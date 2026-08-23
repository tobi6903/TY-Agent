
export class EventStream<T, R = T> implements AsyncIterable<T> {
    private queue: T[] = []
    private resolve: (() => void) | null = null
    private done = false
    private resultValue: R | undefined
    private resultError: unknown

    push(event: T): void {
        if (this.done) throw new Error("Cannot push to a closed EventStream")
        this.queue.push(event)
        this.resolve?.()
        this.resolve = null
    }

    end(result?: R): void {
        this.done = true
        this.resultValue = result
        this.resolve?.()
        this.resolve = null
    }

    error(err: unknown): void {
        this.done = true
        this.resultError = err
        this.resolve?.()
        this.resolve = null
    }

    result(): Promise<R> {
        return new Promise((resolve, reject) => {
            const check = () => {
                if (this.resultError !== undefined)
                    reject(this.resultError)
                else resolve(this.resultValue as R)
            }

            if (this.done) {
                check()
            }
            else {
                const prev = this.resolve
                this.resolve = () => { prev?.(); check() }
            }
        })
    }

    // * generator
    async *[Symbol.asyncIterator](): AsyncIterator<T> { //this object is async-iterable.
        while (true) {
            while (this.queue.length > 0) {
                yield this.queue.shift()!
            }

            if (this.done) break

            await new Promise<void>((resolve) => {
                const prev = this.resolve
                this.resolve = () => { prev?.(); resolve() }
            })
        }
        while (this.queue.length > 0) {
            yield this.queue.shift()!
        }
    }
}

import type { AssistantMessage, AssistantMessageEvent } from "../types"

export class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> { }