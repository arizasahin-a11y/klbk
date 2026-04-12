document.addEventListener('DOMContentLoaded', () => {

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

    const excelUploadGroup = document.getElementById('excelUploadGroup');
    const regExcelUpload = document.getElementById('regExcelUpload');
    const btnUploadExcel = document.getElementById('btnUploadExcel');
    const excelMessage = document.getElementById('excelMessage');

    const quickBranchDiv = document.getElementById('quickBranchDiv');
    const quickBranchInput = document.getElementById('quickBranchInput');
    const btnSaveQuickBranches = document.getElementById('btnSaveQuickBranches');
    const btnSeedBranches = document.getElementById('btnSeedBranches');

    // Firebase Configuration
    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";

    // Global config
    let globalUsersDb = {};
    let uniqueSchools = []; // { storeKey: string, name: string }


    async function getCloudUsers() {
        try {
            const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
            if (res.ok) {
                const data = await res.json();
                if (data) return data;
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
            const res = await fetch(`${firebaseDatabaseUrl}/app_store/${id}.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataObj)
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Firebase hata: ${res.status} - ${errText}`);
            }
            return true;
        } catch (e) {
            console.error("Buluta veri kaydedilirken hata:", e);
            throw e;
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
        const quickBranchDiv = document.getElementById('quickBranchDiv');
        if (quickBranchDiv) quickBranchDiv.classList.add('hidden');

        try {
            const url = `${firebaseDatabaseUrl}/app_store/${storeKey}.json`;
            const res = await fetch(url);
            
            if (res.ok) {
                const data = await res.json();
                if (!data || !data.school) {
                    regBranchSelect.innerHTML = '<option value="">Sunucuda okul verisi henüz yok</option>';
                    if (quickBranchDiv) quickBranchDiv.classList.remove('hidden');
                    return;
                }

                if (data.school.subjects && data.school.subjects.length > 0) {
                    const subjects = data.school.subjects;
                    regBranchSelect.innerHTML = '<option value="">-- Branş Seçiniz --</option>';
                    subjects.forEach(sub => {
                        const opt = document.createElement('option');
                        opt.value = sub;
                        opt.textContent = sub;
                        regBranchSelect.appendChild(opt);
                    });
                } else {
                    regBranchSelect.innerHTML = '<option value="">Okulda henüz ders tanımlanmamış</option>';
                    if (quickBranchDiv) quickBranchDiv.classList.remove('hidden');
                }
            } else {
                regBranchSelect.innerHTML = `<option value="">Hata (${res.status}): Bağlantı reddedildi</option>`;
            }
        } catch (e) {
            console.error("Dersler alınamadı", e);
            regBranchSelect.innerHTML = '<option value="">Sunucu bağlantı hatası!</option>';
        }
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
            if (excelUploadGroup) excelUploadGroup.classList.remove('hidden');

            // New school implies new user
            regUsernameSelect.innerHTML = '<option value="_NEW_USER_">+ Yeni Kullanıcı Ekle</option>';
            regUsernameSelect.value = "_NEW_USER_";
            regUsernameSelect.dispatchEvent(new Event('change'));
        } else if (val) {
            newSchoolGroup.classList.add('hidden');
            regSchoolNewInput.required = false;
            regSchoolNewInput.value = '';
            if (editSchoolNameBtn) editSchoolNameBtn.classList.remove('hidden');
            if (excelUploadGroup) excelUploadGroup.classList.remove('hidden');

            updateUsersList(val);
            if (regRoleSelect.value === 'ogretmen') {
                await fetchSchoolBranches(val);
            }
        } else {
            newSchoolGroup.classList.add('hidden');
            regSchoolNewInput.required = false;
            regUsernameSelect.innerHTML = '<option value="">Lütfen Önce Okul Seçin</option>';
            if (editSchoolNameBtn) editSchoolNameBtn.classList.add('hidden');
            if (excelUploadGroup) excelUploadGroup.classList.add('hidden');
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
                const res = await fetch(`${firebaseDatabaseUrl}/app_store/${storeKey}.json`);
                if (res.ok) {
                    const schoolData = await res.json();
                    if (schoolData) {
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

    if (regExcelUpload && btnUploadExcel) {
        regExcelUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                btnUploadExcel.classList.remove('hidden');
            } else {
                btnUploadExcel.classList.add('hidden');
            }
            if (excelMessage) excelMessage.innerText = '';
        });

        btnUploadExcel.addEventListener('click', async () => {
            const isNewSchool = regSchoolSelect.value === '_NEW_';
            let storeKeyToUse = isNewSchool ? `klbk_data_${Date.now()}` : regSchoolSelect.value;
            let schoolNameToUse = isNewSchool ? regSchoolNewInput.value.trim() : regSchoolSelect.options[regSchoolSelect.selectedIndex].text;

            if (!schoolNameToUse || (isNewSchool && !regSchoolNewInput.value.trim())) {
                excelMessage.style.color = "var(--danger)";
                excelMessage.innerText = "Lütfen önce kurum adını belirtin!";
                return;
            }

            const file = regExcelUpload.files[0];
            if (!file) return;

            btnUploadExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
            btnUploadExcel.disabled = true;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    const usersDb = await getCloudUsers();
                    let addedCount = 0;
                    let errorCount = 0;

                    for (let i = 1; i < json.length; i++) {
                        const row = json[i];
                        if (!row || row.length === 0) continue;
                        
                        let adSoyad = (row[0] || '').toString().trim();
                        let unameVal = (row[1] || '').toString().trim();
                        let emailVal = (row[2] || '').toString().trim();
                        let passVal = (row[3] || '').toString().trim();
                        let branchesStr = (row[4] || '').toString().trim();
                        let roleVal = (row[5] || '').toString().trim();

                        if (!adSoyad && !unameVal) continue;

                        if (!unameVal) {
                            unameVal = adSoyad.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (usersDb[unameVal]) unameVal += Math.floor(Math.random() * 1000);
                        }
                        if (!passVal) passVal = "123456";

                        if (usersDb[unameVal]) {
                            errorCount++;
                            continue;
                        }

                        let finalRole = roleVal || 'ogretmen';

                        let branches = branchesStr ? branchesStr.split(',').map(b => b.trim()).filter(b => b.length > 0) : [];

                        usersDb[unameVal] = {
                            name: adSoyad,
                            password: passVal,
                            schoolName: schoolNameToUse,
                            storeKey: storeKeyToUse,
                            email: emailVal,
                            role: finalRole,
                            branch: branches
                        };
                        addedCount++;
                    }

                    if (addedCount > 0) {
                        await saveToCloud('klbk_users', usersDb);

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

                        excelMessage.style.color = "green";
                        excelMessage.innerText = `${addedCount} öğretmen başarıyla eklendi. ${errorCount > 0 ? '(' + errorCount + ' mevcut)' : ''}`;
                        globalUsersDb = usersDb;
                        
                        setTimeout(() => {
                            initMasterPage();
                            btnUploadExcel.classList.add('hidden');
                            regExcelUpload.value = '';
                        }, 2000);
                    } else {
                        excelMessage.style.color = "var(--danger)";
                        excelMessage.innerText = "Eklenecek geçerli kayıt bulunamadı veya kullanıcılar zaten mevcut.";
                    }
                } catch (err) {
                    console.error(err);
                    excelMessage.style.color = "var(--danger)";
                    excelMessage.innerText = "Excel okunurken hata oluştu!";
                }
                
                btnUploadExcel.innerHTML = `<i class="fa-solid fa-upload"></i> Excel'i İçeri Aktar`;
                btnUploadExcel.disabled = false;
            };
            reader.readAsArrayBuffer(file);
        });
    }

    if (btnSaveQuickBranches) {
        btnSaveQuickBranches.addEventListener('click', async () => {
            const storeKey = regSchoolSelect.value;
            const branchText = quickBranchInput.value.trim();
            if (!storeKey || !branchText) return;

            const branches = branchText.split(',').map(b => b.trim()).filter(b => b.length > 0);
            if (branches.length === 0) return;

            btnSaveQuickBranches.disabled = true;
            btnSaveQuickBranches.textContent = "Kaydediliyor...";

            try {
                // Fetch current or create new
                let schoolData = { school: { name: regSchoolSelect.options[regSchoolSelect.selectedIndex].text, subjects: [] } };
                const res = await fetch(`${firebaseDatabaseUrl}/app_store/${storeKey}.json`);
                if (res.ok) {
                    const existing = await res.json();
                    if (existing) schoolData = existing;
                }
                
                if (!schoolData.school) schoolData.school = { subjects: [] };
                schoolData.school.subjects = branches;

                await saveToCloud(storeKey, schoolData);
                Swal.fire('Başarılı', 'Dersler okula tanımlandı.', 'success');
                fetchSchoolBranches(storeKey);
            } catch (err) {
                Swal.fire('Hata', 'Dersler kaydedilemedi.', 'error');
            }
            btnSaveQuickBranches.disabled = false;
            btnSaveQuickBranches.textContent = "Kaydet";
        });
    }

    if (btnSeedBranches) {
        btnSeedBranches.addEventListener('click', () => {
            const common = "Matematik, Türk Dili ve Edebiyatı, Fizik, Kimya, Biyoloji, Tarih, Coğrafya, Felsefe, İngilizce, Din Kültürü, Beden Eğitimi, Görsel Sanatlar, Müzik, Almanca, Psikoloji, Sosyoloji";
            quickBranchInput.value = common;
        });
    }

    // Call init on load
    initMasterPage();

    const btnShowActivity = document.getElementById('btnShowActivity');
    if (btnShowActivity) {
        btnShowActivity.addEventListener('click', async () => {
            btnShowActivity.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
            btnShowActivity.disabled = true;

            try {
                const logRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_activity_log.json`);
                let logs = [];
                if (logRes.ok) {
                    const data = await logRes.json();
                    if (data && data.logs) {
                        logs = data.logs;
                    }
                }

                if (!Array.isArray(logs) || logs.length === 0) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Kayıt Bulunamadı',
                        text: 'Henüz sisteme giriş yapmış bir kullanıcı activity logu yok.'
                    });
                } else {
                    let htmlContent = '<div style="max-height: 400px; overflow-y: auto; text-align: left;"><table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">';
                    htmlContent += '<thead style="position: sticky; top: 0; background: #f9f9f9; z-index: 10;"><tr style="border-bottom: 2px solid #ddd;"><th style="padding: 8px;">Kullanıcı</th><th style="padding: 8px;">Okul</th><th style="padding: 8px; text-align: right;">Tarih</th></tr></thead><tbody>';
                    
                    logs.forEach(l => {
                        htmlContent += `<tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px;"><b>${l.username}</b> <small style="color:var(--gray-500)">(${l.role})</small></td>
                            <td style="padding: 8px; color: var(--primary);">${l.school || '-'}</td>
                            <td style="padding: 8px; text-align: right; color: var(--gray-700);">${l.time}</td>
                        </tr>`;
                    });
                    htmlContent += '</tbody></table></div>';

                    const action = await Swal.fire({
                        title: 'Son Giriş Yapanlar (' + logs.length + ')',
                        html: htmlContent,
                        width: '700px',
                        showDenyButton: true,
                        showCancelButton: true,
                        showConfirmButton: false,
                        denyButtonText: '<i class="fa-solid fa-trash"></i> Listeyi Sıfırla',
                        cancelButtonText: 'Kapat',
                        customClass: {
                            denyButton: 'btn btn-danger',
                            cancelButton: 'btn btn-secondary'
                        }
                    });

                    if (action.isDenied) {
                        const confirmReset = await Swal.fire({
                            title: 'Emin misiniz?',
                            text: "Tüm giriş loglarını kalıcı olarak silmek üzeresiniz!",
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#d33',
                            cancelButtonColor: '#3085d6',
                            confirmButtonText: 'Evet, Sıfırla',
                            cancelButtonText: 'İptal'
                        });

                        if (confirmReset.isConfirmed) {
                            await fetch(`${firebaseDatabaseUrl}/app_store/klbk_activity_log.json`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ logs: [] })
                            });
                            Swal.fire('Sıfırlandı!', 'Tüm aktivite logları temizlendi.', 'success');
                        }
                    }
                }
            } catch (err) {
                console.error("Log fetch hatası", err);
                Swal.fire({ icon: 'error', title: 'Hata', text: 'Loglar alınırken bir sorun oluştu.' });
            }

            btnShowActivity.innerHTML = '<i class="fa-solid fa-list-check"></i> <span>Aktivite Seçenekleri (Giriş Logları)</span>';
            btnShowActivity.disabled = false;
        });
    }

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

    // --- Backup & Restore Logic ---
    async function backupMasterData() {
        // Since Supabase might be blocked, we use the local globalUsersDb if fetch fails
        let users = await getCloudUsers();
        if (!users || (Object.keys(users).length === 1 && users.admin)) {
            console.warn("Cloud fetch failed or empty, using local memory data for backup");
            users = globalUsersDb;
        }

        if (!users || Object.keys(users).length === 0) {
            Swal.fire('Hata', 'Yedeklenecek veri bulunamadı.', 'error');
            return;
        }

        const dataStr = JSON.stringify(users, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        a.href = url;
        a.download = `klbk_master_yedek_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'Yedek Alındı!', text: 'Kullanıcı listesi JSON olarak indirildi.', timer: 2000, showConfirmButton: false });
    }

    async function restoreMasterData() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    // Basic validation: must be an object and have at least one user or admin
                    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Geçersiz format: Veriler nesne (object) olmalıdır.');
                    
                    const confirm = await Swal.fire({
                        title: 'Emin misiniz?',
                        text: "Mevcut tüm kullanıcı ve okul listesi bu yedekteki verilerle DEĞİŞTİRİLECEKTİR! Bu işlem geri alınamaz.",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Evet, Geri Yükle',
                        cancelButtonText: 'İptal',
                        confirmButtonColor: '#d33'
                    });

                    if (confirm.isConfirmed) {
                        Swal.fire({ title: 'Yükleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        try {
                            await saveToCloud('klbk_users', parsed);
                            Swal.fire('Başarılı!', 'Kullanıcı veritabanı geri yüklendi. Sayfa yenileniyor...', 'success');
                            setTimeout(() => window.location.reload(), 2000);
                        } catch (err) {
                            Swal.fire('Hata', 'Firebase kaydı başarısız oldu: ' + err.message, 'error');
                        }
                    }
                } catch (err) {
                    Swal.fire('Hata', 'Dosya okunamadı veya format geçersiz: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }

    const btnBackupMaster = document.getElementById('btnBackupMaster');
    const btnRestoreMaster = document.getElementById('btnRestoreMaster');

    if (btnBackupMaster) btnBackupMaster.addEventListener('click', backupMasterData);
    if (btnRestoreMaster) btnRestoreMaster.addEventListener('click', restoreMasterData);

});
