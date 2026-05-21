const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'ogretmen.html');
const content = fs.readFileSync(htmlPath, 'utf8');

// Find all script blocks
const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = regex.exec(content)) !== null) {
    count++;
    const jsCode = match[1];
    console.log(`Checking script block #${count} (length: ${jsCode.length})...`);
    
    try {
        // We will compile the script block as a Module or Script to check syntax
        new Function(jsCode);
        console.log(`Script block #${count} parsed successfully without basic syntax errors.`);
    } catch (err) {
        console.error(`\n!!! SYNTAX ERROR in script block #${count}:`);
        console.error(err.message);
        
        // Find line number in original HTML
        const index = match.index;
        const lineNum = content.substring(0, index).split('\n').length;
        console.error(`Approximate starting HTML line: ${lineNum}`);
        
        // Print context
        const errLineMatch = err.stack ? err.stack.match(/<anonymous>:(\d+):(\d+)/) : null;
        if (errLineMatch) {
            const blockLine = parseInt(errLineMatch[1], 10);
            const jsLines = jsCode.split('\n');
            console.error(`Error is at line ${blockLine} of the script block (HTML line ${lineNum + blockLine - 1}):`);
            const start = Math.max(0, blockLine - 5);
            const end = Math.min(jsLines.length, blockLine + 5);
            for (let i = start; i < end; i++) {
                const marker = (i + 1 === blockLine) ? '=> ' : '   ';
                console.error(`${marker}${lineNum + i}: ${jsLines[i]}`);
            }
        } else {
            // Fallback: print first few lines of the error stack or the error itself
            console.error(err.stack);
        }
    }
}
