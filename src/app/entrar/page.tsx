'use client'

import { useState } from 'react'
import { TecladoPin } from '@/componentes/TecladoPin'

const PERSONAS = ['Alix', 'Jose', 'Yenny']

export default function Entrar() {
  const [persona, setPersona] = useState<string | null>(null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      {persona ? (
        <TecladoPin persona={persona} alVolver={() => setPersona(null)} />
      ) : (
        <>
          <h1 className="mb-10 text-center text-xl font-semibold text-slate-900">
            ¿Quién eres?
          </h1>
          <div className="flex flex-col gap-3">
            {PERSONAS.map((nombre) => (
              <button
                key={nombre}
                type="button"
                onClick={() => setPersona(nombre)}
                className="h-16 rounded-2xl bg-slate-900 text-lg font-medium text-white active:bg-slate-700"
              >
                {nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
