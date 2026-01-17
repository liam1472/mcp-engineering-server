const fs = require('fs');

const data = JSON.parse(fs.readFileSync('reports/mutation/mutation.json', 'utf-8'));
const file = data.files['src/security/scanner.ts'];

const stringLit = file.mutants.filter(
  m => m.mutatorName === 'StringLiteral' && (m.status === 'Survived' || m.status === 'NoCoverage')
);

console.log(`=== StringLiteral (Survived + NoCoverage): ${stringLit.length} ===\n`);

// Group by status
const byStatus = {
  Survived: stringLit.filter(m => m.status === 'Survived'),
  NoCoverage: stringLit.filter(m => m.status === 'NoCoverage')
};

console.log(`Survived: ${byStatus.Survived.length}`);
console.log(`NoCoverage: ${byStatus.NoCoverage.length}\n`);

// Group by line
const byLine = {};
stringLit.forEach(m => {
  const line = m.location.start.line;
  if (!byLine[line]) {
    byLine[line] = [];
  }
  byLine[line].push({
    replacement: m.replacement,
    status: m.status,
    id: m.id
  });
});

// Show sorted by line (top 20)
console.log('=== By Line (Top 20) ===');
Object.keys(byLine)
  .sort((a, b) => parseInt(a) - parseInt(b))
  .slice(0, 20)
  .forEach(line => {
    const mutants = byLine[line];
    const status = mutants[0].status;
    console.log(`Line ${line} [${status}]: ${mutants.length} mutants`);
    mutants.forEach(m => {
      console.log(`  → "${m.replacement}"`);
    });
  });

console.log('\n=== High-Value Targets (Functional Strings) ===');
const highValue = stringLit.filter(m => {
  const repl = m.replacement.toLowerCase();
  // Skip error messages (low ROI)
  if (repl.includes('error') || repl.includes('failed') || repl.includes('✗')) {
    return false;
  }
  // Focus on functional strings
  return (
    repl.includes('env') ||
    repl.includes('key') ||
    repl.includes('secret') ||
    repl.includes('pattern') ||
    repl.includes('.') || // file extensions
    m.location.start.line >= 730 && m.location.start.line <= 770 // env var generation area
  );
});

console.log(`Found ${highValue.length} high-value StringLiteral mutants\n`);
highValue.forEach((m, i) => {
  console.log(`${i + 1}. Line ${m.location.start.line} [${m.status}]: "${m.replacement}"`);
});
