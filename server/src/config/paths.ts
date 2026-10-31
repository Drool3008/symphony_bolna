import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repository root. Data paths resolve from here, whichever directory the server was started in. */
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/** A path from the root, or an absolute one as given: `C:\…` on Windows, and a root holding `#` or `%`, as well. */
export const fromRoot = (path: string) => resolve(ROOT, path)
