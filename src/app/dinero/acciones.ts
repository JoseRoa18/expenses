'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { parsearMonto, MONTO_MAXIMO } from '@/lib/montos'
import { hoyVenezuela } from '@/lib/formato'

type Resultado = { error: string | null }

export async function registrarAporte(datos: FormData): Promise<Resultado> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }
  // Cualquiera registra el dinero que recibe, pero siempre a su nombre: el
  // id que se inserta es el de la sesión, nunca uno que venga del
  // formulario. La política de `aportes` exige lo mismo desde la base.

  const fecha = String(datos.get('fecha') ?? '')
  const metodo = String(datos.get('metodo') ?? '').trim()
  const notas = String(datos.get('notas') ?? '').trim()

  // El navegador no es de fiar: este es el último punto en el que se puede
  // rechazar un monto mal escrito antes de que entre al libro de cuentas.
  // Un <input type="number"> convertía "1.500" en 1,5 y "12,50" en 1250 sin
  // avisar a nadie (ver src/lib/montos.ts); parsearMonto nunca adivina.
  const montoUsd = parsearMonto(String(datos.get('monto_usd') ?? ''))

  if (montoUsd === null || montoUsd <= 0) {
    return { error: 'El monto en dólares no se entiende. Escríbelo así: 12,50' }
  }
  if (montoUsd > MONTO_MAXIMO) {
    return { error: 'Ese monto es demasiado alto. Revisa que no tenga un cero de más.' }
  }

  const supabase = await crearClienteServidor()
  const { data: aporte, error } = await supabase
    .from('aportes')
    .insert({
      registrada_por: perfil.id,
      monto_usd: montoUsd,
      fecha: fecha || hoyVenezuela(),
      metodo,
      notas,
    })
    .select('id')
    .single()

  // Igual que en registrarCompra: si RLS deja pasar la inserción sin
  // devolver una fila, no se le dice a Jose que el aporte quedó guardado.
  if (error || !aporte) return { error: 'No se pudo guardar' }

  revalidatePath('/dinero')
  return { error: null }
}
