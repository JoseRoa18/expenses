'use client'

import { useRef, useState, useTransition } from 'react'
import { registrarCompra } from '@/app/compras/acciones'
import { crearClienteNavegador } from '@/lib/supabase/navegador'
import { tasaImplicita } from '@/lib/balance'
import { formatearBs, formatearPeso, formatearUsd, hoyVenezuela } from '@/lib/formato'
import { parsearMonto, MONTO_MAXIMO } from '@/lib/montos'
import { comprimirImagen } from '@/lib/imagenes'
import { ERROR_CONEXION } from '@/lib/errores'
import { Boton } from '@/componentes/Boton'
import { Campo, CLASE_ENTRADA } from '@/componentes/Campo'
import { IconoArchivo, IconoCamara, IconoQuitar } from '@/componentes/Iconos'

// Mismo límite que el bucket 'facturas' (supabase/migraciones/0003), para
// avisarle a Jose ANTES de intentar subir en vez de dejar que el bucket lo
// rechace después de que ya escribió todo el formulario. Con la compresión
// una foto ya no debería acercarse nunca a esto, pero un PDF pesado sí
// puede: los PDF no se comprimen.
const TAMANO_MAXIMO_FACTURA = 10 * 1024 * 1024

/**
 * Una factura ya elegida y lista (o casi) para subir.
 *
 * `pesaba` es el tamaño con el que salió de la cámara y `archivo` es lo que
 * de verdad se va a subir. Se guardan los dos para poder mostrar "4,2 MB →
 * 780 KB": sin eso, la compresión es magia invisible, y el día que una foto
 * salga ilegible nadie va a saber por dónde empezar a mirar.
 */
type Adjunto = {
  id: string
  nombre: string
  pesaba: number
  archivo: File
  listo: boolean
}

export function FormularioCompra({
  solicitudId,
  descripcionInicial = '',
}: {
  solicitudId?: string
  descripcionInicial?: string
}) {
  const [montoBs, setMontoBs] = useState('')
  const [montoUsd, setMontoUsd] = useState('')
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const refCamara = useRef<HTMLInputElement>(null)
  const refArchivos = useRef<HTMLInputElement>(null)

  const comprimiendo = adjuntos.some((a) => !a.listo)

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

  /**
   * Se comprime al elegir la foto, no al enviar.
   *
   * Así la espera ocurre mientras Jose escribe los montos -- tiempo que iba
   * a pasar de todas formas -- y no después de tocar "Registrar compra",
   * que es justo cuando él ya está guardando el teléfono.
   */
  async function agregar(lista: FileList | null) {
    if (!lista || lista.length === 0) return
    setError(null)

    for (const original of Array.from(lista)) {
      const id = crypto.randomUUID()
      setAdjuntos((actuales) => [
        ...actuales,
        { id, nombre: original.name, pesaba: original.size, archivo: original, listo: false },
      ])

      // comprimirImagen nunca lanza: si no puede, devuelve el original.
      const listo = await comprimirImagen(original)
      setAdjuntos((actuales) =>
        actuales.map((a) => (a.id === id ? { ...a, archivo: listo, listo: true } : a)),
      )
    }
  }

  function quitar(id: string) {
    setAdjuntos((actuales) => actuales.filter((a) => a.id !== id))
  }

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
    if (comprimiendo) {
      setError('Espera a que terminen de prepararse las fotos.')
      return
    }

    const archivos = adjuntos.map((a) => a.archivo)

    // Se rechaza ANTES de tocar la red: escribir todo el formulario para
    // enterarse recién al final de que el archivo pesa demasiado (y perderlo
    // todo porque no había try/catch ni error.tsx) es exactamente el
    // defecto que se corrige aquí.
    const archivoGrande = archivos.find((a) => a.size > TAMANO_MAXIMO_FACTURA)
    if (archivoGrande) {
      setError(
        `"${archivoGrande.name}" pesa más de 10 MB incluso ya preparado. Si es un PDF, súbelo más liviano.`,
      )
      return
    }

    iniciar(async () => {
      const compraId = crypto.randomUUID()
      const rutas: string[] = []
      let fallosSubida = 0

      // Las fotos no viajan dentro del FormData de la Server Action: ese es
      // exactamente el body grande que Next/Vercel rechazan. Se suben
      // aparte, directo al bucket.
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
        setAdjuntos([])
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
    <form action={enviar} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      {solicitudId && <input type="hidden" name="solicitud_id" value={solicitudId} />}

      <Campo etiqueta="¿Qué compraste?" className="mb-3">
        <input
          name="descripcion"
          required
          defaultValue={descripcionInicial}
          placeholder="Dos cajas de leche"
          className={CLASE_ENTRADA}
        />
      </Campo>

      <div className="mb-1 grid grid-cols-2 gap-2">
        <Campo
          etiqueta="Monto factura (Bs)"
          pie={
            <>
              {bsExcede && (
                <span className="text-red-600">
                  Demasiado alto. Revisa que no tenga un cero de más.
                </span>
              )}
              {!bsExcede && bsEscrito && bsParseado === null && (
                <span className="text-red-600">No se entiende. Ej: 1.500,00</span>
              )}
              {!bsInvalido && bsParseado !== null && (
                <span className="cifras text-slate-500">Se guardará: {formatearBs(bsParseado)}</span>
              )}
            </>
          }
        >
          <input
            name="monto_bs"
            type="text"
            inputMode="decimal"
            placeholder="1.500,00"
            required
            value={montoBs}
            onChange={(e) => setMontoBs(e.target.value)}
            className={`${CLASE_ENTRADA} cifras`}
          />
        </Campo>

        <Campo
          etiqueta="Monto en dólares"
          pie={
            <>
              {usdExcede && (
                <span className="text-red-600">
                  Demasiado alto. Revisa que no tenga un cero de más.
                </span>
              )}
              {!usdExcede && usdEscrito && usdParseado === null && (
                <span className="text-red-600">No se entiende. Ej: 12,50</span>
              )}
              {!usdInvalido && usdParseado !== null && (
                <span className="cifras text-slate-500">
                  Se guardará: {formatearUsd(usdParseado)}
                </span>
              )}
            </>
          }
        >
          <input
            name="monto_usd"
            type="text"
            inputMode="decimal"
            placeholder="12,50"
            required
            value={montoUsd}
            onChange={(e) => setMontoUsd(e.target.value)}
            className={`${CLASE_ENTRADA} cifras`}
          />
        </Campo>
      </div>

      <p className="mb-3 h-5 text-xs text-slate-500">
        {tasa !== null && <span className="cifras">Tasa: {formatearBs(tasa)} por dólar</span>}
      </p>

      <Campo etiqueta="Fecha de compra" className="mb-3">
        <input
          name="fecha_compra"
          type="date"
          defaultValue={hoyVenezuela()}
          className={`${CLASE_ENTRADA} cifras`}
        />
      </Campo>

      <Campo etiqueta="Notas" className="mb-4">
        <textarea name="notas" rows={2} placeholder="Opcional" className={CLASE_ENTRADA} />
      </Campo>

      <fieldset className="mb-4">
        <legend className="mb-1 text-xs font-medium text-slate-600">Factura</legend>

        {/* Dos entradas escondidas, una por botón. La de la cámara lleva
            `capture`, que en el teléfono abre la cámara directamente en vez
            del carrete. Ninguna lleva `name`: los archivos no viajan en el
            FormData, se suben aparte. */}
        <input
          ref={refCamara}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            agregar(e.target.files)
            // Se limpia para que volver a tomar una foto dispare el evento
            // otra vez aunque el archivo se llame igual que el anterior.
            e.target.value = ''
          }}
        />
        <input
          ref={refArchivos}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            agregar(e.target.files)
            e.target.value = ''
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <Boton type="button" variante="secundario" onClick={() => refCamara.current?.click()}>
            <IconoCamara />
            Tomar foto
          </Boton>
          <Boton type="button" variante="secundario" onClick={() => refArchivos.current?.click()}>
            <IconoArchivo />
            Elegir archivo
          </Boton>
        </div>

        {adjuntos.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {adjuntos.map((adjunto) => (
              <li
                key={adjunto.id}
                className="flex items-center gap-2 rounded-xl bg-slate-50 py-2 pr-1 pl-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-800">{adjunto.nombre}</span>
                  <span className="cifras block text-xs text-slate-500">
                    {!adjunto.listo
                      ? 'Preparando...'
                      : adjunto.archivo.size < adjunto.pesaba
                        ? `${formatearPeso(adjunto.pesaba)} → ${formatearPeso(adjunto.archivo.size)}`
                        : formatearPeso(adjunto.archivo.size)}
                  </span>
                </span>
                <Boton
                  type="button"
                  variante="texto"
                  aria-label={`Quitar ${adjunto.nombre}`}
                  onClick={() => quitar(adjunto.id)}
                  className="no-underline"
                >
                  <IconoQuitar />
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {error && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Boton
        type="submit"
        disabled={pendiente || comprimiendo || bsInvalido || usdInvalido}
        className="w-full"
      >
        {pendiente ? 'Guardando...' : comprimiendo ? 'Preparando fotos...' : 'Registrar compra'}
      </Boton>
    </form>
  )
}
