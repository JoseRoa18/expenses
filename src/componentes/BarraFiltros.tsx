'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFiltros } from '@/componentes/ZonaFiltrada'
import { CLASE_ENTRADA } from '@/componentes/Campo'
import { IconoBuscar, IconoFiltros, IconoQuitar } from '@/componentes/Iconos'
import { ETIQUETAS_PERIODO, PERIODOS, type Periodo } from '@/lib/periodos'

/**
 * La barra de filtros de las pantallas con listas.
 *
 * Se arma con piezas y no se escribe una por pantalla: el servidor decide qué
 * filtros tiene cada lista y con qué opciones (por ejemplo, a Alix no se le
 * ofrece elegir persona: solo ve lo suyo), y esta barra solo los dibuja y
 * los lleva a la dirección.
 *
 * El orden, de arriba abajo, es el de lo que más se usa: buscar, el período
 * (o el estado), y el resto guardado detrás de "Filtros". Lo que queda
 * activo de ese resto se ve siempre como etiquetas con su ×, para que un
 * filtro escondido no haga pensar que "faltan" gastos.
 */

export type Opcion = { valor: string; etiqueta: string; cuenta?: number }

export type CampoChips = {
  clave: string
  /** Para lectores de pantalla: qué se está eligiendo. */
  etiqueta: string
  valor: string
  porDefecto: string
  opciones: Opcion[]
}

export type CampoSelect = CampoChips

export type CampoCasilla = { clave: string; etiqueta: string; activa: boolean }

export type FiltroActivo = { etiqueta: string; quitar: string[] }

export function BarraFiltros({
  busqueda,
  periodo,
  chips = [],
  selects = [],
  casillas = [],
  activos = [],
}: {
  busqueda?: { valor: string; placeholder: string }
  periodo?: { valor: Periodo; desde: string | null; hasta: string | null; porDefecto: Periodo }
  chips?: CampoChips[]
  selects?: CampoSelect[]
  casillas?: CampoCasilla[]
  activos?: FiltroActivo[]
}) {
  const { cambiar } = useFiltros()
  const [abierto, setAbierto] = useState(false)
  const hayPanel = selects.length > 0 || casillas.length > 0

  const hayAlgo =
    (busqueda?.valor ?? '') !== '' ||
    (periodo !== undefined && periodo.valor !== periodo.porDefecto) ||
    chips.some((c) => c.valor !== c.porDefecto) ||
    selects.some((s) => s.valor !== s.porDefecto) ||
    casillas.some((c) => c.activa)

  function limpiarTodo() {
    const claves = [
      ...(busqueda ? ['q'] : []),
      ...(periodo ? ['periodo', 'desde', 'hasta'] : []),
      ...chips.map((c) => c.clave),
      ...selects.map((s) => s.clave),
      ...casillas.map((c) => c.clave),
    ]
    cambiar(Object.fromEntries(claves.map((c) => [c, null])))
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      {(busqueda || hayPanel) && (
        <div className="flex gap-2">
          {busqueda && <Buscador valor={busqueda.valor} placeholder={busqueda.placeholder} />}
          {hayPanel && (
            <button
              type="button"
              onClick={() => setAbierto((a) => !a)}
              aria-expanded={abierto}
              className={`relative inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                abierto
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-800 active:bg-slate-100'
              } ${busqueda ? '' : 'w-full justify-center'}`}
            >
              <IconoFiltros />
              Filtros
              {activos.length > 0 && (
                <span
                  className={`cifras ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                    abierto ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
                  }`}
                >
                  {activos.length}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {periodo && <SelectorPeriodo {...periodo} />}

      {chips.map((campo) => (
        <FilaChips key={campo.clave} campo={campo} />
      ))}

      {hayPanel && abierto && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
          {selects.map((campo) => (
            <label key={campo.clave} className="block min-w-0">
              <span className="mb-1 block text-xs font-medium text-slate-600">{campo.etiqueta}</span>
              {/* Sin controlar, y con `key`: controlado, volvería a la opción
                  vieja mientras el servidor responde. La `key` lo pone al día
                  cuando la respuesta llega (o cuando lo cambia "Quitar"). */}
              <select
                key={campo.valor}
                defaultValue={campo.valor}
                onChange={(e) =>
                  cambiar({ [campo.clave]: e.target.value === campo.porDefecto ? null : e.target.value })
                }
                className={`${CLASE_ENTRADA} py-2.5`}
              >
                {campo.opciones.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {casillas.map((campo) => (
            <label
              key={campo.clave}
              className="col-span-2 flex min-h-11 items-center gap-3 text-sm text-slate-800"
            >
              <input
                key={String(campo.activa)}
                type="checkbox"
                defaultChecked={campo.activa}
                onChange={(e) => cambiar({ [campo.clave]: e.target.checked ? '1' : null })}
                className="h-5 w-5 rounded border-slate-300 accent-slate-900"
              />
              {campo.etiqueta}
            </label>
          ))}
        </div>
      )}

      {(activos.length > 0 || hayAlgo) && (
        <div className="flex flex-wrap items-center gap-2">
          {activos.map((a) => (
            <button
              key={a.etiqueta}
              type="button"
              onClick={() => cambiar(Object.fromEntries(a.quitar.map((c) => [c, null])))}
              aria-label={`Quitar filtro: ${a.etiqueta}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-slate-200 py-1 pr-2 pl-3 text-sm text-slate-800 active:bg-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {a.etiqueta}
              <IconoQuitar className="h-4 w-4" />
            </button>
          ))}
          {hayAlgo && (
            <button
              type="button"
              onClick={limpiarTodo}
              className="min-h-9 px-1 text-sm text-slate-600 underline underline-offset-2 active:text-slate-900"
            >
              Quitar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * El buscador escribe en la dirección un momento después de la última tecla,
 * no en cada una: en un teléfono con datos, una petición por letra se nota.
 */
function Buscador({ valor, placeholder }: { valor: string; placeholder: string }) {
  const { cambiar } = useFiltros()
  const [texto, setTexto] = useState(valor)
  // Lo último que este buscador mandó a la dirección.
  const [enviado, setEnviado] = useState(valor)
  const [valorPrevio, setValorPrevio] = useState(valor)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Si la búsqueda cambió desde fuera -- "Quitar filtros", el botón de
  // atrás -- el campo tiene que enterarse. Pero si lo que llega es el eco
  // de lo que este mismo campo mandó, no se toca: la persona ya siguió
  // escribiendo, y pisarle el texto le borraría las últimas letras.
  if (valor !== valorPrevio) {
    setValorPrevio(valor)
    if (valor !== enviado) {
      setTexto(valor)
      setEnviado(valor)
    }
  }

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  function enviar(nuevo: string) {
    if (temporizador.current) clearTimeout(temporizador.current)
    // Recortado, porque así lo lee el servidor: si no, el eco de "leche "
    // volvería como "leche" y parecería un cambio de fuera.
    const limpio = nuevo.trim()
    setEnviado(limpio)
    cambiar({ q: limpio || null }, { reemplazar: true })
  }

  function escribir(nuevo: string) {
    setTexto(nuevo)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => enviar(nuevo), 350)
  }

  return (
    <form
      role="search"
      className="relative min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault()
        enviar(texto)
        // Esconde el teclado del teléfono: ya se buscó, ahora se quiere ver la lista.
        e.currentTarget.querySelector('input')?.blur()
      }}
    >
      <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        enterKeyHint="search"
        value={texto}
        onChange={(e) => escribir(e.target.value)}
        placeholder={placeholder}
        maxLength={100}
        aria-label={placeholder}
        className={`${CLASE_ENTRADA} pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden`}
      />
      {texto && (
        <button
          type="button"
          onClick={() => {
            setTexto('')
            enviar('')
          }}
          aria-label="Borrar búsqueda"
          className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 active:text-slate-900"
        >
          <IconoQuitar />
        </button>
      )}
    </form>
  )
}

function FilaChips({ campo }: { campo: CampoChips }) {
  const { cambiar } = useFiltros()
  return (
    <Chips
      etiqueta={campo.etiqueta}
      opciones={campo.opciones}
      valor={campo.valor}
      alElegir={(v) => cambiar({ [campo.clave]: v === campo.porDefecto ? null : v })}
    />
  )
}

/** Una fila de botones de los que solo uno está elegido. */
function Chips({
  etiqueta,
  opciones,
  valor,
  alElegir,
}: {
  etiqueta: string
  opciones: Opcion[]
  valor: string
  alElegir: (valor: string) => void
}) {
  // El botón tocado se marca en el acto, sin esperar al servidor: un toque
  // que no responde se repite, y el segundo toque es otra navegación.
  const [elegido, setElegido] = useState(valor)
  const [valorPrevio, setValorPrevio] = useState(valor)
  if (valor !== valorPrevio) {
    setValorPrevio(valor)
    setElegido(valor)
  }

  // La fila se desplaza de lado, así que el botón elegido puede quedar
  // fuera de la pantalla ("Este año", un enlace que llega con
  // "Fechas…"). Se trae a la vista moviendo solo la fila, nunca la página.
  const fila = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const contenedor = fila.current
    const boton = contenedor?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!contenedor || !boton) return
    const margen = 16
    const izquierda = boton.offsetLeft - margen
    const derecha = boton.offsetLeft + boton.offsetWidth + margen - contenedor.clientWidth
    if (contenedor.scrollLeft > izquierda) contenedor.scrollLeft = izquierda
    else if (contenedor.scrollLeft < derecha) contenedor.scrollLeft = derecha
  }, [elegido])

  return (
    // En el teléfono la fila se desplaza de lado en vez de partirse en dos:
    // así la lista de abajo empieza siempre a la misma altura. Los bordes se
    // desvanecen para que el botón a medio salir se lea como "hay más por
    // aquí" y no como un corte. En una pantalla ancha no hace falta
    // desplazar nada: los botones bajan a una segunda fila y se ven todos.
    //
    // El `py-1` (compensado con `-my-1`) deja sitio arriba y abajo: una fila
    // que se desplaza de lado también recorta en vertical, y se comía el
    // contorno de los botones y el anillo del foco.
    <div
      ref={fila}
      role="group"
      aria-label={etiqueta}
      className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%_-_1rem),transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
    >
      {opciones.map((o) => {
        const activo = o.valor === elegido
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => {
              if (o.valor === elegido) return
              setElegido(o.valor)
              alElegir(o.valor)
            }}
            // Borde y no `ring`: el anillo se dibuja por fuera de la caja y
            // la fila lo recortaba. El peso de la letra es el mismo elegido
            // o no, para que el botón no cambie de ancho al tocarlo. En
            // pantalla ancha se usa ratón, no pulgar: van más compactos.
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-9 sm:px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              activo
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 active:bg-slate-100'
            }`}
          >
            {o.etiqueta}
            {o.cuenta !== undefined && (
              <span className={`cifras text-xs ${activo ? 'text-white/80' : 'text-slate-500'}`}>
                {o.cuenta}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function SelectorPeriodo({
  valor,
  desde,
  hasta,
  porDefecto,
}: {
  valor: Periodo
  desde: string | null
  hasta: string | null
  porDefecto: Periodo
}) {
  const { cambiar } = useFiltros()

  return (
    <>
      <Chips
        etiqueta="Período"
        opciones={PERIODOS.map((p) => ({ valor: p, etiqueta: ETIQUETAS_PERIODO[p] }))}
        valor={valor}
        alElegir={(p) =>
          cambiar({
            periodo: p === porDefecto ? null : p,
            // Las fechas a mano solo valen para "Fechas…": al elegir otro
            // período se olvidan, para que no reaparezcan de sorpresa.
            ...(p === 'rango' ? {} : { desde: null, hasta: null }),
          })
        }
      />
      {valor === 'rango' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Desde</span>
            <input
              key={desde ?? ''}
              type="date"
              defaultValue={desde ?? ''}
              max={hasta ?? undefined}
              onChange={(e) => cambiar({ desde: e.target.value || null })}
              className={`${CLASE_ENTRADA} cifras py-2.5`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Hasta</span>
            <input
              key={hasta ?? ''}
              type="date"
              defaultValue={hasta ?? ''}
              min={desde ?? undefined}
              onChange={(e) => cambiar({ hasta: e.target.value || null })}
              className={`${CLASE_ENTRADA} cifras py-2.5`}
            />
          </label>
        </div>
      )}
    </>
  )
}
