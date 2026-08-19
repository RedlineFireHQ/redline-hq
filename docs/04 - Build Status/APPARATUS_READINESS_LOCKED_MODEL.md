# Apparatus Readiness Locked Model

Version: 2026-08-18

Source of Truth: Redline HQ Apparatus Readiness Bible PDF (external human-readable reference)

## Scope

This document defines the locked Apparatus Readiness model implemented in code. It is authoritative for developers and administrators configuring readiness behavior.

This model is distinct from My Readiness.

- Apparatus Readiness evaluates current operational state of an apparatus.
- My Readiness evaluates firefighter personal readiness and assigned-deficiency responsibility.
- My Readiness scoring and personal deficiency age matrix are not used here.

## Locked Bucket Weights

Total score is 100% and uses four weighted buckets:

- Apparatus Checks: 20%
- Apparatus Condition / Safety: 40%
- Maintenance / Service: 20%
- Required Equipment: 20%

## Safety Precedence (OOS Gate)

Numerical score does not override safety status.

Out of Service is triggered by any of the following:

- Apparatus explicitly marked Out of Service
- Active Critical condition in Condition / Safety
- Critical required equipment missing or unusable

When OOS gate is true, readiness status is Out of Service even if numerical score is high.

## Deficiency Priority Mapping (Apparatus Condition / Safety only)

Locked mapping for apparatus-level condition scoring:

- Low -> Minor -> -1
- Medium -> Significant -> -5
- High -> Significant -> -5
- Critical -> Critical/OOS -> -40 and OOS gate

This mapping is local to apparatus readiness calculations.

It does not alter:

- Deficiency data taxonomy itself
- My Readiness formula
- personal deficiency age matrix

## Apparatus Checks Bucket (20)

Terminology: Apparatus Check

The due date is calculated as:

- next due = last completed Apparatus Check + configured interval

Configuration is department/apparatus specific and must not assume daily checks.

Cadence semantics are locked as:

- interval_days defines department-specific cadence (daily, weekly, monthly, or other positive interval).
- interval_days = 1 uses the Daily profile.
- interval_days >= 30 uses the Extended/Monthly profile.
- interval_days 2..29 uses a deterministic scaled custom profile.
- No department can configure the penalty curve itself.

Scoring profile behavior:

Daily profile:

- Current: 20
- Due today and not completed: 15
- 1 day overdue: 10
- 2 days overdue: 5
- 3+ days overdue: 0

Monthly profile:

- Current: 20
- Due today and not completed: 10
- 1 day overdue: 5
- 2+ days overdue: 0

Scaled custom profile (interval_days 2..29):

- Current: 20
- Due today and not completed: 15
- Overdue at ~25% of one full interval: 10
- Overdue at ~50% of one full interval: 5
- Overdue at 100% of one full interval: 0

Deterministic boundaries (approved clarification of locked model implementation):

- proportional boundaries use nearest-integer rounding.
- quarter boundary = round(interval_days * 0.25)
- half boundary = round(interval_days * 0.50)
- quarter boundary is clamped to at least 1 day.
- half boundary is clamped to at least quarter + 1 day.
- full boundary = interval_days

Examples produced by this deterministic model:

- 7-day: due=15, +2=10, +4=5, +7=0
- 14-day: due=15, +4=10, +7=5, +14=0
- 21-day: due=15, +5=10, +11=5, +21=0

Configuration hierarchy for Apparatus Check cadence:

- apparatus-specific active override in apparatus_check_requirements
- otherwise active department default in apparatus_check_department_defaults
- otherwise configuration required (not scored)

Configuration governance:

- readiness configuration is effective-dated (effective_start_at / effective_end_at)
- readiness configuration keeps audit metadata (created_by/updated_by, created_at/updated_at)
- historical records are preserved by ending prior effective windows rather than deleting history

## Condition / Safety Bucket (40)

Base score is 40 and active deductions stack.

- Minor: -1 each
- Significant: -5 each
- Critical/OOS: -40 each and OOS gate

Bucket floor is 0.

Example:

- Critical plus five Minor -> 40 - 40 - 5 = 0
- Critical resolved, five Minor remain -> 40 - 5 = 35

Resolving a Critical issue does not automatically restore 100% when other active conditions remain.

## Maintenance / Service Bucket (20)

A maintenance requirement can use one or more methods:

- time-based
- mileage-based
- engine-hours-based
- multiple methods (whichever comes first)

Each method is configured with:

- interval value
- due soon threshold
- early overdue threshold
- moderate overdue threshold

Method state progression:

- Current
- Due Soon
- Due
- Early Overdue
- Moderately Overdue
- Severely Overdue

Requirement state uses worst method state (whichever comes first).

Bucket score mapping:

- Current: 20
- Due Soon: 19
- Due: 17
- Early Overdue: 15
- Moderately Overdue: 10
- Severely Overdue: 0

Maintenance history in maintenance_records remains historical evidence and is not replaced.

## Required Equipment Bucket (20)

Requirements are apparatus-specific and classify equipment as:

- required vs optional
- critical vs non-critical

Only required equipment affects score.

Optional equipment has no penalty and no bonus.

For non-critical required items:

score = (operational non-critical required items / total non-critical required items) * 20

Operational means available for use.

- Present but deficient does not count operational.
- Missing or unusable does not count operational.

Critical required equipment missing or unusable triggers OOS gate.

## Double-Counting Protection

The implementation applies explicit protections:

- Condition/Safety uses active deficiencies.
- Required Equipment also uses operational/deficiency state.
- Critical always wins: an active Critical deficiency is always counted in Condition/Safety even when linked to required equipment.
- Non-critical deficiency tied to required equipment is counted in Required Equipment and excluded from Condition/Safety to avoid double deduction.
- Maintenance scoring is schedule/interval based and does not apply additional deficiency-severity deductions.
- Apparatus Checks scoring uses cadence completion timing only.

If data is missing for reliable cross-bucket attribution, the engine emits configuration/data gaps and marks score as not scored where required buckets cannot be evaluated safely.

## Department Integrity Rules (Locked)

Readiness configuration rows are department-owned and must align to apparatus ownership.

- apparatus_check_requirements (apparatus_id, department_id) must match apparatus (id, department_id).
- apparatus_maintenance_requirements (apparatus_id, department_id) must match apparatus (id, department_id).
- apparatus_equipment_requirements (apparatus_id, department_id) must match apparatus (id, department_id).
- apparatus_maintenance_requirement_methods (apparatus_maintenance_requirement_id, department_id) must match parent requirement (id, department_id).

These constraints prevent cross-department mismatches while preserving department-scoped RLS.

## Equipment Reference Integrity (Locked)

apparatus_equipment_requirements uses polymorphic equipment_source + equipment_id.

- A single SQL foreign key cannot cover all source tables.
- A write-time validation trigger enforces existence of equipment_id in the source table selected by equipment_source.
- Invalid source/id combinations are rejected.

## Data Model Added For Locked Apparatus Readiness

Migration adds/extends:

- apparatus_check_requirements
- apparatus_check_department_defaults
- apparatus_maintenance_requirements
- apparatus_maintenance_requirement_methods
- apparatus_equipment_requirements
- apparatus.mileage, apparatus.engine_hours, apparatus.check_frequency
- apparatus_inspections.mileage, apparatus_inspections.engine_hours
- updated save_apparatus_inspection function signature to accept optional mileage and engine hours

## Runtime Calculation Shape

Single shared engine:

- lib/readiness/apparatus-readiness.ts

Data normalization layer:

- lib/readiness/apparatus-readiness-data.ts

UI integration targets:

- app/apparatus/[id]/page.tsx
- app/apparatus/page.tsx
- components/command-center-v3/ApparatusPanel.tsx
- components/command-center-v3/TodaysReadinessPanel.tsx

## Test Expectations

Focused tests cover locked scenarios:

- Perfect 100%
- Check current and overdue progression
- Minor/Significant/Critical condition impacts
- Critical resolved with remaining minors
- Maintenance due soon/due/severe
- Non-critical required equipment impact
- Critical required equipment OOS
- Multiple active deficiencies
- Multiple maintenance methods (whichever first)
- Optional equipment excluded
- Score clamped to [0, 100]
- Double-counting protection across condition/equipment

Test file:

- lib/readiness/apparatus-readiness.test.ts
