const path = require('path');

function loadConfig(env = process.env) {
  return {
    channelSecret: env.LINE_CHANNEL_SECRET || '',
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN || '',
    ownerUserId: env.LINE_OWNER_USER_ID || '',
    groupId: env.LINE_GROUP_ID || '',
    // Extra approvers (Parn's manager). They get every card Parn gets and can tap อนุมัติ.
    approverUserIds: idList(env.LINE_APPROVER_USER_IDS),
    orderSenderUserIds: idList(env.LINE_ORDER_SENDER_USER_IDS),
    suppliersPath: env.LINE_ORDER_SUPPLIERS_PATH || path.join(__dirname, '..', 'orders', 'suppliers.json'),
    geminiKey: env.GEMINI_API_KEY || '',
    geminiModel: env.GEMINI_MODEL || env.GEMINI_OCR_MODEL || 'gemini-3.5-flash',
    geminiFallbackModel: env.GEMINI_MODEL_FALLBACK || 'gemini-3.8-flash',
    minimaxKey: env.MINIMAX_API_KEY || '',
    minimaxModel: env.MINIMAX_MODEL || 'MiniMax-M3',
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

function idList(raw) {
  return String(raw || '').split(',').map(id => id.trim()).filter(Boolean);
}

/** Parn first, then the extra approvers, without repeats. The one list every owner check reads. */
function approversOf(config) {
  if (!config) return [];
  return [...new Set([config.ownerUserId, ...(config.approverUserIds || [])].filter(Boolean))];
}

function isApprover(userId, config) {
  return Boolean(userId) && approversOf(config).includes(userId);
}

function parseGroupConfig(raw) {
  const table = new Map();
  for (const part of String(raw || '').split(',')) {
    const token = part.trim();
    if (!token) continue;
    const match = token.match(/^([^:\s]+?)(?::(B[1-4]))?$/i);
    if (!match) continue;
    table.set(match[1], match[2] ? match[2].toUpperCase() : null);
  }
  return table;
}

module.exports = { loadConfig, parseGroupConfig, approversOf, isApprover };
