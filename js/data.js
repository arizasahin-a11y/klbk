/**
 * Data Storage & Management Module
 * Manages school settings, classes, students, and classrooms using LocalStorage
 */

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

    // Cloud Configuration
    supabaseUrl: "https://esdttjvkqyeaosdcsskr.supabase.co",
    supabaseKey: "sb_publishable_Rdl1xQ10AjWVZPxLwL_O_A_x4NYDxl6",
    _memoryData: null,

    // Get Key
    _getStorageKey: function () {
        const storeKey = sessionStorage.getItem('klbk_storeKey');
        if (storeKey) return storeKey;
        const user = sessionStorage.getItem('klbk_currentUser') || 'admin';
        return `klbk_data_${user}`;
    },

    // Initialize Cloud Data (Must be called on page load)
    initCloud: async function () {
        const key = this._getStorageKey();
        try {
            const res = await fetch(`${this.supabaseUrl}/rest/v1/app_store?id=eq.${key}&select=*`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                }
            });
            if (res.ok) {
                const rows = await res.json();
                if (rows && rows.length > 0) {
                    this._memoryData = rows[0].data;
                    console.log("Cloud data loaded successfully.");
                    this._migrateDateFormats(); // Standardize dates to DD.MM.YYYY
                    return;
                }
            }
        } catch (e) {
            console.error("Cloud fetch failed, initializing empty state", e);
        }

        // If not found or error, use initial state
        this._memoryData = JSON.parse(JSON.stringify(initialState));
    },

    // Sync Memory Data to Cloud
    _syncToCloud: async function (data) {
        const key = this._getStorageKey();
        try {
            await fetch(`${this.supabaseUrl}/rest/v1/app_store`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({ id: key, data: data })
            });
            console.log("Data synced to cloud.");
        } catch (e) {
            console.error("Cloud sync failed!", e);
            // Optionally fallback to localStorage here if offline
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

    // --- Supabase Storage (PDF Uploads) ---
    uploadFileToSupabase: async function (file) {
        if (!file) return null;

        const bucketName = 'xms';
        const currentUser = sessionStorage.getItem('klbk_currentUser') || 'unknown';
        
        // Remove Turkish characters and spaces to prevent "InvalidKey" 400 API errors
        const cleanUser = this.sanitizeSupabaseString(currentUser);
        let cleanName = this.sanitizeSupabaseString(file.name);
        
        const uniqueFileName = `${cleanUser}_${cleanName}`;

        const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${bucketName}/${uniqueFileName}`;

        try {
            const res = await fetch(uploadUrl, {
                method: 'POST', // Changed from POST to POST with upsert header or PUT? Usually Supabase Storage API uses POST to create. To overwrite, we might need upsert headers.
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Content-Type': file.type || 'application/pdf',
                    'x-upsert': 'true' // Allow overwriting files with the same name
                },
                body: file
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Upload failed: ${res.status} ${errText}`);
            }

            // Return the public URL for the newly uploaded file
            const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${bucketName}/${uniqueFileName}`;
            return publicUrl;
        } catch (e) {
            console.error("Supabase Storage Upload Error:", e);
            throw e;
        }
    },

    deleteSupabaseFile: async function (fileName) {
        const bucketName = 'xms';
        const deleteUrl = `${this.supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;

        try {
            const res = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                }
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Delete failed: ${res.status} ${errText}`);
            }
            return true;
        } catch (e) {
            console.error("Supabase Storage Delete Error:", e);
            throw e;
        }
    },

    listSupabaseFiles: async function (teacherOnly = false) {
        const bucketName = 'xms';
        const listUrl = `${this.supabaseUrl}/storage/v1/object/list/${bucketName}`;
        const currentUser = sessionStorage.getItem('klbk_currentUser') || '';

        try {
            const res = await fetch(listUrl, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prefix: '',
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' },
                    search: '' // Ensure Supabase returns all
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Failed to list files: ${res.status} ${errText}`);
            }

            const files = await res.json();
            
            let mappedFiles = files.map(f => ({
                name: f.name,
                url: `${this.supabaseUrl}/storage/v1/object/public/${bucketName}/${f.name}`,
                created_at: f.created_at
            }));

            if (teacherOnly && currentUser) {
                // Ensure we filter using the exact same sanitized prefix as used during upload
                const searchPrefix = this.sanitizeSupabaseString(currentUser) + '_';
                mappedFiles = mappedFiles.filter(f => f.name.startsWith(searchPrefix));
            }

            return mappedFiles;
        } catch (e) {
            console.error("Supabase Storage List Error:", e);
            throw e;
        }
    },

    // Internal Method: Get Full Data Store (Returns Memory)
    _getData: function () {
        if (!this._memoryData) {
            console.warn("DataManager accessed before initCloud! Returning empty state.");
            return JSON.parse(JSON.stringify(initialState));
        }
        return this._memoryData;
    },

    // Internal Method: Save Full Data Store (Updates Memory & Triggers Sync)
    _saveData: function (data) {
        this._memoryData = data;
        this._syncToCloud(data);
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
            const res = await fetch(`${this.supabaseUrl}/rest/v1/app_store?id=eq.klbk_users&select=*`, {
                headers: { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${this.supabaseKey}` }
            });
            if (res.ok) {
                const rows = await res.json();
                if (rows && rows.length > 0) {
                    const usersDb = rows[0].data;
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
                        await fetch(`${this.supabaseUrl}/rest/v1/app_store`, {
                            method: 'POST',
                            headers: {
                                'apikey': this.supabaseKey,
                                'Authorization': `Bearer ${this.supabaseKey}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'resolution=merge-duplicates'
                            },
                            body: JSON.stringify({ id: 'klbk_users', data: usersDb })
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

    saveClassRoomMapping: function (className, roomName) {
        const data = this._getData();
        if (!data.classRoomMappings) data.classRoomMappings = {};
        if (roomName) {
            data.classRoomMappings[className] = roomName;
        } else {
            delete data.classRoomMappings[className];
        }
        this._saveData(data);
    },

    // --- Students API ---
    getStudents: function () {
        return this._getData().students;
    },

    addStudent: function (studentObj) {
        const data = this._getData();
        // Check if exists
        const exists = data.students.findIndex(s => s.no === studentObj.no);
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
        return this._getData().classrooms;
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
        return this._getData().examSessions || [];
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

        const now = new Date();
        const school = this.getSchoolSettings();
        const lessonTimes = school.lessonTimes || {};

        // Helper to get a stable sortable score
        const getSessionScore = (ses) => {
            const start = this.parseSessionDateTime(ses.date, ses.time);
            const end = this.getSessionEndDateTime(ses.date, ses.time);

            const isFinished = now > end;

            // Score components:
            // 1. Finished status (0 for upcoming/ongoing, 1 for finished)
            // 2. Date/Time difference (Absolute value for future/past?)
            // We want: 
            // - Upcoming/Ongoing: Sorted by Date ASC (nearest first)
            // - Finished: Sorted by Date DESC (most recent first) and placed at the bottom

            return {
                isFinished,
                startTime: start.getTime(),
                endTime: end.getTime()
            };
        };

        return [...sessions].sort((a, b) => {
            const scoreA = getSessionScore(a);
            const scoreB = getSessionScore(b);

            // 1. Not finished comes first
            if (scoreA.isFinished !== scoreB.isFinished) {
                return scoreA.isFinished ? 1 : -1;
            }

            if (!scoreA.isFinished) {
                // Upcoming/Ongoing: Nearest start time first (ASC)
                return scoreA.startTime - scoreB.startTime;
            } else {
                // Finished: Most recently finished first (DESC)
                return scoreB.endTime - scoreA.endTime;
            }
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

    getSessionEndDateTime: function (dateStr, timeStr) {
        const start = this.parseSessionDateTime(dateStr, timeStr);
        let duration = 40; // Default 40 mins

        if (timeStr && timeStr.includes('. Ders')) {
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
            if (ses.date) {
                // If it's YYYY-MM-DD (Standard HTML Date Input)
                if (ses.date.includes('-')) {
                    ses.date = this.formatDateToStandard(ses.date);
                    changed = true;
                }
                // If it's YYYY.MM.DD (Incorrectly saved earlier)
                else if (ses.date.includes('.') && ses.date.split('.')[0].length === 4) {
                    const parts = ses.date.split('.');
                    ses.date = `${parts[2]}.${parts[1]}.${parts[0]}`;
                    changed = true;
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
        if (!buffer || buffer.byteLength < 10) return false;
        const arr = new Uint8Array(buffer.slice(0, 100));
        const str = String.fromCharCode(...arr).toLowerCase();
        // Sadece HTML hata sayfalarını reddet (CORS proxylerinden dönenleri engellemek için)
        if (str.includes('<!doctype html') || str.includes('<html') || str.includes('<body') || str.includes('hata oluştu')) {
            return false;
        }
        return true;
    },

    getFileBytes: async function (url) {
        if (!url) return null;
        if (this._fileBytesCache[url]) return this._fileBytesCache[url];

        // Data URI ise proxy veya Drive mantığını tamamen atla
        if (url.startsWith('data:')) {
            try {
                const res = await fetch(url);
                const buf = await res.arrayBuffer();
                this._fileBytesCache[url] = buf;
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
            const timeoutId = useTimeout ? setTimeout(() => controller.abort(), 6000) : null;
            
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

        // 1. Yol: Eğer Google Drive ID varsa, önce custom GAS Proxy dene (En güvenilir CORS çözümü)
        if (driveId) {
            try {
                const proxyUrl = `${gasUrl}?id=${driveId}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s maks
                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    const base64 = await res.text();
                    if (base64 && base64.length > 100 && !base64.startsWith('<!DOCTYPE') && !base64.startsWith('Hata')) {
                        const binaryString = atob(base64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                        
                        if (this.validateBuffer(bytes.buffer)) {
                            this._fileBytesCache[url] = bytes.buffer;
                            return bytes.buffer;
                        }
                    }
                }
            } catch (e) { console.warn("GAS Proxy failed or timed out."); }
        }

        // 2. Yol: Doğrudan indirme linklerini dene
        const directUrls = [];
        if (driveId) {
            directUrls.push(`https://drive.usercontent.google.com/download?id=${driveId}&export=download`);
            directUrls.push(`https://drive.google.com/uc?export=download&id=${driveId}`);
        } else {
            directUrls.push(url);
        }

        for (const dUrl of directUrls) {
            const bytes = await fetchWithRetry(dUrl, true);
            if (bytes && this.validateBuffer(bytes)) {
                this._fileBytesCache[url] = bytes;
                return bytes;
            }
        }

        // Eğer URL yerel (relative) bir dosya veya aynı domain içerisindeyse proxy kullanma, iptal et
        if (!url.startsWith('http')) {
            return null; // Local fetch failed so no point in trying internet proxies
        }

        // 3. Yol: CORS Proxyleri üzerinden Paralel deneme (ikinci döngüyü hızlandırmak için)
        const proxies = [
            "https://api.allorigins.win/raw?url=",
            "https://corsproxy.io/?",
            "https://api.codetabs.com/v1/proxy?quest="
        ];

        // Proxylere aynı anda istek gönder, dönen ilk başarılı sonucu al!
        const promises = [];
        for (const proxy of proxies) {
            for (const dUrl of directUrls) {
                const pUrl = proxy + encodeURIComponent(dUrl);
                promises.push(
                     fetchWithRetry(pUrl, true).then(buf => {
                          if (buf && this.validateBuffer(buf)) return buf;
                          throw new Error("Invalid buffer");
                     })
                );
            }
        }

        try {
            const successBuffer = await Promise.any(promises);
            this._fileBytesCache[url] = successBuffer;
            return successBuffer;
        } catch (e) {
            // Hiçbiri başarılı olamadı
            return null;
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
            // Fontları paralel yükle
            const robotoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf';
            const nameFontUrl = 'fonts/MonotypeCorsiva.ttf';
            const schoolFontUrl = 'fonts/SnapITC.ttf';

            const [robotoBytes, nameFontBytes, schoolFontBytes] = await Promise.all([
                this.getFileBytes(robotoUrl),
                this.getFileBytes(nameFontUrl).catch(()=>null),
                this.getFileBytes(schoolFontUrl).catch(()=>null)
            ]);

            if (robotoBytes) {
                const robotoFont = await pdfDoc.embedFont(robotoBytes);
                customFonts.mainFont = robotoFont;
                customFonts.schoolFont = robotoFont;
                customFonts.nameFont = robotoFont;
            }
            if (nameFontBytes) {
                try { customFonts.nameFont = await pdfDoc.embedFont(nameFontBytes); } catch(e){}
            }
            if (schoolFontBytes) {
                try { customFonts.schoolFont = await pdfDoc.embedFont(schoolFontBytes); } catch(e){}
            }
        } catch (e) { console.warn("Font load failed:", e); }

        return customFonts;
    }
};

window.DataManager = DataManager;
