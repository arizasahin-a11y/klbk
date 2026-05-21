const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ogretmen.html');
const html = fs.readFileSync(filePath, 'utf8');

// A very basic HTML tag validator
const tagRegex = /<\/?([a-zA-Z0-9:-]+)(\s[^>]*)?>/g;
let match;
const stack = [];
const selfClosing = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

let line = 1;
let lastIndex = 0;

// Simple line count helper
function getLineNumber(index) {
    return html.substring(0, index).split('\n').length;
}

while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || selfClosing.has(tagName);
    const index = match.index;
    const currentLine = getLineNumber(index);

    if (isSelfClosing) {
        continue;
    }

    if (!isClosing) {
        stack.push({ name: tagName, line: currentLine, tag: fullTag });
    } else {
        if (stack.length === 0) {
            console.log(`Warning: Closing tag </${tagName}> at line ${currentLine} has no matching open tag.`);
            continue;
        }

        const last = stack.pop();
        if (last.name !== tagName) {
            // Check if it matches a parent to see if we just missed a close tag
            console.log(`Mismatch: Open <${last.name}> at line ${last.line} closed by </${tagName}> at line ${currentLine}`);
            // Push back or adjust stack to try to recover
            stack.push(last);
        }
    }
}

if (stack.length > 0) {
    console.log(`\nUnclosed tags remaining in stack:`);
    stack.forEach(t => {
        console.log(`  <${t.name}> at line ${t.line} (${t.tag.substring(0, 40)}...)`);
    });
} else {
    console.log(`No unclosed tag issues found.`);
}
