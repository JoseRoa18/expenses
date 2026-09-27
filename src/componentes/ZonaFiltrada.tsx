'use client'

import { createContext, useContext, useRef, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Lo que comparten la barra de filtros y la lista que filtra.
 *
 * Los filtros viven en la dirección (ver `src/lib/filtros.ts`): cambiar uno
 * es navegar a la misma pantalla con otros parámetros, y el servidor vuelve
 * a armar la lista. Mientras llega, la lista de antes se queda donde estaba,
 * atenuada -- sin esqueletos ni saltos, que en un teléfono hacen perder el
 * sitio con el pulgar.
 */

type Cambios = Record<string, string | null>

type Contexto = {
  /** `reemplazar`: sin dejar rastro en el historial (lo que se va tecleando). */
  cambiar: (cambios: Cambios, opciones?: { reemplazar?: boolean }) => void
  pendiente: boolean
}

const ContextoFiltros = createContext<Contexto | null>(null)

export function ZonaFiltrada({ children }: { children: ReactNode }) {
  const router = useRouter()
  const ruta = usePathname()
  const params = useSearchParams()
  const [pendiente, iniciar] = useTransition()

  // Lo último que se pidió. Si se tocan dos filtros seguidos antes de que
  // llegue la respuesta del primero, la dirección todavía no cambió, y
  // armar el segundo sobre ella borraría el primero.
  const pedido = useRef<string | null>(null)

  function cambiar(cambios: Cambios, { reemplazar = false } = {}) {
    const base = pendiente && pedido.current !== null ? pedido.current : params.toString()
    const nuevos = new URLSearchParams(base)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === '') nuevos.delete(clave)
      else nuevos.set(clave, valor)
    }
    // Con otro filtro la lista es otra: se vuelve a mostrar desde el principio.
    nuevos.delete('ver')

    const texto = nuevos.toString()
    pedido.current = texto
    const destino = texto ? `${ruta}?${texto}` : ruta

    // Tocar un filtro deja rastro en el historial, así el botón de atrás lo
    // deshace. Lo que se va tecleando no: serían diez pasos atrás por palabra.
    iniciar(() => {
      if (reemplazar) router.replace(destino, { scroll: false })
      else router.push(destino, { scroll: false })
    })
  }

  return (
    <ContextoFiltros.Provider value={{ cambiar, pendiente }}>{children}</ContextoFiltros.Provider>
  )
}

export function useFiltros(): Contexto {
  const contexto = useContext(ContextoFiltros)
  if (!contexto) throw new Error('useFiltros tiene que usarse dentro de <ZonaFiltrada>')
  return contexto
}

/** Lo que se atenúa mientras llega la lista nueva. */
export function Resultados({ children }: { children: ReactNode }) {
  const { pendiente } = useFiltros()
  return (
    <div aria-busy={pendiente} className={`transition-opacity ${pendiente ? 'opacity-50' : ''}`}>
      {children}
    </div>
  )
}
