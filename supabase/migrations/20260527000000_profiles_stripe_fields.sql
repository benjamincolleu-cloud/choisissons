-- Nouveaux champs profil : Stripe subscription, code postal, date de naissance hashée

alter table profiles
  add column if not exists stripe_subscription_id text,
  add column if not exists code_postal            text,
  add column if not exists date_naissance_hash    text;

-- Étendre subscription_plan pour inclure les nouveaux plans
alter table profiles drop constraint if exists profiles_subscription_plan_check;
alter table profiles
  add constraint profiles_subscription_plan_check
    check (subscription_plan in (
      'gratuit',
      'citoyen',
      'commune_petite', 'commune_moyenne', 'commune_grande',
      'media', 'ong',
      'assoc_s', 'assoc_m', 'assoc_l'
    ));
