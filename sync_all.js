const fs = require('fs');

const DATABASE_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";

function readJsonFile(path) {
    const buffer = fs.readFileSync(path);
    let content;
    
    // Check for UTF-16 BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        content = buffer.subarray(2).toString('utf16le');
    } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        content = buffer.subarray(2).reverse().toString('utf16le'); // BE to LE hack if needed
    } else if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        content = buffer.subarray(3).toString('utf8');
    } else {
        // Fallback: try utf8, then utf16le if it fails or looks wrong
        content = buffer.toString('utf8');
    }
    
    // If it's a bunch of nulls or nonsense, try utf16le
    if (content.includes('\u0000')) {
        content = buffer.toString('utf16le');
    }
    
    try {
        return JSON.parse(content);
    } catch (e) {
        console.error("JSON parse failed. Buffer preview:", buffer.subarray(0, 20));
        throw e;
    }
}

async function patchSchool(key, subjects) {
    const url = `${DATABASE_URL}/app_store/${key}.json`;
    const payload = JSON.stringify({
        school: {
            subjects: subjects
        }
    });
    
    console.log(`Patching ${key} with subjects:`, subjects.join(', '));
    
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: payload
    });
    
    if (response.ok) {
        console.log(`Successfully updated ${key}`);
    } else {
        console.error(`Failed to update ${key}: ${response.statusText}`);
    }
}

async function main() {
    try {
        const users = readJsonFile('users_final_clean.json');
        const schoolMap = {};

        Object.values(users).forEach(u => {
            if (u.storeKey && u.branch) {
                if (!schoolMap[u.storeKey]) schoolMap[u.storeKey] = new Set();
                const branches = Array.isArray(u.branch) ? u.branch : [u.branch];
                branches.forEach(b => {
                    if (b && typeof b === 'string') {
                        const trimmed = b.trim();
                        if (trimmed) schoolMap[u.storeKey].add(trimmed);
                    }
                });
            }
        });

        for (const [key, branches] of Object.entries(schoolMap)) {
            const subjectList = Array.from(branches).sort();
            await patchSchool(key, subjectList);
        }
        
        console.log("All subjects synced successfully.");
    } catch (err) {
        console.error("Error in main:", err);
    }
}

main();
