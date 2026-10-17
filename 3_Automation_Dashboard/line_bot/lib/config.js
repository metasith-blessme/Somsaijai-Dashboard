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
    geminiModel: env.GEMINI_MODEL || env.GEMINI_OCR_MODEL || 'gemini-3.5-flash',
    geminiFallbackModel: env.GEMINI_MODEL_FALLBACK || 'gemini-3.8-flash',
    minimaxKey: env.MINIMAX_API_KEY || '',
    minimaxModel: env.MINIMAX_MODEL || 'MiniMax-M2',
    allowDeploy: env.LINE_BOT_ALLOW_DEPLOY === '1',
    // Pushing the commit to main already starts the Vercel Git deploy.
    // The bot calls the deployments API only when this is exactly "1".
    vercelApiDeploy: env.LINE_BOT_VERCEL_DEPLOY === '1',
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

function parseGroupConfig(raw) {
  const table = new Map();
  for (const part of String(raw || '').split(',')) {
    const token = part.trim();
    if (!token) continue;
    const match = token.match(/^([^:\s]+?)(?::(B[123]))?$/i);
    if (!match) continue;
    table.set(match[1], match[2] ? match[2].toUpperCase() : null);
  }
  return table;
}

module.exports = { loadConfig, parseGroupConfig };
