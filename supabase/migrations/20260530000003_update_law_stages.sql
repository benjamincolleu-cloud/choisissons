-- Fonction pour mettre à jour les statuts des lois selon leur date de vote
CREATE OR REPLACE FUNCTION public.update_parliamentary_law_stages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Passage en 'closed' (7 jours après le vote)
  UPDATE parliamentary_laws 
  SET stage = 'closed'
  WHERE stage = 'voting' 
  AND parliament_vote_date IS NOT NULL
  AND parliament_vote_date != ''
  AND parliament_vote_date::date + 7 < CURRENT_DATE;
  
  -- Passage en 'archived' (37 jours après le vote)
  UPDATE parliamentary_laws 
  SET stage = 'archived'
  WHERE stage = 'closed'
  AND parliament_vote_date IS NOT NULL  
  AND parliament_vote_date != ''
  AND parliament_vote_date::date + 37 < CURRENT_DATE;
END;
$$;

-- Appliquer immédiatement pour les lois actuelles
SELECT public.update_parliamentary_law_stages();