import { cerrarSesion } from '@/app/acciones-sesion'
import { Boton } from '@/componentes/Boton'

// `nombre` es opcional porque `error.tsx` también usa este botón para la
// pantalla de "hay sesión pero no se encontró un perfil" (ver
// `obtenerPerfilObligatorio`): en ese caso no hay un `Perfil` del que sacar
// un nombre, pero la persona igual necesita una forma de salir.
export function BotonSalir({ nombre }: { nombre?: string }) {
  return (
    <form action={cerrarSesion}>
      {/* El nombre va sin subrayado y la palabra "Salir" con él: es lo
          único de los dos que se toca, y en una barra pequeña conviene que
          se note cuál. */}
      <Boton type="submit" variante="texto" className="no-underline">
        {nombre && <span className="text-slate-500">{nombre}</span>}
        <span className="underline underline-offset-2">Salir</span>
      </Boton>
    </form>
  )
}
