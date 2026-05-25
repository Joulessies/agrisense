const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

const cleanLines = [...lines.slice(0, 480), ...lines.slice(557)];

fs.writeFileSync('index.html', cleanLines.join('\n'), 'utf8');
console.log('Done. Lines before:', lines.length, '| Lines after:', cleanLines.length);
