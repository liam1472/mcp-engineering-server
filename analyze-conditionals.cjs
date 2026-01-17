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
console.log('=== All Lines ===');
Object.keys(byLine)
  .sort((a, b) => parseInt(a) - parseInt(b))
  .forEach(line => {
    const mutants = byLine[line];
    console.log(`Line ${line}: ${mutants.map(m => m.replacement).join(', ')}`);
  });

console.log('\n=== Defensive vs Testable ===');
const defensive = [];
const testable = [];

Object.entries(byLine).forEach(([line, mutants]) => {
  const lineNum = parseInt(line);
  // Defensive checks (hard to kill)
  if (lineNum >= 622 && lineNum <= 651) {
    defensive.push({ line: lineNum, count: mutants.length, type: 'summary generation' });
  } else if (lineNum === 592 || lineNum === 594) {
    defensive.push({ line: lineNum, count: mutants.length, type: 'array bounds' });
  } else {
    testable.push({ line: lineNum, count: mutants.length, mutants });
  }
});

console.log(`\nDefensive (hard to kill): ${defensive.length} lines`);
defensive.forEach(d => {
  console.log(`  Line ${d.line}: ${d.count} mutants (${d.type})`);
});

console.log(`\nTestable: ${testable.length} lines`);
testable.forEach(t => {
  console.log(`  Line ${t.line}: ${t.count} mutants - ${t.mutants.map(m => m.replacement).join(', ')}`);
});
