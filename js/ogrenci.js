DataManager._getStorageKey = function () {
            const urlParams = new URLSearchParams(window.location.search);
            const q = urlParams.get('school');
            
            // Priority 1: URL Parameter ?school=xyz
            if (q) {
                localStorage.setItem('klbk_last_school', q);
                return `klbk_data_${q}`;
            }

            // Priority 2: Last used school
            const lastSchool = localStorage.getItem('klbk_last_school');
            if (lastSchool) return `klbk_data_${lastSchool}`;

            // Priority 3: Fallback
            return `klbk_data_admin`;
        };

        let currentStudent = null;
        let timerInterval = null;
        let trustedBaseTime = 0;
        let performanceAtSync = 0;
        let openSessions = new Set();
        let lastStates = {};

        async function syncTime() {
            const statusEl = document.getElementById('timeSyncStatus');
            try {
                // Add a 3-second timeout for worldtimeapi
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const startTime = Date.now();
                
                // Try server header first
                let serverTime = null;
                try {
                    const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
                    const dateHeader = res.headers.get('date');
                    if (dateHeader) serverTime = new Date(dateHeader).getTime();
                } catch(e) {}
                
                if (!serverTime) {
                    // Fallback to timeapi.io
                    const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Europe/Istanbul', { signal: controller.signal });
                    const data = await response.json();
                    if (data.dateTime) serverTime = new Date(data.dateTime).getTime();
                }

                clearTimeout(timeoutId);

                const endTime = Date.now();
                const latency = (endTime - startTime) / 2;
                trustedBaseTime = serverTime + latency;
                performanceAtSync = performance.now();
                statusEl.innerHTML = '<i class="fa-solid fa-cloud-check"></i> İnternet saati ile senkronize';
                statusEl.style.color = 'var(--secondary)';
            } catch (err) {
                console.error("Time sync failed or timed out:", err);
                statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Cihaz saati kullanılıyor';
                statusEl.style.color = 'var(--danger)';
                trustedBaseTime = Date.now();
                performanceAtSync = performance.now();
            }            // Sadece cache'den okul ismini göster
            const nameDisplay = document.getElementById('schoolNameDisplay');
            if (nameDisplay) {
                const cached = localStorage.getItem('klbk_lastSchoolName');
                if (cached) nameDisplay.textContent = cached;
            }
            
            // "Sınav verileri indiriliyor" metnini tamamen kaldırmak için
            const statusEl2 = document.getElementById('timeSyncStatus');
            if (statusEl2) statusEl2.classList.add('hidden');
        } finally {
                // Ensure body is visible after initial sync/check
                document.body.style.visibility = 'visible';
                // Check for persistent session after time sync
                checkPersistentSession();
            }
        }

        function checkClassroomDisplay() {
            const devId = localStorage.getItem('klbk_device_id');
            if (!devId) return false;
            
            const mappings = DataManager.getClassDeviceMappings() || {};
            let assignedClass = null;
            for (let cls in mappings) {
                if (mappings[cls] === devId) {
                    assignedClass = cls;
                    break;
                }
            }
            
            // Start polling for instant device mapping updates
            if (!window._deviceMapPollerStarted) {
                window._deviceMapPollerStarted = true;
                
                // Track ALL classes assigned to this device to prevent infinite reload on multi-assignment
                window._currentAssignedClasses = Object.keys(mappings)
                    .filter(k => mappings[k] === devId)
                    .sort().join(',');
                
                setInterval(async () => {
                    const currentDev = localStorage.getItem('klbk_device_id');
                    if(!currentDev) return;
                    try {
                        const storeKey = encodeURIComponent(DataManager._getStorageKey());
                        const res = await fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/${storeKey}/classDeviceMappings.json?t=` + Date.now());
                        if(res.ok) {
                            const newMappings = await res.json() || {};
                            
                            const newAssignedClasses = Object.keys(newMappings)
                                .filter(k => newMappings[k] === currentDev)
                                .sort().join(',');
                            
                            // If mapping changed, reload the page to apply cleanly
                            if (window._currentAssignedClasses !== newAssignedClasses) {
                                location.reload();
                            }
                        }
                    } catch(e) {}
                }, 3000);
            }

            if (!assignedClass) return false;
            
            const roomMappings = DataManager.getClassRoomMappings() || {};
            const safeClass = DataManager.sanitizeFirebaseKey(assignedClass);
            let roomName = roomMappings[safeClass] || roomMappings[assignedClass];
            if (!roomName) {
                for(let key in roomMappings) {
                    if (key === safeClass || key === assignedClass) {
                        roomName = roomMappings[key];
                        break;
                    }
                }
            }
            if (!roomName) return false;
            
            const exams = DataManager.getExams() || [];
            const roomData = exams.find(e => e.name === roomName);
            if (!roomData) return false;
            
            renderClassroomDisplay(roomData, assignedClass);
            return true;
        }

        function renderClassroomDisplay(roomData, assignedClass) {
            let overlay = document.getElementById('fullScreenPlanOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'fullScreenPlanOverlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.backgroundColor = '#f8fafc';
                overlay.style.zIndex = '9999';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.overflow = 'hidden';
                document.body.appendChild(overlay);
            }

            const resultsView = document.getElementById('resultsView');
            if (resultsView) resultsView.classList.add('hidden');
            const loginView = document.getElementById('loginView');
            if (loginView) loginView.classList.add('hidden');
            document.body.classList.remove('login-body');

            let html = `
                <div style="background: var(--dark); color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div>
                            <h2 style="margin: 0; font-weight: 800; font-size: 1.25rem;">${roomData.name} Dersliği Oturma Planı</h2>
                            <div style="font-size: 0.85rem; color: var(--gray-400);">Bu ekran ${assignedClass} sınıfına ait cihazdan yansıtılmaktadır.</div>
                        </div>
                    </div>
                </div>
                
                <div id="fullScreenSchemaContainer" style="flex: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative; background: #f0f2f5;">
            `;

            let roomSeatCounter = 1;
            const seatToNum = {};
            const safeDisabledSeats = roomData.disabledSeats || [];
            const safeSeats = roomData.seats || {};
            
            for (let g = 1; g <= roomData.groups; g++) {
                const conf = (roomData.groupConfigs && roomData.groupConfigs[g - 1]) ? roomData.groupConfigs[g - 1] : { rows: roomData.rows || 1, cols: roomData.cols || 1 };
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!safeDisabledSeats.includes(sid)) {
                            seatToNum[sid] = roomSeatCounter++;
                        }
                    }
                }
            }

            let groupsHtml = '<div class="groups-row">';
            for (let g = 1; g <= roomData.groups; g++) {
                const cf = (roomData.groupConfigs && roomData.groupConfigs[g - 1]) ? roomData.groupConfigs[g - 1] : { rows: roomData.rows || 1, cols: roomData.cols || 1 };
                groupsHtml += `<div class="desk-group" style="grid-template-columns:repeat(${cf.cols}, 1fr)">`;

                for (let r = cf.rows; r >= 1; r--) {
                    for (let c = 1; c <= cf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        const disabled = safeDisabledSeats.includes(sid);
                        const std = safeSeats[sid];
                        const num = seatToNum[sid] || '-';

                        if (disabled) {
                            groupsHtml += `<div class="desk" style="opacity:0.2; border: 1px dashed var(--gray-300);"></div>`;
                        } else if (std) {
                            let deskBg = (std.class === assignedClass) ? '#ecfdf5' : 'white';
                            groupsHtml += `
                                <div class="desk" style="background: ${deskBg}; width: 180px; height: 130px; border: 2px solid var(--gray-300);">
                                    <div style="font-size:0.85rem; color:var(--gray-500); font-weight:700;">${std.class} / ${std.no}</div>
                                    <div style="font-size:0.95rem; font-weight:900; color:var(--dark); margin:8px 0; line-height:1.2; word-break: break-word;">${std.name}</div>
                                    <div style="font-size:0.8rem; color:var(--gray-400); font-weight:600;">${std._matchedSubject || '-'}</div>
                                    <div class="desk-num" style="width: 32px; height: 32px; font-size: 1.1rem; bottom: -5px;">${num}</div>
                                </div>`;
                        } else {
                            groupsHtml += `<div class="desk empty" style="width: 180px; height: 130px;"><div class="desk-num" style="width: 32px; height: 32px; font-size: 1.1rem; bottom: -5px;">${num}</div><div style="font-size:0.75rem; color:var(--danger); font-weight:700; margin-top:15px;">BOŞ</div></div>`;
                        }
                    }
                }
                groupsHtml += `</div>`;
            }
            groupsHtml += '</div>';

            const isTeacherRight = (roomData.teacherDeskPos || 'right') === 'right';

            let frontAreaHtml = `
                <div class="front-area" style="margin-top: 50px;">
                    ${!isTeacherRight ? '<div class="teacher-desk" style="width: 120px; height: 80px; font-size: 0.85rem;">ÖĞRETMEN<br>MASASI</div><div class="board" style="height: 50px; font-size: 1.1rem;">YAZI TAHTASI</div><div style="width:120px;"></div>' : '<div style="width:120px;"></div><div class="board" style="height: 50px; font-size: 1.1rem;">YAZI TAHTASI</div><div class="teacher-desk" style="width: 120px; height: 80px; font-size: 0.85rem;">ÖĞRETMEN<br>MASASI</div>'}
                </div>
            `;

            html += `
                <div class="classroom-walls" id="fsWalls" style="transform-origin: center;">
                    ${groupsHtml}
                    ${frontAreaHtml}
                </div>
            </div>
            `;

            overlay.innerHTML = html;
            overlay.style.display = 'flex';

            if (typeof scaleFullScreenPlan === 'function') {
                setTimeout(scaleFullScreenPlan, 100);
                window.addEventListener('resize', scaleFullScreenPlan);
            }

            // Çift tıklayarak öğrenci girişine dönülebilir
            overlay.ondblclick = function() {
                overlay.style.display = 'none';
                if (loginView) loginView.classList.remove('hidden');
                document.body.classList.add('login-body');
            };
        }

        function checkPersistentSession() {
            try {
                if (checkClassroomDisplay()) return;
            } catch (err) {
                console.error("checkClassroomDisplay crashed:", err);
            }

            // r-oturumu: öğrenci r2403 formatında giriş yapmışsa session geri yükle
            try {
                const srhSessionRaw = localStorage.getItem('klbk_srh_session');
                if (srhSessionRaw) {
                    const studentObj = JSON.parse(srhSessionRaw);
                    if (studentObj && studentObj.no) {
                        window.currentSrhStudent = studentObj;
                        // Oturumu geri yükle ve ekranı göster
                        (async () => {
                            try {
                                Swal.fire({ title: 'Yükleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                                const res = await fetch("https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/srh_data.json?_=" + Date.now());
                                const data = res.ok ? await res.json() : {};
                                
                                const publishedApps = Object.entries(data || {}).filter(([id, app]) => {
                                    if (app.status !== 'published') return false;
                                    if (!app.publishedClasses || app.publishedClasses.length === 0) return true;
                                    return app.publishedClasses.includes((studentObj.class || '').trim());
                                });

                                Swal.close();

                                if (publishedApps.length === 0) {
                                    // Uygulama yoksa login'e dön ve session sil
                                    localStorage.removeItem('klbk_srh_session');
                                    localStorage.removeItem('klbk_student_session');
                                    const lv = document.getElementById('loginView');
                                    if (lv) lv.classList.remove('hidden');
                                    return;
                                }

                                const loginView = document.getElementById('loginView');
                                if (loginView) loginView.classList.add('hidden');
                                document.getElementById('srhListView').classList.remove('hidden');

                                document.getElementById('srhStudentNameListDisplay').innerText = `${studentObj.name || ''} ${studentObj.surname || ''}`.trim();
                                document.getElementById('srhStudentClassListDisplay').innerText = `Sınıf: ${studentObj.class} | No: ${studentObj.no}`;

                                window.publishedSrhApps = publishedApps;
                                window.completedSrhApps = window.completedSrhApps || new Set();

                                // Daha önce tamamlananları Firebase'den kontrol et
                                const checks = publishedApps.map(async ([appId]) => {
                                    const r = await fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/srh_answers/${appId}/${studentObj.no}.json?_=` + Date.now());
                                    if (r.ok) {
                                        const d = await r.json();
                                        if (d && d.timestamp) window.completedSrhApps.add(appId);
                                    }
                                });
                                await Promise.all(checks);

                                renderSrhAppsList();
                            } catch (e) {
                                console.error('r-session restore failed:', e);
                                localStorage.removeItem('klbk_srh_session');
                                localStorage.removeItem('klbk_student_session');
                                const lv = document.getElementById('loginView');
                                if (lv) lv.classList.remove('hidden');
                            }
                        })();
                        return;
                    }
                }
            } catch (err) {
                console.error("r-session check crashed:", err);
                localStorage.removeItem('klbk_srh_session');
            }

            try {
                const savedNo = localStorage.getItem('klbk_student_session');
                if (savedNo && !savedNo.startsWith('r')) {
                    document.getElementById('studentNo').value = savedNo;
                    queryExams(true);
                    return;
                }
            } catch (err) {
                console.error("Session check crashed:", err);
            }
            
            const lv = document.getElementById('loginView');
            if(lv) lv.classList.remove('hidden');
        }


        function getNow() {
            if (trustedBaseTime === 0) return new Date();
            return new Date(trustedBaseTime + (performance.now() - performanceAtSync));
        }

        syncTime();

        // --- Gerçek Cihaz Parmak İzi (Device Fingerprint) ---
        async function buildDeviceFingerprint() {
            // 1) localStorage'da kayıtlı varsa kullan (sadece yeni CHZ-XXXX-XXXX formatı)
            const saved = localStorage.getItem('klbk_device_id');
            if (saved && /^CHZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(saved)) return saved;
            // Eski formattaki kodu temizle
            if (saved) localStorage.removeItem('klbk_device_id');

            // 2) IndexedDB'de kayıtlı varsa kullan (localStorage temizlense de kalır)
            try {
                const idbVal = await new Promise((res) => {
                    const req = indexedDB.open('klbk_device_store', 1);
                    req.onupgradeneeded = e => e.target.result.createObjectStore('data');
                    req.onsuccess = e => {
                        const db = e.target.result;
                        const tx = db.transaction('data', 'readonly');
                        const get = tx.objectStore('data').get('device_id');
                        get.onsuccess = () => res(get.result);
                        get.onerror = () => res(null);
                    };
                    req.onerror = () => res(null);
                });
                if (idbVal && /^CHZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(idbVal)) {
                    localStorage.setItem('klbk_device_id', idbVal);
                    return idbVal;
                }
            } catch(e) {}

            // 3) Donanıma özgü SABIT verilerden fingerprint hesapla
            //    NOT: Canvas/WebGL/userAgent gibi tarayıcıya göre değişen veriler KULLANILMAZ
            const parts = [];
            // Ekran boyutu — cihaza özgü, tarayıcıdan bağımsız
            parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
            // Saat dilimi — cihaza özgü
            parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'notz');
            // CPU çekirdek sayısı — donanıma özgü
            parts.push(`cpu${navigator.hardwareConcurrency || 0}`);
            // Platform — işletim sistemine özgü
            parts.push(navigator.platform || 'noplat');
            // Dil — genelde cihaza özgü
            parts.push(navigator.language || 'nolang');
            // Dokunmatik nokta sayısı — cihaz donanımına özgü
            parts.push(`touch${navigator.maxTouchPoints || 0}`);

            const raw = parts.join('|');

            // djb2 hash — senkron, tüm tarayıcılarda aynı sonuç
            let hash1 = 5381;
            let hash2 = 52711;
            for (let i = 0; i < raw.length; i++) {
                const c = raw.charCodeAt(i);
                hash1 = ((hash1 << 5) + hash1) + c;
                hash2 = ((hash2 << 5) + hash2) + c;
            }
            hash1 = Math.abs(hash1 | 0);
            hash2 = Math.abs(hash2 | 0);
            const h1 = hash1.toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
            const h2 = hash2.toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
            const devId = `CHZ-${h1}-${h2}`;

            // localStorage + IndexedDB'ye kaydet
            localStorage.setItem('klbk_device_id', devId);
            try {
                const r = indexedDB.open('klbk_device_store', 1);
                r.onsuccess = e => {
                    const db = e.target.result;
                    db.transaction('data', 'readwrite').objectStore('data').put(devId, 'device_id');
                };
            } catch(e) {}
            return devId;
        }


        async function queryExams(isAutoLogin = false) {
            try {
                // Sınav / Nöbet sorgulanmadan önce veritabanı yüklenmediyse yükle
                const dbCheck = (typeof DataManager !== 'undefined') ? DataManager._getData() : null;
                if (!dbCheck || !dbCheck.school) {
                    Swal.fire({ title: 'Sistem Yükleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    await DataManager.initCloud();
                    
                    const schoolSettings = DataManager.getSchoolSettings();
                    const schoolName = schoolSettings ? (schoolSettings.name || schoolSettings.schoolName || '') : '';
                    if (schoolName) {
                        localStorage.setItem('klbk_lastSchoolName', schoolName);
                        const nd = document.getElementById('schoolNameDisplay');
                        if(nd) nd.textContent = schoolName;
                    }
                    Swal.close();
                }

                const noInput = document.getElementById('studentNo');
                const studentNo = noInput.value.trim().toLowerCase();
                if (!studentNo) return;
                
                // --- Rehberlik ve Sosyal Uygulamalar Kontrol Sistemi (r + numara) ---
                if (studentNo.startsWith('r') && !isNaN(studentNo.substring(1))) {
                    const srhNo = studentNo.substring(1);

                    // DataManager._getData() returns { students: [...], ... } NOT { school: { students: [...] } }
                    // Also fallback to Firebase fetch if DataManager hasn't loaded yet
                    let students = null;
                    try {
                        const db = (typeof DataManager !== 'undefined') ? DataManager._getData() : null;
                        if (db && db.students && db.students.length > 0) {
                            students = db.students;
                        } else {
                            // Fallback: fetch directly from Firebase
                            Swal.fire({ title: 'Yükleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                            const fbRes = await fetch('https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/school/students.json?_=' + Date.now());
                            if (fbRes.ok) {
                                const fbData = await fbRes.json();
                                if (fbData) {
                                    students = Array.isArray(fbData) ? fbData : Object.values(fbData);
                                }
                            }
                            Swal.close();
                        }
                    } catch(e) {
                        Swal.close();
                        console.error('Öğrenci verisi alınamadı:', e);
                    }

                    if (!students || students.length === 0) {
                        Swal.fire('Hata', 'Öğrenci veritabanı bulunamadı.', 'error');
                        return;
                    }
                    
                    const studentObj = students.find(s => String(s.no) === String(srhNo));
                    
                    if (!studentObj) {
                        Swal.fire('Hata', 'Kayıtlı öğrenci bulunamadı.', 'error');
                        return;
                    }
                    
                    window.currentSrhStudent = studentObj;
                    
                    // Fetch published apps
                    Swal.fire({ title: 'Kontrol ediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    try {
                        const res = await fetch("https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/srh_data.json?_=" + Date.now());
                        const data = res.ok ? await res.json() : {};
                        
                        const publishedApps = Object.entries(data || {}).filter(([id, app]) => {
                            if (app.status !== 'published') return false;
                            if (!app.publishedClasses || app.publishedClasses.length === 0) return true; // Sınıf kısıtlaması yoksa herkese
                            return app.publishedClasses.includes((studentObj.class || '').trim());
                        });
                        
                        if (publishedApps.length === 0) {
                            Swal.fire('Bilgi', 'Şu an size tanımlı bir çalışma yok.', 'info');
                            return;
                        }
                        
                        Swal.close();
                        
                        // Oturumu localStorage'a kaydet (sayfa yenilenince geri dönmek için)
                        window.currentSrhStudent = studentObj;
                        localStorage.setItem('klbk_srh_session', JSON.stringify({
                            no: studentObj.no,
                            name: studentObj.name || '',
                            surname: studentObj.surname || '',
                            class: studentObj.class || studentObj.sinif || ''
                        }));
                        localStorage.setItem('klbk_student_session', 'r' + srhNo);
                        
                        // Yönlendirme ve UI güncellemeleri
                        const loginView = document.getElementById('loginView');
                        if(loginView) loginView.classList.add('hidden');
                        document.getElementById('srhListView').classList.remove('hidden');
                        
                        document.getElementById('srhStudentNameListDisplay').innerText = `${studentObj.name || ''} ${studentObj.surname || ''}`.trim();
                        document.getElementById('srhStudentClassListDisplay').innerText = `Sınıf: ${studentObj.class} | No: ${studentObj.no}`;
                        
                        window.publishedSrhApps = publishedApps;
                        
                        // Hangi uygulamaları zaten doldurduğunu Firebase'den kontrol et
                        window.completedSrhApps = window.completedSrhApps || new Set();
                        try {
                            const completedChecks = publishedApps.map(async ([appId]) => {
                                const r = await fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/srh_answers/${appId}/${studentObj.no}.json?_=` + Date.now());
                                if (r.ok) {
                                    const d = await r.json();
                                    if (d && d.timestamp) window.completedSrhApps.add(appId);
                                }
                            });
                            await Promise.all(completedChecks);
                        } catch(e) { console.warn('Tamamlanma kontrolü başarısız:', e); }
                        
                        renderSrhAppsList();
                        
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Hata', 'Sunucuya bağlanılamadı.', 'error');
                    }
                    return;
                }
                
                // --- Öğrenci Nöbet Kontrol Sistemi (n + numara) ---
                if (studentNo.startsWith('n') && !isNaN(studentNo.substring(1))) {
                    const dutyNo = studentNo.substring(1);
                    const db = DataManager._getData();
                    
                    if (!db || !db.school || !db.school.studentDuties || !db.school.studentDuties.plan) {
                        Swal.fire('Bilgi', 'Size tanımlanmış bir nöbet görevi yok.', 'info');
                        return;
                    }
                    
                    const rawPlan = db.school.studentDuties.plan;
                    const plan = typeof window.shiftStudentPlanDates === 'function' ? window.shiftStudentPlanDates(rawPlan) : rawPlan;
                    const myDuties = plan.filter(p => String(p.number) === String(dutyNo));
                    
                    if (myDuties.length === 0) {
                        Swal.fire('Bilgi', 'Size tanımlanmış bir nöbet görevi yok.', 'info');
                        return;
                    }
                    
                    if (isAutoLogin) {
                        const loginView = document.getElementById('loginView');
                        const resultsView = document.getElementById('resultsView');
                        const rulesView = document.getElementById('rulesView');
                        const dutyView = document.getElementById('dutyView');
                        
                        if(loginView) loginView.classList.add('hidden');
                        if(resultsView) resultsView.classList.add('hidden');
                        if(rulesView) rulesView.classList.add('hidden');
                        if(dutyView) dutyView.classList.remove('hidden');
                        
                        renderStudentDutyView(dutyNo, db);
                        return;
                    }
                    
                    // Nöbeti var, kuralları göster
                    let currentRules = db.school?.studentDuties?.rules || '';
                    if (currentRules.trim() === '') {
                        currentRules = "Nöbet görevinizde başarılar dileriz. Lütfen görev yerinizde zamanında olunuz.";
                    }
                    
                    let lessonTimes = db.school.lessonTimes || {};
                    let firstStart = lessonTimes['1_start'] || '08:30';
                    let [sh, sm] = firstStart.split(':').map(Number);
                    let ruleTime = new Date();
                    ruleTime.setHours(sh, sm, 0, 0);
                    ruleTime.setMinutes(ruleTime.getMinutes() - 10);
                    let ruleTimeStr = String(ruleTime.getHours()).padStart(2, '0') + ':' + String(ruleTime.getMinutes()).padStart(2, '0');
                    
                    currentRules = currentRules.replace(/\[SAAT\]/g, ruleTimeStr);
                    
                    let formattedRules = currentRules.replace(/\n/g, '<br>');
                    const rulesHtml = `
                        <div style="text-align: left; font-size: 15px; line-height: 1.6; color: var(--gray-700);">
                            ${formattedRules}
                        </div>
                    `;
                    
                    Swal.fire({
                        title: 'Nöbet Kuralları',
                        html: rulesHtml,
                        icon: 'info',
                        confirmButtonText: 'Kabul Ediyorum',
                        confirmButtonColor: '#4f46e5',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    }).then((result) => {
                        if (result.isConfirmed) {
                            localStorage.setItem('klbk_student_session', 'n' + dutyNo);
                            // UI geçişini yap
                            const loginView = document.getElementById('loginView');
                            const resultsView = document.getElementById('resultsView');
                            const rulesView = document.getElementById('rulesView');
                            const dutyView = document.getElementById('dutyView');
                            
                            if(loginView) loginView.classList.add('hidden');
                            if(resultsView) resultsView.classList.add('hidden');
                            if(rulesView) rulesView.classList.add('hidden');
                            if(dutyView) dutyView.classList.remove('hidden');
                            
                            renderStudentDutyView(dutyNo, db);
                        }
                    });
                    
                    return; // Sınav sorgusunu iptal et
                }
                
                const no = noInput.value.trim();
                
                // --- Cihaz Eşleştirme Modu (00000) ---
                if (studentNo === '00000') {
                    const devId = await buildDeviceFingerprint();
                    const beaconUrl = 'https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_users/device_assign_00000.json';
                    const beaconBody = JSON.stringify({ deviceId: devId, timestamp: Date.now() });

                    // İlk sinyali HEMEN gönder (2 sn beklemeden)
                    const sendBeacon = () => {
                        return fetch(beaconUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ deviceId: devId, timestamp: Date.now() })
                        });
                    };

                    // Eşleşme kontrolü
                    const checkMapping = async () => {
                        try {
                            const storeKey = encodeURIComponent(DataManager._getStorageKey());
                            const res = await fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/${storeKey}/classDeviceMappings.json`);
                            if (res.ok) {
                                const mappings = await res.json() || {};
                                if (Object.values(mappings).includes(devId)) location.reload();
                            }
                        } catch(e) {}
                    };

                    // İlk sinyali hemen gönder
                    try {
                        await sendBeacon();
                        console.log('İlk sinyal gönderildi:', devId);
                    } catch(e) {
                        console.error('İlk sinyal hatası:', e);
                    }

                    // Sonra her 2 saniyede tekrarla
                    let beaconInterval = setInterval(async () => {
                        try {
                            await sendBeacon();
                        } catch(e) {
                            console.error('Beacon hatası:', e);
                        }
                        await checkMapping();
                    }, 2000);

                    Swal.fire({
                        title: 'Cihaz Eşleştirme',
                        html: `Sinyal gönderiliyor... <br><br>Cihaz Kodunuz: <b style="color:var(--primary); font-size:1.2rem;">${devId}</b><br><br>Bu kodu yönetici panelinden 'Cihaz Ata' diyerek eşleştirin.<br><br><div class="spinner-border text-primary" role="status"></div>`,
                        allowOutsideClick: false,
                        showConfirmButton: true,
                        confirmButtonText: 'İptal',
                        confirmButtonColor: '#ef4444'
                    }).then(() => {
                        if (beaconInterval) { clearInterval(beaconInterval); beaconInterval = null; }
                    });
                    
                    return; // Normal öğrenci girişini atla
                }

                
                const students = DataManager.getStudents();
                if (!students || (Array.isArray(students) && students.length === 0)) {
                    if (!isAutoLogin) alert('Öğrenci verileri yüklenemedi. Lütfen internetinizi kontrol edip sayfayı yenileyin.');
                    return;
                }

                // Robust number normalization (Removes leading zeros for better matching)
                const normalizeNo = (val) => String(val || '').trim().replace(/^0+/, '');
                const targetNo = normalizeNo(no);

                currentStudent = students.find(s => s && s.no && normalizeNo(s.no) === targetNo);
                
                if (!currentStudent) {
                    if (!isAutoLogin) {
                        alert(`Öğrenci bulunamadı! Numarayı doğru girdiğinizden emin olun.`);
                    }
                    if (isAutoLogin) localStorage.removeItem('klbk_student_session');
                    return;
                }

            // Save session
            localStorage.setItem('klbk_student_session', no);

            document.getElementById('studentNameDisplay').textContent = currentStudent.name;
            document.getElementById('studentClassDisplay').textContent = currentStudent.class + (currentStudent.alan ? ` / ${currentStudent.alan}` : '');

            // Check Rules Agreement
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            
            // Read mostly from local device to prevent DB race conditions
            let lastAccepted = parseInt(localStorage.getItem(`klbk_rules_${currentStudent.no}`) || '0');
            
            // Sync with global admin reset timestamp
            const school = DataManager.getSchoolSettings() || {};
            const rulesResetAt = parseInt(school.rulesResetAt || '0');
            if (lastAccepted < rulesResetAt) {
                lastAccepted = 0;
            }
            
            // Legacy check
            if (currentStudent.rulesAcceptedAt && currentStudent.rulesAcceptedAt > lastAccepted) {
                lastAccepted = currentStudent.rulesAcceptedAt;
                localStorage.setItem(`klbk_rules_${currentStudent.no}`, lastAccepted.toString());
            }

            document.getElementById('loginView').classList.add('hidden');
            document.body.classList.remove('login-body');

            if (now - lastAccepted > thirtyDaysMs) {
                // Show rules
                renderRulesList();
                document.getElementById('rulesView').classList.remove('hidden');
                document.getElementById('resultsView').classList.add('hidden');
            } else {
                // Show results directly
                showResultsScreen();
            }
          } catch (err) {
            console.error("QueryExams Error:", err);
            if (!isAutoLogin) alert("Sorgulama sırasında bir hata oluştu: " + err.message);
          }
        }

        function acceptRules() {
            if (!currentStudent) return;
            // Save to device storage to prevent massive data overwrite race conditions on cloud DB
            localStorage.setItem(`klbk_rules_${currentStudent.no}`, Date.now().toString());
            
            document.getElementById('rulesView').classList.add('hidden');
            showResultsScreen();
        }

        function renderRulesList() {
            const school = DataManager.getSchoolSettings() || {};
            const container = document.getElementById('rulesListContainer');
            if (!container) return;

            let rules = school.rules;
            if (!rules || !Array.isArray(rules) || rules.length === 0) {
                rules = [
                    "Tüm öğrenciler sınav başlamadan önce sınavda kendilerine ayrılmış derslikte ve oturma planında gösterilen yerde hazır bulunacaktır. Farklı bir dersliğe ve oturma yerine oturmanız yasaktır.",
                    "Sınav süresince cep telefonu tablet, akıllı saatler kapalı olsa dahi öğrencinin yanında bulunması kesinlikle yasaktır. Yanınızda bu tür cihazlar varsa sınav başlamadan önce ulaşamayacağınız bir yere koyunuz.",
                    "Sınav yerinizde size ait olsun olmasın, sınav dersine ait ders notu, kitap defter vb. araç gereç olup olmadığını kontrol edip kaldırınız. Sınav esnasında yanınızda olmaması gereken araç-gereç bulunması durumunda sorumlusu sizsiniz.",
                    "İlk 4 maddeyi yerine getirmemenizden dolayı olabilecek gecikmeler toplam sınav süresine dâhildir. Bu nedenle tüm gerekli iş, işlem ve kontrolleri yapınız.",
                    "Sınav esnasında konuşmak, silgi kalem alış verişi yasaktır. Sınava gerekli ve yeterli araç gereçle geliniz.",
                    "Sınav süresi bittiğinde sınav kâğıtları mutlaka görevli öğretmene teslim ediniz. Süre bittikten sonra kâğıda bir şey yazmaya çalışmayınız.",
                    "Sınavı biten öğrenci ders sonuna kadar beklemek zorundadır. Sınavınızın bitmesi size dışarı çıkma hakkı vermez. Bu konuda görevli öğretmenin talimatları dışına çıkmayınız",
                    "Sınav kurallarıyla ilgili görevli öğretmen herhangi bir uyarı ya da hatırlatma yapmak zorunda değildir. Sınav kurallarını bildiğiniz ve kurallara uymamanız durumunda sonuçlarından haberdar olduğunuzu sorumluluğu kabul ettiğinizi unutmayınız.",
                    "Sınava katılmayan öğrencilerin yazılı olabilmeleri için mazeretlerini belgelendirmeleri gerekmektedir. Aksi halde sınav notları G girilecek bu da ortalama alınırken sıfır sayılacaktır."
                ];
            }

            container.innerHTML = rules.map(rule => `<li>${rule}</li>`).join('');
        }

        function showResultsScreen() {
            document.getElementById('resultsView').classList.remove('hidden');
            lastStates = {};
            renderExams();
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateAllTimers, 1000);

            if (window.cloudSyncInterval) clearInterval(window.cloudSyncInterval);
            window.cloudSyncInterval = setInterval(async () => {
                const oldData = JSON.stringify(DataManager.getExamSessions());
                await DataManager.initCloud();
                const newData = JSON.stringify(DataManager.getExamSessions());
                
                // Eğer veriler değişmişse listeyi tekrar çiz (Anlık yansıma)
                if (oldData !== newData) {
                    renderExams();
                    checkFullScreenTriggers();
                }
                checkLiveMessages();
            }, 2000);
        }

        function logout() {
            localStorage.removeItem('klbk_student_session');
            localStorage.removeItem('klbk_persistent_session');
            localStorage.removeItem('klbk_srh_session');
            currentStudent = null;
            window.currentSrhStudent = null;
            window.publishedSrhApps = null;
            window.completedSrhApps = new Set();
            clearInterval(timerInterval);
            if (window.cloudSyncInterval) clearInterval(window.cloudSyncInterval);
            document.getElementById('loginView').classList.remove('hidden');
            document.getElementById('resultsView').classList.add('hidden');
            document.getElementById('rulesView').classList.add('hidden');
            if (document.getElementById('dutyView')) document.getElementById('dutyView').classList.add('hidden');
            if (document.getElementById('srhListView')) document.getElementById('srhListView').classList.add('hidden');
            if (document.getElementById('srhView')) document.getElementById('srhView').classList.add('hidden');
            document.getElementById('studentNo').value = '';
            openSessions.clear();
            document.body.classList.add('login-body');
        }


        function renderExams() {
            if (!currentStudent) return;
            const sessions = DataManager.getSortedExamSessions().filter(s => s.isPublished);
            const listContainer = document.getElementById('examsList');
            const now = getNow();
            const schoolDefs = DataManager.getSchoolSettings()?.defaultTimes || {
                studentLocationMinutes: 20,
                studentExamEndHideMinutes: 30,
                examFilesActiveMinutes: 3
            };

            const myExams = [];
            sessions.forEach(ses => {
                if (!ses.results) return;
                let foundRoom = null, foundSeatId = null, seatNum = null;
                ses.results.forEach(room => {
                    let roomSeatCounter = 1;
                    const seatToNum = {};
                    for (let g = 1; g <= room.groups; g++) {
                        const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                        for (let r = 1; r <= conf.rows; r++) {
                            for (let c = 1; c <= conf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                if (!(room.disabledSeats && room.disabledSeats.includes(sid))) seatToNum[sid] = roomSeatCounter++;
                            }
                        }
                    }
                    Object.entries(room.seats).forEach(([sid, std]) => {
                        if (std.no.toString() === currentStudent.no.toString()) {
                            foundRoom = room; foundSeatId = sid; seatNum = seatToNum[sid];
                        }
                    });
                });
                if (foundRoom) myExams.push({ session: ses, room: foundRoom, seatId: foundSeatId, seatNum: seatNum });
            });

            if (myExams.length === 0) {
                listContainer.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--gray-500); font-weight: 600;"><i class="fa-solid fa-circle-info" style="margin-right:8px; font-size:1.2rem; opacity:0.8;"></i> Şu an görebileceğiniz bir sınav bilgisi yok</div>';
                return;
            }

            let html = '';
            myExams.forEach(item => {
                const ses = item.session;
                const targetTime = parseDateTime(ses.date, ses.time);
                const endTime = getExamEndTime(ses.date, ses.time, ses.examDuration);
                const diffMs = targetTime - now;
                const diffMins = diffMs / 1000 / 60;
                const diffEndMins = (endTime - now) / 1000 / 60;

                // Sınav 36 saatten sonraysa GÖSTERME
                if (diffMins > 36 * 60) return;

                // Sınav biteli 30 dakikadan fazla olduysa GÖSTERME
                if (diffEndMins < -schoolDefs.studentExamEndHideMinutes) return;

                let stateCode;
                let limit = schoolDefs.studentLocationMinutes;
                if (ses.type === 'uygulama') {
                    if (diffEndMins < 0) {
                        stateCode = 'finished';
                    } else if (diffMins <= 0) {
                        stateCode = 'active';
                    } else if (diffMins > limit) {
                        stateCode = 'far';
                    } else {
                        stateCode = 'near';
                    }
                } else {
                    stateCode = diffEndMins < 0 ? 'finished' : (diffMins <= 0 ? 'active' : (diffMins > 60 ? 'far' : (Math.floor(diffMins) > limit ? 'med' : 'near')));
                }
                
                const stateKey = stateCode + (ses.type === 'uygulama' ? `_unlocked_${((now - targetTime) / 1000 / 60) >= schoolDefs.examFilesActiveMinutes}` : '');
                lastStates[ses.id] = stateKey;

                const displayTime = ses.time.includes('. Ders') ? `${ses.time} (${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')})` : ses.time;
                const isFar = (stateCode === 'far');
                const isMed = (stateCode === 'med');
                const isFinished = (stateCode === 'finished');
                // stateCode can be active or near
                const isNearOrActive = (stateCode === 'near' || stateCode === 'active' || isFinished); // allow clicking to see results even if finished
                const isOpen = openSessions.has(ses.id);

                let timerDisplayHtml = '';
                if (isFar) {
                    timerDisplayHtml = `<span style="font-size: 0.8rem; color: var(--gray-400); font-weight: 700;">HAZIRLANIYOR</span>`;
                } else {
                    let text = '';
                    let color = '';
                    if (isFinished) {
                        text = 'BİTTİ';
                        color = 'var(--gray-500)';
                    } else if (stateCode === 'active') {
                        text = 'DEVAM EDİYOR';
                        color = 'var(--danger)';
                    } else {
                        text = formatCountdown(diffMs);
                    }
                    timerDisplayHtml = `<div class="countdown" id="cd-${ses.id}" style="${color ? 'color: ' + color : ''}">${text}</div>`;
                }

                // ALL upcoming (not expired) cards are clickable
                html += `<div class="exam-card" data-ses-id="${ses.id}" data-state="${stateCode}" style="${isNearOrActive ? 'border-left: 5px solid var(--primary);' : ''}">
                            <div class="exam-header" onclick="toggleDetails('${ses.id}')" style="cursor: pointer">
                                <div style="flex:1">
                                    <div style="font-size: 0.75rem; color: var(--primary); font-weight: 700; margin-bottom: 4px;">
                                        ${isFar ? '<i class="fa-solid fa-calendar-days"></i> GELECEK SINAV' : '<i class="fa-solid fa-clock"></i> SINAV GÜNÜ'}
                                    </div>
                                    <h4 style="margin:0; font-weight:900;">${ses.name}</h4>
                                    <small style="color:var(--gray-500)">${ses.date} ${displayTime}</small>
                                </div>
                                <div style="display: flex; align-items:center; gap: 10px;">
                                    ${timerDisplayHtml}
                                    ${isFar ? '' : `<i class="fa-solid fa-chevron-down" id="arrow-${ses.id}" style="color:var(--gray-400); transition:0.3s; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}"></i>`}
                                </div>
                            </div>
                            <div id="details-${ses.id}" class="${isOpen ? '' : 'hidden'}">
                                ${isNearOrActive ? generateDetailsHtml(item) : (isMed ? `<div class="glass-panel" style="padding: 1.5rem; text-align: center; margin-top: 10px; border: 1px dashed var(--primary-light); color: var(--primary); font-weight: 600;"><i class="fa-solid fa-user-shield" style="margin-right: 8px;"></i> Sınav yerleri sınavdan ${limit} dakika önce burada açıklanacaktır.</div>` : '')}
                            </div>
                        </div>`;
            });

            if (html === '') {
                html = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--gray-500); font-weight: 600;"><i class="fa-solid fa-circle-info" style="margin-right:8px; font-size:1.2rem; opacity:0.8;"></i> Şu an görebileceğiniz bir sınav bilgisi yok</div>';
            }

            listContainer.innerHTML = html;
            // Apply initial scaling for any already open details
            if (openSessions.size > 0) setTimeout(scaleAllVisiblePlans, 50);
        }

        function updateAllTimers() {
            if (!currentStudent) return;
            const sessions = DataManager.getExamSessions().filter(s => s.isPublished);
            const now = getNow();
            const schoolDefs = DataManager.getSchoolSettings()?.defaultTimes || {
                studentLocationMinutes: 20,
                studentExamEndHideMinutes: 30,
                examFilesActiveMinutes: 3
            };
            let needsFullRender = false;
            sessions.forEach(ses => {
                const card = document.querySelector(`.exam-card[data-ses-id="${ses.id}"]`);
                if (!card) return;
                const targetTime = DataManager.parseSessionDateTime(ses.date, ses.time);
                const endTime = DataManager.getSessionEndDateTime(ses.date, ses.time, ses.examDuration);
                const diffMs = targetTime - now;
                const diffMins = diffMs / 1000 / 60;
                const diffEndMins = (endTime - now) / 1000 / 60;

                let newState = 'hidden';
                if (diffMins <= 36 * 60 && diffEndMins >= -schoolDefs.studentExamEndHideMinutes) {
                    if (ses.type === 'uygulama') {
                        if (diffEndMins < 0) {
                            newState = 'finished';
                        } else if (diffMins <= 0) {
                            newState = 'active';
                        } else if (diffMins > schoolDefs.studentLocationMinutes) {
                            newState = 'far';
                        } else {
                            newState = 'near';
                        }
                    } else {
                        newState = diffEndMins < 0 ? 'finished' : (diffMins <= 0 ? 'active' : (diffMins > 60 ? 'far' : (Math.floor(diffMins) > schoolDefs.studentLocationMinutes ? 'med' : 'near')));
                    }
                }

                const newStateKey = newState === 'hidden' ? 'hidden' : (newState + (ses.type === 'uygulama' ? `_unlocked_${((now - targetTime) / 1000 / 60) >= schoolDefs.examFilesActiveMinutes}` : ''));

                // Only trigger full render if state actually changes
                if (newStateKey !== lastStates[ses.id]) {
                    needsFullRender = true;
                    return;
                }

                const cdEl = document.getElementById(`cd-${ses.id}`);
                if (cdEl) {
                    let newText = '';
                    if (diffEndMins < 0) {
                        newText = 'BİTTİ';
                    } else if (diffMins <= 0) {
                        newText = 'DEVAM EDİYOR';
                    } else {
                        newText = formatCountdown(diffMs);
                    }

                    if (cdEl.innerText !== newText) {
                        cdEl.innerText = newText;
                        if (diffEndMins < 0) cdEl.style.color = 'var(--gray-500)';
                        else if (diffMins <= 0) cdEl.style.color = 'var(--danger)';
                        else cdEl.style.color = '';
                    }
                }

                const dtEl = document.getElementById(`detail-timer-${ses.id}`);
                if (dtEl) {
                    let text = '';
                    if (diffEndMins < 0) {
                        text = 'SINAV BİTTİ';
                        dtEl.style.color = '#ef4444';
                        dtEl.style.textShadow = '0 0 18px rgba(239,68,68,0.6)';
                    } else if (diffMins <= 0) {
                        const remainingMs = endTime - now;
                        text = formatCountdownHMS(remainingMs);
                        dtEl.style.color = '#39FF14';
                        dtEl.style.textShadow = '0 0 18px rgba(57,255,20,0.6)';
                    } else {
                        text = formatCountdownHMS(diffMs);
                        dtEl.style.color = '#eab308';
                        dtEl.style.textShadow = '0 0 18px rgba(234,179,8,0.6)';
                    }
                    if (dtEl.innerText !== text) {
                        dtEl.innerText = text;
                    }
                }
            });
            if (needsFullRender) renderExams();
            checkFullScreenTriggers();
        }

        function getSchoolSettings() {
            return DataManager.getSchoolSettings();
        }

        function formatCountdown(ms) {
            if (ms < 0) return "00:00";
            const s = Math.floor(ms / 1000);
            const m = Math.floor(s / 60);
            return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
        }

        function formatCountdownHMS(ms) {
            if (ms < 0) return '00:00:00';
            const totalSec = Math.floor(ms / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }

        function toggleDetails(id) {
            const el = document.getElementById(`details-${id}`);
            const arrow = document.getElementById(`arrow-${id}`);
            const isHidden = el.classList.contains('hidden');
            if (isHidden) {
                el.classList.remove('hidden');
                if (arrow) arrow.style.transform = 'rotate(180deg)';
                openSessions.add(id);
                setTimeout(() => scaleSeatingPlan(id), 10);
            } else {
                el.classList.add('hidden');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
                openSessions.delete(id);
            }
        }

        function toggleNested(el) {
            const content = el.nextElementSibling;
            content.classList.toggle('hidden');
            const icon = el.querySelector('.fa-chevron-down');
            if (icon) icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';

            // If opening the seating plan, scale it
            if (!content.classList.contains('hidden') && content.querySelector('.schema-container')) {
                const sessionId = el.closest('.exam-card').getAttribute('data-ses-id');
                setTimeout(() => scaleSeatingPlan(sessionId), 10);
            }
        }

        // --- Auto Scaling Engine ---
        function scaleSeatingPlan(id) {
            const container = document.querySelector(`#details-${id} .schema-container`);
            const walls = document.querySelector(`#details-${id} .classroom-walls`);
            if (!container || !walls) return;

            // Reset scale for measurement
            walls.style.transform = 'scale(1)';
            container.style.height = 'auto';

            const availableWidth = container.clientWidth - 60; // 30px padding each side
            const availableHeight = window.innerHeight * 0.7; // Max height for schema
            const actualWidth = walls.offsetWidth;
            const actualHeight = walls.offsetHeight;

            let scale = availableWidth / actualWidth;
            if (actualHeight * scale > availableHeight) {
                scale = availableHeight / actualHeight;
            }

            // Allow upscaling for large screens (e.g., up to 1.5x for inline view)
            scale = Math.min(scale, 1.5);

            walls.style.transform = `scale(${scale})`;
            // Adjust container height to fit the scaled element
            container.style.height = (actualHeight * scale) + 60 + 'px';
        }

        function scaleAllVisiblePlans() {
            openSessions.forEach(id => scaleSeatingPlan(id));
        }

        window.addEventListener('resize', scaleAllVisiblePlans);

        function generateDetailsHtml(item) {
            const ses = item.session;
            const myRoom = item.room;
            
            // Öğrenci durumu (GELMEDİ, KOPYA veya DİĞER) kontrolü
            if (ses.studentStatuses && ses.studentStatuses[currentStudent.no]) {
                const status = ses.studentStatuses[currentStudent.no];
                if (status === 'GELMEDİ' || status === 'KOPYA' || status === 'DİĞER') {
                    return `
                    <div class="glass-panel" style="padding: 2rem; text-align: center; margin-top: 10px; border: 2px solid #fecaca; background: #fef2f2; border-radius: 12px;">
                        <i class="fa-solid fa-ban" style="font-size: 2rem; color: var(--danger); margin-bottom: 10px; display:block;"></i>
                        <h4 style="color: var(--danger); margin:0; font-weight: 900; font-size:1.2rem;">Erişim Engellendi</h4>
                        <p style="color: #7f1d1d; margin-top: 8px; font-weight: 600;">Bu Sınav Bilgilerini Görmeniz mümkün değildir.</p>
                    </div>`;
                }
            }

            const mySeatId = item.seatId;
            const mySeatNum = item.seatNum;
            const myClass = currentStudent.class;
            const schoolDefs = DataManager.getSchoolSettings()?.defaultTimes || {
                examFilesActiveMinutes: 3
            };

            const std = myRoom.seats[mySeatId];
            const matchedSubject = std ? std._matchedSubject : '';

            if (ses.type === 'uygulama') {
                // Application Exam View: No seating plan schema, has duration timer & file launcher
                const now = getNow();
                const targetTime = parseDateTime(ses.date, ses.time);
                const diffStartMins = (now - targetTime) / 1000 / 60;

                const meta = DataManager.getSanitizedSubjectMetadata(ses, matchedSubject) || {};
                const papers = meta.papers || {};
                const files = (Array.isArray(papers.uygulamaFiles) ? papers.uygulamaFiles : (typeof papers === 'string' && papers ? [papers] : [])).filter(f => f && f.trim().length > 5);

                // Arka planda dosyaları IndexedDB önbelleğine almaya başla (Hızlı oynatma için, kademeli ve akıllı gecikmeli)
                if (files && files.length > 0) {
                    files.forEach((fUrl, index) => {
                        // Bellek önbelleğinde varsa zaten işlem yapmaya gerek yok
                        if (DataManager._fileBytesCache[fUrl]) return;
                        
                        // Önce IndexedDB'yi yerel olarak kontrol et (ağ çağrısı yapmaz)
                        DataManager._getIdbCache(fUrl).then(idbBuffer => {
                            if (idbBuffer && DataManager.validateBuffer(idbBuffer)) {
                                DataManager._fileBytesCache[fUrl] = idbBuffer;
                                return;
                            }
                            
                            // Önbellekte yoksa, okul ağını tıkamamak için kademeli/gecikmeli olarak indirmeye başla
                            // Sıra (seatNum) bilgisine göre her öğrencinin isteğini farklı zaman dilimlerine yayıyoruz
                            const seatOffset = (mySeatNum && !isNaN(mySeatNum)) ? (parseInt(mySeatNum) % 10) * 1500 : Math.random() * 8000;
                            const fileOffset = index * 2000; // Aynı öğrencinin birden fazla dosyası varsa aralarında 2 saniye bekle
                            const totalDelay = 500 + seatOffset + fileOffset;
                            
                            setTimeout(() => {
                                DataManager.getFileBytes(fUrl).catch(() => {});
                            }, totalDelay);
                        }).catch(() => {});
                    });
                }

                const turkishNumbers = ["BİRİNCİ", "İKİNCİ", "ÜÇÜNCÜ", "DÖRDÜNCÜ", "BEŞİNCİ", "ALTINCI", "YEDİNCİ", "SEKİZİNCİ", "DOKUZUNCU", "ONUNCU"];

                let filesSection = '';
                if (diffStartMins < schoolDefs.examFilesActiveMinutes) {
                    filesSection = `
                        <div class="glass-panel" style="padding: 2rem; border-radius: 16px; text-align: center; border: 1.5px dashed var(--warning); color: #c2410c; background: rgba(245, 158, 11, 0.04); margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
                            <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.5rem; margin-bottom: 15px; display: block; color: var(--warning);"></i>
                            <div style="font-size: 1.05rem; font-weight: 800; line-height: 1.6; color: #7c2d12;">
                                Uygulama Sınavı dosyaları sınav başlama saatinden ${schoolDefs.examFilesActiveMinutes} dakika sonra aktif olacaktır.<br>
                                <span style="font-size: 0.9rem; font-weight: 600; color: var(--gray-600); opacity: 0.95;">Eğer zamanı geldiği halde dosyalar görünmüyorsa sayfayı yenileyin.</span>
                            </div>
                        </div>`;
                } else {
                    if (files.length === 0) {
                        filesSection = `
                            <div class="glass-panel" style="padding: 2rem; border-radius: 16px; text-align: center; border: 1.5px dashed var(--gray-300); color: var(--gray-500); background: var(--gray-50); margin-bottom: 1.5rem;">
                                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; margin-bottom: 15px; display: block; color: var(--gray-400);"></i>
                                <div style="font-size: 1rem; font-weight: 700;">Bu sınav için tanımlanmış uygulama dosyası bulunamadı.</div>
                            </div>`;
                     } else {
                        filesSection = `
                            <div style="background: white; border-radius: 16px; border: 1px solid var(--gray-200); padding: 1.5rem; box-shadow: var(--shadow-md); margin-bottom: 1.5rem;">
                                <label style="display: block; font-weight: 800; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
                                    <i class="fa-solid fa-folder-open" style="margin-right: 6px;"></i> Sınav Uygulama Dosyaları
                                </label>
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    ${files.map((fileUrl, fIdx) => {
                                        const labelName = `${turkishNumbers[fIdx] || (fIdx + 1) + '.'} DOSYA`;
                                        const encodedUrl = encodeURIComponent(fileUrl);
                                        return `
                                            <button type="button" class="btn btn-primary" onclick="window.playUygulamaMediaStudent(decodeURIComponent('${encodedUrl}'))" style="width: 100%; padding: 1rem 1.5rem; border-radius: 12px; font-weight: 800; font-size: 1rem; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, var(--secondary), #059669); border: none; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15); transition: all 0.2s; text-align: left; color: white; cursor: pointer;">
                                                <span style="display: flex; align-items: center; gap: 12px;">
                                                    <span style="width: 32px; height: 32px; background: rgba(255, 255, 255, 0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 900;">
                                                        ${fIdx + 1}
                                                    </span>
                                                    <span>${labelName}</span>
                                                </span>
                                                <i class="fa-solid fa-circle-play" style="font-size: 1.3rem; opacity: 0.9;"></i>
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                            </div>`;
                    }
                }

                // Prepare Class-wise students (like renderClasswiseList)
                const classStudents = [];
                ses.results.forEach(r => {
                    let roomSeatCounter = 1;
                    const seatToNum = {};
                    for (let g = 1; g <= r.groups; g++) {
                        const conf = r.groupConfigs ? r.groupConfigs[g - 1] : { rows: r.rows || 1, cols: r.cols || 1 };
                        for (let rr = 1; rr <= conf.rows; rr++) {
                            for (let cc = 1; cc <= conf.cols; cc++) {
                                const sid = `G${g}-S${rr}-C${cc}`;
                                if (!(r.disabledSeats && r.disabledSeats.includes(sid))) {
                                    seatToNum[sid] = roomSeatCounter++;
                                }
                            }
                        }
                    }
                    Object.entries(r.seats).forEach(([sid, s]) => {
                        if (s.class === myClass) {
                            classStudents.push({
                                name: s.name,
                                no: s.no,
                                room: r.name,
                                sn: seatToNum[sid] || '-',
                                isMe: s.no.toString() === currentStudent.no.toString(),
                                subject: s._matchedSubject || '-'
                            });
                        }
                    });
                });
                classStudents.sort((a, b) => parseInt(a.no) - parseInt(b.no));

                return `
                    <div class="details-panel">
                        <!-- Sınav Süre Sayacı -->
                        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid rgba(57,255,20,0.25); border-radius: 16px; padding: 1rem 1.25rem 1.25rem; margin-bottom: 1.5rem; text-align: center; color: white; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
                            <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #39FF14; letter-spacing: 1.5px; margin-bottom: 8px; opacity:0.85;">
                                <i class="fa-solid fa-stopwatch" style="margin-right: 6px;"></i> KALAN SÜRENİZ
                            </div>
                            <div id="detail-timer-${ses.id}" style="font-size: 2.6rem; font-weight: 900; font-family: 'JetBrains Mono', 'Courier New', monospace; color: #39FF14; letter-spacing: 3px; text-shadow: 0 0 18px rgba(57,255,20,0.6); padding: 8px 0;">--:--:--</div>
                        </div>

                        <!-- Dosyalar / Bekleme Ekranı -->
                        ${filesSection}

                        <!-- Dağılım Listesi -->
                        ${ses.type !== 'uygulama' ? `
                        <div class="nested-accordion">
                            <div class="nested-header" onclick="toggleNested(this)">
                                <span><i class="fa-solid fa-users-viewfinder" style="color:var(--primary); margin-right:10px;"></i> ${myClass} Sınıfı Dağılım Listesi</span>
                                <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; transition: 0.3s;"></i>
                            </div>
                            <div class="nested-content hidden">
                                <div class="table-responsive">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th style="width:60px;">No</th>
                                                <th>Ad Soyad</th>
                                                <th>Sınav Salonu</th>
                                                <th style="width:80px; text-align:center;">Yer No</th>
                                                <th>Sınav Dersi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${classStudents.map(s => `
                                                <tr style="${s.isMe ? 'background:rgba(16, 185, 129, 0.05); font-weight:bold;' : ''}">
                                                    <td>${s.no}</td>
                                                    <td>${s.name} ${s.isMe ? '<span style="color:var(--secondary); font-size:0.7rem; margin-left:5px;">(SİZSİNİZ)</span>' : ''}</td>
                                                    <td><i class="fa-solid fa-door-open" style="color:var(--gray-400); margin-right:5px; font-size:0.8rem;"></i> ${s.room}</td>
                                                    <td style="text-align:center;"><span class="badge-seat">${s.sn}</span></td>
                                                    <td style="font-size:0.85rem; color:var(--gray-600);">${s.subject}</td>
                                                </tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>`;
            }

            // 1. Prepare Class-wise students (like renderClasswiseList)
            const classStudents = [];
            ses.results.forEach(r => {
                let roomSeatCounter = 1;
                const seatToNum = {};
                for (let g = 1; g <= r.groups; g++) {
                    const conf = r.groupConfigs ? r.groupConfigs[g - 1] : { rows: r.rows || 1, cols: r.cols || 1 };
                    for (let rr = 1; rr <= conf.rows; rr++) {
                        for (let cc = 1; cc <= conf.cols; cc++) {
                            const sid = `G${g}-S${rr}-C${cc}`;
                            if (!(r.disabledSeats && r.disabledSeats.includes(sid))) {
                                seatToNum[sid] = roomSeatCounter++;
                            }
                        }
                    }
                }
                Object.entries(r.seats).forEach(([sid, s]) => {
                    if (s.class === myClass) {
                        classStudents.push({
                            name: s.name,
                            no: s.no,
                            room: r.name,
                            sn: seatToNum[sid] || '-',
                            isMe: s.no.toString() === currentStudent.no.toString(),
                            subject: s._matchedSubject || '-'
                        });
                    }
                });
            });
            classStudents.sort((a, b) => parseInt(a.no) - parseInt(b.no));

            // 2. Prepare Seating Plan (like renderExamResults)
            // Re-calculate visual numbers for myRoom
            let roomSeatCounter = 1;
            const seatToNum = {};
            for (let g = 1; g <= myRoom.groups; g++) {
                const conf = myRoom.groupConfigs ? myRoom.groupConfigs[g - 1] : { rows: myRoom.rows || 1, cols: myRoom.cols || 1 };
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(myRoom.disabledSeats && myRoom.disabledSeats.includes(sid))) {
                            seatToNum[sid] = roomSeatCounter++;
                        }
                    }
                }
            }

            let groupsHtml = '<div class="groups-row">';
            for (let g = 1; g <= myRoom.groups; g++) {
                const cf = myRoom.groupConfigs ? myRoom.groupConfigs[g - 1] : { rows: myRoom.rows || 1, cols: myRoom.cols || 1 };
                groupsHtml += `<div class="desk-group" style="grid-template-columns:repeat(${cf.cols}, 1fr)">`;

                // Front to Back (rows reversed in view)
                for (let r = cf.rows; r >= 1; r--) {
                    for (let c = 1; c <= cf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        const isMe = (sid === mySeatId);
                        const disabled = (myRoom.disabledSeats || []).includes(sid);
                        const std = myRoom.seats[sid];
                        const num = seatToNum[sid] || '-';

                        if (disabled) {
                            groupsHtml += `<div class="desk" style="opacity:0.2; border: 1px dashed var(--gray-300);"></div>`;
                        } else if (std) {
                            const fullName = std.name;

                            // Check for same-subject neighbors (Rule: Like renderExamResults in ui.js)
                            let neighborColor = '';
                            const neighbors = [
                                { sid: `G${g}-S${r}-C${c - 1}`, type: 'side' }, // Left
                                { sid: `G${g}-S${r}-C${c + 1}`, type: 'side' }, // Right
                                { sid: `G${g}-S${r - 1}-C${c}`, type: 'vertical' }, // Front
                                { sid: `G${g}-S${r + 1}-C${c}`, type: 'vertical' }, // Back
                                { sid: `G${g}-S${r - 1}-C${c - 1}`, type: 'side' }, // Diag FL
                                { sid: `G${g}-S${r - 1}-C${c + 1}`, type: 'side' }, // Diag FR
                                { sid: `G${g}-S${r + 1}-C${c - 1}`, type: 'side' }, // Diag BL
                                { sid: `G${g}-S${r + 1}-C${c + 1}`, type: 'side' }  // Diag BR
                            ];

                            neighbors.forEach(n => {
                                const nStd = myRoom.seats[n.sid];
                                if (nStd && nStd._matchedSubject === std._matchedSubject) {
                                    if (n.type === 'vertical') {
                                        if (neighborColor !== 'rgba(239, 68, 68, 0.15)') neighborColor = 'rgba(245, 158, 11, 0.15)'; // Yellow for vertical
                                    } else {
                                        neighborColor = 'rgba(239, 68, 68, 0.15)'; // Red for side/diag
                                    }
                                }
                            });

                            let deskBorder = isMe ? '3px solid var(--secondary)' : (neighborColor ? (neighborColor.includes('239') ? '2px solid var(--danger)' : '2px solid var(--warning)') : '2px solid var(--gray-300)');

                            groupsHtml += `
                                <div class="desk ${isMe ? 'current-student' : ''}" style="background: ${isMe ? '#ecfdf5' : (neighborColor || 'white')}; border: ${deskBorder};">
                                    <div style="font-size:0.75rem; color:var(--gray-500); font-weight:700;">${std.class} / ${std.no}</div>
                                    <div style="font-size:0.85rem; font-weight:800; color:var(--dark); margin:6px 0; line-height:1.2; word-break: break-word;">${fullName}</div>
                                    <div style="font-size:0.7rem; color:var(--gray-400); font-weight:600;">${std._matchedSubject || '-'}</div>
                                    <div class="desk-num">${num}</div>
                                    ${isMe ? '<div style="font-size:0.7rem; font-weight:900; color:var(--secondary); position:absolute; top:4px; right:6px;"><i class="fa-solid fa-star"></i></div>' : ''}
                                </div>`;
                        } else {
                            groupsHtml += `<div class="desk empty"><div class="desk-num">${num}</div><div style="font-size:0.65rem; color:var(--danger); font-weight:700; margin-top:15px;">BOŞ</div></div>`;
                        }
                    }
                }
                groupsHtml += '</div>';
            }
            groupsHtml += '</div>';

            const frontAreaHtml = `
                <div class="front-area">
                    ${myRoom.teacherDeskPos === 'left' ? '<div class="teacher-desk">DERS ÖĞRETMEN MASASI</div><div class="board">SINAV TAHTASI</div><div style="width:100px;"></div>' : '<div style="width:100px;"></div><div class="board">SINAV TAHTASI</div><div class="teacher-desk">MASA</div>'}
                </div>`;

            return `
                <div class="details-panel">
                    <div style="background: linear-gradient(135deg, var(--secondary), #059669); color:white; padding:1.25rem; border-radius:16px; margin-bottom:1.5rem; display:flex; align-items:center; gap:1.25rem; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2); position: relative;">
                        <div style="width:48px; height:48px; background:rgba(255,255,255,0.2); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                            <i class="fa-solid fa-location-dot"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="font-size:0.85rem; opacity:0.9; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Sınav Yeriniz</div>
                            <div style="font-size:1.4rem; font-weight:900;">${myRoom.name} Salonu <span style="opacity:0.5; margin:0 5px;">|</span> Sıra No: ${mySeatNum}</div>
                        </div>
                    </div>

                    <div class="nested-accordion">
                        <div class="nested-header" onclick="toggleNested(this)">
                            <span><i class="fa-solid fa-users-viewfinder" style="color:var(--primary); margin-right:10px;"></i> ${myClass} Sınıfı Dağılım Listesi</span>
                            <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; transition: 0.3s;"></i>
                        </div>
                        <div class="nested-content hidden">
                            <div class="table-responsive">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th style="width:60px;">No</th>
                                            <th>Ad Soyad</th>
                                            <th>Sınav Salonu</th>
                                            <th style="width:80px; text-align:center;">Yer No</th>
                                            <th>Sınav Dersi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${classStudents.map(s => `
                                            <tr style="${s.isMe ? 'background:rgba(16, 185, 129, 0.05); font-weight:bold;' : ''}">
                                                <td>${s.no}</td>
                                                <td>${s.name} ${s.isMe ? '<span style="color:var(--secondary); font-size:0.7rem; margin-left:5px;">(SİZSİNİZ)</span>' : ''}</td>
                                                <td><i class="fa-solid fa-door-open" style="color:var(--gray-400); margin-right:5px; font-size:0.8rem;"></i> ${s.room}</td>
                                                <td style="text-align:center;"><span class="badge-seat">${s.sn}</span></td>
                                                <td style="font-size:0.85rem; color:var(--gray-600);">${s.subject}</td>
                                            </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    ${(ses.screenViewEnabled && ses.screenViewLimit === 0) ? `
                    <div class="nested-accordion">
                        <div class="nested-header" onclick="toggleNested(this)">
                            <span><i class="fa-solid fa-thumbtack" style="color:var(--primary); margin-right:10px;"></i> ${myRoom.name} Salonu Oturma Planı</span>
                            <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; transition: 0.3s;"></i>
                        </div>
                        <div class="nested-content hidden">
                            <div class="schema-container">
                                <div class="classroom-walls">
                                    ${groupsHtml}
                                    ${frontAreaHtml}
                                </div>
                            </div>
                            <div style="margin-top:1.5rem; display:flex; gap:15px; flex-wrap:wrap; justify-content:center; font-size:0.8rem;">
                                <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px; height:12px; background:#ecfdf5; border:2px solid var(--secondary); border-radius:3px;"></div> Sizin Yeriniz</div>
                                <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px; height:12px; background:rgba(239, 68, 68, 0.15); border:1.5px solid var(--danger); border-radius:3px;"></div> Aynı Ders (Yan/Çapraz)</div>
                                <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px; height:12px; background:rgba(245, 158, 11, 0.15); border:1.5px solid var(--warning); border-radius:3px;"></div> Aynı Ders (Arka/Ön)</div>
                            </div>
                        </div>
                    </div>` : ''}
                </div>`;
        }

        // --- APPLICATION EXAM MEDIA PLAYER FOR STUDENTS ---
        window.playUygulamaMediaStudent = async function(url) {
            if (!url) {
                Swal.fire('Eksik', 'Geçersiz dosya bağlantısı', 'warning');
                return;
            }
            const lowerUrl = url.toLowerCase();

            // YouTube detection
            const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
            // Vimeo detection
            const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i);

            if (ytMatch) {
                const videoId = ytMatch[1];
                const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&controls=1`;
                Swal.fire({
                    title: 'YouTube Medya Oynatıcı',
                    html: `
                    <div style="background:#1e293b; color:#fff; border-radius:12px; padding:15px; text-align:center;">
                        <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; background:#000; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                            <iframe src="${embedUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
                        </div>
                        <div style="margin-top:15px; border-top:1px solid #334155; padding-top:12px; display:flex; flex-direction:column; gap:8px;">
                            <div style="text-align:left; font-size:0.75rem; color:#94a3b8; line-height:1.4;">
                                <i class="fa-brands fa-youtube" style="color:#ef4444; font-size: 0.95rem; margin-right:4px;"></i> 
                                YouTube bağlantısı gömülü güvenli oynatıcı aracılığıyla yürütülüyor.
                            </div>
                        </div>
                    </div>`,
                    width: '720px',
                    background: '#1e293b',
                    showCloseButton: true,
                    showConfirmButton: false
                });
                return;
            }

            if (vimeoMatch) {
                const videoId = vimeoMatch[1];
                const embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1`;
                Swal.fire({
                    title: 'Vimeo Medya Oynatıcı',
                    html: `
                    <div style="background:#1e293b; color:#fff; border-radius:12px; padding:15px; text-align:center;">
                        <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; background:#000; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                            <iframe src="${embedUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allow="autoplay; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
                        </div>
                        <div style="margin-top:15px; border-top:1px solid #334155; padding-top:12px; display:flex; flex-direction:column; gap:8px;">
                            <div style="text-align:left; font-size:0.75rem; color:#94a3b8; line-height:1.4;">
                                <i class="fa-brands fa-vimeo" style="color:#00adef; font-size: 0.95rem; margin-right:4px;"></i> 
                                Vimeo bağlantısı gömülü güvenli oynatıcı aracılığıyla yürütülüyor.
                            </div>
                        </div>
                    </div>`,
                    width: '720px',
                    background: '#1e293b',
                    showCloseButton: true,
                    showConfirmButton: false
                });
                return;
            }

            // Extract Google Drive ID if present
            let isGoogleDrive = false;
            let fileId = '';
            if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
                isGoogleDrive = true;
                const parts = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                              url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                              url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                              url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
                if (parts) {
                    fileId = parts[1];
                }
            }

            // Proactive Cache (IndexedDB) Lookup
            let downloadUrl = isGoogleDrive && fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url;
            let cacheInfoHtml = `
                <div id="klbk-player-status" style="font-size:0.8rem; color:#94a3b8; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <i class="fa-solid fa-bolt" style="color:#eab308;"></i> <span>Anında Akış Modu</span>
                </div>`;

            // Hızlı yerel önbellek kontrolü (Arayüzün açılmasını geciktirmez, <5ms)
            let cachedBytes = DataManager._fileBytesCache[url];
            if (!cachedBytes) {
                try {
                    const idbBuffer = await DataManager._getIdbCache(url);
                    if (idbBuffer && DataManager.validateBuffer(idbBuffer)) {
                        DataManager._fileBytesCache[url] = idbBuffer;
                        cachedBytes = idbBuffer;
                    }
                } catch (e) {
                    console.warn("Local IDB cache quick lookup failed", e);
                }
            }

            if (cachedBytes && cachedBytes.byteLength > 0) {
                const mime = DataManager.detectMimeType(cachedBytes);
                const blob = new Blob([cachedBytes], { type: mime });
                downloadUrl = URL.createObjectURL(blob);
                cacheInfoHtml = `
                    <div id="klbk-player-status" style="font-size:0.8rem; color:#34d399; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="fa-solid fa-circle-check" style="color:#34d399;"></i> <span style="font-weight:600; color:#34d399;">Önbellekten Hızlı Oynatılıyor (0 Gecikme)</span>
                    </div>`;
            } else {
                // Önbellekte yoksa, arka planda indirmeyi başlatıyoruz (oynatıcı akışla oynatırken arka planda önbelleğe alınır)
                DataManager.getFileBytes(url).catch(err => console.warn("Background caching failed:", err));
            }

            const showMediaError = () => {
                Swal.fire({
                    title: 'Medya Yüklenemedi',
                    html: `
                    <div style="text-align: left; font-size: 0.95rem; line-height: 1.5; color: var(--gray-700);">
                        <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-bottom: 15px; color: #b91c1c; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-circle-exclamation" style="font-size: 1.2rem;"></i>
                            <span>Dosya Erişimi Engellendi veya Bağlantı Hatası</span>
                        </div>
                        <p>Sınav medya dosyası yüklenemedi. Bu hatanın en yaygın sebepleri şunlardır:</p>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                            <ul style="margin: 0; padding-left: 20px; font-weight: 600; color: #475569; font-size: 0.85rem;">
                                <li style="margin-bottom:4px;">Google Drive dosyasının paylaşım ayarı <strong>"Bağlantıya sahip olan herkes"</strong> olarak ayarlanmamış olabilir.</li>
                                <li style="margin-bottom:4px;">Dosya bağlantısı hatalı veya erişilemez durumda olabilir.</li>
                                <li>Lütfen <strong>sınav görevlisi öğretmeninize</strong> durumu bildirerek izinleri kontrol etmesini rica edin.</li>
                            </ul>
                        </div>
                    </div>`,
                    width: '600px',
                    confirmButtonText: 'Kapat',
                    confirmButtonColor: '#6366f1'
                });
            };

            window.currentShowMediaError = showMediaError;

            window.handleKlbkPlayerError = async function(mediaElement, originalUrl) {
                if (mediaElement.dataset.fallbackTriggered) return;
                mediaElement.dataset.fallbackTriggered = "true";

                console.warn("Direct streaming failed, trying background download...", originalUrl);
                const statusEl = document.getElementById('klbk-player-status');
                if (statusEl) {
                    statusEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="color:#818cf8; margin-right:6px;"></i> <span style="color:#a5b4fc; font-weight:600;">İlk oynatım için dosya hazırlanıyor...</span>`;
                }

                try {
                    const buffer = await DataManager.getFileBytes(originalUrl);
                    if (!buffer || buffer.byteLength === 0) {
                        throw new Error("Boş dosya");
                    }
                    let mime = DataManager.detectMimeType(buffer);
                    const blob = new Blob([buffer], { type: mime });
                    const blobUrl = URL.createObjectURL(blob);
                    
                    const isVideoMime = mime.startsWith('video/');
                    const isAudioMime = mime.startsWith('audio/');
                    const isImageMime = mime.startsWith('image/');
                    const isPdfMime = mime === 'application/pdf';

                    if (isVideoMime && mediaElement.tagName === 'AUDIO') {
                        const parent = mediaElement.parentElement;
                        const videoEl = document.createElement('video');
                        videoEl.id = 'klbk-native-video';
                        videoEl.controls = true;
                        videoEl.setAttribute('controlsList', 'nodownload noplaybackrate');
                        videoEl.setAttribute('disablePictureInPicture', 'true');
                        videoEl.setAttribute('oncontextmenu', 'return false;');
                        videoEl.autoplay = true;
                        videoEl.style.cssText = 'width:100%; max-height:360px; border-radius:8px; background:#000;';
                        videoEl.dataset.blobUrl = blobUrl;
                        videoEl.src = blobUrl;
                        videoEl.dataset.fallbackTriggered = "true";
                        parent.replaceChild(videoEl, mediaElement);
                        videoEl.load();
                        videoEl.oncanplay = () => {
                            videoEl.play().catch(e => console.error("Playback failed after fallback swap:", e));
                        };
                    } else if (isAudioMime && mediaElement.tagName === 'VIDEO') {
                        const parent = mediaElement.parentElement;
                        const audioEl = document.createElement('audio');
                        audioEl.id = 'klbk-native-audio';
                        audioEl.controls = true;
                        audioEl.setAttribute('controlsList', 'nodownload noplaybackrate');
                        audioEl.setAttribute('oncontextmenu', 'return false;');
                        audioEl.autoplay = true;
                        audioEl.style.cssText = 'width:100%; max-width:500px; margin:20px 0;';
                        audioEl.dataset.blobUrl = blobUrl;
                        audioEl.src = blobUrl;
                        audioEl.dataset.fallbackTriggered = "true";
                        parent.replaceChild(audioEl, mediaElement);
                        audioEl.load();
                        audioEl.oncanplay = () => {
                            audioEl.play().catch(e => console.error("Playback failed after fallback swap:", e));
                        };
                    } else if (isImageMime) {
                        const parent = mediaElement.parentElement;
                        const imgEl = document.createElement('img');
                        imgEl.src = blobUrl;
                        imgEl.style.cssText = 'width:100%; max-height:400px; object-fit:contain; border-radius:8px;';
                        imgEl.setAttribute('oncontextmenu', 'return false;');
                        parent.replaceChild(imgEl, mediaElement);
                    } else if (isPdfMime) {
                        const parent = mediaElement.parentElement;
                        const iframeEl = document.createElement('iframe');
                        iframeEl.src = blobUrl;
                        iframeEl.style.cssText = 'width:100%; height:450px; border:none; border-radius:8px;';
                        iframeEl.setAttribute('oncontextmenu', 'return false;');
                        iframeEl.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
                        parent.replaceChild(iframeEl, mediaElement);
                    } else {
                        mediaElement.dataset.blobUrl = blobUrl;
                        mediaElement.src = blobUrl;
                        mediaElement.load();
                        mediaElement.oncanplay = () => {
                            mediaElement.play().catch(e => console.error("Playback failed after fallback:", e));
                        };
                    }

                    if (statusEl) {
                        statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#34d399; margin-right:6px;"></i> <span style="color:#34d399; font-weight:600;">Hazır (Bellekten Oynatılıyor)</span>`;
                    }
                } catch (err) {
                    console.error("Fallback download error:", err);
                    if (statusEl) {
                        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; margin-right:5px;"></i> <span style="color:#f87171; font-weight:600;">Dosya yüklenemedi!</span>`;
                    }
                    if (window.currentShowMediaError) {
                        window.currentShowMediaError();
                    }
                }
            };

            // Guess MIME type synchronously to display player instantly
            const guessMimeType = (u) => {
                const lower = u.toLowerCase();
                if (lower.match(/\.(mp4|m4v|webm)$/) || lower.includes('video') || lower.includes('mp4')) return 'video/mp4';
                if (lower.match(/\.(mp3|mpeg|wav|ogg|m4a)$/) || lower.includes('audio') || lower.includes('ses') || lower.includes('sound') || lower.includes('mp3')) return 'audio/mpeg';
                if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/) || lower.includes('gorsel') || lower.includes('resim')) return 'image/jpeg';
                if (lower.match(/\.pdf$/) || lower.includes('pdf')) return 'application/pdf';
                if (u.includes('drive.google.com') || u.includes('docs.google.com')) return 'audio/mpeg'; // Default to audio for Google Drive
                return 'audio/mpeg'; // Safe default for listening exam application links
            };
            const mimeType = guessMimeType(url);

            const isAudio = mimeType.startsWith('audio/') || lowerUrl.includes('.mp3') || lowerUrl.includes('.wav') || lowerUrl.includes('.m4a') || lowerUrl.includes('.ogg') || lowerUrl.includes('audio') || lowerUrl.includes('ses');
            const isVideo = mimeType.startsWith('video/') || lowerUrl.includes('.mp4') || lowerUrl.includes('.webm') || lowerUrl.includes('.m4v') || lowerUrl.includes('video');
            const isImage = mimeType.startsWith('image/') || lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.png') || lowerUrl.includes('.gif') || lowerUrl.includes('.webp') || lowerUrl.includes('gorsel') || lowerUrl.includes('resim');
            const isPdf = mimeType === 'application/pdf' || lowerUrl.includes('.pdf');

            let swalConfig = {};

            if (isVideo) {
                swalConfig = {
                    title: 'Video Oynatıcı',
                    html: `
                    <div style="background:#1e293b; color:#fff; border-radius:12px; padding:15px; text-align:center;">
                        ${cacheInfoHtml}
                        <video id="klbk-native-video" src="${downloadUrl}" controls controlsList="nodownload noplaybackrate" disablePictureInPicture oncontextmenu="return false;" autoplay style="width:100%; max-height:400px; border-radius:8px;" onerror="window.handleKlbkPlayerError(this, '${url}')">
                            Tarayıcınız video etiketini desteklemiyor.
                        </video>
                    </div>`,
                    width: '600px',
                    background: '#1e293b'
                };
            } else if (isAudio) {
                swalConfig = {
                    title: 'Ses Oynatıcı',
                    html: `
                    <div style="background:#1e293b; color:#fff; border-radius:12px; padding:15px; text-align:center;">
                        ${cacheInfoHtml}
                        <audio id="klbk-native-audio" src="${downloadUrl}" controls controlsList="nodownload noplaybackrate" oncontextmenu="return false;" autoplay style="width:100%; margin-top:10px;" onerror="window.handleKlbkPlayerError(this, '${url}')">
                            Tarayıcınız ses etiketini desteklemiyor.
                        </audio>
                    </div>`,
                    width: '400px',
                    background: '#1e293b'
                };
            } else if (isImage) {
                swalConfig = {
                    title: 'Görsel Önizleme',
                    html: `<img src="${downloadUrl}" style="width:100%; max-height:400px; object-fit:contain; border-radius:8px;" oncontextmenu="return false;">`,
                    width: '600px',
                };
            } else if (isPdf) {
                swalConfig = {
                    title: 'Dosya Önizleme (PDF)',
                    html: `<iframe src="${downloadUrl}" style="width:100%; height:550px; border:none; border-radius:8px;" oncontextmenu="return false;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`,
                    width: '700px',
                };
            } else {
                swalConfig = {
                    title: 'Dosya Önizleme',
                    html: `<iframe src="${downloadUrl}" style="width:100%; height:550px; border:none; border-radius:8px;" oncontextmenu="return false;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`,
                    width: '700px',
                };
            }

            Swal.fire({
                ...swalConfig,
                showCloseButton: true,
                showConfirmButton: false,
                didClose: () => {
                    const audio = document.getElementById('klbk-native-audio');
                    const video = document.getElementById('klbk-native-video');
                    if (audio && audio.dataset.blobUrl) URL.revokeObjectURL(audio.dataset.blobUrl);
                    if (video && video.dataset.blobUrl) URL.revokeObjectURL(video.dataset.blobUrl);
                }
            });
        };

        // --- FULL SCREEN SEATING PLAN LOGIC ---
        let currentFullScreenSessionId = null;
        let userClosedFullScreen = false;
        let activeMessages = new Map(); // Store active message windows
        window.pdfTabs = window.pdfTabs || []; // To track opened PDF tabs for automatic closing

        window.openPdfTab = async function (url) {
            if (!url) return;
            if (!window.pdfTabs) window.pdfTabs = [];

            Swal.fire({
                title: 'Soru Kağıdı Hazırlanıyor...',
                text: 'Dosya güvenli şekilde hazırlanıyor, lütfen bekleyin.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                // 1. Get bytes via GAS Proxy (Bypasses CORS and prevents direct download)
                const bytes = await DataManager.getFileBytes(url);
                if (!bytes) throw new Error("Dosya indirilemedi (Bağlantı hatası).");

                let blobUrl;
                let title = 'Soru Kağıdı';

                const stdUser = window.currentStudent;
                const session = window.currentRenderedSession;

                if (!stdUser) {
                    // SMARTBOARD MODE: Skip personalization, just open as Blob
                    const blob = new Blob([bytes], { type: 'application/pdf' });
                    blobUrl = URL.createObjectURL(blob);
                } else {
                    // STUDENT MODE: Personalize with header
                    const pdfDoc = await PDFLib.PDFDocument.load(bytes);
                    const pages = pdfDoc.getPages();
                    const firstPage = pages[0];
                    const { width, height } = firstPage.getSize();

                    let info = null;
                    if (session && session.results) {
                        for (const room of session.results) {
                            const seatId = Object.keys(room.seats || {}).find(sid => room.seats[sid].no === stdUser.no);
                            if (seatId) {
                                const stdData = room.seats[seatId];
                                let seatNum = '-';
                                let ctr = 1;
                                for (let g = 1; g <= room.groups; g++) {
                                    const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                                    for (let r = 1; r <= cf.rows; r++) {
                                        for (let c = 1; c <= cf.cols; c++) {
                                            const sid = `G${g}-S${r}-C${c}`;
                                            if (!(room.disabledSeats || []).includes(sid)) {
                                                if (sid === seatId) seatNum = ctr;
                                                ctr++;
                                            }
                                        }
                                    }
                                }
                                info = {
                                    name: stdData.name,
                                    no: stdData.no,
                                    class: stdData.class,
                                    room: room.name,
                                    seat: seatNum.toString(),
                                    subject: stdData._matchedSubject || '',
                                    examNo: DataManager.getSanitizedSubjectMetadata(session, stdData._matchedSubject || '').examNo || ''
                                };
                                break;
                            }
                        }
                    }

                    if (info) {
                        title = 'Soru Kağıdı - ' + info.name;
                        const A4_W = 595.28, A4_H = 841.89;
                        const sf = 1 / Math.min(A4_W / width, A4_H / height);
                        const fonts = await DataManager.loadRequiredFonts(pdfDoc);

                        await window.renderStudentPDFHeader(pdfDoc, firstPage, info, {
                            ...fonts,
                            sf: sf,
                            session: session,
                            designType: DataManager.getSanitizedSubjectMetadata(session, info.subject).pdfHeaderDesign || '1'
                        });
                    }

                    const modifiedPdfBytes = await pdfDoc.save();
                    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
                    blobUrl = URL.createObjectURL(blob);
                }

                Swal.close();
                const newWin = window.openSafePdf(blobUrl, title);
                if (newWin) {
                    newWin._sessionId = session.id;
                    window.pdfTabs.push(newWin);
                }

            } catch (err) {
                console.error("OpenPdfTab Error:", err);
                Swal.fire({
                    icon: 'error',
                    title: 'Dosya Açılamadı',
                    text: 'Hata: ' + err.message + '. Lütfen yetkilerinizi veya internet bağlantınızı kontrol edin.'
                });
            }
        };

        function checkLiveMessages() {
            if (!currentStudent) return;
            const sessions = DataManager.getExamSessions();
            const now = getNow();

            // Find all subjects in the rooms where the student is assigned
            const subjectsInMyRooms = new Set();
            sessions.forEach(ses => {
                if (!ses.results) return;
                ses.results.forEach(room => {
                    const isStudentInThisRoom = Object.values(room.seats).some(seat =>
                        seat.no.toString() === currentStudent.no.toString()
                    );
                    if (isStudentInThisRoom) {
                        Object.values(room.seats).forEach(seat => {
                            if (seat._matchedSubject) subjectsInMyRooms.add(seat._matchedSubject);
                        });
                    }
                });
            });

            // Group relevant messages by subject
            const groupedMessages = {};
            sessions.forEach(ses => {
                if (ses.type === 'uygulama') return; // Suppress live messages for application exams
                if (ses.liveMessages) {
                    ses.liveMessages.forEach(m => {
                        if (m.expireAt > now && subjectsInMyRooms.has(m.subject)) {
                            // Filter out already closed message IDs
                            if (window.closedMessageIds && window.closedMessageIds.has(m.timestamp)) return;

                            if (!groupedMessages[m.subject]) groupedMessages[m.subject] = [];
                            groupedMessages[m.subject].push(m);
                        }
                    });
                }
            });


            // Remove windows for subjects that no longer have active unclosed messages
            activeMessages.forEach((win, subject) => {
                if (!groupedMessages[subject]) {
                    win.remove();
                    activeMessages.delete(subject);
                }
            });

            // Add or update windows for each subject group
            Object.entries(groupedMessages).forEach(([subject, messages]) => {
                if (!activeMessages.has(subject)) {
                    createMessageWindow(subject, messages);
                } else {
                    updateMessageWindowContent(subject, messages);
                }
            });
        }



        function updateMessageWindowContent(subject, messages) {
            const win = activeMessages.get(subject);
            if (!win) return;
            const content = win.querySelector('.window-content');
            if (content) {
                content.innerHTML = messages.map(msg => {
                    const isFemale = msg.gender === 'kadin';
                    const icon = isFemale ? 'fa-user-graduate' : 'fa-user-tie';
                    const color = isFemale ? '#ec4899' : '#4f46e5';
                    
                    return `
                    <div style="border-bottom:1px solid #f1f5f9; padding-bottom:10px; margin-bottom:10px; last-child:border-bottom:none;">
                        <div style="font-size:0.75rem; color:var(--gray-500); margin-bottom:5px; font-weight:700; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid ${icon}" style="color:${color}"></i> ${msg.author} <span style="font-weight:normal; margin-left:5px; opacity:0.7;">(${new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})</span>
                        </div>
                        <p style="font-size: 1.1rem; font-weight: 800; color: var(--dark); line-height: 1.4; margin: 0;">${msg.text}</p>
                    </div>`;
                }).join('');
            }
        }

        function createMessageWindow(subject, messages) {
            const container = document.getElementById('notificationContainer');
            const win = document.createElement('div');
            win.className = 'floating-window animate-in';
            // Use a safe ID for the DOM element (optional, for debugging)
            const safeSubject = subject.replace(/[^a-zA-Z0-9]/g, '_');
            win.id = `win-subj-${safeSubject}`;
            win.style.zIndex = 10000 + activeMessages.size;

            win.innerHTML = `
                <div class="window-header" onmousedown="startDragging(event, '${subject.replace(/'/g, "'")}')">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-bell fa-shake" style="color:var(--danger)"></i>
                        <span style="font-weight:900; font-size:0.8rem; color:var(--danger); text-transform:uppercase;">${subject}</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="minimize-btn" title="Küçült" style="background:none; border:none; cursor:pointer; color:var(--gray-400);"><i class="fa-solid fa-minus"></i></button>
                        <button class="close-btn" title="Kapat" style="background:none; border:none; cursor:pointer; color:var(--gray-400);"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
                <div class="window-content">
                    <!-- populated by updateMessageWindowContent -->
                </div>
            `;

            container.appendChild(win);
            activeMessages.set(subject, win);
            updateMessageWindowContent(subject, messages);

            // Re-bind buttons directly to avoid selector issues with special characters in ID
            win.querySelector('.minimize-btn').onclick = () => toggleMinimize(subject);
            win.querySelector('.close-btn').onclick = () => closeSubjectWindow(subject, messages);

            // Play notification sound
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch (e) { }
        }

        function toggleMinimize(subject) {
            const win = activeMessages.get(subject);
            if (win) {
                win.classList.toggle('minimized');
            }
        }

        function closeSubjectWindow(subject, messages) {
            const win = activeMessages.get(subject);
            if (win) {
                win.style.opacity = '0';
                win.style.transform = 'scale(0.8) translateX(50px)';
                setTimeout(() => {
                    win.remove();
                    activeMessages.delete(subject);
                }, 300);
            }
            // Mark all current messages in this window as closed
            if (!window.closedMessageIds) window.closedMessageIds = new Set();
            messages.forEach(m => window.closedMessageIds.add(m.timestamp));
        }

        // --- Dragging Logic ---
        let draggedElement = null;
        let offset = { x: 0, y: 0 };

        function startDragging(e, subject) {
            const win = activeMessages.get(subject);
            if (!win) return;
            draggedElement = win;

            // Bring to front
            activeMessages.forEach(w => w.style.zIndex = 10000);
            win.style.zIndex = 10001;

            const rect = win.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;

            win.style.position = 'fixed';
            win.style.left = rect.left + 'px';
            win.style.top = rect.top + 'px';
            win.style.right = 'auto'; // Break from container flow

            document.addEventListener('mousemove', onDragging);
            document.addEventListener('mouseup', stopDragging);
        }

        function onDragging(e) {
            if (!draggedElement) return;
            draggedElement.style.left = (e.clientX - offset.x) + 'px';
            draggedElement.style.top = (e.clientY - offset.y) + 'px';
        }

        function stopDragging() {
            draggedElement = null;
            document.removeEventListener('mousemove', onDragging);
            document.removeEventListener('mouseup', stopDragging);
        }

        function checkFullScreenTriggers() {
            if (!currentStudent) return;
            const sessions = DataManager.getSortedExamSessions();
            const now = getNow();
            const myRoomName = DataManager.getSanitizedClassRoomMapping(currentStudent.class);

            if (!myRoomName) return;

            // --- PDF Otomatik Kapatma Mantığı ---
            if (window.pdfTabs && window.pdfTabs.length > 0) {
                window.pdfTabs = window.pdfTabs.filter(win => {
                    try {
                        if (!win || win.closed) return false;
                        const sid = win._sessionId;
                        if (sid) {
                            const ses = sessions.find(s => s.id === sid);
                            // Seans yayından kalkmışsa veya genel olarak paylaşılan kağıtlar temizlenmişse kapat
                            if (!ses || !ses.isPublished) {
                                win.close();
                                return false;
                            }
                            // Eğer öğretmen "Soru Kağıdını Paylaş" tikini kaldırmışsa (Tüm branşlar için)
                            if (ses.subjectMetadata) {
                                let anyShared = false;
                                Object.values(ses.subjectMetadata).forEach(m => { if (m.isShared) anyShared = true; });
                                if (!anyShared) {
                                    win.close();
                                    return false;
                                }
                            }
                        }
                        return true;
                    } catch (e) { return false; }
                });
            }

            let activeSession = null;
            let activeRoomData = null;

            for (let ses of sessions) {
                if (!ses.isPublished || !ses.screenViewEnabled || !ses.results || ses.type === 'uygulama') continue;

                const targetTime = DataManager.parseSessionDateTime(ses.date, ses.time);
                const durationMins = ses.examDuration || 40;
                const endTime = new Date(targetTime.getTime() + durationMins * 60 * 1000);
                const diffMins = (targetTime - now) / 1000 / 60;
                const diffEndMins = (endTime - now) / 1000 / 60;

                const defaultScreenLimit = DataManager.getSchoolSettings()?.defaultTimes?.defaultScreenViewLimit || 8;
                const limit = (ses.screenViewLimit === 0) ? 999999 : ((ses.screenViewLimit === undefined) ? defaultScreenLimit : ses.screenViewLimit);
                
                if (Math.floor(diffMins) <= limit && diffEndMins >= -3) {
                    const roomResult = ses.results.find(r => r.name === myRoomName);
                    if (roomResult) {
                        activeSession = ses;
                        activeRoomData = roomResult;
                        break;
                    }
                }
            }

            if (activeSession && activeRoomData) {
                const examStartTime = DataManager.parseSessionDateTime(activeSession.date, activeSession.time);
                const durationMins = activeSession.examDuration || 40;
                const examEndTime = new Date(examStartTime.getTime() + durationMins * 60 * 1000);
                const isExamActive = (now >= examStartTime && now <= examEndTime);

                // Sadece görseli etkileyen alanları hash'e dahil et.
                // triggeredSmartboards gibi volatile metadata hariç bırakılmalı,
                // yoksa cloudSync her döngüde farklı JSON üretip sonsuz yenileme tetikler.
                const sessionHashData = {
                    id: activeSession.id,
                    results: activeSession.results,
                    subjectMetadata: activeSession.subjectMetadata,
                    screenViewTimerEnabled: activeSession.screenViewTimerEnabled,
                    examDuration: activeSession.examDuration,
                    name: activeSession.name,
                    date: activeSession.date,
                    time: activeSession.time,
                    _active: isExamActive
                };
                const sessionHash = JSON.stringify(sessionHashData);
                // Eğer seans değişmişse VEYA seans içindeki veriler (örn: PDF paylaşımı) değişmişse VEYA sınav başladığı/bittiği an ise yeniden çiz
                if ((currentFullScreenSessionId !== activeSession.id || window._lastActiveSessionHash !== sessionHash) && !userClosedFullScreen) {
                    window._lastActiveSessionHash = sessionHash;
                    
                    // Close previous session's PDF tabs if switching sessions
                    if (currentFullScreenSessionId !== activeSession.id && pdfTabs.length > 0) {
                        pdfTabs.forEach(win => { try { win.close(); } catch (e) { } });
                        pdfTabs = [];
                    }
                    currentFullScreenSessionId = activeSession.id;
                    renderFullScreenPlan(activeRoomData, activeSession);

                    if (!activeSession.triggeredSmartboards) activeSession.triggeredSmartboards = {};
                    if (!activeSession.triggeredSmartboards[currentStudent.class]) {
                        activeSession.triggeredSmartboards[currentStudent.class] = currentStudent.no;
                        DataManager.addExamSession(activeSession);
                    }
                }
            } else {
                // Exam ended or no active session for this classroom
                if (window.currentFullScreenSessionId) {
                    window.closeFullScreenPlan();
                    if (pdfTabs.length > 0) {
                        pdfTabs.forEach(win => { try { win.close(); } catch (e) { } });
                        pdfTabs = [];
                    }
                }
                currentFullScreenSessionId = null;
                userClosedFullScreen = false;
            }
        }

        function closeFullScreenPlan(isManual = false) {
            const overlay = document.getElementById('fullScreenPlanOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }

            if (window.fullScreenTimerInterval) {
                clearInterval(window.fullScreenTimerInterval);
                window.fullScreenTimerInterval = null;
            }

            // Restore student info UI
            const resultsView = document.getElementById('resultsView');
            if (resultsView && currentStudent) resultsView.style.display = 'block';

            currentFullScreenSessionId = null; // Reset so it doesn't immediately re-open on retick

            if (isManual) {
                userClosedFullScreen = true;
            } else {
                userClosedFullScreen = false; // Allow reopening if closed automatically
            }
            window.removeEventListener('resize', scaleFullScreenPlan);
        }

        function renderFullScreenPlan(roomData, sessionData) {
            // Cleanup existing timer if any
            window.currentRenderedSession = sessionData;
            // Clear current student to ensure smartboard view doesn't use stale student info
            window.currentStudent = null;

            if (window.fullScreenTimerInterval) clearInterval(window.fullScreenTimerInterval);

            const examStartTime = DataManager.parseSessionDateTime(sessionData.date, sessionData.time).getTime();
            const durationMins = sessionData.examDuration || 40;
            const examEndTime = examStartTime + (durationMins * 60 * 1000);
            const totalDurationMs = examEndTime - examStartTime;

            // Timer Updater Function
            const updateTimerUI = () => {
                const timerEl = document.getElementById('fullScreenTimer');
                if (!timerEl) return;

                const now = getNow().getTime();
                let diff = 0;
                let isFinished = false;

                // Color and Border logic based on User Request (Percentage based)
                const elapsedMs = now - examStartTime;
                const progress = elapsedMs / totalDurationMs;

                if (now < examStartTime) {
                    diff = examStartTime - now;
                    timerEl.style.color = '#39FF14'; // Phosphor Green (Before Start)
                    timerEl.style.borderColor = 'rgba(57, 255, 20, 0.4)';
                } else if (progress <= 0.5) {
                    diff = examEndTime - now;
                    timerEl.style.color = '#39FF14'; // Phosphor Green (First Half)
                    timerEl.style.borderColor = 'rgba(57, 255, 20, 0.4)';
                } else if (progress <= 0.75) {
                    diff = examEndTime - now;
                    timerEl.style.color = '#FFFF00'; // Pure Yellow (50% - 75%)
                    timerEl.style.borderColor = 'rgba(255, 255, 0, 0.5)';
                } else if (progress <= 0.875) {
                    diff = examEndTime - now;
                    timerEl.style.color = '#FFA500'; // Orange (75% - 87.5%)
                    timerEl.style.borderColor = 'rgba(255, 165, 0, 0.5)';
                } else if (now < examEndTime) {
                    diff = examEndTime - now;
                    timerEl.style.color = '#FF3131'; // Neon Red (> 87.5%)
                    timerEl.style.borderColor = 'rgba(255, 49, 49, 0.6)';
                } else {
                    isFinished = true;
                    // Auto-close any opened PDF tabs when exam finishes
                    if (pdfTabs.length > 0) {
                        pdfTabs.forEach(win => { try { win.close(); } catch (e) { } });
                        pdfTabs = [];
                    }
                }

                // Trigger emergency invert alert in the last 60 seconds (independent of color rules)
                if (!isFinished && now >= examStartTime && diff <= 60000) {
                    timerEl.style.animation = 'invertAlert 1s infinite steps(2)';
                } else {
                    timerEl.style.animation = 'none';
                }

                if (isFinished) {
                    timerEl.textContent = 'SINAV BİTTİ';
                    timerEl.style.color = '#FF3131'; 
                    timerEl.style.background = 'rgba(0,0,0,0.75)'; // Reset background if it was inverted
                    timerEl.style.borderColor = 'rgba(255, 49, 49, 0.8)';
                    const label = document.getElementById('fullScreenLessonLabel');
                    if (label) {
                        label.style.background = '#FF3131';
                        label.style.borderColor = '#FF3131';
                    }
                    timerEl.style.animation = 'blink 1s infinite';
                    return;
                }

                // Format HH:MM:SS (No prefix as requested)
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                
                const hStr = h.toString().padStart(2, '0');
                const mStr = m.toString().padStart(2, '0');
                const sStr = s.toString().padStart(2, '0');

                timerEl.textContent = `${hStr}:${mStr}:${sStr}`;
                // Animation is managed by logic above (none or invertAlert)
                timerEl.style.fontWeight = '900'; // Always Bold

                // Sync label color with timer color
                const label = document.getElementById('fullScreenLessonLabel');
                if (label) {
                    label.style.background = timerEl.style.color;
                    label.style.borderColor = timerEl.style.color;
                }
            };

            window.fullScreenTimerInterval = setInterval(updateTimerUI, 1000);

            // Calculate timing for PDF links (2 minutes after start)
            let pdfLinksHtml = '';
            const nowTime = getNow();
            const diffMs = nowTime - examStartTime;

            if (nowTime >= examStartTime && nowTime <= examEndTime) {
                const roomSubjects = new Set();
                Object.values(roomData.seats).forEach(seat => {
                    if (seat._matchedSubject) roomSubjects.add(seat._matchedSubject);
                });

                Array.from(roomSubjects).sort().forEach(subj => {
                    const meta = DataManager.getSanitizedSubjectMetadata(sessionData, subj);
                    if (meta && meta.papers) {
                        // Only show if the teacher has explicitly checked the "Paylaş" (Share) checkbox
                        if (meta.isShared !== true) return;

                        // Extract link (support both string and object formats)
                        let link = typeof meta.papers === 'string' ? meta.papers : (meta.papers.default || Object.values(meta.papers)[0]);
                        if (link && link.trim()) {
                            pdfLinksHtml += `
                                <a href="javascript:void(0)" onclick="openPdfTab('${link}')" class="btn btn-outline-light" 
                                   style="margin-left: 10px; font-size: 0.8rem; font-weight: 800; border-color: #39FF14; color: #39FF14; padding: 0.4rem 0.8rem; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; background: rgba(57, 255, 20, 0.05); text-shadow: 0 0 5px rgba(57, 255, 20, 0.3);">
                                    <i class="fa-solid fa-file-pdf"></i> ${subj.toUpperCase()}
                                </a>
                            `;
                        }
                    }
                });
            }

            let overlay = document.getElementById('fullScreenPlanOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'fullScreenPlanOverlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.backgroundColor = '#f8fafc';
                overlay.style.zIndex = '9999';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.overflow = 'hidden';
                document.body.appendChild(overlay);
            }

            // Hide personal student info completely
            const resultsView = document.getElementById('resultsView');
            if (resultsView) resultsView.style.display = 'none';


            // Floating Info Panel Layer (Zaman Sayacı Seçeneği)
            const showTimer = sessionData.screenViewTimerEnabled !== false;
            let html = `
                <div style="background: var(--dark); color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div>
                            <h2 style="margin: 0; font-weight: 800; font-size: 1.25rem;">${sessionData.name}</h2>
                            <div style="font-size: 0.85rem; color: var(--gray-400);">${currentStudent.class} Sınıfı - ${roomData.name} Salonu Oturma Planı</div>
                        </div>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                            ${pdfLinksHtml}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px; margin-left: auto;">
                        <button onclick="closeFullScreenPlan(true)" class="btn btn-danger" style="padding: 0.6rem 1.2rem; border-radius: 10px; font-weight: 800; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);">
                            <i class="fa-solid fa-xmark" style="font-size: 1.1rem;"></i> KAPAT
                        </button>
                    </div>
                </div>
                
                <!-- Floating Timer Panel — Draggable & Resizable -->
                <div id="fsTimerWrapper" style="
                    position: fixed;
                    left: 20px;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 10000;
                    display: ${showTimer ? 'flex' : 'none'};
                    flex-direction: column;
                    align-items: center;
                    gap: 0;
                    user-select: none;
                    cursor: default;
                ">
                    <!-- Drag Handle -->
                    <div id="fsTimerDragHandle" style="
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 3px 10px;
                        background: rgba(0,0,0,0.5);
                        border-radius: 10px 10px 0 0;
                        cursor: grab;
                        gap: 6px;
                        pointer-events: all;
                    ">
                        <span style="color: rgba(255,255,255,0.5); font-size: 0.65rem; letter-spacing: 1px;">⠿ TAŞI</span>
                        <input id="fsTimerSizeSlider" type="range" min="1.2" max="7" step="0.1" value="3.2"
                            title="Boyutu Ayarla"
                            style="width: 80px; height: 4px; cursor: pointer; accent-color: #39FF14; pointer-events: all;"
                            oninput="window._fsSizeChange(this.value)"
                        />
                        <span style="color: rgba(255,255,255,0.4); font-size: 0.6rem;">🔍</span>
                    </div>
                    <!-- Label -->
                    <div id="fullScreenLessonLabel" style="
                        padding: 6px 20px;
                        background: #39FF14;
                        color: black;
                        font-weight: 900;
                        font-size: 1.1rem;
                        border-radius: 0;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        width: 100%;
                        text-align: center;
                        box-shadow: 0 -5px 15px rgba(57, 255, 20, 0.2);
                        border: 2px solid #39FF14;
                        border-top: none;
                        border-bottom: none;
                        pointer-events: none;
                    ">
                        KALAN SÜRENİZ
                    </div>
                    <!-- Timer Display -->
                    <div id="fullScreenTimer" style="
                        font-family: 'JetBrains Mono', 'Courier New', monospace;
                        font-weight: 900;
                        font-size: 3.2rem;
                        color: #39FF14;
                        background: rgba(0,0,0,0.75);
                        padding: 10px 20px;
                        border-radius: 0 0 16px 16px;
                        border: 5px double rgba(57, 255, 20, 0.6);
                        box-shadow: 0 15px 40px rgba(0,0,0,0.6);
                        letter-spacing: 3px;
                        text-align: center;
                        text-shadow: 0 0 15px rgba(57, 255, 20, 0.4);
                        line-height: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        backdrop-filter: blur(8px);
                        min-width: 200px;
                        pointer-events: none;
                    ">
                        --:--:--
                    </div>
                </div>

                <div id="fullScreenSchemaContainer" style="flex: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative;">
            `;

            // Generate desks HTML similar to generateDetailsHtml but for everyone in the room
            let roomSeatCounter = 1;
            const seatToNum = {};
            for (let g = 1; g <= roomData.groups; g++) {
                const conf = roomData.groupConfigs ? roomData.groupConfigs[g - 1] : { rows: roomData.rows || 1, cols: roomData.cols || 1 };
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(roomData.disabledSeats && roomData.disabledSeats.includes(sid))) {
                            seatToNum[sid] = roomSeatCounter++;
                        }
                    }
                }
            }

            let groupsHtml = '<div class="groups-row">';
            for (let g = 1; g <= roomData.groups; g++) {
                const cf = roomData.groupConfigs ? roomData.groupConfigs[g - 1] : { rows: roomData.rows || 1, cols: roomData.cols || 1 };
                groupsHtml += `<div class="desk-group" style="grid-template-columns:repeat(${cf.cols}, 1fr)">`;

                for (let r = cf.rows; r >= 1; r--) {
                    for (let c = 1; c <= cf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        const disabled = (roomData.disabledSeats || []).includes(sid);
                        const std = roomData.seats[sid];
                        const num = seatToNum[sid] || '-';

                        if (disabled) {
                            groupsHtml += `<div class="desk" style="opacity:0.2; border: 1px dashed var(--gray-300);"></div>`;
                        } else if (std) {
                            let deskBg = 'white';
                            if (std.class === currentStudent.class) {
                                deskBg = '#ecfdf5'; // Highlight own class slightly
                            }

                            groupsHtml += `
                                <div class="desk" style="background: ${deskBg}; width: 180px; height: 130px; border: 2px solid var(--gray-300);">
                                    <div style="font-size:0.85rem; color:var(--gray-500); font-weight:700;">${std.class} / ${std.no}</div>
                                    <div style="font-size:0.95rem; font-weight:900; color:var(--dark); margin:8px 0; line-height:1.2; word-break: break-word;">${std.name}</div>
                                    <div style="font-size:0.8rem; color:var(--gray-400); font-weight:600;">${std._matchedSubject || '-'}</div>
                                    <div class="desk-num" style="width: 32px; height: 32px; font-size: 1.1rem; bottom: -5px;">${num}</div>
                                </div>`;
                        } else {
                            groupsHtml += `<div class="desk empty" style="width: 180px; height: 130px;"><div class="desk-num" style="width: 32px; height: 32px; font-size: 1.1rem; bottom: -5px;">${num}</div><div style="font-size:0.75rem; color:var(--danger); font-weight:700; margin-top:15px;">BOŞ</div></div>`;
                        }
                    }
                }
                groupsHtml += `</div>`;
            }
            groupsHtml += '</div>';

            const isTeacherRight = (roomData.teacherDeskPos || 'right') === 'right';

            let frontAreaHtml = `
                <div class="front-area" style="margin-top: 50px;">
                    ${!isTeacherRight ? '<div class="teacher-desk" style="width: 120px; height: 80px; font-size: 0.85rem;">ÖĞRETMEN<br>MASASI</div><div class="board" style="height: 50px; font-size: 1.1rem;">YAZI TAHTASI</div><div style="width:120px;"></div>' : '<div style="width:120px;"></div><div class="board" style="height: 50px; font-size: 1.1rem;">YAZI TAHTASI</div><div class="teacher-desk" style="width: 120px; height: 80px; font-size: 0.85rem;">ÖĞRETMEN<br>MASASI</div>'}
                </div>
            `;

            html += `
                <div class="classroom-walls" id="fsWalls" style="transform-origin: center;">
                    ${groupsHtml}
                    ${frontAreaHtml}
                </div>
            </div>`;

            overlay.innerHTML = html;
            overlay.style.display = 'flex';

            // ── Timer Panel: Drag & Resize ──────────────────────────────
            const LS_POS  = 'fsTimer_pos';
            const LS_SIZE = 'fsTimer_size';

            const wrapper = document.getElementById('fsTimerWrapper');
            const handle  = document.getElementById('fsTimerDragHandle');
            const slider  = document.getElementById('fsTimerSizeSlider');
            const timerDisp = document.getElementById('fullScreenTimer');
            const timerLabel = document.getElementById('fullScreenLessonLabel');

            // Restore saved size
            const savedSize = parseFloat(localStorage.getItem(LS_SIZE) || '3.2');
            if (slider) slider.value = savedSize;
            if (timerDisp) timerDisp.style.fontSize = savedSize + 'rem';

            // Restore saved position
            const savedPos = JSON.parse(localStorage.getItem(LS_POS) || 'null');
            if (savedPos && wrapper) {
                wrapper.style.transform = 'none';
                wrapper.style.left = savedPos.x + 'px';
                wrapper.style.top  = savedPos.y + 'px';
            }

            // Size change handler
            window._fsSizeChange = (val) => {
                const v = parseFloat(val);
                if (timerDisp) timerDisp.style.fontSize = v + 'rem';
                localStorage.setItem(LS_SIZE, v);
            };

            // Drag logic
            if (handle && wrapper) {
                let dragging = false, ox = 0, oy = 0;

                handle.addEventListener('mousedown', (e) => {
                    if (e.target === slider) return; // don't drag when using slider
                    dragging = true;
                    const rect = wrapper.getBoundingClientRect();
                    ox = e.clientX - rect.left;
                    oy = e.clientY - rect.top;
                    wrapper.style.transform = 'none';
                    handle.style.cursor = 'grabbing';
                    e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                    if (!dragging) return;
                    let nx = e.clientX - ox;
                    let ny = e.clientY - oy;
                    // Clamp inside viewport
                    const rw = wrapper.offsetWidth;
                    const rh = wrapper.offsetHeight;
                    nx = Math.max(0, Math.min(nx, window.innerWidth  - rw));
                    ny = Math.max(0, Math.min(ny, window.innerHeight - rh));
                    wrapper.style.left = nx + 'px';
                    wrapper.style.top  = ny + 'px';
                });

                document.addEventListener('mouseup', () => {
                    if (!dragging) return;
                    dragging = false;
                    handle.style.cursor = 'grab';
                    localStorage.setItem(LS_POS, JSON.stringify({
                        x: parseInt(wrapper.style.left),
                        y: parseInt(wrapper.style.top)
                    }));
                });

                // Touch support
                handle.addEventListener('touchstart', (e) => {
                    if (e.target === slider) return;
                    const touch = e.touches[0];
                    dragging = true;
                    const rect = wrapper.getBoundingClientRect();
                    ox = touch.clientX - rect.left;
                    oy = touch.clientY - rect.top;
                    wrapper.style.transform = 'none';
                    e.preventDefault();
                }, { passive: false });

                document.addEventListener('touchmove', (e) => {
                    if (!dragging) return;
                    const touch = e.touches[0];
                    let nx = touch.clientX - ox;
                    let ny = touch.clientY - oy;
                    const rw = wrapper.offsetWidth;
                    const rh = wrapper.offsetHeight;
                    nx = Math.max(0, Math.min(nx, window.innerWidth  - rw));
                    ny = Math.max(0, Math.min(ny, window.innerHeight - rh));
                    wrapper.style.left = nx + 'px';
                    wrapper.style.top  = ny + 'px';
                }, { passive: true });

                document.addEventListener('touchend', () => {
                    if (!dragging) return;
                    dragging = false;
                    localStorage.setItem(LS_POS, JSON.stringify({
                        x: parseInt(wrapper.style.left),
                        y: parseInt(wrapper.style.top)
                    }));
                });
            }
            // ────────────────────────────────────────────────────────────

            // Auto-scale it to fit screen perfectly
            setTimeout(scaleFullScreenPlan, 100);
            window.addEventListener('resize', scaleFullScreenPlan);
        }

        function scaleFullScreenPlan() {
            const container = document.getElementById('fullScreenSchemaContainer');
            const target = document.getElementById('fsWalls');
            if (!container || !target) return;

            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const targetWidth = target.offsetWidth;
            const targetHeight = target.offsetHeight;

            // padding
            const padding = 60;
            const scaleX = (containerWidth - padding) / targetWidth;
            const scaleY = (containerHeight - padding) / targetHeight;

            // Allow significant upscaling for 4K Interactive Smartboards (up to 3.5x)
            let scale = Math.min(scaleX, scaleY, 3.5);

            if (scale > 0) {
                target.style.transform = `scale(${scale})`;
            }
        }
        function parseDateTime(dateStr, timeStr) {
            return DataManager.parseSessionDateTime(dateStr, timeStr);
        }

        function getExamEndTime(dateStr, timeStr, duration) {
            return DataManager.getSessionEndDateTime(dateStr, timeStr, duration);
        }

        // --- Öğrenci Nöbet Görüntüleme Sistemi ---
        function initDutyCheck() {
            const urlParams = new URLSearchParams(window.location.search);
            const dutyNo = urlParams.get('dutyCheck');
            if (!dutyNo) return;
            
            // Eğer parametre varsa, sınav UI'ını gizle, nöbet UI'ını göster
            const loginView = document.getElementById('loginView');
            const resultsView = document.getElementById('resultsView');
            const rulesView = document.getElementById('rulesView');
            const dutyView = document.getElementById('dutyView');
            
            if(loginView) loginView.classList.add('hidden');
            if(resultsView) resultsView.classList.add('hidden');
            if(rulesView) rulesView.classList.add('hidden');
            if(dutyView) dutyView.classList.remove('hidden');
            
            // Verinin yüklenmesini bekle
            const checkInt = setInterval(() => {
                const db = DataManager._getData();
                if (db && db.school && db.school.studentDuties) {
                    clearInterval(checkInt);
                    renderStudentDutyView(dutyNo, db);
                }
            }, 100);
        }
        
        function getTeachersForDate(targetDateStr, teacherPlan, teacherSettings, users) {
            if (!teacherPlan || !teacherPlan.data) return [];
            
            let p = teacherPlan;
            let settings = teacherSettings || {};
            let dutyType = p.dutyType || settings.dutyType || 'fixed';
            
            let startDateStr = p.startDate;
            if (!startDateStr) return [];
            
            let startDate = new Date(startDateStr);
            let targetDate = new Date(targetDateStr);
            
            let dayOfWeek = targetDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) return []; // Weekend
            
            let baseDateStr = null;
            for (let d of Object.keys(p.data)) {
                let dObj = new Date(d);
                if (dObj.getDay() === dayOfWeek) {
                    baseDateStr = d;
                    break;
                }
            }
            if (!baseDateStr) return [];
            
            let baseDayData = p.data[baseDateStr];
            if (!baseDayData) return [];
            
            let diffTime = targetDate.getTime() - startDate.getTime();
            let weeksPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
            if (weeksPassed < 0) weeksPassed = 0;
            
            let cycleWeeks = dutyType === 'monthly' ? 4 : 1;
            let cyclesPassed = Math.floor(weeksPassed / cycleWeeks);
            
            let dir = settings.rotationDir || 'asc';
            
            let shiftIds = Object.keys(baseDayData).filter(id => id !== '_admin_duty' && !id.startsWith('fixed_'));
            
            let locations = settings.locations || [];
            shiftIds.sort((a, b) => {
                let locIdA = a.replace('_dilim1', '').replace('_dilim2', '');
                let locIdB = b.replace('_dilim1', '').replace('_dilim2', '');
                let pA = locations.find(l => l.id === locIdA)?.priority || 99;
                let pB = locations.find(l => l.id === locIdB)?.priority || 99;
                if(pA !== pB) return pA - pB;
                return a.localeCompare(b);
            });
            
            let dynamicSlots = [];
            let slotMap = [];
            
            users = users || {};
            
            for (let shiftId of shiftIds) {
                let teachersInLoc = baseDayData[shiftId] || [];
                for (let i = 0; i < teachersInLoc.length; i++) {
                    let uname = teachersInLoc[i];
                    let isFixed = false;
                    if (users[uname] && users[uname].fixedLoc) {
                        let baseShift = shiftId.replace('_dilim1', '').replace('_dilim2', '');
                        if (users[uname].fixedLoc === shiftId || users[uname].fixedLoc === baseShift) {
                            isFixed = true;
                        }
                    }
                    if (!isFixed) {
                        dynamicSlots.push(uname);
                        slotMap.push({ shiftId, index: i });
                    }
                }
            }
            
            let currentSlots = [...dynamicSlots];
            if (cyclesPassed > 0 && dutyType !== 'fixed') {
                let s = (cyclesPassed * (dir === 'desc' ? -1 : 1)) % dynamicSlots.length;
                if (s < 0) s += dynamicSlots.length;
                currentSlots = [...dynamicSlots.slice(dynamicSlots.length - s), ...dynamicSlots.slice(0, dynamicSlots.length - s)];
            }
            
            let finalDayData = JSON.parse(JSON.stringify(baseDayData));
            
            if (dutyType !== 'fixed') {
                for (let i = 0; i < currentSlots.length; i++) {
                    let { shiftId, index } = slotMap[i];
                    finalDayData[shiftId][index] = currentSlots[i];
                }
            }
            
            let result = [];
            for (let shiftId in finalDayData) {
                if (shiftId === '_isHoliday') continue;
                
                let teachers = finalDayData[shiftId] || [];
                let locName = shiftId;
                if (shiftId === '_admin_duty') {
                    locName = "Nöbetçi İdareci";
                } else if (shiftId.startsWith('fixed_')) {
                    locName = "Sabit Görev";
                } else {
                    let isDilim1 = shiftId.includes('_dilim1');
                    let isDilim2 = shiftId.includes('_dilim2');
                    let locId = shiftId.replace('_dilim1', '').replace('_dilim2', '');
                    let locInfo = locations.find(l => l.id === locId);
                    locName = locInfo ? locInfo.name : locId;
                    if(isDilim1) locName += " (1. Dilim)";
                    if(isDilim2) locName += " (2. Dilim)";
                }
                
                teachers.forEach(t => {
                    let realName = users[t] ? (users[t].name || t) : t;
                    result.push(`${realName} (${locName})`);
                });
            }
            
            return result;
        }

        async function renderStudentDutyView(studentNo, db) {
            const container = document.getElementById('dutyContentContainer');
            const rawPlan = db.school.studentDuties.plan || [];
            const plan = typeof window.shiftStudentPlanDates === 'function' ? window.shiftStudentPlanDates(rawPlan) : rawPlan;
            const myDuties = plan.filter(p => String(p.number) === String(studentNo));
            
            if (myDuties.length === 0) {
                container.innerHTML = '<div style="padding:30px; text-align:center; color:var(--gray-500);"><i class="fa-solid fa-circle-exclamation fa-3x" style="color:var(--warning); margin-bottom:15px;"></i><br>Size atanmış bir nöbet görevi bulunmuyor.</div>';
                return;
            }
            
            // Öğretmen nöbet verilerini çek
            let teacherPlan = null;
            let teacherSettings = {};
            let teacherUsers = db.users || {};
            
            try {
                let resPlan = await fetch(`${DataManager.firebaseDatabaseUrl}/app_store/klbk_nobet/publishedPlan.json`);
                if (resPlan.ok) teacherPlan = await resPlan.json();
                
                let resSettings = await fetch(`${DataManager.firebaseDatabaseUrl}/app_store/klbk_nobet/settings.json`);
                if (resSettings.ok) {
                    let rawSettings = await resSettings.json();
                    if (rawSettings && rawSettings.global) {
                        if (typeof rawSettings.global === 'string') {
                            teacherSettings = JSON.parse(rawSettings.global);
                        } else {
                            teacherSettings = rawSettings.global;
                        }
                    }
                }
                
                let resUsers = await fetch(`${DataManager.firebaseDatabaseUrl}/app_store/klbk_users.json`);
                if (resUsers.ok) {
                    teacherUsers = await resUsers.json();
                }
            } catch(e) {
                console.error("Öğretmen nöbet verileri çekilemedi:", e);
            }
            
            // myDuties tarihe göre sırala
            myDuties.sort((a,b) => new Date(a.date) - new Date(b.date));
            
            const todayStr = new Date().toISOString().split('T')[0];
            
            // En yakın nöbeti bul (bugün veya bugünden sonraki ilk nöbet)
            let closestDuty = myDuties.find(p => p.date >= todayStr) || myDuties[myDuties.length - 1]; // Eğer gelecek nöbet yoksa en sonuncuyu göster
            let closestDate = closestDuty.date;
            
            // Nöbet arkadaşları (Aynı gün nöbetçi olan TÜM öğrenciler)
            let partners = plan.filter(p => p.date === closestDate && String(p.number) !== String(studentNo));
            
            // O günkü Nöbetçi Öğretmenler
            let dutyTeachersHtml = '';
            let teachersList = getTeachersForDate(closestDate, teacherPlan, teacherSettings, teacherUsers);
            
            if (teachersList.length > 0) {
                let teacherHeadingText = (closestDate === todayStr) ? "Bugün Nöbetçi Olan Öğretmenler" : "O Günkü Nöbetçi Öğretmenler";
                dutyTeachersHtml = `
                    <div style="margin-top:20px; background:white; padding:20px; border-radius:12px; border:1px solid var(--gray-200); box-shadow:var(--shadow-sm);">
                        <h3 style="margin:0 0 10px 0; color:var(--dark); font-size:1.1rem;"><i class="fa-solid fa-chalkboard-user" style="color:#ef4444;"></i> ${teacherHeadingText}</h3>
                        <ul style="margin:0; padding-left:20px; color:var(--gray-600); line-height:1.6;">
                            ${teachersList.map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            // Tarihi formatla
            let [y,m,d] = closestDate.split('-');
            let formattedClosestDate = `${d}.${m}.${y}`;
            
            // Okulun Tüm Nöbet Çizelgesi - State Kurulumu
            window.studentScheduleState = {
                dateGroups: {},
                sortedDates: [],
                todayStr: todayStr,
                studentNo: studentNo,
                db: db,
                page: 0
            };
            
            plan.forEach(p => {
                if(!window.studentScheduleState.dateGroups[p.date]) window.studentScheduleState.dateGroups[p.date] = [];
                window.studentScheduleState.dateGroups[p.date].push(p);
            });
            window.studentScheduleState.sortedDates = Object.keys(window.studentScheduleState.dateGroups).sort((a,b) => new Date(a) - new Date(b));
            
            let startIndex = 0;
            let targetDateIndex = window.studentScheduleState.sortedDates.findIndex(d => d >= todayStr);
            if (targetDateIndex !== -1) {
                startIndex = targetDateIndex;
            } else if (window.studentScheduleState.sortedDates.length > 0) {
                startIndex = Math.max(0, window.studentScheduleState.sortedDates.length - 30);
            }
            window.studentScheduleState.startIndex = startIndex;
            
            // Yaklaşan Nöbet Kartı
            let isToday = (closestDate === todayStr);
            let closestHtmlHeading = isToday ? "BUGÜN NÖBETÇİSİNİZ" : "En Yakın Nöbetiniz";
            let dateColor = isToday ? "#ef4444" : "white";
            let dateShadow = isToday ? "text-shadow: 2px 2px 0px #fff, -2px -2px 0px #fff, 2px -2px 0px #fff, -2px 2px 0px #fff;" : "";
            
            let warningsHtml = '';
            if (isToday) {
                let db = window.studentScheduleState.db;
                let lessonTimes = db.school?.lessonTimes || {};
                let firstStart = lessonTimes['1_start'] || '08:30';
                let [sh, sm] = firstStart.split(':').map(Number);
                let now = new Date();
                let lessonTime = new Date();
                lessonTime.setHours(sh, sm, 0, 0);
                
                if (now < lessonTime) {
                    warningsHtml = `
                        <div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; gap: 10px; justify-content: center; align-items: center;">
                            <div style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 0.95rem; text-align: center; width: 100%; max-width: 350px;">
                                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 5px; color: #fca5a5;"></i> Nöbete gelemeyecekseniz haber veriniz!
                            </div>
                            <div style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 0.95rem; text-align: center; width: 100%; max-width: 350px;">
                                <i class="fa-solid fa-bell" style="margin-right: 5px; color: #86efac;"></i> Nöbete başladığınızı haber veriniz!
                            </div>
                        </div>
                    `;
                }
            }

            let closestHtml = `
                <div style="background:linear-gradient(135deg, #4f46e5, #3b82f6); padding:25px; border-radius:16px; color:white; box-shadow:var(--shadow-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <div style="font-size:0.9rem; text-transform:uppercase; font-weight:700; letter-spacing:1px; opacity:0.8;">${closestHtmlHeading}</div>
                        <div style="font-size:2.5rem; font-weight:900; margin:10px 0; color:${dateColor}; ${dateShadow}">${formattedClosestDate}</div>
                        <div style="font-size:1.2rem; font-weight:600; display:flex; align-items:center; gap:10px;">
                            <i class="fa-solid fa-location-dot"></i> ${closestDuty.locName}
                        </div>
                    </div>
                    ${warningsHtml}
                    <div style="background: rgba(255,255,255,0.1); padding: 15px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); text-align: right;">
                        <div style="font-size: 1.1rem; font-weight: 800; margin-bottom: 5px;"><i class="fa-solid fa-user-graduate" style="margin-right:5px; opacity:0.8;"></i> ${closestDuty.name}</div>
                        <div style="font-size: 0.95rem; font-weight: 600; opacity: 0.9; margin-bottom: 3px;">Sınıf: ${closestDuty.className || closestDuty.class || ''}</div>
                        <div style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">Okul No: ${closestDuty.number}</div>
                    </div>
                </div>
            `;
            
            // Nöbet Arkadaşları Kartı
            let partnersHtml = '';
            let dayText = (closestDate === todayStr) ? "Bugün" : "O Gün";
            if (partners.length > 0) {
                let locGroups = {};
                partners.forEach(pt => {
                    if(!locGroups[pt.locName]) locGroups[pt.locName] = [];
                    locGroups[pt.locName].push(`<strong>${pt.name}</strong> (${pt.className || pt.class || ''} - ${pt.number})`);
                });
                
                let pList = '';
                for (let l in locGroups) {
                    pList += `<div style="margin-top:10px;"><strong style="color:var(--primary); font-size:0.9rem;">${l}</strong><ul style="margin:5px 0 0 0; padding-left:20px; color:var(--gray-600); line-height:1.6;">`;
                    locGroups[l].forEach(ptHtml => pList += `<li>${ptHtml}</li>`);
                    pList += `</ul></div>`;
                }

                partnersHtml = `
                    <div style="margin-top:20px; background:white; padding:20px; border-radius:12px; border:1px solid var(--gray-200); box-shadow:var(--shadow-sm);">
                        <h3 style="margin:0 0 10px 0; color:var(--dark); font-size:1.1rem;"><i class="fa-solid fa-users" style="color:var(--secondary);"></i> ${dayText} Nöbetçi Olan Diğer Öğrenciler</h3>
                        ${pList}
                    </div>
                `;
            } else {
                partnersHtml = `
                    <div style="margin-top:20px; background:white; padding:15px; border-radius:12px; border:1px solid var(--gray-200); color:var(--gray-500); font-size:0.95rem;">
                        <i class="fa-solid fa-info-circle"></i> ${dayText} okulda başka nöbetçi öğrenci bulunmuyor.
                    </div>
                `;
            }

            let sideBySideHtml = '';
            if (partnersHtml || dutyTeachersHtml) {
                // Her iki html parçasındaki margin-top:20px'i kaldıralım (regex kullanarak ilkini bulup değiştiriyoruz)
                let pClean = partnersHtml.replace('margin-top:20px;', 'margin-top:0; height:100%; box-sizing:border-box;');
                let tClean = dutyTeachersHtml.replace('margin-top:20px;', 'margin-top:0; height:100%; box-sizing:border-box;');
                
                sideBySideHtml = `
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px; align-items: stretch;">
                        ${partnersHtml ? `<div style="flex: 1; min-width: 300px; display: flex; flex-direction: column;">${pClean}</div>` : ''}
                        ${dutyTeachersHtml ? `<div style="flex: 1; min-width: 300px; display: flex; flex-direction: column;">${tClean}</div>` : ''}
                    </div>
                `;
            }

            container.innerHTML = closestHtml + sideBySideHtml + `<div id="studentScheduleContainer"></div>`;
            renderStudentScheduleTable();
        }

        window.changeStudentSchedulePage = function(dir) {
            const itemsPerPage = 30;
            const state = window.studentScheduleState;
            const anchorIndex = state.sortedDates.findIndex(d => d >= state.todayStr);
            const anchor = anchorIndex !== -1 ? anchorIndex : state.sortedDates.length;
            
            if (dir < 0) {
                if (state.startIndex === anchor) {
                    let pastCount = anchor;
                    let remainder = pastCount % itemsPerPage;
                    let step = remainder === 0 ? itemsPerPage : remainder;
                    state.startIndex = Math.max(0, anchor - step);
                } else {
                    state.startIndex -= itemsPerPage;
                }
                if (state.startIndex < 0) state.startIndex = 0;
            } else {
                if (state.startIndex < anchor && state.startIndex + itemsPerPage >= anchor) {
                    state.startIndex = anchor;
                } else {
                    state.startIndex += itemsPerPage;
                }
            }
            if (state.startIndex >= state.sortedDates.length) return;
            renderStudentScheduleTable();
        }

        function renderStudentScheduleTable() {
            const container = document.getElementById('studentScheduleContainer');
            if(!container) return;
            
            const state = window.studentScheduleState;
            const itemsPerPage = 30;
            const startIndex = state.startIndex !== undefined ? state.startIndex : 0;
            
            const anchorIndex = state.sortedDates.findIndex(d => d >= state.todayStr);
            const anchor = anchorIndex !== -1 ? anchorIndex : state.sortedDates.length;
            
            let endIndex = startIndex + itemsPerPage;
            if (startIndex < anchor && endIndex > anchor) {
                endIndex = anchor; // Geçmiş sayfasında geleceği gösterme
            }
            
            const paginatedDates = state.sortedDates.slice(startIndex, endIndex);
            
            const canGoBack = startIndex > 0;
            const canGoForward = endIndex < state.sortedDates.length;
            
            let scheduleHtml = `
                <div style="margin-top:20px; background:white; padding:20px; border-radius:12px; border:1px solid var(--gray-200); box-shadow:var(--shadow-sm);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                        <h3 style="margin:0; color:var(--dark); font-size:1.1rem;"><i class="fa-regular fa-calendar-days" style="color:var(--primary);"></i> Okul Nöbet Çizelgesi</h3>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <button onclick="changeStudentSchedulePage(-1)" ${!canGoBack ? 'disabled' : ''} style="background:var(--gray-100); border:1px solid var(--gray-300); padding:5px 15px; border-radius:6px; cursor:${!canGoBack ? 'not-allowed' : 'pointer'}; opacity:${!canGoBack ? '0.5' : '1'}; color:var(--dark); font-weight:bold;"><i class="fa-solid fa-chevron-left"></i> Önceki</button>
                            <span style="font-size:0.85rem; color:var(--gray-600); font-weight:bold;">Görünüm: ${startIndex + 1}-${Math.min(endIndex, state.sortedDates.length)} / ${state.sortedDates.length}</span>
                            <button onclick="changeStudentSchedulePage(1)" ${!canGoForward ? 'disabled' : ''} style="background:var(--gray-100); border:1px solid var(--gray-300); padding:5px 15px; border-radius:6px; cursor:${!canGoForward ? 'not-allowed' : 'pointer'}; opacity:${!canGoForward ? '0.5' : '1'}; color:var(--dark); font-weight:bold;">Sonraki <i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                    </div>
                    
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; min-width:300px; font-size:0.9rem;">
                            <thead>
                                <tr style="background:var(--gray-50); border-bottom:2px solid var(--gray-200);">
                                    <th style="padding:12px; text-align:left; color:var(--gray-600); font-weight:600;">Tarih</th>
                                    <th style="padding:12px; text-align:left; color:var(--gray-600); font-weight:600;">Nöbet Yerleri ve Öğrenciler</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${paginatedDates.map((dateStr, index) => {
                                    let extraHtml = '';
                                    let globalIndex = startIndex + index;
                                    if (globalIndex > 0) {
                                        let prevDateStr = state.sortedDates[globalIndex - 1];
                                        let currDate = new Date(dateStr);
                                        let prevDate = new Date(prevDateStr);
                                        let diffTime = currDate.getTime() - prevDate.getTime();
                                        let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                                        if (diffDays > 1) {
                                            extraHtml = `<tr style="border-top: 4px solid #10b981;"><td colspan="2" style="padding:0; height:0;"></td></tr>`;
                                        }
                                    }
                                    
                                    let [py,pm,pd] = dateStr.split('-');
                                    let isPast = dateStr < state.todayStr;
                                    let isToday = dateStr === state.todayStr;
                                    let badge = '';
                                    if(isToday) badge = '<span style="background:#ef4444; color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-left:8px; display:inline-block; margin-top:5px;">BUGÜN</span>';
                                    else if(isPast) badge = '<span style="color:var(--gray-400); font-size:0.8rem; display:block; margin-top:5px;">(Geçmiş)</span>';
                                    
                                    let locStr = '';
                                    let locObj = {};
                                    state.dateGroups[dateStr].forEach(p => {
                                        if(!locObj[p.locName]) locObj[p.locName] = [];
                                        let meBadge = (String(p.number) === String(state.studentNo)) ? ' <span style="color:white; background:var(--primary); padding:1px 4px; border-radius:4px; font-size:0.7rem;">SİZ</span>' : '';
                                        locObj[p.locName].push(`${p.name} (${p.className || p.class || ''} - ${p.number})${meBadge}`);
                                    });
                                    
                                    for(let l in locObj) {
                                        locStr += `<div style="margin-bottom:6px;"><strong style="color:var(--primary);">${l}:</strong> ${locObj[l].join(', ')}</div>`;
                                    }
                                    
                                    return extraHtml + `
                                    <tr style="border-bottom:1px solid var(--gray-100); ${isPast ? 'opacity:0.6;' : ''} ${isToday ? 'background:rgba(239, 68, 68, 0.05);' : ''}">
                                        <td style="padding:12px; color:var(--dark); font-weight:600; vertical-align:top; width:130px;">${pd}.${pm}.${py} ${badge}</td>
                                        <td style="padding:12px;">${locStr}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            container.innerHTML = scheduleHtml;
        }

        // --- SRH (Rehberlik ve Sosyal Uygulamalar) Functions ---
        // Tamamlanan uygulamaları takip etmek için Set
        window.completedSrhApps = window.completedSrhApps || new Set();

        function renderSrhAppsList() {
            const container = document.getElementById('srhAppsListContainer');
            container.innerHTML = '';
            
            if (!window.publishedSrhApps || window.publishedSrhApps.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:var(--gray-500); padding:2rem;">Yayınlanmış çalışma bulunamadı.</div>';
                return;
            }
            
            window.publishedSrhApps.forEach(([id, app]) => {
                const typeLabels = {
                    'coktan_secmeli': 'Çoktan Seçmeli',
                    'kisa_cevap': 'Kısa Cevap',
                    'tik_atma': 'Tik Atma'
                };
                
                const card = document.createElement('div');
                card.style.cssText = 'background: white; border: 1px solid var(--gray-200); border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm);';
                card.innerHTML = `
                    <div>
                        <h4 style="margin: 0; font-size: 1.1rem; color: var(--dark);">${app.name}
                            ${window.completedSrhApps.has(id)
                                ? '<span style="background:#d1fae5; color:#065f46; padding:2px 10px; border-radius:20px; font-size:0.78rem; font-weight:700; margin-left:8px;"><i class="fa-solid fa-circle-check"></i> TAMAMLANDI</span>'
                                : '<span style="background:#fee2e2; color:#991b1b; padding:2px 10px; border-radius:20px; font-size:0.78rem; font-weight:700; margin-left:8px;"><i class="fa-solid fa-circle-xmark"></i> TAMAMLANMADI</span>'
                            }
                        </h4>
                        ${app.description ? `<p style="margin: 4px 0 4px 0; font-size: 0.9rem; color: var(--gray-600);">${app.description}</p>` : ''}
                        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: var(--gray-500);">Tip: ${typeLabels[app.type]} | Soru Sayısı: ${app.questions ? app.questions.length : 0}</p>
                    </div>
                    <button class="btn btn-primary" onclick="openSrhApp('${id}')" style="padding: 0.5rem 1rem; border-radius: 8px;">
                        ${window.completedSrhApps.has(id) ? 'Tekrar Aç <i class="fa-solid fa-rotate-right"></i>' : 'Çalışmayı Aç <i class="fa-solid fa-arrow-right"></i>'}
                    </button>
                `;
                container.appendChild(card);
            });
        }
        
        async function openSrhApp(appId) {
            const appEntry = window.publishedSrhApps.find(([id, _]) => id === appId);
            if (!appEntry) return;
            
            const [id, app] = appEntry;
            window.currentSrhAppId = id;
            window.currentSrhApp = app;
            
            document.getElementById('srhListView').classList.add('hidden');
            document.getElementById('srhView').classList.remove('hidden');
            
            const studentObj = window.currentSrhStudent;
            document.getElementById('srhStudentNameDisplay').innerText = `${studentObj.name || ''} ${studentObj.surname || ''}`.trim();
            document.getElementById('srhStudentClassDisplay').innerText = `Sınıf: ${studentObj.class} | No: ${studentObj.no}`;
            document.getElementById('srhAppTitleDisplay').innerText = app.name;
            
            // Öğrenci daha önce tamamladıysa eski cevapları Firebase'den çek
            let previousAnswers = null;
            if (window.completedSrhApps && window.completedSrhApps.has(appId)) {
                try {
                    Swal.fire({ title: 'Yükleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    const r = await fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/srh_answers/${appId}/${studentObj.no}.json?_=` + Date.now());
                    if (r.ok) {
                        const d = await r.json();
                        if (d && d.answers) previousAnswers = d.answers;
                    }
                    Swal.close();
                } catch(e) {
                    Swal.close();
                    console.warn('Eski cevaplar yüklenemedi:', e);
                }
            }
            
            renderSrhQuestions(app, previousAnswers);
        }
        
        function backToSrhList() {
            document.getElementById('srhView').classList.add('hidden');
            document.getElementById('srhListView').classList.remove('hidden');
        }
        
        function renderSrhQuestions(app, previousAnswers = null) {
            const container = document.getElementById('srhQuestionsContainer');
            container.innerHTML = '';
            
            // Descriptionı soruların üstünde göster
            if (app.description) {
                const descDiv = document.createElement('div');
                descDiv.style.cssText = 'background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 10px;';
                descDiv.innerHTML = `<p style="margin:0; color:#1e40af; font-size:0.97rem; line-height:1.6;">${app.description.replace(/\n/g, '<br>')}</p>`;
                container.appendChild(descDiv);
            }
            
            if (!app.questions || app.questions.length === 0) {
                container.innerHTML += '<p>Soru bulunamadı.</p>';
                return;
            }
            
            app.questions.forEach((q, index) => {
                const qDiv = document.createElement('div');
                qDiv.style.cssText = 'background: var(--gray-50); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--gray-200); margin-bottom: 15px;';
                
                let qHtml = `<h4 style="margin-top: 0; color: var(--dark); font-size: 1.05rem;">${index + 1}. ${q.text}</h4>`;
                
                if (app.type === 'coktan_secmeli') {
                    qHtml += '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
                    if (q.options) {
                        q.options.forEach((opt, oIndex) => {
                            const prevAnswer = previousAnswers ? (previousAnswers.find(a => a.questionIndex === index) || {}).answer : null;
                            const isChecked = prevAnswer === opt.label ? 'checked' : '';
                            qHtml += `
                                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px; border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.background='white'" onmouseout="this.style.background='transparent'">
                                    <input type="radio" name="q_${index}" value="${opt.label}" ${isChecked} style="width: 18px; height: 18px;">
                                    <span style="font-weight: 600; color: var(--primary);">${opt.label})</span> <span>${opt.text}</span>
                                </label>
                            `;
                        });
                    }
                    qHtml += '</div>';
                } else if (app.type === 'kisa_cevap') {
                    const prevAnswer = previousAnswers ? (previousAnswers.find(a => a.questionIndex === index) || {}).answer : '';
                    qHtml += `
                        <div style="margin-top: 15px;">
                            <textarea id="q_${index}" rows="3" style="width: 100%; padding: 10px; border: 1px solid var(--gray-300); border-radius: 8px; font-family: inherit;" placeholder="Cevabınızı buraya yazınız...">${prevAnswer || ''}</textarea>
                        </div>
                    `;
                } else if (app.type === 'tik_atma') {
                    const prevAnswer = previousAnswers ? (previousAnswers.find(a => a.questionIndex === index) || {}).answer : false;
                    const isChecked = prevAnswer === true ? 'checked' : '';
                    qHtml = `
                        <label style="display: flex; align-items: flex-start; gap: 15px; cursor: pointer;">
                            <input type="checkbox" id="q_${index}" ${isChecked} style="width: 22px; height: 22px; margin-top: 2px;">
                            <span style="color: var(--dark); font-size: 1.05rem; font-weight: 500;">${index + 1}. ${q.text}</span>
                        </label>
                    `;
                }
                
                qDiv.innerHTML = qHtml;
                container.appendChild(qDiv);
            });
        }
        
        async function submitSrhAnswers() {
            const app = window.currentSrhApp;
            const appId = window.currentSrhAppId;
            const studentObj = window.currentSrhStudent;
            
            if (!app || !studentObj) return;
            
            const answers = [];
            let isComplete = true;
            
            app.questions.forEach((q, index) => {
                let answerValue = null;
                if (app.type === 'coktan_secmeli') {
                    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
                    if (selected) {
                        answerValue = selected.value;
                    } else {
                        isComplete = false;
                    }
                } else if (app.type === 'kisa_cevap') {
                    const txt = document.getElementById(`q_${index}`).value.trim();
                    if (txt) {
                        answerValue = txt;
                    } else {
                        isComplete = false;
                    }
                } else if (app.type === 'tik_atma') {
                    answerValue = document.getElementById(`q_${index}`).checked;
                }
                
                answers.push({
                    questionIndex: index,
                    answer: answerValue
                });
            });
            
            if (!isComplete && app.type !== 'tik_atma') {
                const confirm = await Swal.fire({
                    title: 'Eksik Cevaplar Var',
                    text: 'Tüm soruları cevaplamadınız. Yine de kaydetmek istiyor musunuz?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Kaydet',
                    cancelButtonText: 'İptal'
                });
                if (!confirm.isConfirmed) return;
            }
            
            const payload = {
                studentNo: studentObj.no,
                studentName: `${studentObj.name || ''} ${studentObj.surname || ''}`.trim(),
                studentClass: studentObj.class,
                answers: answers,
                timestamp: new Date().toISOString()
            };
            
            Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            try {
                // /api/saveSrhAnswer üzerinden kaydet (Firebase kuralları doğrudan yazmayı engeller)
                const res = await fetch('/api/saveSrhAnswer', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appId, studentNo: studentObj.no, payload })
                });
                
                if (res.ok) {
                    window.completedSrhApps.add(appId);
                    Swal.fire('Başarılı', 'Cevaplarınız başarıyla kaydedildi!', 'success').then(() => {
                        backToSrhList();
                        renderSrhAppsList(); // Rozeti güncelle
                    });
                } else {
                    throw new Error("HTTP " + res.status);
                }
            } catch (err) {
                console.error("Kaydetme hatası:", err);
                Swal.fire('Hata', 'Kaydedilirken bir hata oluştu.', 'error');
            }
        }

        // Script sonunda çalıştır
        initDutyCheck();