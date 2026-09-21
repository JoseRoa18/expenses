/**
 * Las dos variables que la app necesita para hablar con Supabase.
 *
 * Existe este archivo porque el fallo que evita es especialmente cruel: si
 * falta una, `createServerClient` revienta dentro del middleware y el
 * navegador muestra "MIDDLEWARE_INVOCATION_FAILED" — un muro en blanco que no
 * dice nada sobre la causa, en todas las rutas a la vez, incluida la de
 * entrada. Pasó en el primer despliegue a Vercel.
 *
 * `leerEntorno` devuelve qué falta en vez de lanzar, para que quien llame
 * decida cómo contarlo. El middleware no puede permitirse lanzar.
 */

export type Entorno = { url: string; anon: string }

export type ResultadoEntorno =
  | { ok: true; entorno: Entorno }
  | { ok: false; faltan: string[] }

export function leerEntorno(): ResultadoEntorno {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const faltan: string[] = []
  if (!url?.trim()) faltan.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anon?.trim()) faltan.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (faltan.length > 0) return { ok: false, faltan }
  return { ok: true, entorno: { url: url!, anon: anon! } }
}

/**
 * Para el código de servidor que sí puede lanzar. El mensaje nombra la
 * variable concreta que falta: buscar a ciegas cuál de las dos es lo que
 * convierte cinco minutos en una tarde.
 */
export function exigirEntorno(): Entorno {
  const resultado = leerEntorno()
  if (!resultado.ok) {
    throw new Error(
      `Falta configurar ${resultado.faltan.join(' y ')}. ` +
        'En local va en .env.local; en Vercel, en Settings → Environment Variables ' +
        '(y hay que volver a desplegar para que surta efecto).',
    )
  }
  return resultado.entorno
}

/**
 * La llave de servicio, que puentea las políticas de la base de datos.
 *
 * Solo la usa el camino de "crear mi PIN": quien está en esa pantalla
 * todavía no tiene sesión, y las políticas de `profiles` exigen estar
 * autenticado, así que no hay forma de preguntar con la llave pública si
 * una cuenta ya tiene PIN.
 *
 * Va aparte de `leerEntorno` a propósito: el middleware, que es quien avisa
 * de las variables que faltan, corre en cada petición y no necesita esta.
 * Exigirla allí convertiría "falta una variable que solo hace falta para
 * entrar" en "la app entera no responde".
 */
export function exigirLlaveDeServicio(): string {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave?.trim()) {
    throw new Error(
      'Falta configurar SUPABASE_SERVICE_ROLE_KEY. En local va en .env.local; ' +
        'en Vercel, en Settings → Environment Variables (y hay que volver a ' +
        'desplegar para que surta efecto). Sin ella nadie puede crear su PIN. ' +
        'Nunca con el prefijo NEXT_PUBLIC_: eso la mandaría al navegador.',
    )
  }
  return llave
}
