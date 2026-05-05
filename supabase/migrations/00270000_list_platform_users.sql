-- 00270000_list_platform_users.sql
--
-- RPC pra listar usuarios cadastrados na plataforma. Usado pelo dropdown
-- de "Adicionar moderador" na pagina de evento. Retorna id + email.
-- Disponivel pra qualquer authenticated; mesmo nivel de acesso que ja
-- existe na pagina /admin/users (que ja lista todo mundo via service role).

create or replace function public.list_platform_users()
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select u.id, u.email::text
    from auth.users u
    where u.email is not null
    order by u.email asc;
end;
$$;

grant execute on function public.list_platform_users() to authenticated;
