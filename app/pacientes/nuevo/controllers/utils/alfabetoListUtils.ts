import type { AlfabetoConNumeros } from '@/app/controllers/Paciente'
import type { AllDiagnosticos } from '@/app/controllers/Diagnostico'

// Catálogo de alfabetos tal como lo trae useFetchAllDiagnosticos; tipo único para
// los utils, el hook del picker y el componente.
type CatalogoAlfabetos = AllDiagnosticos['alfabetos']
type AlfabetosElegidos = ReadonlyArray<AlfabetoConNumeros>

const ordenDe = (catalogo: CatalogoAlfabetos, alfabetoId: string): number =>
  catalogo.find((a) => a.id === alfabetoId)?.orden ?? Number.MAX_SAFE_INTEGER

const alfabetosDisponibles = (
  catalogo: CatalogoAlfabetos,
  value: AlfabetosElegidos,
): CatalogoAlfabetos =>
  catalogo.filter((a) => !value.some((v) => v.alfabetoId === a.id))

const setNumerosDeAlfabeto = (
  value: AlfabetosElegidos,
  catalogo: CatalogoAlfabetos,
  alfabetoId: string,
  numeros: ReadonlyArray<number>,
): AlfabetosElegidos => {
  const sinEste = value.filter((a) => a.alfabetoId !== alfabetoId)
  if (numeros.length === 0) return sinEste
  const limpios = Array.from(new Set(numeros)).sort((a, b) => a - b)
  return [...sinEste, { alfabetoId, numeros: limpios }].sort(
    (a, b) => ordenDe(catalogo, a.alfabetoId) - ordenDe(catalogo, b.alfabetoId),
  )
}

const quitarNumero = (
  value: AlfabetosElegidos,
  alfabetoId: string,
  numero: number,
): AlfabetosElegidos =>
  value.flatMap((a) => {
    if (a.alfabetoId !== alfabetoId) return [a]
    const numeros = a.numeros.filter((n) => n !== numero)
    return numeros.length === 0 ? [] : [{ ...a, numeros }]
  })

const quitarAlfabeto = (
  value: AlfabetosElegidos,
  alfabetoId: string,
): AlfabetosElegidos => value.filter((a) => a.alfabetoId !== alfabetoId)

const formatAlfabetosResumen = (
  value: AlfabetosElegidos,
  catalogo: CatalogoAlfabetos,
  vacio: string,
): string => {
  if (value.length === 0) return vacio
  return [...value]
    .sort(
      (a, b) =>
        ordenDe(catalogo, a.alfabetoId) - ordenDe(catalogo, b.alfabetoId),
    )
    .map((a) => {
      const nombre =
        catalogo.find((c) => c.id === a.alfabetoId)?.nombre ?? a.alfabetoId
      return `${nombre} ${a.numeros.join(', ')}`
    })
    .join(' · ')
}

export type { CatalogoAlfabetos, AlfabetosElegidos }
export {
  alfabetosDisponibles,
  setNumerosDeAlfabeto,
  quitarNumero,
  quitarAlfabeto,
  formatAlfabetosResumen,
}
