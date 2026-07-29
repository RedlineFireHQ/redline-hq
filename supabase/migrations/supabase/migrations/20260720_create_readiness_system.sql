-- ==========================================
-- Redline HQ Readiness System
-- ==========================================

create table if not exists readiness_checks (
    id uuid primary key default gen_random_uuid(),

    department_id uuid not null references departments(id),
    apparatus_id uuid not null references apparatus(id),
    completed_by uuid not null references members(id),

    status text not null check (
        status in (
            'ready',
            'needs_attention',
            'out_of_service'
        )
    ),

    engine_hours integer,
    notes text,

    created_at timestamptz not null default now()
);

create table if not exists readiness_issues (
    id uuid primary key default gen_random_uuid(),

    readiness_check_id uuid
        references readiness_checks(id)
        on delete cascade,

    department_id uuid not null references departments(id),
    apparatus_id uuid not null references apparatus(id),

    category text not null,

    severity text not null check (
        severity in (
            'needs_attention',
            'out_of_service'
        )
    ),

    description text not null,

    status text not null default 'open' check (
        status in (
            'open',
            'acknowledged',
            'repairing',
            'resolved',
            'closed'
        )
    ),

    reported_by uuid references members(id),
    assigned_to uuid references members(id),

    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

create table if not exists issue_photos (
    id uuid primary key default gen_random_uuid(),

    issue_id uuid not null
        references readiness_issues(id)
        on delete cascade,

    storage_path text not null,

    uploaded_by uuid references members(id),

    created_at timestamptz not null default now()
);

create table if not exists issue_activity (
    id uuid primary key default gen_random_uuid(),

    issue_id uuid not null
        references readiness_issues(id)
        on delete cascade,

    member_id uuid references members(id),

    activity text not null,

    created_at timestamptz not null default now()
);

create index if not exists idx_readiness_checks_apparatus
on readiness_checks(apparatus_id);

create index if not exists idx_readiness_issues_status
on readiness_issues(status);

create index if not exists idx_issue_activity_issue
on issue_activity(issue_id);