import Anthropic from "@anthropic-ai/sdk";

import type {
    Api,
    AssistantMessage,
    Context,
    Message,
    Model,
    StopReason,
    StreamFunction,
    StreamOptions,
    TextContent,
    ThinkingContent,
    ToolCall,
    ToolResultMessage,
} from "../types.ts"
import { AssistantMessageEventStream } from "../utils/event-stream.js";

function convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = []

    for (const msg of messages) {
        if (msg.role === "user") { // input to user
            const content = typeof msg.content === "string"
                ? msg.content  // only string
                : msg.content.map(block =>
                    block.type === "text"
                        ? { type: "text" as const, text: block.text }
                        : {
                            type: "image" as const,
                            source: {
                                type: "base64" as const,
                                media_type: block.mimeType as "image/jpeg" | "image/png",
                                data: block.data,
                            },
                        }
                )

            result.push({ role: "user", content })

        } else if (msg.role === "assistant") {
            const blocks: Anthropic.ContentBlockParam[] = []
            for (const block of msg.content) {
                if (block.type === "text") {
                    blocks.push({ type: "text", text: block.text })
                } else if (block.type === "thinking") {
                    blocks.push({
                        type: "thinking",
                        thinking: block.thinking,
                        signature: (block as any).thinkingSignature ?? "",
                    } as any)
                } else if (block.type === "toolCall") {
                    blocks.push({
                        type: "tool_use",
                        id: block.id,
                        name: block.name,
                        input: block.arguments ?? {}
                    })
                }
            }

            if (blocks.length > 0) result.push({ role: "assistant", content: blocks })

        } else if (msg.role === "toolResult") {
            result.push({
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: msg.toolCallId,
                        content: msg.content.map(c => ({
                            type: "text" as const,
                            text: (c as TextContent).text
                        })),
                        is_error: msg.isError
                    },
                ],
            })
        }
    }

    return result
}


function convertTools(tools: Context["tools"]): Anthropic.Tool[] {
    if (!tools || tools.length === 0) return []

    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
            type: "object" as const,
            ...(tool.parameters as any),
        }
    }))
}

//Antropic to ours
function mapStopReason(reason: String): StopReason {
    switch (reason) {
        case "end_turn": return "stop"
        case "max_tokens": return "length"
        case "tool_use": return "toolUse"
        default: return "stop"
    }
}

export const stream: StreamFunction = (
    model: Model,
    context: Context,
    options?: StreamOptions
): AssistantMessageEventStream => {
    const eventStream = new AssistantMessageEventStream()

        ; (async () => {

            const output: AssistantMessage = {
                role: "assistant",
                content: [],
                api: model.api as Api,
                provider: model.provider,
                model: model.id,
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
                },
                stopReason: "pending",
                timestamp: Date.now(),
            }

            try {
                const apiKey = process.env.ANTHROPIC_API_KEY
                if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")

                const client = new Anthropic({ apiKey: apiKey, baseURL: model.baseUrl })

                eventStream.push({ type: "start", partial: output })

                const sdkStream = await client.messages.create({
                    model: model.id,
                    system: context.systemPrompt,
                    messages: convertMessages(context.messages),
                    tools: convertTools(context.tools),
                    max_tokens: options?.maxTokens ?? model.maxTokens,
                    stream: true,
                }, {
                    signal: options?.signal
                    //signal is an AbortSignal — a standard JavaScript mechanism to cancel an in-progress async operation.
                })
            }
        })
    return []
}