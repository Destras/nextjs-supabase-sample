import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Delta, MomentoChip } from '@/components/mediciones'
import { formatDate } from '@/lib/format'
import type {
  CentroEnergetico,
  MedicionHistoria,
} from '@/app/controllers/Tratamiento'

interface HistMedicionesProps {
  readonly centros: ReadonlyArray<CentroEnergetico>
  readonly mediciones: ReadonlyArray<MedicionHistoria>
}

// Matriz de la Historia (design §5.5, mock `d4c5ab46-…js:601-643`): una
// columna por medición, una fila por centro en el orden del catálogo, más
// una fila destacada "Estructura general". El delta de cada celda va contra
// la columna anterior — así lo describe §8.4: "cada celda muestra el
// valor... y el Delta contra la columna anterior, salvo la primera columna,
// que muestra —". Un centro no medido en esa columna (catálogo cambiado)
// queda en blanco, nunca en 0.
//
// Excepción: una columna `cierre_automatico` NO muestra delta. Es una copia
// del sistema, no una lectura clínica: su valor es idéntico al de la columna
// anterior, así que el delta daría 0 en los 12 centros y se leería "no
// avanzó" cuando la verdad es "no se midió" — exactamente el malentendido
// que §9.3 evita dándole momento propio. La fila "Estructura general" ya lo
// suprime via Medicion.deltaEstructura (null en apertura y cierre_automatico,
// PR2); esta regla alinea las filas de centros con esa misma semántica.
// `apertura` no necesita caso: al ser la primera medición de la etapa, es
// siempre la columna 0 y cae en la rama `i === 0`.
const valorEnColumna = (
  medicion: MedicionHistoria,
  centroId: string,
): number | null =>
  medicion.valores.find((v) => v.centroId === centroId)?.valor ?? null

const HistMediciones = ({ centros, mediciones }: HistMedicionesProps) => {
  if (mediciones.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Esta etapa no registró mediciones de estructura.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Centro</TableHead>
          {mediciones.map((medicion) => (
            <TableHead key={medicion.id}>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2 font-normal normal-case tracking-normal">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatDate(medicion.registradaEn)}
                  </span>
                  <MomentoChip momento={medicion.momento} />
                </div>
                <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                  {medicion.autorNombre ?? 'Sistema'}
                </span>
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {centros.map((centro) => (
          <TableRow key={centro.id}>
            <TableCell className="font-medium text-foreground">
              {centro.nombre}
            </TableCell>
            {mediciones.map((medicion, i) => {
              const valor = valorEnColumna(medicion, centro.id)
              if (valor === null) return <TableCell key={medicion.id} />
              const valorPrevio =
                i === 0 ? null : valorEnColumna(mediciones[i - 1], centro.id)
              const delta =
                i === 0 ||
                valorPrevio === null ||
                medicion.momento === 'cierre_automatico'
                  ? null
                  : valor - valorPrevio
              return (
                <TableCell key={medicion.id}>
                  <span className="font-mono">{valor}</span>{' '}
                  <Delta value={delta} size={11} />
                </TableCell>
              )
            })}
          </TableRow>
        ))}
        <TableRow className="border-t border-border">
          <TableCell className="font-medium text-foreground">
            Estructura general
          </TableCell>
          {mediciones.map((medicion) => (
            <TableCell
              key={medicion.id}
              className="font-medium text-foreground"
            >
              <span className="font-mono">{medicion.estructuraGeneral}</span>{' '}
              <Delta value={medicion.deltaEstructura} size={11} />
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  )
}

export { HistMediciones }
export type { HistMedicionesProps }
