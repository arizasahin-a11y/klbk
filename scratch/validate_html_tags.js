const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ogretmen.html');
let html = fs.readFileSync(filePath, 'utf8');

// Replace all <script>...</script> with placeholders to avoid matching JS comparison operators
html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
    // Keep the newlines to preserve line numbers
    const newlines = content.split('\n').map(() => '').join('\n');
    return `<script>${newlines}</script>`;
});

// Replace all <style>...</style> with placeholders
html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, content) => {
    const newlines = content.split('\n').map(() => '').join('\n');
    return `<style>${newlines}</style>`;
});

// Replace HTML comments
html = html.replace(/<!--([\s\S]*?)-->/g, '');

const tagRegex = /<\/?([a-zA-Z0-9:-]+)(\s[^>]*)?>/g;
let match;
const stack = [];
const selfClosing = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

function getLineNumber(index) {
    return html.substring(0, index).split('\n').length;
}

let mismatches = 0;

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
            mismatches++;
            continue;
        }

        const last = stack.pop();
        if (last.name !== tagName) {
            console.log(`Mismatch: Open <${last.name}> at line ${last.line} closed by </${tagName}> at line ${currentLine}`);
            mismatches++;
            // Push back to try to keep track
            stack.push(last);
        }
    }
}

if (stack.length > 0) {
    console.log(`\nUnclosed tags remaining in stack:`);
    stack.forEach(t => {
        console.log(`  <${t.name}> at line ${t.line} (${t.tag.substring(0, 40)}...)`);
    });
} else if (mismatches === 0) {
    console.log(`No HTML tag issues found.`);
} else {
    console.log(`Found ${mismatches} mismatches, but stack is empty.`);
}
