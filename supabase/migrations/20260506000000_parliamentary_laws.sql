create table if not exists parliamentary_laws (
  id                   text        primary key,
  number               text        not null,
  title                text        not null,
  description          text        not null default '',
  category             text        not null default 'Divers',
  stage                text        not null default 'voting',
  parliament_vote_date text        not null default '',
  votes                jsonb       not null default '{"pour":0,"contre":0,"blanc":0}',
  tags                 text[]      not null default '{}',
  official_url         text        not null default '',
  synced_at            timestamptz not null default now()
);

alter table parliamentary_laws enable row level security;

create policy "Lecture publique" on parliamentary_laws
  for select using (true);
