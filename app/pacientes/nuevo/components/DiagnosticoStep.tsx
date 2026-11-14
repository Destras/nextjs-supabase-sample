'use client'

import type { JSX } from 'react'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AllDiagnosticos } from '@/app/controllers/Diagnostico'
import type { FormState } from '../controllers'
import { SelectableCard } from './SelectableCard'

const ETAPA_GLYPHS = ['①', '②', '③', '④'] as const

interface EtapaLike {
  readonly numeroEtapa: number
  readonly fraseEsperada: string
}

const EtapasList = ({
  etapas,
}: {
  readonly etapas: ReadonlyArray<EtapaLike>
}): JSX.Element | null => {
  if (etapas.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      <div className="eyebrow text-muted-foreground">Etapas esperadas</div>
      <ul className="space-y-1.5 text-xs leading-relaxed text-foreground">
        {etapas.map((e) => (
          <li key={e.numeroEtapa} className="flex gap-2">
            <span
              aria-hidden
              className="shrink-0 font-mono text-muted-foreground"
            >
              {ETAPA_GLYPHS[e.numeroEtapa - 1] ?? `${e.numeroEtapa}.`}
            </span>
            <span>{e.fraseEsperada}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface DiagnosticoStepProps {
  readonly diagnostico: FormState['diagnostico']
  readonly errores: Readonly<Record<string, string>>
  readonly causas: AllDiagnosticos['causa']
  readonly bloqueos: AllDiagnosticos['bloqueos']
  readonly algoritmos: AllDiagnosticos['algoritmo']
  readonly onSelectCausa: (id: string) => void
  readonly onToggleBloqueo: (id: string) => void
  readonly onSelectAlgoritmo: (id: string) => void
  readonly disabled?: boolean
}

const DiagnosticoStep = ({
  diagnostico,
  errores,
  causas,
  bloqueos,
  algoritmos,
  onSelectCausa,
  onToggleBloqueo,
  onSelectAlgoritmo,
  disabled = false,
}: DiagnosticoStepProps): JSX.Element => {
  return (
    <div className="flex flex-col gap-6">
      {/* Causa raíz — full-width card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardDescription className="eyebrow text-muted-foreground">
                Causa raíz
              </CardDescription>
              <CardTitle className="mt-1 text-lg">
                Seleccioná <em className="italic font-light">una sola</em> causa
              </CardTitle>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono">
              {causas.length} categorías
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {causas.map((c) => {
              const isSelected = diagnostico.causaId === c.id
              const emociones = c.emocionesEsperadas.slice(0, 2)

              return (
                <SelectableCard
                  key={c.id}
                  role="radio"
                  selected={isSelected}
                  disabled={disabled}
                  onSelect={() => onSelectCausa(c.id)}
                  hoverContent={
                    <>
                      <div className="text-sm font-medium text-foreground">
                        {c.nombre}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {c.definicion}
                      </p>
                      <EtapasList etapas={c.etapas} />
                    </>
                  }
                >
                  <div className="pr-5 text-sm font-medium text-foreground">
                    {c.nombre}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {c.definicion}
                  </div>
                  {emociones.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {emociones.map((em) => (
                        <Badge key={em} variant="outline" className="text-xs">
                          {em}
                        </Badge>
                      ))}
                    </div>
                  )}
                </SelectableCard>
              )
            })}
          </div>
          {errores['diagnostico.causaId'] && (
            <p className="mt-2 text-sm text-destructive">
              {errores['diagnostico.causaId']}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bloqueos + Algoritmo — two-column grid (alturas independientes; cada
          lista tiene su propio scroll interno) */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        {/* Card izquierda — Bloqueos energéticos (multi-select, scroll interno) */}
        <Card>
          <CardHeader>
            <CardDescription className="eyebrow text-muted-foreground">
              Bloqueos energéticos
            </CardDescription>
            <CardTitle className="mt-1 text-lg">
              Identifica los <em className="italic font-light">centros</em>{' '}
              afectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex max-h-[44rem] flex-col gap-2 overflow-y-auto pr-1">
              {bloqueos.map((b) => {
                const isSelected = diagnostico.bloqueoIds.includes(b.id)

                return (
                  <SelectableCard
                    key={b.id}
                    role="checkbox"
                    selected={isSelected}
                    disabled={disabled}
                    onSelect={() => onToggleBloqueo(b.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">
                        {b.nombre}
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {b.descripcion}
                    </div>
                  </SelectableCard>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Card derecha — Algoritmo (exclusiva, lista con scroll interno generoso) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardDescription className="eyebrow text-muted-foreground">
                  Algoritmo
                </CardDescription>
                <CardTitle className="mt-1 text-lg">
                  El <em className="italic font-light">patrón rector</em>
                </CardTitle>
              </div>
              <Badge variant="outline" className="shrink-0 font-mono">
                {algoritmos.length} patrones
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex max-h-[44rem] flex-col gap-2 overflow-y-auto pr-1">
              {algoritmos.map((a) => {
                const isSelected = diagnostico.algoritmoId === a.id

                return (
                  <SelectableCard
                    key={a.id}
                    role="radio"
                    selected={isSelected}
                    disabled={disabled}
                    onSelect={() => onSelectAlgoritmo(a.id)}
                    hoverContent={
                      <>
                        <div className="text-sm font-medium text-foreground">
                          {a.nombre}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {a.definicion}
                        </p>
                        {a.comportamiento && (
                          <div className="mt-3 space-y-1">
                            <div className="eyebrow text-muted-foreground">
                              Comportamiento
                            </div>
                            <p className="text-xs leading-relaxed text-foreground">
                              {a.comportamiento}
                            </p>
                          </div>
                        )}
                        <EtapasList etapas={a.etapas} />
                      </>
                    }
                  >
                    <div className="flex items-center justify-between gap-3 pr-5">
                      <div className="text-sm font-medium text-foreground">
                        {a.nombre}
                      </div>
                      {a.comportamientoBadge && (
                        <Badge className="shrink-0 bg-info-bg text-info border-info/30 text-xs">
                          {a.comportamientoBadge}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {a.definicion}
                    </div>
                  </SelectableCard>
                )
              })}
            </div>
            {errores['diagnostico.algoritmoId'] && (
              <p className="mt-2 text-sm text-destructive">
                {errores['diagnostico.algoritmoId']}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { DiagnosticoStep }
export type { DiagnosticoStepProps }
