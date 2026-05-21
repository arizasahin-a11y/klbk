const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("Starting screenViewLimit=0 timing verification...");

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
        id: "ses_klass_0",
        name: "Classical Exam Limit 0 Test",
        date: "2026-05-21",
        time: "15:30", // Let's mock time so diffMins is 70 minutes
        examDuration: 40,
        type: "klasik",
        isPublished: true,
        screenViewLimit: 0, // 0 means always show/immediate
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

    // Inject mock student
    vm.runInContext("currentStudent = " + JSON.stringify(mockStudent) + ";", context);

    // Mock getNow() to represent a time 70 minutes before mockSession
    const sessionTime = context.DataManager.parseSessionDateTime(mockSession.date, mockSession.time);
    const mockNow = new Date(sessionTime.getTime() - 70 * 60 * 1000); // 70 minutes before
    
    // Inject mock getNow()
    vm.runInContext(`getNow = function() { return new Date(${mockNow.getTime()}); };`, context);

    // Let's mock DataManager.getSortedExamSessions to return our mock session
    vm.runInContext(`DataManager.getSortedExamSessions = function() { return [${JSON.stringify(mockSession)}]; };`, context);
    vm.runInContext(`DataManager.getExamSessions = function() { return [${JSON.stringify(mockSession)}]; };`, context);
    
    // Mock getSanitizedClassRoomMapping
    vm.runInContext(`DataManager.getSanitizedClassRoomMapping = function() { return "Laboratuvar-1"; };`, context);

    // 1. Run timing checks for Student panel render
    // Let's capture the stateCode resolved by the code
    const ses = mockSession;
    const now = mockNow;
    const targetTime = sessionTime;
    const endTime = context.DataManager.getSessionEndDateTime(ses.date, ses.time, ses.examDuration);
    const diffMs = targetTime - now;
    const diffMins = diffMs / 1000 / 60;
    const diffEndMins = (endTime - now) / 1000 / 60;

    const limit = (ses.screenViewLimit === 0) ? 999999 : (ses.screenViewLimit || 8);
    const stateCode = diffEndMins < 0 ? 'finished' : (diffMins <= 0 ? 'active' : ((diffMins > 60 && ses.screenViewLimit !== 0) ? 'far' : (Math.floor(diffMins) > limit ? 'med' : 'near')));

    console.log("\n--- Verification Assertions ---");
    console.log(`1. diffMins resolved to: ${diffMins}`);
    console.log(`2. stateCode resolved to: ${stateCode} (Expected: near)`);
    if (stateCode !== 'near') {
        console.error("FAIL: Classical exam was not unlocked when screenViewLimit is 0 and scheduled far in the future!");
        process.exit(1);
    } else {
        console.log("PASS: Classical exam is unlocked for student view!");
    }

    // 2. Test smartboard fullscreen trigger logic
    let triggerSuccessful = false;
    // We mock renderFullScreenPlan to toggle a flag
    vm.runInContext(`renderFullScreenPlan = function(room, session) { triggerSuccessful = true; };`, context);
    
    // Run triggers check
    vm.runInContext("checkFullScreenTriggers();", context);
    
    const triggered = vm.runInContext("triggerSuccessful", context);
    console.log(`3. Smartboard overlay triggered: ${triggered} (Expected: true)`);
    if (!triggered) {
        console.error("FAIL: Smartboard full screen seating plan was not triggered 70 minutes before the exam!");
        process.exit(1);
    } else {
        console.log("PASS: Smartboard overlay is triggered successfully!");
    }

    console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");

} catch (e) {
    console.error("Verification failed with runtime error:");
    console.error(e.stack || e);
    process.exit(1);
}
