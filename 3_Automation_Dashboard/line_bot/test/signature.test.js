const test = require('node:test');
const assert = require('node:assert/strict');
const { signBody, verifySignature } = require('../lib/signature');

const secret = 'channel-secret';
const body = Buffer.from(JSON.stringify({ events: [] }), 'utf8');

test('a valid LINE signature matches the raw body', () => {
  const signature = signBody(body, secret);
  assert.equal(verifySignature(body, signature, secret), true);
});

test('a changed body, a wrong secret, or a missing signature is rejected', () => {
  const signature = signBody(body, secret);
  const tampered = Buffer.from(body.toString('utf8').replace('[]', '[{}]'));
  assert.equal(verifySignature(tampered, signature, secret), false);
  assert.equal(verifySignature(body, signature, 'other-secret'), false);
  assert.equal(verifySignature(body, '', secret), false);
  assert.equal(verifySignature(body, signature, ''), false);
});

test('the webhook returns 401 and does not download an image when the signature is wrong', async () => {
  const { handleWebhook } = require('../lib/handler');
  const { MemoryStore } = require('../lib/store');
  let downloads = 0;
  const result = await handleWebhook({
    rawBody: body,
    signature: 'nope',
    ctx: {
      config: { channelSecret: secret, groupId: 'C1', ownerUserId: 'U1' },
      store: new MemoryStore(),
      line: { getContent() { downloads += 1; } },
      now: Date.now(),
    },
  });
  assert.equal(result.status, 401);
  assert.equal(downloads, 0);
});
