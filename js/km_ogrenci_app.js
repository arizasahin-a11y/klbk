/**
 * km_ogrenci_app.js - Ogrenci Giris & Calisma Ekrani
 * Ogrenci okul numarasi ile giris yapar (sifresiz).
 * klbk_users Firebase node'undan dogrulama yapilir.
 */

let kmCurrentStudent = null;
let kmCurrentAssignments = [];
let kmCurrentStudy = null;
let kmCurrentAssignment = null;
let kmCevaplar = [];
let kmSureSayac = null;

// --- GIRIS ---
async function kmOgrenciGiris() {
    const schoolNo = document.getElementById('kmSchoolNo').value.trim();
    if (!schoolNo) return kmShowMsg('Okul numarasi giriniz.', 'error');

    const btn = document.getElementById('kmGirisBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dogrulaniyor...';

    try {
        const student = await km_findStudentBySchoolNo(schoolNo);
        if (!student) {
            kmShowMsg('Okul numarasi bulunamadi. Lutfen kontrol edin.', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Giris Yap';
            return;
        }
        kmCurrentStudent = student;
        sessionStorage.setItem('km_student', JSON.stringify(student));
        sessionStorage.setItem('km_school_no', schoolNo);
        await kmOgrenciLoadPanel();
    } catch (e) {
        kmShowMsg('Baglanti hatasi: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Giris Yap';
    }
}

async function kmOgrenciLoadPanel() {
    const student = kmCurrentStudent;
    const schoolNo = sessionStorage.getItem('km_school_no');
    const className = student.class_name || student.sinif || student.className || '';

    document.getElementById('kmLoginSection').style.display = 'none';
    document.getElementById('kmPanelSection').style.display = 'block';
    document.getElementById('kmStudentName').textContent = student.name || student.ad || 'Ogrenci';
    document.getElementById('kmStudentClass').textContent = className;
    document.getElementById('kmStudentNo').textContent = schoolNo;

    document.getElementById('kmAssignmentsList').innerHTML =
        '<div style="text-align:center;padding:3rem;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Calismalar yukleniyor...</div>';

    try {
        kmCurrentAssignments = await km_getStudentPanelData(className, schoolNo);
        kmRenderAssignmentList();
    } catch (e) {
        document.getElementById('kmAssignmentsList').innerHTML =
            `<div style="text-align:center;padding:2rem;color:#ef4444;">Hata: ${e.message}</div>`;
    }
}

function kmRenderAssignmentList() {
    const container = document.getElementById('kmAssignmentsList');
    if (!kmCurrentAssignments || kmCurrentAssignments.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8;"><i class="fa-solid fa-inbox fa-2x"></i><br><br>Atanmis calisma yok.</div>';
        return;
    }

    container.innerHTML = '';
    kmCurrentAssignments.forEach((a, idx) => {
        const now = Date.now();
        const expired = a.bitis && now > a.bitis;
        const hasStarted = a.myRecord.entry_count > 0;
        const isFinished = a.myRecord.degerlendirme && a.myRecord.degerlendirme.bitti;

        let statusBadge = '';
        if (isFinished) statusBadge = '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;"><i class="fa-solid fa-check"></i> Tamamlandi</span>';
        else if (expired) statusBadge = '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;"><i class="fa-solid fa-clock"></i> Suresi Doldu</span>';
        else if (hasStarted) statusBadge = '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;"><i class="fa-solid fa-hourglass-half"></i> Devam Ediyor</span>';
        else statusBadge = '<span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;"><i class="fa-solid fa-circle-dot"></i> Baslanmadi</span>';

        const canStart = !expired && a.izin !== false;
        const soruSayisi = (a.studyContent && a.studyContent.sorular) ? a.studyContent.sorular.length : 0;

        const card = document.createElement('div');
        card.className = 'km-card';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <h3 style="margin:0;font-size:1.1rem;font-weight:700;color:#1e293b;">${a.calisma}</h3>
                ${statusBadge}
            </div>
            <div style="display:flex;gap:15px;margin-bottom:12px;font-size:0.85rem;color:#64748b;">
                <span><i class="fa-solid fa-users" style="margin-right:4px;"></i>${a.yontem}</span>
                <span><i class="fa-solid fa-list-check" style="margin-right:4px;"></i>${soruSayisi} Soru</span>
                ${a.bitis ? `<span><i class="fa-solid fa-calendar-xmark" style="margin-right:4px;"></i>${new Date(a.bitis).toLocaleDateString('tr-TR')}</span>` : ''}
            </div>
            ${a.myGroup ? `<div style="background:#eff6ff;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:0.85rem;color:#1d4ed8;"><i class="fa-solid fa-people-group"></i> Grup ${a.myGroup.groupNo}</div>` : ''}
            ${isFinished && a.degerl ? `
                <div style="background:#f0fdf4;border-radius:8px;padding:10px 15px;margin-bottom:12px;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:800;color:#15803d;">${a.myRecord.degerlendirme.toplam || 0}</div>
                    <div style="font-size:0.8rem;color:#166534;">Toplam Puan</div>
                </div>` : ''}
            <button class="km-btn km-btn-primary" style="width:100%;justify-content:center;" ${!canStart ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} onclick="kmStartStudy(${idx})">
                <i class="fa-solid fa-${isFinished ? 'eye' : 'play'}"></i> ${isFinished ? 'Sonucu Gor' : (hasStarted ? 'Devam Et' : 'Baslat')}
            </button>`;
        container.appendChild(card);
    });
}

// --- CALISMA BASLAT ---
async function kmStartStudy(assignmentIdx) {
    kmCurrentAssignment = kmCurrentAssignments[assignmentIdx];
    const study = kmCurrentAssignment.studyContent;

    if (!study || !study.sorular || study.sorular.length === 0) {
        return Swal.fire('Uyari', 'Bu calismada soru bulunamadi.', 'warning');
    }

    // Mevcut cevaplari yukle
    const schoolNo = sessionStorage.getItem('km_school_no');
    const existing = await km_getStudentEvaluation(kmCurrentAssignment.studyFirebaseId, schoolNo).catch(() => null);
    if (existing && existing.answers && existing.answers.cevaplar) {
        kmCevaplar = existing.answers.cevaplar;
    } else {
        kmCevaplar = new Array(study.sorular.length).fill(null).map(() => []);
    }

    document.getElementById('kmPanelSection').style.display = 'none';
    document.getElementById('kmStudySection').style.display = 'block';
    document.getElementById('kmStudyTitle').textContent = kmCurrentAssignment.calisma;

    if (kmCurrentAssignment.sure > 0) {
        kmStartTimer(kmCurrentAssignment.sure * 60);
    }

    kmRenderStudy(study.sorular);
}

function kmRenderStudy(sorular) {
    const container = document.getElementById('kmSorularContainer');
    container.innerHTML = '';

    sorular.forEach((soru, si) => {
        const div = document.createElement('div');
        div.className = 'km-soru-card';
        div.id = `km-soru-${si}`;

        let secenek = '';
        if (soru.secenekler && soru.secenekler.length > 0) {
            soru.secenekler.forEach((s, ci) => {
                const isChecked = kmCevaplar[si] && kmCevaplar[si][ci];
                secenek += `
                    <label class="km-secenek ${isChecked ? 'km-secildi' : ''}" onclick="kmToggleCevap(${si}, ${ci}, this)">
                        <span class="km-secenek-harf">${String.fromCharCode(65 + ci)}</span>
                        <span>${s}</span>
                    </label>`;
            });
        } else {
            secenek = `<textarea class="km-textarea" placeholder="Cevabin..." onchange="kmSetMetinCevap(${si}, this.value)">${(kmCevaplar[si] && kmCevaplar[si][0]) || ''}</textarea>`;
        }

        div.innerHTML = `
            <div class="km-soru-no">Soru ${si + 1}</div>
            <div class="km-soru-metin">${soru.soru || soru.metin || ''}</div>
            ${soru.gorsel ? `<img src="${soru.gorsel}" style="max-width:100%;border-radius:8px;margin:10px 0;">` : ''}
            <div class="km-secenekler">${secenek}</div>`;
        container.appendChild(div);
    });
}

function kmToggleCevap(soruIdx, cevapIdx, label) {
    if (!kmCevaplar[soruIdx]) kmCevaplar[soruIdx] = [];
    const soru = kmCurrentAssignment.studyContent.sorular[soruIdx];
    const isMulti = soru.cokluSecim;

    if (!isMulti) {
        kmCevaplar[soruIdx] = [];
        document.querySelectorAll(`#km-soru-${soruIdx} .km-secenek`).forEach(el => el.classList.remove('km-secildi'));
    }

    const val = kmCevaplar[soruIdx][cevapIdx];
    if (val) {
        kmCevaplar[soruIdx][cevapIdx] = 0;
        label.classList.remove('km-secildi');
    } else {
        kmCevaplar[soruIdx][cevapIdx] = 1;
        label.classList.add('km-secildi');
    }
}

function kmSetMetinCevap(soruIdx, val) {
    kmCevaplar[soruIdx] = [val];
}

async function kmSaveCevaplar() {
    const schoolNo = sessionStorage.getItem('km_school_no');
    const student = kmCurrentStudent;
    const className = student.class_name || student.sinif || '';
    try {
        await km_saveStudentAnswers(kmCurrentAssignment.studyFirebaseId, schoolNo, kmCevaplar, className);
        return true;
    } catch (e) {
        console.error('Cevap kayit hatasi:', e);
        return false;
    }
}

async function kmBitir() {
    const r = await Swal.fire({
        title: 'Calismay bitirmek istiyor musunuz?',
        text: 'Bitirdikten sonra cevaplar degistirilemeyebilir.',
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'Evet, Bitir', cancelButtonText: 'Devam Et'
    });
    if (!r.isConfirmed) return;

    const schoolNo = sessionStorage.getItem('km_school_no');
    try {
        await km_saveStudentAnswers(kmCurrentAssignment.studyFirebaseId, schoolNo, kmCevaplar, kmCurrentStudent.class_name || '');
        // Toplam hesapla (basit sayim)
        let toplam = 0;
        await km_finishEvaluation(kmCurrentAssignment.studyFirebaseId, schoolNo, toplam, null);
        if (kmSureSayac) clearInterval(kmSureSayac);
        document.getElementById('kmStudySection').style.display = 'none';
        document.getElementById('kmPanelSection').style.display = 'block';
        await kmOgrenciLoadPanel();
        Swal.fire({ icon: 'success', title: 'Kaydedildi!', text: 'Cevapların kaydedildi.', timer: 2000, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

async function kmGeriDon() {
    await kmSaveCevaplar();
    if (kmSureSayac) clearInterval(kmSureSayac);
    document.getElementById('kmStudySection').style.display = 'none';
    document.getElementById('kmPanelSection').style.display = 'block';
    await kmOgrenciLoadPanel();
}

function kmStartTimer(saniye) {
    const el = document.getElementById('kmTimerDisplay');
    if (!el) return;
    let kalan = saniye;
    kmSureSayac = setInterval(() => {
        kalan--;
        const dk = Math.floor(kalan / 60).toString().padStart(2, '0');
        const sn = (kalan % 60).toString().padStart(2, '0');
        el.textContent = `${dk}:${sn}`;
        if (kalan <= 60) el.style.color = '#ef4444';
        if (kalan <= 0) {
            clearInterval(kmSureSayac);
            Swal.fire({ icon: 'warning', title: 'Sure Doldu!', text: 'Cevaplar otomatik kaydediliyor...' });
            kmBitir();
        }
    }, 1000);
}

function kmShowMsg(msg, type) {
    const el = document.getElementById('kmLoginMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = type === 'error' ? '#fee2e2' : '#dcfce7';
    el.style.color = type === 'error' ? '#b91c1c' : '#166534';
}

function kmCikis() {
    sessionStorage.removeItem('km_student');
    sessionStorage.removeItem('km_school_no');
    kmCurrentStudent = null;
    document.getElementById('kmPanelSection').style.display = 'none';
    document.getElementById('kmLoginSection').style.display = 'flex';
    document.getElementById('kmSchoolNo').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const saved = sessionStorage.getItem('km_student');
    if (saved) {
        try {
            kmCurrentStudent = JSON.parse(saved);
            kmOgrenciLoadPanel();
            return;
        } catch (e) { sessionStorage.removeItem('km_student'); }
    }
    document.getElementById('kmLoginSection').style.display = 'flex';
    document.getElementById('kmSchoolNo').addEventListener('keyup', e => {
        if (e.key === 'Enter') kmOgrenciGiris();
    });
});