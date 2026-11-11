-- Secret du vote (08/11/2026)
-- Avant : le registre gardait le choix de chaque votant (last_choice) à côté de son identifiant,
-- et le bulletin de l'urne portait la même heure, à la microseconde, que la ligne du registre.
-- Après :
--   * le registre ne garde que « ce compte a voté » (pour bloquer le double vote), jamais le choix ;
--   * le bulletin de l'urne est daté au jour seulement, pour ne plus pouvoir le rapprocher du registre par l'heure ;
--   * les 21 choix déjà stockés sont effacés et les dates des bulletins existants sont arrondies au jour.
-- Les compteurs (votes_pour / votes_contre / votes_blanc) ne changent pas.

CREATE OR REPLACE FUNCTION public.deposer_bulletin(p_proposal_id text, p_user_hash text, p_choice text, p_proof_hash text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_uid uuid := auth.uid(); v_user_hash text;
  v_is_law boolean; v_law_uuid uuid; v_law_number text; v_rows integer; v_canonical_id text;
begin
  -- p_user_hash est ignoré : l'identifiant du votant est calculé ici, à partir du compte connecté.
  if v_uid is null then return json_build_object('success', false, 'error', 'not_authenticated'); end if;
  if p_choice is null or p_choice not in ('YES','NO','ABSTAIN') then return json_build_object('success', false, 'error', 'invalid_choice'); end if;
  v_user_hash := encode(extensions.digest(v_uid::text, 'sha256'), 'hex');

  select id, number into v_law_uuid, v_law_number from parliamentary_laws where number = p_proposal_id limit 1;
  if v_law_uuid is null and p_proposal_id like 'DOSSIER-%' then
    select id, number into v_law_uuid, v_law_number from parliamentary_laws
     where number like 'TXT-%' and official_url like '%' || substring(p_proposal_id from 9) || '%' limit 1;
  end if;
  v_is_law := (v_law_uuid is not null);
  v_canonical_id := case when v_is_law then v_law_number else p_proposal_id end;

  -- Vote définitif + anti-double-vote atomique.
  -- Secret du vote : le registre ne garde que « ce compte a voté », jamais le choix.
  insert into registre_scrutin (proposal_id, user_hash) values (v_canonical_id, v_user_hash)
    on conflict (proposal_id, user_hash) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return json_build_object('success', false, 'already_voted', true, 'is_law', v_is_law); end if;

  -- Bulletin dans l'urne, daté au jour seulement : impossible de le rapprocher du registre par l'heure.
  insert into urne_electronique (proposal_id, vote_choice, proof_hash, deposited_at)
    values (v_canonical_id, p_choice, p_proof_hash, date_trunc('day', now())::timestamp);

  -- Incrémenter le compteur
  if v_is_law then
    if p_choice='YES' then update parliamentary_laws set votes_pour=coalesce(votes_pour,0)+1 where id=v_law_uuid;
    elsif p_choice='NO' then update parliamentary_laws set votes_contre=coalesce(votes_contre,0)+1 where id=v_law_uuid;
    else update parliamentary_laws set votes_blanc=coalesce(votes_blanc,0)+1 where id=v_law_uuid; end if;
  else
    if p_choice='YES' then update proposals set votes_pour=coalesce(votes_pour,0)+1 where id::text=p_proposal_id;
    elsif p_choice='NO' then update proposals set votes_contre=coalesce(votes_contre,0)+1 where id::text=p_proposal_id;
    else update proposals set votes_blanc=coalesce(votes_blanc,0)+1 where id::text=p_proposal_id; end if;
  end if;

  return json_build_object('success', true, 'already_voted', false, 'is_law', v_is_law);
end;
$function$;

ALTER TABLE public.urne_electronique ALTER COLUMN deposited_at SET DEFAULT date_trunc('day', now());

UPDATE public.registre_scrutin SET last_choice = NULL WHERE last_choice IS NOT NULL;

UPDATE public.urne_electronique SET deposited_at = date_trunc('day', deposited_at)
 WHERE deposited_at <> date_trunc('day', deposited_at);
