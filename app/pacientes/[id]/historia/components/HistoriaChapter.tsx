'use client'

import { useState } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type {
  EtapaHistoria,
  CentroEnergetico,
} from '@/app/controllers/Tratamiento'
import { ChapterHeader } from './ChapterHeader'
import { DiagnosticoBlock } from './DiagnosticoBlock'
import { PlanBlock } from './PlanBlock'
import { EvolucionTimeline } from './EvolucionTimeline'
import { HistMediciones } from './HistMediciones'
import { ResultadoBlock } from './ResultadoBlock'

interface HistoriaChapterProps {
  readonly etapa: EtapaHistoria
  readonly defaultOpen: boolean
  readonly centros: ReadonlyArray<CentroEnergetico>
}

const HistoriaChapter = ({
  etapa,
  defaultOpen,
  centros,
}: HistoriaChapterProps) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border bg-card"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <ChapterHeader etapa={etapa} open={open} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* ① Diagnóstico */}
        <DiagnosticoBlock
          diagnostico={etapa.diagnostico}
          alfabetos={etapa.alfabetos}
        />

        {/* separator */}
        <div className="h-px bg-border" />

        {/* ② Plan */}
        <PlanBlock modalidad={etapa.modalidad} />

        {/* separator */}
        <div className="h-px bg-border" />

        {/* ③ Evolución */}
        <section className="flex flex-col gap-4 px-4 py-4">
          <div className="eyebrow text-muted-foreground">Evolución</div>
          <EvolucionTimeline eventos={etapa.eventos} />
        </section>

        {/* separator */}
        <div className="h-px bg-border" />

        {/* ④ Mediciones de estructura */}
        <section className="flex flex-col gap-4 px-4 py-4">
          <div className="eyebrow text-muted-foreground">
            Mediciones de estructura
          </div>
          <HistMediciones centros={centros} mediciones={etapa.mediciones} />
        </section>

        {/* separator */}
        <div className="h-px bg-border" />

        {/* Resultado / Próxima evaluación (sin número — la lectura de cierre se ve en ④) */}
        <ResultadoBlock etapa={etapa} />
      </CollapsibleContent>
    </Collapsible>
  )
}

export { HistoriaChapter }
export type { HistoriaChapterProps }
