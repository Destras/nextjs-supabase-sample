import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import type { JSX } from 'react'
import type { LoginViewModel } from './controllers'

const LoginView = ({
  email,
  password,
  error,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}: LoginViewModel): JSX.Element => {
  return (
    <div className="fixed inset-0 grid grid-cols-2 bg-background">
      <div
        data-theme="dark"
        className="relative flex flex-col p-12 bg-login-panel"
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo-mark.svg"
            alt=""
            aria-hidden
            width={28}
            height={28}
            unoptimized
          />
          <span className="font-login-display text-2xl font-normal tracking-tight login-text-foreground">
            Aurora
          </span>
        </div>

        <div className="flex flex-1 items-center">
          <div>
            <span
              aria-hidden
              className="block font-login-wonky login-text-primary text-7xl leading-none mb-2"
            >
              &ldquo;
            </span>
            <p className="font-login-quote max-w-[480px] login-text-faded text-3xl leading-display">
              Una marca para tapar el silencio. Una herramienta para sostener el
              camino.
            </p>
          </div>
        </div>

        <p className="eyebrow login-text-muted">v 0.4 &middot; Beta interna</p>
      </div>

      <div className="flex flex-col justify-center px-12 py-12">
        <div className="mx-auto w-full max-w-[400px]">
          <p className="eyebrow text-primary mb-3">Acceso al panel</p>

          <h2 className="font-login-display text-foreground text-6xl font-light tracking-tight leading-tight mb-3">
            Bienvenido <em className="font-login-quote">de vuelta</em>
          </h2>

          <p className="text-muted-foreground text-sm mb-8">
            Continuamos donde lo dejamos. Tus pacientes te están esperando.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="email"
                className="eyebrow-sm text-muted-foreground"
              >
                Correo profesional
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="sofia@aurora.example"
                required
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="password"
                className="eyebrow-sm text-muted-foreground"
              >
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="mt-3 w-full" disabled={isLoading}>
              {isLoading ? 'Entrando…' : 'Entrar al panel →'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={onForgotPassword}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export { LoginView }
