// simple_log.js
// Generates/updates vertical-coverage-log.md with coverage % and test failures.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Resolve paths relative to the project root (current working directory)
const COVERAGE_SUMMARY = path.resolve(process.cwd(), 'coverage', 'coverage-summary.json');
const TEST_OUTPUT = path.resolve(process.cwd(), 'test_output.txt');
const LOG_FILE = path.resolve(process.cwd(), 'vertical-coverage-log.md');

function readCoverageSummary() {
  try {
    return JSON.parse(fs.readFileSync(COVERAGE_SUMMARY, 'utf8'));
  } catch (e) {
    console.error('❌ Unable to read coverage-summary.json:', e.message);
    return null;
  }
}

function extractFailures() {
  if (!fs.existsSync(TEST_OUTPUT)) return [];
  const raw = fs.readFileSync(TEST_OUTPUT, 'utf8');
  const lines = raw.split(/\r?\n/);
  const failRegex = /\bFAIL\b|Error|exception/i;
  return lines.filter(l => failRegex.test(l.replace(/\x1b\[[0-9;]*m/g, '')));
}

function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: process.cwd() }).toString().trim();
  } catch (_) {
    return 'unknown';
  }
}

function updateLog(pct, failures) {
  const dateIso = new Date().toISOString();
  const sha = getGitSha();
  const header = '| Cobertura statements % | Fecha ISO | Commit SHA |\n|------------------------|-----------|------------|';
  const row = `| ${pct.toFixed(2)}% | ${dateIso} | ${sha} |`;
  let content = '# Registro de Cobertura\n\n' + header + '\n' + row + '\n\n';
  if (failures.length > 0) {
    content += '## ❌ Fallos de Tests\n\n```\n' + failures.join('\n') + '\n```\n';
  }
  fs.writeFileSync(LOG_FILE, content, 'utf8');
  console.log('✅ vertical-coverage-log.md actualizado');
}

function main() {
  const summary = readCoverageSummary();
  if (!summary) return;
  const statementsPct = summary.total?.statements?.pct;
  if (typeof statementsPct !== 'number') {
    console.error('❌ statements.pct not found in coverage-summary.json');
    return;
  }
  const failures = extractFailures();
  updateLog(statementsPct, failures);
}

main();

function readCoverageSummary() {
  try {
    return JSON.parse(fs.readFileSync(COVERAGE_SUMMARY, 'utf8'));
  } catch (e) {
    console.error('❌ Unable to read coverage-summary.json:', e.message);
    return null;
  }
}

function extractFailures() {
  if (!fs.existsSync(TEST_OUTPUT)) return [];
  const raw = fs.readFileSync(TEST_OUTPUT, 'utf8');
  const lines = raw.split(/\r?\n/);
  const failRegex = /\bFAIL\b|Error|exception/i;
  return lines.filter(l => failRegex.test(l.replace(/\x1b\[[0-9;]*m/g, '')));
}

function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: process.cwd() }).toString().trim();
  } catch (_) {
    return 'unknown';
  }
}

function updateLog(pct, failures) {
  const dateIso = new Date().toISOString();
  const sha = getGitSha();
  const header = '| Cobertura statements % | Fecha ISO | Commit SHA |\n|------------------------|-----------|------------|';
  const row = `| ${pct.toFixed(2)}% | ${dateIso} | ${sha} |`;
  let content = '# Registro de Cobertura\n\n' + header + '\n' + row + '\n\n';
  if (failures.length > 0) {
    content += '## ❌ Fallos de Tests\n\n```\n' + failures.join('\n') + '\n```\n';
  }
  fs.writeFileSync(LOG_FILE, content, 'utf8');
  console.log('✅ vertical-coverage-log.md actualizado');
}

function main() {
  const summary = readCoverageSummary();
  if (!summary) return;
  const statementsPct = summary.total?.statements?.pct;
  if (typeof statementsPct !== 'number') {
    console.error('❌ statements.pct not found in coverage-summary.json');
    return;
  }
  const failures = extractFailures();
  updateLog(statementsPct, failures);
}

main();
