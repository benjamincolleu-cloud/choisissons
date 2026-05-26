-- À exécuter UNE SEULE FOIS dans le SQL Editor Supabase
-- après avoir déployé la fonction sync-parliamentary-laws

-- Extensions (déjà actives si cron-setup.sql a été exécuté)
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Planifier la synchronisation tous les jours à 3h00 UTC
select cron.schedule(
  'sync-parliamentary-laws-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url        := 'https://rojpkszrscsdpuydrnea.supabase.co/functions/v1/sync-parliamentary-laws',
    headers    := '{"Authorization": "Bearer TON_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body       := '{}'::bytea
  )
  $$
);

-- Vérifier que le job est bien créé
select jobid, jobname, schedule, command from cron.job where jobname = 'sync-parliamentary-laws-daily';
