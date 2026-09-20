'use server'

import { redirect } from 'next/navigation'
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

export async function iniciarSesion(
  persona: string,
  pin: string,
): Promise<{ error: string | null }> {
  const correo = CORREOS[persona]
  if (!correo) return { error: 'Persona no reconocida' }
  if (!/^\d{6}$/.test(pin)) return { error: 'El PIN son 6 dígitos' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: pin })

  if (error) {
    // No se distingue entre "PIN incorrecto" y otros fallos, para no dar
    // pistas a quien esté probando combinaciones.
    return { error: 'PIN incorrecto' }
  }

  redirect('/')
}
