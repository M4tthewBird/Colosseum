-- Run once in the SQL editor on a project created before this change.
-- Lets the creator delete a gym, and removes the gyms left behind by the first test runs.
create policy "gyms delete" on public.gyms for delete to authenticated using (created_by = auth.uid());

delete from public.gyms where name like 'Test Gym %' or name = 'UI Test Gym';
