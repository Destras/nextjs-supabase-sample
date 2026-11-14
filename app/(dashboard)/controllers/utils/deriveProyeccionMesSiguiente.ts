import type { DistItem } from '../dashboardTypes'

const isNumericLabel = (label: string): boolean => /^\d+$/.test(label)

// §16.1 DevSpec: el mes de tratamiento avanza solo por calendario, así que la
// distribución del mes que viene es un corrimiento +1 determinista de la foto
// de hoy — no hacen falta datos nuevos. `Mes k (hoy) → Mes k+1 (siguiente)`;
// `Mes 1` (siguiente) = nuevas altas → siempre desconocido → se OMITE (no se
// inventa, y no aporta nada mostrar una fila permanentemente vacía); quienes
// hoy están en el último mes cierran su tratamiento y salen de la proyección
// (su count sale directo del bucket del último mes de `distribucionMes`, lo
// arma el consumidor, no este derivador). Buckets sin mes conocido
// ("Sin etapa") tampoco se proyectan: no sabemos a qué mes van.
//
// CONTRATO REQUERIDO (fix code-review): `distribucionMes` debe traer SIEMPRE
// la serie completa `1..N` (N = duración del tratamiento), con `0` en los
// meses sin pacientes hoy — lo garantizan `get_admin_dashboard_stats()`
// (62_rpc_admin.sql) y `deriveDistribucionMes`. Este derivador infiere N como
// `Math.max` de los labels numéricos presentes; si el jsonb omitiera un mes
// vacío (contrato viejo, agrupaba solo lo ocupado), N se leía mal y la
// cohorte del último mes ocupado se confundía con "cierran tratamiento" en
// vez de proyectarse al mes siguiente. Con el contrato nuevo esto no puede
// pasar: el mes 0-count SIEMPRE está presente como key.
const deriveProyeccionMesSiguiente = (
  distribucionMes: ReadonlyArray<DistItem>,
): ReadonlyArray<DistItem> => {
  const porMes = new Map<number, number>()
  for (const item of distribucionMes) {
    if (!isNumericLabel(item.label)) continue
    porMes.set(Number(item.label), item.cantidad)
  }
  if (porMes.size === 0) return []

  const maxMes = Math.max(...porMes.keys())
  const cantidades: number[] = []
  for (let mes = 2; mes <= maxMes; mes++) {
    cantidades.push(porMes.get(mes - 1) ?? 0)
  }

  const total = cantidades.reduce<number>((acc, c) => acc + c, 0)

  return cantidades.map((cantidad, idx) => ({
    label: String(idx + 2),
    cantidad,
    pct: total === 0 ? 0 : Math.round((cantidad / total) * 100),
  }))
}

export { deriveProyeccionMesSiguiente }
