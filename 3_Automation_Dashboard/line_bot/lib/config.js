const path = require('path');

function loadConfig(env = process.env) {
  return {
    channelSecret: env.LINE_CHANNEL_SECRET || '',
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN || '',
    ownerUserId: env.LINE_OWNER_USER_ID || '',
    groupId: env.LINE_GROUP_ID || '',
    orderSenderUserIds: String(env.LINE_ORDER_SENDER_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    suppliersPath: env.LINE_ORDER_SUPPLIERS_PATH || path.join(__dirname, '..', 'orders', 'suppliers.json'),
    geminiKey: env.GEMINI_API_KEY || '',
    geminiModel: env.GEMINI_OCR_MODEL || 'gemini-3.5-flash',
    allowDeploy: env.LINE_BOT_ALLOW_DEPLOY === '1',
    githubToken: env.GITHUB_TOKEN || '',
    githubRepo: env.GITHUB_REPO || '',
    githubBranch: env.GITHUB_BRANCH || 'main',
    vercelToken: env.VERCEL_TOKEN || '',
    vercelScope: env.VERCEL_SCOPE || 'parn',
    vercelProjectId: env.VERCEL_PROJECT_ID || '',
    publicUrl: (env.LINE_BOT_PUBLIC_URL || 'https://somsaijailive.vercel.app').replace(/\/$/, ''),
    dashboardDir: env.SOMSAIJAI_DASHBOARD_DIR || path.join(__dirname, '..', '..'),
  };
}

module.exports = { loadConfig };
