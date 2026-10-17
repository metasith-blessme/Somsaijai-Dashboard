const ALBUM_HELP = 'Send photos one by one in this chat, not as an album. The bot cannot see album photos.';
const OCR_FAIL = 'Could not read this photo. It will be tried again. If it still fails, send this photo again in the chat.';

const ONLY_PARN_APPROVE = 'Only Parn can approve this.';
const ONLY_PARN_SUMMARY = 'Only Parn can ask for the summary.';
const SUMMARY_IS_PRIVATE = 'The summary is private. Open a private chat with this bot and send summary.';
const NO_ORDER = 'No order yet.';
const ORDER_REPLAY_NOTE = 'Last order. The shop messages below are in Thai. Copy them yourself. The bot did not send them.';
const ORDER_RECEIVED = 'Order received.';
const ORDER_SENT = 'Sent the draft to Parn. The bot did not message the shops.';
const ORDER_NOT_SENT = 'Could not send this to Parn. Ask Parn to send order in the bot chat.';
const ORDER_NO_OWNER = 'LINE_OWNER_USER_ID is not set, so this was not sent to Parn.';
const YOU_ORDER = 'you order this yourself. Not in a shop message.';
const UNKNOWN_ITEM = 'unknown item. Not added.';
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
  if (!groupsLocked) lines.push('Put these in LINE_OWNER_USER_ID and LINE_GROUP_ID.');
  if (inGroup) lines.push(ALBUM_HELP);
  return lines.join('\n');
}

function unconfiguredPhoto({ groupId, userId }) {
  return [
    `Group id: ${groupId}`,
    'Set LINE_GROUP_ID to this id before the bot can read photos.',
    `Your id: ${userId || '(none)'}`,
    ALBUM_HELP,
  ].join('\n');
}

function unconfiguredText(groupId) {
  return `Group id: ${groupId}. Set LINE_GROUP_ID before the bot can read photos.\n${ALBUM_HELP}`;
}

function partialPhotos(have, total, waitMin) {
  return `Got ${have} of ${total} photos. The summary comes when the set is complete, or within ${waitMin} minutes.\n${ALBUM_HELP}`;
}

function conflictPhotos() {
  return `These photos overlap and cannot be read. Send them again, one by one, in this chat.\n${ALBUM_HELP}`;
}

function photosDone(warning) {
  const extra = warning ? `\n${warning}` : '';
  return `All photos received. Summary sent to Parn in a private chat. Nothing is saved to the books yet.\n${ALBUM_HELP}${extra}`;
}

function latePhoto() {
  return `This photo arrived after the summary. If it was missing, send that photo again as a new message.\n${ALBUM_HELP}`;
}

function missingPhotosNote(summary) {
  if (!summary || !summary.missing || !summary.missing.length) return '';
  return `Photos are incomplete: ${summary.ordered.length}/${summary.total}. Missing: ${summary.missing.join(', ')}. The summary uses the photos that arrived. Send the missing photos again in this chat.`;
}

function pushFailed(error) {
  return `Photos are read, but the private summary could not be sent (${error}). Ask Parn to open the bot chat and send summary.`;
}

function ownerMissing() {
  return 'Photos are read, but LINE_OWNER_USER_ID is not set, so Parn was not notified.';
}

function helpText() {
  return `${ALBUM_HELP}\nSend each photo in the chat. Do not use an album.`;
}

function catalogFailed(error) {
  return `Could not read the shop list: ${String(error).slice(0, 200)}`;
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
