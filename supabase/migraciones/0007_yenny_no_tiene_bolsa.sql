-- =====================================================================
-- 0007: quien pone el dinero no tiene bolsa
--
-- Corrige 0006, que le dio bolsa a las tres personas. Yenny no recibe ni
-- gasta: pone el dinero y audita. Las bolsas son la de Alix y la de Jose,
-- y cada una la alimenta su dueña registrando lo que recibe.
--
-- Se decide por el rol y no por "no tiene movimientos". Si dependiera de
-- los movimientos, a Yenny le aparecería una bolsa en $0,00 y "Al día" --
-- indistinguible de una bolsa real que cuadra, y una invitación a
-- registrar dinero en ella.
--
-- Repetible: correrlo dos veces no cambia el resultado.
-- =====================================================================

-- --- Nadie registra dinero en una bolsa que no existe -----------------

-- La condición de 0006 (`registrada_por = auth.uid()`) dejaba a Yenny
-- registrar gastos e ingresos suyos. Sigue valiendo, y ahora además se
-- exige que quien escribe no sea quien solo provee.
drop policy if exists "registrar compras" on compras;
create policy "registrar compras" on compras
  for insert to authenticated
  with check (registrada_por = auth.uid() and mi_rol() <> 'financista');

drop policy if exists "registrar aportes" on aportes;
create policy "registrar aportes" on aportes
  for insert to authenticated
  with check (registrada_por = auth.uid() and mi_rol() <> 'financista');

-- --- Balance ----------------------------------------------------------

-- Igual que en 0006, pero sin la fila de quien no tiene bolsa. Quién ve
-- cuántas filas lo sigue decidiendo esta función y no la pantalla: a Alix
-- le devuelve una (la suya), a Jose y a Yenny dos (la de Alix y la de
-- Jose). Una pantalla con un fallo no puede enseñar un balance ajeno
-- porque nunca llega a tenerlo.
create or replace function obtener_balances()
returns table (
  persona_id    uuid,
  nombre        text,
  total_aportes numeric,
  total_gastos  numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.nombre,
    coalesce((select sum(a.monto_usd) from aportes a where a.registrada_por = p.id), 0)::numeric,
    coalesce((select sum(c.monto_usd) from compras c where c.registrada_por = p.id), 0)::numeric
  from profiles p
  where p.rol <> 'financista'
    and (mi_rol() in ('comprador', 'financista') or p.id = auth.uid())
  order by p.nombre
$$;

revoke all on function obtener_balances() from public;
grant execute on function obtener_balances() to authenticated;
