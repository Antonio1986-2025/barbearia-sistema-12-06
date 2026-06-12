-- Ensure the pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Use a simpler update for the existing user if it exists, otherwise insert.
-- We'll try to find by email first.
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'barbeariastatus01@gmail.com';
  v_pass TEXT := '022464Jj@';
BEGIN
  -- 1. Try to find existing user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    -- Use the ID from public.profiles if user doesn't exist in auth.users
    v_user_id := '17831681-759c-4398-aeb5-699b228e8aa5';
    
    INSERT INTO auth.users (
      id, 
      instance_id, 
      email, 
      encrypted_password, 
      email_confirmed_at, 
      raw_app_meta_data, 
      raw_user_meta_data, 
      is_super_admin, 
      role, 
      aud, 
      created_at, 
      updated_at, 
      confirmation_token, 
      recovery_token, 
      email_change_token_new, 
      email_change
    )
    VALUES (
      v_user_id, 
      '00000000-0000-0000-0000-000000000000', 
      v_email, 
      crypt(v_pass, gen_salt('bf')), 
      now(), 
      '{"provider":"email","providers":["email"]}', 
      '{"nome":"Admin","tipo":"admin"}', 
      false, 
      'authenticated', 
      'authenticated', 
      now(), 
      now(), 
      '', 
      '', 
      '', 
      ''
    );
  ELSE
    -- User exists, update password and confirm email
    UPDATE auth.users 
    SET 
      encrypted_password = crypt(v_pass, gen_salt('bf')),
      email_confirmed_at = now(),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}',
      raw_user_meta_data = '{"nome":"Admin","tipo":"admin"}'
    WHERE id = v_user_id;
  END IF;

  -- 2. Resync auth.identities
  DELETE FROM auth.identities WHERE user_id = v_user_id;
  
  INSERT INTO auth.identities (
    id, 
    user_id, 
    identity_data, 
    provider, 
    last_sign_in_at, 
    created_at, 
    updated_at, 
    provider_id
  )
  VALUES (
    gen_random_uuid(), 
    v_user_id, 
    jsonb_build_object('sub', v_user_id, 'email', v_email, 'email_verified', true), 
    'email', 
    now(), 
    now(), 
    now(), 
    v_user_id::text
  );
END $$;
