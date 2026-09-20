import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Perfil } from '@/lib/tipos'
import { exigirEntorno } from '@/lib/entorno'

export async function crearClienteServidor() {
  // Nota: lanza si faltan las variables. Durante `next build`, Next
  // prerenderiza el layout -- que llama a obtenerPerfil() -- asi que quien
  // llame en ese camino debe capturarlo o la compilacion entera falla.
  const entorno = exigirEntorno()
  const almacen = await cookies()

  return createServerClient(
    entorno.url,
    entorno.anon,
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

/** El perfil de quien está en sesión, o null si no hay nadie o si la fila de `profiles` no se pudo leer. */
export async function obtenerPerfil(): Promise<Perfil | null> {
  // Sin variables de entorno no hay a quien preguntar, y eso pasa tanto en
  // `next build` (donde el layout se prerenderiza sin ellas) como en un
  // despliegue mal configurado. En ambos casos "no hay nadie en sesion" es la
  // respuesta correcta; quien avisa del problema es el middleware, que lo
  // detecta antes y muestra que variable falta.
  let supabase
  try {
    supabase = await crearClienteServidor()
  } catch {
    return null
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single()

  return data ?? null
}

/**
 * Hay sesión en `auth.users` pero no una fila correspondiente en `profiles`.
 * Ver `obtenerPerfilObligatorio` para por qué esto se distingue de "no hay
 * sesión".
 */
export class SinPerfil extends Error {
  constructor() {
    super('Hay sesión pero no se encontró un perfil para este usuario')
    this.name = 'SinPerfil'
  }
}

/**
 * Como `obtenerPerfil`, pero para las cuatro pantallas de nivel superior que
 * ya exigen sesión (`/`, `/solicitudes`, `/compras`, `/dinero`).
 *
 * `obtenerPerfil` devuelve `null` tanto para "no hay sesión" como para "hay
 * sesión pero la fila de `profiles` no existe o no se pudo leer". Esas
 * pantallas hacen `if (!perfil) redirect('/entrar')`, así que ambos casos
 * terminaban en el mismo sitio -- pero el middleware ve que sí hay un
 * usuario autenticado en `/entrar` y redirige de vuelta a `/`, que vuelve a
 * llamar a `obtenerPerfil()`, que vuelve a fallar, que vuelve a
 * redirigir... hasta ERR_TOO_MANY_REDIRECTS, sin ninguna pantalla
 * alcanzable y sin un botón para salir. Esto es transitorio si PostgREST se
 * reinicia, pero permanente para cualquiera que exista en `auth.users` sin
 * fila en `profiles` -- por ejemplo, una cuenta creada a mano desde el
 * dashboard de Supabase sin correr `crear-usuarios`.
 *
 * Aquí se lanza en el segundo caso en vez de devolver `null`, para que el
 * `error.tsx` de la app lo atrape y muestre una pantalla con un botón para
 * salir, en vez de seguir redirigiendo en círculos. El primer caso (sin
 * sesión en absoluto) sigue devolviendo `null` normalmente: ese sí debe
 * redirigir a `/entrar`, es el comportamiento correcto.
 */
export async function obtenerPerfilObligatorio(): Promise<Perfil | null> {
  // Sin variables de entorno no hay a quién preguntar. Pasa en `next build`,
  // donde Next prerenderiza estas páginas sin ellas, y en un despliegue mal
  // configurado. En ambos casos la respuesta correcta es "no hay sesión": la
  // página redirige a /entrar y allí el middleware, que sí detecta el problema
  // antes, muestra qué variable falta. Si esto lanzara, la compilación entera
  // fallaría y no habría despliegue donde ver el aviso.
  let supabase
  try {
    supabase = await crearClienteServidor()
  } catch {
    return null
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single()

  if (!data) throw new SinPerfil()
  return data
}
