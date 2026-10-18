/**
 * LINE delivers each photo in a multi-select as its own webhook event.
 * They share message.imageSet.id, with a 1-based index and a total.
 * A photo sent on its own has no imageSet and is a batch of one.
 * Albums never arrive here — LINE does not webhook group albums.
 *
 * Each part is stored at its own key. A shared set document loses parts
 * when those events write at the same time.
 */

const IMAGE_SET_TIMEOUT_MS = 2 * 60 * 1000;

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

function partKey(setId, index) {
  return `set:${setId}:part:${index}`;
}

function doneKey(setId) {
  return `set:${setId}:done`;
}

function conflictKey(setId, index) {
  return `set:${setId}:conflict:${index}`;
}

function partPrefix(setId) {
  return `set:${setId}:part:`;
}

function conflictPrefix(setId) {
  return `set:${setId}:conflict:`;
}

function batchIdFor(setId) {
  return `set_${setId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
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

/**
 * Parts are independent blobs. Completeness is which indexes are present.
 * @param {object[]} parts
 * @param {object[]} [conflicts]
 */
function summarizeParts(parts, conflicts) {
  const found = new Map();
  const localConflicts = Array.isArray(conflicts) ? conflicts.slice() : [];
  let total = null;
  for (const part of parts || []) {
    if (!part || !Number.isInteger(part.index) || part.index < 1 || !Number.isInteger(part.total) || part.total < 1) {
      localConflicts.push({ type: 'bad_index', index: part && part.index, total: part && part.total, messageId: part && part.messageId });
      continue;
    }
    if (total == null) total = part.total;
    else if (part.total !== total) {
      localConflicts.push({ type: 'total_mismatch', index: part.index, total: part.total, previous: total });
      continue;
    }
    const prev = found.get(part.index);
    if (prev && prev.messageId !== part.messageId) {
      localConflicts.push({ type: 'index_conflict', index: part.index, messageId: part.messageId, previous: prev.messageId });
      continue;
    }
    found.set(part.index, part);
  }
  const missing = [];
  const ordered = [];
  if (total) {
    for (let i = 1; i <= total; i++) {
      if (found.has(i)) ordered.push(found.get(i));
      else missing.push(i);
    }
  }
  return {
    total,
    missing,
    conflicts: localConflicts,
    ordered,
    have: found.size,
    complete: Boolean(total) && missing.length === 0 && localConflicts.length === 0,
  };
}

function missingNote(summary) {
  if (!summary || !summary.missing || !summary.missing.length) return '';
  return `รูปไม่ครบ ${summary.ordered.length}/${summary.total} ขาดลำดับ ${summary.missing.join(', ')}`;
}

module.exports = {
  IMAGE_SET_TIMEOUT_MS,
  setIdFor,
  partFromMessage,
  partKey,
  doneKey,
  conflictKey,
  partPrefix,
  conflictPrefix,
  batchIdFor,
  emptySet,
  addPart,
  isComplete,
  orderedParts,
  summarizeParts,
  missingNote,
};
