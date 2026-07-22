
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            Swal.fire('Teknik Hata Oluştu', `${msg}\nSatır: ${lineNo}\nLütfen bu hatayı geliştiriciye bildirin.`, 'error');
            return false;
        };
        window.addEventListener("unhandledrejection", function(e) {
            Swal.fire('Teknik Hata (Promise)', `${e.reason}\nLütfen bu hatayı geliştiriciye bildirin.`, 'error');
        });

        // Global variables
        let schoolData = {};
        
        // --- INTERNET TIME SYNCHRONIZATION ---
        let internetTimeOffset = 0;
        async function syncInternetTime() {
            try {
                const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/Istanbul', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    const serverMs = new Date(data.utc_datetime).getTime();
                    internetTimeOffset = serverMs - Date.now();
                    console.log("Internet time synced. Offset:", internetTimeOffset, "ms");
                }
            } catch (e) {
                console.log("Time sync failed, using device time.", e);
            }
        }
        syncInternetTime();

        function getTRTime() {
            const realUtcMs = Date.now() + internetTimeOffset;
            const trStr = new Date(realUtcMs).toLocaleString('en-US', { timeZone: 'Europe/Istanbul' });
            return new Date(trStr);
        }
        // ------------------------------------
        let allStudents = [];
        let teachersDb = {};
        let activeTeacherUsername = "";
        let activeTeacherObject = null;
        let activeClassStudents = [];
        
        // Attendance records in memory for current selection
        // studentNo -> status ('GELDİ', 'GELMEDİ', 'GEÇ', 'DİĞER')
        let attendanceMap = {}; 
        let gecTimeMap = {};

        // Firebase URL
        const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";

        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        function logoutTeacher() {
            sessionStorage.clear();
            localStorage.removeItem('klbk_storeKey');
            window.location.reload();
        }

        async function openTeacherSettings() {
            const currentUser = sessionStorage.getItem('klbk_currentUser');
            if(!currentUser) {
                Swal.fire('Hata', 'Oturum bilgisi bulunamadı', 'error');
                return;
            }

            Swal.fire({
                title: 'Hesap Ayarları',
                html: `
                    <div style="text-align: left; margin-top: 10px;">
                        <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Kullanıcı Adı</label>
                        <input type="text" id="profUser" class="form-control" value="${currentUser}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">

                        <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">E-Posta Adresi</label>
                        <input type="email" id="profEmail" class="form-control" placeholder="E-Posta" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">

                        <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Cinsiyet</label>
                        <select id="profGender" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">
                            <option value="erkek">Erkek</option>
                            <option value="kadin">Kadın</option>
                            <option value="diger">Belirtilmemiş</option>
                        </select>

                        <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Yeni Şifre</label>
                        <input type="password" id="profPass" class="form-control" placeholder="Değiştirmek istemiyorsanız boş bırakın" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">
                        
                        <hr style="margin: 15px 0; border: 0; border-top: 1px solid var(--gray-200);">
                        <label style="display:block; font-size: 0.85rem; font-weight: 700; color: var(--danger); margin-bottom: 4px;">Değişiklikleri Onaylamak İçin Güncel Şifreniz</label>
                        <input type="password" id="currentPassVerify" class="form-control" placeholder="Mevcut şifrenizi girin" style="width: 100%; padding: 0.75rem; border: 2px solid var(--danger); border-radius: 6px; font-family: inherit;">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Kaydet',
                cancelButtonText: 'İptal',
                didOpen: async () => {
                    Swal.showLoading();
                    try {
                        const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
                        if (res.ok) {
                            const db = await res.json();
                            if (db && db[currentUser]) {
                                const emailEl = document.getElementById('profEmail');
                                if (emailEl) emailEl.value = db[currentUser].email || '';
                                const genderEl = document.getElementById('profGender');
                                if (genderEl) genderEl.value = db[currentUser].gender || 'erkek';
                            }
                        }
                    } catch (e) { }
                    Swal.hideLoading();
                },
                preConfirm: async () => {
                    const newUsername = document.getElementById('profUser').value.trim();
                    const email = document.getElementById('profEmail').value.trim();
                    const gender = document.getElementById('profGender').value;
                    const pass = document.getElementById('profPass').value;
                    const currentPassVerify = document.getElementById('currentPassVerify').value;

                    if (!newUsername) {
                        Swal.showValidationMessage('Kullanıcı adı boş olamaz');
                        return false;
                    }
                    if (!currentPassVerify) {
                        Swal.showValidationMessage('İşlemi onaylamak için güncel şifrenizi girmelisiniz');
                        return false;
                    }

                    Swal.showLoading();
                    try {
                        const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
                        if (res.ok) {
                            const db = await res.json();
                            if (db) {
                                if (!db[currentUser]) {
                                    throw new Error("Kullanıcı bulunamadı!");
                                }

                                const passHash = await hashPassword(currentPassVerify);
                                if (db[currentUser].password !== currentPassVerify && db[currentUser].password !== passHash) {
                                    throw new Error("Güncel şifre yanlış!");
                                }

                                if (newUsername !== currentUser && db[newUsername]) {
                                    throw new Error("Bu kullanıcı adı zaten alınmış!");
                                }

                                const updatedUser = { ...db[currentUser] };
                                updatedUser.email = email;
                                updatedUser.gender = gender;

                                if (pass) {
                                    updatedUser.password = await hashPassword(pass);
                                }

                                if (newUsername !== currentUser) {
                                    db[newUsername] = updatedUser;
                                    delete db[currentUser];
                                } else {
                                    db[currentUser] = updatedUser;
                                }

                                const updateRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(db)
                                });

                                if (!updateRes.ok) throw new Error("Veritabanı güncellenemedi");

                                if (newUsername !== currentUser) {
                                    sessionStorage.setItem('klbk_currentUser', newUsername);
                                }
                            }
                        }
                    } catch (error) {
                        Swal.showValidationMessage(`Hata: ${error.message}`);
                        return false;
                    }
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Başarılı',
                        text: 'Profil ayarlarınız güncellendi. Sistem tutarlılığı için sayfa yenilenecektir.',
                        timer: 2500,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.reload();
                    });
                }
            });
        }

        async function handleYoklamaLogin() {
            const user = document.getElementById('loginUsername').value.trim();
            const pass = document.getElementById('loginPassword').value;
            
            if (!user || !pass) {
                Swal.fire('Hata', 'Lütfen kullanıcı adı ve şifrenizi girin.', 'warning');
                return;
            }

            Swal.fire({ title: 'Giriş Yapılıyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
                const users = await res.json();

                if (users && users[user]) {
                    const userObj = users[user];
                    const passHash = await hashPassword(pass);
                    
                    if (userObj.password === pass || userObj.password === passHash) {
                        sessionStorage.setItem('klbk_isLoggedIn', 'true');
                        sessionStorage.setItem('klbk_currentUser', user);
                        sessionStorage.setItem('klbk_role', userObj.role || 'ogretmen');
                        sessionStorage.setItem('klbk_name', userObj.name || user);
                        sessionStorage.setItem('klbk_storeKey', userObj.storeKey || ('klbk_data_' + user));
                        
                        window.location.reload();
                    } else {
                        Swal.fire('Hata', 'Şifre hatalı!', 'error');
                    }
                } else {
                    Swal.fire('Hata', 'Kullanıcı bulunamadı!', 'error');
                }
            } catch (e) {
                console.error("Giriş hatası:", e);
                Swal.fire('Hata', 'Bağlantı hatası oluştu.', 'error');
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            // 1. Auth Validation
            const isLoggedIn = sessionStorage.getItem('klbk_isLoggedIn') === 'true';
            const role = sessionStorage.getItem('klbk_role') || '';
            activeTeacherUsername = sessionStorage.getItem('klbk_currentUser') || '';

            if (!isLoggedIn || !activeTeacherUsername) {
                document.getElementById('loginPanel').style.display = 'flex';
                return;
            }
            
            // Close dropdown if clicked outside
            window.addEventListener('click', function(e) {
                if (!e.target.closest('.mobile-hamburger-menu')) {
                    const dropdowns = document.getElementsByClassName("dropdown-content");
                    for (let i = 0; i < dropdowns.length; i++) {
                        dropdowns[i].classList.remove('show');
                        dropdowns[i].style.zIndex = '1000';
                    }
                }
            });
            
            document.getElementById('appContainer').style.display = 'block';

            // Set welcome message
            const userRole = sessionStorage.getItem('klbk_role') || 'ogretmen';
            const roleDisplay = userRole === 'admin' ? 'Yönetici' : 'Öğretmen';
            
            document.getElementById('teacherWelcome').innerHTML = sessionStorage.getItem('klbk_name');
            document.getElementById('schoolDisplay').innerHTML = `<i class="fa-solid fa-user-tie"></i> ${roleDisplay}`;

            // Set default date to today and restrict min date to 14 days ago
            const todayObj = getTRTime();
            const minDateObj = getTRTime();
            minDateObj.setDate(todayObj.getDate() - 14);
            
            // Format dates accounting for local timezone issues
            const yyyy = todayObj.getFullYear();
            const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
            const dd = String(todayObj.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;
            
            const min_yyyy = minDateObj.getFullYear();
            const min_mm = String(minDateObj.getMonth() + 1).padStart(2, '0');
            const min_dd = String(minDateObj.getDate()).padStart(2, '0');
            const minDateStr = `${min_yyyy}-${min_mm}-${min_dd}`;
            
            const dateInput = document.getElementById('yoklamaDate');
            dateInput.value = todayStr;
            dateInput.setAttribute('min', minDateStr);

            // 2. Fetch Data
            Swal.fire({
                title: 'Veriler Yükleniyor',
                text: 'Lütfen bekleyin...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                // Fetch all users to get active teacher's schedule
                const usersRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
                if (usersRes.ok) {
                    teachersDb = await usersRes.json();
                    activeTeacherObject = teachersDb[activeTeacherUsername];
                }

                // Initialize DataManager
                await DataManager.initCloud();
                schoolData = DataManager.getSchoolSettings();
                allStudents = DataManager.getStudents();

                const debugInfoArea = document.getElementById('debugInfoArea');
                if (debugInfoArea) {
                    debugInfoArea.innerHTML = `Durum: Başarılı<br>Öğrenci: ${allStudents ? allStudents.length : 0}<br>Tarih: ${getTRTime().toLocaleTimeString()}`;
                    if (allStudents && allStudents.length > 0) {
                        debugInfoArea.style.display = 'none'; // Hide if successful
                    }
                }

                // Populate Class Dropdown
                populateClasses();

                // Populate Subject Dropdown
                populateSubjects();

                // Set default hour based on current time
                setDefaultLessonHour();

                // Auto detect class based on schedule
                checkAndAutoDetectClass();

                Swal.close();
            } catch (e) {
                console.error("Initialization error:", e);
                const debugInfoArea = document.getElementById('debugInfoArea');
                if (debugInfoArea) {
                    debugInfoArea.innerHTML = `HATA: ${e.message}<br>Lütfen sayfayı yenileyin.`;
                }
                Swal.fire('Hata', 'Veritabanına bağlanırken bir hata oluştu.', 'error');
            }
        });

        function populateClasses() {
            const classSelect = document.getElementById('classSelect');
            const statClassSelect = document.getElementById('statClassSelect');
            
            // Extract unique class names
            const classesArray = [];
            allStudents.forEach(s => {
                if (s.class) {
                    const c = s.class.trim();
                    if (c && classesArray.indexOf(c) === -1) {
                        classesArray.push(c);
                    }
                }
            });

            const sortedClasses = classesArray.sort((a, b) => {
                try {
                    return a.localeCompare(b, 'tr', { numeric: true, sensitivity: 'base' });
                } catch (e) {
                    return a > b ? 1 : (a < b ? -1 : 0);
                }
            });
            
            sortedClasses.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls;
                opt.textContent = cls;
                classSelect.appendChild(opt);
                
                if (statClassSelect) {
                    const opt2 = document.createElement('option');
                    opt2.value = cls;
                    opt2.textContent = cls;
                    statClassSelect.appendChild(opt2);
                }
            });
        }

        function populateSubjects() {
            const subjectSelect = document.getElementById('subjectSelect');
            const schoolSubjects = schoolData.subjects || [];
            const teacherBranches = (activeTeacherObject && activeTeacherObject.branch) || [];

            // Add teacher's own branches first
            if (teacherBranches.length > 0) {
                const grp = document.createElement('optgroup');
                grp.label = "Branşlarınız";
                teacherBranches.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    opt.textContent = sub;
                    grp.appendChild(opt);
                });
                subjectSelect.appendChild(grp);
            }

            // Add other subjects
            const otherSubjects = schoolSubjects.filter(s => !teacherBranches.includes(s));
            if (otherSubjects.length > 0) {
                const grp = document.createElement('optgroup');
                grp.label = "Diğer Dersler";
                otherSubjects.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    opt.textContent = sub;
                    grp.appendChild(opt);
                });
                subjectSelect.appendChild(grp);
            }

            // Pre-select first branch if available
            if (teacherBranches.length > 0) {
                subjectSelect.value = teacherBranches[0];
            }
        }

        function setDefaultLessonHour() {
            const now = getTRTime();
            const nowStr = now.toTimeString().slice(0, 5); // "HH:MM"
            const lessonTimes = schoolData.lessonTimes || {};
            
            let bestHour = ""; // Varsayılan boş
            for (let i = 1; i <= 20; i++) {
                const start = lessonTimes[`${i}_start`];
                const end = lessonTimes[`${i}_end`];
                if (start && end) {
                    if (nowStr >= start && nowStr <= end) {
                        bestHour = i.toString();
                        break; // Tam dersteyiz
                    }
                }
            }
            
            const hourSelect = document.getElementById('lessonHour');
            if (hourSelect) {
                hourSelect.value = bestHour;
            }
        }

        function checkAndAutoDetectClass() {
            if (!activeTeacherObject || !activeTeacherObject.schedule) {
                loadStudentList();
                return;
            }

            const selectedDateVal = document.getElementById('yoklamaDate').value;
            if (!selectedDateVal) {
                loadStudentList();
                return;
            }

            // Map Date object's day index to schedule day key
            const [y, m, dNum] = selectedDateVal.split('-');
            const d = new Date(y, parseInt(m) - 1, dNum);
            const dayMap = { 1: 'Pa', 2: 'Sa', 3: 'Ça', 4: 'Pe', 5: 'Cu', 6: 'Ct', 0: 'Pz' };
            const dayKey = dayMap[d.getDay()];

            const hourVal = document.getElementById('lessonHour').value;

            if (dayKey && hourVal) {
                const schedClass = activeTeacherObject.schedule[dayKey] ? activeTeacherObject.schedule[dayKey][hourVal] : undefined;
                if (schedClass && schedClass !== '-') {
                    // Match found! Auto-select it
                    const classSelect = document.getElementById('classSelect');
                    
                    const cleanString = str => (str || '').toString().toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '');
                    const cleanSchedClass = cleanString(schedClass);
                    
                    // Check if class exists in dropdown options (fuzzy match)
                    const options = Array.from(classSelect.options);
                    const matchedOption = options.find(o => cleanString(o.value) === cleanSchedClass);

                    if (matchedOption) {
                        classSelect.value = matchedOption.value;
                        
                        // Ders (Subject) seçimini de otomatik yap
                        const subjectSelect = document.getElementById('subjectSelect');
                        let foundSubject = false;
                        
                        // --- 1. Kullanıcının ataç ile sabitlediği bir tercih var mı? ---
                        const dbData = DataManager._getData();
                        const overrideKey = `${dayKey}_${hourVal}_${matchedOption.value}`;
                        if (dbData.subjectOverrides && dbData.subjectOverrides[activeTeacherUsername] && dbData.subjectOverrides[activeTeacherUsername][overrideKey]) {
                            const pinnedSubject = dbData.subjectOverrides[activeTeacherUsername][overrideKey];
                            const hasOption = Array.from(subjectSelect.options).some(o => o.value === pinnedSubject);
                            if (hasOption) {
                                subjectSelect.value = pinnedSubject;
                                foundSubject = true;
                            }
                        }
                        
                        // 2. Eğer program hücresinde ders adı geçiyorsa (Örn: "10A - Seçmeli Fizik")
                        if (!foundSubject && activeTeacherObject.branch) {
                            for (let br of activeTeacherObject.branch) {
                                if (schedClass.toLocaleUpperCase('tr-TR').includes(br.toLocaleUpperCase('tr-TR'))) {
                                    subjectSelect.value = br;
                                    foundSubject = true;
                                    break;
                                }
                            }
                        }
                        
                        // 2. Eğer geçmiyorsa (sadece "10A" ise) öğretmenin ana (ilk) branşını seç
                        if (!foundSubject && activeTeacherObject.branch && activeTeacherObject.branch.length > 0) {
                            subjectSelect.value = activeTeacherObject.branch[0];
                        }

                        document.getElementById('autoDetectAlert').classList.remove('hidden');
                        loadStudentList();
                        return;
                    }
                }
            }

            document.getElementById('autoDetectAlert').classList.add('hidden');
            loadStudentList();
        }

        async function saveSubjectOverride() {
            const dateVal = document.getElementById('yoklamaDate').value;
            const hourVal = document.getElementById('lessonHour').value;
            const classVal = document.getElementById('classSelect').value;
            const subjectVal = document.getElementById('subjectSelect').value;

            if (!dateVal || !hourVal || !classVal || !subjectVal) {
                Swal.fire('Eksik Bilgi', 'Sabitleme yapmak için tarih, saat, sınıf ve ders seçilmiş olmalıdır.', 'warning');
                return;
            }

            const [y, m, dNum] = dateVal.split('-');
            const d = new Date(y, parseInt(m) - 1, dNum);
            const dayMap = { 1: 'Pa', 2: 'Sa', 3: 'Ça', 4: 'Pe', 5: 'Cu', 6: 'Ct', 0: 'Pz' };
            const dayKey = dayMap[d.getDay()];

            if (!dayKey) return;

            try {
                const dbData = DataManager._getData();
                dbData.subjectOverrides = dbData.subjectOverrides || {};
                dbData.subjectOverrides[activeTeacherUsername] = dbData.subjectOverrides[activeTeacherUsername] || {};
                
                const overrideKey = `${dayKey}_${hourVal}_${classVal}`;
                dbData.subjectOverrides[activeTeacherUsername][overrideKey] = subjectVal;

                await DataManager._saveData(dbData);
                
                let dayName = d.toLocaleDateString('tr-TR', { weekday: 'long' });
                Swal.fire({
                    icon: 'success',
                    title: 'Ders Sabitlendi',
                    text: `${dayName} ${hourVal}. ders ${classVal} sınıfı için "${subjectVal}" dersi varsayılan olarak kaydedildi. Artık bu gün ve saatte hep bu ders seçili gelecek.`,
                    timer: 3000,
                    showConfirmButton: false
                });
            } catch (e) {
                console.error("Override save error:", e);
                Swal.fire('Hata', 'Sabitleme kaydedilemedi.', 'error');
            }
        }

        function loadStudentList() {
            const classVal = document.getElementById('classSelect').value;
            const subjectVal = document.getElementById('subjectSelect').value;
            const emptyState = document.getElementById('emptyState');
            const studentListContainer = document.getElementById('studentListContainer');

            // --- 1. Henüz gelmemiş gün/saat kontrolü ---
            const selectedDateVal = document.getElementById('yoklamaDate').value;
            const hourVal = document.getElementById('lessonHour').value;
            
            if (selectedDateVal) {
                const now = getTRTime();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;
                
                if (selectedDateVal > todayStr) {
                    emptyState.innerHTML = `<i class="fa-solid fa-calendar-xmark" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>
                    Gelecek bir tarihin yoklamasını alamazsınız.`;
                    emptyState.classList.remove('hidden');
                    studentListContainer.classList.add('hidden');
                    return;
                }
                
                if (selectedDateVal === todayStr && hourVal) {
                    const lessonTimes = schoolData.lessonTimes || {};
                    const startStr = lessonTimes[`${hourVal}_start`];
                    if (startStr) {
                        const nowStr = now.toTimeString().slice(0, 5); // "HH:MM"
                        if (nowStr < startStr) {
                            emptyState.innerHTML = `<i class="fa-solid fa-clock" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>
                            <span style="color:#ef4444; font-weight:bold;">${hourVal}. ders henüz başlamadı!</span><br>
                            <small>(Ders Başlangıcı: ${startStr} | Şu Anki Saat: ${nowStr})</small>`;
                            emptyState.classList.remove('hidden');
                            studentListContainer.classList.add('hidden');
                            return;
                        }
                    }
                }
            }

            // Sabitleme butonunun görünürlüğü
            if (classVal && subjectVal) {
                document.getElementById('btnPinSubject').style.display = 'block';
            } else {
                document.getElementById('btnPinSubject').style.display = 'none';
            }

            if (!classVal) {
                emptyState.innerHTML = `<i class="fa-solid fa-users-rectangle" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>
                Lütfen sınıf ve ders saati seçin...`;
                emptyState.classList.remove('hidden');
                studentListContainer.classList.add('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            studentListContainer.classList.remove('hidden');

            // Filter students by class and subject
            activeClassStudents = allStudents.filter(s => {
                if (!s.class || s.class.trim() !== classVal.trim()) return false;
                
                // If student has a defined lessons array, they must be taking the selected subject
                if (subjectVal && s.dersler && Array.isArray(s.dersler) && s.dersler.length > 0) {
                    const cleanStr = str => (str || '').toString().toLocaleUpperCase('tr-TR').replace(/[^A-ZÇĞIİÖŞÜ0-9]/g, '');
                    const cleanSubject = cleanStr(subjectVal);
                    
                    const takesLesson = s.dersler.some(lessonName => {
                        const cleanLesson = cleanStr(lessonName);
                        return cleanLesson.includes(cleanSubject) || cleanSubject.includes(cleanLesson);
                    });
                    
                    if (!takesLesson) return false;
                }
                
                return true;
            });
            
            const sortVal = document.getElementById('sortSelect') ? document.getElementById('sortSelect').value : 'no';
            if (sortVal === 'name') {
                activeClassStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
            } else {
                activeClassStudents.sort((a, b) => (parseInt(a.no) || 0) - (parseInt(b.no) || 0));
            }

            document.getElementById('totalStudentsDisplay').textContent = activeClassStudents.length;

            // Load existing attendance if any
            loadExistingAttendanceRecord();
        }

        function loadExistingAttendanceRecord() {
            const dateVal = document.getElementById('yoklamaDate').value;
            const hourVal = document.getElementById('lessonHour').value;
            const classVal = document.getElementById('classSelect').value;

            // Fetch data from local DataManager memory
            const dbData = DataManager._getData();
            dbData.attendance = dbData.attendance || {};

            attendanceMap = {};
            gecTimeMap = {};

            const lessonRecord = (dbData.attendance[dateVal] && dbData.attendance[dateVal][hourVal]) ? dbData.attendance[dateVal][hourVal][classVal] : undefined;
            if (lessonRecord) {
                attendanceMap = lessonRecord.records || {};
                gecTimeMap = lessonRecord.gecTimes || {};
                
                // Pre-fill lesson subject if saved
                if (lessonRecord.subject) {
                    document.getElementById('subjectSelect').value = lessonRecord.subject;
                }

                document.getElementById('lastSaveDisplay').textContent = lessonRecord.lastUpdated || 'Kaydedildi';
            } else {
                document.getElementById('lastSaveDisplay').textContent = 'Kaydedilmedi';
            }

            // For students that don't have a record, set to 'GELDİ' by default
            activeClassStudents.forEach(s => {
                if (!attendanceMap[s.no]) {
                    attendanceMap[s.no] = 'GELDİ';
                }
            });

            renderStudentsTable();
            updateLiveCounters();
        }

        function renderStudentsTable() {
            const tbody = document.getElementById('studentTableBody');
            tbody.innerHTML = '';

            if (activeClassStudents.length === 0) {
                tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:2rem; color:var(--gray-400);">Bu sınıfta öğrenci bulunamadı.</td></tr>`;
                return;
            }

            activeClassStudents.forEach(s => {
                const currentStatus = attendanceMap[s.no] === 'BOŞ' ? 'BOŞ' : (attendanceMap[s.no] || 'GELDİ');
                
                const tr = document.createElement('tr');
                tr.className = "student-row";
                tr.setAttribute('data-no', s.no);
                tr.setAttribute('data-search', `${s.no} ${s.name} ${s.surname || ''}`.toLowerCase());

                const isNobetci = currentStatus === 'NÖBETÇİ';
                const mainBorder = isNobetci ? 'red' : 'var(--primary)';
                const headerBg = isNobetci ? '#e5e7eb' : '#f8fafc';
                const headerBorder = isNobetci ? 'red' : 'var(--primary-light)';
                const textColor = isNobetci ? 'red' : 'var(--dark)';
                const noColor = isNobetci ? 'red' : 'var(--primary)';

                const buttons = `
                    <button type="button" class="status-btn ${(currentStatus === 'GELDİ' || isNobetci) ? 'active' : ''}" data-status="GELDİ" onclick="setStudentStatus('${s.no}', 'GELDİ')" ondblclick="setStudentStatus('${s.no}', 'NÖBETÇİ')" oncontextmenu="event.preventDefault(); setStudentStatus('${s.no}', 'NÖBETÇİ');" title="Geldi (Çift Tıkla/Basılı Tut: Nöbetçi)">
                        <i class="fa-solid fa-plus" style="color: ${isNobetci ? 'var(--dark)' : ''};"></i>
                    </button>
                    <button type="button" class="status-btn ${currentStatus === 'GELMEDİ' ? 'active' : ''}" data-status="GELMEDİ" onclick="setStudentStatus('${s.no}', 'GELMEDİ')" title="Gelmedi">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <button type="button" class="status-btn ${currentStatus === 'GEÇ' ? 'active' : ''}" data-status="GEÇ" onclick="setStudentStatus('${s.no}', 'GEÇ')" title="Geç">
                        <i class="fa-solid fa-clock"></i>
                    </button>
                    <button type="button" class="status-btn ${currentStatus === 'DİĞER' ? 'active' : ''}" data-status="DİĞER" onclick="setStudentStatus('${s.no}', 'DİĞER')" title="Diğer">
                        <i class="fa-solid fa-certificate" style="color: #0284c7;"></i>
                    </button>
                    <button type="button" class="status-btn ${currentStatus === 'BOŞ' ? 'active' : ''}" data-status="BOŞ" onclick="setStudentStatus('${s.no}', 'BOŞ')" style="color:var(--dark); border-color:#e2e8f0; background:#f1f5f9;" title="Sıfırla">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;

                tr.innerHTML = `
                    <td style="padding: 0; border: 2px solid ${mainBorder}; border-radius: 8px; overflow: hidden; display: block; margin-bottom: 1rem; width: 100%; box-sizing: border-box;">
                        <div style="display: flex; align-items: center; gap: 10px; padding: 12px 15px; background: ${headerBg}; border-bottom: 1px solid ${headerBorder}; box-sizing: border-box;">
                            <div class="student-avatar" style="flex-shrink:0; width: 36px; height: 36px; font-size: 0.9rem; color: ${textColor}; border-color: ${textColor};">${s.name ? s.name.charAt(0) : '?'}</div>
                            <span class="student-no" style="font-size: 1rem; font-weight: 700; color: ${noColor}; flex-shrink: 0;">${s.no}</span>
                            <span class="student-name" style="font-size: 0.95rem; font-weight: 600; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;">${s.name} ${s.surname || ''} ${isNobetci ? '(NÖBETÇİ)' : ''}</span>
                            ${currentStatus === 'GEÇ' && gecTimeMap[s.no] !== undefined ? `
                                <div class="late-time-ui" style="display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:16px; padding:2px 6px; color:var(--gec-color); flex-shrink:0;">
                                    <span onclick="event.preventDefault(); event.stopPropagation(); window.adjustGecTime('${s.no}', -1)" style="width:22px; height:22px; background:var(--gec-color); color:white; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(245,158,11,0.3);">-</span>
                                    <span class="late-time-text" style="font-size:0.85rem; font-weight:800; min-width:20px; text-align:center;">${gecTimeMap[s.no]}m</span>
                                    <span onclick="event.preventDefault(); event.stopPropagation(); window.adjustGecTime('${s.no}', 1)" style="width:22px; height:22px; background:var(--gec-color); color:white; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(245,158,11,0.3);">+</span>
                                </div>
                            ` : ''}
                        </div>
                        <div style="padding: 12px 10px; background: white;">
                            <div class="status-button-group" style="display: flex; gap: 8px; justify-content: center; width: 100%;">
                                ${buttons}
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function setNobetciForAllHours(studentNo, isNobetci) {
            const dateVal = document.getElementById('yoklamaDate').value;
            const classVal = document.getElementById('classSelect').value;
            const dbData = DataManager._getData();
            dbData.attendance = dbData.attendance || {};
            if (!dbData.attendance[dateVal]) dbData.attendance[dateVal] = {};

            for (let i = 1; i <= 8; i++) {
                let hourStr = i.toString();
                if (!dbData.attendance[dateVal][hourStr]) dbData.attendance[dateVal][hourStr] = {};
                if (!dbData.attendance[dateVal][hourStr][classVal]) {
                    dbData.attendance[dateVal][hourStr][classVal] = { records: {} };
                }
                if (!dbData.attendance[dateVal][hourStr][classVal].records) {
                    dbData.attendance[dateVal][hourStr][classVal].records = {};
                }
                
                if (isNobetci) {
                    dbData.attendance[dateVal][hourStr][classVal].records[studentNo] = 'NÖBETÇİ';
                } else {
                    if (dbData.attendance[dateVal][hourStr][classVal].records[studentNo] === 'NÖBETÇİ') {
                        delete dbData.attendance[dateVal][hourStr][classVal].records[studentNo];
                    }
                }
            }
            
            DataManager._saveData(dbData);
            
            if (isNobetci) {
                attendanceMap[studentNo] = 'NÖBETÇİ';
            } else {
                attendanceMap[studentNo] = 'BOŞ';
            }
            delete gecTimeMap[studentNo];
            
            loadExistingAttendanceRecord();
            Swal.fire({
                icon: 'success',
                title: 'Başarılı',
                text: isNobetci ? 'Öğrenci tüm gün için nöbetçi olarak işaretlendi.' : 'Durum sıfırlandı.',
                timer: 1500,
                showConfirmButton: false
            });
        }

        function setStudentStatus(studentNo, status) {
            if (status === 'NÖBETÇİ') {
                Swal.fire({
                    title: 'Nöbetçi Olarak İşaretle',
                    text: 'Öğrenci bu günün tüm dersleri için "Nöbetçi" olarak işaretlenecek. Onaylıyor musunuz?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, İşaretle',
                    cancelButtonText: 'İptal'
                }).then((result) => {
                    if (result.isConfirmed) {
                        setNobetciForAllHours(studentNo, true);
                    }
                });
                return;
            }

            if (status === 'BOŞ') {
                Swal.fire({
                    title: 'Yoklamayı Sıfırla',
                    text: 'Öğrencinin yoklama durumu sıfırlanacak. Emin misiniz?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Sıfırla',
                    cancelButtonText: 'İptal'
                }).then((result) => {
                    if (result.isConfirmed) {
                        if (attendanceMap[studentNo] === 'NÖBETÇİ') {
                            setNobetciForAllHours(studentNo, false);
                        } else {
                            attendanceMap[studentNo] = 'BOŞ';
                            delete gecTimeMap[studentNo];
                            
                            const row = document.querySelector(`.student-row[data-no="${studentNo}"]`);
                            if (row) {
                                row.style.opacity = '1';
                                const buttons = row.querySelectorAll('.status-btn');
                                buttons.forEach(btn => {
                                    if (btn.getAttribute('data-status') === 'BOŞ') {
                                        btn.classList.add('active');
                                    } else {
                                        btn.classList.remove('active');
                                    }
                                });
                                const topBar = row.querySelector('div[style*="background:"]');
                                if (topBar) {
                                    let existingLateUi = topBar.querySelector('.late-time-ui');
                                    if (existingLateUi) existingLateUi.remove();
                                }
                            }
                            updateLiveCounters();
                            saveAttendance(true);
                        }
                    }
                });
                return;
            }

            if (attendanceMap[studentNo] === status) {
                // If they click the same status, toggle it OFF (delete it)
                delete attendanceMap[studentNo];
                delete gecTimeMap[studentNo];
                
                const row = document.querySelector(`.student-row[data-no="${studentNo}"]`);
                if (row) {
                    row.style.opacity = '1';
                    const buttons = row.querySelectorAll('.status-btn');
                    buttons.forEach(btn => btn.classList.remove('active'));
                    
                    const topBar = row.querySelector('div[style*="background: #f8fafc"]');
                    if (topBar) {
                        let existingLateUi = topBar.querySelector('.late-time-ui');
                        if (existingLateUi) existingLateUi.remove();
                    }
                }
                saveAttendance(true);
                return;
            } else if (status === 'GEÇ') {
                attendanceMap[studentNo] = status;
                const hourVal = document.getElementById('lessonHour').value;
                const lessonTimes = schoolData.lessonTimes || {};
                const start = lessonTimes[`${hourVal}_start`];
                if (start) {
                    const now = getTRTime();
                    const [startH, startM] = start.split(':').map(Number);
                    const startTotalM = startH * 60 + startM;
                    const nowTotalM = now.getHours() * 60 + now.getMinutes();
                    let diff = nowTotalM - startTotalM;
                    if (diff < 0) diff = 0;
                    gecTimeMap[studentNo] = diff;
                }
            } else {
                attendanceMap[studentNo] = status;
                delete gecTimeMap[studentNo];
                
                // Remove late time UI if exists
                const row = document.querySelector(`.student-row[data-no="${studentNo}"]`);
                if (row) {
                    const topBar = row.querySelector('div[style*="background: #f8fafc"]');
                    if (topBar) {
                        let existingLateUi = topBar.querySelector('.late-time-ui');
                        if (existingLateUi) existingLateUi.remove();
                    }
                }
            }
            
            const row = document.querySelector(`.student-row[data-no="${studentNo}"]`);
            if (row) {
                row.style.opacity = '1';
                const buttons = row.querySelectorAll('.status-btn');
                buttons.forEach(btn => {
                    const btnStatus = btn.getAttribute('data-status');
                    if (btnStatus === status) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                // Dynamically update the Late Time UI next to the student name
                const topBar = row.querySelector('div[style*="background: #f8fafc"]');
                if (topBar) {
                    let existingLateUi = topBar.querySelector('.late-time-ui');
                    if (status === 'GEÇ' && gecTimeMap[studentNo] !== undefined) {
                        if (!existingLateUi) {
                            let lateDiv = document.createElement('div');
                            lateDiv.className = 'late-time-ui';
                            lateDiv.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:16px; padding:2px 6px; color:var(--gec-color); flex-shrink:0;';
                            lateDiv.innerHTML = `
                                <span onclick="event.preventDefault(); event.stopPropagation(); window.adjustGecTime('${studentNo}', -1)" style="width:22px; height:22px; background:var(--gec-color); color:white; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(245,158,11,0.3);">-</span>
                                <span class="late-time-text" style="font-size:0.85rem; font-weight:800; min-width:20px; text-align:center;">${gecTimeMap[studentNo]}m</span>
                                <span onclick="event.preventDefault(); event.stopPropagation(); window.adjustGecTime('${studentNo}', 1)" style="width:22px; height:22px; background:var(--gec-color); color:white; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(245,158,11,0.3);">+</span>
                            `;
                            topBar.appendChild(lateDiv);
                        } else {
                            existingLateUi.querySelector('.late-time-text').textContent = `${gecTimeMap[studentNo]}m`;
                        }
                    } else {
                        if (existingLateUi) {
                            existingLateUi.remove();
                        }
                    }
                }
            }

            updateLiveCounters();
            saveAttendance(true);
        }

        window.adjustGecTime = function(studentNo, change) {
            let current = gecTimeMap[studentNo] || 0;
            current += change;
            if (current < 0) current = 0;
            gecTimeMap[studentNo] = current;
            const row = document.querySelector(`.student-row[data-no="${studentNo}"]`);
            if (row) {
                const lateText = row.querySelector('.late-time-text');
                if (lateText) {
                    lateText.textContent = `${current}m`;
                }
            }
            saveAttendance(true);
        };

        function setAllAttendance(status) {
            activeClassStudents.forEach(s => {
                attendanceMap[s.no] = status;
                delete gecTimeMap[s.no];
            });
            renderStudentsTable();
            updateLiveCounters();
            saveAttendance(true);
        }

        function updateLiveCounters() {
            let geldi = 0, gelmedi = 0, gec = 0, diger = 0;
            
            Object.values(attendanceMap).forEach(v => {
                if (v === 'GELDİ' || v === 'NÖBETÇİ') geldi++;
                else if (v === 'GELMEDİ') gelmedi++;
                else if (v === 'GEÇ') gec++;
                else if (v === 'DİĞER') diger++;
            });

            document.getElementById('countGeldi').textContent = geldi;
            document.getElementById('countGelmedi').textContent = gelmedi;
            document.getElementById('countGec').textContent = gec;
            document.getElementById('countRahatsiz').textContent = diger;
        }

        function filterStudents() {
            const query = document.getElementById('studentSearch').value.toLowerCase().trim();
            const rows = document.querySelectorAll('.student-row');
            
            rows.forEach(row => {
                const searchStr = row.getAttribute('data-search');
                if (searchStr.includes(query)) {
                    row.classList.remove('hidden');
                } else {
                    row.classList.add('hidden');
                }
            });
        }

        async function saveAttendance(silent = false) {
            const dateVal = document.getElementById('yoklamaDate').value;
            const hourVal = document.getElementById('lessonHour').value;
            const classVal = document.getElementById('classSelect').value;
            const subjectVal = document.getElementById('subjectSelect').value;

            if (!classVal) {
                if (!silent) Swal.fire('Hata', 'Lütfen sınıf seçin!', 'error');
                return;
            }

            if (!subjectVal) {
                if (!silent) Swal.fire('Hata', 'Lütfen ders seçin!', 'error');
                return;
            }

            if (!silent) {
                // Check if any student is left empty (or 'BOŞ')
                const unsetCount = activeClassStudents.filter(s => {
                    const status = attendanceMap[s.no];
                    return !status || status === 'BOŞ';
                }).length;

                if (unsetCount > 0) {
                    Swal.fire({
                        title: 'Eksik Yoklama!',
                        html: `Sınıfta durumu seçilmemiş <b>${unsetCount}</b> öğrenci var.<br>Lütfen tüm öğrencilerin yoklamasını tamamlayın.`,
                        icon: 'warning',
                        confirmButtonText: 'Tamam',
                        confirmButtonColor: '#f59e0b'
                    });
                    return;
                }

                Swal.fire({
                    title: 'Kaydediliyor',
                    text: 'Yoklama buluta yükleniyor...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
            }

            try {
                // Fetch full data
                const dbData = DataManager._getData();
                dbData.attendance = dbData.attendance || {};
                dbData.attendance[dateVal] = dbData.attendance[dateVal] || {};
                dbData.attendance[dateVal][hourVal] = dbData.attendance[dateVal][hourVal] || {};
                
                let currentTeacher = sessionStorage.getItem('klbk_name') || activeTeacherUsername;
                let existingRecord = dbData.attendance[dateVal][hourVal][classVal];
                let finalTeacherName = currentTeacher;
                
                if (existingRecord && existingRecord.teacherName && !existingRecord.teacherName.includes(currentTeacher)) {
                    finalTeacherName = existingRecord.teacherName + ' / ' + currentTeacher;
                }
                
                // Save record
                dbData.attendance[dateVal][hourVal][classVal] = {
                    teacher: activeTeacherUsername,
                    teacherName: finalTeacherName,
                    subject: subjectVal,
                    records: attendanceMap,
                    gecTimes: gecTimeMap,
                    lastUpdated: getTRTime().toLocaleTimeString('tr-TR') + ' ' + getTRTime().toLocaleDateString('tr-TR')
                };

                // Sync via DataManager
                await DataManager._saveData(dbData);

                document.getElementById('lastSaveDisplay').textContent = dbData.attendance[dateVal][hourVal][classVal].lastUpdated;

                if (!silent) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Başarıyla Kaydedildi',
                        text: 'Yoklama verisi sisteme işlendi ve buluta aktarıldı.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }

                // If history is loaded, refresh it (only if not silent to avoid UI flicker)
                if (!silent) loadHistory();

            } catch (e) {
                console.error("Save attendance error:", e);
                if (!silent) Swal.fire('Hata', 'Yoklama kaydedilemedi. Lütfen bağlantınızı kontrol edin.', 'error');
            }
        }

        // --- Tab Switching Logic ---
        function switchTab(tabName) {
            const tabYoklama = document.getElementById('tabYoklama');
            const tabGecmis = document.getElementById('tabGecmis');
            const tabIstatistik = document.getElementById('tabIstatistik');
            
            const btnYoklama = document.getElementById('btnTabYoklama');
            const btnGecmis = document.getElementById('btnTabGecmis');
            const btnIstatistik = document.getElementById('btnTabIstatistik');

            [tabYoklama, tabGecmis, tabIstatistik].forEach(t => { if(t) t.classList.add('hidden'); });
            [btnYoklama, btnGecmis, btnIstatistik].forEach(b => {
                if(b) {
                    b.className = 'btn btn-secondary';
                    b.style.background = 'white';
                    b.style.color = 'var(--gray-600)';
                }
            });

            if (tabName === 'yoklama') {
                tabYoklama.classList.remove('hidden');
                if(btnYoklama) {
                    btnYoklama.className = 'btn btn-primary';
                    btnYoklama.style.background = '';
                    btnYoklama.style.color = '';
                }
            } else if (tabName === 'gecmis') {
                tabGecmis.classList.remove('hidden');
                if(btnGecmis) {
                    btnGecmis.className = 'btn btn-primary';
                    btnGecmis.style.background = '';
                    btnGecmis.style.color = '';
                }
                loadHistory();
            } else if (tabName === 'istatistik') {
                tabIstatistik.classList.remove('hidden');
                if(btnIstatistik) {
                    btnIstatistik.className = 'btn btn-primary';
                    btnIstatistik.style.background = '';
                    btnIstatistik.style.color = '';
                }
                loadStatistics();
            }
        }

        function loadHistory() {
            const container = document.getElementById('historyListContainer');
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-500);"><i class="fa-solid fa-spinner fa-spin"></i> Geçmiş yoklamalar yükleniyor...</div>';

            const dbData = DataManager._getData();
            const attendance = dbData.attendance || {};

            const historyList = [];
            
            const minDateObj = getTRTime();
            minDateObj.setDate(getTRTime().getDate() - 14);
            const min_yyyy = minDateObj.getFullYear();
            const min_mm = String(minDateObj.getMonth() + 1).padStart(2, '0');
            const min_dd = String(minDateObj.getDate()).padStart(2, '0');
            const minDateStr = `${min_yyyy}-${min_mm}-${min_dd}`;

            // Filter records taken by this teacher within the last 14 days
            for (const date in attendance) {
                if (date < minDateStr) continue;
                for (const hour in attendance[date]) {
                    for (const cls in attendance[date][hour]) {
                        const record = attendance[date][hour][cls];
                        if (record.teacher === activeTeacherUsername) {
                            // Count statuses
                            let gelmedi = 0, gec = 0, diger = 0;
                            Object.values(record.records || {}).forEach(v => {
                                if (v === 'GELMEDİ') gelmedi++;
                                else if (v === 'GEÇ') gec++;
                                else if (v === 'DİĞER') diger++;
                            });

                            historyList.push({
                                date,
                                hour,
                                class: cls,
                                subject: record.subject,
                                lastUpdated: record.lastUpdated,
                                stats: { gelmedi, gec, diger }
                            });
                        }
                    }
                }
            }

            // Sort by date descending, hour descending
            historyList.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return parseInt(b.hour) - parseInt(a.hour);
            });

            if (historyList.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--gray-500);">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>
                    Son 14 güne ait alınmış bir yoklama kaydınız bulunmuyor.
                </div>`;
                return;
            }

            let html = '';
            historyList.forEach(item => {
                html += `
                    <div class="history-card">
                        <div>
                            <div style="font-weight: 800; font-size: 1.05rem; color: var(--primary);">
                                ${item.class} - ${item.subject}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--gray-500); margin-top: 4px;">
                                <i class="fa-solid fa-calendar"></i> ${item.date} | <i class="fa-solid fa-clock"></i> ${item.hour}. Ders | Güncelleme: ${item.lastUpdated}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px; margin-top: 10px;">
                            <div style="display: flex; gap: 6px;">
                                <span class="stat-badge gelmedi">Gelmedi: ${item.stats.gelmedi}</span>
                                <span class="stat-badge gec">Geç: ${item.stats.gec}</span>
                                <span class="stat-badge diger">Diğer: ${item.stats.diger}</span>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary btn-sm" onclick="editPastAttendance('${item.date}', '${item.hour}', '${item.class}')">
                                    <i class="fa-solid fa-pen-to-square"></i> Düzenle
                                </button>
                                <button class="btn btn-sm" style="background:#fef2f2; color:#ef4444; border:1px solid #fecaca; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 5px; transition: all 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" onclick="deletePastAttendance('${item.date}', '${item.hour}', '${item.class}')">
                                    <i class="fa-solid fa-trash"></i> Sil
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function deletePastAttendance(date, hour, className) {
            Swal.fire({
                title: 'Onay ve Şifre',
                text: `${date} tarihli ${hour}. ders ${className} sınıfı yoklaması kalıcı olarak silinecek! Lütfen şifrenizi girin.`,
                icon: 'warning',
                input: 'password',
                inputPlaceholder: 'Şifrenizi girin',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'İptal',
                preConfirm: (password) => {
                    if (password !== '1234') {
                        Swal.showValidationMessage('Hatalı şifre girdiniz!');
                        return false;
                    }
                    return true;
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const dbData = DataManager._getData();
                        if (dbData.attendance && dbData.attendance[date] && dbData.attendance[date][hour]) {
                            delete dbData.attendance[date][hour][className];
                            
                            // Cleanup empty objects
                            if (Object.keys(dbData.attendance[date][hour]).length === 0) delete dbData.attendance[date][hour];
                            if (Object.keys(dbData.attendance[date]).length === 0) delete dbData.attendance[date];

                            await DataManager._saveData(dbData);
                            
                            Swal.fire({
                                icon: 'success',
                                title: 'Silindi!',
                                text: 'Yoklama kaydı başarıyla silindi.',
                                timer: 1500,
                                showConfirmButton: false
                            });
                            loadHistory();
                        }
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Hata', 'Yoklama silinemedi.', 'error');
                    }
                }
            });
        }

        function promptDeleteAllRecords() {
            Swal.fire({
                title: 'Tüm Yoklamaları Sil',
                text: 'Son 14 gündeki tüm yoklama kayıtlarınız kalıcı olarak silinecek! Lütfen şifrenizi girin.',
                icon: 'warning',
                input: 'password',
                inputPlaceholder: 'Şifrenizi girin',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Hepsini Sil',
                cancelButtonText: 'İptal',
                preConfirm: (password) => {
                    if (password !== '1234') {
                        Swal.showValidationMessage('Hatalı şifre girdiniz!');
                        return false;
                    }
                    return true;
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const dbData = DataManager._getData();
                        if (dbData.attendance) {
                            let deletedCount = 0;
                            const minDateObj = getTRTime();
                            minDateObj.setDate(getTRTime().getDate() - 14);
                            const min_yyyy = minDateObj.getFullYear();
                            const min_mm = String(minDateObj.getMonth() + 1).padStart(2, '0');
                            const min_dd = String(minDateObj.getDate()).padStart(2, '0');
                            const minDateStr = `${min_yyyy}-${min_mm}-${min_dd}`;

                            for (let date in dbData.attendance) {
                                if (date < minDateStr) continue;
                                for (let hour in dbData.attendance[date]) {
                                    for (let cls in dbData.attendance[date][hour]) {
                                        const record = dbData.attendance[date][hour][cls];
                                        if (record.teacher === activeTeacherUsername) {
                                            delete dbData.attendance[date][hour][cls];
                                            deletedCount++;
                                        }
                                    }
                                    if (Object.keys(dbData.attendance[date][hour]).length === 0) delete dbData.attendance[date][hour];
                                }
                                if (Object.keys(dbData.attendance[date]).length === 0) delete dbData.attendance[date];
                            }
                            
                            if (deletedCount > 0) {
                                await DataManager._saveData(dbData);
                                Swal.fire({
                                    icon: 'success',
                                    title: 'Silindi!',
                                    text: `${deletedCount} adet yoklama kaydı başarıyla silindi.`,
                                    timer: 1500,
                                    showConfirmButton: false
                                });
                                loadHistory();
                            } else {
                                Swal.fire('Bilgi', 'Silinecek size ait bir yoklama bulunamadı.', 'info');
                            }
                        }
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Hata', 'Tüm yoklamalar silinirken bir hata oluştu.', 'error');
                    }
                }
            });
        }

        function editPastAttendance(date, hour, className) {
            document.getElementById('yoklamaDate').value = date;
            document.getElementById('lessonHour').value = hour;
            document.getElementById('classSelect').value = className;

            switchTab('yoklama');
            loadStudentList();

            // Highlight animation on the students list panel to guide the teacher
            const listPanel = document.getElementById('studentListContainer');
            listPanel.style.animation = 'none';
            listPanel.offsetHeight; // trigger reflow
            listPanel.style.animation = 'pulse-blue 1.5s ease-out';
        }

        function logout() {
            sessionStorage.clear();
            localStorage.removeItem('klbk_persistent_session');
            window.location.href = '/k9x7v2m4';
        }
        // Global utility to pad zero
        function padZero(num) {
            return num < 10 ? '0' + num : num;
        }

        
        let currentStatSortCol = 'gelmedi';
        let currentStatSortOrder = 'desc';
        let currentStatsArr = [];

        function handleStatSort(col) {
            if (currentStatSortCol === col) {
                currentStatSortOrder = currentStatSortOrder === 'desc' ? 'asc' : 'desc';
            } else {
                currentStatSortCol = col;
                currentStatSortOrder = 'desc';
            }
            renderStatisticsTable();
        }

        function loadStatistics() {
            const container = document.getElementById('statisticsContainer');
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-500);"><i class="fa-solid fa-spinner fa-spin"></i> Hesaplanıyor...</div>';

            const timeRange = document.getElementById('statTimeRange').value;
            const selectedClass = document.getElementById('statClassSelect').value;
            
            const dbData = DataManager._getData();
            const attendance = dbData.attendance || {};
            
            const statsMap = {}; // studentNo -> data
            
            const today = getTRTime();
            // Important: Handle timezone differences nicely by getting local date string
            const yyyy = today.getFullYear();
            const mm = padZero(today.getMonth() + 1);
            const dd = padZero(today.getDate());
            
            const todayStr = `${yyyy}-${mm}-${dd}`;
            const thisMonthStr = `${yyyy}-${mm}`;
            
            // Calculate start and end of this week (Monday to Sunday)
            const dayOfWeek = today.getDay() || 7;
            const startOfWeekDate = new Date(today);
            startOfWeekDate.setDate(today.getDate() - dayOfWeek + 1);
            const endOfWeekDate = new Date(startOfWeekDate);
            endOfWeekDate.setDate(startOfWeekDate.getDate() + 6);
            
            const startOfWeekStr = `${startOfWeekDate.getFullYear()}-${padZero(startOfWeekDate.getMonth() + 1)}-${padZero(startOfWeekDate.getDate())}`;
            const endOfWeekStr = `${endOfWeekDate.getFullYear()}-${padZero(endOfWeekDate.getMonth() + 1)}-${padZero(endOfWeekDate.getDate())}`;
            
            for (const date in attendance) {
                if (timeRange === 'week' && (date < startOfWeekStr || date > endOfWeekStr)) continue;
                if (timeRange === 'month' && !date.startsWith(thisMonthStr)) continue;
                
                for (const hour in attendance[date]) {
                    for (const cls in attendance[date][hour]) {
                        if (selectedClass && cls !== selectedClass) continue;
                        
                        const record = attendance[date][hour][cls];
                        if (record.teacher === activeTeacherUsername) {
                            const recs = record.records || {};
                            const gecT = record.gecTimes || {};
                            
                            for (const stuNo in recs) {
                                const status = recs[stuNo];
                                if (status === 'GELDİ') continue;
                                
                                if (!statsMap[stuNo]) {
                                    const stuObj = allStudents.find(s => s.no === stuNo) || {};
                                    statsMap[stuNo] = {
                                        no: stuNo,
                                        name: `${stuObj.name || ''} ${stuObj.surname || ''}`.trim() || 'Bilinmiyor',
                                        class: cls,
                                        gelmedi: 0,
                                        gec: 0,
                                        gecMins: 0,
                                        gecFirst: 0,
                                        gecFirstMins: 0,
                                        gecMid: 0,
                                        gecMidMins: 0,
                                        diger: 0,
                                        nobetci: 0
                                    };
                                }
                                
                                if (status === 'GELMEDİ') statsMap[stuNo].gelmedi++;
                                if (status === 'GEÇ') {
                                    const lateMins = parseInt(gecT[stuNo] || 0);
                                    statsMap[stuNo].gec++;
                                    statsMap[stuNo].gecMins += lateMins;
                                    
                                    if (hour === "1" || hour === 1) {
                                        statsMap[stuNo].gecFirst++;
                                        statsMap[stuNo].gecFirstMins += lateMins;
                                    } else {
                                        statsMap[stuNo].gecMid++;
                                        statsMap[stuNo].gecMidMins += lateMins;
                                    }
                                }
                                if (status === 'DİĞER') statsMap[stuNo].diger++;
                                if (status === 'NÖBETÇİ') statsMap[stuNo].nobetci++;
                            }
                        }
                    }
                }
            }
            
            currentStatsArr = Object.values(statsMap);
            renderStatisticsTable();
        }

        function renderStatisticsTable() {
            const container = document.getElementById('statisticsContainer');
            if (!currentStatsArr || currentStatsArr.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                    <i class="fa-solid fa-check-circle" style="font-size:3rem; color:#10b981; margin-bottom:1rem; display:block;"></i>
                    Seçili aralıkta derse devamsızlık yapan veya geç kalan öğrenci bulunmuyor.
                </div>`;
                return;
            }

            // Sort
            currentStatsArr.sort((a, b) => {
                let valA = a[currentStatSortCol];
                let valB = b[currentStatSortCol];
                if (typeof valA === 'string') {
                    return currentStatSortOrder === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
                } else {
                    return currentStatSortOrder === 'desc' ? valB - valA : valA - valB;
                }
            });

            const getSortIcon = (col) => {
                if (currentStatSortCol !== col) return '<i class="fa-solid fa-sort" style="color:var(--gray-300); margin-left:5px;"></i>';
                return currentStatSortOrder === 'desc' 
                    ? '<i class="fa-solid fa-sort-down" style="color:var(--primary); margin-left:5px;"></i>' 
                    : '<i class="fa-solid fa-sort-up" style="color:var(--primary); margin-left:5px;"></i>';
            };

            let html = `
            <div class="table-responsive">
                <table class="student-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:left; color:var(--gray-500); cursor:pointer;" onclick="handleStatSort('name')">Öğrenci ${getSortIcon('name')}</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500); cursor:pointer;" onclick="handleStatSort('gelmedi')">Gelmedi ${getSortIcon('gelmedi')}</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500); cursor:pointer;" onclick="handleStatSort('gec')">Geç Kalma ${getSortIcon('gec')}</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500); cursor:pointer;" onclick="handleStatSort('diger')">Diğer ${getSortIcon('diger')}</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500); cursor:pointer;" onclick="handleStatSort('nobetci')">Nöbetçi ${getSortIcon('nobetci')}</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            currentStatsArr.forEach(s => {
                html += `
                    <tr style="border-bottom:1px solid var(--gray-100); transition:background 0.2s;" onmouseover="this.style.background='#fafbfc'" onmouseout="this.style.background='white'">
                        <td style="padding:1rem;">
                            <div style="font-weight:700; color:var(--dark);">${s.name}</div>
                            <div style="font-size:0.8rem; color:var(--gray-500);">No: ${s.no} | Sınıf: ${s.class}</div>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.gelmedi > 0 ? 'gelmedi' : ''}" style="${s.gelmedi === 0 ? 'background:#f1f5f9;color:#94a3b8;' : ''}">${s.gelmedi} Kez</span>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.gec > 0 ? 'gec' : ''}" 
                                  style="${s.gec === 0 ? 'background:#f1f5f9;color:#94a3b8;' : 'cursor:pointer; text-decoration:underline;'}"
                                  data-name="${s.name}"
                                  ${s.gec > 0 ? `onclick="showLateDetails(this.getAttribute('data-name'), ${s.gecFirst}, ${s.gecFirstMins}, ${s.gecMid}, ${s.gecMidMins})"` : ''}
                                  title="${s.gec > 0 ? 'Detayları görmek için tıklayın' : ''}">
                                ${s.gec} Kez ${s.gec > 0 ? `(${s.gecMins}dk)` : ''}
                            </span>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.diger > 0 ? 'diger' : ''}" style="${s.diger === 0 ? 'background:#f1f5f9;color:#94a3b8;' : ''}">${s.diger} Kez</span>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.nobetci > 0 ? 'diger' : ''}" style="${s.nobetci === 0 ? 'background:#f1f5f9;color:#94a3b8;' : 'background:#f3f4f6;color:#6b7280;'}">${s.nobetci} Kez</span>
                        </td>
                    </tr>`;
            });
            
            html += `</tbody></table></div>`;
            container.innerHTML = html;
        }

        function deletePastAttendance(date, hour, className) {
            Swal.fire({
                title: 'Onay ve Şifre',
                text: `${date} tarihli ${hour}. ders ${className} sınıfı yoklaması kalıcı olarak silinecek! Lütfen şifrenizi girin.`,
                icon: 'warning',
                input: 'password',
                inputPlaceholder: 'Şifrenizi girin',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'İptal',
                preConfirm: (password) => {
                    if (password !== '1234') {
                        Swal.showValidationMessage('Hatalı şifre girdiniz!');
                        return false;
                    }
                    return true;
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const dbData = DataManager._getData();
                        if (dbData.attendance && dbData.attendance[date] && dbData.attendance[date][hour]) {
                            delete dbData.attendance[date][hour][className];
                            
                            // Cleanup empty objects
                            if (Object.keys(dbData.attendance[date][hour]).length === 0) delete dbData.attendance[date][hour];
                            if (Object.keys(dbData.attendance[date]).length === 0) delete dbData.attendance[date];

                            await DataManager._saveData(dbData);
                            
                            Swal.fire({
                                icon: 'success',
                                title: 'Silindi!',
                                text: 'Yoklama kaydı başarıyla silindi.',
                                timer: 1500,
                                showConfirmButton: false
                            });
                            loadHistory();
                        }
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Hata', 'Yoklama silinemedi.', 'error');
                    }
                }
            });
        }

        function promptDeleteAllRecords() {
            Swal.fire({
                title: 'Tüm Yoklamaları Sil',
                text: 'Son 14 gündeki tüm yoklama kayıtlarınız kalıcı olarak silinecek! Lütfen şifrenizi girin.',
                icon: 'warning',
                input: 'password',
                inputPlaceholder: 'Şifrenizi girin',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Hepsini Sil',
                cancelButtonText: 'İptal',
                preConfirm: (password) => {
                    if (password !== '1234') {
                        Swal.showValidationMessage('Hatalı şifre girdiniz!');
                        return false;
                    }
                    return true;
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const dbData = DataManager._getData();
                        if (dbData.attendance) {
                            let deletedCount = 0;
                            const minDateObj = getTRTime();
                            minDateObj.setDate(getTRTime().getDate() - 14);
                            const min_yyyy = minDateObj.getFullYear();
                            const min_mm = String(minDateObj.getMonth() + 1).padStart(2, '0');
                            const min_dd = String(minDateObj.getDate()).padStart(2, '0');
                            const minDateStr = `${min_yyyy}-${min_mm}-${min_dd}`;

                            for (let date in dbData.attendance) {
                                if (date < minDateStr) continue;
                                for (let hour in dbData.attendance[date]) {
                                    for (let cls in dbData.attendance[date][hour]) {
                                        const record = dbData.attendance[date][hour][cls];
                                        if (record.teacher === activeTeacherUsername) {
                                            delete dbData.attendance[date][hour][cls];
                                            deletedCount++;
                                        }
                                    }
                                    if (Object.keys(dbData.attendance[date][hour]).length === 0) delete dbData.attendance[date][hour];
                                }
                                if (Object.keys(dbData.attendance[date]).length === 0) delete dbData.attendance[date];
                            }
                            
                            if (deletedCount > 0) {
                                await DataManager._saveData(dbData);
                                Swal.fire({
                                    icon: 'success',
                                    title: 'Silindi!',
                                    text: `${deletedCount} adet yoklama kaydı başarıyla silindi.`,
                                    timer: 1500,
                                    showConfirmButton: false
                                });
                                loadHistory();
                            } else {
                                Swal.fire('Bilgi', 'Silinecek size ait bir yoklama bulunamadı.', 'info');
                            }
                        }
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Hata', 'Tüm yoklamalar silinirken bir hata oluştu.', 'error');
                    }
                }
            });
        }

        function editPastAttendance(date, hour, className) {
            document.getElementById('yoklamaDate').value = date;
            document.getElementById('lessonHour').value = hour;
            document.getElementById('classSelect').value = className;

            switchTab('yoklama');
            loadStudentList();

            // Highlight animation on the students list panel to guide the teacher
            const listPanel = document.getElementById('studentListContainer');
            listPanel.style.animation = 'none';
            listPanel.offsetHeight; // trigger reflow
            listPanel.style.animation = 'pulse-blue 1.5s ease-out';
        }

        function logout() {
            sessionStorage.clear();
            localStorage.removeItem('klbk_persistent_session');
            window.location.href = '/k9x7v2m4';
        }
        // Global utility to pad zero
        function padZero(num) {
            return num < 10 ? '0' + num : num;
        }

        
        let currentStatSortCol = 'gelmedi';
        let currentStatSortOrder = 'desc';
        let currentStatsArr = [];

        function handleStatSort(col) {
            if (currentStatSortCol === col) {
                currentStatSortOrder = currentStatSortOrder === 'desc' ? 'asc' : 'desc';
            } else {
                currentStatSortCol = col;
                currentStatSortOrder = 'desc';
            }
            renderStatisticsTable();
        }

        function loadStatistics() {
            const container = document.getElementById('statisticsContainer');
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--gray-500);"><i class="fa-solid fa-spinner fa-spin"></i> Hesaplanıyor...</div>';

            const timeRange = document.getElementById('statTimeRange').value;
            const selectedClass = document.getElementById('statClassSelect').value;
            
            const dbData = DataManager._getData();
            const attendance = dbData.attendance || {};
            
            const statsMap = {}; // studentNo -> data
            
            const today = getTRTime();
            // Important: Handle timezone differences nicely by getting local date string
            const yyyy = today.getFullYear();
            const mm = padZero(today.getMonth() + 1);
            const dd = padZero(today.getDate());
            
            const todayStr = `${yyyy}-${mm}-${dd}`;
            const thisMonthStr = `${yyyy}-${mm}`;
            
            // Calculate start and end of this week (Monday to Sunday)
            const dayOfWeek = today.getDay() || 7;
            const startOfWeekDate = new Date(today);
            startOfWeekDate.setDate(today.getDate() - dayOfWeek + 1);
            const endOfWeekDate = new Date(startOfWeekDate);
            endOfWeekDate.setDate(startOfWeekDate.getDate() + 6);
            
            const startOfWeekStr = `${startOfWeekDate.getFullYear()}-${padZero(startOfWeekDate.getMonth() + 1)}-${padZero(startOfWeekDate.getDate())}`;
            const endOfWeekStr = `${endOfWeekDate.getFullYear()}-${padZero(endOfWeekDate.getMonth() + 1)}-${padZero(endOfWeekDate.getDate())}`;
            
            for (const date in attendance) {
                if (timeRange === 'week' && (date < startOfWeekStr || date > endOfWeekStr)) continue;
                if (timeRange === 'month' && !date.startsWith(thisMonthStr)) continue;
                
                for (const hour in attendance[date]) {
                    for (const cls in attendance[date][hour]) {
                        if (selectedClass && cls !== selectedClass) continue;
                        
                        const record = attendance[date][hour][cls];
                        if (record.teacher === activeTeacherUsername) {
                            const recs = record.records || {};
                            const gecT = record.gecTimes || {};
                            
                            for (const stuNo in recs) {
                                const status = recs[stuNo];
                                if (status === 'GELDİ') continue;
                                
                                if (!statsMap[stuNo]) {
                                    const stuObj = allStudents.find(s => s.no === stuNo) || {};
                                    statsMap[stuNo] = {
                                        no: stuNo,
                                        name: `${stuObj.name || ''} ${stuObj.surname || ''}`.trim() || 'Bilinmiyor',
                                        class: cls,
                                        gelmedi: 0,
                                        gec: 0,
                                        gecMins: 0,
                                        gecFirst: 0,
                                        gecFirstMins: 0,
                                        gecMid: 0,
                                        gecMidMins: 0,
                                        diger: 0,
                                        nobetci: 0
                                    };
                                }
                                
                                if (status === 'GELMEDİ') statsMap[stuNo].gelmedi++;
                                if (status === 'GEÇ') {
                                    const lateMins = parseInt(gecT[stuNo] || 0);
                                    statsMap[stuNo].gec++;
                                    statsMap[stuNo].gecMins += lateMins;
                                    
                                    if (hour === "1" || hour === 1) {
                                        statsMap[stuNo].gecFirst++;
                                        statsMap[stuNo].gecFirstMins += lateMins;
                                    } else {
                                        statsMap[stuNo].gecMid++;
                                        statsMap[stuNo].gecMidMins += lateMins;
                                    }
                                }
                                if (status === 'DİĞER') statsMap[stuNo].diger++;
                                if (status === 'NÖBETÇİ') statsMap[stuNo].nobetci++;
                            }
                        }
                    }
                }
            }
            
            const statsArr = Object.values(statsMap);
            
            // Sort primarily by gelmedi, then gec
            statsArr.sort((a, b) => {
                if (b.gelmedi !== a.gelmedi) return b.gelmedi - a.gelmedi;
                return b.gec - a.gec;
            });
            
            if (statsArr.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                    <i class="fa-solid fa-check-circle" style="font-size:3rem; color:#10b981; margin-bottom:1rem; display:block;"></i>
                    Seçili aralıkta derse devamsızlık yapan veya geç kalan öğrenci bulunmuyor.
                </div>`;
                return;
            }
            
            let html = `
            <div class="table-responsive">
                <table class="student-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:left; color:var(--gray-500);">Öğrenci</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500);">Gelmedi</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500);">Geç Kalma</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500);">Diğer</th>
                            <th style="padding:1rem; border-bottom:2px solid var(--gray-200); text-align:center; color:var(--gray-500);">Nöbetçi</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            statsArr.forEach(s => {
                html += `
                    <tr style="border-bottom:1px solid var(--gray-100); transition:background 0.2s;" onmouseover="this.style.background='#fafbfc'" onmouseout="this.style.background='white'">
                        <td style="padding:1rem;">
                            <div style="font-weight:700; color:var(--dark);">${s.name}</div>
                            <div style="font-size:0.8rem; color:var(--gray-500);">No: ${s.no} | Sınıf: ${s.class}</div>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.gelmedi > 0 ? 'gelmedi' : ''}" style="${s.gelmedi === 0 ? 'background:#f1f5f9;color:#94a3b8;' : ''}">${s.gelmedi} Kez</span>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.gec > 0 ? 'gec' : ''}" 
                                  style="${s.gec === 0 ? 'background:#f1f5f9;color:#94a3b8;' : 'cursor:pointer; text-decoration:underline;'}"
                                  data-name="${s.name}"
                                  ${s.gec > 0 ? `onclick="showLateDetails(this.getAttribute('data-name'), ${s.gecFirst}, ${s.gecFirstMins}, ${s.gecMid}, ${s.gecMidMins})"` : ''}
                                  title="${s.gec > 0 ? 'Detayları görmek için tıklayın' : ''}">
                                ${s.gec} Kez ${s.gec > 0 ? `(${s.gecMins}dk)` : ''}
                            </span>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.diger > 0 ? 'diger' : ''}" style="${s.diger === 0 ? 'background:#f1f5f9;color:#94a3b8;' : ''}">${s.diger} Kez</span>
                        </td>
                        <td style="padding:1rem; text-align:center;">
                            <span class="stat-badge ${s.nobetci > 0 ? 'diger' : ''}" style="${s.nobetci === 0 ? 'background:#f1f5f9;color:#94a3b8;' : 'background:#f3f4f6;color:#6b7280;'}">${s.nobetci} Kez</span>
                        </td>
                    </tr>`;
            });
            
            html += `</tbody></table></div>`;
            container.innerHTML = html;
        }

        function showLateDetails(studentName, firstCount, firstMins, midCount, midMins) {
            Swal.fire({
                title: 'Geç Kalma Detayı',
                html: `
                    <div style="text-align: left; padding: 1rem; font-size: 1.05rem;">
                        <h4 style="margin-bottom: 1rem; color: var(--primary); font-weight: 800; border-bottom: 2px solid var(--gray-200); padding-bottom: 0.5rem;">${studentName}</h4>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 1rem; border-radius: 8px;">
                                <div style="color: #92400e; font-weight: 800; margin-bottom: 4px;"><i class="fa-solid fa-sun"></i> 1. Derslere Geç Kalma</div>
                                <div style="color: #b45309;">${firstCount} Kez (Toplam ${firstMins} dk)</div>
                            </div>
                            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 1rem; border-radius: 8px;">
                                <div style="color: #1e40af; font-weight: 800; margin-bottom: 4px;"><i class="fa-solid fa-clock-rotate-left"></i> Ara Derslere Geç Kalma</div>
                                <div style="color: #1d4ed8;">${midCount} Kez (Toplam ${midMins} dk)</div>
                            </div>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Tamam',
                confirmButtonColor: '#4f46e5'
            });
        }

        // Start Timers
        setInterval(() => {
            if (typeof getTRTime !== 'function') return;
            const now = getTRTime();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            
            const neonCurrentTime = document.getElementById('neonCurrentTime');
            if(neonCurrentTime) neonCurrentTime.textContent = `${h}:${m}:${s}`;
            
            const neonLessonStatusContainer = document.getElementById('neonLessonStatusContainer');
            const neonLessonStatus = document.getElementById('neonLessonStatus');
            
            if (neonLessonStatus && neonLessonStatusContainer) {
                let statusInfo = null;
                if (activeTeacherObject && activeTeacherObject.schedule && schoolData && schoolData.lessonTimes) {
                    const nowObj = getTRTime();
                    const dayMap = { 1: 'Pa', 2: 'Sa', 3: 'Ça', 4: 'Pe', 5: 'Cu', 6: 'Ct', 0: 'Pz' };
                    const dayKey = dayMap[nowObj.getDay()];
                    const todaySchedule = activeTeacherObject.schedule[dayKey];
                    
                    if (todaySchedule) {
                        const currentTotalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
                        let nextOrCurrentHour = null;
                        let isCurrent = false;
                        
                        for (let hr = 1; hr <= 20; hr++) {
                            const sc = todaySchedule[String(hr)];
                            if (sc && sc !== '-') {
                                const startStr = schoolData.lessonTimes[`${hr}_start`];
                                const endStr = schoolData.lessonTimes[`${hr}_end`];
                                if (startStr && endStr) {
                                    const [startH, startM] = startStr.split(':').map(Number);
                                    const [endH, endM] = endStr.split(':').map(Number);
                                    const startSecs = startH * 3600 + startM * 60;
                                    const endSecs = endH * 3600 + endM * 60;
                                    
                                    if (currentTotalSeconds <= endSecs) {
                                        nextOrCurrentHour = hr;
                                        isCurrent = (currentTotalSeconds >= startSecs);
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (nextOrCurrentHour !== null) {
                            const startStr = schoolData.lessonTimes[`${nextOrCurrentHour}_start`];
                            const endStr = schoolData.lessonTimes[`${nextOrCurrentHour}_end`];
                            const [startH, startM] = startStr.split(':').map(Number);
                            const [endH, endM] = endStr.split(':').map(Number);
                            const startSecs = startH * 3600 + startM * 60;
                            const endSecs = endH * 3600 + endM * 60;
                            
                            let targetSecs = isCurrent ? endSecs : startSecs;
                            let diffSeconds = targetSecs - currentTotalSeconds;
                            
                            let diffH = String(Math.floor(diffSeconds / 3600)).padStart(2, '0');
                            let diffM = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, '0');
                            let diffS = String(diffSeconds % 60).padStart(2, '0');
                            
                            statusInfo = {
                                text: `${diffH}:${diffM}:${diffS}`,
                                isCurrent: isCurrent
                            };
                        }
                    }
                }
                
                if (statusInfo) {
                    if (statusInfo.isCurrent) {
                        neonLessonStatusContainer.style.color = '#ff073a';
                        neonLessonStatusContainer.style.textShadow = '0 0 5px #ff073a, 0 0 10px #ff073a, 0 0 20px #ff073a';
                    } else {
                        neonLessonStatusContainer.style.color = '#ffeb3b';
                        neonLessonStatusContainer.style.textShadow = '0 0 5px #ffeb3b, 0 0 10px #ffeb3b, 0 0 20px #ffeb3b';
                    }
                    neonLessonStatus.textContent = statusInfo.text;
                    neonLessonStatusContainer.style.display = 'block';
                } else {
                    neonLessonStatusContainer.style.display = 'none';
                }
            }
        }, 1000);

        // --- Forgot Password Logic ---
        document.addEventListener('DOMContentLoaded', () => {
            const forgotLink = document.querySelector('.forgot-link');
            if (forgotLink) {
                if (window.emailjs) emailjs.init("0gioGMhJGYrohmvyz");

                forgotLink.addEventListener('click', async (e) => {
                    e.preventDefault();

                    const { value: emailAddress } = await Swal.fire({
                        title: 'Şifremi Unuttum',
                        text: 'Sisteme kayıtlı e-posta adresinizi giriniz:',
                        input: 'email',
                        inputPlaceholder: 'E-posta adresiniz',
                        showCancelButton: true,
                        confirmButtonText: 'Gönder',
                        cancelButtonText: 'İptal',
                        confirmButtonColor: 'var(--primary)',
                        inputValidator: (value) => {
                            if (!value) return 'Lütfen bir e-posta adresi girin!';
                        }
                    });

                    if (emailAddress) {
                        Swal.fire({
                            title: 'Lütfen Bekleyin',
                            text: 'Bilgileriniz kontrol ediliyor...',
                            allowOutsideClick: false,
                            didOpen: () => { Swal.showLoading(); }
                        });

                        try {
                            const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
                            const usersDb = await res.json();
                            let foundUser = null;

                            if (usersDb) {
                                for (const [uname, data] of Object.entries(usersDb)) {
                                    if (data.email && data.email.toLowerCase() === emailAddress.toLowerCase()) {
                                        foundUser = { username: uname, ...data };
                                        break;
                                    }
                                }
                            }

                            if (foundUser) {
                                const templateParams = {
                                    to_email: emailAddress,
                                    email: emailAddress,
                                    user_email: emailAddress,
                                    username: foundUser.username,
                                    password: foundUser.password,
                                    school_name: foundUser.schoolName || 'Kelebek Sistemi'
                                };

                                await emailjs.send("service_205ar93", "template_i0eo9o5", templateParams);

                                Swal.fire({
                                    icon: 'success',
                                    title: 'Bilgiler Gönderildi',
                                    html: `Kullanıcı bilgileriniz <b>${emailAddress}</b> adresine e-posta olarak gönderilmiştir.`,
                                    confirmButtonColor: 'var(--secondary)'
                                });
                            } else {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Hata',
                                    text: 'E-posta adresiniz sisteme kayıtlı değil. Sistem yöneticinizle görüşün.',
                                    confirmButtonColor: 'var(--danger)'
                                });
                            }
                        } catch (err) {
                            console.error(err);
                            const errorMsg = err?.text || err?.message || "Bilinmeyen bir hata oluştu";
                            Swal.fire({
                                icon: 'warning',
                                title: 'Gönderim Hatası',
                                html: `E-posta servisi şu an yanıt vermiyor.<br><br><small>Hata: ${errorMsg}</small><br><br>Lütfen bilgilerin doğruluğunu kontrol edin veya sistem yöneticisi ile iletişime geçin.`,
                                confirmButtonColor: 'var(--primary)'
                            });
                        }
                    }
                });
            }
        });
    