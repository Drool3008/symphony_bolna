import type { ReactNode } from 'react'

/**
 * The app's icons, drawn here as small line drawings on a 24-unit grid. The
 * shapes follow the ones the reference client used (a house, a speech
 * bubble, two people, a hand…; ../super-duper-engine-reference/src/PhoneApp.tsx
 * and src/components/AgentChat.tsx), but no icon package is used. Every icon
 * is decorative unless it is given a label.
 */
interface IconProps {
  size?: number
  strokeWidth?: number
  /** Read out to screen readers; without it the icon is hidden from them. */
  label?: string
  className?: string
}

function Icon({
  size = 20,
  strokeWidth = 2,
  label,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {children}
    </svg>
  )
}

export const HouseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z" />
  </Icon>
)

export const BubbleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4a8 8 0 0 0-6.93 12L4 20l4.1-1.06A8 8 0 1 0 12 4z" />
  </Icon>
)

export const PeopleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    <path d="M18 14.4A6 6 0 0 1 21 20" />
  </Icon>
)

export const WalletIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 7V5.5A1.5 1.5 0 0 0 16.5 4H5.5A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5H5.5" />
    <path d="M16 14h.01" />
  </Icon>
)

export const HandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 13.5V6.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M11 11V4.8a1.5 1.5 0 0 1 3 0V11" />
    <path d="M14 11V6.3a1.5 1.5 0 0 1 3 0V14a6.5 6.5 0 0 1-6.5 6.5h-.3a6 6 0 0 1-4.7-2.3l-2.6-3.3a1.5 1.5 0 0 1 2.3-1.9L8 15" />
  </Icon>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)

export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Icon>
)

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.2 12.4 2.6 2.6 5-5.2" />
  </Icon>
)

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 6.5v11" />
    <path d="M14.5 6.5v11" />
  </Icon>
)

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12 20 4.5 16.5 19.5l-5-5.5z" />
    <path d="M11.5 14 20 4.5" />
  </Icon>
)

/** The agent's mark: a large four-point star and a small one. */
export const SparklesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3.5c.7 3.6 2.4 5.3 6 6-3.6.7-5.3 2.4-6 6-.7-3.6-2.4-5.3-6-6 3.6-.7 5.3-2.4 6-6z" />
    <path d="M18 14.5v5" />
    <path d="M15.5 17h5" />
  </Icon>
)

/** A solid four-point star, for the small white disc in the header's status row. */
export const SparkIcon = ({ size = 14, className }: Pick<IconProps, 'size' | 'className'>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M12 2.5c.8 4.6 3 6.9 7.5 7.5-4.5.6-6.7 2.9-7.5 7.5-.8-4.6-3-6.9-7.5-7.5 4.5-.6 6.7-2.9 7.5-7.5z"
      fill="currentColor"
    />
  </svg>
)

export const PillIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.6 19.9a4.9 4.9 0 0 1-6.9-6.9l6.6-6.6a4.9 4.9 0 0 1 6.9 6.9z" />
    <path d="m7 9.7 7.3 7.3" />
  </Icon>
)

export const FlaskIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3.5h6" />
    <path d="M10 3.5v5.8l-5.2 9.1A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.3V3.5" />
    <path d="M7.4 15h9.2" />
  </Icon>
)

export const WarningIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 4.6 2.7 17.8A2 2 0 0 0 4.4 20.8h15.2a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4" />
    <path d="M12 17h.01" />
  </Icon>
)

export const CalendarPlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
    <path d="M3.5 10h17" />
    <path d="M12 12.8v5" />
    <path d="M9.5 15.3h5" />
  </Icon>
)

export const PersonIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
)
