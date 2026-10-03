import { readMessages, writeMessages } from './_store.js';
// receive a new chat message
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { user, text } = req.body || {};
  if (!user || !text || !String(text).trim()) return res.status(400).json({ error: 'Name and message required' });
  const data = await readMessages();
  const msg = { id: data.nextId++, user: String(user).slice(0, 20), text: String(text).slice(0, 500), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  data.messages.push(msg);
  if (data.messages.length > 200) data.messages = data.messages.slice(-200);
  await writeMessages(data);
  res.status(200).json({ ok: true, message: msg });
}
