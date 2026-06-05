const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = path.join(__dirname, '..', '..', '..');
const SCRIPTS_DIR = __dirname;

function cleanupLockFiles() {
    console.log('🧹 Checking for Excel lock files...');
    const files = fs.readdirSync(DASHBOARD_DIR);
    const lockFiles = files.filter(f => f.startsWith('.~lock') || f.endsWith('.lock'));
    
    if (lockFiles.length > 0) {
        lockFiles.forEach(f => {
            try {
                fs.unlinkSync(path.join(DASHBOARD_DIR, f));
                console.log(`   ✅ Removed lock file: ${f}`);
            } catch (e) {
                console.warn(`   ⚠️ Could not remove ${f}: ${e.message}`);
            }
        });
    } else {
        console.log('   ✅ No lock files found.');
    }
}

function runStep(name, command) {
    console.log(`\n🚀 Step: ${name}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: DASHBOARD_DIR });
        return true;
    } catch (e) {
        console.error(`\n❌ ${name} failed. Stopping sync.`);
        return false;
    }
}

async function sync() {
    console.log('=== SomSaiJai Master Sync & Deploy ===\n');
    
    cleanupLockFiles();

    // 1. Verify Sales (Move from pending to Excel)
    if (!runStep('Verifying Sales', 'node Sales_System_Automation/ocr-sales-dashboard/scripts/verify_sales.js')) return;

    // 2. Update Dashboard & Deploy (Excel to JSON + Vercel)
    if (!runStep('Updating Dashboard & Deploying', 'node Sales_System_Automation/ocr-sales-dashboard/scripts/update_dashboard.js')) return;

    console.log('\n✨ Sync and Deployment Complete!');
}

sync();
