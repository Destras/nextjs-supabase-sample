interface MesCalendarioLabels {
  readonly actual: string
  readonly siguiente: string
}

const capitalize = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1)

const monthLabel = (date: Date): string =>
  capitalize(new Intl.DateTimeFormat('es', { month: 'long' }).format(date))

// DEC-4: los kickers "Mes de tratamiento" / "Proyección" de las cards por-mes
// mostraban literales ("Hoy" / "Mes siguiente"); ahora muestran el nombre real
// del mes calendario. `siguiente` usa `now.getMonth() + 1` para que
// `new Date` resuelva el rollover diciembre→enero automáticamente.
const deriveMesCalendarioLabels = (now: Date): MesCalendarioLabels => ({
  actual: monthLabel(now),
  siguiente: monthLabel(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
})

export { deriveMesCalendarioLabels }
export type { MesCalendarioLabels }
