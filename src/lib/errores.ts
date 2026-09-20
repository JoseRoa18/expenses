/**
 * Mensaje para cuando una acción de servidor ni siquiera llegó a devolver
 * { error } (red caída, Supabase inalcanzable, el teléfono perdió señal a
 * mitad del envío, etc.). Vive en un solo sitio -- igual que MONTO_MAXIMO en
 * `src/lib/montos.ts` -- para que los seis formularios de la app digan
 * exactamente lo mismo ante el mismo tipo de fallo, en vez de que cada uno
 * relance su propio texto.
 */
export const ERROR_CONEXION = 'No se pudo conectar. Intenta de nuevo.'
