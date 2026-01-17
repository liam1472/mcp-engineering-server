const fs = require('fs');

const data = JSON.parse(fs.readFileSync('reports/mutation/mutation.json', 'utf-8'));
const file = data.files['src/security/scanner.ts'];

const conditionals = file.mutants.filter(
  m => m.mutatorName === 'ConditionalExpression' && m.status === 'Survived'
);

console.log(`=== ConditionalExpression Survived: ${conditionals.length} ===\n`);

// Group by line
const byLine = {};
conditionals.forEach(m => {
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
Object.keys(byLine)
  .sort((a, b) => parseInt(a) - parseInt(b))
  .forEach(line => {
    const mutants = byLine[line];
    console.log(`Line ${line}: ${mutants.map(m => m.replacement).join(', ')} (${mutants.length} mutants)`);
  });

console.log('\n=== Top 10 Most Frequent Lines ===');
const sorted = Object.entries(byLine).sort((a, b) => b[1].length - a[1].length);
sorted.slice(0, 10).forEach(([line, mutants]) => {
  console.log(`Line ${line}: ${mutants.length} mutants`);
});
