import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { getRoleRequirementStatus } from "./role-requirements";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const readMigration = (name: string) => readFileSync(new URL(name, migrations), "utf8");

// Synthetic tables and JWT claims; membership resolution and permission logic come from actual migrations.
const fixture = `
create role authenticated;
create role anon;
create table departments (id uuid primary key);
create table department_roles (id uuid primary key, department_id uuid references departments, name text, active boolean);
create table members (
  id uuid primary key default gen_random_uuid(), department_id uuid references departments,
  first_name text, last_name text, email text, phone text, rank text, role text, active boolean,
  special_permissions_enabled boolean, department_role_id uuid references department_roles,
  auth_user_id uuid
);
create table app_permissions (key text primary key, active boolean);
create table member_app_permissions (
  department_id uuid references departments, member_id uuid references members,
  permission_key text references app_permissions, created_by uuid references members,
  unique(department_id,member_id,permission_key)
);
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.email() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;
insert into departments values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into department_roles values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Firefighter',true),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Captain',true),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Foreign Captain',true),
 ('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Inactive Captain',false);
insert into members(id,department_id,first_name,last_name,role,active,auth_user_id) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Admin','Actor','Administrator',true,'90000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Standard','Actor','Firefighter',true,'90000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Admin','Actor','Administrator',true,'90000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','Standard','Actor','Administrator',true,'90000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','Inactive','Actor','Administrator',false,'90000000-0000-4000-8000-000000000003');
insert into app_permissions values ('training_management',true);
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
`;

const checks = `
create function test_force_role_failure() returns trigger language plpgsql as $$
begin
  if new.last_name='ForcedFailure' then
    if (select count(*) from member_app_permissions where member_id=new.id) <> 1 then
      raise exception 'Permission insert did not run before forced role failure';
    end if;
    raise exception 'FORCED_ROLE_ASSIGNMENT_FAILURE';
  end if;
  return new;
end $$;
create trigger force_role_failure before update of department_role_id on members
for each row execute function test_force_role_failure();
do $grants$
begin
  if has_function_privilege('anon','public.create_department_member_with_role(text,text,text,text,text,boolean,boolean,text[],date,date,uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Anonymous caller can execute wrapper';
  end if;
end $grants$;
set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
do $test$
declare v_id uuid; v_before integer; v_permissions integer; v_caught boolean := false;
begin
  v_id := create_department_member_with_role('Atomic','Success','atomic@example.invalid',null,null,true,true,
    array['training_management'],null,null,'30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
  if (select count(*) from members where id=v_id and department_role_id='30000000-0000-4000-8000-000000000001') <> 1
    then raise exception 'Success did not save exactly one member and role'; end if;
  if (select count(*) from member_app_permissions where member_id=v_id) <> 1
    then raise exception 'Permission row missing on success'; end if;
  raise notice 'PASS: one member plus selected role and permission saved';

  select count(*) into v_before from members;
  select count(*) into v_permissions from member_app_permissions;
  begin
    perform create_department_member_with_role('Atomic','ForcedFailure','failure@example.invalid',null,null,true,true,
      array['training_management'],null,null,'30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm <> 'FORCED_ROLE_ASSIGNMENT_FAILURE' then raise; end if;
    v_caught := true;
  end;
  if not v_caught then raise exception 'Forced failure did not execute'; end if;
  if (select count(*) from members) <> v_before or (select count(*) from member_app_permissions) <> v_permissions
    then raise exception 'PARTIAL MEMBER OR PERMISSION ROW SURVIVED ROLLBACK'; end if;
  if exists(select 1 from members where last_name='ForcedFailure')
    then raise exception 'Failed member survived'; end if;
  raise notice 'PASS: forced assignment failure rolled back member AND permission insert';

  perform update_department_member_role(v_id,'30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
  if (select department_role_id from members where id=v_id) <> '30000000-0000-4000-8000-000000000002'
    then raise exception 'Later role change failed'; end if;
  raise notice 'PASS: administrator can change the same saved role later';

  raise notice 'PASS: saved role remains editable independently of submission metadata';

  v_caught := false;
  begin
    perform create_department_member_with_role('Foreign','Target',null,null,null,true,false,
      array[]::text[],null,null,'30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm not like 'Validation error: select an active Department Role%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught or (select count(*) from members) <> v_before then raise exception 'Foreign assignment accepted'; end if;
  raise notice 'PASS: cross-department role rejected without writes';

  v_caught := false;
  begin
    perform create_department_member_with_role('Inactive','Target',null,null,null,true,false,
      array[]::text[],null,null,'30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm not like 'Validation error: select an active Department Role%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught then raise exception 'Inactive role accepted'; end if;
  raise notice 'PASS: inactive role rejected';

  perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',false);
  v_caught := false;
  begin
    perform create_department_member_with_role('Denied','Target',null,null,null,true,false,
      array[]::text[],null,null,'30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm not like 'Forbidden:%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught or (select count(*) from members) <> v_before then raise exception 'Unauthorized actor created member'; end if;
  raise notice 'PASS: unauthorized personnel manager rejected';

  perform set_config('request.jwt.claim.sub','',false);
  v_caught := false;
  begin
    perform create_department_member_with_role('Missing','Actor',null,null,null,true,false,
      array[]::text[],null,null,'30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm not like 'Unauthorized:%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught or (select count(*) from members) <> v_before then raise exception 'Missing requester created member'; end if;
  raise notice 'PASS: missing requester rejected and anonymous execute denied';
end $test$;
reset role;
`;

const multiDepartmentChecks = `
set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
do $multi$
declare
  v_department uuid;
  v_role uuid;
  v_id uuid;
  v_unassigned uuid;
  v_legacy_department uuid;
  v_caught boolean;
  v_before integer;
  v_role_before uuid;
begin
  select department_id into v_legacy_department from resolve_requesting_member_access_context();
  foreach v_department in array array[
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid
  ] loop
    v_role := case when v_department='10000000-0000-4000-8000-000000000001'
      then '30000000-0000-4000-8000-000000000001'::uuid
      else '30000000-0000-4000-8000-000000000003'::uuid end;
    v_id := create_department_member_with_role('Multi','Selected',null,null,null,true,true,
      array['training_management'],null,null,v_role,v_department);
    if not exists(select 1 from members where id=v_id and department_id=v_department and department_role_id=v_role)
      or not exists(select 1 from member_app_permissions where member_id=v_id and department_id=v_department
        and created_by=(select member_id from resolve_requesting_member_access_context(v_department))) then
      raise exception 'Selected role or permissions saved in wrong department';
    end if;
    v_unassigned := create_department_member_with_role('Multi','Unassigned',null,null,null,true,false,
      array[]::text[],null,null,null,v_department);
    if not exists(select 1 from members where id=v_unassigned and department_id=v_department and department_role_id is null) then
      raise exception 'Unassigned member saved in wrong department';
    end if;
    if v_department <> v_legacy_department then
      raise notice 'PASS: selected and Unassigned target the department opposite legacy resolver';
    end if;
    perform update_department_member(v_id,'Multi','Edited',null,null,null,true,true,
      array['training_management'],null,null,v_department);
    perform update_department_member_role(v_unassigned,v_role,v_department);
    if not exists(select 1 from members where id=v_id and last_name='Edited' and department_id=v_department)
      or not exists(select 1 from members where id=v_unassigned and department_role_id=v_role and department_id=v_department) then
      raise exception 'Explicit-context Edit did not persist';
    end if;
  end loop;
  raise notice 'PASS: real JWT membership and permissions target both departments for Add and Edit';

  select count(*) into v_before from members;
  select department_role_id into v_role_before from members where id=v_id;
  v_caught := false;
  begin
    perform update_department_member_role(v_id,null,
      case when v_department='10000000-0000-4000-8000-000000000001'
        then '10000000-0000-4000-8000-000000000002'::uuid
        else '10000000-0000-4000-8000-000000000001'::uuid end);
  exception when others then
    if sqlerrm not like 'Forbidden: target member%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught or (select department_role_id from members where id=v_id) is distinct from v_role_before then
    raise exception 'Cross-department Edit was accepted';
  end if;

  perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',false);
  v_caught := false;
  begin
    perform create_department_member_with_role('Wrong','Permission',null,null,null,true,false,
      array[]::text[],null,null,null,'10000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm not like 'Forbidden:%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught then raise exception 'Permission in another department leaked'; end if;

  perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
  v_caught := false;
  begin
    perform create_department_member_with_role('Inactive','Requester',null,null,null,true,false,
      array[]::text[],null,null,null,'10000000-0000-4000-8000-000000000002');
  exception when others then
    if sqlerrm not like 'Unauthorized:%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught then raise exception 'Inactive requester accepted'; end if;

  perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
  foreach v_department in array array[null::uuid, '10000000-0000-4000-8000-000000000099'::uuid] loop
    v_caught := false;
    begin
      perform create_department_member_with_role('Missing','Department',null,null,null,true,false,
        array[]::text[],null,null,null,v_department);
    exception when others then
      if sqlerrm not like 'Unauthorized:%' then raise; end if;
      v_caught := true;
    end;
    if not v_caught then raise exception 'Missing department accepted'; end if;
  end loop;
  if (select count(*) from members) <> v_before then raise exception 'Rejected request wrote member'; end if;
  raise notice 'PASS: foreign target, wrong-department permission, inactive membership and missing department rejected';

  perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',false);
  reset role;
  update members set special_permissions_enabled=true where id='20000000-0000-4000-8000-000000000002';
  insert into app_permissions values ('personnel_management',true);
  insert into member_app_permissions(department_id,member_id,permission_key,created_by) values
    ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','personnel_management','20000000-0000-4000-8000-000000000001');
  set role authenticated;
  perform create_department_member_with_role('Delegated','Manager',null,null,null,true,false,
    array[]::text[],null,null,null,'10000000-0000-4000-8000-000000000001');
  raise notice 'PASS: existing explicit personnel-management permission still authorizes onboarding';
end $multi$;
reset role;
`;

const retryChecks = `
set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
do $retry$
declare
  v_request uuid := gen_random_uuid();
  v_id uuid;
  v_retry uuid;
  v_other uuid;
  v_before integer;
  v_caught boolean := false;
begin
  select count(*) into v_before from members;
  v_id := create_department_member_with_role('Same','Person','shared@example.invalid',null,null,true,true,
    array['training_management'],null,null,'30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',v_request);
  v_retry := create_department_member_with_role('Same','Person','shared@example.invalid',null,null,true,true,
    array['training_management'],null,null,'30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',v_request);
  if v_retry <> v_id or (select count(*) from members) <> v_before+1
    or (select count(*) from member_app_permissions where member_id=v_id) <> 1 then
    raise exception 'Retry did not return original member without duplicate permission rows';
  end if;
  raise notice 'PASS: same request returns original ID with one member and permission row';
  v_other := create_department_member_with_role('Same','Person','shared@example.invalid',null,null,true,true,
    array['training_management'],null,null,'30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',gen_random_uuid());
  if v_other=v_id or (select count(*) from members) <> v_before+2 then
    raise exception 'Different requests incorrectly merged or rejected same name/email';
  end if;
  raise notice 'PASS: separate requests allow same name and shared email without merging';
  begin
    perform create_department_member_with_role('Changed','Person','shared@example.invalid',null,null,true,true,
      array['training_management'],null,null,'30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',v_request);
  exception when others then
    if sqlerrm not like 'This submission was already saved with different information%' then raise; end if;
    v_caught := true;
  end;
  if not v_caught or (select first_name from members where id=v_id) <> 'Same'
    or (select count(*) from members) <> v_before+2 then
    raise exception 'Changed retry mutated original or created duplicate';
  end if;
  raise notice 'PASS: changed information rejected without modifying original';
  v_other := create_department_member_with_role('Same','Person','shared@example.invalid',null,null,true,false,
    array[]::text[],null,null,null,'10000000-0000-4000-8000-000000000002',v_request);
  if v_other=v_id or not exists(select 1 from members where id=v_other
    and department_id='10000000-0000-4000-8000-000000000002') then
    raise exception 'Request metadata crossed departments';
  end if;
  raise notice 'PASS: identical UUID in separate departments is isolated';
end $retry$;
reset role;
`;

test("real PostgreSQL: atomic member/role creation and forced-failure rollback", { timeout: 120000 }, async () => {
  const name = `redline-atomic-${randomUUID()}`;
  function docker(args: string[], input?: string) {
    const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 60000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
    return result.stdout + result.stderr;
  }
  docker(["run", "--rm", "-d", "--name", name, "--network", "none", "--tmpfs", "/var/lib/postgresql/data",
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const probe = spawnSync("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { encoding: "utf8" });
      if (probe.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, "Isolated PostgreSQL did not become responsive");
    const foundation = readMigration("20260820060000_member_management_permissions_foundation.sql");
    const roleFunction = foundation.match(/create or replace function public\.update_department_member_role\([\s\S]*?grant execute on function public\.update_department_member_role\(uuid, uuid\) to authenticated;/)?.[0];
    assert.ok(roleFunction);
    const baseMemberFunctions = foundation.slice(foundation.indexOf("create or replace function public.create_department_member("));
    const realAuthorization = foundation.slice(
      foundation.indexOf("create or replace function public.resolve_requesting_member_access_context()"),
      foundation.indexOf("alter table public.app_permissions enable row level security;"),
    );
    const sql = fixture
      + realAuthorization
      + readMigration("20261023120000_fix_member_permission_department_resolution.sql")
      + baseMemberFunctions
      + readMigration("20260826143000_add_member_service_dates_and_status_rules.sql")
      + readMigration("20261104090000_allow_unassigned_legacy_member_rank.sql")
      + roleFunction
      + readMigration("20261104210000_create_department_member_with_role.sql")
      + (checks + multiDepartmentChecks).replace(
        /((?:perform|:=)\s+create_department_member_with_role\([\s\S]*?)\);/g,
        "$1,gen_random_uuid());",
      )
      + retryChecks;
    const output = docker(["exec", "-i", name, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], sql);
    assert.ok(output.includes("forced assignment failure rolled back member AND permission insert"));
    assert.equal((output.match(/PASS:/g) ?? []).length, 16);
    console.log(output.split("\n").filter(line => line.includes("PASS:")).join("\n"));

    const savedRole = docker(["exec", name, "psql", "-X", "-U", "postgres", "-Atqc",
      "select department_role_id from members where last_name='Success'"]).trim();
    const requirements = getRoleRequirementStatus({
      memberDepartmentRoleId: savedRole,
      certificationTypes: [
        { id: "captain-cert", name: "Captain Credential", active: true },
        { id: "firefighter-cert", name: "Firefighter Credential", active: true },
      ],
      qualificationTypes: [],
      memberCertifications: [{ certification_id: "firefighter-cert", expires_at: null }],
      memberQualifications: [],
      roleRequiredCertifications: [
        { department_role_id: "30000000-0000-4000-8000-000000000001", certification_id: "firefighter-cert" },
        { department_role_id: "30000000-0000-4000-8000-000000000002", certification_id: "captain-cert" },
      ], roleRequiredQualifications: [],
    });
    assert.equal(requirements.kind, "missing");
    assert.equal(requirements.missingCount, 1, "Readiness must use the actual saved Captain role, not Firefighter");

    function execute(sql: string, onOutput?: (output: string) => void) {
      const process = spawn("docker", ["exec", "-i", name, "psql", "-X", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"]);
      let output = "";
      process.stdout.on("data", chunk => { output += chunk; onOutput?.(output); });
      process.stderr.on("data", chunk => { output += chunk; });
      const done = new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        process.on("error", reject);
        process.on("close", code => resolve({ code, output }));
      });
      process.stdin.end(sql);
      return done;
    }
    const create = "select create_department_member_with_role('Concurrent','Retry','concurrent@example.invalid',null,null,true,false,array[]::text[],null,null,'30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001');";
    let startSecond: () => void = () => {};
    const firstCreated = new Promise<void>(resolve => { startSecond = resolve; });
    const first = execute(`begin; set role authenticated; select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false); ${create} select 'FIRST_CREATED'; select pg_sleep(3); commit;`,
      output => { if (output.includes("FIRST_CREATED")) startSecond(); });
    await Promise.race([firstCreated, first.then(() => { throw new Error("First concurrent insert failed before barrier"); })]);
    const second = execute(`set role authenticated; select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false); ${create}`);
    let blocked = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (docker(["exec", name, "psql", "-X", "-U", "postgres", "-Atqc",
        "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and wait_event='advisory')"]).trim() === "t") {
        blocked = true; break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const results = await Promise.all([first, second]);
    assert.ok(blocked, "Concurrent retry must wait on the transaction advisory lock");
    assert.equal(results[0].code, 0, results[0].output);
    assert.equal(results[1].code, 0, results[1].output);
    const firstId = results[0].output.match(/^[0-9a-f-]{36}$/m)?.[0];
    const secondId = results[1].output.match(/^[0-9a-f-]{36}$/m)?.[0];
    // Ignore the preceding JWT-subject set_config result.
    const returnedIds = results.map(result => result.output.match(/^[0-9a-f-]{36}$/gm)?.at(-1));
    assert.ok(firstId && secondId && returnedIds[0]);
    assert.equal(returnedIds[0], returnedIds[1]);
    assert.equal(docker(["exec", name, "psql", "-X", "-U", "postgres", "-Atqc",
      "select count(*) from members where last_name='Retry'"]).trim(), "1");
    console.log("PASS: concurrent retry returns original ID; exactly one member remains");
  } finally {
    docker(["rm", "-f", name]);
  }
});
