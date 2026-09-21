'use client'

import { useState } from 'react'
import { TecladoPin } from '@/componentes/TecladoPin'
import { CrearPin } from '@/componentes/CrearPin'
import { estadoDePersona } from '@/app/entrar/acciones'
import { ERROR_CONEXION } from '@/lib/errores'

const PERSONAS = ['Alix', 'Jose', 'Yenny']

type Elegida = { nombre: string; tienePin: boolean }

export default function Entrar() {
  const [elegida, setElegida] = useState<Elegida | null>(null)
  const [preguntando, setPreguntando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Al tocar un nombre hay que preguntarle al servidor si esa persona ya
   * tiene PIN: de eso depende si ve el teclado de entrar o el de crearlo.
   *
   * Si no se puede preguntar, se muestra el error y no se avanza. Suponer
   * "no tiene PIN" ante un fallo de red sería ofrecer tomar una cuenta
   * ajena; suponer "sí tiene" dejaría a quien aún no lo ha creado dando
   * vueltas contra un "PIN incorrecto" que nunca podría acertar.
   */
  async function elegir(nombre: string) {
    if (preguntando) return
    setPreguntando(nombre)
    setError(null)

    try {
      const resultado = await estadoDePersona(nombre)
      if (resultado.tienePin === null) {
        setError(resultado.error ?? ERROR_CONEXION)
        setPreguntando(null)
        return
      }
      setElegida({ nombre, tienePin: resultado.tienePin })
      setPreguntando(null)
    } catch {
      setError(ERROR_CONEXION)
      setPreguntando(null)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      {elegida ? (
        elegida.tienePin ? (
          <TecladoPin persona={elegida.nombre} alVolver={() => setElegida(null)} />
        ) : (
          <CrearPin persona={elegida.nombre} alVolver={() => setElegida(null)} />
        )
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
                onClick={() => elegir(nombre)}
                disabled={preguntando !== null}
                className="h-16 rounded-2xl bg-slate-900 text-lg font-medium text-white transition active:bg-slate-700 disabled:opacity-60"
              >
                {preguntando === nombre ? 'Un momento...' : nombre}
              </button>
            ))}
          </div>
          <p className="mt-6 h-5 text-center text-sm text-red-600" role="alert">
            {error ?? ''}
          </p>
        </>
      )}
    </main>
  )
}
