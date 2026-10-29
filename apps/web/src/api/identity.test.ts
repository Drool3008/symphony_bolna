import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chooseMember,
  chosenMember,
  forgetMember,
  identityHeaders,
  resetIdentityForTests,
} from './identity.js'

beforeEach(() => {
  window.localStorage.clear()
  resetIdentityForTests()
})
afterEach(() => vi.restoreAllMocks())

describe('who is asking', () => {
  it('names nobody until a member is picked', () => {
    expect(chosenMember()).toBeNull()
    expect(identityHeaders()).toEqual({})
  })

  it('sends the picked member in X-Member-Id', () => {
    chooseMember('patient')
    expect(identityHeaders()).toEqual({ 'X-Member-Id': 'patient' })
  })

  it('remembers the pick across a reload, and only the id', () => {
    chooseMember('rp')
    resetIdentityForTests()
    expect(chosenMember()).toBe('rp')
    expect(Object.keys(window.localStorage)).toEqual(['member-id'])
  })

  it('forgets the pick', () => {
    chooseMember('member_3')
    forgetMember()
    resetIdentityForTests()
    expect(chosenMember()).toBeNull()
  })

  it('still works for the session when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(chosenMember()).toBeNull()
    chooseMember('rp')
    expect(identityHeaders()).toEqual({ 'X-Member-Id': 'rp' })
  })
})
