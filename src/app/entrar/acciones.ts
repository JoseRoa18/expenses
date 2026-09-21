'use server'

import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdministrador } from '@/lib/supabase/administrador'
import { liberarCuenta, personaTienePin, reclamarCuentaSinPin } from '@/lib/cuentas'
import { validarPinNuevo } from '@/lib/pin'
import { ERROR_CONEXION } from '@/lib/errores'

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

/**
 * Los mensajes del otro camino, el de crear el PIN. Aquí no se disimula
 * como en el de entrar: quien está en esta pantalla no tiene cuenta que
 * proteger todavía, y necesita saber qué pasó para volver a intentarlo.
 */
const ERROR_CREAR = 'No se pudo crear el PIN. Intenta de nuevo.'
const CUENTA_YA_TIENE_PIN = 'Esa cuenta ya tiene PIN. Vuelve atrás y escríbelo.'
const PIN_CREADO_SIN_ENTRAR = 'Tu PIN quedó creado. Vuelve atrás y entra con él.'

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

/**
 * Qué pantalla le toca a esta persona al tocar su nombre: el teclado de
 * siempre, o el de crear su PIN por primera vez.
 *
 * `tienePin` en `null` significa que no se pudo preguntar (Supabase caído,
 * sin red, falta la llave de servicio). Eso NO es "no tiene PIN": ofrecer
 * crear uno en ese caso sería ofrecer tomar una cuenta ajena por un fallo
 * de red. La pantalla muestra el error y deja volver.
 */
export async function estadoDePersona(
  persona: string,
): Promise<{ tienePin: boolean | null; error: string | null }> {
  if (!CORREOS[persona]) {
    console.error(`estadoDePersona: persona no reconocida (${persona})`)
    // Como si ya tuviera PIN: manda al teclado de entrar, que responde
    // "PIN incorrecto" a todo sin revelar qué cuentas existen.
    return { tienePin: true, error: null }
  }

  try {
    const admin = crearClienteAdministrador()
    return { tienePin: await personaTienePin(admin, persona), error: null }
  } catch (e) {
    console.error('estadoDePersona: no se pudo leer el estado:', e)
    return { tienePin: null, error: ERROR_CONEXION }
  }
}

/**
 * Crea el PIN de quien todavía no tiene, y la deja dentro.
 *
 * El orden importa. Primero se reclama la cuenta (un UPDATE condicionado,
 * ver `reclamarCuentaSinPin`) y solo después se fija la contraseña: así, si
 * dos personas llegan a la vez a la misma cuenta libre, la base deja pasar
 * a una sola. Al revés -- fijar primero, marcar después -- las dos fijarían
 * su PIN y ganaría la última, que es justo lo que no se quiere.
 *
 * Si fijar la contraseña falla después de haber reclamado, se devuelve la
 * cuenta a "sin PIN"; si no, quedaría marcada como tomada sin que nadie
 * conozca ningún PIN, inaccesible hasta repararla a mano en Supabase.
 */
export async function crearPin(
  persona: string,
  pin: string,
  repeticion: string,
): Promise<{ error: string | null }> {
  const correo = CORREOS[persona]
  if (!correo) {
    console.error(`crearPin: persona no reconocida (${persona})`)
    return { error: ERROR_CREAR }
  }

  const problema = validarPinNuevo(pin, repeticion)
  if (problema) return { error: problema }

  let id: string | null = null
  // Una vez fijado el PIN, la cuenta no se libera pase lo que pase.
  let pinFijado = false
  try {
    const admin = crearClienteAdministrador()

    id = await reclamarCuentaSinPin(admin, persona)
    if (!id) return { error: CUENTA_YA_TIENE_PIN }

    const { error: errorClave } = await admin.auth.admin.updateUserById(id, { password: pin })
    if (errorClave) {
      console.error('crearPin: no se pudo fijar la contraseña:', errorClave.message)
      await liberarCuenta(admin, id)
      return { error: ERROR_CREAR }
    }

    // El PIN ya existe: es un PIN válido que su dueña conoce, y soltar la
    // cuenta ahora la dejaría fuera de la que acaba de crear.
    pinFijado = true

    const supabase = await crearClienteServidor()
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: pin })
    if (error) {
      console.error('crearPin: PIN creado pero no se pudo entrar:', error.message)
      return { error: PIN_CREADO_SIN_ENTRAR }
    }

    return { error: null }
  } catch (e) {
    console.error('crearPin: error inesperado:', e)
    // Solo se devuelve la cuenta si se cayó ANTES de fijar el PIN. Si el
    // fallo fue al entrar, el PIN ya es bueno y la cuenta es suya.
    if (id && !pinFijado) {
      try {
        await liberarCuenta(crearClienteAdministrador(), id)
      } catch (e2) {
        console.error('crearPin: tampoco se pudo liberar la cuenta:', e2)
      }
    }
    return { error: ERROR_CREAR }
  }
}
