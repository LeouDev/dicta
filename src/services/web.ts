/**
 * The website in web/: it opens /post links in Dicta when installed (universal
 * links) and shows the quote otherwise. dicta-orcin.vercel.app, its first
 * address, still serves the same site and still opens the app.
 */
const WEB_ORIGIN = 'https://dicta.world';

export const postLink = (postId: string) => `${WEB_ORIGIN}/post/${postId}`;
export const TERMS_URL = `${WEB_ORIGIN}/terms`;
export const PRIVACY_URL = `${WEB_ORIGIN}/privacy`;

/**
 * Asks the website to draw the post's card image now (the post page and link
 * previews show it), so it's ready before anyone opens a shared link. Fire and
 * forget: the website draws it on first view anyway.
 */
export function prepareCardImage(postId: string) {
  fetch(`${WEB_ORIGIN}/api/card?id=${encodeURIComponent(postId)}&warm=1`).catch(() => {});
}
