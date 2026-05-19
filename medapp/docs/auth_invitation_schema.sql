-- MedApp authentication and doctor invitation schema.
-- Run this in Supabase SQL Editor before using doctor invitations.

alter table public.users
  add column if not exists email_verified boolean not null default false,
  add column if not exists invited_by_user_id bigint references public.users(id),
  add column if not exists last_login timestamptz;

update public.users
set email_verified = true
where is_active = true
  and email_verified = false;

create table if not exists public.doctor_invitations (
  id bigserial primary key,
  token_hash text not null unique,
  email text not null,
  full_name text not null,
  role text not null default 'doctor' check (role = 'doctor'),
  user_id bigint not null references public.users(id) on delete cascade,
  doctor_id bigint references public.doctors(id) on delete set null,
  invited_by_user_id bigint references public.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id bigint references public.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_doctor_invitations_email
  on public.doctor_invitations (lower(email));

create index if not exists idx_doctor_invitations_user_id
  on public.doctor_invitations (user_id);

create index if not exists idx_doctor_invitations_expires_at
  on public.doctor_invitations (expires_at);

-- Optional hardening if your Flask backend uses SUPABASE_SERVICE_ROLE_KEY.
-- alter table public.doctor_invitations enable row level security;
-- revoke all on public.doctor_invitations from anon, authenticated;
