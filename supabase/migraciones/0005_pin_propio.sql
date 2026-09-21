-- =====================================================================
-- 0005: cada persona crea su propio PIN la primera vez que entra
-- Repetible: correrlo dos veces no cambia el resultado.
-- =====================================================================

-- NULL = esa persona todavía no tiene PIN, así que la app le deja crear
-- uno. Con fecha = ya lo creó, y la opción no vuelve a aparecer para ella.
-- Para reabrirla (alguien olvidó su PIN), poner esta columna en NULL desde
-- Supabase; el PIN viejo deja de servir en cuanto la persona cree el nuevo.
alter table profiles add column if not exists pin_configurado_en timestamptz;

comment on column profiles.pin_configurado_en is
  'Cuándo creó esta persona su PIN. NULL = aún no lo ha creado y la app se lo pedirá.';

-- El reclamo de una cuenta sin PIN es un UPDATE condicionado al nombre
-- (`where nombre = ... and pin_configurado_en is null`). Si dos filas
-- pudieran llamarse igual, ese UPDATE tocaría las dos. La app ya asumía
-- que el nombre identifica a la persona; aquí la base lo hace cierto.
do $$ begin
  alter table profiles add constraint profiles_nombre_unico unique (nombre);
exception when duplicate_table or duplicate_object then null; end $$;

-- No hace falta política de escritura: `pin_configurado_en` solo la toca el
-- servidor con la llave de servicio, que no pasa por RLS. Desde el
-- navegador nadie escribe en profiles (0002 no crea política de UPDATE).
