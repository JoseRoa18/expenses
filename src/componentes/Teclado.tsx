'use client'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←']

const LARGO_PIN = 6

/**
 * El teclado numérico y los seis puntitos, sin ninguna idea de para qué se
 * está tecleando. Lo usan las dos pantallas de la entrada: la de escribir
 * el PIN de siempre y la de crearlo la primera vez.
 *
 * No guarda estado ni decide nada: recibe lo tecleado y avisa de cada
 * tecla. Quien lo usa es el que sabe qué hacer cuando se llega a seis
 * dígitos.
 */
export function Teclado({
  valor,
  error,
  alPulsar,
  deshabilitado = false,
}: {
  valor: string
  /** Mensaje bajo los puntitos. El hueco se reserva siempre, para que la
   *  botonera no salte cuando aparece o desaparece. */
  error: string | null
  alPulsar: (tecla: string) => void
  deshabilitado?: boolean
}) {
  return (
    <>
      <div className="flex gap-3" aria-label={`PIN: ${valor.length} de ${LARGO_PIN} dígitos`}>
        {Array.from({ length: LARGO_PIN }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${
              i < valor.length ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
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
            onClick={() => alPulsar(tecla)}
            disabled={tecla === '' || deshabilitado}
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
    </>
  )
}

export { LARGO_PIN }
