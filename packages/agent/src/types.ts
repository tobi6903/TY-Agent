import type {
    AssistantMessage,
    AssistantMessageEvent,
    Model,
    Context,
    StreamFunction,
    StreamOptions,
    ToolResultMessage
} from "@ty-agent/ai"

export type ToolExecutionMode = "sequential" | "parallel"

export interface AgentToolCall {
    id: string
    name: string
    arguments: Record<string, any>
}

export interface AgentToolResult {
    toolCallId: string
    toolName: string
    content: string
    isError: boolean
}

export interface AgentTool {
    name: string
    description: string
    parameters: Record<string, unknown>
    executionMode?: ToolExecutionMode
    execute(args: Record<string, any>, signal?: AbortSignal):
        Promise<string>
}

export interface AgentConfig {
    model: Model
    systemPrompt?: string
    tools?: AgentTool[]
    maxTokens?: number
    signal?: AbortSignal
}

export type AgentEvent =
    | { type: "agent_start" }
    | { type: "turn_start" }
    | { type: "message_start"; message: AssistantMessage }
    | { type: "message_update"; event: AssistantMessageEvent; message: AssistantMessage }
    | { type: "tool_start"; toolCall: AgentToolCall }
    | { type: "tool_end"; toolCall: AgentToolCall; result: AgentToolResult }
    | { type: "turn_end"; message: AssistantMessage }
    | { type: "agent_end"; messages: AssistantMessage[] }
    | { type: "error"; error: string }