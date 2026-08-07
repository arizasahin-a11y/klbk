// js/no_app.js - Nöbetçi Öğrenci Planlama Mantığı
let currentUser = null;
let userRole = null;
let allStudents = [];
let classList = [];
let dutyLocations = []; // { id, name, count, gender, rule }
let generatedPlan = []; // { date, locName, class, no, name }
window.currentChunkIndex = 0;
window.planChunks = [];
window.exemptStudents = []; // Store exempt IDs
window.swapSource = null; // Store first selected student for manual swap
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

        // Sınıf seçimi değiştiğinde Muafiyet menüsünü güncelle
        $select.on('change', function() {
            if(typeof window.updateExemptClassDropdown === 'function') {
                window.updateExemptClassDropdown();
            }
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
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Ekle',
        cancelButtonText: 'İptal',
        preConfirm: () => {
            const name = document.getElementById('locName').value.trim();
            const count = parseInt(document.getElementById('locCount').value);
            const gender = document.getElementById('locGender').value;
            
            if (!name) return Swal.showValidationMessage("Yer adı girin.");
            if (isNaN(count) || count < 1) return Swal.showValidationMessage("Geçerli bir nöbetçi sayısı girin.");
            return { id: Date.now().toString(), name, count, gender };
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

        let html = `
            <div class="location-card">
                <div class="location-info">
                    <span class="location-title" style="font-weight: 700; color: var(--gray-800);">${loc.name}</span>
                    <span class="location-meta" style="display: flex; gap: 10px; font-size: 0.85rem; color: var(--gray-600); margin-top: 5px;">
                        <span><i class="fa-solid fa-users" style="width:16px;"></i> ${loc.count} Nöbetçi / Gün</span>
                        <span>|</span>
                        <span>${genderIcon} ${loc.gender}</span>
                    </span>
                </div>
                <button class="btn-icon" onclick="window.removeLocation('${loc.id}')" title="Sil" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: none; padding: 10px; cursor: pointer; transition: 0.2s;">
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

    // Son 1 yılı hesapla (Sadece hafta içi ve tatil olmayan günler)
    let workingDays = [];
    let d = new Date(); 
    
    // 1 Yıllık plan üret ve sayfala
    let maxLookAhead = 365;
    while(maxLookAhead > 0) {
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

    const globalRule = document.getElementById('globalRule').value;

    generatedPlan = [];
    
    // Global öğrenci nöbet sayacı (Ay boyunca kimin kaç nöbet tuttuğunu takip eder)
    let studentStats = {}; 
    selectedClasses.forEach(c => {
        if(studentsByClass[c]) {
            studentsByClass[c].forEach(s => {
                let id = c + '-' + (s.number || s.no || s.name || '-').toString().trim();
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
                            let id = c + '-' + (s.number || s.no || s.name || '-').toString().trim();
                            // MUAF KONTROLÜ
                            if (window.exemptStudents && window.exemptStudents.includes(id)) return;

                            if (!assignedToday.has(id) && isValidGender(s, loc.gender)) {
                                candidateStudents.push({
                                    student: s,
                                    id: id,
                                    class: c,
                                    count: studentStats[id] || 0,
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

                    if (globalRule === 'sirayla') {
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

    // Planı 20 günlük (yaklaşık 1 aylık) parçalara (chunk) böl
    let uniqueDates = [...new Set(generatedPlan.map(p => p.date))];
    window.planChunks = [];
    for(let i=0; i<uniqueDates.length; i+=20) {
        window.planChunks.push(uniqueDates.slice(i, i+20));
    }
    window.currentChunkIndex = 0;

    renderPlan();
    if(typeof window.renderTodayDuties === 'function') window.renderTodayDuties();
    
    $('#resultsPanel').show();
    $('#btnSavePlan').show();
    $('#topSaveBtn').show(); // Üstteki yeni kaydet butonu

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
    let genderVal = student.cinsiyet || student.Cinsiyet || student['Cinsiyeti'] || student['CİNSİYETİ'] || student.gender || student.cns || student.extra1 || '';
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

window.changeChunk = function(delta) {
    if (window.planChunks.length === 0) return;
    let newIndex = window.currentChunkIndex + delta;
    if (newIndex >= 0 && newIndex < window.planChunks.length) {
        window.currentChunkIndex = newIndex;
        renderPlan();
    } else {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: delta > 0 ? 'Listenin sonundasınız. Daha fazlası için yeni plan oluşturun.' : 'Listenin başındasınız.',
            showConfirmButton: false,
            timer: 2000
        });
    }
};

function renderPlan() {
    let tbody = document.querySelector('#planTable tbody');
    tbody.innerHTML = '';

    if (generatedPlan.length === 0 || window.planChunks.length === 0) {
        $('#resultsPanel').hide();
        $('#topSaveBtn').hide();
        return;
    }

    let currentChunkDates = window.planChunks[window.currentChunkIndex];
    let filteredPlan = generatedPlan.filter(p => currentChunkDates.includes(p.date));

    // Tarih formatlama fonksiyonu
    const formatDateTR = (dateStr) => {
        let [y, m, d] = dateStr.split('-');
        let monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        return `${parseInt(d)} ${monthNames[parseInt(m)-1]}`;
    };

    // Başlığı güncelle (Örn: 7 Ağustos - 5 Eylül Tarihleri Arası Nöbet Listesi)
    let firstDate = currentChunkDates[0];
    let lastDate = currentChunkDates[currentChunkDates.length - 1];
    document.getElementById('currentChunkLabel').innerText = `${formatDateTR(firstDate)} - ${formatDateTR(lastDate)} Tarihleri Arası`;

    // Tarihe göre grupla
    let grouped = {};
    filteredPlan.forEach(p => {
        if (!grouped[p.date]) grouped[p.date] = [];
        grouped[p.date].push(p);
    });

    Object.keys(grouped).sort().forEach(dateStr => {
        let parts = dateStr.split('-');
        let displayDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
        let dayRows = grouped[dateStr];
        
        dayRows.forEach((p, index) => {
            let html = `<tr style="cursor:pointer; transition:0.2s;" class="plan-row"
                            oncontextmenu="window.handleRowRightClick(event, '${p.date}', '${p.locName}', '${p.className}', '${p.number}')"
                            onclick="window.handleRowClick(event, '${p.date}', '${p.locName}', '${p.className}', '${p.number}')">`;
            
            if (index === 0) {
                html += `<td rowspan="${dayRows.length}" style="vertical-align: middle; background: #f8fafc; border-right: 1px solid #e2e8f0; font-size: 15px;"><strong>${displayDate}</strong></td>`;
            }
            
            html += `
                <td><span style="background:rgba(79,70,229,0.1); color:#4f46e5; padding:4px 8px; border-radius:6px; font-weight:600; font-size:13px;">${p.locName}</span></td>
                <td>${p.className}</td>
                <td>${p.number}</td>
                <td>${p.name} ${p.note ? `<br><span style="font-size:11px;">${p.note}</span>` : ''}</td>
            </tr>`;
            tbody.insertAdjacentHTML('beforeend', html);
        });
    });
}

// --- Manuel Yer Değiştirme (Swap) İşlemleri ---
window.handleRowRightClick = function(event, date, locName, className, number) {
    event.preventDefault();
    window.swapSource = { date, locName, className, number };
    
    // Tüm satırların rengini sıfırla
    document.querySelectorAll('.plan-row').forEach(el => el.style.background = '');
    // Tıklanan satırı turuncu/sarı yap
    let tr = event.currentTarget;
    if (tr) tr.style.background = 'rgba(245, 158, 11, 0.2)'; 
    
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'İlk kişi seçildi. Değiştireceğiniz ikinci kişiye sol tıklayın.',
        showConfirmButton: false,
        timer: 3000
    });
};

window.handleRowClick = function(event, date, locName, className, number) {
    if (!window.swapSource) return; // Değişim modu açık değilse normal tıklama (şu an boş)
    
    // Kendisine tıklandıysa iptal et
    if (window.swapSource.date === date && window.swapSource.locName === locName && window.swapSource.className === className && String(window.swapSource.number) === String(number)) {
        window.swapSource = null;
        document.querySelectorAll('.plan-row').forEach(el => el.style.background = '');
        Swal.fire({ toast:true, position:'top-end', icon:'info', title:'Yer değiştirme iptal edildi.', showConfirmButton:false, timer:1500 });
        return;
    }

    let p1Data = window.swapSource;
    let p2Data = { date, locName, className, number };
    
    let idx1 = generatedPlan.findIndex(p => p.date === p1Data.date && p.locName === p1Data.locName && p.className === p1Data.className && String(p.number) === String(p1Data.number));
    let idx2 = generatedPlan.findIndex(p => p.date === p2Data.date && p.locName === p2Data.locName && p.className === p2Data.className && String(p.number) === String(p2Data.number));
    
    if (idx1 !== -1 && idx2 !== -1) {
        let p1 = generatedPlan[idx1];
        let p2 = generatedPlan[idx2];
        
        let tempClass = p1.className;
        let tempNum = p1.number;
        let tempName = p1.name;
        
        p1.className = p2.className;
        p1.number = p2.number;
        p1.name = p2.name;
        
        p2.className = tempClass;
        p2.number = tempNum;
        p2.name = tempName;
        
        p1.note = "<span style='color:#f59e0b;'><i class='fa-solid fa-right-left'></i> Manuel Değiştirildi</span>";
        p2.note = "<span style='color:#f59e0b;'><i class='fa-solid fa-right-left'></i> Manuel Değiştirildi</span>";
        
        window.swapSource = null;
        window.savePlan();
        renderPlan();
        if(typeof window.renderTodayDuties === 'function') window.renderTodayDuties();
        
        Swal.fire({ toast:true, position:'top-end', icon:'success', title:'Kişiler yer değiştirdi.', showConfirmButton:false, timer:2000 });
    }
};

// --- Muaf Öğrenci İşlemleri ---
window.updateExemptClassDropdown = function() {
    const classes = $('#classSelect').val() || [];
    let sel = document.getElementById('exemptClassSelect');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">-- Sınıf Seçin --</option>';
    classes.forEach(c => {
        sel.innerHTML += `<option value="${c}">${c}</option>`;
    });
    
    let stuSel = document.getElementById('exemptStudentSelect');
    if (stuSel) {
        stuSel.innerHTML = '<option value="">-- Önce Sınıf Seçin --</option>';
        stuSel.disabled = true;
    }
};

window.updateExemptStudentDropdown = function() {
    let c = document.getElementById('exemptClassSelect').value;
    let sel = document.getElementById('exemptStudentSelect');
    if (!sel) return;
    
    if (!c) {
        sel.innerHTML = '<option value="">-- Önce Sınıf Seçin --</option>';
        sel.disabled = true;
        return;
    }
    
    sel.innerHTML = '<option value="">-- Öğrenci Seçin --</option>';
    let students = allStudents.filter(s => s.class === c).sort((a,b) => parseInt(a.number||0) - parseInt(b.number||0));
    students.forEach(s => {
        let id = c + '-' + (s.number || s.no || s.name || '-').toString().trim();
        // Eğer zaten muafsa seçilemesin
        if (window.exemptStudents.includes(id)) return; 
        sel.innerHTML += `<option value="${id}">${s.number || '-'} - ${s.name} ${s.surname||''}</option>`;
    });
    sel.disabled = false;
};

window.addExemptStudent = function() {
    let sel = document.getElementById('exemptStudentSelect');
    let id = sel.value;
    if (!id) return;
    
    if (!window.exemptStudents.includes(id)) {
        window.exemptStudents.push(id);
        if(typeof window.renderExemptStudentsList === 'function') window.renderExemptStudentsList();
        window.updateExemptStudentDropdown(); // Listeyi güncelle ki eklenen gitsin
        if (generatedPlan && generatedPlan.length > 0) {
            window.generatePlan();
        }
        window.savePlan();
    }
};

window.removeExemptStudent = function(id) {
    window.exemptStudents = window.exemptStudents.filter(e => e !== id);
    if(typeof window.renderExemptStudentsList === 'function') window.renderExemptStudentsList();
    window.updateExemptStudentDropdown(); // Sınıf seçiliyse öğrenci geri gelsin
    if (generatedPlan && generatedPlan.length > 0) {
        window.generatePlan();
    }
    window.savePlan();
};

window.renderExemptStudentsList = function() {
    let container = document.getElementById('exemptStudentsList');
    if (!container) return;
    container.innerHTML = '';
    
    if (window.exemptStudents.length === 0) {
        container.innerHTML = '<div style="color:var(--gray-500); font-size:0.85rem; padding-left:5px;">Muaf öğrenci bulunmuyor.</div>';
        return;
    }
    
    window.exemptStudents.forEach(id => {
        let parts = id.split('-');
        let c = parts[0];
        let numOrName = parts.slice(1).join('-');
        
        let studentObj = allStudents.find(s => s.class === c && (String(s.number) === String(numOrName) || String(s.no) === String(numOrName) || s.name === numOrName));
        let fullName = studentObj ? `${studentObj.name} ${studentObj.surname || ''}`.trim() : '';
        let displayName = fullName ? `${numOrName} - ${fullName}` : numOrName;
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:8px 12px; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                <span style="font-size:0.85rem; font-weight:600;"><span style="color:#ef4444;">${c}</span> - Öğrenci No/Ad: ${displayName}</span>
                <button class="btn-icon" style="color:#ef4444; cursor:pointer; background:none; border:none;" title="Muafiyeti Kaldır" onclick="window.removeExemptStudent('${id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
};

// --- Bugünkü Nöbetçiler & Gelmedi İşlemi ---
window.renderTodayDuties = function() {
    let container = document.getElementById('todayDutiesContainer');
    let panel = document.getElementById('todayDutiesPanel');
    if (!container || !panel) return;
    
    if (generatedPlan.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    // Test veya Gerçek kullanım:
    let todayStr = new Date().toISOString().split('T')[0];
    
    // Sadece bugünün planı
    let todaysPlan = generatedPlan.filter(p => p.date === todayStr);
    
    if (todaysPlan.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    let [y, m, d] = todayStr.split('-');
    let monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    document.getElementById('todayDateLabel').innerText = `${parseInt(d)} ${monthNames[parseInt(m)-1]}`;
    
    panel.style.display = 'block';
    container.innerHTML = '';
    
    todaysPlan.forEach((p, idx) => {
        let html = `
            <div style="flex:1; min-width: 200px; background: rgba(79,70,229,0.05); border: 1px solid rgba(79,70,229,0.2); border-radius: 12px; padding: 15px; position:relative; cursor:pointer; transition:0.2s;"
                 onmouseover="this.style.background='rgba(79,70,229,0.1)'" onmouseout="this.style.background='rgba(79,70,229,0.05)'"
                 oncontextmenu="window.showAbsentOptions(event, '${p.date}', '${p.locName}', '${p.className}', '${p.number}')"
                 onclick="window.showAbsentOptions(event, '${p.date}', '${p.locName}', '${p.className}', '${p.number}')">
                <div style="font-size: 0.8rem; font-weight: 700; color: #4f46e5; margin-bottom: 5px;">${p.locName}</div>
                <div style="font-weight: 700; color: var(--gray-800);">${p.name}</div>
                <div style="font-size: 0.85rem; color: var(--gray-600);"><i class="fa-solid fa-graduation-cap"></i> ${p.className} - No: ${p.number}</div>
                ${p.note ? `<div style="font-size:0.75rem; margin-top:5px; font-weight:600;">${p.note}</div>` : ''}
                <div style="font-size:0.7rem; color:var(--gray-500); margin-top:10px; text-align:right;"><i class="fa-solid fa-hand-pointer"></i> Yoklama için tıkla</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
};

window.showAbsentOptions = function(event, date, locName, className, number) {
    if(event) event.preventDefault(); 
    
    Swal.fire({
        title: 'Öğrenci Yoklaması',
        text: 'Lütfen öğrencinin durumunu seçin.',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#ef4444',
        denyButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fa-solid fa-user-xmark"></i> Gelmedi (Değiştir)',
        denyButtonText: '<i class="fa-solid fa-user-check"></i> Geldi',
        cancelButtonText: 'İptal'
    }).then((result) => {
        if (result.isConfirmed) {
            window.markAbsentAndSwap(date, locName, className, number);
        } else if (result.isDenied) {
            window.markPresent(date, locName, className, number);
        }
    });
};

window.markPresent = function(date, locName, className, number) {
    let currentIdx = generatedPlan.findIndex(p => p.date === date && p.locName === locName && p.className === className && String(p.number) === String(number));
    
    if (currentIdx === -1) {
        Swal.fire('Hata', 'Nöbetçi planda bulunamadı.', 'error');
        return;
    }
    
    generatedPlan[currentIdx].note = "<span style='color:#10b981;'><i class='fa-solid fa-check'></i> Nöbetini Tuttu</span>";
    
    window.savePlan();
    renderPlan();
    if(typeof window.renderTodayDuties === 'function') window.renderTodayDuties();
    
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Geldi olarak işaretlendi.',
        showConfirmButton: false,
        timer: 1500
    });
};

window.markAbsentAndSwap = function(date, locName, className, number) {
    let currentIdx = generatedPlan.findIndex(p => p.date === date && p.locName === locName && p.className === className && String(p.number) === String(number));
    
    if (currentIdx === -1) {
        Swal.fire('Hata', 'Nöbetçi planda bulunamadı.', 'error');
        return;
    }
    
    // Aynı lokasyondaki bir sonraki nöbetçiyi bul
    let nextIdx = -1;
    for(let i = currentIdx + 1; i < generatedPlan.length; i++) {
        if (generatedPlan[i].locName === locName) {
            nextIdx = i;
            break;
        }
    }
    
    if (nextIdx === -1) {
        Swal.fire('Bilgi', 'Bu nöbet yeri için planda sıradaki başka bir nöbetçi kalmamış, yer değişimi yapılamaz. Yeni plan üretin.', 'info');
        return;
    }
    
    let p1 = generatedPlan[currentIdx];
    let p2 = generatedPlan[nextIdx];
    
    let tempClass = p1.className;
    let tempNum = p1.number;
    let tempName = p1.name;
    
    p1.className = p2.className;
    p1.number = p2.number;
    p1.name = p2.name;
    
    p2.className = tempClass;
    p2.number = tempNum;
    p2.name = tempName;
    
    // Not ekle
    p1.note = "<span style='color:#ef4444;'>(Gelmediği için değişti)</span>";
    p2.note = "<span style='color:#ef4444;'>(Gelmediği için değişti)</span>";
    
    window.savePlan();
    renderPlan();
    if(typeof window.renderTodayDuties === 'function') window.renderTodayDuties();
    
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Öğrenciler yer değiştirdi.',
        showConfirmButton: false,
        timer: 2000
    });
};

// --- Kayıt İşlemleri ---
window.savePlan = async function() {
    const selectedClasses = $('#classSelect').val() || [];
    const globalRule = document.getElementById('globalRule').value;
    const saveData = {
        locations: dutyLocations,
        selectedClasses: selectedClasses,
        globalRule: globalRule,
        plan: generatedPlan,
        exemptStudents: window.exemptStudents || [],
        updatedAt: Date.now()
    };

    try {
        Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        // DataManager üzerinden kaydet (Token ve Güvenlik kurallarından geçmek için)
        let db = DataManager._getData();
        if (!db.school) db.school = {};
        db.school.studentDuties = saveData;
        DataManager._saveData(db);

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Değişiklikler kaydedildi',
            showConfirmButton: false,
            timer: 1500
        });
    } catch (e) {
        console.error(e);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Kaydedilirken hata oluştu',
            showConfirmButton: false,
            timer: 2000
        });
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
            if (data.globalRule) {
                document.getElementById('globalRule').value = data.globalRule;
            }
            if (data.exemptStudents) {
                window.exemptStudents = data.exemptStudents;
            } else {
                window.exemptStudents = [];
            }
            if(typeof window.renderExemptStudentsList === 'function') window.renderExemptStudentsList();

            if (data.plan && data.plan.length > 0) {
                let p = typeof window.shiftStudentPlanDates === 'function' ? window.shiftStudentPlanDates(data.plan) : data.plan;
                generatedPlan = p;
                // Kayıtlı planı chunk'lara ayır
                let uniqueDates = [...new Set(generatedPlan.map(p => p.date))];
                window.planChunks = [];
                for(let i=0; i<uniqueDates.length; i+=20) {
                    window.planChunks.push(uniqueDates.slice(i, i+20));
                }
                window.currentChunkIndex = 0;
                
                renderPlan();
                if(typeof window.renderTodayDuties === 'function') window.renderTodayDuties();
                $('#resultsPanel').show();
                $('#topSaveBtn').show();
            }
        }
    } catch (e) {
        console.warn('Eski plan yüklenemedi:', e);
    }
}
