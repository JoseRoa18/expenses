-- =====================================================================
-- 0004: inmutabilidad de `compras`
-- Repetible: correrlo dos veces no cambia el resultado.
--
-- Fix 8 de la revisión final de rama: "nada se edita una vez registrado"
-- (spec, "Fuera de alcance") ya se impone en `solicitudes` con el trigger
-- de 0001 (validar_transicion_solicitud). En `compras`, la política RLS
-- "actualizar compras" (0002) es `using (mi_rol() = 'comprador')` sin
-- ninguna restricción de columna, y a diferencia de `solicitudes` no había
-- ningún trigger `before update`: Jose podía reescribir `monto_usd` (o
-- cualquier otro campo) de una compra ya registrada sin que la base lo
-- impidiera. Ningún camino de la app hace esto hoy, pero es exactamente la
-- tabla que audita Yenny, y es la única regla de integridad que el
-- proyecto se atribuye que Postgres no imponía todavía.
--
-- Se deja `fecha_entrega` fuera de este candado a propósito: es la única
-- columna que se escribe después del INSERT (marcarEntregada), y ese mismo
-- flujo la revierte a NULL si la solicitud asociada no logra pasar a
-- "entregada" (ver `src/app/compras/acciones.ts`). Bloquear esa columna
-- rompería esa reversión, que es legítima.
-- =====================================================================

create or replace function proteger_compra_registrada()
returns trigger
language plpgsql
as $$
begin
  if (old.solicitud_id, old.registrada_por, old.descripcion, old.monto_bs,
      old.monto_usd, old.notas, old.fecha_compra)
     is distinct from
     (new.solicitud_id, new.registrada_por, new.descripcion, new.monto_bs,
      new.monto_usd, new.notas, new.fecha_compra)
  then
    raise exception
      'Una compra ya registrada no se puede editar (solo se puede marcar la entrega)';
  end if;

  return new;
end
$$;

drop trigger if exists trg_proteger_compra_registrada on compras;
create trigger trg_proteger_compra_registrada
  before update on compras
  for each row execute function proteger_compra_registrada();
