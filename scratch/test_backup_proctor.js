const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser environment
const context = {
    console: console,
    window: {},
    document: {
        getElementById: () => null,
        addEventListener: () => {}
    },
    sessionStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    location: {
        pathname: '/ogretmen.html',
        href: ''
    },
    performance: {
        now: () => Date.now()
    },
    setInterval: () => {},
    setTimeout: () => {},
    fetch: async () => ({
        ok: true,
        json: async () => ({})
    })
};

context.window = context;
vm.createContext(context);

// Load core data script
const coreDataPath = path.join(__dirname, '..', 'js', 'core_data_v11_9_1.js');
const coreDataCode = fs.readFileSync(coreDataPath, 'utf8');
vm.runInContext(coreDataCode, context);

const DataManager = context.DataManager;

// Set school settings lesson times
DataManager._memoryData = {
    schoolSettings: {
        dailyLessons: 8,
        lessonTimes: {
            "1_start": "08:30", "1_end": "09:10",
            "2_start": "09:20", "2_end": "10:00",
            "3_start": "10:10", "3_end": "10:50",
            "4_start": "11:00", "4_end": "11:40",
            "5_start": "11:50", "5_end": "12:30",
            "6_start": "13:30", "6_end": "14:10",
            "7_start": "14:20", "7_end": "15:00",
            "8_start": "15:10", "8_end": "15:50"
        }
    }
};

// Test helper
function assert(condition, message) {
    if (!condition) {
        console.error("❌ FAILED:", message);
        process.exit(1);
    } else {
        console.log("✅ PASSED:", message);
    }
}

// 03.03.2026 is Tuesday -> "Sa"
const sessionBase = {
    id: "ses_1",
    name: "Test Sınavı",
    date: "03.03.2026",
    time: "3. Ders", // default exam hour is 3rd period
    results: [
        { name: "9A" }
    ]
};

// Scenario 1: Teacher's lessons start at 5th period, exam is 3rd period. (Should NOT be backup proctor)
let teachersDb = {
    "t1": {
        name: "Ahmet Yılmaz",
        role: "ogretmen",
        schedule: {
            "Sa": {
                "1": "-", "2": "-", "3": "-", "4": "-",
                "5": "10A", "6": "10B"
            }
        }
    }
};
let res = DataManager.calculateExamTeachers(sessionBase, teachersDb);
assert(
    res.globalSpares.find(s => s.uname === "t1") === undefined,
    "Scenario 1: Teacher starting at 5th period is NOT spare for 3rd period exam"
);

// Scenario 2: Teacher's lessons end at 4th period, exam is 7th period. (Should NOT be backup proctor)
teachersDb = {
    "t2": {
        name: "Mehmet Demir",
        role: "ogretmen",
        schedule: {
            "Sa": {
                "1": "11A", "2": "11B", "3": "11C", "4": "12A",
                "5": "-", "6": "-", "7": "-", "8": "-"
            }
        }
    }
};
let session7 = { ...sessionBase, time: "7. Ders" };
res = DataManager.calculateExamTeachers(session7, teachersDb);
assert(
    res.globalSpares.find(s => s.uname === "t2") === undefined,
    "Scenario 2: Teacher ending at 4th period is NOT spare for 7th period exam"
);

// Scenario 3: Teacher has a lesson during the exam hour (is double scheduled). (Should be spare proctor)
teachersDb = {
    "t3": {
        name: "Ayşe Kaya",
        role: "ogretmen",
        schedule: {
            "Sa": {
                "1": "-", "2": "-", "3": "9A", "4": "-", // has lesson in 9A, which has the exam
                "5": "-", "6": "-", "7": "-", "8": "-"
            }
        }
    }
};
res = DataManager.calculateExamTeachers(sessionBase, teachersDb);
// Since she is scheduled for 9A during the 3rd period, she will be assigned as gorevli for 9A (because she is the only one).
// Let's add a second teacher to 9A to make her a double spare!
teachersDb = {
    "t3": {
        name: "Ayşe Kaya",
        role: "ogretmen",
        schedule: {
            "Sa": {
                "1": "-", "2": "-", "3": "9A", "4": "-"
            }
        }
    },
    "t3_double": {
        name: "Fatma Şen",
        role: "ogretmen",
        schedule: {
            "Sa": {
                "1": "-", "2": "-", "3": "9A", "4": "-"
            }
        }
    }
};
res = DataManager.calculateExamTeachers(sessionBase, teachersDb);
// One of them will be the main proctor, the other will be a spare
assert(
    res.globalSpares.find(s => s.uname === "t3" || s.uname === "t3_double") !== undefined,
    "Scenario 3: Co-teacher assigned to same class at exam hour becomes a spare proctor"
);

// Scenario 4: Teacher's lesson ended at 4th period, exam is 5th period. (Should be spare proctor - 1 period later)
teachersDb = {
    "t4": {
        name: "Veli Can",
        role: "ogretmen",
        schedule: {
            "Sa": {
                "1": "9A", "2": "9B", "3": "9C", "4": "10A",
                "5": "-", "6": "-", "7": "-", "8": "-"
            }
        }
    }
};
let session5 = { ...sessionBase, time: "5. Ders" };
res = DataManager.calculateExamTeachers(session5, teachersDb);
assert(
    res.globalSpares.find(s => s.uname === "t4") !== undefined,
    "Scenario 4: Teacher ending at 4th period is spare for 5th period exam (1 lesson after)"
);

// Scenario 5: Teacher's lesson ended at 4th period, exam is 6th period. (Should NOT be spare proctor - 2 periods later)
teachersDb = {
    "t5": {
        name: "Elif Ak",
        role: "ogretmen",
        schedule: {
            "Sa": {
                "1": "9A", "2": "9B", "3": "9C", "4": "10A",
                "5": "-", "6": "-", "7": "-", "8": "-"
            }
        }
    }
};
let session6 = { ...sessionBase, time: "6. Ders" };
res = DataManager.calculateExamTeachers(session6, teachersDb);
assert(
    res.globalSpares.find(s => s.uname === "t5") === undefined,
    "Scenario 5: Teacher ending at 4th period is NOT spare for 6th period exam (2 lessons after)"
);

// Scenario 6: Administrator has no lessons but is at school. (Should ALWAYS be spare proctor)
teachersDb = {
    "admin1": {
        name: "Müdür Bey",
        role: "idareci",
        schedule: {
            "Sa": {} // no lessons scheduled
        }
    }
};
res = DataManager.calculateExamTeachers(sessionBase, teachersDb);
assert(
    res.globalSpares.find(s => s.uname === "admin1") !== undefined,
    "Scenario 6: Administrator with empty schedule is ALWAYS spare for any exam"
);

console.log("\n🎉 All 6 Scenarios Passed Perfectly! The backup proctor logic behaves 100% correctly.");
