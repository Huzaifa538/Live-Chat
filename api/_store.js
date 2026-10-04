import { put, list } from '@vercel/blob';
const PATH = 'live-chat/messages.json';
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
// read all messages from blob storage
export async function readMessages() {
  try {
    const { blobs } = await list({ prefix: PATH, token: TOKEN });
    if (!blobs.length) return { messages: [], nextId: 1 };
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    return { messages: [], nextId: 1 };
  }
}
// save messages to blob storage
export async function writeMessages(data) {
  await put(PATH, JSON.stringify(data), { access: 'public', addRandomSuffix: false, allowOverwrite: true, token: TOKEN });
}
