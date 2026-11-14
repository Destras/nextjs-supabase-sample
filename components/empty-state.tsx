import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  readonly title: string
  readonly titleHighlight?: string
  readonly message: string
  readonly ctaLabel?: string
  readonly ctaHref?: string
  readonly ctaIcon?: LucideIcon
}

// Empty state compartido por /pacientes y el dashboard (terapeuta + admin).
// Renderiza solo el bloque interno — el wrapper `<main className="flex
// min-h-dvh flex-col items-center justify-center p-8">` queda en cada call
// site, tal como estaba antes de extraer este componente. No duplicar este
// markup: si necesitás un empty state full-page nuevo, reusá este.
const EmptyState = ({
  title,
  titleHighlight,
  message,
  ctaLabel,
  ctaHref,
  ctaIcon: CtaIcon,
}: EmptyStateProps) => {
  return (
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <h1 className="text-3xl font-medium tracking-tight">
        {title}
        {titleHighlight && (
          <>
            {' '}
            <span className="font-semibold text-primary">{titleHighlight}</span>
          </>
        )}
      </h1>
      <p className="text-muted-foreground">{message}</p>
      {ctaHref && ctaLabel && (
        <div className="mt-2">
          <Button asChild>
            <Link href={ctaHref}>
              {CtaIcon && <CtaIcon />}
              {ctaLabel}
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
