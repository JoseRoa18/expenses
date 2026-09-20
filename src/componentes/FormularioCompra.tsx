'use client'

import { useState, useTransition } from 'react'
import { registrarCompra } from '@/app/compras/acciones'
import { crearClienteNavegador } from '@/lib/supabase/navegador'
import { tasaImplicita } from '@/lib/balance'
import { formatearBs, formatearUsd, hoyVenezuela } from '@/lib/formato'
import { parsearMonto, MONTO_MAXIMO } from '@/lib/montos'
import { ERROR_CONEXION } from '@/lib/errores'

// Mismo límite que el bucket 'facturas' (supabase/migraciones/0003), para
// avisarle a Jose ANTES de intentar subir en vez de dejar que el bucket lo
// rechace después de que ya escribió todo el formulario. Una foto de
// factura tomada con el teléfono pesa 2-6 MB: muy por debajo de esto, pero
// muy por encima del límite de 1 MB (Next) / 4.5 MB (Vercel) que tendría un
// <input type=file> si sus bytes viajaran dentro de esta Server Action --
// por eso se suben aparte, directo al bucket, antes de llamar a
// registrarCompra.
const TAMANO_MAXIMO_FACTURA = 10 * 1024 * 1024

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
  // MONTO_MAXIMO es el mismo techo que aplica registrarCompra en el
  // servidor: sin esto, la vista previa decía "Se guardará: 50.000.000,00
  // Bs" para un monto que el servidor iba a rechazar un instante después.
  const bsExcede = bsParseado !== null && bsParseado > MONTO_MAXIMO
  const usdExcede = usdParseado !== null && usdParseado > MONTO_MAXIMO
  const bsInvalido = (bsEscrito && bsParseado === null) || bsExcede
  const usdInvalido = (usdEscrito && usdParseado === null) || usdExcede

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

    const archivos = datos.getAll('facturas').filter((f): f is File => f instanceof File && f.size > 0)

    // Se rechaza ANTES de tocar la red: escribir todo el formulario para
    // enterarse recién al final de que la foto pesa demasiado (y perderlo
    // todo porque no había try/catch ni error.tsx) es exactamente el
    // defecto que se corrige aquí.
    const archivoGrande = archivos.find((a) => a.size > TAMANO_MAXIMO_FACTURA)
    if (archivoGrande) {
      setError(
        `La foto "${archivoGrande.name}" pesa más de 10 MB. Usa una foto más liviana o comprime el PDF.`,
      )
      return
    }

    // No debe viajar dentro del FormData que llega a la Server Action: eso
    // es exactamente el body grande que Next/Vercel rechazan. Las fotos se
    // suben aparte, directo al bucket (ver más abajo).
    datos.delete('facturas')

    iniciar(async () => {
      const compraId = crypto.randomUUID()
      const rutas: string[] = []
      let fallosSubida = 0

      if (archivos.length > 0) {
        const navegador = crearClienteNavegador()
        for (const archivo of archivos) {
          const extension = archivo.name.split('.').pop() || 'jpg'
          const ruta = `${compraId}/${crypto.randomUUID()}.${extension}`
          try {
            const { error: errorSubida } = await navegador.storage
              .from('facturas')
              .upload(ruta, archivo, { contentType: archivo.type || 'application/octet-stream' })
            if (errorSubida) {
              fallosSubida++
              continue
            }
            rutas.push(ruta)
          } catch {
            fallosSubida++
          }
        }
      }

      datos.set('compra_id', compraId)
      datos.set('rutas_facturas', JSON.stringify(rutas))

      let resultado
      try {
        resultado = await registrarCompra(datos)
      } catch {
        // Igual que en TecladoPin: un fallo que ni siquiera llegó a devolver
        // { error } (red caída, servidor inalcanzable). Sin este catch, Jose
        // perdía la descripción y los dos montos que ya había escrito en la
        // pantalla de error en inglés de Next.
        setError(ERROR_CONEXION)
        return
      }

      setError(resultado.error)
      if (!resultado.error) {
        setMontoBs('')
        setMontoUsd('')
      }

      const fallosTotal = fallosSubida + (resultado.facturasFallidas ?? 0)
      if (!resultado.error && fallosTotal > 0) {
        // Cuando la compra viene de una solicitud, en cuanto esta pasa a
        // "comprada" el formulario entero se oculta (ver AccionesSolicitud):
        // un texto en pantalla podría desaparecer antes de que Jose llegue a
        // leerlo. Una alerta nativa no depende de que este componente siga
        // visible ni montado para que él la vea.
        window.alert(
          archivos.length === 1
            ? 'La compra se guardó, pero la foto de la factura no se pudo subir. Guarda el papel: el sistema no tiene evidencia de esta compra.'
            : fallosTotal === archivos.length
              ? `La compra se guardó, pero ninguna de las ${archivos.length} fotos se pudo subir. Guarda esos papeles: el sistema no tiene evidencia de esta compra.`
              : `La compra se guardó, pero ${fallosTotal} de ${archivos.length} foto(s) de factura no se pudieron subir. Guarda esos papeles.`,
        )
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
            {bsExcede && (
              <span className="text-red-600">Demasiado alto. Revisa que no tenga un cero de más.</span>
            )}
            {!bsExcede && bsEscrito && bsParseado === null && (
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
            {usdExcede && (
              <span className="text-red-600">Demasiado alto. Revisa que no tenga un cero de más.</span>
            )}
            {!usdExcede && usdEscrito && usdParseado === null && (
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
          defaultValue={hoyVenezuela()}
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
        <span className="mb-1 block text-xs text-slate-500">Foto(s) de la factura (máx. 10 MB c/u)</span>
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
