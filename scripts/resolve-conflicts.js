const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node resolve-conflicts.js <file>');
  process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');
let iterations = 0;

while (content.includes('<<<<<<<')) {
  iterations++;
  if (iterations > 100) throw new Error('Too many conflict iterations');

  const start = content.indexOf('<<<<<<<');
  const mid = content.indexOf('=======', start);
  const end = content.indexOf('>>>>>>>', mid);
  if (mid === -1 || end === -1) throw new Error('Malformed conflict marker');

  const ours = content.slice(content.indexOf('\n', start) + 1, mid).replace(/\n$/, '');
  const theirs = content.slice(content.indexOf('\n', mid) + 1, end).replace(/\n$/, '');

  let merged;
  if (!theirs.trim()) {
    merged = ours;
  } else if (!ours.trim()) {
    merged = theirs;
  } else {
    merged = `${ours}\n${theirs}`;
  }

  content = content.slice(0, start) + merged + content.slice(content.indexOf('\n', end) + 1);
}

fs.writeFileSync(file, content);
console.log(`Resolved conflicts in ${path.basename(file)} (${iterations} blocks)`);
