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
    container.innerHTML = '';
    
    const selectFilled = document.getElementById('selectAppFilled');
    const selectNotFilled = document.getElementById('selectAppNotFilled');
    const prevFilledVal = selectFilled.value;
    const prevNotFilledVal = selectNotFilled.value;
    
    selectFilled.innerHTML = '<option value="">-- Lütfen bir uygulama seçin --</option>';
    selectNotFilled.innerHTML = '<option value="">-- Lütfen bir uygulama seçin --</option>';
    
    const apps = Object.entries(srhApplications);
    
    if (apps.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-400);">Kayıtlı uygulama bulunamadı.</div>';
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
            <div>
                <h4 style="margin:0; font-size:1.1rem; color:var(--dark);">${app.name} ${statusBadge}</h4>
                <p style="margin:5px 0 0 0; font-size:0.85rem; color:var(--gray-500);">
                    Tip: ${typeLabels[app.type]} | Soru Sayısı: ${app.questions ? app.questions.length : 0}
                </p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-action ${app.status === 'published' ? '' : 'btn-success'}" onclick="togglePublish('${id}')">
                    ${app.status === 'published' ? '<i class="fa-solid fa-eye-slash"></i> Yayından Kaldır' : '<i class="fa-solid fa-bullhorn"></i> Yayınla'}
                </button>
                <button class="btn-action btn-info" style="background:#e0f2fe; color:#0369a1;" onclick="editApp('${id}')" title="Düzenle">
                    <i class="fa-solid fa-pen"></i> Düzenle
                </button>
                <button class="btn-action btn-warning" onclick="toggleArchive('${id}')">
                    ${app.status === 'archived' ? '<i class="fa-solid fa-box-open"></i> Arşivden Çıkar' : '<i class="fa-solid fa-box-archive"></i> Arşive Al'}
                </button>
                <button class="btn-action" style="background:#fee2e2; color:#b91c1c;" onclick="deleteApp('${id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
        
        if (app.status === 'published' || app.status === 'archived') {
            const opt = document.createElement('option');
            opt.value = id;
            opt.innerText = app.name;
            selectFilled.appendChild(opt.cloneNode(true));
            selectNotFilled.appendChild(opt);
        }
    });
    
    if (prevFilledVal) selectFilled.value = prevFilledVal;
    if (prevNotFilledVal) selectNotFilled.value = prevNotFilledVal;
}

function switchMainTab(tabName) {
    document.getElementById('tabContent_ayarlar').style.display = tabName === 'ayarlar' ? 'block' : 'none';
    document.getElementById('tabContent_dolduranlar').style.display = tabName === 'dolduranlar' ? 'block' : 'none';
    document.getElementById('tabContent_doldurmayanlar').style.display = tabName === 'doldurmayanlar' ? 'block' : 'none';
    
    document.getElementById('tabBtn_ayarlar').style.borderBottomColor = tabName === 'ayarlar' ? 'var(--primary)' : 'transparent';
    document.getElementById('tabBtn_ayarlar').style.color = tabName === 'ayarlar' ? 'var(--primary)' : 'var(--gray-500)';
    
    document.getElementById('tabBtn_dolduranlar').style.borderBottomColor = tabName === 'dolduranlar' ? 'var(--primary)' : 'transparent';
    document.getElementById('tabBtn_dolduranlar').style.color = tabName === 'dolduranlar' ? 'var(--primary)' : 'var(--gray-500)';
    
    document.getElementById('tabBtn_doldurmayanlar').style.borderBottomColor = tabName === 'doldurmayanlar' ? 'var(--primary)' : 'transparent';
    document.getElementById('tabBtn_doldurmayanlar').style.color = tabName === 'doldurmayanlar' ? 'var(--primary)' : 'var(--gray-500)';
}

let currentEditAppId = null;

function openAddAppModal() {
    currentEditAppId = null;
    document.getElementById('appNameInput').value = '';
    document.getElementById('appTypeSelect').value = 'coktan_secmeli';
    document.getElementById('addAppModal1').style.display = 'flex';
}

function editApp(id) {
    const app = srhApplications[id];
    if (!app) return;
    
    currentEditAppId = id;
    document.getElementById('appNameInput').value = app.name;
    document.getElementById('appTypeSelect').value = app.type;
    
    // Convert questions back to text
    let questionsText = '';
    if (app.type === 'coktan_secmeli') {
        app.questions.forEach(q => {
            questionsText += q.text + '\n';
            if (q.options) {
                q.options.forEach(opt => questionsText += opt + '\n');
            }
            questionsText += '\n'; // separator
        });
    } else {
        app.questions.forEach(q => {
            questionsText += q.text + '\n';
        });
    }
    document.getElementById('appQuestionsTextarea').value = questionsText.trim();
    
    document.getElementById('addAppModal1').style.display = 'flex';
}

function closeAddAppModal1() {
    document.getElementById('addAppModal1').style.display = 'none';
}

let tempAppData = {};

function goToStep2() {
    const name = document.getElementById('appNameInput').value.trim();
    const type = document.getElementById('appTypeSelect').value;
    
    if (!name) {
        Swal.fire('Hata', 'Lütfen uygulama adını giriniz.', 'error');
        return;
    }
    
    tempAppData = { name, type };
    
    document.getElementById('step2AppNameTitle').innerText = name;
    document.getElementById('appQuestionsTextarea').value = '';
    
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
    const lines = rawText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
    const questions = [];
    
    if (type === 'kisa_cevap' || type === 'tik_atma') {
        // Each line is a question
        lines.forEach(line => {
            questions.push({ text: line });
        });
    } else if (type === 'coktan_secmeli') {
        // Need to parse options
        let currentQuestion = null;
        
        // Regex to match A) B) a) b) A- B- A. B.
        const optionRegex = /^([a-eA-E])\\s*[\\)\\-\\.](.*)/;
        
        lines.forEach(line => {
            const match = line.match(optionRegex);
            if (match) {
                // It's an option
                if (currentQuestion) {
                    if (!currentQuestion.options) currentQuestion.options = [];
                    currentQuestion.options.push({
                        label: match[1].toUpperCase(),
                        text: match[2].trim()
                    });
                }
            } else {
                // It's a question (or a new question starting)
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                currentQuestion = { text: line, options: [] };
            }
        });
        
        // Push the last question
        if (currentQuestion) {
            questions.push(currentQuestion);
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
        srhApplications[currentEditAppId].type = tempAppData.type;
        srhApplications[currentEditAppId].questions = parsedQuestions;
    } else {
        // Create mode
        const appId = 'app_' + Date.now();
        const newApp = {
            name: tempAppData.name,
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
    } catch (err) {
        console.error("Güncelleme hatası:", err);
        Swal.fire('Hata', 'Güncelleme sırasında bir hata oluştu.', 'error');
    }
}

let currentPublishAppId = null;

function togglePublish(id) {
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
}

function openPublishModal() {
    const listContainer = document.getElementById('publishClassesList');
    listContainer.innerHTML = '';
    document.getElementById('selectAllClassesCb').checked = false;

    // Sınıfları çek
    const students = DataManager._getData()?.school?.students || [];
    const classesSet = new Set();
    students.forEach(s => {
        if (s.class) classesSet.add(s.class.trim());
    });
    
    let allClasses = Array.from(classesSet).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
    
    if (allClasses.length === 0) {
        listContainer.innerHTML = '<div style="color:var(--gray-500);">Kayıtlı sınıf bulunamadı. Lütfen Master Ayarlarından öğrenci listesini yükleyin.</div>';
    } else {
        allClasses.forEach(cls => {
            listContainer.innerHTML += `
                <label style="display:flex; align-items:center; gap:5px; background:var(--gray-50); padding:8px 12px; border-radius:8px; border:1px solid var(--gray-200); cursor:pointer;">
                    <input type="checkbox" class="class-publish-cb" value="${cls}" style="width:16px; height:16px;">
                    <span style="font-weight:600;">${cls}</span>
                </label>
            `;
        });
    }

    document.getElementById('publishClassModal').style.display = 'flex';
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

let currentResultsData = null;
let currentAppForResults = null;

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
        const url = `${FIREBASE_DB_URL_SRH}/app_store/srh_answers/${appId}.json?_=` + Date.now();
        const res = await fetch(url);
        currentResultsData = res.ok ? (await res.json() || {}) : {};
        
        Swal.close();
        renderResults();
    } catch (err) {
        console.error("Sonuçları çekerken hata:", err);
        Swal.fire('Hata', 'Sonuçlar alınamadı.', 'error');
    }
}

function renderResults() {
    const filledContainer = document.getElementById('filledAccordionContainer');
    const notFilledContainer = document.getElementById('notFilledAccordionContainer');
    filledContainer.innerHTML = '';
    notFilledContainer.innerHTML = '';
    
    const students = DataManager._getData()?.school?.students || [];
    if (students.length === 0) {
        filledContainer.innerHTML = '<p>Öğrenci verisi bulunamadı.</p>';
        notFilledContainer.innerHTML = '<p>Öğrenci verisi bulunamadı.</p>';
        return;
    }
    
    // Yayınlanan sınıfları bul
    const pubClasses = currentAppForResults.publishedClasses || [];
    let targetStudents = students;
    if (pubClasses.length > 0) {
        targetStudents = students.filter(s => pubClasses.includes((s.class || '').trim()));
    }
    
    // Sınıf bazlı gruplama
    const classGroups = {};
    pubClasses.forEach(c => classGroups[c] = { filled: [], notFilled: [] });
    
    targetStudents.forEach(s => {
        const cls = (s.class || '').trim();
        if (!classGroups[cls]) classGroups[cls] = { filled: [], notFilled: [] };
        
        if (currentResultsData[s.no]) {
            classGroups[cls].filled.push({ student: s, answers: currentResultsData[s.no] });
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
                
                studentsHtml += `
                    <div style="padding: 10px 15px; border-bottom: 1px solid var(--gray-100);">
                        <div style="display:flex; justify-content:space-between; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <strong style="color:var(--dark);">${s.no} - ${s.name} ${s.surname}</strong>
                            <span style="font-size:0.8rem; color:var(--gray-500);">${dateStr} <i class="fa-solid fa-chevron-down" style="margin-left:5px;"></i></span>
                        </div>
                        <div style="display:none; margin-top:10px; background:var(--gray-50); padding:10px; border-radius:6px;">
                            ${ansDetails || 'Detay bulunamadı.'}
                        </div>
                    </div>
                `;
            });
            
            filledAcc.innerHTML = `
                <div style="background:var(--gray-50); padding:12px 15px; font-weight:bold; cursor:pointer; display:flex; justify-content:space-between;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <span>${cls} Sınıfı</span>
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
                nfStudentsHtml += `
                    <div style="padding: 8px 15px; border-bottom: 1px solid var(--gray-100); color:var(--dark);">
                        ${s.no} - ${s.name} ${s.surname}
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
