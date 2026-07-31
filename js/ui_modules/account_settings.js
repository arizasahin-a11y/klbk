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
                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Adı Soyadı</label>
                    <input type="text" id="accName" class="form-control" value="${currentName}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">

                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">E-posta Adresi</label>
                    <input type="email" id="accEmail" class="form-control" value="${currentEmail}" placeholder="ornek@okul.com" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">

                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Giriş Şifresi</label>
                    <input type="password" id="accPassword" class="form-control" placeholder="Yeni şifre (boş bırakırsanız değişmez)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit;">

                    <label style="display:block; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); margin-bottom: 4px;">Cinsiyet</label>
                    <select id="accGender" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 6px; margin-bottom: 15px; font-family: inherit; height: auto;">
                        <option value="erkek" ${currentGender === 'erkek' ? 'selected' : ''}>Erkek</option>
                        <option value="kadin" ${currentGender === 'kadin' ? 'selected' : ''}>Kadın</option>
                        <option value="diger" ${currentGender === 'diger' ? 'selected' : ''}>Belirtilmemiş</option>
                    </select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            confirmButtonColor: '#4f46e5',
            preConfirm: () => {
                const nameVal = document.getElementById('accName').value.trim();
                const emailVal = document.getElementById('accEmail').value.trim();
                const passVal = document.getElementById('accPassword').value;
                const genderVal = document.getElementById('accGender').value;

                if (!nameVal) {
                    Swal.showValidationMessage('Adı Soyadı alanı boş olamaz.');
                    return false;
                }
                if (passVal && passVal.length < 4) {
                    Swal.showValidationMessage('Şifre en az 4 karakter olmalıdır.');
                    return false;
                }

                return {
                    name: nameVal,
                    email: emailVal,
                    password: passVal,
                    gender: genderVal
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Güncelleniyor',
                    text: 'Bilgiler buluta kaydediliyor...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                try {
                    const updatePayload = {
                        name: result.value.name,
                        email: result.value.email,
                        gender: result.value.gender
                    };

                    // Only update password if new one is provided
                    if (result.value.password && result.value.password.trim() !== '') {
                        updatePayload.password = await window.hashPassword(result.value.password);
                    } else {
                        // Keep existing password
                        updatePayload.password = matchedUser.password;
                    }

                    // Use PATCH to update only the current user's node, avoiding full DB overwrite
                    const putRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users/${encodeURIComponent(currentUser)}.json`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatePayload)
                    });

                    if (!putRes.ok) throw new Error('Veritabanına kaydedilemedi.');

                    const formattedName = (name) => {
                        if (!name) return "";
                        const cleanName = name.trim().replace(/\s+/g, ' ');
                        const parts = cleanName.split(' ');
                        if (parts.length === 0) return "";
                        if (parts.length === 1) return parts[0].toLocaleUpperCase('tr-TR');
                        const surname = parts.pop().toLocaleUpperCase('tr-TR');
                        const firstNames = parts.map(n => {
                            if (!n) return "";
                            return n.charAt(0).toLocaleUpperCase('tr-TR') + n.slice(1).toLocaleLowerCase('tr-TR');
                        }).join(" ");
                        return `${firstNames} ${surname}`;
                    };

                    const displayFormattedName = formattedName(result.value.name);

                    sessionStorage.setItem('klbk_name', displayFormattedName);
                    sessionStorage.setItem('klbk_gender', result.value.gender);

                    const persistentSession = localStorage.getItem('klbk_persistent_session');
                    if (persistentSession) {
                        try {
                            const data = JSON.parse(persistentSession);
                            data.klbk_name = displayFormattedName;
                            data.klbk_gender = result.value.gender;
                            localStorage.setItem('klbk_persistent_session', JSON.stringify(data));
                        } catch (e) {
                            console.error(e);
                        }
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
                        title: 'Başarılı!',
                        text: 'Hesap ayarlarınız başarıyla güncellendi.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });

                } catch (e) {
                    Swal.fire('Hata', 'Güncelleme sırasında hata oluştu: ' + e.message, 'error');
                }
            }
        });

    } catch (e) {
        Swal.fire('Hata', 'Bilgiler alınırken hata oluştu: ' + e.message, 'error');
    }
};
