// Database Configuration
const STORE_NAME = 'reports';
const LEADER_STORE = 'activity_leaders'; // Faaliyet Liderleri koleksiyonu
const REGISTERED_LEADERS_STORE = 'registered_leaders'; // Kayıtlı Lider Havuzu
const SETTINGS_STORE = 'settings'; // Genel Ayarlar
const LEADER_PASSWORD = '1234';          // Lider işlemleri şifre

let currentSchoolName = 'İstanbul Atatürk Anadolu Lisesi';

// Firebase Setup
const firebaseConfig = {
  apiKey: "AIzaSyBoScB63OHNIPZ2y1Eo9LWa3ynSRPG6xYU",
  authDomain: "okulpt.firebaseapp.com",
  projectId: "okulpt",
  storageBucket: "okulpt.firebasestorage.app",
  messagingSenderId: "715714176883",
  appId: "1:715714176883:web:a1a125314f834f61b60706"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Enable offline persistence to keep it working without internet!
db.enablePersistence().catch(err => {
    console.warn('Firebase persistence error:', err);
});
let combinedData = null;
let savedReportsCache = []; // Cache for filtering overdue list
let activityLeadersCache = new Map(); // planId -> leaders[]
let registeredLeadersCache = []; // Global Havuz (Ad Soyad dizisi)
let currentReportingPerson = null; 
let lastSavedData = null; 
let currentRecordId = null; 
let currentModalTasks = []; // Data for printing the current modal list
let currentModalTitle = ""; // Title for the printed list
let _leaderModalPlanId = null; // Active planId in leader modal
let _leaderModalProjectType = null; // Active project type in leader modal
let isArchiveView = false;

let mainForm, saveBtn, directPrintBtn, historyBtn, backToFormBtn, savedReportsSection, reportsList;
let respInput, activityInput, suggestionsPanel, activityPanel; // Global inputs for suggestion logic

// --- GLOBAL CORE FUNCTIONS (Defined early for reliable accessibility) ---

window._doLoadRecord = function(data) {
    if (!data) {
        alert("Hata: Yüklenecek veri bulunamadı.");
        return;
    }

    try {
        console.log("Loading record into form:", data.id);
        
        // Force Switch Views
        const f = document.getElementById('activity-form');
        const s = document.getElementById('saved-reports');
        if (f) f.style.display = 'block';
        if (s) s.style.display = 'none';
        
        window.scrollTo(0, 0);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 10);

        currentRecordId = data.id;
        lastSavedData = { ...data };
        if (document.getElementById('plan-id')) {
            document.getElementById('plan-id').value = data.planId || '';
        }

        // Field mapping
        const map = {
            'eduYear': 'edu-year', 'activityName': 'activity-name', 'activityTheme': 'activity-theme', 'teacher': 'responsible-teacher',
            'totalParticipants': 'total-participants', 'location': 'activity-location',
            'startDate': 'activity-start', 'endDate': 'activity-end', 'duration': 'total-duration',
            'cost': 'cost', 'documentNo': 'document-no', 'purpose': 'purpose',
            'difficulties': 'difficulties', 'suggestions': 'suggestions', 'realizedValue': 'realized-value', 'collaborations': 'collaborations',
            'evaluation': 'evaluation', 'fillerName': 'filler-name', 'fillerRole': 'filler-role', 'fillerDate': 'filler-date'
        };

        for (const key in map) {
            const el = document.getElementById(map[key]);
            if (el) {
                el.value = data[key] || '';
                if (typeof updateFilledState === 'function') updateFilledState(el);
            }
        }

        // Project Type Radio
        if (data.projectType) {
            const r = document.querySelector(`input[name="project-type"][value="${data.projectType}"]`);
            if (r) {
                r.checked = true;
                r.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Status Radio
        if (data.status) {
            const r = document.querySelector(`input[name="report-status"][value="${data.status}"]`);
            if (r) r.checked = true;
        }

        // Multi-select Checkboxes
        if (typeof setCheckboxValues === 'function') {
            setCheckboxValues('activity-type', data.activityType, 'type-other-check', 'type-other-text');
            setCheckboxValues('participant-profile', data.participantProfile, 'participant-other-check', 'participant-other-text');
            setCheckboxValues('docs', data.docs, 'docs-other-check', 'docs-other-text');
        }

        // Refresh all filled states
        document.querySelectorAll('input, textarea').forEach(el => {
            if (typeof updateFilledState === 'function') updateFilledState(el);
        });
        
        console.log("Record loaded successfully:", data.id);
    } catch (err) {
        console.error("Error in _doLoadRecord:", err);
        alert("Kayıt yüklenirken teknik bir hata oluştu: " + err.message);
    }
};

window.editRecord = function(data) {
    console.log("window.editRecord triggered", data ? data.id : 'null');
    window._doLoadRecord(data);
};

window.printRecord = function(data) {
    console.log("window.printRecord triggered", data ? data.id : 'null');
    if (typeof printReport === 'function') {
        printReport(data);
    } else {
        alert("Yazdırma fonksiyonu henüz yüklenmedi!");
    }
};

function setCheckboxValues(name, csvValue, otherCheckId, otherTextId) {
    if (!csvValue) return;
    const vals = csvValue.split(',').map(v => v.trim());
    const checks = document.querySelectorAll(`input[name="${name}"]`);
    const otherCheck = document.getElementById(otherCheckId);
    const otherText = document.getElementById(otherTextId);

    checks.forEach(c => c.checked = false);
    if (otherCheck) otherCheck.checked = false;

    vals.forEach(val => {
        let found = false;
        checks.forEach(c => {
            if (c.value === val) { c.checked = true; found = true; }
        });
        if (!found && otherCheck) {
            otherCheck.checked = true;
            if (otherText) otherText.value = val;
        }
    });
}

// Initial connection triggers the snapshot
console.log('Firebase initialized successfully');
syncSavedReportsCache();
syncLeadersCache();
syncRegisteredLeadersCache();
syncSettings();

async function syncSavedReportsCache() {
    if (!db) return;
    
    // Listen to live changes
    db.collection(STORE_NAME).onSnapshot((snapshot) => {
        savedReportsCache = [];
        snapshot.forEach((doc) => {
            savedReportsCache.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`Cache updated from Firebase: ${savedReportsCache.length} reports.`);
        refreshCombinedData();
        populateFillerSelects();
        
        // Refresh UI if user is on history page
        if (typeof savedReportsSection !== 'undefined' && savedReportsSection && savedReportsSection.style.display === 'block') {
            loadReports();
        }
        
        // Sadece modal halihazırda açıksa listeyi tazelemek için tetikle.
        // Aksi takdirde kendi kendine kullanıcıya popup fırlatır!
        const modal = document.getElementById('overdue-modal');
        if (modal && modal.style.display === 'flex') {
            const t = modal.querySelector('.modal-header h3').innerText;
            if (t.includes('Eksik') && typeof checkUnreportedActivities === 'function') {
                checkUnreportedActivities();
            } else if (t.includes('Girilmiş') && typeof checkReportedActivities === 'function') {
                checkReportedActivities();
            }
        }
    });
}

// ----------------------------------------------------
// LOCAL-TO-CLOUD AUTOMATIC MIGRATOR
// (Eski cihazlardaki yerel verileri yakalayıp buluta fırlatır)
// ----------------------------------------------------
function migrateOldDataToFirebase() {
    try {
        if (!window.indexedDB) return;
        const request = indexedDB.open('PFDS_Database', 1);
        request.onsuccess = (e) => {
        const localDb = e.target.result;
        if (!localDb.objectStoreNames.contains(STORE_NAME)) return;
        
        const tx = localDb.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.getAll();
        
        getReq.onsuccess = () => {
            const oldReports = getReq.result;
            if (oldReports && oldReports.length > 0) {
                console.log(`Migration: ${oldReports.length} eski yerel rapor bulundu. Buluta aktarılıyor...`);
                oldReports.forEach(report => {
                    // Yerel ID'ler her cihazda '1, 2, 3' şeklinde olacağı için çakışma yaratır.
                    // Bu yüzden bulut ortamına (Firebase) yepyeni eşsiz bir kimlikle yüklüyoruz.
                    const oldId = report.id;
                    const newDocRef = db.collection(STORE_NAME).doc();
                    report.id = newDocRef.id;
                    report.isMigrated = true; // Göç edilenleri etiketle
                    
                    newDocRef.set(report).then(() => {
                        // Buluta başarıyla gittiyse, bir daha aktarmamak ve yer kaplamamak için yerelden sil.
                        const delTx = localDb.transaction([STORE_NAME], 'readwrite');
                        delTx.objectStore(STORE_NAME).delete(oldId);
                    }).catch(err => console.error("Göç Hatası:", err));
                });
            }
        };
    };
    request.onerror = (e) => {
            console.warn("Migration DB Access Error. Cannot read old data:", e);
        };
    } catch(err) {
        console.warn("IndexedDB not supported or blocked, skipping migration.", err);
    }
}
// Göç ediciyi uygulamaya girilir girilmez çalıştır.
migrateOldDataToFirebase();
// ----------------------------------------------------

// Automatic Academic Year Calculation
function calculateEduYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0=Ocak, 8=Eylül
    
    let eduYear = "";
    if (month >= 8) { // Eylül ve sonrası: yeni eğitim yılı başladı
        eduYear = `${year} - ${year + 1}`;
    } else { // Eylül'den önce: önceki yıl hala devam ediyor
        eduYear = `${year - 1} - ${year}`;
    }
    const el = document.getElementById('edu-year');
    if (el) el.value = eduYear;
}

// Helper: Track if an input has a meaningful value
function updateFilledState(el) {
    if (!el) return;
    if (el.type === 'radio' || el.type === 'checkbox') return;

    const val = el.value ? el.value.trim() : "";
    let hasValue = val.length > 0;

    if (hasValue) {
        el.classList.add('has-value');
    } else {
        el.classList.remove('has-value');
    }
    // Update field-wrapper state to show/hide × button
    const wrapper = el.closest('.field-wrapper');
    if (wrapper) {
        if (hasValue) wrapper.classList.add('has-content');
        else wrapper.classList.remove('has-content');
    }
    checkFormHasContent();
}

// Show/hide the top “Tüm Formu Temizle” bar based on form state
function checkFormHasContent() {
    const textIds = [
        'activity-name', 'responsible-teacher', 'total-participants', 'activity-location',
        'activity-start', 'activity-end', 'total-duration', 'cost', 'purpose',
        'difficulties', 'suggestions', 'collaborations', 'evaluation',
        'filler-name', 'filler-role', 'document-no', 'filler-date'
    ];
    const hasText = textIds.some(id => {
        const el = document.getElementById(id);
        return el && el.value.trim().length > 0;
    });
    const hasChecked = document.querySelectorAll(
        '[name="activity-type"]:checked, [name="participant-profile"]:checked, [name="docs"]:checked'
    ).length > 0;
    const bar = document.getElementById('clear-all-bar');
    if (bar) bar.style.display = (hasText || hasChecked) ? 'flex' : 'none';
}

// Clear SORUMLU field and close its suggestion panel
function clearResponsible() {
    clearField('responsible-teacher');
    const sp = document.getElementById('suggestions-panel');
    if (sp) sp.style.display = 'none';
}

// --- CLEAR HELPERS ---
function clearField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    updateFilledState(el);
    el.dispatchEvent(new Event('input'));
    if (id === 'activity-name') {
        const themeSelect = document.getElementById('activity-theme');
        if (themeSelect) { themeSelect.value = ''; updateFilledState(themeSelect); }
    }
}

function clearCheckboxGroup(name, otherCheckId, otherTextId) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(c => { c.checked = false; });
    const oc = document.getElementById(otherCheckId);
    const ot = document.getElementById(otherTextId);
    if (oc) oc.checked = false;
    if (ot) ot.value = '';
    checkFormHasContent();
}

function clearRadioGroup(name, defaultValue) {
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    radios.forEach(r => { r.checked = (r.value === defaultValue); });
    // Trigger change event on the default
    const def = document.querySelector(`input[name="${name}"][value="${defaultValue}"]`);
    if (def) def.dispatchEvent(new Event('change'));
}

function clearAllForm() {
    if (!confirm('Formdaki TÜM veriler silinecek. Emin misiniz?')) return;
    const textIds = [
        'activity-name', 'responsible-teacher', 'total-participants', 'activity-location',
        'activity-start', 'activity-end', 'total-duration', 'cost', 'purpose',
        'difficulties', 'suggestions', 'collaborations', 'evaluation',
        'filler-name', 'filler-role', 'document-no', 'filler-date', 'realized-value'
    ];
    textIds.forEach(id => clearField(id));
    clearCheckboxGroup('activity-type', 'type-other-check', 'type-other-text');
    clearCheckboxGroup('participant-profile', 'participant-other-check', 'participant-other-text');
    clearCheckboxGroup('docs', 'docs-other-check', 'docs-other-text');
    clearRadioGroup('project-type', 'OKUL GELİŞİM PROJESİ');
    const themeSelect = document.getElementById('activity-theme');
    if (themeSelect) { themeSelect.value = ''; updateFilledState(themeSelect); }
    clearRadioGroup('report-status', 'Tamamlandı');
    const sp = document.getElementById('suggestions-panel');
    if (sp) sp.style.display = 'none';
    const planIdObj = document.getElementById('plan-id');
    if (planIdObj) planIdObj.value = '';
    currentRecordId = null;
    lastSavedData = null;
    document.querySelectorAll('input, textarea').forEach(updateFilledState);
    checkFormHasContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialize Core Application
window.addEventListener('DOMContentLoaded', () => {
    // Selection of UI Elements
    mainForm = document.getElementById('activity-form');
    saveBtn = document.getElementById('save-btn');
    directPrintBtn = document.getElementById('direct-print-btn');
    const mainTitle = document.getElementById('main-title');
    if (mainTitle) {
        // Left Click: Return Home
        mainTitle.onclick = () => {
            if (savedReportsSection) savedReportsSection.style.display = 'none';
            const archiveSection = document.getElementById('archived-reports');
            if (archiveSection) archiveSection.style.display = 'none';
            if (mainForm) mainForm.style.display = 'block';
            window.scrollTo(0, 0);
        };
        
        // Shift + Right Click: School Principal Control
        mainTitle.addEventListener('mousedown', (e) => {
            if (e.shiftKey && e.button === 2) {
                e.preventDefault();
                const current = localStorage.getItem('schoolPrincipal') || '';
                const name = prompt('Okul Müdürü İsmini Giriniz:', current);
                if (name !== null) {
                    localStorage.setItem('schoolPrincipal', name.trim());
                    alert('Okul Müdürü güncellendi: ' + name.trim());
                }
            }
        });
        mainTitle.addEventListener('contextmenu', (e) => { if (e.shiftKey) e.preventDefault(); });
    }

    historyBtn = document.getElementById('history-btn');
    backToFormBtn = document.getElementById('back-to-form');
    savedReportsSection = document.getElementById('saved-reports');
    reportsList = document.getElementById('reports-list');

    const downloadMasterBtn = document.getElementById('download-master-btn');
    if (downloadMasterBtn) downloadMasterBtn.addEventListener('click', downloadMasterJson);

    // Uygulama açılışında verileri hemen hazırla (Firebase'den önce yerel veriyi yükle)
    refreshCombinedData();

    const exportExcelBtn = document.getElementById('export-excel-btn');
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);

    calculateEduYear();
    
    // CSS handles `.other-input` visibility through `:checked ~ .other-input`
    // We only need to clear the field if it's unchecked.
    document.querySelectorAll('input[type="checkbox"][id$="-other-check"]').forEach(chk => {
        chk.addEventListener('change', (e) => {
            if (!e.target.checked) {
                const inputId = e.target.id.replace('-check', '-text');
                const input = document.getElementById(inputId);
                if (input) input.value = '';
            }
        });
    });
    
    // Recovery of last state
    const lastType = localStorage.getItem('lastProjectType');
    if (lastType) {
        const typeRadio = document.querySelector(`input[name="project-type"][value="${lastType}"]`);
        if (typeRadio) typeRadio.checked = true;
    }

    // Suggestions Logic Initialization
    respInput = document.getElementById('responsible-teacher');
    activityInput = document.getElementById('activity-name');
    suggestionsPanel = document.getElementById('suggestions-panel');
    activityPanel = document.getElementById('activity-suggestions-panel');

    // Show suggestions on Focus/Click (Restored for basic usability)
    const showSuggestionsOnFocus = (input, panel, renderFn) => {
        if (!input || !panel) return;
        input.addEventListener('focus', () => {
            const val = input.value;
            const lastComma = val.lastIndexOf(',');
            const frag = val.substring(lastComma + 1).trim();
            renderFn(frag || "");
        });
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = input.value;
            const lastComma = val.lastIndexOf(',');
            const frag = val.substring(lastComma + 1).trim();
            renderFn(frag || "");
        });
    };

    showSuggestionsOnFocus(respInput, suggestionsPanel, renderSuggestions);
    // Otomatik modal açılması engellendi (Kullanıcı istediği için)
    /*
    if (respInput) {
        respInput.addEventListener('change', (e) => {
            if (e.target.value.trim()) checkUnreportedActivities();
        });
    }
    */
    showSuggestionsOnFocus(activityInput, activityPanel, renderActivitySuggestions);


    // New Suggestion Panels
    const fillerInput = document.getElementById('filler-name');
    const fillerPanel = document.getElementById('filler-suggestions-panel');
    showSuggestionsOnFocus(fillerInput, fillerPanel, renderFillerSuggestions);
    if (fillerInput) fillerInput.addEventListener('input', (e) => renderFillerSuggestions(e.target.value));

    const leaderFilterInput = document.getElementById('leader-filter-input');
    const leaderFilterPanel = document.getElementById('leader-filter-suggestions');
    showSuggestionsOnFocus(leaderFilterInput, leaderFilterPanel, renderLeaderFilterSuggestions);
    if (leaderFilterInput) {
        leaderFilterInput.addEventListener('input', (e) => renderLeaderFilterSuggestions(e.target.value));
        // Trigger activity list only when a definitive change/selection happens
        leaderFilterInput.addEventListener('change', (e) => {
            if (e.target.value.trim()) checkActivitiesByLeader(e.target.value.trim());
        });
    }

    // Hide suggestions when clicking outside
    document.addEventListener('click', () => {
        if (suggestionsPanel) suggestionsPanel.style.display = 'none';
        if (activityPanel) activityPanel.style.display = 'none';
        if (fillerPanel) fillerPanel.style.display = 'none';
        if (leaderFilterPanel) leaderFilterPanel.style.display = 'none';
    });
    if (suggestionsPanel) suggestionsPanel.onclick = (e) => e.stopPropagation();
    if (activityPanel) activityPanel.onclick = (e) => e.stopPropagation();
    if (fillerPanel) fillerPanel.onclick = (e) => e.stopPropagation();
    if (leaderFilterPanel) leaderFilterPanel.onclick = (e) => e.stopPropagation();

    if (respInput) {
        respInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const lastCommaIndex = val.lastIndexOf(',');
            const currentFragment = val.substring(lastCommaIndex + 1).trim();
            renderSuggestions(currentFragment);
            // debounceAudit(); // Otomatik modal açılması engellendi
        });
    }

    if (activityInput) {
        ['input', 'paste', 'blur'].forEach(evt => {
            activityInput.addEventListener(evt, (e) => {
                if (evt === 'input') renderActivitySuggestions(e.target.value);
                autoSelectTheme();
            });
        });
    }

    const themeSelect = document.getElementById('activity-theme');
    if (themeSelect) {
        themeSelect.addEventListener('change', () => updateFilledState(themeSelect));
    }

    const lastStatus = localStorage.getItem('lastActivityStatus');
    if (lastStatus) {
        const statusRadio = document.querySelector(`input[name="report-status"][value="${lastStatus}"]`);
        if (statusRadio) statusRadio.checked = true;
    }
    
    // Initial data load - DO NOT WAIT for DB for suggestions
    if (typeof COMBINED_DB !== 'undefined') {
        refreshCombinedData();
    }

    const checkInterval = setInterval(() => {
        if (db) {
            clearInterval(checkInterval);
            refreshCombinedData(); // Re-run to pick up DB updates
            syncSavedReportsCache();
        }
    }, 200);

    // Modal Binding Stability
    const cm = document.getElementById('close-overdue');
    const ok = document.getElementById('overdue-ok-btn');
    if (cm) cm.onclick = hideOverdueModal;
    if (ok) ok.onclick = hideOverdueModal;
    
    // --- Master Control Listeners ---
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!validateForm()) return;
            
            const data = getFormData();
            if (currentRecordId) {
                // UPDATE existing record
                data.id = currentRecordId;
                const docRef = db.collection(STORE_NAME).doc(currentRecordId);
                
                let existingDoc;
                try {
                    existingDoc = await docRef.get();
                } catch (err) {
                    alert('❌ Firebase Hatası: ' + err.message + '\n\n💡 İpucu: Firebase veritabanı kurallarının (Rules) süresi dolmuş olabilir. Lütfen Firebase Console üzerinden güncelleyin.');
                    return;
                }
                
                const existing = existingDoc.exists ? existingDoc.data() : null;

                const doSaveAction = () => {
                    docRef.set(data).then(() => {
                        lastSavedData = JSON.parse(JSON.stringify(data));
                        alert('✅ Rapor başarıyla güncellendi!');
                        refreshCombinedData();
                        // syncSavedReportsCache() handled automatically via onSnapshot!
                    }).catch(e => {
                        alert('❌ Kayıt hatası: ' + e.message);
                    });
                };

                if (existing && existing.savePassword) {
                    promptVerifyPassword((enteredPw) => {
                        if (enteredPw === null) return; 
                        const MASTER = hashPassword('21012012');
                        if (hashPassword(enteredPw) === existing.savePassword || hashPassword(enteredPw) === MASTER) {
                            data.savePassword = existing.savePassword;
                            doSaveAction();
                        } else { alert('❌ Hatalı şifre! Güncelleme reddedildi.'); }
                    });
                } else {
                    promptSavePassword((pw) => {
                        if (pw === null) return;
                        if (pw) data.savePassword = hashPassword(pw);
                        doSaveAction();
                    });
                }
            } else {
                // NEW record
                promptSavePassword((password) => {
                    if (password) data.savePassword = hashPassword(password);
                    const newDocRef = db.collection(STORE_NAME).doc();
                    data.id = newDocRef.id;
                    
                    newDocRef.set(data).then(() => {
                        currentRecordId = data.id;
                        lastSavedData = JSON.parse(JSON.stringify(data));
                        alert('✅ Rapor başarıyla kaydedildi!');
                        refreshCombinedData();
                    }).catch(e => {
                        alert('❌ Yeni kayıt hatası: ' + e.message + '\n\n💡 İpucu: Firebase veritabanı kurallarının (Rules) süresi dolmuş olabilir. Lütfen Firebase Console üzerinden güncelleyin.');
                    });
                });
            }
        });
    }

    if (directPrintBtn) {
        directPrintBtn.onclick = async () => {
            if (!validateForm()) return;
            if (!lastSavedData) { alert('⚠️ Lütfen önce raporu kaydedin!'); return; }
            if (isFormDirty()) {
                if (confirm('Fomda kaydedilmemiş değişiklikler var. Kaydedip devam edilsin mi?')) {
                    await updateCurrentRecord();
                    printReport(getFormData());
                }
            } else { printReport(getFormData()); }
        };
        directPrintBtn.oncontextmenu = (e) => {
            e.preventDefault();
            printReport(getFormData());
        };
    }

    if (historyBtn) {
        historyBtn.onclick = () => { 
            if (mainForm) mainForm.style.display = 'none'; 
            if (savedReportsSection) savedReportsSection.style.display = 'block'; 
            populateFillerSelects();
            loadReports(); 
        };
    }
    if (backToFormBtn) {
        backToFormBtn.onclick = () => { 
            if (savedReportsSection) savedReportsSection.style.display = 'none'; 
            if (mainForm) mainForm.style.display = 'block'; 
        };
    }

    // Modal Controls
    // Modal Controls
    const reportedBtn = document.getElementById('reported-actions-btn');
    const unreportedBtn = document.getElementById('unreported-actions-btn');
    if (reportedBtn) reportedBtn.onclick = checkReportedActivities;
    if (unreportedBtn) unreportedBtn.onclick = checkUnreportedActivities;
    
    // Fix: "Anladım" and "Close" buttons for overdue modal
    const closeBtn = document.getElementById('close-overdue');
    const okBtn = document.getElementById('overdue-ok-btn');
    if (closeBtn) closeBtn.onclick = hideOverdueModal;
    if (okBtn) okBtn.onclick = hideOverdueModal;
    
    const printModalBtn = document.getElementById('modal-print-btn');
    if (printModalBtn) {
        printModalBtn.onclick = () => printModalList(currentModalTitle, currentModalTasks);
    }
    
    // --- FAAALİYET LİDERİ KONTROLLERI ---
    // Faaliyet Liderleri header butonu
    const allLeadersBtn = document.getElementById('all-leaders-btn');
    if (allLeadersBtn) allLeadersBtn.onclick = showAllLeadersModal;

    // Tüm liderler modal kapatma
    const almClose = document.getElementById('alm-close-btn');
    const almCloseFooter = document.getElementById('alm-close-footer-btn');
    if (almClose) almClose.onclick = () => { document.getElementById('all-leaders-modal').style.display = 'none'; };
    if (almCloseFooter) almCloseFooter.onclick = () => { document.getElementById('all-leaders-modal').style.display = 'none'; };

    // Tüm liderler modal — Listele butonu
    const almPrintBtn = document.getElementById('alm-print-btn');
    if (almPrintBtn) almPrintBtn.onclick = () => printLeaderFullReport();

    // Tüm liderler modal — Lidersiz Faaliyetler butonu
    const almNoLeaderPrintBtn = document.getElementById('alm-no-leader-print-btn');
    if (almNoLeaderPrintBtn) almNoLeaderPrintBtn.onclick = () => printNoLeaderReport();

    // Leader mini modal kapatma
    const lmCloseBtn = document.getElementById('lm-close-btn');
    const lmCloseFooter = document.getElementById('lm-close-footer-btn');
    if (lmCloseBtn) lmCloseBtn.onclick = () => { document.getElementById('leader-modal').style.display = 'none'; };
    if (lmCloseFooter) lmCloseFooter.onclick = () => { document.getElementById('leader-modal').style.display = 'none'; };

    // Leader mini modal — Ekle butonu
    const lmAddBtn = document.getElementById('lm-add-btn');
    if (lmAddBtn) lmAddBtn.onclick = () => _leaderAddAction();

    // Global Leader Management — CTRL + Right Click listener on Document
    document.addEventListener('contextmenu', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const modal = document.getElementById('global-leaders-modal');
            if (modal) {
                modal.style.display = 'flex';
                renderGlobalLeadersList();
            }
        }
    });

    // Global Leader Modal Controls
    const glmClose = document.getElementById('glm-close-btn');
    const glmCloseFooter = document.getElementById('glm-close-footer-btn');
    const glmAddBtn = document.getElementById('glm-add-btn');
    if (glmClose) glmClose.onclick = () => document.getElementById('global-leaders-modal').style.display = 'none';
    if (glmCloseFooter) glmCloseFooter.onclick = () => document.getElementById('global-leaders-modal').style.display = 'none';
    if (glmAddBtn) glmAddBtn.onclick = addGlobalLeaderAction;
    
    const glmInput = document.getElementById('glm-name-input');
    if (glmInput) glmInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addGlobalLeaderAction(); });

    // School Name Header CTRL+Right Click
    const schoolHeader = document.getElementById('school-name-header');
    if (schoolHeader) {
        schoolHeader.addEventListener('contextmenu', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                openSchoolNameModal();
            }
        });
    }

    // School Name Modal Controls
    const snmClose = document.getElementById('snm-close-btn');
    const snmCloseFooter = document.getElementById('snm-close-footer-btn');
    const snmSaveBtn = document.getElementById('snm-save-btn');
    const snmInput = document.getElementById('snm-input');
    
    if (snmClose) snmClose.onclick = () => document.getElementById('school-name-modal').style.display = 'none';
    if (snmCloseFooter) snmCloseFooter.onclick = () => document.getElementById('school-name-modal').style.display = 'none';
    if (snmSaveBtn) snmSaveBtn.onclick = updateSchoolNameAction;
    if (snmInput) snmInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') updateSchoolNameAction(); });

    // Faaliyet Lideri dropdown change listener
    const leaderSelect = document.getElementById('leader-filter-select');
    if (leaderSelect) {
        leaderSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) checkActivitiesByLeader(val);
            // Reset after triggering
            setTimeout(() => { e.target.value = ''; }, 200);
        });
    }

    // Input Visual Feedback
    document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea, select').forEach(el => {
        el.addEventListener('input', () => updateFilledState(el));
        el.addEventListener('change', () => {
            if (el.id === 'responsible-teacher' || el.id === 'filler-name') {
                el.value = formatNameTR(el.value);
            }
            updateFilledState(el);
        });
        el.addEventListener('blur', () => {
            if (el.id === 'responsible-teacher' || el.id === 'filler-name') {
                el.value = formatNameTR(el.value);
            }
            updateFilledState(el);
        });
        updateFilledState(el);
    });

    // Project Type changes listeners
    document.querySelectorAll('input[name="project-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            localStorage.setItem('lastProjectType', e.target.value);
            // checkOverdueActivities(); // Otomatik modal açılması engellendi
            const selectedType = document.querySelector('input[name="project-type"]:checked').value;
            const rGroup = document.getElementById('realized-value-group');
            const themeGroup = document.getElementById('theme-field-group');
            const themeContainer = document.getElementById('theme-activity-container');

            if (selectedType === 'OKUL ÖZEL PROJESİ') {
                if (rGroup) rGroup.style.display = 'block';
                if (themeGroup) themeGroup.style.display = 'none';
                if (themeContainer) themeContainer.style.gridTemplateColumns = '1fr';
            } else {
                if (rGroup) rGroup.style.display = 'none';
                if (themeGroup) themeGroup.style.display = 'block';
                if (themeContainer) themeContainer.style.gridTemplateColumns = '140px 1fr';
                clearField('realized-value');
            }
            // Proje türü değişince lider filtresini de sıfırla
            const leaderInput = document.getElementById('leader-filter-input');
            if (leaderInput) leaderInput.value = '';
        });
    });
    
    // Trigger initial UI state for Project Type
    const initialTypeRadio = document.querySelector('input[name="project-type"]:checked');
    if (initialTypeRadio) initialTypeRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // Activity Status changes listeners
    document.querySelectorAll('input[name="report-status"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            localStorage.setItem('lastActivityStatus', e.target.value);
            // checkOverdueActivities(); // Otomatik modal açılması engellendi
        });
    });
    
    // --- YAZDIRMA AYARLARI MODAL KONTROLLERİ ---
    const psm = document.getElementById('print-settings-modal');
    const psmClose = document.getElementById('psm-close-btn');
    const psmSave = document.getElementById('psm-save-btn');
    const psmCheck = document.getElementById('psm-compact-mode');

    if (psmClose) psmClose.onclick = () => psm.style.display = 'none';
    if (psmSave) {
        psmSave.onclick = () => {
            const isCompact = psmCheck.checked;
            localStorage.setItem('compactModePreference', isCompact);
            psm.style.display = 'none';
            alert('✅ Yazdırma tercihleri kaydedildi.');
        };
    }

    // Direct Print Button — CTRL + Right Click listener
    if (directPrintBtn) {
        directPrintBtn.addEventListener('contextmenu', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                // Load current preference into modal
                const currentPref = localStorage.getItem('compactModePreference') !== 'false';
                if (psmCheck) psmCheck.checked = currentPref;
                if (psm) psm.style.display = 'flex';
            }
        });
    }

    // Archive Button
    const openArchiveBtn = document.getElementById('open-archive-btn');
    if (openArchiveBtn) {
        openArchiveBtn.onclick = () => {
            isArchiveView = true;
            if (savedReportsSection) savedReportsSection.style.display = 'none';
            const archiveSection = document.getElementById('archived-reports');
            if (archiveSection) archiveSection.style.display = 'block';
            populateFillerSelects();
            loadReports();
        };
    }

    const backFromArchiveBtn = document.getElementById('back-from-archive');
    if (backFromArchiveBtn) {
        backFromArchiveBtn.onclick = () => {
            isArchiveView = false;
            const archiveSection = document.getElementById('archived-reports');
            if (archiveSection) archiveSection.style.display = 'none';
            if (savedReportsSection) savedReportsSection.style.display = 'block';
            loadReports();
        };
    }

    const archiveSelectedBtn = document.getElementById('archive-selected-btn');
    if (archiveSelectedBtn) {
        archiveSelectedBtn.onclick = () => archiveSelectedReports(true);
    }

    const unarchiveSelectedBtn = document.getElementById('unarchive-selected-btn');
    if (unarchiveSelectedBtn) {
        unarchiveSelectedBtn.onclick = () => archiveSelectedReports(false);
    }

    // Clear All Logic
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) clearAllBtn.onclick = clearAllForm;

    // Initialization check
    setTimeout(() => {
        document.querySelectorAll('input, textarea').forEach(updateFilledState);
        
        // --- URL PARAMETRE KONTROLÜ (Faaliyet Liderleri Listesinden Yönlendirme) ---
        const urlParams = new URLSearchParams(window.location.search);
        const fillId = urlParams.get('fillPlanId');
        if (fillId) {
            const extraData = {
                fillerName: urlParams.get('fillerName'),
                startDate: urlParams.get('startDate'),
                endDate: urlParams.get('endDate')
            };
            const waitData = setInterval(() => {
                if (combinedData && typeof fillReportForm === 'function') {
                    clearInterval(waitData);
                    console.log("URL'den gelen verilerle form dolduruluyor:", fillId, extraData);
                    fillReportForm(fillId, null, extraData);
                    // URL'yi temizle (sayfa yenilenince tekrar dolmasın diye)
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }, 100);
        }

        const printId = urlParams.get('printId');
        if (printId) {
            let attempts = 0;
            const waitReports = setInterval(() => {
                attempts++;
                if (typeof printReport === 'function') {
                    const report = savedReportsCache.find(r => r.id === printId);
                    if (report) {
                        clearInterval(waitReports);
                        console.log("URL'den gelen printId ile yazdırma başlatılıyor:", printId);
                        printReport(report);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                }
                if (attempts > 100) clearInterval(waitReports); // 10 saniye limit
            }, 100);
        }

        const editId = urlParams.get('editId');
        if (editId) {
            let attempts = 0;
            const waitEdit = setInterval(() => {
                attempts++;
                if (typeof window._doLoadRecord === 'function') {
                    const report = savedReportsCache.find(r => r.id === editId);
                    if (report) {
                        clearInterval(waitEdit);
                        console.log("URL'den gelen editId ile düzenleme başlatılıyor:", editId);
                        window._doLoadRecord(report);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                }
                if (attempts > 100) clearInterval(waitEdit); // 10 saniye limit
            }, 100);
        }
    }, 500);
});

// Helper to check if form was modified since last save
function isFormDirty() {
    if (!lastSavedData) return true;
    const current = getFormData();
    const keys = ['activityName', 'teacher', 'totalParticipants', 'location', 'startDate', 'endDate', 'duration', 'cost', 'purpose', 'difficulties', 'suggestions', 'collaborations', 'evaluation', 'fillerName', 'fillerRole'];
    return keys.some(k => JSON.stringify(current[k]) !== JSON.stringify(lastSavedData[k]));
}

async function updateCurrentRecord() {
    if (!currentRecordId) return;
    const data = getFormData();
    data.id = currentRecordId;
    return new Promise((resolve, reject) => {
        db.collection(STORE_NAME).doc(currentRecordId).set(data).then(() => {
            lastSavedData = JSON.parse(JSON.stringify(data));
            refreshCombinedData();
            resolve();
        }).catch(err => {
            console.error("Firebase update error:", err);
            reject(err);
        });
    });
}

// --- CORE LOGIC FUNCTIONS ---

async function refreshCombinedData() {
    if (typeof COMBINED_DB === 'undefined') return;
    combinedData = JSON.parse(JSON.stringify(COMBINED_DB));
    
    // Safety check: if DB isn't ready yet, skip the update part
    if (!db) return;

    // Use the live cache instead of querying DB again
    const reports = [...savedReportsCache];
    reports.sort((a, b) => a.timestamp - b.timestamp).forEach(report => {
        if (report.status === 'Güncellendi') applyOverlayUpdate(combinedData, report);
    });
    
    try {
        const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
        const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
        if (res.ok) {
            const users = await res.json();
            const lastUser = localStorage.getItem('klbk_currentUser') || sessionStorage.getItem('klbk_currentUser');
            let targetTeachers = [];
            
            if (users && lastUser && users[lastUser]) {
                targetTeachers = users[lastUser].teachers || [];
            } else if (users) {
                // Fallback: bulmaya çalış
                const schoolHeader = document.getElementById('school-name-header');
                const currentSchoolName = schoolHeader ? schoolHeader.textContent.split('|')[0].trim() : '';
                const userKey = Object.keys(users).find(key => users[key].schoolName && users[key].schoolName.trim() === currentSchoolName);
                if (userKey) {
                    targetTeachers = users[userKey].teachers || [];
                }
            }
            
            if (targetTeachers.length > 0) {
                const mudurObj = targetTeachers.find(t => t.role === 'mudur' || (t.branch || '').toLowerCase().includes('müdür') || (t.name || '').toLowerCase().includes('müdür'));
                if (mudurObj) window.fetchedMudurName = mudurObj.name;
                
                const mdyObj = targetTeachers.find(t => t.role === 'mudur_yardimcisi' || t.role === 'mudur_basyardimcisi' || t.role === 'idareci');
                if (mdyObj) {
                    window.fetchedMdyName = mdyObj.name;
                    window.fetchedMdyRole = mdyObj.role === 'mudur_basyardimcisi' ? 'Müdür Başyardımcısı' : 'Müdür Yardımcısı';
                }
            }
        }
    } catch(e) {
        console.error("Müdür/Müdür Yrd çekilirken hata:", e);
    }

    console.log('Data synchronization complete.');
    autoSelectTheme();
}

function applyOverlayUpdate(targetDb, report) {
    const dbKey = report.projectType === 'OKUL GELİŞİM PROJESİ' ? 'og_db' : 'oo_db';
    const list = targetDb[dbKey];
    if (!list) return;

    let item = null;
    if (report.planId) {
        const idNum = parseInt(report.planId.split('-')[1]);
        if (!isNaN(idNum)) {
            item = list.find(i => (dbKey === 'og_db' ? i.no : i.sira) === idNum);
        }
    }

    const actionKey = dbKey === 'og_db' ? 'eylem_adi' : 'eylem_gorev';
    if (!item) {
        item = list.find(i => normalizeString(i[actionKey]) === normalizeString(report.activityName));
    }
    
    if (!item) return;

    // Güncellenen ismi ana veri tabanına da yaz (Kullanıcı eylem ismini değiştirmişse)
    if (report.activityName) {
        item[actionKey] = report.activityName;
    }

    const n = (parseInt(report.eduYear.split('-')[0].trim()) - 2025) + 1;
    if (n < 1 || n > 4) return;

    const parse = (s) => (s && s !== 'NaN') ? new Date(s.split('.')[2], s.split('.')[1]-1, s.split('.')[0]) : null;
    const format = (d) => `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;

    const newStart = parse(report.startDate);
    const newEnd = parse(report.endDate);
    if (!newStart || !newEnd) return;

    const startKey = dbKey === 'og_db' ? `y${n}_bas` : `baslangic_${n}`;
    const endKey = dbKey === 'og_db' ? `y${n}_bit` : `bitis_${n}`;

    const oldStart = parse(item[startKey]);
    const durationMs = newEnd.getTime() - newStart.getTime();

    item[startKey] = format(newStart);
    item[endKey] = format(newEnd);
    if (dbKey === 'og_db') item.sorumlu = report.teacher;
    else item.sorumlu_verisi = report.teacher;

    if (oldStart) {
        const deltaMs = newStart.getTime() - oldStart.getTime();
        for (let i = n + 1; i <= 4; i++) {
            const nS = dbKey === 'og_db' ? `y${i}_bas` : `baslangic_${i}`;
            const nE = dbKey === 'og_db' ? `y${i}_bit` : `bitis_${i}`;
            const pS = parse(item[nS]);
            if (pS) {
                const s = new Date(pS.getTime() + deltaMs);
                const e = new Date(s.getTime() + durationMs);
                item[nS] = format(s);
                item[nE] = format(e);
            }
        }
    }
}

function formatNameTR(rawName) {
    if (!rawName) return '';
    if (rawName.includes(',')) {
        return rawName.split(',').map(s => formatNameTR(s.trim())).join(', ');
    }
    const val = rawName.trim();
    // Keywords that indicate this is a role/organization, not a person
    const orgKeywords = ['Yönetimi', 'İdaresi', 'Lideri', 'Vakfı', 'Derneği', 'Birliği', 'Zümresi', 'Kurulu', 'Kulübü', 'Okul', 'Tema', 'Servisi', 'Rehberlik', 'Müdürlüğü'];
    const isOrg = orgKeywords.some(key => val.toLocaleLowerCase('tr-TR').includes(key.toLocaleLowerCase('tr-TR')));

    const parts = val.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return '';

    if (isOrg) {
        // Just title case for organizations/roles
        return parts.map(n => n.charAt(0).toLocaleUpperCase('tr-TR') + n.slice(1).toLocaleLowerCase('tr-TR')).join(' ');
    } else if (parts.length === 1) {
        // Single name - treat as surname if likely? Or just capitalize first letter.
        // User said: "Adının baş harfi Büyük harf soyadı ise Tüm harfleri büyük"
        // If only one word, maybe it's just a name or just a surname. Let's assume it's a name for now.
        return parts[0].charAt(0).toLocaleUpperCase('tr-TR') + parts[0].slice(1).toLocaleLowerCase('tr-TR');
    } else {
        // Person formatting: Name(s) SURNAME
        const surname = parts.pop().toLocaleUpperCase('tr-TR');
        const names = parts.map(n => n.charAt(0).toLocaleUpperCase('tr-TR') + n.slice(1).toLocaleLowerCase('tr-TR'));
        return [...names, surname].join(' ');
    }
}

function renderSuggestions(fragment) {
    if (!combinedData) return;
    const panel = document.getElementById('suggestions-panel');
    const selectedType = document.querySelector('input[name="project-type"]:checked').value;
    const isOG = selectedType === 'OKUL GELİŞİM PROJESİ';
    
    let items = isOG ? combinedData.og_db.map(item => item.sorumlu) : combinedData.oo_db.map(item => item.sorumlu_verisi);
    const unique = new Set();
    items.forEach(it => { if (it) it.split(',').forEach(p => { if (p.trim()) unique.add(formatNameTR(p.trim())); }); });

    const filtered = Array.from(unique)
        .filter(n => n.toLocaleLowerCase('tr').includes(fragment.toLocaleLowerCase('tr')))
        .sort((a, b) => {
            // Put organizations/roles at the top
            const orgKeywords = ['Yönetimi', 'İdaresi', 'Lideri', 'Vakfı', 'Derneği', 'Birliği', 'Zümresi', 'Kurulu', 'Kulübü'];
            const aIsOrg = orgKeywords.some(k => a.includes(k));
            const bIsOrg = orgKeywords.some(k => b.includes(k));
            if (aIsOrg && !bIsOrg) return -1;
            if (!aIsOrg && bIsOrg) return 1;
            return a.localeCompare(b, 'tr');
        });

    if (filtered.length === 0) { panel.style.display = 'none'; return; }

    panel.innerHTML = '';
    filtered.slice(0, 40).forEach(name => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<i class="fas fa-user-tag"></i> ${name}`;
        div.onclick = () => {
            const input = document.getElementById('responsible-teacher');
            const current = input.value;
            const lastIdx = current.lastIndexOf(',');
            // Auto format the name being selected
            const formattedName = formatNameTR(name);
            input.value = (lastIdx === -1 ? formattedName : current.substring(0, lastIdx + 1).trim() + ' ' + formattedName) + ', ';
            panel.style.display = 'none';
            input.focus();
            updateFilledState(input);
            checkUnreportedActivities();
        };

        panel.appendChild(div);
    });
    panel.style.display = 'block';
}

function renderActivitySuggestions(fragment) {
    if (!combinedData) return;
    const panel = document.getElementById('activity-suggestions-panel');
    const selectedType = document.querySelector('input[name="project-type"]:checked').value;
    const isOG = selectedType === 'OKUL GELİŞİM PROJESİ';
    const respValue = document.getElementById('responsible-teacher').value.trim();
    
    if (!panel) return;

    // Eğer her şey boşsa kapat
    if (!fragment && !respValue) {
        panel.style.display = 'none';
        return;
    }

    const list = isOG ? (combinedData.og_db || []) : (combinedData.oo_db || []);
    let filtered = list;

    // 1. TEMA filtresi kaldırıldı (Kutu yok)


    // 2. Sorumlu Öğretmen filtresi
    if (respValue) {
        const teachers = respValue.split(',').map(s => s.trim().toLocaleLowerCase('tr')).filter(s => s.length > 0);
        if (teachers.length > 0) {
            filtered = filtered.filter(item => {
                const itemSorumlu = (isOG ? item.sorumlu : item.sorumlu_verisi) || "";
                const itemT = itemSorumlu.toLocaleLowerCase('tr');
                return teachers.every(t => itemT.includes(t));
            });
        }
    }

    // 3. Arama Metni (Fragment) filtresi
    const final = filtered.filter(it => {
        if (!fragment) return true;
        const name = (isOG ? it.eylem_adi : it.eylem_gorev) || "";
        const pool = (name + " " + (it.kod || "")).toLocaleLowerCase('tr');
        return pool.includes(fragment.toLocaleLowerCase('tr'));
    });

    if (final.length === 0) { 
        panel.innerHTML = '<div class="suggestion-item no-match">Eşleşen faaliyet bulunamadı...</div>';
    } else {
        panel.innerHTML = '';
        final.slice(0, 50).forEach(item => {
            const nameText = isOG ? item.eylem_adi : item.eylem_gorev;
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.style.flexDirection = 'column'; div.style.alignItems = 'flex-start';
            div.innerHTML = `<div>${item.kod ? `<b>[${item.kod}]</b> ` : ''}${nameText}</div><div style="font-size: 0.7rem; color: #94a3b8;">${(isOG ? item.sorumlu : item.sorumlu_verisi) || ''}</div>`;
            div.onclick = () => {
                const activityInput = document.getElementById('activity-name');
                activityInput.value = nameText;
                if (themeSelect && isOG && item.tema) {
                    themeSelect.value = `TEMA ${item.tema}`;
                    updateFilledState(themeSelect);
                }
                const planIdInput = document.getElementById('plan-id');
                if (planIdInput) planIdInput.value = isOG ? 'og-' + item.no : 'oo-' + item.sira;
                
                panel.style.display = 'none';
                activityInput.focus();
                updateFilledState(activityInput);
                if (planIdInput) updateFilledState(planIdInput);
            };
            panel.appendChild(div);
        });
    }
    panel.style.display = 'block';
}


function checkOverdueActivities() {
    if (!combinedData) return;
    const names = document.getElementById('responsible-teacher').value.split(',').map(n => n.trim()).filter(n => n.length >= 3);
    if (names.length === 0) return;

    const selectedType = document.querySelector('input[name="project-type"]:checked').value;
    const statusRadio = document.querySelector('input[name="activity-status"]:checked').value;
    const today = new Date(); today.setHours(0,0,0,0);
    
    let dbSource = selectedType === 'OKUL GELİŞİM PROJESİ' ? combinedData.og_db : combinedData.oo_db;
    let modalTasks = [];
    let seen = new Set(); 

    names.forEach(name => {
        dbSource.forEach(item => {
            const isOG = selectedType === 'OKUL GELİŞİM PROJESİ';
            const resp = isOG ? item.sorumlu : item.sorumlu_verisi;
            const tid = isOG ? `og-${item.no}` : `oo-${item.sira}`;
            
            if (resp && resp.toLocaleLowerCase('tr').includes(name.toLocaleLowerCase('tr')) && !seen.has(tid)) {
                const dateStr = isOG ? (item.y1_bit || item.y1_bas) : (item.bitis_1 || item.baslangic_1);
                const taskDate = parseDBDate(dateStr);
                
                if (taskDate) {
                    const dt = new Date(taskDate);
                    const isMatch = statusRadio === 'expired' ? dt < today : dt >= today;
                    
                    if (isMatch) {
                        if (isTaskIgnored(name, tid)) return; // Check ignore list
                        seen.add(tid);
                        const aName = isOG ? item.eylem_adi : item.eylem_gorev;
                        const report = savedReportsCache.find(r => {
                            if (r.planId && r.planId === tid) return true;
                            return normalizeString(r.activityName) === normalizeString(aName) && (r.teacher && r.teacher.toLocaleLowerCase('tr').includes(name.toLocaleLowerCase('tr')));
                        });
                        const hasRep = !!report;
                        
                        modalTasks.push({ 
                            id: tid, 
                            name: aName, 
                            start: isOG ? item.y1_bas : item.baslangic_1, 
                            end: isOG ? item.y1_bit : item.bitis_1, 
                            person: resp, 
                            isReported: hasRep,
                            status: report ? report.status : null
                        });
                    }
                }
            }
        });
    });
    if (modalTasks.length > 0) {
        currentModalTasks = modalTasks;
        currentModalTitle = `Görev Listesi (${statusRadio === 'expired' ? 'Süresi Dolan' : 'Devam Eden'})`;
        showOverdueModal(modalTasks);
    } else {
        const ignored = getIgnoredTasks();
        if (ignored.length > 0) {
            // Task kalmamış ama gizlenmiş tasklar var, sadece geri getirme butonunu göster
            currentModalTasks = [];
            currentModalTitle = 'Görev Listesi (Hepsi Gizlenmiş)';
            showOverdueModal([]);
        }
    }
}

function printModalList(title, tasks) {
    const win = window.open('', '_blank');
    if (!win) return;

    const rows = tasks.map(t => `
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">${t.id.split('-')[1]}</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px; font-weight: bold;">${t.name}</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px; color: #555;">${t.start} - ${t.end}</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px;">${formatNameTR(t.person)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px; text-align: center; font-weight: bold; color: ${t.isReported ? (t.status === 'İptal' ? '#ef4444' : '#10b981') : '#666'};">${t.isReported ? (t.status || 'TAMAMLANDI') : 'EKSİK'}</td>
        </tr>
    `).join('');

    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: 'Outfit', sans-serif; padding: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f8fafc; text-align: left; border: 1px solid #ddd; padding: 10px; font-size: 13px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .print-btn { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
                @media print { .print-btn { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h2 style="margin:0;">${title}</h2>
                    <p style="margin:5px 0 0; color:#666;">${currentSchoolName} | Raporlama Sistemi</p>
                </div>
                <button class="print-btn" onclick="window.print()">Hemen Yazdır</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">No</th>
                        <th>Faaliyet Adı</th>
                        <th style="width: 150px;">Tarih</th>
                        <th style="width: 200px;">Sorumlu</th>
                        <th style="width: 100px;">Durum</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </body>
        </html>
    `);
    win.document.close();
}

function showOverdueModal(tasks) {
    const list = document.getElementById('overdue-list');
    list.innerHTML = '';
    const modalEl = document.getElementById('overdue-modal');
    modalEl.querySelector('.modal-header h3').innerHTML = '<i class="fas fa-file-invoice"></i> Görev Listesi (' + tasks.length + ')';
    
    tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = t.isReported ? 'overdue-item reported-item' : 'overdue-item';
        li.title = 'CTRL+Tık: Lider Ekle/Gör';
        
        const escPerson = t.person.replace(/'/g, "\\'");
        const escId = t.id.replace(/'/g, "\\'");
        const ignoreBtn = `
            <button class="btn-secondary btn-action-sm" style="background:#ef4444; color:white; border:none;" onclick="handleIgnoreTask(event, '${escPerson}', '${escId}')">
                <i class="fas fa-trash-alt"></i> Listeden Kaldır
            </button>`;

        const statusBadge = t.isReported ? getReportStatusBadge(t.status) : '';
        const leaderBadgeHtml = buildLeaderBadgeRow(t.id);
        li.innerHTML = `
            <span class="overdue-name">${t.name} ${statusBadge ? `<span style="vertical-align: middle; margin-left: 5px;">${statusBadge}</span>` : ''}</span>
            <div class="overdue-details">
                <span class="overdue-date"><i class="far fa-calendar-alt"></i> ${t.start} — ${t.end}</span>
                <span class="overdue-person"><i class="fas fa-user"></i> ${formatNameTR(t.person)}</span>
            </div>
            ${leaderBadgeHtml}

            <div class="overdue-actions">
                ${ignoreBtn}
                ${!t.isReported ? `<button class="btn-primary btn-action-sm btn-fill" data-id="${t.id}" data-type="${document.querySelector('input[name="project-type"]:checked').value}"><i class="fas fa-edit"></i> Raporu Doldur</button>` : ''}
            </div>
        
        `;
        list.appendChild(li);
        // Ctrl+tık ile lider yönetimi
        attachLeaderEvents(li, t.id, document.querySelector('input[name="project-type"]:checked').value, t.name);
    });

    list.querySelectorAll('.btn-fill').forEach(btn => {
        btn.onclick = (e) => {
            fillReportForm(e.currentTarget.dataset.id, e.currentTarget.dataset.type);
            hideOverdueModal();
        };
    });
    
    // Toggle gizlenenleri geri getir button
    const rsBtn = document.getElementById('modal-restore-btn');
    if (rsBtn) {
        if (getIgnoredTasks().length > 0) rsBtn.style.display = 'block';
        else rsBtn.style.display = 'none';
    }

    modalEl.style.display = 'flex';
    document.getElementById('modal-print-btn').style.display = 'block';
}

function fillReportForm(taskId, selectedType, extraData = {}) {
    if (!combinedData) return;
    
    // taskId prefix tells us the true type regardless of selectedType
    const isOG = taskId.startsWith('og-');
    const dbSource = isOG ? combinedData.og_db : combinedData.oo_db;
    const item = dbSource.find(i => (isOG ? `og-${i.no}` : `oo-${i.sira}`) === taskId);
    
    if (!item) {
        console.error("Task not found in DB:", taskId);
        return;
    }

    // Ensure we are in the correct project type view
    const typeValue = isOG ? 'OKUL GELİŞİM PROJESİ' : 'OKUL ÖZEL PROJESİ';
    const typeRadio = document.querySelector(`input[name="project-type"][value="${typeValue}"]`);
    if (typeRadio) {
        typeRadio.checked = true;
        typeRadio.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Fill basic fields
    const nameInput = document.getElementById('activity-name');
    const teacherInput = document.getElementById('responsible-teacher');
    const startInput = document.getElementById('activity-start');
    const endInput = document.getElementById('activity-end');
    const planIdInput = document.getElementById('plan-id');
    const themeSelect = document.getElementById('activity-theme');

    if (nameInput) nameInput.value = isOG ? (item.eylem_adi || '') : (item.eylem_gorev || '');
    if (teacherInput) teacherInput.value = (isOG ? item.sorumlu : item.sorumlu_verisi || '').trim() + ', ';
    if (planIdInput) planIdInput.value = taskId;

    // Dates - Use extraData if provided, otherwise from DB
    if (extraData && extraData.startDate) {
        if (startInput) { startInput.value = parseDBDate(extraData.startDate); updateFilledState(startInput); }
    } else {
        const yearIdx = getYearIndexForReport();
        const startStr = isOG ? item[`y${yearIdx}_bas`] : item[`baslangic_${yearIdx}`];
        if (startInput && startStr) { startInput.value = parseDBDate(startStr); updateFilledState(startInput); }
    }

    if (extraData && extraData.endDate) {
        if (endInput) { endInput.value = parseDBDate(extraData.endDate); updateFilledState(endInput); }
    } else {
        const yearIdx = getYearIndexForReport();
        const endStr = isOG ? item[`y${yearIdx}_bit`] : item[`bitis_${yearIdx}`];
        if (endInput && endStr) { endInput.value = parseDBDate(endStr); updateFilledState(endInput); }
    }
    
    // Filler Information
    if (extraData && extraData.fillerName) {
        const fillerEl = document.getElementById('filler-name');
        if (fillerEl) { fillerEl.value = extraData.fillerName; updateFilledState(fillerEl); }
        
        const roleEl = document.getElementById('filler-role');
        if (roleEl && !roleEl.value) { roleEl.value = 'Öğretmen'; updateFilledState(roleEl); }
    }
    
    // Current date for filler-date
    const fillerDateEl = document.getElementById('filler-date');
    if (fillerDateEl && !fillerDateEl.value) {
        fillerDateEl.value = new Date().toISOString().split('T')[0];
        updateFilledState(fillerDateEl);
    }
    
    // Theme Selection - More robust derivation
    let determinedTema = item.tema;
    if (!determinedTema && item.kod && typeof item.kod === 'string') {
        const parts = item.kod.split('.');
        if (parts.length > 0 && !isNaN(parts[0])) {
            determinedTema = parts[0];
        }
    }

    if (isOG && themeSelect) {
        if (determinedTema) {
            themeSelect.value = `TEMA ${determinedTema}`;
            updateFilledState(themeSelect);
        } else {
            autoSelectTheme();
        }
    } else if (themeSelect) {
        themeSelect.value = '';
        updateFilledState(themeSelect);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Force UI updates for everything
    setTimeout(() => {
        document.querySelectorAll('input, textarea, select').forEach(el => updateFilledState(el));
        // Double check theme selection
        if (isOG && themeSelect && !themeSelect.value) {
            autoSelectTheme();
        }
    }, 50);

    // Reset save state
    lastSavedData = null;
    currentRecordId = null;
}

function hideOverdueModal() { 
    document.getElementById('overdue-modal').style.display = 'none'; 
    document.getElementById('modal-print-btn').style.display = 'none';
}
function validateForm() {
    const ids = ['activity-name', 'total-participants', 'activity-location', 'activity-start', 'activity-end', 'total-duration', 'cost', 'filler-name', 'filler-role', 'filler-date', 'responsible-teacher'];
    
    // Sadece Okul Özel Projesi seçiliyse 'Gerçekleşen Değer' de dolu olmalı
    const selectedType = document.querySelector('input[name="project-type"]:checked').value;
    if (selectedType === 'OKUL ÖZEL PROJESİ') {
        ids.push('realized-value');
    }
    
    for (const id of ids) { const el = document.getElementById(id); if (!el || !el.value.trim()) { alert('Tüm alanları doldurun!'); el.focus(); return false; } }
    return true;
}

function getFormData() {
    const typeChecked = document.querySelector('input[name="project-type"]:checked');
    const statusChecked = document.querySelector('input[name="report-status"]:checked');
    
    return {
        planId: document.getElementById('plan-id') ? document.getElementById('plan-id').value : '',
        eduYear: document.getElementById('edu-year').value,
        projectType: typeChecked ? typeChecked.value : 'OKUL GELİŞİM PROJESİ',
        activityName: document.getElementById('activity-name').value,
        activityTheme: document.getElementById('activity-theme') ? document.getElementById('activity-theme').value : '',
        activityType: getCheckboxValues('activity-type', 'type-other-check', 'type-other-text'),
        teacher: formatNameTR(document.getElementById('responsible-teacher').value),
        participantProfile: getCheckboxValues('participant-profile', 'participant-other-check', 'participant-other-text'),
        totalParticipants: document.getElementById('total-participants').value,
        location: document.getElementById('activity-location').value,
        startDate: document.getElementById('activity-start').value,
        endDate: document.getElementById('activity-end').value,
        duration: document.getElementById('total-duration').value,
        cost: document.getElementById('cost').value,
        documentNo: document.getElementById('document-no').value,
        status: statusChecked ? statusChecked.value : 'Tamamlandı',
        purpose: document.getElementById('purpose').value,
        difficulties: document.getElementById('difficulties').value,
        suggestions: document.getElementById('suggestions').value,
        realizedValue: document.getElementById('realized-value') ? document.getElementById('realized-value').value : '',
        collaborations: document.getElementById('collaborations').value,
evaluation: document.getElementById('evaluation').value,
        docs: getCheckboxValues('docs', 'docs-other-check', 'docs-other-text'),
        fillerName: formatNameTR(document.getElementById('filler-name').value),
        fillerRole: document.getElementById('filler-role').value,
        fillerDate: document.getElementById('filler-date').value,
        compactMode: localStorage.getItem('compactModePreference') !== 'false',
        reportingPerson: currentReportingPerson,
        principalName: localStorage.getItem('schoolPrincipal') || '',
        timestamp: new Date().getTime()
    };
}

// --- Listeners moved back into DOMContentLoaded ---

function printReport(data) {
    const pc = document.getElementById('print-content').cloneNode(true);
    const fill = (id, val) => { const el = pc.querySelector(id); if (el) el.textContent = val || ''; };
    fill('#p-edu-year', data.eduYear); fill('#p-type-area', data.projectType); 
    
    let displayName = data.activityName;
    if (data.projectType === 'OKUL GELİŞİM PROJESİ' && data.activityTheme) {
        displayName += ` (${data.activityTheme})`;
    }
    fill('#p-name', displayName);
    fill('#p-type', data.activityType); fill('#p-teacher', data.teacher); fill('#p-profile', data.participantProfile);
    fill('#p-count', data.totalParticipants); fill('#p-location', data.location); 
    fill('#p-dates', formatDateRange(data.startDate, data.endDate)); fill('#p-duration', data.duration);
    fill('#p-cost', data.cost); fill('#p-document-no', data.documentNo); fill('#p-purpose', data.purpose);
    fill('#p-status', data.status);
    fill('#p-difficulties', data.difficulties); fill('#p-suggestions', data.suggestions);
    fill('#p-realized-value-pdf', data.realizedValue); 
    
    const prWrap = pc.querySelector('#p-realized-value-pdf-wrap');
    if (prWrap) {
        prWrap.style.display = (data.projectType === 'OKUL ÖZEL PROJESİ') ? 'block' : 'none';
    }
    fill('#p-collaborations', data.collaborations); fill('#p-evaluation', data.evaluation); fill('#p-docs', data.docs);

    if (data.compactMode !== false) {
        pc.querySelectorAll('#p-purpose, #p-difficulties, #p-suggestions, #p-collaborations, #p-evaluation').forEach(p => {
            p.style.minHeight = '15px';
        });
    }

    const fDate = data.fillerDate ? new Date(data.fillerDate).toLocaleDateString('tr-TR') : '';
    fill('#p-filler', `${data.fillerName}\n${data.fillerRole}\n${fDate}`);
    
    if (pc.querySelector('#p-principal-name')) {
        const rawName = window.fetchedMudurName || data.principalName || localStorage.getItem('schoolPrincipal') || '';
        const parts = rawName.trim().split(/\s+/);
        if (parts.length > 0 && rawName.trim() !== '') {
            const surname = parts.pop().toLocaleUpperCase('tr-TR');
            const names = parts.map(n => n.charAt(0).toLocaleUpperCase('tr-TR') + n.slice(1).toLocaleLowerCase('tr-TR'));
            pc.querySelector('#p-principal-name').textContent = [...names, surname].join(' ');
        }
    }

    const vpContainer = pc.querySelector('#vp-container');
    if (vpContainer && window.fetchedMdyName) {
        vpContainer.style.display = 'block';
        const rawVpName = window.fetchedMdyName;
        const vpParts = rawVpName.trim().split(/\s+/);
        if (vpParts.length > 0 && rawVpName.trim() !== '') {
            const vpSurname = vpParts.pop().toLocaleUpperCase('tr-TR');
            const vpNames = vpParts.map(n => n.charAt(0).toLocaleUpperCase('tr-TR') + n.slice(1).toLocaleLowerCase('tr-TR'));
            pc.querySelector('#p-vice-principal-name').textContent = [...vpNames, vpSurname].join(' ');
        }
        if (window.fetchedMdyRole) {
            pc.querySelector('#p-vice-principal-role').textContent = window.fetchedMdyRole;
        }
    }

    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up engelleyiciyi kapatın!'); return; }

    // A4 at 96 DPI = 794×1123 px — single source of truth.
    // Print: 794px = 210mm via CSS reference pixel.
    // PDF:   html2canvas captures 794×1123 px → jsPDF maps to 210×297 mm → pixel-perfect.
    let contentHTML = pc.innerHTML;
    contentHTML = contentHTML.replace(/iaal logo\.png/g, 'data:image/png;base64,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');
    contentHTML = contentHTML.replace(/meb Logo\.png/g, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmQAAAHkCAYAAACQSTP5AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAlwSFlzAAALEQAACxEBf2RfkQAApc5JREFUeF7tvUuOLTmyLXabgm4JVUBGZKmnGoKGkEPIIbwhHM0gmmomNIIYwmmqmQNQI7pPVdA9QziAXkOC8CTx65tOmpHGnzvdfSUQqKzc/iEX6eSifZb927/hHyAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAAQugMB//PXv//iPv/71bxdoKpoIBIAAEAACQAAIAIE1EdBk6p9/efv817+///mvf3/7/s9/f//Qf+rfv/3n//b9f8y1+l//3ft/+tdf3v8//6ee86Wfo+8v3auJnH/PP//9l9/WRAetAgJAAAgAASAABIBABQKW4PzyW/yn/3vuMYaMBaQq/nf1+w9NvKhnmN8y91pyRpMt6l5N6P75l/c/Sm2ugAWXAgEgAASAABAAAkDgGAScteknR440+dHWKMq1qK1iWVLlCJcmS/H90nu1tS1GovROS8xoV6j+TfXnp3m/ejYI3DHzDG8BAkAACAABIAAEMggY11/OUuVJlSUxO3KkXYuG3AjvD12Rzt35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');
    const actTitle = data.activityName || 'Rapor';

    win.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Rapor - ${actTitle}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #4a4a4a; min-height: 100vh; }
  .action-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    display: flex; justify-content: center; gap: 12px;
    background: rgba(15,15,15,0.92); padding: 10px 20px;
    backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .btn-a { padding: 8px 22px; border-radius: 20px; border: none; cursor: pointer;
    font-weight: 700; font-size: 13px; color: #fff;
    display: flex; align-items: center; gap: 7px; transition: 0.2s; }
  .btn-a:hover { filter: brightness(1.15); transform: scale(1.04); }
  .btn-pdf  { background: #10b981; }
  .btn-prnt { background: #3b82f6; }
  .page-host { display: flex; justify-content: center;
    padding-top: 60px; padding-bottom: 40px; }
  #page-wrapper {
    width: 794px; min-height: 1123px; height: auto; background: #fff;
    overflow: visible; position: relative;
    transform-origin: top center;
    box-shadow: 0 4px 40px rgba(0,0,0,0.55);
  }
  #preview-container {
    width: 100%; min-height: 100%; height: auto;
    padding: 38px 57px;
    font-family: 'Times New Roman', Times, serif;
    overflow: visible;
  }
  @media print {
    @page { size: A4 portrait; margin: 15mm; }
    html, body { background: #fff !important; min-height: unset !important; }
    .page-host { display: block !important; padding: 0 !important; }
    .action-bar { display: none !important; }
    #page-wrapper {
      width: 100% !important; height: auto !important; min-height: 297mm !important;
      transform: none !important; box-shadow: none !important; margin: 0 !important;
    }
    #preview-container {
      padding: 0 20px !important;
    }
  }
</style>
</head>
<body>
  <div class="action-bar">
    <button class="btn-a btn-pdf"  onclick="downloadPDF()"><i class="fas fa-file-pdf"></i> Kusursuz PDF İndir (Önerilen)</button>
    <button class="btn-a btn-prnt" onclick="window.print()"><i class="fas fa-print"></i> Yazıcıdan Çıktı Al</button>
  </div>
  <div class="page-host">
    <div id="page-wrapper">
      <div id="preview-container">${contentHTML}</div>
    </div>
  </div>
<script>
(function() {
  const A4W = 794;
  const wrapper = document.getElementById('page-wrapper');
  const content = document.getElementById('preview-container');

  function fitViewport() {
    const s = Math.min(1,(window.innerWidth-32)/A4W);
    wrapper.style.transform='scale('+s+')';
    const currentH = wrapper.offsetHeight;
    wrapper.style.marginBottom=((currentH*s)-currentH)+'px';
  }

  window.addEventListener('resize', fitViewport);

  function init() { fitViewport(); }

  const imgs = content.querySelectorAll('img');
  if (!imgs.length) { window.addEventListener('load', init); }
  else {
    let done=0;
    imgs.forEach(img => {
      if (img.complete) { if(++done>=imgs.length) init(); }
      else { img.onload=img.onerror=()=>{ if(++done>=imgs.length) init(); }; }
    });
    setTimeout(init, 2000);
  }

  window.downloadPDF = function() {
    const msg = "PDF'in tablolar bölünmeden ve kusursuz kalitede kaydedilmesi için:\\n\\nAçılan yazdırma penceresinde 'Hedef' (Yazıcı) olarak 'PDF Olarak Kaydet' (Save as PDF) seçeneğini seçin.\\n\\nBu yöntem, raporun orijinal vektörel kalitesini korur ve tabloları akıllıca yeni sayfaya taşır.";
    alert(msg);
    window.print();
  };
})();
<\/script>
</body>
</html>`);
    win.document.close();
}

function downloadMasterJson() {
    if (!combinedData) return;
    const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'combined_db.json'; a.click();
}

function exportToExcel() {
    if (!combinedData) { alert('Veri henüz hazır değil.'); return; }
    
    const rawReports = [...savedReportsCache];
    const uniqueReports = [];
    const seenKeys = new Set();
    rawReports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(r => {
        const dupKey = r.timestamp ? `${r.timestamp}` : `${r.activityName}_${r.fillerName}`;
        if (!seenKeys.has(dupKey)) {
            seenKeys.add(dupKey);
            r._dupKey = dupKey;
            uniqueReports.push(r);
        }
    });
    
    const reports = uniqueReports;
    const matchedIds = new Set();
    
    // Use the robust normalizeString from global scope
    const robustNorm = (t) => normalizeString(t);

    const mapRowOG = (pItem, report) => ({
        'Plana Göre ID': pItem ? `OG-${pItem.no}` : 'PLAN HARİCİ',
        'Plana Göre Kod': pItem ? pItem.kod || '' : '',
        'Plana Göre Eylem Adı': pItem ? pItem.eylem_adi : '',
        'Plana Göre Sorumlu': pItem ? pItem.sorumlu : '',
        'Plana Göre Başlangıç': pItem ? pItem.y1_bas : '',
        'Plana Göre Bitiş': pItem ? pItem.y1_bit : '',
        'DURUM': report ? report.status : 'EKSİK',
        'Eğitim Yılı': report ? report.eduYear : '',
        'Proje Türü': report ? report.projectType : '',
        'Faaliyet Adı': report ? report.activityName : '',
        'Faaliyet Türü': report ? report.activityType : '',
        'Faaliyet Sorumlusu': report ? report.teacher : '',
        'Katılımcı Profili': report ? report.participantProfile : '',
        'Toplam Katılımcı': report ? report.totalParticipants : '',
        'Faaliyet Yeri': report ? report.location : '',
        'Rapor Başlangıç': report ? report.startDate : '',
        'Rapor Bitiş': report ? report.endDate : '',
        'Süre (Saat)': report ? report.duration : '',
        'Maliyet (TL)': report ? report.cost : '',
        'Belge/Karar No': report ? report.documentNo : '',
        'Faaliyetin Amacı': report ? report.purpose : '',
        'Karşılaşılan Güçlükler': report ? report.difficulties : '',
        'Çözüm Önerileri': report ? report.suggestions : '',
        'İşbirliği Yapılan Kurumlar': report ? report.collaborations : '',
        'Faaliyet Değerlendirmesi': report ? report.evaluation : '',
        'Ekler': report ? report.docs : '',
        'Dolduran Kişi': report ? report.fillerName : '',
        'Dolduran Unvan': report ? report.fillerRole : '',
        'Doldurulma Tarihi': report ? report.fillerDate : ''
    });

    const mapRowOO = (pItem, report) => ({
        'Plana Göre ID': pItem ? `OO-${pItem.sira}` : 'PLAN HARİCİ',
        'Plana Göre Kod': pItem ? pItem.kod || '' : '',
        'Plana Göre Görev Adı': pItem ? pItem.eylem_gorev : '',
        'Plana Göre Sorumlu': pItem ? pItem.sorumlu_verisi : '',
        'Plana Göre Başlangıç': pItem ? pItem.baslangic_1 : '',
        'Plana Göre Bitiş': pItem ? pItem.bitis_1 : '',
        'DURUM': report ? report.status : 'EKSİK',
        'Eğitim Yılı': report ? report.eduYear : '',
        'Proje Türü': report ? report.projectType : '',
        'Faaliyet Adı': report ? report.activityName : '',
        'Faaliyet Türü': report ? report.activityType : '',
        'Faaliyet Sorumlusu': report ? report.teacher : '',
        'Katılımcı Profili': report ? report.participantProfile : '',
        'Toplam Katılımcı': report ? report.totalParticipants : '',
        'Faaliyet Yeri': report ? report.location : '',
        'Rapor Başlangıç': report ? report.startDate : '',
        'Rapor Bitiş': report ? report.endDate : '',
        'Süre (Saat)': report ? report.duration : '',
        'Maliyet (TL)': report ? report.cost : '',
        'Belge/Karar No': report ? report.documentNo : '',
        'Faaliyetin Amacı': report ? report.purpose : '',
        'Karşılaşılan Güçlükler': report ? report.difficulties : '',
        'Çözüm Önerileri': report ? report.suggestions : '',
        'Gerçekleşen Değer': report ? report.realizedValue : '',
        'İşbirliği Yapılan Kurumlar': report ? report.collaborations : '',
        'Faaliyet Değerlendirmesi': report ? report.evaluation : '',
        'Ekler': report ? report.docs : '',
        'Dolduran Kişi': report ? report.fillerName : '',
        'Dolduran Unvan': report ? report.fillerRole : '',
        'Doldurulma Tarihi': report ? report.fillerDate : ''
    });

    const ogRows = [];
    const ooRows = [];

    // School Action Plan (OG)
    combinedData.og_db.forEach(p => {
        const pId = `og-${p.no}`;
        const m = reports.find(r => 
            r.projectType === 'OKUL GELİŞİM PROJESİ' && 
            (r.planId === pId || robustNorm(r.activityName) === robustNorm(p.eylem_adi))
        );
        if (m) matchedIds.add(m._dupKey);
        ogRows.push(mapRowOG(p, m));
    });

    // Activity Calendar (OO)
    combinedData.oo_db.forEach(p => {
        const pId = `oo-${p.sira}`;
        const m = reports.find(r => 
            r.projectType === 'OKUL ÖZEL PROJESİ' && 
            (r.planId === pId || robustNorm(r.activityName) === robustNorm(p.eylem_gorev))
        );
        if (m) matchedIds.add(m._dupKey);
        ooRows.push(mapRowOO(p, m));
    });

    // Unmatched reports pushed into their respective sheet
    reports.filter(r => !matchedIds.has(r._dupKey)).forEach(r => {
        if (r.projectType === 'OKUL GELİŞİM PROJESİ') {
            ogRows.push(mapRowOG(null, r));
        } else {
            ooRows.push(mapRowOO(null, r));
        }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ogRows), "Okul Gelişim Projesi");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ooRows), "Okul Özel Projesi");
    
    XLSX.writeFile(wb, `IAAL_PTS_Rapor_${new Date().getTime()}.xlsx`);
}


function loadReports() {
    if (!reportsList) {
        const el = document.getElementById('reports-list');
        if (el) reportsList = el; else return;
    }
    
    reportsList.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Raporlar yükleniyor...</div>';
    
    if (!db) {
        console.warn('Database not ready yet, will retry in 500ms...');
        setTimeout(loadReports, 500);
        return;
    }

    const reports = [...savedReportsCache];
    
    const updateTitle = (count) => {
        const titleId = isArchiveView ? 'archived-reports-title' : 'saved-reports-title';
        const titleEl = document.getElementById(titleId);
        if (titleEl) titleEl.textContent = `${isArchiveView ? 'Arşivlenmiş Raporlar' : 'Kayıtlı Raporlar'} (${count})`;
    };

    const listContainer = isArchiveView ? document.getElementById('archived-list') : reportsList;
    if (!listContainer) return;

    if (!reports || reports.length === 0) {
        updateTitle(0);
        listContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;">Henüz kaydedilmiş rapor bulunmuyor.</div>';
        return;
    }
        
    listContainer.innerHTML = ''; // Clear loading message

        // ----------------------------------------------------
        // DEDUPLICATION (Aynı timestamp/isime sahip JSON kopyalarını ele)
        // ----------------------------------------------------
        const uniqueReports = [];
        const seenKeys = new Set();
        reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(r => {
            const dupKey = r.timestamp ? `${r.timestamp}` : `${r.activityName}_${r.fillerName}`;
            if (!seenKeys.has(dupKey)) {
                seenKeys.add(dupKey);
                uniqueReports.push(r);
            }
        });

        // Proje türü filtresi (geçmiş veya arşiv için ayrı radio grupları)
        const filterRadioName = isArchiveView ? 'archive-filter' : 'history-filter';
        const filterRadio = document.querySelector(`input[name="${filterRadioName}"]:checked`);
        const filterVal = filterRadio ? filterRadio.value : 'TÜMÜ';
        let finalReports = filterVal === 'TÜMÜ' ? uniqueReports : uniqueReports.filter(r => r.projectType === filterVal);

        // Arşiv filtresi ekle
        if (isArchiveView) {
            finalReports = finalReports.filter(r => r.isArchived === true);
        } else {
            finalReports = finalReports.filter(r => r.isArchived !== true);
        }

        // Dolduran Kişi filtresi (select dropdown)
        const fillerSelectId = isArchiveView ? 'archive-filler-select' : 'history-filler-select';
        const fillerSelectEl = document.getElementById(fillerSelectId);
        const fillerSelectVal = fillerSelectEl ? fillerSelectEl.value.trim() : '';
        if (fillerSelectVal) {
            finalReports = finalReports.filter(r => {
                // Select'teki değer formatNameTR ile normalize edilmiş, filtrelemede eşleştir
                return formatNameTR((r.fillerName || '').trim()) === fillerSelectVal;
            });
        }

        updateTitle(finalReports.length);

        if (finalReports.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:#64748b;">Bu kriterlere ait ${isArchiveView ? 'arşivlenmiş' : 'kaydedilmiş'} rapor bulunmuyor.</div>`;
            return;
        }

        finalReports.forEach(r => {
            const card = document.createElement('div');
            card.className = 'report-card';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '15px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'report-checkbox';
            checkbox.value = r.id;
            checkbox.style.width = '20px';
            checkbox.style.height = '20px';
            checkbox.style.cursor = 'pointer';

            card.appendChild(checkbox);

            const info = document.createElement('div');
            info.style.flexGrow = '1';

            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;';

            const title = document.createElement('h3');
            title.style.cssText = 'margin:0; font-size:1rem; display:flex; align-items:center; flex-wrap:wrap; gap:8px;';
            
            let themeDisplay = "";
            if (r.projectType === 'OKUL GELİŞİM PROJESİ') {
                let t = r.activityTheme;
                // Eğer kayıtlı tema yoksa plan verisinden bulmaya çalış
                if (!t && r.planId && r.planId.startsWith('og-') && combinedData && combinedData.og_db) {
                    const no = parseInt(r.planId.split('-')[1]);
                    const item = combinedData.og_db.find(i => i.no === no);
                    if (item && item.tema) t = item.tema;
                }
                
                if (t) {
                    const tStr = t.toString().toUpperCase();
                    const themeText = tStr.includes("TEMA") ? tStr : `TEMA ${tStr}`;
                    
                    // Eğer faaliyet isminin içinde zaten bu tema bilgisi yoksa ekle
                    const name = r.activityName || 'İsimsiz Rapor';
                    const hasTheme = name.toUpperCase().includes(`(${themeText})`) || name.toUpperCase().includes(themeText);
                    
                    if (!hasTheme) {
                        themeDisplay = ` (${themeText})`;
                    }
                }
            }
            
            title.innerHTML = `<span>${r.activityName || 'İsimsiz Rapor'}${themeDisplay}</span>`;
            if (r.fillerName) {
                title.innerHTML += `<span style="font-size:0.75rem; background:#ecfdf5; color:#10b981; padding:2px 8px; border-radius:12px; font-weight:600; border:1px solid #a7f3d0;"><i class="fas fa-pencil-alt" style="margin-right:4px;"></i>${formatNameTR(r.fillerName)}</span>`;
            }

            const badge = document.createElement('span');
            const statusStr = (r.status || 'Tamamlandı');
            const cleanStatus = statusStr.toLowerCase().replace('ü','u').replace('ö','o').replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g');
            const badgeType = cleanStatus === 'iptal' ? 'iptal' : (cleanStatus === 'güncellendi' ? 'guncellendi' : 'tamamlandi');
            badge.className = `status-badge status-${badgeType}`;
            badge.textContent = statusStr;

            header.appendChild(title);
            header.appendChild(badge);

            const teacher = document.createElement('p');
            teacher.style.cssText = 'margin:0; font-size:0.85rem; color:#64748b;';
            teacher.textContent = r.teacher ? formatNameTR(r.teacher) : '';

            info.appendChild(header);
            info.appendChild(teacher);

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex; gap:10px;';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn-secondary';
            editBtn.style.cssText = 'font-size:0.8rem; padding:0.5rem 1rem;';
            editBtn.textContent = 'Formda Göster';
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.editRecord(r);
            });

            const printBtn = document.createElement('button');
            printBtn.type = 'button';
            printBtn.className = 'btn-primary';
            printBtn.style.cssText = 'font-size:0.8rem; padding:0.5rem 1rem;';
            printBtn.textContent = 'Yazdır';
            printBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.printRecord(r);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-secondary';
            deleteBtn.style.cssText = 'font-size:0.8rem; padding:0.5rem 1rem; color: #ef4444; border-color: #ef4444;';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Sil';
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.deleteRecord(r);
            });

            actions.appendChild(editBtn);
            actions.appendChild(printBtn);
            actions.appendChild(deleteBtn);

            card.appendChild(info);
            card.appendChild(actions);
            listContainer.appendChild(card);
        });
}

async function archiveSelectedReports(shouldArchive) {
    const listId = isArchiveView ? 'archived-list' : 'reports-list';
    const checkboxes = document.querySelectorAll(`#${listId} .report-checkbox:checked`);
    if (checkboxes.length === 0) {
        alert('Lütfen en az bir rapor seçin.');
        return;
    }

    const pw = prompt(`${shouldArchive ? 'Arşivleme' : 'Arşivden çıkarma'} işlemi için şifreyi giriniz:`);
    if (pw === null) return;
    if (pw !== '1234') {
        alert('Hatalı şifre!');
        return;
    }

    const msg = shouldArchive ? `${checkboxes.length} rapor arşivlenecek. Emin misiniz?` : `${checkboxes.length} rapor arşivden çıkarılacak. Emin misiniz?`;
    if (!confirm(msg)) return;

    let successCount = 0;
    for (const cb of checkboxes) {
        const id = cb.value;
        try {
            await db.collection(STORE_NAME).doc(id).update({
                isArchived: shouldArchive
            });
            successCount++;
        } catch (err) {
            console.error(`Error ${shouldArchive ? 'archiving' : 'unarchiving'} report ${id}:`, err);
        }
    }

    alert(`✅ ${successCount} rapor başarıyla ${shouldArchive ? 'arşivlendi' : 'arşivden çıkarıldı'}.`);
    loadReports();
}



function parseDBDate(s) { 
    if (!s || s.indexOf('.') === -1) return null;
    const p = s.split('.'); return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
}

function getCheckboxValues(name, otherCheckId, otherTextId) {
    const cbs = document.querySelectorAll(`input[name="${name}"]:checked`);
    let vals = Array.from(cbs).map(c => c.value);
    const oc = document.getElementById(otherCheckId);
    if (oc && oc.checked) { 
        vals = vals.filter(v => v !== 'Diğer'); 
        vals.push(document.getElementById(otherTextId).value); 
    }
    return vals.join(', ');
}

function getYearIndexForReport() {
    const eduYearVal = document.getElementById('edu-year').value;
    if (!eduYearVal) return 1;
    const startYear = parseInt(eduYearVal.split('-')[0].trim());
    const index = (startYear - 2025) + 1; // 2025 -> 1, 2026 -> 2...
    return (index >= 1 && index <= 4) ? index : 1;
}

function checkUnreportedActivities() {
    if (!combinedData) { alert('Veri henüz yüklenmedi.'); return; }
    const statusRadio = document.querySelector('input[name="activity-status"]:checked');
    const typeRadio = document.querySelector('input[name="project-type"]:checked');
    if (!statusRadio || !typeRadio) return;
    
    const statusVal = statusRadio.value;
    const typeVal = typeRadio.value;
    const isOG = typeVal === 'OKUL GELİŞİM PROJESİ';
    const today = new Date(); today.setHours(0,0,0,0);
    const yearIdx = getYearIndexForReport();
    
    // Filtreleme için sorumlu öğretmen bilgisini al
    const respInputVal = document.getElementById('responsible-teacher').value.trim();
    const filterNames = respInputVal.split(',').map(n => n.trim().toLocaleLowerCase('tr')).filter(n => n.length >= 3);

    let list = isOG ? combinedData.og_db : combinedData.oo_db;
    let results = [];
    const seenNames = new Set();

    const eduYearVal = document.getElementById('edu-year').value;
    list.forEach(item => {
        // Eğer filtre varsa, sorumlu bu isimlerden birini içeriyor mu kontrol et
        if (filterNames.length > 0) {
            const itemSorumlu = (isOG ? item.sorumlu : item.sorumlu_verisi) || "";
            const itemT = itemSorumlu.toLocaleLowerCase('tr');
            const match = filterNames.some(f => itemT.includes(f));
            if (!match) return;
        }

        const nameText = (isOG ? item.eylem_adi : item.eylem_gorev) || "";

        const normName = normalizeString(nameText);
        if (!normName) return;
        
        const itemId = isOG ? `og-${item.no}` : `oo-${item.sira}`;
        // Sadece İLGİLİ TÜR ve YIL için kontrol et, id varsa id ile yoksa isimle eşleştir.
        const isReported = savedReportsCache.some(r => {
            if (r.projectType !== typeVal || r.eduYear !== eduYearVal) return false;
            if (r.planId && r.planId === itemId) return true;
            return normalizeString(r.activityName) === normName;
        });
        
        if (isReported) return;

        // Dynamic date lookup based on year index
        const dStr = isOG ? (item[`y${yearIdx}_bit`] || item[`y${yearIdx}_bas`]) : (item[`bitis_${yearIdx}`] || item[`baslangic_${yearIdx}`]);
        const dt = parseDBDate(dStr);
        
        if (dt) {
            const d = new Date(dt);
            if (statusVal === 'expired' ? d < today : d >= today) {
                if (!seenNames.has(normName)) {
                    seenNames.add(normName);
                    results.push({ 
                        id: isOG ? `og-${item.no}` : `oo-${item.sira}`, 
                        name: (isOG && item.tema) ? `${nameText.trim()} (TEMA ${item.tema})` : nameText.trim(), 
                        eduYear: document.getElementById('edu-year').value,
                        start: isOG ? item[`y${yearIdx}_bas`] : item[`baslangic_${yearIdx}`], 
                        end: isOG ? item[`y${yearIdx}_bit`] : item[`bitis_${yearIdx}`], 
                        person: isOG ? item.sorumlu : item.sorumlu_verisi, 
                        type: typeVal, 
                        isReported: false, 
                        status: null 
                    });
                }
            }
        }
    });

    if (results.length > 0) {
        currentModalTasks = results;
        currentModalTitle = 'Hiç Rapor Girilmemiş Faaliyetler';
        showStatusModal(currentModalTitle, results);
    }
    else alert('Kriterlere uygun raporlanmamış faaliyet bulunamadı.');
}

// Utility for extremely robust string comparison (ignoring case, spaces, and special Turkish differences)
function normalizeString(s) {
    if (!s) return "";
    let str = s.toString().trim().toLocaleLowerCase('tr-TR');
    str = str.replace(/tekrarlayan\s*eylem.*?$/g, ''); // Strip 'tekrarlayan eylem' and anything after it
    return str
        .replace(/\s+/g, '') // Remove ALL spaces
        .replace(/[^a-z0-9ğüşıioöç]/g, ''); // Remove non-alphanumeric
}

function checkReportedActivities() {
    if (!combinedData) { alert('Veri henüz yüklenmedi.'); return; }
    const statusRadio = document.querySelector('input[name="activity-status"]:checked');
    const typeRadio = document.querySelector('input[name="project-type"]:checked');
    if (!statusRadio || !typeRadio) return;

    const statusVal = statusRadio.value;
    const typeVal = typeRadio.value;
    const isOG = typeVal === 'OKUL GELİŞİM PROJESİ';
    const today = new Date(); today.setHours(0,0,0,0);
    const yearIdx = getYearIndexForReport();

    // Filtreleme için sorumlu öğretmen bilgisini al
    const respInputVal = document.getElementById('responsible-teacher').value.trim();
    const filterNames = respInputVal.split(',').map(n => n.trim().toLocaleLowerCase('tr')).filter(n => n.length >= 3);

    let planList = isOG ? combinedData.og_db : combinedData.oo_db;
    let results = [];


    // --- REPORT-CENTRIC LOGIC ---
    const uniqueReports = [];
    const seenKeys = new Set();
    savedReportsCache.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(r => {
        const dupKey = r.timestamp ? `${r.timestamp}` : `${r.activityName}_${r.fillerName}`;
        if (!seenKeys.has(dupKey)) {
            seenKeys.add(dupKey);
            uniqueReports.push(r);
        }
    });

    uniqueReports.forEach(report => {
        if (report.projectType !== typeVal) return;

        // Öğretmen filtresi
        if (filterNames.length > 0) {
            const reportT = (report.teacher || "").toLocaleLowerCase('tr');
            const match = filterNames.some(f => reportT.includes(f));
            if (!match) return;
        }

        const normReportName = normalizeString(report.activityName);

        const planItem = planList.find(p => {
            const itemId = isOG ? `og-${p.no}` : `oo-${p.sira}`;
            if (report.planId && report.planId === itemId) return true;
            const planName = (isOG ? p.eylem_adi : p.eylem_gorev) || "";
            return normalizeString(planName) === normReportName;
        });

        const currentEduYear = document.getElementById('edu-year').value;
        const isCurrentYear = report.eduYear === currentEduYear;
        let showItem = true;
        let planDates = "";

        // Only apply date filtering (Expired/Ongoing) for the CURRENT year
        if (isCurrentYear && planItem) {
            const dStr = isOG ? (planItem[`y${yearIdx}_bit`] || planItem[`y${yearIdx}_bas`]) : (planItem[`bitis_${yearIdx}`] || planItem[`baslangic_${yearIdx}`]);
            const dt = parseDBDate(dStr);
            if (dt) {
                const d = new Date(dt);
                if (statusVal === 'expired' && d >= today) showItem = false;
                if (statusVal === 'ongoing' && d < today) showItem = false;
                planDates = `${isOG ? planItem[`y${yearIdx}_bas`] : planItem[`baslangic_${yearIdx}`]} — ${isOG ? planItem[`y${yearIdx}_bit`] : planItem[`bitis_${yearIdx}`]}`;
            }
        }

        if (showItem) {
            results.push({ 
                id: planItem ? (isOG ? `og-${planItem.no}` : `oo-${planItem.sira}`) : 'manual', 
                name: (isOG && planItem && planItem.tema) ? `${(report.activityName || 'İsimsiz Rapor')} (TEMA ${planItem.tema})` : (report.activityName || 'İsimsiz Rapor'), 
                eduYear: report.eduYear || 'Bilinmiyor',
                start: report.startDate || (planDates ? planDates.split('—')[0].trim() : ''), 
                end: report.endDate || (planDates ? planDates.split('—')[1].trim() : ''), 
                person: report.teacher || (planItem ? (isOG ? planItem.sorumlu : planItem.sorumlu_verisi) : ''), 
                filler: report.fillerName, 
                isReported: true, 
                status: report.status,
                isManual: !planItem || !isCurrentYear
            });
        }
    });

    if (results.length > 0) {
        currentModalTasks = results;
        currentModalTitle = `Raporu Girilmiş ${typeVal === 'OKUL GELİŞİM PROJESİ' ? 'Gelişim' : 'Özel'} Faaliyetler`;
        showStatusModal(currentModalTitle, results);
    }
    else alert('Seçili türde ve kriterlerde raporlanmış faaliyet bulunamadı.');
}

// --- HELPERS & IGNORE LOGIC ---
function getReportStatusBadge(status) {
    const s = (status || 'Tamamlandı').toString();
    const clean = s.toLowerCase().replace('ü','u').replace('ö','o').replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g');
    const type = (clean === 'iptal') ? 'iptal' : (clean === 'güncellendi' ? 'guncellendi' : 'tamamlandi');
    return `<span class="status-badge status-${type}" style="padding: 1px 6px; font-size: 0.65rem;">${s}</span>`;
}

window.restoreIgnoredTasks = function() {
    if (confirm("Daha önce 'Listeden Kaldır' diyerek gizlediğiniz tüm faaliyetler tablolara geri getirilecektir. Onaylıyor musunuz?")) {
        localStorage.removeItem('pfds_ignored_tasks');
        checkOverdueActivities();
    }
};

function getIgnoredTasks() { 
    try {
        let v = JSON.parse(localStorage.getItem('pfds_ignored_tasks'));
        if (!Array.isArray(v)) v = [];
        return v;
    } catch(e) { return []; } 
}
function ignoreTask(person, taskId) {
    const ignored = getIgnoredTasks();
    if (!ignored.includes(taskId)) {
        ignored.push(taskId);
        localStorage.setItem('pfds_ignored_tasks', JSON.stringify(ignored));
    }
}
function isTaskIgnored(person, taskId) {
    const ignored = getIgnoredTasks();
    return ignored.includes(taskId);
}

function showStatusModal(title, tasks) {
    const list = document.getElementById('overdue-list');
    list.innerHTML = '';
    const modal = document.getElementById('overdue-modal');
    modal.querySelector('.modal-header h3').innerHTML = `<i class="fas fa-list"></i> ${title} (${tasks.length})`;
    
    tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = t.isReported ? 'overdue-item reported-item' : 'overdue-item';
        li.title = 'CTRL+Tık: Lider Ekle/Gör';
        
        let statusBadge = '';
        if (t.isReported) {
            const badge = getReportStatusBadge(t.status);
            statusBadge = `<div style="margin-top:4px;">${badge}</div>`;
        }
        const leaderBadgeHtml = buildLeaderBadgeRow(t.id);

        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="overdue-name">${t.name}</span>
                    ${t.filler ? `<span style="font-size:0.7rem; background:#ecfdf5; color:#10b981; padding:2px 6px; border-radius:10px; font-weight:600; border:1px solid #a7f3d0;"><i class="fas fa-pencil-alt" style="margin-right:4px;"></i>${formatNameTR(t.filler)}</span>` : ''}
                </div>
                <span style="font-size:0.75rem; background:#f1f5f9; padding:2px 8px; border-radius:12px; color:#64748b; font-weight:600;">${t.eduYear}</span>
            </div>
            <div class="overdue-details">
                <span class="overdue-date"><i class="far fa-calendar-alt"></i> ${t.start} — ${t.end}</span>
                <span class="overdue-person"><i class="fas fa-user"></i> ${formatNameTR(t.person)}</span>
                ${statusBadge}
            </div>
            ${leaderBadgeHtml}
            <div class="task-actions" style="display:flex; gap:10px; margin-top:5px;">
                <button class="btn-secondary btn-action-sm btn-delete" onclick="handleIgnoreTask(event, '${t.person.replace(/'/g, "\\'")}', '${t.id}')">
                    <i class="fas fa-trash-alt"></i> Listeden Kaldır
                </button>
                ${!t.isReported ? `
                    <button class="btn-primary btn-action-sm btn-fill" onclick="fillFromModal('${t.name.replace(/'/g, "\\'")}','${t.person.replace(/'/g, "\\'")}','${t.start}','${t.end}','${t.id}')">Rapor Doldur</button>
                ` : ''}
            </div>
        `;
        list.appendChild(li);
        // Ctrl+tık ile lider yönetimi
        const projType = document.querySelector('input[name="project-type"]:checked') ? document.querySelector('input[name="project-type"]:checked').value : 'OKUL GELİŞİM PROJESİ';
        attachLeaderEvents(li, t.id, projType, t.name);
    });
    modal.style.display = 'flex';
    document.getElementById('modal-print-btn').style.display = 'block';
}

window.handleIgnoreTask = (e, person, tid) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const pw = prompt('Bu eylemi listeden kaldırmak için yetkili şifresini giriniz:');
    if (pw === '321') {
        ignoreTask(person, tid);
        const item = e.target.closest('.overdue-item');
        if (item) item.remove();
        const list = document.getElementById('overdue-list');
        if (list && list.children.length === 0) hideOverdueModal();
    } else if (pw !== null) {
        alert('Hatalı şifre!');
    }
};

window.fillFromModal = (name, person, start, end, tid) => {
    document.getElementById('activity-name').value = name;
    document.getElementById('responsible-teacher').value = person + ', ';
    document.getElementById('activity-start').value = parseDBDate(start);
    document.getElementById('activity-end').value = parseDBDate(end);
    if (tid) {
        const planIdObj = document.getElementById('plan-id');
        if (planIdObj) planIdObj.value = tid;
    }
    hideOverdueModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll('input, textarea').forEach(updateFilledState);
};

function debounce(f, w) { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>f(...a), w); }; }
const debounceAudit = debounce(checkOverdueActivities, 1000);
function formatDateRange(s, e) { return `${s ? new Date(s).toLocaleDateString('tr-TR') : ''} - ${e ? new Date(e).toLocaleDateString('tr-TR') : ''}`; }

// --- PASSWORD UTILITIES ---
function hashPassword(pw) {
    // Simple but consistent deterministic hash (not crypto-safe, sufficient for this use-case)
    if (!pw) return '';
    let h = 0x811c9dc5;
    for (let i = 0; i < pw.length; i++) {
        h ^= pw.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
}

function _showPwModal({ title, desc, btnLabel, onConfirm }) {
    const modal = document.getElementById('password-modal');
    const pwInput = document.getElementById('pw-modal-input');
    const confirmBtn = document.getElementById('pw-modal-confirm');
    const cancelBtn = document.getElementById('pw-modal-cancel');
    const closeBtn = document.getElementById('pw-modal-close');

    document.getElementById('pw-modal-title').textContent = title;
    document.getElementById('pw-modal-desc').textContent = desc;
    document.getElementById('pw-modal-btn-label').textContent = btnLabel;
    pwInput.value = '';
    pwInput.setAttribute('readonly', 'readonly');
    modal.style.display = 'flex';
    setTimeout(() => {
        pwInput.removeAttribute('readonly');
        pwInput.focus();
    }, 100);

    const cleanup = () => { modal.style.display = 'none'; };

    // Remove old listeners by cloning
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);

    document.getElementById('pw-modal-confirm').onclick = () => {
        const val = document.getElementById('pw-modal-input').value.trim();
        cleanup();
        onConfirm(val);
    };
    document.getElementById('pw-modal-cancel').onclick = () => { cleanup(); onConfirm(null); };
    document.getElementById('pw-modal-close').onclick = () => { cleanup(); onConfirm(null); };

    // Enter key
    const keyHandler = (e) => {
        if (e.key === 'Enter') {
            document.getElementById('pw-modal-confirm').click();
            document.getElementById('pw-modal-input').removeEventListener('keydown', keyHandler);
        }
    };
    document.getElementById('pw-modal-input').addEventListener('keydown', keyHandler);
}

function promptSavePassword(onConfirm) {
    _showPwModal({
        title: 'Kayıt Şifresi Belirle',
        desc: 'Bu raporu korumak için bir şifre belirleyin. Raporu daha sonra düzenlemek istediğinizde bu şifre sorulacaktır. (Boş bırakırsanız şifre uygulanmaz.)',
        btnLabel: 'Şifreyi Kaydet',
        onConfirm
    });
}

function promptVerifyPassword(onConfirm) {
    _showPwModal({
        title: 'Rapor Şifresi',
        desc: 'Bu rapor şifre korumalıdır. Lütfen kayıt şifresini girin. (Yetkili için master şifre geçerlidir.)',
        btnLabel: 'Doğrula & Yükle',
        onConfirm
    });
}

window.deleteRecord = function(data) {
    if (!data || !data.id) return;
    
    promptVerifyPassword((enteredPw) => {
        if (enteredPw === null) return; // User cancelled
        
        const isMaster = enteredPw === '21012012';
        const isCorrectHash = data.passwordHash && hashPassword(enteredPw) === data.passwordHash;
        const isEmptyPasswordHash = !data.passwordHash || data.passwordHash === hashPassword('');
        
        // Always require password. If record has an empty password, either enter empty or master.
        if (isMaster || isCorrectHash || (isEmptyPasswordHash && enteredPw === '')) {
            if (confirm(`'${data.activityName || "İsimsiz Rapor"}' kalıcı olarak silinecek. Onaylıyor musunuz?`)) {
                _executeDelete(data);
            }
        } else {
            alert("Hatalı şifre! Kayıt silinemedi. Yetkili değilseniz master şifreyi girmelisiniz.");
        }
    });
};

function _executeDelete(data) {
    if (!db) {
        alert("Veritabanı bağlantısı yok.");
        return;
    }
    db.collection(STORE_NAME).doc(data.id).delete().then(() => {
        // syncSavedReportsCache array automatic sync via onSnapshot will handle cache removal
        if (currentRecordId === data.id) {
            clearAllForm();
        }
        alert("Kayıt başarıyla silindi.");
    }).catch((e) => {
        console.error("Delete failed:", e);
        alert("Silme işlemi başarısız oldu.");
    });
}

// =============================================
// FAAALİYET LİDERİ — GLOBAL FONKSİYONLAR
// =============================================

// Firebase'den lider verisini dinle ve cache'e al
function syncLeadersCache() {
    if (!db) { setTimeout(syncLeadersCache, 500); return; }
    db.collection(LEADER_STORE).onSnapshot((snapshot) => {
        activityLeadersCache.clear();
        snapshot.forEach((doc) => {
            const d = doc.data();
            activityLeadersCache.set(doc.id, d.leaders || []);
        });
        console.log(`Leader cache updated: ${activityLeadersCache.size} entries.`);
    });
}

async function syncRegisteredLeadersCache() {
    try {
        const res = await fetch("https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_users.json");
        if (res.ok) {
            const usersData = await res.json();
            const uniqueNames = new Set();
            if (usersData && typeof usersData === 'object') {
                Object.values(usersData).forEach(u => {
                    if (u && u.name && typeof u.name === 'string' && u.name.trim()) {
                        const role = (u.role || '').toLowerCase().trim();
                        const isAdmin = role === 'admin' || role === 'master' || role === 'idareci' || u.isAdmin === true;
                        if (!isAdmin) {
                            const formatted = formatNameTR(u.name.trim());
                            if (formatted) uniqueNames.add(formatted);
                        }
                    }
                });
            }
            if (uniqueNames.size > 0) {
                registeredLeadersCache = Array.from(uniqueNames).sort((a, b) => a.localeCompare(b, 'tr'));
                console.log(`Registered leaders cache updated from Dashboard RTDB: ${registeredLeadersCache.length} names.`);
                populateRegisteredLeadersDropdown();
                renderGlobalLeadersList();
                return;
            }
        }
    } catch (e) {
        console.warn("Dashboard RTDB öğretmen verisi alınamadı, Firestore deneniyor:", e);
    }

    if (!db) { setTimeout(syncRegisteredLeadersCache, 500); return; }
    db.collection(REGISTERED_LEADERS_STORE).onSnapshot((snapshot) => {
        const uniqueNames = new Set();
        snapshot.forEach((doc) => {
            const n = doc.data().name;
            if (n) uniqueNames.add(formatNameTR(n));
        });
        registeredLeadersCache = Array.from(uniqueNames).sort((a, b) => a.localeCompare(b, 'tr'));
        console.log(`Registered leaders cache updated: ${registeredLeadersCache.length} names.`);
        populateRegisteredLeadersDropdown();
        renderGlobalLeadersList();
    });
}

function renderGlobalLeadersList() {
    const ul = document.getElementById('glm-leaders-list');
    if (!ul) return;
    ul.innerHTML = '';
    
    // Havuzdaki isimler + Faaliyetlerdeki isimleri göster (havuzda olmayanları işaretle)
    const activeInActivities = new Set();
    activityLeadersCache.forEach(names => names.forEach(n => {
        if (n) activeInActivities.add(formatNameTR(n));
    }));
    
    const allNames = new Set([...registeredLeadersCache, ...activeInActivities]);
    const sortedNames = Array.from(allNames).sort((a, b) => a.localeCompare(b, 'tr'));

    if (sortedNames.length === 0) {
        ul.innerHTML = '<div class="lm-empty">Henüz kayıtlı veya aktif lider bulunmuyor.</div>';
        return;
    }

    sortedNames.forEach((name) => {
        const isRegistered = registeredLeadersCache.includes(name);
        const li = document.createElement('li');
        li.style.opacity = isRegistered ? '1' : '0.7';
        li.innerHTML = `
            <span title="${isRegistered ? 'Kayıtlı Lider' : 'Faaliyetlerde Tanımlı'}">
                <i class="fas ${isRegistered ? 'fa-user-check' : 'fa-user-clock'}" style="color:${isRegistered ? '#fbbf24' : '#94a3b8'}; margin-right:8px;"></i>
                ${name} ${!isRegistered ? '<small style="font-size:0.65rem; color:#94a3b8;">(Kaydedilmemiş)</small>' : ''}
            </span>
            <div style="display:flex; gap:5px;">
                ${!isRegistered ? `<button class="lm-add-btn" style="padding:2px 8px; font-size:0.7rem; background:#6366f1;" onclick="registerExistingLeader('${name.replace(/'/g, "\\\\'")}')">Havuzuna Ekle</button>` : ''}
                <button class="lm-delete-btn" onclick="deleteGlobalLeaderAction('${name.replace(/'/g, "\\\\'")}', ${!isRegistered})"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        ul.appendChild(li);
    });
}

// Havuzda olmayan ama faaliyetlerde geçen bir ismi havuza kaydet
function registerExistingLeader(name) {
    db.collection(REGISTERED_LEADERS_STORE).doc(name).set({ name: name })
        .then(() => console.log(`${name} havuza eklendi.`))
        .catch(e => alert('Hata: ' + e.message));
}

function populateRegisteredLeadersDropdown() {
    const sel = document.getElementById('lm-registered-select');
    if (!sel) return;
    
    // Hem kayıtlı havuzdan hem de mevcut faaliyetlerden gelen tüm isimleri birleştir
    const combinedSet = new Set(registeredLeadersCache);
    activityLeadersCache.forEach(names => names.forEach(n => {
        if (n) combinedSet.add(formatNameTR(n));
    }));
    
    const sortedNames = Array.from(combinedSet).sort((a, b) => a.localeCompare(b, 'tr'));

    const currentSelection = Array.from(sel.selectedOptions).map(opt => opt.value);
    sel.innerHTML = '';
    sortedNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (currentSelection.includes(name)) opt.selected = true;
        sel.appendChild(opt);
    });
}

function addGlobalLeaderAction() {
    const input = document.getElementById('glm-name-input');
    const rawName = input ? input.value.trim() : '';
    if (!rawName) { alert('Lütfen bir isim girin!'); return; }
    
    const formatted = formatNameTR(rawName);
    if (registeredLeadersCache.includes(formatted)) {
        alert('Bu lider zaten kayıtlı!');
        return;
    }

    const pw = prompt('Lider eklemek için şifreyi girin:');
    if (pw === null) return;
    if (pw !== LEADER_PASSWORD) { alert('❌ Hatalı şifre!'); return; }

    db.collection(REGISTERED_LEADERS_STORE).doc(formatted).set({ name: formatted })
        .then(() => { input.value = ''; })
        .catch(e => alert('Kayıt hatası: ' + e.message));
}

function deleteGlobalLeaderAction(name, onlyCleanup = false) {
    const msg = onlyCleanup 
        ? `"${name}" ismi sadece faaliyetlerde görünüyor. Havuzdan silinecek bir kayıt yok. Faaliyetlerden silmek için ilgili faaliyete gidin.`
        : `"${name}" liderini havuzdan silmek istediğinize emin misiniz? Şifreyi girin:`;
    
    if (onlyCleanup) { alert(msg); return; }

    const pw = prompt(msg);
    if (pw === null) return;
    if (pw !== LEADER_PASSWORD) { alert('❌ Hatalı şifre!'); return; }

    db.collection(REGISTERED_LEADERS_STORE).doc(name).delete()
        .catch(e => alert('Silme hatası: ' + e.message));
}

// Lider badge satırını inşa et
function buildLeaderBadgeRow(planId) {
    const leaders = activityLeadersCache.get(planId) || [];
    if (leaders.length === 0) return '';
    const badges = leaders.map(l => `<span class="leader-badge"><i class="fas fa-crown"></i>${formatNameTR(l)}</span>`).join('');
    return `<div class="leader-badge-row">${badges}</div>`;
}

// CTRL+Tık ile lider yönetimi event'lerini bağla
function attachLeaderEvents(liEl, planId, projectType, taskName) {
    liEl.addEventListener('contextmenu', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            openLeaderModal(planId, projectType, taskName);
        }
    });
    liEl.addEventListener('click', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            openLeaderModal(planId, projectType, taskName);
        }
    });
}

// Lider mini modal aç (hem ekleme hem listeleme)
function openLeaderModal(planId, projectType, taskName) {
    _leaderModalPlanId = planId;
    _leaderModalProjectType = projectType;

    const modal = document.getElementById('leader-modal');
    const title = document.getElementById('lm-title');
    const taskNameEl = document.getElementById('lm-task-name');

    if (title) title.innerHTML = '<i class="fas fa-crown"></i> Faaliyet Lideri Yönetimi';
    if (taskNameEl) taskNameEl.textContent = taskName;

    populateRegisteredLeadersDropdown();
    renderLeaderModalList(planId);

    if (modal) modal.style.display = 'flex';
}

// Lider listesini modal içinde yeniden çiz
function renderLeaderModalList(planId) {
    const ul = document.getElementById('lm-leaders-list');
    if (!ul) return;
    const leaders = activityLeadersCache.get(planId) || [];
    ul.innerHTML = '';

    if (leaders.length === 0) {
        ul.innerHTML = '<div class="lm-empty"><i class="fas fa-user-slash" style="margin-right:6px;"></i>Henüz lider tanımlanmamış.</div>';
        return;
    }

    leaders.forEach((leader, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><i class="fas fa-crown" style="color:#fbbf24; margin-right:6px; font-size:0.75rem;"></i>${leader}</span>
            <button class="lm-delete-btn" data-idx="${idx}"><i class="fas fa-trash-alt"></i> Sil</button>
        `;
        li.querySelector('.lm-delete-btn').onclick = () => deleteLeaderAction(planId, idx, leader);
        ul.appendChild(li);
    });
}

// Lider ekleme işlemi (şifre korumalı)
function _leaderAddAction() {
    const sel = document.getElementById('lm-registered-select');
    if (!sel) return;
    
    const selectedOptions = Array.from(sel.selectedOptions).map(opt => opt.value);
    if (selectedOptions.length === 0) { alert('Lütfen listeden en az bir lider seçin!'); return; }

    const pw = prompt('Liderleri faaliyete atamak için şifreyi girin:');
    if (pw === null) return;
    if (pw !== LEADER_PASSWORD) { alert('❌ Hatalı şifre!'); return; }

    const planId = _leaderModalPlanId;
    const projectType = _leaderModalProjectType;
    if (!planId) return;

    const currentLeaders = new Set(activityLeadersCache.get(planId) || []);
    selectedOptions.forEach(name => currentLeaders.add(name));

    db.collection(LEADER_STORE).doc(planId).set({
        planId,
        projectType,
        leaders: Array.from(currentLeaders)
    }).then(() => {
        sel.selectedIndex = -1; // Deselect all
        renderLeaderModalList(planId);
    }).catch(e => alert('Kayıt hatası: ' + e.message));
}

// Lider silme işlemi (şifre korumalı)
function deleteLeaderAction(planId, idx, leaderName) {
    const pw = prompt(`"${leaderName}" liderini silmek için şifreyi girin:`);
    if (pw === null) return;
    if (pw !== LEADER_PASSWORD) { alert('❌ Hatalı şifre!'); return; }

    const currentLeaders = [...(activityLeadersCache.get(planId) || [])];
    currentLeaders.splice(idx, 1);

    const docRef = db.collection(LEADER_STORE).doc(planId);
    if (currentLeaders.length === 0) {
        docRef.delete().then(() => {
            renderLeaderModalList(planId);
        }).catch(e => alert('Silme hatası: ' + e.message));
    } else {
        docRef.set({ planId, leaders: currentLeaders }, { merge: true }).then(() => {
            renderLeaderModalList(planId);
        }).catch(e => alert('Güncelleme hatası: ' + e.message));
    }
}

// Faaliyet Lideri dropdown'u artık kullanılmıyor, datalist/suggestions yapısına geçildi

// Formu dolduran kişi öneri listesini oluştur (form girişi için)
function renderFillerSuggestions(fragment) {
    const panel = document.getElementById('filler-suggestions-panel');
    if (!panel) return;

    const allNames = new Set();
    activityLeadersCache.forEach(names => names.forEach(n => allNames.add(n)));
    
    const filtered = Array.from(allNames)
        .filter(n => n.toLocaleLowerCase('tr').includes(fragment.toLocaleLowerCase('tr')))
        .sort((a, b) => a.localeCompare(b, 'tr'));

    if (filtered.length === 0) { panel.style.display = 'none'; return; }

    panel.innerHTML = '';
    filtered.slice(0, 20).forEach(name => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<i class="fas fa-crown" style="color: #ffd700;"></i> ${name}`;
        div.onclick = () => {
            const input = document.getElementById('filler-name');
            input.value = name;
            panel.style.display = 'none';
            updateFilledState(input);
        };
        panel.appendChild(div);
    });
    panel.style.display = 'block';
}

// Geçmiş Kayıtlar ve Arşiv bölümlerindeki "Dolduran Kişi" select kutularını doldur
function populateFillerSelects() {
    // normalize key -> formatted display adı (aynı ismin farklı yazılışlarını tek bir girdide birleştir)
    const seen = new Map();
    savedReportsCache.forEach(r => {
        if (r.fillerName && r.fillerName.trim()) {
            const formatted = formatNameTR(r.fillerName.trim());
            if (!formatted) return;
            const key = formatted.toLocaleLowerCase('tr').replace(/\s+/g, ' ');
            if (!seen.has(key)) seen.set(key, formatted);
        }
    });
    const sorted = Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'tr'));

    ['history-filler-select', 'archive-filler-select'].forEach(selectId => {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        const current = sel.value; // Seçili değeri koru
        sel.innerHTML = '<option value="">👤 Tüm Dolduranlar</option>';
        sorted.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; // normalize edilmiş formatı hem değer hem gösterim
            opt.textContent = name;
            sel.appendChild(opt);
        });
        // Önceki seçimi geri yükle (varsa)
        if (current && sorted.includes(current)) sel.value = current;
    });
}

// Faaliyet Lideri filtresi öneri listesini oluştur
function renderLeaderFilterSuggestions(fragment) {
    const panel = document.getElementById('leader-filter-suggestions');
    if (!panel) return;

    const typeRadio = document.querySelector('input[name="project-type"]:checked');
    const typeVal = typeRadio ? typeRadio.value : 'OKUL GELİŞİM PROJESİ';
    const prefix = typeVal === 'OKUL GELİŞİM PROJESİ' ? 'og-' : 'oo-';

    const allLeaders = new Set();
    activityLeadersCache.forEach((leaders, planId) => {
        if (planId.startsWith(prefix)) {
            leaders.forEach(l => {
                if (l) allLeaders.add(formatNameTR(l));
            });
        }
    });

    const filtered = Array.from(allLeaders)
        .filter(n => n.toLocaleLowerCase('tr').includes(fragment.toLocaleLowerCase('tr')))
        .sort((a, b) => a.localeCompare(b, 'tr'));

    if (filtered.length === 0) { panel.style.display = 'none'; return; }

    panel.innerHTML = '';
    filtered.slice(0, 20).forEach(name => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<i class="fas fa-crown" style="color: #ffd700;"></i> ${name}`;
        div.onclick = () => {
            const input = document.getElementById('leader-filter-input');
            input.value = name;
            panel.style.display = 'none';
            checkActivitiesByLeader(name);
        };
        panel.appendChild(div);
    });
    panel.style.display = 'block';
}

// Seçilen liderin faaliyetlerini listele (mevcut proje türü + süresi dolan/devam eden filtresi)
function checkActivitiesByLeader(leaderName) {
    if (!combinedData) { alert('Veri henüz yüklenmedi.'); return; }

    const typeRadio = document.querySelector('input[name="project-type"]:checked');
    const statusRadio = document.querySelector('input[name="activity-status"]:checked');
    const typeVal = typeRadio ? typeRadio.value : 'OKUL GELİŞİM PROJESİ';
    const statusVal = statusRadio ? statusRadio.value : 'expired';
    const isOG = typeVal === 'OKUL GELİŞİM PROJESİ';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yearIdx = getYearIndexForReport();

    // Bu lidere ait planId'leri bul
    const leaderPlanIds = new Set();
    activityLeadersCache.forEach((leaders, planId) => {
        if (leaders.some(l => l.toLowerCase() === leaderName.toLowerCase())) {
            leaderPlanIds.add(planId);
        }
    });

    if (leaderPlanIds.size === 0) {
        alert(`"${leaderName}" adlı lidere atanmış faaliyet bulunamadı.`);
        return;
    }

    const dbSource = isOG ? combinedData.og_db : combinedData.oo_db;
    const results = [];
    const eduYearVal = document.getElementById('edu-year').value;

    dbSource.forEach(item => {
        const itemId = isOG ? `og-${item.no}` : `oo-${item.sira}`;
        if (!leaderPlanIds.has(itemId)) return;

        const dStr = isOG
            ? (item[`y${yearIdx}_bit`] || item[`y${yearIdx}_bas`])
            : (item[`bitis_${yearIdx}`] || item[`baslangic_${yearIdx}`]);
        const dt = parseDBDate(dStr);
        if (!dt) return;

        const d = new Date(dt);
        const isMatch = statusVal === 'expired' ? d < today : d >= today;
        if (!isMatch) return;

        const nameText = isOG ? item.eylem_adi : item.eylem_gorev;
        const normName = normalizeString(nameText);
        const report = savedReportsCache.find(r => {
            if (r.projectType !== typeVal) return false;
            if (r.planId && r.planId === itemId) return true;
            return normalizeString(r.activityName) === normName && r.eduYear === eduYearVal;
        });

        results.push({
            id: itemId,
            name: (isOG && item.tema) ? `${nameText} (TEMA ${item.tema})` : nameText,
            eduYear: eduYearVal,
            start: isOG ? item[`y${yearIdx}_bas`] : item[`baslangic_${yearIdx}`],
            end: isOG ? item[`y${yearIdx}_bit`] : item[`bitis_${yearIdx}`],
            person: isOG ? item.sorumlu : item.sorumlu_verisi,
            isReported: !!report,
            status: report ? report.status : null,
            filler: report ? report.fillerName : null
        });
    });

    if (results.length === 0) {
        alert(`"${leaderName}" liderine ait ${statusVal === 'expired' ? 'süresi dolan' : 'devam eden'} faaliyet bulunamadı.`);
        return;
    }

    currentModalTasks = results;
    currentModalTitle = `${leaderName} — Faaliyet Listesi`;
    showStatusModal(currentModalTitle, results);
}

// Aktif filtreler (printLeaderFullReport icin)
let _almCurrentTypeVal = 'OKUL GELİŞİM PROJESİ';
let _almCurrentStatusVal = 'expired';

// Tüm faaliyet liderlerini özet modal'da göster
function showAllLeadersModal() {
    const typeRadio = document.querySelector('input[name="project-type"]:checked');
    const statusRadio = document.querySelector('input[name="activity-status"]:checked');
    const typeVal = typeRadio ? typeRadio.value : 'OKUL GELİŞİM PROJESİ';
    const statusVal = statusRadio ? statusRadio.value : 'expired';
    _almCurrentTypeVal = typeVal;
    _almCurrentStatusVal = statusVal;
    const statusLabel = statusVal === 'expired' ? 'Süresi Dolan' : 'Devam Eden';
    const typeLabel = typeVal === 'OKUL GELİŞİM PROJESİ' ? 'Okul Gelişim' : 'Okul Özel';

    const modal = document.getElementById('all-leaders-modal');
    const almTitle = document.getElementById('alm-title');
    const almList = document.getElementById('alm-list');
    if (!modal || !almList) return;

    if (almTitle) almTitle.textContent = `Faaliyet Liderleri — ${typeLabel} / ${statusLabel}`;

    // Lider → faaliyet sayısı hesapla
    const leaderCounts = new Map();
    activityLeadersCache.forEach((leaders, planId) => {
        // Proje türü filtresi
        const prefix = typeVal === 'OKUL GELİŞİM PROJESİ' ? 'og-' : 'oo-';
        if (!planId.startsWith(prefix)) return;
        leaders.forEach(l => {
            leaderCounts.set(l, (leaderCounts.get(l) || 0) + 1);
        });
    });

    almList.innerHTML = '';
    if (leaderCounts.size === 0) {
        almList.innerHTML = '<div class="lm-empty" style="text-align:center; color:#64748b; padding:1.5rem;"><i class="fas fa-crown" style="margin-right:8px;"></i>Bu proje türünde lider tanımlanmamış.</div>';
    } else {
        const sorted = Array.from(leaderCounts.entries()).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([leader, count]) => {
            const div = document.createElement('div');
            div.className = 'leader-group-item';
            div.innerHTML = `
                <span class="leader-group-name"><i class="fas fa-crown"></i>${leader}</span>
                <span class="leader-group-count">${count} faaliyet</span>
            `;
            div.onclick = () => {
                modal.style.display = 'none';
                checkActivitiesByLeader(leader);
            };
            almList.appendChild(div);
        });
    }

    modal.style.display = 'flex';
}

// Tüm faaliyet liderleri için detaylı rapor — yeni sekmede aç
function printLeaderFullReport() {
    if (!combinedData) { alert('Veri henüz yüklenmedi.'); return; }

    const typeVal = _almCurrentTypeVal;
    const isOG = typeVal === 'OKUL GELİŞİM PROJESİ';
    const typeLabel = isOG ? 'Okul Gelişim Projesi' : 'Okul Özel Projesi';
    const prefix = isOG ? 'og-' : 'oo-';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yearIdx = getYearIndexForReport();
    const eduYearVal = document.getElementById('edu-year') ? document.getElementById('edu-year').value : '';
    const dbSource = isOG ? combinedData.og_db : combinedData.oo_db;

    const leaderActivities = new Map();

    activityLeadersCache.forEach((leaders, planId) => {
        if (!planId.startsWith(prefix)) return;
        const item = dbSource.find(it => (isOG ? `og-${it.no}` : `oo-${it.sira}`) === planId);
        if (!item) return;

        const dStr = isOG
            ? (item[`y${yearIdx}_bit`] || item[`y${yearIdx}_bas`])
            : (item[`bitis_${yearIdx}`] || item[`baslangic_${yearIdx}`]);
        const dt = parseDBDate(dStr);
        const endDate = dt ? new Date(dt) : null;
        const isExpired = endDate ? endDate < today : false;
        // Filtre yok — süresi dolsun ya da dolmasın tümü listelenir

        const startStr = isOG ? item[`y${yearIdx}_bas`] : item[`baslangic_${yearIdx}`];
        const endStr   = isOG ? item[`y${yearIdx}_bit`] : item[`bitis_${yearIdx}`];
        const nameText = isOG ? item.eylem_adi : item.eylem_gorev;
        const normName = normalizeString(nameText);
        const report = savedReportsCache.find(r => {
            if (r.projectType !== typeVal) return false;
            if (r.planId && r.planId === planId) return true;
            return normalizeString(r.activityName) === normName && r.eduYear === eduYearVal;
        });

        const actInfo = {
            name: (isOG && item.tema) ? `${nameText} (TEMA ${item.tema})` : nameText,
            project: typeLabel,
            start: startStr || '—',
            end: endStr || '—',
            isExpired,
            isReported: !!report,
            status: report ? report.status : null
        };

        leaders.forEach(leader => {
            if (!leaderActivities.has(leader)) leaderActivities.set(leader, []);
            leaderActivities.get(leader).push(actInfo);
        });
    });

    if (leaderActivities.size === 0) {
        alert('Bu filtreler için lider tanımlı faaliyet bulunamadı.');
        return;
    }

    const sortedLeaders = Array.from(leaderActivities.entries()).sort((a, b) => a[0].localeCompare(b[0], 'tr'));
    const totalActs = Array.from(leaderActivities.values()).flat();
    let tableRows = '';
    let rowNo = 0;

    sortedLeaders.forEach(([leader, activities]) => {
        activities.forEach((act, idx) => {
            rowNo++;
            const expColor = act.isExpired ? '#dc2626' : '#059669';
            const expText  = act.isExpired ? 'Süresi Doldu' : 'Devam Ediyor';
            const repColor = act.isReported ? (act.status === 'İptal' ? '#dc2626' : '#059669') : '#6b7280';
            const repText  = act.isReported ? (act.status || 'Tamamlandı') : 'Rapor Yok';
            const ldrCell  = idx === 0
                ? `<td rowspan="${activities.length}" style="vertical-align:middle;text-align:center;padding:10px 8px;border:1px solid #e5e7eb;background:#fefce8;white-space:nowrap;">
                     <span style="display:block;font-size:0.65rem;background:#fbbf24;color:#1e293b;padding:2px 6px;border-radius:10px;margin-bottom:4px;font-weight:700;">👑 LİDER</span>
                     <span style="font-weight:700;color:#b45309;font-size:0.85rem;">${leader}</span>
                   </td>`
                : '';
            tableRows += `
            <tr style="background:${rowNo%2===0?'#f9fafb':'#fff'};">
              ${ldrCell}
              <td style="padding:9px 10px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#1f2937;">${act.name}</td>
              <td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:center;">
                <span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;">${act.project.replace(' Projesi','')}</span>
              </td>
              <td style="padding:9px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:center;color:#374151;white-space:nowrap;">${act.start}</td>
              <td style="padding:9px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:center;color:#374151;white-space:nowrap;">${act.end}</td>
              <td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:center;">
                <span style="background:${expColor}18;color:${expColor};padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;border:1px solid ${expColor}33;">${expText}</span>
              </td>
              <td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:center;">
                <span style="background:${repColor}18;color:${repColor};padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;border:1px solid ${repColor}33;">${repText}</span>
              </td>
            </tr>`;
        });
    });

    const now = new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});

    const html = `<!DOCTYPE html><html lang="tr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Faaliyet Liderleri — ${typeLabel} / Tüm Faaliyetler</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Outfit',sans-serif;background:#f1f5f9;color:#1e293b;padding:28px 18px;}
.wrap{max-width:1120px;margin:0 auto;}
.rh{background:linear-gradient(135deg,#1e293b,#0f172a);color:#fff;border-radius:16px;padding:22px 28px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
.rh h1{font-size:1.3rem;font-weight:700;margin-bottom:5px;}
.rh p{font-size:0.8rem;color:#94a3b8;}
.bdg{display:inline-block;padding:5px 13px;border-radius:18px;font-size:0.78rem;font-weight:700;margin-bottom:5px;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.3);color:#fbbf24;}
.bdg.red{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#fca5a5;}
.bdg.grn{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.3);color:#6ee7b7;}
.abar{display:flex;gap:10px;margin-bottom:16px;}
.bprnt{background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1e293b;border:none;border-radius:10px;padding:10px 22px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:8px;}
.bprnt:hover{transform:translateY(-2px);}
.stats{display:flex;gap:11px;margin-bottom:16px;flex-wrap:wrap;}
.stat{background:#fff;border-radius:10px;padding:11px 16px;border:1px solid #e2e8f0;flex:1;min-width:110px;}
.stat .v{font-size:1.45rem;font-weight:700;color:#fbbf24;}
.stat .l{font-size:0.73rem;color:#64748b;}
.tw{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06);border:1px solid #e2e8f0;}
table{width:100%;border-collapse:collapse;}
thead th{background:#1e293b;color:#f8fafc;padding:12px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-right:1px solid rgba(255,255,255,.1);}
thead th:last-child{border-right:none;}
tbody tr:hover{background:#fffbeb!important;}
.foot{text-align:center;color:#94a3b8;font-size:0.7rem;margin-top:10px;}
@media print{
  body{background:#fff;padding:2mm;}
  .abar{display:none!important;}
  .wrap{max-width:100%;}
  .rh,.tw{border-radius:0;}
  .tw{box-shadow:none;}
  @page{margin:5mm;size:A4 landscape;}
}
</style></head><body>
<div class="wrap">
  <div class="rh">
    <div>
      <h1>👑 Faaliyet Liderleri Raporu</h1>
      <p>${currentSchoolName} &nbsp;|&nbsp; ${eduYearVal} Eğitim Öğretim Yılı &nbsp;|&nbsp; ${now}</p>
    </div>
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
      <span class="bdg">${typeLabel}</span>
      <span class="bdg grn">Tüm Faaliyetler</span>
    </div>
  </div>
  <div class="abar">
    <button class="bprnt" onclick="window.print()">🖨️ Yazdır / PDF</button>
  </div>
  <div class="stats">
    <div class="stat"><div class="v">${sortedLeaders.length}</div><div class="l">Faaliyet Lideri</div></div>
    <div class="stat"><div class="v">${rowNo}</div><div class="l">Toplam Faaliyet</div></div>
    <div class="stat"><div class="v" style="color:#dc2626;">${totalActs.filter(a=>a.isExpired).length}</div><div class="l">Süresi Dolan</div></div>
    <div class="stat"><div class="v" style="color:#059669;">${totalActs.filter(a=>!a.isExpired).length}</div><div class="l">Devam Eden</div></div>
    <div class="stat"><div class="v" style="color:#059669;">${totalActs.filter(a=>a.isReported).length}</div><div class="l">Raporu Dolu</div></div>
    <div class="stat"><div class="v" style="color:#6b7280;">${totalActs.filter(a=>!a.isReported).length}</div><div class="l">Rapor Yok</div></div>
  </div>
  <div class="tw">
    <table>
      <thead><tr>
        <th style="width:155px;">Faaliyet Lideri</th>
        <th>Faaliyet Adı</th>
        <th style="width:95px;text-align:center;">Proje</th>
        <th style="width:88px;text-align:center;">Başlangıç</th>
        <th style="width:88px;text-align:center;">Bitiş</th>
        <th style="width:115px;text-align:center;">Süre Durumu</th>
        <th style="width:110px;text-align:center;">Rapor</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div class="foot">PFDS — Proje Faaliyeti Değerlendirme ve Raporlama Sistemi</div>
</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up engelleyiciyi kapatın!'); return; }
    win.document.write(html);
    win.document.close();
}

// Seçili kategoride lider atanmamış faaliyetleri listele — yeni sekmede aç
function printNoLeaderReport() {
    if (!combinedData) { alert('Veri henüz yüklenmedi.'); return; }

    const typeVal = _almCurrentTypeVal;
    const isOG = typeVal === 'OKUL GELİŞİM PROJESİ';
    const typeLabel = isOG ? 'Okul Gelişim Projesi' : 'Okul Özel Projesi';
    const prefix = isOG ? 'og-' : 'oo-';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yearIdx = getYearIndexForReport();
    const eduYearVal = document.getElementById('edu-year') ? document.getElementById('edu-year').value : '';
    const dbSource = isOG ? combinedData.og_db : combinedData.oo_db;

    const noLeaderActivities = [];

    dbSource.forEach(item => {
        const planId = isOG ? `og-${item.no}` : `oo-${item.sira}`;
        const leaders = activityLeadersCache.get(planId) || [];
        
        if (leaders.length === 0) {
            const dStr = isOG
                ? (item[`y${yearIdx}_bit`] || item[`y${yearIdx}_bas`])
                : (item[`bitis_${yearIdx}`] || item[`baslangic_${yearIdx}`]);
            const dt = parseDBDate(dStr);
            const endDate = dt ? new Date(dt) : null;
            const isExpired = endDate ? endDate < today : false;

            const startStr = isOG ? item[`y${yearIdx}_bas`] : item[`baslangic_${yearIdx}`];
            const endStr   = isOG ? item[`y${yearIdx}_bit`] : item[`bitis_${yearIdx}`];
            const nameText = isOG ? item.eylem_adi : item.eylem_gorev;
            const normName = normalizeString(nameText);
            
            const report = savedReportsCache.find(r => {
                if (r.projectType !== typeVal) return false;
                if (r.planId && r.planId === planId) return true;
                return normalizeString(r.activityName) === normName && r.eduYear === eduYearVal;
            });

            noLeaderActivities.push({
                planId: planId,
                name: (isOG && item.tema) ? `${nameText} (TEMA ${item.tema})` : nameText,
                start: startStr || '—',
                end: endStr || '—',
                person: isOG ? item.sorumlu : item.sorumlu_verisi,
                isExpired,
                isReported: !!report,
                status: report ? report.status : null
            });
        }
    });

    if (noLeaderActivities.length === 0) {
        alert('Bu kategoride lider atanmamış faaliyet bulunamadı. Harika!');
        return;
    }

    let tableRows = '';
    noLeaderActivities.forEach((act, idx) => {
        const expColor = act.isExpired ? '#dc2626' : '#059669';
        const expText  = act.isExpired ? 'Süresi Doldu' : 'Devam Ediyor';
        const repColor = act.isReported ? (act.status === 'İptal' ? '#dc2626' : '#059669') : '#6b7280';
        const repText  = act.isReported ? (act.status || 'Tamamlandı') : 'Rapor Yok';
        
        tableRows += `
        <tr style="background:${idx%2===0?'#f9fafb':'#fff'};">
            <td style="padding:10px; border:1px solid #e5e7eb; font-size:0.8rem; font-weight:600; color:#374151; white-space:nowrap; text-align:center;">
                ${act.planId.split('-')[1]}
            </td>
            <td style="padding:10px; border:1px solid #e5e7eb; font-size:0.85rem; font-weight:600; color:#1e293b;">
                ${act.name}
                <div style="font-size:0.75rem; color:#64748b; font-weight:400; margin-top:4px;">Sorumlu: ${act.person || '—'}</div>
            </td>
            <td style="padding:10px; border:1px solid #e5e7eb; font-size:0.8rem; color:#4b5563; text-align:center; white-space:nowrap;">
                ${act.start} — ${act.end}<br>
                <span style="display:inline-block; margin-top:4px; font-size:0.7rem; color:${expColor}; font-weight:700; background:${act.isExpired?'#fee2e2':'#d1fae5'}; padding:2px 6px; border-radius:10px;">${expText}</span>
            </td>
            <td style="padding:10px; border:1px solid #e5e7eb; font-size:0.8rem; font-weight:700; color:${repColor}; text-align:center; white-space:nowrap;">
                <span style="background:${repColor}18;color:${repColor};padding:3px 9px;border-radius:10px;border:1px solid ${repColor}33;">${repText}</span>
            </td>
        </tr>`;
    });

    const now = new Date().toLocaleString('tr-TR');
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Lidersiz Faaliyetler — ${typeLabel}</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                *{box-sizing:border-box;margin:0;padding:0;}
                body{font-family:'Outfit',sans-serif;background:#f1f5f9;color:#1e293b;padding:28px 18px;}
                .wrap{max-width:1000px;margin:0 auto;}
                .rh{background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;border-radius:16px;padding:22px 28px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
                .rh h1{font-size:1.3rem;font-weight:700;margin-bottom:5px;}
                .rh p{font-size:0.8rem;color:#fca5a5;}
                .bdg{display:inline-block;padding:5px 13px;border-radius:18px;font-size:0.78rem;font-weight:700;margin-bottom:5px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;}
                .abar{display:flex;gap:10px;margin-bottom:16px;}
                .bprnt{background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1e293b;border:none;border-radius:10px;padding:10px 22px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;gap:8px;}
                .bprnt:hover{transform:translateY(-2px);}
                .tw{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06);border:1px solid #e2e8f0;}
                table{width:100%;border-collapse:collapse;}
                thead th{background:#1e293b;color:#f8fafc;padding:12px 10px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-right:1px solid rgba(255,255,255,.1);}
                thead th:nth-child(2){text-align:left;}
                thead th:last-child{border-right:none;}
                tbody tr:hover{background:#fffbeb!important;}
                .foot{text-align:center;color:#94a3b8;font-size:0.7rem;margin-top:10px;}
                @media print{
                    body{background:#fff;padding:2mm;}
                    .abar{display:none!important;}
                    .wrap{max-width:100%;}
                    .rh,.tw{border-radius:0;}
                    .tw{box-shadow:none;}
                    @page{margin:5mm;size:A4 portrait;}
                }
            </style>
        </head>
        <body>
            <div class="wrap">
                <div class="rh">
                    <div>
                        <h1>⚠️ Lider Atanmamış Faaliyetler Listesi</h1>
                        <p>${currentSchoolName} &nbsp;|&nbsp; ${eduYearVal} Eğitim Öğretim Yılı &nbsp;|&nbsp; ${now}</p>
                    </div>
                    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
                        <span class="bdg">${typeLabel}</span>
                        <span class="bdg" style="background:rgba(239,68,68,0.3); border-color:#fca5a5;">${noLeaderActivities.length} Kayıt</span>
                    </div>
                </div>
                <div class="abar">
                    <button class="bprnt" onclick="window.print()">🖨️ Yazdır / PDF</button>
                </div>
                <div class="tw">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:60px;">No</th>
                                <th>Faaliyet Adı / Sorumlu Grubu</th>
                                <th style="width:180px;">Tarih / Süreç</th>
                                <th style="width:120px;">Rapor Durumu</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <div class="foot">PFDS — Proje Faaliyeti Değerlendirme ve Raporlama Sistemi</div>
            </div>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up engelleyiciyi kapatın!'); return; }
    win.document.write(htmlContent);
    win.document.close();
}

function autoSelectTheme() {
    // TEMA kutusu kaldırıldığı için bu fonksiyon artık işlevsizdir.
}

// --- AYARLAR VE OKUL ADI LOGIC ---

function syncSettings() {
    if (!db) { setTimeout(syncSettings, 500); return; }
    db.collection(SETTINGS_STORE).doc('general').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.schoolName) {
                currentSchoolName = data.schoolName;
                updateSchoolNameUI();
            }
        }
    });
}

function updateSchoolNameUI() {
    const header = document.getElementById('school-name-header');
    if (header) {
        header.textContent = `${currentSchoolName} | Veri Giriş Portalı`;
    }
}

function openSchoolNameModal() {
    const modal = document.getElementById('school-name-modal');
    const input = document.getElementById('snm-input');
    if (input) input.value = currentSchoolName;
    if (modal) modal.style.display = 'flex';
    setTimeout(() => { if (input) input.focus(); }, 150);
}

function updateSchoolNameAction() {
    const input = document.getElementById('snm-input');
    const newName = input ? input.value.trim() : '';
    if (!newName) { alert('Lütfen bir okul adı girin!'); return; }

    const pw = prompt('Okul adını değiştirmek için şifreyi girin:');
    if (pw === null) return;
    if (pw !== LEADER_PASSWORD) { alert('❌ Hatalı şifre!'); return; }

    db.collection(SETTINGS_STORE).doc('general').set({ schoolName: newName }, { merge: true })
        .then(() => {
            const modal = document.getElementById('school-name-modal');
            if (modal) modal.style.display = 'none';
        })
        .catch(e => alert('Hata: ' + e.message));
}

