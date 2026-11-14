// Saludo del header del dashboard terapeuta, según la hora del día (local) +
// nombre. Pura y testeable: el now se inyecta.
const buildSaludo = (nombre: string | null, now: Date): string => {
  const hora = now.getHours()
  const franja =
    hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  return nombre ? `${franja}, ${nombre}` : franja
}

export { buildSaludo }
