import type { AlfabetoCargado } from '@/app/controllers/Diagnostico'

interface AlfabetosCargadosListProps {
  readonly alfabetos: ReadonlyArray<AlfabetoCargado>
}

const AlfabetosCargadosList = ({ alfabetos }: AlfabetosCargadosListProps) => {
  if (alfabetos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin alfabetos cargados.</p>
    )
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {alfabetos.map((alfabeto) => (
        <div key={alfabeto.alfabetoId} className="contents">
          <dt className="text-sm text-muted-foreground">{alfabeto.nombre}</dt>
          <dd className="text-sm tabular-nums text-foreground">
            {alfabeto.numeros.join(' · ')}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export { AlfabetosCargadosList }
export type { AlfabetosCargadosListProps }
