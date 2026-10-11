-- Run once in the SQL editor (after 2026-10-04-exercise-catalog.sql). Gym machines under the
-- names gyms use. Renames keep ids, so programs and history are kept.

update public.exercises set name = 'Machine Seated Row', muscles = '{back,upper back,biceps}' where created_by is null and name = 'Lever Seated Row';
update public.exercises set name = 'Machine High Row', muscles = '{back,upper back,biceps}' where created_by is null and name = 'Lever High Row';
update public.exercises set name = 'Machine Lat Pulldown', muscles = '{back,biceps}' where created_by is null and name = 'Lever Front Pulldown';
update public.exercises set name = 'Machine Incline Chest Press', muscles = '{upper chest,triceps,shoulders}' where created_by is null and name = 'Lever Incline Chest Press';
update public.exercises set name = 'Machine Decline Chest Press', muscles = '{chest,triceps}' where created_by is null and name = 'Lever Decline Chest Press';
update public.exercises set name = 'Machine Biceps Curl', muscles = '{biceps}' where created_by is null and name = 'Lever Bicep Curl';
update public.exercises set name = 'Machine Triceps Extension', muscles = '{triceps}' where created_by is null and name = 'Lever Triceps Extension';
update public.exercises set name = 'Lying Leg Curl', muscles = '{hamstrings}' where created_by is null and name = 'Lever Lying Leg Curl';
update public.exercises set name = 'Seated Calf Raise', muscles = '{calves}' where created_by is null and name = 'Lever Seated Calf Raise';
update public.exercises set name = 'Machine Hip Adduction', muscles = '{adductors}' where created_by is null and name = 'Lever Seated Hip Adduction';
update public.exercises set name = 'Machine Crunch', muscles = '{core}' where created_by is null and name = 'Lever Seated Crunch';
update public.exercises set name = 'Machine Shrug', muscles = '{traps}' where created_by is null and name = 'Lever Shrug';
update public.exercises set name = 'T Bar Row', muscles = '{back,upper back,biceps}' where created_by is null and name = 'Lever T Bar Row';
update public.exercises set name = 'Machine Pullover', muscles = '{back,chest}' where created_by is null and name = 'Lever Pullover';
update public.exercises set name = 'Machine Back Extension', muscles = '{lower back,glutes,hamstrings}' where created_by is null and name = 'Lever Back Extension';
update public.exercises set name = 'Reverse Hyperextension', muscles = '{glutes,hamstrings,lower back}' where created_by is null and name = 'Lever Reverse Hyperextension';
update public.exercises set name = 'Machine Glute Kickback', muscles = '{glutes,hamstrings}' where created_by is null and name = 'Lever Hip Extension';
update public.exercises set name = 'Smith Machine Shoulder Press', muscles = '{shoulders,triceps}' where created_by is null and name = 'Smith Seated Shoulder Press';
update public.exercises set name = 'Smith Machine Row', muscles = '{back,upper back,biceps}' where created_by is null and name = 'Smith Bent Over Row';

insert into public.exercises (name, muscles, tier)
select v.name, v.muscles::text[], v.tier
from (values
  ('Machine Seated Row', '{back,upper back,biceps}', null),
  ('Machine High Row', '{back,upper back,biceps}', null),
  ('Machine Lat Pulldown', '{back,biceps}', null),
  ('Machine Incline Chest Press', '{upper chest,triceps,shoulders}', null),
  ('Machine Decline Chest Press', '{chest,triceps}', null),
  ('Machine Biceps Curl', '{biceps}', null),
  ('Machine Triceps Extension', '{triceps}', null),
  ('Lying Leg Curl', '{hamstrings}', null),
  ('Seated Calf Raise', '{calves}', null),
  ('Machine Hip Adduction', '{adductors}', null),
  ('Machine Crunch', '{core}', null),
  ('Machine Shrug', '{traps}', null),
  ('T Bar Row', '{back,upper back,biceps}', null),
  ('Machine Pullover', '{back,chest}', null),
  ('Machine Back Extension', '{lower back,glutes,hamstrings}', null),
  ('Reverse Hyperextension', '{glutes,hamstrings,lower back}', null),
  ('Machine Glute Kickback', '{glutes,hamstrings}', null),
  ('Smith Machine Shoulder Press', '{shoulders,triceps}', null),
  ('Smith Machine Row', '{back,upper back,biceps}', null),
  ('Belt Squat', '{quads,glutes}', null),
  ('V Squat', '{quads,glutes}', null),
  ('Reverse Hack Squat', '{glutes,quads,hamstrings}', null),
  ('Horizontal Leg Press', '{quads,glutes}', null),
  ('Standing Leg Curl', '{hamstrings}', null),
  ('Chest Supported T Bar Row', '{back,upper back,biceps}', null),
  ('Smith Machine Romanian Deadlift', '{hamstrings,glutes}', null),
  ('Smith Machine Calf Raise', '{calves}', null),
  ('Assisted Dip', '{chest,triceps}', null)
) as v(name, muscles, tier)
where not exists (
  select 1 from public.exercises e where e.created_by is null and lower(e.name) = lower(v.name)
);
