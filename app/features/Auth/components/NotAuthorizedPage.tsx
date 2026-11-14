'use client'

import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface NotAuthorizedPageProps {
  readonly title?: string
  readonly message?: string
  readonly redirectHref?: string
  readonly redirectLabel?: string
}

const NotAuthorizedPage = ({
  title = 'No autorizado',
  message = 'No tenés permisos para ver esta sección.',
  redirectHref = '/',
  redirectLabel = 'Volver al inicio',
}: NotAuthorizedPageProps): JSX.Element => {
  const router = useRouter()
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <Button onClick={() => router.push(redirectHref)}>
            {redirectLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export { NotAuthorizedPage }
export type { NotAuthorizedPageProps }
