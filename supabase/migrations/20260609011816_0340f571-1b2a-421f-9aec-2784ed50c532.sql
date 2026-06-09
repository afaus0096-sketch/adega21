DO $$
DECLARE
  uids uuid[] := ARRAY['8953a918-c36d-48d5-a1b3-deab7a6c9d05','e0143eaf-414b-4c9f-ab2a-7239f12fba18']::uuid[];
  u uuid;
BEGIN
  FOREACH u IN ARRAY uids LOOP
    DELETE FROM public.user_roles WHERE user_id = u;
    DELETE FROM public.funcionarios WHERE id = u;
    DELETE FROM public.profiles WHERE id = u;
    DELETE FROM auth.users WHERE id = u;
  END LOOP;
END $$;