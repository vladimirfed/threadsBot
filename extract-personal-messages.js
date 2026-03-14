const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'chatHistory.json');
const outputPath = path.join(__dirname, 'personalMessages.json');

function getText(msg) {
  const t = msg.text;
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) {
    return t
      .filter((x) => typeof x === 'string')
      .join(' ')
      .trim();
  }
  return '';
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const messages = data.messages || [];

const result = messages
  .filter((msg) => msg.from === 'Vladimir F')
  .map((msg) => getText(msg))
  .filter((text) => text.length >= 35)
  .map((text) => ({ text }));

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Done. Saved ${result.length} messages to personalMessages.json`);
