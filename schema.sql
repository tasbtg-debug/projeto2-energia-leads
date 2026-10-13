-- Execute no SQL Editor do projeto Supabase escolhido para o Projeto 2.
create table if not exists public.energy_leads (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 name text not null,
 whatsapp text not null,
 state char(2) not null,
 property_type text not null,
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
alter table public.energy_leads enable row level security;
-- Sem policies públicas: apenas backend com service_role ou usuários autorizados via políticas futuras.
create index if not exists energy_leads_created_at_idx on public.energy_leads(created_at desc);
