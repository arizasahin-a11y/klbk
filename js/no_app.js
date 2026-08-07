// js/no_app.js - Nöbetçi Öğrenci Planlama Mantığı
let currentUser = null;
let userRole = null;
let allStudents = [];
let classList = [];
let dutyLocations = []; // { id, name, count, gender, rule }
let generatedPlan = []; // { date, locName, class, no, name }
const FIREBASE_DB_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";

$(document).ready(async function() {
    // 1. Yetki Kontrolü
    const loggedIn = sessionStorage.getItem('klbk_isLoggedIn') === 'true' || localStorage.getItem('klbk_isLoggedIn') === 'true';
    if (!loggedIn) {
        window.location.href = 'enter.html';
        return;
    }

    const userStr = sessionStorage.getItem('klbk_currentUser') || localStorage.getItem('klbk_currentUser');
    userRole = sessionStorage.getItem('klbk_role') || localStorage.getItem('klbk_role');
    
    if (userStr) {
        try {
            currentUser = JSON.parse(userStr);
        } catch(e) {
            currentUser = { username: userStr };
        }
    } else {
        currentUser = { username: 'admin' };
    }

    const roleStr = (userRole || '').toLowerCase().trim();
    const isAdmin = ['admin', 'idareci', 'müdür', 'müdür_yardimcisi', 'mudur', 'mudur_yardimcisi'].includes(roleStr);

    if (!isAdmin) {
        sessionStorage.setItem('klbk_security_msg', 'Nöbetçi öğrenci planlama ekranına sadece İdareciler girebilir.');
        window.location.href = 'security_error.html';
        return;
    }

    // Profil Bilgilerini Doldur
    $('#currentUserName').text(currentUser.fullname || currentUser.username || 'Kullanıcı');
    $('#currentUserRole').text((userRole || 'Admin').toUpperCase());

    // UI Yükleniyor...
    Swal.fire({
        title: 'Veriler Yükleniyor...',
        text: 'Lütfen bekleyin',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // 2. Verileri Yükle
    try {
        await DataManager.initCloud();
        allStudents = typeof DataManager.getStudents === 'function' ? DataManager.getStudents() : [];
        
        // Sınıfları Çıkar
        const classes = new Set();
        allStudents.forEach(s => {
            if (s && s.class) classes.add(s.class.trim());
        });
        classList = Array.from(classes).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true, sensitivity: 'base' }));

        // Select2'yi doldur
        const $select = $('#classSelect');
        classList.forEach(c => {
            $select.append(new Option(c, c));
        });
        $select.select2({
            placeholder: "Nöbetçi seçilecek sınıfları belirleyin",
            allowClear: true
        });

        // Eski planları/yerleri çek
        await loadSavedData();
        renderLocations();

        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire('Hata', 'Veriler yüklenirken bir sorun oluştu.', 'error');
    }
});

window.logout = function() {
    sessionStorage.removeItem('klbk_isLoggedIn');
    sessionStorage.removeItem('klbk_currentUser');
    sessionStorage.removeItem('klbk_role');
    localStorage.removeItem('klbk_isLoggedIn');
    localStorage.removeItem('klbk_currentUser');
    localStorage.removeItem('klbk_role');
    window.location.href = 'enter.html';
};

// --- Nöbet Yeri İşlemleri ---
window.openAddLocationModal = function() {
    Swal.fire({
        title: 'Yeni Nöbet Yeri',
        html: `
            <div style="display:flex; flex-direction:column; gap:15px; text-align:left; margin-top:10px;">
                <div>
                    <label style="font-weight:600; font-size:14px;">Yer Adı (Örn: Bahçe)</label>
                    <input id="locName" class="swal2-input" style="margin:5px 0 0 0; width:100%;">
                </div>
                <div>
                    <label style="font-weight:600; font-size:14px;">Nöbetçi Sayısı</label>
                    <input type="number" id="locCount" class="swal2-input" min="1" value="1" style="margin:5px 0 0 0; width:100%;">
                </div>
                <div>
                    <label style="font-weight:600; font-size:14px;">Cinsiyet</label>
                    <select id="locGender" class="swal2-select" style="margin:5px 0 0 0; width:100%; display:flex;">
                        <option value="Farketmez">Farketmez</option>
                        <option value="Kız">Sadece Kız</option>
                        <option value="Erkek">Sadece Erkek</option>
                    </select>
                </div>
                <div>
                    <label style="font-weight:600; font-size:14px;">Öğrenci Seçim Kuralı</label>
                    <select id="locRule" class="swal2-select" style="margin:5px 0 0 0; width:100%; display:flex;">
                        <option value="sirayla">Sınıflar sırayla (örn: önce 9A bitene kadar)</option>
                        <option value="esit">Her sınıftan eşit sayıda nöbetçi al</option>
                    </select>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Ekle',
        cancelButtonText: 'İptal',
        preConfirm: () => {
            const name = document.getElementById('locName').value.trim();
            const count = parseInt(document.getElementById('locCount').value);
            const gender = document.getElementById('locGender').value;
            const rule = document.getElementById('locRule').value;
            
            if (!name) return Swal.showValidationMessage("Yer adı girin.");
            if (isNaN(count) || count < 1) return Swal.showValidationMessage("Geçerli bir nöbetçi sayısı girin.");
            return { id: Date.now().toString(), name, count, gender, rule };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            dutyLocations.push(res.value);
            renderLocations();
            savePlan(); // Arkada kaydet
        }
    });
};

function renderLocations() {
    const container = $('#locationsContainer');
    if (dutyLocations.length === 0) {
        container.hide();
        return;
    }
    
    container.empty();
    dutyLocations.forEach(loc => {
        let genderIcon = loc.gender === 'Kız' ? '<i class="fa-solid fa-person-dress" style="color:#ec4899;"></i>' : 
                         loc.gender === 'Erkek' ? '<i class="fa-solid fa-person" style="color:#3b82f6;"></i>' : 
                         '<i class="fa-solid fa-users" style="color:#8b5cf6;"></i>';
                         
        let ruleText = loc.rule === 'sirayla' ? 'Sınıflar sırayla' : 'Her sınıftan eşit';

        let html = `
            <div class="location-card">
                <div class="location-info">
                    <span class="location-title">${loc.name}</span>
                    <span class="location-meta">
                        <i class="fa-solid fa-user-clock"></i> ${loc.count} Nöbetçi | 
                        ${genderIcon} ${loc.gender} | 
                        <i class="fa-solid fa-scale-balanced"></i> ${ruleText}
                    </span>
                </div>
                <button class="btn-icon" onclick="window.removeLocation('${loc.id}')" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.append(html);
    });
    container.show();
}

window.removeLocation = function(id) {
    dutyLocations = dutyLocations.filter(l => l.id !== id);
    renderLocations();
    savePlan();
};

// --- Planlama Algoritması ---
window.generatePlan = function() {
    const selectedClasses = $('#classSelect').val();
    if (!selectedClasses || selectedClasses.length === 0) {
        Swal.fire('Hata', 'Lütfen nöbetçi seçilecek en az bir sınıf belirleyin.', 'warning');
        return;
    }
    if (dutyLocations.length === 0) {
        Swal.fire('Hata', 'Lütfen en az bir nöbet yeri ekleyin.', 'warning');
        return;
    }

    // Seçilen sınıflardaki öğrencileri filtrele ve cinsiyete göre hazırla
    // Note: Öğrenci objesinde cinsiyet 'cinsiyet' veya 'gender' olabilir. (E-Okul genelde 'cinsiyet' kullanır: 'Kız', 'Erkek')
    let studentsByClass = {};
    selectedClasses.forEach(c => {
        studentsByClass[c] = allStudents.filter(s => s.class === c).sort((a,b) => parseInt(a.number) - parseInt(b.number));
    });

    // Son 1 ayı hesapla (Sadece hafta içi ve tatil olmayan günler)
    let workingDays = [];
    let d = new Date(); // Today
    
    // Güvenlik: Sonsuz döngüyü engellemek için maks 100 gün ileri bak
    let maxLookAhead = 100;
    while(workingDays.length < 20 && maxLookAhead > 0) { // Yaklaşık 1 ay (20 iş günü)
        let dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Hafta sonu değilse
            let dStr = d.toISOString().split('T')[0];
            // getHolidayInfo(dStr) true dönerse tatildir.
            let isHoliday = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(dStr) : false;
            if (!isHoliday) {
                workingDays.push(dStr);
            }
        }
        d.setDate(d.getDate() + 1);
        maxLookAhead--;
    }

    generatedPlan = [];
    
    // Global öğrenci nöbet sayacı (Ay boyunca kimin kaç nöbet tuttuğunu takip eder)
    let studentStats = {}; 
    selectedClasses.forEach(c => {
        if(studentsByClass[c]) {
            studentsByClass[c].forEach(s => {
                let id = c + '-' + (s.number || s.no || Math.random());
                studentStats[id] = 0;
            });
        }
    });

    // Günlere göre planı oluştur
    workingDays.forEach(dateStr => {
        let assignedToday = new Set(); // O gün nöbet yazılan öğrenciler
        let classAssignmentsToday = {}; // O gün hangi sınıftan kaç kişi nöbetçi oldu (Eşit kuralı için)
        selectedClasses.forEach(c => classAssignmentsToday[c] = 0);

        dutyLocations.forEach(loc => {
            for (let i = 0; i < loc.count; i++) {
                
                // Bu lokasyon için bugünkü adayları belirle
                let candidateStudents = [];
                selectedClasses.forEach(c => {
                    if(studentsByClass[c]) {
                        studentsByClass[c].forEach(s => {
                            let id = c + '-' + (s.number || s.no || '-');
                            if (!assignedToday.has(id) && isValidGender(s, loc.gender)) {
                                candidateStudents.push({
                                    student: s,
                                    id: id,
                                    class: c,
                                    count: studentStats[id],
                                    classOrder: selectedClasses.indexOf(c),
                                    number: parseInt(s.number || s.no || '9999')
                                });
                            }
                        });
                    }
                });

                if (candidateStudents.length === 0) {
                    console.warn(`${dateStr} günü ${loc.name} için boşta uygun öğrenci bulunamadı!`);
                    continue; // Bu lokasyonun bu kontenjanını boş geç
                }

                // Adayları kurala göre sırala
                candidateStudents.sort((a, b) => {
                    // 1. ÖNCELİK: Nöbet Sayısı (En az nöbet tutan öncelikli)
                    if (a.count !== b.count) return a.count - b.count;

                    if (loc.rule === 'sirayla') {
                        // SIRAYLA KURALI
                        // 2. Sınıf Sırası (Önce 9A, sonra 9B...)
                        if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
                        // 3. Öğrenci Numarası
                        return a.number - b.number;
                    } else {
                        // EŞİT KURALI
                        // 2. Bugün o sınıftan kaç kişi nöbetçi oldu? (En az olan öncelikli)
                        let aClassCount = classAssignmentsToday[a.class] || 0;
                        let bClassCount = classAssignmentsToday[b.class] || 0;
                        if (aClassCount !== bClassCount) return aClassCount - bClassCount;
                        // 3. Sınıf Sırası (Tie-breaker)
                        if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
                        // 4. Öğrenci Numarası
                        return a.number - b.number;
                    }
                });

                // En iyi adayı seç
                let bestCandidate = candidateStudents[0];
                
                // Planı kaydet ve sayaçları güncelle
                assignedToday.add(bestCandidate.id);
                studentStats[bestCandidate.id]++;
                classAssignmentsToday[bestCandidate.class]++;

                generatedPlan.push({
                    date: dateStr,
                    locName: loc.name,
                    className: bestCandidate.student.class,
                    number: bestCandidate.student.number || bestCandidate.student.no || '-',
                    name: bestCandidate.student.name + ' ' + (bestCandidate.student.surname || '')
                });
            }
        });
    });

    // Tarihe göre sırala
    generatedPlan.sort((a,b) => a.date.localeCompare(b.date));

    renderPlan();
    $('#resultsPanel').show();
    $('#btnSavePlan').show();

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Plan başarıyla oluşturuldu!',
        showConfirmButton: false,
        timer: 2000
    });
};

function isValidGender(student, genderPref) {
    if (genderPref === 'Farketmez') return true;
    
    // Veritabanındaki farklı sütun isimlerini kapsa
    let genderVal = student.cinsiyet || student.Cinsiyet || student['Cinsiyeti'] || student['CİNSİYETİ'] || student.gender || student.cns || '';
    let sg = String(genderVal).toLowerCase().trim();
    
    if (!sg) return true; // Eğer veritabanında cinsiyet verisi tamamen eksikse, sistemi çökertmemek için herkesi dahil et.
    
    if (genderPref === 'Kız') {
        return (sg === 'kız' || sg === 'k' || sg === 'kiz' || sg.includes('female') || sg.includes('kadın') || sg.includes('kadin'));
    }
    
    if (genderPref === 'Erkek') {
        return (sg === 'erkek' || sg === 'e' || sg.includes('male'));
    }
    
    return true; 
}

function renderPlan() {
    const tbody = $('#planTableBody');
    tbody.empty();
    
    // Tarihe göre grupla
    let grouped = {};
    generatedPlan.forEach(p => {
        if (!grouped[p.date]) grouped[p.date] = [];
        grouped[p.date].push(p);
    });

    Object.keys(grouped).sort().forEach(dateStr => {
        let parts = dateStr.split('-');
        let displayDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
        let dayRows = grouped[dateStr];
        
        dayRows.forEach((p, index) => {
            let html = '<tr>';
            if (index === 0) {
                html += `<td rowspan="${dayRows.length}" style="vertical-align: middle; background: #f8fafc; border-right: 1px solid #e2e8f0; font-size: 15px;"><strong>${displayDate}</strong></td>`;
            }
            
            html += `
                <td><span style="background:rgba(79,70,229,0.1); color:#4f46e5; padding:4px 8px; border-radius:6px; font-weight:600; font-size:13px;">${p.locName}</span></td>
                <td>${p.className}</td>
                <td>${p.number}</td>
                <td>${p.name}</td>
            </tr>`;
            tbody.append(html);
        });
    });
}

// --- Kayıt İşlemleri ---
window.savePlan = async function() {
    const selectedClasses = $('#classSelect').val() || [];
    const saveData = {
        locations: dutyLocations,
        selectedClasses: selectedClasses,
        plan: generatedPlan,
        updatedAt: Date.now()
    };

    try {
        Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        // DataManager üzerinden kaydet (Token ve Güvenlik kurallarından geçmek için)
        let db = DataManager._getData();
        if (!db.school) db.school = {};
        db.school.studentDuties = saveData;
        DataManager._saveData(db);

        Swal.fire('Başarılı', 'Nöbet planı ve ayarları Firebase\'e kaydedildi.', 'success');
    } catch (e) {
        console.error(e);
        Swal.fire('Hata', 'Kaydedilirken bir sorun oluştu.', 'error');
    }
};

async function loadSavedData() {
    try {
        let db = DataManager._getData();
        if (db && db.school && db.school.studentDuties) {
            const data = db.school.studentDuties;
            if (data.locations) dutyLocations = data.locations;
            if (data.selectedClasses) {
                $('#classSelect').val(data.selectedClasses).trigger('change');
            }
            if (data.plan && data.plan.length > 0) {
                generatedPlan = data.plan;
                renderPlan();
                $('#resultsPanel').show();
            }
        }
    } catch (e) {
        console.warn('Eski plan yüklenemedi:', e);
    }
}
