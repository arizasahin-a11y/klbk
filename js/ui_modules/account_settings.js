// === UI Module: Account Settings ===

// Security: Password Hashing Functions (Preserved for client compatibility)
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
    const currentUser = sessionStorage.getItem('klbk_currentUser') || 
                        localStorage.getItem('klbk_currentUser');
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

    let currentEmail = '';
    let currentGender = sessionStorage.getItem('klbk_gender') || localStorage.getItem('klbk_gender') || 'erkek';
    let currentKey = currentUser;

    try {
        // 1. Öncelikle güvenli API üzerinden kullanıcı bilgilerini çekmeyi dene
        try {
            const apiRes = await fetch(`/api/updateProfile?username=${encodeURIComponent(currentUser)}`);
            if (apiRes.ok) {
                const uData = await apiRes.json();
                if (uData) {
                    currentEmail = uData.email || '';
                    currentGender = uData.gender || currentGender;
                    currentKey = uData.username || currentUser;
                }
            }
        } catch (apiErr) {
            console.warn("Profil API üzerinden çekilemedi, doğrudan RTDB deneniyor:", apiErr);
        }

        // 2. Eğer API'den gelmediyse doğrudan Firebase'den dene
        if (!currentEmail) {
            const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
            const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
            if (res.ok) {
                const usersDb = await res.json();
                if (usersDb) {
                    let matchedUser = usersDb[currentUser];
                    if (!matchedUser && currentUser.includes('.')) {
                        const parts = currentUser.split('.');
                        let cur = usersDb;
                        for (const p of parts) {
                            if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
                            else { cur = null; break; }
                        }
                        matchedUser = (cur && typeof cur === 'object') ? cur : null;
                    }
                    if (!matchedUser) {
                        for (const [k, u] of Object.entries(usersDb)) {
                            if (k.toLowerCase() === currentUser.toLowerCase() || (u && u.email && u.email.toLowerCase() === currentUser.toLowerCase())) {
                                matchedUser = u;
                                currentKey = k;
                                break;
                            }
                        }
                    }
                    if (matchedUser) {
                        currentEmail = matchedUser.email || '';
                        currentGender = matchedUser.gender || currentGender;
                    }
                }
            }
        }
    } catch (err) {
        console.warn("Kullanıcı detayları alınırken hata:", err);
    }

    Swal.close();

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
        focusConfirm: false,
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
                // Sunucu tarafında AES şifre çözme ve profil güncelleme
                const res = await fetch('/api/updateProfile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currentUser: currentKey || currentUser,
                        currentPassword: currentPassVerify,
                        newUsername: newUsername,
                        email: email,
                        gender: gender,
                        newPassword: pass
                    })
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.error || "Güncelleme sırasında hata oluştu");
                }

                // Oturum ve depolama bilgilerini güncelle
                sessionStorage.setItem('klbk_gender', gender);
                localStorage.setItem('klbk_gender', gender);

                const finalUsername = data.username || newUsername;
                if (finalUsername !== currentUser) {
                    sessionStorage.setItem('klbk_currentUser', finalUsername);
                    localStorage.setItem('klbk_currentUser', finalUsername);
                    if (data.storeKey) {
                        sessionStorage.setItem('klbk_storeKey', data.storeKey);
                        localStorage.setItem('klbk_storeKey', data.storeKey);
                    }
                    const persistent = localStorage.getItem('klbk_persistent_session');
                    if (persistent) {
                        try {
                            const sess = JSON.parse(persistent);
                            sess.klbk_currentUser = finalUsername;
                            if (data.storeKey) sess.klbk_storeKey = data.storeKey;
                            localStorage.setItem('klbk_persistent_session', JSON.stringify(sess));
                        } catch (e) {}
                    }
                }

                return { newUsername: finalUsername, gender, changedUsername: finalUsername !== currentUser };

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

            // Portal sayfasındaki kullanıcı adı alanını hemen güncelle
            const portalUserNameEl = document.getElementById('portalUserName');
            if (portalUserNameEl && result.value.newUsername) {
                portalUserNameEl.innerText = result.value.newUsername;
            }

            Swal.fire({
                title: 'Başarılı',
                text: 'Profil ayarlarınız güncellendi.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                if (result.value.changedUsername) {
                    window.location.reload();
                }
            });
        }
    });
};

// Global alias for compatibility with other pages
window.openTeacherSettings = window.openAccountSettings;
