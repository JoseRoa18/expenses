import { createClient } from '@supabase/supabase-js'
import { exigirEntorno, exigirLlaveDeServicio } from '@/lib/entorno'

/**
 * Cliente con la llave de servicio: no pasa por las políticas de la base de
 * datos. Solo puede usarse desde el servidor, y solo donde de verdad no hay
 * sesión todavía -- hoy, únicamente el flujo de "crear mi PIN".
 *
 * No guarda sesión ni refresca tokens: no representa a ninguna persona, es
 * una llave suelta que se usa y se olvida en la misma petición.
 */
export function crearClienteAdministrador() {
  const { url } = exigirEntorno()

  return createClient(url, exigirLlaveDeServicio(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
