import { marked } from 'marked';

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

marked.setOptions({ gfm: true, breaks: true });

// AI-generated markdown is untrusted: a prompt-injectable ticket title
// rendered through marked's default html renderer would allow script execution.
marked.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
});

export function renderMarkdown(input: string): string {
  return marked.parse(input, { async: false }) as string;
}
