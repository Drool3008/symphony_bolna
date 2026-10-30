import { expect, it } from 'vitest'
import { stringsFor } from '../i18n/format.js'
import { statusKey } from './Shell.js'

it('says the agent is working while it thinks, else its stage, else that it is here', () => {
  const s = stringsFor('en-IN')
  expect(s.t(statusKey({ thinking: true, stage: 6 }))).toBe('Working on it…')
  expect(s.t(statusKey({ thinking: false, stage: 1 }))).toBe('Watching your medicines and test dates')
  expect(s.t(statusKey({ thinking: false, stage: 12 }))).toBe('Here if you need me')
  expect(s.t(statusKey(undefined))).toBe('Here if you need me')
  expect(stringsFor('te-IN').t(statusKey({ thinking: false, stage: 5 }))).toBe('ఎంత అత్యవసరమో చూస్తున్నాను')
})
