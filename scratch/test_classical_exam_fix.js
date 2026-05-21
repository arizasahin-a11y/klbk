const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("Starting classical exam fix verification...");

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
    removeEventListener: () => {}
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

    const mockRoom = mockSession.results[0];
    const mockItem = {
        session: mockSession,
        room: mockRoom,
        seatId: "G1-S1-C1",
        seatNum: 1
    };

    const detailsHtml = context.generateDetailsHtml(mockItem);

    // Assertions
    console.log("\n--- Verification Assertions ---");

    const hasRoomName = detailsHtml.includes("Laboratuvar-1 Salonu");
    console.log(`1. Room name 'Laboratuvar-1 Salonu' present: ${hasRoomName} (Expected: true)`);
    if (!hasRoomName) {
        console.error("FAIL: Classroom name is missing in details header!");
        process.exit(1);
    }

    const hasSeatingPlan = detailsHtml.includes("Oturma Planı");
    console.log(`2. Seating plan 'Oturma Planı' section present: ${hasSeatingPlan} (Expected: true)`);
    if (!hasSeatingPlan) {
        console.error("FAIL: Seating plan accordion section is missing!");
        process.exit(1);
    }

    const hasSalonHeader = detailsHtml.includes("<th>Sınav Salonu</th>");
    console.log(`3. Table header 'Sınav Salonu' present: ${hasSalonHeader} (Expected: true)`);
    if (!hasSalonHeader) {
        console.error("FAIL: 'Sınav Salonu' table header is missing!");
        process.exit(1);
    }

    const hasRoomNameInRow = detailsHtml.includes("<td><i class=\"fa-solid fa-door-open\" style=\"color:var(--gray-400); margin-right:5px; font-size:0.8rem;\"></i> Laboratuvar-1</td>");
    console.log(`4. Room name cell 'Laboratuvar-1' in table rows present: ${hasRoomNameInRow} (Expected: true)`);
    if (!hasRoomNameInRow) {
        console.error("FAIL: Classroom door-open room name is missing in list table rows!");
        process.exit(1);
    }

    console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");

} catch (e) {
    console.error("Verification failed with runtime error:");
    console.error(e.stack || e);
    process.exit(1);
}
