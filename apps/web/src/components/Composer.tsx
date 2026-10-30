import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/index.js'
import type { Strings } from '../i18n/format.js'
import { SendIcon } from './icons.js'

/**
 * Typing to the agent. Every line goes to POST /api/input and the server
 * decides what it is (server/src/app.ts): the member's reply if the agent is
 * waiting on them, otherwise a new input. The client never decides. The line
 * comes back on the stream as the member's own message in the thread. The
 * look is the reference's (src/components/AgentChat.tsx): a round field and
 * a round send button.
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
          <input
            type="text"
            value={text}
            placeholder={s.t('message')}
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="composer-send"
          aria-label={s.t('send')}
          aria-busy={sending}
          disabled={sending || text.trim() === ''}
        >
          <SendIcon size={20} />
        </button>
      </div>
    </form>
  )
}
