/** The website in web/: it opens /post links in Dicta when installed (universal links) and shows the quote otherwise. */
const WEB_ORIGIN = 'https://dicta-orcin.vercel.app';

export const postLink = (postId: string) => `${WEB_ORIGIN}/post/${postId}`;

/**
 * Asks the website to draw the post's card image now (the post page and link
 * previews show it), so it's ready before anyone opens a shared link. Fire and
 * forget: the website draws it on first view anyway.
 */
export function prepareCardImage(postId: string) {
  fetch(`${WEB_ORIGIN}/api/card?id=${encodeURIComponent(postId)}&warm=1`).catch(() => {});
}

/**
 * Removes a deleted post, or every post of a deleted account, from the
 * website's cache right away, so its page, artwork and link preview stop
 * being served. The website checks the content is really gone first.
 */
export function purgeFromWebsite(target: { post: string } | { author: string }) {
  const query = 'post' in target ? `post=${encodeURIComponent(target.post)}` : `author=${encodeURIComponent(target.author)}`;
  fetch(`${WEB_ORIGIN}/api/purge?${query}`, { method: 'POST' }).catch(() => {});
}
