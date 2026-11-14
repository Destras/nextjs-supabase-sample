import type { Paciente } from '@/app/controllers/Paciente'
import { attachPct } from '@/lib/distribution'
import type { DistItem } from '../dashboardTypes'

const toDistItems = (counts: Map<string, number>): ReadonlyArray<DistItem> =>
  attachPct(
    [...counts.entries()].map(([label, cantidad]) => ({ label, cantidad })),
  )

const SIN_ETAPA = 'Sin etapa'

// Sort helper: numeric labels 1→N first, "Sin etapa" last.
const sortOrdinalLabel = (a: DistItem, b: DistItem): number => {
  if (a.label === SIN_ETAPA) return 1
  if (b.label === SIN_ETAPA) return -1
  return Number(a.label) - Number(b.label)
}

// T7 (Tier A): distribución por etapa (ordinal del ciclo). null → "Sin etapa".
// Ordena por ordinal natural (1→N, "Sin etapa" último). El ordinal no tiene
// tope conocido (no como el mes de tratamiento) así que solo agrupa lo
// ocupado — a diferencia de deriveDistribucionMes.
const deriveDistribucionEtapa = (
  pacientes: ReadonlyArray<Paciente>,
): ReadonlyArray<DistItem> => {
  if (pacientes.length === 0) return []
  const counts = new Map<string, number>()
  for (const p of pacientes) {
    const label = p.etapaOrdinal == null ? SIN_ETAPA : String(p.etapaOrdinal)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...toDistItems(counts)].sort(sortOrdinalLabel)
}

// T7b (Tier A): distribución por mes dentro del ciclo activo. A diferencia de
// deriveDistribucionEtapa, el rango SÍ es conocido (1..N, N = mesesTotales) —
// emite SIEMPRE la serie completa con 0 en los meses sin pacientes hoy. Esto
// mirroria el contrato del RPC admin (62_rpc_admin.sql): si solo agrupáramos
// por mesActual, un mes vacío desaparecería y
// deriveProyeccionMesSiguiente perdería el N real del tratamiento (bug: la
// cohorte del último mes ocupado se confundía con "cierran tratamiento").
// null mesActual → bucket "Sin etapa" aparte, al final, fuera de la serie
// numérica.
const deriveDistribucionMes = (
  pacientes: ReadonlyArray<Paciente>,
): ReadonlyArray<DistItem> => {
  if (pacientes.length === 0) return []

  const n = pacientes.reduce(
    (max, p) =>
      p.mesesTotales != null && p.mesesTotales > max ? p.mesesTotales : max,
    0,
  )
  const porMes = new Map<number, number>()
  let sinEtapa = 0
  for (const p of pacientes) {
    if (p.mesActual == null) {
      sinEtapa += 1
    } else {
      porMes.set(p.mesActual, (porMes.get(p.mesActual) ?? 0) + 1)
    }
  }

  const counts = new Map<string, number>()
  for (let mes = 1; mes <= n; mes++) {
    counts.set(String(mes), porMes.get(mes) ?? 0)
  }
  if (sinEtapa > 0) {
    counts.set(SIN_ETAPA, sinEtapa)
  }
  return toDistItems(counts)
}

export { deriveDistribucionEtapa, deriveDistribucionMes }
