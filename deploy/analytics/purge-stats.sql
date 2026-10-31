-- Purge des statistiques de Miam'Alert au-delà de 13 mois (durée annoncée dans la politique de
-- confidentialité, recommandée par la CNIL pour une mesure d'audience exemptée de consentement).
-- Umami auto-hébergé ne supprime rien de lui-même. Lancé par miam-stats-purge.timer, sur la base
-- « umami » uniquement, avec son propre rôle (aucun accès à la base de l'application).
BEGIN;
DELETE FROM event_data     WHERE created_at < now() - interval '13 months';
DELETE FROM session_data   WHERE created_at < now() - interval '13 months';
DELETE FROM revenue        WHERE created_at < now() - interval '13 months';
DELETE FROM heatmap_event  WHERE created_at < now() - interval '13 months';
DELETE FROM session_replay WHERE created_at < now() - interval '13 months';
DELETE FROM session_link   WHERE created_at < now() - interval '13 months';
DELETE FROM website_event  WHERE created_at < now() - interval '13 months';
-- Une visite ancienne dont il ne reste plus aucun événement.
DELETE FROM session s
 WHERE s.created_at < now() - interval '13 months'
   AND NOT EXISTS (SELECT 1 FROM website_event e WHERE e.session_id = s.session_id);
COMMIT;
