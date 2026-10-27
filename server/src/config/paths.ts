import { fileURLToPath } from 'node:url'

/** The repository root. Data paths resolve from here, whichever directory the server was started in. */
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export const fromRoot = (path: string) => fileURLToPath(new URL(path, `file://${ROOT}`))
