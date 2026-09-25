// Development seed data: 25 fictional people, 77 original quotes (six of them
// in Chinese, Japanese, Korean, Arabic and Russian), and the follows, likes,
// comments, replies and saves between them. Deterministic, so every developer
// gets the same world; timestamps are relative to when it's applied.
//
// Seed accounts use @seed.dicta.test addresses (a reserved test domain) and
// have no password, so nobody can sign in as them.

export const SEED_EMAIL_DOMAIN = 'seed.dicta.test';

const PEOPLE = [
  ['Mara Vell', 'mara.vell', 'Collecting small truths.'],
  ['Theo Okafor', 'theo.writes', 'Notes to my future self.'],
  ['Lina Park', 'linapark', 'Soft words, strong coffee.'],
  ['Jonah Reyes', 'jonahreyes', 'Learning in public.'],
  ['Ava Lindqvist', 'ava.lind', 'Nordic light and long walks.'],
  ['Kofi Mensah', 'kofi.m', 'Builder. Listener. Early riser.'],
  ['Sofía Marín', 'sofiamarin', 'Words for the in-between days.'],
  ['Hiro Tanaka', 'hiro.tanaka', '小さな言葉を集めています。'],
  ['Wen Li', 'wen.li', '写给慢慢变好的自己。'],
  ['Seo-yeon Kim', 'seoyeon.kim', '천천히, 그러나 꾸준히.'],
  ['Layla Haddad', 'layla.haddad', 'كلمات صغيرة لأيام طويلة.'],
  ['Nikolai Petrov', 'nikolai.p', 'Короткие мысли на каждый день.'],
  ['Priya Nair', 'priya.nair', 'Therapist in training. Kind by default.'],
  ['Elias Brandt', 'elias.brandt', 'Designer who writes things down.'],
  ['Noor Rahman', 'noor.rahman', 'Gentle, not soft.'],
  ['Camille Dubois', 'camille.db', 'Poems on the metro.'],
  ['Mateo Silva', 'mateo.silva', 'Coach. Dad. Still learning.'],
  ['Ingrid Holm', 'ingrid.holm', 'Quiet mornings enthusiast.'],
  ['Tunde Adeyemi', 'tunde.a', 'Shipping ideas one day at a time.'],
  ['Rosa Álvarez', 'rosa.alvarez', 'Heart on paper.'],
  ['Felix Wagner', 'felixwagner', 'Engineer by day, reader by night.'],
  ['Amara Diallo', 'amara.diallo', 'Here for the honest ones.'],
  ['Yusuf Kaya', 'yusuf.kaya', 'Small steps, every day.'],
  ['Nora Quinn', 'nora.quinn', 'Writing my way through it.'],
  ['Sam Ellery', 'sam.ellery', 'Friend of the overthinkers.'],
];

// [author index, text, topic]; all written for Dicta.
const QUOTES = [
  [0, 'Slow mornings are not wasted mornings.', 'life'],
  [1, 'You can outgrow a place and still be grateful it held you.', 'growth'],
  [2, 'Rest is part of the work, not a reward for it.', 'mindset'],
  [3, 'Some doors close so you stop standing in the hallway.', 'life'],
  [4, 'Be the friend who remembers the small things.', 'friendship'],
  [5, 'Healing is not linear. It is honest.', 'healing'],
  [6, 'Your worth was never up for a vote.', 'self-worth'],
  [12, 'Say the kind thing while they can still hear it.', 'relationships'],
  [13, 'Progress looks boring from the inside.', 'motivation'],
  [14, 'The version of you that you’re becoming is watching.', 'growth'],
  [15, 'Love that asks you to shrink is not love.', 'love'],
  [16, 'Water the friendships that water you back.', 'friendship'],
  [17, 'Quiet confidence doesn’t need an audience.', 'self-worth'],
  [18, 'Not every storm is a sign. Some are just weather.', 'mindset'],
  [19, 'Choose curiosity over being right.', 'mindset'],
  [20, 'You are allowed to change your mind about who you want to be.', 'growth'],
  [21, 'Your pace is still a pace.', 'motivation'],
  [22, 'The right people make silence comfortable.', 'relationships'],
  [23, 'Start before you feel ready. Ready is a feeling that arrives late.', 'motivation'],
  [24, 'Protect your peace like it pays the rent.', 'self-worth'],
  [0, 'Soft hearts are strong in ways hard ones never learn.', 'love'],
  [1, 'Let the past teach you, not keep you.', 'healing'],
  [2, 'Small steps still leave footprints.', 'motivation'],
  [3, 'Apologize like you mean to do better.', 'relationships'],
  [4, 'Some chapters end mid-sentence. Turn the page anyway.', 'life'],
  [5, 'Talent opens the door. Kindness keeps you in the room.', 'career'],
  [6, 'You don’t have to earn rest.', 'self-worth'],
  [12, 'Grow quietly. Let the results make the noise.', 'growth'],
  [13, 'Home is the people who notice when you’re gone.', 'love'],
  [14, 'Discipline is remembering what you want.', 'motivation'],
  [15, 'The goal is not to be fearless. It’s to be brave with the fear.', 'mindset'],
  [16, 'Don’t let one bad day write the whole week.', 'mindset'],
  [17, 'Keep a little wonder in your pocket.', 'life'],
  [18, 'Listening is the most generous thing you can do.', 'relationships'],
  [19, 'You are not behind. You are on your own timeline.', 'growth'],
  [20, 'Care for yourself like someone you love.', 'self-worth'],
  [21, 'Say no without writing an essay.', 'self-worth'],
  [22, 'Every expert was once a beginner who didn’t quit.', 'career'],
  [23, 'Tender is not the same as fragile.', 'healing'],
  [24, 'The moon doesn’t argue with the dark. It just shines.', 'mindset'],
  [0, 'Your story is still being written. Don’t rush the ending.', 'life'],
  [1, 'A good day is made of small, ordinary mercies.', 'life'],
  [2, 'Hold on to people who make you feel like yourself.', 'friendship'],
  [3, 'Boundaries are a love language too.', 'relationships'],
  [4, 'Make it simple, then make it good.', 'career'],
  [5, 'You can be a masterpiece and a work in progress.', 'growth'],
  [6, 'Old wounds deserve new gentleness.', 'healing'],
  [12, 'Ask for help. It’s a skill, not a weakness.', 'mindset'],
  [13, 'The best apologies change behavior.', 'relationships'],
  [14, 'Let it be easy when it can be.', 'life'],
  [15, 'Write the email. Book the ticket. Call your mother.', 'motivation'],
  [16, 'A calm mind notices the exits.', 'mindset'],
  [17, 'What you tolerate, you teach.', 'relationships'],
  [18, 'Joy counts, even when it’s small.', 'life'],
  [19, 'Friendship is choosing each other on ordinary days.', 'friendship'],
  [20, 'Be patient with the version of you that’s still learning.', 'growth'],
  [21, 'Some people are sunlight in human form.', 'friendship'],
  [22, 'Your inner voice deserves better manners.', 'self-worth'],
  [23, 'The comeback is quieter than the setback. Keep going.', 'motivation'],
  [24, 'Leave room for the life you haven’t imagined yet.', 'life'],
  [0, 'Consistency beats intensity.', 'career'],
  [1, 'You were never too much for the right people.', 'love'],
  [2, 'Laugh often. It’s cheaper than therapy and pairs well with it.', 'healing'],
  [3, 'Nobody is thinking about your mistake as much as you are.', 'mindset'],
  [4, 'Kindness is a form of intelligence.', 'relationships'],
  [5, 'The heart heals in its own weather.', 'healing'],
  [6, 'Every day is another beginning.', 'motivation'],
  [8, '每一天都是新的开始。', 'motivation'],
  [7, '今日も新しい始まり。', 'motivation'],
  [9, '오늘은 새로운 시작이다.', 'motivation'],
  [10, 'كل يوم هو بداية جديدة.', 'motivation'],
  [11, 'Каждый день — новое начало.', 'motivation'],
  [8, '温柔也是一种力量。', 'self-worth'],
  [7, '小さな一歩も、前に進んでいる。', 'growth'],
  [9, '천천히 가도 괜찮아.', 'healing'],
  [10, 'الهدوء قوة.', 'mindset'],
  [11, 'Тишина — тоже ответ.', 'relationships'],
];

const COMMENTS = [
  'This one stays with me.',
  'Needed this today.',
  'Saving this for Monday.',
  'So true.',
  'Reading this twice.',
  'Beautifully said.',
  'Sending this to my sister.',
  'Felt that.',
  'Yes. Exactly this.',
  'Printing this for my desk.',
  'The last line got me.',
  'Quietly powerful.',
];

const REPLIES = ['Glad it found you.', 'Thank you for reading.', 'Same here.', 'It helped me too.', 'Right?', 'Thank you 🙏'];

const FONTS = ['editorial', 'display', 'classic', 'elegant', 'modern', 'bold', 'rounded', 'typewriter', 'lcd', 'pixel', 'hand', 'print', 'brush'];
const CANVASES = ['4:5', '9:16', '1:1'];

// Every template draws without a photo; Photograph needs one, so it's left out.
const TEMPLATES = [
  'editorial', 'minimal', 'midnight', 'typewriter', 'journal', 'modern', 'gradient', 'diptych', 'headline',
  'grain', 'pager', 'lcd', 'ink', 'wall', 'notification', 'book', 'dialogue',
];

// mulberry32: small, fast, deterministic.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const id = (kind, n) => `5eed000${kind}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

/** The seed world as plain data. `minutesAgo` fields become timestamps when applied. */
export function generate() {
  const rand = random(20260927);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const others = (n, exclude) => {
    const pool = PEOPLE.map((_, i) => i).filter((i) => i !== exclude);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  };

  const users = PEOPLE.map(([displayName, username, bio], i) => ({
    id: id(1, i + 1),
    email: `${username.replace(/\./g, '-')}@${SEED_EMAIL_DOMAIN}`,
    displayName,
    username,
    bio,
    verified: i < 3,
    minutesAgo: 40 * 24 * 60 - i * 90,
  }));

  const follows = [];
  users.forEach((user, i) => {
    for (const j of others(between(3, 12), i)) follows.push({ follower: user.id, following: users[j].id, minutesAgo: between(60, 30 * 24 * 60) });
  });

  // Newest last, spread over the past three weeks. Every third post picks its own
  // font; canvases rotate; some Latin-script posts carry hashtags, as people write them.
  const posts = QUOTES.map(([author, text, topic], i) => ({
    id: id(2, i + 1),
    author: users[author].id,
    authorIndex: author,
    text: i % 4 === 1 && /^[\x00-\u024f’—]+$/.test(text) ? `${text} #${topic.replace('-', '')}` : text,
    topic,
    template: TEMPLATES[i % TEMPLATES.length],
    design: {
      align: pick(['left', 'center', 'center']),
      canvas: CANVASES[i % CANVASES.length],
      ...(i % 3 === 0 ? { font: FONTS[(i / 3) % FONTS.length] } : {}),
    },
    minutesAgo: Math.round(((QUOTES.length - i) / QUOTES.length) * 21 * 24 * 60) + between(0, 90),
  }));

  const likes = [];
  const saves = [];
  const comments = [];
  let commentCount = 0;
  for (const post of posts) {
    const age = post.minutesAgo;
    for (const j of others(between(0, 15), post.authorIndex)) likes.push({ user: users[j].id, post: post.id, minutesAgo: between(1, age - 1) });
    for (const j of others(between(0, 3), post.authorIndex)) saves.push({ user: users[j].id, post: post.id, minutesAgo: between(1, age - 1) });
    for (const j of others(between(0, 3), post.authorIndex)) {
      const minutesAgo = between(2, age - 1);
      const comment = { id: id(3, ++commentCount), post: post.id, author: users[j].id, parent: null, body: pick(COMMENTS), minutesAgo };
      comments.push(comment);
      // The author often answers.
      if (rand() < 0.4) {
        comments.push({ id: id(3, ++commentCount), post: post.id, author: post.author, parent: comment.id, body: pick(REPLIES), minutesAgo: between(1, minutesAgo - 1) });
      }
    }
  }

  return { users, follows, posts, likes, saves, comments };
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ago = (minutes) => `now() - interval '${minutes} minutes'`;
const rows = (list, row) => list.map((item) => `  (${row(item)})`).join(',\n');

/**
 * The seed as SQL for supabase/seed.sql. It refuses to run on a database with
 * real accounts, so it can't seed production even if pointed there. Re-running
 * it replaces the previous seed.
 */
export function toSql({ users, follows, posts, likes, saves, comments }) {
  return `-- Development seed: generated by \`npm run seed\` (scripts/seed). Don't edit by hand.
-- Applied to the LOCAL database only: by \`supabase start\` / \`supabase db reset\`,
-- and by \`npm run seed\`. Never run it against production.

do $$
begin
  if exists (select 1 from auth.users where email not like '%@${SEED_EMAIL_DOMAIN}')
     and coalesce(current_setting('dicta.seed_keep_users', true), '') <> 'on' then
    raise exception 'Not seeding: this database has real accounts. The seed only runs on local development databases.';
  end if;
end $$;

-- Replace the previous seed. Its posts were never on the website, so don't ask it to purge them.
alter table public.posts disable trigger posts_after_delete_purge;
delete from auth.users where email like '%@${SEED_EMAIL_DOMAIN}';
alter table public.posts enable trigger posts_after_delete_purge;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
${rows(users, (u) => `${q(u.id)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${q(u.email)}, '{"provider":"email","providers":["email"]}', '{}', ${ago(u.minutesAgo)}, ${ago(u.minutesAgo)}`)};

-- Seed people get no welcome email.
alter table public.profiles disable trigger profiles_after_insert_welcome;
insert into public.profiles (id, username, display_name, bio, is_verified, created_at)
values
${rows(users, (u) => `${q(u.id)}, ${q(u.username)}, ${q(u.displayName)}, ${q(u.bio)}, ${u.verified}, ${ago(u.minutesAgo)}`)};
alter table public.profiles enable trigger profiles_after_insert_welcome;

insert into public.follows (follower_id, following_id, created_at)
values
${rows(follows, (f) => `${q(f.follower)}, ${q(f.following)}, ${ago(f.minutesAgo)}`)};

insert into public.posts (id, author_id, text, topic, created_at)
values
${rows(posts, (p) => `${q(p.id)}, ${q(p.author)}, ${q(p.text)}, ${q(p.topic)}, ${ago(p.minutesAgo)}`)};

insert into public.post_designs (post_id, template, design)
values
${rows(posts, (p) => `${q(p.id)}, ${q(p.template)}, ${q(JSON.stringify({ version: 2, template: p.template, ...p.design }))}`)};

insert into public.likes (user_id, post_id, created_at)
values
${rows(likes, (l) => `${q(l.user)}, ${q(l.post)}, ${ago(l.minutesAgo)}`)};

insert into public.saves (user_id, post_id, created_at)
values
${rows(saves, (s) => `${q(s.user)}, ${q(s.post)}, ${ago(s.minutesAgo)}`)};

insert into public.comments (id, post_id, author_id, parent_id, body, created_at)
values
${rows(comments, (c) => `${q(c.id)}, ${q(c.post)}, ${q(c.author)}, ${c.parent ? q(c.parent) : 'null'}, ${q(c.body)}, ${ago(c.minutesAgo)}`)};
`;
}
