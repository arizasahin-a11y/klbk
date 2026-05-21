const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("Running renderExams reference error test...");

function createMockElement() {
    return {
        style: {},
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {},
        querySelectorAll: () => [],
        querySelector: () => createMockElement(),
        addEventListener: () => {},
        removeEventListener: () => {},
        innerHTML: '',
        textContent: '',
        className: ''
    };
}

const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

const mockDocument = {
    getElementById: (id) => createMockElement(),
    body: {
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {}
    },
    createElement: () => createMockElement(),
    addEventListener: () => {},
    removeEventListener: () => {}
};

const context = {
    console: console,
    window: {},
    document: mockDocument,
    localStorage: mockLocalStorage,
    location: { pathname: '/ogrenci.html', href: '', search: '' },
    performance: { now: () => Date.now() },
    setInterval: () => {},
    setTimeout: () => {},
    clearInterval: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    AbortController: class { constructor() { this.signal = {}; } abort() {} }
};

context.window = context;
vm.createContext(context);

// Load core data
const coreDataPath = path.join(__dirname, '..', 'js', 'core_data_v11_9_1.js');
const coreDataCode = fs.readFileSync(coreDataPath, 'utf8');
vm.runInContext(coreDataCode, context, { filename: 'core_data_v11_9_1.js' });

// Extract and run inline script from ogrenci.html
const ogrenciPath = path.join(__dirname, '..', 'ogrenci.html');
const ogrenciHtml = fs.readFileSync(ogrenciPath, 'utf8');

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
let inlineScript = '';

while ((match = scriptRegex.exec(ogrenciHtml)) !== null) {
    count++;
    if (count === 6) {
        inlineScript = match[1];
        break;
    }
}

try {
    vm.runInContext(inlineScript, context, { filename: 'ogrenci.html_inline_script' });
    console.log("Inline script executed successfully!");

    const mockSession = {
        id: "ses_klass",
        name: "Klasik Sınav Deneme",
        date: "2026-05-21",
        time: "14:15",
        examDuration: 40,
        type: "klasik",
        isPublished: true,
        screenViewLimit: 8,
        screenViewEnabled: true,
        results: [
            {
                name: "Laboratuvar-1",
                groups: 1,
                groupConfigs: [{ rows: 1, cols: 1 }],
                seats: {
                    "G1-S1-C1": { no: "123", name: "Ali Rıza Şahin", class: "12/A", _matchedSubject: "Matematik" }
                }
            }
        ]
    };

    const mockStudent = {
        name: "Ali Rıza Şahin",
        no: "123",
        class: "12/A"
    };

    vm.runInContext("currentStudent = " + JSON.stringify(mockStudent) + ";", context);
    
    // Set now to 15 minutes before the exam (which is > limit of 8 minutes)
    // So stateCode will resolve to 'med'
    const targetTime = context.parseDateTime(mockSession.date, mockSession.time);
    const nowTime = new Date(targetTime.getTime() - 15 * 60 * 1000);
    context.getNow = () => nowTime;

    // Set DataManager data
    vm.runInContext(`
        DataManager._getData = () => ({
            sessions: [${JSON.stringify(mockSession)}],
            students: [${JSON.stringify(mockStudent)}],
            school: { name: "Mock School" }
        });
        DataManager.getSortedExamSessions = () => [${JSON.stringify(mockSession)}];
    `, context);

    console.log("Calling renderExams()...");
    context.renderExams();
    console.log("renderExams() succeeded without throwing!");

} catch (e) {
    console.error("renderExams() failed with error:");
    console.error(e.stack || e);
    process.exit(1);
}
