// log_vertical_coverage.js
// Updated script: reads coverage summary, aggregates by top-level directory (vertical),
// writes/appends rows to vertical-coverage-log.md at project root, and confirms success.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Resolve paths explicitly to project root
const projectRoot = path.resolve(__dirname);
const coveragePath = path.join(projectRoot, 'coverage', 'coverage-summary.json');
const logPath = path.join(projectRoot, 'vertical-coverage-log.md');

if (!fs.existsSync(coveragePath)) {
  console.error('Coverage summary not found:', coveragePath);
  process.exit(1);
}

// Read and parse coverage summary
let coverageData;
try {
  coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
} catch (e) {
  console.error('Failed to parse coverage summary:', e);
  process.exit(1);
}

// Aggregate coverage by first directory segment (vertical)
const verticals = {};
Object.entries(coverageData).forEach(([file, data]) => {
  if (file === 'total') return; // skip global total
  // Jest always uses POSIX separators '/' regardless of OS
  const parts = file.split('/');
  const vertical = parts[0] || 'root';
  if (!verticals[vertical]) {
    verticals[vertical] = { pct: 0 };
  }
  if (data && data.statements && typeof data.statements.pct === 'number') {
    verticals[vertical].pct = data.statements.pct;
  }
});

// Obtener SHA y fecha

const sha = execSync('git rev-parse --short HEAD').toString().trim();
const iso = new Date().toISOString();


let logContent = '';
if (!fs.existsSync(logPath)) {
  logContent += '# Registro de Cobertura por Vertical\n\n';
  logContent += '| Vertical | Cobertura líneas % | Fecha ISO | Commit SHA |\n';
  logContent += '|----------|-------------------|-----------|------------|\n';
} else {
  logContent = fs.readFileSync(logPath, { encoding: 'utf8' });
}

let rowsAdded = 0;
Object.entries(verticals).forEach(([vert, data]) => {
  const pct = typeof data.pct === 'number' ? data.pct.toFixed(2) : '0.00';
  const row = `| ${vert} | ${pct}% | ${iso} | ${sha} |`;
  const regex = new RegExp(`\\|\\s*${vert}\\s*\\|[^\\n]*${iso}[^\\n]*`, 'i');
  if (regex.test(logContent)) {
    logContent = logContent.replace(regex, row);
  } else {
    logContent += `${row}\n`;
    rowsAdded++;
  }
});

const testOutputPath = path.join(projectRoot, 'test_output.txt');
if (fs.existsSync(testOutputPath)) {
  const testOutput = fs.readFileSync(testOutputPath, 'utf8');
  const failureLines = testOutput.split(/\r?\n/).filter(line => /FAIL|Error|error|exception/i.test(line));
  if (failureLines.length > 0) {
    const failureSection = `\n## ❌ Fallos de Tests\n\n\`\`\`\n${failureLines.join('\n')}\n\`\`\`\n`;
    if (!logContent.includes('## ❌ Fallos de Tests')) {
      logContent += failureSection;
    } else {
      // Replace existing failure section
      logContent = logContent.replace(/## ❌ Fallos de Tests[\s\S]*?```[\s\S]*?```/, failureSection);
    }
    console.log('✅ Test failures appended to coverage log.');
  }
}
fs.writeFileSync(logPath, logContent, { encoding: 'utf8' });
console.log('✅ Vertical coverage log updated successfully.');
console.log(`Rows added: ${rowsAdded}`);
