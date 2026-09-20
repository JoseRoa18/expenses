'use server'

import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export async function cerrarSesion() {
  const supabase = await crearClienteServidor()
  await supabase.auth.signOut()
  redirect('/entrar')
}
