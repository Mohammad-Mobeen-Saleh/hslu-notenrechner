-- Einmal im SQL Editor des Projekts ausführen. Voraussetzung sind die vier bestehenden Tabellen.
begin;
create table if not exists public.study_settings (
  user_id uuid primary key references auth.users on delete cascade,
  revision bigint not null default 0,
  target numeric not null default 5
);
alter table public.study_settings enable row level security;
drop policy if exists own_settings on public.study_settings;
create policy own_settings on public.study_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.study_settings to authenticated;
alter table public.semesters add column if not exists collapsed boolean not null default false;
alter table public.semester_modules add column if not exists expanded boolean not null default false;
alter table public.module_assessments alter column grade type numeric(4,2);

create or replace function public.load_gradebook() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('revision', coalesce(cfg.revision,0), 'studyTarget', coalesce(cfg.target,5),
    'semesters', coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'target',s.target_grade,
        'collapsed',s.collapsed,'modules',coalesce((
          select jsonb_agg(jsonb_build_object('id',m.id,'name',m.module_name,'code',m.module_code,
            'target',m.target_grade,'ects',m.ects,'expanded',m.expanded,'source',m.source,
            'assessments',coalesce((
              select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'weight',a.weight,
                'grade',a.grade) order by a.position,a.id) from public.module_assessments a
                where a.semester_module_id=m.id
            ),'[]'::jsonb)) order by m.position,m.id)
            from public.semester_modules m where m.semester_id=s.id
        ),'[]'::jsonb)) order by s.position,s.id)
        from public.semesters s where s.user_id=auth.uid()
    ),'[]'::jsonb))
  from (select auth.uid() as id) u left join public.study_settings cfg on cfg.user_id=u.id;
$$;

create or replace function public.save_gradebook(expected_revision bigint, book jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  next_revision bigint;
  s record;
  m record;
begin
  if owner_id is null or jsonb_typeof(book->'semesters') is distinct from 'array' then
    raise exception 'Ungültiger Notenstand';
  end if;
  insert into public.study_settings(user_id) values(owner_id) on conflict do nothing;
  update public.study_settings set revision=revision+1, target=(book->>'studyTarget')::numeric
    where user_id=owner_id and revision=expected_revision returning revision into next_revision;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  -- Der Austausch des persönlichen Semesterbaums erfolgt in einer einzigen Transaktion.
  delete from public.semesters where user_id=owner_id;
  for s in select * from jsonb_array_elements(book->'semesters') with ordinality loop
    insert into public.semesters(id,user_id,name,target_grade,position,collapsed)
      values((s.value->>'id')::uuid,owner_id,s.value->>'name',(s.value->>'target')::numeric,
        s.ordinality,(s.value->>'collapsed')::boolean);
    for m in select * from jsonb_array_elements(s.value->'modules') with ordinality loop
      insert into public.semester_modules(id,semester_id,module_code,module_name,ects,target_grade,
        source,position,expanded) values((m.value->>'id')::uuid,(s.value->>'id')::uuid,
        m.value->>'code',m.value->>'name',(m.value->>'ects')::numeric,(m.value->>'target')::numeric,
        m.value->>'source',m.ordinality,(m.value->>'expanded')::boolean);
      insert into public.module_assessments(id,semester_module_id,name,weight,grade,position)
        select (value->>'id')::uuid,(m.value->>'id')::uuid,value->>'name',(value->>'weight')::numeric,
          (value->>'grade')::numeric,ordinality from jsonb_array_elements(m.value->'assessments') with ordinality;
    end loop;
  end loop;
  return next_revision;
end;
$$;
revoke all on function public.load_gradebook(), public.save_gradebook(bigint,jsonb) from public, anon;
grant execute on function public.load_gradebook(), public.save_gradebook(bigint,jsonb) to authenticated;
commit;
