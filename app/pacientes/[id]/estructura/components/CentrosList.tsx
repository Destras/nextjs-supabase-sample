import { CentroRow } from './CentroRow'
import { CentroDetalle } from './CentroDetalle'
import type { CentroHistorico, CentroRowVM } from '../controllers'

interface CentrosListProps {
  readonly centros: ReadonlyArray<CentroRowVM>
  readonly centroAbiertoId: string | null
  readonly centroDetalle: CentroHistorico | null
  readonly onToggleCentro: (centroId: string) => void
}

// `centroAbiertoId` es un único valor (design §4.5), así que un solo centro
// se expande a la vez por construcción — no hay estado local acá.
const CentrosList = ({
  centros,
  centroAbiertoId,
  centroDetalle,
  onToggleCentro,
}: CentrosListProps) => (
  <div>
    {centros.map((centro) => {
      const abierto = centroAbiertoId === centro.centroId
      return (
        <div key={centro.centroId}>
          <CentroRow
            nombre={centro.nombre}
            valor={centro.valor}
            delta={centro.delta}
            abierto={abierto}
            onToggle={() => onToggleCentro(centro.centroId)}
          />
          {abierto && centroDetalle !== null && (
            <CentroDetalle historico={centroDetalle} />
          )}
        </div>
      )
    })}
  </div>
)

export { CentrosList }
export type { CentrosListProps }
