-- À exécuter UNE SEULE FOIS dans le SQL Editor Supabase
-- après avoir déployé la fonction sync-an-laws

-- 1. Activer les extensions nécessaires
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2. Planifier la synchronisation tous les jours à 6h00 UTC
select cron.schedule(
  'sync-an-laws-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url        := 'https://rojpkszrscsdpuydrnea.supabase.co/functions/v1/sync-an-laws',
    headers    := '{"Authorization": "Bearer TON_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body       := '{}'::bytea
  )
  $$
);

-- 3. Vérifier que le job est bien créé
select jobid, jobname, schedule, command from cron.job where jobname = 'sync-an-laws-daily';
