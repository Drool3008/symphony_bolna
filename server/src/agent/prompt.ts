import { readFileSync } from 'node:fs'
import { fromRoot } from '../config/paths.js'
import type { Runtime } from '../runtime.js'

export const PROMPT_PATH = fromRoot('config/system-prompt.md')

export const readRules = (path = PROMPT_PATH) => readFileSync(path, 'utf8')

/**
 * The rule ids the prompt defines, counted off the prompt itself so the two
 * cannot drift: the reference once had R24 in the prompt and a list that
 * stopped at R23, and every decision citing it was refused (server/tools.js).
 */
export function ruleIds(rules = readRules()): string[] {
  return [...rules.matchAll(/^\*\*(R\d+)\*\*/gm)].map((m) => m[1] as string)
}

/**
 * The system prompt, and the onboarding data under it as data. The backend
 * adds no guidance of its own: the clock comes with each input, and nothing
 * else is said to the model (reference server/agent.js, systemPrompt()).
 */
export function systemPrompt(rt: Runtime, rules = readRules()): string {
  const data = JSON.stringify(rt.onboarding(), null, 2)
  return `${rules}\n\n---\n\n# Onboarding data for this family\n\n\`\`\`json\n${data}\n\`\`\``
}
