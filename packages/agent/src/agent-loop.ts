import type {
    AgentConfig,
    AgentEvent,
    AgentTool,
    AgentToolCall,
    AgentToolResult
} from "./types.js"

import type {
    AssistantMessage,
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
    signal: AbortSignal,
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

