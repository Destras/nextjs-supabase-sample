import { format } from 'date-fns'
import { parseFechaDia } from '@/app/utils/fechaDia'

// Local noon (parseFechaDia) so the JS Date represents the same calendar day
// across DST.
const parseFechaNacimiento = (iso: string | null): Date | undefined => {
  if (iso === null) return undefined
  return parseFechaDia(iso)
}

const formatFechaNacimiento = (date: Date | null): string | null => {
  if (date === null) return null
  return format(date, 'yyyy-MM-dd')
}

const FECHA_NACIMIENTO_MIN_DATE = new Date(1900, 0, 1)

const fechaNacimientoMaxDate = (today: Date = new Date()): Date => today

export {
  parseFechaNacimiento,
  formatFechaNacimiento,
  FECHA_NACIMIENTO_MIN_DATE,
  fechaNacimientoMaxDate,
}
