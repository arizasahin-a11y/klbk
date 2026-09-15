/**
 * km_admin_app.js - Okul Isleri Admin Paneli JS
 * Calisma olusturma, silme, arsivleme islemi yapar.
 * Firebase uzerinden veri yonetir.
 */

let kmAdminStudies = {};
let kmAdminAssignments = {};
let kmEditingStudyId = null;

// --- INIT ---
async function kmAdminInit() {
    Swal.fire({ title: 'Yukleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await kmAdminLoadAll();
        Swal.close();
    } catch (e) {
        Swal.fire('Hata', 'Veriler yuklenirken bir sorun olustu: ' + e.message, 'error');
    }
}

async function kmAdminLoadAll() {
    const [studies, assigns] = await Promise.all([km_getStudies(), km_getAssignments()]);
    kmAdminStudies = studies;
    kmAdminAssignments = assigns;
    kmAdminRenderStudies();
    kmAdminRenderAssignments();
}

// --- CALISMALAR ---
function kmAdminRenderStudies() {
    const tbody = document.getElementById('kmStudiesTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    const entries = Object.entries(kmAdminStudies);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:2rem;">Hic calisma yok. Yeni ekleyin.</td></tr>';
        return;
    }
    entries.forEach(([id, study]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px 15px;font-weight:600;">${study.name || id}</td>
            <td style="padding:10px 15px;">
                <span style="background:${study.is_archived ? '#fef3c7' : '#dcfce7'};color:${study.is_archived ? '#92400e' : '#166534'};padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">
                    ${study.is_archived ? 'Arsivde' : 'Aktif'}
                </span>
            </td>
            <td style="padding:10px 15px;color:#64748b;font-size:0.85rem;">
                ${study.content && study.content.sorular ? study.content.sorular.length + ' soru' : '-'}
            </td>
            <td style="padding:10px 15px;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="km-btn km-btn-primary km-btn-sm" onclick="kmAdminEditStudy('${id}')"><i class="fa-solid fa-pen"></i> Duzenle</button>
                    <button class="km-btn km-btn-sm" style="background:#e0e7ff;color:#3730a3;" onclick="km_archiveStudy('${id}', ${!study.is_archived}).then(kmAdminLoadAll)">
                        <i class="fa-solid fa-${study.is_archived ? 'inbox' : 'archive'}"></i> ${study.is_archived ? 'Geri Al' : 'Arsivle'}
                    </button>
                    <button class="km-btn km-btn-danger km-btn-sm" onclick="kmAdminDeleteStudy('${id}')"><i class="fa-solid fa-trash"></i> Sil</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

function kmAdminRenderAssignments() {
    const tbody = document.getElementById('kmAssignmentsTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    const entries = Object.entries(kmAdminAssignments);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:2rem;">Atama yok.</td></tr>';
        return;
    }
    entries.forEach(([id, a]) => {
        const studyName = kmAdminStudies[a.study_id] ? kmAdminStudies[a.study_id].name : a.study_id;
        const settings = a.settings || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px 15px;font-weight:600;">${studyName}</td>
            <td style="padding:10px 15px;">${a.class_name || '-'}</td>
            <td style="padding:10px 15px;">
                <span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">${a.method || 'Tek'}</span>
            </td>
            <td style="padding:10px 15px;font-size:0.8rem;color:#64748b;">
                ${settings.gorme ? '<span style="background:#dcfce7;color:#166534;padding:2px 7px;border-radius:10px;margin:2px;display:inline-block;">Goruntuleme</span>' : ''}
                ${settings.yapma ? '<span style="background:#fce7f3;color:#9d174d;padding:2px 7px;border-radius:10px;margin:2px;display:inline-block;">Yapma</span>' : ''}
                ${settings.degerl ? '<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;margin:2px;display:inline-block;">Degerlendirme</span>' : ''}
                ${settings.bitis ? '<span style="background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:10px;margin:2px;display:inline-block;">Bitis: '+new Date(settings.bitis).toLocaleDateString('tr-TR')+'</span>' : ''}
            </td>
            <td style="padding:10px 15px;">
                <div style="display:flex;gap:8px;">
                    <button class="km-btn km-btn-primary km-btn-sm" onclick="kmAdminEditAssignment('${id}')"><i class="fa-solid fa-pen"></i> Duzenle</button>
                    <button class="km-btn km-btn-danger km-btn-sm" onclick="kmAdminDeleteAssignment('${id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

// --- CALISMA OLUSTUR / DUZENLE ---
function kmAdminNewStudy() {
    kmEditingStudyId = null;
    document.getElementById('kmStudyModalTitle').textContent = 'Yeni Calisma Olustur';
    document.getElementById('kmStudyName').value = '';
    document.getElementById('kmStudyAciklama').value = '';
    document.getElementById('kmStudySorular').value = '';
    document.getElementById('kmStudyModal').style.display = 'flex';
}

function kmAdminEditStudy(studyId) {
    const study = kmAdminStudies[studyId];
    if (!study) return;
    kmEditingStudyId = studyId;
    document.getElementById('kmStudyModalTitle').textContent = 'Calismayi Duzenle';
    document.getElementById('kmStudyName').value = study.name || '';
    document.getElementById('kmStudyAciklama').value = (study.content && study.content.aciklama) || '';
    document.getElementById('kmStudySorular').value = (study.content && study.content.sorular)
        ? JSON.stringify(study.content.sorular, null, 2) : '';
    document.getElementById('kmStudyModal').style.display = 'flex';
}

async function kmAdminSaveStudy() {
    const name = document.getElementById('kmStudyName').value.trim();
    const aciklama = document.getElementById('kmStudyAciklama').value.trim();
    const soruText = document.getElementById('kmStudySorular').value.trim();
    if (!name) return Swal.fire('Eksik', 'Calisma adi zorunludur.', 'warning');

    let sorular = [];
    if (soruText) {
        try { sorular = JSON.parse(soruText); }
        catch (e) { return Swal.fire('Hata', 'Sorular gecerli JSON formatinda degil.', 'error'); }
    }

    const studyData = {
        name,
        content: { aciklama, sorular },
        is_archived: false,
        created_at: Date.now()
    };

    try {
        Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await km_saveStudy(kmEditingStudyId, studyData);
        document.getElementById('kmStudyModal').style.display = 'none';
        await kmAdminLoadAll();
        Swal.fire({ icon: 'success', title: 'Kaydedildi!', timer: 1500, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

async function kmAdminDeleteStudy(studyId) {
    const study = kmAdminStudies[studyId];
    const r = await Swal.fire({
        title: 'Silmek istediginizden emin misiniz?',
        text: `"${study ? study.name : studyId}" ve tum ilgili verileri silinecek!`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonText: 'Iptal', confirmButtonText: 'Evet, Sil'
    });
    if (!r.isConfirmed) return;
    try {
        Swal.fire({ title: 'Siliniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await km_deleteStudy(studyId);
        await kmAdminLoadAll();
        Swal.fire({ icon: 'success', title: 'Silindi!', timer: 1500, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

// --- ATAMA OLUSTUR / DUZENLE ---
let kmEditingAssignId = null;

async function kmAdminNewAssignment() {
    kmEditingAssignId = null;
    document.getElementById('kmAssignModalTitle').textContent = 'Yeni Atama Olustur';
    // Study select'i doldur
    const sel = document.getElementById('kmAssignStudy');
    sel.innerHTML = '<option value="">Calisma Sec...</option>';
    Object.entries(kmAdminStudies).forEach(([id, s]) => {
        if (!s.is_archived) sel.innerHTML += `<option value="${id}">${s.name}</option>`;
    });
    document.getElementById('kmAssignClass').value = '';
    document.getElementById('kmAssignMethod').value = 'Tek';
    document.getElementById('kmAssignGorme').checked = false;
    document.getElementById('kmAssignYapma').checked = false;
    document.getElementById('kmAssignDegerl').checked = false;
    document.getElementById('kmAssignBitis').value = '';
    document.getElementById('kmAssignModal').style.display = 'flex';
}

function kmAdminEditAssignment(assignId) {
    const a = kmAdminAssignments[assignId];
    if (!a) return;
    kmEditingAssignId = assignId;
    document.getElementById('kmAssignModalTitle').textContent = 'Atama Duzenle';
    const sel = document.getElementById('kmAssignStudy');
    sel.innerHTML = '<option value="">Calisma Sec...</option>';
    Object.entries(kmAdminStudies).forEach(([id, s]) => {
        sel.innerHTML += `<option value="${id}" ${id === a.study_id ? 'selected' : ''}>${s.name}</option>`;
    });
    document.getElementById('kmAssignClass').value = a.class_name || '';
    document.getElementById('kmAssignMethod').value = a.method || 'Tek';
    const s = a.settings || {};
    document.getElementById('kmAssignGorme').checked = !!s.gorme;
    document.getElementById('kmAssignYapma').checked = !!s.yapma;
    document.getElementById('kmAssignDegerl').checked = !!s.degerl;
    document.getElementById('kmAssignBitis').value = s.bitis ? new Date(s.bitis).toISOString().split('T')[0] : '';
    document.getElementById('kmAssignModal').style.display = 'flex';
}

async function kmAdminSaveAssignment() {
    const studyId = document.getElementById('kmAssignStudy').value;
    const className = document.getElementById('kmAssignClass').value.trim();
    const method = document.getElementById('kmAssignMethod').value;
    const bitisVal = document.getElementById('kmAssignBitis').value;
    if (!studyId || !className) return Swal.fire('Eksik', 'Calisma ve sinif zorunludur.', 'warning');

    const settings = {
        gorme: document.getElementById('kmAssignGorme').checked,
        yapma: document.getElementById('kmAssignYapma').checked,
        degerl: document.getElementById('kmAssignDegerl').checked,
        bitis: bitisVal ? new Date(bitisVal).getTime() : null,
        sure: 0
    };

    try {
        Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await km_saveAssignment(studyId, className, method, settings);
        document.getElementById('kmAssignModal').style.display = 'none';
        await kmAdminLoadAll();
        Swal.fire({ icon: 'success', title: 'Atama Kaydedildi!', timer: 1500, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

async function kmAdminDeleteAssignment(assignId) {
    const r = await Swal.fire({
        title: 'Atama silinsin mi?', text: 'Ogrenci cevaplari etkilenmez.',
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonText: 'Iptal', confirmButtonText: 'Sil'
    });
    if (!r.isConfirmed) return;
    await km_deleteAssignment(assignId);
    await kmAdminLoadAll();
    Swal.fire({ icon: 'success', title: 'Silindi!', timer: 1200, showConfirmButton: false });
}

// --- DEGERLENDIRME SIFIRLA ---
async function kmAdminResetEvals() {
    const studyId = document.getElementById('kmResetStudy').value;
    const className = document.getElementById('kmResetClass').value.trim();
    if (!studyId || !className) return Swal.fire('Eksik', 'Calisma ve sinif secin.', 'warning');
    const r = await Swal.fire({
        title: 'Puanlar sifirlansin mi?', text: `${className} sinifinin puanlari silinecek.`,
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444',
        cancelButtonText: 'Iptal', confirmButtonText: 'Sifirla'
    });
    if (!r.isConfirmed) return;
    try {
        Swal.fire({ title: 'Sifirlaniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await km_resetEvaluationsForClass(studyId, className);
        Swal.fire({ icon: 'success', title: 'Sifirland!', timer: 1500, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

// --- YEDEKLEME ---
async function kmAdminExport() {
    try {
        Swal.fire({ title: 'Yedek hazirlaniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const data = await km_exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `okul_isleri_yedek_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        Swal.close();
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

// Reset select populate
function kmAdminPopulateResetSelect() {
    const sel = document.getElementById('kmResetStudy');
    if (!sel) return;
    sel.innerHTML = '<option value="">Calisma Sec...</option>';
    Object.entries(kmAdminStudies).forEach(([id, s]) => {
        sel.innerHTML += `<option value="${id}">${s.name}</option>`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Yetki kontrolu
    const role = (sessionStorage.getItem('klbk_role') || localStorage.getItem('klbk_role') || '').toLowerCase().trim();
    const isAdmin = ['admin','master','idareci','mudur','mudur_basyardimcisi','mudur_yardimcisi'].includes(role);
    if (!isAdmin) {
        const isLoggedIn = sessionStorage.getItem('klbk_isLoggedIn') === 'true' || localStorage.getItem('klbk_isLoggedIn') === 'true';
        if (!isLoggedIn) { window.location.href = 'enter.html'; return; }
        Swal.fire({ icon: 'error', title: 'Yetkisiz Erisim', text: 'Bu sayfaya erisim yetkiniz yok.' }).then(() => window.location.href = 'enter.html');
        return;
    }
    kmAdminInit();
});