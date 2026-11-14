// Texto del aviso que confirma un "reemplazar y eliminar": `affected` es la
// cantidad de pacientes cuyo plan pasó a usar el contenido de reemplazo.
const formatReemplazoToast = (affected: number): string => {
  if (affected <= 0) {
    return 'Reemplazamos el contenido y eliminamos el original.'
  }
  const pacientes = affected === 1 ? 'paciente' : 'pacientes'
  return `Reemplazamos el contenido en ${affected} ${pacientes} y eliminamos el original.`
}

export { formatReemplazoToast }
