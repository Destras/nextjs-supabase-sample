import type {
  Diagnostico,
  AlfabetoCargado,
} from '@/app/controllers/Diagnostico'
import { Chip } from '../../../components/Chip'
import { AlfabetosCargadosList } from '../../components/AlfabetosCargadosList'

interface DiagnosticoBlockProps {
  readonly diagnostico: Diagnostico
  readonly alfabetos: ReadonlyArray<AlfabetoCargado>
}

const DiagnosticoBlock = ({
  diagnostico,
  alfabetos,
}: DiagnosticoBlockProps) => {
  const { causa, algoritmo, bloqueos } = diagnostico

  return (
    <section className="flex flex-col gap-4 px-4 py-4">
      <div className="eyebrow text-muted-foreground">Diagnóstico</div>

      {/* Causa: nombre + definición */}
      <div className="flex flex-col gap-1">
        <h4 className="m-0 text-base font-medium leading-tight text-foreground">
          {causa.nombre}
        </h4>
        {causa.definicion ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {causa.definicion}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Sin definición clínica registrada.
          </p>
        )}
      </div>

      {/* Algoritmo */}
      <div className="flex flex-col gap-1">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Algoritmo
        </div>
        <span className="text-sm text-foreground">{algoritmo.nombre}</span>
        {algoritmo.definicion ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {algoritmo.definicion}
          </p>
        ) : null}
      </div>

      {/* Emociones esperadas */}
      {causa.emocionesEsperadas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Emociones esperadas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {causa.emocionesEsperadas.map((emocion) => (
              <Chip key={emocion} tone="violet">
                {emocion}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Emociones esperadas
          </div>
          <p className="text-sm italic text-muted-foreground">
            Sin emociones esperadas registradas.
          </p>
        </div>
      )}

      {/* Bloqueos */}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Bloqueos energéticos
        </div>
        {bloqueos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin bloqueos energéticos registrados para esta etapa.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {bloqueos.map((b) => (
              <Chip key={b.id} tone="teal">
                {b.nombre}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Alfabetos */}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Alfabetos
        </div>
        <AlfabetosCargadosList alfabetos={alfabetos} />
      </div>
    </section>
  )
}

export { DiagnosticoBlock }
export type { DiagnosticoBlockProps }
