import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Perfil } from '@/lib/tipos'

export async function crearClienteServidor() {
  const almacen = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (cookiesNuevas) => {
          try {
            cookiesNuevas.forEach(({ name, value, options }) =>
              almacen.set(name, value, options),
            )
          } catch {
            // Los componentes de servidor no pueden escribir cookies.
            // El middleware ya refresca la sesión, así que se ignora.
          }
        },
      },
    },
  )
}

/** El perfil de quien está en sesión, o null si no hay nadie. */
export async function obtenerPerfil(): Promise<Perfil | null> {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single()

  return data ?? null
}
