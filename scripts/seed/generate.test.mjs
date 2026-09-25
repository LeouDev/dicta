// The seed follows the database's rules, looks like real use, and can't touch production.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SEED_EMAIL_DOMAIN, generate, toSql } from './generate.mjs';

const world = generate();
const { users, follows, posts, likes, saves, comments } = world;
const unique = (list, key) => new Set(list.map(key)).size === list.length;

test('is the same every time', () => {
  assert.deepEqual(generate(), world);
});

test('makes 20–30 people and 50–100 original posts, in six scripts', () => {
  assert.ok(users.length >= 20 && users.length <= 30);
  assert.ok(posts.length >= 50 && posts.length <= 100);
  for (const script of [/[一-鿿]/, /[぀-ヿ]/, /[가-힯]/, /[؀-ۿ]/, /[Ѐ-ӿ]/]) {
    assert.ok(posts.some((p) => script.test(p.text)), `a post in ${script}`);
  }
});

test('varies templates, fonts, canvases, topics and hashtags', () => {
  const distinct = (values) => new Set(values).size;
  assert.ok(distinct(posts.map((p) => p.template)) >= 15);
  assert.ok(distinct(posts.map((p) => p.design.font).filter(Boolean)) >= 10);
  assert.equal(distinct(posts.map((p) => p.design.canvas)), 3);
  assert.ok(distinct(posts.map((p) => p.topic)) >= 8);
  const tagged = posts.filter((p) => /#[A-Za-z0-9_]{2,40}/.test(p.text));
  assert.ok(tagged.length >= 10, `${tagged.length} posts with hashtags`);
});

test('fits the schema’s constraints', () => {
  assert.ok(unique(users, (u) => u.username) && unique(users, (u) => u.email) && unique(users, (u) => u.id));
  for (const u of users) {
    assert.match(u.username, /^[a-z0-9_.]{3,30}$/);
    assert.ok(u.displayName.trim().length >= 1 && u.displayName.trim().length <= 50);
    assert.ok(u.bio.length <= 160);
    assert.ok(u.email.endsWith(`@${SEED_EMAIL_DOMAIN}`));
  }
  const topics = new Set(['motivation', 'love', 'life', 'growth', 'healing', 'career', 'friendship', 'self-worth', 'mindset', 'relationships']);
  for (const p of posts) {
    assert.ok(p.text.trim().length >= 1 && p.text.trim().length <= 500);
    assert.ok(topics.has(p.topic), p.topic);
    assert.notEqual(p.template, 'photograph', 'no template that needs a photo');
  }
  for (const c of comments) assert.ok(c.body.trim().length >= 1 && c.body.length <= 1000);
});

test('behaves like real people: no self-follows, no doubles, activity after posting', () => {
  assert.ok(follows.every((f) => f.follower !== f.following));
  assert.ok(unique(follows, (f) => `${f.follower}|${f.following}`));
  assert.ok(unique(likes, (l) => `${l.user}|${l.post}`) && unique(saves, (s) => `${s.user}|${s.post}`));

  const byId = new Map(posts.map((p) => [p.id, p]));
  for (const item of [...likes, ...saves, ...comments]) {
    const post = byId.get(item.post);
    assert.ok(item.minutesAgo >= 1 && item.minutesAgo < post.minutesAgo, 'after the post');
  }
  assert.ok(likes.every((l) => l.user !== byId.get(l.post).author), 'nobody likes their own post');

  const commentsById = new Map(comments.map((c) => [c.id, c]));
  const replies = comments.filter((c) => c.parent);
  assert.ok(replies.length > 0);
  for (const reply of replies) {
    const parent = commentsById.get(reply.parent);
    assert.equal(parent.post, reply.post, 'replies stay on the same post');
    assert.equal(parent.parent, null, 'one level deep');
    assert.ok(reply.minutesAgo < parent.minutesAgo, 'after the comment');
  }
});

test('refuses to run on a database with real accounts, and never names production', () => {
  const sql = toSql(world);
  assert.match(sql, /if exists \(select 1 from auth\.users where email not like '%@seed\.dicta\.test'\)/);
  assert.match(sql, /raise exception 'Not seeding/);
  assert.ok(sql.indexOf('raise exception') < sql.indexOf('delete from auth.users'), 'checks before deleting anything');
  assert.doesNotMatch(sql, /phusfxrnwxhsczhzucod|supabase\.co/);
  assert.match(sql, /delete from auth\.users where email like '%@seed\.dicta\.test'/);
  assert.ok(sql.indexOf('disable trigger profiles_after_insert_welcome') < sql.indexOf('insert into public.profiles'), 'no welcome emails for seed people');
});
