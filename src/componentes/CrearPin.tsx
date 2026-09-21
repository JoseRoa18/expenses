'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearPin } from '@/app/entrar/acciones'
import { ERROR_CONEXION } from '@/lib/errores'
import { LARGO_PIN, Teclado } from '@/componentes/Teclado'

/**
 * La pantalla que ve una persona la primera vez, cuando su cuenta todavía
 * no tiene PIN: lo teclea, lo repite, y queda dentro.
 *
 * El primer PIN se guarda solo aquí, en memoria, hasta que se teclea la
 * repetición: al servidor se manda una sola vez, con los dos. Si no
 * coinciden, se vuelve al primer paso -- no se pide "repítelo otra vez"
 * sobre un primer PIN que a lo mejor fue el equivocado.
 */
export function CrearPin({ persona, alVolver }: { persona: string; alVolver: () => void }) {
  const router = useRouter()
  const [primero, setPrimero] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function volverAEmpezar(mensaje: string | null) {
    setPrimero(null)
    setPin('')
    setError(mensaje)
    setEnviando(false)
  }

  async function pulsar(tecla: string) {
    if (enviando || tecla === '') return
    setError(null)

    if (tecla === '←') {
      setPin((actual) => actual.slice(0, -1))
      return
    }
    if (pin.length >= LARGO_PIN) return

    const nuevo = pin + tecla
    setPin(nuevo)
    if (nuevo.length < LARGO_PIN) return

    if (primero === null) {
      setPrimero(nuevo)
      setPin('')
      return
    }

    setEnviando(true)
    try {
      const resultado = await crearPin(persona, primero, nuevo)
      if (resultado?.error) {
        // Incluye el caso de que los dos PIN no coincidan: quien decide eso
        // es el servidor, para que la regla viva en un solo sitio.
        volverAEmpezar(resultado.error)
        return
      }
      // Ya hay sesión. Se refresca antes de navegar para que '/' no se
      // sirva desde la caché de rutas del cliente sin ella.
      router.refresh()
      router.push('/')
    } catch {
      // Un fallo que ni siquiera llegó a devolver { error } (red caída,
      // Supabase inalcanzable, etc.): no se deja el teclado congelado.
      volverAEmpezar(ERROR_CONEXION)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-sm text-slate-500">Hola,</p>
        <p className="text-2xl font-semibold text-slate-900">{persona}</p>
        <p className="mt-4 text-sm text-slate-600">
          {primero === null
            ? 'Esta es tu primera vez. Crea tu PIN de 6 dígitos.'
            : 'Escríbelo otra vez para confirmarlo.'}
        </p>
      </div>

      <Teclado valor={pin} error={error} alPulsar={pulsar} deshabilitado={enviando} />

      <button
        type="button"
        onClick={alVolver}
        className="flex h-11 items-center px-2 text-sm text-slate-500 underline"
      >
        No soy {persona}
      </button>
    </div>
  )
}
