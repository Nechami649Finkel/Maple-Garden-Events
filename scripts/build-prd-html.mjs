import { readFileSync, writeFileSync } from 'fs';

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function parseTable(lines) {
  const rows = lines.filter(l => l.trim());
  if (rows.length < 2) return '';
  const header = rows[0].split('|').slice(1, -1).map(c => c.trim());
  const body = rows.slice(2).map(row =>
    row.split('|').slice(1, -1).map(c => inline(c.trim()))
  );
  let html = '<table><thead><tr>';
  header.forEach(h => { html += `<th>${inline(h)}</th>`; });
  html += '</tr></thead><tbody>';
  body.forEach(row => {
    html += '<tr>';
    row.forEach(c => { html += `<td>${c}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/).map(l => l.trimEnd());
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push(`<pre><code>${codeLines.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
      i++;
      continue;
    }

    if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      out.push(parseTable(tableLines));
      continue;
    }

    if (line.startsWith('### ')) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
      i++; continue;
    }

    if (line.startsWith('> ')) {
      const bq = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bq.push(inline(lines[i].slice(2)));
        i++;
      }
      out.push(`<blockquote><p>${bq.join('<br>')}</p></blockquote>`);
      continue;
    }

    if (line === '---' || line === '***') {
      out.push('<hr>');
      i++; continue;
    }

    if (/^[-*] /.test(lines[i])) {
      out.push('<ul>');
      while (i < lines.length && /^[-*] /.test(lines[i].trimEnd())) {
        out.push(`<li>${inline(lines[i].trim().replace(/^[-*] /, ''))}</li>`);
        i++;
      }
      out.push('</ul>');
      continue;
    }

    if (line.trim() === '') {
      i++; continue;
    }

    out.push(`<p>${inline(line)}</p>`);
    i++;
  }

  return out.join('\n');
}

const md = readFileSync('PRD.md', 'utf8');
const body = mdToHtml(md);

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>מסמך אפיון מערכת — מיפל גן אירועים בעיר</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --green: #8CBF8E;
      --green-dark: #6BA86E;
      --green-deep: #4F8F52;
      --bg: #F7F8F6;
      --surface: #FFFFFF;
      --text: #2D3748;
      --text-secondary: #4A5568;
      --text-muted: #718096;
      --danger: #E53E3E;
      --warning: #DD6B20;
      --info: #4A6FA5;
      --border: #E2E8F0;
      --shadow: 0 4px 24px rgba(45, 55, 72, 0.08);
      --radius: 12px;
      --sidebar-width: 280px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }

    body {
      font-family: 'Heebo', 'Segoe UI', Tahoma, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.75;
      font-size: 16px;
    }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: linear-gradient(135deg, var(--green-deep) 0%, var(--green-dark) 60%, var(--green) 100%);
      color: #fff;
      padding: 1.25rem 2rem;
      box-shadow: 0 2px 16px rgba(79, 143, 82, 0.35);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .brand { display: flex; align-items: center; gap: 0.75rem; }

    .brand-icon {
      width: 44px; height: 44px;
      background: rgba(255,255,255,0.2);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem;
    }

    .brand h1 { font-size: 1.35rem; font-weight: 700; line-height: 1.3; }
    .brand p { font-size: 0.85rem; opacity: 0.85; font-weight: 300; }

    .meta-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .badge {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 20px;
      padding: 0.25rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .layout {
      display: flex;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 80px);
    }

    .sidebar {
      width: var(--sidebar-width);
      flex-shrink: 0;
      position: sticky;
      top: 80px;
      height: calc(100vh - 80px);
      overflow-y: auto;
      background: var(--surface);
      border-left: 1px solid var(--border);
      padding: 1.5rem 1rem;
      box-shadow: var(--shadow);
    }

    .sidebar h2 {
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .toc { list-style: none; }
    .toc li { margin-bottom: 0.15rem; }

    .toc a {
      display: block;
      padding: 0.35rem 0.6rem;
      border-radius: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      transition: background 0.15s, color 0.15s;
      border-right: 3px solid transparent;
    }

    .toc a:hover, .toc a.active {
      background: #EDF7ED;
      color: var(--green-deep);
      border-right-color: var(--green);
      font-weight: 600;
    }

    .toc .toc-h1 a { font-weight: 600; color: var(--text); font-size: 0.9rem; }
    .toc .toc-h2 a { padding-right: 1.2rem; }
    .toc .toc-h3 a { padding-right: 2rem; font-size: 0.8rem; color: var(--text-muted); }

    .content { flex: 1; padding: 2.5rem 3rem 4rem; min-width: 0; }

    h1 {
      font-size: 2rem; font-weight: 700; color: var(--green-deep);
      margin: 2.5rem 0 1rem; padding: 1.25rem 1.5rem;
      background: var(--surface); border-radius: var(--radius);
      box-shadow: var(--shadow); border-right: 5px solid var(--green);
      scroll-margin-top: 90px;
    }

    h1:first-of-type { margin-top: 0; }

    h2 {
      font-size: 1.45rem; font-weight: 600; color: var(--green-dark);
      margin: 2rem 0 0.75rem; scroll-margin-top: 90px;
    }

    h3 {
      font-size: 1.15rem; font-weight: 600; color: var(--text);
      margin: 1.5rem 0 0.5rem; scroll-margin-top: 90px;
    }

    p { margin: 0.75rem 0; }
    strong { font-weight: 600; }

    hr { border: none; border-top: 2px solid var(--border); margin: 2rem 0; }

    ul, ol { margin: 0.75rem 0 0.75rem 1.5rem; }
    li { margin-bottom: 0.35rem; }

    .table-wrap {
      overflow-x: auto; margin: 1.25rem 0;
      border-radius: var(--radius); box-shadow: var(--shadow);
      border: 1px solid var(--border);
    }

    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; background: var(--surface); }

    thead tr { background: linear-gradient(135deg, var(--green-deep), var(--green-dark)); color: #fff; }
    th { padding: 0.75rem 1rem; text-align: right; font-weight: 600; white-space: nowrap; }
    td { padding: 0.65rem 1rem; border-bottom: 1px solid var(--border); vertical-align: top; color: var(--text-secondary); }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #F0FAF0; }
    tbody tr:nth-child(even) td { background: #FAFBFA; }

    code {
      font-family: 'Cascadia Code', Consolas, monospace;
      font-size: 0.85em; background: #EDF2F7; color: var(--green-deep);
      padding: 0.15em 0.45em; border-radius: 5px; direction: ltr; display: inline-block;
    }

    pre {
      background: #1A202C; color: #E2E8F0;
      padding: 1.25rem 1.5rem; border-radius: var(--radius);
      overflow-x: auto; margin: 1.25rem 0; box-shadow: var(--shadow);
      direction: ltr; text-align: left; font-size: 0.85rem; line-height: 1.6;
    }

    pre code { background: none; color: inherit; padding: 0; }

    blockquote {
      background: linear-gradient(to left, #FFF8F0, #FFFAF5);
      border-right: 4px solid var(--warning);
      border-radius: 0 var(--radius) var(--radius) 0;
      padding: 1rem 1.25rem; margin: 1.25rem 0; color: var(--text-secondary);
    }

    blockquote p { margin: 0; }

    .site-footer {
      text-align: center; padding: 2rem; color: var(--text-muted);
      font-size: 0.85rem; border-top: 1px solid var(--border); background: var(--surface);
    }

    @media print {
      .sidebar, .site-header { display: none; }
      .content { padding: 1rem; }
      .layout { display: block; }
    }

    @media (max-width: 900px) {
      .layout { flex-direction: column; }
      .sidebar { position: static; width: 100%; height: auto; border-left: none; border-bottom: 1px solid var(--border); }
      .content { padding: 1.5rem 1.25rem 3rem; }
    }

    .sidebar::-webkit-scrollbar { width: 4px; }
    .sidebar::-webkit-scrollbar-thumb { background: var(--green); border-radius: 4px; }
  </style>
</head>
<body>

  <header class="site-header">
    <div class="brand">
      <div class="brand-icon">🍁</div>
      <div>
        <h1>מיפל — גן אירועים בעיר</h1>
        <p>מסמך אפיון מערכת (PRD) · Maple Garden Events</p>
      </div>
    </div>
    <div class="meta-badges">
      <span class="badge">גרסה 1.1</span>
      <span class="badge">8 ביולי 2026</span>
      <span class="badge">מאושר תפעולית</span>
    </div>
  </header>

  <div class="layout">
    <nav class="sidebar" id="sidebar">
      <h2>תוכן עניינים</h2>
      <ul class="toc" id="toc"></ul>
    </nav>
    <main class="content" id="content">
      ${body}
    </main>
  </div>

  <footer class="site-footer">
    מסמך זה נכתב על בסיס הקוד הקיים בפרויקט Maple-Garden-Events ומפרט העיצוב ב-STITCH-SPEC.md · גרסה 1.1
  </footer>

  <script>
    document.querySelectorAll('#content table').forEach(t => {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });

    const toc = document.getElementById('toc');
    document.querySelectorAll('#content h1, #content h2, #content h3').forEach((h, i) => {
      if (!h.id) h.id = 'section-' + i;
      const li = document.createElement('li');
      li.className = 'toc-' + h.tagName.toLowerCase();
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      toc.appendChild(li);
    });

    const links = [...toc.querySelectorAll('a')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          const active = toc.querySelector('a[href="#' + e.target.id + '"]');
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-90px 0px -60% 0px' });
    document.querySelectorAll('#content h1, #content h2, #content h3').forEach(h => observer.observe(h));
  </script>
</body>
</html>`;

writeFileSync('PRD.html', html, 'utf8');
console.log('PRD.html created successfully');
