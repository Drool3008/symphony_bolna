import { expect, it } from 'vitest'
import { apiUrl } from './base.js'

it('keeps paths on the page origin when no base is set', () => {
  expect(apiUrl('/api/members', '')).toBe('/api/members')
})

it('puts a configured base in front of every path, with one slash between', () => {
  expect(apiUrl('/api/members', 'http://192.168.1.20:8787')).toBe('http://192.168.1.20:8787/api/members')
  expect(apiUrl('events', 'https://family.example')).toBe('https://family.example/events')
})
