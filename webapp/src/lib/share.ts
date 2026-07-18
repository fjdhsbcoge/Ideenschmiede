// Teilen-Helfer: Deep-Link-URLs und Plattform-Targets
// Hinweis: Plattform-Namen sind Eigennamen und werden nicht übersetzt.

export interface ShareTarget {
  name: string;
  icon: string;
  buildUrl: (url: string, text: string) => string;
}

export const SHARE_TARGETS: ShareTarget[] = [
  { name: 'X', icon: '𝕏', buildUrl: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { name: 'Facebook', icon: '📘', buildUrl: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { name: 'LinkedIn', icon: '💼', buildUrl: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { name: 'WhatsApp', icon: '💬', buildUrl: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { name: 'Telegram', icon: '✈️', buildUrl: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { name: 'Reddit', icon: '🤖', buildUrl: (u, t) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}` },
  { name: 'Mastodon', icon: '🐘', buildUrl: (u, t) => `https://mastodonshare.com/?text=${encodeURIComponent(`${t} ${u}`)}` },
];

/** Absolute Deep-Link-URL zu einer Idee (HashRouter-kompatibel). */
export function ideaShareUrl(ideaId: string): string {
  return `${window.location.origin}${window.location.pathname}#/idea/${ideaId}`;
}

/** E-Mail ist kein Web-Target – eigenes handling im ShareMenu. */
export function emailShareUrl(url: string, subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n${url}`)}`;
}
