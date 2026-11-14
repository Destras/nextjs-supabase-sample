interface LabeledCount {
  readonly label: string
  readonly cantidad: number
}

interface LabeledPct extends LabeledCount {
  readonly pct: number
}

// Adjunta el porcentaje (redondeado) de cada bucket sobre el total. Fuente única
// del cálculo de pct de las distribuciones, compartida por los derivadores del
// terapeuta y el mapper del admin. Guarda total>0 → 0% en vez de NaN.
const attachPct = (items: ReadonlyArray<LabeledCount>): LabeledPct[] => {
  const total = items.reduce((acc, i) => acc + i.cantidad, 0)
  return items.map((i) => ({
    label: i.label,
    cantidad: i.cantidad,
    pct: total > 0 ? Math.round((i.cantidad / total) * 100) : 0,
  }))
}

export { attachPct }
export type { LabeledCount, LabeledPct }
