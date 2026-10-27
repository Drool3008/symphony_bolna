import { readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import type { Runtime } from './runtime.js'
import { deliverInput } from './agent/inbox.js'
import { loadFamilyHistory, MEDIA_DIR } from './domain/history.js'
import { HttpError } from './http.js'
import type { ImagePart } from './store/history.js'

/**
 * A member forwards a record from a family chat to the agent (reference
 * server/index.js, POST /api/forward). The agent only ever sees what somebody
 * chose to send it; it never reads the chats itself (R2).
 *
 * Proposal: the record is named by its chat and message id and the server
 * finds the file itself, rather than taking a file path from the client, so a
 * forward can only ever send a record that is in the history.
 */
export function forwardRecord(
  rt: Runtime,
  from: string,
  request: { chat_id: string; message_id: string; caption?: string | undefined; note?: string | undefined },
): void {
  const chat = loadFamilyHistory().chats.find((c) => c.id === request.chat_id)
  const message = chat?.messages.find((m) => m.id === request.message_id)
  if (!chat || !message)
    throw new HttpError(404, `no message ${request.message_id} in chat ${request.chat_id}`)
  const media = message.media
  if (!media) throw new HttpError(400, 'that message carries no record to forward')

  // A PDF goes as its page-1 image, since that is what the model can read.
  const path = media.type === 'pdf' ? media.thumb : media.src
  const images: ImagePart[] = []
  if (path) {
    const file = normalize(join(MEDIA_DIR, path.replace(/^\/media\//, '')))
    if (!file.startsWith(MEDIA_DIR)) throw new HttpError(400, 'that record is not in the media folder')
    images.push({ mime: 'image/png', data: readFileSync(file).toString('base64'), name: media.name })
  }

  const name = rt.onboarding().family.members.find((m) => m.id === from)?.name ?? from
  const type = media.type === 'pdf' ? 'PDF' : 'photo'
  deliverInput(
    rt,
    {
      kind: 'forwarded_record',
      source: `Forwarded by ${name} from ${chat.name} · ${type} · original date ${message.at.slice(0, 10)}`,
      from,
      document: { type: media.type, name: media.name, pages: media.pages ?? 1 },
      caption_from_forwarder: request.caption ?? null,
      note_from_forwarder: request.note ?? null,
      original_date: message.at,
    },
    images,
    { ...media, caption: request.caption ?? null, note: request.note ?? null, from },
  )
}
