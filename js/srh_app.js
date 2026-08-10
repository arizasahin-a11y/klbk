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
                <button class="btn-action btn-warning" onclick="toggleArchive('${id}')">
                    ${app.status === 'archived' ? '<i class="fa-solid fa-box-open"></i> Arşivden Çıkar' : '<i class="fa-solid fa-box-archive"></i> Arşive Al'}
                </button>
                <button class="btn-action" style="background:#fee2e2; color:#b91c1c;" onclick="deleteApp('${id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

function openAddAppModal() {
    document.getElementById('appNameInput').value = '';
    document.getElementById('appTypeSelect').value = 'coktan_secmeli';
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
    
    const appId = 'app_' + Date.now();
    const newApp = {
        name: tempAppData.name,
        type: tempAppData.type,
        questions: parsedQuestions,
        status: 'draft',
        createdAt: new Date().toISOString()
    };
    
    srhApplications[appId] = newApp;
    
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

function togglePublish(id) {
    if (srhApplications[id]) {
        if (srhApplications[id].status === 'published') {
            srhApplications[id].status = 'draft';
        } else {
            srhApplications[id].status = 'published';
        }
        saveAllToFirebase();
    }
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
