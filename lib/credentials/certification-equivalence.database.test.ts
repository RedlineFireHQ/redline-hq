import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import type { CertificationCatalogRow } from "./facade";
import { certificationDisplayName } from "./canonical-certifications";
import { verifyCertificationReports } from "./certification-report-test-helper";

const migrations = new URL("../../supabase/migrations/", import.meta.url);
const migration = (name: string) => readFileSync(new URL(name, migrations), "utf8");
const redOak = "82f50d14-216a-4dd1-80f4-58459dc97b97";
const standard = "60f6f89f-b2ff-4ac3-9e08-5b246f612e9a";
const foreignDept = "10000000-0000-4000-8000-000000000002";
const actor = "20000000-0000-4000-8000-000000000001";
const subject = "90000000-0000-4000-8000-000000000001";
const quote = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
type Snapshot = {
  departments: Array<{ id: string }>;
  members: Array<{ id: string; department_id: string }>;
  department_roles: Array<Record<string, unknown>>;
  certifications: Array<Record<string, unknown>>;
  member_certifications: Array<{ id: string; department_id: string; member_id: string; certification_id: string; supporting_document_id: string | null }>;
  role_required_certifications: Array<Record<string, unknown>>;
};

const base = `
create role authenticated; create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.email() returns text language sql stable as $$
 select nullif(current_setting('request.jwt.claim.email',true),'') $$;
create table departments(id uuid primary key);
create table members(id uuid primary key,department_id uuid references departments,
 email text,role text,active boolean,auth_user_id uuid,special_permissions_enabled boolean);
create table department_roles(id uuid primary key,department_id uuid,name text,code text,active boolean,sort_order integer);
create table documents(id uuid primary key,department_id uuid);
create table member_app_permissions(department_id uuid,member_id uuid,permission_key text);
create table auth_user_department_memberships(auth_user_id uuid,department_id uuid,can_manage_personnel boolean);
create table member_qualifications(id uuid,department_id uuid,member_id uuid);
create table certifications(id uuid primary key default gen_random_uuid(),
 department_id uuid references departments,name text,created_at timestamptz not null default now(),
 ems_authority text,ems_certification_level text);
create table role_required_certifications(id uuid primary key,department_id uuid,
 department_role_id uuid references department_roles,certification_id uuid references certifications,
 notes text,created_at timestamptz,updated_at timestamptz,created_by uuid,updated_by uuid);
`;

const authorization = migration("20260912250000_personnel_management_profile_read_access.sql");
const readPolicy = authorization.slice(0, authorization.indexOf("drop policy if exists member_qualifications"));
const foundation = migration("20260814020000_create_certification_foundation.sql");
const permission = migration("20261023120000_fix_member_permission_department_resolution.sql");
const schema = migration("20261104220000_department_certification_equivalence.sql");
const configuration = migration("20261104221000_red_oak_standard_certifications.sql");

type SqlSession = {
  result: Promise<{ status: number | null; stdout: string; stderr: string }>;
  send: (text: string) => void;
  finish: (text?: string) => void;
};

async function withDatabase(run: (
  sql: (text: string) => string,
  startSession: (text: string) => SqlSession,
) => void | Promise<void>) {
  const name = `redline-certification-test-${randomUUID()}`;
  function docker(args: string[], input?: string) {
    const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
    return result.stdout;
  }
  docker(["run", "--pull=never", "--name", name, "--network", "none", "--tmpfs", "/var/lib/postgresql/data",
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-d", "postgres:17"]);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const result = spawnSync("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { encoding: "utf8" });
      if (result.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Isolated PostgreSQL must be responsive");
    const sql = (text: string) => docker(["exec", "-i", name, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres", "-At",
      "-v", "ON_ERROR_STOP=1", "-q"], text);
    const startSession = (text: string): SqlSession => {
      const child = spawn("docker", ["exec", "-i", name, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres", "-At",
        "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-q"]);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk.toString(); });
      child.stderr.on("data", chunk => { stderr += chunk.toString(); });
      const result = new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", status => resolve({ status, stdout, stderr }));
      });
      child.stdin.write(`set statement_timeout = '10s'; ${text}\n`);
      return {
        result,
        send: command => { child.stdin.write(`${command}\n`); },
        finish: command => { child.stdin.end(command ? `${command}\n` : ""); },
      };
    };
    sql(base + foundation + permission + readPolicy
      + migration("20260912213000_align_certification_management_permissions.sql")
      + `drop policy certifications_select_by_department on certifications;
      create policy certifications_select_by_department on certifications for select using (
        exists(select 1 from members m where m.department_id=certifications.department_id and m.auth_user_id=auth.uid()));
      grant usage on schema public,auth to authenticated;
      grant select,insert,update,delete on all tables in schema public to authenticated;`);
    await run(sql, startSession);
  } finally {
    docker(["rm", "-f", name]);
  }
}

test("mapping constraints, metadata RLS, historical editing and atomic rollback on isolated PostgreSQL", async () => {
  await withDatabase(sql => {
    sql(`insert into departments values ('${redOak}'),('${foreignDept}');
      insert into members values ('${actor}','${redOak}','actor@example.invalid','Administrator',true,'${subject}',false);
      insert into certifications(id,department_id,name) values
        ('${standard}','${redOak}','Firefighter 1'),
        ('30000000-0000-4000-8000-000000000001','${redOak}','Historical exact label'),
        ('30000000-0000-4000-8000-000000000002','${redOak}','Another standard'),
        ('30000000-0000-4000-8000-000000000003','${foreignDept}','Foreign type');
      insert into member_certifications(id,department_id,member_id,certification_id,issued_at)
        values ('40000000-0000-4000-8000-000000000001','${redOak}','${actor}',
          '30000000-0000-4000-8000-000000000001','2008-01-02');`);
    sql("begin;" + schema + "commit;");
    sql(`update certifications set canonical_certification_id='${standard}'
      where id='30000000-0000-4000-8000-000000000001';
      create function expect_mapping_failure(id uuid,target uuid) returns void language plpgsql as $$
      begin
        begin
          update certifications set canonical_certification_id=target where certifications.id=expect_mapping_failure.id;
        exception when check_violation or foreign_key_violation or raise_exception then return;
        end;
        raise exception 'INVALID MAPPING ACCEPTED';
      end $$;
      select expect_mapping_failure('${standard}','30000000-0000-4000-8000-000000000001');
      select expect_mapping_failure('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
      select expect_mapping_failure('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003');
      select expect_mapping_failure('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
      do $$ begin
        begin update certifications set ems_authority='iowa' where id='${standard}';
        exception when raise_exception then return; end;
        raise exception 'MAPPED ROOT BECAME EMS';
      end $$;`);
    const before = sql("select to_jsonb(mc) from member_certifications mc order by id;").trim();
    const call = (detail: string) => `select save_member_certification_with_details('${redOak}','${actor}',
      '40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
      null,'2008-01-02',null,null,null,'${actor}','${detail}');`;
    sql(`set role authenticated; select set_config('request.jwt.claim.sub','${subject}',false); ${call("IFSAC 2008 Edition")}`);
    assert.equal(sql("select to_jsonb(mc) from member_certifications mc order by id;").trim(), before,
      "Detail-only edit must not change ANY credential or audit field");
    sql(`set role authenticated; select set_config('request.jwt.claim.sub','${subject}',false); ${call("IFSAC 2008 Edition")}`);
    assert.equal(sql("select to_jsonb(mc) from member_certifications mc order by id;").trim(), before, "No-op save must preserve audit fields");
    assert.equal(sql(`set role authenticated; select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000099',false);
      select count(*) from member_certification_details;`).trim().split("\n").at(-1), "0", "Foreign account cannot read details");
    sql(`set role authenticated; select set_config('request.jwt.claim.sub','${subject}',false);
      do $$ begin
        begin perform save_member_certification_with_details('${foreignDept}','${actor}',null,
          '30000000-0000-4000-8000-000000000003',null,'2020-01-01',null,null,null,'${actor}',null);
        exception when raise_exception then return; end;
        raise exception 'FOREIGN DEPARTMENT WRITE ACCEPTED';
      end $$;
      insert into certifications(department_id,name) values ('${redOak}','Ice Rescue');`);
    const ice = sql(`select id from certifications where name='Ice Rescue';`).trim();
    assert.equal(JSON.parse(sql(`set role authenticated; select set_config('request.jwt.claim.sub','${subject}',false);
      select save_member_certification_with_details('${redOak}','${actor}',null,'${ice}',null,'2020-01-01',null,null,null,'${actor}','2020 Standard');`)
      .trim().split("\n").at(-1)!).certification_id, ice);
    sql(`create function force_detail_failure() returns trigger language plpgsql as $$
      begin if new.edition_details='FORCED_FAILURE' then raise exception 'FORCED_DETAIL_FAILURE'; end if; return new; end $$;
      create trigger force_detail_failure before insert or update on member_certification_details
        for each row execute function force_detail_failure();`);
    const allBefore = sql("select jsonb_agg(to_jsonb(mc) order by id) from member_certifications mc;").trim();
    sql(`set role authenticated; select set_config('request.jwt.claim.sub','${subject}',false);
      do $$ begin
        begin perform save_member_certification_with_details('${redOak}','${actor}',null,
          '30000000-0000-4000-8000-000000000002',null,'2020-01-01',null,null,null,'${actor}','FORCED_FAILURE');
        exception when raise_exception then if sqlerrm='FORCED_DETAIL_FAILURE' then return; end if; raise; end;
        raise exception 'FAILURE TRIGGER DID NOT EXECUTE';
      end $$;`);
    assert.equal(sql("select jsonb_agg(to_jsonb(mc) order by id) from member_certifications mc;").trim(), allBefore,
      "Metadata failure must roll back the member certification insert");
    assert.equal(sql(`select has_function_privilege('anon',
      'save_member_certification_with_details(uuid,uuid,uuid,uuid,text,date,date,uuid,text,uuid,text)','execute');`).trim(), "f");
  });
});

test("concurrent reverse mappings reject stale snapshots and serialize only within their department", async () => {
  await withDatabase(async (sql, startSession) => {
    const a = "30000000-0000-4000-8000-000000000001";
    const b = "30000000-0000-4000-8000-000000000002";
    const c = "30000000-0000-4000-8000-000000000003";
    const d = "30000000-0000-4000-8000-000000000004";
    sql(`insert into departments values ('${redOak}'),('${foreignDept}');
      insert into members values ('${actor}','${redOak}','actor@example.invalid','Administrator',true,'${subject}',false);
      insert into certifications(id,department_id,name) values
        ('${a}','${redOak}','A'),('${b}','${redOak}','B'),
        ('${c}','${foreignDept}','C'),('${d}','${foreignDept}','D');
      begin; ${schema} commit;`);
    const waitFor = async (application: string, predicate: string) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (sql(`select count(*) from pg_stat_activity where application_name='${application}' and ${predicate};`).trim() === "1") return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.fail(`Session ${application} did not reach ${predicate}`);
    };
    const claims = `set role authenticated; select set_config('request.jwt.claim.sub','${subject}',false);`;
    for (const [isolation, seeded] of [
      ["READ COMMITTED", true],
      ["REPEATABLE READ", false],
      ["REPEATABLE READ", true],
      ["SERIALIZABLE", true],
    ] as const) {
      sql(`update certifications set canonical_certification_id=null;
        ${seeded ? "" : "delete from certification_mapping_guards;"}`);
      const stale = startSession(`begin isolation level ${isolation}; set application_name='stale';
        ${claims} select count(*) from certifications;`);
      await waitFor("stale", "state='idle in transaction'");
      const writer = startSession(`begin; set application_name='writer'; ${claims}
        update certifications set canonical_certification_id='${b}' where id='${a}';`);
      await waitFor("writer", "state='idle in transaction'");
      stale.send(`update certifications set canonical_certification_id='${a}' where id='${b}'; commit;`);
      await waitFor("stale", "wait_event_type='Lock'");
      writer.finish("commit;");
      stale.finish();
      const [committed, rejected] = await Promise.all([writer.result, stale.result]);
      assert.equal(committed.status, 0, committed.stderr);
      assert.notEqual(rejected.status, 0, `${isolation} must not commit the reverse mapping`);
      assert.match(rejected.stderr, isolation === "READ COMMITTED"
        ? /Certification mapping must target an unmapped type/
        : /40001.*could not serialize access/);
      assert.equal(sql(`select canonical_certification_id from certifications where id='${a}';`).trim(), b);
      assert.equal(sql(`select canonical_certification_id is null from certifications where id='${b}';`).trim(), "t");
      assert.equal(sql(`select count(*) from certifications s join certifications t on t.id=s.canonical_certification_id
        where t.canonical_certification_id is not null;`).trim(), "0", "No chains or cycles may remain");
    }

    const locked = startSession(`begin; set application_name='locked_department';
      update certifications set canonical_certification_id='${b}' where id='${a}';`);
    await waitFor("locked_department", "state='idle in transaction'");
    const independent = startSession(`begin; set application_name='independent_department';
      update certifications set canonical_certification_id='${d}' where id='${c}';`);
    await waitFor("independent_department", "state='idle in transaction'");
    independent.finish("commit;");
    assert.equal((await independent.result).status, 0, "An unrelated department must commit without waiting for the first");
    locked.finish("commit;");
    assert.equal((await locked.result).status, 0);
    assert.equal(sql(`select canonical_certification_id from certifications where id='${c}';`).trim(), d);
    assert.throws(() => sql(`update certifications set canonical_certification_id='${d}' where id='${b}';`),
      /same department|foreign key/);
    assert.equal(sql(`select has_table_privilege('authenticated','certification_mapping_guards','select')
      or has_table_privilege('authenticated','certification_mapping_guards','update')
      or has_table_privilege('anon','certification_mapping_guards','select');`).trim(), "f",
    "The internal guard must not grant callers new access");
  });
});

const snapshotPath = process.env.CERTIFICATION_PRESERVATION_SNAPSHOT;
test("approved Red Oak 69-record snapshot survives exact configuration migration", { skip: !snapshotPath }, async () => {
  assert.ok(snapshotPath);
  const snapshot: Snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  assert.ok(process.env.CERTIFICATION_ORIGINAL_SNAPSHOT, "Original import snapshot is required for independent edition recovery verification");
  assert.ok(process.env.CERTIFICATION_IMPORT_PACKET, "Import packet is required for independent literal recovery verification");
  const original: { catalog: Array<{ id: string; name: string }>; member_certifications: Array<{ id: string; member_id: string; certification_id: string; issued_at: string }> } =
    JSON.parse(readFileSync(process.env.CERTIFICATION_ORIGINAL_SNAPSHOT, "utf8"));
  const packet: { catalog: string[]; people: Array<[string,string,string]>; records: Array<[number,number,string,string,string,number]> } =
    JSON.parse(readFileSync(process.env.CERTIFICATION_IMPORT_PACKET, "utf8"));
  const records = snapshot.member_certifications.filter(row => row.department_id === redOak);
  assert.equal(records.length, 69);
  assert.equal(new Set(records.map(row => row.member_id)).size, 15);
  await withDatabase(async sql => {
    sql(`insert into departments select id from jsonb_populate_recordset(null::departments,${quote(snapshot.departments)});
      insert into departments values ('${foreignDept}') on conflict do nothing;
      insert into members(id,department_id) select id,department_id from jsonb_populate_recordset(null::members,${quote(snapshot.members)});
      insert into members values ('${actor}','${redOak}','actor@example.invalid','Administrator',true,'${subject}',false);
      insert into department_roles select * from jsonb_populate_recordset(null::department_roles,${quote(snapshot.department_roles)});
      insert into certifications select * from jsonb_populate_recordset(null::certifications,${quote(snapshot.certifications)});
      insert into documents(id,department_id) select distinct supporting_document_id,department_id
        from jsonb_populate_recordset(null::member_certifications,${quote(snapshot.member_certifications)})
        where supporting_document_id is not null;
      insert into member_certifications select * from jsonb_populate_recordset(null::member_certifications,${quote(snapshot.member_certifications)});
      insert into role_required_certifications select * from jsonb_populate_recordset(null::role_required_certifications,${quote(snapshot.role_required_certifications)});`);
    const snapshotSql = `select jsonb_build_object('records',(select jsonb_agg(to_jsonb(mc) order by id) from member_certifications mc),
      'requirements',(select jsonb_agg(to_jsonb(r) order by id) from role_required_certifications r),
      'other_catalog',(select jsonb_agg(to_jsonb(c) order by id) from certifications c where department_id<>'${redOak}'));`;
    const before = JSON.parse(sql(snapshotSql));
    sql("begin;" + schema + "commit;");
    // Additive schema introduces a catalog field; compare catalog data independently from the schema change.
    const schemaBefore = JSON.parse(sql(snapshotSql));
    const mismatchedManifest = configuration.replace(records[0].id, "00000000-0000-4000-8000-000000000099");
    assert.notEqual(mismatchedManifest, configuration);
    assert.throws(() => sql("begin;" + mismatchedManifest + "commit;"), /preflight differs from approved preservation manifest/);
    assert.deepEqual(JSON.parse(sql(snapshotSql)), schemaBefore, "A mismatched approval manifest must fail without any partial configuration writes");
    sql("begin;" + configuration + "commit;");
    const after = JSON.parse(sql(snapshotSql));
    assert.deepEqual(after, schemaBefore, "Configuration must preserve every field in all existing records, requirements and other departments' catalogs");
    assert.deepEqual(after.records, before.records, "Schema must also leave every member certification field unchanged");
    assert.deepEqual(after.requirements, before.requirements);
    const newCatalog: CertificationCatalogRow[] = JSON.parse(sql("select jsonb_agg(to_jsonb(c) order by id) from certifications c;"));
    const details: Array<{ member_certification_id: string; edition_details: string; source_reference: string }> =
      JSON.parse(sql("select jsonb_agg(to_jsonb(d) order by member_certification_id) from member_certification_details d;"));
    assert.equal(details.length, 12);
    assert.equal(after.records.filter((row: { department_id: string; expires_at: string | null }) => row.department_id === redOak && row.expires_at === null).length, 69);
    assert.equal(records.filter(row => row.certification_id === standard).length, 12);
    assert.equal(newCatalog.filter(row =>
      row.department_id === redOak && row.canonical_certification_id).length, 39);
    assert.equal(newCatalog.filter(row =>
      row.department_id === redOak && !row.canonical_certification_id && row.active).length, 10);
    for (const id of ["062fd5ca-d996-43ec-ba33-1f65a3da9930","0494a3d9-2fd4-4ab2-b934-a4277a12e98e",
      "0a4dab7a-7f84-4fdb-9ffe-099530454a19","50ec38d6-2d19-4bc8-8acf-2563774d68a7"]) {
      assert.ok(after.records.some((row: { id: string }) => row.id === id), "Each separate Brian Hamman record must survive");
    }
    const recovered = [...configuration.matchAll(/\('([0-9a-f-]{36})','[0-9a-f-]{36}','\d{4}-\d{2}-\d{2}','([^']+)',\d+\)/g)];
    assert.equal(recovered.length, 12);
    for (const [, id, literal] of recovered) {
      const detail = details.find(row => row.member_certification_id === id);
      assert.ok(detail);
      assert.equal(detail.edition_details, literal);
      const source = original.member_certifications.find(row => row.id === id);
      assert.ok(source);
      const originalName = original.catalog.find(row => row.id === source.certification_id)?.name;
      const evidence = packet.records.filter(row => packet.people[row[0]][1] === source.member_id
        && packet.catalog[row[1]] === originalName && row[2] === source.issued_at);
      assert.equal(evidence.length, 1, "Exact original record must have one unambiguous import match");
      assert.equal(detail.edition_details, evidence[0][4], "Literal edition detail must match independent saved import evidence");
      assert.match(detail.source_reference, new RegExp(`page ${evidence[0][5]};`));
    }
    assert.deepEqual(newCatalog.filter(row => row.department_id === redOak && row.canonical_certification_id)
      .map(row => row.name).sort(), [...packet.catalog].sort(), "All 39 exact historical names must remain intact");
    const reportRecords: Array<Record<string, unknown>> = after.records
      .filter((row: { department_id: string }) => row.department_id === redOak)
      .map((row: { id: string }) => ({ ...row, member_certification_details: details.find(detail => detail.member_certification_id === row.id) ?? null }));
    const report = await verifyCertificationReports({ departmentId: redOak,
      catalog: newCatalog.filter(row => row.department_id === redOak), records: reportRecords,
      members: [...new Set(records.map(row => row.member_id))].map(id => ({ id })) });
    assert.equal(report.totalRows, 69);
    for (const detail of details) {
      assert.ok(report.rows.some(row => row.certification_name === certificationDisplayName("Firefighter 1", detail)));
    }
    console.log("PASS: full-field preservation of 154 certifications (69 Red Oak), 40 requirements and all other catalogs; 12 literal recoveries verified");
    console.log("PASS: all 69 report/export rows remain separate; every standard filter includes its mapped variants; all recovered details display");
  });
});
