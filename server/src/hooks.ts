/** A list of callbacks to run when something happens. */
export class Hook<Args extends unknown[] = []> {
  private readonly listeners = new Set<(...args: Args) => void>()

  on(listener: (...args: Args) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  fire(...args: Args): void {
    for (const listener of this.listeners) listener(...args)
  }
}

/** Pieces of the sync event, each from the module that knows it. */
export class SyncParts {
  private readonly parts = new Map<string, () => unknown>()

  provide(key: string, read: () => unknown): void {
    this.parts.set(key, read)
  }

  read(): Record<string, unknown> {
    return Object.fromEntries([...this.parts].map(([key, read]) => [key, read()]))
  }
}
