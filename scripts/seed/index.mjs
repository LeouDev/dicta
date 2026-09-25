// npm run seed: writes supabase/seed.sql and loads it into the LOCAL Supabase
// database (start it with `npx supabase start`, which needs Docker; it also
// loads seed.sql on first start and on every `npx supabase db reset`).
//
// It can't reach any other database: the Supabase CLI is only ever called with
// --local, and the SQL itself refuses to run where real accounts exist.
//   SEED_KEEP_USERS=1 npm run seed   keep your own local test accounts
//   npm run seed -- --write-only     just regenerate supabase/seed.sql
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generate, toSql } from './generate.mjs';

const seedFile = fileURLToPath(new URL('../../supabase/seed.sql', import.meta.url));
const world = generate();
writeFileSync(seedFile, toSql(world));
console.log(
  `Wrote supabase/seed.sql: ${world.users.length} people, ${world.posts.length} posts, ${world.follows.length} follows, ` +
    `${world.likes.length} likes, ${world.comments.length} comments and replies, ${world.saves.length} saves.`,
);
if (process.argv.includes('--write-only')) process.exit(0);

const keepUsers = process.env.SEED_KEEP_USERS === '1' ? "select set_config('dicta.seed_keep_users', 'on', false);\n" : '';
const file = join(mkdtempSync(join(tmpdir(), 'dicta-seed-')), 'seed.sql');
writeFileSync(file, keepUsers + readFileSync(seedFile, 'utf8'));

// The CLI doesn't need an access token for the local database; a stale one only gets in the way.
const env = { ...process.env };
delete env.SUPABASE_ACCESS_TOKEN;
try {
  execFileSync('npx', ['supabase', 'db', 'query', '--local', '-f', file], { stdio: ['ignore', 'ignore', 'inherit'], env });
} catch {
  console.error('\nCouldn’t seed the local database. Is it running? Start it with: npx supabase start (needs Docker).');
  process.exit(1);
}
console.log('Seeded the local database.');
