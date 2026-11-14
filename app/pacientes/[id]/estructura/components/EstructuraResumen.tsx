import { Button } from '@/components/ui/button'
import { Delta, MomentoChip, Sparkline } from '@/components/mediciones'
import type { Medicion } from '@/app/controllers/Tratamiento'
import { formatInstanteCorto } from '@/app/utils/fechaDia'
import { formatDate } from '@/lib/format'

interface EstructuraResumenProps {
  readonly actual: Medicion
  readonly previa: Medicion | null
  readonly serie: ReadonlyArray<{
    readonly fecha: string
    readonly valor: number
  }>
  readonly puedeEditar: boolean
  readonly onEditar: () => void
}

// El mock muestra `MM-DD` (`d4c5ab46-…js:554`, `m.fecha.slice(5)`); acá va
// `dd/MM/yy`: el orden del resto del panel (BETA-033) y con año (BETA-040). Dos
// dígitos porque es el eje del gráfico: con seis mediciones la fecha entera no
// entra en la columna.
// `est-hero` del mock (design §5.2, mock `EstructuraTab` P1): grilla 2
// columnas `minmax(200px,1fr) minmax(240px,1.4fr)`, 1 columna bajo 900px —
// acá vía `md:grid-cols-[...]` (breakpoint Tailwind más cercano al mock).
const EstructuraResumen = ({
  actual,
  previa,
  serie,
  puedeEditar,
  onEditar,
}: EstructuraResumenProps) => (
  <div className="grid grid-cols-1 items-start gap-8 py-1 md:grid-cols-[minmax(200px,1fr)_minmax(240px,1.4fr)]">
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Estructura general
      </p>
      <p className="mt-1.5 font-display text-6xl leading-none text-foreground">
        {actual.estructuraGeneral}
        <em className="ml-1 text-2xl not-italic text-muted-foreground">%</em>
      </p>
      <div className="mt-0.5 flex items-baseline gap-2.5">
        <Delta value={actual.deltaEstructura} size={13} />
        <span className="text-xs text-muted-foreground">
          {previa !== null
            ? `vs. ${formatDate(previa.registradaEn)}`
            : 'primera medición'}
        </span>
      </div>
      <div className="mt-3.5 flex flex-col gap-1 text-[12.5px] leading-relaxed text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-mono">{formatDate(actual.registradaEn)}</span>
          <MomentoChip momento={actual.momento} />
        </div>
        <div>Registró: {actual.autor?.nombre ?? 'Sistema'}</div>
      </div>
      {puedeEditar && (
        <Button
          type="button"
          variant="link"
          className="mt-2.5 h-auto p-0"
          onClick={onEditar}
        >
          Editar esta medición
        </Button>
      )}
    </div>
    <div>
      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Evolución en la etapa
      </p>
      <Sparkline values={serie.map((s) => s.valor)} height={96} />
      <div className="mt-1.5 flex justify-between">
        {serie.map((s) => (
          <span
            key={s.fecha}
            className="font-mono text-[10.5px] text-muted-foreground"
          >
            {formatInstanteCorto(s.fecha)} · {s.valor}
          </span>
        ))}
      </div>
    </div>
  </div>
)

export { EstructuraResumen }
export type { EstructuraResumenProps }
