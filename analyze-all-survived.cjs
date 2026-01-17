const fs = require('fs');

const data = JSON.parse(fs.readFileSync('reports/mutation/mutation.json', 'utf-8'));
const file = data.files['src/security/scanner.ts'];

const survived = file.mutants.filter(m => m.status === 'Survived');

console.log(`=== All Survived Mutants: ${survived.length} ===\n`);

// Group by type
const byType = {};
survived.forEach(m => {
  if (!byType[m.mutatorName]) {
    byType[m.mutatorName] = [];
  }
  byType[m.mutatorName].push(m);
});

console.log('=== By Type (High to Low) ===');
Object.entries(byType)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([type, mutants]) => {
    const impact = (mutants.length / 548 * 100).toFixed(2);
    console.log(`${type}: ${mutants.length} mutants (+${impact}%)`);
  });

console.log('\n=== Top 5 Mutation Types for Phase 7 ===');
const top5 = Object.entries(byType)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 5);

top5.forEach(([type, mutants], idx) => {
  console.log(`\n${idx + 1}. ${type} (${mutants.length} mutants)`);

  // Show first 5 lines
  const byLine = {};
  mutants.forEach(m => {
    const line = m.location.start.line;
    if (!byLine[line]) byLine[line] = [];
    byLine[line].push(m);
  });

  const topLines = Object.keys(byLine)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .slice(0, 5);

  topLines.forEach(line => {
    console.log(`  Line ${line}: ${byLine[line].length} mutants`);
  });

  if (Object.keys(byLine).length > 5) {
    console.log(`  ... and ${Object.keys(byLine).length - 5} more lines`);
  }
});
