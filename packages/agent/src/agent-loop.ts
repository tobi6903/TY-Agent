import type {
    AgentConfig,
    AgentEvent,
    AgentTool,
    AgentToolCall,
    AgentToolResult
} from "./types.js"

import type {
    AssistantMessage,
    AssistantMessageEvent,
    Context,
    Message,
    TextContent,
    ToolCall,
    ToolResultMessage,
} from "@ty-agent/ai"

type Emit = (event: AgentEvent) => void


function buildContext(
    messages: Message[],
    config: AgentConfig
): Context {
    return {
        systemPrompt: config.systemPrompt,
        messages,
        tools: config.tools?.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }))
    }
}

async function executeTool(
    toolCall: AgentToolCall,
    tools: AgentTool[],
    signal?: AbortSignal,
): Promise<AgentToolResult> {
    const tool = tools.find(t => t.name === toolCall.name)

    if (!tool) {
        return {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: `Tool "${toolCall.name}" not found`,
            isError: true,
        }
    }

    try {
        const content = await tool.execute(toolCall.arguments, signal)
        return { toolCallId: toolCall.id, toolName: toolCall.name, content, isError: false }
    } catch (err) {
        return {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: err instanceof Error ? err.message : String(err),
            isError: true,
        }
    }
}

async function executeToolCalls(
    toolCalls: AgentToolCall[],
    tools: AgentTool[],
    emit: Emit,
    signal?: AbortSignal
): Promise<ToolResultMessage[]> {

    const hasSequential = toolCalls.some(tc => {
        const tool = tools.find(t => t.name === tc.name)
        return tool?.executionMode === "sequential"
    })

    for (const tc of toolCalls) {
        emit({ type: "tool_start", toolCall: tc })
    }

    let results: AgentToolResult[]

    if (hasSequential) {
        results = []
        for (const tc of toolCalls) {
            const result = await executeTool(tc, tools, signal)
            emit({ type: "tool_end", toolCall: tc, result })
            results.push(result)
        }
    } else {
        results = await Promise.all(
            toolCalls.map(async tc => {
                const result = await executeTool(tc, tools, signal)
                emit({ type: "tool_end", toolCall: tc, result })
                return result
            })
        )
    }

    return results.map(r => ({
        role: "toolResult" as const,
        toolCallId: r.toolCallId,
        toolName: r.toolName,
        content: [{ type: "text" as const, text: r.content }],
        isError: r.isError,
        timestamp: Date.now(),
    }))
}


export async function agentLoop(
    userMessage: string,
    config: AgentConfig,
    streamFn: (model: any, context: Context, options?: any) =>
        AsyncIterable<AssistantMessageEvent>,
    emit: Emit
): Promise<AssistantMessage[]> {

    const messages: Message[] = [
        { role: "user", content: userMessage, timestamp: Date.now() },
    ]

    const allAssistantMessages: AssistantMessage[] = []

    emit({ type: "agent_start" })

    while (true) {
        emit({ type: "turn_start" })

        const context = buildContext(messages, config)

        const eventStream = streamFn(config.model, context, {
            maxTokens: config.maxTokens,
            signal: config.signal
        })

        let assistantMessage: AssistantMessage | null = null

        for await (const event of eventStream) {
            if (event.type === "start") {
                assistantMessage = event.partial
                emit({ type: "message_start", message: assistantMessage })

            } else if (
                event.type === "text_delta" ||
                event.type === "thinking_delta" ||
                event.type === "toolcall_start" ||
                event.type === "toolcall_delta" ||
                event.type === "toolcall_end"
            ) {
                assistantMessage = event.partial
                emit({ type: "message_update", event, message: assistantMessage })

            } else if (event.type === "done") {
                assistantMessage = event.message

            } else if (event.type === "error") {
                assistantMessage = event.error
                emit({ type: "error", error: assistantMessage.errorMessage ?? "Unknown error" })
                emit({ type: "agent_end", messages: allAssistantMessages })

                return allAssistantMessages
            }
        }
        if (!assistantMessage) break

        messages.push(assistantMessage)
        allAssistantMessages.push(assistantMessage)

        emit({ type: "turn_end", message: assistantMessage })

        if (assistantMessage.stopReason === "stop" ||
            assistantMessage.stopReason === "length") {
            break
        }
        if (assistantMessage.stopReason === "toolUse") {
            const toolCalls = assistantMessage.content
                .filter(c => c.type === "toolCall")
                .map(c => c as AgentToolCall)

            if (toolCalls.length === 0) break

            const toolResultMessages = await executeToolCalls(
                toolCalls,
                config.tools ?? [],
                emit,
                config.signal,
            )

            for (const result of toolResultMessages) {
                messages.push(result)
            }
            continue
        }
        break

    }

    emit({ type: "agent_end", messages: allAssistantMessages })
    return allAssistantMessages
}



