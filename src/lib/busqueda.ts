/**
 * Búsqueda de texto libre en las listas.
 *
 * Se busca sin mayúsculas ni tildes: quien escribe "azucar" en el teléfono
 * está buscando "Azúcar", y obligarle a poner la tilde para encontrarla es
 * obligarle a adivinar cómo la escribió otra persona. Un `ilike` de Postgres
 * sí distingue la tilde, y por eso la búsqueda se hace aquí y no en la base.
 */

/** El texto sin tildes, en minúsculas y con los espacios colapsados. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Si alguno de los `campos` contiene todas las palabras de la búsqueda, en
 * cualquier orden: "leche caja" encuentra "Dos cajas de leche". Una búsqueda
 * vacía lo encuentra todo.
 */
export function coincideBusqueda(busqueda: string, ...campos: (string | null | undefined)[]): boolean {
  const palabras = normalizarTexto(busqueda).split(' ').filter(Boolean)
  if (palabras.length === 0) return true

  const pajar = normalizarTexto(campos.filter(Boolean).join(' '))
  return palabras.every((palabra) => pajar.includes(palabra))
}
