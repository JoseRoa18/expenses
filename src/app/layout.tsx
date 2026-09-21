import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import { Navegacion } from '@/componentes/Navegacion'
import { obtenerPerfil } from '@/lib/supabase/servidor'
import './globals.css'

/**
 * IBM Plex Sans: una fuente de las que se usan en tableros y documentos de
 * trabajo, con números claros y una letra que aguanta el tamaño chico. Esto
 * es un libro de cuentas de una casa, no una revista, y la fuente del
 * sistema que había antes no era una decisión: era lo que tocó.
 */
const fuente = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fuente-texto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gastos',
  description: 'Control de gastos compartidos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Ya no se prohíbe el zoom. Antes estaba con `maximumScale: 1` para que
  // iOS no diera el salto de acercamiento al enfocar un campo; ahora los
  // campos tienen letra de 16 px (ver Campo.tsx), que es lo que de verdad
  // evita ese salto, y a cambio se puede acercar una factura con los dedos.
  themeColor: '#f8fafc',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfil()

  return (
    <html lang="es" className={fuente.variable}>
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
        {perfil && <Navegacion rol={perfil.rol} />}
      </body>
    </html>
  )
}
