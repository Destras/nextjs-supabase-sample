import { Check } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import { ETAPA_LABEL } from '@/lib/clinicalLabels'

interface TerapeutaPacientesTableProps {
  readonly pacientes: ReadonlyArray<Paciente>
  readonly onOpenPaciente: (pacienteId: string) => void
}

const TerapeutaPacientesTable = ({
  pacientes,
  onOpenPaciente,
}: TerapeutaPacientesTableProps) => {
  if (pacientes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este terapeuta no tiene pacientes a cargo.
      </p>
    )
  }

  const maxNiveles = Math.max(0, ...pacientes.map((p) => p.evaluaciones.length))
  const evalIndices = Array.from({ length: maxNiveles }, (_, i) => i + 1)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre del paciente</TableHead>
          <TableHead>{ETAPA_LABEL}</TableHead>
          {evalIndices.map((n) => (
            <TableHead key={n}>Eval {n}</TableHead>
          ))}
          <TableHead>Activo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pacientes.map((p) => {
          // "Paciente activo" (CONTEXT.md) = estado `activo`; no depende de
          // que tenga un tratamiento en curso.
          const activo = p.state === PACIENTE_STATE.ACTIVE
          return (
            <TableRow
              key={p.id}
              className="cursor-pointer"
              onClick={() => onOpenPaciente(p.id)}
            >
              <TableCell>{p.nombre}</TableCell>
              <TableCell>{p.etapaOrdinal ?? '—'}</TableCell>
              {evalIndices.map((n) => {
                const evalMes = p.evaluaciones.find((e) => e.numeroNivel === n)
                return (
                  <TableCell key={n}>
                    {evalMes?.evaluada === true ? (
                      <Check
                        className="h-4 w-4 text-success"
                        aria-label={`Evaluación ${n} hecha`}
                      />
                    ) : evalMes !== undefined ? (
                      <span
                        className="text-muted-foreground"
                        aria-label={`Evaluación ${n} pendiente`}
                      >
                        —
                      </span>
                    ) : null}
                  </TableCell>
                )
              })}
              <TableCell>
                {activo ? (
                  <Badge className="border-success/30 bg-success-bg text-success">
                    Sí
                  </Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export { TerapeutaPacientesTable }
export type { TerapeutaPacientesTableProps }
