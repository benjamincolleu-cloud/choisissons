create table profiles (
  id                   uuid        primary key references auth.users(id) on delete cascade,
  stripe_customer_id   text        unique,
  subscription_status  text        not null default 'inactive',
  subscription_plan    text        not null default 'gratuit',
  updated_at           timestamptz not null default now()
);

-- Contraintes sur les valeurs autorisées
alter table profiles
  add constraint profiles_subscription_status_check
    check (subscription_status in ('active', 'inactive', 'past_due', 'canceled', 'trialing')),
  add constraint profiles_subscription_plan_check
    check (subscription_plan in ('gratuit', 'citoyen', 'commune_petite', 'commune_moyenne', 'commune_grande'));

-- Mise à jour automatique de updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Créer automatiquement un profil à chaque inscription
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles enable row level security;

-- Chaque utilisateur ne voit que son propre profil
create policy "Lecture profil propre" on profiles
  for select using (auth.uid() = id);

-- Seul le webhook Stripe (service role) peut modifier
create policy "Mise à jour service role" on profiles
  for update using (auth.role() = 'service_role');
