import { agruparNumerosPorAlfabeto } from '@/app/controllers/Diagnostico'
import type { AlfabetoConNumeros, EtapaAlfabetoRow } from '../PacienteTypes'

// Filas de etapa_alfabetos → un AlfabetoConNumeros por alfabeto, en el orden de
// primera aparición y con los números sin duplicados, de menor a mayor.
const agruparAlfabetos = (
  rows: ReadonlyArray<EtapaAlfabetoRow>,
): ReadonlyArray<AlfabetoConNumeros> =>
  agruparNumerosPorAlfabeto(
    rows.map((row) => ({ alfabetoId: row.alfabeto_id, numero: row.numero })),
  ).map(({ primera, numeros }) => ({ alfabetoId: primera.alfabetoId, numeros }))

export { agruparAlfabetos }
