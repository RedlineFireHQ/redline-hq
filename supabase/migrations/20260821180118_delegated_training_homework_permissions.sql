drop policy if exists training_events_insert_by_department_role on public.training_events;
create policy training_events_insert_by_department_role
on public.training_events
for insert
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_events.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_events.department_id, 'training_management')
	)
	and (
		training_events.category_id is null
		or exists (
			select 1
			from public.training_categories c
			where c.id = training_events.category_id
				and c.department_id = training_events.department_id
		)
	)
	and (
		training_events.supporting_document_id is null
		or exists (
			select 1
			from public.documents d
			where d.id = training_events.supporting_document_id
				and d.department_id = training_events.department_id
		)
	)
	and (
		training_events.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_events.created_by
				and creator.department_id = training_events.department_id
		)
	)
	and (
		training_events.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_events.updated_by
				and updater.department_id = training_events.department_id
		)
	)
);

drop policy if exists training_events_update_by_department_role on public.training_events;
create policy training_events_update_by_department_role
on public.training_events
for update
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_events.department_id
			and lower(coalesce(m.role, '')) in ('administrator', 'officer')
	)
	or public.member_has_app_permission(training_events.department_id, 'training_management')
)
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_events.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_events.department_id, 'training_management')
	)
	and (
		training_events.category_id is null
		or exists (
			select 1
			from public.training_categories c
			where c.id = training_events.category_id
				and c.department_id = training_events.department_id
		)
	)
	and (
		training_events.supporting_document_id is null
		or exists (
			select 1
			from public.documents d
			where d.id = training_events.supporting_document_id
				and d.department_id = training_events.department_id
		)
	)
	and (
		training_events.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_events.created_by
				and creator.department_id = training_events.department_id
		)
	)
	and (
		training_events.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_events.updated_by
				and updater.department_id = training_events.department_id
		)
	)
);

drop policy if exists training_event_attendance_select_self_or_role on public.training_event_attendance;
create policy training_event_attendance_select_self_or_role
on public.training_event_attendance
for select
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_event_attendance.department_id
			and (
				m.id = training_event_attendance.member_id
				or lower(coalesce(m.role, '')) in ('administrator', 'officer')
				or public.member_has_app_permission(training_event_attendance.department_id, 'training_management')
			)
	)
);

drop policy if exists training_event_attendance_insert_by_department_role on public.training_event_attendance;
create policy training_event_attendance_insert_by_department_role
on public.training_event_attendance
for insert
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_event_attendance.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_event_attendance.department_id, 'training_management')
	)
	and exists (
		select 1
		from public.training_events e
		where e.id = training_event_attendance.training_event_id
			and e.department_id = training_event_attendance.department_id
	)
	and exists (
		select 1
		from public.members target_member
		where target_member.id = training_event_attendance.member_id
			and target_member.department_id = training_event_attendance.department_id
	)
	and (
		training_event_attendance.recorded_by is null
		or exists (
			select 1
			from public.members recorder
			where recorder.id = training_event_attendance.recorded_by
				and recorder.department_id = training_event_attendance.department_id
		)
	)
	and (
		training_event_attendance.reviewed_by is null
		or exists (
			select 1
			from public.members reviewer
			where reviewer.id = training_event_attendance.reviewed_by
				and reviewer.department_id = training_event_attendance.department_id
		)
	)
);

drop policy if exists training_event_attendance_update_by_department_role on public.training_event_attendance;
create policy training_event_attendance_update_by_department_role
on public.training_event_attendance
for update
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_event_attendance.department_id
			and lower(coalesce(m.role, '')) in ('administrator', 'officer')
	)
	or public.member_has_app_permission(training_event_attendance.department_id, 'training_management')
)
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_event_attendance.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_event_attendance.department_id, 'training_management')
	)
	and exists (
		select 1
		from public.training_events e
		where e.id = training_event_attendance.training_event_id
			and e.department_id = training_event_attendance.department_id
	)
	and exists (
		select 1
		from public.members target_member
		where target_member.id = training_event_attendance.member_id
			and target_member.department_id = training_event_attendance.department_id
	)
	and (
		training_event_attendance.recorded_by is null
		or exists (
			select 1
			from public.members recorder
			where recorder.id = training_event_attendance.recorded_by
				and recorder.department_id = training_event_attendance.department_id
		)
	)
	and (
		training_event_attendance.reviewed_by is null
		or exists (
			select 1
			from public.members reviewer
			where reviewer.id = training_event_attendance.reviewed_by
				and reviewer.department_id = training_event_attendance.department_id
		)
	)
);

drop policy if exists training_assignments_insert_by_department_role on public.training_assignments;
create policy training_assignments_insert_by_department_role
on public.training_assignments
for insert
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_assignments.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_assignments.department_id, 'training_management')
		or public.member_has_app_permission(training_assignments.department_id, 'homework_assignment')
	)
	and (
		training_assignments.category_id is null
		or exists (
			select 1
			from public.training_categories c
			where c.id = training_assignments.category_id
				and c.department_id = training_assignments.department_id
		)
	)
	and (
		training_assignments.supporting_document_id is null
		or exists (
			select 1
			from public.documents d
			where d.id = training_assignments.supporting_document_id
				and d.department_id = training_assignments.department_id
		)
	)
	and (
		training_assignments.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_assignments.created_by
				and creator.department_id = training_assignments.department_id
		)
	)
	and (
		training_assignments.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_assignments.updated_by
				and updater.department_id = training_assignments.department_id
		)
	)
);

drop policy if exists training_assignments_update_by_department_role on public.training_assignments;
create policy training_assignments_update_by_department_role
on public.training_assignments
for update
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_assignments.department_id
			and lower(coalesce(m.role, '')) in ('administrator', 'officer')
	)
	or public.member_has_app_permission(training_assignments.department_id, 'training_management')
	or public.member_has_app_permission(training_assignments.department_id, 'homework_assignment')
)
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_assignments.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_assignments.department_id, 'training_management')
		or public.member_has_app_permission(training_assignments.department_id, 'homework_assignment')
	)
	and (
		training_assignments.category_id is null
		or exists (
			select 1
			from public.training_categories c
			where c.id = training_assignments.category_id
				and c.department_id = training_assignments.department_id
		)
	)
	and (
		training_assignments.supporting_document_id is null
		or exists (
			select 1
			from public.documents d
			where d.id = training_assignments.supporting_document_id
				and d.department_id = training_assignments.department_id
		)
	)
	and (
		training_assignments.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_assignments.created_by
				and creator.department_id = training_assignments.department_id
		)
	)
	and (
		training_assignments.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_assignments.updated_by
				and updater.department_id = training_assignments.department_id
		)
	)
);

drop policy if exists training_assignment_members_select_self_or_role on public.training_assignment_members;
create policy training_assignment_members_select_self_or_role
on public.training_assignment_members
for select
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_assignment_members.department_id
			and (
				m.id = training_assignment_members.member_id
				or lower(coalesce(m.role, '')) in ('administrator', 'officer')
				or public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
				or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
				or public.member_has_app_permission(training_assignment_members.department_id, 'training_review')
			)
	)
);

drop policy if exists training_assignment_members_insert_by_department_role on public.training_assignment_members;
create policy training_assignment_members_insert_by_department_role
on public.training_assignment_members
for insert
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_assignment_members.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
		or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
	)
	and exists (
		select 1
		from public.training_assignments a
		where a.id = training_assignment_members.training_assignment_id
			and a.department_id = training_assignment_members.department_id
	)
	and exists (
		select 1
		from public.members target_member
		where target_member.id = training_assignment_members.member_id
			and target_member.department_id = training_assignment_members.department_id
	)
	and (
		training_assignment_members.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_assignment_members.created_by
				and creator.department_id = training_assignment_members.department_id
		)
	)
	and (
		training_assignment_members.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_assignment_members.updated_by
				and updater.department_id = training_assignment_members.department_id
		)
	)
	and (
		training_assignment_members.reviewed_by is null
		or exists (
			select 1
			from public.members reviewer
			where reviewer.id = training_assignment_members.reviewed_by
				and reviewer.department_id = training_assignment_members.department_id
		)
	)
);

drop policy if exists training_assignment_members_update_by_department_role on public.training_assignment_members;
create policy training_assignment_members_update_by_department_role
on public.training_assignment_members
for update
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_assignment_members.department_id
			and lower(coalesce(m.role, '')) in ('administrator', 'officer')
	)
	or public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
	or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
	or public.member_has_app_permission(training_assignment_members.department_id, 'training_review')
)
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_assignment_members.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
		or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
		or public.member_has_app_permission(training_assignment_members.department_id, 'training_review')
	)
	and exists (
		select 1
		from public.training_assignments a
		where a.id = training_assignment_members.training_assignment_id
			and a.department_id = training_assignment_members.department_id
	)
	and exists (
		select 1
		from public.members target_member
		where target_member.id = training_assignment_members.member_id
			and target_member.department_id = training_assignment_members.department_id
	)
	and (
		training_assignment_members.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_assignment_members.created_by
				and creator.department_id = training_assignment_members.department_id
		)
	)
	and (
		training_assignment_members.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_assignment_members.updated_by
				and updater.department_id = training_assignment_members.department_id
		)
	)
	and (
		training_assignment_members.reviewed_by is null
		or exists (
			select 1
			from public.members reviewer
			where reviewer.id = training_assignment_members.reviewed_by
				and reviewer.department_id = training_assignment_members.department_id
		)
	)
);

drop policy if exists training_outside_submissions_select_self_or_role on public.training_outside_submissions;
create policy training_outside_submissions_select_self_or_role
on public.training_outside_submissions
for select
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_outside_submissions.department_id
			and (
				m.id = training_outside_submissions.member_id
				or lower(coalesce(m.role, '')) in ('administrator', 'officer')
				or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
				or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
			)
	)
);

drop policy if exists training_outside_submissions_insert_by_self_or_role on public.training_outside_submissions;
create policy training_outside_submissions_insert_by_self_or_role
on public.training_outside_submissions
for insert
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_outside_submissions.department_id
				and (
					m.id = training_outside_submissions.member_id
					or lower(coalesce(m.role, '')) in ('administrator', 'officer')
				)
		)
		or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
		or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
	)
	and (
		training_outside_submissions.category_id is null
		or exists (
			select 1
			from public.training_categories c
			where c.id = training_outside_submissions.category_id
				and c.department_id = training_outside_submissions.department_id
		)
	)
	and (
		training_outside_submissions.reviewed_by is null
		or exists (
			select 1
			from public.members reviewer
			where reviewer.id = training_outside_submissions.reviewed_by
				and reviewer.department_id = training_outside_submissions.department_id
				and (
					lower(coalesce(reviewer.role, '')) in ('administrator', 'officer')
					or (
						coalesce(reviewer.special_permissions_enabled, false) = true
						and exists (
							select 1
							from public.member_app_permissions map
							where map.department_id = training_outside_submissions.department_id
								and map.member_id = reviewer.id
								and map.permission_key in ('training_management', 'training_review')
						)
					)
				)
		)
	)
	and (
		training_outside_submissions.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_outside_submissions.created_by
				and creator.department_id = training_outside_submissions.department_id
		)
	)
	and (
		training_outside_submissions.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_outside_submissions.updated_by
				and updater.department_id = training_outside_submissions.department_id
		)
	)
);

drop policy if exists training_outside_submissions_update_by_department_role on public.training_outside_submissions;
create policy training_outside_submissions_update_by_department_role
on public.training_outside_submissions
for update
using (
	exists (
		select 1
		from public.members m
		where lower(m.email) = lower(coalesce(auth.email(), ''))
			and m.department_id = training_outside_submissions.department_id
			and lower(coalesce(m.role, '')) in ('administrator', 'officer')
	)
	or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
	or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
)
with check (
	(
		exists (
			select 1
			from public.members m
			where lower(m.email) = lower(coalesce(auth.email(), ''))
				and m.department_id = training_outside_submissions.department_id
				and lower(coalesce(m.role, '')) in ('administrator', 'officer')
		)
		or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
		or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
	)
	and (
		training_outside_submissions.category_id is null
		or exists (
			select 1
			from public.training_categories c
			where c.id = training_outside_submissions.category_id
				and c.department_id = training_outside_submissions.department_id
		)
	)
	and (
		training_outside_submissions.reviewed_by is null
		or exists (
			select 1
			from public.members reviewer
			where reviewer.id = training_outside_submissions.reviewed_by
				and reviewer.department_id = training_outside_submissions.department_id
				and (
					lower(coalesce(reviewer.role, '')) in ('administrator', 'officer')
					or (
						coalesce(reviewer.special_permissions_enabled, false) = true
						and exists (
							select 1
							from public.member_app_permissions map
							where map.department_id = training_outside_submissions.department_id
								and map.member_id = reviewer.id
								and map.permission_key in ('training_management', 'training_review')
						)
					)
				)
		)
	)
	and (
		training_outside_submissions.created_by is null
		or exists (
			select 1
			from public.members creator
			where creator.id = training_outside_submissions.created_by
				and creator.department_id = training_outside_submissions.department_id
		)
	)
	and (
		training_outside_submissions.updated_by is null
		or exists (
			select 1
			from public.members updater
			where updater.id = training_outside_submissions.updated_by
				and updater.department_id = training_outside_submissions.department_id
		)
	)
);
