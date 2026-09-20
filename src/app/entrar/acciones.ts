'use server'

import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * La app muestra nombres; Supabase necesita correos. Esta tabla es la
 * traducción, y vive solo en el servidor.
 */
const CORREOS: Record<string, string> = {
  Alix: 'alix@expenses.local',
  Jose: 'jose@expenses.local',
  Yenny: 'yenny@expenses.local',
}

/**
 * Un solo mensaje para cualquier fallo: persona inválida, PIN mal formado,
 * PIN incorrecto, o un error inesperado de Supabase. No se distingue entre
 * ellos de cara al usuario para no dar pistas a quien esté probando
 * combinaciones; el detalle, si hace falta para depurar, queda en el log
 * del servidor.
 */
const ERROR_GENERICO = 'PIN incorrecto'

export async function iniciarSesion(
  persona: string,
  pin: string,
): Promise<{ error: string | null }> {
  const correo = CORREOS[persona]
  if (!correo) {
    console.error(`iniciarSesion: persona no reconocida (${persona})`)
    return { error: ERROR_GENERICO }
  }
  if (!/^\d{6}$/.test(pin)) {
    console.error('iniciarSesion: el PIN recibido no tiene 6 dígitos')
    return { error: ERROR_GENERICO }
  }

  try {
    const supabase = await crearClienteServidor()
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: pin })

    if (error) {
      console.error('iniciarSesion: fallo de autenticación:', error.message)
      return { error: ERROR_GENERICO }
    }

    return { error: null }
  } catch (e) {
    // Nunca dejar que un fallo inesperado (red, Supabase caído, etc.) se
    // propague como una excepción sin manejar: el teclado en el cliente
    // depende de recibir siempre { error } para no quedarse congelado.
    console.error('iniciarSesion: error inesperado:', e)
    return { error: ERROR_GENERICO }
  }
}
