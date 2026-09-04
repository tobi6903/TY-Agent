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
import { AssistantMessageEventStream, EventStream } from "../utils/event-stream.js";

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
function mapStopReason(reason: string): StopReason {
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
                type Block = (TextContent | ThinkingContent | (ToolCall & { partialJson: string })) & { index: number }

                const blocks = output.content as Block[]
                for await (const event of sdkStream) {
                    if (event.type === "message_start") {
                        output.usage.input = event.message.usage.input_tokens ?? 0
                        output.usage.output = event.message.usage.output_tokens ?? 0
                        output.usage.cacheRead = event.message.usage.cache_read_input_tokens ?? 0
                        output.usage.cacheWrite = event.message.usage.cache_creation_input_tokens ?? 0
                        output.usage.totalTokens = output.usage.input + output.usage.output
                    } else if (event.type === "content_block_start") {
                        if (event.content_block.type === "text") {
                            const block: Block = { type: "text", text: "", index: event.index }
                            output.content.push(block)
                            eventStream.push({
                                type: "text_delta", contentIndex: output.content.length - 1,
                                delta: "", partial: output
                            })
                        } else if (event.content_block.type === "thinking") {
                            const block: Block = { type: "thinking", thinking: "", index: event.index }
                            output.content.push(block)
                            eventStream.push({ type: "thinking_delta", contentIndex: output.content.length - 1, delta: "", partial: output })
                        } else if (event.content_block.type === "tool_use") {
                            const block: Block = {
                                type: "toolCall",
                                id: event.content_block.id,
                                name: event.content_block.name,
                                arguments: {},
                                partialJson: "",
                                index: event.index,
                            }
                            output.content.push(block)
                            eventStream.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output })
                        }
                    } else if (event.type === "content_block_delta") {
                        const idx = blocks.findIndex(b => b.index === event.index)
                        const block = blocks[idx]

                        if (event.delta.type === "text_delta" && block?.type === "text") {
                            block.text += event.delta.text
                            eventStream.push({
                                type: "text_delta", contentIndex: idx,
                                delta: event.delta.text, partial: output
                            })
                        } else if (event.delta.type === "thinking_delta" && block?.type === "thinking") {
                            block.thinking += event.delta.thinking
                            eventStream.push({ type: "thinking_delta", contentIndex: idx, delta: event.delta.thinking, partial: output })

                        } else if (event.delta.type === "input_json_delta" && block?.type === "toolCall") {
                            block.partialJson += event.delta.partial_json
                            try {
                                block.arguments = JSON.parse(block.partialJson)
                            }
                            catch {/*partial*/ }
                            eventStream.push({ type: "toolcall_delta", contentIndex: idx, delta: event.delta.partial_json, partial: output })
                        }
                    } else if (event.type === "content_block_stop") {
                        const idx = blocks.findIndex(b => b.index === event.index)
                        const block = blocks[idx]
                        if (!block) continue

                        delete (block as any).index
                        if (block.type === "toolCall") {
                            try { block.arguments = JSON.parse(block.partialJson) } catch { /* use last partial */ }
                            delete (block as any).partialJson
                            eventStream.push({ type: "toolcall_end", contentIndex: idx, toolCall: block, partial: output })
                        }

                    } else if (event.type === "message_delta") {
                        if (event.delta.stop_reason) {
                            output.stopReason = mapStopReason(event.delta.stop_reason)
                        }
                        if (event.usage?.output_tokens != null) {
                            output.usage.output = event.usage.output_tokens
                            output.usage.totalTokens = output.usage.input + output.usage.output
                        }
                    }

                }
                if (output.stopReason === "pending") {
                    throw new Error("Stream ended without a stop reason")
                }

                eventStream.push({ type: "done", reason: output.stopReason as any, message: output })
                eventStream.end(output)
            } catch (error) {
                for (const block of output.content) {
                    delete (block as any).index
                    delete (block as any).partialJson
                }
                output.stopReason = options?.signal?.aborted ? "aborted" : "error"
                output.errorMessage = error instanceof Error ? error.message : String(error)
                eventStream.push({ type: "error", reason: output.stopReason as any, error: output })
                eventStream.end(output)
            }

            // We keep on calling agent loop till reaches "end turn"


        })()
    return eventStream

}