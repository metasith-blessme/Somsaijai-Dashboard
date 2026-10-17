function lineClient({ token, fetchImpl }) {
  const fetchFn = fetchImpl || fetch;
  async function api(url, body) {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      const error = new Error(`LINE ${res.status}: ${text.slice(0, 300)}`);
      error.status = res.status;
      throw error;
    }
    return text ? JSON.parse(text) : {};
  }
  return {
    /** Reply tokens are free on the LINE free plan. A token works once. */
    reply(replyToken, messages) {
      if (!replyToken) return Promise.resolve({ skipped: true });
      const list = Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }];
      return api('https://api.line.me/v2/bot/message/reply', { replyToken, messages: list.slice(0, 5) });
    },
    /** Push counts against the monthly quota: 1 per recipient. */
    push(to, messages) {
      const list = Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }];
      return api('https://api.line.me/v2/bot/message/push', { to, messages: list.slice(0, 5) });
    },
    async getContent(messageId) {
      const res = await fetchFn(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`LINE content ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return { buf, contentType: res.headers.get('content-type') || 'application/octet-stream' };
    },
  };
}

module.exports = { lineClient };
