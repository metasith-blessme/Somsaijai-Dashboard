const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'pending_verification.json');
if (!fs.existsSync(file)) {
  console.log('No pending_verification.json found');
  process.exit();
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log(`Staging contains ${data.length} entries.`);

// Group by branch
const byBranch = { B1: [], B2: [] };
data.forEach(d => {
  if (byBranch[d.branch]) byBranch[d.branch].push(d);
  else console.log('Unknown branch:', d.branch, d.date);
});

console.log('\n--- BRANCH 1 (B1) SALES ---');
byBranch.B1.sort((a,b) => a.date.localeCompare(b.date)).forEach(d => {
  console.log(`Date: ${d.date} | Day: ${d.day} | Rev: ${d.rev} | Cash: ${d.cash} | Scan: ${d.scan} | Exp: ${d.exp} | Cups: ${d.tot} | Verified: ${d.verified} | Source: ${d.source}`);
});

console.log('\n--- BRANCH 2 (B2) SALES ---');
byBranch.B2.sort((a,b) => a.date.localeCompare(b.date)).forEach(d => {
  console.log(`Date: ${d.date} | Day: ${d.day} | Rev: ${d.rev} | Cash: ${d.cash} | Scan: ${d.scan} | Exp: ${d.exp} | Cups: ${d.tot} | Verified: ${d.verified} | Source: ${d.source}`);
});
