/**
 * LINE delivers each photo in a multi-select as its own webhook event.
 * They share message.imageSet.id, with a 1-based index and a total.
 * A photo sent on its own has no imageSet and is a batch of one.
 * Albums never arrive here — LINE does not webhook group albums.
 */

function setIdFor(message) {
  if (message.imageSet && message.imageSet.id) return String(message.imageSet.id);
  return `single:${message.id}`;
}

function partFromMessage(message) {
  const set = message.imageSet;
  const total = set && Number.isInteger(set.total) ? set.total : 1;
  const index = set && Number.isInteger(set.index) ? set.index : 1;
  return {
    setId: setIdFor(message),
    messageId: String(message.id),
    index,
    total,
  };
}

function emptySet(id, total) {
  return { id, total: total || null, parts: {}, conflicts: [] };
}

/**
 * @param {object} state persisted set
 * @param {{messageId:string,index:number,total:number,sha256:string}} part
 * @returns {{complete:boolean, duplicate:boolean}}
 */
function addPart(state, part) {
  if (!Number.isInteger(part.index) || part.index < 1 || !Number.isInteger(part.total) || part.total < 1) {
    state.conflicts.push({ type: 'bad_index', index: part.index, total: part.total, messageId: part.messageId });
    return { complete: false, duplicate: false };
  }
  if (state.total == null) state.total = part.total;
  if (state.total !== part.total) {
    state.conflicts.push({ type: 'total_mismatch', index: part.index, total: part.total, previous: state.total });
    return { complete: false, duplicate: false };
  }
  const prev = state.parts[String(part.index)];
  if (prev && prev.messageId === part.messageId) {
    return { complete: isComplete(state), duplicate: true };
  }
  if (prev && prev.messageId !== part.messageId) {
    state.conflicts.push({ type: 'index_conflict', index: part.index, messageId: part.messageId, previous: prev.messageId });
    return { complete: false, duplicate: false };
  }
  state.parts[String(part.index)] = {
    messageId: part.messageId,
    index: part.index,
    sha256: part.sha256 || null,
  };
  return { complete: isComplete(state), duplicate: false };
}

function isComplete(state) {
  if (!state || !state.total || state.conflicts.length) return false;
  for (let i = 1; i <= state.total; i++) {
    if (!state.parts[String(i)]) return false;
  }
  return true;
}

function orderedParts(state) {
  const out = [];
  for (let i = 1; i <= (state.total || 0); i++) out.push(state.parts[String(i)]);
  return out;
}

module.exports = { setIdFor, partFromMessage, emptySet, addPart, isComplete, orderedParts };
