import { PRODUCT_NAME } from '@family-health/shared'
import { useId } from 'react'
import { PersonIcon, SparklesIcon } from './icons.js'
import './brand.css'

/**
 * Who is who, at a glance, the reference's one rule
 * (../super-duper-engine-reference/src/components/brand.tsx): the agent is
 * violet with a sparkle on the brand gradient, and says it is AI; people are
 * a flat colour with their initials; a person deciding is amber. Every piece
 * here is drawn anew for this client.
 */

/**
 * The logo mark: a care shield with a pulse line on the brand gradient, and a
 * small warm dot. `decorative` hides it from screen readers where the product
 * name is written beside it.
 */
export function LogoMark({ size = 32, decorative = false }: { size?: number; decorative?: boolean }) {
  const gradient = `logo-${useId().replace(/:/g, '')}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className="logo-mark"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': PRODUCT_NAME })}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--color-brand-1)' }} />
          <stop offset="0.48" style={{ stopColor: 'var(--color-brand-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-brand-3)' }} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradient})`} />
      <path
        d="M20 8 11.5 11.6v6.6c0 5.5 3.6 10.2 8.5 11.8 4.9-1.6 8.5-6.3 8.5-11.8v-6.6z"
        fill="#ffffff"
        fillOpacity="0.18"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14 19.8h3.2l1.8-3.8 2.6 7.4 1.9-3.6H26"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30.5" cy="9.5" r="3.2" fill="#fde68a" stroke="#ffffff" strokeWidth="1.4" />
    </svg>
  )
}

/** The agent's face: the gradient, a sparkle, and a ring, so it never reads as a person. */
export function AgentAvatar({ size = 40 }: { size?: number }) {
  return (
    <span className="agent-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <SparklesIcon size={Math.round(size * 0.55)} strokeWidth={2.2} />
    </span>
  )
}

/** Person avatar tones, from the reference's brand.tsx. */
const TONES = ['#0F766E', '#B45309', '#BE185D', '#1D4ED8', '#7C2D12', '#15803D'] as const

/** A person's tone: the sum of the name's character codes, mod 6. */
export function toneFor(name: string): string {
  const sum = [...name].reduce((total, ch) => total + ch.charCodeAt(0), 0)
  return TONES[sum % TONES.length] as string
}

/** Up to two initials, from the first letters of the first two words. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

/** A person: flat colour and initials, never a sparkle. */
export function PersonAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const letters = initials(name)
  return (
    <span
      className="person-avatar"
      style={{ width: size, height: size, background: toneFor(name), fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {letters || <PersonIcon size={Math.round(size * 0.5)} />}
    </span>
  )
}

/** The "AI" chip, on anything the agent produced. */
export function AiTag({ label = 'AI' }: { label?: string }) {
  return (
    <span className="tag tag-ai">
      <SparklesIcon size={12} strokeWidth={2.5} />
      {label}
    </span>
  )
}

/** The "Human" chip, on a person's decision. */
export function HumanTag({ label }: { label: string }) {
  return (
    <span className="tag tag-human">
      <PersonIcon size={12} strokeWidth={2.5} />
      {label}
    </span>
  )
}
