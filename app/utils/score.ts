const LOW_SCORE_THRESHOLD = 3
const CRITICAL_SCORE_THRESHOLD = 1

const isLowScore = (score: number | null | undefined): boolean => {
  if (score === null || score === undefined) return false
  return score <= LOW_SCORE_THRESHOLD
}

// Umbral más estricto que isLowScore: reservado para el resaltado de fila en
// "Requieren tu mirada" (DEC-3) — el ScorePill ya rojea todo ≤3, el tinte de
// fila se reserva para lo verdaderamente crítico.
const isCriticalScore = (score: number | null | undefined): boolean => {
  if (score === null || score === undefined) return false
  return score <= CRITICAL_SCORE_THRESHOLD
}

export {
  LOW_SCORE_THRESHOLD,
  CRITICAL_SCORE_THRESHOLD,
  isLowScore,
  isCriticalScore,
}
