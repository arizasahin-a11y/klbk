document.addEventListener('DOMContentLoaded', () => {
    // Path Enforcement: Sadece doğrudan .html ismiyle geliniyorsa engelle
    // Not: Bu kural Vercel rewriteları ile bazen çakışabildiği için esnetildi.

    const loginForm = document.getElementById('loginForm');

    // Login Elements
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const loginMessageBox = document.getElementById('loginMessage');
    const rememberMeCheckbox = document.getElementById('rememberMe');

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

    // Check if password is already hashed (SHA-256 = 64 hex chars)
    function isHashedPassword(password) {
        return password && /^[a-f0-9]{64}$/i.test(password);
    }

    // Generate secure session token
    async function generateSessionToken(username, storeKey) {
        const timestamp = Date.now();
        const randomBytes = crypto.getRandomValues(new Uint8Array(16));
        const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const tokenData = `${username}:${storeKey}:${timestamp}:${randomHex}`;
        const hash = await hashPassword(tokenData);
        return hash;
    }

    // Store session token in Firebase for authentication
    async function storeSessionToken(username, token, storeKey, role) {
        try {
            const sessionData = {
                token: token,
                username: username,
                storeKey: storeKey,
                role: role,
                timestamp: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            };
            
            await fetch(`${firebaseDatabaseUrl}/app_store/active_sessions/${token}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });
            
            return true;
        } catch (e) {
            console.error('Session token storage failed:', e);
            return false;
        }
    }

    // Migrate plaintext password to hash (automatic on first login)
    async function migratePasswordIfNeeded(username, userObj, usersDb) {
        if (!userObj.password || isHashedPassword(userObj.password)) {
            return false; // Already hashed or no password
        }

        // Hash the plaintext password
        const hashedPassword = await hashPassword(userObj.password);
        userObj.password = hashedPassword;

        // Update in Firebase
        try {
            const encodedUsername = encodeURIComponent(username);
            await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users/${encodedUsername}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: hashedPassword })
            });
            console.log(`✓ Password migrated to hash for: ${username}`);
            return true;
        } catch (e) {
            console.error('Password migration failed:', e);
            return false;
        }
    }

    async function getCloudUsers() {
        try {
            const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`);
            if (res.ok) {
                const data = await res.json();
                if (data) return data;
            } else {
                console.error("Firebase Auth Error:", res.status);
            }
        } catch (e) {
            console.error("Bulut kullanıcı verisi alınamadı", e);
        }

        // Initialize default if not exists
        const defaultUsers = {
            'admin': { password: 'admin', schoolName: 'Sistem Yöneticisi', role: 'master' }
        };

        try {
            await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(defaultUsers)
            });
        } catch (e) { }

        return defaultUsers;
    }

    // Helper to format teacher names as "Proper SURNAME" (e.g., Ali Rıza ŞAHİN)
    function formatTeacherName(name) {
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

                // Auto-redirect if not coming from a "Back" action
                // We check if we are on the login page and NOT explicitly logging out
                const role = (data.klbk_role || '').toLowerCase().trim();
                const targetUrl = (role === 'ogretmen' || role === 'idareci') ? '/h6t3y9w1' : 
                                 (role === 'master' || role === 'admin' || role === 'dashboard') ? '/r1p5s8q3' : '/j2k5l0p8';
                
                // If we are already on the login page and have a session, 
                // we only redirect if we didn't just come from that page (to allow 'Back' button)
                const lastRedirect = sessionStorage.getItem('klbk_last_redirect');
                if (lastRedirect !== targetUrl) {
                    sessionStorage.setItem('klbk_last_redirect', targetUrl);
                    window.location.href = targetUrl;
                }
                return; 
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
                
                // Helper to find a user in a potentially nested object (Firebase "dot" behavior)
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
                    // Validate if it's the actual user object (should have password)
                    return (current && typeof current === 'object' && 'password' in current) ? current : null;
                };

                // 1. Direct match (No dots or successfully retrieved as flat key)
                let matchedUser = usersDb[username];
                let actualUsername = username;

                // 2. Deep match (If dots in username caused nesting in Firebase)
                if (!matchedUser && username.includes('.')) {
                    matchedUser = findDeepUser(usersDb, username);
                }

                // 3. Email match (Fallthrough search)
                if (!matchedUser) {
                    const flattenUsers = (obj, prefix = '') => {
                        let results = {};
                        for (const k in obj) {
                            const newKey = prefix ? `${prefix}.${k}` : k;
                            if (obj[k] && typeof obj[k] === 'object' && 'password' in obj[k]) {
                                results[newKey] = obj[k];
                            } else if (obj[k] && typeof obj[k] === 'object') {
                                Object.assign(results, flattenUsers(obj[k], newKey));
                            }
                        }
                        return results;
                    };

                    const flatUsers = flattenUsers(usersDb);
                    for (const [uname, data] of Object.entries(flatUsers)) {
                        if (data.email && data.email.toLowerCase() === username.toLowerCase()) {
                            matchedUser = data;
                            actualUsername = uname;
                            break;
                        }
                    }
                }

                // Validate credentials (Support both plaintext and hashed passwords)
                let passwordMatch = false;
                if (matchedUser && matchedUser.password) {
                    if (isHashedPassword(matchedUser.password)) {
                        // Password is hashed, hash input and compare
                        const inputHash = await hashPassword(password);
                        passwordMatch = matchedUser.password === inputHash;
                    } else {
                        // Legacy plaintext password - direct compare
                        passwordMatch = matchedUser.password === password;
                        
                        // Auto-migrate to hash on successful login
                        if (passwordMatch) {
                            migratePasswordIfNeeded(actualUsername, matchedUser, usersDb).catch(e => 
                                console.error('Background password migration failed:', e)
                            );
                        }
                    }
                }

                if (passwordMatch) {
                    
                    // Sadece 'admin', '@arız@' ve '@rız@' hesabı storeKey (yeni sistem kaydı) olmadan girebilir.
                    // Diğer eski master kullanıcıları (örn: ariza) veya her türlü master yeni sistemdeyse girebilir.
                    if (matchedUser.role === 'master' && actualUsername !== 'admin' && actualUsername !== '@arız@' && actualUsername !== '@rız@') {
                        if (!matchedUser.storeKey) {
                            showMessage(loginMessageBox, 'Hesabınız eski sisteme ait. Lütfen yeni sisteme entegre olun.', 'error');
                            if (typeof shakeForm === 'function') shakeForm();
                            btn.innerHTML = originalHtml;
                            btn.disabled = false;
                            return;
                        }
                    }

                    username = actualUsername;
                    const userData = matchedUser;
                    showMessage(loginMessageBox, 'Giriş başarılı! Yönlendiriliyorsunuz...', 'success');

                    // --- Asenkron Aktivite Loglama ---
                    try {
                        fetch(`${firebaseDatabaseUrl}/app_store/klbk_activity_log.json`)
                        .then(r => r.json()).then(async data => {
                            let logs = [];
                            if (data && data.logs) {
                                logs = data.logs;
                            }
                            
                            // Make sure valid array
                            if (!Array.isArray(logs)) logs = [];

                            const role = userData.role || 'admin';
                            // Master logins also counted
                            logs.unshift({
                                username: username,
                                role: role,
                                school: userData.schoolName || '-',
                                time: new Date().toLocaleString('tr-TR')
                            });

                            if (logs.length > 500) logs = logs.slice(0, 500);

                            const syncRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_activity_log.json`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ logs: logs })
                            });
                            if (!syncRes.ok) console.warn("Activity log sync failed", syncRes.status);
                        }).catch(e => console.warn('Aktivite loglanamadı', e));
                    } catch (e) {
                        console.warn("Log tracking failed", e);
                    }
                    // ---------------------------------

                    // Handle Remember Me (Persistent Session)
                    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                        localStorage.setItem('klbk_rememberedUser', username);

                        // Save full session to localStorage for persistence (Except students)
                        const role = userData.role || 'admin';
                        if (role !== 'student' && role !== 'ogrenci') {
                                const sessionData = {
                                    klbk_currentUser: username,
                                    klbk_name: formatTeacherName(userData.name || username),
                                    klbk_schoolName: userData.schoolName || '',
                                    klbk_storeKey: userData.storeKey || (`klbk_data_${username}`),
                                    klbk_role: role,
                                    klbk_loginTime: new Date().toISOString()
                                };
                            if (userData.branch) {
                                sessionData.klbk_branch = userData.branch;
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
                    sessionStorage.setItem('klbk_name', formatTeacherName(userData.name || username));
                    sessionStorage.setItem('klbk_schoolName', userData.schoolName || '');
                    sessionStorage.setItem('klbk_storeKey', userData.storeKey || (`klbk_data_${username}`));
                    sessionStorage.setItem('klbk_role', userData.role || 'admin');
                    sessionStorage.setItem('klbk_gender', userData.gender || 'erkek');
                    if (userData.branch) {
                        sessionStorage.setItem('klbk_branch', userData.branch);
                    }
                    sessionStorage.setItem('klbk_loginTime', new Date().toISOString());

                    // === SECURITY: Generate and store session token for Firebase write access ===
                    try {
                        const storeKey = userData.storeKey || `klbk_data_${username}`;
                        const sessionToken = await generateSessionToken(username, storeKey);
                        sessionStorage.setItem('klbk_sessionToken', sessionToken);
                        
                        // Store token in Firebase for validation
                        await storeSessionToken(username, sessionToken, storeKey, userData.role || 'admin');
                        console.log('✓ Session token generated and stored');
                    } catch (e) {
                        console.error('Session token generation failed:', e);
                    }

                    // Redirect logic
                    setTimeout(() => {
                        const rawRole = userData.role || 'admin';
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
