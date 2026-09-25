// Every cached response about a post, its 404 included, carries this tag
// (Vercel-Cache-Tag), so purging it drops them all at once (api/purge.js).
export const postTag = (id) => `post-${id}`;
