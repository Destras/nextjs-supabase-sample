import type {
  EtapaEstructura,
  MomentoMedicion,
} from '@/app/controllers/Tratamiento'

interface CentroHistoricoMedicion {
  readonly fecha: string
  readonly valor: number
  readonly momento: MomentoMedicion
  readonly delta: number | null
}

interface CentroHistoricoEtapa {
  readonly etapaLabel: string
  readonly mediciones: ReadonlyArray<CentroHistoricoMedicion>
}

interface CentroHistorico {
  readonly etapas: ReadonlyArray<CentroHistoricoEtapa>
  // Serie plana + índices de separación, listas para <Sparkline
  // separadores={...} values={...} /> (design §5.1/§9.9).
  readonly valoresPlanos: ReadonlyArray<number>
  readonly separadores: ReadonlyArray<number>
}

// Utilidad page-local pura (design §5.2): agrupa el histórico completo de UN
// centro a través de TODAS las etapas (§9.9 — el drill-down no tiene
// selector, muestra todo). Reusa el delta que `mapEstructuraPaciente` ya
// calculó por `ValorCentro` (comparado contra la medición anterior de la
// MISMA etapa, y ya `null` para la primera medición de cada etapa) — no
// recalcula nada, sólo extrae y agrupa. Una medición que no midió este
// centro (catálogo cambiado) se omite, nunca se muestra en 0 (§8.1); una
// etapa sin ninguna medición de este centro se excluye del todo.
const mapCentroHistorico = (
  etapas: ReadonlyArray<EtapaEstructura>,
  centroId: string,
): CentroHistorico => {
  const gruposEtapa: ReadonlyArray<CentroHistoricoEtapa> = etapas
    .map((etapa) => {
      const mediciones: ReadonlyArray<CentroHistoricoMedicion> =
        etapa.mediciones.reduce<ReadonlyArray<CentroHistoricoMedicion>>(
          (acc, medicion) => {
            const valorCentro = medicion.valores.find(
              (v) => v.centroId === centroId,
            )
            if (valorCentro === undefined) return acc
            return [
              ...acc,
              {
                fecha: medicion.registradaEn,
                valor: valorCentro.valor,
                momento: medicion.momento,
                delta: valorCentro.delta,
              },
            ]
          },
          [],
        )

      return { etapaLabel: `Etapa ${etapa.ordinal}`, mediciones }
    })
    .filter((grupo) => grupo.mediciones.length > 0)

  const valoresPlanos: number[] = []
  const separadores: number[] = []

  for (const grupo of gruposEtapa) {
    if (valoresPlanos.length > 0) separadores.push(valoresPlanos.length)
    for (const medicion of grupo.mediciones) valoresPlanos.push(medicion.valor)
  }

  return { etapas: gruposEtapa, valoresPlanos, separadores }
}

export { mapCentroHistorico }
export type { CentroHistorico, CentroHistoricoEtapa, CentroHistoricoMedicion }
