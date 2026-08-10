const FIREBASE_DB_URL_SRH = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
let srhApplications = {};

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const isLoggedIn = sessionStorage.getItem('klbk_isLoggedIn') === 'true' || localStorage.getItem('klbk_isLoggedIn') === 'true';
    
    if (isLoggedIn) {
        const role = (sessionStorage.getItem('klbk_role') || localStorage.getItem('klbk_role') || '').toLowerCase().trim();
        const isAdmin = role === 'admin' || role === 'master' || role === 'idareci' || role === 'mudur' || role === 'mudur_basyardimcisi' || role === 'mudur_yardimcisi';
        
        if (!isAdmin) {
            Swal.fire({
                icon: 'error',
                title: 'Yetkisiz Erişim',
                text: 'Bu sayfaya sadece idareciler erişebilir.'
            }).then(() => {
                window.location.href = 'enter.html';
            });
            return;
        }

        document.getElementById('portalSection').style.display = 'block';
        const userName = sessionStorage.getItem('klbk_name') || localStorage.getItem('klbk_name') || 'Kullanıcı';
        document.getElementById('portalUserName').innerText = userName;

        // Load data
        loadApplications();
    } else {
        document.getElementById('loginSection').style.display = 'flex';
    }
});

async function loadApplications() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL_SRH}/app_store/srh_data.json?_=${Date.now()}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (res.ok) {
            const data = await res.json();
            srhApplications = data || {};
        } else {
            srhApplications = {};
        }
        renderApplications();
    } catch (err) {
        console.error("Uygulamalar alınamadı:", err);
        srhApplications = {};
        renderApplications();
    }
}

function renderApplications() {
    const container = document.getElementById('appsListContainer');
    const archivedContainer = document.getElementById('archivedAppsListContainer');
    container.innerHTML = '';
    archivedContainer.innerHTML = '';
    
    const selectFilled = document.getElementById('selectAppFilled');
    const selectNotFilled = document.getElementById('selectAppNotFilled');
    const prevFilledVal = selectFilled.value;
    const prevNotFilledVal = selectNotFilled.value;
    
    selectFilled.innerHTML = '<option value="">-- Lütfen bir uygulama seçin --</option>';
    selectNotFilled.innerHTML = '<option value="">-- Lütfen bir uygulama seçin --</option>';
    
    const apps = Object.entries(srhApplications);
    
    let activeAppsCount = 0;
    let archivedAppsCount = 0;
    
    if (apps.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-400);">Kayıtlı uygulama bulunamadı.</div>';
        archivedContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-400);">Arşivde uygulama bulunamadı.</div>';
        return;
    }

    apps.forEach(([id, app]) => {
        const row = document.createElement('div');
        row.className = 'app-row';
        
        let statusBadge = '';
        if (app.status === 'published') {
            statusBadge = '<span style="background:#d1fae5; color:#059669; padding:3px 8px; border-radius:12px; font-size:0.8rem; margin-left:10px;">Yayınlandı</span>';
        } else if (app.status === 'archived') {
            statusBadge = '<span style="background:#f3f4f6; color:#4b5563; padding:3px 8px; border-radius:12px; font-size:0.8rem; margin-left:10px;">Arşivlendi</span>';
        } else {
            statusBadge = '<span style="background:#fef3c7; color:#d97706; padding:3px 8px; border-radius:12px; font-size:0.8rem; margin-left:10px;">Taslak</span>';
        }

        const typeLabels = {
            'coktan_secmeli': 'Çoktan Seçmeli',
            'kisa_cevap': 'Kısa Cevap',
            'tik_atma': 'Tik Atma'
        };

        row.innerHTML = `
            <div style="position:relative; z-index:10;">
                <h4 style="margin:0; font-size:1.1rem; color:var(--dark);">${app.name} ${statusBadge}</h4>
                <p style="margin:5px 0 0 0; font-size:0.85rem; color:var(--gray-500);">
                    Tip: ${typeLabels[app.type]} | Soru Sayısı: ${app.questions ? app.questions.length : 0}
                </p>
            </div>
            <div style="display:flex; gap:10px; position:relative; z-index:10;">
                <button class="btn-action ${app.status === 'published' ? '' : 'btn-success'}" onclick="togglePublish('${id}')">
                    ${app.status === 'published' ? '<i class="fa-solid fa-eye-slash"></i> Yayından Kaldır' : '<i class="fa-solid fa-bullhorn"></i> Yayınla'}
                </button>
                <button class="btn-action btn-info" style="background:#e0f2fe; color:#0369a1;" onclick="editApp('${id}')" title="Düzenle">
                    <i class="fa-solid fa-pen"></i> Düzenle
                </button>
                <button class="btn-action btn-warning" onclick="toggleArchive('${id}')">
                    ${app.status === 'archived' ? '<i class="fa-solid fa-box-open"></i> Arşivden Çıkar' : '<i class="fa-solid fa-box-archive"></i> Arşive Al'}
                </button>
                <button class="btn-action" style="background:#fee2e2; color:#b91c1c;" onclick="deleteApp('${id}')" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="btn-action" style="background:#f3e8ff; color:#7e22ce;" onclick="window.open('srh_report.html?appId=${id}', '_blank')" title="Yazdır / Rapor Al">
                    <i class="fa-solid fa-print"></i>
                </button>
            </div>
        `;
        if (app.status === 'archived') {
            archivedContainer.appendChild(row);
            archivedAppsCount++;
        } else {
            container.appendChild(row);
            activeAppsCount++;
        }
        
        if (app.status === 'published' || app.status === 'archived') {
            const opt = document.createElement('option');
            opt.value = id;
            opt.innerText = app.name;
            selectFilled.appendChild(opt.cloneNode(true));
            selectNotFilled.appendChild(opt);
        }
    });
    
    if (activeAppsCount === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-400);">Kayıtlı uygulama bulunamadı.</div>';
    }
    if (archivedAppsCount === 0) {
        archivedContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-400);">Arşivde uygulama bulunamadı.</div>';
    }
    
    if (prevFilledVal) selectFilled.value = prevFilledVal;
    if (prevNotFilledVal) selectNotFilled.value = prevNotFilledVal;
}

function switchMainTab(tabName) {
    document.getElementById('tabContent_ayarlar').style.display = tabName === 'ayarlar' ? 'block' : 'none';
    document.getElementById('tabContent_dolduranlar').style.display = tabName === 'dolduranlar' ? 'block' : 'none';
    document.getElementById('tabContent_doldurmayanlar').style.display = tabName === 'doldurmayanlar' ? 'block' : 'none';
    document.getElementById('tabContent_arsiv').style.display = tabName === 'arsiv' ? 'block' : 'none';
    
    document.getElementById('tabBtn_ayarlar').style.borderBottomColor = tabName === 'ayarlar' ? 'var(--primary)' : 'transparent';
    document.getElementById('tabBtn_ayarlar').style.color = tabName === 'ayarlar' ? 'var(--primary)' : 'var(--gray-500)';
    
    document.getElementById('tabBtn_dolduranlar').style.borderBottomColor = tabName === 'dolduranlar' ? 'var(--primary)' : 'transparent';
    document.getElementById('tabBtn_dolduranlar').style.color = tabName === 'dolduranlar' ? 'var(--primary)' : 'var(--gray-500)';
    
    document.getElementById('tabBtn_doldurmayanlar').style.borderBottomColor = tabName === 'doldurmayanlar' ? 'var(--primary)' : 'transparent';
    document.getElementById('tabBtn_doldurmayanlar').style.color = tabName === 'doldurmayanlar' ? 'var(--primary)' : 'var(--gray-500)';
    
    document.getElementById('tabBtn_arsiv').style.borderBottomColor = tabName === 'arsiv' ? 'var(--primary)' : 'transparent';
    document.getElementById('tabBtn_arsiv').style.color = tabName === 'arsiv' ? 'var(--primary)' : 'var(--gray-500)';
}

let currentEditAppId = null;

function openAddAppModal() {
    currentEditAppId = null;
    document.getElementById('appNameInput').value = '';
    document.getElementById('appDescriptionInput').value = '';
    document.getElementById('appTypeSelect').value = 'coktan_secmeli';
    const titleObj = document.querySelector('#addAppModal1 h3');
    if (titleObj) titleObj.innerHTML = 'Yeni Uygulama Oluştur (Adım 1/2)';
    document.getElementById('addAppModal1').style.display = 'flex';
}

function editApp(id) {
    try {
        const app = srhApplications[id];
        if (!app) return;
        currentEditAppId = id;
        
        document.getElementById('appNameInput').value = app.name || '';
        document.getElementById('appDescriptionInput').value = app.description || '';
        document.getElementById('appTypeSelect').value = app.type || 'coktan_secmeli';
        
        const titleObj = document.querySelector('#addAppModal1 h3');
        if (titleObj) titleObj.innerHTML = 'Uygulamayı Düzenle (Adım 1/2) - Sorular İçin İleriye Tıklayın';
        
        // Soruları text area için hazırla
        const qTextArea = document.getElementById('appQuestionsTextarea');
        if (app.questions && app.questions.length > 0) {
            const textLines = app.questions.map(q => {
                if (app.type === 'coktan_secmeli' && q.options) {
                    let line = q.text;
                    const letters = ['A', 'B', 'C', 'D', 'E'];
                    q.options.forEach((opt, idx) => {
                        line += ` ${letters[idx]}) ${opt.text}`;
                    });
                    return line;
                }
                return q.text;
            });
            qTextArea.value = textLines.join('\n\n');
        } else {
            qTextArea.value = '';
        }

        document.getElementById('addAppModal1').style.display = 'flex';
    } catch (err) {
        Swal.fire('Düzenle Hatası', String(err), 'error');
        console.error(err);
    }
}

function closeAddAppModal1() {
    document.getElementById('addAppModal1').style.display = 'none';
}

let tempAppData = {};

function goToStep2() {
    const name = document.getElementById('appNameInput').value.trim();
    const description = document.getElementById('appDescriptionInput').value.trim();
    const type = document.getElementById('appTypeSelect').value;
    
    if (!name) {
        Swal.fire('Hata', 'Lütfen uygulama adını giriniz.', 'error');
        return;
    }
    
    tempAppData = { name, description, type };
    
    document.getElementById('step2AppNameTitle').innerText = name;
    
    // Yalnızca yeni uygulama ekleniyorsa (düzenleme değilse) temizle
    if (!currentEditAppId) {
        document.getElementById('appQuestionsTextarea').value = '';
    }
    
    closeAddAppModal1();
    document.getElementById('addAppModal2').style.display = 'flex';
}

function closeAddAppModal2() {
    document.getElementById('addAppModal2').style.display = 'none';
}

function backToStep1() {
    closeAddAppModal2();
    document.getElementById('addAppModal1').style.display = 'flex';
}

function parseQuestions(rawText, type) {
    // Split into blocks separated by blank lines, OR treat each non-empty line as a unit
    // First try block-based splitting (paragraphs separated by blank lines)
    const blocks = rawText.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(b => b.length > 0);
    const questions = [];

    if (type === 'kisa_cevap' || type === 'tik_atma') {
        // Each line = one question
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        lines.forEach(line => {
            questions.push({ text: line });
        });
        return questions;
    }

    // coktan_secmeli: process block by block
    // A block can be:
    //   - A single line with inline options: "Soru metni A) Şık1 B) Şık2 C) Şık3"
    //   - A multi-line block: first line = question, rest = options (A) ..., B) ...)
    //   - A line starting with a number like "1. Soru metni" followed by option lines
    blocks.forEach(block => {
        const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;

        // Check if first line has inline options (contains both A) and B))
        const firstLine = lines[0];
        const hasInlineOptions = /[A-Ea-e]\s*[\)\.]\s*.+[A-Ea-e]\s*[\)\.]/i.test(firstLine);

        if (hasInlineOptions) {
            // Inline: "Soru metni A) Şık1 B) Şık2 C) Şık3"
            const firstOptionIdx = firstLine.search(/\b[A-Ea-e]\s*[\)\.]/);
            let qText = firstLine.substring(0, firstOptionIdx).trim();
            // Remove leading number like "1." or "1)"
            qText = qText.replace(/^\d+[\.\)]\s*/, '').trim();
            if (!qText) qText = 'Soru';

            const optionsText = firstLine.substring(firstOptionIdx);
            const matches = [...optionsText.matchAll(/([A-Ea-e])\s*[\)\.]\s*(.*?)(?=\s*[A-Ea-e]\s*[\)\.]|$)/g)];
            const options = matches.map(m => ({ label: m[1].toUpperCase(), text: m[2].trim() })).filter(o => o.text);

            questions.push({ text: qText, options });
        } else {
            // Multi-line block: first line(s) = question text, rest = option lines
            let qTextLines = [];
            let optionLines = [];
            let inOptions = false;

            lines.forEach(line => {
                const optionMatch = line.match(/^([A-Ea-e])\s*[\)\.]\s*(.*)/);
                if (optionMatch) {
                    inOptions = true;
                    optionLines.push({ label: optionMatch[1].toUpperCase(), text: optionMatch[2].trim() });
                } else if (!inOptions) {
                    qTextLines.push(line);
                }
            });

            let qText = qTextLines.join(' ').trim();
            // Remove leading number like "1." or "1)"
            qText = qText.replace(/^\d+[\.\)]\s*/, '').trim();
            if (!qText) qText = 'Soru';

            questions.push({ text: qText, options: optionLines });
        }
    });

    // If blocks approach gave only 1 question but the raw text looks like many lines,
    // fall back to line-by-line parsing (no blank line separators)
    if (questions.length <= 1 && type === 'coktan_secmeli') {
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 1) {
            questions.length = 0;
            let currentQuestion = null;
            lines.forEach(line => {
                const optionMatch = line.match(/^([A-Ea-e])\s*[\)\.]\s*(.*)/);
                if (optionMatch && currentQuestion) {
                    currentQuestion.options.push({ label: optionMatch[1].toUpperCase(), text: optionMatch[2].trim() });
                } else {
                    // Check inline options
                    const hasInline = /[A-Ea-e]\s*[\)\.]\s*.+[A-Ea-e]\s*[\)\.]/i.test(line);
                    if (hasInline) {
                        if (currentQuestion) questions.push(currentQuestion);
                        const firstOptionIdx = line.search(/\b[A-Ea-e]\s*[\)\.]/);
                        let qText = line.substring(0, firstOptionIdx).trim().replace(/^\d+[\.\)]\s*/, '').trim() || 'Soru';
                        const optionsText = line.substring(firstOptionIdx);
                        const matches = [...optionsText.matchAll(/([A-Ea-e])\s*[\)\.]\s*(.*?)(?=\s*[A-Ea-e]\s*[\)\.]|$)/g)];
                        const options = matches.map(m => ({ label: m[1].toUpperCase(), text: m[2].trim() })).filter(o => o.text);
                        currentQuestion = { text: qText, options };
                        questions.push(currentQuestion);
                        currentQuestion = null;
                    } else {
                        if (currentQuestion) questions.push(currentQuestion);
                        let qText = line.replace(/^\d+[\.\)]\s*/, '').trim();
                        currentQuestion = { text: qText, options: [] };
                    }
                }
            });
            if (currentQuestion) questions.push(currentQuestion);
        }
    }

    return questions;
}


async function saveApplication() {
    const rawText = document.getElementById('appQuestionsTextarea').value;
    if (!rawText.trim()) {
        Swal.fire('Hata', 'Lütfen en az bir soru giriniz.', 'error');
        return;
    }
    
    const parsedQuestions = parseQuestions(rawText, tempAppData.type);
    
    if (parsedQuestions.length === 0) {
        Swal.fire('Hata', 'Geçerli bir soru bulunamadı.', 'error');
        return;
    }
    
    if (currentEditAppId) {
        // Edit mode
        srhApplications[currentEditAppId].name = tempAppData.name;
        srhApplications[currentEditAppId].description = tempAppData.description || '';
        srhApplications[currentEditAppId].type = tempAppData.type;
        srhApplications[currentEditAppId].questions = parsedQuestions;
    } else {
        // Create mode
        const appId = 'app_' + Date.now();
        const newApp = {
            name: tempAppData.name,
            description: tempAppData.description || '',
            type: tempAppData.type,
            questions: parsedQuestions,
            status: 'draft',
            createdAt: new Date().toISOString()
        };
        srhApplications[appId] = newApp;
    }
    
    Swal.fire({
        title: 'Kaydediliyor...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const token = sessionStorage.getItem('klbk_sessionToken') || localStorage.getItem('klbk_sessionToken');
        if (token) {
            const res = await fetch(`/api/updateSrhData`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(srhApplications)
            });
            
            if (res.ok) {
                closeAddAppModal2();
                renderApplications();
                Swal.fire('Başarılı', 'Uygulama başarıyla kaydedildi.', 'success');
            } else {
                throw new Error("HTTP " + res.status);
            }
        } else {
            // Fallback for local testing if token doesn't exist, though it will fail if rules require auth
            const res = await fetch(`${FIREBASE_DB_URL_SRH}/app_store/srh_data.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(srhApplications)
            });
            
            if (res.ok) {
                closeAddAppModal2();
                renderApplications();
                Swal.fire('Başarılı', 'Uygulama başarıyla kaydedildi.', 'success');
            } else {
                throw new Error("HTTP " + res.status);
            }
        }
    } catch (err) {
        console.error("Kaydetme hatası:", err);
        Swal.fire('Hata', 'Kaydetme sırasında bir hata oluştu.', 'error');
    }
}

async function saveAllToFirebase() {
    Swal.fire({
        title: 'Güncelleniyor...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const token = sessionStorage.getItem('klbk_sessionToken') || localStorage.getItem('klbk_sessionToken');
        if (token) {
            const res = await fetch(`/api/updateSrhData`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(srhApplications)
            });
            
            if (res.ok) {
                renderApplications();
                Swal.fire('Başarılı', 'İşlem başarılı.', 'success');
            } else {
                throw new Error("HTTP " + res.status);
            }
        } else {
            const res = await fetch(`${FIREBASE_DB_URL_SRH}/app_store/srh_data.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(srhApplications)
            });
            
            if (res.ok) {
                renderApplications();
                Swal.fire('Başarılı', 'İşlem başarılı.', 'success');
            } else {
                throw new Error("HTTP " + res.status);
            }
        }
    } catch (err) {
        console.error("Güncelleme hatası:", err);
        Swal.fire('Hata', 'Güncelleme sırasında bir hata oluştu.', 'error');
    }
}

let currentPublishAppId = null;

function togglePublish(id) {
    try {
        if (srhApplications[id]) {
            if (srhApplications[id].status === 'published') {
                srhApplications[id].status = 'draft';
                saveAllToFirebase();
            } else {
                // Sınıf seçme modalını aç
                currentPublishAppId = id;
                openPublishModal();
            }
        }
    } catch (err) {
        Swal.fire('Yayınla Hatası', String(err), 'error');
        console.error(err);
    }
}

async function openPublishModal() {
    const listContainer = document.getElementById('publishClassesList');
    listContainer.innerHTML = '<div style="color:var(--gray-500); text-align:center;">Sınıflar yükleniyor...</div>';
    document.getElementById('selectAllClassesCb').checked = false;
    document.getElementById('publishClassModal').style.display = 'flex';

    try {
        if (typeof DataManager !== 'undefined') {
            await DataManager.initCloud();
            const students = DataManager.getStudents();
            
            const classesSet = new Set();
            if (students) {
                if (Array.isArray(students)) {
                    students.forEach(s => {
                        if (s && s.class) classesSet.add(String(s.class).trim());
                        if (s && s.sinif) classesSet.add(String(s.sinif).trim());
                    });
                } else {
                    Object.values(students).forEach(s => {
                        if (s && s.class) classesSet.add(String(s.class).trim());
                        if (s && s.sinif) classesSet.add(String(s.sinif).trim());
                    });
                }
            }
            
            let allClasses = Array.from(classesSet).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
            
            if (allClasses.length === 0) {
                listContainer.innerHTML = '<div style="color:var(--gray-500);">Kayıtlı sınıf bulunamadı. Lütfen Master Ayarlarından öğrenci listesini yükleyin.</div>';
            } else {
                listContainer.innerHTML = '';
                allClasses.forEach(cls => {
                    listContainer.innerHTML += `
                        <label style="display:flex; align-items:center; gap:5px; background:var(--gray-50); padding:8px 12px; border-radius:8px; border:1px solid var(--gray-200); cursor:pointer;">
                            <input type="checkbox" class="class-publish-cb" value="${cls}" style="width:16px; height:16px;">
                            <span style="font-weight:600;">${cls}</span>
                        </label>
                    `;
                });
            }
        } else {
            throw new Error("DataManager bulunamadı.");
        }
    } catch (err) {
        listContainer.innerHTML = '<div style="color:red; text-align:center;">Sınıflar yüklenirken hata oluştu.</div>';
        console.error("Sınıflar yüklenemedi:", err);
    }
}

function closePublishModal() {
    document.getElementById('publishClassModal').style.display = 'none';
}

function toggleAllClasses(cb) {
    const checkboxes = document.querySelectorAll('.class-publish-cb');
    checkboxes.forEach(c => c.checked = cb.checked);
}

function confirmPublish() {
    if (!currentPublishAppId) return;
    
    const checkboxes = document.querySelectorAll('.class-publish-cb:checked');
    const selectedClasses = Array.from(checkboxes).map(c => c.value);
    
    if (selectedClasses.length === 0) {
        Swal.fire('Uyarı', 'Lütfen en az bir sınıf seçin.', 'warning');
        return;
    }
    
    srhApplications[currentPublishAppId].status = 'published';
    srhApplications[currentPublishAppId].publishedClasses = selectedClasses;
    
    closePublishModal();
    saveAllToFirebase();
}

let currentAppForResults = null;
let currentResultsData = null;
let currentTargetStudents = [];

async function loadResultsForApp(appId) {
    // Senkronize et (Dolduranlar ve Doldurmayanlar tabındaki select'leri aynı yap)
    document.getElementById('selectAppFilled').value = appId;
    document.getElementById('selectAppNotFilled').value = appId;

    const filledContainer = document.getElementById('filledAccordionContainer');
    const notFilledContainer = document.getElementById('notFilledAccordionContainer');
    filledContainer.innerHTML = '';
    notFilledContainer.innerHTML = '';

    if (!appId) {
        return; // Seçim temizlendiyse boş bırak
    }

    const app = srhApplications[appId];
    if (!app) return;
    
    currentAppForResults = app;
    
    Swal.fire({ title: 'Sonuçlar Çekiliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        let authQuery = '';
        if (typeof DataManager !== 'undefined' && DataManager._getAuthToken) {
            const token = DataManager._getAuthToken();
            if (token) authQuery = `&auth=${token}`;
        }
        
        const url = `${FIREBASE_DB_URL_SRH}/app_store/srh_answers/${appId}.json?_=` + Date.now() + authQuery;
        const res = await fetch(url);
        currentResultsData = res.ok ? (await res.json() || {}) : {};
        
        Swal.close();
        renderResults();
    } catch (err) {
        console.error("Sonuçları çekerken hata:", err);
        Swal.fire('Hata', 'Sonuçlar alınamadı.', 'error');
    }
}

async function renderResults() {
    const filledContainer = document.getElementById('filledAccordionContainer');
    const notFilledContainer = document.getElementById('notFilledAccordionContainer');
    filledContainer.innerHTML = '<div style="padding:10px; color:var(--gray-500);">Öğrenciler yükleniyor...</div>';
    notFilledContainer.innerHTML = '<div style="padding:10px; color:var(--gray-500);">Öğrenciler yükleniyor...</div>';

    // Öğrenci listesi: DataManager veya doğrudan Firebase'den çek
    let students = [];
    try {
        let authQuery = '';
        if (typeof DataManager !== 'undefined') {
            await DataManager.initCloud(); // DataManager'ı hazırla
            const dm = DataManager.getStudents ? DataManager.getStudents() : null;
            if (dm && dm.length > 0) {
                students = dm;
            }
            if (DataManager._getAuthToken) {
                const token = DataManager._getAuthToken();
                if (token) authQuery = `&auth=${token}`;
            }
        }
        if (students.length === 0) {
            // Fallback: doğrudan Firebase'den çek (Auth eklenmiş)
            const sRes = await fetch(`${FIREBASE_DB_URL_SRH}/school/students.json?_=` + Date.now() + authQuery);
            if (sRes.ok) {
                const sData = await sRes.json();
                if (sData) {
                    students = Array.isArray(sData) ? sData : Object.values(sData);
                }
            }
        }
    } catch(e) {
        console.error('Öğrenci listesi alınamadı:', e);
    }

    filledContainer.innerHTML = '';
    notFilledContainer.innerHTML = '';

    if (students.length === 0) {
        filledContainer.innerHTML = '<p>Öğrenci verisi bulunamadı. Lütfen Master Ayarlarından öğrenci listesini yükleyin.</p>';
        notFilledContainer.innerHTML = '<p>Öğrenci verisi bulunamadı.</p>';
        return;
    }
    
    // Yayınlanan sınıfları bul
    const pubClasses = currentAppForResults.publishedClasses || [];
    let targetStudents = students;
    if (pubClasses.length > 0) {
        targetStudents = students.filter(s => pubClasses.includes((s.class || s.sinif || '').trim()));
    }
    currentTargetStudents = targetStudents;
    
    if (targetStudents.length === 0) {
        filledContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--gray-500);">Bu sınıflara kayıtlı öğrenci bulunamadı.</div>';
        notFilledContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--gray-500);">Bu sınıflara kayıtlı öğrenci bulunamadı.</div>';
        return;
    }

    // Sınıf bazlı gruplama
    const classGroups = {};
    
    targetStudents.forEach(s => {
        const cls = (s.class || s.sinif || '').trim();
        if (!classGroups[cls]) classGroups[cls] = { filled: [], notFilled: [] };
        
        const studentNo = String(s.no || s.number || '');
        if (currentResultsData && currentResultsData[studentNo]) {
            classGroups[cls].filled.push({ student: s, answers: currentResultsData[studentNo] });
        } else {
            classGroups[cls].notFilled.push(s);
        }
    });
    
    const sortedClasses = Object.keys(classGroups).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
    
    if (sortedClasses.length === 0) {
        filledContainer.innerHTML = '<p>Gösterilecek veri yok.</p>';
        notFilledContainer.innerHTML = '<p>Gösterilecek veri yok.</p>';
        return;
    }
    
    sortedClasses.forEach(cls => {
        const group = classGroups[cls];
        
        // --- Dolduranlar Akordiyonu ---
        if (group.filled.length > 0) {
            const filledAcc = document.createElement('div');
            filledAcc.style.cssText = 'border: 1px solid var(--gray-200); border-radius: 8px; overflow: hidden;';
            
            let studentsHtml = '';
            group.filled.sort((a,b) => parseInt(a.student.no) - parseInt(b.student.no)).forEach(item => {
                const s = item.student;
                const ans = item.answers;
                const dateStr = ans.timestamp ? new Date(ans.timestamp).toLocaleString('tr-TR') : 'Bilinmeyen Tarih';
                
                let ansDetails = '';
                if (ans.answers && Array.isArray(ans.answers)) {
                    ans.answers.forEach(a => {
                        const q = currentAppForResults.questions[a.questionIndex];
                        let ansText = a.answer;
                        if (ansText === true) ansText = "Evet/İşaretlendi";
                        if (ansText === false) ansText = "Hayır/İşaretlenmedi";
                        if (ansText === null || ansText === "") ansText = "Cevap Yok";
                        
                        ansDetails += `
                            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed var(--gray-200);">
                                <div style="font-weight:600; font-size:0.9rem;">${a.questionIndex + 1}. ${q ? q.text : 'Soru bulunamadı'}</div>
                                <div style="color:var(--primary); font-size:0.9rem; margin-top:3px;"><i class="fa-solid fa-arrow-turn-down fa-rotate-270" style="margin-right:5px; opacity:0.5;"></i>${ansText}</div>
                            </div>
                        `;
                    });
                }
                
                const fullName = `${s.name || ''} ${s.surname || ''}`.trim();
                studentsHtml += `
                    <div style="padding: 10px 15px; border-bottom: 1px solid var(--gray-100);">
                        <div style="display:flex; justify-content:space-between; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <strong style="color:var(--dark);">${s.no} - ${fullName}</strong>
                            <span style="font-size:0.8rem; color:var(--gray-500);">${dateStr} <i class="fa-solid fa-chevron-down" style="margin-left:5px;"></i></span>
                        </div>
                        <div style="display:none; margin-top:10px; background:var(--gray-50); padding:10px; border-radius:6px;">
                            ${ansDetails || 'Detay bulunamadı.'}
                        </div>
                    </div>
                `;
            });
            
            let completedBadge = '';
            if (group.notFilled.length === 0) {
                completedBadge = '<span style="background:#d1fae5; color:#065f46; padding:3px 10px; border-radius:20px; font-size:0.75rem; margin-left:10px; vertical-align:middle;"><i class="fa-solid fa-circle-check"></i> TAMAMLANDI</span>';
            }

            filledAcc.innerHTML = `
                <div style="background:var(--gray-50); padding:12px 15px; font-weight:bold; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <span>${cls} Sınıfı ${completedBadge}</span>
                    <span style="background:var(--primary); color:white; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${group.filled.length} Öğrenci</span>
                </div>
                <div style="display:none; background:white;">${studentsHtml}</div>
            `;
            filledContainer.appendChild(filledAcc);
        }
        
        // --- Doldurmayanlar Akordiyonu ---
        if (group.notFilled.length > 0) {
            const notFilledAcc = document.createElement('div');
            notFilledAcc.style.cssText = 'border: 1px solid var(--gray-200); border-radius: 8px; overflow: hidden;';
            
            let nfStudentsHtml = '';
            group.notFilled.sort((a,b) => parseInt(a.no) - parseInt(b.no)).forEach(s => {
                const fullName = `${s.name || ''} ${s.surname || ''}`.trim();
                nfStudentsHtml += `
                    <div style="padding: 8px 15px; border-bottom: 1px solid var(--gray-100); color:var(--dark);">
                        ${s.no} - ${fullName}
                    </div>
                `;
            });
            
            notFilledAcc.innerHTML = `
                <div style="background:var(--gray-50); padding:12px 15px; font-weight:bold; cursor:pointer; display:flex; justify-content:space-between;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <span>${cls} Sınıfı</span>
                    <span style="background:#ef4444; color:white; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${group.notFilled.length} Öğrenci</span>
                </div>
                <div style="display:none; background:white;">${nfStudentsHtml}</div>
            `;
            notFilledContainer.appendChild(notFilledAcc);
        }
    });
    
    if (filledContainer.children.length === 0) filledContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--gray-500);">Bu uygulamayı henüz çözen öğrenci bulunmuyor.</div>';
    if (notFilledContainer.children.length === 0) notFilledContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--gray-500);">Tüm öğrenciler uygulamayı çözmüş!</div>';
}




function toggleArchive(id) {
    if (srhApplications[id]) {
        if (srhApplications[id].status === 'archived') {
            srhApplications[id].status = 'draft';
        } else {
            srhApplications[id].status = 'archived';
        }
        saveAllToFirebase();
    }
}

function deleteApp(id) {
    Swal.fire({
        title: 'Emin misiniz?',
        text: 'Bu uygulamayı kalıcı olarak silmek istediğinize emin misiniz?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, Sil!',
        cancelButtonText: 'İptal'
    }).then((result) => {
        if (result.isConfirmed) {
            delete srhApplications[id];
            saveAllToFirebase();
        }
    });
}

async function checkAppCompletion(appId) {
    try {
        const token = typeof DataManager !== 'undefined' && DataManager._getAuthToken ? DataManager._getAuthToken() : '';
        const authQuery = token ? `?auth=${token}` : '';
        const FIREBASE_DB_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
        
        let students = typeof DataManager !== 'undefined' && DataManager.getStudents ? DataManager.getStudents() : null;
        if (!students || students.length === 0) {
            const sRes = await fetch(`${FIREBASE_DB_URL}/school/students.json${authQuery}`);
            const sData = await sRes.json();
            students = Array.isArray(sData) ? sData : Object.values(sData || {});
        }
        
        const ansRes = await fetch(`${FIREBASE_DB_URL}/app_store/srh_answers/${appId}.json${authQuery}`);
        const ansData = await ansRes.json() || {};
        
        const totalStudents = students.length;
        const answeredCount = Object.keys(ansData).length;
        
        const badgeSpan = document.getElementById(`comp-badge-${appId}`);
        if (!badgeSpan) return;
        
        if (totalStudents > 0 && answeredCount >= totalStudents) {
            badgeSpan.innerHTML = '<span style="background:#d1fae5; color:#065f46; padding:3px 8px; border-radius:12px; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> TAMAMLANDI</span>';
            badgeSpan.style.opacity = '1';
        } else {
            badgeSpan.innerHTML = `<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:12px; font-weight:bold;"><i class="fa-solid fa-circle-xmark"></i> TAMAMLANMADI (${answeredCount}/${totalStudents})</span>`;
            badgeSpan.style.opacity = '1';
        }
    } catch (err) {
        console.error(err);
        const badgeSpan = document.getElementById(`comp-badge-${appId}`);
        if (badgeSpan) badgeSpan.innerHTML = '';
    }
}

function exportResultsToExcel(type) {
    if (!currentAppForResults) {
        Swal.fire('Hata', 'Lütfen önce bir uygulama seçin.', 'error');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        Swal.fire('Hata', 'Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyin.', 'error');
        return;
    }
    
    const dataToExport = [];
    
    currentTargetStudents.forEach(s => {
        const studentNo = String(s.no || s.number || '');
        const hasFilled = currentResultsData && currentResultsData[studentNo];
        
        if (type === 'filled' && hasFilled) {
            dataToExport.push({
                'Sınıf': s.class || s.sinif || '',
                'Okul Numarası': s.no,
                'Adı Soyadı': `${s.name || ''} ${s.surname || ''}`.trim()
            });
        } else if (type === 'notFilled' && !hasFilled) {
            dataToExport.push({
                'Sınıf': s.class || s.sinif || '',
                'Okul Numarası': s.no,
                'Adı Soyadı': `${s.name || ''} ${s.surname || ''}`.trim()
            });
        }
    });
    
    if (dataToExport.length === 0) {
        Swal.fire('Bilgi', 'Dışa aktarılacak öğrenci bulunamadı.', 'info');
        return;
    }
    
    dataToExport.sort((a, b) => {
        if (a['Sınıf'] !== b['Sınıf']) return String(a['Sınıf']).localeCompare(String(b['Sınıf']), 'tr', { numeric: true });
        return parseInt(a['Okul Numarası']) - parseInt(b['Okul Numarası']);
    });
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wscols = [ {wpx: 60}, {wpx: 100}, {wpx: 180} ];
    ws['!cols'] = wscols;
    
    const wb = XLSX.utils.book_new();
    const sheetName = type === 'filled' ? 'Dolduranlar' : 'Doldurmayanlar';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    let safeName = (currentAppForResults.name || 'Uygulama').replace(/[^a-z0-9ğüşöçİĞÜŞÖÇ]/gi, '_');
    XLSX.writeFile(wb, `${safeName}_${sheetName}.xlsx`);
}
