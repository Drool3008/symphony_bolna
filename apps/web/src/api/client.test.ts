import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApi } from './client.js'

function answering(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

describe('the API client', () => {
  it('sends every request to the base, with the headers it is given', async () => {
    const fetch = answering(200, { members: [] })
    const api = createApi({ base: 'http://lan:8787', fetch, headers: () => ({ 'X-Member-Id': 'rp' }) })
    await api.members()
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://lan:8787/api/members')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['X-Member-Id']).toBe('rp')
  })

  it('posts a JSON body', async () => {
    const fetch = answering(200, { ok: true, as: 'input' })
    const api = createApi({ base: '', fetch })
    const res = await api.input({ text: 'Her tablets are low' })
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ text: 'Her tablets are low' }))
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(res.as).toBe('input')
  })

  it("passes on the server's own reason when it refuses", async () => {
    const api = createApi({ base: '', fetch: answering(409, { error: 'that card is already answered' }) })
    const err = await api.reply({ message_id: 'm1', action: 'Approve' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ kind: 'refused', status: 409, reason: 'that card is already answered' })
  })

  it('says the server answered with a status when the body is not its JSON', async () => {
    const api = createApi({ base: '', fetch: answering(502, '<html>Bad gateway</html>') })
    await expect(api.members()).rejects.toMatchObject({ kind: 'refused', status: 502 })
  })

  it('says the app is offline when the server cannot be reached', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const api = createApi({ base: '', fetch })
    await expect(api.members()).rejects.toMatchObject({ kind: 'offline', status: null })
  })

  it('puts a member id into the path safely', async () => {
    const fetch = answering(200, {})
    await createApi({ base: '', fetch }).home('member_3')
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('/api/members/member_3/home')
  })
})
