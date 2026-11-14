import { EtapaStatus } from '../TratamientoTypes'

/**
 * True for a stage that has closed (`FINALIZADA` or `ABANDONADA`), false for
 * one still open (`EN_CURSO`, `PENDIENTE`). Extracted so `EtapaStatus` never
 * gains a member without every consumer of "is this stage closed" updating in
 * lockstep — the predicate used to be re-derived inline in both
 * `ChapterHeader` and `ResultadoBlock`.
 */
const isEtapaCerrada = (status: EtapaStatus): boolean =>
  status === EtapaStatus.FINALIZADA || status === EtapaStatus.ABANDONADA

export { isEtapaCerrada }
