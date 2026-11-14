import type { FilaNumeroDeAlfabeto, GrupoDeAlfabeto } from '../DiagnosticoTypes'

// Agrupa filas planas (una por alfabeto+número) por alfabeto, en el orden en que
// aparece cada uno. Base compartida de toAlfabetosCargados (Diagnostico) y
// agruparAlfabetos (Paciente).
const agruparNumerosPorAlfabeto = <F extends FilaNumeroDeAlfabeto>(
  filas: ReadonlyArray<F>,
): ReadonlyArray<GrupoDeAlfabeto<F>> => {
  const porAlfabeto = new Map<string, { primera: F; numeros: Set<number> }>()
  for (const fila of filas) {
    const grupo = porAlfabeto.get(fila.alfabetoId)
    if (grupo) grupo.numeros.add(fila.numero)
    else
      porAlfabeto.set(fila.alfabetoId, {
        primera: fila,
        numeros: new Set([fila.numero]),
      })
  }
  return Array.from(porAlfabeto.values(), ({ primera, numeros }) => ({
    primera,
    numeros: Array.from(numeros).sort((a, b) => a - b),
  }))
}

export { agruparNumerosPorAlfabeto }
