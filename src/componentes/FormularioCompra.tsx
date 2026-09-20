'use client'

import { useState, useTransition } from 'react'
import { registrarCompra } from '@/app/compras/acciones'
import { tasaImplicita } from '@/lib/balance'
import { formatearBs } from '@/lib/formato'

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

  const tasa = tasaImplicita(Number(montoBs), Number(montoUsd))

  function enviar(datos: FormData) {
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
            type="number"
            step="0.01"
            min="0"
            required
            value={montoBs}
            onChange={(e) => setMontoBs(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Monto en dólares</span>
          <input
            name="monto_usd"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={montoUsd}
            onChange={(e) => setMontoUsd(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3"
          />
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
        disabled={pendiente}
        className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando...' : 'Registrar compra'}
      </button>
    </form>
  )
}
