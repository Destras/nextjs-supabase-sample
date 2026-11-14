import {
  AudioWaveform,
  BrainCircuit,
  Images,
  Quote,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react'
import type { ColumnKey } from '@/app/controllers/Tratamiento'

/**
 * Single source of truth for how each grid COLUMN is presented in the plan
 * table — consumed by BOTH the column header (PlanEnviosCard) and the data rows
 * (SemanaRow). Keeping it here prevents the two from drifting (e.g. the header
 * dot color no longer matching the combobox icon in the column beneath it).
 *
 * Ordered to match the grid columns: Meditación · Mantra · Egregor · CMA · IC
 * · Frase. `meditacion`, `mantra`, `egregor`, `cma` and `ic` are fillable
 * (combobox); `frases` is a read-only, automatic column (no `comboboxKind`).
 *
 * Token collapse (design §9.3): only 3 brand hues exist
 * (brand-secondary-500, brand-primary-500, brand-accent-500) and the token
 * freeze forbids a 4th for the 6 columns now in play. Colour is cycled as a
 * GROUPING cue, not identity — identity is carried by the Icon:
 * meditacion/cma → secondary, mantra/ic → primary, egregor/frases → accent.
 */
interface SlotPresentation {
  readonly slot: ColumnKey
  readonly Icon: LucideIcon
  /** Brand color of the header dot. Full class — Tailwind can't interpolate. */
  readonly dotClass: string
  /** `?tipo=` segment of the /contenido/[id] preview deep-link. */
  readonly tipoParam: string
  /**
   * Column header copy — short names (BETA-026), the same ones the Contenido
   * tab of the patient record uses (SLOT_HEADER_LABELS in ContenidoGrid.tsx).
   * Keep both in sync by hand: a longer label gets cut off in a ~150px column.
   */
  readonly headerLabel: string
  /** Combobox aria kind ("Video" · "Audio/mantra"). Absent for read-only columns. */
  readonly comboboxKind?: string
  /** Preview aria kind ("video" · "mantra" · "egregor" · "cma" · "ic" · "frase"). */
  readonly previewKind: string
}

const SLOT_PRESENTATION: ReadonlyArray<SlotPresentation> = [
  {
    slot: 'meditacion',
    Icon: Video,
    dotClass: 'bg-brand-secondary-500',
    tipoParam: 'videos',
    headerLabel: 'Meditación',
    comboboxKind: 'Video',
    previewKind: 'video',
  },
  {
    slot: 'mantra',
    Icon: AudioWaveform,
    dotClass: 'bg-brand-primary-500',
    tipoParam: 'mantras',
    headerLabel: 'Mantra',
    comboboxKind: 'Audio/mantra',
    previewKind: 'mantra',
  },
  {
    slot: 'egregor',
    Icon: Sparkles,
    dotClass: 'bg-brand-accent-500',
    tipoParam: 'egregores',
    headerLabel: 'Egregor',
    comboboxKind: 'Egregor',
    previewKind: 'egregor',
  },
  {
    slot: 'cma',
    Icon: Images,
    dotClass: 'bg-brand-secondary-500',
    tipoParam: 'cma',
    headerLabel: 'CMA',
    comboboxKind: 'CMA',
    previewKind: 'cma',
  },
  {
    slot: 'ic',
    Icon: BrainCircuit,
    dotClass: 'bg-brand-primary-500',
    tipoParam: 'ic',
    headerLabel: 'IC',
    comboboxKind: 'IC',
    previewKind: 'ic',
  },
  {
    slot: 'frases',
    Icon: Quote,
    dotClass: 'bg-brand-accent-500',
    tipoParam: 'frases',
    headerLabel: 'Frases',
    previewKind: 'frase',
  },
]

export type { SlotPresentation }
export { SLOT_PRESENTATION }
