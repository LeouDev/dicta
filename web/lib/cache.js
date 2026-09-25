// Every cached response about a post carries these tags (Vercel-Cache-Tag), so
// deleting the post, or its author's account, drops them all at once (api/purge.js).
export const postTags = (post) => `post-${post.id},author-${post.author_id}`;
export const missingPostTags = (id) => `post-${id}`;
