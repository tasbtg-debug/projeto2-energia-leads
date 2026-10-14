-- Execute no SQL Editor do projeto Supabase escolhido para o Projeto 2.
create table if not exists public.energy_leads (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 name text not null,
 whatsapp text not null,
 state char(2) not null,
 property_type text not null,
 ownership text,
 bill_range text not null,
 benefit text not null,
 bill_holder text not null,
 consent boolean not null default false,
 source text not null default 'projeto-2-netlify',
 status text not null default 'Novo',
 notes text,
 updated_at timestamptz not null default now(),
 constraint energy_leads_status_check check (status in ('Novo','Em contato','Em análise','Proposta enviada','Convertido','Não convertido'))
);
alter table public.energy_leads add column if not exists ownership text;
alter table public.energy_leads enable row level security;
-- Sem policies públicas: apenas backend com service_role ou usuários autorizados via políticas futuras.
create index if not exists energy_leads_created_at_idx on public.energy_leads(created_at desc);

-- Execute estas instruções no SQL Editor do Supabase antes de testar o formulário.
create sequence if not exists public.energy_lead_protocol_seq
  as bigint start with 0 increment by 1 minvalue 0;
alter table public.energy_leads
  add column if not exists protocol bigint unique default nextval('public.energy_lead_protocol_seq');
alter table public.energy_leads
  add column if not exists bill_path text;
-- Se a tabela já possuir cadastros, a sequência é ajustada para evitar números repetidos.
select setval('public.energy_lead_protocol_seq',
  coalesce((select max(protocol) from public.energy_leads),0),
  exists(select 1 from public.energy_leads where protocol is not null));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('energy-bills','energy-bills',false,4194304,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
