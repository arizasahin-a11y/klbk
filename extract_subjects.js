const fs = require('fs');

function readJsonFile(path) {
    let content = fs.readFileSync(path);
    if (content[0] === 0xFF && content[1] === 0xFE) {
        content = content.subarray(2).toString('utf16le');
    } else if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
        content = content.subarray(3).toString('utf8');
    } else {
        content = content.toString('utf8');
    }
    return JSON.parse(content);
}

const users = readJsonFile('users_final.json');
const schoolSubjects = {};

Object.values(users).forEach(user => {
    if (user.storeKey && user.branch) {
        if (!schoolSubjects[user.storeKey]) {
            schoolSubjects[user.storeKey] = new Set();
        }
        const branches = Array.isArray(user.branch) ? user.branch : [user.branch];
        branches.forEach(b => {
             if (b && typeof b === 'string') {
                 schoolSubjects[user.storeKey].add(b.trim());
             }
        });
    }
});

const result = {};
for (const [key, branches] of Object.entries(schoolSubjects)) {
    result[key] = {
        school: {
            subjects: Array.from(branches).filter(b => b !== "").sort()
        }
    };
}

console.log(JSON.stringify(result, null, 2));
fs.writeFileSync('extracted_subjects.json', JSON.stringify(result, null, 2), 'utf8');
