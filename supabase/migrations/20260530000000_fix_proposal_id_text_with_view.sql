-- Migration appliquée directement en base le 30 Mai 2026
-- Conversion proposal_id bigint -> text pour supporter les IDs de lois AN (ex: PPL-2026-0514)

DROP FUNCTION IF EXISTS public.deposer_bulletin(bigint, text, text, text);
DROP VIEW IF EXISTS public.bibliotheque_votes;
ALTER TABLE public.registre_scrutin DROP CONSTRAINT IF EXISTS registre_scrutin_proposal_id_fkey;
ALTER TABLE public.urne_electronique DROP CONSTRAINT IF EXISTS urne_electronique_proposal_id_fkey;
ALTER TABLE public.registre_scrutin ALTER COLUMN proposal_id TYPE text USING proposal_id::text;
ALTER TABLE public.urne_electronique ALTER COLUMN proposal_id TYPE text USING proposal_id::text;

CREATE OR REPLACE VIEW public.bibliotheque_votes AS
  SELECT p.id, p.title, p.description, p.category, p.status,
    p.votes_pour, p.votes_contre, p.votes_blanc, p.closed_at,
    p.blockchain_proof, count(u.id) AS total_bulletins
  FROM proposals p
  LEFT JOIN urne_electronique u ON (u.proposal_id = p.id::text)
  WHERE p.status = ANY (ARRAY['adopted'::text, 'rejected'::text, 'closed'::text])
  GROUP BY p.id;

CREATE OR REPLACE FUNCTION public.deposer_bulletin(
  p_proposal_id text, p_user_hash text, p_choice text, p_proof_hash text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_old_choice TEXT;
BEGIN
  SELECT last_choice INTO v_old_choice FROM registre_scrutin
  WHERE proposal_id = p_proposal_id AND user_hash = p_user_hash;
  IF v_old_choice IS NOT NULL THEN
    IF v_old_choice = 'YES' THEN UPDATE proposals SET votes_pour = COALESCE(votes_pour,0) - 1 WHERE id::text = p_proposal_id;
    ELSIF v_old_choice = 'NO' THEN UPDATE proposals SET votes_contre = COALESCE(votes_contre,0) - 1 WHERE id::text = p_proposal_id;
    ELSIF v_old_choice = 'ABSTAIN' THEN UPDATE proposals SET votes_blanc = COALESCE(votes_blanc,0) - 1 WHERE id::text = p_proposal_id;
    END IF;
    UPDATE registre_scrutin SET last_choice = p_choice, voted_at = now()
    WHERE proposal_id = p_proposal_id AND user_hash = p_user_hash;
  ELSE
    INSERT INTO registre_scrutin (proposal_id, user_hash, last_choice) VALUES (p_proposal_id, p_user_hash, p_choice);
  END IF;
  INSERT INTO urne_electronique (proposal_id, vote_choice, proof_hash) VALUES (p_proposal_id, p_choice, p_proof_hash);
  IF p_choice = 'YES' THEN UPDATE proposals SET votes_pour = COALESCE(votes_pour,0) + 1 WHERE id::text = p_proposal_id;
  ELSIF p_choice = 'NO' THEN UPDATE proposals SET votes_contre = COALESCE(votes_contre,0) + 1 WHERE id::text = p_proposal_id;
  ELSIF p_choice = 'ABSTAIN' THEN UPDATE proposals SET votes_blanc = COALESCE(votes_blanc,0) + 1 WHERE id::text = p_proposal_id;
  END IF;
  RETURN json_build_object('success', true, 'updated', v_old_choice IS NOT NULL);
END;
$function$;