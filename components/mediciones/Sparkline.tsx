interface SparklineProps {
  readonly values: ReadonlyArray<number>
  readonly height?: number
  readonly separadores?: ReadonlyArray<number>
}

// SVG propio, NO recharts (design §9.7 / §5.1): dominio fijo 0-100 (nunca
// min/max de los datos — lo que hace comparables dos sparklines y evita que
// una serie plana se dibuje como ruido amplificado). `--gold-400`/`--line-2`/
// `--bg-deep` del mock (`d4c5ab46-…js:74-108`) colapsan a los tokens
// semánticos `--primary`/`--border`/`--background` (token freeze, ningún
// token nuevo). `role="img"` + `aria-label` con resumen textual — a
// diferencia del mock (`aria-hidden`), la Sparkline acá SÍ es accesible por
// lectores de pantalla (design §7.1 a11y: "el gráfico tiene resumen textual").
const VIEWBOX_WIDTH = 260
const DOMAIN_MAX = 100

const Sparkline = ({
  values,
  height = 64,
  separadores = [],
}: SparklineProps) => {
  if (values.length === 0) return null

  const step = values.length > 1 ? VIEWBOX_WIDTH / (values.length - 1) : 0
  const points: ReadonlyArray<readonly [number, number]> = values.map(
    (v, i) => {
      const x = values.length > 1 ? i * step : VIEWBOX_WIDTH / 2
      const y = height - (v / DOMAIN_MAX) * height
      return [x, y] as const
    },
  )

  const ultimoValor = values[values.length - 1]
  const resumen = `Evolución: ${values.length} ${
    values.length === 1 ? 'medición' : 'mediciones'
  }, valor actual ${ultimoValor}%`

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={resumen}
    >
      <line
        x1={0}
        y1={height}
        x2={VIEWBOX_WIDTH}
        y2={height}
        className="stroke-border"
        strokeWidth={1}
      />
      {separadores.map((idx) => {
        const point = points[idx]
        if (point === undefined) return null
        return (
          <line
            key={idx}
            x1={point[0]}
            y1={0}
            x2={point[0]}
            y2={height}
            className="stroke-border"
            strokeWidth={1}
          />
        )
      })}
      {values.length > 1 && (
        <polyline
          points={points.map((p) => p.join(',')).join(' ')}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {points.map(([x, y], i) => {
        const isLast = i === points.length - 1
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={isLast ? 4 : 2.5}
            className={
              isLast
                ? 'fill-primary stroke-primary'
                : 'fill-background stroke-primary'
            }
            strokeWidth={1.4}
          />
        )
      })}
    </svg>
  )
}

export { Sparkline }
export type { SparklineProps }
