// fix_jest_mocked.js
// Script to replace jest.mocked(...) usage in test files with the inner expression.
const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(/jest\.mocked\(([^)]+)\)/g, '$1');
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.test.ts')) {
      replaceInFile(fullPath);
    }
  }
}

walk(path.resolve(__dirname, 'servicios'));
walk(path.resolve(__dirname, 'vistas'));
console.log('jest.mocked replacements complete');
