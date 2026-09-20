'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Rol } from '@/lib/tipos'

const ENLACES: Record<Rol, { href: string; texto: string }[]> = {
  solicitante: [{ href: '/solicitudes', texto: 'Solicitudes' }],
  comprador: [
    { href: '/dinero', texto: 'Balance' },
    { href: '/solicitudes', texto: 'Solicitudes' },
    { href: '/compras', texto: 'Gastos' },
  ],
  financista: [
    { href: '/dinero', texto: 'Balance' },
    { href: '/solicitudes', texto: 'Solicitudes' },
    { href: '/compras', texto: 'Gastos' },
  ],
}

export function Navegacion({ rol }: { rol: Rol }) {
  const ruta = usePathname()
  const enlaces = ENLACES[rol]

  // Alix (solicitante) tiene una sola pantalla: una barra de una pestaña no
  // sirve de nada y solo tapa espacio, así que no se muestra.
  if (enlaces.length < 2) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-md">
        {enlaces.map(({ href, texto }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 py-4 text-center text-sm font-medium ${
              ruta === href ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            {texto}
          </Link>
        ))}
      </div>
    </nav>
  )
}
