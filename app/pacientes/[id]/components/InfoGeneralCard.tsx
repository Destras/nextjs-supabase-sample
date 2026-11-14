import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import type { Paciente } from '@/app/controllers/Paciente'
import { AuroraCard } from './AuroraCard'

interface InfoFieldProps {
  label: string
  value: string | null
}

const InfoField = ({ label, value }: InfoFieldProps) => (
  <div className="flex flex-col gap-1">
    <div className="eyebrow text-muted-foreground">{label}</div>
    <div
      className={cn(
        'text-sm',
        value === null ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {value ?? '—'}
    </div>
  </div>
)

interface InfoGeneralCardProps {
  paciente: Paciente
}

const InfoGeneralCard = ({ paciente }: InfoGeneralCardProps) => {
  const info = paciente.generalInfo
  const fechaNacimiento =
    info.fechaNacimiento !== null
      ? info.edad !== null
        ? `${formatDate(info.fechaNacimiento)} · ${info.edad} años`
        : formatDate(info.fechaNacimiento)
      : null

  return (
    <AuroraCard kicker="general" title="Información general">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        <InfoField label="Teléfono" value={info.telefono} />
        <InfoField label="Email" value={info.email} />
        <InfoField label="Fecha de nacimiento" value={fechaNacimiento} />
        <InfoField
          label="Registrado"
          value={info.fechaAlta !== null ? formatDate(info.fechaAlta) : null}
        />
      </div>
    </AuroraCard>
  )
}

export { InfoGeneralCard }
export type { InfoGeneralCardProps }
