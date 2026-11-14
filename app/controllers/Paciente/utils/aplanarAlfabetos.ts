import type { AlfabetoConNumeros, EtapaAlfabetoRow } from '../PacienteTypes'

const aplanarAlfabetos = (
  value: ReadonlyArray<AlfabetoConNumeros>,
): ReadonlyArray<EtapaAlfabetoRow> =>
  value.flatMap((a) =>
    a.numeros.map((numero) => ({ alfabeto_id: a.alfabetoId, numero })),
  )

export { aplanarAlfabetos }
