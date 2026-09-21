'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconoBalance, IconoGastos, IconoSolicitudes } from '@/componentes/Iconos'

/**
 * Las tres pantallas son las mismas para todos.
 *
 * Antes esta barra dependía del rol -- Alix tenía una sola pantalla y por
 * eso no se le mostraba nada -- pero desde que cada persona tiene su propia
 * bolsa, los tres tienen balance, solicitudes y gastos. Lo que cambia es
 * *cuánto* se ve dentro de cada pantalla, y eso lo decide la base de datos,
 * no esta barra.
 */
const ENLACES = [
  { href: '/dinero', texto: 'Balance', Icono: IconoBalance },
  { href: '/solicitudes', texto: 'Solicitudes', Icono: IconoSolicitudes },
  { href: '/compras', texto: 'Gastos', Icono: IconoGastos },
]

export function Navegacion() {
  const ruta = usePathname()

  return (
    <nav
      // El relleno de abajo es la franja del gesto de inicio del iPhone: sin
      // él, la fila de pestañas queda partida por la rayita del sistema.
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-md">
        {ENLACES.map(({ href, texto, Icono }) => {
          const activo = ruta === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900 ${
                activo ? 'font-semibold text-slate-900' : 'text-slate-500 active:text-slate-700'
              }`}
            >
              {/* La pestaña activa se marca por partida triple -- ícono
                  relleno, texto más oscuro y la barrita de arriba -- porque
                  bajo el sol el color solo no se distingue. */}
              <span
                className={`h-0.5 w-8 rounded-full ${activo ? 'bg-slate-900' : 'bg-transparent'}`}
              />
              <Icono className={activo ? 'h-6 w-6' : 'h-6 w-6 opacity-80'} />
              {texto}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
