'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ContenidoTabLink, TabKey } from '@/app/contenido/controllers'

interface ContenidoTabBarProps {
  readonly tabs: ReadonlyArray<ContenidoTabLink>
}

// Copy delta vs the plantillas mockup (aurora-ui Step 5): five tabs don't
// fit the original two-tab labels. 'Meditaciones en video' shortens to
// 'Meditaciones'; the three new tabs get short, scannable labels.
const TAB_LABEL: Record<TabKey, string> = {
  videos: 'Meditaciones',
  mantras: 'Mantras',
  egregores: 'Egregores',
  cma: 'CMA',
  ic: 'IC',
}

const ContenidoTabBar = ({ tabs }: ContenidoTabBarProps) => (
  <div className="mb-6 flex border-b border-border">
    {tabs.map(({ tab, href, count, isActive }) => (
      <Link
        key={tab}
        href={href}
        className={cn(
          '-mb-px border-b-2 px-[18px] py-3 text-sm transition-colors',
          isActive
            ? 'border-brand-accent-500 text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        {`${TAB_LABEL[tab]} · ${count}`}
      </Link>
    ))}
  </div>
)

export { ContenidoTabBar }
