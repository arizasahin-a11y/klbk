/* js/dt_app.js */
const FIREBASE_DB_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
let klbkUsers = {};
let nobetSettings = {
    dutyType: 'weekly', // 'weekly', 'monthly', 'fixed'
    dutyDuration: 'full', // 'full', 'half'
    dutyCount: 1,
    adminCount: 1,
    rotationDir: 'asc', // 'asc' or 'desc'
    locations: []
};
let nobetSettingsProfiles = {}; // { profileId: { name: '...', settings: {...} } }
let teacherData = {}; // teacher specific settings: { [uid]: { exempt: false, fixedLoc: '' } }
let currentUser = null;
let isAdmin = false;
let currentWeekPlan = {}; // { dateStr: { locationId: userId } }
let allNobetPlans = {};
let publishedPlanMeta = null;
let viewingPlanId = null;
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
            username: sessionStorage.getItem('klbk_currentUser') || localStorage.getItem('klbk_currentUser') || sessionStorage.getItem('klbk_username') || localStorage.getItem('klbk_username'),
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
            let finalUsername = data.actualUsername || username;
            
            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('klbk_isLoggedIn', 'true');
            storage.setItem('klbk_faaliyet_isLoggedIn', 'true');
            storage.setItem('klbk_username', finalUsername);
            storage.setItem('klbk_currentUser', finalUsername);
            
            let matchedRole = (data.user && data.user.role) ? data.user.role : (data.role || 'user');
            let matchedName = (data.user && data.user.name) ? data.user.name : (data.name || finalUsername);
            let token = data.token || (data.user && data.user.token) || 'legacy-session';
            let storeKey = (data.user && data.user.storeKey) ? data.user.storeKey : `klbk_data_${finalUsername}`;
            let schoolName = (data.user && data.user.schoolName) ? data.user.schoolName : '';
            
            storage.setItem('klbk_name', matchedName);
            storage.setItem('klbk_role', matchedRole);
            storage.setItem('klbk_session_token', token);
            storage.setItem('klbk_storeKey', storeKey);
            storage.setItem('klbk_schoolName', schoolName);
            
            if (data.user && data.user.branch) {
                storage.setItem('klbk_branch', data.user.branch);
            }
            
            if (remember && matchedRole !== 'student' && matchedRole !== 'ogrenci') {
                const sessionData = {
                    klbk_currentUser: finalUsername,
                    klbk_name: matchedName,
                    klbk_schoolName: schoolName,
                    klbk_storeKey: storeKey,
                    klbk_role: matchedRole,
                    klbk_loginTime: new Date().toISOString()
                };
                if (data.user && data.user.branch) {
                    sessionData.klbk_branch = data.user.branch;
                }
                localStorage.setItem('klbk_persistent_session', JSON.stringify(sessionData));
                localStorage.setItem('klbk_rememberedUser', finalUsername);
            } else {
                localStorage.removeItem('klbk_persistent_session');
                localStorage.removeItem('klbk_rememberedUser');
            }
            
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
    localStorage.removeItem('klbk_faaliyet_isLoggedIn');
    localStorage.removeItem('klbk_username');
    localStorage.removeItem('klbk_currentUser');
    localStorage.removeItem('klbk_name');
    localStorage.removeItem('klbk_role');
    localStorage.removeItem('klbk_session_token');
    localStorage.removeItem('klbk_storeKey');
    localStorage.removeItem('klbk_schoolName');
    localStorage.removeItem('klbk_branch');
    localStorage.removeItem('klbk_persistent_session');
    localStorage.removeItem('klbk_rememberedUser');
    window.location.reload();
}

function buildTabs() {
    let tabsHtml = '';
    
    if (isAdmin) {
        tabsHtml += `
            <button class="tab-btn" onclick="switchTab('teacher-active', this)"><i class="fa-solid fa-user-shield"></i> Nöbet Durumum</button>
            <button class="tab-btn" onclick="switchTab('admin-settings', this)"><i class="fa-solid fa-cogs"></i> Ayarlar</button>
            <button class="tab-btn active" onclick="switchTab('admin-plan', this)"><i class="fa-solid fa-calendar-alt"></i> Planlama</button>
            <button class="tab-btn" onclick="switchTab('admin-incidents', this)"><i class="fa-solid fa-folder-open"></i> Tutanaklar</button>
        `;
    } else {
        tabsHtml += `<button class="tab-btn active" onclick="switchTab('teacher-active', this)"><i class="fa-solid fa-user-shield"></i> Nöbet Durumum</button>`;
    }
    
    $('#mainTabs').html(tabsHtml);
    
    if (isAdmin) {
        switchTab('admin-plan', $('.tab-btn.active')[0]);
    } else {
        switchTab('teacher-active', $('.tab-btn.active')[0]);
    }
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
        const usersRes = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_users.json?_=${Date.now()}`);
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

        const settingsRes = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/settings.json?_=${Date.now()}`); // if db rules allow, else we need a proxy API. Assuming db rules allow authenticated read.
        if (settingsRes.ok) {
            const data = await settingsRes.json();
            if (data) {
                if(data.global) {
                    if(typeof data.global === 'string') {
                        try { nobetSettings = JSON.parse(data.global); } catch(e) { console.error("Could not parse global settings"); }
                    } else {
                        nobetSettings = data.global;
                    }
                }
                if(data.profiles) {
                    nobetSettingsProfiles = data.profiles;
                }
                if(data.teachers) {
                    if(typeof data.teachers === 'string') {
                        try { teacherData = JSON.parse(data.teachers); } catch(e) { console.error("Could not parse teacher settings"); }
                    } else {
                        teacherData = data.teachers;
                    }
                }
            }
        }
        
        const pubRes = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/publishedPlan.json?_=${Date.now()}`);
        if (pubRes.ok) {
            const p = await pubRes.json();
            if (p && typeof p === 'object') {
                if (p.data) {
                    // CORRUPTION FIX: Remove mistakenly nested plans inside the published data
                    publishedPlanMeta = p;
                    if (!isAdmin) {
                        currentWeekPlan = applyDynamicRotation(p.data, p.startDate, nobetSettings.dutyType || 'fixed');
                    } else {
                        currentWeekPlan = p.data;
                    }
                } else {
                    currentWeekPlan = p; // backward compat if saved directly
                }
            }
        }
        
        const plansRes = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/plans.json?_=${Date.now()}`);
        if (plansRes.ok) {
            const plans = await plansRes.json();
            if (plans) {
                if(typeof plans === 'string') {
                    try { 
                        let pd = JSON.parse(plans);
                        allNobetPlans = { 'plan_legacy': { data: pd, status: 'published', createdAt: new Date().toISOString() } };
                        if(!publishedPlanMeta) { currentWeekPlan = pd; viewingPlanId = 'plan_legacy'; }
                    } catch(e) { console.error("Could not parse plans"); }
                } else if (plans.Pazartesi || Object.values(plans).some(v => typeof v === 'object' && !v.data)) {
                    // It's the old plan format directly in plans
                    allNobetPlans = { 'plan_legacy': { data: plans, status: 'published', createdAt: new Date().toISOString() } };
                    if(!publishedPlanMeta) { currentWeekPlan = plans; viewingPlanId = 'plan_legacy'; }
                } else {
                    allNobetPlans = plans;
                    
                    // CORRUPTION FIX: Extract mistakenly nested plans (e.g. inside plan_legacy.data)
                    for (let pk in allNobetPlans) {
                        let p = allNobetPlans[pk];
                        if (p && p.data && typeof p.data === 'object') {
                            for (let subK in p.data) {
                                if (subK.startsWith('plan_') && p.data[subK] && p.data[subK].createdAt) {
                                    allNobetPlans[subK] = p.data[subK];
                                    delete p.data[subK];
                                }
                            }
                        }
                    }
                    
                    // Set default viewing plan for admin
                    let planKeys = Object.keys(allNobetPlans).sort().reverse();
                    if(planKeys.length > 0) {
                        let publishedKey = planKeys.find(k => allNobetPlans[k].status === 'published');
                        viewingPlanId = publishedKey || planKeys[0];
                    }
                }
            }
        }
        
        // If not admin, teacher only sees published
        if(isAdmin && viewingPlanId && allNobetPlans[viewingPlanId]) {
            currentWeekPlan = allNobetPlans[viewingPlanId].data;
        }

        populateTeacherDropdowns();
        updateAdminSettingsUI();
        updateTeacherViewUI();
        if(isAdmin) {
            loadIncidents();
        } else {
            loadTeacherIncidents();
        }

        Swal.close();
    } catch(e) {
        console.error(e);
        Swal.fire('Hata', 'Veriler yüklenirken hata oluştu: ' + e.message, 'error');
    }
}

function populateTeacherDropdowns() {
    try {
        let options = '<option value="">-- Öğretmen Seç --</option>';
        let teacherArr = [];
        const adminRoles = ['admin', 'master', 'idareci', 'mudur', 'mudur_basyardimcisi', 'mudur_yardimcisi'];
        
        for(let uid in klbkUsers) {
            let role = (klbkUsers[uid].role || '').toLowerCase().trim();
            let isSystemAccount = uid.startsWith('admin') || uid.startsWith('master') || uid.startsWith('device_assign') || uid.startsWith('@');
            if(!isSystemAccount && !adminRoles.includes(role)) {
                let tData = teacherData[uid] || { exempt: false, fixedLoc: '' };
                teacherArr.push({ 
                    id: uid, 
                    text: klbkUsers[uid].name || uid,
                    exempt: tData.exempt,
                    fixedLoc: tData.fixedLoc
                });
            }
        }
        
        // Sort: Exempt at bottom, then alphabetical
        teacherArr.sort((a,b) => {
            if(a.exempt && !b.exempt) return 1;
            if(!a.exempt && b.exempt) return -1;
            return (a.text || '').localeCompare(b.text || '');
        });
        
        let statusListHtml = '';

        teacherArr.forEach(t => {
            let color = '';
            let displayText = t.text;
            
            if(t.exempt) {
                color = 'red';
                statusListHtml += `<li style="color: red; padding: 3px 0; border-bottom: 1px dashed var(--gray-200);"><i class="fa-solid fa-ban"></i> ${t.text} (Nöbetten Muaf)</li>`;
            } else if(t.fixedLoc) {
                color = 'green';
                let locName = t.fixedLoc;
                // Safely check if locations exists and is an array
                if(nobetSettings && Array.isArray(nobetSettings.locations)) {
                    let locObj = nobetSettings.locations.find(l => l.id === t.fixedLoc);
                    if(locObj) locName = locObj.name;
                }
                displayText += ` (${locName})`;
                statusListHtml += `<li style="color: green; padding: 3px 0; border-bottom: 1px dashed var(--gray-200);"><i class="fa-solid fa-thumbtack"></i> ${t.text} (Sabit Yeri: ${locName})</li>`;
            }
            
            options += `<option value="${t.id}" data-color="${color}">${displayText}</option>`;
        });
        
        if (statusListHtml === '') {
            statusListHtml = '<li style="color: var(--gray-500); font-style: italic;">Özel durumlu öğretmen bulunmuyor.</li>';
        }
        
        if ($('#teacherStatusList').length === 0) {
            $('#teacherSettingsForm').after(`
                <div id="teacherStatusContainer" style="margin-top: 20px; background: rgba(255,255,255,0.5); padding: 15px; border-radius: 12px; border: 1px solid var(--gray-200);">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--primary); border-bottom: 1px solid var(--gray-200); padding-bottom: 5px;">Özel Durumlu Öğretmenler</h4>
                    <ul id="teacherStatusList" style="list-style: none; padding: 0; margin: 0; font-size: 14px; line-height: 1.6;">
                    </ul>
                </div>
            `);
        }
        
        $('#teacherStatusList').html(statusListHtml);

        if ($('.select2-teachers').hasClass("select2-hidden-accessible")) {
            $('.select2-teachers').select2('destroy');
        }

        $('#teacherSelect').html(options);
        $('#incTeachers').html(options); // multiple select
        
        const formatState = function (state) {
            if (!state.id) return state.text;
            let color = '';
            if (state.element) {
                color = $(state.element).attr('data-color');
            }
            if (!color) return state.text;
            return $(`<span style="color: ${color}; font-weight: 500;">${state.text}</span>`);
        };

        $('.select2-teachers').select2({
            templateResult: formatState,
            templateSelection: formatState
        });
    } catch (err) {
        console.error("Dropdown error:", err);
    }
}

function populateStudentDropdown() {
    let classGroups = {};
    studentsList.forEach(s => {
        let cName = s.class || 'Bilinmiyor';
        if (!classGroups[cName]) classGroups[cName] = [];
        classGroups[cName].push(s);
    });

    let sortedClasses = Object.keys(classGroups).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)) || 0;
        const numB = parseInt(b.match(/\d+/)) || 0;
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
    });

    let classHtml = '<option value="">-- Sınıf Seç --</option>';
    sortedClasses.forEach(cName => {
        classHtml += `<option value="${cName}">${cName}</option>`;
    });

    $('#incClassSelect').html(classHtml);
    $('.select2-students').select2({
        placeholder: '-- Önce Sınıf Seçin --',
        allowClear: true
    });

    $('#incClassSelect').off('change').on('change', function() {
        const selectedClass = $(this).val();
        let studentHtml = '';
        
        if (selectedClass && classGroups[selectedClass]) {
            let studentsInClass = classGroups[selectedClass];
            studentsInClass.sort((a, b) => {
                const noA = parseInt(a.no) || 0;
                const noB = parseInt(b.no) || 0;
                return noA - noB;
            });

            studentsInClass.forEach(s => {
                const displayName = `${s.name || ''} ${s.surname || ''}`.trim();
                const idVal = `${selectedClass} - ${s.no} - ${displayName}`;
                const textVal = `${s.no} - ${displayName}`;
                studentHtml += `<option value="${idVal}">${textVal}</option>`;
            });
            
            $('.select2-students').select2({
                placeholder: '-- Öğrenci Seç (Arama Yapabilirsiniz) --',
                allowClear: true
            });
        } else {
            $('.select2-students').select2({
                placeholder: '-- Önce Sınıf Seçin --',
                allowClear: true
            });
        }
        
        $('#incStudents').html(studentHtml).val(null).trigger('change');
    });
}

function updateAdminSettingsUI() {
    $('#settingPlanName').val(nobetSettings.planName || '');
    $('#settingDutyType').val(nobetSettings.dutyType || 'weekly').trigger('change');
    $('#settingDutyDuration').val(nobetSettings.dutyDuration || 'full');
    $('#settingDutyCount').val(nobetSettings.dutyCount || 1);
    $('#settingAdminCount').val(nobetSettings.adminCount !== undefined ? nobetSettings.adminCount : 1);
    $('#settingRotationDir').prop('checked', nobetSettings.rotationDir === 'desc').trigger('change');
    renderLocationsList();
    renderSettingsProfilesList();
    populatePlanArchiveDropdown();
}

window.renderSettingsProfilesList = function() {
    let html = '';
    let keys = Object.keys(nobetSettingsProfiles);
    if(keys.length === 0) {
        html = '<p style="color:var(--gray-500); text-align:center; padding: 10px;">Kaydedilmiş profil yok.</p>';
    } else {
        keys.forEach(k => {
            let prof = nobetSettingsProfiles[k];
            let name = prof.planName || 'Adsız Profil';
            let type = prof.dutyType === 'fixed' ? 'Sabit' : (prof.dutyType === 'monthly' ? 'Aylık' : 'Haftalık');
            html += `
                <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border-radius:6px; margin-bottom:5px; border:1px solid #e2e8f0;">
                    <div>
                        <strong style="display:block;">${name}</strong>
                        <small style="color:var(--gray-500);">${type} - ${prof.dutyDuration === 'half' ? 'Yarım Gün' : 'Tam Gün'}</small>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-primary" onclick="loadSettingsProfile('${k}')" style="padding:4px 8px; font-size:12px; margin-right:5px;"><i class="fa-solid fa-download"></i> Yükle</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSettingsProfile('${k}')" style="padding:4px 8px; font-size:12px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    }
    $('#settingsProfilesList').html(html);
};

window.loadSettingsProfile = function(k) {
    if(nobetSettingsProfiles[k]) {
        nobetSettings = JSON.parse(JSON.stringify(nobetSettingsProfiles[k]));
        updateAdminSettingsUI();
        Swal.fire({title: 'Yüklendi', text: 'Ayar profili yüklendi', icon: 'success', timer: 1500, showConfirmButton: false});
    }
};

window.deleteSettingsProfile = async function(k) {
    const { isConfirmed } = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Bu profil silinecektir!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Evet, Sil!',
        cancelButtonText: 'İptal'
    });
    if(!isConfirmed) return;
    
    delete nobetSettingsProfiles[k];
    renderSettingsProfilesList();
    
    await fetch('/api/updateNobet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path: `settings/profiles/${k}`
        })
    });
};

window.populatePlanArchiveDropdown = () => {
    let html = '';
    let planKeys = Object.keys(allNobetPlans).sort().reverse();
    if(planKeys.length === 0) {
        html = '<option value="">Plan Bulunmuyor</option>';
    } else {
        planKeys.forEach(pid => {
            let p = allNobetPlans[pid];
            let dateStr = new Date(p.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
            let planNameText = p.planName ? p.planName : `Adsız Plan | ${dateStr}`;
            let formattedStartDate = 'Tarih Yok';
            if (p.startDate) {
                let d = new Date(p.startDate);
                if (!isNaN(d.getTime())) {
                    formattedStartDate = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth()+1).padStart(2, '0') + '.' + d.getFullYear();
                } else {
                    formattedStartDate = p.startDate;
                }
            }
            let statusText = p.status === 'published' ? `(YAYINDA: ${formattedStartDate})` : '(TASLAK)';
            let optionStyle = p.status === 'published' ? 'font-weight: bold; color: #16a34a;' : '';
            html += `<option value="${pid}" style="${optionStyle}">${planNameText} - ${statusText}</option>`;
        });
    }
    $('#planArchiveSelect').html(html);
    if(viewingPlanId) $('#planArchiveSelect').val(viewingPlanId);
    
    updatePlanActionButtons();
};

window.updatePlanActionButtons = () => {
    if(!viewingPlanId || !allNobetPlans[viewingPlanId]) {
        $('#planActionToggleGroup').hide();
        $('#deletePlanBtn').hide();
        $('#planStatusBanner').hide();
        currentWeekPlan = null;
        if(isAdmin) renderWeeklyPlan();
        return;
    }
    
    $('#planActionToggleGroup').css('display', 'flex');
    $('#deletePlanBtn').show();
    let p = allNobetPlans[viewingPlanId];
    
    // Reset buttons
    $('#togglePublishBtn, #toggleDraftBtn, #toggleArchiveBtn').css({
        background: 'white',
        color: '#64748b',
        opacity: '1',
        pointerEvents: 'auto'
    });
    $('#deletePlanBtn').css({ opacity: '1', pointerEvents: 'auto' });
    
    if(!p.status) p.status = 'draft';
    
    // Style select dropdown based on selected status
    if (p.status === 'published') {
        $('#planArchiveSelect').css({ 'font-weight': 'bold', 'color': '#16a34a', 'border-color': '#16a34a', 'background-color': '#f0fdf4' });
    } else {
        $('#planArchiveSelect').css({ 'font-weight': 'normal', 'color': 'inherit', 'border-color': '#cbd5e1', 'background-color': 'white' });
    }
    
    if(p.status === 'published') {
        $('#togglePublishBtn').html('<i class="fa-solid fa-pen"></i> Tarihi Güncelle').css({ background: '#10b981', color: 'white' });
        $('#toggleDraftBtn').html('<i class="fa-solid fa-pen-ruler"></i> Taslak Yap');
        $('#deletePlanBtn').css({ opacity: '0.5' }); // Visual disabled state only, click will show alert
    } else if (p.status === 'archived') {
        $('#togglePublishBtn').html('<i class="fa-solid fa-bullhorn"></i> Yayınla');
        $('#toggleDraftBtn').html('<i class="fa-solid fa-pen-ruler"></i> Taslak Yap');
        $('#toggleArchiveBtn').css({ background: '#64748b', color: 'white' });
    } else {
        $('#togglePublishBtn').html('<i class="fa-solid fa-bullhorn"></i> Yayınla');
        $('#toggleDraftBtn').css({ background: '#f59e0b', color: 'white' });
    }
    
    // Banner Logic
    if (p.status === 'published' && p.startDate) {
        let dutyType = p.dutyType || nobetSettings.dutyType || 'fixed';
        let startDate = new Date(p.startDate);
        let bannerText = "";
        
        let formatStr = (d) => {
            let day = String(d.getDate()).padStart(2, '0');
            let month = String(d.getMonth()+1).padStart(2, '0');
            let year = d.getFullYear();
            const days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
            return `${day}.${month}.${year} ${days[d.getDay()]}`;
        };
        
        let currentDate = new Date();
        let diffTime = currentDate.getTime() - startDate.getTime();
        let weeksPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (weeksPassed < 0) weeksPassed = 0;
        
        if (dutyType === 'fixed') {
            bannerText = `${formatStr(startDate)} tarihinden itibaren geçerlidir.`;
        } else {
            let cycleWeeks = dutyType === 'monthly' ? 4 : 1;
            
            // For monthly, the "current cycle" starts every 4 weeks. So we calculate how many cycles passed.
            let cyclesPassed = Math.floor(weeksPassed / cycleWeeks);
            let currentCycleStart = new Date(startDate.getTime());
            currentCycleStart.setDate(currentCycleStart.getDate() + (cyclesPassed * cycleWeeks * 7));
            
            let currentCycleEnd = new Date(currentCycleStart.getTime());
            // Move to Friday of the final week of the cycle
            currentCycleEnd.setDate(currentCycleEnd.getDate() + ((cycleWeeks - 1) * 7) + 4);
            
            bannerText = `${formatStr(currentCycleStart)} - ${formatStr(currentCycleEnd)} arasında geçerlidir.`;
        }
        
        let typeName = dutyType === 'monthly' ? 'Aylık Dönüşümlü' : (dutyType === 'fixed' ? 'Sabit' : 'Haftalık Dönüşümlü');
        $('#planStatusBanner').html(`<i class="fa-solid fa-calendar-check"></i> <b>Bu plan yayında. (${typeName})</b> ${bannerText}`).css({background: '#d1fae5', color: '#065f46'}).show();
    } else if (p.status === 'archived') {
        $('#planStatusBanner').html(`<i class="fa-solid fa-box-archive"></i> Bu plan ARŞİVLENMİŞ durumdadır. Öğretmenler tarafından görülmüyor.`).css({background: '#e2e8f0', color: '#475569'}).show();
    } else {
        $('#planStatusBanner').html(`<i class="fa-solid fa-triangle-exclamation"></i> Bu plan henüz TASLAK aşamasındadır. Öğretmenler tarafından görülmüyor.`).css({background: '#fef3c7', color: '#92400e'}).show();
    }
    
    let activeDutyType = p.dutyType || nobetSettings.dutyType || 'fixed';
    currentWeekPlan = applyDynamicRotation(p.data, p.startDate, activeDutyType);
    if(isAdmin) renderWeeklyPlan();
};

window.loadSelectedPlan = () => {
    viewingPlanId = $('#planArchiveSelect').val();
    updatePlanActionButtons();
};

window.changePlanStatus = async (newStatus) => {
    if(!viewingPlanId || !allNobetPlans[viewingPlanId]) return;
    let p = allNobetPlans[viewingPlanId];
    
    // If it's already in the requested state (and not published, where we might want to update the date), do nothing
    if (p.status === newStatus && newStatus !== 'published') return;

    if (newStatus === 'published') {
        const { value: startDate } = await Swal.fire({
            title: 'İlk Uygulama Tarihi',
            input: 'date',
            inputLabel: 'Bu plan hangi tarihten itibaren geçerli olacak?',
            showCancelButton: true,
            confirmButtonText: 'Yayınla',
            cancelButtonText: 'İptal',
            inputValidator: (value) => {
                if (!value) {
                    return 'Lütfen bir tarih giriniz!';
                }
            }
        });
        
        if (startDate) {
            // Update all plans status to archived if they were published
            Object.keys(allNobetPlans).forEach(k => {
                if (allNobetPlans[k].status === 'published') {
                    allNobetPlans[k].status = 'archived';
                }
            });
            
            p.status = 'published';
            p.startDate = startDate;
            publishedPlanMeta = p;
            
            try {
                await fetch('/api/updateNobet', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'plans', data: allNobetPlans })
                });
                await fetch('/api/updateNobet', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'publishedPlan', data: p })
                });
                populatePlanArchiveDropdown();
                Swal.fire('Yayınlandı!', 'Plan başarıyla yayına alındı.', 'success');
            } catch(e) {
                Swal.fire('Hata', 'İşlem sırasında bir hata oluştu: ' + e.message, 'error');
            }
        }
    } else {
        // Draft or Archived
        const actionName = newStatus === 'draft' ? 'Taslak Yap' : 'Arşivle';
        const { isConfirmed } = await Swal.fire({
            title: actionName,
            text: `Bu planı ${newStatus === 'draft' ? 'taslak' : 'arşiv'} durumuna getirmek istediğinize emin misiniz? Eğer bu plan yayındaysa yayından kaldırılacaktır.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet',
            cancelButtonText: 'İptal'
        });
        
        if (isConfirmed) {
            p.status = newStatus;
            
            try {
                await fetch('/api/updateNobet', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'plans', data: allNobetPlans })
                });
                
                // If this was the published plan, remove it from publishedPlan
                if (publishedPlanMeta && publishedPlanMeta.createdAt === p.createdAt) {
                    publishedPlanMeta = null;
                    await fetch('/api/updateNobet', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: 'publishedPlan' })
                    });
                }
                
                populatePlanArchiveDropdown();
                Swal.fire('Başarılı', `Plan durumu güncellendi.`, 'success');
            } catch(e) {
                Swal.fire('Hata', 'İşlem sırasında bir hata oluştu: ' + e.message, 'error');
            }
        }
    }
};

window.deleteCurrentPlan = async () => {
    if(!viewingPlanId || !allNobetPlans[viewingPlanId]) return;
    
    let p = allNobetPlans[viewingPlanId];
    if(p.status === 'published') {
        Swal.fire('Hata', 'Yayında olan bir planı silemezsiniz. Önce başka bir planı yayınlayın.', 'error');
        return;
    }
    
    const { isConfirmed } = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Bu plan arşivi kalıcı olarak silinecektir!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, Sil!',
        cancelButtonText: 'İptal'
    });
    
    if(isConfirmed) {
        try {
            await fetch('/api/updateNobet', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: `plans/${viewingPlanId}`
                })
            });
            
            delete allNobetPlans[viewingPlanId];
            viewingPlanId = null;
            
            // Re-select highest plan if possible
            let planKeys = Object.keys(allNobetPlans).sort().reverse();
            if(planKeys.length > 0) viewingPlanId = planKeys[0];
            
            populatePlanArchiveDropdown();
            loadSelectedPlan();
            Swal.fire('Silindi', 'Plan arşivden silindi.', 'success');
        } catch(e) {
            Swal.fire('Hata', 'Silinirken bir hata oluştu: ' + e.message, 'error');
        }
    }
};

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
    nobetSettings = (typeof nobetSettings === 'string') ? {} : nobetSettings; // recovery if it was corrupted
    
    nobetSettings.planName = $('#settingPlanName').val().trim();
    nobetSettings.dutyType = $('#settingDutyType').val();
    nobetSettings.dutyDuration = $('#settingDutyDuration').val();
    nobetSettings.dutyCount = parseInt($('#settingDutyCount').val()) || 1;
    nobetSettings.adminCount = parseInt($('#settingAdminCount').val()) || 0;
    nobetSettings.rotationDir = $('#settingRotationDir').is(':checked') ? 'desc' : 'asc';
    
    Swal.fire({title:'Kaydediliyor...', didOpen:()=>Swal.showLoading()});
    try {
        const res = await fetch('/api/updateNobet', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: 'settings/global',
                data: nobetSettings
            })
        });
        
        let pId = nobetSettings.planName ? 'prof_' + nobetSettings.planName.replace(/[^a-zA-Z0-9]/g, '_') : 'prof_default';
        nobetSettingsProfiles[pId] = JSON.parse(JSON.stringify(nobetSettings));
        await fetch('/api/updateNobet', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: `settings/profiles/${pId}`,
                data: nobetSettings
            })
        });
        
        renderSettingsProfilesList();
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'API Error');
        }
        
        Swal.fire('Başarılı', 'Ayarlar kaydedildi.', 'success');
    } catch(e) {
        Swal.fire('Hata', 'Ayarlar kaydedilirken hata oluştu: ' + e.message, 'error');
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
    
    teacherData = (typeof teacherData === 'string') ? {} : teacherData;
    teacherData[uid] = tData;
    
    Swal.fire({title:'Kaydediliyor...', didOpen:()=>Swal.showLoading()});
    try {
        const res = await fetch('/api/updateNobet', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: `settings/teachers/${uid}`,
                data: tData
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'API Error');
        }

        $('#teacherSettingsForm').fadeOut();
        
        // RE-POPULATE THE DROPDOWN AND LIST SO IT UPDATES INSTANTLY
        populateTeacherDropdowns();
        
        Swal.fire('Başarılı', 'Öğretmen ayarları kaydedildi.', 'success');
    } catch(e) {
        Swal.fire('Hata', 'Ayarlar kaydedilirken hata oluştu: ' + e.message, 'error');
    }
};

window.generatePlan = async function() {
    let profileOptions = `<option value="active">-- Mevcut Ekran Ayarları --</option>`;
    Object.keys(nobetSettingsProfiles).forEach(k => {
        let prof = nobetSettingsProfiles[k];
        let name = prof.planName || 'Adsız Profil';
        profileOptions += `<option value="${k}">${name}</option>`;
    });

    let basePlanName = nobetSettings.planName || 'Yeni Plan';
    
    const { value: formValues, isConfirmed } = await Swal.fire({
        title: 'Yeni Plan Oluştur',
        html: `
            <div style="text-align: left; margin-bottom: 15px;">
                <label style="font-weight: bold; font-size:14px;">Ayar Profili Seçin:</label>
                <select id="swal-profile-select" class="swal2-select" style="width: 100%; font-size:14px; margin-top:5px; padding:8px;">
                    ${profileOptions}
                </select>
            </div>
            <div style="text-align: left;">
                <label style="font-weight: bold; font-size:14px;">Plan Adı (Tarih eklenecek):</label>
                <input id="swal-plan-name" class="swal2-input" value="${basePlanName}" style="margin-top: 5px; width: 90%; font-size:15px;">
            </div>
        `,
        didOpen: () => {
            document.getElementById('swal-profile-select').addEventListener('change', (e) => {
                let k = e.target.value;
                if(k === 'active') {
                    document.getElementById('swal-plan-name').value = nobetSettings.planName || 'Yeni Plan';
                } else if(nobetSettingsProfiles[k]) {
                    document.getElementById('swal-plan-name').value = nobetSettingsProfiles[k].planName || 'Yeni Plan';
                }
            });
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-bolt"></i> Oluştur',
        cancelButtonText: 'İptal',
        preConfirm: () => {
            return {
                planName: document.getElementById('swal-plan-name').value.trim() || 'Adsız Plan',
                profileId: document.getElementById('swal-profile-select').value
            };
        }
    });

    if (!isConfirmed) return;
    
    let selectedSettings = nobetSettings;
    if (formValues.profileId !== 'active' && nobetSettingsProfiles[formValues.profileId]) {
        selectedSettings = nobetSettingsProfiles[formValues.profileId];
    }
    window._tempGenSettings = selectedSettings;
    
    let now = new Date();
    let timeStr = String(now.getDate()).padStart(2,'0') + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + now.getFullYear() + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    window._tempFinalPlanName = formValues.planName + ' - ' + timeStr;

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
        const realAdminRoles = ['idareci', 'mudur', 'mudur_basyardimcisi', 'mudur_yardimcisi']; // exclude master/admin sys accounts

        let eligibleTeachersList = Object.keys(klbkUsers).filter(uid => {
            let role = (klbkUsers[uid].role || '').toLowerCase().trim();
            let isSystemAccount = uid.startsWith('admin') || uid.startsWith('master') || uid.startsWith('device_assign') || uid.startsWith('@');
            return !isSystemAccount && !adminRoles.includes(role) && !(teacherData[uid] && teacherData[uid].exempt);
        });

        let eligibleAdminsList = Object.keys(klbkUsers).filter(uid => {
            let role = (klbkUsers[uid].role || '').toLowerCase().trim();
            let isSystemAccount = uid.startsWith('admin') || uid.startsWith('master') || uid.startsWith('device_assign') || uid.startsWith('@');
            return realAdminRoles.includes(role) && !isSystemAccount && !(teacherData[uid] && teacherData[uid].exempt);
        });
        
        // Track how many assignments each teacher has received this week
        let teacherAssignmentCounts = {};
        eligibleTeachersList.forEach(uid => teacherAssignmentCounts[uid] = 0);

        let adminAssignmentCounts = {};
        eligibleAdminsList.forEach(uid => adminAssignmentCounts[uid] = 0);
        
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
        let dayDate = new Date(nextMonday);
        
        const shortDays = { 'Pazartesi': 'Pa', 'Salı': 'Sa', 'Çarşamba': 'Ça', 'Perşembe': 'Pe', 'Cuma': 'Cu' };
        
        const scoreDayForTeacher = (uid, dayName) => {
            const shortName = shortDays[dayName] || dayName;
            const s = (klbkUsers[uid] && klbkUsers[uid].schedule && klbkUsers[uid].schedule[shortName]) ? klbkUsers[uid].schedule[shortName] : null;
            if(!s) return -99999; // Not at school
            
            let lessons = Object.keys(s)
                .filter(n => s[n] !== null && s[n] !== '' && s[n] !== undefined && n !== '0')
                .map(n => parseInt(n))
                .sort((a,b)=>a-b);
                
            if(lessons.length === 0) return -99999;
            
            let min = lessons[0];
            let max = lessons[lessons.length-1];
            let span = max - min + 1;
            let emptyCount = span - lessons.length;
            
            // Primary: max span (en çok okulda durduğu gün)
            // Secondary: max empty hours (en çok boş saatlerin olduğu gün)
            let score = (span * 100) + (emptyCount * 10);
            
            // Kullanıcının kuralı: 1. ve 2. dersi yoksa (geç geliyorsa) VEYA 7. ve 8. dersi yoksa (erken çıkıyorsa) mümkün olduğunca nöbet yazma (Büyük Ceza)
            if (min > 2 || max < 7) {
                score -= 5000;
            }
            
            return score;
        };

        const targetDutyCount = window._tempGenSettings.dutyCount || 1;
        const targetAdminCount = window._tempGenSettings.adminCount !== undefined ? window._tempGenSettings.adminCount : 1;
        const isHalf = window._tempGenSettings.dutyDuration === 'half';
        // Calculate minimum required teachers per day
        let reqPerDay = 0;
        if(window._tempGenSettings.locations && window._tempGenSettings.locations.length > 0) {
            window._tempGenSettings.locations.forEach(loc => {
                reqPerDay += (loc.reqTeachers ? parseInt(loc.reqTeachers) : 1);
            });
            if (isHalf) reqPerDay *= 2;
        } else {
            reqPerDay = 1;
        }
        
        // --- NEW ALGORITHM: Distribute teachers across days first ---
        let dailyCap = Math.max(reqPerDay, Math.ceil((eligibleTeachersList.length * targetDutyCount) / 5));
        let dayCounts = { 'Pazartesi': 0, 'Salı': 0, 'Çarşamba': 0, 'Perşembe': 0, 'Cuma': 0 };
        let teacherAssignments = {};
        eligibleTeachersList.forEach(uid => teacherAssignments[uid] = []);
        
        // Sort teachers by how many days they are available (most constrained first)
        let teachersWithAvail = eligibleTeachersList.map(uid => {
            let availCount = 0;
            for(let i=0; i<5; i++) {
                if(scoreDayForTeacher(uid, days[i]) > -90000) availCount++;
            }
            return { uid, availCount };
        });
        teachersWithAvail.sort((a,b) => a.availCount - b.availCount);
        
        for(let loop=0; loop<targetDutyCount; loop++) {
            teachersWithAvail.forEach(t => {
                let uid = t.uid;
                let bestDay = null;
                let bestScore = -9999;
                
                // Try to find a valid day under the daily cap
                for(let i=0; i<5; i++) {
                    let d = days[i];
                    if(teacherAssignments[uid].includes(d)) continue; 
                    let score = scoreDayForTeacher(uid, d);
                    let starvationBoost = (dayCounts[d] < reqPerDay) ? 10000 : 0;
                    let boostedScore = score + starvationBoost;
                    if(score > -90000 && dayCounts[d] < dailyCap) {
                        if(boostedScore > bestScore) {
                            bestScore = boostedScore;
                            bestDay = d;
                        }
                    }
                }
                
                // If all available days are at cap, pick the day with the absolute minimum count
                if(!bestDay) {
                    let minCount = 9999;
                    for(let i=0; i<5; i++) {
                        let d = days[i];
                        if(teacherAssignments[uid].includes(d)) continue;
                        let score = scoreDayForTeacher(uid, d);
                        let starvationBoost = (dayCounts[d] < reqPerDay) ? 10000 : 0;
                        let boostedScore = score + starvationBoost;
                        if(score > -90000) {
                            if(dayCounts[d] < minCount) {
                                minCount = dayCounts[d];
                                bestDay = d;
                                bestScore = boostedScore;
                            } else if (dayCounts[d] === minCount && boostedScore > bestScore) {
                                bestDay = d;
                                bestScore = boostedScore;
                            }
                        }
                    }
                }
                
                // If they STILL have no bestDay (e.g. they have no schedule at all on any day), force assign them to the least populated day
                if(!bestDay) {
                    let minCount = 9999;
                    for(let i=0; i<5; i++) {
                        let d = days[i];
                        if(teacherAssignments[uid].includes(d)) continue;
                        if(dayCounts[d] < minCount) {
                            minCount = dayCounts[d];
                            bestDay = d;
                        }
                    }
                }
                
                if(bestDay) {
                    teacherAssignments[uid].push(bestDay);
                    dayCounts[bestDay]++;
                }
            });
        }
        // --- END DAY DISTRIBUTION ---

        for(let i=0; i<5; i++) {
            let dateStr = dayDate.toISOString().split('T')[0];
            let dayName = days[i];
            newPlan[dateStr] = {};

            // 1. Assign Admins
            if(targetAdminCount > 0 && eligibleAdminsList.length > 0) {
                newPlan[dateStr]['_admin_duty'] = [];
                let availableAdmins = [...eligibleAdminsList];
                availableAdmins.sort((a,b) => {
                    let diff = adminAssignmentCounts[a] - adminAssignmentCounts[b];
                    return diff === 0 ? Math.random() - 0.5 : diff;
                });

                for(let k=0; k<targetAdminCount; k++) {
                    if(availableAdmins.length > 0) {
                        let chosenAdmin = availableAdmins.shift();
                        newPlan[dateStr]['_admin_duty'].push(chosenAdmin);
                        adminAssignmentCounts[chosenAdmin]++;
                    }
                }
            }
            
            // 2. Assign Teachers dynamically to balance locations
            let teachersToday = eligibleTeachersList.filter(uid => teacherAssignments[uid].includes(dayName));
            
            if(window._tempGenSettings.locations && window._tempGenSettings.locations.length > 0) {
                let sortedLocs = [...window._tempGenSettings.locations].sort((a,b) => a.priority - b.priority);
                let shifts = [];
                
                sortedLocs.forEach(loc => {
                    let req = loc.reqTeachers ? parseInt(loc.reqTeachers) : 1;
                    for (let r = 0; r < req; r++) {
                        let idSuffix = req > 1 ? `_${r+1}` : '';
                        if(isHalf) {
                            shifts.push({ id: `${loc.id}${idSuffix}_dilim1`, locId: loc.id, priority: loc.priority });
                            shifts.push({ id: `${loc.id}${idSuffix}_dilim2`, locId: loc.id, priority: loc.priority });
                        } else {
                            shifts.push({ id: `${loc.id}${idSuffix}`, locId: loc.id, priority: loc.priority });
                        }
                    }
                });
                
                shifts.forEach(s => newPlan[dateStr][s.id] = []);
                
                // Handle fixed locations first
                let remainingTeachers = [];
                teachersToday.forEach(uid => {
                    let tData = teacherData[uid];
                    if(tData && tData.fixedLoc) {
                        let validShifts = shifts.filter(s => s.locId === tData.fixedLoc);
                        if(validShifts.length > 0) {
                            validShifts.sort((a,b) => newPlan[dateStr][a.id].length - newPlan[dateStr][b.id].length);
                            newPlan[dateStr][validShifts[0].id].push(uid);
                        } else {
                            remainingTeachers.push(uid);
                        }
                    } else {
                        remainingTeachers.push(uid);
                    }
                });
                
                // Distribute remaining teachers to balance shifts
                // Sort them so teachers with higher schedule scores get priority placement (if tie)
                remainingTeachers.sort((a,b) => scoreDayForTeacher(b, dayName) - scoreDayForTeacher(a, dayName));
                
                remainingTeachers.forEach(uid => {
                    // Find shift with lowest count, tie-break by priority
                    shifts.sort((a,b) => {
                        let countA = newPlan[dateStr][a.id].length;
                        let countB = newPlan[dateStr][b.id].length;
                        if(countA !== countB) return countA - countB;
                        return a.priority - b.priority;
                    });
                    newPlan[dateStr][shifts[0].id].push(uid);
                });
            }
            dayDate.setDate(dayDate.getDate() + 1);
        }
        
        const newPlanId = 'plan_' + Date.now();
        const planObj = {
            planName: window._tempFinalPlanName || 'Adsız Plan',
            data: newPlan,
            dutyType: window._tempGenSettings ? window._tempGenSettings.dutyType : nobetSettings.dutyType,
            status: 'draft',
            createdAt: new Date().toISOString()
        };
        window._tempFinalPlanName = null;
        allNobetPlans[newPlanId] = planObj;
        viewingPlanId = newPlanId;
        currentWeekPlan = newPlan;
        
        // Save to Firebase via API
        try {
            const res = await fetch('/api/updateNobet', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: `plans/${newPlanId}`,
                    data: planObj
                })
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'API Error');
            }

            updateTeacherViewUI();
            updateAdminSettingsUI(); // Update UI to show the new plan in dropdown
            Swal.fire('Başarılı', 'Yeni nöbet planı oluşturuldu ve TASLAK olarak kaydedildi.', 'success');
        } catch(e) {
            Swal.fire('Hata', 'Plan kaydedilirken bir hata oluştu: ' + e.message, 'error');
        }
    }, 1500);
};

function applyDynamicRotation(originalPlan, startDateStr, dutyType, targetDateObj) {
    if (!startDateStr || !originalPlan) return originalPlan;
    
    let startDate = new Date(startDateStr);
    let currentDate = targetDateObj ? new Date(targetDateObj) : new Date();
    let diffTime = currentDate.getTime() - startDate.getTime();
    let weeksPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    if (weeksPassed < 0) weeksPassed = 0;
    
    let cycleWeeks = dutyType === 'monthly' ? 4 : 1;
    let cyclesPassed = Math.floor(weeksPassed / cycleWeeks);
    
    let dir = nobetSettings.rotationDir || 'asc';
    window.rotationTally = {}; 
    let newPlan = JSON.parse(JSON.stringify(originalPlan));
    
    let dates = Object.keys(newPlan);
    for (let day of dates) {
        window.rotationTally[day] = {};
        
        let shiftIds = Object.keys(newPlan[day]).filter(id => id !== '_admin_duty' && !id.startsWith('fixed_')); 
        
        // Sort shiftIds by priority so slots are ordered geographically
        shiftIds.sort((a, b) => {
            let locIdA = a.replace('_dilim1', '').replace('_dilim2', '');
            let locIdB = b.replace('_dilim1', '').replace('_dilim2', '');
            let pA = nobetSettings.locations?.find(l => l.id === locIdA)?.priority || 99;
            let pB = nobetSettings.locations?.find(l => l.id === locIdB)?.priority || 99;
            if(pA !== pB) return pA - pB;
            return a.localeCompare(b);
        });

        let dynamicSlots = [];
        let slotMap = []; 

        for (let shiftId of shiftIds) {
            let teachersInLoc = newPlan[day][shiftId];
            window.rotationTally[day][shiftId] = {};
            
            for (let i = 0; i < teachersInLoc.length; i++) {
                let uname = teachersInLoc[i];
                let isFixed = false;
                if (teacherData && teacherData[uname] && teacherData[uname].fixedLoc) {
                    let baseShift = shiftId.replace('_dilim1', '').replace('_dilim2', '');
                    if (teacherData[uname].fixedLoc === shiftId || teacherData[uname].fixedLoc === baseShift) {
                        isFixed = true;
                    }
                }
                if (!isFixed) {
                    dynamicSlots.push(uname);
                    slotMap.push({ shiftId, index: i });
                }
            }
        }
        
        // Initialize admin tallies
        if (newPlan[day]['_admin_duty']) {
            window.rotationTally[day]['_admin_duty'] = {};
        }

        // Simulate each cycle to count assignments up to the current cycle
        for (let cycle = 0; cycle <= cyclesPassed; cycle++) {
            let currentSlots = [...dynamicSlots];
            
            if (cycle > 0 && dutyType !== 'fixed') {
                let s = (cycle * (dir === 'desc' ? -1 : 1)) % dynamicSlots.length;
                if (s < 0) s += dynamicSlots.length;
                currentSlots = [...dynamicSlots.slice(dynamicSlots.length - s), ...dynamicSlots.slice(0, dynamicSlots.length - s)];
            }
            
            let weeksInThisCycle = (cycle === cyclesPassed) ? ((weeksPassed % cycleWeeks) + 1) : cycleWeeks;
            
            // Record tallies for this cycle
            // 1. Fixed teachers (always at their spot)
            for (let shiftId of shiftIds) {
                let teachersInLoc = newPlan[day][shiftId];
                for (let uname of teachersInLoc) {
                    let isFixed = false;
                    if (teacherData && teacherData[uname] && teacherData[uname].fixedLoc) {
                        let baseShift = shiftId.replace('_dilim1', '').replace('_dilim2', '');
                        if (teacherData[uname].fixedLoc === shiftId || teacherData[uname].fixedLoc === baseShift) {
                            isFixed = true;
                        }
                    }
                    if (isFixed) {
                        window.rotationTally[day][shiftId][uname] = (window.rotationTally[day][shiftId][uname] || 0) + weeksInThisCycle;
                    }
                }
            }
            // 2. Admin duty
            if (newPlan[day]['_admin_duty']) {
                for (let uname of newPlan[day]['_admin_duty']) {
                    window.rotationTally[day]['_admin_duty'][uname] = (window.rotationTally[day]['_admin_duty'][uname] || 0) + weeksInThisCycle;
                }
            }
            // 3. Dynamic teachers
            for (let i = 0; i < currentSlots.length; i++) {
                let shiftId = slotMap[i].shiftId;
                let uname = currentSlots[i];
                window.rotationTally[day][shiftId][uname] = (window.rotationTally[day][shiftId][uname] || 0) + weeksInThisCycle;
            }
            
            // If this is the FINAL cycle, modify newPlan to reflect it
            if (cycle === cyclesPassed) {
                for (let i = 0; i < currentSlots.length; i++) {
                    let { shiftId, index } = slotMap[i];
                    newPlan[day][shiftId][index] = currentSlots[i];
                }
            }
        }
    }
    
    return newPlan;
}

function renderWeeklyPlan() {
    if(!currentWeekPlan || Object.keys(currentWeekPlan).length === 0) {
        $('#weeklyPlanContainer').html('<p style="color:var(--gray-500);">Plan bulunmuyor.</p>');
        return;
    }
    
    let dates = Object.keys(currentWeekPlan).sort();
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
    
    // Collect all unique locations across all days
    let allShifts = [];
    dates.forEach(d => {
        for(let shiftId in currentWeekPlan[d]) {
            if(!allShifts.includes(shiftId)) allShifts.push(shiftId);
        }
    });
    
    // Sort shifts: _admin_duty first, then by location priority if possible
    allShifts.sort((a, b) => {
        if(a === '_admin_duty') return -1;
        if(b === '_admin_duty') return 1;
        
        let locIdA = a.replace('_dilim1', '').replace('_dilim2', '');
        let locIdB = b.replace('_dilim1', '').replace('_dilim2', '');
        let infoA = nobetSettings.locations?.find(l => l.id === locIdA);
        let infoB = nobetSettings.locations?.find(l => l.id === locIdB);
        let pA = infoA ? infoA.priority : 99;
        let pB = infoB ? infoB.priority : 99;
        if(pA !== pB) return pA - pB;
        return a.localeCompare(b);
    });
    let html = `
    <div style="text-align:right; margin-bottom:10px;">
        <button onclick="window.openPrintTab()" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-print"></i> PDF Yap / Yazdır</button>
    </div>
    <div style="overflow-x: auto; margin-top: 20px;" id="printablePlanArea">
        <table style="width: 100%; border-collapse: collapse; min-width: 800px; text-align: center; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <thead>
                <tr style="background: var(--primary); color: white;">
                    <th style="padding: 15px; border: 1px solid rgba(255,255,255,0.2); font-weight: 600;">Nöbet Yeri</th>`;
    
    for(let i=0; i<5; i++) {
        html += `<th style="padding: 15px; border: 1px solid rgba(255,255,255,0.2); font-weight: 600;">${dayNames[i] || ''}</th>`;
    }
    
    html += `</tr>
            </thead>
            <tbody>`;
            
    allShifts.forEach((shiftId, index) => {
        let locName = shiftId;
        if(shiftId === '_admin_duty') {
            locName = "Nöbetçi İdareci";
        } else {
            let isDilim1 = shiftId.includes('_dilim1');
            let isDilim2 = shiftId.includes('_dilim2');
            let locId = shiftId.replace('_dilim1', '').replace('_dilim2', '');
            
            let locInfo = nobetSettings.locations?.find(l => l.id === locId);
            locName = locInfo ? locInfo.name : locId;
            if(isDilim1) locName += " (1. Dilim)";
            if(isDilim2) locName += " (2. Dilim)";
        }
        
        let rowBg = index % 2 === 0 ? 'background: var(--white);' : 'background: #f9fafb;';
        html += `<tr style="${rowBg}">
                    <td style="padding: 12px; border: 1px solid var(--gray-200); font-weight: 600; color: var(--primary-dark); text-align: left;">${locName}</td>`;
                    
        for(let i=0; i<5; i++) {
            let dateStr = dates[i];
            let teachersList = '';
            if(dateStr && currentWeekPlan[dateStr] && currentWeekPlan[dateStr][shiftId]) {
                teachersList = currentWeekPlan[dateStr][shiftId].map(uid => {
                    let name = klbkUsers[uid]?.name || uid;
                    let countStr = "";
                    if (window.rotationTally && window.rotationTally[dateStr] && window.rotationTally[dateStr][shiftId] && window.rotationTally[dateStr][shiftId][uid]) {
                        countStr = ` <span style="font-size:0.85em; opacity:0.8;">(${window.rotationTally[dateStr][shiftId][uid]})</span>`;
                    }
                    let isFixed = false;
                    if (teacherData && teacherData[uid] && teacherData[uid].fixedLoc) {
                        let baseShift = shiftId.replace('_dilim1', '').replace('_dilim2', '');
                        if (teacherData[uid].fixedLoc === shiftId || teacherData[uid].fixedLoc === baseShift) {
                            isFixed = true;
                        }
                    }
                    
                    let baseStyle = isFixed ? "font-weight:900; color:#111827;" : "";

                    if (isAdmin) {
                        let safeUid = uid.replace(/'/g, "\\'");
                        let safeDate = dateStr.replace(/'/g, "\\'");
                        if (shiftId === '_admin_duty') {
                            return `<span style="cursor:pointer; text-decoration:underline; color:var(--primary); ${baseStyle}" onclick="window.changeAdminDuty('${safeDate}', '${safeUid}')">${name}${countStr}</span>`;
                        } else {
                            let cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '');
                            return `<span style="cursor:pointer; display:inline-block; ${baseStyle}" oncontextmenu="window.selectTeacherForSwap('${safeDate}', '${safeUid}', event)" onclick="window.handleTeacherClick('${safeDate}', '${safeUid}', event)" id="span_swap_${dateStr}_${cleanUid}">${name}${countStr}</span>`;
                        }
                    } else if (isFixed) {
                        return `<span style="${baseStyle}">${name}${countStr}</span>`;
                    }
                    return name + countStr;
                }).join('<br>');
            }
            html += `<td style="padding: 12px; border: 1px solid var(--gray-200); color: var(--gray-700);">${teachersList || '<span style="color:var(--gray-400);">-</span>'}</td>`;
        }
        
        html += `</tr>`;
    });
    
    html += `</tbody>
        </table>
    </div>`;
    
    $('#weeklyPlanContainer').html(html);
}

let teacherDutyInterval = null;

function getDutyLocationName(shiftId) {
    if(shiftId === '_admin_duty') return "Nöbetçi İdareci";
    let isDilim1 = shiftId.includes('_dilim1');
    let isDilim2 = shiftId.includes('_dilim2');
    let locId = shiftId.replace('_dilim1', '').replace('_dilim2', '');
    let locInfo = nobetSettings.locations?.find(l => l.id === locId);
    let lName = locInfo ? locInfo.name : locId;
    if(isDilim1) lName += " (1. Dilim)";
    if(isDilim2) lName += " (2. Dilim)";
    return lName;
}

function determineNextDuty(teacherUid) {
    if (!publishedPlanMeta || !publishedPlanMeta.data) return null;
    let p = publishedPlanMeta;
    let dutyType = p.dutyType || nobetSettings.dutyType || 'weekly';
    
    if (teacherData[teacherUid] && teacherData[teacherUid].exempt) return { exempt: true };
    
    let isTeacherInPlan = false;
    Object.values(p.data).forEach(dayObj => {
        Object.values(dayObj).forEach(shiftData => {
            if (Array.isArray(shiftData) && shiftData.includes(teacherUid)) isTeacherInPlan = true;
            if (typeof shiftData === 'string' && shiftData.includes(teacherUid)) isTeacherInPlan = true;
        });
    });
    
    if (!isTeacherInPlan) return { notInPlan: true };
    
    let originalDates = Object.keys(p.data).sort();
    let checkDate = new Date();
    
    for(let i=0; i<60; i++) {
        let d = new Date(checkDate);
        d.setDate(d.getDate() + i);
        let dayOfWeek = d.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        let matchingOrigDateStr = originalDates.find(dStr => new Date(dStr).getDay() === dayOfWeek);
        if(!matchingOrigDateStr) continue;
        
        let virtualPlan = dutyType === 'fixed' ? p.data : applyDynamicRotation(p.data, p.startDate, dutyType, d);
        let dayPlan = virtualPlan[matchingOrigDateStr];
        
        if (dayPlan) {
            for(let shiftId in dayPlan) {
                let shiftData = dayPlan[shiftId];
                let hasTeacher = false;
                if (Array.isArray(shiftData) && shiftData.includes(teacherUid)) hasTeacher = true;
                if (typeof shiftData === 'string' && shiftData.includes(teacherUid)) hasTeacher = true;
                
                if (hasTeacher) {
                    let partners = [];
                    for (let sId in dayPlan) {
                        let sData = dayPlan[sId];
                        let tList = Array.isArray(sData) ? sData : (sData ? [sData] : []);
                        tList.forEach(t => {
                            if (t !== teacherUid && t && klbkUsers[t]) {
                                partners.push(`${klbkUsers[t].name || t} (${getDutyLocationName(sId)})`);
                            }
                        });
                    }
                    
                    return {
                        dateObj: d,
                        locationName: getDutyLocationName(shiftId),
                        partners: partners
                    };
                }
            }
        }
    }
    return { notFound: true };
}

function updateTeacherDutyDashboardUI() {
    if(isAdmin) renderWeeklyPlan();
    
    if (teacherDutyInterval) clearInterval(teacherDutyInterval);
    
    const container = $('#teacherDutyDashboardContainer');
    const incidentBtn = $('#teacherIncidentBtnContainer');
    
    if (!publishedPlanMeta) {
        container.html(`<div style="padding: 30px;"><i class="fa-solid fa-calendar-xmark" style="font-size: 3rem; color: var(--gray-400); margin-bottom:15px;"></i><h3>Aktif Nöbet Planı Yok</h3></div>`);
        return;
    }
    
    let dutyInfo = determineNextDuty(currentUser.username);
    
    if (!dutyInfo || dutyInfo.exempt) {
        container.html(`<div style="padding: 30px;"><i class="fa-solid fa-mug-hot" style="font-size: 3rem; color: var(--gray-400); margin-bottom:15px;"></i><h3>Nöbetten Muafsınız</h3><p style="color:var(--gray-500);">Nöbet göreviniz bulunmamaktadır.</p></div>`);
        return;
    }
    if (dutyInfo.notInPlan || dutyInfo.notFound) {
        container.html(`<div style="padding: 30px;"><i class="fa-solid fa-mug-hot" style="font-size: 3rem; color: var(--gray-400); margin-bottom:15px;"></i><h3>Şu an nöbetçi değilsiniz</h3><p style="color:var(--gray-500);">Bu plan periyodunda nöbetiniz bulunmuyor.</p></div>`);
        return;
    }
    
    // We have a next duty or today duty
    let dutyDate = dutyInfo.dateObj;
    let today = new Date();
    let isToday = dutyDate.toDateString() === today.toDateString();
    
    // Get lesson times
    let storeKey = sessionStorage.getItem('klbk_storeKey') || 'klbk_data_admin';
    fetch(`${FIREBASE_DB_URL}/app_store/${storeKey}/school/lessonTimes.json`).then(res => res.json()).then(lessonTimes => {
        let firstStart = lessonTimes && lessonTimes['1_start'] ? lessonTimes['1_start'] : '08:30';
        let lastEnd = '15:30';
        if(lessonTimes) {
            let maxHour = Math.max(...Object.keys(lessonTimes).map(k => parseInt(k.split('_')[0])).filter(n => !isNaN(n)));
            if(lessonTimes[`${maxHour}_end`]) lastEnd = lessonTimes[`${maxHour}_end`];
        }
        
        let startH = parseInt(firstStart.split(':')[0]);
        let startM = parseInt(firstStart.split(':')[1]);
        let endH = parseInt(lastEnd.split(':')[0]);
        let endM = parseInt(lastEnd.split(':')[1]);
        
        let dutyStart = new Date(dutyDate);
        dutyStart.setHours(startH, startM, 0, 0);
        dutyStart.setMinutes(dutyStart.getMinutes() - 30); // 30 mins before first lesson
        
        let dutyEnd = new Date(dutyDate);
        dutyEnd.setHours(endH, endM, 0, 0);
        dutyEnd.setMinutes(dutyEnd.getMinutes() + 15); // 15 mins after last lesson
        
        const days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
        let dateFormatted = String(dutyDate.getDate()).padStart(2,'0') + '.' + String(dutyDate.getMonth()+1).padStart(2,'0') + '.' + dutyDate.getFullYear() + ' ' + days[dutyDate.getDay()];
        
        function renderUI() {
            let now = new Date();
            let html = '';
            
            if (isToday) {
                if (now < dutyStart) {
                    let diff = dutyStart.getTime() - now.getTime();
                    html = renderStateHtml('Bugün nöbetçisiniz, Kolay Gelsin', dutyInfo.locationName, formatCountdown(diff), dutyInfo.partners, 'Nöbet Başlıyor:');
                } else if (now >= dutyStart && now <= dutyEnd) {
                    let diff = dutyEnd.getTime() - now.getTime();
                    html = renderStateHtml('Nöbetiniz Başladı', dutyInfo.locationName, formatCountdown(diff), dutyInfo.partners, 'Nöbet Bitiyor:');
                } else {
                    html = renderPostDutyHtml(dateFormatted, dutyInfo.locationName);
                }
            } else {
                let diff = dutyStart.getTime() - now.getTime();
                html = `<div style="padding: 20px;">
                    <i class="fa-solid fa-mug-hot" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 15px;"></i>
                    <h2 style="margin:0 0 10px 0;">Şu an nöbetçi değilsiniz</h2>
                    <div style="background: var(--gray-100); padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <p style="margin:0; color: var(--gray-600); font-size: 0.95rem;">En yakın nöbetiniz:</p>
                        <p style="margin:5px 0 0 0; font-weight: bold; font-size: 1.2rem; color: var(--dark);">${dateFormatted}</p>
                        <p style="margin:5px 0 0 0; color: var(--primary-dark); font-weight: 600;">Görev Yeri: ${dutyInfo.locationName}</p>
                    </div>
                    <div style="margin-top: 20px; font-size: 2.2rem; font-weight: 900; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px; color: #39ff14; text-shadow: 0 0 10px rgba(57, 255, 20, 0.5); background: var(--gray-900); padding: 15px 20px; border-radius: 8px; display: inline-block;">
                        <i class="fa-solid fa-hourglass-half" style="color: #fff; font-size: 1.5rem; vertical-align: middle;"></i> Kalan Süre: <span style="vertical-align: middle;">${formatCountdown(diff)}</span>
                    </div>
                    ${dutyInfo.partners.length > 0 ? `<div style="margin-top:20px; text-align:left; font-size:0.9rem; color:var(--gray-600);"><strong style="color:var(--dark);">Nöbet Arkadaşlarınız:</strong><br>${dutyInfo.partners.join('<br>')}</div>` : ''}
                </div>`;
            }
            container.html(html);
        }
        
        renderUI();
        teacherDutyInterval = setInterval(renderUI, 1000);
        if(!isAdmin) renderTeacherWeeklyPlan();
    }).catch(e => {
        container.html(`<div style="padding: 30px; color: red;">Ders saatleri alınamadı. Lütfen sayfayı yenileyin.</div>`);
    });
}

function renderStateHtml(title, location, countdown, partners, countdownLabel) {
    let pList = partners.length > 0 ? `<div style="margin-top:20px; padding: 15px; background: rgba(255,255,255,0.5); border-radius: 8px; text-align:left; font-size:0.95rem; color:var(--gray-700);"><strong style="color:var(--dark);"><i class="fa-solid fa-users"></i> Nöbet Arkadaşlarınız:</strong><br><div style="margin-top:8px; line-height: 1.6;">${partners.join('<br>')}</div></div>` : '';
    return `
        <div style="padding: 10px;">
            <div style="width: 70px; height: 70px; background: var(--primary-light); color: var(--primary-dark); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 15px;">
                <i class="fa-solid fa-shield-halved"></i>
            </div>
            <h2 style="margin:0 0 10px 0; color: var(--primary-dark);">${title}</h2>
            <h3 style="margin:0 0 20px 0; color: var(--dark);">Görev Yeri: ${location}</h3>
            
            <div style="background: var(--gray-900); color: #39ff14; padding: 15px 25px; border-radius: 8px; margin-top: 15px; display: inline-block; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                <p style="margin:0 0 5px 0; color: var(--gray-400); font-size: 0.85rem; font-family: sans-serif;">${countdownLabel}</p>
                <div style="font-size: 2.5rem; font-weight: 900; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px; text-shadow: 0 0 10px rgba(57, 255, 20, 0.6);">
                    ${countdown}
                </div>
            </div>
            ${pList}
        </div>
    `;
}

function renderPostDutyHtml(dateStr, location) {
    return `
        <div style="padding: 20px;">
            <i class="fa-solid fa-check-circle" style="font-size: 3.5rem; color: var(--success); margin-bottom: 15px;"></i>
            <h2 style="margin:0 0 10px 0; color: var(--dark);">Bugünkü Nöbetiniz Bitti</h2>
            <p style="color: var(--gray-500); margin-bottom: 20px;">Tebrikler, bugünkü nöbet görevinizi başarıyla tamamladınız.</p>
            <p style="color: var(--gray-400); font-size: 0.9rem;">Bir sonraki nöbet bilginiz sayfa yenilendiğinde (veya yarın) hesaplanacaktır.</p>
        </div>
    `;
}

function formatCountdown(ms) {
    if (ms < 0) ms = 0;
    let s = Math.floor((ms / 1000) % 60);
    let m = Math.floor((ms / (1000 * 60)) % 60);
    let h = Math.floor((ms / (1000 * 60 * 60)) % 24);
    let d = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function renderTeacherWeeklyPlan() {
    if(!currentWeekPlan || Object.keys(currentWeekPlan).length === 0) {
        $('#teacherWeeklyPlanContainer').html('');
        return;
    }
    
    let dates = Object.keys(currentWeekPlan).sort();
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
    
    let allShifts = [];
    dates.forEach(d => {
        for(let shiftId in currentWeekPlan[d]) {
            if(!allShifts.includes(shiftId)) allShifts.push(shiftId);
        }
    });
    
    allShifts.sort((a, b) => {
        if(a === '_admin_duty') return -1;
        if(b === '_admin_duty') return 1;
        let locIdA = a.replace('_dilim1', '').replace('_dilim2', '');
        let locIdB = b.replace('_dilim1', '').replace('_dilim2', '');
        let infoA = nobetSettings.locations?.find(l => l.id === locIdA);
        let infoB = nobetSettings.locations?.find(l => l.id === locIdB);
        let pA = infoA ? infoA.priority : 99;
        let pB = infoB ? infoB.priority : 99;
        if(pA !== pB) return pA - pB;
        return a.localeCompare(b);
    });
    
    const trMonths = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    let planTitle = 'Nöbet Çizelgesi';
    if (dates.length >= 2) {
        let startD = new Date(dates[0]);
        let endD = new Date(dates[dates.length - 1]);
        planTitle = `${startD.getDate()} ${trMonths[startD.getMonth()]} - ${endD.getDate()} ${trMonths[endD.getMonth()]} Arası Nöbet Çizelgesi`;
    }

    let html = `
    <h3 style="margin-bottom:15px; color:var(--primary-dark); text-align:left; border-bottom:1px solid var(--gray-200); padding-bottom:10px;"><i class="fa-solid fa-table-list"></i> ${planTitle}</h3>
    <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; min-width: 800px; text-align: center; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <thead>
                <tr style="background: var(--primary); color: white;">
                    <th style="padding: 15px; border: 1px solid rgba(255,255,255,0.2); font-weight: 600;">Nöbet Yeri</th>`;
    
    for(let i=0; i<5; i++) {
        html += `<th style="padding: 15px; border: 1px solid rgba(255,255,255,0.2); font-weight: 600;">${dayNames[i] || ''}</th>`;
    }
    
    html += `</tr>
            </thead>
            <tbody>`;
            
    allShifts.forEach((shiftId, index) => {
        let locName = getDutyLocationName(shiftId);
        
        let rowBg = index % 2 === 0 ? 'background: var(--white);' : 'background: #f9fafb;';
        html += `<tr style="${rowBg}">
                    <td style="padding: 12px; border: 1px solid var(--gray-200); font-weight: 600; color: var(--primary-dark); text-align: left;">${locName}</td>`;
                    
        for(let i=0; i<5; i++) {
            let dateStr = dates[i];
            let teachersList = '';
            if(dateStr && currentWeekPlan[dateStr] && currentWeekPlan[dateStr][shiftId]) {
                teachersList = currentWeekPlan[dateStr][shiftId].map(uid => {
                    let name = klbkUsers[uid]?.name || uid;
                    
                    let countStr = "";
                    if (window.rotationTally && window.rotationTally[dateStr] && window.rotationTally[dateStr][shiftId] && window.rotationTally[dateStr][shiftId][uid]) {
                        countStr = ` <span style="font-size:0.85em; opacity:0.8;">(${window.rotationTally[dateStr][shiftId][uid]})</span>`;
                    }
                    
                    let isFixed = false;
                    if (teacherData && teacherData[uid] && teacherData[uid].fixedLoc) {
                        let baseShift = shiftId.replace('_dilim1', '').replace('_dilim2', '');
                        if (teacherData[uid].fixedLoc === shiftId || teacherData[uid].fixedLoc === baseShift) {
                            isFixed = true;
                        }
                    }
                    
                    let highlightStyle = isFixed ? 'font-weight: 900; color: #111827;' : '';
                    if (uid === currentUser.username) {
                        highlightStyle = 'color: #39ff14; font-weight: 900; font-size: 1.15em; background: var(--gray-900); padding: 4px 8px; border-radius: 6px; display:inline-block; margin:2px; box-shadow: 0 0 8px rgba(57,255,20,0.4);';
                    }
                    
                    return `<span style="${highlightStyle}">${name}${countStr}</span>`;
                }).join('<br>');
            }
            html += `<td style="padding: 12px; border: 1px solid var(--gray-200); color: var(--gray-700);">${teachersList || '<span style="color:var(--gray-400);">-</span>'}</td>`;
        }
        
        html += `</tr>`;
    });
    
    html += `</tbody>
        </table>
    </div>`;
    
    $('#teacherWeeklyPlanContainer').html(html);
}

window.updateTeacherViewUI = updateTeacherDutyDashboardUI;

window.showIncidentForm = function() {
    $('#incidentSection').slideDown();
    document.getElementById('incidentSection').scrollIntoView({behavior: "smooth"});
};

window.hideIncidentForm = function() {
    $('#incidentSection').slideUp();
    $('#incidentForm')[0].reset();
    $('#incTeachers').val(null).trigger('change');
    $('#incClassSelect').val('');
    $('#incStudents').html('').val(null).trigger('change');
    $('#editIncidentId').val('');
    $('#selectedStudentsList').hide();
    $('#selectedStudentsUl').html('');
};

async function submitIncident() {
    const time = $('#incTime').val();
    const students = $('#incStudents').val() || [];
    const studentsStr = students.join(', ');
    const teachers = $('#incTeachers').val() || [];
    const desc = $('#incDesc').val();
    const editId = $('#editIncidentId').val();
    
    const today = new Date().toISOString().split('T')[0];
    const incidentId = editId ? editId : Date.now().toString();
    
    const incidentData = {
        date: today,
        time: time,
        reporterId: currentUser.username,
        reporterName: currentUser.name,
        students: studentsStr,
        involvedTeachers: teachers,
        description: desc,
        timestamp: editId ? parseInt(editId) : Date.now()
    };
    
    Swal.fire({title:'Gönderiliyor...', didOpen:()=>Swal.showLoading()});
    try {
        const res = await fetch('/api/updateNobet', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: `incidents/${incidentId}`,
                data: incidentData
            })
        });
        
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(errBody || 'Sunucu hatası');
        }

        Swal.fire('Başarılı', editId ? 'Tutanak güncellendi.' : 'Tutanak kaydedildi.', 'success');
        hideIncidentForm();
        
        if (isAdmin) loadIncidents();
        loadTeacherIncidents();
    } catch(e) {
        Swal.fire('Hata', 'Gönderilemedi: ' + e.message, 'error');
    }
}

function formatDateTR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
}

window.printIncident = function(incJsonStr) {
    try {
        localStorage.setItem('printIncidentData', incJsonStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        window.open('tutanak_yazdir.html', '_blank');
    } catch(e) {
        console.error(e);
        Swal.fire('Hata', 'Yazdırma işlemi başlatılamadı.', 'error');
    }
};

async function loadTeacherIncidents() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/incidents.json`);
        const data = await res.json();
        
        let html = '';
        if (data) {
            let myIncidents = Object.entries(data).filter(([id, inc]) => inc.reporterId === currentUser.username);
            
            // Sort by timestamp desc
            myIncidents.sort((a,b) => b[1].timestamp - a[1].timestamp);
            
            if (myIncidents.length > 0) {
                let totalCount = myIncidents.length;
                myIncidents.forEach(([id, inc], idx) => {
                    let incJson = JSON.stringify(inc).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                    
                    let tNames = (inc.involvedTeachers || []).map(uid => klbkUsers[uid]?.name || uid).join(', ');
                    let printInc = { ...inc };
                    printInc.involvedTeachers = tNames;
                    let printIncJson = JSON.stringify(printInc).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

                    let tutanakName = `Tutanak ${totalCount - idx}`;

                    html += `
                        <tr>
                            <td>${formatDateTR(inc.date) || ''}</td>
                            <td><strong>${tutanakName}</strong></td>
                            <td>
                                <button class="btn btn-primary btn-sm" onclick="editTeacherIncident('${id}', '${incJson}')">
                                    <i class="fa-solid fa-pen"></i> Düzenle
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="printIncident('${printIncJson}')" style="margin-left: 3px; background: #6b7280; border-color: #6b7280; color: white;">
                                    <i class="fa-solid fa-print"></i>
                                </button>
                                <button class="btn btn-sm" onclick="deleteIncident('${id}')" style="margin-left: 3px; background: #ef4444; border-color: #ef4444; color: white;">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                $('#teacherIncidentsContainer').show();
            } else {
                $('#teacherIncidentsContainer').hide();
            }
        } else {
            $('#teacherIncidentsContainer').hide();
        }
        $('#teacherIncidentsTableBody').html(html);
    } catch(e) {
        console.error("Geçmiş tutanaklar yüklenemedi:", e);
    }
}

window.editTeacherIncident = function(id, incJsonStr) {
    try {
        const inc = JSON.parse(incJsonStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        $('#editIncidentId').val(id);
        $('#incTime').val(inc.time || '');
        $('#incDesc').val(inc.description || '');
        
        if (inc.students) {
            let stdArr = inc.students.split(',').map(s => s.trim());
            // Pre-fill the dropdown correctly if they belong to a class
            // To be safe, we just throw all these specific students in as options so they display correctly
            let studentHtml = '';
            stdArr.forEach(s => {
                studentHtml += `<option value="${s}" selected>${s}</option>`;
            });
            $('#incClassSelect').val('');
            $('#incStudents').html(studentHtml).val(stdArr).trigger('change');
        } else {
            $('#incStudents').html('').val(null).trigger('change');
        }
        
        if (inc.involvedTeachers && Array.isArray(inc.involvedTeachers)) {
            $('#incTeachers').val(inc.involvedTeachers).trigger('change');
        } else {
            $('#incTeachers').val(null).trigger('change');
        }
        
        showIncidentForm();
        
        $('html, body').animate({
            scrollTop: $("#incidentSection").offset().top - 50
        }, 500);
    } catch (e) {
        console.error("Düzenleme hatası:", e);
        Swal.fire('Hata', 'Tutanak verisi okunamadı.', 'error');
    }
};

async function loadIncidents() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/app_store/klbk_nobet/incidents.json?_=${Date.now()}`);
        if(res.ok) {
            const data = await res.json();
            if(data) {
                let html = '';
                const keys = Object.keys(data).sort().reverse(); // newest first
                let totalCount = keys.length;
                keys.forEach((k, idx) => {
                    const inc = data[k];
                    let tNames = (inc.involvedTeachers || []).map(uid => klbkUsers[uid]?.name || uid).join(', ');
                    
                    let printInc = { ...inc };
                    printInc.involvedTeachers = tNames;
                    let incJson = JSON.stringify(printInc).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

                    let tutanakName = `Tutanak ${totalCount - idx}`;

                    html += `
                        <div class="item-row" style="flex-direction:column; align-items:flex-start; gap:10px;">
                            <div style="width:100%; display:flex; justify-content:space-between; border-bottom:1px solid var(--gray-200); padding-bottom:5px; align-items:center;">
                                <strong style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> ${tutanakName} — ${formatDateTR(inc.date)}</strong>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <small style="color:var(--gray-500);">Bildiren: ${inc.reporterName}</small>
                                    <button class="btn btn-sm" onclick="printIncident('${incJson}')" style="background: #6b7280; color: white; padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;">
                                        <i class="fa-solid fa-print"></i>
                                    </button>
                                    <button class="btn btn-sm" onclick="deleteIncident('${k}')" style="background: #ef4444; color: white; padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
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

window.deleteIncident = async function(incidentId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Emin misiniz?',
        text: 'Bu tutanak kalıcı olarak silinecektir.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal'
    });
    
    if (!isConfirmed) return;
    
    Swal.fire({title:'Siliniyor...', didOpen:()=>Swal.showLoading()});
    try {
        const res = await fetch('/api/updateNobet', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: `incidents/${incidentId}` })
        });
        
        if (!res.ok) throw new Error('Sunucu hatası');
        
        Swal.fire('Silindi', 'Tutanak başarıyla silindi.', 'success');
        if (isAdmin) loadIncidents();
        loadTeacherIncidents();
    } catch(e) {
        Swal.fire('Hata', 'Silinemedi: ' + e.message, 'error');
    }
};

// Live selected students display
$(document).on('change', '#incStudents', function() {
    const selected = $(this).val() || [];
    const container = $('#selectedStudentsList');
    const ul = $('#selectedStudentsUl');
    
    if (selected.length > 0) {
        let html = '';
        selected.forEach((s, i) => {
            html += `<li style="background: var(--primary-light, #e0e7ff); color: var(--primary-dark, #1e3a8a); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-user-graduate" style="font-size: 0.7rem;"></i> ${s}
            </li>`;
        });
        ul.html(html);
        container.show();
    } else {
        ul.html('');
        container.hide();
    }
});

// --- Interactive Table Features ---
window.changeAdminDuty = async (dateStr, currentUid) => {
    if (!isAdmin) return;
    
    // Warn if dynamic rotation is active
    let p = allNobetPlans[viewingPlanId];
    if (p.status === 'published' && p.startDate) {
        let diffTime = new Date().getTime() - new Date(p.startDate).getTime();
        let weeksPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (weeksPassed > 0) {
            const { isConfirmed } = await Swal.fire({
                title: 'Dikkat!',
                text: 'Bu plan yayında ve dinamik dönüşüm aşamasında. İdareciyi değiştirmek ana taslağı güncelleyecektir.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Devam Et',
                cancelButtonText: 'İptal'
            });
            if(!isConfirmed) return;
        }
    }

    // Get admins (only Idareci roles)
    let adminsList = Object.keys(klbkUsers).filter(uid => {
        let t = klbkUsers[uid];
        return (t.role === 'mudur' || t.role === 'mudur_basyardimcisi' || t.role === 'mudur_yardimcisi') && !t.isSystemAccount;
    });

    let inputOptions = {};
    adminsList.forEach(uid => {
        inputOptions[uid] = klbkUsers[uid].name;
    });

    const { value: selectedUid } = await Swal.fire({
        title: 'Nöbetçi İdareci Değiştir',
        input: 'select',
        inputOptions: inputOptions,
        inputPlaceholder: 'İdareci Seçin',
        showCancelButton: true,
        confirmButtonText: 'Değiştir',
        cancelButtonText: 'İptal'
    });

    if (selectedUid && selectedUid !== currentUid) {
        let plan = allNobetPlans[viewingPlanId].data;
        if(plan[dateStr] && plan[dateStr]['_admin_duty']) {
            let idx = plan[dateStr]['_admin_duty'].indexOf(currentUid);
            if (idx > -1) {
                plan[dateStr]['_admin_duty'][idx] = selectedUid;
                await savePlanChanges('İdareci başarıyla değiştirildi.');
            }
        }
    }
};

window.selectedSwapTeacher = null;

window.selectTeacherForSwap = (dateStr, uid, e) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    if (window.selectedSwapTeacher) {
        let cleanOldUid = window.selectedSwapTeacher.uid.replace(/[^a-zA-Z0-9]/g, '');
        $(`#span_swap_${window.selectedSwapTeacher.dateStr}_${cleanOldUid}`).css({background: 'transparent', padding: '0'});
    }
    window.selectedSwapTeacher = { dateStr, uid };
    
    let cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '');
    $(`#span_swap_${dateStr}_${cleanUid}`).css({background: '#fef08a', padding: '2px 4px', borderRadius: '4px'});
    
    let tName = klbkUsers[uid]?.name || uid;
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        icon: 'info',
        title: `${tName} seçildi. Takas etmek istediğiniz diğer öğretmene tıklayın.`
    });
};

window.handleTeacherClick = (dateStr, uid, e) => {
    if (!isAdmin) return;
    if (!window.selectedSwapTeacher) return;
    if (window.selectedSwapTeacher.uid === uid && window.selectedSwapTeacher.dateStr === dateStr) return; // Same person/day
    
    window.confirmTeacherSwap(window.selectedSwapTeacher, {dateStr, uid});
};

window.confirmTeacherSwap = async (t1, t2) => {
    let name1 = klbkUsers[t1.uid]?.name || t1.uid;
    let name2 = klbkUsers[t2.uid]?.name || t2.uid;
    
    let p = allNobetPlans[viewingPlanId];
    if (p.status === 'published' && p.startDate) {
        let diffTime = new Date().getTime() - new Date(p.startDate).getTime();
        let weeksPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (weeksPassed > 0) {
            const { isConfirmed } = await Swal.fire({
                title: 'Dikkat!',
                text: 'Bu plan yayında ve dinamik dönüşüm aşamasında. Takas yaparsanız değişiklikler 1. haftadaki ORİJİNAL taslağa uygulanır!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Devam Et',
                cancelButtonText: 'İptal'
            });
            if(!isConfirmed) return;
        }
    }
    
    const { isConfirmed } = await Swal.fire({
        title: 'Nöbet Takası Onayı',
        html: `<b>${name1}</b> ile <b>${name2}</b> kişilerinin nöbet günlerini veya yerlerini takas etmek istediğinize emin misiniz?<br><br><i>Not: Bu işlem orijinal plana işlenecektir.</i>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Evet, Takas Et',
        cancelButtonText: 'İptal'
    });
    
    if (isConfirmed) {
        let plan = allNobetPlans[viewingPlanId].data;
        
        let shift1 = null, shift2 = null;
        for (let sid in plan[t1.dateStr]) {
            if (plan[t1.dateStr][sid].includes(t1.uid)) shift1 = sid;
        }
        for (let sid in plan[t2.dateStr]) {
            if (plan[t2.dateStr][sid].includes(t2.uid)) shift2 = sid;
        }
        
        if (shift1 && shift2) {
            let idx1 = plan[t1.dateStr][shift1].indexOf(t1.uid);
            let idx2 = plan[t2.dateStr][shift2].indexOf(t2.uid);
            
            plan[t1.dateStr][shift1][idx1] = t2.uid;
            plan[t2.dateStr][shift2][idx2] = t1.uid;
            
            window.selectedSwapTeacher = null;
            await savePlanChanges('Öğretmenler başarıyla takas edildi.');
        } else {
            Swal.fire('Hata', 'Kişilerin baz plandaki yerleri bulunamadı.', 'error');
        }
    }
};

async function savePlanChanges(successMsg) {
    let p = allNobetPlans[viewingPlanId];
    try {
        await fetch('/api/updateNobet', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'plans', data: allNobetPlans })
        });
        
        if (p.status === 'published') {
            await fetch('/api/updateNobet', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'publishedPlan', data: p })
            });
        }
        
        currentWeekPlan = applyDynamicRotation(p.data, p.startDate, nobetSettings.dutyType || 'fixed');
        renderWeeklyPlan();
        
        Swal.fire('Başarılı', successMsg, 'success');
    } catch(e) {
        Swal.fire('Hata', 'Değişiklik kaydedilemedi: ' + e.message, 'error');
    }
}

window.openPrintTab = async () => {
    let p = allNobetPlans[viewingPlanId];
    if (!p) return;

    let activeDutyType = (p && p.dutyType) ? p.dutyType : null;
    
    // For old plans missing dutyType, ask the user to set it
    if (!activeDutyType && p.status !== 'draft') {
        const { value: selectedType } = await Swal.fire({
            title: 'Plan Türü Belirleme',
            html: 'Bu plan eski bir versiyonda oluşturulmuş. Lütfen bu planın türünü seçiniz (Bu seçim kaydedilecektir):',
            input: 'select',
            inputOptions: {
                'weekly': 'Haftalık Dönüşümlü',
                'monthly': 'Aylık Dönüşümlü',
                'fixed': 'Sabit (Değişmez)'
            },
            inputPlaceholder: 'Plan türünü seçin',
            showCancelButton: true,
            confirmButtonText: 'Kaydet ve Devam Et',
            cancelButtonText: 'İptal'
        });
        if (selectedType) {
            p.dutyType = selectedType;
            activeDutyType = selectedType;
            // Save to firebase
            await fetch('/api/updateNobet', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: `plans/${viewingPlanId}/dutyType`,
                    data: selectedType
                })
            });
            window.updatePlanActionButtons();
        } else {
            return; // Cancelled
        }
    } else if (!activeDutyType) {
        activeDutyType = nobetSettings.dutyType || 'weekly';
    }
    
    if (isAdmin && p && p.status === 'published' && (activeDutyType === 'weekly' || activeDutyType === 'monthly')) {
        let qHtml = activeDutyType === 'monthly' ? `Yazdırmak istediğiniz ayın/döngünün içinden herhangi bir tarih seçiniz.<br><br><small>Seçtiğiniz tarihe denk gelen 4 haftalık döngü tarihi yazdırılacaktır.</small>` : `Hangi haftanın planını yazdırmak istersiniz?<br><br><small>Seçtiğiniz tarihteki dönüşüm düzeni ve nöbet sayıları hesaplanacaktır.</small>`;
        const { value: targetDateStr } = await Swal.fire({
            title: 'Yazdırma Tarihi Seçimi',
            html: qHtml,
            input: 'date',
            inputValue: new Date().toISOString().split('T')[0],
            showCancelButton: true,
            confirmButtonText: 'Devam Et',
            cancelButtonText: 'İptal'
        });
        
        if (!targetDateStr) return; // Cancelled
        
        // Re-calculate based on selected date
        let targetDateObj = new Date(targetDateStr);
        currentWeekPlan = applyDynamicRotation(p.data, p.startDate, activeDutyType, targetDateObj);
        
        // Update the banner date format based on duty type
        let formatDateShort = (dStr) => {
            if (!dStr) return "";
            let d = new Date(dStr);
            let day = String(d.getDate()).padStart(2, '0');
            let month = String(d.getMonth()+1).padStart(2, '0');
            let year = d.getFullYear();
            return `${day}.${month}.${year}`;
        };
        
        let cycleWeeks = activeDutyType === 'monthly' ? 4 : 1;
        let diffTime = targetDateObj.getTime() - new Date(p.startDate).getTime();
        let weeksPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (weeksPassed < 0) weeksPassed = 0;
        
        let cyclesPassed = Math.floor(weeksPassed / cycleWeeks);
        let currentCycleStart = new Date(p.startDate);
        currentCycleStart.setDate(currentCycleStart.getDate() + (cyclesPassed * cycleWeeks * 7));
        
        let currentCycleEnd = new Date(currentCycleStart.getTime());
        currentCycleEnd.setDate(currentCycleEnd.getDate() + ((cycleWeeks - 1) * 7) + 4); // Friday of last week
        
        window.customPrintDateText = " "; // Hide any inner header
        
        // Official Header and Footer values
        window.tempPrintHeaderData = {
            start: formatDateShort(currentCycleStart),
            end: formatDateShort(currentCycleEnd)
        };
        
        renderWeeklyPlan();
        
        // Small delay to let UI update before extracting HTML
        await new Promise(r => setTimeout(r, 100));
    }
    
    let printContent = document.getElementById('printablePlanArea').innerHTML;
    
    // If we changed the date for printing, revert it back to today's view for the live dashboard
    let activeDutyType2 = (p && p.dutyType) ? p.dutyType : nobetSettings.dutyType;
    if (isAdmin && p && p.status === 'published' && (activeDutyType2 === 'weekly' || activeDutyType2 === 'monthly')) {
        currentWeekPlan = applyDynamicRotation(p.data, p.startDate, activeDutyType2);
        renderWeeklyPlan();
    }
    
    // Fallback if tempPrintHeaderData was not set (e.g. fixed plan)
    if (!window.tempPrintHeaderData) {
        let pInfo = allNobetPlans[viewingPlanId] || publishedPlanMeta;
        let pStartDate = pInfo && pInfo.startDate ? new Date(pInfo.startDate) : new Date();
        let pStartStr = String(pStartDate.getDate()).padStart(2,'0') + "." + String(pStartDate.getMonth()+1).padStart(2,'0') + "." + pStartDate.getFullYear();
        window.tempPrintHeaderData = { start: pStartStr, end: '...' };
    }
    
    let mudurObj = Object.values(klbkUsers).find(u => u.role === 'mudur');
    let mudurName = mudurObj ? mudurObj.name : '.......................';
    
    let validSchoolName = '';
    if (mudurObj && mudurObj.schoolName) {
        validSchoolName = mudurObj.schoolName;
    } else {
        let anyUser = Object.values(klbkUsers).find(u => u.schoolName);
        if (anyUser) validSchoolName = anyUser.schoolName;
    }
    
    if (!validSchoolName) {
        validSchoolName = sessionStorage.getItem('klbk_schoolName') || localStorage.getItem('klbk_lastSchoolName') || localStorage.getItem('klbk_schoolName') || localStorage.getItem('schoolName') || '';
    }
    
    let sName = validSchoolName.trim() ? validSchoolName : '.......................';
    
    let paragraphText = '';
    let finalDutyType = (p && p.dutyType) ? p.dutyType : nobetSettings.dutyType;
    if (finalDutyType === 'fixed') {
        paragraphText = `Okulumuzda <b>${window.tempPrintHeaderData.start}</b> Pazartesi gününden itibaren uygulanacak nöbetçi öğretmen çizelgesi aşağıdadır.<br>Bilgilerinizi rica ederim.`;
    } else {
        paragraphText = `Okulumuzda <b>${window.tempPrintHeaderData.start}</b> Pazartesi - <b>${window.tempPrintHeaderData.end}</b> Cuma günleri arasında uygulanacak nöbetçi öğretmen çizelgesi aşağıdadır.<br>Bilgilerinizi rica ederim.`;
    }

    let officialHeader = `
        <div style="text-align: center; margin-top: 40px; margin-bottom: 25px;">
            <h2 style="margin: 0; font-size: 14pt;">${sName.toUpperCase()} MÜDÜRLÜĞÜ</h2>
        </div>
        <p style="text-align: justify; font-size: 12pt; margin-bottom: 15px; line-height: 1.5;">
            ${paragraphText}
        </p>
    `;
    let officialFooter = `
        <div style="margin-top: 80px; text-align: center; width: 300px; margin-left: auto; margin-right: auto;">
            <div style="margin-bottom: 50px;">${window.tempPrintHeaderData.start}</div>
            <div style="font-weight: bold; text-decoration: underline;">${mudurName}</div>
            <div>Okul Müdürü</div>
        </div>
        <div style="clear: both;"></div>
    `;
    window.tempPrintHeaderData = null; // reset
    
    let win = window.open('', '_blank');
    if(!win) {
        Swal.fire('Hata', 'Açılır pencere engelleyicisi yeni sekmeyi engelledi. Lütfen izin verin.', 'error');
        return;
    }
    
    win.document.write(`
        <html>
        <head>
            <title>Nöbet Planı</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    background: #f3f4f6;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .a4-container {
                    background: #fff;
                    width: 210mm;
                    min-height: 297mm;
                    padding: 10mm;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                @page { size: A4 portrait; margin: 5mm; }
                table { 
                    width: 100% !important; 
                    min-width: 100% !important; 
                    max-width: 100% !important; 
                    border-collapse: collapse; 
                    margin-top: 15px; 
                    table-layout: fixed;
                    box-shadow: none !important;
                    border-radius: 0 !important;
                }
                th, td { 
                    border: 1.5px solid #000 !important; 
                    padding: 6px; 
                    text-align: center; 
                    font-size: 9pt; 
                    color: black !important; 
                    word-wrap: break-word; 
                }
                th { background-color: #e5e7eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
                span { color: black !important; text-decoration: none !important; }
                span[style*="opacity:0.8"] { color: #444 !important; font-size: 0.8em; display:block; margin-top:2px; }
                .print-actions { text-align: center; margin-bottom: 15px; display: flex; gap: 15px; justify-content: center; width: 100%; }
                .print-actions button {
                    color: white; border: none; padding: 10px 20px; 
                    border-radius: 6px; cursor: pointer; font-size: 15px; font-weight: bold;
                }
                .btn-pdf { background: #dc2626; }
                .btn-print { background: #2563eb; }
                @media print {
                    body { background: #fff; padding: 0; display: block; }
                    .a4-container { width: 100%; min-height: auto; padding: 0; box-shadow: none; margin: 0; }
                    .print-actions { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="print-actions">
                <button class="btn-pdf" onclick="alert('Lütfen açılan yazdırma penceresinde hedefi \\'PDF Olarak Kaydet\\' seçiniz.'); window.print();">PDF İndir</button>
                <button class="btn-print" onclick="window.print()">Yazdır</button>
            </div>
            <div class="a4-container">
                ${officialHeader}
                ${printContent}
                ${officialFooter}
            </div>
        </body>
        </html>
    `);
    
    win.document.close();
};
