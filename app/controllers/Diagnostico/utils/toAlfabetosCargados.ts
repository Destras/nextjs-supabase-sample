import type { AlfabetoCargado, FilaNumeroDeAlfabeto } from '../DiagnosticoTypes'
import { agruparNumerosPorAlfabeto } from './agruparNumerosPorAlfabeto'

interface FilaAlfabetoCargado extends FilaNumeroDeAlfabeto {
  readonly nombre: string
  readonly orden: number
}

// Agrupa filas planas (una por alfabeto+número) en un AlfabetoCargado por
// alfabeto: números sin duplicados y ascendentes, alfabetos en orden de catálogo.
const toAlfabetosCargados = (
  filas: ReadonlyArray<FilaAlfabetoCargado>,
): ReadonlyArray<AlfabetoCargado> =>
  agruparNumerosPorAlfabeto([...filas].sort((a, b) => a.orden - b.orden)).map(
    ({ primera, numeros }) => ({
      alfabetoId: primera.alfabetoId,
      nombre: primera.nombre,
      numeros,
    }),
  )

export type { FilaAlfabetoCargado }
export { toAlfabetosCargados }
