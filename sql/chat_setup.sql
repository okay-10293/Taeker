/* =====================================================
   TAEKER 1:1 채팅 기능
   conversations / messages 테이블 + RLS + realtime
   이 파일은 Supabase SQL Editor에서 한 번 실행하면 됩니다.
===================================================== */

/* ---------- CONVERSATIONS ----------
   두 사용자 사이의 대화방 1개를 나타낸다.
   user_a_id < user_b_id 로 항상 정렬해서 저장하여
   같은 두 사람 사이의 중복 대화방 생성을 막는다. */

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_a_id uuid not null references public.profiles(id) on delete cascade,
    user_b_id uuid not null references public.profiles(id) on delete cascade,
    last_message text,
    last_message_at timestamptz,
    created_at timestamptz not null default now(),

    constraint conversations_distinct_users check (user_a_id <> user_b_id),
    constraint conversations_ordered_pair check (user_a_id < user_b_id),
    constraint conversations_unique_pair unique (user_a_id, user_b_id)
);

create index if not exists conversations_user_a_idx on public.conversations(user_a_id);
create index if not exists conversations_user_b_idx on public.conversations(user_b_id);
create index if not exists conversations_last_message_at_idx on public.conversations(last_message_at desc);

/* ---------- MESSAGES ---------- */

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_id uuid not null references public.profiles(id) on delete cascade,
    content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 2000),
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists messages_sender_idx on public.messages(sender_id);

/* ---------- 대화방 목록 자동 갱신 (마지막 메시지 미리보기) ---------- */

create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.conversations
    set last_message = new.content,
        last_message_at = new.created_at
    where id = new.conversation_id;

    return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;

create trigger on_message_created
after insert on public.messages
for each row execute function public.handle_new_message();

/* ---------- 대화방 조회/생성 헬퍼 함수 ----------
   두 사용자 id를 받아 기존 대화방을 찾거나 없으면 새로 만든다.
   RPC로 호출: supabase.rpc('get_or_create_conversation', { target_id: ... }) */

create or replace function public.get_or_create_conversation(target_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    a uuid;
    b uuid;
    conv_id uuid;
begin
    if me is null then
        raise exception '로그인이 필요합니다.';
    end if;

    if target_id = me then
        raise exception '자기 자신과는 대화할 수 없습니다.';
    end if;

    if me < target_id then
        a := me;
        b := target_id;
    else
        a := target_id;
        b := me;
    end if;

    select id into conv_id
    from public.conversations
    where user_a_id = a and user_b_id = b;

    if conv_id is null then
        insert into public.conversations (user_a_id, user_b_id)
        values (a, b)
        returning id into conv_id;
    end if;

    return conv_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

/* ---------- RLS ---------- */

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
on public.conversations for select
to authenticated
using (auth.uid() = user_a_id or auth.uid() = user_b_id);

/* 대화방 생성은 get_or_create_conversation() (security definer) 을 통해서만 이뤄지므로
   직접 insert 는 막아둔다. 다만 혹시 모를 클라이언트 직접 insert 를 대비해 정책은 남겨둔다. */
drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
on public.conversations for insert
to authenticated
with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "messages_select_own_conversation" on public.messages;
create policy "messages_select_own_conversation"
on public.messages for select
to authenticated
using (
    exists (
        select 1 from public.conversations c
        where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
);

drop policy if exists "messages_insert_own_conversation" on public.messages;
create policy "messages_insert_own_conversation"
on public.messages for insert
to authenticated
with check (
    sender_id = auth.uid()
    and exists (
        select 1 from public.conversations c
        where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
);

/* 상대가 보낸 메시지의 read_at 만 갱신할 수 있도록 허용 (읽음 처리) */
drop policy if exists "messages_update_read_own_conversation" on public.messages;
create policy "messages_update_read_own_conversation"
on public.messages for update
to authenticated
using (
    exists (
        select 1 from public.conversations c
        where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
)
with check (
    exists (
        select 1 from public.conversations c
        where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
);

/* ---------- REALTIME ---------- */

alter publication supabase_realtime add table public.messages;
