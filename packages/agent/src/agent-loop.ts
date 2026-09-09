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