import { AlertasCountBell } from './AlertasCountBell'

// Barra superior sticky, montada al tope de la columna de contenido (dentro
// del wrapper pl-[260px] de SidebarLayout, no full-width sobre el sidebar).
// Arranca mínima: solo la campana alineada a la derecha. Buscador, toggle de
// tema y breadcrumbs quedan para el rediseño del shell (fuera de alcance).
const Topbar = () => {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-border bg-card px-8 py-3.5">
      <AlertasCountBell />
    </header>
  )
}

export { Topbar }
