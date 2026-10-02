// Local stand-in for the Supabase database: PGlite (Postgres in WebAssembly) with
// the bits of Supabase the migrations use (auth, storage, pg_net, roles, realtime),
// then every migration in order, then every test file. Each test file runs in its
// own BEGIN … ROLLBACK, as it does against the live database.
//   npm run test:db:local [-- only-this-test.sql]
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..');
const db = await PGlite.create({ extensions: { pg_trgm } });

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  create schema auth;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text,
    raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage to anon, authenticated, service_role;

  create schema net;
  create table net.http_request_queue (id bigserial primary key, method text, url text, headers jsonb, body bytea, timeout_milliseconds int);
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
                                headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
  returns bigint language sql as $$
    insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
    values ('POST', url, headers, convert_to(body::text, 'utf8'), timeout_milliseconds) returning id
  $$;
  grant usage on schema net to anon, authenticated, service_role;

  create publication supabase_realtime;
`);

const migrations = readdirSync(join(REPO, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const file of migrations) {
  // pg_net is stubbed above (net.http_post records into net.http_request_queue).
  const sql = readFileSync(join(REPO, 'supabase/migrations', file), 'utf8').replace(/create extension if not exists pg_net[^;]*;/gi, '');
  try {
    await db.exec(sql);
  } catch (error) {
    console.error(`✕ migration ${file}: ${error.message}`);
    if (error.position) console.error(`  near: ${sql.slice(Math.max(0, error.position - 160), Number(error.position) + 80)}`);
    process.exit(1);
  }
}
console.log(`✓ ${migrations.length} migrations`);

const only = process.argv[2];
const tests = readdirSync(join(REPO, 'supabase/tests')).filter((f) => f.endsWith('.sql') && (!only || f === only)).sort();
let failed = 0;
for (const file of tests) {
  const sql = readFileSync(join(REPO, 'supabase/tests', file), 'utf8');
  try {
    await db.exec(sql);
    console.log(`✓ ${file}`);
  } catch (error) {
    failed++;
    console.error(`✕ ${file}: ${error.message}`);
    if (error.where) console.error(`  where: ${error.where}`);
    await db.exec('rollback').catch(() => {});
  }
}
process.exit(failed ? 1 : 0);
