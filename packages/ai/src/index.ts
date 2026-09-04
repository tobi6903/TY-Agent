// packages/ai/src/index.ts

//types
export type {
    Api,
    KnownApi,
    ProviderId,
    KnownProvider,
    StopReason,
    TextContent,
    ThinkingContent,
    ImageContent,
    ToolCall,
    Usage,
    UserMessage,
    AssistantMessage,
    ToolResultMessage,
    Message,
    Tool,
    Context,
    StreamOptions,
    AssistantMessageEvent,
    StreamFunction,
    ModelCost,
    Model,
    Provider,
} from "./types"

// Event stream
export { EventStream, AssistantMessageEventStream } from "./utils/event-stream"

// Anthropic provider
export { anthropicProvider, getAnthropicModel } from "./providers/anthropic"

// Anthropic stream function (if someone wants to use it directly)
export { stream as anthropicStream } from "./api/anthropic-messages"