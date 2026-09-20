-- =====================================================================
-- 0001: tipos, tablas, restricciones y triggers
-- Repetible: correrlo dos veces no cambia el resultado.
-- =====================================================================

-- --- Tipos ------------------------------------------------------------

do $$ begin
  create type rol_usuario as enum ('solicitante', 'comprador', 'financista');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgencia_solicitud as enum ('normal', 'urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_solicitud as enum
    ('pendiente', 'comprada', 'entregada', 'rechazada', 'cancelada');
exception when duplicate_object then null; end $$;

-- --- Tablas -----------------------------------------------------------

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  rol         rol_usuario not null,
  created_at  timestamptz not null default now()
);

create table if not exists solicitudes (
  id              uuid primary key default gen_random_uuid(),
  creada_por      uuid not null references profiles(id) on delete restrict,
  titulo          text not null check (length(trim(titulo)) > 0),
  cantidad        text not null default '',
  urgencia        urgencia_solicitud not null default 'normal',
  notas           text not null default '',
  estado          estado_solicitud not null default 'pendiente',
  motivo_rechazo  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- El motivo es obligatorio al rechazar, y no puede quedar colgando en
  -- otros estados. Lo impone la base, no el formulario.
  constraint motivo_solo_si_rechazada check (
    (estado = 'rechazada'
      and motivo_rechazo is not null
      and length(trim(motivo_rechazo)) > 0)
    or
    (estado <> 'rechazada' and motivo_rechazo is null)
  )
);

create table if not exists compras (
  id              uuid primary key default gen_random_uuid(),
  -- null = compra suelta, sin que nadie la pidiera.
  -- El UNIQUE ignora los nulos, así que puede haber muchas compras sueltas
  -- pero solo una compra por solicitud.
  solicitud_id    uuid unique references solicitudes(id) on delete restrict,
  registrada_por  uuid not null references profiles(id) on delete restrict,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  monto_bs        numeric(14, 2) not null check (monto_bs >= 0),
  monto_usd       numeric(12, 2) not null check (monto_usd >= 0),
  notas           text not null default '',
  fecha_compra    date not null default current_date,
  fecha_entrega   date,
  created_at      timestamptz not null default now(),

  constraint entrega_no_antes_de_compra check (
    fecha_entrega is null or fecha_entrega >= fecha_compra
  )
);

create table if not exists facturas (
  id            uuid primary key default gen_random_uuid(),
  compra_id     uuid not null references compras(id) on delete restrict,
  storage_path  text not null check (length(trim(storage_path)) > 0),
  created_at    timestamptz not null default now()
);

-- Nada se borra ni se edita una vez registrado (ver "Fuera de alcance" en el
-- spec): las facturas son la evidencia de auditoría, así que borrar una
-- compra nunca debe arrastrar sus facturas. Esta tabla ya existía con
-- "on delete cascade" en bases ya migradas, así que la corregimos aquí de
-- forma repetible en vez de depender del "create table if not exists" de
-- arriba, que no toca tablas existentes.
alter table facturas drop constraint if exists facturas_compra_id_fkey;
alter table facturas
  add constraint facturas_compra_id_fkey
  foreign key (compra_id) references compras(id) on delete restrict;

create table if not exists aportes (
  id              uuid primary key default gen_random_uuid(),
  registrada_por  uuid not null references profiles(id) on delete restrict,
  monto_usd       numeric(12, 2) not null check (monto_usd > 0),
  fecha           date not null default current_date,
  metodo          text not null default '',
  notas           text not null default '',
  created_at      timestamptz not null default now()
);

-- --- Índices ----------------------------------------------------------

create index if not exists idx_solicitudes_estado on solicitudes (estado, created_at desc);
create index if not exists idx_solicitudes_autor on solicitudes (creada_por);
create index if not exists idx_compras_fecha on compras (fecha_compra desc);
create index if not exists idx_facturas_compra on facturas (compra_id);
create index if not exists idx_aportes_fecha on aportes (fecha desc);

-- --- Transiciones de estado -------------------------------------------

create or replace function validar_transicion_solicitud()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  -- La autoría nunca se reasigna. No hay ningún flujo legítimo -- ni de la
  -- app, ni una corrección administrativa -- que le cambie el dueño a una
  -- solicitud, así que este candado no tiene excepción para nadie.
  if new.creada_por is distinct from old.creada_por then
    raise exception 'La autoría de una solicitud no se puede reasignar';
  end if;

  -- Inmutabilidad de contenido: solo el propio autor puede cambiar el
  -- título, la cantidad, la urgencia o las notas, y aun el autor deja de
  -- poder hacerlo en cuanto la solicitud sale de "pendiente". Esto se
  -- impone aquí -- no solo en la política de RLS -- porque la política
  -- "comprador gestiona estado" permite a Jose actualizar la fila para
  -- cambiar el estado, y RLS es por fila, no por columna: sin este
  -- candado, Jose podría reescribir el contenido de una solicitud ajena en
  -- el mismo UPDATE con el que la marca como comprada.
  --
  -- auth.uid() es NULL bajo una conexión con la llave de servicio
  -- (migraciones, scripts de administración, correcciones manuales desde
  -- Supabase), así que un llamador NULL no se bloquea aquí: el candado es
  -- para la app, no para el acceso administrativo que el spec ya permite.
  if (old.titulo, old.cantidad, old.urgencia, old.notas)
     is distinct from (new.titulo, new.cantidad, new.urgencia, new.notas)
  then
    if auth.uid() is not null and auth.uid() <> old.creada_por then
      raise exception 'Solo el autor de la solicitud puede cambiar su contenido';
    end if;

    -- Antes esto solo se comprobaba cuando el estado se mantenía igual, así
    -- que una transición legal (p. ej. comprada -> entregada) podía colarse
    -- reescribiendo el título o las notas en el mismo UPDATE.
    if old.estado <> 'pendiente' then
      raise exception
        'La solicitud está en estado % y ya no se puede editar', old.estado;
    end if;
  end if;

  -- El motivo de rechazo es el registro de por qué se rechazó algo: una vez
  -- fijado, no se toca más. El guard es sobre el valor viejo (no nulo), para
  -- no bloquear la transición legal pendiente -> rechazada, que pasa de
  -- NULL a un valor en el mismo UPDATE.
  if old.motivo_rechazo is not null
     and new.motivo_rechazo is distinct from old.motivo_rechazo
  then
    raise exception 'El motivo de rechazo no se puede modificar una vez registrado';
  end if;

  -- Sin cambio de estado: ya se validó arriba que el contenido no cambió.
  if old.estado = new.estado then
    return new;
  end if;

  -- Estados cerrados: no se sale de ellos.
  if old.estado in ('entregada', 'rechazada', 'cancelada') then
    raise exception
      'La solicitud ya está cerrada (%) y no admite más cambios', old.estado;
  end if;

  if old.estado = 'pendiente'
     and new.estado not in ('comprada', 'rechazada', 'cancelada') then
    raise exception 'Una solicitud pendiente no puede pasar a %', new.estado;
  end if;

  if old.estado = 'comprada' and new.estado <> 'entregada' then
    raise exception 'Una solicitud comprada solo puede pasar a entregada';
  end if;

  return new;
end
$$;

drop trigger if exists trg_transicion_solicitud on solicitudes;
create trigger trg_transicion_solicitud
  before update on solicitudes
  for each row execute function validar_transicion_solicitud();
