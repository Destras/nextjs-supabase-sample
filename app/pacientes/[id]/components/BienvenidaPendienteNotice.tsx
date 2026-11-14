import { Loader2, MessageCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface BienvenidaPendienteNoticeProps {
  readonly nombre: string
  readonly isSending: boolean
  readonly onReenviar: () => void
}

// Sin mockup en Aurora para este estado (escape hatch #1): Alert + Button con
// tokens existentes.
const BienvenidaPendienteNotice = ({
  nombre,
  isSending,
  onReenviar,
}: BienvenidaPendienteNoticeProps) => (
  <Alert role="status" className="mb-6">
    <MessageCircle aria-hidden />
    <AlertDescription className="flex flex-1 flex-wrap items-center justify-between gap-3">
      <span>{nombre} todavía no recibió la bienvenida por WhatsApp.</span>
      <Button
        size="sm"
        variant="outline"
        disabled={isSending}
        onClick={onReenviar}
      >
        {isSending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          'Reenviar bienvenida'
        )}
      </Button>
    </AlertDescription>
  </Alert>
)

export { BienvenidaPendienteNotice }
export type { BienvenidaPendienteNoticeProps }
