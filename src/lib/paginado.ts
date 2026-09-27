/**
 * Leer una tabla entera, de a trozos.
 *
 * Supabase no devuelve más de 1.000 filas por consulta, y no avisa cuando
 * corta: la respuesta llega con 1.000 filas y sin error. Una lista cortada
 * se nota; un total del resumen sumado sobre 1.000 de 1.200 gastos no se nota
 * nunca, y es un número falso en la pantalla que se usa para decidir.
 *
 * Por eso se pide el total (`count`) y se sigue pidiendo hasta tenerlo. Se
 * avanza por lo que de verdad llegó y no por el tamaño pedido, para que
 * funcione igual si el proyecto tiene configurado un tope distinto.
 */

export const TAMANO_TROZO = 1000

/** Techo defensivo: 50.000 filas son décadas de gastos de una casa. */
const MAXIMO_TROZOS = 50

export type Trozo<T> = { data: T[] | null; error: unknown; count?: number | null }

/**
 * `pedir(desde, hasta)` hace la consulta de un trozo (índices incluidos,
 * como `.range()`). Devuelve todas las filas, o `null` si algún trozo falló:
 * media lista no se hace pasar por la lista entera.
 */
export async function leerPorTrozos<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<Trozo<T>>,
): Promise<T[] | null> {
  const filas: T[] = []
  let total: number | null = null

  for (let vuelta = 0; vuelta < MAXIMO_TROZOS; vuelta++) {
    const { data, error, count } = await pedir(filas.length, filas.length + TAMANO_TROZO - 1)
    if (error || !data) return null
    if (total === null && typeof count === 'number') total = count

    filas.push(...data)
    if (data.length === 0) return filas
    if (total !== null && filas.length >= total) return filas
  }

  return null
}
