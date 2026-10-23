-- Atlas Agency · 0008 · Class distance reference ("school to the library")
--
-- Teachers can set one place near school and its distance, so students who
-- don't know how far home is can compare map distances to a shared trip.
-- This is class data (a public place), never a student's home.

alter table public.classes
  add column trip_place_en text check (length(trip_place_en) between 1 and 40),
  add column trip_place_es text check (length(trip_place_es) between 1 and 40),
  add column trip_km numeric(5,2) check (trip_km between 0.1 and 50),
  add constraint trip_complete check ((trip_place_en is null) = (trip_km is null) and (trip_place_es is null or trip_place_en is not null));

comment on column public.classes.trip_place_en is 'Destination of the class trip from school, e.g. "the public library".';

-- Only the class's teachers (and the school admin) may change it: classes_update already enforces that.
grant update (trip_place_en, trip_place_es, trip_km) on public.classes to authenticated;
