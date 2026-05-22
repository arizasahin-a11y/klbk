const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('dashboard.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
const window = dom.window;

// Mock dependencies
window.Swal = { fire: async () => ({ isConfirmed: true }), showLoading: () => {} };
window.PDFLib = require('pdf-lib');

const uiJs = fs.readFileSync('js/ui.js', 'utf8');
const pdfJs = fs.readFileSync('js/pdf_engine_v11_9_1.js', 'utf8');

try {
    window.eval(pdfJs);
    window.eval(uiJs);
    console.log("Scripts loaded successfully");
} catch (e) {
    console.error("Eval Error:", e);
}
