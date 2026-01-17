const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./reports/mutation/mutation.json', 'utf-8'));
const scanner = data.files['src/security/scanner.ts'];
const survived = scanner.mutants.filter(m => m.status === 'Survived');

// Show mutants for lines 405-500 (applyFixes function)
console.log('=== applyFixes() Survived Mutants (Lines 405-500) ===\n');

const applyFixesMutants = survived.filter(m => m.location.start.line >= 405 && m.location.start.line <= 500);

applyFixesMutants.forEach((m, i) => {
  console.log(`${i + 1}. Line ${m.location.start.line} (${m.mutatorName})`);
  console.log(`   Original: ${m.replacement === '' ? '<empty>' : m.replacement.substring(0, 100)}`);
  if (m.statusReason) {
    console.log(`   Reason: ${m.statusReason.substring(0, 100)}`);
  }
  console.log('');
});

console.log(`\nTotal: ${applyFixesMutants.length} mutants in this range`);
