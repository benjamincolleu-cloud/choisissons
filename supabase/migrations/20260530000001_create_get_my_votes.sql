-- Fonction pour récupérer l'historique des votes d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_my_votes(p_user_hash text)
RETURNS TABLE (proposal_id text, title text, voted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT r.proposal_id, COALESCE(p.title, l.title, 'Proposition inconnue') as title, r.voted_at
  FROM registre_scrutin r
  LEFT JOIN proposals p ON p.id::text = r.proposal_id
  LEFT JOIN parliamentary_laws l ON l.id = r.proposal_id
  WHERE r.user_hash = p_user_hash
  ORDER BY r.voted_at DESC;
END;
$$;