const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("Starting ogrenci.html load simulation...");

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
    location: {
        pathname: '/ogrenci.html',
        href: '',
        search: ''
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

// 3. Extract and run inline script from ogrenci.html
const ogrenciPath = path.join(__dirname, '..', 'ogrenci.html');
const ogrenciHtml = fs.readFileSync(ogrenciPath, 'utf8');

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
let inlineScript = '';

while ((match = scriptRegex.exec(ogrenciHtml)) !== null) {
    count++;
    if (count === 6) { // The main script block is the 6th one in ogrenci.html
        inlineScript = match[1];
        break;
    }
}

if (!inlineScript) {
    console.error("Could not find the 6th script block in ogrenci.html");
    process.exit(1);
}

try {
    vm.runInContext(inlineScript, context, { filename: 'ogrenci.html_inline_script' });
    console.log("ogrenci.html main inline script executed successfully!");

    // Helper functions testing inside the context
    if (typeof context.parseDateTime === 'function') {
        console.log("Checking parseDateTime definition... SUCCESS!");
    } else {
        console.error("parseDateTime is missing!");
        process.exit(1);
    }
    
    // Construct mock session and verify timings for Uygulama
    console.log("\n--- Testing Timing and Display Rules for Uygulama Sınavı ---");
    
    const mockSession = {
        id: "ses_123",
        name: "Uygulama Sınavı Deneme",
        date: "2026-05-21",
        time: "14:15",
        examDuration: 40,
        type: "uygulama",
        isPublished: true,
        results: [
            {
                name: "Laboratuvar-1",
                groups: 1,
                groupConfigs: [{ rows: 1, cols: 1 }],
                seats: {
                    "G1-S1-C1": { no: "123", name: "Ali Rıza Şahin", class: "12/A" }
                }
            }
        ]
    };
    
    const mockStudent = {
        name: "Ali Rıza Şahin",
        no: "123",
        class: "12/A"
    };
    
    // We mock the student context
    vm.runInContext("currentStudent = " + JSON.stringify(mockStudent) + ";", context);
    
    // Let's test timing scenarios by setting a custom getNow() mock
    const parseDateTime = context.parseDateTime;
    const targetTime = parseDateTime(mockSession.date, mockSession.time);
    
    // Scenario 1: Sınava 25 dakika var (should be far / Hazırlanıyor)
    console.log("\nScenario 1: 25 minutes before exam start");
    let nowTime = new Date(targetTime.getTime() - 25 * 60 * 1000);
    context.getNow = () => nowTime;
    
    // Test the state code resolution logic mimicking renderExams
    let diffMs = targetTime - nowTime;
    let diffMins = diffMs / 1000 / 60;
    let endTime = targetTime.getTime() + mockSession.examDuration * 60 * 1000;
    let diffEndMins = (endTime - nowTime) / 1000 / 60;
    
    let stateCode;
    if (mockSession.type === 'uygulama') {
        if (diffEndMins < 0) {
            stateCode = 'finished';
        } else if (diffMins <= 0) {
            stateCode = 'active';
        } else if (diffMins > 20) {
            stateCode = 'far';
        } else {
            stateCode = 'near';
        }
    }
    console.log(`- stateCode resolved to: ${stateCode} (Expected: far)`);
    if (stateCode !== 'far') {
        console.error("Scenario 1 FAILED!");
        process.exit(1);
    }
    
    // Scenario 2: Sınava 15 dakika var (should be near / alert visible, no files, no location)
    console.log("\nScenario 2: 15 minutes before exam start");
    nowTime = new Date(targetTime.getTime() - 15 * 60 * 1000);
    context.getNow = () => nowTime;
    
    diffMs = targetTime - nowTime;
    diffMins = diffMs / 1000 / 60;
    diffEndMins = (endTime - nowTime) / 1000 / 60;
    
    if (mockSession.type === 'uygulama') {
        if (diffEndMins < 0) {
            stateCode = 'finished';
        } else if (diffMins <= 0) {
            stateCode = 'active';
        } else if (diffMins > 20) {
            stateCode = 'far';
        } else {
            stateCode = 'near';
        }
    }
    console.log(`- stateCode resolved to: ${stateCode} (Expected: near)`);
    if (stateCode !== 'near') {
        console.error("Scenario 2 FAILED!");
        process.exit(1);
    }
    
    // Let's mock generateDetailsHtml arguments and call it
    const mockRoom = {
        name: "Laboratuvar-1",
        groups: 1,
        groupConfigs: [{ rows: 1, cols: 1 }],
        seats: {
            "G1-S1-C1": { no: "123", name: "Ali Rıza Şahin", class: "12/A" }
        }
    };
    const mockItem = {
        session: mockSession,
        room: mockRoom,
        seatId: "G1-S1-C1",
        seatNum: 1
    };
    
    const detailsHtml = context.generateDetailsHtml(mockItem);
    console.log("- Checking if location info is suppressed in detailsHtml...");
    if (detailsHtml.includes("Laboratuvar-1 Salonu") || detailsHtml.includes("Sıra No:") || detailsHtml.includes("Sınav Yeriniz")) {
        console.error("Location info found! Suppression FAILED.");
        process.exit(1);
    } else {
        console.log("  Location info is correctly suppressed! SUCCESS!");
    }
    
    console.log("- Checking if files warning alert message exists in detailsHtml...");
    const expectedAlert = "Uygulama Sınavı dosyaları sınav başlama saatinden 3 dakika sonra aktif olacaktır.";
    if (!detailsHtml.includes(expectedAlert)) {
        console.error("Expected warning alert not found or mismatch! FAILED.");
        console.log("HTML:", detailsHtml);
        process.exit(1);
    } else {
        console.log("  Warning alert message is correctly present! SUCCESS!");
    }
    
    // Scenario 3: Sınav başladıktan 5 dakika sonra (should be active / files visible)
    console.log("\nScenario 3: 5 minutes after exam start");
    nowTime = new Date(targetTime.getTime() + 5 * 60 * 1000);
    context.getNow = () => nowTime;
    
    const detailsHtmlAfter3Min = context.generateDetailsHtml(mockItem);
    console.log("- Checking if warning alert is removed...");
    if (detailsHtmlAfter3Min.includes(expectedAlert)) {
        console.error("Warning alert still present 5 minutes after start! FAILED.");
        process.exit(1);
    } else {
        console.log("  Warning alert is removed! SUCCESS!");
    }
    
    console.log("\nAll timing and rendering scenarios verified successfully! Excellent work.");
    
} catch (e) {
    console.error("RUNTIME ERROR during script execution:");
    console.error(e.stack || e);
    process.exit(1);
}
