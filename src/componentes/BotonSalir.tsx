import { cerrarSesion } from '@/app/acciones-sesion'

export function BotonSalir({ nombre }: { nombre: string }) {
  return (
    <form action={cerrarSesion}>
      <button type="submit" className="flex h-11 items-center text-sm text-slate-500 underline">
        {nombre} · Salir
      </button>
    </form>
  )
}
