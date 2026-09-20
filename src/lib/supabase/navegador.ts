import { createBrowserClient } from '@supabase/ssr'
import { exigirEntorno } from '@/lib/entorno'

export function crearClienteNavegador() {
  const entorno = exigirEntorno()
  return createBrowserClient(
    entorno.url,
    entorno.anon,
  )
}
