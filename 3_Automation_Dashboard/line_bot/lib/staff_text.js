const ALBUM_HELP = 'Send photos one by one, not as an album.';
const OCR_FAIL = 'Could not read this photo. Please send this photo again.';

const ONLY_PARN_APPROVE = 'Only Parn can approve this.';
const ONLY_PARN_SUMMARY = 'Only Parn can ask for the summary.';
const SUMMARY_IS_PRIVATE = 'Summary is private. Open a private chat and send summary.';
const NO_ORDER = 'No order yet.';
const ORDER_REPLAY_NOTE = 'Last order. Copy the Thai shop texts below. Not sent.';
const ORDER_RECEIVED = 'Order received.';
const ORDER_SENT = 'Sent the draft to Parn. Shops were not messaged.';
const ORDER_NOT_SENT = 'Not sent to Parn. Ask Parn to send order.';
const ORDER_NO_OWNER = 'Not sent. LINE_OWNER_USER_ID is not set.';
const YOU_ORDER = 'you order this yourself';
const UNKNOWN_ITEM = 'unknown item';
const NO_SHOP = 'no shop';
const COULD_NOT_READ = 'Could not read:';

const UNIT_EN = {
  'ลูก': 'pcs',
  'กก': 'kg',
  'กล่อง': 'boxes',
  'ลัง': 'crates',
};

function commandKey(text) {
  return String(text || '').trim().toLowerCase();
}

function isIdCommand(text) {
  const key = commandKey(text);
  return key === 'id' || key === '/id' || key === 'ไอดี';
}

function isReviewCommand(text) {
  const key = commandKey(text);
  return key === 'review' || key === '/review' || key === 'summary' || key === '/summary' || key === 'สรุป';
}

function isHelpCommand(text) {
  const key = commandKey(text);
  return key === 'help' || key === '/help' || key === 'ช่วย' || key === 'วิธีส่งรูป';
}

function isOrderCommand(text) {
  const key = commandKey(text);
  return key === 'order' || key === '/order' || key === 'ออเดอร์';
}

function showUnit(unit) {
  if (!unit) return '';
  return UNIT_EN[unit] || unit;
}

function idReply({ userId, groupId, groupsLocked, inGroup }) {
  const lines = [`Your id: ${userId || '(none)'}`];
  if (groupId) lines.push(`Group id: ${groupId}`);
  if (!groupsLocked) lines.push('Set LINE_OWNER_USER_ID and LINE_GROUP_ID.');
  if (inGroup) lines.push(ALBUM_HELP);
  return lines.join('\n');
}

function unconfiguredPhoto({ groupId, userId }) {
  return [
    `Set LINE_GROUP_ID to ${groupId}.`,
    `Your id: ${userId || '(none)'}`,
  ].join('\n');
}

function unconfiguredText(groupId) {
  return `Set LINE_GROUP_ID to ${groupId}.`;
}

function partialPhotos(have, total, waitMin) {
  return `Got ${have}/${total}. Summary when complete, or within ${waitMin} minutes.`;
}

function conflictPhotos() {
  return 'Photos overlap. Send them again, one by one.';
}

function photosDone(warning) {
  const extra = warning ? `\n${warning}` : '';
  return `Summary sent to Parn. Not saved yet.${extra}`;
}

function latePhoto() {
  return 'This photo arrived after the summary. Send it again if it was missing.';
}

function missingPhotosNote(summary) {
  if (!summary || !summary.missing || !summary.missing.length) return '';
  return `Missing ${summary.missing.join(', ')} (${summary.ordered.length}/${summary.total}). Send those again.`;
}

function pushFailed(error) {
  return `Read, but the private summary could not be sent (${error}). Ask Parn to send summary.`;
}

function ownerMissing() {
  return 'Read, but LINE_OWNER_USER_ID is not set. Parn was not notified.';
}

function helpText() {
  return ALBUM_HELP;
}

function catalogFailed(error) {
  return `Shop list failed: ${String(error).slice(0, 200)}`;
}

function wentWrong(error) {
  return `Something went wrong: ${String(error).slice(0, 300)}`;
}

module.exports = {
  ALBUM_HELP,
  OCR_FAIL,
  ONLY_PARN_APPROVE,
  ONLY_PARN_SUMMARY,
  SUMMARY_IS_PRIVATE,
  NO_ORDER,
  ORDER_REPLAY_NOTE,
  ORDER_RECEIVED,
  ORDER_SENT,
  ORDER_NOT_SENT,
  ORDER_NO_OWNER,
  YOU_ORDER,
  UNKNOWN_ITEM,
  NO_SHOP,
  COULD_NOT_READ,
  UNIT_EN,
  commandKey,
  isIdCommand,
  isReviewCommand,
  isHelpCommand,
  isOrderCommand,
  showUnit,
  idReply,
  unconfiguredPhoto,
  unconfiguredText,
  partialPhotos,
  conflictPhotos,
  photosDone,
  latePhoto,
  missingPhotosNote,
  pushFailed,
  ownerMissing,
  helpText,
  catalogFailed,
  wentWrong,
};
