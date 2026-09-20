-- =====================================================================
-- 0002: Row Level Security
--
-- Regla central: Alix (rol 'solicitante') NUNCA puede leer compras,
-- facturas, aportes ni el balance. Esto se impone aquí, dentro de la base
-- de datos, de modo que siga siendo cierto aunque la app tenga un fallo.
-- =====================================================================

-- --- Quién soy --------------------------------------------------------

-- security definer: necesita leer profiles sin que la política de profiles
-- la llame de vuelta a sí misma y se quede dando vueltas.
create or replace function mi_rol()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from profiles where id = auth.uid()
$$;

revoke all on function mi_rol() from public;
grant execute on function mi_rol() to authenticated;

-- --- profiles ---------------------------------------------------------

alter table profiles enable row level security;

drop policy if exists "leer perfiles" on profiles;
create policy "leer perfiles" on profiles
  for select to authenticated
  using (true);
-- Nadie escribe en profiles desde la app: las cuentas se crean con el
-- script de administración.

-- --- solicitudes ------------------------------------------------------

alter table solicitudes enable row level security;

drop policy if exists "leer solicitudes" on solicitudes;
create policy "leer solicitudes" on solicitudes
  for select to authenticated
  using (true);

drop policy if exists "crear solicitudes" on solicitudes;
create policy "crear solicitudes" on solicitudes
  for insert to authenticated
  with check (
    creada_por = auth.uid()
    and mi_rol() in ('solicitante', 'financista')
  );

-- El autor edita las suyas mientras estén pendientes. El trigger de la
-- migración 0001 se encarga de que no cambie el estado por esta vía.
drop policy if exists "editar propias" on solicitudes;
create policy "editar propias" on solicitudes
  for update to authenticated
  using (
    creada_por = auth.uid()
    and mi_rol() in ('solicitante', 'financista')
    and estado = 'pendiente'
  )
  with check (creada_por = auth.uid());

-- Jose cambia el estado de cualquier solicitud (comprar, rechazar, entregar).
drop policy if exists "comprador gestiona estado" on solicitudes;
create policy "comprador gestiona estado" on solicitudes
  for update to authenticated
  using (mi_rol() = 'comprador')
  with check (mi_rol() = 'comprador');

-- --- compras ----------------------------------------------------------

alter table compras enable row level security;

drop policy if exists "leer compras" on compras;
create policy "leer compras" on compras
  for select to authenticated
  using (mi_rol() in ('comprador', 'financista'));

drop policy if exists "registrar compras" on compras;
create policy "registrar compras" on compras
  for insert to authenticated
  with check (mi_rol() = 'comprador' and registrada_por = auth.uid());

drop policy if exists "actualizar compras" on compras;
create policy "actualizar compras" on compras
  for update to authenticated
  using (mi_rol() = 'comprador')
  with check (mi_rol() = 'comprador');

-- --- facturas ---------------------------------------------------------

alter table facturas enable row level security;

drop policy if exists "leer facturas" on facturas;
create policy "leer facturas" on facturas
  for select to authenticated
  using (mi_rol() in ('comprador', 'financista'));

drop policy if exists "subir facturas" on facturas;
create policy "subir facturas" on facturas
  for insert to authenticated
  with check (mi_rol() = 'comprador');

-- --- aportes ----------------------------------------------------------

alter table aportes enable row level security;

drop policy if exists "leer aportes" on aportes;
create policy "leer aportes" on aportes
  for select to authenticated
  using (mi_rol() in ('comprador', 'financista'));

drop policy if exists "registrar aportes" on aportes;
create policy "registrar aportes" on aportes
  for insert to authenticated
  with check (mi_rol() = 'comprador' and registrada_por = auth.uid());

-- --- Balance ----------------------------------------------------------

-- Devuelve los dos totales en una sola consulta. El WHERE de dentro hace
-- que a Alix no le devuelva ninguna fila: no es que vea ceros, es que no
-- hay resultado.
create or replace function obtener_balance()
returns table (total_aportes numeric, total_gastos numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(monto_usd) from aportes), 0)::numeric as total_aportes,
    coalesce((select sum(monto_usd) from compras), 0)::numeric as total_gastos
  where mi_rol() in ('comprador', 'financista')
$$;

revoke all on function obtener_balance() from public;
grant execute on function obtener_balance() to authenticated;
