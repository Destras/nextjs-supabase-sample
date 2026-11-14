import { EmptyState } from '@/components/empty-state'

// 404 de todo el panel (BETA-041): cubre las rutas que no existen y cualquier
// `notFound()`. Se renderiza dentro del layout raíz, así que con sesión queda
// dentro del menú y en `/auth/*` ocupa la pantalla entera. Sin mock en Aurora:
// reusa el empty state full-page del panel.
const NotFound = () => (
  <main className="flex min-h-dvh flex-col items-center justify-center p-8">
    <EmptyState
      title="No encontramos esa página"
      message="Puede que el enlace esté mal o que la página ya no exista."
      ctaLabel="Volver al inicio"
      ctaHref="/"
    />
  </main>
)

export default NotFound
