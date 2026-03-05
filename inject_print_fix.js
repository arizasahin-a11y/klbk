const fs = require('fs');
const path = require('path');

const htmlPath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'ogretmen.html');
const logicPath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'print_logic.js');

let html = fs.readFileSync(htmlPath, 'utf8');
const logicContent = fs.readFileSync(logicPath, 'utf8');

// The file currently has some messed up `\n    </script>` from previous error.
// We will replace from `window.printSession = async function (id) {` all the way to `</body>`
const startStr = 'window.printSession = async function (id) {';
const startIdx = html.indexOf(startStr);

// Find the last </body>
const bodyEndIdx = html.lastIndexOf('</body>');

if (startIdx !== -1 && bodyEndIdx !== -1) {
    const beforeBlock = html.substring(0, startIdx);
    const afterBlock = html.substring(bodyEndIdx);

    // Inject the new logic, then properly close the script and body tags
    html = beforeBlock + logicContent + '\n    </script>\n' + afterBlock;

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log("Fixed injection complete");
} else {
    console.error("Bounds not found");
}
