import { rutaInternaSegura } from '@/app/controllers/Auth'
import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // `next` viene de la URL: solo se acepta una ruta interna del panel, para que
  // un link armado a mano no saque al usuario del sitio después de verificar.
  const next = rutaInternaSegura(searchParams.get('next'), '/')

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      redirect(next)
    } else {
      // /auth/error traduce el `code`; el `message` crudo de Supabase está en
      // inglés y no se le muestra al usuario.
      redirect(
        error.code
          ? `/auth/error?error=${encodeURIComponent(error.code)}`
          : '/auth/error',
      )
    }
  }

  // Sin token no hay nada que verificar: /auth/error muestra su mensaje genérico.
  redirect('/auth/error')
}
