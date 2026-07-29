-- Remove searches that are still attributable to a profile as part of the
-- same transaction that deletes that profile. auth.users cascades into
-- public.users; a BEFORE trigger is required because the existing FK would
-- otherwise retain those rows with user_id = NULL.
CREATE OR REPLACE FUNCTION delete_owned_search_history_before_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.search_history WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION delete_owned_search_history_before_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_owned_search_history_before_profile() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_delete_owned_search_history ON public.users;
CREATE TRIGGER trg_delete_owned_search_history
  BEFORE DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION delete_owned_search_history_before_profile();
