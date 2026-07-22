const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../shared');
const dest = path.resolve(__dirname, '../src/vendor/shared');

function copySourceFiles(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copySourceFiles(srcPath, destPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.json')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync(dest, { recursive: true, force: true });
copySourceFiles(src, dest);
console.log('Copied shared/ (.ts and .json) into server/src/vendor/shared/');
