import { AlertTriangle, Inbox } from 'lucide-react'
import type { ALERTA_TIPO } from '@/app/controllers/Alerta'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlertaRow, AlertaRowSkeleton } from '@/components/alertas'
import type { AlertasViewModel } from './controllers'

// Header 1:1 con el mock (`Web App.html:359-408`, page-head 361-377); el
// kicker se fija en "Alertas" (sin el conteo dinámico por rol del mock,
// todavía no hay data) y el subtítulo se adapta a los 4 tipos vigentes en
// v2 (score bajo, evaluación vencida, mes 3, cierre) — el mock menciona
// "pacientes en silencio", tipo descopeado del MVP (DEC-E0-7).
//
// Inbox real (task 1.4): el mock (`pages-1.jsx:280-303` · `styles.css:676-721`)
// modela `.alert-row` dentro de un `<Card kicker="Alertas" title="Hoy">` en el
// dashboard — acá es la página dedicada, así que el Card envuelve la lista
// completa y el filtro (sin equivalente en el mock) sigue el patrón de
// `PacientesView` (ToggleGroup single-select). La prioridad se comunica SOLO
// vía el ícono de `AlertaRow`/`AlertaTipoIcon` (task 0.5) — la fila nunca se
// tiñe entera.
const AlertasView = ({
  alertas,
  tipos,
  filtroTipo,
  onFiltrar,
  countsPorTipo,
  onMarcar,
  isLoading,
  error,
  onOpenPaciente,
}: AlertasViewModel) => {
  // El VM no expone un total agregado (countsPorTipo cuenta el caseload
  // completo antes del filtro de tipo) — se suma acá para el item "Todas".
  const countTotal = Object.values(countsPorTipo).reduce<number>(
    (acc, n) => acc + (n ?? 0),
    0,
  )

  return (
    <main className="flex min-h-dvh flex-col p-8">
      <div className="mb-8">
        <div className="eyebrow">Alertas</div>
        <h1 className="text-4xl font-medium tracking-tight">
          Lo que{' '}
          <em className="font-light italic text-muted-foreground">
            no puede esperar
          </em>
        </h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Scores bajos, evaluaciones vencidas, mediciones de cierre pendientes y
          momentos clave del tratamiento. Ordenado por urgencia.
        </p>
      </div>

      {/* Los chips no entran en una línea por debajo de ~1300 px: scrollean
          dentro de su fila en vez de ensanchar la página (BETA-044). */}
      <div className="mb-4 overflow-x-auto">
        <ToggleGroup
          type="single"
          value={filtroTipo ?? 'todas'}
          onValueChange={(v) => {
            if (!v) return
            onFiltrar(v === 'todas' ? null : (v as ALERTA_TIPO))
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="todas">Todas · {countTotal}</ToggleGroupItem>
          {tipos.map((tipo) => (
            <ToggleGroupItem key={tipo.codigo} value={tipo.codigo}>
              {tipo.nombre} · {countsPorTipo[tipo.codigo as ALERTA_TIPO] ?? 0}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Card className="px-6">
        {isLoading ? (
          <>
            <AlertaRowSkeleton />
            <AlertaRowSkeleton />
            <AlertaRowSkeleton />
            <AlertaRowSkeleton />
          </>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive/70" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </div>
        ) : alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Ninguna alerta activa — todo bajo control.
            </p>
          </div>
        ) : (
          alertas.map((alerta) => (
            <AlertaRow
              key={`${alerta.tipo}:${alerta.eventoRef}:${alerta.pacienteId}`}
              alerta={alerta}
              onMarcar={onMarcar}
              onOpenPaciente={onOpenPaciente}
            />
          ))
        )}
      </Card>
    </main>
  )
}

export { AlertasView }
