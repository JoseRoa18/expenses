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
  compra_id     uuid not null references compras(id) on delete cascade,
  storage_path  text not null check (length(trim(storage_path)) > 0),
  created_at    timestamptz not null default now()
);

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

  -- Sin cambio de estado: solo se admite editar si sigue pendiente.
  if old.estado = new.estado then
    if old.estado <> 'pendiente'
       and (old.titulo, old.cantidad, old.urgencia, old.notas)
           is distinct from (new.titulo, new.cantidad, new.urgencia, new.notas)
    then
      raise exception
        'La solicitud está en estado % y ya no se puede editar', old.estado;
    end if;
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
