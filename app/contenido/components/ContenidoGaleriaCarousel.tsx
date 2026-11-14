import { AlertCircle, Images } from 'lucide-react'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { ContenidoThumb } from '@/app/contenido/components/ContenidoThumb'
import type { ContenidoImagen } from '@/app/controllers/Contenido'
import { useFetchContenidoImagenesUrls } from '@/app/controllers/Contenido'

interface ContenidoGaleriaCarouselProps {
  readonly imagenes: ReadonlyArray<ContenidoImagen>
}

/**
 * Carousel over a gallery's signed image URLs, in `orden` sequence (design
 * §8.3). Occupies the same stage slot as `MediaPlayer` in
 * `ContenidoDetailView.tsx` for CMA/IC content and mirrors its state
 * precedence (empty → error → loading → ready) and its
 * `aspect-video`/rounded/bordered stage container.
 *
 * No mockup equivalent for a carousel (aurora-ui escape hatch #1): reuses the
 * `plantillas`-derived stage container already established by
 * `MediaPlayer`/`ContenidoThumb`.
 */
export function ContenidoGaleriaCarousel({
  imagenes,
}: ContenidoGaleriaCarouselProps) {
  const paths = imagenes.map((imagen) => imagen.path)
  const { urls, isLoading, error } = useFetchContenidoImagenesUrls(paths)

  // Empty gallery (e.g. a `futura` week nulls `imagenes` to `[]` by design,
  // and the RPC guarantees nothing about non-empty galleries otherwise) — an
  // empty carousel shell would look broken, so this short-circuits before
  // even considering the hook's loading/error state.
  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-border bg-muted/40 py-12 text-center">
        <Images className="h-10 w-10 text-muted-foreground/50" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Esta galería todavía no tiene imágenes.
        </p>
      </div>
    )
  }

  // Signing failed outright, or every signed entry came back errored
  // (createSignedUrls batches the request, not the per-object outcome — see
  // useFetchContenidoImagenesUrls) — surface it rather than render an empty
  // carousel shell.
  if (!isLoading && (error !== null || urls.length === 0)) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-[var(--radius)] border border-border bg-destructive-bg px-6 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No pudimos cargar las imágenes de esta galería.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return <ContenidoThumb thumbKind="galeria" size="stage" duracion={null} />
  }

  return (
    <Carousel className="w-full">
      <CarouselContent>
        {urls.map(({ path, signedUrl }, index) => (
          <CarouselItem key={path}>
            <div className="overflow-hidden rounded-[var(--radius)] border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed
                  Storage URLs are incompatible with next/image (no
                  images.remotePatterns configured for this bucket). */}
              <img
                src={signedUrl}
                alt={`Imagen ${index + 1} de ${urls.length} de la galería`}
                className="aspect-video w-full object-cover"
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {/* No dead prev/next affordances for a single-image gallery. */}
      {urls.length > 1 && (
        <>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </>
      )}
    </Carousel>
  )
}
