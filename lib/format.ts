import { formatFechaDia, formatInstante } from '@/app/utils/fechaDia'

const SOLO_DIA_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// dd/MM/yyyy para todo el panel. Una fecha de día (columna `date`, 'yyyy-MM-dd'
// exacto) se formatea por sus componentes, sin pasar por `Date` (BETA-017). Un
// instante (`timestamptz`, p. ej. la fecha de respuesta de una evaluación) se
// muestra en su día de Argentina (ADR 0012, BETA-040).
const formatDate = (iso: string | null): string => {
  if (!iso) return '—'
  return SOLO_DIA_PATTERN.test(iso) ? formatFechaDia(iso) : formatInstante(iso)
}

export { formatDate }
