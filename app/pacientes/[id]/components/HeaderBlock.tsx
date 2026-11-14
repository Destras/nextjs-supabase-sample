import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import type { Paciente } from '@/app/controllers/Paciente'
import { Chip } from '../../components/Chip'
import { ScorePill } from '../../components/ScorePill'
import { encabezadoTratamiento } from '../controllers/utils/encabezadoTratamiento'
import { TratamientoActions } from './TratamientoActions'

interface HeaderBlockProps {
  paciente: Paciente
  onCerrada: () => void
  puedeIniciar: boolean
  onIniciar: () => void
}

const HeaderBlock = ({
  paciente,
  onCerrada,
  puedeIniciar,
  onIniciar,
}: HeaderBlockProps) => {
  // Un texto por estado del tratamiento, sin guiones sueltos (BETA-048).
  const { modalidad, estado } = encabezadoTratamiento(paciente)

  return (
    <div className="mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-6 rounded-lg border border-border bg-card p-6">
      <UserAvatar name={paciente.nombre} size="lg" />
      <div>
        <h2 className="m-0 text-3xl font-normal leading-tight">
          {paciente.nombre}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
          {modalidad !== null && (
            <>
              <span>{modalidad}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="text-brand-accent-700">{estado}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {paciente.tieneAlerta && (
          <Chip tone="coral" withDot>
            alerta abierta
          </Chip>
        )}
        {paciente.ultimoScore !== null && (
          <ScorePill
            score={paciente.ultimoScore}
            tendencia={paciente.tendencia}
          />
        )}
        {puedeIniciar && (
          <Button onClick={onIniciar}>Iniciar tratamiento</Button>
        )}
        <TratamientoActions paciente={paciente} onCerrada={onCerrada} />
      </div>
    </div>
  )
}

export { HeaderBlock }
export type { HeaderBlockProps }
