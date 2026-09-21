-- =====================================================================
-- 0006: una bolsa de dinero por persona
--
-- Sustituye la regla central de 0002. Antes: Alix no podía leer NADA de
-- dinero. Ahora Alix también recibe y también gasta, así que tiene su
-- propia bolsa -- y lo que se impone aquí es que **solo vea la suya**.
--
-- El dueño de un movimiento es quien lo registró (`registrada_por`). No
-- hay columna de dueño aparte porque nadie puede registrar a nombre de
-- otro: las dos cosas son siempre la misma. Si algún día Yenny registra a
-- nombre de alguien, ese día aparece la columna.
--
-- Repetible: correrlo dos veces no cambia el resultado.
-- =====================================================================

-- --- compras ----------------------------------------------------------

drop policy if exists "leer compras" on compras;
create policy "leer compras" on compras
  for select to authenticated
  using (
    mi_rol() in ('comprador', 'financista')
    or registrada_por = auth.uid()
  );

-- Cualquiera registra un gasto, pero solo a su nombre. Esto es lo que
-- sostiene todo lo demás: si se pudiera insertar con el id de otro, la
-- bolsa ajena bajaría sin que su dueño hiciera nada.
drop policy if exists "registrar compras" on compras;
create policy "registrar compras" on compras
  for insert to authenticated
  with check (registrada_por = auth.uid());

-- Marcar entregada sigue siendo cosa de Jose: es el que entrega.
drop policy if exists "actualizar compras" on compras;
create policy "actualizar compras" on compras
  for update to authenticated
  using (mi_rol() = 'comprador')
  with check (mi_rol() = 'comprador');

-- --- facturas ---------------------------------------------------------

-- Una factura se ve si se ve su compra. Se escribe como la condición de
-- `compras` y no aparte, para que no puedan quedar desalineadas: una
-- factura visible de una compra invisible sería una fuga.
drop policy if exists "leer facturas" on facturas;
create policy "leer facturas" on facturas
  for select to authenticated
  using (
    mi_rol() in ('comprador', 'financista')
    or exists (
      select 1 from compras c
      where c.id = facturas.compra_id
        and c.registrada_por = auth.uid()
    )
  );

drop policy if exists "subir facturas" on facturas;
create policy "subir facturas" on facturas
  for insert to authenticated
  with check (
    exists (
      select 1 from compras c
      where c.id = compra_id
        and c.registrada_por = auth.uid()
    )
  );

-- --- aportes ----------------------------------------------------------

drop policy if exists "leer aportes" on aportes;
create policy "leer aportes" on aportes
  for select to authenticated
  using (
    mi_rol() in ('comprador', 'financista')
    or registrada_por = auth.uid()
  );

drop policy if exists "registrar aportes" on aportes;
create policy "registrar aportes" on aportes
  for insert to authenticated
  with check (registrada_por = auth.uid());

-- --- archivos de facturas ---------------------------------------------

-- La foto se sube ANTES de que exista la fila de `compras` (el navegador
-- la manda al bucket y recién después se llama a registrarCompra), así que
-- la escritura no puede pedir que la compra exista: no existiría nunca.
-- Subir queda abierto a los tres; lo que decide quién ve qué es la
-- lectura. Un archivo subido y nunca asociado a una compra no lo puede
-- leer su propia autora: queda huérfano y solo visible para quien audita.
drop policy if exists "subir archivos de facturas" on storage.objects;
create policy "subir archivos de facturas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas');

-- La ruta de cada archivo es `<id de la compra>/<uuid>.<ext>`, así que la
-- primera carpeta dice a qué compra pertenece.
drop policy if exists "ver archivos de facturas" on storage.objects;
create policy "ver archivos de facturas" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'facturas'
    and (
      mi_rol() in ('comprador', 'financista')
      or exists (
        select 1 from compras c
        where c.registrada_por = auth.uid()
          and c.id::text = (storage.foldername(name))[1]
      )
    )
  );

-- --- Balance ----------------------------------------------------------

-- Una fila por persona. Quién ve cuántas filas lo decide esta función y no
-- la pantalla: a Alix le devuelve exactamente una, la suya. Una pantalla
-- con un fallo no puede enseñar un balance ajeno porque nunca llega a
-- tenerlo.
--
-- `security invoker` (y no `definer` como la anterior) es deliberado: así
-- las sumas de dentro pasan por las políticas de arriba. La condición del
-- `where` y las políticas de las tablas dicen lo mismo por dos caminos
-- distintos; si una se equivocara, la otra sigue tapando.
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
  where mi_rol() in ('comprador', 'financista') or p.id = auth.uid()
  order by p.nombre
$$;

revoke all on function obtener_balances() from public;
grant execute on function obtener_balances() to authenticated;

-- La anterior sumaba el dinero de todos en un solo número. Con bolsas por
-- persona ese número ya no significa nada para nadie, y dejarla viva sería
-- dejar una trampa para el próximo que la llame.
drop function if exists obtener_balance();
