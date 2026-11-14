// ¿El usuario cargó algo en el wizard? (pulidoBeta / BETA-047)
//
// Compara lo cargado contra el estado inicial, ignorando `paso`: avanzar o
// volver de paso no es un cambio que se pueda perder. Los estados de los
// wizards son datos planos (strings, null, listas de ids), así que alcanza con
// comparar su JSON.

interface EstadoDeWizard {
  readonly paso: number
}

const sinPaso = <T extends EstadoDeWizard>(estado: T): string =>
  JSON.stringify({ ...estado, paso: null })

const hayCambiosEnWizard = <T extends EstadoDeWizard>(
  actual: T,
  inicial: T,
): boolean => sinPaso(actual) !== sinPaso(inicial)

export { hayCambiosEnWizard }
