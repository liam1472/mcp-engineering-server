const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./reports/mutation/mutation.json', 'utf-8'));
const scanner = data.files['src/security/scanner.ts'];
const survived = scanner.mutants.filter(m => m.status === 'Survived');
const noCoverage = scanner.mutants.filter(m => m.status === 'NoCoverage');

console.log('=== Scanner.ts Mutation Analysis ===');
console.log('Total mutants:', scanner.mutants.length);
console.log('Survived:', survived.length);
console.log('No Coverage:', noCoverage.length);
console.log('Killed:', scanner.mutants.filter(m => m.status === 'Killed').length);

console.log('\n=== Survived Mutants by Type ===');
const survivedByType = {};
survived.forEach(m => {
  survivedByType[m.mutatorName] = (survivedByType[m.mutatorName] || 0) + 1;
});
Object.entries(survivedByType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
  console.log(`${type}: ${count}`);
});

console.log('\n=== No Coverage Mutants by Type ===');
const noCoverageByType = {};
noCoverage.forEach(m => {
  noCoverageByType[m.mutatorName] = (noCoverageByType[m.mutatorName] || 0) + 1;
});
Object.entries(noCoverageByType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
  console.log(`${type}: ${count}`);
});

console.log('\n=== Survived Mutants by Line Range ===');
const lineRanges = {
  '1-200': 0,
  '201-400': 0,
  '401-600': 0,
  '601-800': 0,
  '801-1000': 0
};
survived.forEach(m => {
  const line = m.location.start.line;
  if (line <= 200) lineRanges['1-200']++;
  else if (line <= 400) lineRanges['201-400']++;
  else if (line <= 600) lineRanges['401-600']++;
  else if (line <= 800) lineRanges['601-800']++;
  else lineRanges['801-1000']++;
});
Object.entries(lineRanges).forEach(([range, count]) => {
  console.log(`Lines ${range}: ${count}`);
});

console.log('\n=== Sample Survived Mutants ===');
survived.slice(0, 20).forEach((m, i) => {
  console.log(`${i+1}. Line ${m.location.start.line}: ${m.mutatorName}`);
  console.log(`   Replacement: ${m.replacement.substring(0, 80)}`);
});
