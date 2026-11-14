import Link from 'next/link'
import { Button } from '@/components/ui/button'

const AccessDeniedState = () => (
  <main className="flex min-h-dvh flex-col items-center justify-center p-8">
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <h1 className="text-3xl font-medium tracking-tight">
        No tenés acceso a este paciente.
      </h1>
      <Button asChild variant="outline">
        <Link href="/pacientes">Volver a Mis pacientes</Link>
      </Button>
    </div>
  </main>
)

export { AccessDeniedState }
