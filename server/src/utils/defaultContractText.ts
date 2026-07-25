import { getBrandConfig } from '@maple/shared/brand';

export const DEFAULT_CONTRACT_TEXT = getBrandConfig().contract.defaultContractText;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function emphasizeIfNeeded(text: string): string {
  if (text.includes('!!!')) {
    return `<strong class="contract-emphasis">${text}</strong>`;
  }
  return text;
}

export function formatContractTextForHtml(text: string): string {
  const escaped = escapeHtml(text);
  const lines = escaped.split('\n');
  const parts: string[] = [];
  let inOl = false;
  let inUl = false;

  const closeLists = () => {
    if (inOl) {
      parts.push('</ol>');
      inOl = false;
    }
    if (inUl) {
      parts.push('</ul>');
      inUl = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    const numbered = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    const bullet = /^[•·\-]\s+(.+)$/.exec(trimmed);

    if (numbered) {
      if (!inOl) {
        closeLists();
        parts.push('<ol class="contract-list">');
        inOl = true;
      }
      parts.push(`<li>${emphasizeIfNeeded(numbered[2])}</li>`);
      continue;
    }

    if (bullet) {
      if (!inUl) {
        closeLists();
        parts.push('<ul class="contract-list">');
        inUl = true;
      }
      parts.push(`<li>${emphasizeIfNeeded(bullet[1])}</li>`);
      continue;
    }

    closeLists();
    const content = emphasizeIfNeeded(trimmed);
    if (trimmed.endsWith(':') && trimmed.length < 80) {
      parts.push(`<p class="contract-heading">${content}</p>`);
    } else {
      parts.push(`<p class="contract-para">${content}</p>`);
    }
  }

  closeLists();
  return parts.join('\n');
}
