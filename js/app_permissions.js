(async function() {
    // Hide body initially to prevent flashing unauthorized content
    const style = document.createElement('style');
    style.id = 'app-permissions-style';
    style.innerHTML = 'body { display: none !important; }';
    document.head.appendChild(style);

    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
    const currentPath = window.location.pathname;
    
    // Ignore permissions check for login, enter (portal), and security_error
    if (currentPath === '/' || currentPath.endsWith('index.html') || currentPath.endsWith('enter.html') || currentPath.endsWith('security_error.html') || currentPath.endsWith('master.html')) {
        document.head.removeChild(style);
        return;
    }

    try {
        const res = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_app_permissions.json?_=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            
            let dbKey = currentPath;
            if (dbKey.startsWith('/')) dbKey = dbKey.substring(1);
            dbKey = dbKey.replace(/\./g, '_');
            
            if (data && data[dbKey]) {
                const perm = data[dbKey];
                
                // 1. Check Global Access
                if (perm.globalAccess === false) {
                    showAccessDenied();
                    return; // Stop execution
                }

                // 2. Check Role Overrides
                const currentUser = sessionStorage.getItem('klbk_currentUser') || localStorage.getItem('klbk_currentUser');
                if (currentUser) {
                    const assignedRole = (perm.assignments && perm.assignments[currentUser]) ? perm.assignments[currentUser] : 'ogretmen';
                    if (assignedRole !== 'serbest') {
                        sessionStorage.setItem('klbk_role', assignedRole); // Override role for this session context
                    }
                }
            }
        }
    } catch (e) {
        console.error("App permissions check failed:", e);
        // On failure, we fail open (allow access based on normal auth)
    }

    // Allow body to show
    document.head.removeChild(style);

    function showAccessDenied() {
        document.body.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height:100vh; background-color:#f8fafc; font-family:'Outfit', sans-serif; text-align:center; padding:20px;">
                <div style="background:white; padding:40px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.1); max-width:500px;">
                    <div style="font-size:3rem; color:#ef4444; margin-bottom:20px;">
                        <svg style="width:64px; height:64px; margin:0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h1 style="color:#1e293b; margin-top:0;">Erişim Engellendi</h1>
                    <p style="color:#64748b; font-size:1.1rem; line-height:1.5;">Bu uygulamaya erişim engellenmiş. Lütfen admininize danışın.</p>
                    <div style="margin-top:20px; padding:15px; background:#f1f5f9; border-radius:8px; font-weight:600; color:#334155;">
                        <a href="mailto:arizasahin@gmail.com" style="color:#2563eb; text-decoration:none;">arizasahin@gmail.com</a>
                    </div>
                    <button onclick="window.history.back()" style="margin-top:30px; background:#e2e8f0; color:#475569; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:600;">Geri Dön</button>
                </div>
            </div>
        `;
        document.head.removeChild(style);
    }
})();
