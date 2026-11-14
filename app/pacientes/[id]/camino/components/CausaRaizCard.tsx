import type { Paciente } from '@/app/controllers/Paciente'
import { Chip } from '../../../components/Chip'
import { AuroraCard } from '../../components/AuroraCard'
import { AlfabetosCargadosList } from '../../components/AlfabetosCargadosList'

interface CausaRaizCardProps {
  paciente: Paciente
}

const CausaRaizCard = ({ paciente }: CausaRaizCardProps) => {
  const causa = paciente.causaActual
  const algoritmo = paciente.algoritmoActual

  if (causa === null) {
    return (
      <AuroraCard
        kicker="Diagnóstico activo"
        title={<span className="font-semibold text-primary">Diagnóstico</span>}
      >
        <p className="italic text-muted-foreground">
          Esta etapa aún no tiene diagnóstico activo.
        </p>
      </AuroraCard>
    )
  }

  const emociones =
    causa.emocionesEsperadas
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []

  return (
    <AuroraCard
      kicker="Diagnóstico activo"
      title={<span className="font-semibold text-primary">Diagnóstico</span>}
    >
      <div className="flex flex-col gap-4">
        <h4 className="m-0 text-2xl font-medium leading-tight tracking-tight text-brand-accent-700">
          {causa.nombre}
        </h4>
        {causa.definicion ? (
          <p className="leading-relaxed text-muted-foreground">
            {causa.definicion}
          </p>
        ) : (
          <p className="italic text-muted-foreground">
            Sin definición clínica registrada.
          </p>
        )}
        {emociones.length > 0 && (
          <div>
            <div className="eyebrow mb-2 text-muted-foreground">
              Emociones asociadas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {emociones.map((e) => (
                <Chip key={e} tone="violet">
                  {e}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="h-px bg-border" />
        {algoritmo !== null && (
          <>
            <div>
              <div className="eyebrow mb-2 text-muted-foreground">
                Algoritmo
              </div>
              <p className="m-0 font-medium text-foreground">
                {algoritmo.nombre}
              </p>
              {algoritmo.definicion && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {algoritmo.definicion}
                </p>
              )}
            </div>
            <div className="h-px bg-border" />
          </>
        )}
        <div>
          <div className="eyebrow mb-2 text-muted-foreground">
            Bloqueos identificados
          </div>
          {paciente.bloqueosIdentificados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin bloqueos energéticos registrados para esta etapa.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {paciente.bloqueosIdentificados.map((b) => (
                <Chip key={b.id} tone="teal">
                  {b.nombre}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <div className="h-px bg-border" />
        <div>
          <div className="eyebrow mb-2 text-muted-foreground">Alfabetos</div>
          <AlfabetosCargadosList alfabetos={paciente.alfabetosActuales} />
        </div>
      </div>
    </AuroraCard>
  )
}

export { CausaRaizCard }
export type { CausaRaizCardProps }
