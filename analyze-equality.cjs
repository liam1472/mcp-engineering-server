const fs = require('fs');

const data = JSON.parse(fs.readFileSync('reports/mutation/mutation.json', 'utf-8'));
const file = data.files['src/security/scanner.ts'];

const equality = file.mutants.filter(
  m => m.mutatorName === 'EqualityOperator' && m.status === 'Survived'
);

console.log(`=== EqualityOperator Survived: ${equality.length} ===\n`);

// Group by line
const byLine = {};
equality.forEach(m => {
  const line = m.location.start.line;
  if (!byLine[line]) {
    byLine[line] = [];
  }
  byLine[line].push({
    replacement: m.replacement,
    id: m.id
  });
});

// Show sorted by line
console.log('=== By Line ===');
Object.keys(byLine)
  .sort((a, b) => parseInt(a) - parseInt(b))
  .forEach(line => {
    const mutants = byLine[line];
    console.log(`Line ${line}: ${mutants.map(m => m.replacement).join(', ')} (${mutants.length} mutants)`);
  });

console.log('\n=== All Details ===');
equality.forEach((m, i) => {
  console.log(`${i + 1}. Line ${m.location.start.line}: ${m.mutatorName}`);
  console.log(`   ID: ${m.id}`);
  console.log(`   Replacement: ${m.replacement}`);
});
