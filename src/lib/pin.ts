/**
 * Reglas del PIN que cada persona crea para sí misma la primera vez que
 * entra. Viven aquí, aparte de la acción de servidor, porque son la única
 * parte del flujo que se puede probar sin hablar con Supabase.
 *
 * Los mensajes se exportan para que la prueba compruebe cuál de los dos
 * fallos ocurrió sin copiar el texto -- si el texto cambia, la prueba sigue
 * siendo cierta.
 */

export const PIN_CORTO = 'El PIN debe ser de 6 dígitos'
export const PIN_NO_COINCIDE = 'Los dos PIN no son iguales'

/** `null` si el PIN sirve; si no, el mensaje que ve la persona. */
export function validarPinNuevo(pin: string, repeticion: string): string | null {
  // El formato se comprueba antes que la coincidencia: decir "no coinciden"
  // cuando el problema es que faltan dígitos manda a corregir lo que no está mal.
  if (!/^\d{6}$/.test(pin)) return PIN_CORTO
  if (pin !== repeticion) return PIN_NO_COINCIDE
  return null
}
