'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TerapeutasViewModel } from './controllers'
import { EstadoTerapeutaBadge } from './components/EstadoTerapeutaBadge'
import { InvitarTerapeutaModal } from './components/InvitarTerapeutaModal'
import { RevocarInvitacionDialog } from './components/RevocarInvitacionDialog'
import { EditarTerapeutaModal } from './components/EditarTerapeutaModal'
import { DesactivarTerapeutaDialog } from './components/DesactivarTerapeutaDialog'
import { TERAPEUTA_STATE } from '@/app/controllers/Terapeuta'
import { Chip } from '@/app/pacientes/components/Chip'

const TerapeutasView = ({
  terapeutas,
  isLoading,
  error,
  onOpenInvitar,
  isInvitarOpen,
  onCloseInvitar,
  onInvitarSuccess,
  revocarTarget,
  isRevoking,
  revokeError,
  onOpenRevocar,
  onCloseRevocar,
  onConfirmRevocar,
  onResendInvitation,
  editarTarget,
  onOpenEditar,
  onCloseEditar,
  onEditarSuccess,
  desactivarTarget,
  desactivarMotivo,
  desactivarMotivoError,
  desactivarSubmitError,
  isDeactivating,
  onOpenDesactivar,
  onCloseDesactivar,
  onDesactivarMotivoChange,
  onConfirmDesactivar,
  onReactivar,
}: TerapeutasViewModel) => {
  const router = useRouter()

  if (isLoading) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Terapeutas</h1>
          <Button onClick={onOpenInvitar}>Invitar terapeuta</Button>
        </header>
        <p className="text-sm text-muted-foreground">Cargando terapeutas...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Terapeutas</h1>
          <Button onClick={onOpenInvitar}>Invitar terapeuta</Button>
        </header>
        <p className="text-sm text-destructive">{error}</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Terapeutas</h1>
        <Button onClick={onOpenInvitar}>Invitar terapeuta</Button>
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Pacientes a cargo</TableHead>
            <TableHead>Alertas</TableHead>
            <TableHead>Sin iniciar</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-12" aria-label="Acciones" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {terapeutas.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                Todavía no hay terapeutas.
              </TableCell>
            </TableRow>
          ) : (
            terapeutas.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.profile.name}</TableCell>
                <TableCell>{t.email}</TableCell>
                <TableCell>{t.pacientesActivos}</TableCell>
                <TableCell>
                  <Link href={`/terapeutas/${t.id}`} className="inline-block">
                    {(t.alertasActivas ?? 0) > 0 ? (
                      <Chip tone="coral" withDot>
                        {t.alertasActivas}
                      </Chip>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  {(t.sinIniciar ?? 0) > 0 ? (
                    <Chip tone="gold">{t.sinIniciar}</Chip>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <EstadoTerapeutaBadge estado={t.state} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Acciones">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/terapeutas/${t.id}`)}
                      >
                        Ver detalle
                      </DropdownMenuItem>
                      {(t.state === TERAPEUTA_STATE.ACTIVO ||
                        t.state === TERAPEUTA_STATE.INACTIVO) && (
                        <DropdownMenuItem onClick={() => onOpenEditar(t)}>
                          Editar
                        </DropdownMenuItem>
                      )}
                      {t.state === TERAPEUTA_STATE.ACTIVO && (
                        <DropdownMenuItem
                          onClick={() => onOpenDesactivar(t)}
                          className="text-destructive focus:text-destructive"
                        >
                          Desactivar
                        </DropdownMenuItem>
                      )}
                      {t.state === TERAPEUTA_STATE.INACTIVO && (
                        <DropdownMenuItem onClick={() => onReactivar(t)}>
                          Reactivar
                        </DropdownMenuItem>
                      )}
                      {t.state === TERAPEUTA_STATE.PENDIENTE && (
                        <>
                          <DropdownMenuItem
                            onClick={() => onResendInvitation(t)}
                          >
                            Reenviar invitación
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onOpenRevocar(t)}
                            className="text-destructive focus:text-destructive"
                          >
                            Revocar invitación
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <InvitarTerapeutaModal
        isOpen={isInvitarOpen}
        onClose={onCloseInvitar}
        onSuccess={onInvitarSuccess}
      />
      <RevocarInvitacionDialog
        terapeuta={revocarTarget}
        isSubmitting={isRevoking}
        errorMessage={revokeError}
        onConfirm={onConfirmRevocar}
        onClose={onCloseRevocar}
      />
      <EditarTerapeutaModal
        terapeuta={editarTarget}
        onClose={onCloseEditar}
        onSuccess={onEditarSuccess}
      />
      <DesactivarTerapeutaDialog
        terapeuta={desactivarTarget}
        motivo={desactivarMotivo}
        motivoError={desactivarMotivoError}
        submitError={desactivarSubmitError}
        isSubmitting={isDeactivating}
        onMotivoChange={onDesactivarMotivoChange}
        onConfirm={onConfirmDesactivar}
        onClose={onCloseDesactivar}
      />
    </main>
  )
}

export { TerapeutasView }
