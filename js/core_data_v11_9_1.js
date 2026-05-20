/**
 * Data Storage & Management Module
 * Manages school settings, classes, students, and classrooms using LocalStorage
 */

// --- SESSION RESTORATION (AUTO-LOGIN) ---
(function() {
    // Öğrenci sayfalarında (obfuscated veya değil) oturum geri yükleme yapma
    const path = window.location.pathname;
    const isStudentPage = path.includes('ogrenci') || path.includes('j2k5l0p8') || path.includes('j2k5');
    if (isStudentPage) return;

    if (!sessionStorage.getItem('klbk_isLoggedIn')) {
        const persistent = localStorage.getItem('klbk_persistent_session');
        if (persistent) {
            try {
                const data = JSON.parse(persistent);
                // Ensure we have a valid login time
                const loginTime = data.klbk_loginTime ? new Date(data.klbk_loginTime) : new Date();
                const now = new Date();
                const diffDays = (now - loginTime) / (1000 * 60 * 60 * 24);

                // Session valid for 30 days
                if (diffDays < 30) {
                    for (const [key, value] of Object.entries(data)) {
                        sessionStorage.setItem(key, value);
                    }
                    sessionStorage.setItem('klbk_isLoggedIn', 'true');
                    console.log("Session restored from persistent storage.");
                } else {
                    localStorage.removeItem('klbk_persistent_session');
                    console.log("Persistent session expired.");
                }
            } catch (e) {
                console.error("Persistent session restoration failed", e);
                localStorage.removeItem('klbk_persistent_session');
            }
        }
    }
})();

// Default initial state
const initialState = {
    school: {
        name: '',
        academicYear: '',
        principal: '',
        vicePrincipal: '',
        classCount: '',   // Sınıf Sayısı
        roomCount: '',    // Derslik Sayısı
        gradeLevels: [],  // [9, 10, 11, 12]
        subjects: []      // ['Matematik', 'Fizik']
    },
    students: [],         // Array of student objects
    classrooms: [],       // Array of classroom layout objects
    examSessions: []      // Array of configured exam sessions
};

const DataManager = {

    // Cloud Configuration (Firebase DB & Google Drive Storage)
    firebaseDatabaseUrl: "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app", 
    gasStorageUrl: "https://script.google.com/macros/s/AKfycbz6K2I5ylOxaDR_QbT2XnPA6wh2HrquAgM3mrbVZ4x-3nPqVf4KXJMTnGCWlPj2lvBZyQ/exec",
    _memoryData: null,

    // Helper to format teacher names as "Proper SURNAME" (e.g., Ali Rıza ŞAHİN)
    formatTeacherName: function (name) {
        if (!name) return "";
        // Clean multiple spaces and trim
        const cleanName = name.trim().replace(/\s+/g, ' ');
        const parts = cleanName.split(' ');
        if (parts.length === 0) return "";
        
        if (parts.length === 1) {
            // Single word - treat as surname if it's all that's provided
            return parts[0].toLocaleUpperCase('tr-TR');
        }

        const surname = parts.pop().toLocaleUpperCase('tr-TR');
        const firstNames = parts.map(n => {
            if (!n) return "";
            // Proper Case: First letter Upper, rest Lower
            return n.charAt(0).toLocaleUpperCase('tr-TR') + n.slice(1).toLocaleLowerCase('tr-TR');
        }).join(" ");

        return `${firstNames} ${surname}`;
    },

    // Get Key
    _getStorageKey: function () {
        const storeKey = sessionStorage.getItem('klbk_storeKey');
        if (storeKey) return storeKey;
        const user = sessionStorage.getItem('klbk_currentUser') || 'admin';
        return `klbk_data_${user}`;
    },

    // Firebase prohibited keys: . $ # [ ] /
    sanitizeFirebaseKey: function (key) {
        if (key === null || key === undefined) return "unknown";
        // Ensure it's a string and replace forbidden characters
        return String(key).replace(/[\.\$\#\[\]\/]/g, '_');
    },

    _deepSanitizeKeys: function (obj) {
        if (obj === null || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => DataManager._deepSanitizeKeys(item));
        }

        const sanitized = {};
        for (let key in obj) {
            const safeKey = DataManager.sanitizeFirebaseKey(key);
            sanitized[safeKey] = DataManager._deepSanitizeKeys(obj[key]);
        }
        return sanitized;
    },

    getSanitizedSubjectMetadata: function (session, subjectName) {
        if (!session || !session.subjectMetadata) return {};
        const safeKey = this.sanitizeFirebaseKey(subjectName);
        
        // Try sanitized key first (new standard)
        if (session.subjectMetadata[safeKey]) return session.subjectMetadata[safeKey];
        
        // Fallback to unsanitized key (legacy support - may contain dots)
        // This allows existing data to be read even before it is re-saved with safe keys
        if (session.subjectMetadata[subjectName]) return session.subjectMetadata[subjectName];
        
        return {};
    },

    // Initialize Cloud Data (Must be called on page load)
    initCloud: async function () {
        const key = this._getStorageKey();
        try {
            const encodedKey = encodeURIComponent(key);
            const res = await fetch(`${this.firebaseDatabaseUrl}/app_store/${encodedKey}.json?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                if (data) { 
                    // Race Condition Check: Don't overwrite memory if a local change just happened
                    const lastLocal = parseInt(localStorage.getItem('klbk_lastLocalChange') || '0');
                    if (Date.now() - lastLocal < 5000) {
                        console.log("Skipping cloud load: Local change in progress...");
                        return;
                    }

                    this._memoryData = data;
                    localStorage.setItem(key, JSON.stringify(data)); // Sync cloud to local
                    console.log("%c CLOUD SUCCESS: Loaded data for " + key, "background: #22c55e; color: white; padding: 2px 5px;");
                    this._migrateDateFormats(); 
                    return;
                }
            }
        } catch (e) {
            console.error("Cloud fetch failed for:", key, e);
        }

        console.log("Checking LocalStorage fallback for:", key);
        // Fallback to LocalStorage if cloud fails
        const local = localStorage.getItem(key);
        if (local) {
            try {
                this._memoryData = JSON.parse(local);
                console.log("Offline mode: Loaded data from local storage for:", key);
                this._migrateDateFormats();
                return;
            } catch (e) { 
                console.error("Local storage parse failed:", e);
            }
        }

        // Final fallback: Initial state
        this._memoryData = JSON.parse(JSON.stringify(initialState));
    },

    // Sync Memory Data to Cloud
    _syncToCloud: async function (data) {
        const key = this._getStorageKey();
        try {
            // Validate data before sync
            if (!data) throw new Error("Sync attempts with null data");
            
            // Deep copy to strip any non-serializable properties (functions, DOM refs, etc)
            // This often fixes 400 Bad Request errors in Firebase
            // Recursive deep sanitize all keys to prevent 400 errors from dots/slashes/etc
            const cleanData = this._deepSanitizeKeys(data);
            const payload = JSON.stringify(cleanData);
            
            if (!payload || payload === "{}") {
                console.warn("Syncing empty or invalid object skipped");
                return;
            }

            // URL encode the key to handle Turkish characters in the path safely
            const encodedKey = encodeURIComponent(key);
            const res = await fetch(`${this.firebaseDatabaseUrl}/app_store/${encodedKey}.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: payload
            });

            if (!res.ok) {
                const errText = await res.text();
                let serverMsg = errText;
                try {
                    const errObj = JSON.parse(errText);
                    if (errObj.error) serverMsg = errObj.error;
                } catch(e) {}

                const errMsg = `Firebase Kayıt Hatası (${res.status}): ${serverMsg}`;
                console.error(errMsg, "Key:", key);
                
                // Extract keys with forbidden characters for debugging
                const findForbiddenKeys = (obj, path = '') => {
                    let forbidden = [];
                    for (let k in obj) {
                        if (/[\.\$\#\[\]\/]/.test(k)) {
                            forbidden.push(`${path}${k}`);
                        }
                        if (obj[k] && typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                            forbidden = forbidden.concat(findForbiddenKeys(obj[k], `${path}${k} -> `));
                        }
                    }
                    return forbidden;
                };

                const issues = findForbiddenKeys(cleanData);
                if (issues.length > 0) {
                    console.warn("Tespit edilen geçersiz anahtarlar:", issues);
                }

                if (window.Swal) {
                    Swal.fire({
                        title: 'Bulut Eşitleme Hatası',
                        html: `Verileriniz buluta kaydedilemedi.<br><br><b>Hata:</b> ${serverMsg}<br><br>${issues.length > 0 ? `<b>Geçersiz Karakter İçeren Anahtarlar:</b><br><small>${issues.join('<br>')}</small>` : 'Lütfen internetinizi veya veri formatını kontrol edin.'}`,
                        icon: 'error'
                    });
                }
            } else {
                console.log("Data successfully synced to cloud for:", key);
            }
        } catch (e) {
            console.error("Cloud sync failed for:", key, e);
            if (window.Swal) {
                Swal.fire('Bağlantı Hatası', 'Buluta erişilemiyor veya veri hatası oluştu. Lütfen internetinizi kontrol edin.', 'warning');
            }
        }
    },

    // Helper to safely format paths for cloud buckets (removes special chars & turkish chars)
    sanitizeSupabaseString: function (str) {
        if (!str) return '';
        const trMap = {
            'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
            'ı': 'i', 'I': 'I', 'İ': 'I',
            'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S',
            'ü': 'u', 'Ü': 'U', ' ': '_'
        };
        let s = '';
        for (let char of str) s += trMap[char] || char;
        // Keep only alphanumeric, dot, hyphen, underscore safely
        return s.replace(/[^a-zA-Z0-9.\-_]/g, '');
    },

    // --- Cloud Storage (Google Drive via Apps Script) ---
    uploadFileToSupabase: async function (file) {
        if (!file) return null;

        const currentUser = sessionStorage.getItem('klbk_currentUser') || 'unknown';
        const cleanUser = this.sanitizeSupabaseString(currentUser);
        let cleanName = this.sanitizeSupabaseString(file.name);
        const uniqueFileName = `${cleanUser}_${cleanName}`;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result.split(',')[1];
                
                try {
                    const formData = new URLSearchParams();
                    formData.append('action', 'upload');
                    formData.append('fileName', uniqueFileName);
                    formData.append('mimeType', file.type || 'application/pdf');
                    formData.append('fileData', base64Data);

                    const res = await fetch(this.gasStorageUrl, {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await res.json();
                    if (data && data.success) {
                        resolve(data.url);
                    } else {
                        reject(new Error(data.error || "Unknown GAS upload error"));
                    }
                } catch (e) {
                    console.error("GAS Upload Error:", e);
                    reject(e);
                }
            };
            reader.onerror = error => reject(error);
        });
    },

    deleteSupabaseFile: async function (fileName) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'delete');
            formData.append('fileName', fileName);

            const res = await fetch(this.gasStorageUrl, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data && data.success) {
                return true;
            } else {
                throw new Error(data.error || "Unknown GAS delete error");
            }
        } catch (e) {
            console.error("GAS Delete Error:", e);
            throw e;
        }
    },

    listSupabaseFiles: async function (teacherOnly = false) {
        const currentUser = sessionStorage.getItem('klbk_currentUser') || '';

        try {
            const formData = new URLSearchParams();
            formData.append('action', 'list');

            const res = await fetch(this.gasStorageUrl, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data && data.success) {
                let mappedFiles = data.files.map(f => {
                    return {
                        name: f.name,
                        url: f.url,
                        created_at: f.created_at
                    };
                });

                if (teacherOnly && currentUser) {
                    const searchPrefix = this.sanitizeSupabaseString(currentUser) + '_';
                    mappedFiles = mappedFiles.filter(f => f.name.startsWith(searchPrefix));
                }

                return mappedFiles;
            } else {
                throw new Error(data.error || "Failed to list files via GAS");
            }
        } catch (e) {
            console.error("GAS List Error:", e);
            throw e;
        }
    },

    // Internal Method: Get Full Data Store (Returns Memory)
    _getData: function () {
        // Ensure core structure always exists to prevent crashes
        const base = JSON.parse(JSON.stringify(initialState));
        if (!this._memoryData) {
            console.warn("DataManager accessed before initCloud! Returning default state.");
            return base;
        }

        const data = this._memoryData;
        
        // --- DATA HARDENING: Ensure core keys are Arrays (Firebase fallback) ---
        // If Firebase saved these as objects (0:..., 1:...), convert back to arrays
        const ensureArray = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            return Object.values(val);
        };

        return { 
            ...base, 
            ...data,
            students: ensureArray(data.students),
            classrooms: ensureArray(data.classrooms),
            examSessions: ensureArray(data.examSessions)
        };
    },

    // Internal Method: Save Full Data Store (Updates Memory & Triggers Sync)
    _saveData: function (data) {
        // Always sanitize before storing anywhere (memory, local, or cloud)
        // to ensure consistency across all storage layers.
        const cleanData = this._deepSanitizeKeys(data);
        this._memoryData = cleanData;
        const key = this._getStorageKey();
        localStorage.setItem(key, JSON.stringify(cleanData));
        this._syncToCloud(cleanData);
    },

    // --- School API ---
    getSchoolSettings: function () {
        return this._getData().school;
    },

    saveSchoolSettings: function (settingsObj) {
        const data = this._getData();
        const oldName = data.school.name;
        data.school = { ...data.school, ...settingsObj };
        this._saveData(data);

        // Sync new school name back to Master DB if it was changed
        if (settingsObj.name && oldName !== settingsObj.name) {
            this._updateMasterSchoolName(settingsObj.name);
        }
    },

    // Sync school name changes from the dashboard back to the root Master DB
    _updateMasterSchoolName: async function (newName) {
        const storeKey = this._getStorageKey();
        try {
            const res = await fetch(`${this.firebaseDatabaseUrl}/app_store/klbk_users.json`);
            if (res.ok) {
                const usersDb = await res.json();
                if (usersDb) {
                    let updated = false;

                    for (const [uname, user] of Object.entries(usersDb)) {
                        if (uname === 'admin') continue;
                        const userStoreKey = user.storeKey || `klbk_data_${uname}`;
                        if (userStoreKey === storeKey && user.schoolName !== newName) {
                            user.schoolName = newName;
                            updated = true;
                        }
                    }

                    if (updated) {
                        await fetch(`${this.firebaseDatabaseUrl}/app_store/klbk_users.json`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(usersDb)
                        });
                        console.log("Master school name updated for related users.");
                        sessionStorage.setItem('klbk_schoolName', newName); // Local cache sync
                    }
                }
            }
        } catch (e) {
            console.error("Failed to update master school name", e);
        }
    },

    getClassRoomMappings: function () {
        return this._getData().classRoomMappings || {};
    },

    getSanitizedClassRoomMapping: function (className) {
        const mappings = this.getClassRoomMappings();
        const safeKey = this.sanitizeFirebaseKey(className);
        
        // 1. Check sanitized key
        if (mappings[safeKey]) return mappings[safeKey];
        // 2. Fallback to original key
        if (mappings[className]) return mappings[className];
        
        return null;
    },

    saveClassRoomMapping: function (className, roomName) {
        const data = this._getData();
        if (!data.classRoomMappings) data.classRoomMappings = {};
        const safeKey = this.sanitizeFirebaseKey(className);

        if (roomName) {
            data.classRoomMappings[safeKey] = roomName;
            // Also cleanup legacy key if it exists and is different from safeKey
            if (safeKey !== className && data.classRoomMappings[className]) {
                delete data.classRoomMappings[className];
            }
        } else {
            delete data.classRoomMappings[safeKey];
            if (safeKey !== className) delete data.classRoomMappings[className];
        }
        this._saveData(data);
    },

    // --- Students API ---
    getStudents: function () {
        const students = this._getData().students;
        if (!students) return [];
        return Array.isArray(students) ? students : Object.values(students);
    },

    addStudent: function (studentObj) {
        const data = this._getData();
        // Check if exists using robust string comparison
        const exists = data.students.findIndex(s => String(s.no).trim() === String(studentObj.no).trim());
        if (exists !== -1) {
            data.students[exists] = { ...data.students[exists], ...studentObj }; // Merge update
        } else {
            data.students.push(studentObj);
        }
        this._saveData(data);
    },

    bulkImportStudents: function (studentList, mode) {
        const data = this._getData();
        const stats = {
            totalStudents: 0,
            totalClasses: 0,
            addedCount: 0,
            deletedCount: 0,
            classChangedCount: 0
        };

        // Helper for student identification (Number + Name) - Robust against Turkish casing
        const normalizeName = (n) => (n || '').trim().replace(/i/g, 'İ').toUpperCase();
        const getId = s => `${String(s.no).trim()}|${normalizeName(s.name)}`;

        if (mode === 'fresh') {
            const classesSet = new Set();
            studentList.forEach(s => classesSet.add(s.class));
            stats.totalStudents = studentList.length;
            stats.totalClasses = classesSet.size;
            data.students = studentList;
        } else {
            // mode === 'update' (Sync operation - Class aware)
            const existingStudents = data.students || [];
            const existingMap = new Map();
            existingStudents.forEach(s => existingMap.set(getId(s), s));

            const newStudentsMap = new Map();
            studentList.forEach(s => newStudentsMap.set(getId(s), s));
            
            // Classes present in the new Excel list
            const classesInExcel = new Set();
            studentList.forEach(s => classesInExcel.add(s.class));

            const finalStudents = [];

            // 1. Process new students and updates from Excel
            studentList.forEach(newStd => {
                const id = getId(newStd);
                if (existingMap.has(id)) {
                    // Existing student - check for class change or other updates
                    const existingStd = existingMap.get(id);
                    if (existingStd.class !== newStd.class) {
                        stats.classChangedCount++;
                    }
                    // Merge data, keeping existing student's extra data but updating Excel fields
                    finalStudents.push({ ...existingStd, ...newStd });
                } else {
                    // New student
                    stats.addedCount++;
                    finalStudents.push(newStd);
                }
            });

            // 2. Decide what to do with existing students NOT in the Excel file
            existingStudents.forEach(oldStd => {
                const id = getId(oldStd);
                if (!newStudentsMap.has(id)) {
                    // This student is NOT in the new list.
                    // If their class IS in the Excel file, it means they are intentional deletions for that class.
                    // If their class IS NOT in the Excel file, we KEEP them (Partial update support).
                    if (classesInExcel.has(oldStd.class)) {
                        stats.deletedCount++;
                    } else {
                        finalStudents.push(oldStd);
                    }
                }
            });

            data.students = finalStudents;
        }

        this._saveData(data);
        return stats;
    },

    resetAllStudentRuleAcceptances: function () {
        const data = this._getData();
        if (!data.students) return 0;
        let count = 0;
        data.students.forEach(s => {
            if (s.rulesAcceptedAt) {
                s.rulesAcceptedAt = 0; // Reset
                count++;
            }
        });
        if (count > 0) {
            this._saveData(data);
        }
        return count;
    },

    // --- Classrooms API ---
    getClassrooms: function () {
        const rooms = this._getData().classrooms;
        if (!rooms) return [];
        return Array.isArray(rooms) ? rooms : Object.values(rooms);
    },

    addClassroom: function (roomObj) {
        const data = this._getData();
        const exists = data.classrooms.findIndex(r => r.name === roomObj.name);
        if (exists !== -1) {
            data.classrooms[exists] = roomObj;
        } else {
            data.classrooms.push(roomObj);
        }
        this._saveData(data);
    },

    removeClassroom: function (name) {
        const data = this._getData();
        data.classrooms = data.classrooms.filter(r => r.name !== name);
        this._saveData(data);
    },

    // --- Exam Sessions API ---
    getExamSessions: function () {
        const sessions = this._getData().examSessions;
        if (!sessions) return [];
        return Array.isArray(sessions) ? sessions : Object.values(sessions);
    },

    addExamSession: function (sessionObj) {
        const data = this._getData();
        if (!data.examSessions) data.examSessions = [];

        // Apply default messages if empty
        if (!sessionObj.studentMsg) {
            sessionObj.studentMsg = "Lütfen sınav kurallarına uyunuz. Görevli Öğretmen sizi uyarmak zorunda değildir.";
        }
        if (!sessionObj.teacherMsg) {
            sessionObj.teacherMsg = "Gelmeyen öğrencinin açıklama hanesine GİRMEDİ yazınız. Kolaylıklar dilerim";
        }
        if (sessionObj.date) {
            sessionObj.date = this.formatDateToStandard(sessionObj.date);
        }
        if (typeof sessionObj.isPublished === 'undefined') {
            sessionObj.isPublished = false;
        }

        const exists = data.examSessions.findIndex(s => s.id === sessionObj.id);
        if (exists !== -1) {
            data.examSessions[exists] = sessionObj;
        } else {
            data.examSessions.push(sessionObj);
        }
        this._saveData(data);
    },

    removeExamSession: function (id) {
        const data = this._getData();
        if (!data.examSessions) return;
        data.examSessions = data.examSessions.filter(s => s.id !== id);
        this._saveData(data);
    },

    // --- Sorted Exam Sessions for UI ---
    getSortedExamSessions: function () {
        const sessions = this.getExamSessions();
        if (!sessions || sessions.length === 0) return [];

        const nowTime = new Date().getTime();

        return [...sessions].sort((a, b) => {
            const startA = this.parseSessionDateTime(a.date, a.time).getTime();
            const startB = this.parseSessionDateTime(b.date, b.time).getTime();

            const diffA = Math.abs(startA - nowTime);
            const diffB = Math.abs(startB - nowTime);

            return diffA - diffB;
        });
    },

    parseSessionDateTime: function (dateStr, timeStr) {
        if (!dateStr) return new Date(0);
        let ds = dateStr;
        if (ds.includes('.')) {
            const parts = ds.split('.');
            if (parts.length === 3 && parts[0].length === 2) {
                ds = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD.MM.YYYY to YYYY-MM-DD
            }
        }

        let ts = timeStr || "00:00";
        if (ts.includes('. Ders')) {
            const lessonNum = parseInt(ts);
            const school = this.getSchoolSettings();
            const lessonTimes = school.lessonTimes || {};
            const startTime = lessonTimes[`${lessonNum}_start`];
            ts = startTime || "08:00"; // Default to 08:00 if not set
        } else if (ts.includes(':')) {
            const [h, m] = ts.split(':');
            ts = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        }

        const d = new Date(`${ds}T${ts}:00`);
        // If invalid date, return epoch
        return isNaN(d.getTime()) ? new Date(0) : d;
    },

    getSessionEndDateTime: function (dateStr, timeStr, forcedDuration) {
        const start = this.parseSessionDateTime(dateStr, timeStr);
        let duration = forcedDuration || 40; // Default 40 mins

        if (!forcedDuration && timeStr && timeStr.includes('. Ders')) {
            const lessonNum = parseInt(timeStr);
            const school = this.getSchoolSettings();
            const lessonTimes = school.lessonTimes || {};
            const endStr = lessonTimes[`${lessonNum}_end`];
            if (endStr) {
                let ds = dateStr;
                if (ds.includes('.')) {
                    const parts = ds.split('.');
                    if (parts.length === 3 && parts[0].length === 2) { ds = `${parts[2]}-${parts[1]}-${parts[0]}`; }
                }
                const d = new Date(`${ds}T${endStr}:00`);
                if (!isNaN(d.getTime())) return d;
            }
        }

        return new Date(start.getTime() + duration * 60000);
    },

    // --- Dashboard Specific Computed Data ---
    getStats: function () {
        const data = this._getData();
        const totalStudents = data.students.length;

        // Find unique classes
        const classesSet = new Set();
        data.students.forEach(s => classesSet.add(s.class));
        const totalClasses = classesSet.size;

        const totalRooms = data.classrooms.length;

        let totalCapacity = 0;
        data.classrooms.forEach(room => {
            let roomSeats = 0;
            if (room.groupConfigs) {
                room.groupConfigs.forEach(conf => roomSeats += (conf.rows * conf.cols));
            } else {
                roomSeats = (room.groups || 1) * (room.rows || 1) * (room.cols || 1);
            }
            const disabledCount = room.disabledSeats ? room.disabledSeats.length : 0;
            totalCapacity += (roomSeats - disabledCount);
        });

        return {
            totalStudents,
            totalClasses,
            totalRooms,
            totalCapacity
        };
    },

    // --- Date Format Helpers & Migration ---
    formatDateToStandard: function (val) {
        if (!val) return "";
        if (val.includes('-')) {
            const parts = val.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
                return `${parts[2]}.${parts[1]}.${parts[0]}`; // YYYY-MM-DD to DD.MM.YYYY
            }
        }
        return val;
    },

    formatDateToInput: function (val) {
        if (!val) return "";
        if (val.includes('.')) {
            const parts = val.split('.');
            if (parts.length === 3 && parts[0].length === 2) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD.MM.YYYY to YYYY-MM-DD
            }
        }
        return val;
    },

    _migrateDateFormats: function () {
        if (!this._memoryData || !this._memoryData.examSessions) return;
        let changed = false;
        this._memoryData.examSessions.forEach(ses => {
            if (ses && ses.date && typeof ses.date === 'string') {
                // If it's YYYY-MM-DD (Standard HTML Date Input)
                if (ses.date.includes('-')) {
                    ses.date = this.formatDateToStandard(ses.date);
                    changed = true;
                }
                // If it's YYYY.MM.DD (Incorrectly saved earlier)
                else if (ses.date.includes('.') && ses.date.split('.')[0].length === 4) {
                    const parts = ses.date.split('.');
                    if (parts.length === 3) {
                        ses.date = `${parts[2]}.${parts[1]}.${parts[0]}`;
                        changed = true;
                    }
                }
            }
        });
        if (changed) {
            console.log("Date formats fixed and standardized to DD.MM.YYYY");
            this._saveData(this._memoryData);
        }
    },

    // --- PDF & File Fetching Utilities ---
    _fileBytesCache: {},

    validateBuffer: function (buffer) {
        if (!buffer || buffer.byteLength < 16) return false;
        
        const arr = new Uint8Array(buffer.slice(0, 50));
        const str = String.fromCharCode(...arr);
        
        // Kesin PDF imzası (Baştaki 1024 byte içinde %PDF- olmalı)
        const headerStr = String.fromCharCode(...new Uint8Array(buffer.slice(0, 1024)));
        if (headerStr.includes('%PDF-')) return true;

        // TTF: 0x00 0x01 0x00 0x00
        if (arr[0] === 0x00 && arr[1] === 0x01 && arr[2] === 0x00 && arr[3] === 0x00) return true;
        // OTF: 'OTTO'
        if (arr[0] === 0x4F && arr[1] === 0x54 && arr[2] === 0x54 && arr[3] === 0x4F) return true;
        // WOFF: 'wOFF'
        if (arr[0] === 0x77 && arr[1] === 0x4F && arr[2] === 0x46 && arr[3] === 0x46) return true;
        // WOFF2: 'wOF2'
        if (arr[0] === 0x77 && arr[1] === 0x4F && arr[2] === 0x46 && arr[3] === 0x32) return true;

        // JPEG: FF D8 FF
        if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) return true;
        // PNG: 89 50 4E 47
        if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) return true;
        // GIF: GIF8
        if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) return true;
        // WEBP: RIFF .... WEBP
        if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 && arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) return true;

        // MP3 (ID3v2): ID3
        if (arr[0] === 0x49 && arr[1] === 0x44 && arr[2] === 0x33) return true;
        // MP3 (no ID3 tag): FF FB or FF F3 or FF F2
        if (arr[0] === 0xFF && (arr[1] === 0xFB || arr[1] === 0xF3 || arr[1] === 0xF2)) return true;
        // MP4 / M4A: starts with ftyp at index 4
        if (arr[4] === 0x66 && arr[5] === 0x74 && arr[6] === 0x79 && arr[7] === 0x70) return true;
        // WAV: RIFF at start and WAVE at byte 8
        if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 && arr[8] === 0x57 && arr[9] === 0x41 && arr[10] === 0x56 && arr[11] === 0x45) return true;
        // OGG: OggS
        if (arr[0] === 0x4F && arr[1] === 0x67 && arr[2] === 0x67 && arr[3] === 0x53) return true;
        // WEBM / MKV: EBML header (1A 45 DF A3)
        if (arr[0] === 0x1A && arr[1] === 0x45 && arr[2] === 0xDF && arr[3] === 0xA3) return true;

        // Kesin emin olamadıysak reddet.
        const sig = Array.from(arr.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.warn(`Tampon doğrulanamadı (Boyut: ${buffer.byteLength}). İmza: ${sig} | Metin: ${str.slice(0, 20)}`);
        return false;
    },

    detectMimeType: function (buffer, defaultType = 'application/octet-stream') {
        if (!buffer || buffer.byteLength < 12) return defaultType;
        const arr = new Uint8Array(buffer.slice(0, 50));
        
        // PDF
        const headerStr = String.fromCharCode(...new Uint8Array(buffer.slice(0, 1024)));
        if (headerStr.includes('%PDF-')) return 'application/pdf';
        
        // JPEG
        if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) return 'image/jpeg';
        // PNG
        if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) return 'image/png';
        // GIF
        if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) return 'image/gif';
        // WEBP
        if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 && arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) return 'image/webp';
        
        // MP3
        if (arr[0] === 0x49 && arr[1] === 0x44 && arr[2] === 0x33) return 'audio/mpeg';
        if (arr[0] === 0xFF && (arr[1] === 0xFB || arr[1] === 0xF3 || arr[1] === 0xF2)) return 'audio/mpeg';
        // WAV
        if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 && arr[8] === 0x57 && arr[9] === 0x41 && arr[10] === 0x56 && arr[11] === 0x45) return 'audio/wav';
        // OGG
        if (arr[0] === 0x4F && arr[1] === 0x67 && arr[2] === 0x67 && arr[3] === 0x53) return 'audio/ogg';
        // WEBM
        if (arr[0] === 0x1A && arr[1] === 0x45 && arr[2] === 0xDF && arr[3] === 0xA3) return 'video/webm';
        
        // MP4 / M4A
        if (arr[4] === 0x66 && arr[5] === 0x74 && arr[6] === 0x79 && arr[7] === 0x70) {
            const brand = String.fromCharCode(arr[8], arr[9], arr[10], arr[11]);
            if (brand.includes('m4a') || brand.includes('M4A')) return 'audio/mp4';
            return 'video/mp4';
        }
        
        return defaultType;
    },

    detectMimeTypeOnline: async function (url) {
        if (!url) return 'application/octet-stream';
        const lowerUrl = url.toLowerCase();

        // 1. Uzantı kontrolü (En hızlı yöntem, ağ gerektirmez)
        if (lowerUrl.match(/\.(mp4|m4v)$/)) return 'video/mp4';
        if (lowerUrl.match(/\.webm$/)) return 'video/webm';
        if (lowerUrl.match(/\.(mp3|mpeg)$/)) return 'audio/mpeg';
        if (lowerUrl.match(/\.wav$/)) return 'audio/wav';
        if (lowerUrl.match(/\.ogg$/)) return 'audio/ogg';
        if (lowerUrl.match(/\.pdf$/)) return 'application/pdf';
        if (lowerUrl.match(/\.(jpg|jpeg)$/)) return 'image/jpeg';
        if (lowerUrl.match(/\.png$/)) return 'image/png';
        if (lowerUrl.match(/\.gif$/)) return 'image/gif';
        if (lowerUrl.match(/\.webp$/)) return 'image/webp';

        // 2. Google Drive ID Çıkarma
        let driveId = null;
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const parts = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                          url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                          url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                          url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
            if (parts) driveId = parts[1];
        }

        // 3. İlk chunk indirme & abort (Sadece ilk birkaç KB indirilip bağlantı kesilir!)
        const targetUrls = [];
        if (driveId) {
            targetUrls.push(`https://drive.google.com/uc?export=download&id=${driveId}`);
            targetUrls.push(`https://drive.usercontent.google.com/download?id=${driveId}&export=download`);
        } else {
            targetUrls.push(url);
        }

        const proxies = [
            "https://corsproxy.io/?",
            "https://api.allorigins.win/raw?url=",
            "https://api.codetabs.com/v1/proxy?quest="
        ];

        const fetchFirstChunk = async (fetchUrl) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            try {
                const res = await fetch(fetchUrl, { signal: controller.signal });
                if (!res.ok) throw new Error("Status " + res.status);
                const reader = res.body.getReader();
                const { value, done } = await reader.read();
                clearTimeout(timeoutId);
                reader.cancel(); // Kalan indirmeyi anında iptal et!
                if (value && value.length > 0) {
                    return value.buffer;
                }
            } catch (e) {
                clearTimeout(timeoutId);
                return null;
            }
            return null;
        };

        // Google Drive değilse önce doğrudan dene
        if (!driveId) {
            const buf = await fetchFirstChunk(url);
            if (buf) {
                const mime = this.detectMimeType(buf);
                if (mime !== 'application/octet-stream') return mime;
            }
        }

        // CORS Proxyleri üzerinden ilk paketleri çekmeyi dene
        for (const tUrl of targetUrls) {
            for (const proxy of proxies) {
                const proxyUrl = proxy + encodeURIComponent(tUrl);
                const buf = await fetchFirstChunk(proxyUrl);
                if (buf) {
                    const mime = this.detectMimeType(buf);
                    if (mime !== 'application/octet-stream') return mime;
                }
            }
        }

        // Anahtar kelime eşleştirmesi (Fallback)
        if (lowerUrl.includes('video') || lowerUrl.includes('movie')) return 'video/mp4';
        if (lowerUrl.includes('audio') || lowerUrl.includes('sound') || lowerUrl.includes('music')) return 'audio/mpeg';

        return 'application/octet-stream';
    },

    _idbFileCache: null,
    _initIdb: function() {
        if (this._idbFileCache) return this._idbFileCache;
        this._idbFileCache = new Promise((resolve) => {
            try {
                const req = indexedDB.open('klbk_files', 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = () => resolve(null);
            } catch(e) { resolve(null); }
        });
        return this._idbFileCache;
    },
    _getIdbCache: async function(url) {
        try {
            const db = await this._initIdb();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction('cache', 'readonly');
                const req = tx.objectStore('cache').get(url);
                req.onsuccess = () => resolve(req.result ? req.result.buffer : null);
                req.onerror = () => resolve(null);
            });
        } catch(e) { return null; }
    },
    _setIdbCache: async function(url, buffer) {
        try {
            const db = await this._initIdb();
            if (!db) return;
            return new Promise((resolve) => {
                const tx = db.transaction('cache', 'readwrite');
                const req = tx.objectStore('cache').put({ buffer: buffer, ts: Date.now() }, url);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            });
        } catch(e) {}
    },

    getFileBytes: async function (url) {
        if (!url) return null;
        if (this._fileBytesCache[url]) return this._fileBytesCache[url];

        // IndexedDB kalıcı önbellek kontrolü (Hız Optimizasyonu)
        const idbBuffer = await this._getIdbCache(url);
        if (idbBuffer && this.validateBuffer(idbBuffer)) {
            console.log(`[IDB Cache Hit]: ${url}`);
            this._fileBytesCache[url] = idbBuffer;
            return idbBuffer;
        }

        // Data URI ise proxy veya Drive mantığını tamamen atla
        if (url.startsWith('data:')) {
            try {
                const res = await fetch(url);
                const buf = await res.arrayBuffer();
                this._fileBytesCache[url] = buf;
                this._setIdbCache(url, buf);
                return buf;
            } catch (e) { return null; }
        }

        let driveId = null;
        // Gelişmiş Google Drive ID çıkarma regexi
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const parts = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                          url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                          url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                          url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
            if (parts) driveId = parts[1];
        }

        const gasUrl = "https://script.google.com/macros/s/AKfycbzzq1WBvSNmM5yGVH49vt2EOkTA83sFFSiysuqg4x54L3Cn9DEOmixlHW8fd_bLJ_du/exec";

        const fetchWithRetry = async (targetUrl, useTimeout = true) => {
            const controller = new AbortController();
            const timeoutId = useTimeout ? setTimeout(() => controller.abort(), 3000) : null;
            
            try {
                const response = await fetch(targetUrl, { signal: controller.signal });
                if (timeoutId) clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                // Google Drive "Virus Scan" veya "Large File" onay sayfasını kontrol et
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    const html = await response.text();
                    if (html.includes('confirm=')) {
                        const confirmToken = html.match(/confirm=([a-zA-Z0-9_-]+)/)?.[1];
                        if (confirmToken) {
                            const newUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'confirm=' + confirmToken;
                            const retryRes = await fetch(newUrl);
                            return await retryRes.arrayBuffer();
                        }
                    }
                    throw new Error("Google Drive Preview page returned instead of file.");
                }
                return await response.arrayBuffer();
            } catch (e) {
                if (timeoutId) clearTimeout(timeoutId);
                return null;
            }
        };

        const promises = [];

        // 1. GAS Proxy
        if (driveId) {
            const proxyUrl = `${gasUrl}?id=${driveId}`;
            promises.push(
                new Promise(async (resolve, reject) => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 4000);
                        const res = await fetch(proxyUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        if (res.ok) {
                            const base64 = await res.text();
                            if (base64 && base64.length > 100 && !base64.startsWith('<!DOCTYPE') && !base64.startsWith('Hata')) {
                                const binaryString = atob(base64);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                                
                                if (this.validateBuffer(bytes.buffer)) resolve(bytes.buffer);
                                else reject("Invalid GAS buffer");
                            } else reject("Invalid GAS content");
                        } else reject("GAS HTTP Error");
                    } catch (e) { reject(e); }
                })
            );
        }

        // 2. Direct URLs
        const directUrls = [];
        if (driveId) {
            directUrls.push(`https://drive.usercontent.google.com/download?id=${driveId}&export=download`);
            directUrls.push(`https://drive.google.com/uc?export=download&id=${driveId}`);
        } else {
            directUrls.push(url);
        }

        for (const dUrl of directUrls) {
            promises.push(
                fetchWithRetry(dUrl, true).then(buf => {
                    if (buf && this.validateBuffer(buf)) return buf;
                    throw new Error("Invalid buffer from direct URL");
                })
            );
        }

        // 3. CORS Proxies (Only used as a fallback if everything else fails)
        const runCorsProxies = async () => {
            if (!url.startsWith('http')) return null;
            const proxies = [
                "https://api.allorigins.win/raw?url=",
                "https://corsproxy.io/?",
                "https://api.codetabs.com/v1/proxy?quest="
            ];
            const corsPromises = [];
            for (const proxy of proxies) {
                for (const dUrl of directUrls) {
                    const pUrl = proxy + encodeURIComponent(dUrl);
                    corsPromises.push(
                         fetchWithRetry(pUrl, true).then(buf => {
                              if (buf && this.validateBuffer(buf)) return buf;
                              throw new Error("Invalid buffer from proxy");
                         })
                    );
                }
            }
            return Promise.any(corsPromises);
        };

        try {
            // First race GAS proxy and Direct URLs
            console.log(`Dosya indiriliyor (Direct/GAS): ${url}`);
            const successBuffer = await Promise.any(promises);
            console.log(`Dosya başarıyla indirildi: ${url} (${successBuffer.byteLength} bytes)`);
            this._fileBytesCache[url] = successBuffer;
            this._setIdbCache(url, successBuffer);
            return successBuffer;
        } catch (e) {
            console.warn(`Doğrudan indirme başarısız (${url}), proxy deneniyor...`, e);
            // If all reliable methods fail, fallback to CORS proxies
            try {
                const proxyBuffer = await runCorsProxies();
                if (proxyBuffer) {
                    console.log(`Dosya proxy üzerinden indirildi: ${url}`);
                    this._fileBytesCache[url] = proxyBuffer;
                    this._setIdbCache(url, proxyBuffer);
                }
                return proxyBuffer;
            } catch (e2) {
                console.error(`Dosya indirme TAMAMEN başarısız: ${url}`, e2);
                return null;
            }
        }
    },

    loadRequiredFonts: async function (pdfDoc) {
        if (typeof PDFLib === 'undefined') return {};
        
        // Fontkit'i kaydet ! (Özel TTF fontlarını yükleyebilmek için ÇOK ÖNEMLİ)
        if (typeof window !== 'undefined' && window.fontkit) {
            pdfDoc.registerFontkit(window.fontkit);
        } else if (typeof fontkit !== 'undefined') {
            pdfDoc.registerFontkit(fontkit);
        }

        const { StandardFonts } = PDFLib;
        
        const [helveticaBold, helvetica] = await Promise.all([
            pdfDoc.embedFont(StandardFonts.HelveticaBold),
            pdfDoc.embedFont(StandardFonts.Helvetica)
        ]);

        const customFonts = {
            mainFont: helveticaBold,
            schoolFont: helveticaBold,
            nameFont: helveticaBold,
            normalFont: helvetica
        };

        try {
            // Sadece ana baz fontu (Roboto) yükle. 
            // Okul ve isim fontları renderStudentPDFHeader içinde dinamik olarak yüklenecektir.
            const robotoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf';
            const robotoBytes = await this.getFileBytes(robotoUrl);

            if (robotoBytes) {
                const robotoFont = await pdfDoc.embedFont(robotoBytes);
                customFonts.mainFont = robotoFont;
                customFonts.schoolFont = robotoFont;
                customFonts.nameFont = robotoFont;
            }
            
            // Arial fontunu yükle (Puan ve sabit metinler için kullanıcı isteği)
            try {
                const arialBytes = await this.getFileBytes('fonts/arial.ttf');
                if (arialBytes) {
                    customFonts.infoFont = await pdfDoc.embedFont(arialBytes);
                }
            } catch (ae) { console.warn("Arial yüklenemedi, Helvetica kullanılacak."); }

        } catch (e) {
            console.warn("Temel font yükleme hatası (Roboto):", e);
        }

        return customFonts;
    },

    // --- Görevli & Yedek Öğretmen Engine ---
    getSchoolTeachers: async function () {
        try {
            const res = await fetch(`${this.firebaseDatabaseUrl}/app_store/klbk_users.json`);
            if (res.ok) {
                const usersDb = await res.json();
                if (!usersDb) return {};
                
                const myStoreKey = this._getStorageKey();
                const schoolTeachers = {};
                for (let [uname, u] of Object.entries(usersDb)) {
                    if (uname === 'admin' || u.role === 'admin' || u.role === 'master' || (u.storeKey || `klbk_data_${uname}`) === myStoreKey) {
                        if (uname !== 'admin' && uname !== '@arız@' && uname !== '@rız@') {
                            schoolTeachers[uname] = u;
                        }
                    }
                }
                return schoolTeachers;
            }
        } catch (e) {
            console.error("Failed to fetch school teachers:", e);
        }
        return {};
    },

    calculateExamTeachers: function (session, teachersDb) {
        let result = {
            classrooms: {},      // roomName -> { gorevli: "", yedekler: [] }
            globalSpares: []     // list of { name: "", uname: "", role: "", hasLaterClasses: bool, hasAnyClassThisDay: bool }
        };

        if (!session || !teachersDb || Object.keys(teachersDb).length === 0) return result;

        const parseDay = (dateStr) => {
            if (!dateStr) return null;
            let ds = dateStr;
            if (ds.includes('.')) {
                const parts = ds.split('.');
                if (parts.length === 3 && parts[0].length === 2) {
                    ds = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }
            const d = new Date(ds + 'T00:00:00');
            if (isNaN(d.getTime())) return null;
            const days = ['Pz', 'Pa', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
            return days[d.getDay()];
        };

        const examDay = parseDay(session.date);
        const timeStr = (session.time || '').trim();
        const examHourMatch = timeStr.match(/\d+/);
        const examHourNum = examHourMatch ? examHourMatch[0] : null;

        if (!examDay || !timeStr) return result;

        const school = this.getSchoolSettings() || {};
        const lessonTimes = school.lessonTimes || {};
        
        // Saatten ders numarasını bul (Örn: "09:00" -> "1")
        let mappedLessonNum = null;
        if (timeStr.includes(':')) {
            for (let i = 1; i <= 20; i++) {
                if (lessonTimes[`${i}_start`] === timeStr) {
                    mappedLessonNum = String(i);
                    break;
                }
            }
        }

        const normalizeClass = (val) => String(val).toUpperCase().replace(/[^A-Z0-9ĞÜŞİÖÇ]/gi, '');
        
        let assignments = {};

        Object.entries(teachersDb).forEach(([uname, t]) => {
            const sched = t.schedule || {};
            const daySched = sched[examDay] || {};

            const hasAnyClassThisDay = Object.values(daySched).some(v => v && v !== '-');
            
            // Try matching by exact string first, then mapped lesson number, then by first number found
            let assignedClassAtThisHourRaw = daySched[timeStr];
            
            if (!assignedClassAtThisHourRaw && mappedLessonNum) {
                assignedClassAtThisHourRaw = daySched[mappedLessonNum];
            }

            if (!assignedClassAtThisHourRaw && examHourNum) {
                const cleanHourNum = parseInt(examHourNum).toString();
                assignedClassAtThisHourRaw = daySched[cleanHourNum];
            }
            
            const assignedClassAtThisHour = (assignedClassAtThisHourRaw && assignedClassAtThisHourRaw !== '-') ? assignedClassAtThisHourRaw : null;

            if (assignedClassAtThisHour) {
                const normalizedRoom = normalizeClass(assignedClassAtThisHour);
                if (!assignments[normalizedRoom]) {
                    assignments[normalizedRoom] = { ogretmenler: [], idareciler: [], origMatches: [] };
                }
                
                // Keep track of the original class name match
                if (!assignments[normalizedRoom].origMatches.includes(assignedClassAtThisHour)) {
                    assignments[normalizedRoom].origMatches.push(assignedClassAtThisHour);
                }

                if (t.role === 'idareci' || t.role === 'admin' || t.role === 'master') {
                    assignments[normalizedRoom].idareciler.push({ uname, name: this.formatTeacherName(t.name), role: t.role });
                } else {
                    assignments[normalizedRoom].ogretmenler.push({ uname, name: this.formatTeacherName(t.name), role: t.role });
                }
            } else {
                // Bu ders saatinde boşta
                let currentHourKey = null;
                if (daySched[timeStr]) currentHourKey = timeStr;
                else if (mappedLessonNum && daySched[mappedLessonNum]) currentHourKey = mappedLessonNum;
                else if (examHourNum) {
                    const clean = parseInt(examHourNum).toString();
                    if (daySched[clean]) currentHourKey = clean;
                }
                
                let hasLaterClasses = false;
                const refHour = parseInt(currentHourKey || mappedLessonNum || examHourNum || 0);
                if (refHour > 0) {
                    hasLaterClasses = Object.entries(daySched).some(([h, v]) => parseInt(h) > refHour && v && v !== '-');
                }

                const isIdareci = t.role === 'idareci' || t.role === 'admin' || t.role === 'master';
                
                if (hasAnyClassThisDay || isIdareci) {
                    result.globalSpares.push({ 
                        uname, 
                        name: this.formatTeacherName(t.name), 
                        role: t.role,
                        hasLaterClasses,
                        hasAnyClassThisDay
                    });
                }
            }
        });

        // Loop over the known rooms in the session to properly link them up
        if (session.results) {
            // Stable hash function to alternate between teachers deterministically across different sessions
            const getHash = (str) => {
                let hash = 0;
                if (!str) return hash;
                for (let i = 0; i < str.length; i++) {
                    hash = (hash << 5) - hash + str.charCodeAt(i);
                    hash |= 0;
                }
                return Math.abs(hash);
            };
            const sessionHash = getHash(session.id || session.name || "");

            session.results.forEach(room => {
                const normRoom = normalizeClass(room.name);
                const assignmentMatch = assignments[normRoom];
                
                let classroomInfo = { gorevli: "", yedekler: [] };

                if (assignmentMatch) {
                    if (assignmentMatch.ogretmenler.length > 0) {
                        const chosenIdx = sessionHash % assignmentMatch.ogretmenler.length;
                        const chosenTeacher = assignmentMatch.ogretmenler[chosenIdx];
                        classroomInfo.gorevli = chosenTeacher.name;
                        
                        const extras = [
                            ...assignmentMatch.ogretmenler.slice(0, chosenIdx),
                            ...assignmentMatch.ogretmenler.slice(chosenIdx + 1)
                        ];
                        extras.forEach(extra => {
                            const t = teachersDb[extra.uname];
                            const daySched = (t && t.schedule) ? (t.schedule[examDay] || {}) : {};
                            const refHour = parseInt(mappedLessonNum || examHourNum || 0);
                            result.globalSpares.push({
                                ...extra,
                                isDouble: true,
                                hasLaterClasses: Object.entries(daySched).some(([h, v]) => parseInt(h) > refHour && v && v !== '-'),
                                hasAnyClassThisDay: Object.values(daySched).some(v => v && v !== '-')
                            });
                        });
                        assignmentMatch.idareciler.forEach(idr => {
                            const t = teachersDb[idr.uname];
                            const daySched = (t && t.schedule) ? (t.schedule[examDay] || {}) : {};
                            const refHour = parseInt(mappedLessonNum || examHourNum || 0);
                            result.globalSpares.push({
                                ...idr,
                                isDouble: true,
                                hasLaterClasses: Object.entries(daySched).some(([h, v]) => parseInt(h) > refHour && v && v !== '-'),
                                hasAnyClassThisDay: Object.values(daySched).some(v => v && v !== '-')
                            });
                        });
                    } else if (assignmentMatch.idareciler.length > 0) {
                        const chosenIdx = sessionHash % assignmentMatch.idareciler.length;
                        const chosenIdr = assignmentMatch.idareciler[chosenIdx];
                        classroomInfo.gorevli = chosenIdr.name + " (İdare)";
                        
                        const extras = [
                            ...assignmentMatch.idareciler.slice(0, chosenIdx),
                            ...assignmentMatch.idareciler.slice(chosenIdx + 1)
                        ];
                        extras.forEach(extra => {
                            const t = teachersDb[extra.uname];
                            const daySched = (t && t.schedule) ? (t.schedule[examDay] || {}) : {};
                            const refHour = parseInt(mappedLessonNum || examHourNum || 0);
                            result.globalSpares.push({
                                ...extra,
                                isDouble: true,
                                hasLaterClasses: Object.entries(daySched).some(([h, v]) => parseInt(h) > refHour && v && v !== '-'),
                                hasAnyClassThisDay: Object.values(daySched).some(v => v && v !== '-')
                            });
                        });
                    }
                }
                
                result.classrooms[room.name] = classroomInfo;
            });
        }

        return result;
    }
};

window.DataManager = DataManager;
