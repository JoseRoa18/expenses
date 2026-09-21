'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconoBalance, IconoGastos, IconoSolicitudes } from '@/componentes/Iconos'
import type { Rol } from '@/lib/tipos'

type Enlace = { href: string; texto: string; Icono: (p: { className?: string }) => React.ReactElement }

const BALANCE: Enlace = { href: '/dinero', texto: 'Balance', Icono: IconoBalance }
const SOLICITUDES: Enlace = { href: '/solicitudes', texto: 'Solicitudes', Icono: IconoSolicitudes }
const GASTOS: Enlace = { href: '/compras', texto: 'Gastos', Icono: IconoGastos }

const ENLACES: Record<Rol, Enlace[]> = {
  solicitante: [SOLICITUDES],
  comprador: [BALANCE, SOLICITUDES, GASTOS],
  financista: [BALANCE, SOLICITUDES, GASTOS],
}

export function Navegacion({ rol }: { rol: Rol }) {
  const ruta = usePathname()
  const enlaces = ENLACES[rol]

  // Alix (solicitante) tiene una sola pantalla: una barra de una pestaña no
  // sirve de nada y solo tapa espacio, así que no se muestra.
  if (enlaces.length < 2) return null

  return (
    <nav
      // El relleno de abajo es la franja del gesto de inicio del iPhone: sin
      // él, la fila de pestañas queda partida por la rayita del sistema.
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-md">
        {enlaces.map(({ href, texto, Icono }) => {
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
