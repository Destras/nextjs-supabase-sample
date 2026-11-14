// Fechas "de día": columnas `date` de la base, que viajan como 'yyyy-MM-dd' y no
// tienen hora ni zona. Pasarlas por `new Date(iso)` las lee como medianoche UTC,
// que en Argentina (UTC-3) es el día anterior (BETA-017). Estas tres funciones
// son la única puerta entre un día de la base y un `Date`/texto del panel.
// (Los instantes —`timestamptz`— van por las funciones del final del archivo.)

const FECHA_DIA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/

const pad2 = (n: number): string => String(n).padStart(2, '0')

// Mediodía LOCAL de ese día: el Date cae en el mismo día de calendario aunque un
// cambio de horario corra la hora.
const parseFechaDia = (iso: string): Date => new Date(`${iso}T12:00:00`)

// dd/MM/yyyy armado con los componentes del string, sin pasar por `Date`: no hay
// zona horaria que pueda correr el día.
const formatFechaDia = (iso: string | null): string => {
  const partes = iso === null ? null : FECHA_DIA_PATTERN.exec(iso)
  if (partes === null) return '—'
  const [, anio, mes, dia] = partes
  return `${dia}/${mes}/${anio}`
}

// El día de calendario LOCAL de un instante, en 'yyyy-MM-dd' (comparable como
// string contra una columna `date`). `toISOString().slice(0, 10)` da el día UTC,
// que desde las 21:00 de Argentina ya es mañana.
const hoyFechaDia = (now: Date): string =>
  `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`

// --- Instantes (`timestamptz`) ---------------------------------------------
// Un instante tiene hora y zona: el día en que "cae" depende de dónde se mire.
// El panel lo muestra SIEMPRE en el día de Argentina (ADR 0012), no en UTC ni
// en el huso del navegador: algo registrado a las 22:00 de Buenos Aires es de
// ese día aunque en UTC ya sea el siguiente (BETA-040). No usar estas funciones
// con una columna `date`: 'yyyy-MM-dd' se leería como medianoche UTC y caería
// en el día anterior; para eso están las de arriba.
const ZONA_PANEL = 'America/Argentina/Buenos_Aires'

const DIA_EN_ZONA_PANEL = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_PANEL,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// El día de Argentina de un instante, en 'yyyy-MM-dd'. null si no es un instante.
const diaDeInstante = (iso: string | null): string | null => {
  if (iso === null) return null
  const instante = new Date(iso)
  if (Number.isNaN(instante.getTime())) return null
  const partes = new Map(
    DIA_EN_ZONA_PANEL.formatToParts(instante).map((p) => [p.type, p.value]),
  )
  return `${partes.get('year')}-${partes.get('month')}-${partes.get('day')}`
}

// dd/MM/yyyy del día de Argentina de un instante.
const formatInstante = (iso: string | null): string =>
  formatFechaDia(diaDeInstante(iso))

// dd/MM/yy: para rótulos apretados (el eje de un gráfico), donde el año entero
// no entra pero igual tiene que estar.
const formatInstanteCorto = (iso: string | null): string => {
  const completa = formatInstante(iso)
  return completa === '—'
    ? completa
    : `${completa.slice(0, 6)}${completa.slice(8)}`
}

export {
  diaDeInstante,
  formatFechaDia,
  formatInstante,
  formatInstanteCorto,
  hoyFechaDia,
  parseFechaDia,
}
