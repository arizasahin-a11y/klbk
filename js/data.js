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

    // --- Supabase Storage (PDF Uploads) ---
    uploadFileToSupabase: async function (file) {
        if (!file) return null;

        const bucketName = 'xms';
        // Clean the original filename, but preserve it without adding random strings
        let cleanName = file.name.replace(/[^a-zA-Z0-9.\-—_ğüşöçİĞÜŞÖÇ ]/g, "_");
        // Ensure name is unique enough if uploaded multiple times? Usually Supabase allows overwrite if upsert is true. We'll add a short prefix just in case to prevent accidental full overwrites if they upload different files with the same name, or just use the clean name. Let's use just the name so it overwrites/updates cleanly.
        const uniqueFileName = cleanName;

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

    listSupabaseFiles: async function () {
        const bucketName = 'xms';
        const listUrl = `${this.supabaseUrl}/storage/v1/object/list/${bucketName}`;

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
                    sortBy: { column: 'created_at', order: 'desc' }
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Failed to list files: ${res.status} ${errText}`);
            }

            const files = await res.json();
            return files.map(f => ({
                name: f.name,
                url: `${this.supabaseUrl}/storage/v1/object/public/${bucketName}/${f.name}`,
                created_at: f.created_at
            }));
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
            data.students[exists] = studentObj; // Update
        } else {
            data.students.push(studentObj);
        }
        this._saveData(data);
    },

    bulkImportStudents: function (studentList, mode) {
        const data = this._getData();
        if (mode === 'fresh') {
            data.students = studentList;
        } else {
            // mode === 'update'
            studentList.forEach(newStd => {
                const idx = data.students.findIndex(s => s.no === newStd.no);
                if (idx !== -1) {
                    // Update existing
                    data.students[idx] = { ...data.students[idx], ...newStd };
                } else {
                    // Add new
                    data.students.push(newStd);
                }
            });
        }
        this._saveData(data);
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
            if (ses.date && ses.date.includes('-')) {
                ses.date = this.formatDateToStandard(ses.date);
                changed = true;
            }
        });
        if (changed) {
            console.log("Date formats migrated to DD.MM.YYYY");
            this._saveData(this._memoryData);
        }
    }
};

window.DataManager = DataManager;
