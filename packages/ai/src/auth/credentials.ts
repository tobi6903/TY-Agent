import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

interface ClaudeCredentials {
    claudeAiOauth?: {
        accessToken: string
        refreshToken: string
        expiresAt: number
        refreshTokenExpiresAt: number
    }
}

export function readClaudeOAuthToken(): string | undefined {
    const paths = [
        join(homedir(), ".claude", ".credentials.json"),  // native Linux / WSL
    ]

    for (const path of paths) {
        try {
            const raw = readFileSync(path, "utf-8")
            const creds: ClaudeCredentials = JSON.parse(raw)
            const token = creds.claudeAiOauth?.accessToken
            if (!token) continue

            // Check if token is expired
            const expiresAt = creds.claudeAiOauth?.expiresAt ?? 0
            if (Date.now() >= expiresAt) {
                console.warn("Claude Code OAuth token is expired. Re-login with Claude Code.")
                return undefined
            }

            return token
        } catch {
            continue
        }
    }
    return undefined
}

export function isOAuthToken(token: string): boolean {
    return token.includes("sk-ant-oat")
}