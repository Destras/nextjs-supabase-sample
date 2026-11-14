import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  Fraunces,
  Geist,
  Geist_Mono,
  IBM_Plex_Sans,
  Instrument_Serif,
} from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { SidebarLayout } from '@/components/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Aurora — Gestión Clínica',
  description: 'Dashboard de gestión terapéutica bioenergética',
}

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
})

// Login-specific fonts — only used in the auth/login dark decorative panel.
// Fraunces: variable serif; axes opsz + SOFT + WONK loaded for full variation control.
// Instrument Serif: elegant serif with a true italic cut.
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT', 'WONK'],
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  preload: false,
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexSans.variable} ${fraunces.variable} ${instrumentSerif.variable} antialiased`}
      >
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>
            <Suspense fallback={null}>
              <SidebarLayout>{children}</SidebarLayout>
            </Suspense>
            <Toaster
              toastOptions={{
                classNames: {
                  toast: 'border bg-card text-card-foreground',
                  success: 'bg-success-bg text-success border-success/30',
                  error:
                    'bg-destructive-bg text-destructive border-destructive/30',
                  warning: 'bg-warning-bg text-warning border-warning/30',
                  info: 'bg-info-bg text-info border-info/30',
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
