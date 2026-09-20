'use client'

import { useState, useTransition } from 'react'
import { registrarAporte } from '@/app/dinero/acciones'
import { formatearUsd } from '@/lib/formato'
import { parsearMonto } from '@/lib/montos'

export function FormularioAporte() {
  const [montoUsd, setMontoUsd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  // Texto libre, no <input type="number">: Jose escribe los montos a la
  // venezolana (punto de millares, coma decimal, ej. "1.500") y un
  // <input type="number"> corrompe eso en silencio (ver parsearMonto). Se
  // parsea en cada tecla para mostrarle a Jose, antes de guardar, exactamente
  // el número que se va a registrar.
  const usdEscrito = montoUsd.trim() !== ''
  const usdParseado = usdEscrito ? parsearMonto(montoUsd) : null
  const usdInvalido = usdEscrito && usdParseado === null

  function enviar(datos: FormData) {
    // Comprobación de nuevo aquí (no solo en el botón deshabilitado): un
    // Enter dentro del formulario no pasa por el estado `disabled` del
    // botón, y este es el único lugar por el que pasa cualquier envío.
    const usd = parsearMonto(String(datos.get('monto_usd') ?? ''))
    if (usd === null || usd <= 0) {
      setError('El monto en dólares no se entiende. Escríbelo así: 12,50')
      return
    }

    iniciar(async () => {
      const resultado = await registrarAporte(datos)
      setError(resultado.error)
      if (!resultado.error) {
        setMontoUsd('')
      }
    })
  }

  return (
    <form action={enviar} className="rounded-2xl bg-white p-4 shadow-sm">
      <label className="mb-2 block">
        <span className="mb-1 block text-xs text-slate-500">Monto en dólares</span>
        <input
          name="monto_usd"
          type="text"
          inputMode="decimal"
          placeholder="12,50"
          required
          value={montoUsd}
          onChange={(e) => setMontoUsd(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-3"
        />
        <p className="mt-1 min-h-4 text-xs">
          {usdInvalido && <span className="text-red-600">No se entiende. Ej: 12,50</span>}
          {!usdInvalido && usdParseado !== null && (
            <span className="text-slate-500">Se guardará: {formatearUsd(usdParseado)}</span>
          )}
        </p>
      </label>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Fecha</span>
          <input
            name="fecha"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Por dónde</span>
          <input
            name="metodo"
            placeholder="Zelle, efectivo..."
            className="w-full rounded-xl border border-slate-200 px-3 py-3"
          />
        </label>
      </div>

      <textarea
        name="notas"
        rows={2}
        placeholder="Notas (opcional)"
        className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-3"
      />

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pendiente || usdInvalido}
        className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando...' : 'Registrar'}
      </button>
    </form>
  )
}
