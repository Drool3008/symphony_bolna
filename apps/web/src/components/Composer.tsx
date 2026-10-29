import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/index.js'
import type { Strings } from '../i18n/format.js'

/**
 * Typing to the agent. Every line goes to POST /api/input and the server
 * decides what it is (server/src/app.ts): the member's reply if the agent is
 * waiting on them, otherwise a new input. The client never decides. The line
 * comes back on the stream as the member's own message in the thread.
 */
export function Composer({ s }: { s: Strings }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function send(event: FormEvent) {
    event.preventDefault()
    const line = text.trim()
    if (!line || sending) return
    setSending(true)
    setProblem(null)
    try {
      await api.input({ text: line })
      setText('')
    } catch (err) {
      setProblem(err instanceof ApiError ? err.reason : s.t('offline'))
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="composer" onSubmit={(e) => void send(e)}>
      {problem && (
        <p className="composer-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="composer-row">
        <label className="composer-field">
          <span className="visually-hidden">{s.t('message')}</span>
          <textarea
            rows={1}
            value={text}
            placeholder={s.t('message')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) void send(e)
            }}
          />
        </label>
        <button type="submit" className="button" disabled={sending || text.trim() === ''}>
          {sending ? s.t('sending') : s.t('send')}
        </button>
      </div>
    </form>
  )
}
