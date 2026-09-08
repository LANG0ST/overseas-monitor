alter type public.profile_role
  add value if not exists 'superadmin' before 'admin';
