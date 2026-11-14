'use client'

import type { JSX, ReactNode } from 'react'
import { Info } from 'lucide-react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

interface SelectableCardProps {
  readonly role: 'radio' | 'checkbox'
  readonly selected: boolean
  readonly onSelect: () => void
  readonly className?: string
  readonly children: ReactNode
  readonly hoverContent?: ReactNode
  readonly disabled?: boolean
}

const SelectableCard = ({
  role,
  selected,
  onSelect,
  className,
  children,
  hoverContent,
  disabled = false,
}: SelectableCardProps): JSX.Element => {
  const trigger = (
    <div
      role={role}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      // Disabled = fuera del orden de tabulación y sin handlers, así el lock es
      // real también por teclado (no solo pointer-events). Visual via tokens.
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'relative rounded-lg border p-3 transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:bg-muted/40',
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect()
              }
            }
      }
    >
      {hoverContent !== undefined && (
        <Info
          aria-hidden
          className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/50"
        />
      )}
      {children}
    </div>
  )

  if (hoverContent === undefined) return trigger

  return (
    <HoverCard openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent className="w-80" side="top" collisionPadding={16}>
        {hoverContent}
      </HoverCardContent>
    </HoverCard>
  )
}

export { SelectableCard }
export type { SelectableCardProps }
