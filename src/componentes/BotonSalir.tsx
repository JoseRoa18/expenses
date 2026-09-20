import { cerrarSesion } from '@/app/acciones-sesion'

// `nombre` es opcional porque `error.tsx` también usa este botón para la
// pantalla de "hay sesión pero no se encontró un perfil" (ver
// `obtenerPerfilObligatorio`): en ese caso no hay un `Perfil` del que sacar
// un nombre, pero la persona igual necesita una forma de salir.
export function BotonSalir({ nombre }: { nombre?: string }) {
  return (
    <form action={cerrarSesion}>
      <button type="submit" className="flex h-11 items-center text-sm text-slate-500 underline">
        {nombre ? `${nombre} · Salir` : 'Salir'}
      </button>
    </form>
  )
}
