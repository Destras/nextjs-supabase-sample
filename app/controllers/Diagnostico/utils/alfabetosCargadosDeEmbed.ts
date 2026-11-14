import type { AlfabetoCargado, EtapaAlfabetoEmbed } from '../DiagnosticoTypes'
import { toAlfabetosCargados } from './toAlfabetosCargados'

// Traduce el embed `etapa_alfabetos(numero, alfabetos(...))` a los alfabetos
// cargados de la etapa. Las filas sin alfabeto (catálogo no visible) se descartan.
const alfabetosCargadosDeEmbed = (
  embed: ReadonlyArray<EtapaAlfabetoEmbed>,
): ReadonlyArray<AlfabetoCargado> =>
  toAlfabetosCargados(
    embed.flatMap((fila) =>
      fila.alfabetos
        ? [
            {
              alfabetoId: fila.alfabetos.id,
              nombre: fila.alfabetos.nombre,
              orden: fila.alfabetos.orden,
              numero: fila.numero,
            },
          ]
        : [],
    ),
  )

export { alfabetosCargadosDeEmbed }
