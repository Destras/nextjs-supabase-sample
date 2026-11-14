import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../lib/response.ts'

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const handleInvite = async (
  supabaseAdmin: SupabaseClient,
  body: unknown,
): Promise<Response> => {
  // Validate shape
  if (
    typeof (body as Record<string, unknown>).nombre !== 'string' ||
    typeof (body as Record<string, unknown>).email !== 'string'
  ) {
    return jsonResponse(400, { error: 'body_invalido' })
  }
  const { nombre, email } = body as { nombre: string; email: string }

  if (!nombre.trim() || !isValidEmail(email)) {
    return jsonResponse(400, { error: 'validacion_invalida' })
  }

  // Pre-check email duplicado
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
  if (
    existing?.users.some(
      (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
    )
  ) {
    return jsonResponse(400, { error: 'email_duplicado' })
  }

  // 1. Crear auth user (Supabase manda el email automáticamente)
  const { data: invite, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get('WEB_CONSOLE_URL')}/auth/update-password`,
      data: { nombre },
    })
  if (inviteError || !invite?.user) {
    console.error(
      JSON.stringify({
        action: 'invite',
        step: 'inviteUserByEmail',
        errorCode: inviteError?.code ?? null,
        errorMessage: inviteError?.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'invite_failed' })
  }
  const newUserId = invite.user.id

  // 2. Asegurar profile.rol_id = rol terapeuta
  const { data: rolRow } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('codigo', 'terapeuta')
    .single()
  if (!rolRow) {
    console.error(
      JSON.stringify({
        action: 'invite',
        step: 'rol_terapeuta_lookup',
        terapeutaId: newUserId,
        errorMessage: 'rol_terapeuta_no_encontrado',
      }),
    )
    await supabaseAdmin.auth.admin.deleteUser(newUserId) // rollback
    return jsonResponse(500, { error: 'rol_terapeuta_no_encontrado' })
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ nombre, rol_id: rolRow.id })
    .eq('id', newUserId)
  if (profileError) {
    console.error(
      JSON.stringify({
        action: 'invite',
        step: 'profile_update',
        terapeutaId: newUserId,
        errorCode: profileError.code ?? null,
        errorMessage: profileError.message ?? null,
      }),
    )
    await supabaseAdmin.auth.admin.deleteUser(newUserId) // rollback
    return jsonResponse(500, { error: 'profile_update_failed' })
  }

  // 3. Insertar fila terapeutas con estado_id = pendiente
  const { data: estadoRow } = await supabaseAdmin
    .from('estados_terapeuta')
    .select('id')
    .eq('codigo', 'pendiente')
    .single()
  if (!estadoRow) {
    console.error(
      JSON.stringify({
        action: 'invite',
        step: 'estado_pendiente_lookup',
        terapeutaId: newUserId,
        errorMessage: 'estado_pendiente_no_seedeado',
      }),
    )
    await supabaseAdmin.auth.admin.deleteUser(newUserId) // rollback
    return jsonResponse(500, { error: 'estado_pendiente_no_seedeado' })
  }

  const { error: terapeutaError } = await supabaseAdmin
    .from('terapeutas')
    .insert({ id: newUserId, estado_id: estadoRow.id, activo: true })
  if (terapeutaError) {
    console.error(
      JSON.stringify({
        action: 'invite',
        step: 'terapeuta_insert',
        terapeutaId: newUserId,
        errorCode: terapeutaError.code ?? null,
        errorMessage: terapeutaError.message ?? null,
      }),
    )
    await supabaseAdmin.auth.admin.deleteUser(newUserId) // rollback
    return jsonResponse(500, { error: 'terapeuta_insert_failed' })
  }

  return jsonResponse(200, { ok: true, terapeutaId: newUserId })
}

export { handleInvite }
