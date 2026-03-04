document.addEventListener('DOMContentLoaded', () => {

    const masterForm = document.getElementById('masterForm');

    // Form Elements
    const regSchoolSelect = document.getElementById('regSchoolSelect');
    const newSchoolGroup = document.getElementById('newSchoolGroup');
    const regSchoolNewInput = document.getElementById('regSchoolNew');
    const branchGroup = document.getElementById('branchGroup');
    const regBranchSelect = document.getElementById('regBranch');
    const regRoleSelect = document.getElementById('regRole');

    const regUsernameInput = document.getElementById('regUsername');
    const regPasswordInput = document.getElementById('regPassword');
    const messageBox = document.getElementById('masterMessage');

    // Supabase Configuration
    const supabaseUrl = "https://esdttjvkqyeaosdcsskr.supabase.co";
    const supabaseKey = "sb_publishable_Rdl1xQ10AjWVZPxLwL_O_A_x4NYDxl6";

    // Global config
    let globalUsersDb = {};
    let uniqueSchools = []; // { storeKey: string, name: string }


    async function getCloudUsers() {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/app_store?id=eq.klbk_users&select=*`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
                const rows = await res.json();
                if (rows && rows.length > 0) return rows[0].data;
            }
        } catch (e) {
            console.error("Bulut verisi çekilirken hata:", e);
        }
        return {
            'admin': { password: 'admin', schoolName: 'Sistem Yöneticisi', role: 'master' }
        };
    }

    async function saveToCloud(id, dataObj) {
        try {
            await fetch(`${supabaseUrl}/rest/v1/app_store`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({ id: id, data: dataObj })
            });
        } catch (e) {
            console.error("Buluta veri kaydedilirken hata:", e);
        }
    }

    // Initialize Page
    async function initMasterPage() {
        globalUsersDb = await getCloudUsers();

        // Extract unique schools
        const schoolMap = {};
        for (const [uname, user] of Object.entries(globalUsersDb)) {
            // We no longer skip 'admin' here because the admin might want to assign
            // teachers to their own school name they configured on the dashboard.

            // Legacy data support (before multiple users per school feature)
            // If the user has a schoolName but no storeKey, we assume their storeKey is klbk_data_{username}
            const sName = user.schoolName;
            let sKey = user.storeKey;

            if (sName) {
                if (!sKey) {
                    sKey = `klbk_data_${uname}`; // Infer the original storeKey
                }

                // Only add if we haven't tracked this explicit storeKey yet
                if (!schoolMap[sKey]) {
                    schoolMap[sKey] = sName;
                }
            }
        }

        uniqueSchools = Object.keys(schoolMap).map(k => ({ storeKey: k, name: schoolMap[k] }));

        // Populate Select
        regSchoolSelect.innerHTML = '<option value="">-- Okul Seçiniz --</option>';
        uniqueSchools.forEach(sc => {
            const opt = document.createElement('option');
            opt.value = sc.storeKey;
            opt.textContent = sc.name;
            regSchoolSelect.appendChild(opt);
        });

        const newOpt = document.createElement('option');
        newOpt.value = "_NEW_";
        newOpt.textContent = "+ Yeni Okul Ekle (Sisteme Tanımla)";
        newOpt.style.fontWeight = "bold";
        newOpt.style.color = "var(--primary)";
        regSchoolSelect.appendChild(newOpt);
    }

    // Role Change UI Logic
    regRoleSelect.addEventListener('change', () => {
        if (regRoleSelect.value === 'ogretmen') {
            branchGroup.classList.remove('hidden');
        } else {
            branchGroup.classList.add('hidden');
        }
    });

    // Fetch School Data for Branches
    async function fetchSchoolBranches(storeKey) {
        regBranchSelect.innerHTML = '<option value="">Yükleniyor...</option>';
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/app_store?id=eq.${storeKey}&select=*`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
                const rows = await res.json();
                if (rows && rows.length > 0 && rows[0].data.school && rows[0].data.school.subjects) {
                    const subjects = rows[0].data.school.subjects;
                    regBranchSelect.innerHTML = '<option value="">-- Branş Seçiniz --</option>';
                    subjects.forEach(sub => {
                        const opt = document.createElement('option');
                        opt.value = sub;
                        opt.textContent = sub;
                        regBranchSelect.appendChild(opt);
                    });
                    if (subjects.length === 0) {
                        regBranchSelect.innerHTML = '<option value="">Okulda henüz ders tanımlanmamış</option>';
                    }
                    return;
                }
            }
        } catch (e) {
            console.error("Dersler alınamadı", e);
        }
        regBranchSelect.innerHTML = '<option value="">Okulda henüz ders tanımlanmamış</option>';
    }

    // School Select Change Logic
    regSchoolSelect.addEventListener('change', async () => {
        const val = regSchoolSelect.value;
        if (val === '_NEW_') {
            newSchoolGroup.classList.remove('hidden');
            regSchoolNewInput.required = true;
            branchGroup.classList.add('hidden');
            regRoleSelect.value = 'admin'; // Forced admin for new schools usually or idareci
            regRoleSelect.disabled = false;
        } else if (val) {
            newSchoolGroup.classList.add('hidden');
            regSchoolNewInput.required = false;
            regSchoolNewInput.value = '';
            if (regRoleSelect.value === 'ogretmen') {
                branchGroup.classList.remove('hidden');
                await fetchSchoolBranches(val);
            }
        } else {
            newSchoolGroup.classList.add('hidden');
            regSchoolNewInput.required = false;
            regBranchSelect.innerHTML = '<option value="">Lütfen Önce Okul Seçin</option>';
        }
    });

    if (masterForm) {
        masterForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isNewSchool = regSchoolSelect.value === '_NEW_';
            const storeKeyToUse = isNewSchool ? `klbk_data_${regUsernameInput.value.trim()}` : regSchoolSelect.value;
            const schoolNameToUse = isNewSchool ? regSchoolNewInput.value.trim() : regSchoolSelect.options[regSchoolSelect.selectedIndex].text;

            const username = regUsernameInput.value.trim();
            const password = regPasswordInput.value;
            const role = regRoleSelect.value;
            let branch = [];

            if (role === 'ogretmen' && !isNewSchool) {
                // Collect selected options for multiple branches
                const options = Array.from(regBranchSelect.options);
                branch = options.filter(opt => opt.selected).map(opt => opt.value);

                if (branch.length === 0) {
                    showMessage('Lütfen geçerli en az bir branş seçiniz.', 'error');
                    return;
                }
            }

            if (!schoolNameToUse) {
                showMessage('Lütfen kurum adını belirtin.', 'error');
                return;
            }

            if (username.length < 3) {
                showMessage('Kullanıcı adı en az 3 karakter olmalıdır.', 'error');
                return;
            }
            if (password.length < 4) {
                showMessage('Şifre en az 4 karakter olmalıdır.', 'error');
                return;
            }

            // Loading state
            const btn = masterForm.querySelector('button[type="submit"]');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
            btn.disabled = true;

            const usersDb = await getCloudUsers();

            // Check if user already exists
            if (usersDb[username]) {
                showMessage(`'${username}' kullanıcı adı zaten kullanılıyor. Lütfen başka bir tane seçin.`, 'error');
                shakeForm();
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                return;
            }

            // Save new user
            usersDb[username] = {
                password: password,
                schoolName: schoolNameToUse,
                storeKey: storeKeyToUse,
                role: role,
                branch: branch
            };
            await saveToCloud('klbk_users', usersDb);

            // Pre-seed default settings for the new school logic
            if (isNewSchool) {
                const initialData = {
                    school: {
                        name: schoolNameToUse,
                        academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
                        principal: '', vicePrincipal: '', gradeLevels: [], subjects: []
                    },
                    students: [], classrooms: [], examSessions: []
                };
                await saveToCloud(storeKeyToUse, initialData);
            }

            showMessage(`${schoolNameToUse} için kullanıcı '${username}' başarıyla sisteme eklendi!`, 'success');

            // clear form
            masterForm.reset();
            btn.innerHTML = originalHtml;
            btn.disabled = false;

            // Reload select
            setTimeout(() => {
                initMasterPage();
            }, 1000);
        });
    }

    // Call init on load
    initMasterPage();


    function showMessage(text, type) {
        if (!messageBox) return;
        messageBox.innerHTML = type === 'error'
            ? `<i class="fa-solid fa-circle-exclamation"></i> ${text}`
            : `<i class="fa-solid fa-circle-check"></i> ${text}`;

        messageBox.className = `message-box ${type}`;
        messageBox.classList.remove('hidden');
    }

    function shakeForm() {
        const loginCard = document.querySelector('.login-card');
        if (!loginCard) return;
        loginCard.style.animation = 'none';
        loginCard.offsetHeight; /* trigger reflow */
        loginCard.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => { loginCard.style.animation = 'none'; }, 500);
    }

});
