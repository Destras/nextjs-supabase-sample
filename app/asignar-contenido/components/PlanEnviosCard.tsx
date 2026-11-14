'use client'

import { useMemo, type JSX } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ComboboxOption } from '@/components/ui/SearchableCombobox'
import type { Contenido } from '@/app/controllers/Contenido'
import { contenidoLabel } from '@/app/controllers/Contenido'
import { SEMANA_GRID_TEMPLATE, SLOT_KEYS } from '@/app/controllers/Tratamiento'
import type {
  SemanaContenido,
  FrasesPorSemana,
  SlotKey,
} from '@/app/controllers/Tratamiento'
import { SLOT_PRESENTATION } from './slotPresentation'
import { SemanaRow } from './SemanaRow'

interface PlanEnviosCardProps {
  weeks: number
  currentPlan: ReadonlyArray<SemanaContenido>
  contenidosBySlot: Record<SlotKey, ReadonlyArray<Contenido>>
  frasesPorSemana: FrasesPorSemana
  semanasPorNivel: number
  semanasConContenido: number
  totalSemanas: number
  canSave: boolean
  puedeIniciar: boolean
  esSemanaPasada: (semana: number) => boolean
  onIniciar: () => void
  isIniciando: boolean
  isPlanLoading: boolean
  currentWeek: number | null
  pacienteNombre: string | null
  isSaving: boolean
  saveError: string | null
  justSaved: boolean
  onSave: () => Promise<void>
  setSemana: (idx: number, slot: SlotKey, value: string | null) => void
}

const PlanEnviosCard = ({
  weeks,
  currentPlan,
  contenidosBySlot,
  frasesPorSemana,
  semanasPorNivel,
  semanasConContenido,
  totalSemanas,
  canSave,
  puedeIniciar,
  esSemanaPasada,
  onIniciar,
  isIniciando,
  isPlanLoading,
  currentWeek,
  pacienteNombre,
  isSaving,
  saveError,
  justSaved,
  onSave,
  setSemana,
}: PlanEnviosCardProps): JSX.Element => {
  // Map each slot's catalog array to ComboboxOption[] once per catalog
  // (memoized): keeps referential stability so the N SemanaRow children don't
  // re-render on every edit (each setSemana re-renders this card). Iterates
  // SLOT_KEYS (5 slots since new-media-types/PR4) instead of one useMemo per
  // slot, so this stays generic as slots are added/removed.
  const optionsBySlot = useMemo(
    (): Record<SlotKey, ReadonlyArray<ComboboxOption>> =>
      SLOT_KEYS.reduce(
        (acc, key) => ({
          ...acc,
          [key]: contenidosBySlot[key].map((c) => ({
            value: c.id,
            label: contenidoLabel(c),
          })),
        }),
        {} as Record<SlotKey, ReadonlyArray<ComboboxOption>>,
      ),
    [contenidosBySlot],
  )
  return (
    <Card className="mt-5">
      <CardContent className="pt-5">
        {/* Card kicker + title */}
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Contenido semanal
            </p>
            <h3 className="font-display mt-1 text-[20px] font-medium leading-tight tracking-tight text-card-foreground">
              El <em className="font-display italic">plan de env&iacute;os</em>{' '}
              &middot; {weeks} semanas
            </h3>
          </div>
        </div>

        {/* Completeness indicator */}
        <div className="mb-5 rounded-[6px] border border-border bg-background px-4 py-3.5">
          <div className="font-display text-[28px] leading-none text-foreground">
            <em className="not-italic text-brand-accent-500">
              {semanasConContenido}
            </em>
            <span className="text-[18px] text-muted-foreground">
              /{totalSemanas}
            </span>
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Semanas con contenido
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[10px] border border-border">
          {/* Horizontal scroll — ADR-7 (design §9.2): PlanEnviosCard's header
              and each SemanaRow are INDEPENDENT grids that only stay aligned
              because both compute identical column widths from the same
              SEMANA_GRID_TEMPLATE + gap. This is the ONLY horizontal scroll
              container in the whole table — it wraps the header AND the row
              list TOGETHER, so a scrollbar moves both in lockstep. Putting
              overflow-x-auto on individual rows instead would let them scroll
              independently of the header and of each other: instant, visible
              desync. min-w-[1000px] is the floor below which 6 content
              columns + the week label stop rendering usably. It has to stay
              under ~1064px, the width left at 1440px once the fixed sidebar
              and the paddings are taken out: above that the table scrolls
              and hides Frases on the most common screen (BETA-026). */}
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Vertical scroll — wraps the header too so both share the same
                  viewport width: a scrollbar narrows header and rows equally, so
                  columns stay aligned (CON-005). The header stays pinned via sticky. */}
              <div className="max-h-[540px] overflow-y-auto">
                {/* Header (sticky). gap-2 (not gap-3.5) MUST match SemanaRow's
                    row gap exactly — gap contributes to each grid's computed
                    track widths, so a mismatch here would desync the header
                    from the rows even with an identical gridTemplateColumns. */}
                <div
                  className="sticky top-0 z-10 grid items-center gap-2 border-b border-border bg-background px-4 py-3"
                  style={{ gridTemplateColumns: SEMANA_GRID_TEMPLATE }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Semana
                  </span>
                  {SLOT_PRESENTATION.map(
                    ({ slot, Icon, dotClass, headerLabel }) => (
                      <span
                        key={slot}
                        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                          aria-hidden
                        />
                        <Icon size={11} aria-hidden />
                        {headerLabel}
                      </span>
                    ),
                  )}
                </div>

                {isPlanLoading ? (
                  /* Skeleton rows while the plan reloads after a patient switch */
                  <div className="flex flex-col gap-0 px-4 py-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="my-1.5 h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    {currentPlan.map((semana, i) => (
                      <SemanaRow
                        key={semana.semana}
                        semana={semana}
                        idx={i}
                        isNow={
                          currentWeek != null && semana.semana === currentWeek
                        }
                        readOnly={esSemanaPasada(semana.semana)}
                        optionsBySlot={optionsBySlot}
                        frases={frasesPorSemana[semana.semana] ?? []}
                        semanasPorNivel={semanasPorNivel}
                        onChange={setSemana}
                      />
                    ))}
                    {currentPlan.length === 0 && (
                      <div className="px-4 py-10 text-center italic text-muted-foreground">
                        Seleccioná un paciente para ver su plan.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-start justify-between border-t border-border pt-5">
          <span className="text-[13px] text-muted-foreground">
            {justSaved && !saveError ? (
              <span className="flex items-center gap-1.5 text-brand-accent-500">
                <Check size={13} aria-hidden />
                Plan guardado
                {pacienteNombre ? ` para ${pacienteNombre}` : ''}.
                {puedeIniciar ? ' El tratamiento todavía no empezó.' : ''}
              </span>
            ) : saveError ? (
              <span className="text-destructive">{saveError}</span>
            ) : (
              <>
                Contenido en {semanasConContenido} de {totalSemanas} semanas
                {pacienteNombre ? ` para ${pacienteNombre}` : ''}
              </>
            )}
          </span>
          <div className="flex items-center justify-end gap-2">
            {puedeIniciar && (
              <Button
                variant="outline"
                onClick={onIniciar}
                disabled={isSaving || isIniciando}
              >
                {isIniciando ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    Iniciando&hellip;
                  </>
                ) : (
                  'Iniciar tratamiento'
                )}
              </Button>
            )}
            <Button onClick={onSave} disabled={!canSave || isIniciando}>
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Guardando&hellip;
                </>
              ) : (
                <>
                  Guardar
                  <Check size={14} aria-hidden />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { PlanEnviosCard }
export type { PlanEnviosCardProps }
