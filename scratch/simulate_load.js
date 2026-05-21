const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("Starting ogretmen.html load simulation...");

// Helper to mock DOM elements
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

// 1. Setup mock DOM and browser environments
const mockSessionStorage = {
    getItem: (key) => {
        if (key === 'klbk_isLoggedIn') return 'true';
        if (key === 'klbk_role') return 'ogretmen';
        if (key === 'klbk_currentUser') return 'test_teacher';
        if (key === 'klbk_name') return 'Test Teacher';
        if (key === 'klbk_branch') return 'Matematik';
        return null;
    },
    setItem: () => {},
    clear: () => {}
};

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
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    location: {
        pathname: '/ogretmen.html',
        href: ''
    },
    trustedBaseTime: 0,
    performanceAtSync: 0,
    performance: {
        now: () => Date.now()
    },
    setInterval: () => {},
    setTimeout: () => {},
    clearInterval: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    fetch: async () => ({
        ok: true,
        json: async () => ({})
    }),
    AbortController: class {
        constructor() {
            this.signal = {};
        }
        abort() {}
    },
    Swal: {
        fire: () => Promise.resolve({ isConfirmed: true })
    },
    pdfLib: {
        PDFDocument: {
            create: () => ({}),
            load: () => ({})
        }
    }
};

context.window = context;
vm.createContext(context);

// 2. Read and run js/core_data_v11_9_1.js
const coreDataPath = path.join(__dirname, '..', 'js', 'core_data_v11_9_1.js');
const coreDataCode = fs.readFileSync(coreDataPath, 'utf8');
try {
    vm.runInContext(coreDataCode, context, { filename: 'core_data_v11_9_1.js' });
    console.log("js/core_data_v11_9_1.js loaded successfully in mock context.");
} catch (e) {
    console.error("Error loading js/core_data_v11_9_1.js:", e);
    process.exit(1);
}

// 3. Extract and run inline script from ogretmen.html
const ogretmenPath = path.join(__dirname, '..', 'ogretmen.html');
const ogretmenHtml = fs.readFileSync(ogretmenPath, 'utf8');

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
let inlineScript = '';

while ((match = scriptRegex.exec(ogretmenHtml)) !== null) {
    count++;
    if (count === 7) { // The main script block is the 7th one
        inlineScript = match[1];
        break;
    }
}

if (!inlineScript) {
    console.error("Could not find the 7th script block in ogretmen.html");
    process.exit(1);
}

try {
    vm.runInContext(inlineScript, context, { filename: 'ogretmen.html_inline_script' });
    console.log("ogretmen.html main inline script executed successfully!");
    
    // Test renderExams
    if (typeof context.renderExams === 'function') {
        console.log("Testing renderExams()...");
        context.renderExams();
        console.log("renderExams() executed successfully!");
    } else {
        console.warn("renderExams is not a function in context");
    }
} catch (e) {
    console.error("RUNTIME ERROR during ogretmen.html script execution:");
    console.error(e.stack || e);
    process.exit(1);
}
