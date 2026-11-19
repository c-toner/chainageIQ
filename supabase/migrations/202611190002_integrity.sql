create function public.project_owner_membership() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin insert into project_memberships(project_id,organisation_id,user_id,role)values(new.id,new.organisation_id,auth.uid(),'admin');return new;end $$;
create trigger project_owner after insert on public.projects for each row execute function public.project_owner_membership();
create function public.validate_quality_record() returns trigger language plpgsql set search_path=public,pg_temp as $$ declare response jsonb;begin if TG_TABLE_NAME='corrective_actions' then if new.assignee_id is not null and not exists(select 1 from project_memberships where project_id=new.project_id and user_id=new.assignee_id) then raise exception 'Assignee must belong to this project';end if;end if;if TG_TABLE_NAME='inspections' then for response in select * from jsonb_array_elements(new.responses) loop if not(response ?& array['question','result','note']) or length(trim(response->>'question'))<1 or response->>'result' not in ('pass','fail','na') then raise exception 'Invalid checklist response';end if;end loop;end if;return new;end $$;
create trigger quality_action before insert or update on public.corrective_actions for each row execute function public.validate_quality_record();
create trigger quality_inspection before insert or update on public.inspections for each row execute function public.validate_quality_record();
revoke execute on function public.project_owner_membership(),public.validate_quality_record() from public,anon,authenticated;
-- Seeders/scanners are trusted operations. Normal users cannot update audit, history, evidence verdicts or approvals.

revoke create on schema public from public,anon,authenticated;
