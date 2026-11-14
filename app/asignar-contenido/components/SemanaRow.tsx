'use client'

import { memo, type JSX } from 'react'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { SearchableCombobox } from '@/components/ui/SearchableCombobox'
import type { ComboboxOption } from '@/components/ui/SearchableCombobox'
import type {
  SemanaContenido,
  FraseDerivada,
  SlotKey,
} from '@/app/controllers/Tratamiento'
import { SEMANA_GRID_TEMPLATE } from '@/app/controllers/Tratamiento'
import { SLOT_PRESENTATION } from './slotPresentation'
import { FrasesSemanaCell } from '@/components/FrasesSemanaCell'

interface SemanaRowProps {
  semana: SemanaContenido
  idx: number
  isNow: boolean
  /** Past week: selectors disabled and the row is marked "Ya pasó". */
  readOnly: boolean
  /** Pre-mapped options (value=id, label=display text) keyed by slot. */
  optionsBySlot: Record<SlotKey, ReadonlyArray<ComboboxOption>>
  /** This row's 3 auto-derived frases (read-only), keyed by semana in the VM. */
  frases: ReadonlyArray<FraseDerivada>
  /** From the VM: Math.ceil(totalWeeks / cantidadNiveles) */
  semanasPorNivel: number
  onChange: (idx: number, slot: SlotKey, value: string | null) => void
}

// Memoized: a plan can have dozens of rows; setSemana replaces only the edited
// row object (others keep identity), and every other prop (options, onChange) is
// referentially stable, so non-edited rows skip re-render on each edit.
const SemanaRow = memo(function SemanaRow({
  semana,
  idx,
  isNow,
  readOnly,
  optionsBySlot,
  frases,
  semanasPorNivel,
  onChange,
}: SemanaRowProps): JSX.Element {
  // Derive nivel from semanasPorNivel (guard: treat 0 as 1 to avoid /0)
  const spn = semanasPorNivel > 0 ? semanasPorNivel : 1
  const nivel = Math.floor(idx / spn) + 1
  const num = String(idx + 1).padStart(2, '0')

  return (
    <div
      className={cn(
        'grid items-center gap-2 border-b border-border px-4 py-[11px] last:border-b-0',
        // even rows get a subtle alternate tint
        idx % 2 !== 0 && 'bg-white/[0.012]',
        // current-week highlight: accent left bar + warm tint (takes priority)
        isNow &&
          'bg-brand-accent-500/[0.06] shadow-[inset_3px_0_0_var(--brand-accent-500)]',
      )}
      style={{ gridTemplateColumns: SEMANA_GRID_TEMPLATE }}
    >
      {/* Semana label */}
      <div>
        <div
          className={cn(
            'font-display text-[18px] leading-tight text-foreground',
            isNow && 'text-brand-accent-500',
          )}
        >
          Semana {num}
        </div>
        {isNow ? (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-brand-accent-500">
            En curso
          </div>
        ) : (
          <div className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
            Nivel {nivel}
          </div>
        )}
        {readOnly && (
          <Badge variant="secondary" className="mt-1">
            Ya pasó
          </Badge>
        )}
      </div>

      {/* Content cells — one per slot, driven by SLOT_PRESENTATION.
          Each cell is a flex row: [combobox (flex-1, truncates)] [preview lane].
          The preview lane is always reserved (w-6, recovered from w-7 in
          new-media-types/PR4 for the 5-slot grid's tighter horizontal budget)
          so combobox widths stay uniform whether or not a slot is filled, and
          the preview never overlaps the input. */}
      {SLOT_PRESENTATION.map(
        ({ slot, tipoParam, comboboxKind, previewKind }) => {
          // The "frases" column is read-only/derived (frasesAutomaticas/epic-1,
          // Task 1.2) — no combobox, no preview link, no completeness check.
          if (slot === 'frases') {
            return (
              <div key={slot} className="min-w-0">
                <FrasesSemanaCell
                  frases={frases}
                  numeroSemana={semana.semana}
                />
              </div>
            )
          }

          const value = semana[slot]
          return (
            <div key={slot} className="flex items-center gap-1">
              <div className="min-w-0 flex-1 rounded-md">
                <SearchableCombobox
                  items={optionsBySlot[slot]}
                  value={value ?? null}
                  onChange={(val) => onChange(idx, slot, val)}
                  placeholder="Sin asignar"
                  disabled={readOnly}
                  ariaLabel={`${comboboxKind ?? slot} semana ${num}`}
                  // No leading icon and tighter padding (BETA-026): the
                  // column header already carries the icon, and in a ~150px
                  // column it left too little room to read "Sin asignar".
                  triggerClassName="gap-1.5 px-2 has-[>svg]:px-2"
                />
              </div>
              <div className="flex w-6 shrink-0 items-center justify-center">
                {value !== null && (
                  <Link
                    href={`/contenido/${value}?tipo=${tipoParam}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver ${previewKind} semana ${num}`}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink size={16} aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          )
        },
      )}
    </div>
  )
})

export { SemanaRow }
export type { SemanaRowProps }
