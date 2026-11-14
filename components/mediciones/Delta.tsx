interface DeltaProps {
  readonly value: number | null
  readonly size?: number
}

// Molécula compartida (design §5.1, mock `d4c5ab46-…js:49-72`): glifo + signo,
// nunca solo color (RF-MED-013) — el token de color es siempre neutro
// (`text-muted-foreground`), la dirección la comunica el glifo y el texto
// accesible. Reusada por la pestaña Estructura, el diálogo de cierre (PR4) y
// la matriz de Historia (PR5).
const Delta = ({ value, size = 12 }: DeltaProps) => {
  if (value === null) {
    return (
      <span
        className="font-mono text-muted-foreground"
        style={{ fontSize: size }}
        aria-label="sin medición anterior para comparar"
      >
        —
      </span>
    )
  }

  const isFlat = value === 0
  const isUp = value > 0
  const glyph = isFlat ? '→' : isUp ? '↑' : '↓'
  const magnitud = Math.abs(value)
  const direccion = isFlat ? 'sin cambios' : isUp ? 'subió' : 'bajó'

  return (
    <span
      className="whitespace-nowrap font-mono text-muted-foreground"
      style={{ fontSize: size }}
      aria-label={
        isFlat
          ? 'variación sin cambios'
          : `variación ${direccion} ${magnitud} puntos`
      }
    >
      <span aria-hidden="true">{glyph}</span>{' '}
      {isFlat ? '0' : `${isUp ? '+' : '−'}${magnitud}`}
    </span>
  )
}

export { Delta }
export type { DeltaProps }
