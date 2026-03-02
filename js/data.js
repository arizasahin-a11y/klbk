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
        data.school = { ...data.school, ...settingsObj };
        this._saveData(data);
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
    }
};

window.DataManager = DataManager;
