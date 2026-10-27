import type { NextFunction, Request, Response } from 'express'
import type { z } from 'zod'

/** An error a request caused, with the status and the words to send back. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** The request body, checked. A bad body is a 400 that names each field that is wrong. */
export function bodyOf<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  const parsed = schema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
    throw new HttpError(400, lines.join('; '))
  }
  return parsed.data
}

/** Last in the chain: an HttpError goes back as JSON with its status; anything else is a 500. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  res.status(500).json({ error: (err as Error).message ?? 'something went wrong' })
}
