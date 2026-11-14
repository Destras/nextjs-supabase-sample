import type { DistItem } from '../controllers/dashboardTypes'

interface DistributionBarsProps {
  readonly items: ReadonlyArray<DistItem>
}

// Mapea las barras de distribución del mock (pages-1.jsx · Dashboard "Por causa
// raíz"): fila con label + "cantidad · pct%" y una barra proporcional con el
// gradiente brand (teal→violet del mock). El width es un valor calculado en
// runtime → va inline (no expresable como token Tailwind).
const DistributionBars = ({ items }: DistributionBarsProps) => {
  return (
    <div className="mt-2 flex flex-col gap-2.5">
      {items.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-sm">{d.label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {d.cantidad} · {d.pct}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-brand"
              style={{ width: `${d.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export { DistributionBars }
export type { DistributionBarsProps }
