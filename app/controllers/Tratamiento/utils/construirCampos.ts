import type {
  CampoMedicion,
  CentroEnergetico,
  Medicion,
} from '../TratamientoTypes'

// Utilidad pura compartida (design §5.2, promovida a la entidad en PR4-refactor
// medir-chakras): shapea centrosActivos + medicionBase (la medición usada
// para precargar hints — la actual en "Nueva medición", la que se edita en
// "Editar") en el array de campos que consume MedicionForm. `centrosActivos`
// viene ordenado del RPC, pero se re-ordena acá por `orden` para no depender
// de esa garantía implícita. Estructura general siempre va al final (design
// §5.3: "a todo el ancho al final, después de un divisor"). Usada por el tab
// de Estructura y por FinalizarTratamientoDialog.
const construirCampos = (
  centrosActivos: ReadonlyArray<CentroEnergetico>,
  medicionBase: Medicion | null,
): ReadonlyArray<CampoMedicion> => {
  const camposCentros: ReadonlyArray<CampoMedicion> = [...centrosActivos]
    .sort((a, b) => a.orden - b.orden)
    .map((centro) => ({
      key: centro.id,
      label: centro.nombre,
      centroId: centro.id,
      valorAnterior:
        medicionBase?.valores.find((v) => v.centroId === centro.id)?.valor ??
        null,
    }))

  const campoEstructuraGeneral: CampoMedicion = {
    key: 'estructura_general',
    label: 'Estructura general',
    centroId: null,
    valorAnterior: medicionBase?.estructuraGeneral ?? null,
  }

  return [...camposCentros, campoEstructuraGeneral]
}

export { construirCampos }
