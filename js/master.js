document.addEventListener('DOMContentLoaded', () => {
    const masterForm = document.getElementById('masterForm');
    const regSchoolNewInput = document.getElementById('regSchoolNew');
    const btnSubmitMaster = document.getElementById('btnSubmitMaster');
    const regPasswordInput = document.getElementById('regPassword');
    const messageBox = document.getElementById('masterMessage');
    const btnShowActivity = document.getElementById('btnShowActivity');

    // Firebase Configuration
    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";

    // === SECURITY: Password Hashing with Web Crypto API ===
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

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
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
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

    if (masterForm) {
        masterForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const schoolNameToUse = regSchoolNewInput.value.trim();
            const password = regPasswordInput.value;

            if (!schoolNameToUse) {
                showMessage('Lütfen kurum adını belirtin.', 'error');
                return;
            }

            if (password.length < 4) {
                showMessage('Şifre en az 4 karakter olmalıdır.', 'error');
                return;
            }

            const originalHtml = btnSubmitMaster.innerHTML;
            btnSubmitMaster.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
            btnSubmitMaster.disabled = true;

            try {
                const usersDb = await getCloudUsers();

                // Auto-generate folderName (initials)
                let baseFolderName = schoolNameToUse.trim().split(/\s+/).map(w => w[0].toLowerCase()).join('');
                const trMap = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
                baseFolderName = baseFolderName.replace(/[çğıöşü]/g, m => trMap[m] || m).replace(/[^a-z0-9]/g, '');
                if (!baseFolderName) baseFolderName = 'okul';

                let folderName = baseFolderName;
                let counter = 2;
                // Check if user already exists
                while (usersDb[`admin_${folderName}`]) {
                    folderName = baseFolderName + counter;
                    counter++;
                }

                const finalUsername = `admin_${folderName}`;
                const storeKeyToUse = `klbk_data_${folderName}`;

                // Hash password
                const finalPassword = await hashPassword(password);

                const newUserObj = {
                    password: finalPassword,
                    schoolName: schoolNameToUse,
                    storeKey: storeKeyToUse,
                    email: '',
                    role: 'admin',
                    branch: []
                };

                // Atomik olarak sadece yeni kullanıcıyı ekle (Permission Denied hatalarını ve veri kaybını önler)
                const userPatchRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [finalUsername]: newUserObj })
                });

                if (!userPatchRes.ok) {
                    throw new Error(`Kullanıcı kaydedilemedi. Firebase 401 Yetki Hatası olabilir.`);
                }

                // Pre-seed default settings
                const initialData = {
                    school: {
                        name: schoolNameToUse,
                        academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
                        principal: '', vicePrincipal: '', gradeLevels: [], subjects: []
                    },
                    students: [], classrooms: [], examSessions: []
                };
                await saveToCloud(storeKeyToUse, initialData);

                // Try physical folder creation via create_school.php
                let folderCreated = false;
                let folderUrl = '';

                try {
                    const createRes = await fetch('create_school.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            folderName: folderName,
                            storeKey: storeKeyToUse
                        })
                    });

                    if (createRes.ok) {
                        const createData = await createRes.json();
                        if (createData.success) {
                            folderCreated = true;
                            folderUrl = window.location.origin + createData.url;
                        } else {
                            console.warn("PHP Hatası:", createData.error);
                        }
                    }
                } catch (err) {
                    console.warn("Fiziksel klasör oluşturulamadı", err);
                }

                if (folderCreated) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Okul Klasörü Oluşturuldu! 🎉',
                        html: `<b>${schoolNameToUse}</b> için sistem başarıyla kuruldu.<br><br>` + 
                              `<div style="text-align: left; background: #f8fafc; padding: 15px; border-radius: 10px; margin-top: 15px;">` +
                              `<strong>Klasör (Kısa Kod):</strong> <span style="color:#e91e63">${folderName}</span><br>` +
                              `<strong>Admin Kullanıcı Adı:</strong> <span style="color:#e91e63">${finalUsername}</span><br><br>` +
                              `<strong style="color:var(--primary);">👨‍🏫 Öğretmen ve İdareci Girişi:</strong><br>` +
                              `<a href="${folderUrl}index.html" target="_blank" style="color: #4f46e5; text-decoration: underline; word-break: break-all;">${folderUrl}index.html</a><br><br>` +
                              `<strong style="color:var(--secondary);">🎓 Öğrenci Girişi:</strong><br>` +
                              `<a href="${folderUrl}ogrenci.html" target="_blank" style="color: #10b981; text-decoration: underline; word-break: break-all;">${folderUrl}ogrenci.html</a><br><br>` +
                              `<strong style="color:#f59e0b;">📊 Yönetici Paneli (Dashboard):</strong><br>` +
                              `<a href="${folderUrl}dashboard.html" target="_blank" style="color: #d97706; text-decoration: underline; word-break: break-all;">${folderUrl}dashboard.html</a>` +
                              `</div>`,
                        confirmButtonText: 'Tamam'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Hata',
                        text: 'Veritabanı kaydı oluşturuldu ancak fiziksel klasör kopyalanamadı. Lütfen sunucunun (PHP) çalıştığından emin olun.'
                    });
                }

                masterForm.reset();
            } catch (error) {
                showMessage('Hata: ' + error.message, 'error');
            }

            btnSubmitMaster.innerHTML = originalHtml;
            btnSubmitMaster.disabled = false;
        });
    }

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

    const btnBackupMaster = document.getElementById('btnBackupMaster');
    const btnRestoreMaster = document.getElementById('btnRestoreMaster');

    if (btnBackupMaster) {
        btnBackupMaster.addEventListener('click', async () => {
            let users = await getCloudUsers();
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
        });
    }

    if (btnRestoreMaster) {
        btnRestoreMaster.addEventListener('click', async () => {
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
        });
    }
});
