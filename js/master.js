document.addEventListener('DOMContentLoaded', () => {

    const masterForm = document.getElementById('masterForm');

    // Form Elements
    const regSchoolInput = document.getElementById('regSchool');
    const regUsernameInput = document.getElementById('regUsername');
    const regPasswordInput = document.getElementById('regPassword');
    const messageBox = document.getElementById('masterMessage');

    // Supabase Configuration
    const supabaseUrl = "https://esdttjvkqyeaosdcsskr.supabase.co";
    const supabaseKey = "sb_publishable_Rdl1xQ10AjWVZPxLwL_O_A_x4NYDxl6";

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

    if (masterForm) {
        masterForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const schoolName = regSchoolInput.value.trim();
            const username = regUsernameInput.value.trim();
            const password = regPasswordInput.value;

            if (username.length < 3) {
                showMessage('Kullanıcı adı en az 3 karakter olmalıdır.', 'error');
                return;
            }
            if (password.length < 4) {
                showMessage('Şifre en az 4 karakter olmalıdır.', 'error');
                return;
            }

            // Loading state
            const btn = masterForm.querySelector('button[type="submit"]');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
            btn.disabled = true;

            const usersDb = await getCloudUsers();

            // Check if user already exists
            if (usersDb[username]) {
                showMessage(`'${username}' kullanıcı adı zaten kullanılıyor. Lütfen başka bir tane seçin.`, 'error');
                shakeForm();
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                return;
            }

            // Save new user
            usersDb[username] = {
                password: password,
                schoolName: schoolName
            };
            await saveToCloud('klbk_users', usersDb);

            // Pre-seed default settings for the new user logic
            const userStoreKey = `klbk_data_${username}`;
            const initialData = {
                school: {
                    name: schoolName,
                    academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
                    principal: '', vicePrincipal: '', gradeLevels: [], subjects: []
                },
                students: [], classrooms: [], examSessions: []
            };
            await saveToCloud(userStoreKey, initialData);

            showMessage(`${schoolName} (Kullanıcı: ${username}) başarıyla sisteme eklendi!`, 'success');

            // clear form
            masterForm.reset();
            btn.innerHTML = originalHtml;
            btn.disabled = false;
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

});
