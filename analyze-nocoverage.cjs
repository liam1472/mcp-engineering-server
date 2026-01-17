const fs = require('fs');

const data = JSON.parse(fs.readFileSync('reports/mutation/mutation.json', 'utf-8'));
const file = data.files['src/security/scanner.ts'];

const noCoverage = file.mutants.filter(m => m.status === 'NoCoverage');

console.log(`=== No-Coverage Mutants: ${noCoverage.length} ===\n`);

// Group by type
const byType = {};
noCoverage.forEach(m => {
  if (!byType[m.mutatorName]) {
    byType[m.mutatorName] = [];
  }
  byType[m.mutatorName].push(m);
});

console.log('=== By Type ===');
Object.entries(byType)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([type, mutants]) => {
    console.log(`${type}: ${mutants.length}`);
  });

console.log('\n=== By Line (grouped) ===');
const byLine = {};
noCoverage.forEach(m => {
  const line = m.location.start.line;
  if (!byLine[line]) {
    byLine[line] = [];
  }
  byLine[line].push(m);
});

Object.keys(byLine)
  .sort((a, b) => parseInt(a) - parseInt(b))
  .forEach(line => {
    const mutants = byLine[line];
    const types = mutants.map(m => m.mutatorName).join(', ');
    console.log(`Line ${line}: ${mutants.length} mutants (${types})`);
  });

console.log('\n=== Sample Details (first 20) ===');
noCoverage.slice(0, 20).forEach((m, i) => {
  console.log(`${i + 1}. Line ${m.location.start.line}: ${m.mutatorName}`);
  console.log(`   Replacement: ${m.replacement}`);
});
