import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Las tres operaciones sobre `profiles.pin_configurado_en`, que es lo que
 * decide si a una persona la app le pide su PIN o le deja crearlo.
 *
 * Todas reciben el cliente de administración (llave de servicio) porque
 * quien pregunta todavía no tiene sesión, y las políticas de RLS de
 * `profiles` exigen estar autenticado. Reciben el cliente en vez de
 * fabricarlo para que las pruebas puedan pasar el suyo, contra una cuenta
 * desechable, sin tocar las cuentas reales.
 *
 * Lanzan si la base responde con error, en vez de devolver un valor que se
 * confundiría con "no": para quien llama, "no se pudo preguntar" y "la
 * cuenta ya tiene PIN" no son la misma cosa.
 */

/**
 * Marca la cuenta de `nombre` como que ya tiene PIN, pero solo si no lo
 * tenía, y devuelve su id. Si ya lo tenía -- o si ese nombre no existe --
 * devuelve `null`.
 *
 * Es un solo UPDATE condicionado, y ahí está todo el asunto: si dos
 * personas abren la app a la vez sobre la misma cuenta libre, la base deja
 * pasar a una sola. La otra recibe `null` y no llega a fijar ningún PIN.
 * Por eso se reclama ANTES de fijar la contraseña, y no al revés.
 */
export async function reclamarCuentaSinPin(
  admin: SupabaseClient,
  nombre: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    // Instante en UTC. La columna es `timestamptz`, así que guarda el
    // momento exacto; quien lo muestre lo convierte a la hora de Venezuela
    // con los ayudantes de `formato.ts`.
    .update({ pin_configurado_en: new Date().toISOString() })
    .eq('nombre', nombre)
    .is('pin_configurado_en', null)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`No se pudo reclamar la cuenta: ${error.message}`)
  return data?.id ?? null
}

/**
 * Deshace un reclamo: la cuenta vuelve a quedar sin PIN.
 *
 * Existe para un solo caso: se reclamó la cuenta y justo después falló el
 * fijar la contraseña. Sin esto, esa cuenta quedaría marcada como "ya tiene
 * PIN" sin que nadie conozca ninguno -- inaccesible hasta que el dueño la
 * reabriera a mano desde Supabase.
 */
export async function liberarCuenta(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ pin_configurado_en: null })
    .eq('id', id)

  if (error) throw new Error(`No se pudo liberar la cuenta: ${error.message}`)
}

/**
 * Si esta persona ya creó su PIN. Es lo que decide qué pantalla ve al tocar
 * su nombre.
 *
 * Un nombre que no existe cuenta como "sí tiene": no hay ninguna cuenta que
 * ofrecerle, y mandarlo a la pantalla de entrar -- donde todo falla con el
 * mismo "PIN incorrecto" -- evita que probando nombres se averigüe cuáles
 * existen.
 */
export async function personaTienePin(
  admin: SupabaseClient,
  nombre: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('profiles')
    .select('pin_configurado_en')
    .eq('nombre', nombre)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer el estado de la cuenta: ${error.message}`)
  if (!data) return true
  return data.pin_configurado_en !== null
}
