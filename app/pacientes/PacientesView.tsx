'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { MES_LABEL } from '@/lib/clinicalLabels'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import type { EstadoInicioTratamiento } from '@/app/controllers/Paciente'
import { Chip } from './components/Chip'
import { ScorePill } from './components/ScorePill'
import type { PacientesFilter, PacientesViewModel } from './controllers'

// Copy del chip de un paciente que el terapeuta ya no atiende. En un Map (no en
// un objeto literal indexado). El activo no está acá: su chip depende de si
// tiene una alerta abierta.
const ESTADO_NO_ACTIVO_LABEL: ReadonlyMap<PACIENTE_STATE, string> = new Map([
  [PACIENTE_STATE.PAUSED, 'pausado'],
  [PACIENTE_STATE.BAJA, 'baja'],
])

// Columna Inicio: qué se lee cuando el tratamiento más reciente no tiene una fecha
// de inicio que mostrar (BETA-015). 'en_curso' no está acá: muestra su fecha.
const INICIO_SIN_FECHA_LABEL: ReadonlyMap<EstadoInicioTratamiento, string> =
  new Map([
    ['sin_iniciar', 'Sin iniciar'],
    ['finalizado', 'Finalizado'],
  ])

const NuevoPacienteButton = () => (
  <Button asChild>
    <Link href="/pacientes/nuevo">
      <Plus />
      Nuevo paciente
    </Link>
  </Button>
)

const PacientesView = ({
  pacientes,
  isLoading,
  error,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  counts,
}: PacientesViewModel) => {
  const router = useRouter()

  if (!isLoading && !error && counts.total === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <EmptyState
          title="Todavía no tenés"
          titleHighlight="pacientes"
          message="Agregá tu primer paciente para empezar a hacerle seguimiento desde Aurora."
          ctaLabel="Nuevo paciente"
          ctaHref="/pacientes/nuevo"
          ctaIcon={Plus}
        />
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col p-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{counts.activos} activos</div>
          <h1 className="mt-1 text-4xl font-medium tracking-tight">
            Mis{' '}
            <span className="font-semibold not-italic text-primary">
              pacientes
            </span>
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Cada uno en su etapa y su mes de tratamiento. Aquí los ves a todos
            juntos.
          </p>
        </div>
        <NuevoPacienteButton />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => {
            if (v) setFilter(v as PacientesFilter)
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="todos">
            Todos · {counts.total}
          </ToggleGroupItem>
          <ToggleGroupItem value="activos">
            Activos · {counts.activos}
          </ToggleGroupItem>
          <ToggleGroupItem value="alerta">
            Con alerta · {counts.conAlerta}
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex-1" />
        <div className="flex w-72 items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>{MES_LABEL}</TableHead>
              <TableHead>Causa raíz</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Próx. eval</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Cargando pacientes...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : pacientes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Ningún paciente coincide con la búsqueda.
                </TableCell>
              </TableRow>
            ) : (
              pacientes.map((p) => {
                const estadoNoActivo = ESTADO_NO_ACTIVO_LABEL.get(p.state)
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => router.push(`/pacientes/${p.id}/camino`)}
                    className={cn(
                      'cursor-pointer',
                      p.tieneAlerta &&
                        'bg-destructive-bg/40 hover:bg-destructive-bg/60',
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={p.nombre} size="md" />
                        <div>
                          <div className="font-medium">{p.nombre}</div>
                          {p.modalidadResumen && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {p.modalidadResumen}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.mesActual !== null && p.mesesTotales !== null ? (
                        <Chip tone="violet">
                          {p.mesActual}/{p.mesesTotales}
                        </Chip>
                      ) : p.sinIniciar ? (
                        <Chip tone="gold">Sin iniciar</Chip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.causaActual?.nombre ?? '—'}
                    </TableCell>
                    <TableCell>
                      {p.ultimoScore !== null ? (
                        <ScorePill
                          score={p.ultimoScore}
                          tendencia={p.tendencia}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {INICIO_SIN_FECHA_LABEL.get(p.inicioTratamiento.estado) ??
                        formatDate(p.inicioTratamiento.fecha)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {formatDate(p.proximaEvaluacion)}
                    </TableCell>
                    <TableCell>
                      {estadoNoActivo !== undefined ? (
                        // El estado gana al chip de alerta: de un paciente
                        // pausado o dado de baja se muestra su estado.
                        <Chip tone="default" withDot>
                          {estadoNoActivo}
                        </Chip>
                      ) : p.tieneAlerta ? (
                        <Chip tone="coral" withDot>
                          alerta
                        </Chip>
                      ) : (
                        <Chip tone="green" withDot>
                          activo
                        </Chip>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </main>
  )
}

export { PacientesView }
