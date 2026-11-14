import { Chip } from '@/app/pacientes/components/Chip'
import type { ChipTone } from '@/app/pacientes/components/Chip'
import type { MomentoMedicion } from '@/app/controllers/Tratamiento'

interface MomentoChipProps {
  readonly momento: MomentoMedicion
}

// Reusa el molecule `Chip` ya compartido en `app/pacientes/components/Chip.tsx`
// (mismo patrón `tone` teal/violet/default que el mock, `d4c5ab46-…js:110-112`)
// en vez de reinventar variantes sobre `Badge` — "compose, don't reinvent" y
// cero tokens nuevos: teal/violet ya resuelven a `--brand-primary-*` /
// `--brand-secondary-*`. `cierre_automatico` cae en el tono neutro con el
// copy "cierre sin medición" (design §5.1 / DevSpec §7.2, "no se implementa
// el aviso al paciente" no aplica acá — es sólo el label del momento).
const MOMENTO_LABEL: Record<MomentoMedicion, string> = {
  apertura: 'apertura',
  seguimiento: 'seguimiento',
  cierre: 'cierre',
  cierre_automatico: 'cierre sin medición',
}

const MOMENTO_TONE: Record<MomentoMedicion, ChipTone> = {
  apertura: 'teal',
  seguimiento: 'default',
  cierre: 'violet',
  cierre_automatico: 'default',
}

const MomentoChip = ({ momento }: MomentoChipProps) => (
  <Chip tone={MOMENTO_TONE[momento]}>{MOMENTO_LABEL[momento]}</Chip>
)

export { MomentoChip }
export type { MomentoChipProps }
