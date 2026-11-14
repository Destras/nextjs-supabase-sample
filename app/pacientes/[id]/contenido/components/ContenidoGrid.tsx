import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FrasesSemanaCell } from '@/components/FrasesSemanaCell'
import { SLOT_KEYS } from '@/app/controllers/Tratamiento'
import type { SlotKey } from '@/app/controllers/Tratamiento'
import { ContenidoCell } from './ContenidoCell'
import type { SemanaContenidoRow } from '../controllers'

interface ContenidoGridProps {
  readonly weeks: ReadonlyArray<SemanaContenidoRow>
}

// Encabezados cortos de los 5 slots (BETA-020). Las columnas salen de
// SLOT_KEYS, así que el orden es el mismo que en Asignar contenido:
// Semana · Meditación · Mantra · Egregor · CMA · IC · Frases. Map y no un
// objeto literal: indexar un objeto recorre Object.prototype.
const SLOT_HEADER_LABELS = new Map<SlotKey, string>([
  ['meditacion', 'Meditación'],
  ['mantra', 'Mantra'],
  ['egregor', 'Egregor'],
  ['cma', 'CMA'],
  ['ic', 'IC'],
])

// Pantalla de lectura: sin scroll horizontal. `table-fixed` reparte el ancho
// en partes iguales entre las 6 columnas de contenido (la de semana es angosta
// y fija) y los títulos largos se cortan en dos líneas dentro de su celda.
const ContenidoGrid = ({ weeks }: ContenidoGridProps) => (
  <Table className="table-fixed">
    <TableHeader>
      <TableRow>
        <TableHead scope="col" className="w-20">
          Semana
        </TableHead>
        {SLOT_KEYS.map((key) => (
          <TableHead key={key} scope="col">
            {SLOT_HEADER_LABELS.get(key)}
          </TableHead>
        ))}
        <TableHead scope="col">Frases</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {weeks.map((row) => (
        <TableRow key={row.numeroSemana}>
          <TableCell className="font-mono tabular-nums text-muted-foreground">
            S{row.numeroSemana}
          </TableCell>
          {SLOT_KEYS.map((key) => (
            <TableCell key={key} className="whitespace-normal">
              <ContenidoCell cell={row.slots[key]} />
            </TableCell>
          ))}
          <TableCell>
            <FrasesSemanaCell
              frases={row.frases}
              numeroSemana={row.numeroSemana}
            />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)

export { ContenidoGrid }
export type { ContenidoGridProps }
