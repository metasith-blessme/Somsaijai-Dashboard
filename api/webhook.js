// Vercel only builds functions from a root api/ directory.
// The handler stays beside the dashboard and is re-exported here.
const webhook = require('../3_Automation_Dashboard/api/webhook');

module.exports = webhook;
module.exports.config = {
  api: { bodyParser: false },
  maxDuration: 300,
};
module.exports.scheduleBackground = webhook.scheduleBackground;
module.exports.readRaw = webhook.readRaw;
