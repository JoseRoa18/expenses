'use client'

import { useState } from 'react'
import { iniciarSesion } from '@/app/entrar/acciones'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←']

export function TecladoPin({ persona, alVolver }: { persona: string; alVolver: () => void }) {
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
    if (pin.length >= 6) return

    const nuevo = pin + tecla
    setPin(nuevo)

    if (nuevo.length === 6) {
      setEnviando(true)
      const resultado = await iniciarSesion(persona, nuevo)
      if (resultado?.error) {
        setError(resultado.error)
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

      <div className="flex gap-3" aria-label={`PIN: ${pin.length} de 6 dígitos`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${
              i < pin.length ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
            }`}
          />
        ))}
      </div>

      <p className="h-5 text-sm text-red-600" role="alert">{error ?? ''}</p>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {TECLAS.map((tecla, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pulsar(tecla)}
            disabled={tecla === '' || enviando}
            className={`h-16 rounded-2xl text-2xl font-medium transition ${
              tecla === ''
                ? 'invisible'
                : 'bg-slate-100 text-slate-900 active:bg-slate-200 disabled:opacity-40'
            }`}
          >
            {tecla}
          </button>
        ))}
      </div>

      <button type="button" onClick={alVolver} className="text-sm text-slate-500 underline">
        No soy {persona}
      </button>
    </div>
  )
}
