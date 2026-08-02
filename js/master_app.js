const FIREBASE_DB_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
const DEFAULT_PIN_HASH = "2966a7b65f6d4eff4c1951aab002ac415a7313c996b689c03c3117a4ba8d6334"; // 127872

let currentMasterPinHash = null;
let appPermissions = {};
let usersData = {};
let currentEditingApp = null;
let tempAssignments = {};

const allHtmlFiles = [
    { id: "html_404", title: "404 Sayfası", desc: "Sayfa bulunamadı hatası", url: "/404.html", icon: "fa-triangle-exclamation" },
    { id: "html_dashboard", title: "Dashboard", desc: "Ana Yönetim Paneli", url: "/dashboard.html", icon: "fa-chart-line" },
    { id: "html_dt", title: "Nöbet Planlama", desc: "Öğretmen Nöbet Çizelgesi ve İşlemleri", url: "/dt.html", icon: "fa-calendar-day" },
    { id: "html_enter", title: "Portal Giriş", desc: "Okul İşleri Portalı", url: "/enter.html", icon: "fa-compass" },
    { id: "html_index", title: "Ana Giriş", desc: "Sistem Ana Giriş Sayfası", url: "/index.html", icon: "fa-right-to-bracket" },
    { id: "html_listeci", title: "Listeci (Barkod & Liste)", desc: "Öğrenci Barkod ve Liste Okuma Ekranı", url: "/listeci.html", icon: "fa-barcode" },
    { id: "html_listeci_print", title: "Listeci Yazdır", desc: "Liste yazdırma ekranı", url: "/listeci_print.html", icon: "fa-print" },
    { id: "html_oeovvb", title: "OEOVVB", desc: "Öğretmen Eylem Veritabanı", url: "/oeovvb.html", icon: "fa-database" },
    { id: "html_oeyp", title: "OEYP", desc: "Öğretmen Eylem Yönetim Paneli", url: "/oeyp.html", icon: "fa-tasks" },
    { id: "html_ogrenci", title: "Öğrenci Sınav Sorgu Sayfası", desc: "Öğrenciler İçin Sınav Yeri Bakma Sayfası", url: "/ogrenci.html", icon: "fa-user-graduate" },
    { id: "html_ogrencitakip", title: "Öğrenci Takip", desc: "Öğrenci Davranış Takip İstatistikleri", url: "/ogrencitakip.html", icon: "fa-chart-pie" },
    { id: "html_ogretmen", title: "Öğretmen Sayfası", desc: "Öğretmen Ana Sayfası", url: "/ogretmen.html", icon: "fa-chalkboard-user" },
    { id: "html_pts", title: "Proje Faaliyet Raporu (PTS)", desc: "OGP ve OÖP Faaliyet Değerlendirme & Raporlama", url: "/faaliyet_liderleri.html", icon: "fa-file-signature" },
    { id: "html_security_error", title: "Güvenlik Hatası", desc: "Yetki/Güvenlik Hatası Sayfası", url: "/security_error.html", icon: "fa-shield-halved" },
    { id: "html_yoklama_idareci", title: "Yoklama İdareci", desc: "İdareci Yoklama Yönetim Paneli", url: "/yoklama_idareci.html", icon: "fa-building-user" },
    { id: "html_yoklama_ogretmen", title: "Yoklama Ekranı", desc: "Öğretmen Yoklama Alma Sayfası", url: "/yoklama_ogretmen.html", icon: "fa-clipboard-list" },
    { id: "html_zumreci", title: "Zümreci", desc: "Zümre Planlama ve Görüş İşleme", url: "/zumreci.html", icon: "fa-users-between-lines" }
];

// === SECURITY: Password Hashing with Web Crypto API ===
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchMasterPin() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_master_pin.json?_=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            currentMasterPinHash = data || DEFAULT_PIN_HASH;
        } else {
            currentMasterPinHash = DEFAULT_PIN_HASH;
        }
    } catch (e) {
        console.error("Master PIN fetch error:", e);
        currentMasterPinHash = DEFAULT_PIN_HASH;
    }
}

async function verifyPin() {
    const input = document.getElementById('masterPinInput').value;
    if (!input) return;

    if (!currentMasterPinHash) await fetchMasterPin();
    const inputHash = await hashPassword(input);

    if (inputHash === currentMasterPinHash) {
        document.getElementById('pinOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        initMasterApp();
    } else {
        Swal.fire({ icon: 'error', title: 'Hatalı PIN', text: 'Lütfen doğru Master PIN kodunu giriniz.' });
        document.getElementById('masterPinInput').value = '';
    }
}

document.getElementById('masterPinInput').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') verifyPin();
});

// === Initial Load ===
async function initMasterApp() {
    Swal.fire({ title: 'Yükleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const [permRes, usersRes] = await Promise.all([
            fetch(`${FIREBASE_DB_URL}/app_store/klbk_app_permissions.json?_=${Date.now()}`),
            fetch(`${FIREBASE_DB_URL}/app_store/klbk_users.json?_=${Date.now()}`)
        ]);

        if (permRes.ok) {
            const data = await permRes.json();
            appPermissions = data || {};
        }

        if (usersRes.ok) {
            const data = await usersRes.json();
            usersData = data || {};
        }

        renderAppList();
        Swal.close();
    } catch (e) {
        console.error("Init Error:", e);
        Swal.fire('Hata', 'Veriler yüklenirken bir sorun oluştu.', 'error');
    }
}

// === Render UI ===
function renderAppList() {
    const container = document.getElementById('appListContainer');
    container.innerHTML = '';

    allHtmlFiles.forEach(app => {
        // Create a Firebase-safe key from the URL (e.g., /dt.html -> dt_html)
        let dbKey = app.url;
        if (dbKey.startsWith('/')) dbKey = dbKey.substring(1);
        dbKey = dbKey.replace(/\./g, '_');

        // Initialize default permissions if not exists
        if (!appPermissions[dbKey]) {
            appPermissions[dbKey] = { globalAccess: true, assignments: {} };
        }
        
        const perm = appPermissions[dbKey];
        const isGlobalAccess = perm.globalAccess;
        const assignmentCount = perm.assignments ? Object.keys(perm.assignments).length : 0;
        
        let expiryText = '';
        if (isGlobalAccess && perm.expiresAt) {
            const expDate = new Date(perm.expiresAt);
            if (Date.now() > expDate.getTime()) {
                expiryText = `<span style="color:#ef4444; font-size:0.8rem; margin-top:4px; display:block;"><i class="fa-solid fa-clock"></i> Süresi Doldu (${expDate.toLocaleDateString('tr-TR')})</span>`;
            } else {
                expiryText = `<span style="color:#10b981; font-size:0.8rem; margin-top:4px; display:block;"><i class="fa-solid fa-clock"></i> Kapanış: ${expDate.toLocaleDateString('tr-TR')}</span>`;
            }
        }

        const row = document.createElement('div');
        row.className = 'app-row';
        row.innerHTML = `
            <div class="app-info">
                <div class="app-icon"><i class="fa-solid ${app.icon}"></i></div>
                <div class="app-text">
                    <h4>${app.title}</h4>
                    <p>${app.url} &bull; ${app.desc}</p>
                    ${expiryText}
                </div>
            </div>
            <div class="app-controls">
                ${assignmentCount > 0 ? `<span class="assigned-users-badge" title="Özel rol atanmış kullanıcı sayısı"><i class="fa-solid fa-users"></i> ${assignmentCount} Özel Yetki</span>` : ''}
                
                <button class="btn-action" style="background:#e2e8f0; color:#475569;" onclick="openAssignModal('${dbKey}', '${app.title}')" title="Kullanıcı Yetkilendir">
                    <i class="fa-solid fa-user-plus"></i> Kullanıcı Ata
                </button>
                
                <label class="toggle-switch" title="Genel Erişime Aç/Kapat">
                    <input type="checkbox" id="toggle_${dbKey}" ${isGlobalAccess ? 'checked' : ''} onchange="toggleGlobalAccess('${dbKey}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
        `;
        container.appendChild(row);
    });
}

// === Save to Backend API ===
async function savePermissionsToBackend() {
    try {
        const res = await fetch('/api/updateAppPermissions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: appPermissions })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Sunucu reddetti (HTTP " + res.status + ")");
        }
        return true;
    } catch (e) {
        console.error("Save error:", e);
        return false;
    }
}

async function toggleGlobalAccess(appKey, isChecked) {
    if (!appPermissions[appKey]) appPermissions[appKey] = { assignments: {} };
    
    if (isChecked) {
        const { value: months } = await Swal.fire({
            title: 'Süre Belirleme',
            text: 'Uygulama erişime açılıyor. Kaç ay açık kalmasını istersiniz?',
            input: 'number',
            inputAttributes: { min: 1, max: 120, step: 1 },
            inputValue: 12,
            showCancelButton: true,
            confirmButtonText: 'Aç',
            cancelButtonText: 'İptal',
            inputValidator: (value) => {
                if (!value || value <= 0) return 'Lütfen geçerli bir ay sayısı girin!';
            }
        });

        if (!months) {
            // User cancelled, revert switch visually
            document.getElementById(`toggle_${appKey}`).checked = false;
            return;
        }

        appPermissions[appKey].globalAccess = true;
        const date = new Date();
        date.setMonth(date.getMonth() + parseInt(months));
        appPermissions[appKey].expiresAt = date.getTime();
    } else {
        appPermissions[appKey].globalAccess = false;
        appPermissions[appKey].expiresAt = null;
    }
    
    Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const success = await savePermissionsToBackend();
    if (success) {
        Swal.close();
        renderAppList(); // Update UI with new dates
    } else {
        // Revert UI on failure
        appPermissions[appKey].globalAccess = !isChecked;
        renderAppList();
        Swal.fire('Hata', 'Değişiklik kaydedilemedi.', 'error');
    }
}

// === Teacher Assignment Modal ===
function formatTeacherName(name) {
    if(!name) return "";
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function openAssignModal(appKey, appTitle) {
    currentEditingApp = appKey;
    document.getElementById('modalAppTitle').innerText = `${appTitle} - Yetkilendirme`;
    
    tempAssignments = JSON.parse(JSON.stringify(appPermissions[appKey]?.assignments || {}));
    
    document.getElementById('teacherSearch').value = '';
    document.getElementById('assignModal').style.display = 'flex';
    renderTeacherList();
}

function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
}

function renderTeacherList(filterText = '') {
    const container = document.getElementById('teacherListContainer');
    container.innerHTML = '';

    const users = Object.entries(usersData).map(([uname, data]) => ({ uid: uname, ...data })).filter(u => u && u.name);
    users.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    users.forEach(user => {
        const displayName = formatTeacherName(user.name);
        if (filterText && !displayName.toLowerCase().includes(filterText.toLowerCase())) return;

        const currentRole = tempAssignments[user.uid] || 'ogretmen';
        const roleLabel = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()) : 'Bilinmiyor';

        const item = document.createElement('div');
        item.className = 'teacher-item';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="teacher-checkbox" value="${user.uid}" style="width:18px; height:18px; cursor:pointer;">
                <div>
                    <strong style="color:var(--dark); display:block;">${displayName}</strong>
                    <span style="font-size:0.8rem; color:var(--gray-500);">Genel Rol: ${roleLabel}</span>
                </div>
            </div>
            <div class="role-selector">
                <select id="select_role_${user.uid}" onchange="updateTempAssignment('${user.uid}', this.value)">
                    <option value="ogretmen" ${currentRole === 'ogretmen' ? 'selected' : ''}>Öğretmen (Varsayılan)</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="serbest" ${currentRole === 'serbest' ? 'selected' : ''}>Serbest</option>
                </select>
            </div>
        `;
        container.appendChild(item);
    });
}

function toggleSelectAllTeachers() {
    const checkboxes = document.querySelectorAll('.teacher-checkbox');
    if (checkboxes.length === 0) return;
    const allChecked = Array.from(checkboxes).every(c => c.checked);
    checkboxes.forEach(c => c.checked = !allChecked);
}

function bulkAssignRole(role) {
    const checkboxes = document.querySelectorAll('.teacher-checkbox:checked');
    if (checkboxes.length === 0) {
        Swal.fire('Uyarı', 'Lütfen en az bir kişi seçin.', 'warning');
        return;
    }
    
    checkboxes.forEach(c => {
        const uid = c.value;
        const selectEl = document.getElementById(`select_role_${uid}`);
        if (selectEl) selectEl.value = role;
        updateTempAssignment(uid, role);
    });
    
    // Uncheck them after bulk apply to prevent mistakes
    checkboxes.forEach(c => c.checked = false);
    
    Swal.fire({
        icon: 'success',
        title: 'Atandı!',
        text: `Seçili kişilere "${role}" yetkisi uygulandı. Değişiklikleri kaydetmeyi unutmayın!`,
        timer: 2000,
        showConfirmButton: false
    });
}

function filterTeachers() {
    const text = document.getElementById('teacherSearch').value;
    renderTeacherList(text);
}

function updateTempAssignment(uid, role) {
    if (role === 'ogretmen') {
        delete tempAssignments[uid];
    } else {
        tempAssignments[uid] = role;
    }
}

async function saveAssignments() {
    if (!currentEditingApp) return;
    
    if (!appPermissions[currentEditingApp]) {
        appPermissions[currentEditingApp] = { globalAccess: true };
    }
    appPermissions[currentEditingApp].assignments = tempAssignments;

    Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const success = await savePermissionsToBackend();
    if (success) {
        renderAppList();
        closeAssignModal();
        Swal.fire({ icon: 'success', title: 'Başarılı', text: 'Yetkilendirmeler kaydedildi.', timer: 1500, showConfirmButton: false });
    } else {
        Swal.fire('Hata', 'Değişiklik kaydedilemedi.', 'error');
    }
}

// === PIN Change ===
function openChangePinModal() {
    document.getElementById('oldPinInput').value = '';
    document.getElementById('newPinInput').value = '';
    document.getElementById('newPinConfirmInput').value = '';
    document.getElementById('changePinModal').style.display = 'flex';
}

function closeChangePinModal() {
    document.getElementById('changePinModal').style.display = 'none';
}

async function changeMasterPin() {
    const oldPin = document.getElementById('oldPinInput').value;
    const newPin = document.getElementById('newPinInput').value;
    const newPinConfirm = document.getElementById('newPinConfirmInput').value;

    if (!oldPin || !newPin || !newPinConfirm) {
        Swal.fire('Uyarı', 'Lütfen tüm alanları doldurun.', 'warning');
        return;
    }

    if (newPin !== newPinConfirm) {
        Swal.fire('Uyarı', 'Yeni PIN tekrarı uyuşmuyor.', 'warning');
        return;
    }

    const oldPinHash = await hashPassword(oldPin);
    if (oldPinHash !== currentMasterPinHash) {
        Swal.fire('Hata', 'Eski PIN hatalı.', 'error');
        return;
    }

    const newPinHash = await hashPassword(newPin);
    
    Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const res = await fetch('/api/updateMasterPin', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinHash: newPinHash })
        });
        if (!res.ok) throw new Error("Sunucu hatası");
        
        currentMasterPinHash = newPinHash;
        closeChangePinModal();
        Swal.fire({ icon: 'success', title: 'Başarılı', text: 'Master PIN güncellendi.', timer: 2000, showConfirmButton: false });
    } catch (e) {
        console.error(e);
        Swal.fire('Hata', 'PIN güncellenemedi.', 'error');
    }
}

// Start
fetchMasterPin();
