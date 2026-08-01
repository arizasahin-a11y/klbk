document.addEventListener('DOMContentLoaded', async () => {
    try {

    // Security functions moved to js/ui_modules/account_settings.js

    // Shared sort utility for Turkish alphanumeric strings (e.g. "9-A", "Salon 1")
    window.sortByNum = (a, b) => {
        const numA = parseInt(a.replace(/[a-zA-Z\u00C0-\u024F]+$/, '')) || 0;
        const numB = parseInt(b.replace(/[a-zA-Z\u00C0-\u024F]+$/, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b, 'tr');
    };

    // --- Global Date Helpers (Delegated to DataManager) ---
    window.formatDateToStandard = (val) => DataManager.formatDateToStandard(val);
    window.formatDateToInput = (val) => DataManager.formatDateToInput(val);

    window.googleFonts100 = [
        "Roboto", "Open Sans", "Montserrat", "Lato", "Oswald", "Source Sans Pro", "Slabo 27px", "Raleway", "PT Sans", "Merriweather",
        "Nunito", "Concert One", "Prompt", "Work Sans", "Fira Sans", "Rubik", "Mukta", "Quicksand", "Inter", "Ubuntu",
        "Karla", "Arimo", "Noto Sans", "Playfair Display", "Mulish", "Nanum Gothic", "Zilla Slab", "Libre Baskerville", "Lora", "Oxygen",
        "Cabin", "Varela Round", "Bitter", "Dosis", "Abel", "Inconsolata", "Anton", "Josefin Sans", "Hind", "Heebo",
        "Teko", "Exo 2", "Pacifico", "Lobster", "Comfortaa", "Yanone Kaffeesatz", "Fjalla One", "Titillium Web", "Asap", "Bree Serif",
        "Archivo Narrow", "Play", "Vollkorn", "Alegreya", "Signika", "Righteous", "Amatic SC", "Crimson Text", "Acme", "Monda",
        "Francois One", "Rokkitt", "Orbitron", "Patua One", "Tinos", "Crete Round", "Russo One", "Gudea", "Kreon", "Marmelad",
        "Philosopher", "Trocchi", "Coda", "Glegoo", "Bangers", "Jura", "Sura", "Tauri", "Krona One", "Syncopate",
        "Changa One", "Racing Sans One", "Michroma", "Baumans", "Magra", "Iceberg", "Gafata", "Doppio One", "Knewave", "Candal",
        "Oleo Script", "Spinnaker", "Fugaz One", "Salsa", "Coustard", "Vampiro One", "Supermercado One", "Lemon", "Carme", "Ovo"
    ];


    // --- 1. Authentication & Path enforcement ---
    const path = window.location.pathname;

    // Allow dashboard access but check session
    const isDashboard = path.endsWith('/dashboard.html') || path.endsWith('/dashboard');

    const isLoginPage = path.includes('k9x7v2m4');
    
    if (!isLoginPage) {
        const isLoggedIn = sessionStorage.getItem('klbk_isLoggedIn');
        if (!isLoggedIn) {
            sessionStorage.setItem('klbk_intended_url', window.location.pathname);
            window.location.href = '/enter.html';
            return;
        }
    }

    // --- Cloud Sync ---
    // Fetch user's data from Supabase before rendering the dashboard
    console.log("%c DIAGNOSIS: Path is " + path, "color: blue; font-weight: bold; font-size: 14px;");
    await DataManager.initCloud();
    
    // Fetch school teachers for assignment calculations
    if (DataManager.getSchoolTeachers) {
        window.globalTeachersDb = await DataManager.getSchoolTeachers();
    }
    
    // Check what was loaded
    const studentsCount = DataManager.getStudents().length;
    console.log("%c DIAGNOSIS: Found " + studentsCount + " students in memory.", "color: green; font-weight: bold; font-size: 16px;");
    if (studentsCount > 0) {
        console.log("First student preview:", DataManager.getStudents()[0].name);
    } else {
        console.warn("%c DIAGNOSIS WARNING: NO STUDENTS FOUND! Check storage key or database content.", "color: red; font-weight: bold;");
    }

    const key = DataManager._getStorageKey();
    console.log("%c DIAGNOSIS: Using storage key: " + key, "color: orange; font-weight: bold;");

    // --- Data Mutation Wrappers for UI Sync ---
    window._lastLocalChangeTime = 0;
    const _origAddSession = DataManager.addExamSession;
    DataManager.addExamSession = function(s) {
        const res = _origAddSession.apply(DataManager, arguments);
        window._lastLocalChangeTime = Date.now();
        if (window.updateSyncHash) window.updateSyncHash();
        return res;
    };
    const _origRemoveSession = DataManager.removeExamSession;
    DataManager.removeExamSession = function(id) {
        const res = _origRemoveSession.apply(DataManager, arguments);
        window._lastLocalChangeTime = Date.now();
        if (window.updateSyncHash) window.updateSyncHash();
        return res;
    };

    document.getElementById('displayUsername').textContent = sessionStorage.getItem('klbk_currentUser') || 'Yönetici';
    
    // Set Sidebar Avatar based on gender
    const sidebarAvatarIcon = document.getElementById('sidebarAvatarIcon');
    if (sidebarAvatarIcon) {
        const cachedGender = sessionStorage.getItem('klbk_gender') || 'erkek';
        let iconClass = 'fa-user-tie';
        let bg = '#2196f3';
        if (cachedGender === 'kadin') { iconClass = 'fa-user-nurse'; bg = '#e91e63'; }
        else if (cachedGender === 'diger') { iconClass = 'fa-user'; bg = '#6c757d'; }
        sidebarAvatarIcon.className = `fa-solid ${iconClass}`;
        sidebarAvatarIcon.parentElement.style.background = bg;
        sidebarAvatarIcon.parentElement.style.color = 'white';
    }

    // --- Logout Action ---
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.clear();
        localStorage.removeItem('klbk_persistent_session');
        window.location.href = '/k9x7v2m4?logout=true';
    });

    // --- Global Reset Rules Action ---
    const resetRulesBtn = document.getElementById('globalResetRulesBtn');
    if (resetRulesBtn) {
        resetRulesBtn.addEventListener('click', () => {
            Swal.fire({
                title: 'Kural Onaylarını Sıfırla?',
                text: "Tüm öğrencilerin Sınav Kuralları onay durumları sıfırlanacaktır. Sistemi tekrar kullandıklarında kuralları yeniden onaylamaları istenecektir. Emin misiniz?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Evet, Sıfırla',
                cancelButtonText: 'İptal'
            }).then((result) => {
                if (result.isConfirmed) {
                    const count = DataManager.resetAllStudentRuleAcceptances();
                    Swal.fire({
                        title: 'Başarılı!',
                        text: `Toplam ${count} öğrencinin kural onayı başarıyla sıfırlandı.`,
                        icon: 'success'
                    });
                }
            });
        });

        // Right click context menu to edit rules text
        resetRulesBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const school = DataManager.getSchoolSettings() || {};
            let rules = school.rules;
            if (!rules || !Array.isArray(rules) || rules.length === 0) {
                // Fallback default rules
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

            const rulesText = rules.join('\n');

            Swal.fire({
                title: 'Sınav Kurallarını Düzenle',
                html: `
                    <p style="font-size: 0.85rem; color: var(--gray-500); text-align: left; margin-bottom: 10px;">
                        Her bir kuralı yeni bir satıra yazınız. Boş satırlar otomatik elenecektir.
                    </p>
                    <textarea id="rulesEditorText" class="form-control" style="width: 100%; height: 300px; padding: 10px; font-family: inherit; font-size: 0.9rem; border: 1px solid var(--gray-300); border-radius: 8px; resize: vertical; line-height: 1.5;">${rulesText}</textarea>
                `,
                showCancelButton: true,
                confirmButtonText: 'Kaydet',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#4f46e5',
                preConfirm: () => {
                    const editorVal = document.getElementById('rulesEditorText').value;
                    const parsedRules = editorVal.split('\n').map(r => r.trim()).filter(Boolean);
                    if (parsedRules.length === 0) {
                        Swal.showValidationMessage('En az bir kural girilmelidir.');
                        return false;
                    }
                    return parsedRules;
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    school.rules = result.value;
                    DataManager.saveSchoolSettings(school);
                    Swal.fire({
                        title: 'Başarılı!',
                        text: 'Sınav kuralları güncellendi. Yeni kurallar öğrencilerin bir sonraki kural ekranı açılışında gösterilecektir.',
                        icon: 'success',
                        timer: 2500,
                        showConfirmButton: false
                    });
                }
            });
        });
    }

    // --- System Settings Action ---
    async function openSystemSettings() {
        const school = DataManager.getSchoolSettings();
        const defs = school.defaultTimes || {
            studentLocationMinutes: 20,
            studentExamEndHideMinutes: 30,
            teacherExamRemovalMinutes: 5,
            branchTeacherExamRemovalMinutes: 120,
            examFilesActiveMinutes: 3,
            defaultExamDuration: 40,
            defaultScreenViewLimit: 8
        };

        Swal.fire({
            title: 'Sınav Sistem Ayarları',
            html: `
                <div style="display: grid; grid-template-columns: 1fr 100px; gap: 15px; align-items: center; text-align: left; margin-top: 15px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; box-sizing: border-box;">
                    <label for="sysLocMin" style="font-size: 0.85rem; font-weight: 700; color: #334155; line-height: 1.4; padding-right: 10px;">
                        Sınav Yerleri Görünme Süresi <span style="font-size:0.75rem; color:#64748b; font-weight:normal; display:block;">(Sınavdan kaç dakika önce)</span>
                    </label>
                    <input type="number" id="sysLocMin" class="form-control" value="${defs.studentLocationMinutes}" style="width: 100%; height: 38px; padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: bold; text-align: center; box-sizing: border-box; outline: none; margin: 0;">

                    <label for="sysStudHideMin" style="font-size: 0.85rem; font-weight: 700; color: #334155; line-height: 1.4; padding-right: 10px;">
                        Öğrenciden Sınavı Gizleme Süresi <span style="font-size:0.75rem; color:#64748b; font-weight:normal; display:block;">(Sınav bitiminden kaç dakika sonra)</span>
                    </label>
                    <input type="number" id="sysStudHideMin" class="form-control" value="${defs.studentExamEndHideMinutes}" style="width: 100%; height: 38px; padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: bold; text-align: center; box-sizing: border-box; outline: none; margin: 0;">

                    <label for="sysTchHideMin" style="font-size: 0.85rem; font-weight: 700; color: #334155; line-height: 1.4; padding-right: 10px;">
                        Gözetmen Listesinden Kaldırma Süresi <span style="font-size:0.75rem; color:#64748b; font-weight:normal; display:block;">(Sınav bitiminden kaç dakika sonra)</span>
                    </label>
                    <input type="number" id="sysTchHideMin" class="form-control" value="${defs.teacherExamRemovalMinutes}" style="width: 100%; height: 38px; padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: bold; text-align: center; box-sizing: border-box; outline: none; margin: 0;">

                    <label for="sysBranchTchHideMin" style="font-size: 0.85rem; font-weight: 700; color: #334155; line-height: 1.4; padding-right: 10px;">
                        Branş Öğretmeninden Kaldırma Süresi <span style="font-size:0.75rem; color:#64748b; font-weight:normal; display:block;">(Sınav bitiminden kaç dakika sonra)</span>
                    </label>
                    <input type="number" id="sysBranchTchHideMin" class="form-control" value="${defs.branchTeacherExamRemovalMinutes !== undefined ? defs.branchTeacherExamRemovalMinutes : 120}" style="width: 100%; height: 38px; padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: bold; text-align: center; box-sizing: border-box; outline: none; margin: 0;">

                    <label for="sysFileActMin" style="font-size: 0.85rem; font-weight: 700; color: #334155; line-height: 1.4; padding-right: 10px;">
                        Dosya İndirme Gecikmesi <span style="font-size:0.75rem; color:#64748b; font-weight:normal; display:block;">(Sınav başladıktan kaç dakika sonra)</span>
                    </label>
                    <input type="number" id="sysFileActMin" class="form-control" value="${defs.examFilesActiveMinutes}" style="width: 100%; height: 38px; padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: bold; text-align: center; box-sizing: border-box; outline: none; margin: 0;">

                    <label for="sysDefDur" style="font-size: 0.85rem; font-weight: 700; color: #334155; line-height: 1.4; padding-right: 10px;">
                        Varsayılan Sınav Süresi <span style="font-size:0.75rem; color:#64748b; font-weight:normal; display:block;">(Dakika cinsinden)</span>
                    </label>
                    <input type="number" id="sysDefDur" class="form-control" value="${defs.defaultExamDuration}" style="width: 100%; height: 38px; padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: bold; text-align: center; box-sizing: border-box; outline: none; margin: 0;">

                    <label for="sysScreenLimit" style="font-size: 0.85rem; font-weight: 700; color: #334155; line-height: 1.4; padding-right: 10px;">
                        Ekran Görünümü Varsayılan Süresi <span style="font-size:0.75rem; color:#64748b; font-weight:normal; display:block;">(Dakika cinsinden)</span>
                    </label>
                    <input type="number" id="sysScreenLimit" class="form-control" value="${defs.defaultScreenViewLimit}" style="width: 100%; height: 38px; padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: bold; text-align: center; box-sizing: border-box; outline: none; margin: 0;">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            preConfirm: () => {
                const locMin = parseInt(document.getElementById('sysLocMin').value);
                const studHideMin = parseInt(document.getElementById('sysStudHideMin').value);
                const tchHideMin = parseInt(document.getElementById('sysTchHideMin').value);
                const branchTchHideMin = parseInt(document.getElementById('sysBranchTchHideMin').value);
                const fileActMin = parseInt(document.getElementById('sysFileActMin').value);
                const defDur = parseInt(document.getElementById('sysDefDur').value);
                const screenLimit = parseInt(document.getElementById('sysScreenLimit').value);

                if (isNaN(locMin) || isNaN(studHideMin) || isNaN(tchHideMin) || isNaN(branchTchHideMin) || isNaN(fileActMin) || isNaN(defDur) || isNaN(screenLimit)) {
                    Swal.showValidationMessage('Tüm alanlara geçerli sayılar girmelisiniz');
                    return false;
                }

                try {
                    const currentSchool = DataManager.getSchoolSettings();
                    currentSchool.defaultTimes = {
                        studentLocationMinutes: locMin,
                        studentExamEndHideMinutes: studHideMin,
                        teacherExamRemovalMinutes: tchHideMin,
                        branchTeacherExamRemovalMinutes: branchTchHideMin,
                        examFilesActiveMinutes: fileActMin,
                        defaultExamDuration: defDur,
                        defaultScreenViewLimit: screenLimit
                    };
                    DataManager.saveSchoolSettings(currentSchool);
                    return true;
                } catch (e) {
                    Swal.showValidationMessage(e.message);
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Başarılı',
                    text: 'Sistem ayarları güncellendi.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    }

    const accountSettingsBtn = document.getElementById('accountSettingsBtn');
    if (accountSettingsBtn) {
        accountSettingsBtn.addEventListener('click', openSystemSettings);
    }
    const sidebarUserArea = document.getElementById('sidebarUserArea');
    if (sidebarUserArea) {
        sidebarUserArea.addEventListener('click', openSystemSettings);
    }

    const displayUsernameEl = document.getElementById('displayUsername');
    if (displayUsernameEl) {
        displayUsernameEl.style.cursor = 'pointer';
        displayUsernameEl.style.transition = 'color 0.2s ease, text-decoration 0.2s ease';
        displayUsernameEl.title = 'Hesap Ayarları';
        displayUsernameEl.addEventListener('mouseenter', () => {
            displayUsernameEl.style.color = 'var(--primary)';
            displayUsernameEl.style.textDecoration = 'underline';
        });
        displayUsernameEl.addEventListener('mouseleave', () => {
            displayUsernameEl.style.color = '';
            displayUsernameEl.style.textDecoration = '';
        });
        displayUsernameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            openAccountSettings();
        });
    }

    // Account settings function moved to js/ui_modules/account_settings.js

    // --- Global Event Delegation for Accordion Classroom Editor ---
    document.body.addEventListener('change', (e) => {
        if (e.target.matches('.desk-pos-select')) {
            console.log("Delegated desk-pos-select change trigger:", e.target.dataset.room, e.target.value);
            window.updateDeskPos(e.target.dataset.room, e.target.value);
        }
    });

    document.body.addEventListener('click', (e) => {
        const seatBtn = e.target.closest('.seat-toggle-btn');
        if (seatBtn) {
            console.log("Delegated seat-toggle-btn click trigger:", seatBtn.dataset.room, seatBtn.dataset.seat);
            window.toggleSeat(seatBtn.dataset.room, seatBtn.dataset.seat);
        }
    });


    // --- 2. Sidebar Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    const viewTitles = {
        'view-dashboard': { title: 'Genel Bakış', subtitle: 'Sisteme hoş geldiniz, istatistikleri ve genel durumu görebilirsiniz.' },
        'view-school': { title: 'Okul Ayarları', subtitle: 'Kurum genel bilgileri ve eğitim yılı tanımlamaları.' },
        'view-students': { title: 'Öğrenci & Sınıf Yönetimi', subtitle: 'Okuldaki sınıflar ve öğrenci listelerinin tanımlandığı bölüm.' },
        'view-classrooms': { title: 'Derslik Yönetimi', subtitle: 'Sınavın yapılacağı derslikler ve oturma (sıra) planları tasarımı.' },
        'view-teachers': { title: 'Öğretmen Yönetimi', subtitle: 'Sisteme öğretmen ekleme, listeleme ve branş işlemlerini buradan yapabilirsiniz.' },
        'view-exam': { title: 'Sınav Dağıtımı', subtitle: 'Öğrencileri dersliklere dağıtma algoritması ve sonuçlar.' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active to clicked target
            item.classList.add('active');

            const targetViewId = item.getAttribute('data-target');

            // Hide all sections
            viewSections.forEach(section => {
                section.classList.add('hidden');
                section.classList.remove('active');
            });

            // Show target section
            const targetSection = document.getElementById(targetViewId);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                targetSection.classList.add('active');

                // Update Header
                if (viewTitles[targetViewId]) {
                    pageTitle.textContent = viewTitles[targetViewId].title;
                    pageSubtitle.textContent = viewTitles[targetViewId].subtitle;
                }
            }

            // Close mobile sidebar if open
            if (window.innerWidth <= 900) {
                document.querySelector('.sidebar').style.left = '-300px';
            }

            // Refresh view specific data conditionally
            if (targetViewId === 'view-dashboard') updateDashboardStats();
            if (targetViewId === 'view-students') updateClassesList();
            if (targetViewId === 'view-school') loadSchoolSettings();

            // Update Browser URL (Hash based for easy refresh)
            window.location.hash = targetViewId;
            sessionStorage.setItem('klbk_activeTab', targetViewId);

            // Close Sidebar on Mobile after selection
            if (window.innerWidth <= 900) {
                document.querySelector('.sidebar').classList.remove('open');
            }
        });
    });

    // Handle initial state and persistence
    function initializeNavigation() {
        const savedTabId = sessionStorage.getItem('klbk_activeTab');
        const loader = document.getElementById('appLoader');
        const isMobile = window.innerWidth <= 900;

        if (isMobile) {
            // Force Exam section on mobile as requested
            const examTab = Array.from(navItems).find(item => item.getAttribute('data-target') === 'view-exam');
            if (examTab) {
                examTab.click();
            }
        } else if (savedTabId) {
            const tabToClick = Array.from(navItems).find(item => item.getAttribute('data-target') === savedTabId);
            if (tabToClick) {
                tabToClick.click();
            }
        } else {
            // Default to Exam section if no saved tab (User's specific request)
            const examTab = Array.from(navItems).find(item => item.getAttribute('data-target') === 'view-exam');
            if (examTab) {
                examTab.click();
            }
        }

        // Hide loader with a slight delay to ensure rendering is smooth
        if (loader) {
            setTimeout(() => {
                loader.classList.add('fade-out');
                // Remove from DOM after transition
                setTimeout(() => loader.remove(), 600);
            }, 500);
        }
    }

    // Mobile Sidebar Toggle
    const toggleSidebar = () => {
        document.querySelector('.sidebar').classList.toggle('open');
    };

    if (document.getElementById('mobileMenuBtn')) {
        document.getElementById('mobileMenuBtn').addEventListener('click', toggleSidebar);
    }
    if (document.getElementById('mobileMenuBtnOutside')) {
        document.getElementById('mobileMenuBtnOutside').addEventListener('click', toggleSidebar);
    }


    // --- 3. Inner Tabs (Students View) ---
    const innerTabs = document.querySelectorAll('.inner-tab');
    const innerContents = document.querySelectorAll('.inner-content');

    innerTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            innerTabs.forEach(t => t.classList.remove('active'));
            innerContents.forEach(c => c.classList.remove('active', 'hidden'));

            tab.classList.add('active');

            const targetId = tab.getAttribute('data-tab');
            innerContents.forEach(c => {
                if (c.id === 'tab-' + targetId) {
                    c.classList.add('active');
                } else {
                    c.classList.add('hidden');
                }
            });
        });
    });


    // --- 4. Load Data using DataManager ---

    // Load School Settings
    function loadSchoolSettings() {
        const school = DataManager.getSchoolSettings();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

        setVal('schoolName', school.name || '');
        setVal('classCount', school.classCount || '');
        setVal('roomCount', school.roomCount || '');
        setVal('principalName', school.principal || '');
        setVal('vicePrincipalName', school.vicePrincipal || '');
        setVal('gradeLevels', school.gradeLevels ? school.gradeLevels.join(', ') : '');
        setVal('schoolSubjects', school.subjects ? school.subjects.join(', ') : '');
        setVal('pdfHeaderDesign', school.pdfHeaderDesign || '1');

        // Auto-fill academic year & term based on today's date
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1; // 1-12
        // Academic calendar rules:
        // Sep–Dec (9–12) → I. Dönem, year = y / y+1
        // Jan     (1)    → I. Dönem, year = y-1 / y
        // Feb–Aug (2–8)  → II. Dönem, year = y-1 / y
        let autoYear, autoTerm;
        if (m >= 9) {
            // Sep–Dec: start of new school year
            autoYear = `${y}-${y + 1}`;
            autoTerm = 'I. Dönem';
        } else if (m === 1) {
            // January: still first term of the school year that started previous Sep
            autoYear = `${y - 1}-${y}`;
            autoTerm = 'I. Dönem';
        } else {
            // Feb–Aug: second term of the closing school year
            autoYear = `${y - 1}-${y}`;
            autoTerm = 'II. Dönem';
        }

        setVal('academicYear', school.academicYear || autoYear);
        setVal('academicTerm', autoTerm);

        // Logo Preview
        const logoPreview = document.getElementById('schoolLogoPreview');
        if (logoPreview) {
            if (school.logo) {
                logoPreview.innerHTML = `<img src="${school.logo}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
            } else {
                logoPreview.innerHTML = `<i class="fa-solid fa-image" style="color:#ccc;"></i>`;
            }
        }

        // Lesson schedule
        const dailyLessons = school.dailyLessons || '';
        setVal('dailyLessons', dailyLessons);
        if (dailyLessons && parseInt(dailyLessons) > 0 && typeof window.updateLessonSchedule === 'function') {
            window.updateLessonSchedule(dailyLessons, school.lessonTimes || {});
        }
    }

    loadSchoolSettings();

    // --- Gear Menu Toggle ---
    document.getElementById('schoolGearBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('schoolGearMenu');
        menu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
        const menu = document.getElementById('schoolGearMenu');
        if (menu) menu.classList.add('hidden');
    });

    // --- Lesson Schedule Builder ---
    window.updateLessonSchedule = function (count, savedTimes) {
        const n = parseInt(count);
        const panel = document.getElementById('lessonSchedulePanel');
        const grid = document.getElementById('lessonTimesGrid');
        if (!n || n < 1) { panel.classList.add('hidden'); return; }
        panel.classList.remove('hidden');

        // Load saved times from data if not provided
        if (!savedTimes) {
            const school = DataManager.getSchoolSettings();
            savedTimes = school.lessonTimes || {};
        }

        let html = '';
        for (let i = 1; i <= n; i++) {
            const start = savedTimes[`${i}_start`] || '';
            const end = savedTimes[`${i}_end`] || '';
            html += `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem;">
                    <div style="font-size:0.8rem; font-weight:700; color:#4f46e5; margin-bottom:0.5rem;"><i class='fa-solid fa-clock'></i> ${i}. Ders</div>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <div style="flex:1;">
                            <label style="font-size:0.7rem; color:#64748b; display:block; margin-bottom:2px;">Giriş</label>
                            <input type="time" id="lt_${i}_start" value="${start}" style="width:100%; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; font-size:0.85rem;">
                        </div>
                        <span style="color:#94a3b8; padding-top:16px;">-</span>
                        <div style="flex:1;">
                            <label style="font-size:0.7rem; color:#64748b; display:block; margin-bottom:2px;">\u00c7\u0131k\u0131\u015f</label>
                            <input type="time" id="lt_${i}_end" value="${end}" style="width:100%; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; font-size:0.85rem;">
                        </div>
                    </div>
                </div>`;
        }
        grid.innerHTML = html;
    };

    // --- Backup / Import Functions ---
    window.backupAllData = function () {
        document.getElementById('schoolGearMenu').classList.add('hidden');
        const key = DataManager._getStorageKey();
        const data = DataManager._getData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        a.href = url;
        a.download = `klbk_yedek_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'Yedek Al\u0131nd\u0131!', text: 'T\u00fcm veriler JSON dosyas\u0131 olarak indirildi.', timer: 2000, showConfirmButton: false });
    };

    window.importBackupData = function () {
        document.getElementById('schoolGearMenu').classList.add('hidden');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    if (!parsed.school && !parsed.students) throw new Error('Invalid');
                    Swal.fire({
                        title: 'Yede\u011fi G\u00fcncelle',
                        html: 'Bu i\u015flem mevcut verilerin \u00fczerine yazar. Emin misiniz?',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Evet, Y\u00fckle',
                        cancelButtonText: '\u0130ptal',
                        confirmButtonColor: '#6366f1'
                    }).then(res => {
                        if (res.isConfirmed) {
                            DataManager._saveData(parsed);
                            
                            // Fully refresh all UI components with the new data
                            loadSchoolSettings();
                            if (typeof updateDashboardStats === 'function') updateDashboardStats();
                            if (typeof updateClassesList === 'function') updateClassesList();
                            
                            Swal.fire({ 
                                icon: 'success', 
                                title: 'Yüklendi!', 
                                text: 'Veriler başarıyla geri yüklendi. Sistem güncelleniyor...', 
                                timer: 1500, 
                                showConfirmButton: false 
                            }).then(() => {
                                location.reload();
                            });
                        }
                    });
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Hata', text: 'Ge\u00e7ersiz yedek dosyas\u0131.' });
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // Save School Settings Form
    document.getElementById('schoolForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const gradesArr = document.getElementById('gradeLevels').value.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
        const subjectsArr = document.getElementById('schoolSubjects').value.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);

        // Collect lesson times
        const dailyLessonsEl = document.getElementById('dailyLessons');
        const dailyLessons = dailyLessonsEl ? dailyLessonsEl.value.trim() : '';
        const lessonTimes = {};
        const n = parseInt(dailyLessons);
        if (n > 0) {
            for (let i = 1; i <= n; i++) {
                const sEl = document.getElementById(`lt_${i}_start`);
                const eEl = document.getElementById(`lt_${i}_end`);
                if (sEl) lessonTimes[`${i}_start`] = sEl.value;
                if (eEl) lessonTimes[`${i}_end`] = eEl.value;
            }
        }

        const currentSchool = DataManager.getSchoolSettings();
        const settings = {
            ...currentSchool,
            name: document.getElementById('schoolName').value.trim(),

            academicYear: document.getElementById('academicYear').value.trim(),
            classCount: document.getElementById('classCount').value.trim(),
            roomCount: document.getElementById('roomCount').value.trim(),
            principal: document.getElementById('principalName').value.trim(),
            vicePrincipal: document.getElementById('vicePrincipalName').value.trim(),
            gradeLevels: gradesArr,
            subjects: subjectsArr,
            dailyLessons: dailyLessons,
            lessonTimes: lessonTimes,
            pdfHeaderDesign: document.getElementById('pdfHeaderDesign') ? document.getElementById('pdfHeaderDesign').value : '1'
        };

        DataManager.saveSchoolSettings(settings);
        loadSchoolSettings(); // Refresh UI with cleaned data

        Swal.fire({
            icon: 'success',
            title: 'Ba\u015far\u0131l\u0131!',
            text: 'Kurum bilgileri ba\u015far\u0131yla kaydedildi.',
            timer: 2000,
            showConfirmButton: false
        });
    });


    // --- 5. Add Single Student ---
    document.getElementById('studentForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const no = document.getElementById('stdNo').value.trim();
        const stdClass = document.getElementById('stdClass').value.trim().toUpperCase();

        const std = {
            no: no,
            name: document.getElementById('stdName').value.trim(),
            class: stdClass,
            alan: document.getElementById('stdField').value.trim(),
            ogrenciKodu: document.getElementById('stdCode').value.trim(),
            dersler: document.getElementById('stdSubjects').value.split(/[,\n;]/).map(s => s.trim()).filter(Boolean),
            extra1: document.getElementById('stdExtra1').value.trim(),
            extra2: document.getElementById('stdExtra2').value.trim(),
            extra3: document.getElementById('stdExtra3').value.trim(),
            extra4: document.getElementById('stdExtra4').value.trim(),
            extra5: document.getElementById('stdExtra5').value.trim(),
            status: 'Aktif'
        };

        DataManager.addStudent(std);

        Swal.fire({
            icon: 'success',
            title: 'Öğrenci Kaydedildi',
            text: `${std.name} (${std.no}) - ${stdClass} sınıfına eklendi.`,
            timer: 2000,
            showConfirmButton: false
        });

        // Reset specific fields only
        document.getElementById('stdNo').value = '';
        document.getElementById('stdName').value = '';
        document.getElementById('stdNo').focus();

        // Refresh stats
        updateDashboardStats();
        updateClassesList();
    });

    // --- 5.5 Bulk Import via Excel ---
    const excelFileInput = document.getElementById('excelFileInput');
    const btnProcessExcel = document.getElementById('btnProcessExcel');
    const excelFileName = document.getElementById('excelFileName');

    if (excelFileInput && btnProcessExcel) {
        excelFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) {
                excelFileName.textContent = '';
                btnProcessExcel.disabled = true;
                return;
            }
            excelFileName.textContent = `Seçilen dosya: ${file.name}`;
            btnProcessExcel.disabled = false;

            // Auto-trigger processing for better UX
            btnProcessExcel.click();
        });

        btnProcessExcel.addEventListener('click', function () {
            const file = excelFileInput.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = async function (e) {
                try {
                    if (typeof XLSX === 'undefined') {
                        Swal.fire('Hata', 'SheetJS kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.', 'error');
                        return;
                    }
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonArr = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (jsonArr.length === 0) {
                        Swal.fire('Hata', 'Excel dosyası boş görünüyor.', 'error');
                        return;
                    }

                    // Collect students in array
                    const parsedStudents = [];
                    let currentClass = null;
                    let findingHeaders = false;
                    let colSNo = -1, colOgrNo = -1, colAd = -1, colSoyad = -1;
                    let detectedMode = null; // 'e-okul' or 'simple'

                    for (let i = 0; i < jsonArr.length; i++) {
                        const row = jsonArr[i];
                        if (!row || row.length === 0) continue;

                        let rowTextStr = row.join(' ').replace(/\n/g, ' ').toUpperCase();

                        // 1. Check for E-Okul Class Header (Priority)
                        let cMatchStr = null;
                        let m1 = rowTextStr.match(/(\d+)\.?\s*[ŞS]?INIF.*?([A-ZÇĞİÖŞÜ])\s*[ŞS]UBE/);
                        if (m1) {
                            cMatchStr = m1[1] + m1[2];
                        } else {
                            let m2 = rowTextStr.match(/[ŞS]?INIF.*?(?::|-|=)\s*(\d+)\s*[\/\-]?\s*([A-ZÇĞİÖŞÜ])/);
                            if (m2) cMatchStr = m2[1] + m2[2];
                            else {
                                let m3 = rowTextStr.match(/(\d+)\s*[\/\-]\s*([A-ZÇĞİÖŞÜ])\s*[ŞS]?INIF/);
                                if (m3) cMatchStr = m3[1] + m3[2];
                                else {
                                    let m4 = rowTextStr.match(/(\d+)\s*([A-ZÇĞİÖŞÜ])\s*(?:[ŞS]?INIFI|[ŞS]?UBESİ)/);
                                    if (m4) cMatchStr = m4[1] + m4[2];
                                    else {
                                        // Catch simple "9-A" or "10/B" as header if it's the only thing or start of row
                                        let m5 = rowTextStr.match(/^(\d+)\s*[\/\-]\s*([A-ZÇĞİÖŞÜ])(?:\s|$)/);
                                        if (m5) cMatchStr = m5[1] + m5[2];
                                    }
                                }
                            }
                        }

                        if (cMatchStr) {
                            currentClass = cMatchStr;
                            findingHeaders = true;
                            detectedMode = 'e-okul';
                            colSNo = -1; colOgrNo = -1; colAd = -1; colSoyad = -1;
                            continue;
                        }

                        // 2. Simple Format Detection (Only if not already in E-Okul mode)
                        // If we haven't found an E-Okul header yet, check if this row looks like Class | No | Name
                        if (!detectedMode || detectedMode === 'simple') {
                            const stdClass = String(row[0] || '').trim().toUpperCase();
                            const no = String(row[1] || '').trim();
                            const name = String(row[2] || '').trim();

                            // A row is simple if Class is like 9A, 10-B, and No is numeric
                            if (stdClass && no && name && !isNaN(parseInt(no))) {
                                // Validate Class string a bit more
                                if (stdClass.match(/^\d+\s*[\/\-]?[A-ZÇĞİÖŞÜ]$/) || stdClass.match(/^\d+$/)) {
                                    let normalizedClass = stdClass.replace(/[\/\-\s]+/g, '');
                                    parsedStudents.push({
                                        no, name, class: normalizedClass,
                                        status: 'Aktif'
                                    });
                                    detectedMode = 'simple';
                                    continue;
                                }
                            }
                        }

                        // 3. Continue E-Okul Parsing if mode is set
                        if (detectedMode === 'e-okul' && findingHeaders && currentClass) {
                            if (colSNo !== -1) {
                                let potentialSNo = parseInt(row[colSNo]);
                                if (!isNaN(potentialSNo) && potentialSNo > 0) {
                                    findingHeaders = false;
                                    if (colOgrNo === -1) {
                                        for (let j = colSNo + 1; j < row.length; j++) {
                                            if (String(row[j] || '').trim().length > 0) { colOgrNo = j; break; }
                                        }
                                    }
                                    if (colAd === -1) {
                                        for (let j = (colOgrNo !== -1 ? colOgrNo : colSNo) + 1; j < row.length; j++) {
                                            if (String(row[j] || '').trim().length > 0) { colAd = j; colSoyad = j; break; }
                                        }
                                    }
                                }
                            }

                            if (findingHeaders) {
                                let sNoIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\s\.\n]+/g, '').toUpperCase(); return v === 'SNO' || v === 'SIRANO' || v === 'NO' || v === 'SN'; });
                                if (sNoIdx !== -1) colSNo = sNoIdx;
                                let ogrNoIdx = row.findIndex(c => {
                                    let val = String(c || '').trim().replace(/[\s\.\n]+/g, '').toUpperCase();
                                    return val.includes('ÖĞRENCİNO') || val.includes('ÖGRENCİNO') || val.includes('OGRENCINO') || val.includes('OKULNO') || val.includes('NUMARASI') || val.includes('TC') || val.includes('OGRNO');
                                });
                                if (ogrNoIdx !== -1) colOgrNo = ogrNoIdx;
                                let adSoyadIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\s\.\n]+/g, '').toUpperCase(); return v === 'ADISOYADI' || v === 'ADSOYAD' || v.includes('ÖĞRENCİADISOYADI'); });
                                if (adSoyadIdx !== -1) { colAd = adSoyadIdx; colSoyad = adSoyadIdx; }
                                let adIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\n]+/g, '').toUpperCase(); return v === 'ADI' || v === 'AD'; });
                                if (adIdx !== -1) colAd = adIdx;
                                let soyadIdx = row.findIndex(c => { let v = String(c || '').trim().replace(/[\n]+/g, '').toUpperCase(); return v === 'SOYADI' || v === 'SOYAD'; });
                                if (soyadIdx !== -1) colSoyad = soyadIdx;
                                continue;
                            }
                        }

                        if (detectedMode === 'e-okul' && currentClass && !findingHeaders && colSNo !== -1) {
                            let sNoVal = parseInt(row[colSNo]);
                            if (!isNaN(sNoVal)) {
                                let stdNo = String(row[colOgrNo] || '').replace(/[\n\s]+/g, '').trim();
                                let stdAd = "", stdSoyad = "";
                                if (colAd === colSoyad) {
                                    let full = String(row[colAd] || '').replace(/\n/g, ' ').trim();
                                    let parts = full.split(/\s+/);
                                    if (parts.length > 1) { stdSoyad = parts.pop(); stdAd = parts.join(' '); }
                                    else { stdAd = full; stdSoyad = ""; }
                                } else {
                                    stdAd = String(row[colAd] || '').replace(/\n/g, ' ').trim();
                                    stdSoyad = String(row[colSoyad] || '').replace(/\n/g, ' ').trim();
                                }
                                if (stdNo && (stdAd || stdSoyad)) {
                                    let fullName = (stdAd + " " + stdSoyad).replace(/\s+/g, ' ').trim();
                                    parsedStudents.push({
                                        no: stdNo, name: fullName, class: currentClass,
                                        status: 'Aktif'
                                    });
                                }
                            } else if (String(row[colSNo]).trim()) {
                                // Non-numeric S.No means maybe end of class or some footer
                                // But don't clear currentClass immediately, just stop finding headers if we were
                                findingHeaders = false;
                            }
                        }
                    }

                    if (parsedStudents.length === 0) {
                        Swal.fire('Hata', 'Excel dosyasında öğrenci verisi bulunamadı veya format tanınmadı.', 'error');
                        return;
                    }

                    // Choose Import Method
                    const result = await Swal.fire({
                        title: 'Yükleme Seçeneği',
                        text: `${parsedStudents.length} öğrenci tespit edildi. Nasıl yüklemek istersiniz?`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Güncelle',
                        denyButtonText: 'Sıfırdan Yükle',
                        showDenyButton: true,
                        cancelButtonText: 'İptal',
                        confirmButtonColor: '#4f46e5',
                        denyButtonColor: '#ef4444'
                    });

                    if (result.isDismissed) return;

                    let method = 'update';
                    if (result.isDenied) {
                        method = 'fresh';
                    }

                    const stats = DataManager.bulkImportStudents(parsedStudents, method);

                    if (method === 'fresh') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Sıfırdan Yükleme Tamamlandı',
                            customClass: { popup: 'swal2-responsive-popup' },
                            width: 'auto',
                            html: `<b>${stats.totalStudents}</b> öğrenci ve <b>${stats.totalClasses}</b> sınıf başarıyla eklendi.`,
                            confirmButtonColor: '#4f46e5'
                        });
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: 'Güncelleme Tamamlandı',
                            customClass: { popup: 'swal2-responsive-popup' },
                            width: 'auto',
                            html: `
                                <div style="text-align:left; padding: 0.5rem;">
                                    <p style="margin: 0.75rem 0; display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-user-plus" style="color:#10b981; font-size:1.1rem;"></i> <span><b>${stats.addedCount}</b> yeni öğrenci eklendi.</span></p>
                                    <p style="margin: 0.75rem 0; display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-user-minus" style="color:#ef4444; font-size:1.1rem;"></i> <span><b>${stats.deletedCount}</b> öğrenci silindi.</span></p>
                                    <p style="margin: 0.75rem 0; display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-shuffle" style="color:#f59e0b; font-size:1.1rem;"></i> <span><b>${stats.classChangedCount}</b> öğrenci sınıf değiştirdi.</span></p>
                                </div>
                            `,
                            confirmButtonColor: '#4f46e5'
                        });
                    }

                    // reset upload UI
                    excelFileInput.value = '';
                    excelFileName.textContent = '';
                    btnProcessExcel.disabled = true;

                    updateDashboardStats();
                    updateClassesList();
                    document.querySelector('[data-tab="classLists"]').click();

                } catch (err) {
                    console.error("Excel parse hatasi:", err);
                    Swal.fire('Hata', 'Dosya okunurken bir hata oluştu.', 'error');
                }
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // --- 6. Update Dashboard Stats ---
    function updateDashboardStats() {
        try {
            const stats = DataManager.getStats();
            document.getElementById('statTotalStudents').textContent = stats.totalStudents || 0;
            document.getElementById('statTotalClasses').textContent = stats.totalClasses || 0;
            document.getElementById('statTotalRooms').textContent = stats.totalRooms || 0;
            document.getElementById('statTotalCapacity').textContent = stats.totalCapacity || 0;
        } catch (err) {
            console.error("Dashboard Stats calculation failed:", err);
            // Fallback display
            document.getElementById('statTotalStudents').textContent = '0';
        }
    }

    // --- 7. Students & Classes UI Helpers ---
    window.assignRoomToClass = function (className, roomName) {
        DataManager.saveClassRoomMapping(className, roomName);
        updateClassesList(); // Listeyi yenileyerek seçilen dersliği diğerlerinden gizle
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Derslik ayarı kaydedildi',
            showConfirmButton: false,
            timer: 1500
        });
    };

    let assignDeviceInterval = null;
    window.assignDeviceToClass = async function(className) {
        if (assignDeviceInterval) clearInterval(assignDeviceInterval);
        
        // Firebase Rules güncellemesine gerek kalmadan çalışması için halihazırda yazma yetkisi olan klbk_users klasörünü kullanıyoruz
        const pairingChannel = 'device_assign_00000';
        const waitToken = Math.random().toString(36).substring(2, 10);
        
        // Önceki kalıntıları temizlemek ve güvenli bir bekleme durumuna geçmek için Firebase'e token yazıyoruz
        try {
            const putRes = await fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_users/${pairingChannel}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'waiting', token: waitToken })
            });
            if (!putRes.ok) throw new Error("Firebase HTTP " + putRes.status);
        } catch (e) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Bağlantı hatası! ' + e.message,
                showConfirmButton: false,
                timer: 4000
            });
            console.error("Cihaz ata hatası:", e);
            return;
        }

        Swal.fire({
            title: 'Cihaz Bekleniyor...',
            html: `Lütfen tabletten/telefondan <b>00000</b> öğrenci numarasıyla Öğrenci Sistemine giriş yapın.<br><br>Sistem cihazı otomatik algılayacaktır.<br><br><div class="spinner-border text-primary" role="status"></div>`,
            showCancelButton: true,
            cancelButtonText: 'İptal',
            showConfirmButton: false,
            allowOutsideClick: false
        }).then((res) => {
            if (assignDeviceInterval) clearInterval(assignDeviceInterval);
        });

        assignDeviceInterval = setInterval(async () => {
            try {
                const res = await fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_users/${pairingChannel}.json?t=${Date.now()}`, { cache: 'no-store' });
                const data = await res.json();
                
                // Eğer data.deviceId varsa VE bizim token silinmişse (tablet PUT yaparak üzerine yazmışsa), bu %100 taze bir eşleşmedir!
                if (data && data.deviceId && data.token !== waitToken) {
                    clearInterval(assignDeviceInterval);
                    Swal.close();
                    
                    DataManager.saveClassDeviceMapping(className, data.deviceId);
                    
                    fetch(`https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_users/${pairingChannel}.json`, {
                        method: 'DELETE'
                    }).catch(e => {});
                    
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: `Cihaz başarıyla '${className}' sınıfına atandı! (Kod: ${data.deviceId})`,
                        showConfirmButton: false,
                        timer: 2000
                    });
                    
                    updateClassesList();
                }
            } catch(e) {}
        }, 2000);
    };

    window.selectedClassForSwap = null;
    
    window.selectDeviceForSwap = function(className, e) {
        if(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        window.selectedClassForSwap = className;
        // Highlight the selected badge
        document.querySelectorAll('.device-badge-selected').forEach(el => el.classList.remove('device-badge-selected'));
        const badge = document.querySelector(`[data-device-class="${CSS.escape(className)}"]`);
        if (badge) badge.classList.add('device-badge-selected');
        Swal.fire({
            toast: true,
            position: 'top',
            icon: 'info',
            title: `'${className}' seçildi. Takas için başka bir sınıfın cihaz alanına tıklayın.`,
            showConfirmButton: false,
            timer: 4000
        });
    };

    window.editDeviceMapping = async function(className) {
        if (window.selectedClassForSwap && window.selectedClassForSwap !== className) {
            const class1 = window.selectedClassForSwap;
            const class2 = className;
            window.selectedClassForSwap = null;
            document.querySelectorAll('.device-badge-selected').forEach(el => el.classList.remove('device-badge-selected'));

            // Single atomic save — no race condition
            const { id1, id2 } = DataManager.swapClassDeviceMappings(class1, class2);
            
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `Takas edildi: ${class1} (${id1 || '—'}) ↔ ${class2} (${id2 || '—'})`,
                showConfirmButton: false,
                timer: 2500
            });
            updateClassesList();
            return;
        }
        window.selectedClassForSwap = null;
        document.querySelectorAll('.device-badge-selected').forEach(el => el.classList.remove('device-badge-selected'));
        
        const currentId = DataManager.getSanitizedClassDeviceMapping(className) || '';
        const result = await Swal.fire({
            title: 'Cihaz Kodu Değiştir',
            input: 'text',
            inputLabel: `'${className}' sınıfına ait cihazın kodunu manuel olarak değiştirebilir veya başka bir cihazın koduyla eşleştirebilirsiniz.`,
            inputValue: currentId,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Kaydet',
            denyButtonText: 'Sil',
            cancelButtonText: 'İptal'
        });

        if (result.isDenied) {
            DataManager.saveClassDeviceMapping(className, '');
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Cihaz kodu silindi!',
                showConfirmButton: false,
                timer: 1500
            });
            updateClassesList();
        } else if (result.isConfirmed && result.value !== undefined) {
            const newId = result.value;
            if (newId !== currentId) {
                DataManager.saveClassDeviceMapping(className, newId.trim().toUpperCase());
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Cihaz kodu güncellendi!',
                    showConfirmButton: false,
                    timer: 1500
                });
                updateClassesList();
            }
        }
    };

    // --- Real-time device mapping polling (every 3 seconds) ---
    (function startDeviceMappingPoller() {
        let lastDeviceState = JSON.stringify(DataManager.getClassDeviceMappings() || {});
        setInterval(async () => {
            try {
                const key = DataManager._getStorageKey();
                const encodedKey = encodeURIComponent(key);
                const res = await fetch(`${DataManager.firebaseDatabaseUrl}/app_store/${encodedKey}/classDeviceMappings.json?t=${Date.now()}`);
                if (res.ok) {
                    const remote = await res.json() || {};
                    const remoteStr = JSON.stringify(remote);
                    if (remoteStr !== lastDeviceState) {
                        lastDeviceState = remoteStr;
                        // Merge into local memory without overwriting everything
                        const localData = DataManager._getData();
                        localData.classDeviceMappings = remote;
                        DataManager._memoryData = localData;
                        localStorage.setItem(DataManager._getStorageKey(), JSON.stringify(localData));
                        updateClassesList();
                        console.log('Device mappings updated from cloud.');
                    }
                }
            } catch(e) { /* silent */ }
        }, 3000);
    })();

    // Öğretmen listesi cache (Firebase'den bir kez çekilir)
    let _cachedTeachers = null;
    let _teachersLoading = false;

    async function ensureTeachersLoaded() {
        if (_cachedTeachers) return _cachedTeachers;
        if (_teachersLoading) return {};
        _teachersLoading = true;
        try {
            _cachedTeachers = await DataManager.getSchoolTeachers();
        } catch(e) { _cachedTeachers = {}; }
        _teachersLoading = false;
        return _cachedTeachers;
    }

    // İlk yüklemede öğretmenleri çek
    ensureTeachersLoaded().then(() => { if (typeof updateClassesList === 'function') updateClassesList(); });

    window.assignClassTeacher = function(className, teacherName) {
        DataManager.saveClassTeacherMapping(className, teacherName || '');
        updateClassesList();
    };

    function updateClassesList() {
        const students = DataManager.getStudents();
        const container = document.getElementById('classesGridContainer');
        const recentWidget = document.getElementById('recentClassesList');
        const classrooms = DataManager.getClassrooms();
        const classRoomMappings = DataManager.getClassRoomMappings() || {};
        const classTeacherMappings = DataManager.getClassTeacherMappings() || {};
        const allTeachers = _cachedTeachers || {};
        const assignedTeachers = Object.values(classTeacherMappings).filter(t => t);
        
        // Use sanitized mapping for display
        const getDisplayRoom = (cls) => DataManager.getSanitizedClassRoomMapping(cls);
        const assignedRoomNames = Object.values(classRoomMappings).filter(r => r);

        // Group students by class
        const classGroups = {};
        students.forEach(s => {
            if (!classGroups[s.class]) classGroups[s.class] = [];
            classGroups[s.class].push(s);
        });

        const classes = Object.keys(classGroups).sort((a, b) => {
            const matchA = a.match(/\d+/);
            const matchB = b.match(/\d+/);
            const numA = matchA ? parseInt(matchA[0]) : 0;
            const numB = matchB ? parseInt(matchB[0]) : 0;
            if (numA !== numB) return numA - numB;

            const strA = a.replace(/\d+/g, '').trim();
            const strB = b.replace(/\d+/g, '').trim();
            return strA.localeCompare(strB);
        });

        // Render
        if (classes.length === 0) {
            container.innerHTML = `<p class="empty-text">Henüz öğrenci eklenmemiş.</p>`;
            recentWidget.innerHTML = `<p class="empty-text">Sınıf kaydı bulunamadı.</p>`;
            return;
        }

        let html = '<div class="accordion-container" style="display:flex; flex-direction:column; gap:1rem;">';
        let widgetHtml = '';

        classes.forEach((cls, index) => {
            const clsStudents = (classGroups[cls] || []).slice().sort((a, b) => {
                const na = parseInt(a.no) || 0;
                const nb = parseInt(b.no) || 0;
                if (na !== nb) return na - nb;
                return String(a.no).localeCompare(String(b.no));
            });
            const count = clsStudents.length;
            const assignedRoom = DataManager.getSanitizedClassRoomMapping(cls) || '';

            // Accordion Header
            html += `
                <div class="accordion-item glass-panel" style="border-radius:10px; overflow-x:auto;">
                    <div class="accordion-header" style="padding:0.85rem 1.25rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; gap:10px; min-width:980px;" onclick="this.nextElementSibling.classList.toggle('hidden');">
                        <div style="width:150px; min-width:150px; flex-shrink:0; display:flex; align-items:center; gap:8px;">
                            <h2 style="color:var(--primary); font-size:1.2rem; margin:0; white-space:nowrap;">
                                ${cls} Sınıfı
                            </h2>
                            <span style="background:var(--secondary); color:#fff; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.75rem; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; height:24px;">
                                <i class="fa-solid fa-users"></i> ${count}
                            </span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-end;">
                            <button class="btn btn-secondary btn-sm" style="height:38px; width:125px; min-width:125px; flex-shrink:0; padding:0 0.5rem; font-size:0.85rem; font-weight:600; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; gap:5px; box-sizing:border-box; white-space:nowrap;" onclick="event.stopPropagation(); window.assignSubjectsToClass('${cls}')">
                                <i class="fa-solid fa-book"></i> Ders Tanımla
                            </button>
                            <button class="btn btn-secondary btn-sm" style="height:38px; width:125px; min-width:125px; flex-shrink:0; padding:0 0.5rem; font-size:0.85rem; font-weight:600; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; gap:5px; box-sizing:border-box; white-space:nowrap;" onclick="event.stopPropagation(); window.assignFieldToClass('${cls}')">
                                <i class="fa-solid fa-layer-group"></i> Alan Tanımla
                            </button>
                            <select class="form-control" style="height:38px; width:170px; min-width:170px; flex-shrink:0; padding:0 0.5rem; font-size:0.85rem; font-weight:600; border:2px solid #10b981; border-radius:8px; background-color:#f0fdf4; color:#065f46; cursor:pointer; box-sizing:border-box; display:inline-flex; align-items:center; margin:0;" onchange="window.assignClassTeacher('${cls}', this.value)" onclick="event.stopPropagation();" title="Sınıf Öğretmeni Ata">
                                <option value="">👩‍🏫 Sınıf Öğrt.</option>
                                ${Object.entries(allTeachers).filter(([uname, t]) => {
                                    if (!t.name || !t.name.trim()) return false;
                                    const tName = DataManager.formatTeacherName(t.name);
                                    if (!tName || !tName.trim()) return false;
                                    const currentAssigned = DataManager.getSanitizedClassTeacherMapping(cls);
                                    if (tName === currentAssigned) return true;
                                    return !assignedTeachers.includes(tName);
                                }).sort((a, b) => DataManager.formatTeacherName(a[1].name).localeCompare(DataManager.formatTeacherName(b[1].name), 'tr')).map(([uname, t]) => {
                                    const tName = DataManager.formatTeacherName(t.name);
                                    const currentAssigned = DataManager.getSanitizedClassTeacherMapping(cls);
                                    return '<option value="' + tName + '" ' + (currentAssigned === tName ? 'selected' : '') + '>' + tName + '</option>';
                                }).join('')}
                            </select>
                            <select class="form-control" style="height:38px; width:85px; min-width:85px; flex-shrink:0; padding:0 0.4rem; font-size:0.85rem; font-weight:600; border:1px solid #cbd5e1; border-radius:8px; background-color:white; color:var(--primary); cursor:pointer; box-sizing:border-box; display:inline-flex; align-items:center; margin:0;" onchange="window.assignRoomToClass('${cls}', this.value)" onclick="event.stopPropagation();">
                                <option value="">Derslik</option>
                                ${classrooms.filter(room => room.name === assignedRoom || !assignedRoomNames.includes(room.name)).map(room => `<option value="${room.name}" ${assignedRoom === room.name ? 'selected' : ''}>${room.name}</option>`).join('')}
                            </select>
                            <button class="btn btn-secondary btn-sm" style="height:38px; width:110px; min-width:110px; flex-shrink:0; padding:0 0.5rem; font-size:0.85rem; font-weight:600; border-radius:8px; background-color:var(--primary); color:white; border:none; display:inline-flex; align-items:center; justify-content:center; gap:5px; box-sizing:border-box; white-space:nowrap;" onclick="event.stopPropagation(); window.assignDeviceToClass('${cls}')">
                                <i class="fa-solid fa-tablet-screen-button"></i> Cihaz Ata
                            </button>
                            <span data-device-class="${cls}" onclick="event.stopPropagation(); window.editDeviceMapping('${cls}')" oncontextmenu="window.selectDeviceForSwap('${cls}', event)" ontouchstart="window.deviceTouchTimer = setTimeout(() => window.selectDeviceForSwap('${cls}', null), 800)" ontouchend="clearTimeout(window.deviceTouchTimer)" ontouchmove="clearTimeout(window.deviceTouchTimer)" style="height:38px; width:140px; min-width:140px; flex-shrink:0; padding:0 8px; border-radius:8px; border:1px solid ${DataManager.getSanitizedClassDeviceMapping(cls) ? '#cbd5e1' : '#e2e8f0'}; background:${DataManager.getSanitizedClassDeviceMapping(cls) ? '#f8fafc' : 'transparent'}; font-size:0.82rem; color:var(--primary); white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; gap:5px; box-sizing:border-box; cursor:pointer;" title="${DataManager.getSanitizedClassDeviceMapping(cls) ? 'Değiştirmek için tıklayın, takas için sağ tıklayın veya basılı tutun' : 'Cihaz atamak için tıklayın veya sağ tık ile takas yapın'}">${DataManager.getSanitizedClassDeviceMapping(cls) ? '<i class="fa-solid fa-mobile-screen-button"></i>' + DataManager.getSanitizedClassDeviceMapping(cls) : ''}</span>

                            <button class="btn btn-danger btn-sm" style="height:38px; width:38px; min-width:38px; flex-shrink:0; padding:0; font-size:0.95rem; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; margin-left:2px;" onclick="event.stopPropagation(); window.deleteClassCompletely('${cls}')" title="Sınıfı Sil">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="accordion-body hidden" style="background:var(--glass-bg); padding:1.5rem; border-top:1px solid rgba(255,255,255,0.1);">
                        <div class="table-responsive">
                            <table style="width:100%; border-collapse:collapse; text-align:left;">
                                <thead>
                                    <tr style="border-bottom:2px solid var(--primary); color:var(--text);">
                                        <th style="padding:0.75rem 0.5rem;">Öğrenci No</th>
                                        <th style="padding:0.75rem 0.5rem;">Adı Soyadı</th>
                                        <th style="padding:0.75rem 0.5rem;">Alanı</th>
                                        <th style="padding:0.75rem 0.5rem;">Öğrenci Kodu</th>
                                        <th style="padding:0.75rem 0.5rem;">Dersler</th>
                                        <th style="padding:0.75rem 0.5rem; text-align:right;">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            clsStudents.forEach(std => {
                html += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:0.75rem 0.5rem; font-weight:bold;">${std.no}</td>
                        <td style="padding:0.75rem 0.5rem; display:flex; align-items:center; gap:5px;">
                            ${std.name}
                            ${(std.ogrenciKodu || "").split(/[,\s]+/).map(k => k.trim().toUpperCase()).includes('C') ? '<span class="condition-marker type-c" data-tooltip="Dikkat Edilmesi Gerekir">C</span>' : ''}
                            ${(std.ogrenciKodu || "").split(/[,\s]+/).map(k => k.trim().toUpperCase()).includes('H') ? '<span class="condition-marker type-h" data-tooltip="Sağlık Sorunu Var">H</span>' : ''}
                        </td>
                        <td style="padding:0.75rem 0.5rem;"><span style="font-size:0.85rem; background:rgba(255,255,255,0.1); padding:0.2rem 0.5rem; border-radius:4px;">${std.alan || '-'}</span></td>
                        <td style="padding:0.75rem 0.5rem;">${std.ogrenciKodu || '-'}</td>
                        <td style="padding:0.75rem 0.5rem; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${(std.dersler || []).join(', ')}">${(std.dersler || []).join(', ') || '-'}</td>
                        <td style="padding:0.75rem 0.5rem; text-align:right;">
                            <button class="btn btn-secondary btn-sm" title="Düzenle" onclick="window.editStudentDetails('${std.no}')"><i class="fa-solid fa-pen"></i></button>
                        </td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            const assignedTeacher = DataManager.getSanitizedClassTeacherMapping(cls) || '';

            widgetHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 0; border-bottom:1px solid #f1f5f9;">
                    <div style="display:flex; flex-direction:column;">
                        <strong>${cls}</strong>
                        <span style="font-size:0.75rem; color:var(--gray-500);">${count} Öğrenci</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.85rem; color:#059669; font-weight:600;">${assignedTeacher}</span>
                    </div>
                </div>
            `;
        });



        html += '</div>';

        container.innerHTML = html;
        recentWidget.innerHTML = widgetHtml;
    }

    // --- 8. Classroom Management ---
    const btnPreviewClassroom = document.getElementById('btnPreviewClassroom');
    const classroomGrid = document.getElementById('classroomGrid');
    const previewArea = document.getElementById('classroomPreviewArea');
    const previewCapacity = document.getElementById('previewCapacity');
    const btnAutoCreateClassrooms = document.getElementById('btnAutoCreateClassrooms');

    // MOCK-UP FOR EXISTING
    let currentLayout = {
        name: '',
        groupConfigs: [], // will store {rows, cols} per group
        groups: 0,
        disabledSeats: [],
        deskNotes: {}
    };

    if (btnAutoCreateClassrooms) {
        btnAutoCreateClassrooms.addEventListener('click', () => {
            const students = DataManager.getStudents();
            const classesSet = new Set();
            students.forEach(s => classesSet.add(s.class));
            const classesArray = Array.from(classesSet);

            if (classesArray.length === 0) {
                Swal.fire('Hata', 'Kayıtlı hiçbir sınıf bulunamadı. Önce öğrenci ekleyin.', 'warning');
                return;
            }

            Swal.fire({
                title: 'Otomatik Oluştur',
                text: `${classesArray.length} adet sınıf için varsayılan düzende (3 Grup, 2x5) derslik oluşturulacak. Onaylıyor musunuz?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Evet, Oluştur',
                cancelButtonText: 'İptal'
            }).then((result) => {
                if (result.isConfirmed) {
                    let count = 0;
                    classesArray.forEach(cls => {
                        // avoid overwriting existing
                        const existing = DataManager.getClassrooms().find(r => r.name === cls);
                        if (!existing) {
                            DataManager.addClassroom({
                                name: cls,
                                groups: 3,
                                groupConfigs: [
                                    { cols: 2, rows: 5 },
                                    { cols: 2, rows: 5 },
                                    { cols: 2, rows: 5 }
                                ],
                                disabledSeats: [],
                                deskNotes: {}
                            });
                            count++;
                        }
                    });

                    updateClassroomsList();
                    updateDashboardStats();
                    Swal.fire('Başarılı', `${count} adet derslik otomatik oluşturuldu.`, 'success');
                }
            });
        });
    }

    const teacherDeskPosSelect = document.getElementById('teacherDeskPos');
    if (teacherDeskPosSelect) {
        teacherDeskPosSelect.addEventListener('change', (e) => {
            if (currentLayout.name) {
                currentLayout.teacherDeskPos = e.target.value;
                renderClassroomPreview();
            }
        });
    }

    if (btnPreviewClassroom) {
        btnPreviewClassroom.addEventListener('click', () => {
            const name = document.getElementById('className').value.trim();
            const groups = parseInt(document.getElementById('classGroups').value);
            const teacherDeskPos = document.getElementById('teacherDeskPos').value || 'right';

            if (!name || groups < 1) {
                Swal.fire('Hata', 'Lütfen derslik adı ve grup sayısını girin.', 'error');
                return;
            }

            // Gather group configs
            const groupConfigs = [];
            for (let i = 1; i <= groups; i++) {
                const r = parseInt(document.getElementById(`g${i}_rows`).value);
                const c = parseInt(document.getElementById(`g${i}_cols`).value);
                if (r < 1 || c < 1) {
                    Swal.fire('Hata', `${i}. Grup için geçerli satır ve sütun giriniz.`, 'error');
                    return;
                }
                groupConfigs.push({ rows: r, cols: c });
            }

            // only reset if changing the target classroom name
            if (currentLayout.name !== name) {
                const existing = DataManager.getClassrooms().find(r => r.name === name);
                if (existing) {
                    currentLayout.disabledSeats = [...existing.disabledSeats];
                    currentLayout.deskNotes = existing.deskNotes ? { ...existing.deskNotes } : {};
                } else {
                    currentLayout.disabledSeats = [];
                    currentLayout.deskNotes = {};
                }
            }
            currentLayout.name = name;
            currentLayout.groups = groups;
            currentLayout.groupConfigs = groupConfigs;
            currentLayout.teacherDeskPos = document.getElementById('teacherDeskPos').value || 'right';

            renderClassroomPreview();
            previewArea.classList.remove('hidden');
        });
    }

    // Dynamic Groups Input Generation
    const classGroupsInput = document.getElementById('classGroups');
    const dynamicGroupsArea = document.getElementById('dynamicGroupsArea');
    const classTemplateSelect = document.getElementById('classTemplateSelect');

    function renderDynamicGroupInputs(groupCount, configs = null) {
        if (!dynamicGroupsArea) return;
        dynamicGroupsArea.innerHTML = '';

        let html = '<h3 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--gray-600);">Grup Boyutları</h3><div style="display: flex; gap: 1rem; flex-wrap: wrap;">';

        for (let i = 1; i <= groupCount; i++) {
            const r = configs && configs[i - 1] ? configs[i - 1].rows : 5;
            const c = configs && configs[i - 1] ? configs[i - 1].cols : 2;

            html += `
                <div class="group-config box glass-panel" style="padding: 1rem; flex: 1; min-width: 150px;">
                    <h4 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--primary);">Grup ${i}</h4>
                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.8rem;">Sütun (Genişlik)</label>
                        <input type="number" id="g${i}_cols" min="1" max="10" value="${c}" style="width: 100%; padding: 0.25rem;">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem;">Satır (Derinlik)</label>
                        <input type="number" id="g${i}_rows" min="1" max="20" value="${r}" style="width: 100%; padding: 0.25rem;">
                    </div>
                </div>
            `;
        }
        html += '</div>';
        dynamicGroupsArea.innerHTML = html;
    }

    if (classGroupsInput) {
        classGroupsInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (val > 0) renderDynamicGroupInputs(val);
        });
        // initial render
        renderDynamicGroupInputs(parseInt(classGroupsInput.value));
    }

    if (classTemplateSelect) {
        classTemplateSelect.addEventListener('change', (e) => {
            const tplName = e.target.value;
            if (!tplName) return;

            const room = DataManager.getClassrooms().find(r => r.name === tplName);
            if (room) {
                classGroupsInput.value = room.groups;
                if (document.getElementById('teacherDeskPos')) {
                    document.getElementById('teacherDeskPos').value = room.teacherDeskPos || 'right';
                }
                renderDynamicGroupInputs(room.groups, room.groupConfigs || Array(room.groups).fill({ rows: room.rows || 5, cols: room.cols || 2 }));
                // We will also apply disabledSeats and notes on preview
                currentLayout.disabledSeats = [...(room.disabledSeats || [])];
                currentLayout.deskNotes = room.deskNotes ? { ...room.deskNotes } : {};
            }
        });
    }

    function renderClassroomPreview() {
        classroomGrid.innerHTML = '';
        let totalSeats = 0;

        currentLayout.groupConfigs.forEach(conf => {
            totalSeats += (conf.rows * conf.cols);
        });

        let activeCapacity = totalSeats;

        // Render Groups
        const groupsContainer = document.createElement('div');
        groupsContainer.style.display = 'flex';
        groupsContainer.style.justifyContent = 'center';
        groupsContainer.style.gap = '2rem';
        groupsContainer.style.width = '100%';

        let globalCounter = 1;

        // Pre-compute numbering map to assign ID starting from bottom-left (highest r, lowest c)
        // moving right (highest r, highest c), then up (r-1, lowest c)
        const seatMap = {};
        for (let g = 1; g <= currentLayout.groups; g++) {
            const conf = currentLayout.groupConfigs[g - 1];
            for (let r = conf.rows; r >= 1; r--) {
                for (let c = 1; c <= conf.cols; c++) {
                    const seatId = `G${g}-S${r}-C${c}`;
                    seatMap[seatId] = globalCounter++;
                }
            }
        }

        for (let g = 1; g <= currentLayout.groups; g++) {
            const conf = currentLayout.groupConfigs[g - 1];
            const groupEl = document.createElement('div');
            groupEl.className = 'desk-group';
            // CSS grid dynamically setup based on cols for THIS group
            groupEl.style.gridTemplateColumns = `repeat(${conf.cols}, 1fr)`;

            // Render top-down so visually the highest r is at the bottom of the grid
            for (let r = 1; r <= conf.rows; r++) {
                for (let c = 1; c <= conf.cols; c++) {
                    const seatId = `G${g}-S${r}-C${c}`;
                    const desk = document.createElement('div');
                    desk.className = 'desk';
                    desk.title = `Grup ${g}, Satır ${r}, Sütun ${c}`;

                    const seatNum = seatMap[seatId];
                    const isDisabled = currentLayout.disabledSeats.includes(seatId);

                    let seatNumberDisplay = '';
                    if (!isDisabled) {
                        seatNumberDisplay = seatNum;
                    } else {
                        seatNumberDisplay = `<span style="position:relative; z-index:0;"><span style="text-decoration:line-through; color:var(--danger); font-weight:bold; font-size:1.2rem;">${seatNum}</span></span>`;
                    }

                    // Update innerHTML to use assigned seat number
                    const note = currentLayout.deskNotes[seatId];
                    if (note) {
                        desk.innerHTML = `<i class="fa-solid fa-note-sticky" style="color:var(--warning); position:absolute; top:2px; right:2px; font-size:0.7rem;" title="${note}"></i><span style="font-size:1.2rem">${seatNumberDisplay}</span>`;
                    } else {
                        desk.innerHTML = `<span style="font-size:1.2rem">${seatNumberDisplay}</span>`;
                    }

                    desk.style.direction = 'ltr'; // Ensure text remains readable

                    if (isDisabled) {
                        desk.classList.add('disabled');
                        activeCapacity--;
                    }

                    desk.addEventListener('click', () => {
                        const currentlyDisabled = currentLayout.disabledSeats.includes(seatId);
                        if (currentlyDisabled) {
                            currentLayout.disabledSeats = currentLayout.disabledSeats.filter(id => id !== seatId);
                            // Recalculate capacity to prevent drift
                            renderClassroomPreview();
                        } else {
                            currentLayout.disabledSeats.push(seatId);
                            renderClassroomPreview();
                        }
                    });

                    groupEl.appendChild(desk);
                }
            }
            groupsContainer.appendChild(groupEl);
        }
        classroomGrid.appendChild(groupsContainer);

        // Add Whiteboard & Teacher Desk Representation AT THE BOTTOM
        const frontArea = document.createElement('div');
        frontArea.style.width = '100%';
        frontArea.style.display = 'flex';
        frontArea.style.justifyContent = 'space-between';
        frontArea.style.alignItems = 'center';
        frontArea.style.padding = '0 1rem';

        let deskHtml = `<div style="width:100px; height:60px; background:#e2e8f0; border:2px solid #cbd5e1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--gray-600); box-shadow:0 4px 6px rgba(0,0,0,0.05);">Öğretmen</div>`;
        let boardHtml = `<div style="flex:1; max-width:60%; height:40px; background:#1e293b; border:4px solid #94a3b8; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; letter-spacing:2px; margin:0 auto; box-shadow:0 4px 6px rgba(0,0,0,0.1);">Y A Z I   T A H T A S I</div>`;
        let emptySpace = `<div style="width:100px;"></div>`;

        if (currentLayout.teacherDeskPos === 'left') {
            frontArea.innerHTML = deskHtml + boardHtml + emptySpace;
        } else {
            frontArea.innerHTML = emptySpace + boardHtml + deskHtml;
        }

        // Visually the "front" is appended last to appear at the bottom
        classroomGrid.appendChild(frontArea);

        previewCapacity.textContent = activeCapacity;
    }

    document.getElementById('btnSaveClassroom').addEventListener('click', () => {
        // deep copy
        const saveObj = {
            name: currentLayout.name,
            groups: currentLayout.groups,
            groupConfigs: JSON.parse(JSON.stringify(currentLayout.groupConfigs)),
            teacherDeskPos: currentLayout.teacherDeskPos || 'right',
            disabledSeats: [...currentLayout.disabledSeats],
            deskNotes: { ...currentLayout.deskNotes }
        };

        DataManager.addClassroom(saveObj);

        Swal.fire('Başarılı', `${currentLayout.name} dersliği kaydedildi. (${previewCapacity.textContent} kapasite)`, 'success');

        // Reset form
        document.getElementById('className').value = '';
        document.getElementById('classTemplateSelect').value = '';
        previewArea.classList.add('hidden');

        updateClassroomsList();
        updateDashboardStats();
    });

    // Accordion Based Classroom Listing
    window.updateClassroomsList = function () {
        const rooms = DataManager.getClassrooms();
        const container = document.getElementById('savedClassroomsList');
        const widgetContainer = document.getElementById('readyClassroomsList');
        const templateSelect = document.getElementById('classTemplateSelect');

        let openIdx = -1;
        if (container) {
            const accs = container.querySelectorAll('.accordion-body');
            accs.forEach((acc, i) => { if (!acc.classList.contains('hidden')) openIdx = i; });
        }

        // Update template select
        if (templateSelect) {
            templateSelect.innerHTML = '<option value="">-- Şablon Yok --</option>';
            rooms.forEach(room => {
                templateSelect.innerHTML += `<option value="${room.name}">${room.name}</option>`;
            });
        }

        if (!container) return; // not rendered

        if (rooms.length === 0) {
            container.innerHTML = `<p class="empty-text">Henüz derslik tanımlanmamış.</p>`;
            if (widgetContainer) widgetContainer.innerHTML = `<p class="empty-text">Henüz derslik tanımlanmamış.</p>`;
            return;
        }

        let html = '<div class="accordion-container" style="display:flex; flex-direction:column; gap:1rem;">';
        let widgetHtml = '';

        rooms.forEach((room, index) => {
            const deskPos = room.teacherDeskPos || 'right';
            const confs = room.groupConfigs || Array(room.groups).fill({ rows: room.rows || 0, cols: room.cols || 0 });
            let totalCapacity = 0;

            const groupHtml = confs.map((g, gi) => {
                const groupDisabledStr = room.disabledSeats ? room.disabledSeats.filter(id => id.startsWith(`G${gi + 1}-`)).length : 0;
                const groupCapacity = (g.rows * g.cols) - groupDisabledStr;
                totalCapacity += groupCapacity;
                return `${g.rows}x${g.cols}`;
            }).join(' | ');

            html += `
                <div class="accordion-item glass-panel" style="border-radius:10px; overflow:hidden;">
                    <div class="accordion-header" style="padding:1.5rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.classList.toggle('hidden');">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <h3 style="color:var(--primary); font-size:1.2rem; margin:0;">${room.name}</h3>
                            <select class="desk-pos-select" data-room="${room.name}" onclick="event.stopPropagation()" style="padding:0.3rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.8rem; background:white;">
                                <option value="left" ${deskPos === 'left' ? 'selected' : ''}>Masa Solda</option>
                                <option value="right" ${deskPos === 'right' ? 'selected' : ''}>Masa Sağda</option>
                            </select>
                            <button class="btn btn-secondary btn-sm" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="event.stopPropagation(); window.editClassroom('${room.name}')"><i class="fa-solid fa-pen"></i> Forma Al</button>
                            <button class="btn btn-secondary btn-sm" style="color:var(--danger); padding:0.3rem 0.6rem; font-size:0.8rem; border-color:var(--danger);" onclick="event.stopPropagation(); window.deleteClassroom('${room.name}')"><i class="fa-solid fa-trash"></i> Sil</button>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <span style="background:var(--primary); color:white; padding:0.25rem 0.75rem; border-radius:1rem; font-size:0.85rem;"><i class="fa-solid fa-layer-group"></i> ${room.groups} Grup (${groupHtml})</span>
                            <span style="background:var(--secondary); color:#fff; padding:0.25rem 0.75rem; border-radius:1rem; font-size:0.85rem;"><i class="fa-solid fa-chair"></i> ${totalCapacity} Kapasite</span>
                        </div>
                    </div>
                    
                    <div class="accordion-body hidden" style="background:var(--glass-bg); padding:2rem; border-top:1px solid rgba(255,255,255,0.1);">
            `;
            html += `<div style="display:flex; justify-content:center; gap:2rem; width:100%; overflow-x:auto; padding-bottom:1rem;">`;

            // Pre-compute numbering map to assign ID starting from bottom-left
            let globalCounter = 1;
            const seatMap = {};
            for (let g = 1; g <= room.groups; g++) {
                const config = confs[g - 1];
                for (let r = config.rows; r >= 1; r--) {
                    for (let c = 1; c <= config.cols; c++) {
                        const seatId = `G${g}-S${r}-C${c}`;
                        seatMap[seatId] = globalCounter++;
                    }
                }
            }

            for (let g = 1; g <= room.groups; g++) {
                const config = confs[g - 1];
                html += `<div class="desk-group" style="display:grid; grid-template-columns:repeat(${config.cols}, 1fr); gap:0.5rem; background:rgba(255,255,255,0.4); padding:1rem; border-radius:8px; border:2px dashed #cbd5e1; direction:ltr;">`;

                // Render top-down visually
                for (let r = 1; r <= config.rows; r++) {
                    for (let c = 1; c <= config.cols; c++) {
                        const seatId = `G${g}-S${r}-C${c}`;
                        const seatNum = seatMap[seatId];
                        if (room.disabledSeats && room.disabledSeats.includes(seatId)) {
                            html += `<div class="seat-toggle-btn" data-room="${room.name}" data-seat="${seatId}" style="width:40px; height:40px; background:#fee2e2; border:2px solid var(--danger); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1rem; color:var(--danger); opacity:0.6; cursor:pointer;" title="Açmak İçin Tıkla: ${seatId}"><span style="pointer-events:none; text-decoration:line-through; font-weight:bold;">${seatNum}</span></div>`;
                        } else {
                            html += `<div class="seat-toggle-btn" data-room="${room.name}" data-seat="${seatId}" style="width:40px; height:40px; background:white; border:2px solid var(--primary); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1rem; color:var(--primary); font-weight:bold; cursor:pointer;" title="Kapatmak İçin Tıkla: ${seatId}">${seatNum}</div>`;
                        }
                    }
                }
                html += `</div>`; // End desk-group
            }

            html += `</div>`; // End groups container

            // Append Whiteboard & Desk AFTER groups
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2rem; padding:0 1rem; width:100%;">
            `;
            let deskHtmlBox = `<div style="width:100px; height:60px; background:#e2e8f0; border:2px solid #cbd5e1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--gray-600); box-shadow:0 4px 6px rgba(0,0,0,0.05);">Öğretmen</div>`;
            let boardHtmlBox = `<div style="flex:1; max-width:60%; height:40px; background:#1e293b; border:4px solid #94a3b8; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; letter-spacing:2px; margin:0 auto; box-shadow:0 4px 6px rgba(0,0,0,0.1);">Y A Z I   T A H T A S I</div>`;
            let emptySpaceBox = `<div style="width:100px;"></div>`;

            if (deskPos === 'left') {
                html += deskHtmlBox + boardHtmlBox + emptySpaceBox;
            } else {
                html += emptySpaceBox + boardHtmlBox + deskHtmlBox;
            }
            html += `</div>`; // End Front Area

            html += `</div></div>`; // End accordion-body and accordion-item

            widgetHtml += `
            <div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid #f1f5f9;">
                <strong>${room.name}</strong>
                <span style="color:var(--secondary); font-weight:bold;">${totalCapacity}</span>
            </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        if (openIdx !== -1) {
            const newAccs = container.querySelectorAll('.accordion-body');
            if (newAccs[openIdx]) newAccs[openIdx].classList.remove('hidden');
        }

        if (widgetContainer) widgetContainer.innerHTML = widgetHtml;

        // Add delete listeners
        document.querySelectorAll('.delete-room').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.currentTarget.getAttribute('data-name');
                Swal.fire({
                    title: 'Emin misiniz?',
                    text: `${name} dersliği silinecek!`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Sil!',
                    cancelButtonText: 'İptal'
                }).then((result) => {
                    if (result.isConfirmed) {
                        DataManager.removeClassroom(name);
                        updateClassroomsList();
                        updateDashboardStats();
                    }
                });
            });
        });
    }

    window.editClassroom = function (name) {
        const room = DataManager.getClassrooms().find(r => r.name === name);
        if (!room) return;
        document.getElementById('className').value = room.name;
        document.getElementById('classTemplateSelect').value = '';
        document.getElementById('classGroups').value = room.groups;

        if (document.getElementById('teacherDeskPos')) {
            document.getElementById('teacherDeskPos').value = room.teacherDeskPos || 'right';
        }

        renderDynamicGroupInputs(room.groups, room.groupConfigs);

        currentLayout.name = room.name;
        currentLayout.groups = room.groups;
        currentLayout.groupConfigs = JSON.parse(JSON.stringify(room.groupConfigs));
        currentLayout.teacherDeskPos = room.teacherDeskPos || 'right';
        currentLayout.disabledSeats = [...(room.disabledSeats || [])];
        currentLayout.deskNotes = room.deskNotes ? { ...room.deskNotes } : {};

        previewArea.classList.remove('hidden');
        renderClassroomPreview();
        // Scroll to form
        document.querySelector('.settings-card').scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteClassroom = function (name) {
        Swal.fire({
            title: 'Emin misiniz?',
            text: `${name} dersliği silinecek!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, Sil!',
            cancelButtonText: 'İptal'
        }).then((result) => {
            if (result.isConfirmed) {
                DataManager.removeClassroom(name);
                updateClassroomsList();
                updateDashboardStats();
            }
        });
    };

    // --- 9. Exam Distribution UI ---
    const btnStartDistribution = document.getElementById('btnStartDistribution');
    const examSetupPanel = document.getElementById('examSetupPanel');
    const examResultsPanel = document.getElementById('examResultsPanel');
    const examClassroomsView = document.getElementById('examClassroomsView');
    const examPreflightStats = document.getElementById('examPreflightStats');

    // Update Preflight Stats when entering view
    document.querySelector('[data-target="view-exam"]').addEventListener('click', () => {
        const stats = DataManager.getStats();
        if (examPreflightStats) {
            examPreflightStats.innerHTML = `
                <div class="stat-card glass-panel" style="padding:1.5rem;">
                    <h3>Dağıtılacak Toplam Öğrenci</h3><h2 style="color:var(--primary); font-size:2.5rem;">${stats.totalStudents}</h2>
                </div>
                <div class="stat-card glass-panel" style="padding:1.5rem;">
                    <h3>Sınav Merkezi Toplam Kapasite</h3><h2 style="color:var(--secondary); font-size:2.5rem;">${stats.totalCapacity}</h2>
                </div>
            `;
        }
    });

    /**
     * distributeWithRetry — Akıllı Tekrarlı Dağıtım
     * Her tur en fazla ROUND_SIZE deneme yapar. Sonra kullanıcıya sorar.
     * "Durdur" butonu ile herhangi bir anda en iyi sonuç gösterilir.
     */
    async function distributeWithRetry(students, classrooms, sessionData, onFinish) {
        const ROUND_SIZE = 30; // Her turda kaç deneme yapılacak
        const YIELD_EVERY = 5; // Kaç denemede bir UI'ya nefes verileceği
        let bestResult = null;
        let bestScore = Infinity;
        let totalAttempts = 0;
        let cancelled = false;

        const sleep = () => new Promise(r => setTimeout(r, 0));

        const runRound = async () => {
            for (let i = 0; i < ROUND_SIZE && !cancelled; i++) {
                if (i > 0 && i % YIELD_EVERY === 0) {
                    // UI'ya nefes ver ve progress güncelle
                    const el = document.getElementById('retry-progress');
                    if (el) el.innerHTML =
                        `<b>${totalAttempts}</b>. deneme &nbsp;|&nbsp; En iyi: <b>${bestScore === Infinity ? '—' : bestScore}</b> çakışma`;
                    await sleep();
                    if (cancelled) break;
                }
                try {
                    const result = ExamAlgorithm.distribute([...students], classrooms, sessionData);
                    const score = ExamAlgorithm.countVerticalCollisions(result);
                    totalAttempts++;
                    if (score < bestScore) { bestScore = score; bestResult = result; }
                    if (score === 0) { cancelled = true; break; } // Mükemmel!
                } catch (e) {
                    totalAttempts++;
                    console.warn('distribute hata:', e);
                }
            }
        };

        // İlk turu çalıştır
        Swal.fire({
            title: 'Optimum Dağıtım Aranıyor...',
            html: `<div id="retry-progress">İlk deneme...</div>
                   <button id="btn-stop-retry" class="swal2-cancel swal2-styled" style="margin-top:12px; background:#6c757d;">
                     Durdur (En iyiyi Göster)
                   </button>`,
            allowOutsideClick: false,
            showConfirmButton: false,
            showCancelButton: false,
            didOpen: () => {
                Swal.showLoading();
                document.getElementById('btn-stop-retry')?.addEventListener('click', () => {
                    cancelled = true;
                });
            }
        });

        await runRound();

        // Mükemmel bulunduysa veya iptal edildiyse bitir
        if (bestScore === 0 || cancelled) {
            Swal.close();
            onFinish(bestResult, totalAttempts, bestScore);
            return bestResult;
        }

        // Devam sorusu döngüsü
        while (bestScore > 0) {
            Swal.close();
            const { isConfirmed } = await Swal.fire({
                title: `${bestScore} Dikey Çakışma Kaldı`,
                html: `<b>${totalAttempts}</b> denemede en iyi: <b>${bestScore}</b> arka arkaya çift.<br><br>30 deneme daha yapılsın mı?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Evet, devam et',
                cancelButtonText: 'Hayır, en iyisini göster'
            });
            if (!isConfirmed) break;

            cancelled = false;
            Swal.fire({
                title: 'Optimum Dağıtım Aranıyor...',
                html: `<div id="retry-progress">${totalAttempts + 1}. deneme başlıyor...</div>
                       <button id="btn-stop-retry" class="swal2-cancel swal2-styled" style="margin-top:12px; background:#6c757d;">
                         Durdur (En iyiyi Göster)
                       </button>`,
                allowOutsideClick: false, showConfirmButton: false, showCancelButton: false,
                didOpen: () => {
                    Swal.showLoading();
                    document.getElementById('btn-stop-retry')?.addEventListener('click', () => { cancelled = true; });
                }
            });

            await runRound();
            if (bestScore === 0 || cancelled) break;
        }

        Swal.close();
        onFinish(bestResult, totalAttempts, bestScore);
        return bestResult;
    }

    if (btnStartDistribution) {
        btnStartDistribution.addEventListener('click', () => {
            const students = DataManager.getStudents();
            const classrooms = DataManager.getClassrooms();

            if (students.length === 0 || classrooms.length === 0) {
                Swal.fire('Eksik Bilgi', 'Dağıtım için en az bir öğrenci ve derslik tanımlı olmalıdır.', 'warning');
                return;
            }

            try {
                // Smart Retry Distribution — onFinish callback handles render
                distributeWithRetry([...students], classrooms, {}, (r) => {
                    window._currentExamResults = r;
                    examSetupPanel.classList.add('hidden');
                    examResultsPanel.classList.remove('hidden');
                    renderExamResults(r);
                    Swal.fire('Tamamlandı', 'Öğrenciler başarıyla dersliklere dağıtıldı.', 'success');
                });
            } catch (err) {
                Swal.fire('Hata Oluştu', err.message, 'error');
            }
        });
    }

    window.toggleNestedAccordion = function (id) {
        const el = document.getElementById(id);
        const icon = document.getElementById(`icon-${id}`);
        if (el) {
            const isHidden = el.classList.contains('hidden');
            if (isHidden) {
                el.classList.remove('hidden');
                if (icon) icon.className = 'fa-solid fa-chevron-down';
            } else {
                el.classList.add('hidden');
                if (icon) icon.className = 'fa-solid fa-chevron-right';
            }
        }
    };

    function renderExamResults(session, targetContainer = null, appendMode = false) {
        const results = session.results;
        const view = targetContainer || examClassroomsView;
        const openRoomIds = Array.from(view.querySelectorAll('.nested-accordion-body:not(.hidden)')).map(el => el.id);
        
        if (!appendMode) view.innerHTML = '';

        results.forEach((room, idx) => {
            const roomId = `nested-room-schema-${session.id}-${idx}`;
            const roomEl = document.createElement('div');
            roomEl.className = 'exam-room-result';
            roomEl.style.marginBottom = '2.5rem';

            // Calculate Visual Sequence Numbers (Rule: Bottom-Left = 1)
            let roomSeatCounterMaster = 1;
            const seatToNumRoom = {};
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(room.disabledSeats && room.disabledSeats.includes(sid))) {
                            seatToNumRoom[sid] = roomSeatCounterMaster++;
                        }
                    }
                }
            }

            let groupsHtml = '<div style="display:flex; gap:40px; justify-content:center; flex-wrap:wrap; margin-bottom: 2rem; direction: ltr;">';
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                groupsHtml += `<div class="desk-group" style="display:grid; grid-template-columns: repeat(${conf.cols}, 1fr); gap:6px; background:rgba(248,250,252,0.5); padding:10px; border:1px dashed #cbd5e1; border-radius:12px;">`;
                for (let r = conf.rows; r >= 1; r--) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const seatId = `G${g}-S${r}-C${c}`;
                        const student = room.seats[seatId];
                        const isDisabled = room.disabledSeats && room.disabledSeats.includes(seatId);

                        if (isDisabled) {
                            groupsHtml += `<div class="desk disabled" style="width:95px; height:80px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; color:#94a3b8; border-radius:8px; font-size:0.75rem; border:2px dotted #cbd5e1; opacity:0.4;">KAPALI</div>`;
                        } else {
                            const curNum = seatToNumRoom[seatId] || '-';
                            if (student) {
                                const sub = student._matchedSubject || '-';
                                let bg = 'background:white;';
                                let border = 'border:2px solid var(--primary);';
                                const neighbors = [{ dr: 0, dc: -1 }, { dr: 0, dc: 1 }, { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }, { dr: -1, dc: 0, v: 1 }, { dr: 1, dc: 0, v: 1 }];
                                let hs = false, hv = false;
                                neighbors.forEach(n => {
                                    const nid = `G${g}-S${r + n.dr}-C${c + n.dc}`;
                                    const nstd = room.seats[nid];
                                    if (nstd && (nstd._matchedSubject || '-') === sub) { if (n.v) hv = true; else hs = true; }
                                });
                                if (hs) { bg = 'background:#fee2e2;'; border = 'border:2px solid #ef4444;'; }
                                else if (hv) { bg = 'background:#fef9c3;'; border = 'border:2px solid #eab308;'; }

                                groupsHtml += `<div class="desk" style="width:95px; height:80px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center; ${bg} ${border} border-radius:8px; padding:6px; position:relative; box-shadow:0 3px 5px rgba(0,0,0,0.06); cursor:pointer; overflow:visible;"
                                    onclick="examDeskClick(event, ${idx}, '${seatId}')" oncontextmenu="examDeskRightClick(event, ${idx}, '${seatId}')">
                                    <div style="font-size:0.6rem; color:#64748b; font-weight:700; background:rgba(241,245,249,0.6); padding:1px 4px; border-radius:4px; width:100%; text-align:center; margin-bottom:4px;">${student.class} / ${student.no}</div>
                                    <div style="font-size:0.65rem; font-weight:800; color:#1e293b; text-align:center; line-height:1.1; margin-top:2px; height:32px; display:flex; align-items:center; justify-content:center; overflow:hidden;">${student.name}</div>
                                    <div style="width:22px; height:22px; background:#f8fafc; border:1px solid #cbd5e1; color:#334155; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:900; position:absolute; bottom:0; left:50%; transform:translateX(-50%); z-index:2; box-shadow:0 2px 4px rgba(0,0,0,0.1);">${curNum}</div>
                                </div>`;
                            } else {
                                groupsHtml += `<div class="desk empty" style="width:95px; height:80px; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; border:2px dashed #ef4444; background:#fff5f5; border-radius:8px; cursor:pointer; position:relative; overflow:visible; padding:6px;"
                                    onclick="examDeskClick(event, ${idx}, '${seatId}')">
                                    <div style="font-size:0.6rem; font-weight:900; color:#dc2626; margin-top:10px; letter-spacing:0.5px; text-align:center; line-height:1.2;">BOŞ<br>BIRAKINIZ</div>
                                    <div style="width:22px; height:22px; background:#fee2e2; border:1px solid #fecaca; color:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:900; position:absolute; bottom:0; left:50%; transform:translateX(-50%); z-index:2; box-shadow:0 2px 4px rgba(239,68,68,0.1);">${curNum}</div>
                                </div>`;
                            }
                        }
                    }
                }
                groupsHtml += '</div>';
            }
            groupsHtml += '</div>';

            const teacherDeskHtml = `<div style="width:100px; height:60px; background:#f1f5f9; border:3px solid #64748b; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:bold; color:#1e293b; box-shadow:0 4px 6px rgba(0,0,0,0.1);">MASA</div>`;
            const boardHtml = `<div style="flex:1; max-width:60%; height:40px; background:#0f172a; border:4px solid #475569; border-radius:4px; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; letter-spacing:4px; font-size:0.9rem; box-shadow:0 6px 12px rgba(0,0,0,0.2);">TAHTA</div>`;
            const frontAreaHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px; padding:0 10px; width:100%;">
                ${room.teacherDeskPos === 'left' ? teacherDeskHtml + boardHtml + '<div style="width:100px;"></div>' : '<div style="width:100px;"></div>' + boardHtml + teacherDeskHtml}
            </div>`;

            roomEl.innerHTML = `
                <div class="nested-accordion-header" onclick="toggleNestedAccordion('${roomId}')" style="background:var(--gray-50); padding:1rem; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.1rem;"><i class="fa-solid fa-table-cells" style="color:var(--primary);"></i> ${room.name} Salonu - Oturma Planı</h3>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <i class="fa-solid fa-print" style="color:var(--gray-400); cursor:pointer;" title="Yazdır" onclick="event.stopPropagation(); window.printSessionDistribution('${session.id}', '${room.name}')"></i>
                        <i id="icon-${roomId}" class="fa-solid ${openRoomIds.includes(roomId) ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color:var(--gray-400);"></i>
                    </div>
                </div>
                <div id="${roomId}" class="nested-accordion-body ${openRoomIds.includes(roomId) ? '' : 'hidden'}" style="padding:0.5rem; border:1px solid var(--gray-200); border-top:none; border-bottom-left-radius:8px; border-bottom-right-radius:8px; background:#f8fafc; overflow:hidden;">
                    <div class="schema-scroller" style="width:100%; display:flex; justify-content:center; align-items:center; min-height:400px; overflow-x:auto; padding:20px 0;">
                        <div class="classroom-walls" style="border:4px solid #334155; padding:40px; border-radius:24px; background:white; display:inline-block; transition: transform 0.3s ease; transform-origin:center; box-shadow:0 20px 50px rgba(0,0,0,0.1);">
                            ${groupsHtml}
                            ${frontAreaHtml}
                        </div>
                    </div>
                </div>
            `;
            view.appendChild(roomEl);

            setTimeout(() => {
                const sc = roomEl.querySelector('.schema-scroller');
                const wl = roomEl.querySelector('.classroom-walls');
                if (sc && wl) {
                    const upScale = () => {
                        // Force a temporary visible state to measure accurately if currently hidden
                        const isHidden = !sc.offsetParent;
                        let originalStyle = "";
                        if (isHidden) {
                            originalStyle = wl.style.cssText;
                            wl.style.transition = 'none'; // Disable transition during measurement
                            // We need both the parent and the walls to be block-ish to measure
                            wl.style.display = 'inline-block';
                            wl.style.position = 'absolute';
                            wl.style.visibility = 'hidden';
                            // Special case: if the whole panel is hidden, we might still get 0.
                            // But usually roomEl being in DOM is enough for offsetWidth of inline-block.
                        }

                        const margin = 30;
                        const containerWidth = sc.clientWidth || (view.clientWidth - 40); // Fallback to view width
                        const containerHeight = sc.clientHeight || 500; // Fallback to reasonable height

                        const scaleW = (containerWidth - margin) / (wl.offsetWidth || 1);
                        const scaleH = (containerHeight - margin) / (wl.offsetHeight || 1);

                        // Cap at 1.0 (100%) to prevent over-zooming.
                        const s = Math.min(scaleW, scaleH, 1.0);

                        if (isHidden) {
                            wl.style.cssText = originalStyle;
                        }

                        wl.style.transition = 'none'; // Ensure no animation for initial scale
                        wl.style.transform = `scale(${s})`;
                        // Restore transition after a frame
                        setTimeout(() => { wl.style.transition = ''; }, 50);
                    };
                    upScale();
                    window.addEventListener('resize', upScale);
                }
            }, 100);
        });
    }
    window._renderExamResults = renderExamResults;
    window._distributeWithRetry = distributeWithRetry;


    // Context menu handlers are defined globally below (outside DOMContentLoaded)

    
    // --- 10. Exam Session Wizard Logic --- (MOVED TO ui_modules/ui_exam_management.js)


    // Init Calls (kept here for backward compatibility, primary init is near top)
    updateDashboardStats();
    updateClassesList();
    updateClassroomsList();
    window.renderExamSessionsList();

    // --- 11. Custom Global Class Bulk Assignment Methods ---
    window.assignSubjectsToClass = function (className) {
        const settings = DataManager.getSchoolSettings();
        const students = DataManager.getStudents();

        if (!settings.subjects || settings.subjects.length === 0) {
            Swal.fire('Hata', 'Önce Genel Ayarlar sekmesinden okul derslerini tanımlamalısınız.', 'error');
            return;
        }

        // Find grade for this class
        let gradeMatch = className.match(/\d+/);
        let grade = gradeMatch ? gradeMatch[0] : "";

        // Determine existing subjects in this class & find unique fields (alanlar)
        window._currentSubjectsByField = {};
        window._currentClassSubjects = new Set();
        let uniqueFields = new Set();

        students.forEach(s => {
            if (s.class === className) {
                const f = s.alan && s.alan.trim() !== '' ? s.alan.trim() : '_NOFIELD_';
                if (f !== '_NOFIELD_') uniqueFields.add(f);

                if (!window._currentSubjectsByField[f]) {
                    window._currentSubjectsByField[f] = new Set();
                }

                if (s.dersler) {
                    s.dersler.forEach(d => {
                        settings.subjects.forEach(sub => {
                            let expected = grade ? `${sub} ${grade}` : sub;
                            if (d.trim() === expected) {
                                window._currentSubjectsByField[f].add(sub);
                                window._currentClassSubjects.add(sub);
                            }
                        });
                    });
                }
            }
        });

        // Global updater function for the SweetAlert modal checkboxes
        window.updateSwalSubjects = function () {
            const checkedFields = Array.from(document.querySelectorAll('.swal-field-filter-checkbox:checked')).map(cb => cb.value);
            let activeSubjects = new Set();

            checkedFields.forEach(f => {
                if (window._currentSubjectsByField[f]) {
                    window._currentSubjectsByField[f].forEach(sub => activeSubjects.add(sub));
                }
            });

            document.querySelectorAll('.swal-subject-checkbox').forEach(cb => {
                cb.checked = activeSubjects.has(cb.value);
            });
        };

        let initialChecked = new Set();
        if (uniqueFields.size > 0) {
            uniqueFields.forEach(f => {
                if (window._currentSubjectsByField[f]) {
                    window._currentSubjectsByField[f].forEach(sub => initialChecked.add(sub));
                }
            });
        } else {
            initialChecked = window._currentClassSubjects;
        }

        let html = '<div style="text-align:left; max-height:200px; overflow-y:auto; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:1rem;">';
        html += '<p style="font-size:0.9rem; font-weight:600; margin-top:0; margin-bottom:10px;">Dersleri Seçin:</p>';
        const subjectsToShow = settings.subjects || [];
        subjectsToShow.forEach(sub => {
            let isChecked = initialChecked.has(sub.trim()) ? 'checked' : '';
            html += `<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer;">
    <input type="checkbox" class="swal-subject-checkbox" value="${sub.trim()}" style="width:18px; height:18px; cursor:pointer;" ${isChecked}>
        <span style="font-size:1rem; color:var(--dark);">${sub.trim()}</span>
    </label>`;
        });
        html += '</div>';

        // If the class has fields, let user select which fields to assign to
        if (uniqueFields.size > 0) {
            html += '<div style="text-align:left; max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:1rem;">';
            html += '<p style="font-size:0.9rem; font-weight:600; margin-top:0; margin-bottom:10px;">Hangi alanlara tanımlansın? (Seçime göre üstteki dersler güncellenir):</p>';
            uniqueFields.forEach(f => {
                html += `<label style="display:inline-flex; align-items:center; gap:5px; margin-right:15px; margin-bottom:8px; cursor:pointer;">
    <input type="checkbox" class="swal-field-filter-checkbox" value="${f}" style="cursor:pointer;" checked onchange="window.updateSwalSubjects()">
        <span style="font-size:0.9rem;">${f}</span>
    </label>`;
            });
            html += '</div>';
        }

        // Copy to other classes section
        let allClasses = new Set();
        students.forEach(s => { if (s.class && s.class !== className) allClasses.add(s.class); });
        const sortedClasses = Array.from(allClasses).sort((a, b) => {
            const numA = (a.match(/\d+/) || [0])[0];
            const numB = (b.match(/\d+/) || [0])[0];
            if (numA !== numB) return numA - numB;
            return a.replace(/\d+/g, '').trim().localeCompare(b.replace(/\d+/g, '').trim());
        });

        if (sortedClasses.length > 0) {
            html += '<div style="text-align:left; max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">';
            html += '<p style="font-size:0.9rem; font-weight:600; margin-top:0; margin-bottom:10px;">Şu sınıflara da kopyala (İsteğe bağlı):</p>';
            sortedClasses.forEach(c => {
                html += `<label style="display:inline-flex; align-items:center; gap:5px; margin-right:15px; margin-bottom:8px; cursor:pointer;">
    <input type="checkbox" class="swal-copy-class-checkbox" value="${c}" style="cursor:pointer;">
        <span style="font-size:0.9rem;">${c}</span>
    </label>`;
            });
            html += '</div>';
        }

        Swal.fire({
            title: `${className} Sınıfı İşlemleri`,
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            width: 500,
            preConfirm: () => {
                const checkedSubs = Array.from(document.querySelectorAll('.swal-subject-checkbox:checked')).map(cb => cb.value);
                const copyClasses = Array.from(document.querySelectorAll('.swal-copy-class-checkbox:checked')).map(cb => cb.value);
                const targetFields = Array.from(document.querySelectorAll('.swal-field-filter-checkbox:checked')).map(cb => cb.value);

                // If the field checkboxes exist but none are checked, we could optionally warn. But we'll just respect the selection.
                return { checkedSubs, targetClasses: [className, ...copyClasses], targetFields, hasFieldFilters: uniqueFields.size > 0 };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { checkedSubs, targetClasses, targetFields, hasFieldFilters } = result.value;
                let updatedStudentsCount = 0;

                targetClasses.forEach(targetClass => {
                    let tGradeMatch = targetClass.match(/\d+/);
                    let tGrade = tGradeMatch ? tGradeMatch[0] : "";

                    // Construct new subjects list appending the target's grade level
                    const newSubjects = checkedSubs.map(sub => tGrade ? `${sub} ${tGrade}` : sub);
                    // All possible settings subjects customized to this target class's grade
                    const possibleSettingsSubjects = settings.subjects.map(sub => tGrade ? `${sub} ${tGrade}` : sub);

                    // If we copy to other classes, do we apply the field filter assuming the other class has those fields? 
                    // The prompt says: "Seçilirse seçilen dersler seçilen alanlara tanımlanır diğerlerine tanımklanmaz". 
                    // This logic implies this applies mainly to the CURRENT class, and if copied, to the matching fields in the target class.
                    // We will only assign to students whose field is included in targetFields if field filters were selected
                    // Fetch fresh students inside the target loop just in case
                    const currentStudents = DataManager.getStudents();
                    currentStudents.forEach(s => {
                        if (s.class === targetClass) {

                            // Check field filtering logic
                            let shouldAssign = true;
                            if (hasFieldFilters && targetFields.length > 0) {
                                // Only assign if the student has one of the selected fields
                                shouldAssign = s.alan && targetFields.includes(s.alan.trim());
                            } else if (hasFieldFilters && targetFields.length === 0) {
                                // Checked boxes existed but user unchecked all of them -> essentially "assign to none" or "assign to those without field"?
                                // For safety, let's treat "no fields selected" as assigning to the whole class if you meant "skip filtering",
                                // but usually if checkboxes exist and none are checked, it means don't assign.
                                // The user said: "Seçilirse seçilen dersler seçilen alanlara tanımlanır diğerlerine tanımklanmaz".
                                shouldAssign = false;
                            }

                            if (shouldAssign) {
                                // Remove previously assigned school settings subjects for this grade
                                let filtered = (s.dersler || []).filter(d => !possibleSettingsSubjects.includes(d));
                                // Assign the new selections
                                s.dersler = Array.from(new Set([...filtered, ...newSubjects]));
                                updatedStudentsCount++;
                            }
                        }
                    });

                    // Update students for each class
                    const liveData = DataManager._getData();
                    liveData.students = currentStudents;
                    DataManager._saveData(liveData);
                });

                document.querySelector('[data-tab="classLists"]').click();
                Swal.fire('Başarılı', `Seçilen dersler, ${targetClasses.length} sınıftaki ilgili ${updatedStudentsCount} öğrenciye başarıyla tanımlandı.`, 'success');
            }
        });
    };

    window.assignFieldToClass = function (className) {
        const data = DataManager._getData();
        let classStudents = data.students.filter(s => s.class === className);

        // Sort students by number just to be neat
        classStudents.sort((a, b) => parseInt(a.no) - parseInt(b.no));

        let html = `
    <div style="text-align:left; font-size:0.95rem;">
            <div style="margin-bottom:1rem;">
                <label style="display:block; font-weight:600; margin-bottom:5px;">Alan Adı</label>
                <input type="text" id="swal-field-name" class="swal2-input" placeholder="Örn: Sayısal, Eşit Ağırlık..." style="margin:0; width:100%; box-sizing:border-box;">
            </div>
            
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:1rem; cursor:pointer;">
                <input type="checkbox" id="swal-specific-students-toggle" style="width:18px; height:18px; cursor:pointer;" 
                       onchange="document.getElementById('swal-students-list').style.display = this.checked ? 'block' : 'none';">
                <span style="font-weight:600; color:var(--primary);">Sadece belirli öğrencilere tanımla</span>
            </label>
            
            <div id="swal-students-list" style="display:none; max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
    `;

        classStudents.forEach(std => {
            let currentField = std.alan ? ` <span style="font-size:0.8rem; color:#888;">(${std.alan})</span>` : '';
            html += `
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer;">
                <input type="checkbox" class="swal-student-cb" value="${std.no}" style="width:16px; height:16px; cursor:pointer;" checked>
                <span><b>${std.no}</b> - ${std.name}${currentField}</span>
            </label>
        `;
        });

        html += `</div></div>`;

        Swal.fire({
            title: `${className} Sınıfına Alan Tanımla`,
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Alanı Kaydet',
            cancelButtonText: 'İptal',
            width: 500,
            preConfirm: () => {
                const fieldName = document.getElementById('swal-field-name').value.trim();
                if (!fieldName) {
                    Swal.showValidationMessage('Lütfen bir alan adı giriniz.');
                    return false;
                }

                const isSpecific = document.getElementById('swal-specific-students-toggle').checked;
                let targetNos = [];

                if (isSpecific) {
                    targetNos = Array.from(document.querySelectorAll('.swal-student-cb:checked')).map(cb => cb.value);
                    if (targetNos.length === 0) {
                        Swal.showValidationMessage('Lütfen en az bir öğrenci seçiniz.');
                        return false;
                    }
                } else {
                    // If not specific, map all student numbers in this class
                    targetNos = classStudents.map(s => s.no);
                }

                return { fieldName, targetNos };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { fieldName, targetNos } = result.value;
                const liveData = DataManager._getData();
                let count = 0;

                liveData.students.forEach(s => {
                    if (s.class === className && targetNos.includes(s.no)) {
                        s.alan = fieldName;
                        count++;
                    }
                });
                DataManager._saveData(liveData);

                // Refresh Dashboard UI
                document.querySelector('[data-tab="classLists"]').click();
                Swal.fire('Başarılı', `"${fieldName}" alanı ${count} öğrenciye tanımlandı.`, 'success');
            }
        });
    };

    window.editStudentDetails = function (studentNo) {
        const data = DataManager._getData();
        const studentIndex = data.students.findIndex(s => s.no == studentNo);

        if (studentIndex === -1) {
            Swal.fire('Hata', 'Öğrenci bulunamadı', 'error');
            return;
        }

        const std = data.students[studentIndex];

        let html = `
    <div style="text-align:left; font-size:0.9rem;">
            <div class="modal-row" style="margin-bottom:10px;">
                <div class="modal-form-group">
                    <label style="font-weight:600;">Öğrenci No</label>
                    <input type="number" id="edit-std-no" class="swal2-input" value="${std.no}" style="margin:0; width:100%; height:38px;">
                </div>
                <div class="modal-form-group" style="flex:2;">
                    <label style="font-weight:600;">Adı Soyadı</label>
                    <input type="text" id="edit-std-name" class="swal2-input" value="${std.name}" style="margin:0; width:100%; height:38px;">
                </div>
            </div>
            
            <div class="modal-row" style="margin-bottom:10px;">
                <div class="modal-form-group">
                    <label style="font-weight:600;">Sınıfı</label>
                    <input type="text" id="edit-std-class" class="swal2-input" value="${std.class}" style="margin:0; width:100%; height:38px;">
                </div>
                <div class="modal-form-group">
                    <label style="font-weight:600;">Alanı</label>
                    <input type="text" id="edit-std-alan" class="swal2-input" value="${std.alan || ''}" style="margin:0; width:100%; height:38px;">
                </div>
                <div class="modal-form-group">
                    <label style="font-weight:600;">
                        Öğrenci Kodu 
                        <a href="javascript:void(0)" onclick="window.toggleEditCodeGuide()" style="font-size:0.75rem; font-weight:normal; margin-left:5px; color:var(--primary);">
                            <i class="fa-solid fa-circle-info"></i> Rehber
                        </a>
                    </label>
                    <input type="text" id="edit-std-kodu" class="swal2-input" value="${std.ogrenciKodu || ''}" style="margin:0; width:100%; height:38px;" placeholder="Örn: C, H">
                </div>
            </div>
            
            <div id="edit-code-guide" style="display:none; margin-top:5px; margin-bottom:15px; padding: 12px; background: rgba(79, 70, 229, 0.05); border-radius: 8px; border: 1px solid rgba(79, 70, 229, 0.1); text-align: left; animation: fadeIn 0.3s ease;">
                <p style="margin-bottom: 10px; font-size: 0.85rem; font-weight: 600; color: var(--gray-600);">Hızlı Seçim:</p>
                <div style="display: flex; gap: 15px; margin-bottom:12px; flex-wrap:wrap;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                        <input type="checkbox" id="edit-chk-c" style="width:20px; height:20px;">
                        <span class="condition-marker type-c" style="margin:0;">C</span> Dikkat
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                        <input type="checkbox" id="edit-chk-h" style="width:20px; height:20px;">
                        <span class="condition-marker type-h" style="margin:0;">H</span> Sağlık
                    </label>
                </div>
                <div style="padding-top:10px; border-top:1px dashed rgba(79, 70, 229, 0.2); font-size:0.8rem; color:var(--gray-600); line-height:1.4;">
                    <i class="fa-solid fa-lightbulb" style="color:var(--primary);"></i> <strong>İpucu:</strong> Belli bir derslikte sınava girmesi istenirse derslik adını (Örn: 12B) buraya yazabilirsiniz.
                </div>
            </div>
            
            <div class="modal-form-group" style="margin-bottom:10px;">
                <label style="font-weight:600;">Dersler (Virgülle ayırın)</label>
                <input type="text" id="edit-std-dersler" class="swal2-input" value="${(std.dersler || []).join(', ')}" style="margin:0; width:100%; height:38px;">
            </div>
            
            <p style="font-weight:600; margin-top:20px; margin-bottom:10px; border-bottom:2px solid var(--gray-100); padding-bottom:5px; color:var(--primary);">Ekstra Bilgiler</p>
            
            <div class="modal-row" style="margin-bottom:10px;">
                <div class="modal-form-group">
                    <label style="font-weight:600; font-size:0.8rem;">Cinsiyet (K/E)</label>
                    <select id="edit-std-ex1" class="swal2-select" style="margin:0; width:100%; height:34px; font-size:0.85rem; padding:0 8px; border:1px solid #d9d9d9; border-radius:6px; background:#fff; outline:none;">
                        <option value="" ${!std.extra1 ? 'selected' : ''}>Seçiniz</option>
                        <option value="K" ${std.extra1 === 'K' ? 'selected' : ''}>Kız (K)</option>
                        <option value="E" ${std.extra1 === 'E' ? 'selected' : ''}>Erkek (E)</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label style="font-weight:600; font-size:0.8rem;">Ekstra 2</label>
                    <input type="text" id="edit-std-ex2" class="swal2-input" value="${std.extra2 || ''}" style="margin:0; width:100%; height:34px; font-size:0.85rem;">
                </div>
            </div>
            <div class="modal-row" style="margin-bottom:10px;">
                <div class="modal-form-group">
                    <label style="font-weight:600; font-size:0.8rem;">Ekstra 3</label>
                    <input type="text" id="edit-std-ex3" class="swal2-input" value="${std.extra3 || ''}" style="margin:0; width:100%; height:34px; font-size:0.85rem;">
                </div>
                <div class="modal-form-group">
                    <label style="font-weight:600; font-size:0.8rem;">Ekstra 4</label>
                    <input type="text" id="edit-std-ex4" class="swal2-input" value="${std.extra4 || ''}" style="margin:0; width:100%; height:34px; font-size:0.85rem;">
                </div>
                <div class="modal-form-group">
                    <label style="font-weight:600; font-size:0.8rem;">Ekstra 5</label>
                    <input type="text" id="edit-std-ex5" class="swal2-input" value="${std.extra5 || ''}" style="margin:0; width:100%; height:34px; font-size:0.85rem;">
                </div>
            </div>
        </div>
`;

        Swal.fire({
            title: 'Öğrenci Kartı Düzenle',
            html: html,
            width: 600,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            denyButtonText: '<i class="fa-solid fa-trash"></i> Sil',
            denyButtonColor: '#ef4444',
            didOpen: () => {
                const guide = document.getElementById('edit-code-guide');
                const input = document.getElementById('edit-std-kodu');
                const chkC = document.getElementById('edit-chk-c');
                const chkH = document.getElementById('edit-chk-h');

                window.toggleEditCodeGuide = () => {
                    guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
                };

                const updateCheckboxes = () => {
                    const tags = input.value.split(/[,\s]+/).map(t => t.trim().toUpperCase());
                    chkC.checked = tags.includes('C');
                    chkH.checked = tags.includes('H');
                };

                updateCheckboxes();

                const updateInput = (code, checked) => {
                    let tags = input.value.split(/[,\s]+/).map(t => t.trim().toUpperCase()).filter(t => t);
                    if (checked) {
                        if (!tags.includes(code)) tags.push(code);
                    } else {
                        tags = tags.filter(t => t !== code);
                    }
                    input.value = tags.join(', ');
                };

                chkC.addEventListener('change', (e) => updateInput('C', e.target.checked));
                chkH.addEventListener('change', (e) => updateInput('H', e.target.checked));
                input.addEventListener('input', updateCheckboxes);
            },
            preConfirm: () => {
                const no = document.getElementById('edit-std-no').value.trim();
                const name = document.getElementById('edit-std-name').value.trim();
                const cls = document.getElementById('edit-std-class').value.trim();

                if (!no || !name || !cls) {
                    Swal.showValidationMessage('Öğrenci No, Adı Soyadı ve Sınıfı zorunludur.');
                    return false;
                }

                if (no != studentNo && data.students.some(s => s.no == no)) {
                    Swal.showValidationMessage('Bu numaraya sahip başka bir öğrenci zaten var.');
                    return false;
                }

                const derslerStr = document.getElementById('edit-std-dersler').value.trim();
                const derslerArr = derslerStr ? derslerStr.split(/[,\n;]/).map(d => d.trim()).filter(d => d) : [];

                return {
                    no: no,
                    name: name,
                    class: cls,
                    alan: document.getElementById('edit-std-alan').value.trim(),
                    ogrenciKodu: document.getElementById('edit-std-kodu').value.trim(),
                    dersler: derslerArr,
                    extra1: document.getElementById('edit-std-ex1').value.trim(),
                    extra2: document.getElementById('edit-std-ex2').value.trim(),
                    extra3: document.getElementById('edit-std-ex3').value.trim(),
                    extra4: document.getElementById('edit-std-ex4').value.trim(),
                    extra5: document.getElementById('edit-std-ex5').value.trim(),
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                data.students[studentIndex] = { ...data.students[studentIndex], ...result.value };
                DataManager._saveData(data);
                document.querySelector('[data-tab="classLists"]').click();
                Swal.fire('Başarılı', 'Öğrenci bilgileri güncellendi.', 'success');
            } else if (result.isDenied) {
                Swal.fire({
                    title: 'Emin misiniz?',
                    text: `${std.class} sınıfındaki ${std.no} numaralı ${std.name} isimli öğrenci silinecek. Bu işlem geri alınamaz!`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Evet, Sil!',
                    cancelButtonText: 'İptal'
                }).then((del) => {
                    if (del.isConfirmed) {
                        data.students.splice(studentIndex, 1);
                        DataManager._saveData(data);
                        document.querySelector('[data-tab="classLists"]').click();
                        Swal.fire('Silindi!', 'Öğrenci başarıyla silindi.', 'success');
                    }
                });
            }
        });
    };

    window.deleteClassCompletely = function (className) {
        Swal.fire({
            title: 'Sınıfı Silmek İstediğinize Emin Misiniz?',
            text: `Bu işlem "${className}" sınıfını ve sınıfta bulunan İÇİNDEKİ TÜM ÖĞRENCİLERİ silecektir. Bu işlem geri alınamaz!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Evet, Tüm Sınıfı Sil!',
            cancelButtonText: 'İptal'
        }).then((result) => {
            if (result.isConfirmed) {
                const data = DataManager._getData();
                data.students = data.students.filter(s => s.class !== className);
                
                if (data.classRoomMappings) {
                    const safeCls = DataManager.sanitizeFirebaseKey(className);
                    if (data.classRoomMappings[className]) delete data.classRoomMappings[className];
                    if (data.classRoomMappings[safeCls]) delete data.classRoomMappings[safeCls];
                }
                
                DataManager._saveData(data);
                
                // Refresh list
                const updateClassesListFn = window.updateClassesList || document.querySelector('[data-tab="classLists"]').click;
                try {
                    document.querySelector('[data-tab="classLists"]').click();
                } catch(e) {}
                
                Swal.fire('Silindi!', `"${className}" sınıfı ve öğrencileri silindi.`, 'success');
            }
        });
    };

    window.updateDeskPos = function (roomName, pos) {
        const room = DataManager.getClassrooms().find(r => r.name === roomName);
        if (!room) return;
        room.teacherDeskPos = pos;
        DataManager.addClassroom(room);
        window.updateClassroomsList();
    };

    window.toggleSeat = function (roomName, seatId) {
        const room = DataManager.getClassrooms().find(r => r.name === roomName);
        if (!room) return;
        if (!room.disabledSeats) room.disabledSeats = [];
        if (room.disabledSeats.includes(seatId)) {
            room.disabledSeats = room.disabledSeats.filter(id => id !== seatId);
        } else {
            room.disabledSeats.push(seatId);
        }
        DataManager.addClassroom(room);
        window.updateClassroomsList();
    };

    window.updateClassroomsList = updateClassroomsList;

    // --- 13. Student Code Guide ---
    window.showStudentCodeGuide = function (targetInputId) {
        const inputEl = document.getElementById(targetInputId);
        if (!inputEl) return;

        const currentVal = inputEl.value.toUpperCase();
        const hasC = currentVal.split(/[,\s]+/).includes('C');
        const hasH = currentVal.split(/[,\s]+/).includes('H');

        Swal.fire({
            title: 'Öğrenci Kod Rehberi',
            html: `
    <div style="text-align: left; padding: 1rem;">
                    <p style="margin-bottom: 1.5rem; color: var(--gray-600);">Özel durumları hızlıca eklemek için yanlarındaki kutucukları işaretleyebilirsiniz:</p>
                    
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: rgba(239, 68, 68, 0.05); border-radius: 8px; border-left: 4px solid var(--danger);">
                        <input type="checkbox" id="guide-chk-c" ${hasC ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                        <span class="condition-marker type-c" style="margin:0; flex-shrink:0;">C</span>
                        <div style="flex: 1;">
                            <strong style="color: var(--danger); display: block;">C (Dikkat):</strong>
                            <span style="font-size: 0.85rem;">Dikkat Edilmesi Gerekir (Örn: Kaynaştırma öğrencisi).</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(245, 158, 11, 0.05); border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <input type="checkbox" id="guide-chk-h" ${hasH ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                        <span class="condition-marker type-h" style="margin:0; flex-shrink:0;">H</span>
                        <div style="flex: 1;">
                            <strong style="color: #f59e0b; display: block;">H (Sağlık):</strong>
                            <span style="font-size: 0.85rem;">Sağlık Sorunu Var (Örn: Kronik hastalık, alerji).</span>
                        </div>
                    </div>

                    <div style="padding: 1rem; background: rgba(79, 70, 229, 0.05); border-radius: 8px; border-top: 2px dashed var(--primary);">
                        <p style="font-weight: 700; color: var(--primary); margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <i class="fa-solid fa-location-dot"></i> Derslik Atama (Özel İpucu)
                        </p>
                        <p style="font-size: 0.85rem; color: var(--gray-600); line-height: 1.4;">
                            Eğer bu öğrencinin <strong>belli bir derslikte</strong> sınava girmesini isterseniz, kod kısmına doğrudan derslik adını (Örn: <strong>12B</strong> gibi) ekleyebilirsiniz.
                        </p>
                    </div>
                </div>
    `,
            didOpen: () => {
                const chkC = document.getElementById('guide-chk-c');
                const chkH = document.getElementById('guide-chk-h');

                const updateInput = (code, checked) => {
                    let tags = inputEl.value.split(/[,\s]+/).map(t => t.trim().toUpperCase()).filter(t => t);
                    if (checked) {
                        if (!tags.includes(code)) tags.push(code);
                    } else {
                        tags = tags.filter(t => t !== code);
                    }
                    inputEl.value = tags.join(', ');
                };

                chkC.addEventListener('change', (e) => updateInput('C', e.target.checked));
                chkH.addEventListener('change', (e) => updateInput('H', e.target.checked));
            },
            confirmButtonText: 'Tamam',
            confirmButtonColor: 'var(--primary)',
            showCloseButton: true,
            width: '500px'
        });
    };

    } catch (e) {
        console.error("Dashboard initialization error:", e);
    } finally {
        initializeNavigation();

        // --- Anlık Senkronizasyon (Diğer sayfalardaki değişiklikleri dashboard'a yansıtır) ---
        window._lastSyncHash = JSON.stringify(DataManager.getExamSessions());
        window.updateSyncHash = function() {
            window._lastSyncHash = JSON.stringify(DataManager.getExamSessions());
        };

        setInterval(async () => {
            const sessionsTab = document.getElementById('view-exam');
            
            // Skip sync if a local change was made recently (wait for cloud to catch up)
            if (Date.now() - (window._lastLocalChangeTime || 0) < 15000) return;

            // Sadece Sınav Dağıtımı sekmesi aktifse ve modal açık değilse yenile (UI akışını bozmamak için)
            if (sessionsTab && !sessionsTab.classList.contains('hidden') && !document.querySelector('.swal2-container')) {
                await DataManager.initCloud();
                const currentHash = JSON.stringify(DataManager.getExamSessions());
                if (currentHash !== window._lastSyncHash) {
                    window._lastSyncHash = currentHash;
                    console.log("Dış veri değişikliği algılandı, oturum listesi yenileniyor...");
                    if (typeof window.renderExamSessionsList === 'function') window.renderExamSessionsList();
                }
            }
        }, 5000); // Admin dashboard için 5 saniye yeterli

        (async function preFetchFonts() {
            const fonts = ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf'];
            fonts.forEach(url => window.getFileBytes(url));
        })();
    }
});

// ══════════════════════════════════════════════════════════════
// GLOBAL: Seating Plan Context Menu
// Must be OUTSIDE DOMContentLoaded so inline oncontextmenu/onclick
// HTML attributes can call these functions reliably.
// ══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // Shared state
    const _ctx = { target: null, moveMode: false, moveSrc: null };

    // Lazy-get the context menu element (created on first call)
    function getMenu() {
        let m = document.getElementById('examDeskContextMenu');
        if (!m) {
            m = document.createElement('div');
            m.id = 'examDeskContextMenu';
            m.style.cssText = 'display:none;position:fixed;z-index:99999;background:white;'
                + 'border:1px solid #e2e8f0;border-radius:10px;'
                + 'box-shadow:0 8px 24px rgba(0,0,0,0.18);overflow:hidden;min-width:155px;';
            m.innerHTML =
                '<div id="examCtxMove" style="padding:12px 18px;cursor:pointer;display:flex;align-items:center;gap:9px;font-size:0.9rem;font-weight:600;color:#1e293b;"'
                + ' onmouseenter="this.style.background=\'#f1f5f9\'" onmouseleave="this.style.background=\'\'">'
                + '<i class="fa-solid fa-arrows-up-down-left-right" style="color:#6366f1;"></i>Taşı</div>'
                + '<div style="height:1px;background:#e2e8f0;margin:0 10px;"></div>'
                + '<div id="examCtxDelete" style="padding:12px 18px;cursor:pointer;display:flex;align-items:center;gap:9px;font-size:0.9rem;font-weight:600;color:#ef4444;"'
                + ' onmouseenter="this.style.background=\'#fef2f2\'" onmouseleave="this.style.background=\'\'">'
                + '<i class="fa-solid fa-trash"></i>Sil</div>';
            document.body.appendChild(m);

            // Wire up buttons immediately after creating the menu
            document.getElementById('examCtxDelete').addEventListener('click', onDelete);
            document.getElementById('examCtxMove').addEventListener('click', onMove);
        }
        return m;
    }

    function hideMenu() {
        const m = document.getElementById('examDeskContextMenu');
        if (m) m.style.display = 'none';
    }

    function renderResults() {
        const s = window.currentRenderedSession;
        if (s && window._renderExamResults) {
            window._renderExamResults(s, window._activeResultsContainer);
        }
    }

    // ── Called from oncontextmenu="examDeskRightClick(event, idx, seatId)"
    window.examDeskRightClick = function (e, roomIdx, seatId) {
        // Fallback: try to get results from the currently rendered session
        if (!window._currentExamResults && window.currentRenderedSession && window.currentRenderedSession.results) {
            window._currentExamResults = window.currentRenderedSession.results;
        }
        const results = window._currentExamResults;
        if (!results || !results[+roomIdx] || !results[+roomIdx].seats[seatId]) return;
        // Only prevent default AFTER confirming we'll show our menu
        e.preventDefault();
        e.stopPropagation();
        _ctx.target = { roomIdx: +roomIdx, seatId: seatId };
        const m = getMenu();
        m.style.display = 'block';
        m.style.left = (e.clientX + 2) + 'px';
        m.style.top = (e.clientY + 2) + 'px';
    };

    // ── Called from onclick="examDeskClick(event, idx, seatId)"
    window.examDeskClick = function (e, roomIdx, seatId) {
        if (!_ctx.moveMode) return;
        e.stopPropagation();
        clearHighlights();

        const results = window._currentExamResults;
        if (!results) { _ctx.moveMode = false; return; }

        const srcRoom = results[_ctx.moveSrc.roomIdx];
        const dstRoom = results[+roomIdx];
        const moving = srcRoom && srcRoom.seats[_ctx.moveSrc.seatId];
        const target = dstRoom && dstRoom.seats[seatId];

        if (!moving) { _ctx.moveMode = false; _ctx.moveSrc = null; return; }

        const desc = target
            ? '<b>' + target.name + '</b> ile yer değiştirilecek'
            : 'Boş koltuğa taşınacak';

        Swal.fire({
            title: 'Taşımayı Onayla',
            html: '<b>' + moving.name + '</b> &rarr; <b>' + dstRoom.name + '</b> salonu. ' + desc + '.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, Taşı',
            cancelButtonText: 'İptal'
        }).then(function (r) {
            if (r.isConfirmed) {
                if (target) srcRoom.seats[_ctx.moveSrc.seatId] = target;
                else delete srcRoom.seats[_ctx.moveSrc.seatId];
                dstRoom.seats[seatId] = moving;
                if (window.currentRenderedSession) {
                    window.currentRenderedSession.results = results;
                    if (window.DataManager) {
                        DataManager.addExamSession(window.currentRenderedSession);
                    }
                }
                renderResults();
            }
            _ctx.moveMode = false;
            _ctx.moveSrc = null;
        });
    };

    function onDelete() {
        hideMenu();
        if (!_ctx.target) return;
        var roomIdx = _ctx.target.roomIdx;
        var seatId = _ctx.target.seatId;
        var results = window._currentExamResults;
        var student = results && results[roomIdx] && results[roomIdx].seats[seatId];
        if (!student) return;

        Swal.fire({
            title: 'Öğrenciyi Kaldır',
            html: '<b>' + student.name + '</b> (' + student.no + ' / ' + student.class + ') dağıtımdan silinecek. Emin misiniz?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'İptal'
        }).then(function (r) {
            if (!r.isConfirmed) return;
            delete results[roomIdx].seats[seatId];
            if (window.currentRenderedSession) {
                window.currentRenderedSession.results = results;
                if (window.DataManager) {
                    DataManager.addExamSession(window.currentRenderedSession);
                }
            }
            renderResults();
        });
    }

    function onMove() {
        hideMenu();
        if (!_ctx.target) return;
        _ctx.moveMode = true;
        _ctx.moveSrc = { roomIdx: _ctx.target.roomIdx, seatId: _ctx.target.seatId };
        document.querySelectorAll('[oncontextmenu],[onclick]').forEach(function (el) {
            if (el.getAttribute('oncontextmenu') && el.getAttribute('oncontextmenu').indexOf('examDeskRightClick') > -1) {
                el.style.outline = '2px dashed #6366f1';
            }
        });
        Swal.fire({ title: 'Taşı Modu', text: 'Hedef koltuğa tıklayın. Dolu ise yer değiştirilir. ESC = iptal.', icon: 'info', timer: 2500, showConfirmButton: false, toast: true, position: 'top-end' });
    }

    function clearHighlights() {
        document.querySelectorAll('[oncontextmenu]').forEach(function (el) {
            el.style.outline = '';
            el.style.cursor = 'context-menu';
        });
    }

    // Global dismiss
    document.addEventListener('click', function (e) {
        var m = document.getElementById('examDeskContextMenu');
        if (m && m.style.display !== 'none' && !m.contains(e.target)) hideMenu();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        hideMenu();
        if (_ctx.moveMode) { _ctx.moveMode = false; _ctx.moveSrc = null; clearHighlights(); }
    });
    }());
    window.testDashboardPdf = async function(customUrl = null, customDesignId = null, customSubject = null, sessType = 'klasik') {
        const testUrl = customUrl || "https://drive.google.com/file/d/1UZRlx5JA_Qx8Lx4edyP1GkSssDBQNwAc/view?usp=sharing";
        const designId = customDesignId || 'design9';
        const subName = customSubject || 'MATEMATİK';

        Swal.fire({
            title: 'Örnek Başlık Hazırlanıyor...',
            html: 'Dosya indiriliyor ve örnek öğrenci başlığı ekleniyor...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const bytes = await window.getFileBytes(testUrl);
            if (!bytes) throw new Error("Dosya indirilemedi (Proxy hatası).");
            
            const uint8 = new Uint8Array(bytes);
            if (uint8[0] !== 0x25 || uint8[1] !== 0x50 || uint8[2] !== 0x44 || uint8[3] !== 0x46) {
                throw new Error("Seçili dosya geçerli bir PDF formatında değil! Lütfen MP3, Word veya Resim dosyası yerine doğru bir PDF soru kağıdı yüklediğinizden emin olun.");
            }
            
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.load(bytes);
            const firstPage = pdfDoc.getPages()[0];
            const { width, height } = firstPage.getSize();
            
            const mockStudent = {
                no: '123',
                name: 'ÖRNEK ÖĞRENCİ',
                class: '9-A',
                room: '9A',
                seat: '1',
                subject: subName,
                examNo: '1'
            };

            // Font loading using shared utility
            const fonts = await DataManager.loadRequiredFonts(pdfDoc);
            
            const A4_W = 595.28, A4_H = 841.89;
            const sf = 1 / Math.min(A4_W / width, A4_H / height);

            // Render header
            await window.renderStudentPDFHeader(pdfDoc, firstPage, mockStudent, { 
                ...fonts,
                sf: sf,
                session: { date: new Date().toLocaleDateString('tr-TR'), time: new Date().toLocaleTimeString('tr-TR'), type: sessType },
                designType: designId
            });

            const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
            window.finalizeAndPrint(URL.createObjectURL(blob));
            Swal.close();
        } catch (err) {
            console.error("Dashboard Test Error:", err);
            Swal.fire({ icon: 'error', title: 'Test Başarısız', text: 'Hata: ' + err.message });
        }
    };

    window.testSpecificRow = function(btn, sessType = 'klasik') {
        const row = btn.closest('.meta-subject-row');
        const inputGroup = btn.closest('.input-group');
        let input = null;
        if (inputGroup) {
            input = inputGroup.querySelector('.meta-paper-pdf-input') || inputGroup.querySelector('.meta-paper-input');
        }
        if (!input) {
            input = row.querySelector('.meta-paper-pdf-input') || row.querySelector('.meta-paper-input');
        }
        
        const select = row.querySelector('.meta-header-design-select');
        const subTitle = row.querySelector('strong').textContent;
        
        if (!input || !input.value) {
            Swal.showValidationMessage('Lütfen önce bir PDF linki girin.');
            return;
        }
        
        if (input.value.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac)$/)) {
            Swal.showValidationMessage('Örnek Öğrenci Kağıdı özelliği sadece Soru Kağıdı (PDF) için çalışır. Lütfen seçili olan dinleme dosyası (MP3) yerine PDF girdiğinizden emin olun.');
            return;
        }
        
        window.testDashboardPdf(input.value.trim(), select.value, subTitle, sessType);
    };

    window.addUygulamaFileRow = function(sub) {
        const container = document.getElementById(`uyg-container-${sub}`);
        if (!container) return;
        const rowCount = container.querySelectorAll('.uygulama-file-row').length;
        const fIdx = rowCount;
        const newRow = document.createElement('div');
        newRow.className = 'input-group uygulama-file-row';
        newRow.style.cssText = 'display:flex; align-items:center; gap:3px; margin-top:4px;';
        newRow.innerHTML = `
            <span style="font-size:0.7rem; font-weight:700; color:var(--gray-500); min-width:60px;">${fIdx + 1}. dosya</span>
            <input type="text" class="swal2-input meta-paper-input" data-sub="${sub}" data-uyg-idx="${fIdx}" style="flex:1; margin:0; height:30px; font-size:0.8rem; padding:0 6px;" value="" placeholder="Uygulama dosyası linki">
            <button type="button" class="btn btn-secondary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="const inp=this.closest('div').querySelector('input.meta-paper-input'); if(inp && inp.value) window.open(inp.value, '_blank'); else Swal.showValidationMessage('Önce bir link girin');" title="Linki Aç"><i class="fa-solid fa-external-link"></i></button>
            <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem; background:#6366f1; border-color:#6366f1;" onclick="window.testUygulamaMedia(this)" title="Medya Test"><i class="fa-solid fa-play"></i> Test</button>
            <button type="button" class="btn btn-info btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.showCloudFiles(this)" title="Buluttan Seç"><i class="fa-solid fa-cloud"></i></button>
            <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.browseToInput(this)" title="Yükle"><i class="fa-solid fa-cloud-arrow-up"></i></button>
            <button type="button" class="btn btn-danger btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="this.closest('.uygulama-file-row').remove();" title="Sil"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(newRow);
    };

    window.testUygulamaMedia = async function(btn) {
        const inp = btn.closest('div').querySelector('input.meta-paper-input');
        if (!inp || !inp.value) {
            Swal.fire('Eksik', 'Önce bir link girin', 'warning');
            return;
        }
        const url = inp.value;
        const lowerUrl = url.toLowerCase();
        
        // YouTube / Vimeo Embed check
        const getYoutubeOrVimeoEmbed = (u) => {
            const lower = u.toLowerCase();
            if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
                let videoId = '';
                if (lower.includes('youtu.be/')) {
                    videoId = u.split('youtu.be/')[1]?.split(/[?#]/)[0];
                } else if (lower.includes('youtube.com/shorts/')) {
                    videoId = u.split('/shorts/')[1]?.split(/[?#]/)[0];
                } else {
                    const match = u.match(/[?&]v=([^&#]+)/);
                    if (match) videoId = match[1];
                    else {
                        const embedMatch = u.match(/\/embed\/([^&#?]+)/);
                        if (embedMatch) videoId = embedMatch[1];
                    }
                }
                if (videoId) return `https://www.youtube.com/embed/${videoId}`;
            }
            if (lower.includes('vimeo.com')) {
                const match = u.match(/vimeo\.com\/(\d+)/);
                if (match) return `https://player.vimeo.com/video/${match[1]}`;
            }
            return null;
        };

        const embedUrl = getYoutubeOrVimeoEmbed(url);
        if (embedUrl) {
            Swal.fire({
                title: 'Video Önizleme',
                html: `<iframe src="${embedUrl}" style="width:100%; height:450px; border:none; border-radius:8px;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
                width: '700px',
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

        const iframeUrl = isGoogleDrive && fileId ? `https://drive.google.com/file/d/${fileId}/preview` : '';
        
        // Proactive Cache (IndexedDB) Lookup
        let downloadUrl = isGoogleDrive && fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url;
        let cacheInfoHtml = `
            <div id="klbk-player-status" style="font-size:0.8rem; color:#94a3b8; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                <i class="fa-solid fa-bolt" style="color:#eab308;"></i> <span>Anında Akış Modu</span>
            </div>`;

        try {
            const cachedBytes = await DataManager.getFileBytes(url);
            if (cachedBytes && cachedBytes.byteLength > 0) {
                const mime = DataManager.detectMimeType(cachedBytes);
                const blob = new Blob([cachedBytes], { type: mime });
                downloadUrl = URL.createObjectURL(blob);
                cacheInfoHtml = `
                    <div id="klbk-player-status" style="font-size:0.8rem; color:#34d399; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="fa-solid fa-circle-check" style="color:#34d399;"></i> <span style="font-weight:600; color:#34d399;">Önbellekten Hızlı Oynatılıyor (0 Gecikme)</span>
                    </div>`;
            }
        } catch (err) {
            console.warn("Fast-cached play lookup bypassed, using live URL", err);
        }

        const showMediaError = () => {
            if (isGoogleDrive && fileId) {
                Swal.fire({
                    title: 'Medya Yüklenemedi',
                    html: `
                    <div style="text-align: left; font-size: 0.95rem; line-height: 1.5; color: var(--gray-700);">
                        <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-bottom: 15px; color: #b91c1c; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-circle-exclamation" style="font-size: 1.2rem;"></i>
                            <span>Dosya Erişimi Engellendi veya Bağlantı Hatası</span>
                        </div>
                        <p>Google Drive dosyanız indirilemedi ve oynatılamadı. Bu hatanın en yaygın sebebi, dosyanın <strong>herkese açık paylaşım izinlerinin verilmemiş olmasıdır</strong>.</p>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                            <strong style="color: var(--primary); display: block; margin-bottom: 6px;"><i class="fa-solid fa-key"></i> Çözüm Adımları:</strong>
                            <ol style="margin: 0; padding-left: 20px; font-weight: 600; color: #475569; font-size: 0.85rem;">
                                <li style="margin-bottom:4px;">Google Drive'da dosyanıza gidin, sağ tıklayıp <strong>Paylaş</strong> seçeneğine tıklayın.</li>
                                <li style="margin-bottom:4px;">Genel Erişim ayarını <strong>"Kısıtlanmış"</strong> yerine <strong>"Bağlantıya sahip olan herkes"</strong> olarak güncelleyin.</li>
                                <li>Rolün <strong>"Görüntüleyici"</strong> olduğundan emin olun ve <strong>Bağlantıyı Kopyala</strong> deyip buraya yeni linki yapıştırın.</li>
                            </ol>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--gray-500); margin: 0;">İzinleriniz tam olmasına rağmen bu hatayı alıyorsanız, aşağıdaki alternatif butonları kullanabilirsiniz.</p>
                    </div>`,
                    width: '600px',
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: '<i class="fa-solid fa-window-restore"></i> Yedek Mod (Iframe)',
                    denyButtonText: '<i class="fa-solid fa-external-link"></i> Yeni Sekmede Aç',
                    cancelButtonText: 'Kapat',
                    confirmButtonColor: '#6366f1',
                    denyButtonColor: '#0ea5e9'
                }).then((result) => {
                    if (result.isConfirmed) {
                        Swal.fire({
                            title: 'Dosya Önizleme (Yedek Mod)',
                            html: `<iframe src="${iframeUrl}" style="width:100%; height:450px; border:none; border-radius:8px;"></iframe>`,
                            width: '700px',
                            showCloseButton: true,
                            showConfirmButton: false
                        });
                    } else if (result.isDenied) {
                        window.open(url, '_blank');
                    }
                });
            } else {
                const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
                Swal.fire({
                    title: 'Medya Yüklenemedi',
                    html: `
                    <div style="text-align: left; font-size: 0.95rem; line-height: 1.5; color: var(--gray-700);">
                        <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-bottom: 15px; color: #b91c1c; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-circle-exclamation" style="font-size: 1.2rem;"></i>
                            <span>Dosya Bağlantı Hatası</span>
                        </div>
                        <p>Medya bağlantısına erişim sağlanamadı veya dosya formatı desteklenmiyor. Lütfen bağlantının doğruluğunu ve internet erişimini kontrol edin.</p>
                    </div>`,
                    width: '500px',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fa-solid fa-window-restore"></i> Yedek Mod (Viewer)',
                    cancelButtonText: 'Kapat',
                    confirmButtonColor: '#6366f1'
                }).then((result) => {
                    if (result.isConfirmed) {
                        Swal.fire({
                            title: 'Dosya Önizleme (Yedek Mod)',
                            html: `<iframe src="${viewerUrl}" style="width:100%; height:450px; border:none; border-radius:8px;"></iframe>`,
                            width: '700px',
                            showCloseButton: true,
                            showConfirmButton: false
                        });
                    }
                });
            }
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
                    parent.replaceChild(imgEl, mediaElement);
                } else if (isPdfMime) {
                    const parent = mediaElement.parentElement;
                    const iframeEl = document.createElement('iframe');
                    iframeEl.src = blobUrl;
                    iframeEl.style.cssText = 'width:100%; height:450px; border:none; border-radius:8px;';
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

        window.switchKlbkPlayerTab = function(tabName) {
            const btnNative = document.getElementById('tab-btn-native');
            const btnIframe = document.getElementById('tab-btn-iframe');
            const contentNative = document.getElementById('player-content-native');
            const contentIframe = document.getElementById('player-content-iframe');
            
            const nativeAudio = document.getElementById('klbk-native-audio');
            const nativeVideo = document.getElementById('klbk-native-video');
            if (nativeAudio) nativeAudio.pause();
            if (nativeVideo) nativeVideo.pause();
            
            if (tabName === 'native') {
                if (btnNative) { btnNative.style.background = '#6366f1'; btnNative.style.color = '#fff'; }
                if (btnIframe) { btnIframe.style.background = '#334155'; btnIframe.style.color = '#94a3b8'; }
                if (contentNative) contentNative.style.display = 'flex';
                if (contentIframe) contentIframe.style.display = 'none';
            } else {
                if (btnNative) { btnNative.style.background = '#334155'; btnNative.style.color = '#94a3b8'; }
                if (btnIframe) { btnIframe.style.background = '#6366f1'; btnIframe.style.color = '#fff'; }
                if (contentNative) contentNative.style.display = 'none';
                if (contentIframe) contentIframe.style.display = 'block';
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

        if (isGoogleDrive && fileId) {
            const iframeHeight = isAudio ? '200px' : '450px';
            swalConfig = {
                title: 'Google Drive Oynatıcı',
                html: `
                <div class="klbk-player-container" style="background:#1e293b; color:#fff; border-radius:12px; padding:15px; text-align:center;">
                    <!-- Sekme Başlıkları -->
                    <div class="klbk-player-tabs" style="display:flex; justify-content:center; gap:10px; margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:10px;">
                        <button type="button" class="player-tab-btn active" onclick="window.switchKlbkPlayerTab('native')" id="tab-btn-native" style="background:#6366f1; color:#fff; border:none; padding:8px 16px; border-radius:20px; font-weight:600; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.2s;">
                            <i class="fa-solid fa-play"></i> Tarayıcı Oynatıcısı
                        </button>
                        <button type="button" class="player-tab-btn" onclick="window.switchKlbkPlayerTab('iframe')" id="tab-btn-iframe" style="background:#334155; color:#94a3b8; border:none; padding:8px 16px; border-radius:20px; font-weight:600; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.2s;">
                            <i class="fa-brands fa-google-drive"></i> Google Drive Oynatıcısı
                        </button>
                    </div>
                    
                    <!-- Sekme İçeriği: Yerel Tarayıcı Oynatıcısı -->
                    <div id="player-content-native" class="player-tab-content" style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:120px;">
                        <div id="klbk-player-status" style="font-size:0.8rem; color:#94a3b8; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <i class="fa-solid fa-bolt" style="color:#eab308;"></i> <span>Anında Akış Modu</span>
                        </div>
                        ${isAudio ? `
                            <audio id="klbk-native-audio" src="${downloadUrl}" controls autoplay style="width:100%; max-width:500px; margin:20px 0;" onerror="window.handleKlbkPlayerError(this, '${url}')">
                                Tarayıcınız ses etiketini desteklemiyor.
                            </audio>
                        ` : `
                            <video id="klbk-native-video" src="${downloadUrl}" controls autoplay style="width:100%; max-height:360px; border-radius:8px; background:#000;" onerror="window.handleKlbkPlayerError(this, '${url}')">
                                Tarayıcınız video etiketini desteklemiyor.
                            </video>
                        `}
                    </div>
                    
                    <!-- Sekme İçeriği: Iframe Oynatıcı -->
                    <div id="player-content-iframe" class="player-tab-content" style="display:none;">
                        <iframe src="${iframeUrl}" style="width:100%; height:${iframeHeight}; border:none; border-radius:8px; background:#000;" allow="autoplay"></iframe>
                    </div>
                    
                    <!-- Ortak Bilgilendirme ve Butonlar -->
                    <div style="margin-top:15px; border-top:1px solid #334155; padding-top:12px; display:flex; flex-direction:column; gap:8px;">
                        <div style="text-align:left; font-size:0.75rem; color:#94a3b8; line-height:1.4;">
                            <i class="fa-solid fa-circle-info" style="color:#6366f1;"></i> 
                            Tarayıcı doğrudan akış yapar. İlk oynatımda gerekirse dosya arka planda otomatik olarak hazırlanır.
                        </div>
                        <div style="display:flex; justify-content:center; gap:10px; margin-top:8px;">
                            <a href="${url}" target="_blank" class="btn btn-info btn-sm" style="padding:6px 12px; border-radius:6px; font-weight:600; font-size:0.8rem; display:flex; align-items:center; gap:4px; text-decoration:none; background:#0ea5e9; color:#fff; border:none;">
                                <i class="fa-solid fa-external-link"></i> Yeni Sekmede Aç
                            </a>
                            <a href="${downloadUrl}" target="_blank" class="btn btn-success btn-sm" style="padding:6px 12px; border-radius:6px; font-weight:600; font-size:0.8rem; display:flex; align-items:center; gap:4px; text-decoration:none; background:#10b981; color:#fff; border:none;">
                                <i class="fa-solid fa-cloud-arrow-down"></i> Dosyayı İndir
                            </a>
                        </div>
                    </div>
                </div>
                `,
                width: '700px',
                background: '#1e293b'
            };
        } else {
            if (isVideo) {
                swalConfig = {
                    title: 'Video Oynatıcı',
                    html: `
                    <div style="background:#1e293b; color:#fff; border-radius:12px; padding:15px; text-align:center;">
                        <div id="klbk-player-status" style="font-size:0.8rem; color:#94a3b8; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <i class="fa-solid fa-bolt" style="color:#eab308;"></i> <span>Anında Akış Modu</span>
                        </div>
                        <video id="klbk-native-video" src="${downloadUrl}" controls autoplay style="width:100%; max-height:400px; border-radius:8px;" onerror="window.handleKlbkPlayerError(this, '${url}')">
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
                        <div id="klbk-player-status" style="font-size:0.8rem; color:#94a3b8; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <i class="fa-solid fa-bolt" style="color:#eab308;"></i> <span>Anında Akış Modu</span>
                        </div>
                        <audio id="klbk-native-audio" src="${downloadUrl}" controls autoplay style="width:100%; margin-top:10px;" onerror="window.handleKlbkPlayerError(this, '${url}')">
                            Tarayıcınız ses etiketini desteklemiyor.
                        </audio>
                    </div>`,
                    width: '400px',
                    background: '#1e293b'
                };
            } else if (isImage) {
                swalConfig = {
                    title: 'Görsel Önizleme',
                    html: `<img src="${downloadUrl}" style="width:100%; max-height:400px; object-fit:contain; border-radius:8px;">`,
                    width: '600px',
                };
            } else if (isPdf) {
                swalConfig = {
                    title: 'Dosya Önizleme (PDF)',
                    html: `<iframe src="${downloadUrl}" style="width:100%; height:550px; border:none; border-radius:8px;"></iframe>`,
                    width: '700px',
                };
            } else {
                swalConfig = {
                    title: 'Dosya Önizleme',
                    html: `<iframe src="${downloadUrl}" style="width:100%; height:550px; border:none; border-radius:8px;"></iframe>`,
                    width: '700px',
                };
            }
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
