create or replace function public.fixed_nick_profile(p_nickname text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when f.nick_key is null then null else jsonb_build_object(
      'nickname', f.nickname, 'since', f.created_at,
      'post_count', (select count(*) from public.posts p where p.is_fixed and lower(p.nickname) = f.nick_key),
      'like_total', (select coalesce(sum(p.like_count),0) from public.posts p where p.is_fixed and lower(p.nickname) = f.nick_key),
      'comment_count', (select count(*) from public.comments c where c.is_fixed and lower(c.nickname) = f.nick_key)
  ) end
  from (select 1) x left join public.fixed_nicks f on f.nick_key = lower(btrim(p_nickname));
$$;
grant execute on function public.fixed_nick_profile(text) to anon, authenticated;
