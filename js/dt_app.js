/* js/dt_app.js */
const FIREBASE_DB_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
let klbkUsers = {};
let nobetSettings = {
    dutyType: 'weekly', // 'weekly', 'monthly', 'fixed'
    dutyDuration: 'full', // 'full', 'half'
    dutyCount: 1,
    rotationDir: 'asc', // 'asc' or 'desc'
    locations: []
};
let teacherData = {}; // teacher specific settings: { [uid]: { exempt: false, fixedLoc: '' } }
let currentUser = null;
let isAdmin = false;
let currentWeekPlan = {}; // { dateStr: { locationId: userId } }
let studentsList = [];

$(document).ready(function() {
    // Password toggle
    $('#togglePassword').on('click', function() {
        const input = $('#password');
        const icon = $(this).find('i');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            input.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
        }
    });

    // Login Form Submit
    $('#loginForm').on('submit', async function(e) {
        e.preventDefault();
        const username = $('#username').val().trim();
        const password = $('#password').val();
        const remember = $('#rememberMe').is(':checked');
        await doLogin(username, password, remember);
    });

    // Check Session
    checkSession();

    // Settings toggle
    $('#settingDutyType').on('change', function() {
        if($(this).val() === 'fixed') {
            $('#rotationSettingsContainer').hide();
        } else {
            $('#rotationSettingsContainer').show();
        }
    });

    $('#settingRotationDir').on('change', function() {
        if(this.checked) {
            $('#rotationDirLabel').text('Azalan (3→2→1)');
        } else {
            $('#rotationDirLabel').text('Artan (1→2→3)');
        }
    });

    $('#teacherSelect').on('change', function() {
        const uid = $(this).val();
        if(uid) {
            loadTeacherSettingsForm(uid);
        } else {
            $('#teacherSettingsForm').hide();
        }
    });
    
    // Incident form submit
    $('#incidentForm').on('submit', function(e) {
        e.preventDefault();
        submitIncident();
    });
});

async function checkSession() {
    const isLoggedIn = sessionStorage.getItem('klbk_isLoggedIn') === 'true' || localStorage.getItem('klbk_isLoggedIn') === 'true';
    if (isLoggedIn) {
        const username = sessionStorage.getItem('klbk_name') || localStorage.getItem('klbk_name') || 'Kullanıcı';
        const role = (sessionStorage.getItem('klbk_role') || localStorage.getItem('klbk_role') || '').toLowerCase().trim();
        const token = sessionStorage.getItem('klbk_session_token') || localStorage.getItem('klbk_session_token');
        
        currentUser = {
            username: sessionStorage.getItem('klbk_username') || localStorage.getItem('klbk_username'),
            name: username,
            role: role,
            token: token
        };

        isAdmin = ['admin', 'master', 'idareci', 'mudur', 'mudur_basyardimcisi', 'mudur_yardimcisi'].includes(role);
        
        $('#userNameDisplay').text(username);
        $('#loginSection').hide();
        $('#dashboardSection').show();

        buildTabs();
        await loadInitialData();
    } else {
        $('#dashboardSection').hide();
        $('#loginSection').show();
    }
}

async function doLogin(username, password, remember) {
    const btn = $('#loginBtn');
    const msg = $('#loginMessage');
    btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Giriş yapılıyor...');
    msg.hide();

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('klbk_isLoggedIn', 'true');
            storage.setItem('klbk_username', username);
            storage.setItem('klbk_name', data.name || username);
            storage.setItem('klbk_role', data.role || 'user');
            storage.setItem('klbk_session_token', data.token);
            
            checkSession();
        } else {
            msg.removeClass('message-success').addClass('message-error').text(data.error || 'Giriş başarısız').show();
        }
    } catch (err) {
        msg.removeClass('message-success').addClass('message-error').text('Bağlantı hatası: ' + err.message).show();
    } finally {
        btn.prop('disabled', false).html('<span>Giriş Yap</span> <i class="fa-solid fa-arrow-right"></i>');
    }
}

function logout() {
    sessionStorage.clear();
    localStorage.removeItem('klbk_isLoggedIn');
    localStorage.removeItem('klbk_username');
    localStorage.removeItem('klbk_name');
    localStorage.removeItem('klbk_role');
    localStorage.removeItem('klbk_session_token');
    window.location.reload();
}

function buildTabs() {
    let tabsHtml = '';
    
    // Both Admin and Teacher see their active duty tab
    tabsHtml += `<button class="tab-btn active" onclick="switchTab('teacher-active', this)"><i class="fa-solid fa-user-shield"></i> Nöbet Durumum</button>`;

    if (isAdmin) {
        tabsHtml += `
            <button class="tab-btn" onclick="switchTab('admin-settings', this)"><i class="fa-solid fa-cogs"></i> Ayarlar</button>
            <button class="tab-btn" onclick="switchTab('admin-plan', this)"><i class="fa-solid fa-calendar-alt"></i> Planlama</button>
            <button class="tab-btn" onclick="switchTab('admin-incidents', this)"><i class="fa-solid fa-folder-open"></i> Tutanaklar</button>
        `;
    }
    
    $('#mainTabs').html(tabsHtml);
    switchTab('teacher-active', $('#mainTabs .tab-btn').first()[0]);
}

window.switchTab = function(tabId, btnElement) {
    $('.tab-content').removeClass('active');
    $('.tab-btn').removeClass('active');
    
    $(`#tab-${tabId}`).addClass('active');
    if(btnElement) $(btnElement).addClass('active');
};

async function loadInitialData() {
    Swal.fire({ title: 'Veriler Yükleniyor...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    
    try {
        // Fetch Users (for teacher lists) - API handles token
        const usersRes = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_users.json`);
        if(usersRes.ok) {
            klbkUsers = await usersRes.json();
            populateTeacherDropdowns();
        }

        // Fetch Students
        const storeKey = sessionStorage.getItem('klbk_storeKey') || 'klbk_data_admin';
        const stRes = await fetch(`${FIREBASE_DB_URL}/app_store/${storeKey}.json`);
        if(stRes.ok) {
            const stData = await stRes.json();
            if(stData && stData.students) {
                studentsList = stData.students;
            }
        }
        populateStudentDropdown();

        // Fetch Settings & Plans from Firebase using REST
        const settingsRes = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/settings.json`); // if db rules allow, else we need a proxy API. Assuming db rules allow authenticated read.
        if (settingsRes.ok) {
            const data = await settingsRes.json();
            if (data) {
                if(data.global) nobetSettings = data.global;
                if(data.teachers) teacherData = data.teachers;
            }
        }
        
        const plansRes = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/plans.json`);
        if (plansRes.ok) {
            const plans = await plansRes.json();
            if (plans) currentWeekPlan = plans;
        }

        updateAdminSettingsUI();
        updateTeacherViewUI();
        if(isAdmin) loadIncidents();

        Swal.close();
    } catch(e) {
        console.error(e);
        Swal.fire('Hata', 'Veriler yüklenirken hata oluştu: ' + e.message, 'error');
    }
}

function populateTeacherDropdowns() {
    let options = '<option value="">-- Öğretmen Seç --</option>';
    let teacherArr = [];
    const adminRoles = ['admin', 'master', 'idareci', 'mudur', 'mudur_basyardimcisi', 'mudur_yardimcisi'];
    
    for(let uid in klbkUsers) {
        let role = (klbkUsers[uid].role || '').toLowerCase().trim();
        if(uid !== 'admin' && uid !== 'master' && !adminRoles.includes(role)) {
            teacherArr.push({ id: uid, text: klbkUsers[uid].name || uid });
        }
    }
    teacherArr.sort((a,b) => a.text.localeCompare(b.text));
    
    teacherArr.forEach(t => {
        options += `<option value="${t.id}">${t.text}</option>`;
    });

    $('#teacherSelect').html(options);
    $('#incTeachers').html(options); // multiple select
    
    $('.select2-teachers').select2();
}

function populateStudentDropdown() {
    let options = '<option value="">-- Öğrenci Seç --</option>';
    let stdArr = studentsList.map(s => {
        return { id: (s.class || '') + ' - ' + (s.name || ''), text: (s.class || '') + ' - ' + (s.name || '') };
    });
    stdArr.sort((a,b) => a.text.localeCompare(b.text));
    
    stdArr.forEach(s => {
        options += `<option value="${s.id}">${s.text}</option>`;
    });

    $('#incStudents').html(options);
    $('.select2-students').select2();
}

function updateAdminSettingsUI() {
    $('#settingDutyType').val(nobetSettings.dutyType || 'weekly').trigger('change');
    $('#settingDutyDuration').val(nobetSettings.dutyDuration || 'full');
    $('#settingDutyCount').val(nobetSettings.dutyCount || 1);
    $('#settingRotationDir').prop('checked', nobetSettings.rotationDir === 'desc').trigger('change');
    renderLocationsList();
}

function renderLocationsList() {
    let html = '';
    const locs = nobetSettings.locations || [];
    
    // Update Fixed Loc dropdown
    let fixedOpts = '<option value="">-- Sabit Yeri Yok --</option>';
    
    if(locs.length === 0) {
        html = '<p style="color:var(--gray-500); padding:10px;">Henüz nöbet yeri eklenmemiş.</p>';
    } else {
        locs.sort((a,b) => a.priority - b.priority).forEach((loc, index) => {
            html += `
                <div class="item-row">
                    <div class="item-row-content">
                        <span class="item-row-title">${loc.name}</span>
                        <span class="item-row-desc">Öncelik: ${loc.priority} | Öğretmen: ${loc.reqTeachers}</span>
                    </div>
                    <button class="btn btn-sm" style="background:#fef2f2; color:#ef4444; border:1px solid #fecaca; padding:5px 10px;" onclick="removeLocation(${index})"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            fixedOpts += `<option value="${loc.id}">${loc.name}</option>`;
        });
    }
    $('#locationsList').html(html);
    $('#tsFixedLoc').html(fixedOpts);
}

window.openAddLocationModal = function() {
    Swal.fire({
        title: 'Yeni Nöbet Yeri',
        html: `
            <input id="swal-input1" class="swal2-input" placeholder="Yer Adı (Örn: Bahçe)">
            <input id="swal-input2" type="number" class="swal2-input" placeholder="Öncelik (1 en yüksek)">
            <input id="swal-input3" type="number" class="swal2-input" placeholder="Gereken Öğretmen Sayısı">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Ekle',
        cancelButtonText: 'İptal',
        preConfirm: () => {
            return [
                document.getElementById('swal-input1').value,
                document.getElementById('swal-input2').value,
                document.getElementById('swal-input3').value
            ]
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const vals = result.value;
            if(!vals[0]) return Swal.fire('Hata', 'Yer adı zorunludur', 'error');
            
            if(!nobetSettings.locations) nobetSettings.locations = [];
            nobetSettings.locations.push({
                id: 'loc_' + Date.now(),
                name: vals[0],
                priority: parseInt(vals[1] || 1),
                reqTeachers: parseInt(vals[2] || 1)
            });
            renderLocationsList();
        }
    });
};

window.removeLocation = function(index) {
    if(nobetSettings.locations) {
        nobetSettings.locations.splice(index, 1);
        renderLocationsList();
    }
};

window.saveAdminSettings = async function() {
    nobetSettings.dutyType = $('#settingDutyType').val();
    nobetSettings.dutyDuration = $('#settingDutyDuration').val();
    nobetSettings.dutyCount = parseInt($('#settingDutyCount').val()) || 1;
    nobetSettings.rotationDir = $('#settingRotationDir').is(':checked') ? 'desc' : 'asc';
    
    Swal.fire({title:'Kaydediliyor...', didOpen:()=>Swal.showLoading()});
    try {
        await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/settings/global.json`, {
            method: 'PUT',
            body: JSON.stringify(nobetSettings)
        });
        Swal.fire('Başarılı', 'Ayarlar kaydedildi.', 'success');
    } catch(e) {
        Swal.fire('Hata', e.message, 'error');
    }
};

window.loadTeacherSettingsForm = function(uid) {
    const user = klbkUsers[uid];
    if(!user) return;
    
    $('#tsName').text(user.name || uid);
    
    const tData = teacherData[uid] || { exempt: false, fixedLoc: '' };
    
    $('#tsExempt').prop('checked', tData.exempt);
    $('#tsFixedLoc').val(tData.fixedLoc || '');
    
    $('#teacherSettingsForm').fadeIn();
};

window.saveTeacherSettings = async function() {
    const uid = $('#teacherSelect').val();
    if(!uid) return;
    
    const tData = {
        exempt: $('#tsExempt').is(':checked'),
        fixedLoc: $('#tsFixedLoc').val()
    };
    
    teacherData[uid] = tData;
    
    Swal.fire({title:'Kaydediliyor...', didOpen:()=>Swal.showLoading()});
    try {
        await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/settings/teachers/${uid}.json`, {
            method: 'PUT',
            body: JSON.stringify(tData)
        });
        Swal.fire({toast:true, position:'top-end', icon:'success', title:'Öğretmen ayarı kaydedildi.', showConfirmButton:false, timer:2000});
    } catch(e) {
        Swal.fire('Hata', e.message, 'error');
    }
};

window.generatePlan = async function() {
    Swal.fire({
        title: 'Plan Oluşturuluyor...',
        text: 'Ders yükleri ve ayarlar hesaba katılıyor',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
    
    setTimeout(async () => {
        const nextMonday = new Date();
        nextMonday.setDate(nextMonday.getDate() + (1 + 7 - nextMonday.getDay()) % 7);
        
        let newPlan = {}; // { 'YYYY-MM-DD': { 'locId': ['teacherUid'] } }
        const adminRoles = ['admin', 'master', 'idareci', 'mudur', 'mudur_basyardimcisi', 'mudur_yardimcisi'];
        let eligibleTeachersList = Object.keys(klbkUsers).filter(uid => {
            let role = (klbkUsers[uid].role || '').toLowerCase().trim();
            return uid !== 'admin' && uid !== 'master' && !adminRoles.includes(role) && !(teacherData[uid] && teacherData[uid].exempt);
        });
        
        // Track how many assignments each teacher has received this week
        let teacherAssignmentCounts = {};
        eligibleTeachersList.forEach(uid => teacherAssignmentCounts[uid] = 0);
        
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
        let dayDate = new Date(nextMonday);
        
        const scoreDayForTeacher = (uid, dayName) => {
            const s = (klbkUsers[uid] && klbkUsers[uid].schedule && klbkUsers[uid].schedule[dayName]) ? klbkUsers[uid].schedule[dayName] : null;
            if(!s) return -999; // Not at school
            
            let lessons = Object.keys(s).map(n => parseInt(n)).sort((a,b)=>a-b);
            if(lessons.length === 0) return -999;
            
            let min = lessons[0];
            let max = lessons[lessons.length-1];
            let span = max - min + 1;
            let emptyCount = span - lessons.length;
            
            let score = emptyCount * 10 + span; // Priority: max empty, then max span
            
            // Penalize if first 2 or last 2 are empty (assuming 8 periods)
            if(!s['1'] && !s['2']) score -= 50;
            if(!s['7'] && !s['8']) score -= 50;
            
            return score;
        };

        const targetDutyCount = nobetSettings.dutyCount || 1;
        const isHalf = nobetSettings.dutyDuration === 'half';
        
        for(let i=0; i<5; i++) {
            let dateStr = dayDate.toISOString().split('T')[0];
            let dayName = days[i];
            newPlan[dateStr] = {};
            
            if(nobetSettings.locations) {
                // sort locations by priority
                let sortedLocs = [...nobetSettings.locations].sort((a,b) => a.priority - b.priority);
                
                sortedLocs.forEach(loc => {
                    // if half day, we need 2 shifts per location (1. Dilim and 2. Dilim). Or we just assign normally and display it?
                    // The simplest is to create loc_1 and loc_2 under the same date
                    let shifts = isHalf ? [`${loc.id}_dilim1`, `${loc.id}_dilim2`] : [loc.id];
                    
                    shifts.forEach(shiftId => {
                        newPlan[dateStr][shiftId] = [];
                        
                        // Sort teachers by score
                        let availableToday = eligibleTeachersList.filter(uid => teacherAssignmentCounts[uid] < targetDutyCount);
                        
                        availableToday.sort((a,b) => {
                            return scoreDayForTeacher(b, dayName) - scoreDayForTeacher(a, dayName);
                        });
                        
                        for(let k=0; k<loc.reqTeachers; k++) {
                            if(availableToday.length > 0) {
                                // Must have score > -999 (at school)
                                if(scoreDayForTeacher(availableToday[0], dayName) > -500) {
                                    let chosen = availableToday.shift();
                                    newPlan[dateStr][shiftId].push(chosen);
                                    teacherAssignmentCounts[chosen]++;
                                }
                            }
                        }
                    });
                });
            }
            dayDate.setDate(dayDate.getDate() + 1);
        }
        
        currentWeekPlan = newPlan;
        
        // Save to Firebase
        try {
            await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/plans.json`, {
                method: 'PUT',
                body: JSON.stringify(newPlan)
            });
            Swal.fire('Başarılı', 'Haftalık plan oluşturuldu ve kaydedildi.', 'success');
            renderWeeklyPlan();
        } catch(e) {
            Swal.fire('Hata', 'Plan kaydedilemedi: ' + e.message, 'error');
        }
    }, 1500);
};

function renderWeeklyPlan() {
    let html = '';
    const daysTr = {'Pazartesi':0, 'Salı':1, 'Çarşamba':2, 'Perşembe':3, 'Cuma':4};
    
    if(Object.keys(currentWeekPlan).length === 0) {
        $('#weeklyPlanContainer').html('<p style="color:var(--gray-500);">Plan bulunmuyor.</p>');
        return;
    }
    
    for(let dateStr in currentWeekPlan) {
        let dateObj = new Date(dateStr);
        let trDay = Object.keys(daysTr)[dateObj.getDay()-1] || '';
        
        html += `<h3 style="margin-top:20px; border-bottom:1px solid var(--gray-200); padding-bottom:5px;">${dateStr} (${trDay})</h3>`;
        
        for(let shiftId in currentWeekPlan[dateStr]) {
            let isDilim1 = shiftId.includes('_dilim1');
            let isDilim2 = shiftId.includes('_dilim2');
            let locId = shiftId.replace('_dilim1', '').replace('_dilim2', '');
            
            let locInfo = nobetSettings.locations?.find(l => l.id === locId);
            let locName = locInfo ? locInfo.name : locId;
            if(isDilim1) locName += " (1. Dilim)";
            if(isDilim2) locName += " (2. Dilim)";
            
            let teachersList = currentWeekPlan[dateStr][shiftId].map(uid => klbkUsers[uid]?.name || uid).join(', ');
            
            html += `
                <div class="item-row" style="margin-bottom:5px; background:var(--white);">
                    <span style="font-weight:600; color:var(--primary-dark); width: 150px;">${locName}</span>
                    <span style="flex:1;">${teachersList || 'Atanmadı'}</span>
                </div>
            `;
        }
    }
    $('#weeklyPlanContainer').html(html);
}

function updateTeacherViewUI() {
    if(isAdmin) renderWeeklyPlan(); // If admin, render plan view too
    
    const today = new Date().toISOString().split('T')[0];
    let isDutyToday = false;
    let todayLocName = "";
    let nextDutyDate = null;
    let nextDutyLoc = "";

    // Search plan for user
    let dates = Object.keys(currentWeekPlan).sort();
    
    for(let dateStr of dates) {
        for(let shiftId in currentWeekPlan[dateStr]) {
            if(currentWeekPlan[dateStr][shiftId].includes(currentUser.username)) {
                let isDilim1 = shiftId.includes('_dilim1');
                let isDilim2 = shiftId.includes('_dilim2');
                let locId = shiftId.replace('_dilim1', '').replace('_dilim2', '');
                
                let locInfo = nobetSettings.locations?.find(l => l.id === locId);
                let lName = locInfo ? locInfo.name : locId;
                if(isDilim1) lName += " (1. Dilim)";
                if(isDilim2) lName += " (2. Dilim)";
                
                if(dateStr === today) {
                    isDutyToday = true;
                    todayLocName = lName;
                } else if(dateStr > today && !nextDutyDate) {
                    nextDutyDate = dateStr;
                    nextDutyLoc = lName;
                }
            }
        }
    }

    if(isDutyToday) {
        $('#noDutyState').hide();
        $('#activeDutyState').show();
        $('#activeDutyLocation').text(todayLocName);
    } else {
        $('#activeDutyState').hide();
        $('#noDutyState').show();
        if(nextDutyDate) {
            $('#nextDutyDateStr').text(`${nextDutyDate} (${nextDutyLoc})`);
        } else {
            $('#nextDutyDateStr').text("Planlanmış nöbetiniz bulunmuyor.");
        }
    }
}

window.showIncidentForm = function() {
    $('#incidentSection').slideDown();
    document.getElementById('incidentSection').scrollIntoView({behavior: "smooth"});
};

window.hideIncidentForm = function() {
    $('#incidentSection').slideUp();
    $('#incidentForm')[0].reset();
    $('#incTeachers').val(null).trigger('change');
};

async function submitIncident() {
    const time = $('#incTime').val();
    const students = $('#incStudents').val() || [];
    const studentsStr = students.join(', ');
    const teachers = $('#incTeachers').val() || [];
    const desc = $('#incDesc').val();
    
    const today = new Date().toISOString().split('T')[0];
    
    const incidentData = {
        date: today,
        time: time,
        reporterId: currentUser.username,
        reporterName: currentUser.name,
        students: studentsStr,
        involvedTeachers: teachers,
        description: desc,
        timestamp: Date.now()
    };
    
    Swal.fire({title:'Gönderiliyor...', didOpen:()=>Swal.showLoading()});
    try {
        await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/incidents/${Date.now()}.json`, {
            method: 'PUT',
            body: JSON.stringify(incidentData)
        });
        Swal.fire('Başarılı', 'Tutanak kaydedildi.', 'success');
        hideIncidentForm();
        if(isAdmin) loadIncidents();
    } catch(e) {
        Swal.fire('Hata', 'Gönderilemedi: ' + e.message, 'error');
    }
}

async function loadIncidents() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/incidents.json`);
        if(res.ok) {
            const data = await res.json();
            if(data) {
                let html = '';
                const keys = Object.keys(data).sort().reverse(); // newest first
                keys.forEach(k => {
                    const inc = data[k];
                    let tNames = (inc.involvedTeachers || []).map(uid => klbkUsers[uid]?.name || uid).join(', ');
                    html += `
                        <div class="item-row" style="flex-direction:column; align-items:flex-start; gap:10px;">
                            <div style="width:100%; display:flex; justify-content:space-between; border-bottom:1px solid var(--gray-200); padding-bottom:5px;">
                                <strong style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> ${inc.date} - ${inc.time}</strong>
                                <small style="color:var(--gray-500);">Bildiren: ${inc.reporterName}</small>
                            </div>
                            <div style="font-size:0.9rem;">
                                <strong>Öğrenciler:</strong> ${inc.students}<br>
                                ${tNames ? `<strong>Öğretmenler:</strong> ${tNames}<br>` : ''}
                                <p style="margin-top:10px; background:var(--gray-50); padding:10px; border-radius:8px; border:1px solid var(--gray-200);">${inc.description}</p>
                            </div>
                        </div>
                    `;
                });
                $('#incidentsList').html(html);
            }
        }
    } catch(e) {
        console.error('Tutanaklar yüklenirken hata', e);
    }
}
