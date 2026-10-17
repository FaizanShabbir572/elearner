import "server-only";
import { Marked } from "marked";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Raw HTML in lesson content is shown as text rather than executed, and only http(s)/mailto links are kept.
const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link(token) {
      const inner = this.parser.parseInline(token.tokens);
      if (!/^(https?:|mailto:|\/|#)/i.test(token.href)) return inner;
      return `<a href="${escapeHtml(token.href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    },
    image({ href, text }) {
      if (!/^https?:/i.test(href)) return escapeHtml(text);
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" />`;
    },
  },
});

export function renderMarkdown(src: string) {
  return md.parse(src || "", { async: false }) as string;
}
