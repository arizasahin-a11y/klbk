document.addEventListener('DOMContentLoaded', () => {

    // Path Enforcement: Block direct access to master.html
    const path = window.location.pathname;
    if (path.includes('master.html')) {
        window.location.href = '/security_error';
        return;
    }

    const masterForm = document.getElementById('masterForm');

    // Form Elements
    const regSchoolSelect = document.getElementById('regSchoolSelect');
    const editSchoolNameBtn = document.getElementById('editSchoolNameBtn');
    const newSchoolGroup = document.getElementById('newSchoolGroup');
    const regSchoolNewInput = document.getElementById('regSchoolNew');
    const branchGroup = document.getElementById('branchGroup');
    const regBranchSelect = document.getElementById('regBranch');
    const regRoleSelect = document.getElementById('regRole');

    const usernameNewGroup = document.getElementById('usernameNewGroup');
    const regUsernameSelect = document.getElementById('regUsernameSelect');
    const btnDeleteUser = document.getElementById('btnDeleteUser');
    const btnSubmitMaster = document.getElementById('btnSubmitMaster');
    const regUsernameInput = document.getElementById('regUsername');
    const regPasswordInput = document.getElementById('regPassword');
    const regEmailInput = document.getElementById('regEmail');
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
            const sName = user.schoolName;
            const sKey = getUserStoreKey(uname, user);

            if (sName && sKey) {
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

        // Load persistent selection
        const savedKey = localStorage.getItem('klbk_master_last_school');
        if (savedKey && globalUsersDb) {
            const exists = uniqueSchools.some(sc => sc.storeKey === savedKey);
            if (exists) {
                regSchoolSelect.value = savedKey;
                // Use a small timeout to ensure the dropdown is ready before triggering change
                setTimeout(() => {
                    regSchoolSelect.dispatchEvent(new Event('change'));
                }, 100);
            }
        }
    }

    // Role Change UI Logic
    regRoleSelect.addEventListener('change', () => {
        if (regRoleSelect.value === 'ogretmen') {
            branchGroup.classList.remove('hidden');
        } else {
            branchGroup.classList.add('hidden');
        }
    });

    // Helper to resolve storeKey for a user
    function getUserStoreKey(uname, user) {
        if (user.storeKey) return user.storeKey;
        // Legacy: Infer from username if schoolName exists
        if (user.schoolName) return `klbk_data_${uname}`;
        return null;
    }

    // Fetch School Data for Branches
    async function fetchSchoolBranches(storeKey) {
        if (!regBranchSelect) return;
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

    function updateUsersList(storeKey) {
        if (!regUsernameSelect) return;
        regUsernameSelect.innerHTML = '<option value="">-- Kullanıcı Seçiniz --</option>';

        const schoolUsers = Object.keys(globalUsersDb).filter(uname => {
            const user = globalUsersDb[uname];
            const uKey = getUserStoreKey(uname, user);
            return uKey === storeKey;
        });

        schoolUsers.forEach(uname => {
            const opt = document.createElement('option');
            opt.value = uname;
            opt.textContent = uname;
            regUsernameSelect.appendChild(opt);
        });

        const newOpt = document.createElement('option');
        newOpt.value = "_NEW_USER_";
        newOpt.textContent = "+ Yeni Kullanıcı Ekle";
        newOpt.style.fontWeight = "bold";
        newOpt.style.color = "var(--secondary)";
        regUsernameSelect.appendChild(newOpt);
    }

    // School Select Change Logic
    regSchoolSelect.addEventListener('change', async () => {
        const val = regSchoolSelect.value;
        resetUserForm();

        // Save persistent selection (only for valid existing schools)
        if (val && val !== '_NEW_') {
            localStorage.setItem('klbk_master_last_school', val);
        } else if (!val) {
            localStorage.removeItem('klbk_master_last_school');
        }

        if (val === '_NEW_') {
            newSchoolGroup.classList.remove('hidden');
            regSchoolNewInput.required = true;
            branchGroup.classList.add('hidden');
            regRoleSelect.value = 'admin';
            regRoleSelect.disabled = false;
            if (editSchoolNameBtn) editSchoolNameBtn.classList.add('hidden');

            // New school implies new user
            regUsernameSelect.innerHTML = '<option value="_NEW_USER_">+ Yeni Kullanıcı Ekle</option>';
            regUsernameSelect.value = "_NEW_USER_";
            regUsernameSelect.dispatchEvent(new Event('change'));
        } else if (val) {
            newSchoolGroup.classList.add('hidden');
            regSchoolNewInput.required = false;
            regSchoolNewInput.value = '';
            if (editSchoolNameBtn) editSchoolNameBtn.classList.remove('hidden');

            updateUsersList(val);
            if (regRoleSelect.value === 'ogretmen') {
                await fetchSchoolBranches(val);
            }
        } else {
            newSchoolGroup.classList.add('hidden');
            regSchoolNewInput.required = false;
            regUsernameSelect.innerHTML = '<option value="">Lütfen Önce Okul Seçin</option>';
            if (editSchoolNameBtn) editSchoolNameBtn.classList.add('hidden');
        }
    });

    // Username Select Change Logic
    regUsernameSelect.addEventListener('change', async () => {
        const uname = regUsernameSelect.value;
        if (uname === "_NEW_USER_") {
            resetUserFormFields();
            usernameNewGroup.classList.remove('hidden');
            const labelEl = document.querySelector('#usernameNewGroup label');
            if (labelEl) labelEl.textContent = 'Yeni Kullanıcı Adı';
            regUsernameInput.required = true;
            btnDeleteUser.classList.add('hidden');
            updateSubmitButton(false);
        } else if (uname) {
            usernameNewGroup.classList.remove('hidden');
            const labelEl = document.querySelector('#usernameNewGroup label');
            if (labelEl) labelEl.innerHTML = 'Kullanıcı Adı <small>(Düzenlenebilir)</small>';
            regUsernameInput.value = uname;
            regUsernameInput.required = true;
            btnDeleteUser.classList.remove('hidden');
            updateSubmitButton(true);

            // Populate user data
            const user = globalUsersDb[uname];
            regPasswordInput.value = user.password || '';
            regEmailInput.value = user.email || '';
            regRoleSelect.value = user.role || 'ogretmen';

            if (regRoleSelect.value === 'ogretmen') {
                branchGroup.classList.remove('hidden');
                const storeKey = regSchoolSelect.value;
                await fetchSchoolBranches(storeKey);

                // Select branches
                const branches = user.branch || [];
                Array.from(regBranchSelect.options).forEach(opt => {
                    opt.selected = branches.includes(opt.value);
                });
            } else {
                branchGroup.classList.add('hidden');
            }
        } else {
            resetUserFormFields();
            updateSubmitButton(false);
        }
    });

    function resetUserForm() {
        regUsernameSelect.value = "";
        resetUserFormFields();
    }

    function resetUserFormFields() {
        usernameNewGroup.classList.add('hidden');
        regUsernameInput.value = "";
        regPasswordInput.value = "";
        regEmailInput.value = "";
        regRoleSelect.value = "ogretmen";
        regRoleSelect.dispatchEvent(new Event('change'));
        btnDeleteUser.classList.add('hidden');
    }

    function updateSubmitButton(isEdit) {
        if (isEdit) {
            btnSubmitMaster.innerHTML = '<i class="fa-solid fa-save"></i> <span>Kullanıcıyı Güncelle</span>';
            btnSubmitMaster.className = "btn btn-info btn-block btn-lg";
        } else {
            btnSubmitMaster.innerHTML = '<i class="fa-solid fa-plus-circle"></i> <span>Okul Ekle ve Kullanıcı Oluştur</span>';
            btnSubmitMaster.className = "btn btn-primary btn-block btn-lg";
        }
    }

    // Delete User Logic
    btnDeleteUser.addEventListener('click', async () => {
        const uname = regUsernameSelect.value;
        if (!uname || uname === "_NEW_USER_") return;

        if (!confirm(`'${uname}' kullanıcısını silmek istediğinize emin misiniz?`)) return;

        btnDeleteUser.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Siliyor...';
        btnDeleteUser.disabled = true;

        try {
            delete globalUsersDb[uname];
            await saveToCloud('klbk_users', globalUsersDb);
            showMessage(`'${uname}' kullanıcısı başarıyla silindi.`, 'success');

            setTimeout(() => {
                btnDeleteUser.innerHTML = '<i class="fa-solid fa-trash"></i> Kullanıcıyı Sil';
                btnDeleteUser.disabled = false;
                const currentSchool = regSchoolSelect.value;
                updateUsersList(currentSchool);
                resetUserForm();
            }, 1000);
        } catch (err) {
            console.error("Silme hatası:", err);
            showMessage("Kullanıcı silinemedi.", "error");
            btnDeleteUser.disabled = false;
        }
    });

    // Edit School Name Logic
    if (editSchoolNameBtn) {
        editSchoolNameBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const storeKey = regSchoolSelect.value;
            const currentName = regSchoolSelect.options[regSchoolSelect.selectedIndex].text;
            if (!storeKey || storeKey === '_NEW_') return;

            const newName = prompt("Kurumun yeni adını giriniz:", currentName);
            if (!newName || newName.trim() === '' || newName === currentName) return;

            editSchoolNameBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
            editSchoolNameBtn.style.pointerEvents = 'none';

            try {
                // 1. Update Master DB (klbk_users)
                const usersDb = await getCloudUsers();
                let masterUpdated = false;
                for (const [uname, user] of Object.entries(usersDb)) {
                    let uKey = user.storeKey;
                    if (user.schoolName && !uKey) uKey = `klbk_data_${uname}`;

                    if (uKey === storeKey && user.schoolName !== newName) {
                        user.schoolName = newName.trim();
                        masterUpdated = true;
                    }
                }

                if (masterUpdated) {
                    await saveToCloud('klbk_users', usersDb);
                }

                // 2. Update School's Own DB limits
                const res = await fetch(`${supabaseUrl}/rest/v1/app_store?id=eq.${storeKey}&select=*`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (res.ok) {
                    const rows = await res.json();
                    if (rows && rows.length > 0) {
                        const schoolData = rows[0].data;
                        if (schoolData.school) {
                            schoolData.school.name = newName.trim();
                            await saveToCloud(storeKey, schoolData);
                        }
                    }
                }

                showMessage(`Okul adı "${newName.trim()}" olarak başarıyla güncellendi.`, 'success');
                setTimeout(() => {
                    initMasterPage();
                    editSchoolNameBtn.innerHTML = '<i class="fa-solid fa-pen"></i> İsmi Düzenle';
                    editSchoolNameBtn.style.pointerEvents = 'auto';
                }, 1000);

            } catch (err) {
                console.error("İsim değiştirme hatası:", err);
                showMessage("Okul adı güncellenemedi.", "error");
                editSchoolNameBtn.innerHTML = '<i class="fa-solid fa-pen"></i> İsmi Düzenle';
                editSchoolNameBtn.style.pointerEvents = 'auto';
            }
        });
    }

    if (masterForm) {
        masterForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isNewSchool = regSchoolSelect.value === '_NEW_';
            const storeKeyToUse = isNewSchool ? `klbk_data_${regUsernameInput.value.trim()}` : regSchoolSelect.value;
            const schoolNameToUse = isNewSchool ? regSchoolNewInput.value.trim() : regSchoolSelect.options[regSchoolSelect.selectedIndex].text;

            const username = regUsernameInput.value.trim();
            const password = regPasswordInput.value;
            const email = regEmailInput ? regEmailInput.value.trim() : '';
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
            const originalHtml = btnSubmitMaster.innerHTML;
            btnSubmitMaster.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
            btnSubmitMaster.disabled = true;

            const usersDb = await getCloudUsers();

            const isEdit = regUsernameSelect.value && regUsernameSelect.value !== "_NEW_USER_";
            const originalUsername = isEdit ? regUsernameSelect.value : null;
            const finalUsername = regUsernameInput.value.trim(); // Always use input

            // Check if user already exists
            if (isEdit && finalUsername !== originalUsername) {
                if (usersDb[finalUsername]) {
                    showMessage(`'${finalUsername}' kullanıcı adı zaten kullanılıyor. Lütfen başka bir tane seçin.`, 'error');
                    shakeForm();
                    btnSubmitMaster.innerHTML = originalHtml;
                    btnSubmitMaster.disabled = false;
                    return;
                }
            } else if (!isEdit && usersDb[finalUsername]) {
                showMessage(`'${finalUsername}' kullanıcı adı zaten kullanılıyor. Lütfen başka bir tane seçin.`, 'error');
                shakeForm();
                btnSubmitMaster.innerHTML = originalHtml;
                btnSubmitMaster.disabled = false;
                return;
            }

            // Save/Update user
            usersDb[finalUsername] = {
                password: password,
                schoolName: schoolNameToUse,
                storeKey: isEdit ? usersDb[originalUsername].storeKey : storeKeyToUse,
                email: email,
                role: role,
                branch: branch
            };

            // If username changed, delete the old one
            if (isEdit && finalUsername !== originalUsername) {
                delete usersDb[originalUsername];
            }

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

            showMessage(`${isEdit ? 'Kullanıcı güncellendi' : 'Yeni kullanıcı oluşturuldu'}: '${finalUsername}'`, 'success');

            // Reset form
            if (isNewSchool || !isEdit) {
                masterForm.reset();
                initMasterPage();
            } else {
                // Keep same school, just refresh user data
                globalUsersDb = usersDb;
                updateUsersList(usersDb[finalUsername].storeKey);
                regUsernameSelect.value = finalUsername;
                regUsernameSelect.dispatchEvent(new Event('change'));
            }
            btnSubmitMaster.innerHTML = originalHtml;
            btnSubmitMaster.disabled = false;

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
