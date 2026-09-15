/**
 * km_firebase.js - Okul Isleri Modulu Firebase Veri Katmani
 * KLBK FRVR projesine entegre edilmis okul yonetim sistemi.
 * Tum veriler Firebase Realtime Database uzerinde /okul_isleri/ node'unda tutulur.
 */

const KM_DB_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
const KM_BASE = "okul_isleri";

function km_safeKey(str) {
    return (str || '').replace(/[.#$\[\]/]/g, '_').trim();
}

async function km_get(path) {
    const url = path
        ? `${KM_DB_URL}/${KM_BASE}/${path}.json?_=${Date.now()}`
        : `${KM_DB_URL}/${KM_BASE}.json?_=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firebase GET hatasi (${res.status}): ${path}`);
    return await res.json();
}

async function km_put(path, data) {
    const res = await fetch(`${KM_DB_URL}/${KM_BASE}/${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Firebase PUT hatasi (${res.status}): ${path}`);
    return await res.json();
}

async function km_patch(path, data) {
    const res = await fetch(`${KM_DB_URL}/${KM_BASE}/${path}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Firebase PATCH hatasi (${res.status}): ${path}`);
    return await res.json();
}

async function km_delete(path) {
    const res = await fetch(`${KM_DB_URL}/${KM_BASE}/${path}.json`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Firebase DELETE hatasi (${res.status}): ${path}`);
    return true;
}

// --- OGRENCILER ---
async function km_getStudents() {
    const res = await fetch(`${KM_DB_URL}/app_store/klbk_users.json?_=${Date.now()}`);
    return (await res.json()) || {};
}

async function km_findStudentBySchoolNo(schoolNo) {
    const users = await km_getStudents();
    const schoolNoStr = String(schoolNo).trim();
    for (const [username, userData] of Object.entries(users)) {
        const uNo = String(userData.school_no || userData.schoolNo || userData['okul_no'] || '').trim();
        if (uNo === schoolNoStr) return { username, ...userData };
    }
    return null;
}

// --- CALISMALAR ---
async function km_getStudies() {
    return (await km_get('studies')) || {};
}

async function km_getActiveStudies() {
    const all = await km_getStudies();
    const result = {};
    for (const [id, s] of Object.entries(all)) {
        if (!s.is_archived) result[id] = s;
    }
    return result;
}

async function km_saveStudy(studyId, studyData) {
    const key = studyId || km_safeKey(studyData.name) + '_' + Date.now();
    await km_put(`studies/${key}`, { ...studyData, updated_at: Date.now() });
    return key;
}

async function km_deleteStudy(studyId) {
    await km_delete(`studies/${studyId}`);
    const assigns = await km_get('study_assignments');
    if (assigns) {
        for (const [aid, a] of Object.entries(assigns)) {
            if (a.study_id === studyId) await km_delete(`study_assignments/${aid}`);
        }
    }
    const evals = await km_get('student_evaluations');
    if (evals) {
        for (const [eid, e] of Object.entries(evals)) {
            if (e.study_id === studyId) await km_delete(`student_evaluations/${eid}`);
        }
    }
}

async function km_archiveStudy(studyId, isArchived = true) {
    await km_patch(`studies/${studyId}`, { is_archived: isArchived, updated_at: Date.now() });
}

// --- ATAMALAR ---
async function km_getAssignments() {
    return (await km_get('study_assignments')) || {};
}

async function km_getAssignmentsForClass(className) {
    const all = await km_getAssignments();
    const result = {};
    for (const [id, a] of Object.entries(all)) {
        if (a.class_name === className) result[id] = a;
    }
    return result;
}

async function km_saveAssignment(studyId, className, method, settings) {
    const key = `${km_safeKey(studyId)}_${km_safeKey(className)}`;
    await km_put(`study_assignments/${key}`, {
        study_id: studyId,
        class_name: className,
        method: method || 'Tek',
        settings: settings || {},
        updated_at: Date.now()
    });
    return key;
}

async function km_deleteAssignment(assignmentId) {
    await km_delete(`study_assignments/${assignmentId}`);
}

// --- DEGERLENDIRMELER ---
function km_evalKey(studyId, studentSchoolNo) {
    return `${km_safeKey(studyId)}_${km_safeKey(String(studentSchoolNo))}`;
}

async function km_getEvaluationsForStudy(studyId) {
    const all = await km_get('student_evaluations');
    if (!all) return {};
    const result = {};
    for (const [id, e] of Object.entries(all)) {
        if (e.study_id === studyId) result[id] = e;
    }
    return result;
}

async function km_getStudentEvaluation(studyId, schoolNo) {
    const key = km_evalKey(studyId, schoolNo);
    return await km_get(`student_evaluations/${key}`);
}

async function km_saveStudentAnswers(studyId, schoolNo, answers, sinif) {
    const key = km_evalKey(studyId, schoolNo);
    const existing = (await km_get(`student_evaluations/${key}`)) || {};
    await km_patch(`student_evaluations/${key}`, {
        study_id: studyId,
        student_school_no: String(schoolNo),
        class_name: sinif || existing.class_name || '',
        answers: { cevaplar: answers },
        entry_count: (existing.entry_count || 0) + 1,
        last_updated: Date.now()
    });
    return key;
}

async function km_saveStudentScore(studyId, schoolNo, soruIndex, cevapIndex, puan) {
    const key = km_evalKey(studyId, schoolNo);
    const existing = (await km_get(`student_evaluations/${key}`)) || {};
    const scores = existing.scores || {};
    if (!scores[soruIndex]) scores[soruIndex] = [];
    scores[soruIndex][cevapIndex] = parseInt(puan);
    await km_patch(`student_evaluations/${key}`, { scores, last_updated: Date.now() });
    return key;
}

async function km_finishEvaluation(studyId, schoolNo, toplam, puanlar) {
    const key = km_evalKey(studyId, schoolNo);
    const data = { evaluation: { toplam, degerlendirildi: true, bitti: true }, last_updated: Date.now() };
    if (puanlar) data.scores = puanlar;
    await km_patch(`student_evaluations/${key}`, data);
}

async function km_resetEvaluationsForClass(studyId, className) {
    const all = await km_get('student_evaluations');
    if (!all) return;
    for (const [eid, e] of Object.entries(all)) {
        if (e.study_id === studyId && e.class_name === className) {
            await km_patch(`student_evaluations/${eid}`, { scores: {}, evaluation: {}, last_updated: Date.now() });
        }
    }
}

// --- GRUPLAR ---
async function km_getClassGroups(className) {
    return (await km_get(`class_groups/${km_safeKey(className)}`)) || [];
}

async function km_getStudyGroups(studyId, className) {
    const key = `${km_safeKey(studyId)}_${km_safeKey(className)}`;
    const data = await km_get(`study_groups/${key}`).catch(() => null);
    return data ? (data.groups_data || data) : [];
}

async function km_saveGroups(className, groups, studyId = null) {
    if (studyId) {
        const key = `${km_safeKey(studyId)}_${km_safeKey(className)}`;
        await km_put(`study_groups/${key}`, { study_id: studyId, class_name: className, groups_data: groups, updated_at: Date.now() });
    } else {
        await km_put(`class_groups/${km_safeKey(className)}`, groups);
    }
}

// --- AYARLAR ---
async function km_getStudySettings(studyId) {
    const key = km_evalKey(studyId, 'AYARLAR');
    const data = await km_get(`student_evaluations/${key}`).catch(() => null);
    return data ? (data.answers || data) : {};
}

async function km_saveStudySettings(studyId, settings) {
    const key = km_evalKey(studyId, 'AYARLAR');
    await km_put(`student_evaluations/${key}`, { study_id: studyId, student_school_no: 'AYARLAR', answers: settings, last_updated: Date.now() });
}

// --- OGRENCI PANELI ---
async function km_getStudentPanelData(className, schoolNo) {
    const [assignmentsRaw, allEvals, allStudies] = await Promise.all([
        km_get('study_assignments'),
        km_get('student_evaluations'),
        km_get('studies')
    ]);
    const assignments = assignmentsRaw || {};
    const evals = allEvals || {};
    const studies = allStudies || {};
    const results = [];

    for (const [aid, assignment] of Object.entries(assignments)) {
        if (assignment.class_name !== className) continue;
        const study = studies[assignment.study_id];
        if (!study || study.is_archived) continue;

        const settings = assignment.settings || {};
        const ayarKey = km_evalKey(assignment.study_id, 'AYARLAR');
        const ayar = evals[ayarKey] ? (evals[ayarKey].answers || evals[ayarKey]) : {};
        const myKey = km_evalKey(assignment.study_id, schoolNo);
        const myRec = evals[myKey] || {};

        let cevaplar = [];
        if (myRec.answers) {
            if (Array.isArray(myRec.answers)) cevaplar = myRec.answers;
            else if (myRec.answers.cevaplar) cevaplar = myRec.answers.cevaplar;
        }

        let myGroup = null;
        if (assignment.method === 'Grup') {
            const studyGroups = await km_getStudyGroups(assignment.study_id, className);
            if (Array.isArray(studyGroups)) {
                const gi = studyGroups.findIndex(members =>
                    Array.isArray(members) && members.some(m =>
                        String(m.school_no || m['Okul Numarasi'] || '').trim() === String(schoolNo).trim()
                    )
                );
                if (gi !== -1) myGroup = { groupNo: gi + 1, members: studyGroups[gi] };
            }
        }

        results.push({
            id: aid,
            studyFirebaseId: assignment.study_id,
            calisma: study.name,
            sinif: assignment.class_name,
            yontem: assignment.method,
            ...settings,
            degerl: !!settings.degerl,
            masterDegerl: !!ayar.degerlendirmeIzni,
            izin: !!ayar.izin,
            myRecord: {
                cevaplar,
                puanlar: myRec.scores || {},
                degerlendirme: myRec.evaluation || {},
                entry_count: myRec.entry_count || 0
            },
            myGroup,
            studyContent: study.content || {}
        });
    }
    return results;
}

async function km_exportAllData() {
    return (await km_get('')) || {};
}

console.log('[km_firebase.js] Okul Isleri Firebase katmani yuklendi.');