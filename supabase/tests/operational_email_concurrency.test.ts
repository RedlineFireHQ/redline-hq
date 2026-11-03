import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import test, { before } from "node:test";

const container = process.env.REDLINE_NOTIFICATION_TEST_CONTAINER;
const database = "redline_operational_email_dev_20261103";
const run = promisify(execFile);
const args = ["exec", container ?? "", "psql", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1", "-qAtc"];
const sql = (query: string) => execFileSync("docker", [...args, query], { encoding: "utf8" }).trim();
const parallelSql = async (query: string) => (await run("docker", [...args, query])).stdout.trim();
const suite = container ? test : test.skip;

async function waitForSleeper() {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (sql(`SELECT count(*) FROM pg_stat_activity WHERE datname='${database}' AND wait_event='PgSleep';`) === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Test transaction did not acquire its lock");
}

before(() => {
  if (!container) return;
  assert.equal(sql("SELECT current_database();"), database);
  assert.equal(sql("SELECT count(*) FROM public.members;"), "0", "Concurrency fixture requires schema-only database");
  sql(`
    BEGIN;
    INSERT INTO public.departments(id,name) VALUES ('11000000-0000-0000-0000-000000000001','Concurrency test');
    INSERT INTO auth.users(id,email) VALUES ('61000000-0000-0000-0000-000000000001','local-concurrency@example.test');
    INSERT INTO public.members(id,department_id,first_name,last_name,email,active,role,auth_user_id) VALUES
      ('21000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','Synthetic','Original','original@example.test',true,'Administrator','61000000-0000-0000-0000-000000000001'),
      ('21000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000001','Synthetic','New','new@example.test',true,'Firefighter',null);
    INSERT INTO public.certifications(id,department_id,name)
      VALUES ('31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','Concurrent fire credential');
    INSERT INTO public.member_certifications(department_id,member_id,certification_id,issued_at,expires_at)
      VALUES ('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',current_date-365,(now() AT TIME ZONE 'America/Chicago')::date+60);
    INSERT INTO public.department_notification_recipients(department_id,member_id,notification_type)
      VALUES ('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','ems_supply_low_stock');
    INSERT INTO public.ems_supply_items(id,department_id,item_name,unit_of_measure,quantity_on_hand,reorder_threshold,qr_identifier)
      VALUES ('71000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','Concurrency gauze','each',12,10,'concurrency-gauze');
    UPDATE public.operational_email_rollouts SET enabled=true;
    COMMIT;
  `);
});

suite("concurrent certification scans create exactly one milestone event", async () => {
  const scanning = parallelSql("BEGIN; SELECT public.scan_operational_certification_emails(); SELECT pg_sleep(1); COMMIT;");
  await waitForSleeper();
  const results = await Promise.all([scanning, parallelSql("SELECT public.scan_operational_certification_emails();")]);
  assert.equal(results.map(Number).reduce((a, b) => a + b), 1);
  assert.equal(sql("SELECT count(*) FROM public.operational_email_deliveries WHERE event_type='certification_expiration';"), "1");
});

suite("concurrent claims lease one certification delivery exclusively", async () => {
  const claiming = parallelSql("BEGIN; SELECT count(*) FROM public.claim_operational_email('certification_expiration'); SELECT pg_sleep(1); COMMIT;");
  await waitForSleeper();
  const results = await Promise.all([
    claiming,
    parallelSql("SELECT count(*) FROM public.claim_operational_email('certification_expiration');"),
  ]);
  assert.equal(results.map(Number).reduce((a, b) => a + b), 1);
});

suite("concurrent checkouts serialize stock updates but generate two separate qualifying emails", async () => {
  const checkout = `BEGIN; SET LOCAL request.jwt.claim.sub='61000000-0000-0000-0000-000000000001';
    SELECT transaction_id FROM public.apply_ems_supply_transaction('Checkout',
      '[{"supply_item_id":"71000000-0000-0000-0000-000000000001","quantity":2}]'); COMMIT;`;
  await Promise.all([parallelSql(checkout), parallelSql(checkout)]);
  assert.equal(sql("SELECT quantity_on_hand FROM public.ems_supply_items;"), "8.00");
  assert.equal(sql("SELECT count(*) FROM public.operational_email_deliveries WHERE event_type='ems_supply_withdrawal';"), "2");
  assert.equal(sql("SELECT count(*) FROM public.notifications WHERE type='ems_supply_low_stock';"), "1");
  const claims = await Promise.all([
    parallelSql("SELECT id FROM public.claim_operational_email('ems_supply_withdrawal');"),
    parallelSql("SELECT id FROM public.claim_operational_email('ems_supply_withdrawal');"),
  ]);
  assert.ok(claims[0] && claims[1]);
  assert.notEqual(claims[0], claims[1]);
});

suite("final prepare waits for designation change and then invalidates the old recipient", async () => {
  const id = sql("SELECT id FROM public.operational_email_deliveries WHERE event_type='ems_supply_withdrawal' ORDER BY id LIMIT 1;");
  const changing = parallelSql(`BEGIN;
    UPDATE public.department_notification_recipients SET member_id='21000000-0000-0000-0000-000000000002';
    SELECT pg_sleep(1); COMMIT;`);
  await waitForSleeper();
  const result = await parallelSql(`SELECT public.prepare_operational_email(id,lease_token,'{}') IS NULL
    FROM public.operational_email_deliveries WHERE id='${id}';`);
  await changing;
  assert.equal(result, "t");
  assert.equal(sql(`SELECT status || '/' || last_error FROM public.operational_email_deliveries WHERE id='${id}';`),
    "skipped/designation_changed");
});

suite("isolation migration stops on existing mismatches without rewriting configuration", async () => {
  const migration = readFileSync(new URL("../migrations/20261103031000_enforce_ems_notification_department.sql", import.meta.url), "utf8");
  await assert.rejects(parallelSql(`
    BEGIN;
    ALTER TABLE public.department_notification_recipients DROP CONSTRAINT notification_recipient_member_department_fk;
    INSERT INTO public.departments(id,name) VALUES ('11000000-0000-0000-0000-000000000002','Synthetic mismatched department');
    INSERT INTO public.members(id,department_id,first_name,last_name,active,email) VALUES
      ('21000000-0000-0000-0000-000000000003','11000000-0000-0000-0000-000000000002','Synthetic','Mismatch',true,'mismatch@example.test');
    UPDATE public.department_notification_recipients SET member_id='21000000-0000-0000-0000-000000000003';
    ${migration}
  `), /EMS recipient department mismatch/);
  assert.equal(sql("SELECT count(*) FROM public.department_notification_recipients r JOIN public.members m ON m.id=r.member_id WHERE m.department_id IS DISTINCT FROM r.department_id;"), "0");
});
