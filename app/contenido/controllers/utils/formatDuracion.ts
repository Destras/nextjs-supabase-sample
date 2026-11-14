const formatDuracion = (totalSeg: number | null): string | null => {
  if (totalSeg === null) return null
  const m = Math.floor(totalSeg / 60)
  const s = Math.floor(totalSeg % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Table-cell variant: same MM:SS format, an em dash when there is no duration.
const formatDuracionCelda = (totalSeg: number | null): string =>
  formatDuracion(totalSeg) ?? '—'

export { formatDuracion, formatDuracionCelda }
