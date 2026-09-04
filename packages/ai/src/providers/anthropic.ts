import type { Model, Provider } from "../types";
import { stream } from "../api/anthropic-messages"

const ANTHROPIC_MODELS: Model<"anthropic-messages">[] = [
    {
        id: "claude-sonnet-5-20251101",
        name: "Claude Sonnet 5",
        api: "anthropic-messages",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        contextWindow: 200_000,
        maxTokens: 16_000,
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    },

    // ---- Claude Opus 5 (most capable) ----
    {
        id: "claude-opus-5-20251101",
        name: "Claude Opus 5",
        api: "anthropic-messages",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        contextWindow: 200_000,
        maxTokens: 32_000,
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
    },

    // ---- Claude Haiku 4.5 (fastest, cheapest) ----
    {
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
        api: "anthropic-messages",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        contextWindow: 200_000,
        maxTokens: 16_000,
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0.80, output: 4.00, cacheRead: 0.08, cacheWrite: 1.00 },
    },

    // ---- Claude Sonnet 4.6 (stable, widely used) ----
    {
        id: "claude-sonnet-4-6-20250514",
        name: "Claude Sonnet 4.6",
        api: "anthropic-messages",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        contextWindow: 200_000,
        maxTokens: 16_000,
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    },

    // ---- Claude Opus 4.1 (reasoning, previous gen) ----
    {
        id: "claude-opus-4-1-20250514",
        name: "Claude Opus 4.1",
        api: "anthropic-messages",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        contextWindow: 200_000,
        maxTokens: 32_000,
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
    },

    // ---- Claude Haiku 3.5 (ultra cheap, fast) ----
    {
        id: "claude-haiku-3-5-20241022",
        name: "Claude Haiku 3.5",
        api: "anthropic-messages",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        contextWindow: 200_000,
        maxTokens: 8_000,
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0.80, output: 4.00, cacheRead: 0.08, cacheWrite: 1.00 },
    },
]

export function anthropicProvider(): Provider<"anthropic-messages"> {
    return {
        id: "anthropic",
        name: "Anthropic",
        models: ANTHROPIC_MODELS,
        stream(model, context, options) {
            return stream(model, context, options)
        }
    }
}

export function getAnthropicModel(id: string): Model<"anthropic-messages"> {
    const model = ANTHROPIC_MODELS.find(m => m.id === id)
    if (!model) throw new Error(`Unknown Anthropic model: ${id}`)
    return model
}