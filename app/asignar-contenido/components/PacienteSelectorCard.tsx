'use client'

import type { JSX } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { SearchableCombobox } from '@/components/ui/SearchableCombobox'
import type { Paciente } from '@/app/controllers/Paciente'
import type { PacienteCtx } from '../controllers'
import { MES_LABEL } from '@/lib/clinicalLabels'

interface PacienteSelectorCardProps {
  pacientes: ReadonlyArray<Paciente>
  selectedPacienteId: string | null
  onSelectPaciente: (id: string) => void
  weeks: number
  pacienteCtx: PacienteCtx | null
}

const PacienteSelectorCard = ({
  pacientes,
  selectedPacienteId,
  onSelectPaciente,
  weeks,
  pacienteCtx,
}: PacienteSelectorCardProps): JSX.Element => {
  const currentWeek = pacienteCtx?.currentWeek ?? null
  const mesActual = pacienteCtx?.mesActual ?? null
  const selectedPaciente =
    pacientes.find((p) => p.id === selectedPacienteId) ?? null
  const mesesTotales = selectedPaciente?.mesesTotales ?? null

  return (
    <Card>
      <CardContent className="pt-5">
        {/* Card kicker + title */}
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Paciente
          </p>
          <h3 className="font-display mt-1 text-[20px] font-medium leading-tight tracking-tight text-card-foreground">
            &iquest;Para qui&eacute;n es este plan?
          </h3>
        </div>

        {/* asg-pick grid */}
        <div className="grid items-end gap-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Patient selector — Combobox with search */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Paciente
            </label>
            <SearchableCombobox
              items={pacientes.map((p) => ({
                value: p.id,
                label: `${p.nombre} · ${p.modalidadResumen ?? `${weeks} sem`}`,
              }))}
              value={selectedPacienteId}
              onChange={(id) => {
                if (id != null) onSelectPaciente(id)
              }}
              placeholder="Seleccioná un paciente"
              ariaLabel="Selector de paciente"
              allowClear={false}
            />
          </div>

          {/* Modalidad chip */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Modalidad
            </span>
            <span className="font-display text-[20px] text-foreground">
              <em className="not-italic text-brand-accent-500">{weeks}</em> sem
            </span>
          </div>

          {/* Mes chip */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {MES_LABEL}
            </span>
            <span className="font-display text-[20px] text-foreground">
              {mesActual != null && mesesTotales != null
                ? `${mesActual}/${mesesTotales}`
                : '—'}
            </span>
          </div>

          {/* Current week chip */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Va por la semana
            </span>
            <span className="font-display text-[20px] text-brand-accent-500">
              {currentWeek != null ? String(currentWeek).padStart(2, '0') : '—'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { PacienteSelectorCard }
export type { PacienteSelectorCardProps }
