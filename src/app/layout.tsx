import type { Metadata, Viewport } from 'next'
import { Navegacion } from '@/componentes/Navegacion'
import { obtenerPerfil } from '@/lib/supabase/servidor'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gastos',
  description: 'Control de gastos compartidos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfil()

  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
        {perfil && <Navegacion rol={perfil.rol} />}
      </body>
    </html>
  )
}
