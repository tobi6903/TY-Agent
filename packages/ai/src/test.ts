import { anthropicProvider, getAnthropicModel } from "./providers/anthropic.js"

const provider = anthropicProvider()
const model = getAnthropicModel("claude-haiku-4-5-20251001")

const stream = provider.stream(model, {
    systemPrompt: "You are a helpful assistant.",
    messages: [{ role: "user", content: "Hi , how are you ?", timestamp: Date.now() }],
})

for await (const event of stream) {
    if (event.type === "text_delta") process.stdout.write(event.delta)
    if (event.type === "done") console.log("\n✓ done:", event.message.stopReason)
    if (event.type === "error") console.error("✗ error:", event.error.errorMessage)
}