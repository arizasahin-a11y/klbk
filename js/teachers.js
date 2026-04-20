document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on dashboard and teachers view exists
    const viewTeachers = document.getElementById('view-teachers');
    if (!viewTeachers) return;

    // Tabs logic for Teachers View
    const innerTabs = viewTeachers.querySelectorAll('.inner-tab');
    const innerContents = viewTeachers.querySelectorAll('.inner-content');

    innerTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            innerTabs.forEach(t => t.classList.remove('active'));
            innerContents.forEach(c => c.classList.remove('active', 'hidden'));

            tab.classList.add('active');

            const targetId = tab.getAttribute('data-tab');
            innerContents.forEach(c => {
                if (c.id === 'tab-' + targetId) {
                    c.classList.add('active');
                } else {
                    c.classList.add('hidden');
                }
            });
            
            // Refresh list if list tab is clicked
            if (targetId === 'teacherList') {
                loadTeachersList();
            }
        });
    });

    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
    const currentSchoolStoreKey = sessionStorage.getItem('klbk_storeKey');
    const currentSchoolName = sessionStorage.getItem('klbk_schoolName');
    
    let teachersDb = {};

    async function fetchAllUsers() {
        try {
            const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
            if (res.ok) {
                const data = await res.json();
                return data || {};
            }
        } catch (e) {
            console.error("Kullanıcı verisi çekilirken hata:", e);
        }
        return {};
    }

    async function saveUsersToCloud(dataObj) {
        try {
            const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataObj)
            });
            if (!res.ok) throw new Error("Firebase Hata");
            return true;
        } catch (e) {
            console.error("Buluta veri kaydedilirken hata:", e);
            throw e;
        }
    }

    // --- Tab: Öğretmen Listesi ---
    const teachersGridContainer = document.getElementById('teachersGridContainer');
    const teacherSearch = document.getElementById('teacherSearch');
    const autoCleanBtn = document.getElementById('btnAutoCleanTeachers');
    
    let mergeModeSource = null; // Holds uname of the teacher being copied

    async function loadTeachersList() {
        if (!teachersGridContainer) return;
        teachersGridContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--gray-500);"><i class="fa-solid fa-spinner fa-spin"></i> Öğretmenler yükleniyor...</div>';
        
        teachersDb = await fetchAllUsers();
        renderTeachersGrid();
    }

    // YARDIMCI: Ders programını tablo html'ine çevir
    function buildScheduleHtml(scheduleObj) {
        if (!scheduleObj || Object.keys(scheduleObj).length === 0) {
            return `<div style="text-align: center; padding: 1rem; color: var(--gray-500); font-style: italic;">Henüz ders programı atanmamış.</div>`;
        }
        const days = ['Pa', 'Sa', 'Ça', 'Pe', 'Cu'];
        let table = `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.8rem; text-align: center;">
            <tr style="background: var(--gray-100); border-bottom: 1px solid var(--gray-300);">
                <th style="padding: 4px; border-right: 1px solid var(--gray-300);">Gün</th>
                <th style="padding: 4px;">1</th><th style="padding: 4px;">2</th><th style="padding: 4px;">3</th><th style="padding: 4px;">4</th>
                <th style="padding: 4px;">5</th><th style="padding: 4px;">6</th><th style="padding: 4px;">7</th><th style="padding: 4px;">8</th>
            </tr>`;
            
        days.forEach(day => {
            if (scheduleObj[day]) {
                table += `<tr style="border-bottom: 1px dashed var(--gray-200);">
                    <td style="padding: 4px; font-weight: bold; border-right: 1px solid var(--gray-300);">${day}</td>`;
                for (let i = 1; i <= 8; i++) {
                    const cls = scheduleObj[day][i.toString()] || '-';
                    table += `<td style="padding: 4px; color: ${cls !== '-' ? 'var(--primary)' : 'var(--gray-400)'};">${cls}</td>`;
                }
                table += `</tr>`;
            }
        });
        table += `</table>`;
        return table;
    }

    function renderTeachersGrid() {
        if (!teachersGridContainer) return;
        const query = (teacherSearch ? teacherSearch.value.toLowerCase().trim() : '');
        
        const myTeachers = Object.keys(teachersDb).filter(uname => {
            if (uname === 'admin') return false; // skip master admin
            const user = teachersDb[uname];
            // Admin's own school check (by storeKey or schoolName)
            const uKey = user.storeKey || `klbk_data_${uname}`;
            if (uKey !== currentSchoolStoreKey) return false;
            
            // Allow searching
            if (query) {
                const searchStr = `${uname} ${user.name || ''} ${(user.branch || []).join(' ')}`.toLowerCase();
                if (!searchStr.includes(query)) return false;
            }
            
            return true;
        });

        if (myTeachers.length === 0) {
            teachersGridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--gray-500); padding: 2rem;">
                <i class="fa-solid fa-chalkboard-user" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>
                Herhangi bir öğretmen kaydı bulunamadı.
            </div>`;
            return;
        }

        let html = '';
        
        if (mergeModeSource) {
            const srcName = teachersDb[mergeModeSource]?.name || mergeModeSource;
            html += `<div style="grid-column: 1/-1; background: var(--secondary); color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <i class="fa-solid fa-code-merge" style="margin-right: 10px;"></i> 
                    <b>Birleştirme Modu:</b> '${srcName}' adlı öğretmenin şifre ve branş bilgileri aktarılarak birleştirilecek. Lütfen hedef (kalıcı olacak) öğretmenin kartına tıklayın.
                </div>
                <button type="button" class="btn btn-sm" style="background: white; color: var(--dark);" onclick="window.cancelMergeMode()">İptal Et</button>
            </div>`;
        }

        myTeachers.forEach(uname => {
            const user = teachersDb[uname];
            const name = user.name || uname;
            const branches = user.branch && Array.isArray(user.branch) && user.branch.length ? user.branch.join(', ') : 'Branş Yok';
            const role = user.role === 'admin' ? 'Okul İdaresi' : 'Öğretmen';
            const scheduleHtml = buildScheduleHtml(user.schedule);
            
            // Highlight source card
            const isSource = mergeModeSource === uname;
            const cardStyle = isSource ? 'border: 2px solid var(--secondary); opacity: 0.7; pointer-events: none;' : '';
            const clickEvent = mergeModeSource ? `onclick="window.executeMerge('${uname}')"` : `onclick="window.toggleTeacherSchedule('${uname}')"`;
            const contextEvent = !mergeModeSource ? `oncontextmenu="window.handleTeacherContextMenu(event, '${uname}')"` : '';

            html += `
            <div class="stat-card glass-panel" style="display: flex; flex-direction: column; position: relative; cursor: pointer; transition: all 0.2s ease; ${cardStyle}" ${clickEvent} ${contextEvent}>
                <button type="button" class="btn btn-sm" style="position: absolute; top: 10px; right: 10px; padding: 4px 8px; color: var(--danger); background: transparent; border: none; font-size: 1rem; z-index: 10;" title="Sil" onclick="event.stopPropagation(); window.deleteTeacher('${uname}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <div class="stat-icon ${user.role === 'admin' ? 'primary' : 'success'}"><i class="fa-solid fa-user-tie"></i></div>
                    <div>
                        <h3 style="font-size: 1.1rem; color: var(--dark); margin:0;">${name}</h3>
                        <p style="font-size: 0.8rem; color: var(--gray-500); margin: 0;">@${uname} | Şifre: ${user.password}</p>
                    </div>
                </div>
                <div style="font-size: 0.85rem; color: var(--gray-600); margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--gray-200);">
                    <i class="fa-solid fa-briefcase"></i> Yetki: <b>${role}</b><br>
                    <i class="fa-solid fa-book"></i> Branş: <span style="color: var(--primary);">${branches}</span>
                </div>
                <div id="schedule-${uname}" class="hidden" style="margin-top: 10px; border-top: 1px solid var(--gray-200); padding-top: 10px;">
                    ${scheduleHtml}
                </div>
            </div>`;
        });
        teachersGridContainer.innerHTML = html;
    }

    // Toggle Schedule Visibility (Accordion)
    window.toggleTeacherSchedule = function(uname) {
        const el = document.getElementById('schedule-' + uname);
        if (el) {
            el.classList.toggle('hidden');
        }
    };

    if (teacherSearch) {
        teacherSearch.addEventListener('input', renderTeachersGrid);
    }

    window.deleteTeacher = async function(uname) {
        const confirmResult = await Swal.fire({
            title: 'Öğretmeni Sil?',
            text: `'${uname}' adlı hesabı silmek istediğinize emin misiniz?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'İptal'
        });

        if (!confirmResult.isConfirmed) return;

        try {
            if (teachersDb[uname]) {
                delete teachersDb[uname];
                await saveUsersToCloud(teachersDb);
                Swal.fire('Başarılı', 'Öğretmen silindi.', 'success');
                renderTeachersGrid();
            }
        } catch(e) {
            Swal.fire('Hata', 'Kullanıcı silinemedi.', 'error');
        }
    };


    // Context Menu Logic
    const contextMenu = document.getElementById('teacherContextMenu');
    const btnContextMerge = document.getElementById('btnContextMerge');
    let contextActiveUname = null;

    window.addEventListener('click', () => {
        if (contextMenu) contextMenu.style.display = 'none';
    });

    window.handleTeacherContextMenu = function(e, uname) {
        e.preventDefault();
        contextActiveUname = uname;
        if (contextMenu) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = e.pageX + 'px';
            contextMenu.style.top = e.pageY + 'px';
        }
    };

    if (btnContextMerge) {
        btnContextMerge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (contextMenu) contextMenu.style.display = 'none';
            if (contextActiveUname) {
                mergeModeSource = contextActiveUname;
                const topOfGrid = teachersGridContainer.offsetTop;
                window.scrollTo({top: topOfGrid - 50, behavior: 'smooth'});
                renderTeachersGrid();
            }
        });
    }

    window.cancelMergeMode = function() {
        mergeModeSource = null;
        renderTeachersGrid();
    };

    window.executeMerge = async function(targetUname) {
        if (!mergeModeSource || mergeModeSource === targetUname) return;

        const srcObj = teachersDb[mergeModeSource];
        const tgtObj = teachersDb[targetUname];

        const confirmMsg = `'${srcObj.name}' adlı hesaba ait ŞİFRE ve BRANŞ bilgileri '${tgtObj.name}' (${targetUname}) üzerine aktarılacak ve ${mergeModeSource} TAMAMEN SİLİNECEKTİR. Onaylıyor musunuz?`;
        
        const confirmResult = await Swal.fire({
            title: 'Kayıtları Birleştir',
            text: confirmMsg,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            confirmButtonText: 'Evet, Birleştir',
            cancelButtonText: 'İptal'
        });

        if (confirmResult.isConfirmed) {
            // Act: Copy Branch, Password, Email from source to target
            if (srcObj.branch && srcObj.branch.length > 0) tgtObj.branch = srcObj.branch;
            if (srcObj.password) tgtObj.password = srcObj.password;
            if (srcObj.email) tgtObj.email = srcObj.email;
            
            // Delete source
            delete teachersDb[mergeModeSource];

            try {
                await saveUsersToCloud(teachersDb);
                Swal.fire('Başarılı', 'Kayıtlar başarıyla birleştirildi.', 'success');
                mergeModeSource = null;
                renderTeachersGrid();
            } catch(e) {
                Swal.fire('Hata', 'Birleştime kaydedilemedi.', 'error');
            }
        }
    };

    // Auto Clean Feature
    if (autoCleanBtn) {
        autoCleanBtn.addEventListener('click', async () => {
            if (!teachersDb || Object.keys(teachersDb).length === 0) return;

            const confirmResult = await Swal.fire({
                title: 'Otomatik Temizle',
                html: 'Tüm öğretmenler taranacak; <b>tamamen aynı isme</b> sahip 2 ve üzeri kayıt bulunursa otomatik olarak tek kayıt altında toplanacaktır (Şifre ve ders programı birleştirilir). Devam edilsin mi?',
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#007bff',
                confirmButtonText: 'Evet, Temizle',
                cancelButtonText: 'İptal'
            });

            if (!confirmResult.isConfirmed) return;

            let grouped = {};
            let mergedCount = 0;

            Object.keys(teachersDb).forEach(uname => {
                const user = teachersDb[uname];
                if (user.role !== 'admin' && user.storeKey === currentSchoolStoreKey) {
                    const normName = (user.name || uname).toLowerCase().replace(/\s+/g, '');
                    if (!grouped[normName]) grouped[normName] = [];
                    grouped[normName].push(uname);
                }
            });

            for (const nameKey in grouped) {
                const unames = grouped[nameKey];
                if (unames.length > 1) {
                    // Start merging into the first one that has a schedule, or just the first one
                    unames.sort((a,b) => (teachersDb[b].schedule ? 1 : 0) - (teachersDb[a].schedule ? 1 : 0));
                    
                    let targetUname = unames[0];
                    let tgtObj = teachersDb[targetUname];

                    for (let i = 1; i < unames.length; i++) {
                        let srcUname = unames[i];
                        let srcObj = teachersDb[srcUname];

                        if (!tgtObj.schedule && srcObj.schedule) tgtObj.schedule = srcObj.schedule;
                        if (!tgtObj.branch || tgtObj.branch.length === 0) if (srcObj.branch && srcObj.branch.length > 0) tgtObj.branch = srcObj.branch;
                        if (srcObj.password && srcObj.password !== '123456' && tgtObj.password === '123456') tgtObj.password = srcObj.password;
                        if (!tgtObj.email && srcObj.email) tgtObj.email = srcObj.email;

                        delete teachersDb[srcUname];
                        mergedCount++;
                    }
                }
            }

            if (mergedCount > 0) {
                try {
                    await saveUsersToCloud(teachersDb);
                    Swal.fire('Başarılı', `Toplam ${mergedCount} mükerrer kayıt bulunup hedef öğretmenlere entegre edildi ve fazla hesaplar silindi.`, 'success');
                    renderTeachersGrid();
                } catch(e) {
                    Swal.fire('Hata', 'Kayıt sırasında hata oluştu.', 'error');
                }
            } else {
                Swal.fire('Bilgi', 'Aynı isme sahip herhangi bir mükerrer öğretmen bulunamadı.', 'info');
            }
        });
    }

    // --- Tab: Öğretmen Ekle ---
    const btnRefreshBranches = document.getElementById('btnRefreshBranches');
    const teacherBranch = document.getElementById('teacherBranch');
    const teacherForm = document.getElementById('teacherForm');
    
    function populateBranchSelect() {
        if (!teacherBranch) return;
        const schoolSubjects = DataManager.getSchoolSettings().subjects || [];
        teacherBranch.innerHTML = '';
        if(schoolSubjects.length === 0){
            teacherBranch.innerHTML = '<option value="" disabled selected>Önce Okul Ayarları\'ndan ders ekleyin</option>';
            return;
        }
        schoolSubjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            teacherBranch.appendChild(opt);
        });
    }

    if(btnRefreshBranches){
        btnRefreshBranches.addEventListener('click', populateBranchSelect);
    }

    // Populate branches when this view gets opened
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-target') === 'view-teachers') {
                populateBranchSelect();
                loadTeachersList();
            }
        });
    });

    if (teacherForm) {
        teacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('teacherName').value.trim();
            const uname = document.getElementById('teacherUsername').value.trim();
            const password = document.getElementById('teacherPassword').value;
            const email = document.getElementById('teacherEmail').value.trim();
            
            const options = Array.from(teacherBranch.options);
            const branch = options.filter(opt => opt.selected).map(opt => opt.value);

            if (branch.length === 0) {
                Swal.fire('Hata', 'Lütfen en az bir branş seçiniz.', 'error'); return;
            }
            if (uname.length < 3) {
                Swal.fire('Hata', 'Kullanıcı adı en az 3 karakter olmalıdır.', 'error'); return;
            }
            if (/[\.\$\#\[\]\/]/.test(uname)) {
                 Swal.fire('Hata', 'Kullanıcı adı nokta (.) veya özel karakter içeremez.', 'error'); return;
            }

            const btn = teacherForm.querySelector('button[type="submit"]');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
            btn.disabled = true;

            try {
                const usersDb = await fetchAllUsers();
                if (usersDb[uname]) {
                    Swal.fire('Hata', `'${uname}' kullanıcı adı zaten mevcut!`, 'error');
                } else {
                    usersDb[uname] = {
                        name: name,
                        password: password,
                        email: email,
                        role: 'ogretmen',
                        branch: branch,
                        schoolName: currentSchoolName,
                        storeKey: currentSchoolStoreKey
                    };
                    await saveUsersToCloud(usersDb);
                    Swal.fire('Başarılı', `'${name}' öğretmeni başarıyla eklendi!`, 'success');
                    teacherForm.reset();
                    teachersDb = usersDb; // Update local cache
                    renderTeachersGrid();
                    viewTeachers.querySelector('.inner-tab[data-tab="teacherList"]').click();
                }
            } catch (err) {
                Swal.fire('Hata', 'Öğretmen eklenirken hata oluştu.', 'error');
            }
            btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Öğretmeni Ekle';
            btn.disabled = false;
        });
    }


    // --- Tab: Excel'den Toplu Yükleme ---
    const teacherExcelInput = document.getElementById('teacherExcelInput');
    const btnProcessTeacherExcel = document.getElementById('btnProcessTeacherExcel');
    const teacherExcelName = document.getElementById('teacherExcelName');

    if (teacherExcelInput && btnProcessTeacherExcel) {
        teacherExcelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                teacherExcelName.textContent = '';
                btnProcessTeacherExcel.disabled = true;
                return;
            }
            teacherExcelName.textContent = `Seçili: ${file.name}`;
            btnProcessTeacherExcel.disabled = false;
        });

        btnProcessTeacherExcel.addEventListener('click', async () => {
            const file = teacherExcelInput.files[0];
            if (!file) return;

            btnProcessTeacherExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
            btnProcessTeacherExcel.disabled = true;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    const usersDb = await fetchAllUsers();
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

                        if (!adSoyad && !unameVal) continue;

                        if (!unameVal) {
                            // Convert to basic slug for username
                            unameVal = adSoyad.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (usersDb[unameVal]) unameVal += Math.floor(Math.random() * 1000);
                        }
                        if (!passVal) passVal = "123456";

                        if (usersDb[unameVal]) {
                            errorCount++;
                            continue;
                        }

                        let branches = branchesStr ? branchesStr.split(',').map(b => b.trim()).filter(b => b.length > 0) : [];

                        usersDb[unameVal] = {
                            name: adSoyad,
                            password: passVal,
                            email: emailVal,
                            role: 'ogretmen',
                            branch: branches,
                            schoolName: currentSchoolName,
                            storeKey: currentSchoolStoreKey
                        };
                        addedCount++;
                    }

                    if (addedCount > 0) {
                        await saveUsersToCloud(usersDb);
                        Swal.fire('Başarılı', `${addedCount} öğretmen yüklendi. ${errorCount > 0 ? '(' + errorCount + ' mevcut)' : ''}`, 'success');
                        teacherExcelInput.value = '';
                        teacherExcelName.textContent = '';
                        btnProcessTeacherExcel.disabled = true;
                        
                        teachersDb = usersDb; // Update local cache
                        renderTeachersGrid();
                        // Jump back to list
                        viewTeachers.querySelector('.inner-tab[data-tab="teacherList"]').click();
                    } else {
                        Swal.fire('Hata', 'Eklenecek geçerli kayıt bulunamadı veya kullanıcılar zaten mevcut.', 'warning');
                    }
                } catch (err) {
                    Swal.fire('Hata', 'Excel okunurken bir sorun oluştu.', 'error');
                }
                btnProcessTeacherExcel.innerHTML = '<i class="fa-solid fa-upload"></i> İçeri Aktar';
                btnProcessTeacherExcel.disabled = false;
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // --- Tab: Öğretmen Ders Programı Excel Yükleme ---
    const scheduleExcelInput = document.getElementById('scheduleExcelInput');
    const btnProcessScheduleExcel = document.getElementById('btnProcessScheduleExcel');
    const scheduleExcelName = document.getElementById('scheduleExcelName');

    if (scheduleExcelInput && btnProcessScheduleExcel) {
        scheduleExcelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                scheduleExcelName.textContent = '';
                btnProcessScheduleExcel.disabled = true;
                return;
            }
            scheduleExcelName.textContent = `Seçili: ${file.name}`;
            btnProcessScheduleExcel.disabled = false;
        });

        btnProcessScheduleExcel.addEventListener('click', async () => {
            const file = scheduleExcelInput.files[0];
            if (!file) return;

            btnProcessScheduleExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
            btnProcessScheduleExcel.disabled = true;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const usersDb = await fetchAllUsers();
                    
                    let processedCount = 0;
                    let errorCount = 0;
                    
                    const validDays = ['Pa', 'Sa', 'Ça', 'Pe', 'Cu', 'Pa', 'Sa', 'Ca', 'Pe', 'Cu'];
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
                        
                        // Minimum required rows check
                        if (json.length < 4) return;
                        
                        // A1 = Ad Soyad
                        const rawTeacherName = (json[0] && json[0][0] ? json[0][0].toString().trim() : '');
                        if (!rawTeacherName) return; // Skip empty sheets
                        
                        // Koruma: MEB gibi sistemlerin verdiği sahte .xls (MHTML) dosyalarını engelle
                        if (rawTeacherName.startsWith('MIME-Version') || rawTeacherName.startsWith('<html') || rawTeacherName.startsWith('<!DOCTYPE')) {
                            Swal.fire({
                                icon: 'error',
                                title: 'Geçersiz Excel Formatı',
                                html: 'Yüklediğiniz bu .xls dosyası gerçek bir Excel dosyası değil (Web sayfası / MHTML formatında).<br><br>Lütfen bu dosyayı bilgisayarınızdaki MS Excel programıyla açıp <b>"Farklı Kaydet"</b> diyerek <b>"Excel Çalışma Kitabı (*.xlsx)"</b> formatında kaydedin ve oluşan yeni dosyayı sisteme yükleyin.'
                            });
                            throw new Error('MHTML Format Detected'); // Stop processing
                        }

                        // Find Teacher or Add Stub
                        const searchName = rawTeacherName.toLowerCase().replace(/\s+/g, '');
                        let foundUname = '';
                        let isNew = false;
                        
                        for (const [uname, user] of Object.entries(usersDb)) {
                            const dbName = (user.name || '').toLowerCase().replace(/\s+/g, '');
                            if (dbName === searchName || uname === searchName) {
                                // Double check if standardizing characters matches better (e.g. ı->i, ş->s)
                                foundUname = uname;
                                break;
                            }
                        }
                        
                        if (!foundUname) {
                            // Convert to basic slug for username
                            const charMap = {"ş":"s", "ı":"i", "ğ":"g", "ü":"u", "ö":"o", "ç":"c"};
                            foundUname = rawTeacherName.toLowerCase().replace(/[şığıüöç]/g, match => charMap[match]).replace(/[^a-z0-9]/g, '');
                            if (usersDb[foundUname]) foundUname += Math.floor(Math.random() * 1000);
                            
                            usersDb[foundUname] = {
                                name: rawTeacherName,
                                password: "12345",
                                email: "",
                                role: 'ogretmen',
                                branch: [],
                                schoolName: currentSchoolName,
                                storeKey: currentSchoolStoreKey
                            };
                            isNew = true;
                        }
                        
                        const schedule = {};
                        
                        // Start reading from row index 3 (4. satır)
                        for (let i = 3; i < json.length; i++) {
                            const row = json[i];
                            if (!row || !row[0]) continue;
                            
                            const dayCodeStr = row[0].toString().trim();
                            
                            // Normalleştirme Ça->Ca
                            let safeDay = '';
                            if (dayCodeStr.substring(0,2).toLowerCase() === 'pa') safeDay = 'Pa';
                            else if (dayCodeStr.substring(0,2).toLowerCase() === 'sa') safeDay = 'Sa';
                            else if (dayCodeStr.substring(0,2).toLowerCase() === 'ça' || dayCodeStr.substring(0,2).toLowerCase() === 'ca') safeDay = 'Ça';
                            else if (dayCodeStr.substring(0,2).toLowerCase() === 'pe') safeDay = 'Pe';
                            else if (dayCodeStr.substring(0,2).toLowerCase() === 'cu') safeDay = 'Cu';
                            
                            if (!safeDay) continue; // Not a valid day row
                            
                            const daySchedule = {};
                            
                            // Iterate B to I (indices 1 to 8)
                            for (let colIndex = 1; colIndex <= 8; colIndex++) {
                                if (row[colIndex]) {
                                    let cellStr = row[colIndex].toString();
                                    // Sadece Sınıf ismini yakala: "S.MAT 12-B" -> "12B", "9/C Müzik" -> "9C"
                                    let match = cellStr.match(/\d{1,2}\s*[-/]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü]+/i);
                                    if (match) {
                                        let cellVal = match[0].toUpperCase().replace(/[^A-Z0-9ÇĞİÖŞÜ]/gi, '');
                                        if (cellVal) {
                                            daySchedule[colIndex.toString()] = cellVal;
                                        }
                                    }
                                }
                            }
                            
                            if (Object.keys(daySchedule).length > 0) {
                                schedule[safeDay] = daySchedule;
                            }
                        }
                        
                        if (Object.keys(schedule).length > 0) {
                            usersDb[foundUname].schedule = schedule;
                            processedCount++;
                        } else {
                            // If it was newly created but didn't have a schedule, remove it to prevent pollution
                            if (isNew) delete usersDb[foundUname];
                            else errorCount++;
                        }
                    });

                    if (processedCount > 0) {
                        await saveUsersToCloud(usersDb);
                        Swal.fire('Başarılı', `${processedCount} öğretmenin ders programı sisteme yüklendi.`, 'success');
                        scheduleExcelInput.value = '';
                        scheduleExcelName.textContent = '';
                        btnProcessScheduleExcel.disabled = true;
                        
                        teachersDb = usersDb; // Update local cache
                        renderTeachersGrid();
                        // Jump back to list
                        viewTeachers.querySelector('.inner-tab[data-tab="teacherList"]').click();
                    } else {
                        Swal.fire('Hata', 'İşlenecek geçerli program bulunamadı.', 'warning');
                    }
                } catch (err) {
                    console.error(err);
                    Swal.fire('Hata', 'Excel okunurken bir sorun oluştu.', 'error');
                }
                btnProcessScheduleExcel.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Ders Programlarını İçeri Aktar';
                btnProcessScheduleExcel.disabled = false;
            };
            reader.readAsArrayBuffer(file);
        });
    }

});
