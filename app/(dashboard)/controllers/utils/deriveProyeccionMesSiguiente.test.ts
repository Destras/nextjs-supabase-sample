import type { DistItem } from '../dashboardTypes'
import { deriveProyeccionMesSiguiente } from './deriveProyeccionMesSiguiente'

describe('deriveProyeccionMesSiguiente', () => {
  it('returns an empty array for an empty distribucionMes', () => {
    expect(deriveProyeccionMesSiguiente([])).toEqual([])
  })

  it('shifts each Mes k (hoy) to Mes k+1, dropping the always-empty Mes 1 row and the last month (cierran)', () => {
    const distribucionMes: DistItem[] = [
      { label: '1', cantidad: 18, pct: 47 },
      { label: '2', cantidad: 9, pct: 24 },
      { label: '3', cantidad: 6, pct: 16 },
      { label: '4', cantidad: 4, pct: 11 },
    ]
    expect(deriveProyeccionMesSiguiente(distribucionMes)).toEqual([
      { label: '2', cantidad: 18, pct: 55 },
      { label: '3', cantidad: 9, pct: 27 },
      { label: '4', cantidad: 6, pct: 18 },
    ])
  })

  // Regression (code-review): la implementación vieja tomaba Math.max(keys)
  // como "último mes del tratamiento" — si el mes 4 estaba vacío hoy (nadie
  // llegó todavía), maxMes daba 3 y la cohorte del mes 3 (2 pacientes)
  // desaparecía en vez de proyectarse al mes 4. El contrato nuevo de
  // distribucionMes (SIEMPRE 1..N, 0 en los vacíos) hace que maxMes = N sea
  // correcto de nuevo.
  it('projects the top cohort into the last month instead of dropping it when that month is empty today', () => {
    const distribucionMes: DistItem[] = [
      { label: '1', cantidad: 5, pct: 50 },
      { label: '2', cantidad: 3, pct: 30 },
      { label: '3', cantidad: 2, pct: 20 },
      { label: '4', cantidad: 0, pct: 0 },
    ]
    expect(deriveProyeccionMesSiguiente(distribucionMes)).toEqual([
      { label: '2', cantidad: 5, pct: 50 },
      { label: '3', cantidad: 3, pct: 30 },
      { label: '4', cantidad: 2, pct: 20 },
    ])
  })

  // Día 1 de la rama: todos entran en Mes 1, los meses 2..N están en 0 (no
  // vacíos del jsonb). Antes esto proyectaba [] (maxMes leía 1); ahora
  // proyecta Mes 2..N con 0, reflejando que el tratamiento tiene N meses.
  it('projects zeroed rows for months 2..N on day 1 of the cohort (not an empty array)', () => {
    const distribucionMes: DistItem[] = [
      { label: '1', cantidad: 5, pct: 100 },
      { label: '2', cantidad: 0, pct: 0 },
      { label: '3', cantidad: 0, pct: 0 },
      { label: '4', cantidad: 0, pct: 0 },
    ]
    expect(deriveProyeccionMesSiguiente(distribucionMes)).toEqual([
      { label: '2', cantidad: 5, pct: 100 },
      { label: '3', cantidad: 0, pct: 0 },
      { label: '4', cantidad: 0, pct: 0 },
    ])
  })

  it('excludes the count of pacientes who close their tratamiento (last month bucket) from every output row', () => {
    const distribucionMes: DistItem[] = [
      { label: '1', cantidad: 10, pct: 50 },
      { label: '2', cantidad: 10, pct: 50 },
    ]
    const proyeccion = deriveProyeccionMesSiguiente(distribucionMes)
    // Mes 2 (hoy, 10 pacientes) cierran → no aparecen corridos a un "Mes 3".
    // Solo queda Mes 2 (siguiente) = Mes 1 (hoy) corrido.
    expect(proyeccion).toEqual([{ label: '2', cantidad: 10, pct: 100 }])
  })

  // Cobertura del guard `pct: total === 0 ? 0 : ...` (code-review): sin este
  // guard, cantidad/total sería 0/0 = NaN para cada mes proyectado.
  it('returns cantidad: 0 and pct: 0 for every projected month when the whole cohort is zero (no NaN, no division by zero)', () => {
    const distribucionMes: DistItem[] = [
      { label: '1', cantidad: 0, pct: 0 },
      { label: '2', cantidad: 0, pct: 0 },
      { label: '3', cantidad: 0, pct: 0 },
      { label: '4', cantidad: 0, pct: 0 },
    ]
    expect(deriveProyeccionMesSiguiente(distribucionMes)).toEqual([
      { label: '2', cantidad: 0, pct: 0 },
      { label: '3', cantidad: 0, pct: 0 },
      { label: '4', cantidad: 0, pct: 0 },
    ])
  })

  it('ignores a "Sin etapa" bucket — no se proyectan pacientes sin mes conocido', () => {
    const distribucionMes: DistItem[] = [
      { label: '1', cantidad: 3, pct: 43 },
      { label: '2', cantidad: 0, pct: 0 },
      { label: 'Sin etapa', cantidad: 4, pct: 57 },
    ]
    expect(deriveProyeccionMesSiguiente(distribucionMes)).toEqual([
      { label: '2', cantidad: 3, pct: 100 },
    ])
  })
})
