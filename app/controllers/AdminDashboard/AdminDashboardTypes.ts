// Agregados globales de la red para el dashboard de administración. Entidad
// nueva (aprobada vía gate Rule 6): estos datos cruzan Paciente + Diagnostico +
// Tratamiento y no pertenecen a ninguna entidad existente.

interface DistItem {
  readonly label: string
  readonly cantidad: number
  readonly pct: number
}

interface AdminDashboardStats {
  readonly pacientesActivos: number
  readonly nuevosEsteMes: number
  readonly alertasTotales: number | null // Tier B — null si no hay evaluaciones
  readonly scorePromedio: number | null // Tier B — null si no hay evaluaciones
  readonly distribucionEtapa: ReadonlyArray<DistItem>
  readonly distribucionMes: ReadonlyArray<DistItem>
}

export type { AdminDashboardStats, DistItem }
