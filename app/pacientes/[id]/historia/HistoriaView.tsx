import type { HistoriaTabViewModel } from './controllers'
import { HistoriaChapter } from './components/HistoriaChapter'
import { HistoriaEmptyState } from './components/HistoriaEmptyState'
import { HistoriaErrorState } from './components/HistoriaErrorState'
import { HistoriaLoadingState } from './components/HistoriaLoadingState'

const HistoriaView = ({
  isLoading,
  error,
  isEmpty,
  capitulos,
  centros,
  refresh,
}: HistoriaTabViewModel) => {
  if (isLoading) return <HistoriaLoadingState />
  if (error !== null) return <HistoriaErrorState onRetry={refresh} />
  if (isEmpty) return <HistoriaEmptyState />
  return (
    <div className="flex flex-col gap-4">
      {capitulos.map(({ etapa, expandidoInicial }) => (
        <HistoriaChapter
          key={etapa.id}
          etapa={etapa}
          defaultOpen={expandidoInicial}
          centros={centros}
        />
      ))}
    </div>
  )
}

export { HistoriaView }
