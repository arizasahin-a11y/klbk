/**
 * km_ogretmen_app.js - Ogretmen Degerlendirme Paneli
 * Calismalar listesi, ogrenci cevaplari goruntuleme, puan girisi.
 * KLBK auth sistemi ile entegre.
 */

let kmOgrStudies = {};
let kmOgrAssignments = {};
let kmOgrCurrentStudy = null;
let kmOgrCurrentAssignId = null;
let kmOgrEvals = {};

// --- INIT ---
async function kmOgrInit() {
    Swal.fire({ title: 'Yukleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const [studies, assigns] = await Promise.all([km_getStudies(), km_getAssignments()]);
        kmOgrStudies = studies;
        kmOgrAssignments = assigns;
        kmOgrRenderStudyList();
        Swal.close();
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

// --- CALISMA LISTESI ---
function kmOgrRenderStudyList() {
    const container = document.getElementById('kmOgrStudyList');
    if (!container) return;
    container.innerHTML = '';

    const activeStudies = Object.entries(kmOgrStudies).filter(([, s]) => !s.is_archived);
    if (activeStudies.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8;"><i class="fa-solid fa-inbox fa-2x"></i><br><br>Aktif calisma yok.</div>';
        return;
    }

    activeStudies.forEach(([studyId, study]) => {
        // Bu calismaya ait atamalar
        const studyAssigns = Object.entries(kmOgrAssignments).filter(([, a]) => a.study_id === studyId);

        const card = document.createElement('div');
        card.className = 'km-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <h3 style="margin:0 0 5px;font-size:1.1rem;font-weight:700;">${study.name}</h3>
                    <p style="margin:0;color:#64748b;font-size:0.85rem;">
                        ${study.content && study.content.sorular ? study.content.sorular.length + ' soru' : 'Icerik yok'}
                        &bull; ${studyAssigns.length} sinif atamasi
                    </p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color:#94a3b8;font-size:1.2rem;margin-top:5px;"></i>
            </div>
            ${studyAssigns.length > 0 ? `
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                    ${studyAssigns.map(([, a]) => `<span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">${a.class_name}</span>`).join('')}
                </div>` : ''}`;

        card.onclick = () => kmOgrOpenStudy(studyId, study, studyAssigns);
        container.appendChild(card);
    });
}

// --- CALISMA DETAYI ---
async function kmOgrOpenStudy(studyId, study, assigns) {
    kmOgrCurrentStudy = { id: studyId, ...study };
    document.getElementById('kmOgrListSection').style.display = 'none';
    document.getElementById('kmOgrDetailSection').style.display = 'block';
    document.getElementById('kmOgrDetailTitle').textContent = study.name;

    // Sinif sekmelerini olustur
    const tabsContainer = document.getElementById('kmOgrClassTabs');
    const contentContainer = document.getElementById('kmOgrClassContent');
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    if (assigns.length === 0) {
        contentContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">Bu calisma hicbir sinifa atanmamis.</div>';
        return;
    }

    assigns.forEach(([aid, a], idx) => {
        const tab = document.createElement('button');
        tab.className = 'km-tab-btn' + (idx === 0 ? ' km-tab-active' : '');
        tab.textContent = a.class_name;
        tab.onclick = () => {
            document.querySelectorAll('.km-tab-btn').forEach(b => b.classList.remove('km-tab-active'));
            tab.classList.add('km-tab-active');
            kmOgrLoadClassEvals(studyId, aid, a);
        };
        tabsContainer.appendChild(tab);
    });

    // Ilk sinifi ac
    if (assigns.length > 0) {
        await kmOgrLoadClassEvals(studyId, assigns[0][0], assigns[0][1]);
    }
}

async function kmOgrLoadClassEvals(studyId, assignId, assignment) {
    kmOgrCurrentAssignId = assignId;
    const contentContainer = document.getElementById('kmOgrClassContent');
    contentContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Yukleniyor...</div>';

    try {
        const [evals, settings] = await Promise.all([
            km_getEvaluationsForStudy(studyId),
            km_getStudySettings(studyId)
        ]);
        kmOgrEvals = evals;

        const classEvals = Object.entries(evals).filter(([, e]) =>
            e.class_name === assignment.class_name && e.student_school_no !== 'AYARLAR'
        );

        const study = kmOgrCurrentStudy;
        const sorular = (study.content && study.content.sorular) || [];

        let html = `
            <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div style="font-size:0.9rem;color:#64748b;">
                    <strong>${classEvals.length}</strong> ogrenci cevap vermis
                    &bull; ${sorular.length} soru
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="km-btn km-btn-sm" style="background:#eff6ff;color:#1d4ed8;" onclick="kmOgrToggleSettings('${studyId}')">
                        <i class="fa-solid fa-sliders"></i> Ayarlar
                    </button>
                    <button class="km-btn km-btn-danger km-btn-sm" onclick="kmOgrResetEvals('${studyId}','${assignment.class_name}')">
                        <i class="fa-solid fa-rotate-left"></i> Sifirla
                    </button>
                </div>
            </div>`;

        // Ayarlar paneli
        html += `
            <div id="kmSettingsPanel_${studyId}" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:15px;margin-bottom:20px;">
                <h4 style="margin:0 0 10px;font-size:0.95rem;">Calisma Ayarlari</h4>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;">
                        <input type="checkbox" id="kmSet_izin_${studyId}" ${settings.izin ? 'checked' : ''}> Erisime Ac
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;">
                        <input type="checkbox" id="kmSet_degerl_${studyId}" ${settings.degerlendirmeIzni ? 'checked' : ''}> Degerlendirme Goster
                    </label>
                </div>
                <button class="km-btn km-btn-primary km-btn-sm" style="margin-top:10px;" onclick="kmOgrSaveSettings('${studyId}')">
                    <i class="fa-solid fa-save"></i> Ayarlari Kaydet
                </button>
            </div>`;

        if (classEvals.length === 0) {
            html += '<div style="text-align:center;padding:3rem;color:#94a3b8;">Henuz cevap gonderilmemis.</div>';
        } else {
            html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;">';
            html += '<th style="padding:10px 15px;text-align:left;font-size:0.85rem;color:#64748b;font-weight:600;">Ogrenci</th>';
            html += '<th style="padding:10px 15px;text-align:left;font-size:0.85rem;color:#64748b;font-weight:600;">Giris</th>';
            html += '<th style="padding:10px 15px;text-align:left;font-size:0.85rem;color:#64748b;font-weight:600;">Durum</th>';
            html += '<th style="padding:10px 15px;text-align:left;font-size:0.85rem;color:#64748b;font-weight:600;">Toplam</th>';
            html += '<th style="padding:10px 15px;text-align:left;font-size:0.85rem;color:#64748b;font-weight:600;">Islemler</th>';
            html += '</tr></thead><tbody>';

            classEvals.forEach(([evalId, ev]) => {
                const isFinished = ev.evaluation && ev.evaluation.bitti;
                const toplam = (ev.evaluation && ev.evaluation.toplam) || '-';
                html += `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 15px;font-weight:600;">${ev.student_school_no}</td>
                    <td style="padding:10px 15px;color:#64748b;font-size:0.85rem;">${ev.entry_count || 0}x</td>
                    <td style="padding:10px 15px;">
                        <span style="background:${isFinished ? '#dcfce7' : '#fef3c7'};color:${isFinished ? '#166534' : '#92400e'};padding:3px 8px;border-radius:10px;font-size:0.8rem;font-weight:600;">
                            ${isFinished ? 'Bitti' : 'Devam'}
                        </span>
                    </td>
                    <td style="padding:10px 15px;font-weight:700;color:#1d4ed8;">${toplam}</td>
                    <td style="padding:10px 15px;">
                        <button class="km-btn km-btn-sm" style="background:#eff6ff;color:#1d4ed8;" onclick="kmOgrViewDetail('${evalId}')">
                            <i class="fa-solid fa-eye"></i> Incele
                        </button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table></div>';
        }

        contentContainer.innerHTML = html;
    } catch (e) {
        contentContainer.innerHTML = `<div style="color:#ef4444;padding:1rem;">Hata: ${e.message}</div>`;
    }
}

function kmOgrToggleSettings(studyId) {
    const panel = document.getElementById(`kmSettingsPanel_${studyId}`);
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function kmOgrSaveSettings(studyId) {
    const izin = document.getElementById(`kmSet_izin_${studyId}`).checked;
    const degerl = document.getElementById(`kmSet_degerl_${studyId}`).checked;
    try {
        await km_saveStudySettings(studyId, { izin, degerlendirmeIzni: degerl, updated_at: Date.now() });
        Swal.fire({ icon: 'success', title: 'Ayarlar Kaydedildi!', timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

async function kmOgrResetEvals(studyId, className) {
    const r = await Swal.fire({
        title: 'Puanlar sifirlansin mi?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', confirmButtonText: 'Sifirla', cancelButtonText: 'Iptal'
    });
    if (!r.isConfirmed) return;
    try {
        await km_resetEvaluationsForClass(studyId, className);
        Swal.fire({ icon: 'success', title: 'Sifirland!', timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Hata', e.message, 'error');
    }
}

function kmOgrViewDetail(evalId) {
    const ev = kmOgrEvals[evalId];
    if (!ev) return;
    const study = kmOgrCurrentStudy;
    const sorular = (study && study.content && study.content.sorular) || [];
    let cevaplar = [];
    if (ev.answers) {
        if (Array.isArray(ev.answers)) cevaplar = ev.answers;
        else if (ev.answers.cevaplar) cevaplar = ev.answers.cevaplar;
    }

    let html = `<div style="max-height:70vh;overflow-y:auto;text-align:left;">`;
    html += `<p style="margin-bottom:15px;color:#64748b;">Okul No: <strong>${ev.student_school_no}</strong> | Giris: ${ev.entry_count || 0}x</p>`;

    sorular.forEach((soru, si) => {
        const cev = cevaplar[si] || [];
        html += `<div style="margin-bottom:15px;padding:12px;background:#f8fafc;border-radius:8px;">`;
        html += `<div style="font-weight:600;margin-bottom:8px;font-size:0.9rem;">Soru ${si + 1}: ${soru.soru || ''}</div>`;
        if (soru.secenekler) {
            soru.secenekler.forEach((s, ci) => {
                const sec = cev[ci];
                html += `<div style="padding:4px 8px;border-radius:6px;margin:3px 0;background:${sec ? '#dcfce7' : '#fff'};color:${sec ? '#166534' : '#334155'};font-size:0.85rem;">
                    ${String.fromCharCode(65+ci)}. ${s} ${sec ? '<i class="fa-solid fa-check" style="float:right;"></i>' : ''}
                </div>`;
            });
        } else {
            html += `<div style="font-size:0.85rem;color:#475569;">${cev[0] || '(Bos)'}</div>`;
        }
        html += `</div>`;
    });
    html += '</div>';

    Swal.fire({ title: 'Ogrenci Cevaplari', html, width: 600, confirmButtonText: 'Kapat' });
}

function kmOgrGeriDon() {
    document.getElementById('kmOgrDetailSection').style.display = 'none';
    document.getElementById('kmOgrListSection').style.display = 'block';
    kmOgrCurrentStudy = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = sessionStorage.getItem('klbk_isLoggedIn') === 'true' || localStorage.getItem('klbk_isLoggedIn') === 'true';
    if (!isLoggedIn) { window.location.href = 'enter.html'; return; }
    kmOgrInit();
});