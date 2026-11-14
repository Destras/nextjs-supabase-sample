'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TerapeutaRollup } from '@/app/controllers/Terapeuta'
import { DashboardCard } from './DashboardCard'

interface CargaPorTerapeutaTableProps {
  readonly terapeutas: ReadonlyArray<TerapeutaRollup>
}

const Dash = () => <span className="text-muted-foreground">—</span>

// A5: carga y salud por terapeuta. Filas clickeables → /terapeutas/[id];
// columnas Tier B (score / alertas) con "—" cuando no hay evaluaciones.
const CargaPorTerapeutaTable = ({
  terapeutas,
}: CargaPorTerapeutaTableProps) => {
  const router = useRouter()

  return (
    <DashboardCard
      kicker="Red de terapeutas"
      title="Carga y salud por terapeuta"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Terapeuta</TableHead>
            <TableHead>Pacientes a cargo</TableHead>
            <TableHead>Score prom.</TableHead>
            <TableHead>Alertas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {terapeutas.map((t) => (
            <TableRow
              key={t.id}
              onClick={() => router.push(`/terapeutas/${t.id}`)}
              className="cursor-pointer"
            >
              <TableCell>
                <span className="font-medium">{t.nombre}</span>
              </TableCell>
              <TableCell className="tabular-nums">
                {t.pacientesActivos}
              </TableCell>
              <TableCell className="tabular-nums">
                {t.scorePromedio !== null ? (
                  t.scorePromedio.toFixed(1)
                ) : (
                  <Dash />
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {t.alertasActivas !== null ? t.alertasActivas : <Dash />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DashboardCard>
  )
}

export { CargaPorTerapeutaTable }
export type { CargaPorTerapeutaTableProps }
