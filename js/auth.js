document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('loginForm');

    // Login Elements
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const loginMessageBox = document.getElementById('loginMessage');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Supabase Configuration
    const supabaseUrl = "https://esdttjvkqyeaosdcsskr.supabase.co";
    const supabaseKey = "sb_publishable_Rdl1xQ10AjWVZPxLwL_O_A_x4NYDxl6";

    async function getCloudUsers() {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/app_store?id=eq.klbk_users&select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            if (res.ok) {
                const rows = await res.json();
                if (rows && rows.length > 0) return rows[0].data;
            }
        } catch (e) {
            console.error("Bulut kullanıcı verisi alınamadı", e);
        }

        // Initialize default if not exists
        const defaultUsers = {
            'admin': { password: 'admin', schoolName: 'Sistem Yöneticisi', role: 'master' }
        };

        try {
            await fetch(`${supabaseUrl}/rest/v1/app_store`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({ id: 'klbk_users', data: defaultUsers })
            });
        } catch (e) { }

        return defaultUsers;
    }

    // Check if 'rememberedUser' exists in localStorage
    const savedUser = localStorage.getItem('klbk_rememberedUser');
    if (savedUser && usernameInput) {
        usernameInput.value = savedUser;
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }

    // Toggle Password Visibility (Login Form)
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = togglePasswordBtn.querySelector('i');
            if (type === 'text') {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

    // --- Form Submissions ---

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            // Loading state
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bilgiler Doğrulanıyor...';
            btn.disabled = true;

            const usersDb = await getCloudUsers();

            // Validate credentials against usersDb
            if (usersDb[username] && usersDb[username].password === password) {
                showMessage(loginMessageBox, 'Giriş başarılı! Yönlendiriliyorsunuz...', 'success');

                // Handle Remember Me
                if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                    localStorage.setItem('klbk_rememberedUser', username);
                } else {
                    localStorage.removeItem('klbk_rememberedUser');
                }

                // Setup session
                sessionStorage.setItem('klbk_isLoggedIn', 'true');
                sessionStorage.setItem('klbk_currentUser', username);
                sessionStorage.setItem('klbk_schoolName', usersDb[username].schoolName || '');
                sessionStorage.setItem('klbk_loginTime', new Date().toISOString());

                // Redirect logic
                setTimeout(() => {
                    // Everyone gets directed to dashboard. The school name is fetched dynamically by data.js later via klbk_currentUser
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showMessage(loginMessageBox, 'Hatalı kullanıcı adı veya şifre.', 'error');
                shakeForm();
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });
    }

    // Helper: Show Message Blocks
    function showMessage(element, text, type) {
        if (!element) return;
        element.innerHTML = type === 'error'
            ? `<i class="fa-solid fa-circle-exclamation"></i> ${text}`
            : `<i class="fa-solid fa-circle-check"></i> ${text}`;

        element.className = `message-box ${type}`;
        element.classList.remove('hidden');
    }

    // Helper: Shake Form
    function shakeForm() {
        const loginCard = document.querySelector('.login-card');
        if (!loginCard) return;
        loginCard.style.animation = 'none';
        loginCard.offsetHeight; /* trigger reflow */
        loginCard.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => { loginCard.style.animation = 'none'; }, 500);
    }

});

// Add keyframes programmatically for the shake animation if error occurs
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
  100% { transform: translateX(0); }
}
`;
document.head.appendChild(styleSheet);
