-- Vote définitif : deposer_bulletin renvoie désormais
--   { "success": true/false, "already_voted": true/false, "is_law": true/false }
-- Le champ "updated" de l'ancienne version est supprimé.
-- Si already_voted = true, la fonction ne modifie rien en base.
--
-- ⚠️  COLLE ICI LE CORPS EXACT DE LA FONCTION FOURNI PAR LE RESPONSABLE DB
--     (le message initial a été tronqué avant l'envoi du SQL)

-- CREATE OR REPLACE FUNCTION public.deposer_bulletin(...) ...
