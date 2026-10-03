import { readMessages } from './_store.js';
// return messages newer than ?since=
export default async function handler(req, res) {
  const since = parseInt(req.query.since || '0', 10);
  const data = await readMessages();
  const fresh = data.messages.filter(m => m.id > since);
  res.status(200).json({ messages: fresh, count: data.messages.length });
}
