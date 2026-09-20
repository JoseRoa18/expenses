'use client'

import { useState, useTransition } from 'react'
import { registrarCompra } from '@/app/compras/acciones'
import { tasaImplicita } from '@/lib/balance'
import { formatearBs, formatearUsd } from '@/lib/formato'
import { parsearMonto } from '@/lib/montos'

export function FormularioCompra({
  solicitudId,
  descripcionInicial = '',
}: {
  solicitudId?: string
  descripcionInicial?: string
}) {
  const [montoBs, setMontoBs] = useState('')
  const [montoUsd, setMontoUsd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  // Los campos son texto libre, no <input type="number">: Jose escribe los
  // montos a la venezolana (punto de millares, coma decimal, ej. "1.500")
  // y un <input type="number"> corrompe eso en silencio (ver parsearMonto).
  // Se parsea en cada tecla para poder mostrarle a Jose, antes de guardar,
  // exactamente el número que se va a registrar.
  const bsEscrito = montoBs.trim() !== ''
  const usdEscrito = montoUsd.trim() !== ''
  const bsParseado = bsEscrito ? parsearMonto(montoBs) : null
  const usdParseado = usdEscrito ? parsearMonto(montoUsd) : null
  const bsInvalido = bsEscrito && bsParseado === null
  const usdInvalido = usdEscrito && usdParseado === null

  const tasa =
    bsParseado !== null && usdParseado !== null ? tasaImplicita(bsParseado, usdParseado) : null

  function enviar(datos: FormData) {
    // Comprobación de nuevo aquí (no solo en el botón deshabilitado): un
    // Enter dentro del formulario no pasa por el estado `disabled` del
    // botón, y este es el único lugar por el que pasa cualquier envío.
    const bs = parsearMonto(String(datos.get('monto_bs') ?? ''))
    const usd = parsearMonto(String(datos.get('monto_usd') ?? ''))
    if (bs === null) {
      setError('El monto en bolívares no se entiende. Escríbelo así: 1.500,00')
      return
    }
    if (usd === null || usd <= 0) {
      setError('El monto en dólares no se entiende. Escríbelo así: 12,50')
      return
    }

    iniciar(async () => {
      const resultado = await registrarCompra(datos)
      setError(resultado.error)
      if (!resultado.error) {
        setMontoBs('')
        setMontoUsd('')
      }
    })
  }

  return (
    <form action={enviar} className="rounded-2xl bg-white p-4 shadow-sm">
      {solicitudId && <input type="hidden" name="solicitud_id" value={solicitudId} />}

      <input
        name="descripcion"
        required
        defaultValue={descripcionInicial}
        placeholder="¿Qué compraste?"
        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
      />

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Monto factura (Bs)</span>
          <input
            name="monto_bs"
            type="text"
            inputMode="decimal"
            placeholder="1.500,00"
            required
            value={montoBs}
            onChange={(e) => setMontoBs(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <p className="mt-1 min-h-4 text-xs">
            {bsInvalido && (
              <span className="text-red-600">No se entiende. Ej: 1.500,00</span>
            )}
            {!bsInvalido && bsParseado !== null && (
              <span className="text-slate-500">Se guardará: {formatearBs(bsParseado)}</span>
            )}
          </p>
        </label>
        <label className="block">
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
            {usdInvalido && (
              <span className="text-red-600">No se entiende. Ej: 12,50</span>
            )}
            {!usdInvalido && usdParseado !== null && (
              <span className="text-slate-500">Se guardará: {formatearUsd(usdParseado)}</span>
            )}
          </p>
        </label>
      </div>

      <p className="mb-2 h-5 text-xs text-slate-500">
        {tasa !== null && `Tasa: ${formatearBs(tasa)} por dólar`}
      </p>

      <label className="mb-2 block">
        <span className="mb-1 block text-xs text-slate-500">Fecha de compra</span>
        <input
          name="fecha_compra"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-xl border border-slate-200 px-3 py-3"
        />
      </label>

      <textarea
        name="notas"
        rows={2}
        placeholder="Notas (opcional)"
        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
      />

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-slate-500">Foto(s) de la factura</span>
        <input
          name="facturas"
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="w-full text-sm"
        />
      </label>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pendiente || bsInvalido || usdInvalido}
        className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando...' : 'Registrar compra'}
      </button>
    </form>
  )
}
