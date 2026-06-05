const ImageExtractorAgent = require('./ImageExtractorAgent');
const DataSyncAgent = require('./DataSyncAgent');
const QADeployerAgent = require('./QADeployerAgent');
const { execSync } = require('child_process');

async function runPipeline() {
    console.log("=== SomSaiJai 4-Agent Pipeline ===");
    const imageArg = process.argv[2];
    
    // 1. Extract
    const extractor = new ImageExtractorAgent();
    let pendingData = null;
    if (imageArg) {
        pendingData = await extractor.processImage(imageArg);
        console.log("[Pipeline] Extracted:", pendingData);
    } else {
        console.log("[Pipeline] No image provided. Skipping ImageExtractor.");
        pendingData = require('../../pending_verification.json');
    }

    // 2. Sync
    const syncer = new DataSyncAgent();
    const syncPlan = await syncer.syncData(pendingData);
    console.log("[Pipeline] Sync Plan:", syncPlan);
    // In full implementation, we'd execute the returned plan here.
    // For now we fall back to existing script to ensure safety:
    execSync('npm run verify-sales', { stdio: 'inherit' });

    // 3. QA & Deploy
    const deployer = new QADeployerAgent();
    const deployStatus = await deployer.deployAndVerify();
    console.log("[Pipeline] Deploy Status:", deployStatus);

    // 4. Docs (Python Agent)
    console.log("[Pipeline] Calling DocGenAgent.py...");
    execSync('python3 Sales_System_Automation/agents/DocGenAgent.py', { stdio: 'inherit' });
    
    console.log("=== Pipeline Complete ===");
}

runPipeline().catch(console.error);
