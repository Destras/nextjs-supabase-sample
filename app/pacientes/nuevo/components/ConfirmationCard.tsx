'use client'

import type { JSX } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/user-avatar'
import { MES_SHORT_LABEL } from '@/lib/clinicalLabels'
import { plural } from '@/lib/plural'

interface ConfirmationSummaryShape {
  readonly nombreDisplay: string
  readonly edadDisplay: string
  readonly emailDisplay: string
  readonly causaNombre: string
  readonly algoritmoNombre: string
  readonly modalidadNombre: string
  readonly bloqueoCount: number
  readonly alfabetosDisplay: string
}

interface ConfirmationCardProps {
  readonly summary: ConfirmationSummaryShape
  // Overrides the closing paragraph. Defaults to the copy of cargar un
  // paciente nuevo ("el paciente queda cargado. El tratamiento todavía no
  // arranca…"); flows that reuse this card for an existing paciente (e.g.
  // nuevo-tratamiento) pass their own copy.
  readonly footerCopy?: string
}

const ConfirmationCard = ({
  summary,
  footerCopy = 'Al confirmar, el paciente queda cargado. El tratamiento empieza cuando lo iniciás.',
}: ConfirmationCardProps): JSX.Element => {
  const {
    nombreDisplay,
    edadDisplay,
    emailDisplay,
    causaNombre,
    algoritmoNombre,
    modalidadNombre,
    bloqueoCount,
    alfabetosDisplay,
  } = summary

  return (
    <Card>
      <CardHeader>
        <CardDescription className="eyebrow text-muted-foreground">
          Confirmación
        </CardDescription>
        <CardTitle className="mt-1 text-lg">
          El <em className="italic font-light">plan</em> queda así
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border bg-muted p-5">
          {/* Avatar + name + meta */}
          <div className="mb-4 flex items-center gap-3">
            <UserAvatar name={nombreDisplay} size="lg" />
            <div>
              <div className="font-display text-[22px] font-medium text-foreground">
                {nombreDisplay}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {edadDisplay} años · {emailDisplay}
              </div>
            </div>
          </div>

          {/* Summary rows */}
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Causa raíz</span>
              <span className="text-foreground">{causaNombre}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Bloqueos</span>
              <span className="text-foreground">
                {plural(bloqueoCount, 'centro', 'centros')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Algoritmo</span>
              <span className="text-foreground">{algoritmoNombre}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Modalidad</span>
              <span className="text-foreground">{modalidadNombre}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Alfabetos</span>
              <span className="text-foreground">{alfabetosDisplay}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Inicio</span>
              <span className="text-foreground">{MES_SHORT_LABEL} 1</span>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Footer copy */}
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {footerCopy}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export { ConfirmationCard }
export type { ConfirmationCardProps }
