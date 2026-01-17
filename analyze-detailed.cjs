const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./reports/mutation/mutation.json', 'utf-8'));
const scanner = data.files['src/security/scanner.ts'];
const survived = scanner.mutants.filter(m => m.status === 'Survived');

// Group by function based on line ranges
const functionRanges = {
  'setProfile (230-259)': { start: 230, end: 259, mutants: [] },
  'autoDetectProfile (264-282)': { start: 264, end: 282, mutants: [] },
  'scan (284-310)': { start: 284, end: 310, mutants: [] },
  'scanFile (312-375)': { start: 312, end: 375, mutants: [] },
  'maskSecret (377-403)': { start: 377, end: 403, mutants: [] },
  'applyFixes (405-672)': { start: 405, end: 672, mutants: [] },
  'generateFixes (674-813)': { start: 674, end: 813, mutants: [] },
  'generateCodeReplacement (815-910)': { start: 815, end: 910, mutants: [] },
};

survived.forEach(m => {
  const line = m.location.start.line;
  for (const [funcName, range] of Object.entries(functionRanges)) {
    if (line >= range.start && line <= range.end) {
      range.mutants.push(m);
      break;
    }
  }
});

console.log('=== Survived Mutants by Function ===\n');
Object.entries(functionRanges)
  .filter(([_, range]) => range.mutants.length > 0)
  .sort((a, b) => b[1].mutants.length - a[1].mutants.length)
  .forEach(([funcName, range]) => {
    console.log(`${funcName}: ${range.mutants.length} survived`);

    const byType = {};
    range.mutants.forEach(m => {
      byType[m.mutatorName] = (byType[m.mutatorName] || 0) + 1;
    });

    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

    console.log('  Sample mutants:');
    range.mutants.slice(0, 5).forEach(m => {
      console.log(`    Line ${m.location.start.line}: ${m.mutatorName} => ${m.replacement.substring(0, 50)}`);
    });
    console.log('');
  });
