'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarSesion } from '@/app/entrar/acciones'
import { ERROR_CONEXION } from '@/lib/errores'
import { LARGO_PIN, Teclado } from '@/componentes/Teclado'

export function TecladoPin({ persona, alVolver }: { persona: string; alVolver: () => void }) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

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

    if (nuevo.length === LARGO_PIN) {
      setEnviando(true)
      try {
        const resultado = await iniciarSesion(persona, nuevo)
        if (resultado?.error) {
          setError(resultado.error)
          setPin('')
          setEnviando(false)
          return
        }
        // Éxito: la acción ya no redirige (redirect() dentro de una acción
        // de servidor no se puede envolver en try/catch sin capturar
        // también su propio mecanismo de control de flujo). Navegamos
        // desde el cliente en su lugar.
        // Se refresca antes de navegar para que '/' no se sirva desde la
        // caché de rutas del cliente con el estado de sesión anterior.
        router.refresh()
        router.push('/')
      } catch {
        // Un fallo que ni siquiera llegó a devolver { error } (red caída,
        // Supabase inalcanzable, etc.): no se deja el teclado congelado.
        setError(ERROR_CONEXION)
        setPin('')
        setEnviando(false)
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-sm text-slate-500">Hola,</p>
        <p className="text-2xl font-semibold text-slate-900">{persona}</p>
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
