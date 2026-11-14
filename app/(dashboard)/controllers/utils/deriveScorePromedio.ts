import type { Paciente } from '@/app/controllers/Paciente'

// T8 (Tier B): promedio del último score del caseload (null si ninguno tiene
// score). El breakdown de momentum se sacó junto con ScoreSaludCard (C.2.2) —
// deriveHeroStats solo consume el promedio.
const deriveScorePromedio = (
  pacientes: ReadonlyArray<Paciente>,
): number | null => {
  const withScore = pacientes.filter((p) => p.ultimoScore != null)
  if (withScore.length === 0) return null
  const sum = withScore.reduce((acc, p) => acc + (p.ultimoScore ?? 0), 0)
  return Math.round((sum / withScore.length) * 10) / 10
}

export { deriveScorePromedio }
