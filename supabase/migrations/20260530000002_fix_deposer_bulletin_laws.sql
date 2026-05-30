-- Support des compteurs JSONB pour les lois parlementaires dans deposer_bulletin

CREATE OR REPLACE FUNCTION public.deposer_bulletin(
  p_proposal_id text, p_user_hash text, p_choice text, p_proof_hash text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_old_choice TEXT;
  v_is_law BOOLEAN;
BEGIN
  -- Vérifie si l'ID correspond à une loi de l'Assemblée Nationale
  SELECT EXISTS(SELECT 1 FROM parliamentary_laws WHERE id = p_proposal_id) INTO v_is_law;

  SELECT last_choice INTO v_old_choice FROM registre_scrutin
  WHERE proposal_id = p_proposal_id AND user_hash = p_user_hash;
  
  IF v_old_choice IS NOT NULL THEN
    -- 1. Annulation de l'ancien vote
    IF v_is_law THEN
      IF v_old_choice = 'YES' THEN UPDATE parliamentary_laws SET votes = jsonb_set(votes, '{pour}', (COALESCE((votes->>'pour')::int, 0) - 1)::text::jsonb) WHERE id = p_proposal_id;
      ELSIF v_old_choice = 'NO' THEN UPDATE parliamentary_laws SET votes = jsonb_set(votes, '{contre}', (COALESCE((votes->>'contre')::int, 0) - 1)::text::jsonb) WHERE id = p_proposal_id;
      ELSIF v_old_choice = 'ABSTAIN' THEN UPDATE parliamentary_laws SET votes = jsonb_set(votes, '{blanc}', (COALESCE((votes->>'blanc')::int, 0) - 1)::text::jsonb) WHERE id = p_proposal_id;
      END IF;
    ELSE
      IF v_old_choice = 'YES' THEN UPDATE proposals SET votes_pour = COALESCE(votes_pour,0) - 1 WHERE id::text = p_proposal_id;
      ELSIF v_old_choice = 'NO' THEN UPDATE proposals SET votes_contre = COALESCE(votes_contre,0) - 1 WHERE id::text = p_proposal_id;
      ELSIF v_old_choice = 'ABSTAIN' THEN UPDATE proposals SET votes_blanc = COALESCE(votes_blanc,0) - 1 WHERE id::text = p_proposal_id;
      END IF;
    END IF;
    UPDATE registre_scrutin SET last_choice = p_choice, voted_at = now() WHERE proposal_id = p_proposal_id AND user_hash = p_user_hash;
  ELSE
    INSERT INTO registre_scrutin (proposal_id, user_hash, last_choice) VALUES (p_proposal_id, p_user_hash, p_choice);
  END IF;

  INSERT INTO urne_electronique (proposal_id, vote_choice, proof_hash) VALUES (p_proposal_id, p_choice, p_proof_hash);
  
  -- 2. Ajout du nouveau vote
  IF v_is_law THEN
    IF p_choice = 'YES' THEN UPDATE parliamentary_laws SET votes = jsonb_set(votes, '{pour}', (COALESCE((votes->>'pour')::int, 0) + 1)::text::jsonb) WHERE id = p_proposal_id;
    ELSIF p_choice = 'NO' THEN UPDATE parliamentary_laws SET votes = jsonb_set(votes, '{contre}', (COALESCE((votes->>'contre')::int, 0) + 1)::text::jsonb) WHERE id = p_proposal_id;
    ELSIF p_choice = 'ABSTAIN' THEN UPDATE parliamentary_laws SET votes = jsonb_set(votes, '{blanc}', (COALESCE((votes->>'blanc')::int, 0) + 1)::text::jsonb) WHERE id = p_proposal_id;
    END IF;
  ELSE
    IF p_choice = 'YES' THEN UPDATE proposals SET votes_pour = COALESCE(votes_pour,0) + 1 WHERE id::text = p_proposal_id;
    ELSIF p_choice = 'NO' THEN UPDATE proposals SET votes_contre = COALESCE(votes_contre,0) + 1 WHERE id::text = p_proposal_id;
    ELSIF p_choice = 'ABSTAIN' THEN UPDATE proposals SET votes_blanc = COALESCE(votes_blanc,0) + 1 WHERE id::text = p_proposal_id;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'updated', v_old_choice IS NOT NULL);
END;
$function$;