import type { NextRequest } from 'next/server'
import { refrescarSesion } from '@/lib/supabase/middleware'

// Antes `middleware.ts`: Next 16 renombró la convención a `proxy` y dejó la
// anterior como obsoleta. Hace exactamente lo mismo, y ahora corre en
// Node.js por defecto en vez del runtime de borde.
export async function proxy(request: NextRequest) {
  return refrescarSesion(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
