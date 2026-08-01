// === UI Module: Account Settings ===

// Security: Password Hashing Functions
window.hashPassword = async function(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

window.isHashedPassword = function(password) {
    return password && /^[a-f0-9]{64}$/i.test(password);
};

window.openAccountSettings = async function() {
    const currentUser = sessionStorage.getItem('klbk_currentUser');
    if (!currentUser) {
        Swal.fire('Hata', 'Kullanıcı oturumu bulunamadı!', 'error');
        return;
    }

    Swal.fire({
        title: 'Lütfen Bekleyin',
        text: 'Hesap bilgileri yükleniyor...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
        const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
        if (!res.ok) throw new Error('Bulut veritabanı yanıt vermedi.');
        const usersDb = await res.json();
        if (!usersDb) throw new Error('Kullanıcı veritabanı boş.');

        const findDeepUser = (obj, targetPath) => {
            const parts = targetPath.split('.');
            let current = obj;
            for (const p of parts) {
                if (current && typeof current === 'object' && p in current) {
                    current = current[p];
                } else {
                    return null;
                }
            }
            return (current && typeof current === 'object') ? current : null;
        };

        let matchedUser = usersDb[currentUser];
        if (!matchedUser && currentUser.includes('.')) {
            matchedUser = findDeepUser(usersDb, currentUser);
        }

        if (!matchedUser) {
            throw new Error('Kullanıcı bilgisi bulunamadı.');
        }

        Swal.close();

        const currentName = matchedUser.name || currentUser;
        const currentEmail = matchedUser.email || '';
        const currentPassword = matchedUser.password || '';
        const currentGender = matchedUser.gender || 'erkek';

        Swal.fire({
            title: 'Hesap Ayarlarım',
            html: `
                <div style="text-align: left; margin-top: 10px;">
                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Kullanıcı Adı</label>
                    <input type="text" id="accUser" class="form-control" value="${currentUser}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">

                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">E-Posta Adresi</label>
                    <input type="email" id="accEmail" class="form-control" value="${currentEmail}" placeholder="E-Posta" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">

                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Cinsiyet</label>
                    <select id="accGender" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit; height: auto;">
                        <option value="erkek" ${currentGender === 'erkek' ? 'selected' : ''}>Erkek</option>
                        <option value="kadin" ${currentGender === 'kadin' ? 'selected' : ''}>Kadın</option>
                        <option value="diger" ${currentGender === 'diger' ? 'selected' : ''}>Belirtilmemiş</option>
                    </select>

                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Yeni Şifre</label>
                    <input type="password" id="accPass" class="form-control" placeholder="Değiştirmek istemiyorsanız boş bırakın" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">
                    
                    <hr style="margin: 15px 0; border: 0; border-top: 1px solid var(--gray-200);">
                    <label style="display:block; font-size: 0.85rem; font-weight: 700; color: var(--danger); margin-bottom: 4px;">Değişiklikleri Onaylamak İçin Güncel Şifreniz</label>
                    <input type="password" id="currentPassVerify" class="form-control" placeholder="Mevcut şifrenizi girin" style="width: 100%; padding: 0.75rem; border: 2px solid var(--danger); border-radius: 6px; font-family: inherit;">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            confirmButtonColor: '#4f46e5',
            preConfirm: async () => {
                const newUsername = document.getElementById('accUser').value.trim();
                const email = document.getElementById('accEmail').value.trim();
                const gender = document.getElementById('accGender').value;
                const pass = document.getElementById('accPass').value;
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

                            let passwordMatch = false;
                            const storedPassword = db[currentUser].password;
                            
                            if (window.isHashedPassword(storedPassword)) {
                                const verifyHash = await window.hashPassword(currentPassVerify);
                                passwordMatch = storedPassword === verifyHash;
                            } else {
                                passwordMatch = storedPassword === currentPassVerify;
                            }

                            if (!passwordMatch) {
                                throw new Error("Güncel şifreniz hatalı!");
                            }

                            if (newUsername !== currentUser && db[newUsername]) {
                                throw new Error("Bu kullanıcı adı zaten alınmış!");
                            }

                            const userData = db[currentUser];
                            userData.email = email;
                            userData.gender = gender;
                            
                            if (pass && pass.trim() !== '') {
                                userData.password = await window.hashPassword(pass);
                            }

                            if (newUsername !== currentUser) {
                                db[newUsername] = userData;
                                delete db[currentUser];
                            } else {
                                db[currentUser] = userData;
                            }

                            const putRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(db)
                            });
                            if (!putRes.ok) throw new Error("Kayıt sırasında hata oluştu");

                            sessionStorage.setItem('klbk_gender', gender);

                            if (newUsername !== currentUser) {
                                sessionStorage.setItem('klbk_currentUser', newUsername);
                                const oldStoreKey = sessionStorage.getItem('klbk_storeKey');
                                if (oldStoreKey === `klbk_data_${currentUser}`) {
                                    sessionStorage.setItem('klbk_storeKey', `klbk_data_${newUsername}`);
                                }
                            }
                            
                            return { newUsername, gender };
                        }
                    }
                    throw new Error("Veritabanı hatası");
                } catch (e) {
                    Swal.showValidationMessage(e.message);
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const tIcon = document.getElementById('teacherGenderIcon');
                if (tIcon) {
                    let iconClass = 'fa-user-tie';
                    let bg = '#2196f3';
                    if (result.value.gender === 'kadin') { iconClass = 'fa-user-nurse'; bg = '#e91e63'; }
                    else if (result.value.gender === 'diger') { iconClass = 'fa-user'; bg = '#6c757d'; }
                    tIcon.className = `fa-solid ${iconClass}`;
                    const container = document.getElementById('teacherGenderContainer');
                    if (container) container.style.background = bg;
                }
                const sidebarAvatarIcon = document.getElementById('sidebarAvatarIcon');
                if (sidebarAvatarIcon) {
                    let iconClass = 'fa-user-tie';
                    let bg = '#2196f3';
                    if (result.value.gender === 'kadin') { iconClass = 'fa-user-nurse'; bg = '#e91e63'; }
                    else if (result.value.gender === 'diger') { iconClass = 'fa-user'; bg = '#6c757d'; }
                    sidebarAvatarIcon.className = `fa-solid ${iconClass}`;
                    sidebarAvatarIcon.parentElement.style.background = bg;
                    sidebarAvatarIcon.parentElement.style.color = 'white';
                }

                Swal.fire({
                    title: 'Başarılı',
                    text: 'Profil ayarlarınız güncellendi. Kullanıcı adı değişikliği yaptıysanız, sistem tutarlılığı için sayfa yenilenecektir.',
                    icon: 'success'
                }).then(() => {
                    window.location.reload();
                });
            }
        });

    } catch (e) {
        Swal.fire('Hata', 'Bilgiler alınırken hata oluştu: ' + e.message, 'error');
    }
};
