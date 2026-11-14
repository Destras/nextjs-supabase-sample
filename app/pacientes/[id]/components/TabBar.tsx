'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const IMPLEMENTED_TABS = [
  'camino',
  'estructura',
  'evaluaciones',
  'contenido',
  'historia',
] as const
type TabKey =
  | 'camino'
  | 'estructura'
  | 'evaluaciones'
  | 'contenido'
  | 'notas'
  | 'historia'

// "Estructura" entre "Camino" y "Evaluaciones" — OD-1 (design §8), como en
// el mock (bundle 62bd24e4-…js:532-541).
const TABS: ReadonlyArray<{ readonly key: TabKey; readonly label: string }> = [
  { key: 'camino', label: 'Camino' },
  { key: 'estructura', label: 'Estructura' },
  { key: 'evaluaciones', label: 'Evaluaciones' },
  { key: 'contenido', label: 'Contenido' },
  { key: 'notas', label: 'Notas clínicas' },
  { key: 'historia', label: 'Historia' },
]

const isImplemented = (key: TabKey): boolean =>
  (IMPLEMENTED_TABS as ReadonlyArray<string>).includes(key)

const TabBar = () => {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()

  return (
    <div className="mb-6 flex border-b border-border">
      {TABS.map(({ key, label }) => {
        const href = `/pacientes/${params.id}/${key}`
        const isActive = pathname === href || pathname.startsWith(`${href}/`)
        const baseClass =
          '-mb-px border-b-2 px-4 py-3 text-sm transition-colors'

        if (!isImplemented(key)) {
          return (
            <span
              key={key}
              aria-disabled="true"
              className={cn(
                baseClass,
                'cursor-not-allowed border-transparent text-muted-foreground opacity-50',
              )}
            >
              {label}
            </span>
          )
        }

        return (
          <Link
            key={key}
            href={href}
            className={cn(
              baseClass,
              isActive
                ? 'border-brand-accent-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

export { TabBar }
