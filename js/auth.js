document.addEventListener('DOMContentLoaded', () => {
    // Path Enforcement: Sadece doğrudan .html ismiyle geliniyorsa engelle
    const path = window.location.pathname;
    if (path.endsWith('/index.html') || path.endsWith('/index')) {
        window.location.href = '/security_error';
        return;
    }

    const loginForm = document.getElementById('loginForm');

    // Login Elements
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const loginMessageBox = document.getElementById('loginMessage');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Cloud Configuration (Google Apps Script)
    const gasApiUrl = "https://script.google.com/macros/s/AKfycbx_lmok6XZ1te32GRoWFb16sl-FzOPDRL3i81OlsaYrr1D-XXtb93ng1PpcqXBz3y3kuw/exec"; // Final Doğrulanan URL (Garantili)

    async function getCloudUsers() {
        if (!gasApiUrl) return { 'admin': { password: 'admin', schoolName: 'Sistem Yöneticisi', role: 'master' } };
        try {
            const res = await fetch(`${gasApiUrl}?action=get_users`);
            if (res.ok) {
                const data = await res.json();
                if (data) return data;
            }
        } catch (e) {
            console.error("Bulut kullanıcı verisi alınamadı", e);
        }

        // Initialize default if not exists
        const defaultUsers = {
            'admin': { password: 'admin', schoolName: 'Sistem Yöneticisi', role: 'master' }
        };

        try {
            const params = new URLSearchParams();
            params.append('payload', JSON.stringify({ action: 'save_users', data: defaultUsers }));

            await fetch(gasApiUrl, {
                method: 'POST',
                mode: 'no-cors',
                body: params
            });
        } catch (e) { }

        return defaultUsers;
    }

    // Check for logout request via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
        sessionStorage.clear();
        localStorage.removeItem('klbk_persistent_session');
        // Clean the URL to avoid loop
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }

    // Restore persistent session
    const persistentSession = localStorage.getItem('klbk_persistent_session');
    if (persistentSession && urlParams.get('logout') !== 'true') {
        try {
            const data = JSON.parse(persistentSession);
            const loginDate = new Date(data.klbk_loginTime);
            const now = new Date();
            const diffDays = (now - loginDate) / (1000 * 60 * 60 * 24);

            if (diffDays < 30) {
                // Restore session
                for (const [key, value] of Object.entries(data)) {
                    sessionStorage.setItem(key, value);
                }
                sessionStorage.setItem('klbk_isLoggedIn', 'true');

                // Auto-redirect
                const role = (data.klbk_role || '').toLowerCase().trim();
                if (role === 'ogretmen' || role === 'idareci') {
                    window.location.href = '/h6t3y9w1';
                } else if (role === 'master' || role === 'admin' || role === 'dashboard') {
                    window.location.href = '/r1p5s8q3';
                } else {
                    window.location.href = '/j2k5l0p8';
                }
                return; // Stop further processing
            } else {
                localStorage.removeItem('klbk_persistent_session');
            }
        } catch (e) {
            console.error("Persistent session restore failed", e);
            localStorage.removeItem('klbk_persistent_session');
        }
    }

    // Check if 'rememberedUser' exists in localStorage (for prefilling username)
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

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            let username = usernameInput.value.trim();
            const password = passwordInput.value;

            // Loading state
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalHtml = btn.innerHTML;
            
            try {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bilgiler Doğrulanıyor...';
                btn.disabled = true;

                const usersDb = await getCloudUsers();
                
                let matchedUsername = null;
                if (usersDb[username]) {
                    matchedUsername = username;
                } else {
                    for (const [uname, data] of Object.entries(usersDb)) {
                        if (data.email && data.email.toLowerCase() === username.toLowerCase()) {
                            matchedUsername = uname;
                            break;
                        }
                    }
                }

                // Validate credentials against usersDb
                if (matchedUsername && usersDb[matchedUsername].password === password) {
                    username = matchedUsername;
                    showMessage(loginMessageBox, 'Giriş başarılı! Yönlendiriliyorsunuz...', 'success');

                    // --- Asenkron Aktivite Loglama ---
                    try {
                        if (gasApiUrl) {
                            fetch(`${gasApiUrl}?action=get_data&id=klbk_activity_log`).then(r => r.json()).then(rows => {
                                let logs = rows?.logs || [];
                                if (!Array.isArray(logs)) logs = [];

                                const role = usersDb[username].role || 'admin';
                                logs.unshift({
                                    username: username,
                                    role: role,
                                    school: usersDb[username].schoolName || '-',
                                    time: new Date().toLocaleString('tr-TR')
                                });

                                if (logs.length > 500) logs = logs.slice(0, 500);

                                fetch(gasApiUrl, {
                                    method: 'POST',
                                    mode: 'no-cors',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'save_data', id: 'klbk_activity_log', data: { logs: logs } })
                                });
                            }).catch(e => console.warn('Aktivite loglanamadı', e));
                        }
                    } catch (e) {
                        console.warn("Log tracking failed", e);
                    }
                    // ---------------------------------

                    // Handle Remember Me (Persistent Session)
                    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                        localStorage.setItem('klbk_rememberedUser', username);

                        // Save full session to localStorage for persistence (Except students)
                        const role = usersDb[username].role || 'admin';
                        if (role !== 'student' && role !== 'ogrenci') {
                                const sessionData = {
                                    klbk_currentUser: username,
                                    klbk_name: usersDb[username].name || username,
                                    klbk_schoolName: usersDb[username].schoolName || '',
                                    klbk_storeKey: usersDb[username].storeKey || (`klbk_data_${username}`),
                                    klbk_role: role,
                                    klbk_loginTime: new Date().toISOString()
                                };
                            if (usersDb[username].branch) {
                                sessionData.klbk_branch = usersDb[username].branch;
                            }
                            localStorage.setItem('klbk_persistent_session', JSON.stringify(sessionData));
                        }
                    } else {
                        localStorage.removeItem('klbk_rememberedUser');
                        localStorage.removeItem('klbk_persistent_session');
                    }

                    // Setup session
                    sessionStorage.setItem('klbk_isLoggedIn', 'true');
                    sessionStorage.setItem('klbk_currentUser', username);
                    sessionStorage.setItem('klbk_name', usersDb[username].name || username);
                    sessionStorage.setItem('klbk_schoolName', usersDb[username].schoolName || '');
                    sessionStorage.setItem('klbk_storeKey', usersDb[username].storeKey || (`klbk_data_${username}`));
                    sessionStorage.setItem('klbk_role', usersDb[username].role || 'admin');
                    if (usersDb[username].branch) {
                        sessionStorage.setItem('klbk_branch', usersDb[username].branch);
                    }
                    sessionStorage.setItem('klbk_loginTime', new Date().toISOString());

                    // Redirect logic
                    setTimeout(() => {
                        const rawRole = usersDb[username].role || 'admin';
                        const role = rawRole.toLowerCase().trim();
                        
                        if (role === 'ogretmen' || role === 'idareci') {
                            window.location.href = '/h6t3y9w1';
                        } else if (role === 'master' || role === 'admin' || role === 'dashboard') {
                            window.location.href = '/r1p5s8q3';
                        } else {
                            window.location.href = '/j2k5l0p8';
                        }
                    }, 1000);
                } else {
                    showMessage(loginMessageBox, 'Hatalı kullanıcı adı veya şifre.', 'error');
                    if (typeof shakeForm === 'function') shakeForm();
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            } catch (err) {
                console.error("Giriş sırasında hata:", err);
                showMessage(loginMessageBox, 'Sistem hatası oluştu. Lütfen tekrar deneyin.', 'error');
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });
    }

    // Helper: Shake Form on Error
    function shakeForm() {
        const card = document.querySelector('.login-card');
        if (card) {
            card.style.animation = 'none';
            card.offsetHeight; // trigger reflow
            card.style.animation = 'shake 0.4s ease-in-out';
        }
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

    // --- Forgot Password Logic ---
    const forgotLink = document.querySelector('.forgot-link');
    if (forgotLink) {
        // Initialize EmailJS with Public Key
        if (window.emailjs) {
            emailjs.init("0gioGMhJGYrohmvyz");
        }

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

                const usersDb = await getCloudUsers();
                let foundUser = null;

                // Find user by email
                for (const [uname, data] of Object.entries(usersDb)) {
                    if (data.email && data.email.toLowerCase() === emailAddress.toLowerCase()) {
                        foundUser = { username: uname, ...data };
                        break;
                    }
                }

                if (foundUser) {
                    try {
                        // Real Email Sending via EmailJS
                        const templateParams = {
                            to_email: emailAddress,
                            email: emailAddress,
                            user_email: emailAddress,
                            username: foundUser.username,
                            password: foundUser.password,
                            school_name: foundUser.schoolName || 'Kelebek Sistemi'
                        };

                        await emailjs.send(
                            "service_205ar93",
                            "template_i0eo9o5",
                            templateParams
                        );

                        Swal.fire({
                            icon: 'success',
                            title: 'Bilgiler Gönderildi',
                            html: `Kullanıcı bilgileriniz <b>${emailAddress}</b> adresine e-posta olarak gönderilmiştir.`,
                            confirmButtonColor: 'var(--secondary)'
                        });
                    } catch (err) {
                        console.error("EmailJS Full Error:", err);
                        const errorMsg = err?.text || err?.message || "Bilinmeyen bir hata oluştu";
                        Swal.fire({
                            icon: 'warning',
                            title: 'Gönderim Hatası',
                            html: `E-posta servisi şu an yanıt vermiyor.<br><br><small>Hata: ${errorMsg}</small><br><br>Lütfen bilgilerin doğruluğunu kontrol edin veya sistem yöneticisi ile iletişime geçin.`,
                            confirmButtonColor: 'var(--primary)'
                        });
                    }
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Hata',
                        text: 'E-posta adresiniz sisteme kayıtlı değil. Sistem yöneticinizle görüşün.',
                        confirmButtonColor: 'var(--danger)'
                    });
                }
            }
        });
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
