document.addEventListener('DOMContentLoaded', async () => {

    // Shared sort utility for Turkish alphanumeric strings (e.g. "9-A", "Salon 1")
    const sortByNum = (a, b) => {
        const numA = parseInt(a.replace(/[a-zA-Z\u00C0-\u024F]+$/, '')) || 0;
        const numB = parseInt(b.replace(/[a-zA-Z\u00C0-\u024F]+$/, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b, 'tr');
    };

    // --- 1. Authentication Check ---
    const isLoggedIn = sessionStorage.getItem('klbk_isLoggedIn');
    if (!isLoggedIn) {
        window.location.href = 'index.html';
        return;
    }

    // --- Cloud Sync ---
    // Fetch user's data from Supabase before rendering the dashboard
    await DataManager.initCloud();

    // Check klbk_data_ format
    const key = DataManager._getStorageKey();
    if (localStorage.getItem(key)) {
        // Optional: migrate local to cloud if cloud is empty
        const cloudData = DataManager.getSchoolSettings();
        if (!cloudData.name) {
            console.log("Migrating local data to cloud...");
            DataManager._saveData(JSON.parse(localStorage.getItem(key)));
        }
    }

    document.getElementById('displayUsername').textContent = sessionStorage.getItem('klbk_currentUser') || 'Yönetici';

    // --- Logout Action ---
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('klbk_isLoggedIn');
        window.location.href = 'index.html';
    });

    // --- Global Event Delegation for Accordion Classroom Editor ---
    document.body.addEventListener('change', (e) => {
        if (e.target.matches('.desk-pos-select')) {
            console.log("Delegated desk-pos-select change trigger:", e.target.dataset.room, e.target.value);
            window.updateDeskPos(e.target.dataset.room, e.target.value);
        }
    });

    document.body.addEventListener('click', (e) => {
        const seatBtn = e.target.closest('.seat-toggle-btn');
        if (seatBtn) {
            console.log("Delegated seat-toggle-btn click trigger:", seatBtn.dataset.room, seatBtn.dataset.seat);
            window.toggleSeat(seatBtn.dataset.room, seatBtn.dataset.seat);
        }
    });


    // --- 2. Sidebar Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    const viewTitles = {
        'view-dashboard': { title: 'Genel Bakış', subtitle: 'Sisteme hoş geldiniz, istatistikleri ve genel durumu görebilirsiniz.' },
        'view-school': { title: 'Okul Ayarları', subtitle: 'Kurum genel bilgileri ve eğitim yılı tanımlamaları.' },
        'view-students': { title: 'Öğrenci & Sınıf Yönetimi', subtitle: 'Okuldaki sınıflar ve öğrenci listelerinin tanımlandığı bölüm.' },
        'view-classrooms': { title: 'Derslik Yönetimi', subtitle: 'Sınavın yapılacağı derslikler ve oturma (sıra) planları tasarımı.' },
        'view-exam': { title: 'Sınav Dağıtımı', subtitle: 'Öğrencileri dersliklere dağıtma algoritması ve sonuçlar.' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active to clicked target
            item.classList.add('active');

            const targetViewId = item.getAttribute('data-target');

            // Hide all sections
            viewSections.forEach(section => {
                section.classList.add('hidden');
                section.classList.remove('active');
            });

            // Show target section
            const targetSection = document.getElementById(targetViewId);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                targetSection.classList.add('active');

                // Update Header
                if (viewTitles[targetViewId]) {
                    pageTitle.textContent = viewTitles[targetViewId].title;
                    pageSubtitle.textContent = viewTitles[targetViewId].subtitle;
                }
            }

            // Close mobile sidebar if open
            if (window.innerWidth <= 900) {
                document.querySelector('.sidebar').style.left = '-300px';
            }

            // Refresh view specific data conditionally
            if (targetViewId === 'view-dashboard') updateDashboardStats();
            if (targetViewId === 'view-students') updateClassesList();
            if (targetViewId === 'view-school') loadSchoolSettings();

            // Store active tab
            sessionStorage.setItem('klbk_activeTab', targetViewId);
        });
    });

    // Handle initial state and persistence
    function initializeNavigation() {
        const savedTabId = sessionStorage.getItem('klbk_activeTab');
        const loader = document.getElementById('appLoader');

        if (savedTabId) {
            const tabToClick = Array.from(navItems).find(item => item.getAttribute('data-target') === savedTabId);
            if (tabToClick) {
                tabToClick.click();
            }
        } else {
            // Default to Exam section if no saved tab (User's specific request)
            const examTab = Array.from(navItems).find(item => item.getAttribute('data-target') === 'view-exam');
            if (examTab) {
                examTab.click();
            }
        }

        // Hide loader with a slight delay to ensure rendering is smooth
        if (loader) {
            setTimeout(() => {
                loader.classList.add('fade-out');
                // Remove from DOM after transition
                setTimeout(() => loader.remove(), 600);
            }, 500);
        }
    }

    // Mobile Sidebar Toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.style.left = sidebar.style.left === '0px' ? '-300px' : '0px';
    });


    // --- 3. Inner Tabs (Students View) ---
    const innerTabs = document.querySelectorAll('.inner-tab');
    const innerContents = document.querySelectorAll('.inner-content');

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
        });
    });


    // --- 4. Load Data using DataManager ---

    // Load School Settings
    function loadSchoolSettings() {
        const school = DataManager.getSchoolSettings();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

        setVal('schoolName', school.name || '');
        setVal('classCount', school.classCount || '');
        setVal('roomCount', school.roomCount || '');
        setVal('principalName', school.principal || '');
        setVal('vicePrincipalName', school.vicePrincipal || '');
        setVal('gradeLevels', school.gradeLevels ? school.gradeLevels.join(', ') : '');
        setVal('schoolSubjects', school.subjects ? school.subjects.join(', ') : '');

        // Auto-fill academic year & term based on today's date
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1; // 1-12
        const autoYear = (m < 1 || m > 7) ? `${y}-${y + 1}` : `${y - 1}-${y}`;
        const autoTerm = (m < 2) ? 'I. D\u00f6nem' : ((m >= 2 && m <= 7) ? 'II. D\u00f6nem' : 'I. D\u00f6nem');

        setVal('academicYear', school.academicYear || autoYear);
        setVal('academicTerm', autoTerm);

        // Logo Preview
        const logoPreview = document.getElementById('schoolLogoPreview');
        if (logoPreview) {
            if (school.logo) {
                logoPreview.innerHTML = `<img src="${school.logo}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
            } else {
                logoPreview.innerHTML = `<i class="fa-solid fa-image" style="color:#ccc;"></i>`;
            }
        }

        // Lesson schedule
        const dailyLessons = school.dailyLessons || '';
        setVal('dailyLessons', dailyLessons);
        if (dailyLessons && parseInt(dailyLessons) > 0 && typeof window.updateLessonSchedule === 'function') {
            window.updateLessonSchedule(dailyLessons, school.lessonTimes || {});
        }
    }

    loadSchoolSettings();

    // --- Gear Menu Toggle ---
    document.getElementById('schoolGearBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('schoolGearMenu');
        menu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
        const menu = document.getElementById('schoolGearMenu');
        if (menu) menu.classList.add('hidden');
    });

    // --- Lesson Schedule Builder ---
    window.updateLessonSchedule = function (count, savedTimes) {
        const n = parseInt(count);
        const panel = document.getElementById('lessonSchedulePanel');
        const grid = document.getElementById('lessonTimesGrid');
        if (!n || n < 1) { panel.classList.add('hidden'); return; }
        panel.classList.remove('hidden');

        // Load saved times from data if not provided
        if (!savedTimes) {
            const school = DataManager.getSchoolSettings();
            savedTimes = school.lessonTimes || {};
        }

        let html = '';
        for (let i = 1; i <= n; i++) {
            const start = savedTimes[`${i}_start`] || '';
            const end = savedTimes[`${i}_end`] || '';
            html += `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem;">
                    <div style="font-size:0.8rem; font-weight:700; color:#4f46e5; margin-bottom:0.5rem;"><i class='fa-solid fa-clock'></i> ${i}. Ders</div>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <div style="flex:1;">
                            <label style="font-size:0.7rem; color:#64748b; display:block; margin-bottom:2px;">Giriş</label>
                            <input type="time" id="lt_${i}_start" value="${start}" style="width:100%; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; font-size:0.85rem;">
                        </div>
                        <span style="color:#94a3b8; padding-top:16px;">-</span>
                        <div style="flex:1;">
                            <label style="font-size:0.7rem; color:#64748b; display:block; margin-bottom:2px;">\u00c7\u0131k\u0131\u015f</label>
                            <input type="time" id="lt_${i}_end" value="${end}" style="width:100%; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; font-size:0.85rem;">
                        </div>
                    </div>
                </div>`;
        }
        grid.innerHTML = html;
    };

    // --- Backup / Import Functions ---
    window.backupAllData = function () {
        document.getElementById('schoolGearMenu').classList.add('hidden');
        const key = DataManager._getStorageKey();
        const data = DataManager._getData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        a.href = url;
        a.download = `klbk_yedek_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'Yedek Al\u0131nd\u0131!', text: 'T\u00fcm veriler JSON dosyas\u0131 olarak indirildi.', timer: 2000, showConfirmButton: false });
    };

    window.importBackupData = function () {
        document.getElementById('schoolGearMenu').classList.add('hidden');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    if (!parsed.school && !parsed.students) throw new Error('Invalid');
                    Swal.fire({
                        title: 'Yede\u011fi G\u00fcncelle',
                        html: 'Bu i\u015flem mevcut verilerin \u00fczerine yazar. Emin misiniz?',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Evet, Y\u00fckle',
                        cancelButtonText: '\u0130ptal',
                        confirmButtonColor: '#6366f1'
                    }).then(res => {
                        if (res.isConfirmed) {
                            DataManager._saveData(parsed);
                            loadSchoolSettings();
                            Swal.fire({ icon: 'success', title: 'Y\u00fcklendi!', text: 'Veriler ba\u015far\u0131yla geri y\u00fcklendi.', timer: 2000, showConfirmButton: false });
                        }
                    });
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Hata', text: 'Ge\u00e7ersiz yedek dosyas\u0131.' });
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // Save School Settings Form
    document.getElementById('schoolForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const gradesArr = document.getElementById('gradeLevels').value.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
        const subjectsArr = document.getElementById('schoolSubjects').value.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);

        // Collect lesson times
        const dailyLessonsEl = document.getElementById('dailyLessons');
        const dailyLessons = dailyLessonsEl ? dailyLessonsEl.value.trim() : '';
        const lessonTimes = {};
        const n = parseInt(dailyLessons);
        if (n > 0) {
            for (let i = 1; i <= n; i++) {
                const sEl = document.getElementById(`lt_${i}_start`);
                const eEl = document.getElementById(`lt_${i}_end`);
                if (sEl) lessonTimes[`${i}_start`] = sEl.value;
                if (eEl) lessonTimes[`${i}_end`] = eEl.value;
            }
        }

        const currentSchool = DataManager.getSchoolSettings();
        const settings = {
            ...currentSchool,
            name: document.getElementById('schoolName').value.trim(),

            academicYear: document.getElementById('academicYear').value.trim(),
            classCount: document.getElementById('classCount').value.trim(),
            roomCount: document.getElementById('roomCount').value.trim(),
            principal: document.getElementById('principalName').value.trim(),
            vicePrincipal: document.getElementById('vicePrincipalName').value.trim(),
            gradeLevels: gradesArr,
            subjects: subjectsArr,
            dailyLessons: dailyLessons,
            lessonTimes: lessonTimes
        };

        DataManager.saveSchoolSettings(settings);
        loadSchoolSettings(); // Refresh UI with cleaned data

        Swal.fire({
            icon: 'success',
            title: 'Ba\u015far\u0131l\u0131!',
            text: 'Kurum bilgileri ba\u015far\u0131yla kaydedildi.',
            timer: 2000,
            showConfirmButton: false
        });
    });


    // --- 5. Add Single Student ---
    document.getElementById('studentForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const no = document.getElementById('stdNo').value.trim();
        const stdClass = document.getElementById('stdClass').value.trim().toUpperCase();

        const std = {
            no: no,
            name: document.getElementById('stdName').value.trim(),
            class: stdClass,
            alan: document.getElementById('stdField').value.trim(),
            ogrenciKodu: document.getElementById('stdCode').value.trim(),
            dersler: document.getElementById('stdSubjects').value.split(/[,\n;]/).map(s => s.trim()).filter(Boolean),
            extra1: document.getElementById('stdExtra1').value.trim(),
            extra2: document.getElementById('stdExtra2').value.trim(),
            extra3: document.getElementById('stdExtra3').value.trim(),
            extra4: document.getElementById('stdExtra4').value.trim(),
            extra5: document.getElementById('stdExtra5').value.trim(),
            status: 'Aktif'
        };

        DataManager.addStudent(std);

        Swal.fire({
            icon: 'success',
            title: 'Öğrenci Kaydedildi',
            text: `${std.name} (${std.no}) - ${stdClass} sınıfına eklendi.`,
            timer: 2000,
            showConfirmButton: false
        });

        // Reset specific fields only
        document.getElementById('stdNo').value = '';
        document.getElementById('stdName').value = '';
        document.getElementById('stdNo').focus();

        // Refresh stats
        updateDashboardStats();
        updateClassesList();
    });

    // --- 5.5 Bulk Import via Excel ---
    const excelFileInput = document.getElementById('excelFileInput');
    const btnProcessExcel = document.getElementById('btnProcessExcel');
    const excelFileName = document.getElementById('excelFileName');

    if (excelFileInput && btnProcessExcel) {
        excelFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) {
                excelFileName.textContent = '';
                btnProcessExcel.disabled = true;
                return;
            }
            excelFileName.textContent = `Seçilen dosya: ${file.name}`;
            btnProcessExcel.disabled = false;

            // Auto-trigger processing for better UX
            btnProcessExcel.click();
        });

        btnProcessExcel.addEventListener('click', function () {
            const file = excelFileInput.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = async function (e) {
                try {
                    if (typeof XLSX === 'undefined') {
                        Swal.fire('Hata', 'SheetJS kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.', 'error');
                        return;
                    }
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonArr = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (jsonArr.length === 0) {
                        Swal.fire('Hata', 'Excel dosyası boş görünüyor.', 'error');
                        return;
                    }

                    // Collect students in array
                    const parsedStudents = [];
                    let currentClass = null;
                    let findingHeaders = false;
                    let colSNo = -1, colOgrNo = -1, colAd = -1, colSoyad = -1;
                    let detectedMode = null; // 'e-okul' or 'simple'

                    for (let i = 0; i < jsonArr.length; i++) {
                        const row = jsonArr[i];
                        if (!row || row.length === 0) continue;

                        let rowTextStr = row.join(' ').replace(/\n/g, ' ').toUpperCase();

                        // 1. Check for E-Okul Class Header (Priority)
                        let cMatchStr = null;
                        let m1 = rowTextStr.match(/(\d+)\.?\s*[ŞS]?INIF.*?([A-ZÇĞİÖŞÜ])\s*[ŞS]UBE/);
                        if (m1) {
                            cMatchStr = m1[1] + m1[2];
                        } else {
                            let m2 = rowTextStr.match(/[ŞS]?INIF.*?(?::|-|=)\s*(\d+)\s*[\/\-]?\s*([A-ZÇĞİÖŞÜ])/);
                            if (m2) cMatchStr = m2[1] + m2[2];
                            else {
                                let m3 = rowTextStr.match(/(\d+)\s*[\/\-]\s*([A-ZÇĞİÖŞÜ])\s*[ŞS]?INIF/);
                                if (m3) cMatchStr = m3[1] + m3[2];
                                else {
                                    let m4 = rowTextStr.match(/(\d+)\s*([A-ZÇĞİÖŞÜ])\s*(?:[ŞS]?INIFI|[ŞS]?UBESİ)/);
                                    if (m4) cMatchStr = m4[1] + m4[2];
                                    else {
                                        // Catch simple "9-A" or "10/B" as header if it's the only thing or start of row
                                        let m5 = rowTextStr.match(/^(\d+)\s*[\/\-]\s*([A-ZÇĞİÖŞÜ])(?:\s|$)/);
                                        if (m5) cMatchStr = m5[1] + m5[2];
                                    }
                                }
                            }
                        }

                        if (cMatchStr) {
                            currentClass = cMatchStr;
                            findingHeaders = true;
                            detectedMode = 'e-okul';
                            colSNo = -1; colOgrNo = -1; colAd = -1; colSoyad = -1;
                            continue;
                        }

                        // 2. Simple Format Detection (Only if not already in E-Okul mode)
                        // If we haven't found an E-Okul header yet, check if this row looks like Class | No | Name
                        if (!detectedMode || detectedMode === 'simple') {
                            const stdClass = String(row[0] || '').trim().toUpperCase();
                            const no = String(row[1] || '').trim();
                            const name = String(row[2] || '').trim();

                            // A row is simple if Class is like 9A, 10-B, and No is numeric
                            if (stdClass && no && name && !isNaN(parseInt(no))) {
                                // Validate Class string a bit more
                                if (stdClass.match(/^\d+\s*[\/\-]?[A-ZÇĞİÖŞÜ]$/) || stdClass.match(/^\d+$/)) {
                                    let normalizedClass = stdClass.replace(/[\/\-\s]+/g, '');
                                    parsedStudents.push({
                                        no, name, class: normalizedClass,
                                        alan: '', ogrenciKodu: '', dersler: [],
                                        extra1: '', extra2: '', extra3: '', extra4: '', extra5: '',
                                        status: 'Aktif'
                                    });
                                    detectedMode = 'simple';
                                    continue;
                                }
                            }
                        }

                        // 3. Continue E-Okul Parsing if mode is set
                        if (detectedMode === 'e-okul' && findingHeaders && currentClass) {
                            if (colSNo !== -1) {
                                let potentialSNo = parseInt(row[colSNo]);
                                if (!isNaN(potentialSNo) && potentialSNo > 0) {
                                    findingHeaders = false;
                                    if (colOgrNo === -1) {
                                        for (let j = colSNo + 1; j < row.length; j++) {
                                            if (String(row[j] || '').trim().length > 0) { colOgrNo = j; break; }
                                        }
                                    }
                                    if (colAd === -1) {
                                        for (let j = (colOgrNo !== -1 ? colOgrNo : colSNo) + 1; j < row.length; j++) {
                                            if (String(row[j] || '').trim().length > 0) { colAd = j; colSoyad = j; break; }
                                        }
                                    }
                                }
                            }

                            if (findingHeaders) {
                                let sNoIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\s\.\n]+/g, '').toUpperCase(); return v === 'SNO' || v === 'SIRANO' || v === 'NO' || v === 'SN'; });
                                if (sNoIdx !== -1) colSNo = sNoIdx;
                                let ogrNoIdx = row.findIndex(c => {
                                    let val = String(c || '').trim().replace(/[\s\.\n]+/g, '').toUpperCase();
                                    return val.includes('ÖĞRENCİNO') || val.includes('ÖGRENCİNO') || val.includes('OGRENCINO') || val.includes('OKULNO') || val.includes('NUMARASI') || val.includes('TC') || val.includes('OGRNO');
                                });
                                if (ogrNoIdx !== -1) colOgrNo = ogrNoIdx;
                                let adSoyadIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\s\.\n]+/g, '').toUpperCase(); return v === 'ADISOYADI' || v === 'ADSOYAD' || v.includes('ÖĞRENCİADISOYADI'); });
                                if (adSoyadIdx !== -1) { colAd = adSoyadIdx; colSoyad = adSoyadIdx; }
                                let adIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\n]+/g, '').toUpperCase(); return v === 'ADI' || v === 'AD'; });
                                if (adIdx !== -1) colAd = adIdx;
                                let soyadIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\n]+/g, '').toUpperCase(); return v === 'SOYADI' || v === 'SOYAD'; });
                                if (soyadIdx !== -1) colSoyad = soyadIdx;
                                continue;
                            }
                        }

                        if (detectedMode === 'e-okul' && currentClass && !findingHeaders && colSNo !== -1) {
                            let sNoVal = parseInt(row[colSNo]);
                            if (!isNaN(sNoVal)) {
                                let stdNo = String(row[colOgrNo] || '').replace(/[\n\s]+/g, '').trim();
                                let stdAd = "", stdSoyad = "";
                                if (colAd === colSoyad) {
                                    let full = String(row[colAd] || '').replace(/\n/g, ' ').trim();
                                    let parts = full.split(/\s+/);
                                    if (parts.length > 1) { stdSoyad = parts.pop(); stdAd = parts.join(' '); }
                                    else { stdAd = full; stdSoyad = ""; }
                                } else {
                                    stdAd = String(row[colAd] || '').replace(/\n/g, ' ').trim();
                                    stdSoyad = String(row[colSoyad] || '').replace(/\n/g, ' ').trim();
                                }
                                if (stdNo && (stdAd || stdSoyad)) {
                                    let fullName = (stdAd + " " + stdSoyad).replace(/\s+/g, ' ').trim();
                                    parsedStudents.push({
                                        no: stdNo, name: fullName, class: currentClass,
                                        alan: '', ogrenciKodu: '', dersler: [],
                                        extra1: '', extra2: '', extra3: '', extra4: '', extra5: '',
                                        status: 'Aktif'
                                    });
                                }
                            } else if (String(row[colSNo]).trim()) {
                                // Non-numeric S.No means maybe end of class or some footer
                                // But don't clear currentClass immediately, just stop finding headers if we were
                                findingHeaders = false;
                            }
                        }
                    }

                    if (parsedStudents.length === 0) {
                        Swal.fire('Hata', 'Excel dosyasında öğrenci verisi bulunamadı veya format tanınmadı.', 'error');
                        return;
                    }

                    // Choose Import Method
                    const result = await Swal.fire({
                        title: 'Yükleme Seçeneği',
                        text: `${parsedStudents.length} öğrenci tespit edildi. Nasıl yüklemek istersiniz?`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Güncelle',
                        denyButtonText: 'Sıfırdan Yükle',
                        showDenyButton: true,
                        cancelButtonText: 'İptal',
                        confirmButtonColor: '#4f46e5',
                        denyButtonColor: '#ef4444'
                    });

                    if (result.isDismissed) return;

                    let method = 'update';
                    if (result.isDenied) {
                        method = 'fresh';
                    }

                    DataManager.bulkImportStudents(parsedStudents, method);

                    Swal.fire('Başarılı', `${parsedStudents.length} öğrenci ${method === 'fresh' ? 'sıfırdan yüklendi' : 'güncellendi/eklendi'}.`, 'success');

                    // reset upload UI
                    excelFileInput.value = '';
                    excelFileName.textContent = '';
                    btnProcessExcel.disabled = true;

                    updateDashboardStats();
                    updateClassesList();
                    document.querySelector('[data-tab="classLists"]').click();

                } catch (err) {
                    console.error("Excel parse hatasi:", err);
                    Swal.fire('Hata', 'Dosya okunurken bir hata oluştu.', 'error');
                }
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // --- 6. Update Dashboard Stats ---
    function updateDashboardStats() {
        const stats = DataManager.getStats();
        document.getElementById('statTotalStudents').textContent = stats.totalStudents;
        document.getElementById('statTotalClasses').textContent = stats.totalClasses;
        document.getElementById('statTotalRooms').textContent = stats.totalRooms;
        document.getElementById('statTotalCapacity').textContent = stats.totalCapacity;
    }

    // --- 7. Students & Classes UI Helpers ---
    window.assignRoomToClass = function (className, roomName) {
        DataManager.saveClassRoomMapping(className, roomName);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Derslik ayarı kaydedildi',
            showConfirmButton: false,
            timer: 1500
        });
    };

    function updateClassesList() {
        const students = DataManager.getStudents();
        const container = document.getElementById('classesGridContainer');
        const recentWidget = document.getElementById('recentClassesList');
        const classrooms = DataManager.getClassrooms();
        const classRoomMappings = DataManager.getClassRoomMappings();

        // Group students by class
        const classGroups = {};
        students.forEach(s => {
            if (!classGroups[s.class]) classGroups[s.class] = [];
            classGroups[s.class].push(s);
        });

        const classes = Object.keys(classGroups).sort((a, b) => {
            const matchA = a.match(/\d+/);
            const matchB = b.match(/\d+/);
            const numA = matchA ? parseInt(matchA[0]) : 0;
            const numB = matchB ? parseInt(matchB[0]) : 0;
            if (numA !== numB) return numA - numB;

            const strA = a.replace(/\d+/g, '').trim();
            const strB = b.replace(/\d+/g, '').trim();
            return strA.localeCompare(strB);
        });

        // Render
        if (classes.length === 0) {
            container.innerHTML = `<p class="empty-text">Henüz öğrenci eklenmemiş.</p>`;
            recentWidget.innerHTML = `<p class="empty-text">Sınıf kaydı bulunamadı.</p>`;
            return;
        }

        let html = '<div class="accordion-container" style="display:flex; flex-direction:column; gap:1rem;">';
        let widgetHtml = '';

        classes.forEach((cls, index) => {
            const clsStudents = classGroups[cls] || [];
            const count = clsStudents.length;
            const assignedRoom = classRoomMappings[cls] || '';

            // Accordion Header
            html += `
                <div class="accordion-item glass-panel" style="border-radius:10px; overflow:hidden;">
                    <div class="accordion-header" style="padding:1.5rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.classList.toggle('hidden');">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <h2 style="color:var(--primary); font-size:1.5rem; margin:0;">${cls} Sınıfı</h2>
                            <button class="btn btn-secondary btn-sm" style="padding:0.3rem 0.75rem; font-size:0.85rem;" onclick="event.stopPropagation(); window.assignSubjectsToClass('${cls}')">
                                <i class="fa-solid fa-book"></i> Ders Tanımla
                            </button>
                            <button class="btn btn-secondary btn-sm" style="padding:0.3rem 0.75rem; font-size:0.85rem;" onclick="event.stopPropagation(); window.assignFieldToClass('${cls}')">
                                <i class="fa-solid fa-layer-group"></i> Alan Tanımla
                            </button>
                            <select class="form-control" style="width: auto; display: inline-block; padding: 0.2rem 0.5rem; font-size: 0.85rem; border: 1px solid var(--gray-300); border-radius: 4px; background-color: white; color: var(--dark);" onchange="window.assignRoomToClass('${cls}', this.value)" onclick="event.stopPropagation();">
                                <option value="">Derslik Tanımla</option>
                                ${classrooms.map(room => `<option value="${room.name}" ${assignedRoom === room.name ? 'selected' : ''}>${room.name}</option>`).join('')}
                            </select>
                        </div>
                        <span style="background:var(--secondary); color:#fff; padding:0.25rem 0.75rem; border-radius:1rem; font-size:0.9rem;">
                            <i class="fa-solid fa-users"></i> ${count} Öğrenci
                        </span>
                    </div>
                    
                    <div class="accordion-body hidden" style="background:var(--glass-bg); padding:1.5rem; border-top:1px solid rgba(255,255,255,0.1);">
                        <div class="table-responsive">
                            <table style="width:100%; border-collapse:collapse; text-align:left;">
                                <thead>
                                    <tr style="border-bottom:2px solid var(--primary); color:var(--text);">
                                        <th style="padding:0.75rem 0.5rem;">Öğrenci No</th>
                                        <th style="padding:0.75rem 0.5rem;">Adı Soyadı</th>
                                        <th style="padding:0.75rem 0.5rem;">Alanı</th>
                                        <th style="padding:0.75rem 0.5rem;">Öğrenci Kodu</th>
                                        <th style="padding:0.75rem 0.5rem;">Dersler</th>
                                        <th style="padding:0.75rem 0.5rem; text-align:right;">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            clsStudents.forEach(std => {
                html += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:0.75rem 0.5rem; font-weight:bold;">${std.no}</td>
                        <td style="padding:0.75rem 0.5rem; display:flex; align-items:center; gap:5px;">
                            ${std.name}
                            ${(std.ogrenciKodu || "").split(/[,\s]+/).map(k => k.trim().toUpperCase()).includes('C') ? '<span class="condition-marker type-c" data-tooltip="Dikkat Edilmesi Gerekir">C</span>' : ''}
                            ${(std.ogrenciKodu || "").split(/[,\s]+/).map(k => k.trim().toUpperCase()).includes('H') ? '<span class="condition-marker type-h" data-tooltip="Sağlık Sorunu Var">H</span>' : ''}
                        </td>
                        <td style="padding:0.75rem 0.5rem;"><span style="font-size:0.85rem; background:rgba(255,255,255,0.1); padding:0.2rem 0.5rem; border-radius:4px;">${std.alan || '-'}</span></td>
                        <td style="padding:0.75rem 0.5rem;">${std.ogrenciKodu || '-'}</td>
                        <td style="padding:0.75rem 0.5rem; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${(std.dersler || []).join(', ')}">${(std.dersler || []).join(', ') || '-'}</td>
                        <td style="padding:0.75rem 0.5rem; text-align:right;">
                            <button class="btn btn-secondary btn-sm" title="Düzenle" onclick="window.editStudentDetails('${std.no}')"><i class="fa-solid fa-pen"></i></button>
                        </td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            widgetHtml += `
                <div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid #f1f5f9;">
                    <strong>${cls}</strong>
                    <span>${count} Kişi</span>
                </div>
            `;
        });

        html += '</div>';

        container.innerHTML = html;
        recentWidget.innerHTML = widgetHtml;
    }

    // --- 8. Classroom Management ---
    const btnPreviewClassroom = document.getElementById('btnPreviewClassroom');
    const classroomGrid = document.getElementById('classroomGrid');
    const previewArea = document.getElementById('classroomPreviewArea');
    const previewCapacity = document.getElementById('previewCapacity');
    const btnAutoCreateClassrooms = document.getElementById('btnAutoCreateClassrooms');

    // MOCK-UP FOR EXISTING
    let currentLayout = {
        name: '',
        groupConfigs: [], // will store {rows, cols} per group
        groups: 0,
        disabledSeats: [],
        deskNotes: {}
    };

    if (btnAutoCreateClassrooms) {
        btnAutoCreateClassrooms.addEventListener('click', () => {
            const students = DataManager.getStudents();
            const classesSet = new Set();
            students.forEach(s => classesSet.add(s.class));
            const classesArray = Array.from(classesSet);

            if (classesArray.length === 0) {
                Swal.fire('Hata', 'Kayıtlı hiçbir sınıf bulunamadı. Önce öğrenci ekleyin.', 'warning');
                return;
            }

            Swal.fire({
                title: 'Otomatik Oluştur',
                text: `${classesArray.length} adet sınıf için varsayılan düzende (3 Grup, 2x5) derslik oluşturulacak. Onaylıyor musunuz?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Evet, Oluştur',
                cancelButtonText: 'İptal'
            }).then((result) => {
                if (result.isConfirmed) {
                    let count = 0;
                    classesArray.forEach(cls => {
                        // avoid overwriting existing
                        const existing = DataManager.getClassrooms().find(r => r.name === cls);
                        if (!existing) {
                            DataManager.addClassroom({
                                name: cls,
                                groups: 3,
                                groupConfigs: [
                                    { cols: 2, rows: 5 },
                                    { cols: 2, rows: 5 },
                                    { cols: 2, rows: 5 }
                                ],
                                disabledSeats: [],
                                deskNotes: {}
                            });
                            count++;
                        }
                    });

                    updateClassroomsList();
                    updateDashboardStats();
                    Swal.fire('Başarılı', `${count} adet derslik otomatik oluşturuldu.`, 'success');
                }
            });
        });
    }

    const teacherDeskPosSelect = document.getElementById('teacherDeskPos');
    if (teacherDeskPosSelect) {
        teacherDeskPosSelect.addEventListener('change', (e) => {
            if (currentLayout.name) {
                currentLayout.teacherDeskPos = e.target.value;
                renderClassroomPreview();
            }
        });
    }

    if (btnPreviewClassroom) {
        btnPreviewClassroom.addEventListener('click', () => {
            const name = document.getElementById('className').value.trim();
            const groups = parseInt(document.getElementById('classGroups').value);
            const teacherDeskPos = document.getElementById('teacherDeskPos').value || 'right';

            if (!name || groups < 1) {
                Swal.fire('Hata', 'Lütfen derslik adı ve grup sayısını girin.', 'error');
                return;
            }

            // Gather group configs
            const groupConfigs = [];
            for (let i = 1; i <= groups; i++) {
                const r = parseInt(document.getElementById(`g${i}_rows`).value);
                const c = parseInt(document.getElementById(`g${i}_cols`).value);
                if (r < 1 || c < 1) {
                    Swal.fire('Hata', `${i}. Grup için geçerli satır ve sütun giriniz.`, 'error');
                    return;
                }
                groupConfigs.push({ rows: r, cols: c });
            }

            // only reset if changing the target classroom name
            if (currentLayout.name !== name) {
                const existing = DataManager.getClassrooms().find(r => r.name === name);
                if (existing) {
                    currentLayout.disabledSeats = [...existing.disabledSeats];
                    currentLayout.deskNotes = existing.deskNotes ? { ...existing.deskNotes } : {};
                } else {
                    currentLayout.disabledSeats = [];
                    currentLayout.deskNotes = {};
                }
            }
            currentLayout.name = name;
            currentLayout.groups = groups;
            currentLayout.groupConfigs = groupConfigs;
            currentLayout.teacherDeskPos = document.getElementById('teacherDeskPos').value || 'right';

            renderClassroomPreview();
            previewArea.classList.remove('hidden');
        });
    }

    // Dynamic Groups Input Generation
    const classGroupsInput = document.getElementById('classGroups');
    const dynamicGroupsArea = document.getElementById('dynamicGroupsArea');
    const classTemplateSelect = document.getElementById('classTemplateSelect');

    function renderDynamicGroupInputs(groupCount, configs = null) {
        if (!dynamicGroupsArea) return;
        dynamicGroupsArea.innerHTML = '';

        let html = '<h3 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--gray-600);">Grup Boyutları</h3><div style="display: flex; gap: 1rem; flex-wrap: wrap;">';

        for (let i = 1; i <= groupCount; i++) {
            const r = configs && configs[i - 1] ? configs[i - 1].rows : 5;
            const c = configs && configs[i - 1] ? configs[i - 1].cols : 2;

            html += `
                <div class="group-config box glass-panel" style="padding: 1rem; flex: 1; min-width: 150px;">
                    <h4 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--primary);">Grup ${i}</h4>
                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.8rem;">Sütun (Genişlik)</label>
                        <input type="number" id="g${i}_cols" min="1" max="10" value="${c}" style="width: 100%; padding: 0.25rem;">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem;">Satır (Derinlik)</label>
                        <input type="number" id="g${i}_rows" min="1" max="20" value="${r}" style="width: 100%; padding: 0.25rem;">
                    </div>
                </div>
            `;
        }
        html += '</div>';
        dynamicGroupsArea.innerHTML = html;
    }

    if (classGroupsInput) {
        classGroupsInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (val > 0) renderDynamicGroupInputs(val);
        });
        // initial render
        renderDynamicGroupInputs(parseInt(classGroupsInput.value));
    }

    if (classTemplateSelect) {
        classTemplateSelect.addEventListener('change', (e) => {
            const tplName = e.target.value;
            if (!tplName) return;

            const room = DataManager.getClassrooms().find(r => r.name === tplName);
            if (room) {
                classGroupsInput.value = room.groups;
                if (document.getElementById('teacherDeskPos')) {
                    document.getElementById('teacherDeskPos').value = room.teacherDeskPos || 'right';
                }
                renderDynamicGroupInputs(room.groups, room.groupConfigs || Array(room.groups).fill({ rows: room.rows || 5, cols: room.cols || 2 }));
                // We will also apply disabledSeats and notes on preview
                currentLayout.disabledSeats = [...(room.disabledSeats || [])];
                currentLayout.deskNotes = room.deskNotes ? { ...room.deskNotes } : {};
            }
        });
    }

    function renderClassroomPreview() {
        classroomGrid.innerHTML = '';
        let totalSeats = 0;

        currentLayout.groupConfigs.forEach(conf => {
            totalSeats += (conf.rows * conf.cols);
        });

        let activeCapacity = totalSeats;

        // Render Groups
        const groupsContainer = document.createElement('div');
        groupsContainer.style.display = 'flex';
        groupsContainer.style.justifyContent = 'center';
        groupsContainer.style.gap = '2rem';
        groupsContainer.style.width = '100%';

        let globalCounter = 1;

        // Pre-compute numbering map to assign ID starting from bottom-left (highest r, lowest c)
        // moving right (highest r, highest c), then up (r-1, lowest c)
        const seatMap = {};
        for (let g = 1; g <= currentLayout.groups; g++) {
            const conf = currentLayout.groupConfigs[g - 1];
            for (let r = conf.rows; r >= 1; r--) {
                for (let c = 1; c <= conf.cols; c++) {
                    const seatId = `G${g}-S${r}-C${c}`;
                    seatMap[seatId] = globalCounter++;
                }
            }
        }

        for (let g = 1; g <= currentLayout.groups; g++) {
            const conf = currentLayout.groupConfigs[g - 1];
            const groupEl = document.createElement('div');
            groupEl.className = 'desk-group';
            // CSS grid dynamically setup based on cols for THIS group
            groupEl.style.gridTemplateColumns = `repeat(${conf.cols}, 1fr)`;

            // Render top-down so visually the highest r is at the bottom of the grid
            for (let r = 1; r <= conf.rows; r++) {
                for (let c = 1; c <= conf.cols; c++) {
                    const seatId = `G${g}-S${r}-C${c}`;
                    const desk = document.createElement('div');
                    desk.className = 'desk';
                    desk.title = `Grup ${g}, Satır ${r}, Sütun ${c}`;

                    const seatNum = seatMap[seatId];
                    const isDisabled = currentLayout.disabledSeats.includes(seatId);

                    let seatNumberDisplay = '';
                    if (!isDisabled) {
                        seatNumberDisplay = seatNum;
                    } else {
                        seatNumberDisplay = `<span style="position:relative; z-index:0;"><span style="text-decoration:line-through; color:var(--danger); font-weight:bold; font-size:1.2rem;">${seatNum}</span></span>`;
                    }

                    // Update innerHTML to use assigned seat number
                    const note = currentLayout.deskNotes[seatId];
                    if (note) {
                        desk.innerHTML = `<i class="fa-solid fa-note-sticky" style="color:var(--warning); position:absolute; top:2px; right:2px; font-size:0.7rem;" title="${note}"></i><span style="font-size:1.2rem">${seatNumberDisplay}</span>`;
                    } else {
                        desk.innerHTML = `<span style="font-size:1.2rem">${seatNumberDisplay}</span>`;
                    }

                    desk.style.direction = 'ltr'; // Ensure text remains readable

                    if (isDisabled) {
                        desk.classList.add('disabled');
                        activeCapacity--;
                    }

                    desk.addEventListener('click', () => {
                        const currentlyDisabled = currentLayout.disabledSeats.includes(seatId);
                        if (currentlyDisabled) {
                            currentLayout.disabledSeats = currentLayout.disabledSeats.filter(id => id !== seatId);
                            // Recalculate capacity to prevent drift
                            renderClassroomPreview();
                        } else {
                            currentLayout.disabledSeats.push(seatId);
                            renderClassroomPreview();
                        }
                    });

                    groupEl.appendChild(desk);
                }
            }
            groupsContainer.appendChild(groupEl);
        }
        classroomGrid.appendChild(groupsContainer);

        // Add Whiteboard & Teacher Desk Representation AT THE BOTTOM
        const frontArea = document.createElement('div');
        frontArea.style.width = '100%';
        frontArea.style.display = 'flex';
        frontArea.style.justifyContent = 'space-between';
        frontArea.style.alignItems = 'center';
        frontArea.style.padding = '0 1rem';

        let deskHtml = `<div style="width:100px; height:60px; background:#e2e8f0; border:2px solid #cbd5e1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--gray-600); box-shadow:0 4px 6px rgba(0,0,0,0.05);">Öğretmen</div>`;
        let boardHtml = `<div style="flex:1; max-width:60%; height:40px; background:#1e293b; border:4px solid #94a3b8; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; letter-spacing:2px; margin:0 auto; box-shadow:0 4px 6px rgba(0,0,0,0.1);">Y A Z I   T A H T A S I</div>`;
        let emptySpace = `<div style="width:100px;"></div>`;

        if (currentLayout.teacherDeskPos === 'left') {
            frontArea.innerHTML = deskHtml + boardHtml + emptySpace;
        } else {
            frontArea.innerHTML = emptySpace + boardHtml + deskHtml;
        }

        // Visually the "front" is appended last to appear at the bottom
        classroomGrid.appendChild(frontArea);

        previewCapacity.textContent = activeCapacity;
    }

    document.getElementById('btnSaveClassroom').addEventListener('click', () => {
        // deep copy
        const saveObj = {
            name: currentLayout.name,
            groups: currentLayout.groups,
            groupConfigs: JSON.parse(JSON.stringify(currentLayout.groupConfigs)),
            teacherDeskPos: currentLayout.teacherDeskPos || 'right',
            disabledSeats: [...currentLayout.disabledSeats],
            deskNotes: { ...currentLayout.deskNotes }
        };

        DataManager.addClassroom(saveObj);

        Swal.fire('Başarılı', `${currentLayout.name} dersliği kaydedildi. (${previewCapacity.textContent} kapasite)`, 'success');

        // Reset form
        document.getElementById('className').value = '';
        document.getElementById('classTemplateSelect').value = '';
        previewArea.classList.add('hidden');

        updateClassroomsList();
        updateDashboardStats();
    });

    // Accordion Based Classroom Listing
    window.updateClassroomsList = function () {
        const rooms = DataManager.getClassrooms();
        const container = document.getElementById('savedClassroomsList');
        const widgetContainer = document.getElementById('readyClassroomsList');
        const templateSelect = document.getElementById('classTemplateSelect');

        let openIdx = -1;
        if (container) {
            const accs = container.querySelectorAll('.accordion-body');
            accs.forEach((acc, i) => { if (!acc.classList.contains('hidden')) openIdx = i; });
        }

        // Update template select
        if (templateSelect) {
            templateSelect.innerHTML = '<option value="">-- Şablon Yok --</option>';
            rooms.forEach(room => {
                templateSelect.innerHTML += `<option value="${room.name}">${room.name}</option>`;
            });
        }

        if (!container) return; // not rendered

        if (rooms.length === 0) {
            container.innerHTML = `<p class="empty-text">Henüz derslik tanımlanmamış.</p>`;
            if (widgetContainer) widgetContainer.innerHTML = `<p class="empty-text">Henüz derslik tanımlanmamış.</p>`;
            return;
        }

        let html = '<div class="accordion-container" style="display:flex; flex-direction:column; gap:1rem;">';
        let widgetHtml = '';

        rooms.forEach((room, index) => {
            const deskPos = room.teacherDeskPos || 'right';
            const confs = room.groupConfigs || Array(room.groups).fill({ rows: room.rows || 0, cols: room.cols || 0 });
            let totalCapacity = 0;

            const groupHtml = confs.map((g, gi) => {
                const groupDisabledStr = room.disabledSeats ? room.disabledSeats.filter(id => id.startsWith(`G${gi + 1}-`)).length : 0;
                const groupCapacity = (g.rows * g.cols) - groupDisabledStr;
                totalCapacity += groupCapacity;
                return `${g.rows}x${g.cols}`;
            }).join(' | ');

            html += `
                <div class="accordion-item glass-panel" style="border-radius:10px; overflow:hidden;">
                    <div class="accordion-header" style="padding:1.5rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.classList.toggle('hidden');">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <h3 style="color:var(--primary); font-size:1.2rem; margin:0;">${room.name}</h3>
                            <select class="desk-pos-select" data-room="${room.name}" onclick="event.stopPropagation()" style="padding:0.3rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.8rem; background:white;">
                                <option value="left" ${deskPos === 'left' ? 'selected' : ''}>Masa Solda</option>
                                <option value="right" ${deskPos === 'right' ? 'selected' : ''}>Masa Sağda</option>
                            </select>
                            <button class="btn btn-secondary btn-sm" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="event.stopPropagation(); window.editClassroom('${room.name}')"><i class="fa-solid fa-pen"></i> Forma Al</button>
                            <button class="btn btn-secondary btn-sm" style="color:var(--danger); padding:0.3rem 0.6rem; font-size:0.8rem; border-color:var(--danger);" onclick="event.stopPropagation(); window.deleteClassroom('${room.name}')"><i class="fa-solid fa-trash"></i> Sil</button>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <span style="background:var(--primary); color:white; padding:0.25rem 0.75rem; border-radius:1rem; font-size:0.85rem;"><i class="fa-solid fa-layer-group"></i> ${room.groups} Grup (${groupHtml})</span>
                            <span style="background:var(--secondary); color:#fff; padding:0.25rem 0.75rem; border-radius:1rem; font-size:0.85rem;"><i class="fa-solid fa-chair"></i> ${totalCapacity} Kapasite</span>
                        </div>
                    </div>
                    
                    <div class="accordion-body hidden" style="background:var(--glass-bg); padding:2rem; border-top:1px solid rgba(255,255,255,0.1);">
            `;
            html += `<div style="display:flex; justify-content:center; gap:2rem; width:100%; overflow-x:auto; padding-bottom:1rem;">`;

            // Pre-compute numbering map to assign ID starting from bottom-left
            let globalCounter = 1;
            const seatMap = {};
            for (let g = 1; g <= room.groups; g++) {
                const config = confs[g - 1];
                for (let r = config.rows; r >= 1; r--) {
                    for (let c = 1; c <= config.cols; c++) {
                        const seatId = `G${g}-S${r}-C${c}`;
                        seatMap[seatId] = globalCounter++;
                    }
                }
            }

            for (let g = 1; g <= room.groups; g++) {
                const config = confs[g - 1];
                html += `<div class="desk-group" style="display:grid; grid-template-columns:repeat(${config.cols}, 1fr); gap:0.5rem; background:rgba(255,255,255,0.4); padding:1rem; border-radius:8px; border:2px dashed #cbd5e1; direction:ltr;">`;

                // Render top-down visually
                for (let r = 1; r <= config.rows; r++) {
                    for (let c = 1; c <= config.cols; c++) {
                        const seatId = `G${g}-S${r}-C${c}`;
                        const seatNum = seatMap[seatId];
                        if (room.disabledSeats && room.disabledSeats.includes(seatId)) {
                            html += `<div class="seat-toggle-btn" data-room="${room.name}" data-seat="${seatId}" style="width:40px; height:40px; background:#fee2e2; border:2px solid var(--danger); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1rem; color:var(--danger); opacity:0.6; cursor:pointer;" title="Açmak İçin Tıkla: ${seatId}"><span style="pointer-events:none; text-decoration:line-through; font-weight:bold;">${seatNum}</span></div>`;
                        } else {
                            html += `<div class="seat-toggle-btn" data-room="${room.name}" data-seat="${seatId}" style="width:40px; height:40px; background:white; border:2px solid var(--primary); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1rem; color:var(--primary); font-weight:bold; cursor:pointer;" title="Kapatmak İçin Tıkla: ${seatId}">${seatNum}</div>`;
                        }
                    }
                }
                html += `</div>`; // End desk-group
            }

            html += `</div>`; // End groups container

            // Append Whiteboard & Desk AFTER groups
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2rem; padding:0 1rem; width:100%;">
            `;
            let deskHtmlBox = `<div style="width:100px; height:60px; background:#e2e8f0; border:2px solid #cbd5e1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--gray-600); box-shadow:0 4px 6px rgba(0,0,0,0.05);">Öğretmen</div>`;
            let boardHtmlBox = `<div style="flex:1; max-width:60%; height:40px; background:#1e293b; border:4px solid #94a3b8; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; letter-spacing:2px; margin:0 auto; box-shadow:0 4px 6px rgba(0,0,0,0.1);">Y A Z I   T A H T A S I</div>`;
            let emptySpaceBox = `<div style="width:100px;"></div>`;

            if (deskPos === 'left') {
                html += deskHtmlBox + boardHtmlBox + emptySpaceBox;
            } else {
                html += emptySpaceBox + boardHtmlBox + deskHtmlBox;
            }
            html += `</div>`; // End Front Area

            html += `</div></div>`; // End accordion-body and accordion-item

            widgetHtml += `
            <div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid #f1f5f9;">
                <strong>${room.name}</strong>
                <span style="color:var(--secondary); font-weight:bold;">${totalCapacity}</span>
            </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        if (openIdx !== -1) {
            const newAccs = container.querySelectorAll('.accordion-body');
            if (newAccs[openIdx]) newAccs[openIdx].classList.remove('hidden');
        }

        if (widgetContainer) widgetContainer.innerHTML = widgetHtml;

        // Add delete listeners
        document.querySelectorAll('.delete-room').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.currentTarget.getAttribute('data-name');
                Swal.fire({
                    title: 'Emin misiniz?',
                    text: `${name} dersliği silinecek!`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Sil!',
                    cancelButtonText: 'İptal'
                }).then((result) => {
                    if (result.isConfirmed) {
                        DataManager.removeClassroom(name);
                        updateClassroomsList();
                        updateDashboardStats();
                    }
                });
            });
        });
    }

    window.editClassroom = function (name) {
        const room = DataManager.getClassrooms().find(r => r.name === name);
        if (!room) return;
        document.getElementById('className').value = room.name;
        document.getElementById('classTemplateSelect').value = '';
        document.getElementById('classGroups').value = room.groups;

        if (document.getElementById('teacherDeskPos')) {
            document.getElementById('teacherDeskPos').value = room.teacherDeskPos || 'right';
        }

        renderDynamicGroupInputs(room.groups, room.groupConfigs);

        currentLayout.name = room.name;
        currentLayout.groups = room.groups;
        currentLayout.groupConfigs = JSON.parse(JSON.stringify(room.groupConfigs));
        currentLayout.teacherDeskPos = room.teacherDeskPos || 'right';
        currentLayout.disabledSeats = [...(room.disabledSeats || [])];
        currentLayout.deskNotes = room.deskNotes ? { ...room.deskNotes } : {};

        previewArea.classList.remove('hidden');
        renderClassroomPreview();
        // Scroll to form
        document.querySelector('.settings-card').scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteClassroom = function (name) {
        Swal.fire({
            title: 'Emin misiniz?',
            text: `${name} dersliği silinecek!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, Sil!',
            cancelButtonText: 'İptal'
        }).then((result) => {
            if (result.isConfirmed) {
                DataManager.removeClassroom(name);
                updateClassroomsList();
                updateDashboardStats();
            }
        });
    };

    // --- 9. Exam Distribution UI ---
    const btnStartDistribution = document.getElementById('btnStartDistribution');
    const examSetupPanel = document.getElementById('examSetupPanel');
    const examResultsPanel = document.getElementById('examResultsPanel');
    const examClassroomsView = document.getElementById('examClassroomsView');
    const examPreflightStats = document.getElementById('examPreflightStats');

    // Update Preflight Stats when entering view
    document.querySelector('[data-target="view-exam"]').addEventListener('click', () => {
        const stats = DataManager.getStats();
        if (examPreflightStats) {
            examPreflightStats.innerHTML = `
                <div class="stat-card glass-panel" style="padding:1.5rem;">
                    <h3>Dağıtılacak Toplam Öğrenci</h3><h2 style="color:var(--primary); font-size:2.5rem;">${stats.totalStudents}</h2>
                </div>
                <div class="stat-card glass-panel" style="padding:1.5rem;">
                    <h3>Sınav Merkezi Toplam Kapasite</h3><h2 style="color:var(--secondary); font-size:2.5rem;">${stats.totalCapacity}</h2>
                </div>
            `;
        }
    });

    /**
     * distributeWithRetry — Akıllı Tekrarlı Dağıtım
     * Her tur en fazla ROUND_SIZE deneme yapar. Sonra kullanıcıya sorar.
     * "Durdur" butonu ile herhangi bir anda en iyi sonuç gösterilir.
     */
    async function distributeWithRetry(students, classrooms, sessionData, onFinish) {
        const ROUND_SIZE = 30; // Her turda kaç deneme yapılacak
        const YIELD_EVERY = 5; // Kaç denemede bir UI'ya nefes verileceği
        let bestResult = null;
        let bestScore = Infinity;
        let totalAttempts = 0;
        let cancelled = false;

        const sleep = () => new Promise(r => setTimeout(r, 0));

        const runRound = async () => {
            for (let i = 0; i < ROUND_SIZE && !cancelled; i++) {
                if (i > 0 && i % YIELD_EVERY === 0) {
                    // UI'ya nefes ver ve progress güncelle
                    const el = document.getElementById('retry-progress');
                    if (el) el.innerHTML =
                        `<b>${totalAttempts}</b>. deneme &nbsp;|&nbsp; En iyi: <b>${bestScore === Infinity ? '—' : bestScore}</b> çakışma`;
                    await sleep();
                    if (cancelled) break;
                }
                try {
                    const result = ExamAlgorithm.distribute([...students], classrooms, sessionData);
                    const score = ExamAlgorithm.countVerticalCollisions(result);
                    totalAttempts++;
                    if (score < bestScore) { bestScore = score; bestResult = result; }
                    if (score === 0) { cancelled = true; break; } // Mükemmel!
                } catch (e) {
                    totalAttempts++;
                    console.warn('distribute hata:', e);
                }
            }
        };

        // İlk turu çalıştır
        Swal.fire({
            title: 'Optimum Dağıtım Aranıyor...',
            html: `<div id="retry-progress">İlk deneme...</div>
                   <button id="btn-stop-retry" class="swal2-cancel swal2-styled" style="margin-top:12px; background:#6c757d;">
                     Durdur (En iyiyi Göster)
                   </button>`,
            allowOutsideClick: false,
            showConfirmButton: false,
            showCancelButton: false,
            didOpen: () => {
                Swal.showLoading();
                document.getElementById('btn-stop-retry')?.addEventListener('click', () => {
                    cancelled = true;
                });
            }
        });

        await runRound();

        // Mükemmel bulunduysa veya iptal edildiyse bitir
        if (bestScore === 0 || cancelled) {
            Swal.close();
            onFinish(bestResult, totalAttempts, bestScore);
            return bestResult;
        }

        // Devam sorusu döngüsü
        while (bestScore > 0) {
            Swal.close();
            const { isConfirmed } = await Swal.fire({
                title: `${bestScore} Dikey Çakışma Kaldı`,
                html: `<b>${totalAttempts}</b> denemede en iyi: <b>${bestScore}</b> arka arkaya çift.<br><br>30 deneme daha yapılsın mı?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Evet, devam et',
                cancelButtonText: 'Hayır, en iyisini göster'
            });
            if (!isConfirmed) break;

            cancelled = false;
            Swal.fire({
                title: 'Optimum Dağıtım Aranıyor...',
                html: `<div id="retry-progress">${totalAttempts + 1}. deneme başlıyor...</div>
                       <button id="btn-stop-retry" class="swal2-cancel swal2-styled" style="margin-top:12px; background:#6c757d;">
                         Durdur (En iyiyi Göster)
                       </button>`,
                allowOutsideClick: false, showConfirmButton: false, showCancelButton: false,
                didOpen: () => {
                    Swal.showLoading();
                    document.getElementById('btn-stop-retry')?.addEventListener('click', () => { cancelled = true; });
                }
            });

            await runRound();
            if (bestScore === 0 || cancelled) break;
        }

        Swal.close();
        onFinish(bestResult, totalAttempts, bestScore);
        return bestResult;
    }

    if (btnStartDistribution) {
        btnStartDistribution.addEventListener('click', () => {
            const students = DataManager.getStudents();
            const classrooms = DataManager.getClassrooms();

            if (students.length === 0 || classrooms.length === 0) {
                Swal.fire('Eksik Bilgi', 'Dağıtım için en az bir öğrenci ve derslik tanımlı olmalıdır.', 'warning');
                return;
            }

            try {
                // Smart Retry Distribution — onFinish callback handles render
                distributeWithRetry([...students], classrooms, {}, (r) => {
                    window._currentExamResults = r;
                    examSetupPanel.classList.add('hidden');
                    examResultsPanel.classList.remove('hidden');
                    renderExamResults(r);
                    Swal.fire('Tamamlandı', 'Öğrenciler başarıyla dersliklere dağıtıldı.', 'success');
                });
            } catch (err) {
                Swal.fire('Hata Oluştu', err.message, 'error');
            }
        });
    }

    window.toggleNestedAccordion = function (id) {
        const el = document.getElementById(id);
        const icon = document.getElementById(`icon-${id}`);
        if (el) {
            const isHidden = el.classList.contains('hidden');
            if (isHidden) {
                el.classList.remove('hidden');
                if (icon) icon.className = 'fa-solid fa-chevron-down';
            } else {
                el.classList.add('hidden');
                if (icon) icon.className = 'fa-solid fa-chevron-right';
            }
        }
    };

    function renderExamResults(session, targetContainer = null, appendMode = false) {
        const results = session.results;
        const view = targetContainer || examClassroomsView;
        if (!appendMode) view.innerHTML = '';

        results.forEach((room, idx) => {
            const roomId = `nested-room-schema-${idx}-${Math.random().toString(36).substr(2, 5)}`;
            const roomEl = document.createElement('div');
            roomEl.className = 'exam-room-result';
            roomEl.style.marginBottom = '2.5rem';

            // Calculate Visual Sequence Numbers (Rule: Bottom-Left = 1)
            let roomSeatCounterMaster = 1;
            const seatToNumRoom = {};
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(room.disabledSeats && room.disabledSeats.includes(sid))) {
                            seatToNumRoom[sid] = roomSeatCounterMaster++;
                        }
                    }
                }
            }

            let groupsHtml = '<div style="display:flex; gap:40px; justify-content:center; flex-wrap:wrap; margin-bottom: 2rem; direction: ltr;">';
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                groupsHtml += `<div class="desk-group" style="display:grid; grid-template-columns: repeat(${conf.cols}, 1fr); gap:6px; background:rgba(248,250,252,0.5); padding:10px; border:1px dashed #cbd5e1; border-radius:12px;">`;
                for (let r = conf.rows; r >= 1; r--) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const seatId = `G${g}-S${r}-C${c}`;
                        const student = room.seats[seatId];
                        const isDisabled = room.disabledSeats && room.disabledSeats.includes(seatId);

                        if (isDisabled) {
                            groupsHtml += `<div class="desk disabled" style="width:95px; height:80px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; color:#94a3b8; border-radius:8px; font-size:0.75rem; border:2px dotted #cbd5e1; opacity:0.4;">KAPALI</div>`;
                        } else {
                            const curNum = seatToNumRoom[seatId] || '-';
                            if (student) {
                                const sub = student._matchedSubject || '-';
                                let bg = 'background:white;';
                                let border = 'border:2px solid var(--primary);';
                                const neighbors = [{ dr: 0, dc: -1 }, { dr: 0, dc: 1 }, { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }, { dr: -1, dc: 0, v: 1 }, { dr: 1, dc: 0, v: 1 }];
                                let hs = false, hv = false;
                                neighbors.forEach(n => {
                                    const nid = `G${g}-S${r + n.dr}-C${c + n.dc}`;
                                    const nstd = room.seats[nid];
                                    if (nstd && (nstd._matchedSubject || '-') === sub) { if (n.v) hv = true; else hs = true; }
                                });
                                if (hs) { bg = 'background:#fee2e2;'; border = 'border:2px solid #ef4444;'; }
                                else if (hv) { bg = 'background:#fef9c3;'; border = 'border:2px solid #eab308;'; }

                                groupsHtml += `<div class="desk" style="width:95px; height:80px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center; ${bg} ${border} border-radius:8px; padding:6px; position:relative; box-shadow:0 3px 5px rgba(0,0,0,0.06); cursor:pointer; overflow:visible;"
                                    onclick="examDeskClick(event, ${idx}, '${seatId}')" oncontextmenu="examDeskRightClick(event, ${idx}, '${seatId}')">
                                    <div style="font-size:0.6rem; color:#64748b; font-weight:700; background:rgba(241,245,249,0.6); padding:1px 4px; border-radius:4px; width:100%; text-align:center; margin-bottom:4px;">${student.class} / ${student.no}</div>
                                    <div style="font-size:0.65rem; font-weight:800; color:#1e293b; text-align:center; line-height:1.1; margin-top:2px; height:32px; display:flex; align-items:center; justify-content:center; overflow:hidden;">${student.name}</div>
                                    <div style="width:22px; height:22px; background:#f8fafc; border:1px solid #cbd5e1; color:#334155; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:900; position:absolute; bottom:0; left:50%; transform:translateX(-50%); z-index:2; box-shadow:0 2px 4px rgba(0,0,0,0.1);">${curNum}</div>
                                </div>`;
                            } else {
                                groupsHtml += `<div class="desk empty" style="width:95px; height:80px; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; border:2px dashed #ef4444; background:#fff5f5; border-radius:8px; cursor:pointer; position:relative; overflow:visible; padding:6px;"
                                    onclick="examDeskClick(event, ${idx}, '${seatId}')">
                                    <div style="font-size:0.6rem; font-weight:900; color:#dc2626; margin-top:10px; letter-spacing:0.5px; text-align:center; line-height:1.2;">BOŞ<br>BIRAKINIZ</div>
                                    <div style="width:22px; height:22px; background:#fee2e2; border:1px solid #fecaca; color:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:900; position:absolute; bottom:0; left:50%; transform:translateX(-50%); z-index:2; box-shadow:0 2px 4px rgba(239,68,68,0.1);">${curNum}</div>
                                </div>`;
                            }
                        }
                    }
                }
                groupsHtml += '</div>';
            }
            groupsHtml += '</div>';

            const teacherDeskHtml = `<div style="width:100px; height:60px; background:#f1f5f9; border:3px solid #64748b; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:bold; color:#1e293b; box-shadow:0 4px 6px rgba(0,0,0,0.1);">MASA</div>`;
            const boardHtml = `<div style="flex:1; max-width:60%; height:40px; background:#0f172a; border:4px solid #475569; border-radius:4px; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; letter-spacing:4px; font-size:0.9rem; box-shadow:0 6px 12px rgba(0,0,0,0.2);">TAHTA</div>`;
            const frontAreaHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px; padding:0 10px; width:100%;">
                ${room.teacherDeskPos === 'left' ? teacherDeskHtml + boardHtml + '<div style="width:100px;"></div>' : '<div style="width:100px;"></div>' + boardHtml + teacherDeskHtml}
            </div>`;

            roomEl.innerHTML = `
                <div class="nested-accordion-header" onclick="toggleNestedAccordion('${roomId}')" style="background:var(--gray-50); padding:1rem; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.1rem;"><i class="fa-solid fa-table-cells" style="color:var(--primary);"></i> ${room.name} Salonu - Oturma Planı</h3>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <i class="fa-solid fa-print" style="color:var(--gray-400); cursor:pointer;" title="Yazdır" onclick="event.stopPropagation(); window.printSessionDistribution('${session.id}', '${room.name}')"></i>
                        <i id="icon-${roomId}" class="fa-solid fa-chevron-right" style="color:var(--gray-400);"></i>
                    </div>
                </div>
                <div id="${roomId}" class="hidden" style="padding:0.5rem; border:1px solid var(--gray-200); border-top:none; border-bottom-left-radius:8px; border-bottom-right-radius:8px; background:#f8fafc; overflow:hidden;">
                    <div class="schema-scroller" style="width:100%; display:flex; justify-content:center; align-items:center; min-height:400px; overflow-x:auto; padding:20px 0;">
                        <div class="classroom-walls" style="border:4px solid #334155; padding:40px; border-radius:24px; background:white; display:inline-block; transition: transform 0.3s ease; transform-origin:center; box-shadow:0 20px 50px rgba(0,0,0,0.1);">
                            ${groupsHtml}
                            ${frontAreaHtml}
                        </div>
                    </div>
                </div>
            `;
            view.appendChild(roomEl);

            setTimeout(() => {
                const sc = roomEl.querySelector('.schema-scroller');
                const wl = roomEl.querySelector('.classroom-walls');
                if (sc && wl) {
                    const upScale = () => {
                        // Force a temporary visible state to measure accurately if currently hidden
                        const isHidden = !sc.offsetParent;
                        let originalStyle = "";
                        if (isHidden) {
                            originalStyle = wl.style.cssText;
                            wl.style.transition = 'none'; // Disable transition during measurement
                            // We need both the parent and the walls to be block-ish to measure
                            wl.style.display = 'inline-block';
                            wl.style.position = 'absolute';
                            wl.style.visibility = 'hidden';
                            // Special case: if the whole panel is hidden, we might still get 0.
                            // But usually roomEl being in DOM is enough for offsetWidth of inline-block.
                        }

                        const margin = 30;
                        const containerWidth = sc.clientWidth || (view.clientWidth - 40); // Fallback to view width
                        const containerHeight = sc.clientHeight || 500; // Fallback to reasonable height

                        const scaleW = (containerWidth - margin) / (wl.offsetWidth || 1);
                        const scaleH = (containerHeight - margin) / (wl.offsetHeight || 1);

                        // Cap at 1.0 (100%) to prevent over-zooming.
                        const s = Math.min(scaleW, scaleH, 1.0);

                        if (isHidden) {
                            wl.style.cssText = originalStyle;
                        }

                        wl.style.transition = 'none'; // Ensure no animation for initial scale
                        wl.style.transform = `scale(${s})`;
                        // Restore transition after a frame
                        setTimeout(() => { wl.style.transition = ''; }, 50);
                    };
                    upScale();
                    window.addEventListener('resize', upScale);
                }
            }, 100);
        });
    }
    window._renderExamResults = renderExamResults;


    // Context menu handlers are defined globally below (outside DOMContentLoaded)

    // --- 10. Exam Session Wizard Logic ---
    const examWizardModal = document.getElementById('examWizardModal');
    const btnOpenExamWizard = document.getElementById('btnOpenExamWizard');
    const btnWizardClose = document.getElementById('btnWizardClose');
    const btnWizardNext = document.getElementById('btnWizardNext');
    const btnWizardPrev = document.getElementById('btnWizardPrev');
    const btnWizardFinish = document.getElementById('btnWizardFinish');

    let currentWizardStep = 1;
    let wizardSessionData = {
        id: '',
        name: '',
        date: '',
        time: '',
        hasGroups: false,
        groupCount: 2,
        subjects: [], // Now objects: {name, hasGroups}
        selectedClasses: [],
        excludedStudents: [],
        selectedClassrooms: []
    };

    function resetWizard() {
        currentWizardStep = 1;
        wizardSessionData = {
            id: 'ws_' + Date.now(),
            name: '', date: '', time: '', subjects: [],
            selectedClasses: [], excludedStudents: [], selectedClassrooms: []
        };

        const dateInput = document.getElementById('wizSessionDate');
        const today = new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.min = today;

        document.getElementById('wizSessionName').value = '';
        document.getElementById('wizSessionDate').value = '';

        // Dynamically populate session time based on daily lessons
        const timeSelect = document.getElementById('wizSessionTime');
        if (timeSelect) {
            const school = DataManager.getSchoolSettings();
            const lessonCount = parseInt(school.dailyLessons) || 0;
            let timeHtml = '<option value="">-- Seçiniz --</option>';
            for (let i = 1; i <= lessonCount; i++) {
                timeHtml += `<option value="${i}. Ders">${i}. Ders</option>`;
            }
            timeSelect.innerHTML = timeHtml;
            timeSelect.value = '';
        }

        const hasGroupsCheck = document.getElementById('wizSessionHasGroups');
        const groupCountInput = document.getElementById('wizSessionGroupCount');
        const groupCountContainer = document.getElementById('wizGroupCountContainer');

        if (hasGroupsCheck) {
            hasGroupsCheck.checked = false;
            hasGroupsCheck.onchange = () => {
                groupCountContainer.classList.toggle('hidden', !hasGroupsCheck.checked);
            };
        }
        if (groupCountInput) groupCountInput.value = '2';
        if (groupCountContainer) groupCountContainer.classList.add('hidden');

        document.getElementById('wizSubjectSelect').innerHTML = '<option value="">Lütfen Yüklü Öğrencilerden Bir Ders Seçin</option>';
        document.getElementById('wizSelectedSubjectsContainer').innerHTML = '';
        document.getElementById('wizClassesContainer').innerHTML = '<p style="text-align: center; color: var(--gray-500); margin-top: 2rem;">Dersler eklendiğinde, bu dersleri listesinde barındıran tüm sınıflar burada sıralanacaktır.</p>';
        document.getElementById('wizClassroomsContainer').innerHTML = '';
        updateWizardUI();
    }

    if (btnOpenExamWizard) {
        btnOpenExamWizard.addEventListener('click', () => {
            resetWizard();
            examWizardModal.classList.remove('hidden');
        });
    }

    if (btnWizardClose) {
        btnWizardClose.addEventListener('click', () => {
            examWizardModal.classList.add('hidden');
        });
    }

    function updateWizardUI() {
        // Toggle Panes
        [1, 2, 3, 4].forEach(step => {
            document.getElementById(`wizardStep${step}`).classList.toggle('hidden', currentWizardStep !== step);
        });

        // Toggle Stepper Active classes
        document.querySelectorAll('.wizard-step').forEach(el => {
            const stepNum = parseInt(el.dataset.step);
            el.classList.toggle('active', stepNum === currentWizardStep);
            el.style.color = (stepNum < currentWizardStep) ? 'var(--success)' : (stepNum === currentWizardStep ? 'var(--primary)' : 'var(--gray-400)');
            el.style.fontWeight = (stepNum <= currentWizardStep) ? 'bold' : 'normal';
        });

        // Footer buttons
        btnWizardPrev.style.visibility = currentWizardStep === 1 ? 'hidden' : 'visible';

        if (currentWizardStep === 4) {
            btnWizardNext.classList.add('hidden');
            btnWizardFinish.classList.remove('hidden');
            prepareStep4Summary();
        } else {
            btnWizardNext.classList.remove('hidden');
            btnWizardFinish.classList.add('hidden');
        }

        // On Step 2 Trigger: Save Step 1 & Populate Subjects
        if (currentWizardStep === 2) {
            wizardSessionData.name = document.getElementById('wizSessionName').value;
            wizardSessionData.date = document.getElementById('wizSessionDate').value;
            wizardSessionData.time = document.getElementById('wizSessionTime').value;
            wizardSessionData.hasGroups = document.getElementById('wizSessionHasGroups').checked;
            wizardSessionData.groupCount = parseInt(document.getElementById('wizSessionGroupCount').value) || 2;
            populateWizardSubjects();
        }
        // On Step 3 Trigger: Populate Classrooms based on Step 2 Choices
        if (currentWizardStep === 3) {
            populateWizardClassrooms();
        }
    }

    // Step 2 Logic: Subjects
    function populateWizardSubjects() {
        const settings = DataManager.getSchoolSettings();
        const allSubjects = settings.subjects || [];

        const select = document.getElementById('wizSubjectSelect');
        const btnAdd = document.getElementById('btnAddWizardSubject');
        const subjectsContainer = document.getElementById('wizSelectedSubjectsContainer');

        const updateSelectOptions = () => {
            select.innerHTML = '<option value="">-- Ders Seçiniz --</option>';
            allSubjects.forEach(sub => {
                // Hide if already selected
                if (!wizardSessionData.subjects.find(s => s.name === sub)) {
                    select.innerHTML += `<option value="${sub}">${sub}</option>`;
                }
            });
        };

        const renderTags = () => {
            subjectsContainer.innerHTML = '';
            wizardSessionData.subjects.forEach(subObj => {
                const sub = subObj.name;
                const tag = document.createElement('div');
                tag.style = 'background: white; border: 1px solid var(--primary); color: var(--primary); padding: 0.5rem 1rem; border-radius: 12px; font-size: 0.9rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';

                // Group Toggle for this specific subject
                const groupToggle = `
                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; cursor:pointer; color:var(--gray-600); margin-left:1rem; border-left:1px solid var(--gray-200); padding-left:1rem;">
                    <input type="checkbox" ${subObj.hasGroups ? 'checked' : ''} onchange="window.wizToggleSubjectGroup('${sub}', this.checked)" style="width:16px; height:16px;">
                        Grup
                    </label>
            `;

                tag.innerHTML = `
                <span style="font-weight:600;">${sub}</span>
                    ${groupToggle}
            <i class="fa-solid fa-circle-xmark" style="cursor: pointer; color:var(--gray-400); font-size:1.1rem; margin-left:0.5rem;" onclick="window.wizRemoveSubject('${sub}')"></i>
            `;
                subjectsContainer.appendChild(tag);
            });
            updateSelectOptions();
            populateWizardClasses();
        };

        window.wizRemoveSubject = (sub) => {
            wizardSessionData.subjects = wizardSessionData.subjects.filter(s => s.name !== sub);
            renderTags();
        };

        window.wizToggleSubjectGroup = (subName, val) => {
            const sub = wizardSessionData.subjects.find(s => s.name === subName);
            if (sub) sub.hasGroups = val;
        };

        btnAdd.onclick = () => {
            const val = select.value;
            if (val && !wizardSessionData.subjects.find(s => s.name === val)) {
                wizardSessionData.subjects.push({
                    name: val,
                    hasGroups: wizardSessionData.hasGroups // Default to session setting
                });
                renderTags();
                select.value = '';
            }
        };

        renderTags();
    }

    // Step 2 Logic: Classes for Subject
    function populateWizardClasses() {
        const container = document.getElementById('wizClassesContainer');
        if (wizardSessionData.subjects.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); margin-top: 2rem;">Lütfen yukarıdan en az bir ders seçip ekleyin.</p>';
            return;
        }

        const students = DataManager.getStudents();
        const sessions = DataManager.getExamSessions();
        const busyStudentNos = new Set();

        // Find students already in other sessions at the same time
        sessions.forEach(ses => {
            if (ses.id !== wizardSessionData.id && ses.date === wizardSessionData.date && ses.time === wizardSessionData.time) {
                const sesSubjects = ses.subjects || [ses.subject];
                const excluded = ses.excludedStudents || [];

                students.forEach(s => {
                    const poolId = `${s.class}|${s.alan || ""}`;
                    if (ses.selectedClasses.includes(poolId) || ses.selectedClasses.includes(s.class)) {
                        // Check if this student takes any of the session's subjects
                        const takesSub = s.dersler && s.dersler.some(d =>
                            sesSubjects.some(base => {
                                const baseName = typeof base === 'object' ? base.name : base;
                                return d.trim() === baseName || d.trim().startsWith(baseName + " ");
                            })
                        );
                        if (takesSub && !excluded.includes(s.no.toString())) {
                            busyStudentNos.add(s.no.toString());
                        }
                    }
                });
            }
        });

        // Calculate total available population per class (to check for full-class subjects)
        const classPopMap = {};
        students.forEach(s => {
            const sno = s.no.toString();
            if (!busyStudentNos.has(sno)) {
                classPopMap[s.class] = (classPopMap[s.class] || 0) + 1;
            }
        });

        const claimedStudentNos = new Set();
        const subjectGroups = []; // Array of { subject, poolMap: { poolId: { ... } }, ids: [] }

        wizardSessionData.subjects.forEach(baseSub => {
            const currentSubPools = {};
            const classMatches = {}; // "11-A" => { students: [], match: "" }

            students.forEach(s => {
                const sno = s.no.toString();
                if (busyStudentNos.has(sno) || claimedStudentNos.has(sno)) return;

                const baseSubName = baseSub.name;
                const match = s.dersler && s.dersler.find(d =>
                    d.trim() === baseSubName || d.trim().startsWith(baseSubName + " ")
                );

                if (match) {
                    if (!classMatches[s.class]) classMatches[s.class] = { students: [], match: match };
                    classMatches[s.class].students.push(s);
                }
            });

            // For each matching class, decide if we merge or split
            Object.keys(classMatches).sort().forEach(cls => {
                const matchInf = classMatches[cls];
                const totalInClass = classPopMap[cls] || 0;

                // Merge if EVERYONE in the class (who is available) takes this subject
                if (matchInf.students.length === totalInClass) {
                    const pid = cls;
                    currentSubPools[pid] = { class: cls, alan: null, count: matchInf.students.length, students: matchInf.students, match: matchInf.match };
                    matchInf.students.forEach(s => claimedStudentNos.add(s.no.toString()));
                } else {
                    // Split by alan
                    const alanMap = {};
                    matchInf.students.forEach(s => {
                        const alan = s.alan || "";
                        if (!alanMap[alan]) alanMap[alan] = [];
                        alanMap[alan].push(s);
                    });

                    Object.keys(alanMap).sort().forEach(alan => {
                        const pid = `${cls}|${alan}`;
                        const stds = alanMap[alan];
                        currentSubPools[pid] = { class: cls, alan: alan, count: stds.length, students: stds, match: matchInf.match };
                        stds.forEach(s => claimedStudentNos.add(s.no.toString()));
                    });
                }
            });

            const pids = Object.keys(currentSubPools).sort();
            if (pids.length > 0) {
                subjectGroups.push({ subject: baseSub, poolMap: currentSubPools, ids: pids });
            }
        });

        if (subjectGroups.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--danger); margin-top: 2rem;">Bu dersleri alan veya çakışmayan hiçbir öğrenci/sınıf bulunamadı.</p>';
            return;
        }

        let html = '';
        subjectGroups.forEach(grp => {
            html += `<h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--primary); font-size: 1rem; border-bottom: 2px solid var(--gray-200); padding-bottom: 0.3rem;">
                <i class="fa-solid fa-book"></i> ${grp.subject.name} Sınavına Girecek Sınıflar</h4>`;
            html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">`;

            grp.ids.forEach(pid => {
                const inf = grp.poolMap[pid];
                const displayName = inf.alan ? `${inf.class} (${inf.alan})` : inf.class;

                // Auto check by default
                if (!wizardSessionData.selectedClasses.includes(pid)) wizardSessionData.selectedClasses.push(pid);

                html += `
            <div style="background: white; border: 1px solid var(--gray-200); border-radius: 6px; padding: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" class="wiz-class-cb" value="${pid}" checked>
                            <div style="flex:1;">
                                <span style="font-weight:bold;">${displayName}</span>
                                <span style="font-size:0.8rem; color:var(--gray-500); display:block;">${inf.match} - ${inf.count} Öğrenci</span>
                            </div>
                        </label>
                        <button type="button" class="btn btn-secondary btn-sm" style="width:100%; margin-top:0.5rem; font-size:0.7rem;" onclick="window.wizToggleStudents('${pid.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-users"></i> Seçim Yap(${inf.count})
                        </button>
                    </div>
    `;
            });
            html += `</div>`;
        });

        container.innerHTML = html;

        window.wizToggleStudents = (pid) => {
            // Find student list for this pool from all groups
            let studentsInPool = [];
            subjectGroups.forEach(g => { if (g.poolMap[pid]) studentsInPool = g.poolMap[pid].students; });

            let listHtml = `
    <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                    <button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.wiz-std-cb').forEach(cb => cb.checked = true)" style="flex:1;">Hepsini Seç</button>
                    <button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.wiz-std-cb').forEach(cb => cb.checked = false)" style="flex:1;">Hiçbirini Seç</button>
                </div>
    <div style="text-align:left; max-height:300px; overflow-y:auto; padding:1rem; border:1px solid var(--gray-200); border-radius:8px;">`;
            studentsInPool.forEach(s => {
                const isExcluded = wizardSessionData.excludedStudents.includes(s.no.toString());
                listHtml += `
        <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; cursor:pointer;">
            <input type="checkbox" class="wiz-std-cb" value="${s.no}" ${isExcluded ? '' : 'checked'}>
                <span><b>${s.no}</b> - ${s.name}</span>
        </label>
        `;
            });
            listHtml += `</div>`;

            Swal.fire({
                title: `Öğrenci Seçimi`,
                html: listHtml,
                showCancelButton: true,
                confirmButtonText: 'Tamam',
                preConfirm: () => {
                    const checkedNos = Array.from(document.querySelectorAll('.wiz-std-cb:checked')).map(cb => cb.value);
                    const allNos = studentsInPool.map(s => s.no.toString());
                    const excluded = allNos.filter(no => !checkedNos.includes(no));

                    wizardSessionData.excludedStudents = wizardSessionData.excludedStudents.filter(no => !allNos.includes(no));
                    wizardSessionData.excludedStudents.push(...excluded);
                    return true;
                }
            });
        };

        // Bind events
        document.querySelectorAll('.wiz-class-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!wizardSessionData.selectedClasses.includes(e.target.value)) wizardSessionData.selectedClasses.push(e.target.value);
                } else {
                    wizardSessionData.selectedClasses = wizardSessionData.selectedClasses.filter(plot => plot !== e.target.value);
                }
            });
        });
    }

    // Step 3 Logic: Classrooms Auto-Match
    function populateWizardClassrooms() {
        const container = document.getElementById('wizClassroomsContainer');
        const allRooms = DataManager.getClassrooms();

        if (allRooms.length === 0) {
            container.innerHTML = '<p style="color:var(--danger);">Sistemde kayıtlı hiç derslik yok. Lütfen önce Derslik Yönetimi sekmesinden derslik ekleyin.</p>';
            return;
        }

        let html = '';
        wizardSessionData.selectedClassrooms = []; // reset array based on checkbox state

        allRooms.forEach(room => {
            // Auto match heuristic: Does the room name exactly match ANY selected class name?
            const isAutoMatch = wizardSessionData.selectedClasses.includes(room.name);
            if (isAutoMatch) wizardSessionData.selectedClassrooms.push(room.name);

            html += `
                <label style="display: flex; align-items: center; gap: 0.5rem; background: ${isAutoMatch ? 'var(--light-primary)' : 'white'}; padding: 0.75rem; border: 1px solid ${isAutoMatch ? 'var(--primary)' : 'var(--gray-200)'}; border-radius: 6px; cursor: pointer;">
                    <input type="checkbox" class="wiz-room-cb" value="${room.name}" ${isAutoMatch ? 'checked' : ''}>
                    <div style="flex:1;">
                        <span style="font-weight:bold; color: ${isAutoMatch ? 'var(--primary)' : 'inherit'};">${room.name} Salonu</span>
                    </div>
                </label>
`;
        });
        container.innerHTML = html;

        // Bind events
        document.querySelectorAll('.wiz-room-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!wizardSessionData.selectedClassrooms.includes(e.target.value)) wizardSessionData.selectedClassrooms.push(e.target.value);
                } else {
                    wizardSessionData.selectedClassrooms = wizardSessionData.selectedClassrooms.filter(c => c !== e.target.value);
                }
                // Update parent style for viz
                e.target.parentElement.style.background = e.target.checked ? 'var(--light-primary)' : 'white';
                e.target.parentElement.style.borderColor = e.target.checked ? 'var(--primary)' : 'var(--gray-200)';
            });
        });
    }

    // Step 4 Logic: Review
    function prepareStep4Summary() {
        const box = document.getElementById('wizSummaryBox');

        // Format class names for display
        const displayClasses = wizardSessionData.selectedClasses.map(c => c.includes('|') ? c.split('|')[0] + (c.split('|')[1] ? ` (${c.split('|')[1]})` : '') : c);

        const groupInfo = wizardSessionData.hasGroups
            ? `<div style="margin-top:0.5rem; color:var(--primary); font-weight:bold;"><i class="fa-solid fa-layer-group"></i> ${wizardSessionData.groupCount} Gruplu Sınav (Gruplar: ${getGroupNames(wizardSessionData.groupCount)})</div>`
            : `<div style="margin-top:0.5rem; color:var(--gray-500);"><i class="fa-solid fa-ban"></i> Grupsuz Sınav</div>`;

        let subjectsHtml = wizardSessionData.subjects.map(s => {
            const gText = s.hasGroups ? `<span style="color:var(--success); font-size:0.75rem; margin-left:0.5rem;">[Gruplu]</span>` : '';
            return `<li style="margin-bottom:0.25rem;">${s.name}${gText}</li>`;
        }).join('');

        box.innerHTML = `
    <div style="margin-bottom: 1rem; border-bottom: 1px solid var(--gray-200); padding-bottom: 0.5rem;">
                <h4 style="margin:0; color:var(--primary);">${wizardSessionData.name}</h4>
                <div style="font-size:0.9rem; color:var(--gray-600);">${wizardSessionData.date} / ${wizardSessionData.time}</div>
                ${groupInfo}
            </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; font-size:0.9rem;">
        <div>
            <strong style="display:block; margin-bottom:0.5rem;">Sınav Dersleri:</strong>
            <ul style="margin:0; padding-left:1.2rem; color:var(--gray-700);">
                ${subjectsHtml}
            </ul>
        </div>
        <div>
            <strong style="display:block; margin-bottom:0.5rem;">Sınava Girecek Sınıflar:</strong>
            <div style="color:var(--gray-700);">${displayClasses.length} Havuz Seçildi</div>
            <strong style="display:block; margin-top:1rem; margin-bottom:0.5rem;">Kullanılacak Salonlar:</strong>
            <div style="color:var(--gray-700);">${wizardSessionData.selectedClassrooms.length} Salon Seçildi</div>
        </div>
    </div>
`;
    }

    function getGroupNames(count) {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return alphabet.split('').slice(0, count).join(', ');
    }

    if (btnWizardNext) {
        btnWizardNext.addEventListener('click', () => {
            // Validations before moving explicitly
            if (currentWizardStep === 1) {
                wizardSessionData.name = document.getElementById('wizSessionName').value.trim();
                wizardSessionData.date = document.getElementById('wizSessionDate').value;
                wizardSessionData.time = document.getElementById('wizSessionTime').value.trim();
                if (!wizardSessionData.name || !wizardSessionData.date || !wizardSessionData.time) {
                    Swal.fire('Eksik', 'Lütfen 1. Adımdaki tüm alanları doldurun.', 'warning');
                    return;
                }
            } else if (currentWizardStep === 2) {
                if (wizardSessionData.subjects.length === 0 || wizardSessionData.selectedClasses.length === 0) {
                    Swal.fire('Eksik', 'Lütfen en az bir ders eklediğinizden ve havuza en az bir sınıf eklediğinizden emin olun.', 'warning');
                    return;
                }
            } else if (currentWizardStep === 3) {
                if (wizardSessionData.selectedClassrooms.length === 0) {
                    Swal.fire('Eksik', 'Lütfen oturum için en az 1 derslik seçin.', 'warning');
                    return;
                }
            }

            if (currentWizardStep < 4) currentWizardStep++;
            updateWizardUI();
        });
    }

    if (btnWizardPrev) {
        btnWizardPrev.addEventListener('click', () => {
            if (currentWizardStep > 1) currentWizardStep--;
            updateWizardUI();
        });
    }

    if (btnWizardFinish) {
        btnWizardFinish.addEventListener('click', () => {
            // Calculate Results before closing
            const allRooms = DataManager.getClassrooms();
            const targetRooms = allRooms.filter(r => wizardSessionData.selectedClassrooms.includes(r.name));

            const allStudents = DataManager.getStudents();
            const sessionSubjects = wizardSessionData.subjects.map(s => s.name);

            const targetStudents = allStudents.filter(s => {
                const poolId = `${s.class}|${s.alan || ""}`;
                if (!wizardSessionData.selectedClasses.includes(poolId) && !wizardSessionData.selectedClasses.includes(s.class)) return false;

                let matchedSubject = null;
                const hasSub = s.dersler && s.dersler.some(d => {
                    const found = sessionSubjects.some(base => d.trim() === base || d.trim().startsWith(base + " "));
                    if (found) matchedSubject = d.trim();
                    return found;
                });

                if (!hasSub) return false;
                if (wizardSessionData.excludedStudents && wizardSessionData.excludedStudents.includes(s.no.toString())) return false;

                // Attach matched subject for the list view
                s._matchedSubject = matchedSubject;
                return true;
            });

            if (targetStudents.length === 0 || targetRooms.length === 0) {
                Swal.fire('Hata', 'Dağıtım için geçerli öğrenci veya derslik bulunamadı!', 'error');
                return;
            }

            try {
                wizardSessionData.results = ExamAlgorithm.distribute([...targetStudents], targetRooms, wizardSessionData);

                // Save Session
                DataManager.addExamSession(wizardSessionData);
                examWizardModal.classList.add('hidden');

                Swal.fire({
                    title: 'Dağıtımı Yapıldı',
                    text: 'Sınav oturumu kaydedildi ve dağıtım başarıyla tamamlandı.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    // Show result panel immediately
                    window.viewSessionDistribution(wizardSessionData.id, 'class');
                });

                renderExamSessionsList();
            } catch (err) {
                Swal.fire('Dağıtım Hatası', err.message, 'error');
            }
        });
    }

    // List rendering
    const examSessionsList = document.getElementById('examSessionsList');
    function renderExamSessionsList() {
        if (!examSessionsList) return;
        const sessions = DataManager.getExamSessions();
        examSessionsList.innerHTML = '';

        if (sessions.length === 0) {
            examSessionsList.innerHTML = `<div style="text-align:center; padding: 2rem; border: 2px dashed var(--gray-300); border-radius: 8px; color: var(--gray-500);">Henüz bir sınav oturumu planlamadınız. Yukarıdan yeni oturum oluşturun.</div>`;
            return;
        }

        let tableHtml = `
            <table class="data-table" style="width:100%; border-collapse:collapse; background:white; border-radius:12px; overflow:hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <thead style="background:var(--gray-50); border-bottom:2px solid var(--gray-200);">
                    <tr>
                        <th style="padding:1.25rem; text-align:left; font-weight:700; color:var(--gray-700);">Sınav Oturumu</th>
                        <th style="padding:1.25rem; text-align:left; font-weight:700; color:var(--gray-700);">Tarih & Saat</th>
                        <th style="padding:1.25rem; text-align:left; font-weight:700; color:var(--gray-700);">Görünüm Modu</th>
                        <th style="padding:1.25rem; text-align:center; font-weight:700; color:var(--gray-700);">Aksiyom</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sessions.forEach((ses, idx) => {
            // Pastel gradient: Purple (280) to Red (0)
            const hue = sessions.length > 1 ? 280 - (idx / (sessions.length - 1)) * 280 : 280;
            const bgColor = `hsla(${hue}, 70%, 97%, 1)`;

            tableHtml += `
                <tr id="session-row-${ses.id}" style="border-bottom: 1px solid var(--gray-100); transition: background 0.2s; background: ${bgColor};">
                    <td style="padding:1.25rem;">
                        <span onclick="window.viewSessionDistribution('${ses.id}')" style="font-weight:700; color:var(--primary); text-decoration:none; display:block; cursor:pointer;">
                            <i class="fa-solid fa-chevron-right" id="arrow-${ses.id}" style="margin-right:8px; transition: transform 0.2s;"></i> ${ses.name}
                        </span>
                        <div style="font-size:0.75rem; color:var(--gray-500); margin-top:0.25rem;">
                            ${ses.subjects ? ses.subjects.map(s => typeof s === 'object' ? s.name : s).join(', ') : (ses.subject || '')}
                        </div>
                    </td>
                    <td style="padding:1.25rem;">
                        <div style="font-weight:600; color:var(--dark);">${ses.date ? ses.date.split('-').reverse().join('.') : ''}</div>
                        <div style="font-size:0.8rem; color:var(--gray-500);">${ses.time}</div>
                    </td>
                    <td style="padding:1.25rem;">
                        <div class="mode-selector-container" style="display:flex; gap:12px; background:var(--gray-50); padding:8px 12px; border-radius:30px; border:1px solid var(--gray-200); width:fit-content;">
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.85rem; font-weight:500;">
                                <input type="radio" name="mode-${ses.id}" value="class" checked style="width:16px; height:16px;" onclick="window.viewSessionDistribution('${ses.id}', null, true)"> Sınıf
                            </label>
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.85rem; font-weight:500;">
                                <input type="radio" name="mode-${ses.id}" value="room" style="width:16px; height:16px;" onclick="window.viewSessionDistribution('${ses.id}', null, true)"> Salon
                            </label>
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.85rem; font-weight:500;">
                                <input type="radio" name="mode-${ses.id}" value="seating" style="width:16px; height:16px;" onclick="window.viewSessionDistribution('${ses.id}', null, true)"> Şema
                            </label>
                            <div style="width:1px; height:20px; background:var(--gray-300); margin:0 5px;"></div>
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.85rem; font-weight:700; color:var(--primary);">
                                <input type="checkbox" class="session-paper-check" data-id="${ses.id}" style="width:17px; height:17px;"> Soru Kağıdı
                            </label>
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.85rem; font-weight:700; color:var(--info);" title="Ekran Görünümü">
                                <input type="checkbox" class="session-screen-check" data-id="${ses.id}" ${ses.screenViewEnabled ? 'checked' : ''} style="width:17px; height:17px;"> <i class="fa-solid fa-desktop"></i>
                            </label>
                        </div>
                    </td>
                    <td style="padding:1.25rem; text-align:center; display:flex; gap:0.5rem; justify-content:center;">
                        <button class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" onclick="window.openSessionMetadataEditor('${ses.id}')" title="Düzenle">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" title="Yazdır"
                            onclick="window.printSessionDistribution('${ses.id}')">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        <button class="btn btn-danger" style="padding: 0.5rem 0.75rem;" onclick="window.deleteExamSession('${ses.id}')" title="Sil">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>

                </tr>
                <tr id="accordion-body-${ses.id}" class="hidden" style="background:#fafafa;">
                    <td colspan="4" style="padding:0;">
                        <div id="results-container-${ses.id}" style="padding:1.5rem; border-left:4px solid var(--primary);">
                            <!-- Results will be injected here -->
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        examSessionsList.innerHTML = tableHtml;
    }

    // Handle screen view checkbox toggle
    document.body.addEventListener('change', function (e) {
        if (e.target && e.target.classList.contains('session-screen-check')) {
            const sid = e.target.getAttribute('data-id');
            const isChecked = e.target.checked;
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === sid);
            if (session) {
                session.screenViewEnabled = isChecked;
                DataManager.addExamSession(session);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: isChecked ? 'Tam ekran görünümü aktif edildi' : 'Tam ekran görünümü kapatıldı',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        }
    });

    window.deleteExamSession = function (id) {
        Swal.fire({
            title: 'Oturumu Sil',
            text: "Bu sınav oturum planını silmek istediğinize emin misiniz?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'İptal'
        }).then((result) => {
            if (result.isConfirmed) {
                DataManager.removeExamSession(id);
                renderExamSessionsList();
            }
        });
    };

    // --- School Logo Handler ---
    window.handleLogoUpload = function (input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64 = e.target.result;
                const school = DataManager.getSchoolSettings();
                DataManager.saveSchoolSettings({ ...school, logo: base64 });

                const preview = document.getElementById('schoolLogoPreview');
                if (preview) preview.innerHTML = `<img src="${base64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;

                Swal.fire({
                    icon: 'success',
                    title: 'Logo Yüklendi',
                    text: 'Okul amblemi başarıyla kaydedildi.',
                    timer: 1500,
                    showConfirmButton: false
                });
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    // ─────── PRINT HELPERS (Queue-based with PDF Overlay) ───────────
    window._printQueue = [];
    window._isProcessingPrint = false;
    window._cachedFont = null;

    // Robust file fetcher for local file:/// stability
    window.getFileBytes = async function (url) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.arrayBuffer();
        } catch (e) {
            console.warn("Fetch failed, trying XHR for", url);
        }

        return new Promise((resolve, reject) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = function () {
                    if (this.status === 200 || (this.status === 0 && this.response && this.response.byteLength > 0)) {
                        resolve(this.response);
                    } else {
                        reject(new Error(`Okuma hatası: ${this.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error("Bağlantı/Güvenlik hatası. Tarayıcı yerel dosyaya erişimi engelliyor olabilir."));
                xhr.send();
            } catch (e) { reject(e); }
        });
    };

    window.printFile = function (path, studentInfo = null) {
        if (!path) return;
        window._printQueue.push({ path: path.trim(), info: studentInfo });
        if (!window._isProcessingPrint) window._processPrintQueue();
    };

    window._processPrintQueue = async function () {
        if (window._printQueue.length === 0) {
            window._isProcessingPrint = false;
            return;
        }
        window._isProcessingPrint = true;
        let { path, info } = window._printQueue.shift();

        // Clean & Format Path
        let printPath = path;
        if (printPath.match(/^[a-zA-Z]:\\/) || printPath.match(/^[a-zA-Z]:\//)) {
            printPath = 'file:///' + printPath.replace(/\\/g, '/');
        }

        const finalize = (iframe) => {
            if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
            setTimeout(() => window._processPrintQueue(), 1000);
        };

        let currentStep = "Dosya haz\u0131rlan\u0131yor";
        try {
            // 1. Fetch PDF Bytes
            currentStep = "Soru ka\u011f\u0131d\u0131 okunuyor (" + path.split(/[\\\/]/).pop() + ")";
            const pdfBytes = await window.getFileBytes(printPath);

            // 2. Load pdf-lib and Overlay
            currentStep = "PDF i\u015fleniyor";
            if (typeof PDFLib === 'undefined') throw new Error("PDF k\u00fct\u00fcphanesi (pdf-lib) yüklenemedi.");

            const { PDFDocument, rgb } = PDFLib;
            const pdfDoc = await PDFDocument.load(pdfBytes);

            if (typeof fontkit !== 'undefined') {
                pdfDoc.registerFontkit(fontkit);
            } else {
                console.warn("Fontkit yüklenemedi, Türkçe karakterler hatalı görünebilir.");
            }

            // Fetch Fonts if not cached with resilient CDNs
            currentStep = "Yaz\u0131 tipleri yükleniyor";
            if (!window._cachedFonts) window._cachedFonts = {};

            const mainFontUrls = [
                'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf'
            ];
            const nameFontUrls = [
                'fonts/MonotypeCorsiva.ttf'
            ];
            const schoolFontUrls = [
                'fonts/SnapITC.ttf'
            ];

            if (!window._cachedFonts.main) {
                for (const url of mainFontUrls) {
                    try {
                        const bytes = await getFileBytes(url);
                        if (bytes && bytes.byteLength > 1000) { window._cachedFonts.main = bytes; break; }
                    } catch (e) { console.warn("Main font fetch failed", url); }
                }
            }

            if (!window._cachedFonts.nameFont) {
                for (const url of nameFontUrls) {
                    try {
                        const bytes = await getFileBytes(url);
                        if (bytes && bytes.byteLength > 1000) { window._cachedFonts.nameFont = bytes; break; }
                    } catch (e) { console.warn("Name font fetch failed", url); }
                }
            }

            if (!window._cachedFonts.schoolFont) {
                for (const url of schoolFontUrls) {
                    try {
                        const bytes = await getFileBytes(url);
                        if (bytes && bytes.byteLength > 1000) { window._cachedFonts.schoolFont = bytes; break; }
                    } catch (e) { console.warn("School font fetch failed", url); }
                }
            }

            let mainFont = null;
            let nameFont = null;
            let schoolFont = null;
            try {
                if (window._cachedFonts.main) mainFont = await pdfDoc.embedFont(window._cachedFonts.main);
                if (window._cachedFonts.nameFont) nameFont = await pdfDoc.embedFont(window._cachedFonts.nameFont);
                if (window._cachedFonts.schoolFont) schoolFont = await pdfDoc.embedFont(window._cachedFonts.schoolFont);
            } catch (e) { console.error("Font embedding error", e); }

            // Absolute Fallback to prevent "null font" crashes
            const fallbackPdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            const customFont = mainFont ? mainFont : null; // Flag used by cleanTurkishChars helper

            mainFont = mainFont || fallbackPdfFont;
            nameFont = nameFont || mainFont;
            schoolFont = schoolFont || mainFont;


            const school = DataManager.getSchoolSettings();
            const pages = pdfDoc.getPages();

            currentStep = "Bilgiler ekleniyor";
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // --- Text Helpers (Internal to PDF Loop) ---
                const cleanTurkishChars = (text) => {
                    if (!text) return '';
                    if (customFont) return text;
                    return text
                        .replace(/\u0130/g, 'I').replace(/\u0131/g, 'i')
                        .replace(/\u011e/g, 'G').replace(/\u011f/g, 'g')
                        .replace(/\u015e/g, 'S').replace(/\u015f/g, 's')
                        .replace(/\u00c7/g, 'C').replace(/\u00e7/g, 'c')
                        .replace(/\u00d6/g, 'O').replace(/\u00f6/g, 'o')
                        .replace(/\u00dc/g, 'U').replace(/\u00fc/g, 'u');
                };

                const drawCenterText = (str, cx, cy, cw, ch, sz, fnt) => {
                    if (!str) return;
                    const cl = cleanTurkishChars(str).toString();
                    const tw = fnt ? fnt.widthOfTextAtSize(cl, sz) : cl.length * (sz * 0.6);
                    const tx = cx + Math.max(0, (cw - tw) / 2);
                    const ty = cy + (ch / 2) - (sz * 0.35);
                    page.drawText(cl, { x: tx, y: ty, size: sz, font: fnt || undefined, color: rgb(0, 0, 0) });
                };

                const drawLeftText = (str, cx, cy, cw, ch, sz, fnt) => {
                    if (!str) return;
                    const cl = cleanTurkishChars(str).toString();
                    const tx = cx + 5; // 5pt left padding
                    const ty = cy + (ch / 2) - (sz * 0.35);
                    page.drawText(cl, { x: tx, y: ty, size: sz, font: fnt || undefined, color: rgb(0, 0, 0) });
                };

                // ONLY DRAW ON PAGE 1
                if (i === 0) {
                    // --- PERFECT REPRODUCTION HEADER ---
                    // Soru kağıdı ilk sayfası: Sağ, Sol, Üst marjlar tam 0.5 cm (14.17 pt)
                    // Üst bilginin alt sınırı en fazla 3 cm (85.04 pt) olacak.

                    const margin = 14.17; // 0.5 cm
                    const limitY = 85.04; // 3.0 cm

                    // PDFLib'te SVG stroke (çizgi kalınlığı) çizginin ortasından merkeze doğru dışa taşar.
                    // Çerçevenin dışarı taşmaması/kesilmemesi için stroke yarısı kadar içeri alıyoruz.
                    const outerStroke = 1.6;
                    const strokeOffset = outerStroke / 2 + 1; // Güvenlik payı eklendi

                    const ox = margin + strokeOffset;
                    const oy = height - limitY + strokeOffset;
                    const ow = width - (margin * 2) - (strokeOffset * 2);
                    const oh = limitY - margin - (strokeOffset * 2);

                    const gap = 2; // İç çerçeve ile dış çerçeve arası boşluk
                    const ix = ox + gap;
                    const iy = oy + gap;
                    const iw = ow - (gap * 2);
                    const ih = oh - (gap * 2);

                    const leftW = 65;
                    const rightW = 85;
                    const midW = iw - leftW - rightW;

                    const row3H = 25;
                    const row2H = 19;
                    const row1H = ih - row3H - row2H; // approx 22

                    // Mid section columns
                    const midCol2W = 30; // No
                    const midCol4W = 30; // Room
                    const midCol5W = 75; // Subject
                    const midCol6W = 30; // Seat
                    const midCol3W = midW - midCol2W - midCol4W - midCol5W - midCol6W; // Name (Expanded)

                    // 1. BACKGROUNDS
                    // Row 1 (School Name) - Pseudo Cylindrical Gradient
                    const gradTopY = iy + row3H + row2H;
                    const strips = [
                        { c: 0.82, h: 4 }, { c: 0.94, h: 4 }, { c: 1.0, h: row1H - 15 }, { c: 0.94, h: 4 }, { c: 0.82, h: 3 }
                    ];
                    let curStripY = gradTopY;
                    for (let s of strips) {
                        page.drawRectangle({ x: ix + leftW, y: curStripY, width: midW, height: s.h, color: rgb(s.c, s.c, s.c) });
                        curStripY += s.h;
                    }

                    // Name cell (very light gray/dotted sim)
                    page.drawRectangle({ x: ix + leftW + midCol2W, y: iy, width: midCol3W, height: row3H, color: rgb(0.96, 0.96, 0.96) });

                    // Room, Subject, Seat (solid gray)
                    const roomX = ix + leftW + midCol2W + midCol3W;
                    page.drawRectangle({ x: roomX, y: iy, width: midW - (midCol2W + midCol3W), height: row3H, color: rgb(0.88, 0.88, 0.88) });

                    // 2. GRID LINES
                    // Vertical Boundaries
                    page.drawLine({ start: { x: ix + leftW, y: iy }, end: { x: ix + leftW, y: iy + ih }, thickness: 0.75 }); // Between Logo and School Name
                    page.drawLine({ start: { x: ix + leftW + midW, y: iy }, end: { x: ix + leftW + midW, y: iy + ih }, thickness: 0.75 }); // Between Exam Info and PUAN

                    // Row 3 inner verticals
                    let curX = ix + leftW + midCol2W;
                    page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); // After No
                    curX += midCol3W;
                    page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); // After Name
                    curX += midCol4W;
                    page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); // After Room
                    curX += midCol5W;
                    page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); // After Subject

                    // Horizontal Lines
                    page.drawLine({ start: { x: ix + leftW, y: iy + row3H + row2H }, end: { x: ix + leftW + midW, y: iy + row3H + row2H }, thickness: 0.75 }); // Between Row 1 & 2
                    page.drawLine({ start: { x: ix, y: iy + row3H }, end: { x: ix + leftW + midW, y: iy + row3H }, thickness: 0.75 }); // Between Row 2 & 3

                    // 3. EXPLICIT MANUAL LINES FOR OUTER FRAME (100% Guaranteed Render)
                    const drawExplicitOppositeFrame = (x, y, w, h, r, thickness) => {
                        // Straight margins
                        page.drawLine({ start: { x: x + r, y: y + h }, end: { x: x + w, y: y + h }, thickness }); // Top
                        page.drawLine({ start: { x: x + w, y: y + h }, end: { x: x + w, y: y + r }, thickness }); // Right
                        page.drawLine({ start: { x: x + w - r, y: y }, end: { x: x, y: y }, thickness }); // Bottom
                        page.drawLine({ start: { x: x, y: y }, end: { x: x, y: y + h - r }, thickness }); // Left
                        // Top-Left Arc
                        const segments = 12;
                        for (let j = 0; j < segments; j++) {
                            const a1 = Math.PI / 2 + (Math.PI / 2) * (j / segments);
                            const a2 = Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                            page.drawLine({
                                start: { x: x + r + r * Math.cos(a1), y: y + h - r + r * Math.sin(a1) },
                                end: { x: x + r + r * Math.cos(a2), y: y + h - r + r * Math.sin(a2) },
                                thickness
                            });
                        }
                        // Bottom-Right Arc
                        for (let j = 0; j < segments; j++) {
                            const a1 = -Math.PI / 2 + (Math.PI / 2) * (j / segments);
                            const a2 = -Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                            page.drawLine({
                                start: { x: x + w - r + r * Math.cos(a1), y: y + r + r * Math.sin(a1) },
                                end: { x: x + w - r + r * Math.cos(a2), y: y + r + r * Math.sin(a2) },
                                thickness
                            });
                        }
                    };
                    drawExplicitOppositeFrame(ox, oy, ow, oh, 6, 1.5);
                    drawExplicitOppositeFrame(ix, iy, iw, ih, 4, 0.5);

                    // 4. TEXT CONTENT
                    // Row 1: School Name (Spaced & Custom Font)
                    // Ensure lowercase 'i' successfully converts to 'İ' (dotted) before toUpperCase
                    let sName = (school.name || '').replace(/i/g, 'İ').toUpperCase().split('').join(' ');
                    drawCenterText(sName, ix + leftW, iy + row3H + row2H, midW, row1H, 11, schoolFont);

                    // Row 2: Exam Info
                    const sess = window.currentRenderedSession || {};
                    let termDom = '';
                    try {
                        const termEl = document.getElementById('academicTerm');
                        if (termEl) termDom = termEl.value;
                    } catch (e) { }

                    let termStr = (sess.academicTerm || termDom || '').toUpperCase();
                    if (termStr === '1. DÖNEM' || termStr === '1 DÖNEM' || termStr === '1. DONEM') termStr = 'I. DÖNEM';
                    else if (termStr === '2. DÖNEM' || termStr === '2 DÖNEM' || termStr === '2. DONEM') termStr = 'II. DÖNEM';
                    else termStr = termStr.replace('1.', '1.').replace('2.', '2.');

                    if (termStr && !termStr.includes('DÖNEM') && !termStr.includes('DONEM')) termStr += ' DÖNEM';

                    const examNoStr = info?.examNo || info?.examNumber || '';
                    // [Year] ÖĞRETİM YILI [Term] [Subject] DERSİ [No]. YAZILI SINAVI
                    const examText = `${school.academicYear || ''} ÖĞRETİM YILI ${termStr} ${info?.subject || ''} DERSİ ${examNoStr ? `${examNoStr}. ` : ''}YAZILI SINAVI`.trim().toUpperCase();

                    // Decrease font size slightly if row 2 text is very long. Let's find absolute max size that fits.
                    let row2Sz = 14; // Start with max desired size
                    let examTextWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(examText), row2Sz) : examText.length * (row2Sz * 0.6);
                    while (examTextWidth > (midW - 10) && row2Sz > 5) {
                        row2Sz -= 0.5;
                        examTextWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(examText), row2Sz) : examText.length * (row2Sz * 0.6);
                    }
                    drawCenterText(examText, ix + leftW, iy + row3H, midW, row2H, row2Sz, mainFont);

                    // Row 3: Student Details
                    if (info) {
                        drawCenterText(info.class, ix, iy, leftW, row3H, 16, mainFont); // Class
                        drawCenterText(info.no, ix + leftW, iy, midCol2W, row3H, 12, mainFont); // No

                        // Name left-aligned using cursive nameFont with dynamic scaling and heavy pseudo-bold
                        let nameStr = info.name.replace(/i/g, 'İ').toUpperCase();
                        let nameSz = 28; // Start very large
                        let nameWidth = nameFont ? nameFont.widthOfTextAtSize(cleanTurkishChars(nameStr), nameSz) : nameStr.length * (nameSz * 0.5);
                        while (nameWidth > (midCol3W - 15) && nameSz > 8) {
                            nameSz -= 0.5;
                            nameWidth = nameFont ? nameFont.widthOfTextAtSize(cleanTurkishChars(nameStr), nameSz) : nameStr.length * (nameSz * 0.5);
                        }
                        // Clamp vertically so it is as large as possible without touching the 25pt high box lines
                        if (nameSz > 24) nameSz = 24;

                        // Extreme Pseudo-bold by drawing the text 3 times with X offsets
                        drawLeftText(nameStr, ix + leftW + midCol2W, iy, midCol3W, row3H, nameSz, nameFont);
                        drawLeftText(nameStr, ix + leftW + midCol2W + 0.3, iy, midCol3W, row3H, nameSz, nameFont);
                        drawLeftText(nameStr, ix + leftW + midCol2W + 0.6, iy, midCol3W, row3H, nameSz, nameFont);

                        // Inner Top Labels for Right-Side Cells
                        page.drawText("DERSLİK", { x: ix + leftW + midCol2W + midCol3W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                        page.drawText("SINAV", { x: ix + leftW + midCol2W + midCol3W + midCol4W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                        page.drawText("YER", { x: ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });

                        // Shift actual values down slightly to accommodate top labels
                        drawCenterText(info.room, ix + leftW + midCol2W + midCol3W, iy - 2.5, midCol4W, row3H, 11, mainFont); // Room
                        drawCenterText((info.subject || '').toUpperCase(), ix + leftW + midCol2W + midCol3W + midCol4W, iy - 2.5, midCol5W, row3H, 9.5, mainFont); // Subject
                        drawCenterText(info.seat, ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W, iy - 2.5, midCol6W, row3H, 14, mainFont); // Seat
                    }

                    // PUAN label
                    page.drawText("PUAN", { x: ix + leftW + midW + 5, y: iy + ih - 10, size: 7, font: mainFont, color: rgb(0.5, 0.5, 0.5) });

                    // 5. LOGO
                    if (school.logo) {
                        try {
                            const logoBytes = await window.getFileBytes(school.logo);
                            let logoImage;
                            if (school.logo.includes('image/png') || school.logo.toLowerCase().endsWith('.png')) logoImage = await pdfDoc.embedPng(logoBytes);
                            else logoImage = await pdfDoc.embedJpg(logoBytes);

                            const logoDim = 26; // Exact proportion
                            const lx = ix + (leftW - logoDim) / 2;
                            const ly = iy + row3H + (row2H + row1H - logoDim) / 2;
                            page.drawImage(logoImage, { x: lx, y: ly, width: logoDim, height: logoDim });
                        } catch (e) {
                            console.warn("Logo error", e);
                        }
                    }
                }
            }


            const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);

            // 3. Print
            currentStep = "Yaz\u0131c\u0131ya gönderiliyor";
            const iframe = document.createElement('iframe');
            Object.assign(iframe.style, {
                position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden'
            });
            iframe.src = blobUrl;
            document.body.appendChild(iframe);

            iframe.onload = () => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                    finalize(iframe);
                }, 5000);
            };

        } catch (e) {
            console.error("PDF Overlay Error:", e);

            let htmlMsg = `<div style="text-align:left; font-size:0.95rem;">
                             <b>Adım:</b> ${currentStep}<br>
                             <b>Hata:</b> ${e.message}<br><br>`;

            if (printPath.includes("file://") || printPath.includes("C:") || printPath.includes("D:")) {
                htmlMsg += `<b style="color:#e11d48;">UYARI:</b> Sistemi Vercel gibi bir internet sunucusunda çalıştırırken, bilgisayarınızdaki yerel dosyalara (C:\\ veya D:\\) erişilemez. Güvenlik nedeniyle tarayıcılar buna izin vermez.<br><br>
                 <b>ÇÖZÜM:</b> Soru kağıdı PDF'lerinizi OneDrive, Google Drive veya Supabase gibi bir buluta yükleyip <b>'Herkesin görebileceği' bir internet linkini (https://...)</b> buraya yapıştırmalısınız. Veya dosyaları Vercel deponuza (GitHub'a) yükleyip göreceli yol (Örn: <code>/pdf/sinav.pdf</code>) yazmalısınız.`;
            } else {
                htmlMsg += `<small><i>Dosya yolu hatalı olabilir veya internetten çektiğiniz linkin (CORS) indirme izni yoktur.</i></small>`;
            }
            htmlMsg += `</div>`;

            Swal.fire({
                title: 'Dosya Okuma uyarısı',
                html: htmlMsg,
                icon: 'warning',
                width: 600
            });

            console.warn("Attempting fallback print mechanism...");
        }

        // Fallback or Original Print
        const iframe = document.createElement('iframe');
        iframe.src = printPath;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        let fallbackResolved = false;

        iframe.onload = () => {
            if (fallbackResolved) return; fallbackResolved = true;
            try {
                iframe.contentWindow.print();
            } catch (err) {
                console.warn("Iframe Print failed, attempting window.open...", err);
                try {
                    window.open(printPath, '_blank');
                } catch (windowErr) {
                    console.error("Window open fallback also failed", windowErr);
                }
            }
            setTimeout(() => finalize(iframe), 3000);
        };

        iframe.onerror = () => {
            if (fallbackResolved) return; fallbackResolved = true;
            console.error("Iframe failed to load.");
            finalize(iframe);
        };

        // Safety timeout in case both fail to fire
        setTimeout(() => {
            if (!fallbackResolved) {
                fallbackResolved = true;
                console.error("Iframe load timed out.");
                finalize(iframe);
            }
        }, 6000);
    };

    // ─── Toplu Soru Kağıdı ZIP İhracı ───────────────────────────────────────────
    window.exportBatchPDFs = async function (session, mode, filterValue) {
        try {
            if (typeof JSZip === 'undefined') {
                Swal.fire('Hata', 'JSZip kütüphanesi yüklenemedi. Lütfen sayfayı ctrl+f5 ile yenileyin.', 'error');
                return;
            }

            const metadata = session.subjectMetadata || {};

            // Extract flat list of students from session.results (which is an array of Rooms)
            let allStudentsInSession = [];
            (session.results || []).forEach(room => {

                let ctr = 1;
                const seatToNum = {};
                for (let g = 1; g <= room.groups; g++) {
                    const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                    for (let r = 1; r <= cf.rows; r++) {
                        for (let c = 1; c <= cf.cols; c++) {
                            const sid = `G${g}-S${r}-C${c}`;
                            if (!(room.disabledSeats || []).includes(sid)) {
                                seatToNum[sid] = ctr++;
                            }
                        }
                    }
                }

                Object.keys(room.seats || {}).forEach(seatId => {
                    const std = room.seats[seatId];
                    if (std) {
                        allStudentsInSession.push({
                            ...std,
                            room: room.name,
                            seatNum: seatToNum[seatId] || '-'
                        });
                    }
                });
            });

            const studentsToExport = allStudentsInSession.filter(s => {
                if (!filterValue) return true;
                if (mode === 'class') return s.class === filterValue;
                if (mode === 'room') return s.room === filterValue;
                return true;
            });

            if (studentsToExport.length === 0) return;

            let validStudents = [];
            let errors = new Set();

            studentsToExport.forEach(s => {
                const subName = s._matchedSubject || '-';
                const group = s._groupLabel || s.group || 'default';
                const meta = metadata[subName] || {};
                const papers = meta.papers || {};

                let path = '';
                if (typeof papers === 'string') path = papers;
                else path = papers[group] || papers['default'] || '';

                if (path) {
                    validStudents.push({
                        path: path,
                        info: {
                            no: s.no,
                            name: s.name,
                            class: s.class,
                            room: s.room,
                            seat: s.seatNum || '-',
                            subject: subName,
                            group: group,
                            examNo: meta.examNo || meta.examNumber || ''
                        }
                    });
                } else {
                    errors.add(subName);
                }
            });

            if (errors.size > 0) {
                Swal.fire({
                    title: 'Eksik Soru Kağıdı Adresi',
                    html: `Şu dersler atlanacak (Soru kağıdı ayarlanmamış):<br><br><b>${[...errors].join('<br>')}</b>`,
                    icon: 'warning',
                    toast: true,
                    position: 'top-end',
                    timer: 5000
                });
            }

            if (validStudents.length === 0) {
                Swal.fire('Hata', 'Dışa aktarılacak geçerli soru kağıdı bulunamadı!', 'error');
                return;
            }

            const zip = new JSZip();
            const school = DataManager.getSchoolSettings();

            // Prepare fonts
            if (!window._cachedFonts) window._cachedFonts = {};
            const fetchOrGet = async (key, urls) => {
                if (!window._cachedFonts[key]) {
                    for (const url of urls) {
                        try {
                            const bytes = await window.getFileBytes(url);
                            if (bytes && bytes.byteLength > 1000) { window._cachedFonts[key] = bytes; break; }
                        } catch (e) {
                            console.warn("Font fetch err for:", key, e);
                        }
                    }
                }
            };

            // Initialize combined PDF document for immediate printing
            let combinedPdfDoc = null;
            if (typeof PDFLib !== 'undefined') {
                combinedPdfDoc = await PDFLib.PDFDocument.create();
            }

            Swal.fire({
                title: 'Soru Kağıtları Hazırlanıyor',
                html: `Fontlar yükleniyor...`,
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading() }
            });

            await fetchOrGet('main', ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf']);
            await fetchOrGet('nameFont', ['fonts/MonotypeCorsiva.ttf']);
            await fetchOrGet('schoolFont', ['fonts/SnapITC.ttf']);

            const sessDom = window.currentRenderedSession || {};
            let termDom = '';
            try { const el = document.getElementById('academicTerm'); if (el) termDom = el.value; } catch (e) { }

            let successCount = 0;
            let lastError = null;
            let hadLocalFileError = false;

            // Process each student
            for (let i = 0; i < validStudents.length; i++) {
                const req = validStudents[i];
                Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name}</small>` });

                try {
                    let printPath = req.path;
                    if (printPath.match(/^[a-zA-Z]:\\/) || printPath.match(/^[a-zA-Z]:\//)) {
                        printPath = 'file:///' + printPath.replace(/\\/g, '/');
                    }
                    if (printPath.includes("file://") || printPath.includes("C:") || printPath.includes("D:")) {
                        hadLocalFileError = true;
                    }

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - PDF İndiriliyor...</small>` });
                    const pdfBytes = await window.getFileBytes(printPath);
                    if (typeof PDFLib === 'undefined') continue;

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - PDFLib Yükleniyor...</small>` });
                    const { PDFDocument, rgb } = PDFLib;
                    const pdfDoc = await PDFDocument.load(pdfBytes);
                    if (typeof fontkit !== 'undefined') pdfDoc.registerFontkit(fontkit);

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - Fontlar Gömülüyor...</small>` });
                    let mainFont = null, nameFont = null, schoolFont = null;
                    if (window._cachedFonts.main) mainFont = await pdfDoc.embedFont(window._cachedFonts.main);
                    if (window._cachedFonts.nameFont) nameFont = await pdfDoc.embedFont(window._cachedFonts.nameFont);
                    if (window._cachedFonts.schoolFont) schoolFont = await pdfDoc.embedFont(window._cachedFonts.schoolFont);

                    const fallbackPdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
                    const customFont = mainFont ? mainFont : null;
                    mainFont = mainFont || fallbackPdfFont;
                    nameFont = nameFont || mainFont;
                    schoolFont = schoolFont || mainFont;

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - Düzenleniyor...</small>` });
                    const pages = pdfDoc.getPages();
                    for (let pg = 0; pg < (pages.length > 0 ? 1 : 0); pg++) { // Only Page 1
                        const page = pages[pg];
                        const { width, height } = page.getSize();

                        const cleanTurkishChars = (text) => {
                            if (!text) return '';
                            if (customFont) return text;
                            return text.replace(/\u0130/g, 'I').replace(/\u0131/g, 'i')
                                .replace(/\u011e/g, 'G').replace(/\u011f/g, 'g').replace(/\u015e/g, 'S').replace(/\u015f/g, 's')
                                .replace(/\u00c7/g, 'C').replace(/\u00e7/g, 'c').replace(/\u00d6/g, 'O').replace(/\u00f6/g, 'o')
                                .replace(/\u00dc/g, 'U').replace(/\u00fc/g, 'u');
                        };
                        const drawCenterText = (str, cx, cy, cw, ch, sz, fnt) => {
                            if (!str) return;
                            const cl = cleanTurkishChars(str).toString();
                            const tw = fnt ? fnt.widthOfTextAtSize(cl, sz) : cl.length * (sz * 0.6);
                            const tx = cx + Math.max(0, (cw - tw) / 2);
                            const ty = cy + (ch / 2) - (sz * 0.35);
                            page.drawText(cl, { x: tx, y: ty, size: sz, font: fnt || undefined, color: rgb(0, 0, 0) });
                        };
                        const drawLeftText = (str, cx, cy, cw, ch, sz, fnt) => {
                            if (!str) return;
                            const cl = cleanTurkishChars(str).toString();
                            const tx = cx + 5;
                            const ty = cy + (ch / 2) - (sz * 0.35);
                            page.drawText(cl, { x: tx, y: ty, size: sz, font: fnt || undefined, color: rgb(0, 0, 0) });
                        };

                        const margin = 14.17; const limitY = 85.04; const outerStroke = 1.6; const strokeOffset = outerStroke / 2 + 1;
                        const ox = margin + strokeOffset; const oy = height - limitY + strokeOffset;
                        const ow = width - (margin * 2) - (strokeOffset * 2); const oh = limitY - margin - (strokeOffset * 2);
                        const gap = 2; const ix = ox + gap; const iy = oy + gap; const iw = ow - (gap * 2); const ih = oh - (gap * 2);
                        const leftW = 65; const rightW = 85; const midW = iw - leftW - rightW;
                        const row3H = 25; const row2H = 19; const row1H = ih - row3H - row2H;
                        const midCol2W = 30; const midCol4W = 30; const midCol5W = 75; const midCol6W = 30;
                        const midCol3W = midW - midCol2W - midCol4W - midCol5W - midCol6W;

                        const gradTopY = iy + row3H + row2H;
                        const strips = [{ c: 0.82, h: 4 }, { c: 0.94, h: 4 }, { c: 1.0, h: row1H - 15 }, { c: 0.94, h: 4 }, { c: 0.82, h: 3 }];
                        let curStripY = gradTopY;
                        for (let s of strips) { page.drawRectangle({ x: ix + leftW, y: curStripY, width: midW, height: s.h, color: rgb(s.c, s.c, s.c) }); curStripY += s.h; }
                        page.drawRectangle({ x: ix + leftW + midCol2W, y: iy, width: midCol3W, height: row3H, color: rgb(0.96, 0.96, 0.96) });
                        page.drawRectangle({ x: ix + leftW + midCol2W + midCol3W, y: iy, width: midW - (midCol2W + midCol3W), height: row3H, color: rgb(0.88, 0.88, 0.88) });

                        page.drawLine({ start: { x: ix + leftW, y: iy }, end: { x: ix + leftW, y: iy + ih }, thickness: 0.75 });
                        page.drawLine({ start: { x: ix + leftW + midW, y: iy }, end: { x: ix + leftW + midW, y: iy + ih }, thickness: 0.75 });
                        let curX = ix + leftW + midCol2W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); curX += midCol3W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); curX += midCol4W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); curX += midCol5W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 });
                        page.drawLine({ start: { x: ix + leftW, y: iy + row3H + row2H }, end: { x: ix + leftW + midW, y: iy + row3H + row2H }, thickness: 0.75 });
                        page.drawLine({ start: { x: ix, y: iy + row3H }, end: { x: ix + leftW + midW, y: iy + row3H }, thickness: 0.75 });

                        const drawExplicitOppositeFrame = (x, y, w, h, r, thickness) => {
                            page.drawLine({ start: { x: x + r, y: y + h }, end: { x: x + w, y: y + h }, thickness });
                            page.drawLine({ start: { x: x + w, y: y + h }, end: { x: x + w, y: y + r }, thickness });
                            page.drawLine({ start: { x: x + w - r, y: y }, end: { x: x, y: y }, thickness });
                            page.drawLine({ start: { x: x, y: y }, end: { x: x, y: y + h - r }, thickness });
                            const segments = 12;
                            for (let j = 0; j < segments; j++) {
                                const a1 = Math.PI / 2 + (Math.PI / 2) * (j / segments); const a2 = Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                                page.drawLine({ start: { x: x + r + r * Math.cos(a1), y: y + h - r + r * Math.sin(a1) }, end: { x: x + r + r * Math.cos(a2), y: y + h - r + r * Math.sin(a2) }, thickness });
                            }
                            for (let j = 0; j < segments; j++) {
                                const a1 = -Math.PI / 2 + (Math.PI / 2) * (j / segments); const a2 = -Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                                page.drawLine({ start: { x: x + w - r + r * Math.cos(a1), y: y + r + r * Math.sin(a1) }, end: { x: x + w - r + r * Math.cos(a2), y: y + r + r * Math.sin(a2) }, thickness });
                            }
                        };
                        drawExplicitOppositeFrame(ox, oy, ow, oh, 6, 1.5);
                        drawExplicitOppositeFrame(ix, iy, iw, ih, 4, 0.5);

                        let sName = (school.name || '').replace(/i/g, 'İ').toUpperCase().split('').join(' ');
                        drawCenterText(sName, ix + leftW, iy + row3H + row2H, midW, row1H, 11, schoolFont);

                        let termStr = (sessDom.academicTerm || termDom || '').toUpperCase();
                        if (termStr === '1. DÖNEM' || termStr === '1 DÖNEM' || termStr === '1. DONEM') termStr = 'I. DÖNEM';
                        else if (termStr === '2. DÖNEM' || termStr === '2 DÖNEM' || termStr === '2. DONEM') termStr = 'II. DÖNEM';
                        else termStr = termStr.replace('1.', '1.').replace('2.', '2.');
                        if (termStr && !termStr.includes('DÖNEM') && !termStr.includes('DONEM')) termStr += ' DÖNEM';

                        const examNoStr = req.info.examNo || '';
                        const examText = `${school.academicYear || ''} ÖĞRETİM YILI ${termStr} ${req.info.subject || ''} DERSİ ${examNoStr ? `${examNoStr}. ` : ''}YAZILI SINAVI`.trim().toUpperCase();

                        let row2Sz = 14;
                        let examTextWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(examText), row2Sz) : examText.length * (row2Sz * 0.6);
                        while (examTextWidth > (midW - 10) && row2Sz > 5) {
                            row2Sz -= 0.5; examTextWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(examText), row2Sz) : examText.length * (row2Sz * 0.6);
                        }
                        drawCenterText(examText, ix + leftW, iy + row3H, midW, row2H, row2Sz, mainFont);

                        drawCenterText(req.info.class, ix, iy, leftW, row3H, 16, mainFont);
                        drawCenterText(req.info.no, ix + leftW, iy, midCol2W, row3H, 12, mainFont);

                        let nameStr = req.info.name.replace(/i/g, 'İ').toUpperCase();
                        let nameSz = 28;
                        let nameWidth = nameFont ? nameFont.widthOfTextAtSize(cleanTurkishChars(nameStr), nameSz) : nameStr.length * (nameSz * 0.5);
                        while (nameWidth > (midCol3W - 15) && nameSz > 8) {
                            nameSz -= 0.5; nameWidth = nameFont ? nameFont.widthOfTextAtSize(cleanTurkishChars(nameStr), nameSz) : nameStr.length * (nameSz * 0.5);
                        }
                        if (nameSz > 24) nameSz = 24;
                        drawLeftText(nameStr, ix + leftW + midCol2W, iy, midCol3W, row3H, nameSz, nameFont);
                        drawLeftText(nameStr, ix + leftW + midCol2W + 0.3, iy, midCol3W, row3H, nameSz, nameFont);
                        drawLeftText(nameStr, ix + leftW + midCol2W + 0.6, iy, midCol3W, row3H, nameSz, nameFont);

                        page.drawText("DERSLİK", { x: ix + leftW + midCol2W + midCol3W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                        page.drawText("SINAV", { x: ix + leftW + midCol2W + midCol3W + midCol4W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                        page.drawText("YER", { x: ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });

                        drawCenterText(req.info.room, ix + leftW + midCol2W + midCol3W, iy - 2.5, midCol4W, row3H, 11, mainFont);
                        drawCenterText((req.info.subject || '').toUpperCase(), ix + leftW + midCol2W + midCol3W + midCol4W, iy - 2.5, midCol5W, row3H, 9.5, mainFont);
                        drawCenterText(req.info.seat, ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W, iy - 2.5, midCol6W, row3H, 14, mainFont);
                        page.drawText("PUAN", { x: ix + leftW + midW + 5, y: iy + ih - 10, size: 7, font: mainFont, color: rgb(0.5, 0.5, 0.5) });

                        // 5. LOGO
                        if (school.logo) {
                            try {
                                const logoBytes = await window.getFileBytes(school.logo);
                                let logoImage;
                                if (school.logo.includes('image/png') || school.logo.toLowerCase().endsWith('.png')) logoImage = await pdfDoc.embedPng(logoBytes);
                                else logoImage = await pdfDoc.embedJpg(logoBytes);
                                const logoDim = 26; const lx = ix + (leftW - logoDim) / 2; const ly = iy + row3H + (row2H + row1H - logoDim) / 2;
                                page.drawImage(logoImage, { x: lx, y: ly, width: logoDim, height: logoDim });
                            } catch (e) { }
                        }
                    }

                    const outBytes = await pdfDoc.save();
                    const fileName = `${req.info.class} ${req.info.no} ${req.info.name}.pdf`.replace(/[\/\\]/g, '-');
                    zip.file(fileName, outBytes);
                    successCount++;

                    // Add to combined document for immediate printing
                    if (combinedPdfDoc) {
                        const copiedPages = await combinedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
                        copiedPages.forEach((page) => combinedPdfDoc.addPage(page));

                        // DEUBL-SIDED PRINTING FIX: If odd pages, add a blank page so next student starts on a new sheet
                        if (copiedPages.length % 2 !== 0) {
                            combinedPdfDoc.addPage();
                        }
                    }

                } catch (e) {
                    console.error("Batch PDF err:", req.info.name, e);
                    lastError = e;
                }
            }

            if (successCount === 0) {
                let errorHtml = `<div style="text-align:left; font-size:0.95rem;">`;
                if (hadLocalFileError) {
                    errorHtml += `<b style="color:#e11d48;">UYARI:</b> Sistemi Vercel gibi bir internet sunucusunda çalıştırırken, bilgisayarınızdaki yerel dosyalara (C:\\ veya D:\\ vb.) erişilemez. Tarayıcı internet üzerindeki bir sitenin sizin yerel diskinize sızmasını engeller.<br><br>
                 <b>ÇÖZÜM:</b> Soru kağıdı PDF'lerinizi OneDrive, Google Drive veya Supabase depolama sistemine yükleyip, herkesin erişebileceği (https:// ile başlayan) linkleri ayarlardaki Soru Kağıdı bölümüne yapıştırmalısınız.`;
                } else {
                    errorHtml += `Hiçbir soru kağıdı indirilemedi. Dosya yolu hatalı, internet linkiniz kopuk veya (CORS) indirme izni ayarlanmamış olabilir.<br><br><b>Detay:</b> ${lastError ? lastError.message : 'Bilinmeyen Hata'}`;
                }
                errorHtml += `</div>`;

                Swal.fire({
                    title: 'Soru Kağıtları İndirilemedi',
                    html: errorHtml,
                    icon: 'error',
                    width: 600
                });
                return;
            }

            Swal.update({ html: `ZIP Dosyası Sıkıştırılıyor... Lütfen Bekleyin.` });
            try {
                const content = await zip.generateAsync({ type: "blob" });
                let modeSuffix = '';
                if (filterValue) {
                    if (mode === 'class') modeSuffix = ' Sınıfı';
                    if (mode === 'room') modeSuffix = ' Salonu';
                }
                const finalName = filterValue ? `Soru_Kagitlari_${filterValue.replace(/[\/\\]/g, '-')}${modeSuffix}.zip` : `Soru_Kagitlari_Tumu.zip`;

                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = finalName;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => document.body.removeChild(link), 100);

                let successMsg = `${successCount} adet soru kağıdı '${finalName}' olarak indirildi. Yazdırılıyor...`;
                if (successCount < validStudents.length) {
                    successMsg += `<br><br><small style="color:#e11d48;">Dikkat: ${validStudents.length - successCount} adet kağıt bağlantı hatası nedeniyle atlandı.</small>`;
                }

                Swal.fire({
                    title: 'Başarılı!',
                    html: successMsg,
                    icon: 'success',
                    timer: 4000,
                    showConfirmButton: false
                });

                // Trigger direct print of the combined PDF
                if (combinedPdfDoc && combinedPdfDoc.getPageCount() > 0) {
                    const combinedBytes = await combinedPdfDoc.save();
                    const sumBlob = new Blob([combinedBytes], { type: 'application/pdf' });
                    const sumUrl = URL.createObjectURL(sumBlob);

                    const printFrame = document.createElement('iframe');
                    Object.assign(printFrame.style, {
                        position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden'
                    });
                    printFrame.src = sumUrl;
                    document.body.appendChild(printFrame);

                    printFrame.onload = () => {
                        printFrame.contentWindow.focus();
                        printFrame.contentWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(sumUrl);
                            if (document.body.contains(printFrame)) document.body.removeChild(printFrame);
                        }, 5000); // Wait long enough for print dialog
                    };
                }

            } catch (globalErr) {
                console.error("Global JSZip err:", globalErr);
                Swal.fire({
                    title: 'Kritik İhracat Hatası',
                    html: `Toplu indirme işleminde beklenmeyen bir hata oluştu:<br><br><b>${globalErr.message}</b><br><br><small>Tarayıcı konsolunu kontrol edin.</small>`,
                    icon: 'error'
                });
            }
        } catch (setupErr) {
            console.error(setupErr);
            Swal.fire('Hata', setupErr.message, 'error');
        }
    };

    // ─── Oturumu Yazdır ────────────────────────────────────────────────────────
    window.printSessionDistribution = async function (id, filterValue = null) {
        const session = DataManager.getExamSessions().find(s => s.id === id);
        if (!session || !session.results) {
            Swal.fire('Bilgi', 'Bu oturum için dağıtım henüz yapılmamış.', 'info');
            return;
        }

        // Seçili modu DOM'dan oku
        const modeEl = document.querySelector(`input[name="mode-${id}"]:checked`);
        const mode = modeEl ? modeEl.value : 'class';

        // SESSION-WIDE BATCH PRINT DETECTION
        const sessionPaperCb = document.querySelector(`.session-paper-check[data-id="${id}"]`);
        const isSessionWideBatch = !filterValue && sessionPaperCb && sessionPaperCb.checked;

        if (isSessionWideBatch) {
            // 1. Get List of Groups
            let groups = [];
            if (mode === 'class') {
                const classSet = new Set();
                session.results.forEach(r => Object.values(r.seats || {}).forEach(s => classSet.add(s.class)));
                groups = Array.from(classSet).sort(sortByNum);
            } else if (mode === 'room') {
                groups = session.results.map(r => r.name).sort(sortByNum);
            }

            if (groups.length === 0) {
                Swal.fire('Hata', 'Yazdırılacak grup (Sınıf/Salon) bulunamadı.', 'error');
                return;
            }

            // 2. Ask for Mode
            const result = await Swal.fire({
                title: 'Toplu Yazdırma Başlatılsın mı?',
                html: `<b>${groups.length}</b> adet ${mode === 'class' ? 'sınıf' : 'salon'} grubu sırayla yazdırılacak.<br><br>Yazdırma yöntemini seçin:`,
                icon: 'question',
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: 'Sürekli (Otomatik)',
                denyButtonText: 'Duraklamalı (Onaylı)',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#4f46e5',
                denyButtonColor: '#6366f1'
            });

            if (result.isDismissed) return;

            const isPaused = result.isDenied;

            // 3. Process Each Group
            for (let i = 0; i < groups.length; i++) {
                const groupName = groups[i];

                if (isPaused) {
                    const confirmNext = await Swal.fire({
                        title: `Sıradaki: ${groupName}`,
                        text: `${i + 1} / ${groups.length}. grup yazdırılsın mı?`,
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Devam Et',
                        cancelButtonText: 'Durdur'
                    });
                    if (!confirmNext.isConfirmed) break;
                } else {
                    // Small toast for continuous progress
                    Swal.fire({
                        title: 'Toplu Yazdırma',
                        html: `Sıradaki: <b>${groupName}</b> (${i + 1} / ${groups.length})`,
                        timer: 1500,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                    await new Promise(r => setTimeout(r, 1500)); // Delay for browser stability
                }

                // Call self for individual group
                await window.printSessionDistribution(id, groupName);
            }
            return; // Exit session-wide flow
        }

        // BATCH EXPORT INTERCEPT
        let isBulkExportChecked = false;
        if (filterValue) {
            // Sınıf veya Salon yanındaki yazdır butonuna basıldığında
            const cbClass = document.querySelector(`.class-paper-check[data-class="${filterValue}"]`);
            const cbRoom = document.querySelector(`.room-paper-check[data-room="${filterValue}"]`);
            if (cbClass && cbClass.checked) isBulkExportChecked = true;
            if (cbRoom && cbRoom.checked) isBulkExportChecked = true;
        }

        if (isBulkExportChecked) {

            // QUICK VALIDATION: Ensure at least one paper exists before proceeding with anything
            let hasValidPaper = false;
            const metadata = session.subjectMetadata || {};
            let allStudentsInSession = [];
            (session.results || []).forEach(room => Object.values(room.seats || {}).forEach(s => allStudentsInSession.push({ ...s, room: room.name })));

            const targetStudents = allStudentsInSession.filter(s => {
                if (!filterValue) return true;
                if (mode === 'class') return s.class === filterValue;
                if (mode === 'room') return s.room === filterValue;
                return true;
            });

            targetStudents.forEach(s => {
                const subName = s._matchedSubject || '-';
                const group = s._groupLabel || s.group || 'default';
                const papers = (metadata[subName] || {}).papers || {};
                let path = typeof papers === 'string' ? papers : (papers[group] || papers['default'] || '');
                if (path) hasValidPaper = true;
            });

            if (!hasValidPaper) {
                Swal.fire({
                    title: 'Eksik Soru Kağıdı Adresi',
                    html: `Bu listedeki sınavlar için soru kağıdı adresi girilmemiş veya dizin bulunamadı!<br><br>Lütfen <b>Oturum Düzenle</b> kısmından Soru Kağıtlarını veya PDF yollarını tanımlayın.`,
                    icon: 'error'
                });
                return; // ABORT THE WHOLE PRINT ACTION
            }

            // Initiate the background zip export with a slight delay so normal print popup isn't blocked by Swal
            setTimeout(() => {
                window.exportBatchPDFs(session, mode, filterValue);
            }, 100);
            // Continue to print the class/room list as requested by user.
        }

        const modeLabels = { class: 'Sınıf', room: 'Salon', seating: 'Şema' };
        const modeLabel = modeLabels[mode];
        const isSeating = mode === 'seating';

        // ─────── SORU KAĞIDI YAZDIRMA (INTERCEPT) ───────────────────────────
        // Eğer öğrenci checkboxları seçiliyse listeyi değil, kağıtları yazdır/aç. (Batch export harici manuel seçimler)
        const checkedStudents = Array.from(document.querySelectorAll('.student-paper-check:checked')).filter(cb => {
            if (!filterValue) return true; // Genel liste, hepsini al
            const currentMode = modeEl ? modeEl.value : 'class';
            if (currentMode === 'class') return cb.dataset.class === filterValue;
            if (currentMode === 'room') return cb.dataset.room === filterValue;
            return true;
        });

        if (checkedStudents.length > 0 && !isBulkExportChecked) {
            const metadata = session.subjectMetadata || {};
            let foundCount = 0;
            let errors = [];

            checkedStudents.forEach(cb => {
                const subName = cb.dataset.sub;
                const group = cb.dataset.group || 'default';
                const meta = metadata[subName] || {};
                const papers = meta.papers || {};

                let path = '';
                if (typeof papers === 'string') path = papers;
                else path = papers[group] || papers['default'] || '';

                if (path) {
                    const studentInfo = {
                        no: cb.dataset.studentNo,
                        name: cb.dataset.studentName,
                        class: cb.dataset.class,
                        room: cb.dataset.room,
                        seat: cb.dataset.seat || '-',
                        subject: subName,
                        group: group,
                        examNo: meta.examNo || meta.examNumber || ''
                    };

                    window.printFile(path, studentInfo);
                    foundCount++;
                } else {
                    errors.push(subName);
                }
            });

            if (errors.length > 0) {
                const uniqueErrors = [...new Set(errors)];
                Swal.fire({
                    title: 'Soru Kağıdı Hatası',
                    html: `Aşağıdaki dersler için soru kağıdı adresi yok ya da yanlış:<br><br><b>${uniqueErrors.join('<br>')}</b>`,
                    icon: 'error'
                });
            }
            if (errors.length > 0 || foundCount > 0) return; // Liste yazdırmayı durdur
        }

        // Filtre varsa direkt yazdır, yoksa onay al
        const startPrint = (isPreview = false) => {
            // ── Sayfa CSS ──────────────────────────────────────────────────
            const pageCss = `
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 0; padding: 0; background: #fff; }
                @page { ${isSeating ? 'size: A4 landscape;' : 'size: A4 portrait;'} margin: 0; }
                
                .page { 
                    width: ${isSeating ? '297mm' : '210mm'}; 
                    height: ${isSeating ? '210mm' : '297mm'}; 
                    padding: 12mm; 
                    box-sizing: border-box; 
                    page-break-after: always; 
                    display: flex; 
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                }
                .page:last-child { page-break-after: avoid; }

                .page-header { 
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 2px solid #6366f1; margin-bottom: 15px; padding-bottom: 8px;
                }
                .page-header h2 { margin: 0; font-size: 18pt; color: #4f46e5; font-weight: 900; }
                .page-header .info { text-align: right; font-size: 10pt; color: #1e293b; font-weight: 600; }

                table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
                th { background: #f8fafc; padding: 5px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; font-size: 8.5pt; }
                td { padding: 0 6px; border: 1px solid #e2e8f0; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; height: 13pt; font-size: 8.2pt; }
                tr:nth-child(even) td { background: #fcfcfc; }

                .msg-box {
                    margin-top: auto; padding: 12px 15px; border: 2px solid #6366f1; border-radius: 10px;
                    background: #f5f7ff; color: #1e293b; font-size: 9.5pt; line-height: 1.5;
                }
                .msg-box strong { color: #4f46e5; display: flex; align-items: center; margin-bottom: 6px; font-size: 1.1em; }
                .msg-box .icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #ef4444; color: white; border-radius: 50%; margin-right: 10px; font-size: 14px; }

                /* Seating schema centering */
                .schema-container { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 10px; overflow: hidden; }
                .classroom-walls { 
                    border: 4px solid #334155; padding: 35px; border-radius: 24px; background: #fff;
                    display: inline-block; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,0.08);
                    transform-origin: center;
                }
                .front-side { display: flex; justify-content: space-around; align-items: flex-start; margin-top: 40px; width: 100%; border-top: 3px solid #334155; padding-top: 20px; }
                .teacher-desk { 
                    width: 130px; height: 70px; border: 3px solid #475569; background: #f1f5f9;
                    display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: bold; color: #1e293b;
                    border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .board { 
                    background: #0f172a; color: white; padding: 12px 70px; border-radius: 6px; font-size: 11pt;
                    font-weight: bold; letter-spacing: 4px; border: 4px solid #475569; box-shadow: 0 6px 12px rgba(0,0,0,0.2);
                }
                .groups-row { display: flex; gap: 50px; justify-content: center; flex-wrap: wrap; }
                .desk-group { display: grid; gap: 8px; padding: 12px; border: 1.5px dashed #cbd5e1; border-radius: 10px; background: #fafafa; }
                .desk { width: 95px; height: 80px; border: 1.8px solid #6366f1; border-radius: 8px;
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        font-size: 8pt; text-align: center; background: white; padding: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);
                        position: relative; overflow: visible; }
                .desk.empty { border: 1.8px dashed #ef4444; color: #ef4444; background: #fff5f5; font-weight: bold; }
                .desk-num { width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; border: 1px solid #cbd5e1; color: #1e293b; font-size: 10pt; font-weight: 900; 
                           display: flex; align-items: center; justify-content: center; 
                           position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); background: white; z-index: 10;
                           box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            `;

            const formatDate = (d) => {
                if (!d) return '';
                const parts = d.split('-');
                return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
            };

            const hdr = (title) => `
                <div class="page-header">
                    <h2>${title}</h2>
                    <div class="info">
                        <div>${session.name}</div>
                        <div style="font-size: 9pt; color: #64748b; font-weight: 400;">
                            ${formatDate(session.date)} ${session.time || ''}
                        </div>
                    </div>
                </div>`;

            const abbr = (n) => {
                if (!n || n === '-') return n;
                return n.replace(/Matematik/gi, 'Mat.').replace(/Edebiyat/gi, 'Edb.').replace(/İngilizce/gi, 'İng.').replace(/Fizik/gi, 'Fiz.').replace(/Kimya/gi, 'Kim.').replace(/Biyoloji/gi, 'Biyo.').replace(/Tarih/gi, 'Tar.').replace(/Coğrafya/gi, 'Coğ.').replace(/Felsefe/gi, 'Fel.').replace(/Din Kültürü/gi, 'Din.').replace(/Almanca/gi, 'Alm.').replace(/Görsel Sanatlar/gi, 'Grs.').replace(/Müzik/gi, 'Müz.').replace(/Beden Eğitimi/gi, 'Bed.').replace(/Bilişim/gi, 'Biliş.');
            };

            let body = '';

            // ─────── SINIF MODU ───────────────────────────────────────────
            if (mode === 'class') {
                const flatList = [];
                session.results.forEach(room => {
                    let ctr = 1; const seatToNum = {};
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        for (let r = 1; r <= cf.rows; r++)
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                if (!(room.disabledSeats || []).includes(sid)) seatToNum[sid] = ctr++;
                            }
                    }
                    Object.entries(room.seats).forEach(([sid, std]) =>
                        flatList.push({ ...std, room: room.name, seatNum: seatToNum[sid] || '-' }));
                });
                const byClass = {};
                flatList.forEach(s => {
                    if (filterValue && s.class !== filterValue) return;
                    (byClass[s.class] = byClass[s.class] || []).push(s);
                });

                const sorted = Object.keys(byClass).sort(sortByNum);
                const studentMsg = (session.studentMsg || '').trim();

                sorted.forEach(cls => {
                    const students = byClass[cls].sort((a, b) => parseInt(a.no) - parseInt(b.no));
                    const PAGE_SIZE = 50;
                    for (let p = 0; p < students.length; p += PAGE_SIZE) {
                        const chunk = students.slice(p, p + PAGE_SIZE);
                        const pageNum = Math.floor(p / PAGE_SIZE) + 1;
                        const totalPages = Math.ceil(students.length / PAGE_SIZE);

                        const rows = chunk.map(s => {
                            const meta = (session.subjectMetadata || {})[s._matchedSubject] || {};
                            const examNo = meta.examNo || meta.examNumber || '';
                            const eNum = examNo ? ` <small>(${examNo})</small>` : '';


                            return `<tr>
                                <td style="width:10%;"><b>${s.no}</b></td>
                                <td style="width:40%;">${s.name}</td>
                                <td style="width:30%;">${s._matchedSubject || '-'}${eNum}</td>
                                <td style="width:12%;">${s.room}</td>
                                <td style="width:8%; text-align:center;"><b>${s.seatNum}</b></td></tr>`;
                        }).join('');

                        body += `<div class="page">
                            ${hdr(`${cls} Sınıf Listesi ${totalPages > 1 ? `(Sayfa ${pageNum}/${totalPages})` : ''}`)}
                            <table>
                                <thead><tr>
                                    <th style="width:10%;">No</th><th style="width:40%;">Ad Soyad</th>
                                    <th style="width:30%;">Sınav Dersi</th><th style="width:12%;">Derslik</th>
                                    <th style="width:8%;">Sıra</th>
                                </tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                            ${(studentMsg && (p + PAGE_SIZE >= students.length)) ? `<div class="msg-box"><strong><span class="icon">!</span> Lütfen Dikkat!!!</strong>${studentMsg}</div>` : ""}
                        </div>`;
                    }
                });

                // ─────── SALON MODU ───────────────────────────────────────────
            } else if (mode === 'room') {
                const sortedRooms = [...session.results].filter(r => !filterValue || r.name === filterValue).sort((a, b) => sortByNum(a.name, b.name));
                sortedRooms.forEach(room => {
                    let ctr = 1; const seatToNum = {};
                    const seatIds = [];
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        for (let r = 1; r <= cf.rows; r++)
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                if (!(room.disabledSeats || []).includes(sid)) { seatToNum[sid] = ctr++; seatIds.push(sid); }
                            }
                    }
                    const sortedSeatIds = seatIds.sort((a, b) => {
                        const pa = a.match(/\d+/g).map(Number), pb = b.match(/\d+/g).map(Number);
                        for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
                        return 0;
                    });
                    const PAGE_SIZE = 50;
                    for (let p = 0; p < sortedSeatIds.length; p += PAGE_SIZE) {
                        const chunk = sortedSeatIds.slice(p, p + PAGE_SIZE);
                        const pageNum = Math.floor(p / PAGE_SIZE) + 1;
                        const totalPages = Math.ceil(sortedSeatIds.length / PAGE_SIZE);

                        const rows = chunk.map(sid => {
                            const s = room.seats[sid];
                            if (s) {
                                return `<tr><td style="text-align:center;"><b>${seatToNum[sid] || '-'}</b></td>
                                    <td>${s.class}</td><td style="text-align:center;"><b>${s.no}</b></td>
                                    <td>${s.name}</td><td>${abbr(s._matchedSubject || '-')}</td>
                                    <td style="border-bottom:1px solid #eee;"></td></tr>`;
                            } else {
                                return `<tr style="color: #64748b; background: #fff5f5;"><td style="text-align:center;"><b>${seatToNum[sid] || '-'}</b></td>
                                    <td colspan="4" style="text-align:center; font-weight: bold; letter-spacing: 2px;">BOŞ BIRAKILDI</td>
                                    <td></td></tr>`;
                            }
                        }).join('');

                        const studentsInRoom = Object.values(room.seats || {});
                        const roomClasses = [...new Set(studentsInRoom.map(s => s.class))].sort(sortByNum);
                        const teacherMsg = (session.teacherMsg || '').trim();

                        let summaryListHtml = ''; let roomTotal = 0;
                        roomClasses.forEach(cls => {
                            const classStudents = studentsInRoom.filter(s => s.class === cls);
                            const classExams = [...new Set(classStudents.map(s => s._matchedSubject || '-'))].sort();
                            classExams.forEach(ex => {
                                const count = classStudents.filter(s => (s._matchedSubject || '-') === ex).length;
                                summaryListHtml += `<div style="padding: 2px 0; border-bottom: 1px dashed #e2e8f0; font-size: 8.5pt;"><b>${cls}</b> ${abbr(ex)} => <b>${count}</b> Öğrenci</div>`;
                                roomTotal += count;
                            });
                        });
                        const examsInRoom = [...new Set(studentsInRoom.map(s => s._matchedSubject || '-'))].sort();
                        let examSummaryRows = examsInRoom.map(ex => {
                            const count = studentsInRoom.filter(s => (s._matchedSubject || '-') === ex).length;
                            return `<tr><td>${ex}</td><td style="text-align:center; font-weight:bold;">${count}</td></tr>`;
                        }).join('');

                        const summaryContent = (p + PAGE_SIZE >= sortedSeatIds.length) ? `
                            <div style="flex-shrink:0; width:45mm; margin-left:10px;">
                                <div style="background:#f8fafc; padding:6px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:10px;">
                                    <div style="font-size:8.5pt; font-weight:900; color:#4f46e5; border-bottom:2px solid #6366f1; padding-bottom:3px; margin-bottom:6px;">DERSLİK ÖZETİ</div>
                                    <div style="line-height:1.2;">${summaryListHtml}<div style="margin-top:5px; padding-top:3px; border-top:2px solid #6366f1; font-weight:900; color:#4f46e5; text-align:right; font-size:8.5pt;">TOPLAM: ${roomTotal}</div></div>
                                </div>
                                <div style="background:#fff7ed; padding:6px; border-radius:10px; border:1px solid #ffedd5;">
                                    <div style="font-size:8.5pt; font-weight:900; color:#c2410c; border-bottom:2px solid #f97316; padding-bottom:3px; margin-bottom:6px;">SINAV TOPLAMLARI</div>
                                    <table style="font-size:7.5pt; border-collapse:collapse; background:white;">
                                        <thead><tr style="background:#fff7ed;"><th style="padding:2px 4px; width:75%;">Sınav</th><th style="padding:2px 4px; width:25%;">Sayı</th></tr></thead>
                                        <tbody>${examSummaryRows}</tbody>
                                    </table>
                                </div>
                            </div>` : '';

                        body += `<div class="page">${hdr(`${room.name} Salonu - Oturma Listesi ${totalPages > 1 ? `(Sayfa ${pageNum}/${totalPages})` : ''}`)}
                            <div style="display:flex; gap:0; align-items:flex-start; flex:1;">
                                <div style="flex:1;">
                                    <table style="table-layout:fixed;">
                                        <thead><tr>
                                            <th style="width:6%;">Sıra</th><th style="width:7%;">Sınıf</th>
                                            <th style="width:7%;">No</th><th style="width:50%;">Ad Soyad</th>
                                            <th style="width:15%;">Sınav</th><th style="width:15%;">Açıklama</th>
                                        </tr></thead>
                                        <tbody>${rows}</tbody>
                                    </table>
                                </div>
                                ${summaryContent}
                            </div>
                            ${(teacherMsg && (p + PAGE_SIZE >= sortedSeatIds.length)) ? `<div class="msg-box" style="border-color:#ca8a04; background:#fffaf0;"><strong><span class="icon" style="background:#ea580c;">!</span> Lütfen Dikkat!!!</strong>${teacherMsg}</div>` : ""}
                        </div>`;
                    }
                });

                // ─────── ŞEMA MODU ────────────────────────────────────────────
            } else {
                session.results.filter(r => !filterValue || r.name === filterValue).forEach(room => {
                    let ctr = 1; const seatToNum = {};
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        for (let r = 1; r <= cf.rows; r++)
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                if (!(room.disabledSeats || []).includes(sid)) seatToNum[sid] = ctr++;
                            }
                    }
                    let groupsHtml = '<div class="groups-row">';
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        groupsHtml += `<div class="desk-group" style="grid-template-columns:repeat(${cf.cols},1fr)">`;
                        for (let r = cf.rows; r >= 1; r--) {
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                const isDisabled = (room.disabledSeats || []).includes(sid);
                                const student = room.seats?.[sid];
                                const num = seatToNum[sid] || '-';
                                let bg = '';
                                if (student) {
                                    const sub = student._matchedSubject || '-';
                                    let hasStrict = false, hasVertical = false;
                                    const neighbors = [{ dr: 0, dc: -1, type: 'h' }, { dr: 0, dc: 1, type: 'h' }, { dr: -1, dc: -1, type: 'd' }, { dr: -1, dc: 1, type: 'd' }, { dr: 1, dc: -1, type: 'd' }, { dr: 1, dc: 1, type: 'd' }, { dr: -1, dc: 0, type: 'v' }, { dr: 1, dc: 0, type: 'v' }];
                                    neighbors.forEach(n => {
                                        const nstd = room.seats[`G${g}-S${r + n.dr}-C${c + n.dc}`];
                                        if (nstd && (nstd._matchedSubject || '-') === sub) { if (n.type === 'v') hasVertical = true; else hasStrict = true; }
                                    });
                                    if (hasStrict) bg = 'background-color:#fee2e2;'; else if (hasVertical) bg = 'background-color:#fef9c3;';
                                }
                                if (isDisabled) { groupsHtml += `<div class="desk" style="opacity:0.3; border-color:#ccc; border-style:dotted;">KAPALI</div>`; }
                                else if (student) {
                                    groupsHtml += `<div class="desk" style="${bg} border:1px solid #cbd5e1; border-radius:6px;">
                                        <div style="font-size:6.5pt;color:#64748b;font-weight:700;border-bottom:0.1pt solid #eee;margin-bottom:2pt;padding-bottom:1pt;width:100%;">${student.class} / ${student.no}</div>
                                        <div style="font-weight:700;font-size:7.5pt;line-height:1.1; color:#0f172a; flex:1; display:flex; align-items:center; justify-content:center;">${student.name}</div>
                                        <div class="desk-num">${num}</div></div>`;
                                } else {
                                    groupsHtml += `<div class="desk empty">
                                            <div style="font-weight:900; font-size:6pt; color:#dc2626; letter-spacing:0.5px; line-height:1.2;">BOŞ<br>BIRAKINIZ</div>
                                            <div class="desk-num" style="background:#fee2e2; color:#ef4444; border-color:#fecaca;">${num}</div></div>`;
                                }
                            }
                        }
                        groupsHtml += '</div>';
                    }
                    groupsHtml += '</div>';
                    body += `<div class="page">${hdr(`${room.name} Salonu - Oturma Şeması`)}
                        <div class="schema-container"><div class="classroom-walls">${groupsHtml}
                            <div class="front-side">${room.teacherDeskPos === 'left' ? `<div class="teacher-desk">ÖĞRETMEN<br>MASASI</div><div class="board">Y A Z I &nbsp; T A H T A S I</div><div style="width:130px;"></div>` : `<div style="width:130px;"></div><div class="board">Y A Z I &nbsp; T A H T A S I</div><div class="teacher-desk">ÖĞRETMEN<br>MASASI</div>`}</div>
                        </div></div></div>`;
                });

                body += `<script>
                    window.addEventListener('load', () => {
                        document.querySelectorAll('.schema-container').forEach(wrap => {
                            const wall = wrap.querySelector('.classroom-walls');
                            if (!wall) return;
                            const scale = Math.min((wrap.clientWidth-20)/wall.offsetWidth, (wrap.clientHeight-20)/wall.offsetHeight);
                            wall.style.transform = "scale(" + Math.min(scale, 1.8) + ")";
                        });
                    });
                </script>`;
            }

            const win = window.open('', '_blank');
            win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${session.name} - ${modeLabel}</title><style>${pageCss}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>{if(!${isPreview}){window.focus();window.print();}},500);</script></body></html>`);
            win.document.close();
        };

        if (filterValue) {
            startPrint(false);
        } else {
            Swal.fire({
                title: 'Yazdır',
                html: `<div style="text-align: left; font-size: 10.5pt; color: #1e293b; line-height: 1.5;">Tüm <b>${modeLabel}</b> listeleri yazdırılacaktır.<br>Onaylıyor musunuz?<div style="margin-top: 15px; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;"><label style="display: flex; align-items: center; cursor: pointer; font-weight: 600;"><input type="checkbox" id="print-view-check" style="width: 17px; height: 17px; margin-right: 8px; cursor: pointer;"> Yazdırmadan önce önizle</label></div></div>`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-print"></i> Evet, Yazdır',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#6366f1',
                preConfirm: () => ({ preview: document.getElementById('print-view-check')?.checked || false })
            }).then(res => { if (res && res.isConfirmed) startPrint(res.value.preview); });
        }
    };



    // ─────── METADATA HELPERS ─────────────────────────────────────
    window.pasteToInput = async function (btn) {
        try {
            let text = await navigator.clipboard.readText();
            if (text) {
                // Clean text: remove only quotes and commas as per user request
                text = text.replace(/[",]/g, '').trim();

                const input = btn.closest('.input-group').querySelector('input');
                if (input) {
                    input.value = text;
                    Swal.showValidationMessage(''); // Clear any previous errors if in Swal
                }
            }
        } catch (err) {
            console.error('Paste failed:', err);
        }
    };

    window.browseToInput = function (btn) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('Selected file:', file);
                const input = btn.closest('.input-group').querySelector('input');
                // Use file.path for local/Electron environments to get absolute path
                if (input) input.value = file.path || file.name;
            }
        };
        fileInput.click();
    };


    window.openSessionMetadataEditor = function (id) {
        const sessions = DataManager.getExamSessions();
        const ses = sessions.find(s => s.id === id);
        if (!ses) return;

        // Extract ALL unique full subject names (e.g., "Matematik 10") present in the results
        const uniqueFullSubjects = new Set();
        if (ses.results) {
            ses.results.forEach(room => {
                Object.values(room.seats || {}).forEach(std => {
                    if (std._matchedSubject) uniqueFullSubjects.add(std._matchedSubject);
                });
            });
        }

        // Falling back to standard subjects if results are empty (unlikely but safe)
        const subjectNames = uniqueFullSubjects.size > 0
            ? Array.from(uniqueFullSubjects).sort()
            : (ses.subjects || []).map(s => typeof s === 'object' ? s.name : s);

        const metadata = ses.subjectMetadata || {};
        const hasGroups = ses.hasGroups;
        const groupCount = ses.groupCount || 2;
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        let subjectsHtml = '';
        subjectNames.forEach((sub, idx) => {
            const data = metadata[sub] || {};
            const subExamNum = data.examNo || data.examNumber || '';
            const subPapers = data.papers || {};



            let paperInputs = '';
            if (hasGroups) {
                for (let i = 0; i < groupCount; i++) {
                    const groupLetter = alphabet[i];
                    paperInputs += `
                        <div style="flex:1; min-width:160px;">
                            <label style="font-size:0.7rem; color:var(--gray-500); display:block;">Grup ${groupLetter} Soru Kağıdı</label>
                            <div class="input-group" style="display:flex; gap:2px;">
                                <input type="text" class="swal2-input meta-paper-input" data-sub="${sub}" data-group="${groupLetter}" style="flex:1; margin:0; height:35px; font-size:0.8rem;" value="${subPapers[groupLetter] || ''}" placeholder="Yol">
                                <button type="button" class="btn btn-light btn-sm" style="height:35px; padding:0 8px;" onclick="window.pasteToInput(this)" title="Panodan Yapıştır"><i class="fa-solid fa-paste"></i></button>
                                <button type="button" class="btn btn-light btn-sm" style="height:35px; padding:0 8px;" onclick="window.browseToInput(this)" title="Dosya Seç"><i class="fa-solid fa-folder-open"></i></button>
                            </div>
                        </div>
`;
                }
            } else {
                paperInputs = `
                    <div style="flex:1;">
                        <label style="font-size:0.7rem; color:var(--gray-500); display:block;">Soru Kağıdı Adresi</label>
                        <div class="input-group" style="display:flex; gap:2px;">
                            <input type="text" class="swal2-input meta-paper-input" data-sub="${sub}" style="flex:1; margin:0; height:35px; font-size:0.8rem;" value="${typeof subPapers === 'string' ? subPapers : (subPapers['default'] || '')}" placeholder="C:\\Yol veya URL">
                            <button type="button" class="btn btn-light btn-sm" style="height:35px; padding:0 8px;" onclick="window.pasteToInput(this)" title="Panodan Yapıştır"><i class="fa-solid fa-paste"></i></button>
                            <button type="button" class="btn btn-light btn-sm" style="height:35px; padding:0 8px;" onclick="window.browseToInput(this)" title="Dosya Seç"><i class="fa-solid fa-folder-open"></i></button>
                        </div>
                    </div>
`;
            }

            subjectsHtml += `
                <div class="meta-subject-row" style="padding: 1rem; border: 1px solid var(--gray-200); border-radius: 8px; margin-bottom: 1rem; background: var(--gray-50);">
                    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem; border-bottom:1px solid var(--gray-200); padding-bottom:0.5rem;">
                        <input type="checkbox" class="meta-sub-check" checked data-sub="${sub}" style="width:18px; height:18px;">
                        <strong style="color:var(--primary); font-size:1rem;">${sub}</strong>
                        <div style="flex:1; display:flex; justify-content:flex-end; align-items:center; gap:0.5rem;">
                            <label style="font-size:0.8rem; font-weight:bold;">Sınav No:</label>
                            <input type="text" class="swal2-input meta-exam-num-input" data-sub="${sub}" style="width:80px; margin:0; height:35px; font-size:0.8rem; text-align:center;" value="${subExamNum}" placeholder="No">
                        </div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                        ${paperInputs}
                    </div>
                    <div style="margin-top:5px; font-size:0.7rem; color:var(--gray-500); font-style:italic;">
                        <i class="fa-solid fa-info-circle"></i> Tarayıcı güvenliği nedeniyle dosya seçildiğinde tam yol otomatik alınamazsa lütfen yolu kopyalayıp <b>Panodan Yapıştır</b> butonunu kullanın.
                    </div>
                </div>
    `;
        });

        Swal.fire({
            title: 'Oturum Detaylı Bilgilerini Düzenle',
            width: '900px',
            html: `
                <div style="text-align: left;">
                    <div style="background: var(--light-primary); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid var(--primary); display:flex; align-items:center; gap:1rem;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--primary); font-size:1.5rem;"></i>
                        <div style="flex:1;">
                            <strong style="display:block; font-size:0.9rem;">Toplu Sınav No Uygula</strong>
                            <small color="var(--gray-600)">Seçili tüm seviyelere aynı sınav numarasını girin.</small>
                        </div>
                        <input type="text" id="bulk-exam-num" class="swal2-input" style="width:100px; margin:0; height:40px;" placeholder="Sınav No">
                        <button type="button" class="btn btn-primary btn-sm" onclick="const val=document.getElementById('bulk-exam-num').value; document.querySelectorAll('.meta-subject-row').forEach(row => { const cb=row.querySelector('.meta-sub-check'); if(cb && cb.checked){ const input=row.querySelector('.meta-exam-num-input'); if(input) input.value=val; } })">Uygula</button>
                    </div>

                    <div style="display:flex; gap:1rem; margin-bottom: 1.5rem; background: #fff; padding: 1rem; border: 1px solid var(--gray-200); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="flex:1;">
                            <label style="display:block; font-weight:700; font-size:0.85rem; margin-bottom:0.5rem; color:var(--gray-700);">Sınav Tarihi</label>
                            <input type="date" id="meta-date" class="swal2-input" style="width:100%; margin:0; height:40px; font-size:0.9rem;" value="${ses.date || ''}">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-weight:700; font-size:0.85rem; margin-bottom:0.5rem; color:var(--gray-700);">Sınav Saati / Ders</label>
                            ${(() => {
                    const school = DataManager.getSchoolSettings();
                    const dailyLessons = parseInt(school.dailyLessons) || 0;
                    if (dailyLessons > 0) {
                        let options = '<option value="">-- Se\u00e7in --</option>';
                        for (let i = 1; i <= dailyLessons; i++) {
                            const val = `${i}. Ders`;
                            options += `<option value="${val}" ${ses.time === val ? 'selected' : ''}>${val}</option>`;
                        }
                        return `<select id="meta-time" class="swal2-input" style="width:100%; margin:0; height:40px; font-size:0.9rem; padding:0 10px;">${options}</select>`;
                    } else {
                        return `<input type="text" id="meta-time" class="swal2-input" style="width:100%; margin:0; height:40px; font-size:0.9rem;" value="${ses.time || ''}" placeholder="10:00">`;
                    }
                })()}
                        </div>
                    </div>

                    <div id="meta-subjects-list" style="max-height: 400px; overflow-y: auto; padding-right:0.5rem;">
                        ${subjectsHtml}
                    </div>

                    <hr style="margin:1.5rem 0; border:0; border-top:1px solid var(--gray-300);">

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display:block; margin-bottom:0.5rem; font-weight:bold;">Öğrenciye Mesaj / Uyarılar</label>
                        <textarea id="meta-std-msg" class="swal2-textarea" style="width:100%; margin:0; height:80px;" placeholder="Optik formları dikkatli doldurun...">${ses.studentMsg || ''}</textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display:block; margin-bottom:0.5rem; font-weight:bold;">Öğretmen Mesajı / Talimatlar</label>
                        <textarea id="meta-tch-msg" class="swal2-textarea" style="width:100%; margin:0; height:80px;" placeholder="Sınav süresi 40 dakikadır...">${ses.teacherMsg || ''}</textarea>
                    </div>

                    <hr style="margin:1.5rem 0; border:0; border-top:2px dashed #6366f1;">

                    <div style="background:linear-gradient(135deg,#eef2ff,#f5f3ff); border:1.5px solid #6366f1; border-radius:12px; padding:1.2rem; display:flex; align-items:center; gap:1.2rem;">
                        <i class="fa-solid fa-shuffle" style="font-size:1.8rem; color:#6366f1;"></i>
                        <div style="flex:1;">
                            <strong style="display:block; font-size:0.95rem; color:#1e293b;">Dağıtımı Yenile</strong>
                            <small style="color:#64748b;">Mevcut ayarlar korunarak tüm öğrenciler algoritmaya göre sıfırdan yerleştirilir. Bu işlem geri alınamaz.</small>
                        </div>
                        <button type="button" class="btn btn-primary" style="white-space:nowrap; display:flex; align-items:center; gap:8px; padding:0.6rem 1.2rem; font-weight:700;"
                            onclick="Swal.close(); setTimeout(() => window.redistributeSession('${ses.id}'), 150);">
                            <i class="fa-solid fa-arrows-rotate"></i> Tekrar Dağıt
                        </button>
                    </div>
                </div>
`,
            showCancelButton: true,
            confirmButtonText: 'Tümünü Kaydet',
            cancelButtonText: 'İptal',
            didOpen: () => {
                // Ensure values are selected even if template literal had issues
                const dateInp = document.getElementById('meta-date');
                const timeInp = document.getElementById('meta-time');
                if (dateInp && ses.date) dateInp.value = ses.date;
                if (timeInp && ses.time) timeInp.value = ses.time;
            },
            preConfirm: () => {
                const newMetadata = {};
                subjectNames.forEach(sub => {
                    const examNumInput = document.querySelector(`.meta-exam-num-input[data-sub="${sub}"]`);
                    const examNum = examNumInput ? examNumInput.value.trim() : '';
                    const papers = {};
                    const paperInputs = document.querySelectorAll(`.meta-paper-input[data-sub="${sub}"]`);

                    if (hasGroups) {
                        paperInputs.forEach(inp => {
                            const group = inp.dataset.group;
                            papers[group] = inp.value.trim();
                        });
                    } else if (paperInputs[0]) {
                        papers['default'] = paperInputs[0].value.trim();
                    }

                    newMetadata[sub] = {
                        examNo: examNum,
                        papers: papers
                    };

                });

                return {
                    subjectMetadata: newMetadata,
                    date: document.getElementById('meta-date').value,
                    time: document.getElementById('meta-time').value.trim(),
                    studentMsg: document.getElementById('meta-std-msg').value.trim(),
                    teacherMsg: document.getElementById('meta-tch-msg').value.trim()
                };
            }
        })
            .then((result) => {
                if (result.isConfirmed) {
                    const updatedSes = { ...ses, ...result.value };
                    DataManager.addExamSession(updatedSes);
                    renderExamSessionsList();
                    Swal.fire('Kaydedildi', 'Tüm ders bilgileri başarıyla güncellendi.', 'success');
                }
            });
    };

    // ─── Oturumu Tekrar Dağıt ──────────────────────────────────────────────
    window.redistributeSession = function (id) {
        Swal.fire({
            title: 'Tekrar Dağıt',
            html: 'Bu işlem mevcut oturumu <b>sıfırdan</b> dağıtır.<br>Mevcut koltuk atamaları silinir. Devam etmek için şifreyi girin:',
            icon: 'warning',
            input: 'password',
            inputPlaceholder: 'Şifre (1234)',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-arrows-rotate"></i> Doğrula ve Dağıt',
            cancelButtonText: 'İptal',
            confirmButtonColor: '#6366f1',
            inputValidator: (value) => {
                if (!value) return 'Şifre girmelisiniz!';
                if (value !== '1234') return 'Hatalı şifre!';
            }
        }).then(res => {
            if (!res.isConfirmed) return;

            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === id);
            if (!session) return;

            const allRooms = DataManager.getClassrooms();

            // ── Öğrencileri session.results'ten çıkar ──────────────────────
            // Bu yöntem selectedClasses/selectedClassrooms'a BAĞIMLI DEĞİL.
            let targetStudents = [];
            let targetRooms = [];

            if (session.results && session.results.length) {
                // Öğrencileri mevcut dağıtımdan al (_matchedSubject zaten var)
                const seen = new Set();
                session.results.forEach(room => {
                    Object.values(room.seats || {}).forEach(student => {
                        if (student && !seen.has(student.no)) {
                            seen.add(student.no);
                            targetStudents.push({ ...student });
                        }
                    });
                });
                // Derslik isimlerini sonuçlardan al, DataManager'dan eşleştir
                const resultRoomNames = session.results.map(r => r.name);
                targetRooms = allRooms.filter(r => resultRoomNames.includes(r.name));

                // Eşleşen derslik bulunamadıysa tüm dersliklerden sonuç adıyla ara
                if (!targetRooms.length) {
                    targetRooms = allRooms.filter(r =>
                        resultRoomNames.some(n => n === r.name || r.name.includes(n) || n.includes(r.name))
                    );
                }
            }

            // ── Fallback: DataManager üzerinden filtrele ───────────────────
            if (!targetStudents.length || !targetRooms.length) {
                const allStudents = DataManager.getStudents();

                // Dersleri hem obje hem string formatını destekle
                const sessionSubjects = (session.subjects || []).map(s =>
                    typeof s === 'object' ? s.name : s
                ).filter(Boolean);
                if (!sessionSubjects.length && session.subject) sessionSubjects.push(session.subject);

                targetStudents = allStudents.filter(s => {
                    if (session.excludedStudents?.includes(s.no?.toString())) return false;
                    if (!s.dersler?.length) return false;
                    let matched = null;
                    const ok = s.dersler.some(d => {
                        const dt = d.trim();
                        const hit = sessionSubjects.some(base =>
                            dt === base || dt.startsWith(base + ' ') || dt.startsWith(base + '-')
                        );
                        if (hit) matched = dt;
                        return hit;
                    });
                    if (ok) s._matchedSubject = matched;
                    return ok;
                });

                // Derslikler
                if (session.selectedClassrooms?.length) {
                    targetRooms = allRooms.filter(r => session.selectedClassrooms.includes(r.name));
                }
                if (!targetRooms.length) targetRooms = allRooms;
            }

            if (!targetStudents.length || !targetRooms.length) {
                Swal.fire('Eksik Bilgi',
                    `Dağıtım verisi bulunamadı. (Öğrenci: ${targetStudents.length}, Derslik: ${targetRooms.length})`,
                    'error');
                return;
            }

            distributeWithRetry([...targetStudents], targetRooms, session, (res) => {
                if (!res) { Swal.fire('Hata', 'Dağıtım sonucu alınamadı.', 'error'); return; }
                session.results = res;
                DataManager.addExamSession(session);
                window._currentExamResults = res;
                window.currentRenderedSession = session;
                renderExamSessionsList();
                renderExamResults(res);
                setTimeout(() => {
                    if (typeof window.viewSessionDistribution === 'function') {
                        window.viewSessionDistribution(id, null, true);
                    }
                }, 100);
            });
        });
    };

    window.viewSessionDistribution = function (id, forceMode = null, isModeSwitch = false) {

        try {
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === id);
            if (!session) return;

            const accordionBody = document.getElementById(`accordion-body-${id}`);
            const resultsContainer = document.getElementById(`results-container-${id}`);
            const arrow = document.getElementById(`arrow-${id}`);

            // Toggle logic ONLY if it's NOT a mode switch
            if (!isModeSwitch) {
                const isCurrentlyHidden = accordionBody.classList.contains('hidden');

                // Close others
                document.querySelectorAll('[id^="accordion-body-"]').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('[id^="arrow-"]').forEach(el => el.style.transform = 'rotate(0deg)');

                if (isCurrentlyHidden) {
                    accordionBody.classList.remove('hidden');
                    if (arrow) arrow.style.transform = 'rotate(90deg)';
                } else {
                    accordionBody.classList.add('hidden');
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                    return; // Just closed it
                }
            } else {
                // If it's a mode switch but the accordion is closed (shouldn't happen but safe-guard)
                if (accordionBody.classList.contains('hidden')) return;
            }

            const modeEl = document.querySelector(`input[name="mode-${id}"]:checked`);
            const mode = forceMode || (modeEl ? modeEl.value : 'class');

            if (!session.results) {
                return window.startSessionDistribution(id);
            }

            window.currentRenderedSession = session;

            resultsContainer.innerHTML = '';

            if (mode === 'class') {
                renderClasswiseList(session, resultsContainer, true);
            } else if (mode === 'room') {
                renderRoomwiseList(session, resultsContainer, true);
            } else {
                window._currentExamResults = session.results;
                renderExamResults(session, resultsContainer, true);
            }



        } catch (err) {
            console.error("Error in viewSessionDistribution:", err);
            Swal.fire('Görüntüleme Hatası', err.message, 'error');
        }
    };

    function renderRoomwiseList(session, targetContainer = null, appendMode = false) {
        const view = targetContainer || document.getElementById('examClassroomsView');
        if (!appendMode) view.innerHTML = '';

        session.results.forEach((room, idx) => {
            const roomId = `nested-room-list-${idx}-${Math.random().toString(36).substr(2, 5)}`;
            const roomPanel = document.createElement('div');
            roomPanel.style.marginBottom = '1rem';

            // Assign visual Sequence Nos consistently (Rule: Bottom-Left = 1)
            let roomSeatCounter = 1;
            const seatToNum = {};
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                // Sequence from Front to Back: 1 to rows
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(room.disabledSeats && room.disabledSeats.includes(sid))) {
                            seatToNum[sid] = roomSeatCounter++;
                        }
                    }
                }
            }

            // Extract students from seats and sort by seat ID (G..S..C..)
            const sortedSeats = Object.keys(room.seats).sort((a, b) => {
                const partsA = a.match(/\d+/g).map(Number);
                const partsB = b.match(/\d+/g).map(Number);
                for (let i = 0; i < partsA.length; i++) {
                    if (partsA[i] !== partsB[i]) return partsA[i] - partsB[i];
                }
                return 0;
            });

            let tableRows = sortedSeats.map(seatId => {
                const s = room.seats[seatId];
                return `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><b>${seatToNum[seatId] || '-'}</b></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${s.class}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><b>${s.no}${s._groupLabel ? ` (${s._groupLabel})` : ''}</b></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${s.name}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; font-size:0.8rem;">${s._matchedSubject || '-'}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                            <input type="checkbox" class="student-paper-check" 
                                data-student-no="${s.no}" 
                                data-student-name="${s.name}"
                                data-sub="${s._matchedSubject || '-'}" 
                                data-group="${s._groupLabel || ''}" 
                                data-room="${room.name}"
                                data-class="${s.class}"
                                data-seat="${seatToNum[seatId] || '-'}"
                                style="width:15px; height:15px;">
                        </td>
                    </tr>
`;
            }).join('');

            roomPanel.innerHTML = `
                <div class="nested-accordion-header" onclick="toggleNestedAccordion('${roomId}')" style="background:var(--gray-50); padding:1rem; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.1rem;"><i class="fa-solid fa-door-open" style="color:var(--secondary);"></i> ${room.name} Salonu</h3>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <label style="display:flex; align-items:center; gap:5px; margin:0; cursor:pointer; font-size:0.85rem; font-weight:700; color:var(--primary);" onclick="event.stopPropagation();">
                            <input type="checkbox" class="room-paper-check" data-room="${room.name}" style="width:16px; height:16px;"> Soru Kağıdı
                        </label>
                        <i class="fa-solid fa-print" style="color:var(--gray-400); cursor:pointer;" title="Bu Salonu Yazdır" onclick="event.stopPropagation(); window.printSessionDistribution('${session.id}', '${room.name}')"></i>
                        <i id="icon-${roomId}" class="fa-solid fa-chevron-right" style="color:var(--gray-400);"></i>
                    </div>
                </div>
    <div id="${roomId}" class="hidden" style="padding:1.5rem; border:1px solid var(--gray-200); border-top:none; border-bottom-left-radius:8px; border-bottom-right-radius:8px; background:white; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
            <thead>
                <tr style="background:var(--gray-50); color:var(--gray-700);">
                    <th style="padding:8px; width:60px;">Sıra</th>
                    <th style="padding:8px; width:80px;">Sınıf</th>
                    <th style="padding:8px; width:80px;">No</th>
                    <th style="padding:8px;">Ad Soyad</th>
                    <th style="padding:8px;">Sınav Dersi</th>
                    <th style="padding:8px; width:100px; text-align:center;">Soru Kağıdı</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
`;
            view.appendChild(roomPanel);
        });
    }

    function renderClasswiseList(session, targetContainer = null, appendMode = false) {
        const view = targetContainer || document.getElementById('examClassroomsView');
        if (!appendMode) view.innerHTML = '';

        // Flatten with sequence numbers
        const flatList = [];
        session.results.forEach(room => {
            // Re-calculate visual numbers for this room (Rule: Bottom-Left = 1)
            let roomSeatCounter = 1;
            const seatToNum = {};
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                // Sequence from Front to Back: 1 to rows
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(room.disabledSeats && room.disabledSeats.includes(sid))) {
                            seatToNum[sid] = roomSeatCounter++;
                        }
                    }
                }
            }

            Object.entries(room.seats).forEach(([seatId, std]) => {
                flatList.push({
                    ...std,
                    room: room.name,
                    seatNum: seatToNum[seatId] || '-'
                });
            });
        });

        // Group by class
        const byClass = {};
        flatList.forEach(s => {
            if (!byClass[s.class]) byClass[s.class] = [];
            byClass[s.class].push(s);
        });

        const sortedClasses = Object.keys(byClass).sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b);
        });

        sortedClasses.forEach((className, idx) => {
            const classId = `nested-class-list-${idx}-${Math.random().toString(36).substr(2, 5)}`;
            const classPanel = document.createElement('div');
            classPanel.style.marginBottom = '1rem';

            let tableRows = byClass[className]
                .sort((a, b) => parseInt(a.no) - parseInt(b.no))
                .map(s => `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><b>${s.no}${s._groupLabel ? ` (${s._groupLabel})` : ''}</b></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${s.name}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; font-size:0.8rem;">${s._matchedSubject || '-'}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${s.room}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><b>${s.seatNum}</b></td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                            <input type="checkbox" class="student-paper-check" 
                                data-student-no="${s.no}" 
                                data-student-name="${s.name}"
                                data-sub="${s._matchedSubject || '-'}" 
                                data-group="${s._groupLabel || ''}" 
                                data-room="${s.room}"
                                data-class="${className}"
                                data-seat="${s.seatNum}"
                                style="width:15px; height:15px;">
                        </td>
                    </tr>
`).join('');

            classPanel.innerHTML = `
                <div class="nested-accordion-header" onclick="toggleNestedAccordion('${classId}')" style="background:var(--gray-50); padding:1rem; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.1rem;"><i class="fa-solid fa-users" style="color:var(--primary);"></i> ${className} Sınıf Listesi</h3>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <label style="display:flex; align-items:center; gap:5px; margin:0; cursor:pointer; font-size:0.85rem; font-weight:700; color:var(--primary);" onclick="event.stopPropagation();">
                            <input type="checkbox" class="class-paper-check" data-class="${className}" style="width:16px; height:16px;"> Soru Kağıdı
                        </label>
                        <i class="fa-solid fa-print" style="color:var(--gray-400); cursor:pointer;" title="Bu Sınıfı Yazdır" onclick="event.stopPropagation(); window.printSessionDistribution('${session.id}', '${className}')"></i>
                        <i id="icon-${classId}" class="fa-solid fa-chevron-right" style="color:var(--gray-400);"></i>
                    </div>
                </div>
    <div id="${classId}" class="hidden" style="padding:1.5rem; border:1px solid var(--gray-200); border-top:none; border-bottom-left-radius:8px; border-bottom-right-radius:8px; background:white; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
            <thead>
                <tr style="background:var(--gray-50); color:var(--gray-700);">
                    <th style="padding:8px; width:70px;">No</th>
                    <th style="padding:8px;">Ad Soyad</th>
                    <th style="padding:8px;">Sınav Dersi</th>
                    <th style="padding:8px;">Derslik</th>
                    <th style="padding:8px; width:60px;">Sıra</th>
                    <th style="padding:8px; width:100px; text-align:center;">Soru Kağıdı</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
`;
            view.appendChild(classPanel);
        });
    }

    window.startSessionDistribution = function (id) {
        const session = DataManager.getExamSessions().find(s => s.id === id);
        if (!session) return;

        // 1. Filter Classrooms
        const allRooms = DataManager.getClassrooms();
        const targetRooms = allRooms.filter(r => session.selectedClassrooms.includes(r.name));

        // 2. Filter Students
        const allStudents = DataManager.getStudents();
        const sessionSubjects = session.subjects || [session.subject];

        const targetStudents = allStudents.filter(s => {
            const poolId = `${s.class}| ${s.alan || ""} `;
            if (!session.selectedClasses.includes(poolId) && !session.selectedClasses.includes(s.class)) return false;

            let matchedSubject = null;
            const hasSub = s.dersler && s.dersler.some(d => {
                const found = sessionSubjects.some(base => d.trim() === base || d.trim().startsWith(base + " "));
                if (found) matchedSubject = d.trim();
                return found;
            });
            if (!hasSub) return false;

            if (session.excludedStudents && session.excludedStudents.includes(s.no.toString())) return false;

            s._matchedSubject = matchedSubject;
            return true;
        });

        if (targetStudents.length === 0 || targetRooms.length === 0) {
            Swal.fire('Eksik Bilgi', 'Oturum için yeterli hedef öğrenci veya onaylı derslik bulunamadı!', 'error');
            return;
        }

        distributeWithRetry([...targetStudents], targetRooms, session, (res) => {
            if (!res) { Swal.fire('Hata', 'Dağıtım sonucu alınamadı.', 'error'); return; }
            session.results = res;
            DataManager.addExamSession(session);
            window._currentExamResults = res;
            document.getElementById('examSetupPanel').classList.add('hidden');
            document.getElementById('examResultsPanel').classList.remove('hidden');
            window.currentRenderedSession = session;
            renderExamResults(res);
        });
    };

    // --- End Exam Session Wizard Logic ---

    // Init Calls (kept here for backward compatibility, primary init is near top)
    updateDashboardStats();
    updateClassesList();
    updateClassroomsList();
    renderExamSessionsList();

    // --- 11. Custom Global Class Bulk Assignment Methods ---
    window.assignSubjectsToClass = function (className) {
        const settings = DataManager.getSchoolSettings();
        const students = DataManager.getStudents();

        if (!settings.subjects || settings.subjects.length === 0) {
            Swal.fire('Hata', 'Önce Genel Ayarlar sekmesinden okul derslerini tanımlamalısınız.', 'error');
            return;
        }

        // Find grade for this class
        let gradeMatch = className.match(/\d+/);
        let grade = gradeMatch ? gradeMatch[0] : "";

        // Determine existing subjects in this class & find unique fields (alanlar)
        window._currentSubjectsByField = {};
        window._currentClassSubjects = new Set();
        let uniqueFields = new Set();

        students.forEach(s => {
            if (s.class === className) {
                const f = s.alan && s.alan.trim() !== '' ? s.alan.trim() : '_NOFIELD_';
                if (f !== '_NOFIELD_') uniqueFields.add(f);

                if (!window._currentSubjectsByField[f]) {
                    window._currentSubjectsByField[f] = new Set();
                }

                if (s.dersler) {
                    s.dersler.forEach(d => {
                        settings.subjects.forEach(sub => {
                            let expected = grade ? `${sub} ${grade}` : sub;
                            if (d.trim() === expected) {
                                window._currentSubjectsByField[f].add(sub);
                                window._currentClassSubjects.add(sub);
                            }
                        });
                    });
                }
            }
        });

        // Global updater function for the SweetAlert modal checkboxes
        window.updateSwalSubjects = function () {
            const checkedFields = Array.from(document.querySelectorAll('.swal-field-filter-checkbox:checked')).map(cb => cb.value);
            let activeSubjects = new Set();

            checkedFields.forEach(f => {
                if (window._currentSubjectsByField[f]) {
                    window._currentSubjectsByField[f].forEach(sub => activeSubjects.add(sub));
                }
            });

            document.querySelectorAll('.swal-subject-checkbox').forEach(cb => {
                cb.checked = activeSubjects.has(cb.value);
            });
        };

        let initialChecked = new Set();
        if (uniqueFields.size > 0) {
            uniqueFields.forEach(f => {
                if (window._currentSubjectsByField[f]) {
                    window._currentSubjectsByField[f].forEach(sub => initialChecked.add(sub));
                }
            });
        } else {
            initialChecked = window._currentClassSubjects;
        }

        let html = '<div style="text-align:left; max-height:200px; overflow-y:auto; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:1rem;">';
        html += '<p style="font-size:0.9rem; font-weight:600; margin-top:0; margin-bottom:10px;">Dersleri Seçin:</p>';
        const subjectsToShow = settings.subjects || [];
        subjectsToShow.forEach(sub => {
            let isChecked = initialChecked.has(sub.trim()) ? 'checked' : '';
            html += `<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer;">
    <input type="checkbox" class="swal-subject-checkbox" value="${sub.trim()}" style="width:18px; height:18px; cursor:pointer;" ${isChecked}>
        <span style="font-size:1rem; color:var(--dark);">${sub.trim()}</span>
    </label>`;
        });
        html += '</div>';

        // If the class has fields, let user select which fields to assign to
        if (uniqueFields.size > 0) {
            html += '<div style="text-align:left; max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:1rem;">';
            html += '<p style="font-size:0.9rem; font-weight:600; margin-top:0; margin-bottom:10px;">Hangi alanlara tanımlansın? (Seçime göre üstteki dersler güncellenir):</p>';
            uniqueFields.forEach(f => {
                html += `<label style="display:inline-flex; align-items:center; gap:5px; margin-right:15px; margin-bottom:8px; cursor:pointer;">
    <input type="checkbox" class="swal-field-filter-checkbox" value="${f}" style="cursor:pointer;" checked onchange="window.updateSwalSubjects()">
        <span style="font-size:0.9rem;">${f}</span>
    </label>`;
            });
            html += '</div>';
        }

        // Copy to other classes section
        let allClasses = new Set();
        students.forEach(s => { if (s.class && s.class !== className) allClasses.add(s.class); });
        const sortedClasses = Array.from(allClasses).sort((a, b) => {
            const numA = (a.match(/\d+/) || [0])[0];
            const numB = (b.match(/\d+/) || [0])[0];
            if (numA !== numB) return numA - numB;
            return a.replace(/\d+/g, '').trim().localeCompare(b.replace(/\d+/g, '').trim());
        });

        if (sortedClasses.length > 0) {
            html += '<div style="text-align:left; max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">';
            html += '<p style="font-size:0.9rem; font-weight:600; margin-top:0; margin-bottom:10px;">Şu sınıflara da kopyala (İsteğe bağlı):</p>';
            sortedClasses.forEach(c => {
                html += `<label style="display:inline-flex; align-items:center; gap:5px; margin-right:15px; margin-bottom:8px; cursor:pointer;">
    <input type="checkbox" class="swal-copy-class-checkbox" value="${c}" style="cursor:pointer;">
        <span style="font-size:0.9rem;">${c}</span>
    </label>`;
            });
            html += '</div>';
        }

        Swal.fire({
            title: `${className} Sınıfı İşlemleri`,
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            width: 500,
            preConfirm: () => {
                const checkedSubs = Array.from(document.querySelectorAll('.swal-subject-checkbox:checked')).map(cb => cb.value);
                const copyClasses = Array.from(document.querySelectorAll('.swal-copy-class-checkbox:checked')).map(cb => cb.value);
                const targetFields = Array.from(document.querySelectorAll('.swal-field-filter-checkbox:checked')).map(cb => cb.value);

                // If the field checkboxes exist but none are checked, we could optionally warn. But we'll just respect the selection.
                return { checkedSubs, targetClasses: [className, ...copyClasses], targetFields, hasFieldFilters: uniqueFields.size > 0 };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { checkedSubs, targetClasses, targetFields, hasFieldFilters } = result.value;
                let updatedStudentsCount = 0;

                targetClasses.forEach(targetClass => {
                    let tGradeMatch = targetClass.match(/\d+/);
                    let tGrade = tGradeMatch ? tGradeMatch[0] : "";

                    // Construct new subjects list appending the target's grade level
                    const newSubjects = checkedSubs.map(sub => tGrade ? `${sub} ${tGrade}` : sub);
                    // All possible settings subjects customized to this target class's grade
                    const possibleSettingsSubjects = settings.subjects.map(sub => tGrade ? `${sub} ${tGrade}` : sub);

                    // If we copy to other classes, do we apply the field filter assuming the other class has those fields? 
                    // The prompt says: "Seçilirse seçilen dersler seçilen alanlara tanımlanır diğerlerine tanımklanmaz". 
                    // This logic implies this applies mainly to the CURRENT class, and if copied, to the matching fields in the target class.
                    // We will only assign to students whose field is included in targetFields if field filters were selected
                    // Fetch fresh students inside the target loop just in case
                    const currentStudents = DataManager.getStudents();
                    currentStudents.forEach(s => {
                        if (s.class === targetClass) {

                            // Check field filtering logic
                            let shouldAssign = true;
                            if (hasFieldFilters && targetFields.length > 0) {
                                // Only assign if the student has one of the selected fields
                                shouldAssign = s.alan && targetFields.includes(s.alan.trim());
                            } else if (hasFieldFilters && targetFields.length === 0) {
                                // Checked boxes existed but user unchecked all of them -> essentially "assign to none" or "assign to those without field"?
                                // For safety, let's treat "no fields selected" as assigning to the whole class if you meant "skip filtering",
                                // but usually if checkboxes exist and none are checked, it means don't assign.
                                // The user said: "Seçilirse seçilen dersler seçilen alanlara tanımlanır diğerlerine tanımklanmaz".
                                shouldAssign = false;
                            }

                            if (shouldAssign) {
                                // Remove previously assigned school settings subjects for this grade
                                let filtered = (s.dersler || []).filter(d => !possibleSettingsSubjects.includes(d));
                                // Assign the new selections
                                s.dersler = Array.from(new Set([...filtered, ...newSubjects]));
                                updatedStudentsCount++;
                            }
                        }
                    });

                    // Update students for each class
                    const liveData = DataManager._getData();
                    liveData.students = currentStudents;
                    DataManager._saveData(liveData);
                });

                document.querySelector('[data-tab="classLists"]').click();
                Swal.fire('Başarılı', `Seçilen dersler, ${targetClasses.length} sınıftaki ilgili ${updatedStudentsCount} öğrenciye başarıyla tanımlandı.`, 'success');
            }
        });
    };

    window.assignFieldToClass = function (className) {
        const data = DataManager._getData();
        let classStudents = data.students.filter(s => s.class === className);

        // Sort students by number just to be neat
        classStudents.sort((a, b) => parseInt(a.no) - parseInt(b.no));

        let html = `
    <div style="text-align:left; font-size:0.95rem;">
            <div style="margin-bottom:1rem;">
                <label style="display:block; font-weight:600; margin-bottom:5px;">Alan Adı</label>
                <input type="text" id="swal-field-name" class="swal2-input" placeholder="Örn: Sayısal, Eşit Ağırlık..." style="margin:0; width:100%; box-sizing:border-box;">
            </div>
            
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:1rem; cursor:pointer;">
                <input type="checkbox" id="swal-specific-students-toggle" style="width:18px; height:18px; cursor:pointer;" 
                       onchange="document.getElementById('swal-students-list').style.display = this.checked ? 'block' : 'none';">
                <span style="font-weight:600; color:var(--primary);">Sadece belirli öğrencilere tanımla</span>
            </label>
            
            <div id="swal-students-list" style="display:none; max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
    `;

        classStudents.forEach(std => {
            let currentField = std.alan ? ` <span style="font-size:0.8rem; color:#888;">(${std.alan})</span>` : '';
            html += `
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer;">
                <input type="checkbox" class="swal-student-cb" value="${std.no}" style="width:16px; height:16px; cursor:pointer;" checked>
                <span><b>${std.no}</b> - ${std.name}${currentField}</span>
            </label>
        `;
        });

        html += `</div></div>`;

        Swal.fire({
            title: `${className} Sınıfına Alan Tanımla`,
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Alanı Kaydet',
            cancelButtonText: 'İptal',
            width: 500,
            preConfirm: () => {
                const fieldName = document.getElementById('swal-field-name').value.trim();
                if (!fieldName) {
                    Swal.showValidationMessage('Lütfen bir alan adı giriniz.');
                    return false;
                }

                const isSpecific = document.getElementById('swal-specific-students-toggle').checked;
                let targetNos = [];

                if (isSpecific) {
                    targetNos = Array.from(document.querySelectorAll('.swal-student-cb:checked')).map(cb => cb.value);
                    if (targetNos.length === 0) {
                        Swal.showValidationMessage('Lütfen en az bir öğrenci seçiniz.');
                        return false;
                    }
                } else {
                    // If not specific, map all student numbers in this class
                    targetNos = classStudents.map(s => s.no);
                }

                return { fieldName, targetNos };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { fieldName, targetNos } = result.value;
                const liveData = DataManager._getData();
                let count = 0;

                liveData.students.forEach(s => {
                    if (s.class === className && targetNos.includes(s.no)) {
                        s.alan = fieldName;
                        count++;
                    }
                });
                DataManager._saveData(liveData);

                // Refresh Dashboard UI
                document.querySelector('[data-tab="classLists"]').click();
                Swal.fire('Başarılı', `"${fieldName}" alanı ${count} öğrenciye tanımlandı.`, 'success');
            }
        });
    };

    window.editStudentDetails = function (studentNo) {
        const data = DataManager._getData();
        const studentIndex = data.students.findIndex(s => s.no == studentNo);

        if (studentIndex === -1) {
            Swal.fire('Hata', 'Öğrenci bulunamadı', 'error');
            return;
        }

        const std = data.students[studentIndex];

        let html = `
    <div style="text-align:left; font-size:0.9rem;">
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px;">Öğrenci No</label>
                    <input type="number" id="edit-std-no" class="swal2-input" value="${std.no}" style="margin:0; width:100%; height:36px; font-size:0.9rem;">
                </div>
                <div style="flex:2;">
                    <label style="display:block; font-weight:600; margin-bottom:3px;">Adı Soyadı</label>
                    <input type="text" id="edit-std-name" class="swal2-input" value="${std.name}" style="margin:0; width:100%; height:36px; font-size:0.9rem;">
                </div>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px;">Sınıfı</label>
                    <input type="text" id="edit-std-class" class="swal2-input" value="${std.class}" style="margin:0; width:100%; height:36px; font-size:0.9rem;">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px;">Alanı</label>
                    <input type="text" id="edit-std-alan" class="swal2-input" value="${std.alan || ''}" style="margin:0; width:100%; height:36px; font-size:0.9rem;">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px;">
                        Öğrenci Kodu 
                        <a href="javascript:void(0)" onclick="window.toggleEditCodeGuide()" style="font-size:0.75rem; font-weight:normal; margin-left:5px; color:var(--primary); text-decoration:underline;">
                            <i class="fa-solid fa-circle-info"></i> Rehber
                        </a>
                    </label>
                    <input type="text" id="edit-std-kodu" class="swal2-input" value="${std.ogrenciKodu || ''}" style="margin:0; width:100%; height:36px; font-size:0.9rem;" placeholder="Örn: C, H">
                </div>
            </div>
            
            <div id="edit-code-guide" style="display:none; margin-top:5px; margin-bottom:15px; padding: 12px; background: rgba(79, 70, 229, 0.05); border-radius: 8px; border: 1px solid rgba(79, 70, 229, 0.1); text-align: left; animation: fadeIn 0.3s ease;">
                <p style="margin-bottom: 10px; font-size: 0.85rem; font-weight: 600; color: var(--gray-600);">Hızlı Seçim:</p>
                <div style="display: flex; gap: 15px; margin-bottom:12px;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                        <input type="checkbox" id="edit-chk-c" style="width:18px; height:18px;">
                        <span class="condition-marker type-c" style="margin:0;">C</span> Dikkat
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                        <input type="checkbox" id="edit-chk-h" style="width:18px; height:18px;">
                        <span class="condition-marker type-h" style="margin:0;">H</span> Sağlık
                    </label>
                </div>
                <div style="padding-top:10px; border-top:1px dashed rgba(79, 70, 229, 0.2); font-size:0.8rem; color:var(--gray-600); line-height:1.4;">
                    <i class="fa-solid fa-lightbulb" style="color:var(--primary);"></i> <strong>İpucu:</strong> Belli bir derslikte sınava girmesi istenirse derslik adını (Örn: <strong>12B</strong>) buraya yazabilirsiniz.
                </div>
            </div>
            
            <div style="margin-bottom:10px;">
                <label style="display:block; font-weight:600; margin-bottom:3px;">Dersler (Virgülle ayırın)</label>
                <input type="text" id="edit-std-dersler" class="swal2-input" value="${(std.dersler || []).join(', ')}" style="margin:0; width:100%; height:36px; font-size:0.9rem;">
            </div>
            
            <p style="font-weight:600; margin-top:15px; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:5px;">Ekstra Bilgiler</p>
            
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px; font-size:0.8rem;">Ekstra 1</label>
                    <input type="text" id="edit-std-ex1" class="swal2-input" value="${std.extra1 || ''}" style="margin:0; width:100%; height:30px; font-size:0.85rem;">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px; font-size:0.8rem;">Ekstra 2</label>
                    <input type="text" id="edit-std-ex2" class="swal2-input" value="${std.extra2 || ''}" style="margin:0; width:100%; height:30px; font-size:0.85rem;">
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px; font-size:0.8rem;">Ekstra 3</label>
                    <input type="text" id="edit-std-ex3" class="swal2-input" value="${std.extra3 || ''}" style="margin:0; width:100%; height:30px; font-size:0.85rem;">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px; font-size:0.8rem;">Ekstra 4</label>
                    <input type="text" id="edit-std-ex4" class="swal2-input" value="${std.extra4 || ''}" style="margin:0; width:100%; height:30px; font-size:0.85rem;">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:3px; font-size:0.8rem;">Ekstra 5</label>
                    <input type="text" id="edit-std-ex5" class="swal2-input" value="${std.extra5 || ''}" style="margin:0; width:100%; height:30px; font-size:0.85rem;">
                </div>
            </div>
            </div>
        </div>`;

        Swal.fire({
            title: 'Öğrenci Kartı Düzenle',
            html: html,
            width: 600,
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            didOpen: () => {
                const guide = document.getElementById('edit-code-guide');
                const input = document.getElementById('edit-std-kodu');
                const chkC = document.getElementById('edit-chk-c');
                const chkH = document.getElementById('edit-chk-h');

                window.toggleEditCodeGuide = () => {
                    guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
                };

                const updateCheckboxes = () => {
                    const tags = input.value.split(/[,\s]+/).map(t => t.trim().toUpperCase());
                    chkC.checked = tags.includes('C');
                    chkH.checked = tags.includes('H');
                };

                updateCheckboxes();

                const updateInput = (code, checked) => {
                    let tags = input.value.split(/[,\s]+/).map(t => t.trim().toUpperCase()).filter(t => t);
                    if (checked) {
                        if (!tags.includes(code)) tags.push(code);
                    } else {
                        tags = tags.filter(t => t !== code);
                    }
                    input.value = tags.join(', ');
                };

                chkC.addEventListener('change', (e) => updateInput('C', e.target.checked));
                chkH.addEventListener('change', (e) => updateInput('H', e.target.checked));
                input.addEventListener('input', updateCheckboxes);
            },
            preConfirm: () => {
                const no = document.getElementById('edit-std-no').value.trim();
                const name = document.getElementById('edit-std-name').value.trim();
                const cls = document.getElementById('edit-std-class').value.trim();

                if (!no || !name || !cls) {
                    Swal.showValidationMessage('Öğrenci No, Adı Soyadı ve Sınıfı zorunludur.');
                    return false;
                }

                if (no != studentNo && data.students.some(s => s.no == no)) {
                    Swal.showValidationMessage('Bu numaraya sahip başka bir öğrenci zaten var.');
                    return false;
                }

                const derslerStr = document.getElementById('edit-std-dersler').value.trim();
                const derslerArr = derslerStr ? derslerStr.split(/[,\n;]/).map(d => d.trim()).filter(d => d) : [];

                return {
                    no: no,
                    name: name,
                    class: cls,
                    alan: document.getElementById('edit-std-alan').value.trim(),
                    ogrenciKodu: document.getElementById('edit-std-kodu').value.trim(),
                    dersler: derslerArr,
                    extra1: document.getElementById('edit-std-ex1').value.trim(),
                    extra2: document.getElementById('edit-std-ex2').value.trim(),
                    extra3: document.getElementById('edit-std-ex3').value.trim(),
                    extra4: document.getElementById('edit-std-ex4').value.trim(),
                    extra5: document.getElementById('edit-std-ex5').value.trim(),
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                data.students[studentIndex] = { ...data.students[studentIndex], ...result.value };
                DataManager._saveData(data);
                document.querySelector('[data-tab="classLists"]').click();
                Swal.fire('Başarılı', 'Öğrenci bilgileri güncellendi.', 'success');
            }
        });
    };

    window.updateDeskPos = function (roomName, pos) {
        const room = DataManager.getClassrooms().find(r => r.name === roomName);
        if (!room) return;
        room.teacherDeskPos = pos;
        DataManager.addClassroom(room);
        window.updateClassroomsList();
    };

    window.toggleSeat = function (roomName, seatId) {
        const room = DataManager.getClassrooms().find(r => r.name === roomName);
        if (!room) return;
        if (!room.disabledSeats) room.disabledSeats = [];
        if (room.disabledSeats.includes(seatId)) {
            room.disabledSeats = room.disabledSeats.filter(id => id !== seatId);
        } else {
            room.disabledSeats.push(seatId);
        }
        DataManager.addClassroom(room);
        window.updateClassroomsList();
    };

    window.updateClassroomsList = updateClassroomsList;

    // --- 13. Student Code Guide ---
    window.showStudentCodeGuide = function (targetInputId) {
        const inputEl = document.getElementById(targetInputId);
        if (!inputEl) return;

        const currentVal = inputEl.value.toUpperCase();
        const hasC = currentVal.split(/[,\s]+/).includes('C');
        const hasH = currentVal.split(/[,\s]+/).includes('H');

        Swal.fire({
            title: 'Öğrenci Kod Rehberi',
            html: `
    <div style="text-align: left; padding: 1rem;">
                    <p style="margin-bottom: 1.5rem; color: var(--gray-600);">Özel durumları hızlıca eklemek için yanlarındaki kutucukları işaretleyebilirsiniz:</p>
                    
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: rgba(239, 68, 68, 0.05); border-radius: 8px; border-left: 4px solid var(--danger);">
                        <input type="checkbox" id="guide-chk-c" ${hasC ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                        <span class="condition-marker type-c" style="margin:0; flex-shrink:0;">C</span>
                        <div style="flex: 1;">
                            <strong style="color: var(--danger); display: block;">C (Dikkat):</strong>
                            <span style="font-size: 0.85rem;">Dikkat Edilmesi Gerekir (Örn: Kaynaştırma öğrencisi).</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(245, 158, 11, 0.05); border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <input type="checkbox" id="guide-chk-h" ${hasH ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                        <span class="condition-marker type-h" style="margin:0; flex-shrink:0;">H</span>
                        <div style="flex: 1;">
                            <strong style="color: #f59e0b; display: block;">H (Sağlık):</strong>
                            <span style="font-size: 0.85rem;">Sağlık Sorunu Var (Örn: Kronik hastalık, alerji).</span>
                        </div>
                    </div>

                    <div style="padding: 1rem; background: rgba(79, 70, 229, 0.05); border-radius: 8px; border-top: 2px dashed var(--primary);">
                        <p style="font-weight: 700; color: var(--primary); margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <i class="fa-solid fa-location-dot"></i> Derslik Atama (Özel İpucu)
                        </p>
                        <p style="font-size: 0.85rem; color: var(--gray-600); line-height: 1.4;">
                            Eğer bu öğrencinin <strong>belli bir derslikte</strong> sınava girmesini isterseniz, kod kısmına doğrudan derslik adını (Örn: <strong>12B</strong> gibi) ekleyebilirsiniz.
                        </p>
                    </div>
                </div>
    `,
            didOpen: () => {
                const chkC = document.getElementById('guide-chk-c');
                const chkH = document.getElementById('guide-chk-h');

                const updateInput = (code, checked) => {
                    let tags = inputEl.value.split(/[,\s]+/).map(t => t.trim().toUpperCase()).filter(t => t);
                    if (checked) {
                        if (!tags.includes(code)) tags.push(code);
                    } else {
                        tags = tags.filter(t => t !== code);
                    }
                    inputEl.value = tags.join(', ');
                };

                chkC.addEventListener('change', (e) => updateInput('C', e.target.checked));
                chkH.addEventListener('change', (e) => updateInput('H', e.target.checked));
            },
            confirmButtonText: 'Tamam',
            confirmButtonColor: 'var(--primary)',
            showCloseButton: true,
            width: '500px'
        });
    };

    initializeNavigation();

});

// ══════════════════════════════════════════════════════════════
// GLOBAL: Seating Plan Context Menu
// Must be OUTSIDE DOMContentLoaded so inline oncontextmenu/onclick
// HTML attributes can call these functions reliably.
// ══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // Shared state
    const _ctx = { target: null, moveMode: false, moveSrc: null };

    // Lazy-get the context menu element (created on first call)
    function getMenu() {
        let m = document.getElementById('examDeskContextMenu');
        if (!m) {
            m = document.createElement('div');
            m.id = 'examDeskContextMenu';
            m.style.cssText = 'display:none;position:fixed;z-index:99999;background:white;'
                + 'border:1px solid #e2e8f0;border-radius:10px;'
                + 'box-shadow:0 8px 24px rgba(0,0,0,0.18);overflow:hidden;min-width:155px;';
            m.innerHTML =
                '<div id="examCtxMove" style="padding:12px 18px;cursor:pointer;display:flex;align-items:center;gap:9px;font-size:0.9rem;font-weight:600;color:#1e293b;"'
                + ' onmouseenter="this.style.background=\'#f1f5f9\'" onmouseleave="this.style.background=\'\'">'
                + '<i class="fa-solid fa-arrows-up-down-left-right" style="color:#6366f1;"></i>Taşı</div>'
                + '<div style="height:1px;background:#e2e8f0;margin:0 10px;"></div>'
                + '<div id="examCtxDelete" style="padding:12px 18px;cursor:pointer;display:flex;align-items:center;gap:9px;font-size:0.9rem;font-weight:600;color:#ef4444;"'
                + ' onmouseenter="this.style.background=\'#fef2f2\'" onmouseleave="this.style.background=\'\'">'
                + '<i class="fa-solid fa-trash"></i>Sil</div>';
            document.body.appendChild(m);

            // Wire up buttons immediately after creating the menu
            document.getElementById('examCtxDelete').addEventListener('click', onDelete);
            document.getElementById('examCtxMove').addEventListener('click', onMove);
        }
        return m;
    }

    function hideMenu() {
        const m = document.getElementById('examDeskContextMenu');
        if (m) m.style.display = 'none';
    }

    function renderResults() {
        const r = window._currentExamResults;
        if (r && window._renderExamResults) window._renderExamResults(r);
    }

    // ── Called from oncontextmenu="examDeskRightClick(event, idx, seatId)"
    window.examDeskRightClick = function (e, roomIdx, seatId) {
        // Fallback: try to get results from the currently rendered session
        if (!window._currentExamResults && window.currentRenderedSession && window.currentRenderedSession.results) {
            window._currentExamResults = window.currentRenderedSession.results;
        }
        const results = window._currentExamResults;
        if (!results || !results[+roomIdx] || !results[+roomIdx].seats[seatId]) return;
        // Only prevent default AFTER confirming we'll show our menu
        e.preventDefault();
        e.stopPropagation();
        _ctx.target = { roomIdx: +roomIdx, seatId: seatId };
        const m = getMenu();
        m.style.display = 'block';
        m.style.left = (e.clientX + 2) + 'px';
        m.style.top = (e.clientY + 2) + 'px';
    };

    // ── Called from onclick="examDeskClick(event, idx, seatId)"
    window.examDeskClick = function (e, roomIdx, seatId) {
        if (!_ctx.moveMode) return;
        e.stopPropagation();
        clearHighlights();

        const results = window._currentExamResults;
        if (!results) { _ctx.moveMode = false; return; }

        const srcRoom = results[_ctx.moveSrc.roomIdx];
        const dstRoom = results[+roomIdx];
        const moving = srcRoom && srcRoom.seats[_ctx.moveSrc.seatId];
        const target = dstRoom && dstRoom.seats[seatId];

        if (!moving) { _ctx.moveMode = false; _ctx.moveSrc = null; return; }

        const desc = target
            ? '<b>' + target.name + '</b> ile yer değiştirilecek'
            : 'Boş koltuğa taşınacak';

        Swal.fire({
            title: 'Taşımayı Onayla',
            html: '<b>' + moving.name + '</b> &rarr; <b>' + dstRoom.name + '</b> salonu. ' + desc + '.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, Taşı',
            cancelButtonText: 'İptal'
        }).then(function (r) {
            if (r.isConfirmed) {
                if (target) srcRoom.seats[_ctx.moveSrc.seatId] = target;
                else delete srcRoom.seats[_ctx.moveSrc.seatId];
                dstRoom.seats[seatId] = moving;
                if (window.currentRenderedSession) {
                    window.currentRenderedSession.results = results;
                    if (window.DataManager) DataManager.addExamSession(window.currentRenderedSession);
                }
                renderResults();
            }
            _ctx.moveMode = false;
            _ctx.moveSrc = null;
        });
    };

    function onDelete() {
        hideMenu();
        if (!_ctx.target) return;
        var roomIdx = _ctx.target.roomIdx;
        var seatId = _ctx.target.seatId;
        var results = window._currentExamResults;
        var student = results && results[roomIdx] && results[roomIdx].seats[seatId];
        if (!student) return;

        Swal.fire({
            title: 'Öğrenciyi Kaldır',
            html: '<b>' + student.name + '</b> (' + student.no + ' / ' + student.class + ') dağıtımdan silinecek. Emin misiniz?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'İptal'
        }).then(function (r) {
            if (!r.isConfirmed) return;
            delete results[roomIdx].seats[seatId];
            if (window.currentRenderedSession) {
                window.currentRenderedSession.results = results;
                if (window.DataManager) DataManager.addExamSession(window.currentRenderedSession);
            }
            renderResults();
        });
    }

    function onMove() {
        hideMenu();
        if (!_ctx.target) return;
        _ctx.moveMode = true;
        _ctx.moveSrc = { roomIdx: _ctx.target.roomIdx, seatId: _ctx.target.seatId };
        document.querySelectorAll('[oncontextmenu],[onclick]').forEach(function (el) {
            if (el.getAttribute('oncontextmenu') && el.getAttribute('oncontextmenu').indexOf('examDeskRightClick') > -1) {
                el.style.outline = '2px dashed #6366f1';
            }
        });
        Swal.fire({ title: 'Taşı Modu', text: 'Hedef koltuğa tıklayın. Dolu ise yer değiştirilir. ESC = iptal.', icon: 'info', timer: 2500, showConfirmButton: false, toast: true, position: 'top-end' });
    }

    function clearHighlights() {
        document.querySelectorAll('[oncontextmenu]').forEach(function (el) {
            el.style.outline = '';
            el.style.cursor = 'context-menu';
        });
    }

    // Global dismiss
    document.addEventListener('click', function (e) {
        var m = document.getElementById('examDeskContextMenu');
        if (m && m.style.display !== 'none' && !m.contains(e.target)) hideMenu();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        hideMenu();
        if (_ctx.moveMode) { _ctx.moveMode = false; _ctx.moveSrc = null; clearHighlights(); }
    });

}());
