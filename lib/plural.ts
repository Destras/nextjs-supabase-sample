// "1 centro" / "3 centros": el número con el sustantivo que le corresponde
// (pulidoBeta / BETA-049). En castellano el 0 va en plural.
const plural = (n: number, singular: string, enPlural: string): string =>
  `${n} ${n === 1 ? singular : enPlural}`

export { plural }
