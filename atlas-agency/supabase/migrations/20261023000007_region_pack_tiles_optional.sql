-- Atlas Agency · 0007 · Region packs: map tiles are optional
--
-- The whole-world base map ships inside the app, so a region pack is useful
-- with content alone (newer country versions, photos later). Detail tiles are
-- added once a self-hosted tile source is chosen (no third-party tile hosts:
-- COPPA, no trackers). Tile fields are all present or all absent.

alter table public.region_packs
  alter column tiles_path drop not null,
  alter column tiles_bytes drop not null,
  alter column tiles_sha256 drop not null,
  add column content_bytes bigint not null default 0 check (content_bytes >= 0),
  add constraint tiles_all_or_nothing check (num_nulls(tiles_path, tiles_bytes, tiles_sha256) in (0, 3));

comment on column public.region_packs.manifest is
  'Array of {"id": "country:XX", "version": n}; every entry must exist in content_items.';

create function app.validate_region_pack() returns trigger
language plpgsql set search_path = '' as $$
declare missing text;
begin
  select e->>'id' || '@' || (e->>'version') into missing
    from jsonb_array_elements(new.manifest) e
   where not exists (select 1 from public.content_items c
                      where c.id = e->>'id' and c.version = (e->>'version')::int and c.status = 'published')
   limit 1;
  if missing is not null then
    raise exception 'region pack % references unpublished or unknown content %', new.id, missing
      using errcode = 'foreign_key_violation';
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger region_packs_validate before insert or update on public.region_packs
  for each row execute function app.validate_region_pack();
