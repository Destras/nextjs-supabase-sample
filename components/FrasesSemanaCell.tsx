'use client'

import type { JSX } from 'react'
import { ChevronDown, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import type { FraseDerivada } from '@/app/controllers/Tratamiento'

interface FrasesSemanaCellProps {
  readonly frases: ReadonlyArray<FraseDerivada>
  /**
   * Week number this cell belongs to — not in the verbatim spec interface,
   * but required to satisfy the A11y contract ("Ver las 3 frases de la semana
   * N"): the aria-label can't embed a week number it never receives. Logged
   * as a deviation.
   */
  readonly numeroSemana: number
  readonly isLoading?: boolean
}

/**
 * Read-only popover cell for the "frases" grid column (frasesAutomaticas/
 * epic-1, Task 1.2 · DEC-1-1/DEC-1-2). Replaces the SearchableCombobox that
 * used to let the terapeuta pick a frase from a generic catalog — frases are
 * now auto-derived per week from the paciente's causa/algoritmo, so there is
 * nothing to choose. A `Popover` (not `DropdownMenu`) because its content is
 * plain text: no hover/selection states, no checkmarks, no focusable items —
 * nothing here should suggest there is something to pick.
 */
const FrasesSemanaCell = ({
  frases,
  numeroSemana,
  isLoading = false,
}: FrasesSemanaCellProps): JSX.Element => {
  const ariaLabel = `Ver las 3 frases de la semana ${numeroSemana}`

  if (isLoading) {
    return <Skeleton className="h-9 w-full" />
  }

  if (frases.length === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        aria-label={ariaLabel}
        className="flex w-full items-center justify-start gap-2 bg-background text-[13px] font-normal text-muted-foreground"
      >
        <Quote
          size={14}
          className="shrink-0 text-brand-accent-500"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-left">
          Sin frases para esta semana
        </span>
        <ChevronDown className="shrink-0 opacity-50" size={14} aria-hidden />
      </Button>
    )
  }

  const primeraFrase = frases[0]?.texto ?? ''

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className="flex w-full items-center justify-start gap-2 bg-background text-[13px] font-normal"
        >
          <Quote
            size={14}
            className="shrink-0 text-brand-accent-500"
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-left">
            {primeraFrase}
          </span>
          <ChevronDown className="shrink-0 opacity-50" size={14} aria-hidden />
        </Button>
      </PopoverTrigger>

      {/* Plain text, no interactive items — per DEC-1-2, nothing here can look
          pickable: no hover state, no selection state, no checkmarks. */}
      <PopoverContent className="w-80" align="start">
        <ol className="flex flex-col gap-2">
          {frases.map((frase) => (
            <li
              key={frase.orden}
              className="text-[13px] leading-snug text-popover-foreground"
            >
              <span className="mr-1 font-mono text-muted-foreground">
                {frase.orden} &middot;
              </span>
              {frase.texto}
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}

export { FrasesSemanaCell }
export type { FrasesSemanaCellProps }
