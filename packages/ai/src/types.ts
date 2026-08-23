
export type KnownApi = "anthropic-messages" | "openai-completions"
export type Api = KnownApi | (string & {}) //also preserves KnownApi

export type KnownProvider = "anthropic" | "openai"
export type ProviderId = KnownProvider | string //basically a string

export type StopReason = "pending" | "stop" | "length" | "toolUse" | "error" | "aborted"


export interface TextContent {
    type: "text"
    text: string
}


export interface ThinkingContent {
    type: "thinking"
    thinking: string

}

export interface ImageContent {
    type: "image"
    data: string //base64
    mimeType: string //image/jpg application/json 
}

export interface ToolCall {
    type: "toolCall"
    id: string
    name: string
    arguments: Record<string, any>
}

export interface Usage {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    totalTokens: number
    cost: {
        input: number
        output: number
        cacheRead: number
        cacheWrite: number
        total: number
    }
}

export interface UserMessage {
    role: "user"
    content: string | (TextContent | ImageContent)[]
    timestamp: number
}

export interface AssistantMessage {
    role: "assistant"
    content: (TextContent | ThinkingContent | ToolCall)[]
    api: Api
    provider: ProviderId
    model: string
    usage: Usage
    stopReason: StopReason
    errorMessage?: string
    timestamp: number
}

export interface ToolResultMessage {
    role: "toolResult"
    toolCallId: string
    toolName: string
    content: (TextContent | ImageContent)[]
    isError: boolean
    timestamp: number
}

export type Message = UserMessage | AssistantMessage | ToolResultMessage

export interface Tool {
    name: string
    description: string
    parameters: Record<string, unknown>
}

export interface Context {
    systemPrompt?: string
    messages: Message[]
    tools?: Tool[]
}

export interface StreamOptions {
    signal?: AbortSignal
    maxTokens?: number
    temperature?: number
}

export type AssistantMessageEvent =
    | { type: "start"; partial: AssistantMessage }
    | { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
    | { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
    | { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
    | { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
    | { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
    | { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: AssistantMessage }
    | { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage }


export type StreamFunction = (
    model: Model,
    context: Context,
    options?: StreamOptions
) => AsyncIterable<AssistantMessageEvent>

export interface ModelCost {
    input: number     // $/million tokens
    output: number
    cacheRead: number
    cacheWrite: number
}

export interface Model<TApi extends Api = Api> {
    id: string
    name: string
    api: TApi
    provider: ProviderId
    baseUrl: string
    contextWindow: number
    maxTokens: number
    cost: ModelCost
    input: ("text" | "image")[]
    reasoning: boolean
}

export interface Provider<TApi extends Api = Api> {
    id: ProviderId
    name: string
    models: Model<TApi>[]
    stream(model: Model<TApi>, context: Context, options?: StreamOptions):
        AsyncIterable<AssistantMessageEvent>
}

