// Extracted from ui.js
document.addEventListener('DOMContentLoaded', async () => {
// --- 10. Exam Session Wizard Logic ---
    const examWizardModal = document.getElementById('examWizardModal');
    const btnOpenExamWizard = document.getElementById('btnOpenExamWizard');
    const btnWizardClose = document.getElementById('btnWizardClose');
    const btnWizardNext = document.getElementById('btnWizardNext');
    const btnWizardPrev = document.getElementById('btnWizardPrev');
    const btnWizardFinish = document.getElementById('btnWizardFinish');
    const btnWizardCancel = document.getElementById('btnWizardCancel');

    let currentWizardStep = 1;
    let wizardSessionData = {
        id: '',
        name: '',
        date: '',
        time: '',
        hasGroups: false,
        groupCount: 2,
        subjects: [], // Now objects: {name, hasGroups}
        selectedClasses: [],
        excludedStudents: [],
        selectedClassrooms: [],
        screenViewEnabled: true,
        screenViewLimit: 8
    };

    function resetWizard() {
        currentWizardStep = 1;
        wizardSessionData = {
            id: 'ws_' + Date.now(),
            name: '', date: '', time: '', subjects: [],
            examNo: '1',
            selectedClasses: [], excludedStudents: [], selectedClassrooms: [],
            screenViewEnabled: true,
            screenViewLimit: DataManager.getSchoolSettings()?.defaultTimes?.defaultScreenViewLimit || 8
        };
        window._wizAvailableSubjects = null;
        window._wizSeenPools = null;
        window._wizInitialized = false;

        const dateInput = document.getElementById('wizSessionDate');
        const today = new Date().toISOString().split('T')[0];
        if (dateInput) {
            dateInput.min = today;
            dateInput.addEventListener('change', (e) => {
                wizardSessionData.date = e.target.value;
                if (currentWizardStep === 2) populateWizardClasses();
            });
        }

        const timeInput = document.getElementById('wizSessionTime');
        if (timeInput) {
            timeInput.addEventListener('input', (e) => {
                wizardSessionData.time = e.target.value;
                if (currentWizardStep === 2) populateWizardClasses();
            });
        }

        document.getElementById('wizSessionName').value = '';
        document.getElementById('wizSessionDate').value = '';
        if (document.getElementById('wizSessionExamNo')) {
            document.getElementById('wizSessionExamNo').value = '1';
        }

        // Dynamically populate session lesson dropdown based on daily lessons
        const lessonSelect = document.getElementById('wizSessionLesson');
        if (lessonSelect) {
            const school = DataManager.getSchoolSettings();
            const lessonTimes = school.lessonTimes || {};
            const lessonCount = parseInt(school.dailyLessons) || 0;
            let lessonHtml = '<option value="">Seçin (Hızlı Seçim)</option>';
            for (let i = 1; i <= lessonCount; i++) {
                const start = lessonTimes[`${i}_start`];
                if (start) {
                    lessonHtml += `<option value="${start}">${i}. Ders (${start})</option>`;
                }
            }
            lessonSelect.innerHTML = lessonHtml;
            lessonSelect.value = '';
            
            lessonSelect.addEventListener('change', (e) => {
                if (e.target.value && timeInput) {
                    timeInput.value = e.target.value;
                    wizardSessionData.time = e.target.value;
                    if (currentWizardStep === 2) populateWizardClasses();
                }
            });
        }
        if (timeInput) {
            timeInput.value = '';
        }

        const hasGroupsCheck = document.getElementById('wizSessionHasGroups');
        const groupCountInput = document.getElementById('wizSessionGroupCount');
        const groupCountContainer = document.getElementById('wizGroupCountContainer');

        if (hasGroupsCheck) {
            hasGroupsCheck.checked = false;
            hasGroupsCheck.onchange = () => {
                groupCountContainer.classList.toggle('hidden', !hasGroupsCheck.checked);
            };
        }
        if (groupCountInput) groupCountInput.value = '2';
        if (groupCountContainer) groupCountContainer.classList.add('hidden');

        document.getElementById('wizSubjectSelect').innerHTML = '<option value="">Lütfen Yüklü Öğrencilerden Bir Ders Seçin</option>';
        document.getElementById('wizSelectedSubjectsContainer').innerHTML = '';
        document.getElementById('wizClassesContainer').innerHTML = '<p style="text-align: center; color: var(--gray-500); margin-top: 2rem;">Dersler eklendiğinde, bu dersleri listesinde barındıran tüm sınıflar burada sıralanacaktır.</p>';
        document.getElementById('wizClassroomsContainer').innerHTML = '';
        updateWizardUI();
    }

    function hideExamWizardModal() {
        if (examWizardModal) {
            examWizardModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Modal'ı hemen body seviyesine taşı (glass-panel / backdrop-filter kısıtlamalarını engeller)
    if (examWizardModal && examWizardModal.parentElement !== document.body) {
        document.body.appendChild(examWizardModal);
    }

    if (btnOpenExamWizard) {
        btnOpenExamWizard.addEventListener('click', () => {
            resetWizard();
            if (examWizardModal) {
                if (examWizardModal.parentElement !== document.body) {
                    document.body.appendChild(examWizardModal);
                }
                examWizardModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        });
    }

    if (btnWizardClose) {
        btnWizardClose.addEventListener('click', hideExamWizardModal);
    }

    if (btnWizardCancel) {
        btnWizardCancel.addEventListener('click', hideExamWizardModal);
    }


    function updateWizardUI() {
        // Toggle Panes
        [1, 2, 3, 4].forEach(step => {
            document.getElementById(`wizardStep${step}`).classList.toggle('hidden', currentWizardStep !== step);
        });

        // Toggle Stepper Active classes
        document.querySelectorAll('.wizard-step').forEach(el => {
            const stepNum = parseInt(el.dataset.step);
            el.classList.toggle('active', stepNum === currentWizardStep);
            el.style.color = (stepNum < currentWizardStep) ? 'var(--success)' : (stepNum === currentWizardStep ? 'var(--primary)' : 'var(--gray-400)');
            el.style.fontWeight = (stepNum <= currentWizardStep) ? 'bold' : 'normal';
        });

        // Footer buttons
        btnWizardPrev.style.visibility = currentWizardStep === 1 ? 'hidden' : 'visible';

        if (currentWizardStep === 4) {
            btnWizardNext.classList.add('hidden');
            btnWizardFinish.classList.remove('hidden');
            prepareStep4Summary();
        } else {
            btnWizardNext.classList.remove('hidden');
            btnWizardFinish.classList.add('hidden');
        }

        // On Step 2 Trigger: Save Step 1 & Populate Subjects
        if (currentWizardStep === 2) {
            wizardSessionData.name = document.getElementById('wizSessionName').value;
            wizardSessionData.examNo = document.getElementById('wizSessionExamNo') ? document.getElementById('wizSessionExamNo').value : '1';
            wizardSessionData.date = document.getElementById('wizSessionDate').value;
            wizardSessionData.time = document.getElementById('wizSessionTime').value;
            wizardSessionData.hasGroups = document.getElementById('wizSessionHasGroups').checked;
            wizardSessionData.groupCount = parseInt(document.getElementById('wizSessionGroupCount').value) || 2;
            populateWizardSubjects();
        }
        // On Step 3 Trigger: Populate Classrooms based on Step 2 Choices
        if (currentWizardStep === 3) {
            populateWizardClassrooms();
        }
    }

    // Step 2 Logic: Subjects
    function populateWizardSubjects() {
        const settings = DataManager.getSchoolSettings();
        const allSubjects = settings.subjects || [];

        const select = document.getElementById('wizSubjectSelect');
        const btnAdd = document.getElementById('btnAddWizardSubject');
        const subjectsContainer = document.getElementById('wizSelectedSubjectsContainer');

        const updateSelectOptions = () => {
            select.innerHTML = '<option value="">-- Ders Seçiniz --</option>';
            const avail = window._wizAvailableSubjects;

            allSubjects.forEach(sub => {
                const normSub = (sub || "").trim().toLocaleUpperCase('tr-TR');
                const isSelected = !!wizardSessionData.subjects.find(s => (s.name || "").trim().toLocaleUpperCase('tr-TR') === normSub);

                // If avail is null (initial) or has the subject, show it
                let isAvailable = !avail;
                if (avail) {
                    for (const dn of avail) {
                        if (dn === normSub || dn.startsWith(normSub + " ") || normSub.startsWith(dn + " ")) {
                            isAvailable = true;
                            break;
                        }
                    }
                }

                if (!isSelected && isAvailable) {
                    select.innerHTML += `<option value="${sub}">${sub}</option>`;
                }
            });
        };

        // Expose refresh function for populateWizardClasses to trigger
        window._wizRefreshSubjectList = updateSelectOptions;

        const renderTags = () => {
            subjectsContainer.innerHTML = '';
            wizardSessionData.subjects.forEach(subObj => {
                const sub = subObj.name;
                const tag = document.createElement('div');
                tag.className = 'subject-tag';

                // Group Toggle for this specific subject
                const groupToggle = `
                <label class="subject-tag-group">
                    <input type="checkbox" ${subObj.hasGroups ? 'checked' : ''} onchange="window.wizToggleSubjectGroup('${sub}', this.checked)">
                    Grup
                </label>
            `;

                tag.innerHTML = `
                <span style="font-weight:600;">${sub}</span>
                ${groupToggle}
                <i class="fa-solid fa-circle-xmark subject-tag-remove" onclick="window.wizRemoveSubject('${sub}')"></i>
            `;
                subjectsContainer.appendChild(tag);
            });
            updateSelectOptions();
            populateWizardClasses();
        };

        window.wizRemoveSubject = (sub) => {
            wizardSessionData.subjects = wizardSessionData.subjects.filter(s => s.name !== sub);
            renderTags();
        };

        window.wizToggleSubjectGroup = (subName, val) => {
            const sub = wizardSessionData.subjects.find(s => s.name === subName);
            if (sub) sub.hasGroups = val;
        };

        btnAdd.onclick = () => {
            const val = select.value;
            if (val && !wizardSessionData.subjects.find(s => s.name === val)) {
                wizardSessionData.subjects.push({
                    name: val,
                    hasGroups: wizardSessionData.hasGroups // Default to session setting
                });
                renderTags();
                select.value = '';
            }
        };

        renderTags();
    }

    // Step 2 Logic: Classes for Subject
    function populateWizardClasses() {
        const container = document.getElementById('wizClassesContainer');
        const students = DataManager.getStudents();
        const sessions = DataManager.getExamSessions();

        if (wizardSessionData.subjects.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); margin-top: 2rem;">Lütfen yukarıdan en az bir ders seçip ekleyin.</p>';
            // Reset occupancy UI
            const subSelect = document.getElementById('wizSubjectSelect');
            const btnAddSub = document.getElementById('btnAddWizardSubject');
            const noStdsMsg = document.getElementById('wizNoStudentsMsg');
            if (subSelect) subSelect.disabled = false;
            if (btnAddSub) btnAddSub.disabled = false;
            if (noStdsMsg) noStdsMsg.style.display = 'none';
            window._wizAvailableSubjects = null;
            if (window._wizRefreshSubjectList) window._wizRefreshSubjectList();
            return;
        }

        const busyStudentNos = new Set();
        const curDate = (wizardSessionData.date || "").trim();
        const curTime = (wizardSessionData.time || "").trim();

        // ONLY exclude students if there's an EXACT conflict in Date and Time.
        // Draft sessions (no date/time) DO NOT block each other to allow planning.
        sessions.forEach(s => {
            if (s.id === wizardSessionData.id) return;
            const sDate = (s.date || "").trim();
            const sTime = (s.time || "").trim();

            if (curDate && curTime && sDate === curDate && sTime === curTime) {
                if (s.results) {
                    s.results.forEach(room => {
                        Object.values(room.seats || {}).forEach(std => {
                            if (std.no) busyStudentNos.add(std.no.toString());
                        });
                    });
                }
            }
        });

        let availableInSchool = students.filter(s => !busyStudentNos.has(s.no.toString()));

        // Grouping logic (using Turkish locale normalization)
        const currentSubjects = wizardSessionData.subjects;
        const subjectGroups = [];

        // Track which student is assigned to which subject (by subject name).
        // Using Map<studentNo, subjectName> so a student in Biology pool doesn't
        // block Psychology pool — only cross-subject overlap is blocked.
        const studentSubjectMap = new Map(); // no → subjectName they're assigned to

        currentSubjects.forEach(subObj => {
            const subNameNorm = (subObj.name || "").trim().toLocaleUpperCase('tr-TR').replace(/I/g, 'İ');

            // Target students who REALLY take this specific subject
            // AND are NOT already assigned to a DIFFERENT subject in this session.
            const targetStudents = availableInSchool.filter(s => {
                const sno = s.no.toString();
                const assignedTo = studentSubjectMap.get(sno);
                // Block only if assigned to a DIFFERENT subject (not the same one being processed)
                if (assignedTo && assignedTo !== subNameNorm) return false;

                return (s.dersler || []).some(d => {
                    const dn = (d || "").trim().toLocaleUpperCase('tr-TR').replace(/I/g, 'İ');
                    return dn === subNameNorm || dn.startsWith(subNameNorm + " ") || subNameNorm.startsWith(dn + " ");
                });
            });

            if (targetStudents.length === 0) return;

            // Separate by Class and Alan
            const classAlanGroups = {};
            targetStudents.forEach(s => {
                const clsName = (s.class || "Bilinmeyen").trim().toLocaleUpperCase('tr-TR');
                const alanName = (s.alan || "Genel").trim().toLocaleUpperCase('tr-TR').replace(/I/g, 'İ');
                const groupKey = `${clsName}|${alanName}`;
                if (!classAlanGroups[groupKey]) classAlanGroups[groupKey] = [];
                classAlanGroups[groupKey].push(s);
            });

            const pools = [];
            Object.entries(classAlanGroups).forEach(([key, stds]) => {
                const [cls, aln] = key.split('|');
                const originalAlan = stds[0].alan || "Genel";
                pools.push({
                    pid: `${subNameNorm}_${cls}_${aln}`,
                    class: cls,
                    alan: aln,
                    students: stds,
                    count: stds.length,
                    match: subObj.name,
                    displayName: (aln && aln !== "GENEL") ? `${cls} (${originalAlan})` : cls
                });
            });

            subjectGroups.push({ subject: subObj, pools });

            // Lock ONLY students from SELECTED pools to this subject,
            // so they can't be picked up by a subsequent DIFFERENT subject.
            pools.forEach(p => {
                const isSelected = wizardSessionData.selectedClasses.includes(p.pid);
                if (isSelected) {
                    p.students.forEach(s => {
                        const sno = s.no.toString();
                        // Only write if not already locked (first-come first-served across subjects)
                        if (!studentSubjectMap.has(sno)) {
                            studentSubjectMap.set(sno, subNameNorm);
                        }
                    });
                }
            });
        });

        // --- 1.5 Determine who is ACTUALLY CLAIMED based on current checkboxes ---
        // This must run before we filter the dropdown, because unchecking a class
        // should instantly make those students available again.
        const claimedNos = new Set();
        document.querySelectorAll('.wiz-class-cb:checked').forEach(cb => {
            const pid = cb.value;
            subjectGroups.forEach(g => {
                const p = g.pools.find(p => p.pid === pid);
                if (p) {
                    p.students.forEach(s => {
                        const sno = s.no.toString();
                        if (!wizardSessionData.excludedStudents.includes(sno)) claimedNos.add(sno);
                    });
                }
            });
        });

        // 2. Helper Update Function (Reacts to checkbox changes)
        // This is called initially, and every time a checkbox is toggled.
        const updateOccupancy = () => {
            // Re-calculate claimedNos FRESH every time a checkbox changes
            const currentClaimedNos = new Set();
            document.querySelectorAll('.wiz-class-cb:checked').forEach(cb => {
                const pid = cb.value;
                subjectGroups.forEach(g => {
                    const p = g.pools.find(p => p.pid === pid);
                    if (p) {
                        p.students.forEach(s => {
                            const sno = s.no.toString();
                            if (!wizardSessionData.excludedStudents.includes(sno)) currentClaimedNos.add(sno);
                        });
                    }
                });
            });

            wizardSessionData.selectedClasses = Array.from(document.querySelectorAll('.wiz-class-cb:checked')).map(cb => cb.value);

            const availableSubjects = new Set();
            // We iterate over ALL students in the school (except those busy in other conflicting sessions)
            const baseAvailable = students.filter(s => !busyStudentNos.has(s.no.toString()));

            baseAvailable.forEach(s => {
                const sno = s.no.toString();
                // IF NOT CLAIMED in the current wizard, then their subjects ARE available in the dropdown
                if (!currentClaimedNos.has(sno)) {
                    if (s.dersler) {
                        s.dersler.forEach(d => {
                            if (d) {
                                const dn = d.trim().toLocaleUpperCase('tr-TR');
                                availableSubjects.add(dn);
                                if (dn.includes(" ")) availableSubjects.add(dn.split(" ")[0]);
                            }
                        });
                    }
                }
            });

            window._wizAvailableSubjects = availableSubjects;
            if (window._wizRefreshSubjectList) window._wizRefreshSubjectList();

            const totalOccupancy = currentClaimedNos.size;
            const occEl = document.getElementById('wizOccupancyCount');
            if (occEl) occEl.textContent = totalOccupancy;

            const btnAdd = document.getElementById('btnAddWizardSubject');
            const select = document.getElementById('wizSubjectSelect');
            const noMsg = document.getElementById('wizNoStudentsMsg');

            // Dropdown is empty if literal availability is 0
            const isEmpty = availableSubjects.size === 0;

            if (isEmpty && baseAvailable.length > 0 && totalOccupancy >= baseAvailable.length) {
                if (btnAdd) btnAdd.disabled = true;
                if (select) select.disabled = true;
                if (noMsg) noMsg.style.display = 'block';
            } else {
                if (btnAdd) btnAdd.disabled = false;
                if (select) select.disabled = false;
                if (noMsg) noMsg.style.display = 'none';
            }

            // NOTE: We do NOT call populateWizardClasses() here to avoid
            // a feedback loop: populateWizardClasses → updateOccupancy → populateWizardClasses → ...
        };

        // Helper to check what is currently claimed to prevent auto-select conflicts
        const getCurrentlyClaimedNos = () => {
            const claimed = new Set();
            wizardSessionData.selectedClasses.forEach(pid => {
                subjectGroups.forEach(g => {
                    const p = g.pools.find(p => p.pid === pid);
                    if (p) {
                        p.students.forEach(s => {
                            const sno = s.no.toString();
                            if (!wizardSessionData.excludedStudents.includes(sno)) claimed.add(sno);
                        });
                    }
                });
            });
            return claimed;
        };

        // 3. Render HTML
        if (subjectGroups.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--danger); margin-top: 2rem; background: var(--gray-100); padding: 1rem; border-radius: 8px;">
                <i class="fa-solid fa-circle-exclamation"></i> Seçilen ders(ler)i alan hiçbir öğrenci bulunamadı veya tüm potansiyel öğrenciler daha önce eklenen derslere atandı.</p>`;
            // Initialize occupancy state even if empty
            if (!window._wizInitialized) {
                window._wizInitialized = true;
                updateOccupancy();
            }
            return;
        }

        let html = '';

        // Build a mapping of checked POOL PIDs to their subject names.
        // KEY = pid (subject_class_alan) — NOT just class name.
        // This way "11C TM" checked under Psikoloji does NOT hide "11C FEN" from other subjects.
        const checkedPidToSubject = {};
        subjectGroups.forEach(grp => {
            grp.pools.forEach(p => {
                if (wizardSessionData.selectedClasses.includes(p.pid)) {
                    checkedPidToSubject[p.pid] = grp.subject.name;
                }
            });
        });

        subjectGroups.forEach((grp, idx) => {
            // Filter pools: only hide a pool if that EXACT pid is checked under a DIFFERENT subject.
            // Same-class different-alan pools are independent and must remain visible.
            const visiblePools = grp.pools.filter(inf => {
                const selectedInSubject = checkedPidToSubject[inf.pid];
                return !selectedInSubject || selectedInSubject === grp.subject.name;
            });

            if (visiblePools.length === 0) return; // Skip subject header if no pools are visible

            html += `<h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--primary); font-size: 1rem; border-bottom: 2px solid var(--gray-200); padding-bottom: 0.3rem;">
                <i class="fa-solid fa-book"></i> ${grp.subject.name} Sınavına Girecek Sınıflar</h4>`;
            html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">`;

            visiblePools.forEach(inf => {
                if (!window._wizSeenPools) window._wizSeenPools = new Set();

                if (!window._wizSeenPools.has(inf.pid)) {
                    window._wizSeenPools.add(inf.pid);

                    // Since pools are now strictly Mutually Exclusive, we can safely auto-select 
                    // anything new that appears without fear of conflicts!
                    if (!wizardSessionData.selectedClasses.includes(inf.pid)) {
                        wizardSessionData.selectedClasses.push(inf.pid);
                    }
                }

                const isChecked = wizardSessionData.selectedClasses.includes(inf.pid);

                html += `
                    <div class="wizard-class-card">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" class="wiz-class-cb" value="${inf.pid}" data-class="${inf.class}" ${isChecked ? 'checked' : ''}>
                            <div style="flex:1;">
                                <span style="font-weight:bold;">${inf.displayName}</span>
                                <span style="font-size:0.8rem; color:var(--gray-500);"> ${inf.match}</span>
                            </div>
                        </label>
                        <button type="button" class="btn btn-secondary btn-sm" style="width:100%; margin-top:0.5rem; font-size:0.75rem;" onclick="window.wizToggleStudents('${inf.pid.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-users"></i> Seçim Yap(${inf.count})
                        </button>
                    </div>
                `;
            });
            html += `</div>`;
        });

        // Always update DOM to ensure checkbox states stay in sync with selectedClasses
        container.innerHTML = html;

        // Bind events for live reactivity
        document.querySelectorAll('.wiz-class-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                // Update selectedClasses list
                wizardSessionData.selectedClasses = Array.from(document.querySelectorAll('.wiz-class-cb:checked')).map(c => c.value);
                
                // Preserve scroll position
                const scrollTop = container.scrollTop;
                
                // Re-render classes dynamically to apply mutual exclusion
                populateWizardClasses();
                
                // Restore scroll position
                container.scrollTop = scrollTop;
            });
        });

        // _wizInitialized is set and updateOccupancy is called at the end of this function

        // Toggle Students Modal (inside pools)
        window.wizToggleStudents = (pid) => {
            let inf = null;
            subjectGroups.forEach(g => { const p = g.pools.find(p => p.pid === pid); if (p) inf = p; });
            if (!inf) return;

            let listHtml = `
                <div class="modal-row" style="margin-bottom:1rem;">
                    <button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.wiz-std-cb').forEach(cb => cb.checked = true)">Hepsini Seç</button>
                    <button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.wiz-std-cb').forEach(cb => cb.checked = false)">Hiçbirini Seç</button>
                </div>
                <div style="text-align:left; max-height:300px; overflow-y:auto; padding:0.5rem;">`;
            inf.students.forEach(s => {
                const isExcluded = wizardSessionData.excludedStudents.includes(s.no.toString());
                listHtml += `
                    <label style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem; cursor:pointer; padding: 0.5rem; border-bottom: 1px solid var(--gray-100);">
                        <input type="checkbox" class="wiz-std-cb" value="${s.no}" ${isExcluded ? '' : 'checked'} style="width:18px; height:18px;">
                        <span><b>${s.no}</b> - ${s.name}</span>
                    </label>
                `;
            });
            listHtml += `</div>`;

            Swal.fire({
                title: `Öğrenci Seçimi`,
                html: listHtml,
                showCancelButton: true,
                confirmButtonText: 'Tamam',
                preConfirm: () => {
                    const checkedNos = Array.from(document.querySelectorAll('.wiz-std-cb:checked')).map(cb => cb.value);
                    const allNos = inf.students.map(s => s.no.toString());
                    const excluded = allNos.filter(no => !checkedNos.includes(no));

                    // Update global exclusion list
                    allNos.forEach(no => {
                        const idx = wizardSessionData.excludedStudents.indexOf(no);
                        if (idx > -1) wizardSessionData.excludedStudents.splice(idx, 1);
                    });
                    wizardSessionData.excludedStudents.push(...excluded);
                    updateOccupancy();
                }
            });
        };

        // Run initial occupancy calculation (only once, not in recursive path)
        if (!window._wizInitialized) {
            window._wizInitialized = true;
        }
        updateOccupancy();
    }



    // Step 3 Logic: Classrooms Auto-Match
    function populateWizardClassrooms() {
        const container = document.getElementById('wizClassroomsContainer');
        const allRooms = DataManager.getClassrooms();

        if (allRooms.length === 0) {
            container.innerHTML = '<p style="color:var(--danger);">Sistemde kayıtlı hiç derslik yok. Lütfen önce Derslik Yönetimi sekmesinden derslik ekleyin.</p>';
            return;
        }

        let html = '';
        const mappings = DataManager.getClassRoomMappings() || {};
        const selectedClasses = new Set();
        document.querySelectorAll('.wiz-class-cb:checked').forEach(cb => {
            selectedClasses.add(cb.getAttribute('data-class'));
        });

        allRooms.forEach(room => {
            const isAutoMatch = Array.from(selectedClasses).some(cls => DataManager.getSanitizedClassRoomMapping(cls) === room.name);
            if (isAutoMatch && !wizardSessionData.selectedClassrooms.includes(room.name)) {
                wizardSessionData.selectedClassrooms.push(room.name);
            }

            const isChecked = wizardSessionData.selectedClassrooms.includes(room.name);
            html += `
                <label class="wiz-room-label ${isChecked ? 'active' : ''}">
                    <input type="checkbox" class="wiz-room-cb" value="${room.name}" ${isChecked ? 'checked' : ''}>
                    <div style="flex:1;">
                        <span style="font-weight:bold;">${room.name} Salonu</span>
                    </div>
                </label>
            `;
        });
        container.innerHTML = html;

        // Bind events
        document.querySelectorAll('.wiz-room-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!wizardSessionData.selectedClassrooms.includes(e.target.value)) wizardSessionData.selectedClassrooms.push(e.target.value);
                } else {
                    wizardSessionData.selectedClassrooms = wizardSessionData.selectedClassrooms.filter(c => c !== e.target.value);
                }
                // Update parent style for viz
                e.target.parentElement.classList.toggle('active', e.target.checked);
            });
        });
    }

    // Step 4 Logic: Review
    function prepareStep4Summary() {
        const box = document.getElementById('wizSummaryBox');
        const displayClasses = wizardSessionData.selectedClasses.map(pid => {
            const parts = pid.split('_');
            if (parts.length >= 2) {
                const sub = parts[0];
                const cls = parts[1];
                const aln = (parts[2] && parts[2] !== "GENEL") ? ` (${parts[2]})` : "";
                return `${cls}${aln} [${sub}]`;
            }
            return pid;
        });

        const groupInfo = wizardSessionData.hasGroups
            ? `<div class="modal-form-group" style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-layer-group"></i> ${wizardSessionData.groupCount} Gruplu Sınav (${getGroupNames(wizardSessionData.groupCount)})</div>`
            : `<div class="modal-form-group" style="color:var(--gray-500);"><i class="fa-solid fa-ban"></i> Grupsuz Sınav</div>`;

        let subjectsHtml = wizardSessionData.subjects.map(s => {
            const gText = s.hasGroups ? `<span class="badge badge-success" style="font-size:0.7rem; margin-left:0.5rem;">Grup</span>` : '';
            return `<li style="margin-bottom:0.5rem; list-style:none; padding:0.5rem; background:white; border-radius:6px; border:1px solid var(--gray-100);">${s.name}${gText}</li>`;
        }).join('');

        box.innerHTML = `
            <div style="margin-bottom: 1.5rem; border-bottom: 2px solid var(--gray-200); padding-bottom: 1rem;">
                <h4 style="margin:0 0 0.5rem 0; color:var(--primary); font-size:1.2rem;">${wizardSessionData.name}</h4>
                <div style="font-weight:600; color:var(--gray-700);">${wizardSessionData.date} / ${wizardSessionData.time}</div>
                ${groupInfo}
            </div>
            <div class="modal-row">
                <div class="modal-form-group">
                    <strong style="display:block; margin-bottom:0.75rem;"><i class="fa-solid fa-book"></i> Sınav Dersleri:</strong>
                    <ul style="margin:0; padding:0;">
                        ${subjectsHtml}
                    </ul>
                </div>
                <div class="modal-form-group">
                    <strong style="display:block; margin-bottom:0.75rem;"><i class="fa-solid fa-users"></i> Hedef Kitle:</strong>
                    <div class="badge badge-primary" style="margin-bottom:0.5rem;">${displayClasses.length} Havuz Seçildi</div>
                    <strong style="display:block; margin-top:1rem; margin-bottom:0.75rem;"><i class="fa-solid fa-school"></i> Salonlar:</strong>
                    <div class="badge badge-secondary">${wizardSessionData.selectedClassrooms.length} Salon Ayrıldı</div>
                </div>
            </div>
        `;
    }

    function getGroupNames(count) {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return alphabet.split('').slice(0, count).join(', ');
    }

    if (btnWizardNext) {
        btnWizardNext.addEventListener('click', () => {
            // Validations before moving explicitly
            if (currentWizardStep === 1) {
                wizardSessionData.name = document.getElementById('wizSessionName').value.trim();
                wizardSessionData.examNo = document.getElementById('wizSessionExamNo') ? document.getElementById('wizSessionExamNo').value.trim() : '1';
                wizardSessionData.date = window.formatDateToStandard(document.getElementById('wizSessionDate').value);
                wizardSessionData.time = document.getElementById('wizSessionTime').value.trim();
                const typeEl = document.getElementById('wizSessionType');
                if (typeEl) wizardSessionData.type = typeEl.value;
                if (!wizardSessionData.name || !wizardSessionData.date || !wizardSessionData.time) {
                    Swal.fire('Eksik', 'Lütfen 1. Adımdaki tüm alanları doldurun.', 'warning');
                    return;
                }
            } else if (currentWizardStep === 2) {
                if (wizardSessionData.subjects.length === 0 || wizardSessionData.selectedClasses.length === 0) {
                    Swal.fire('Eksik', 'Lütfen en az bir ders eklediğinizden ve havuza en az bir sınıf eklediğinizden emin olun.', 'warning');
                    return;
                }
            } else if (currentWizardStep === 3) {
                if (wizardSessionData.selectedClassrooms.length === 0) {
                    Swal.fire('Eksik', 'Lütfen oturum için en az 1 derslik seçin.', 'warning');
                    return;
                }
            }

            if (currentWizardStep < 4) {
                currentWizardStep++;
                if (currentWizardStep === 4) {
                    const distCheck = document.getElementById('wizDistributeClasses');
                    if (distCheck) {
                        distCheck.checked = (wizardSessionData.type !== 'uygulama');
                    }
                }
            }
            updateWizardUI();
        });
    }

    if (btnWizardPrev) {
        btnWizardPrev.addEventListener('click', () => {
            if (currentWizardStep > 1) currentWizardStep--;
            updateWizardUI();
        });
    }

    if (btnWizardFinish) {
        btnWizardFinish.addEventListener('click', () => {
            try {
                // Calculate Results before closing
                const allRooms = DataManager.getClassrooms();
                const selectedRoomsList = wizardSessionData.selectedClassrooms || [];
                const targetRooms = allRooms.filter(r => selectedRoomsList.includes(r.name));

                const allStudents = DataManager.getStudents();
                const wizardSubjectsList = wizardSessionData.subjects || [];
                const selectedClassesList = wizardSessionData.selectedClasses || [];
                const excludedStudentsList = wizardSessionData.excludedStudents || [];

                const targetStudents = allStudents.filter(s => {
                    const sCls = (s.class || "Bilinmeyen").trim();
                    const sAlan = (s.alan || "Genel").trim().toLocaleUpperCase('tr-TR').replace(/I/g, 'İ');
                    const sDersler = (s.dersler || []).map(d => String(d || '').trim().toLocaleUpperCase('tr-TR').replace(/I/g, 'İ'));

                    let matchingPoolSelected = false;
                    let matchedSubjectName = null;

                    for (const subObj of wizardSubjectsList) {
                        const rawSubName = typeof subObj === 'object' ? subObj.name : subObj;
                        const subNameNorm = String(rawSubName || '').toLocaleUpperCase('tr-TR').replace(/I/g, 'İ');
                        const sitsForThis = sDersler.some(dn =>
                            dn === subNameNorm || dn.startsWith(subNameNorm + " ") || subNameNorm.startsWith(dn + " ")
                        );

                        if (sitsForThis) {
                            const pid = `${subNameNorm}_${sCls.toLocaleUpperCase('tr-TR').replace(/I/g, 'İ')}_${sAlan}`;
                            if (selectedClassesList.includes(pid)) {
                                matchingPoolSelected = true;
                                const foundDers = (s.dersler || []).find(d => {
                                    const dn = String(d || '').trim().toLocaleUpperCase('tr-TR').replace(/I/g, 'İ');
                                    return dn === subNameNorm || dn.startsWith(subNameNorm + " ") || subNameNorm.startsWith(dn + " ");
                                });
                                const originalDers = foundDers ? String(foundDers).trim() : rawSubName;

                                // Use the actual subject name from student data to preserve its level
                                matchedSubjectName = originalDers;
                                
                                // If the subject name doesn't end with a grade level, append it from class
                                if (!/\d+$/.test(originalDers)) {
                                    const gradeMatch = sCls.match(/^\d+/);
                                    if (gradeMatch) matchedSubjectName += " " + gradeMatch[0];
                                }
                                break;
                            }
                        }
                    }

                    if (!matchingPoolSelected) return false;
                    if (excludedStudentsList.includes(String(s.no || ''))) return false;

                    s._matchedSubject = matchedSubjectName;
                    return true;
                });

                if (targetStudents.length === 0 || targetRooms.length === 0) {
                    Swal.fire('Hata', 'Dağıtım için geçerli öğrenci veya derslik bulunamadı! Lütfen sınıf ve derslik seçimlerinizi kontrol edin.', 'error');
                    return;
                }

                if (wizardSessionData.type === 'uygulama' && !wizardSessionData.name.endsWith('(UYG)')) {
                    wizardSessionData.name += ' (UYG)';
                }

                const distCheck = document.getElementById('wizDistributeClasses');
                const doDistribute = distCheck ? distCheck.checked : true;

                if (doDistribute) {
                    const algo = window.ExamAlgorithm || (typeof ExamAlgorithm !== 'undefined' ? ExamAlgorithm : null);
                    if (!algo || typeof algo.distribute !== 'function') {
                        throw new Error('Dağıtım algoritması (ExamAlgorithm) yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
                    }
                    wizardSessionData.results = algo.distribute([...targetStudents], targetRooms, wizardSessionData);
                } else {

                    // Her sınıfı kendi dersliğinde bırak (Bypass Algorithm)
                    const fakeResults = targetRooms.map(room => {
                        const roomNameSafe = DataManager.getSanitizedClassRoomMapping(room.name);
                        const assigned = {};
                        const roomStudents = targetStudents.filter(s => {
                            const clsSafe = DataManager.getSanitizedClassRoomMapping(s.class || "Bilinmeyen");
                            return clsSafe === roomNameSafe || roomNameSafe.includes(clsSafe) || clsSafe.includes(roomNameSafe);
                        });
                        
                        let g = 1, r = 1, c = 1;
                        let studentIdx = 0;
                        while(studentIdx < roomStudents.length) {
                            if (g > (room.groups || 1)) break;
                            const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                            const seatId = `G${g}-S${r}-C${c}`;
                            if (!room.disabledSeats?.includes(seatId)) {
                                assigned[seatId] = roomStudents[studentIdx];
                                studentIdx++;
                            }
                            c++;
                            if (c > cf.cols) {
                                c = 1;
                                r++;
                                if (r > cf.rows) {
                                    r = 1;
                                    g++;
                                }
                            }
                        }
                        
                        return {
                            name: room.name, groups: room.groups, groupConfigs: room.groupConfigs,
                            teacherDeskPos: room.teacherDeskPos || 'right', disabledSeats: room.disabledSeats || [],
                            rows: room.rows, cols: room.cols, seats: assigned
                        };
                    });
                    wizardSessionData.results = fakeResults;
                }

                // Expand subjects based on actual distributed students' matched subjects
                const actualSubjects = [...new Set(targetStudents.map(s => s._matchedSubject))].filter(Boolean);
                if (actualSubjects.length > 0) {
                    const originalSubjects = wizardSessionData.subjects || [];
                    wizardSessionData.subjects = actualSubjects.map(subName => {
                        const baseMatch = originalSubjects.find(s => {
                            const sName = (typeof s === 'object' ? s.name : s);
                            return subName.startsWith(sName);
                        });
                        return {
                            name: subName,
                            hasGroups: baseMatch ? baseMatch.hasGroups : (wizardSessionData.hasGroups || false)
                        };
                    }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
                }

                // Auto-assign PDF header designs based on grade and field
                if (!wizardSessionData.subjectMetadata) wizardSessionData.subjectMetadata = {};
                
                (wizardSessionData.subjects || []).forEach(subObj => {
                    const subName = typeof subObj === 'object' ? subObj.name : subObj;
                    const safeSub = DataManager.sanitizeFirebaseKey(subName);
                    
                    if (!wizardSessionData.subjectMetadata[safeSub]) {
                        wizardSessionData.subjectMetadata[safeSub] = { papers: {}, examNo: '' };
                    }
                    wizardSessionData.subjectMetadata[safeSub].examNo = wizardSessionData.examNo || '1';
                    
                    // Already set manually?
                    if (wizardSessionData.subjectMetadata[safeSub].pdfHeaderDesign) return;

                    // Find first student in this session taking this subject to decide design
                    const sampleStudent = targetStudents.find(s => s._matchedSubject === subName);
                    if (sampleStudent) {
                        const sCls = (sampleStudent.class || "").trim();
                        const sAlan = (sampleStudent.alan || "").toLocaleUpperCase('tr-TR').replace(/I/g, 'İ').trim();
                        let design = "1"; // Default Classic
                        
                        if (sCls.startsWith("9")) {
                            design = "9"; // Atatürk
                        } else if (sCls.startsWith("10")) {
                            design = "1"; // Klasik
                        } else if (sCls.startsWith("11")) {
                            if (sAlan === "FEN" || sAlan === "MF" || sAlan.includes("SAYISAL")) design = "3"; // Köşe Zarif
                            else if (sAlan === "TM" || sAlan === "EA" || sAlan.includes("EŞİT")) design = "4"; // Osmanlı
                        } else if (sCls.startsWith("12")) {
                            if (sAlan === "FEN" || sAlan === "MF" || sAlan.includes("SAYISAL")) design = "6"; // Seddülbahir
                            else if (sAlan === "TM" || sAlan === "EA" || sAlan.includes("EŞİT")) design = "10"; // Bulut
                        }
                        
                        wizardSessionData.subjectMetadata[safeSub].pdfHeaderDesign = design;
                    }
                });

                // Save Session
                DataManager.addExamSession(wizardSessionData);
                hideExamWizardModal();

                Swal.fire({
                    title: 'Dağıtımı Yapıldı',
                    text: 'Sınav oturumu kaydedildi ve dağıtım başarıyla tamamlandı.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    // Show result panel immediately
                    window.viewSessionDistribution(wizardSessionData.id, 'class');
                });

                window.renderExamSessionsList();
            } catch (err) {
                console.error("Wizard Finish Error:", err);
                Swal.fire('Dağıtım Hatası', err.message || 'Oturum oluşturulurken bir hata oluştu.', 'error');
            }
        });
    }

    // List rendering
    const examSessionsList = document.getElementById('examSessionsList');
    window._currentlyOpenSessionId = null;
    window._currentlyOpenSessionMode = {}; // sessionID -> mode
    window._activeResultsContainer = null;

    window.renderExamSessionsList = function() {
        if (!examSessionsList) return;
        const scrollPos = window.scrollY;
        
        const sessions = DataManager.getSortedExamSessions();
        const activeSessions = sessions.filter(s => !s.isArchived);
        const archivedSessions = sessions.filter(s => s.isArchived);

        const renderTable = (list, isArchivedTable) => {
            if (list.length === 0) return isArchivedTable ? '' : '<div class="empty-text" style="text-align:center; padding: 2rem; color: var(--gray-500);">Henüz aktif oturum yok.</div>';
            
            let html = `
                <div class="session-table-container">
                    <table class="session-table">
                    <thead>
                        <tr>
                            <th>Sınav Oturumu</th>
                            <th class="hide-mobile">Tarih & Saat</th>
                            <th class="text-center">Görünüm</th>
                            <th class="text-center">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            list.forEach((ses, idx) => {
                const status = ses.isArchived ? 'archived' : (ses.isPublished ? 'published' : 'unpublished');
                const val = status === 'published' ? 0 : (status === 'unpublished' ? 1 : 2);
                
                const hue = list.length > 1 ? 280 - (idx / (list.length - 1)) * 280 : 280;
                const bgColor = status === 'published' ? `hsla(${hue}, 70%, 97%, 1)` : (status === 'archived' ? '#f1f5f9' : '#fef2f2');
                const titleColor = status === 'published' ? 'var(--primary)' : 'var(--gray-500)';
                const titleText = ses.name;

                html += `
                    <tr id="session-row-${ses.id}" class="session-row" style="background: ${bgColor}; ${status === 'archived' ? 'opacity: 0.8;' : ''}">
                        <td class="session-info-cell">
                            <div class="session-title-wrapper">
                                <div class="tri-range-container" data-status="${status}" title="Durum: ${status === 'published' ? 'Yayında' : (status === 'unpublished' ? 'Yayında Değil' : 'Arşivlendi')}">
                                    <div class="tri-range-labels">
                                        <i class="fa-solid fa-check"></i>
                                        <i class="fa-solid fa-xmark"></i>
                                        <i class="fa-solid fa-box-archive"></i>
                                    </div>
                                    <input type="range" min="0" max="2" step="1" value="${val}" 
                                           class="tri-status-range" 
                                           onchange="window.updateSessionStatus('${ses.id}', this.value)">
                                </div>
                                <i class="fa-solid fa-chevron-right session-arrow-icon" id="arrow-${ses.id}" onclick="window.viewSessionDistribution('${ses.id}')"></i>
                                <span onclick="window.viewSessionDistribution('${ses.id}')" class="session-title" style="color:${titleColor}; cursor: pointer;">
                                    ${titleText}
                                </span>
                            </div>
                            <div class="session-subjects" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:4px;">
                                ${(() => {
                                    const subjectStats = {};
                                    if (ses.results) {
                                        ses.results.forEach(room => {
                                            Object.values(room.seats || {}).forEach(std => {
                                                if (std._matchedSubject) subjectStats[std._matchedSubject] = true;
                                            });
                                        });
                                    }
                                    const subjectNames = Object.keys(subjectStats).length > 0
                                        ? Object.keys(subjectStats).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
                                        : (ses.subjects ? ses.subjects.map(s => typeof s === 'object' ? s.name : s) : (ses.subject ? [ses.subject] : []));
                                    
                                    return subjectNames.map(subName => {
                                        const meta = DataManager.getSanitizedSubjectMetadata(ses, subName);
                                        const papers = meta.papers || {};
                                        let hasPdf = false;
                                        if (typeof papers === 'string' && papers.trim().length > 0) hasPdf = true;
                                        else if (typeof papers === 'object' && papers !== null) {
                                            hasPdf = Object.values(papers).some(p => typeof p === 'string' && p.trim().length > 0);
                                        }
                                        
                                        if (hasPdf) {
                                            return '<span style="color: #10b981; font-weight: 700; font-size: 0.85rem; display:inline-flex; align-items:center; gap:4px;">' + subName + ' <span style="background:#10b981; color:white; padding:2px 5px; border-radius:4px; font-size:0.65rem; line-height:1; font-weight:bold;">PDF</span></span>';
                                        } else {
                                            return '<span style="color: var(--gray-500); font-size: 0.85rem;">' + subName + '</span>';
                                        }
                                    }).join('<span style="color:var(--gray-300); font-size:0.8rem;">•</span>');
                                })()}
                            </div>
                        </td>
                        <td class="session-datetime-desktop">
                            <div class="session-date-wrapper font-weight-bold text-dark" style="display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-calendar-day" style="color: var(--primary);"></i>
                                <span>${ses.date || ''}</span>
                            </div>
                            <div class="session-time-wrapper font-size-0-8 text-gray-500" style="display: inline-flex; align-items: center; gap: 6px; margin-top: 4px;">
                                <i class="fa-solid fa-clock" style="color: var(--gray-400);"></i>
                                <span>${ses.time || ''}</span>
                            </div>
                        </td>
                        <td class="session-view-options-cell">
                            <div class="mode-selector-container" style="display: flex; gap: 8px; justify-content: flex-start; align-items: center; white-space: nowrap; flex-wrap: nowrap; background: transparent; border: none; padding: 0;">
                                ${ses.type === 'uygulama' ? `
                                    <select id="mode-select-${ses.id}" class="mode-selector-select" onchange="window.viewSessionDistribution('${ses.id}', null, true)" style="border: 1px solid var(--gray-200); padding: 6px 10px; border-radius: 8px; font-size: 0.85rem; background: white; cursor: pointer; font-weight: 600; color: var(--dark); outline: none; height: 36px; font-family: 'Outfit', sans-serif;">
                                        <option value="class" selected>Sınıf</option>
                                    </select>
                                ` : `
                                    <select id="mode-select-${ses.id}" class="mode-selector-select" onchange="window.viewSessionDistribution('${ses.id}', null, true)" style="border: 1px solid var(--gray-200); padding: 6px 10px; border-radius: 8px; font-size: 0.85rem; background: white; cursor: pointer; font-weight: 600; color: var(--dark); outline: none; height: 36px; font-family: 'Outfit', sans-serif;">
                                        <option value="seating" ${(window._currentlyOpenSessionMode[ses.id] === 'seating' || (!window._currentlyOpenSessionMode[ses.id] && ses.type !== 'uygulama')) ? 'selected' : ''}>Şema</option>
                                        <option value="room" ${(window._currentlyOpenSessionMode[ses.id] === 'room') ? 'selected' : ''}>Salon</option>
                                        <option value="class" ${(window._currentlyOpenSessionMode[ses.id] === 'class') ? 'selected' : ''}>Sınıf</option>
                                    </select>
                                `}
                                <button class="btn btn-secondary mode-print-btn" style="padding: 0.5rem 0.75rem; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--gray-200); background: white; color: var(--primary); font-size: 0.9rem; cursor: pointer; transition: all 0.2s;" title="Yazdır"
                                    onclick="window.printSessionDistribution('${ses.id}')">
                                    <i class="fa-solid fa-print"></i>
                                </button>
                            </div>
                        </td>
                        <td style="padding:1.25rem; text-align:center; display:flex; gap:0.5rem; justify-content:center;">
                            <button class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" onclick="window.openSessionMetadataEditor('${ses.id}')" title="Düzenle">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn btn-danger" style="padding: 0.5rem 0.75rem;" onclick="window.deleteExamSession('${ses.id}')" title="Sil">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                    <tr id="accordion-body-${ses.id}" class="hidden" style="background:#fafafa;">
                        <td colspan="4" style="padding:0;">
                            <div id="results-container-${ses.id}" style="padding:1.5rem; border-left:4px solid var(--primary);">
                                <!-- Results will be injected here -->
                            </div>
                        </td>
                    </tr>
                `;
            });

            return html + `</tbody></table></div>`;
        };

        const renderArchivedList = (list) => {
            if (list.length === 0) return ''; // Handled by summary view
            
            return `
                <div class="archived-list">
                    ${list.map(ses => `
                        <div class="archived-item">
                            <div class="archived-item-header" onclick="this.parentElement.classList.toggle('open')">
                                <div class="header-left">
                                    <i class="fa-solid fa-chevron-right arrow"></i>
                                    <span class="session-name">${ses.name}</span>
                                </div>
                                <div class="header-right">
                                    <span class="session-date">${ses.date || ''}</span>
                                    <div class="tri-range-container" data-status="archived" onclick="event.stopPropagation()" style="transform: scale(0.9);">
                                        <div class="tri-range-labels">
                                            <i class="fa-solid fa-check"></i>
                                            <i class="fa-solid fa-xmark"></i>
                                            <i class="fa-solid fa-box-archive"></i>
                                        </div>
                                        <input type="range" min="0" max="2" step="1" value="2" 
                                               class="tri-status-range" 
                                               onchange="window.updateSessionStatus('${ses.id}', this.value)">
                                    </div>
                                </div>
                            </div>
                            <div class="archived-item-body">
                                <div style="margin-bottom: 15px; font-size: 0.9rem; color: var(--gray-600);">
                                    <i class="fa-regular fa-clock"></i> <b>Sınav Saati:</b> ${ses.time} <br>
                                    <i class="fa-solid fa-layer-group" style="margin-top:5px;"></i> <b>Dersler:</b> 
                                    ${(ses.subjects || []).map(s => typeof s === 'object' ? s.name : s).join(', ') || 'Tanımsız'}
                                </div>
                                <div class="archived-actions">
                                    <button onclick="window.viewSessionDistribution('${ses.id}')">
                                        <i class="fa-solid fa-eye"></i> Görüntüle
                                    </button>
                                    <button onclick="window.printSessionDistribution('${ses.id}')">
                                        <i class="fa-solid fa-print"></i> Yazdır
                                    </button>
                                    <button onclick="window.openSessionMetadataEditor('${ses.id}')">
                                        <i class="fa-solid fa-pen"></i> Düzenle
                                    </button>
                                    <button class="danger" onclick="window.deleteExamSession('${ses.id}')">
                                        <i class="fa-solid fa-trash"></i> Sil
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        const activeTableHtml = renderTable(activeSessions, false);
        const archivedTableHtml = renderArchivedList(archivedSessions);

        const isArchivedOpen = sessionStorage.getItem('klbk_archivedSectionOpen') === 'true';

        examSessionsList.innerHTML = `
            <div class="active-sessions-section">
                ${activeTableHtml}
            </div>
            ${archivedSessions.length > 0 ? `
            <div class="archived-sessions-section" style="margin-top: 3rem;">
                <div class="archived-section-header" onclick="const wrapper = document.getElementById('archived-sessions-list-wrapper'); wrapper.classList.toggle('hidden'); const isOpen = !wrapper.classList.contains('hidden'); sessionStorage.setItem('klbk_archivedSectionOpen', isOpen); this.querySelector('.arrow').style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';" style="cursor: pointer; display: flex; align-items: center; gap: 10px; margin-bottom: 1rem; user-select: none;">
                    <h3 style="margin: 0; color: var(--gray-500); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-chevron-right arrow" style="transition: transform 0.3s; font-size: 0.85rem; transform: ${isArchivedOpen ? 'rotate(90deg)' : 'rotate(0deg)'}"></i>
                        <i class="fa-solid fa-box-archive"></i> Arşivlenmiş Oturumlar (${archivedSessions.length})
                    </h3>
                </div>
                <div id="archived-sessions-list-wrapper" class="${isArchivedOpen ? '' : 'hidden'}">
                    ${archivedTableHtml}
                </div>
            </div>` : ''}
        `;

        // Restore open accordion if it exists
        if (window._currentlyOpenSessionId) {
            const body = document.getElementById(`accordion-body-${window._currentlyOpenSessionId}`);
            if (body) {
                body.classList.remove('hidden');
                const arrow = document.getElementById(`arrow-${window._currentlyOpenSessionId}`);
                if (arrow) arrow.style.transform = 'rotate(90deg)';
                // Also re-trigger distribution view to populate the container if it was recently updated
                window.viewSessionDistribution(window._currentlyOpenSessionId, null, false, true);
            }
        }

        // Restore scroll position
        window.scrollTo(0, scrollPos);
    }


    window.updateSessionStatus = function (id, val) {
        const sessions = DataManager.getExamSessions();
        const ses = sessions.find(s => s.id === id);
        if (!ses) return;

        val = parseInt(val);
        // 0: Published, 1: Unpublished, 2: Archived
        if (val === 0) {
            ses.isPublished = true;
            ses.isArchived = false;
        } else if (val === 1) {
            ses.isPublished = false;
            ses.isArchived = false;
        } else if (val === 2) {
            ses.isPublished = false;
            ses.isArchived = true;
        }

        DataManager.addExamSession(ses);
        window.renderExamSessionsList();

        let msg = '';
        let icon = 'success';
        if (ses.isArchived) { msg = 'Sınav arşivlendi'; icon = 'info'; }
        else if (ses.isPublished) { msg = 'Sınav yayınlandı'; }
        else { msg = 'Sınav yayından kaldırıldı'; icon = 'warning'; }

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: icon,
            title: msg,
            showConfirmButton: false,
            timer: 1500
        });
    };

    // ===== YEDEK KAĞIT YAZDIRMA (Sağ tıklama) =====
    document.body.addEventListener('contextmenu', function (e) {
        const row = e.target.closest('.session-row');
        if (!row) return;
        e.preventDefault();
        const id = row.id.replace('session-row-', '');
        window.openSparePaperModal(id);
    });

    window.openSparePaperModal = function (sessionId) {
        const sessions = DataManager.getExamSessions();
        const ses = sessions.find(s => s.id === sessionId);
        if (!ses) return;

        const hasPdf = (subName) => {
            const meta = DataManager.getSanitizedSubjectMetadata(ses, subName) || {};
            const papers = meta.papers;
            if (!papers) return false;
            if (typeof papers === 'string') return papers.trim().length > 5;
            if (typeof papers === 'object') {
                return Object.entries(papers).some(([key, val]) => {
                    if (key === 'uygulamaFiles') return false;
                    return typeof val === 'string' && val.trim().length > 5;
                });
            }
            return false;
        };

        const seenNames = new Set();
        const subjectNames = [];

        if (ses.results) {
            ses.results.forEach(room => {
                Object.values(room.seats || {}).forEach(std => {
                    const subName = std._matchedSubject || "";
                    if (subName && !seenNames.has(subName) && hasPdf(subName)) {
                        seenNames.add(subName);
                        subjectNames.push(subName);
                    }
                });
            });
        }

        (ses.subjects || []).forEach(sub => {
            const subName = (typeof sub === 'object' ? sub.name : sub);
            if (!seenNames.has(subName) && hasPdf(subName)) {
                const hasGranular = Array.from(seenNames).some(n => n.startsWith(subName + " "));
                if (!hasGranular) {
                    seenNames.add(subName);
                    subjectNames.push(subName);
                }
            }
        });

        if (subjectNames.length === 0) {
            Swal.fire('Uyarı', 'Bu oturumda yazdırılabilir PDF sınav kağıdı veya uygulama dosyası yüklü olan ders bulunamadı.', 'warning');
            return;
        }

        subjectNames.sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

        let listHtml = subjectNames.map((sub, idx) => `
            <div style="display:flex; align-items:center; gap:12px; padding:12px; background:${idx % 2 === 0 ? 'rgba(79, 70, 229, 0.03)' : '#fff'}; border-radius:10px; margin-bottom:6px; border:1px solid rgba(0,0,0,0.03);">
                <div style="width:36px; height:36px; background:var(--primary); color:white; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.1rem;">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <div style="flex:1; text-align:left;">
                    <div style="font-weight:700; font-size:0.95rem; color:#1e293b; line-height:1.2;">${sub}</div>
                    <div style="font-size:0.75rem; color:var(--gray-500); margin-top:2px;">Yedek Kağıt Adedi</div>
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="number" class="spare-count-input" data-sub="${sub}" value="3" min="0" max="100"
                        style="width:60px; height:38px; text-align:center; border:2px solid var(--gray-200); border-radius:8px; font-size:1.1rem; font-weight:800; color:var(--primary); background:white;">
                    <span style="font-size:0.8rem; color:var(--gray-400); font-weight:600;">adet</span>
                </div>
            </div>
        `).join('');

        Swal.fire({
            title: '<div style="display:flex; align-items:center; gap:10px; justify-content:center;"><i class="fa-solid fa-copy" style="color:var(--primary);"></i> <span>Yedek Kağıt Yazdır (v5.0)</span></div>',
            width: Math.min(520, window.innerWidth - 30),
            padding: '1.5rem',
            html: `
                <div style="text-align:left; margin-top:10px;">
                    <div style="background:var(--primary); color:white; padding:12px; border-radius:10px; margin-bottom:15px; font-size:0.85rem; line-height:1.4; display:flex; gap:10px; align-items:center;">
                        <i class="fa-solid fa-circle-info" style="font-size:1.2rem;"></i>
                        <span>Bu dökümanlarda <b>öğrenci bilgileri (Ad, Sınıf, No vb.) boş</b> bırakılacaktır. Sadece sınav bilgileri ve başlıklar yazdırılır.</span>
                    </div>
                    <div style="max-height:60vh; overflow-y:auto; padding-right:6px; margin-bottom:10px;" class="luxury-scroll">
                        ${listHtml}
                    </div>
                </div>
                <style>
                    .luxury-scroll::-webkit-scrollbar { width: 6px; }
                    .luxury-scroll::-webkit-scrollbar-track { background: transparent; }
                    .luxury-scroll::-webkit-scrollbar-thumb { background: var(--gray-200); border-radius: 10px; }
                </style>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-print"></i> Yazdırmayı Başlat',
            cancelButtonText: 'İptal',
            confirmButtonColor: '#4f46e5',
            reverseButtons: true,
            preConfirm: () => {
                const items = [];
                document.querySelectorAll('.spare-count-input').forEach(inp => {
                    const count = parseInt(inp.value) || 0;
                    if (count > 0) items.push({ subject: inp.getAttribute('data-sub'), count });
                });
                if (items.length === 0) {
                    Swal.showValidationMessage('Lütfen en az bir ders için adet giriniz.');
                    return false;
                }
                return { sessionId, items };
            }
        }).then(result => {
            if (result.isConfirmed && result.value) {
                window.printSparePapers(result.value.sessionId, result.value.items);
            }
        });
    };

    window.printSparePapers = async function (sessionId, items) {
        const A4W = 595.28, A4H = 841.89;
        const pdfLib = window.PDFLib;
        const PDFDocument = pdfLib.PDFDocument;
        const sessions = DataManager.getExamSessions();
        const ses = sessions.find(s => s.id === sessionId);
        if (!ses) return;

        const metadata = ses.subjectMetadata || {};
        const missingSubjects = [];
        const validItems = [];

        items.forEach(item => {
            const subMeta = DataManager.getSanitizedSubjectMetadata(ses, item.subject);
            const paperPath = subMeta.papers
                ? (typeof subMeta.papers === 'string' ? subMeta.papers : (subMeta.papers['default'] || subMeta.papers['A'] || Object.values(subMeta.papers).find(p => p) || ''))
                : '';

            if (paperPath) {
                validItems.push({ ...item, paperPath });
            } else {
                missingSubjects.push(item.subject);
            }
        });

        if (missingSubjects.length > 0) {
            if (validItems.length === 0) {
                Swal.fire({
                    title: 'Soru Kağıdı Bulunamadı',
                    html: `Seçilen derslerin hiçbirinde soru kağıdı yüklenmemiş:<br><br><b>${missingSubjects.join('<br>')}</b>`,
                    icon: 'error'
                });
                return;
            } else {
                const result = await Swal.fire({
                    title: 'Eksik Soru Kağıtları',
                    html: `Aşağıdaki dersler için soru kağıdı yüklü değil ve <b>atlanacak</b>:<br><br><b>${missingSubjects.join('<br>')}</b><br><br>Geri kalan <b>${validItems.length}</b> ders için yazdırmaya devam edilsin mi?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Devam Et',
                    cancelButtonText: 'İptal',
                    confirmButtonColor: '#4f46e5'
                });
                if (!result.isConfirmed) return;
            }
        }

        // Use validItems from now on
        const finalItems = validItems;

        Swal.fire({
            title: 'Yedek Kağıtlar Hazırlanıyor...',
            html: '<div id="spare-progress" style="font-size:0.9rem; color:var(--gray-600); font-weight:bold;">Motor Isınıyor...</div>',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const mergedPdf = await PDFDocument.create();

            // v5.0 Font Embedding & Fetching
            if (!window._cachedFonts) window._cachedFonts = {};
            if (!window._cachedFonts.main) {
                try {
                    const bytes = await window.getFileBytes('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf');
                    if (bytes && bytes.byteLength > 1000) window._cachedFonts.main = bytes;
                } catch (e) { console.warn('Main font fetch failed'); }
            }
            if (!window._cachedFonts.nameFont || !window._cachedFonts.schoolFont) {
                try {
                    const bytes = await window.getFileBytes('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf');
                    if (bytes && bytes.byteLength > 1000) {
                        if (!window._cachedFonts.nameFont) window._cachedFonts.nameFont = bytes;
                        if (!window._cachedFonts.schoolFont) window._cachedFonts.schoolFont = bytes;
                    }
                } catch (e) { }
            }

            if (typeof fontkit !== 'undefined') mergedPdf.registerFontkit(fontkit);
            const fallbackFont = await mergedPdf.embedFont(pdfLib.StandardFonts.HelveticaBold);
            let mainFont = null, nameFont = null, schoolFont = null;
            try {
                if (window._cachedFonts?.main) mainFont = await mergedPdf.embedFont(window._cachedFonts.main);
                if (window._cachedFonts?.nameFont) nameFont = await mergedPdf.embedFont(window._cachedFonts.nameFont);
                if (window._cachedFonts?.schoolFont) schoolFont = await mergedPdf.embedFont(window._cachedFonts.schoolFont);
            } catch (e) { /* Font embedding errors are non-critical, fallback will be used */ }
            mainFont = mainFont || fallbackFont;
            nameFont = nameFont || mainFont;
            schoolFont = schoolFont || mainFont;

            let totalPages = 0;

            for (let itemIdx = 0; itemIdx < finalItems.length; itemIdx++) {
                const item = finalItems[itemIdx];
                const subMeta = DataManager.getSanitizedSubjectMetadata(ses, item.subject);
                const designType = subMeta.pdfHeaderDesign || '1';
                const examNo = subMeta.examNo || subMeta.examNumber || '';
                const paperPath = item.paperPath;

                const progLine = document.getElementById('spare-progress');
                if (progLine) progLine.textContent = `${item.subject} (${itemIdx + 1}/${finalItems.length}) işleniyor...`;

                let paperBytes = null;
                if (paperPath) {
                    try {
                        paperBytes = await window.getFileBytes(paperPath);
                    } catch (e) { console.error(`Failed to load pdf for ${item.subject}`, e); }
                }

                let sourceDoc;
                try {
                    if (paperBytes) sourceDoc = await PDFDocument.load(paperBytes);
                    else {
                        sourceDoc = await PDFDocument.create();
                        sourceDoc.addPage([A4W, A4H]);
                    }
                } catch (e) {
                    console.error(`Failed to load or create PDF for ${item.subject}, creating blank page.`, e);
                    sourceDoc = await PDFDocument.create();
                    sourceDoc.addPage([A4W, A4H]);
                }

                const indicesToCopy = sourceDoc.getPageIndices();
                for (let copyIdx = 0; copyIdx < item.count; copyIdx++) {
                    if (progLine) progLine.textContent = `${item.subject} (${itemIdx + 1}/${finalItems.length}) - Kopya ${copyIdx + 1}/${item.count}...`;

                    const copiedPages = await mergedPdf.copyPages(sourceDoc, indicesToCopy);
                    const firstCopiedPage = copiedPages[0];
                    const { width } = firstCopiedPage.getSize();
                    const sf = width / A4W;

                    // v5.0 STERILE HEADER (No Student Data)
                    await window.renderStudentPDFHeader(mergedPdf, firstCopiedPage, {
                        subject: item.subject,
                        examNo,
                        name: '', class: '', no: '', room: '', seat: ''  // Explicitly EMPTY
                    }, {
                        mainFont, nameFont, schoolFont, sf,
                        session: ses,
                        metadata: { pdfHeaderDesign: designType, examNo },
                        designType
                    });

                    copiedPages.forEach(p => mergedPdf.addPage(p));
                    totalPages += copiedPages.length;
                }
                // Ensure sourceDoc is nullified after use to help with garbage collection
                sourceDoc = null;
            }

            if (totalPages > 0) {
                const pdfBytes = await mergedPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (win) {
                    // Opened in new tab
                } else {
                    Swal.fire({
                        title: 'Yedek Kağıtlar Hazır',
                        text: 'Döküman yeni sekmede açıldı.',
                        icon: 'success'
                    });
                }
            }
            Swal.close();
        } catch (err) {
            console.error('Yedek kağıt hatası:', err);
            Swal.fire('Hata', 'Yedek kağıtlar hazırlanırken bir sorun oluştu: ' + err.message, 'error');
        }
    };

    // Handle screen view checkbox toggle
    document.body.addEventListener('change', function (e) {
        if (!e.target) return;

        if (e.target.classList.contains('session-screen-check')) {
            const sid = e.target.getAttribute('data-id');
            const isChecked = e.target.checked;
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === sid);
            if (session) {
                session.screenViewEnabled = isChecked;
                DataManager.addExamSession(session);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: isChecked ? 'Tam ekran görünümü aktif edildi' : 'Tam ekran görünümü kapatıldı',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        }

        if (e.target.classList.contains('session-screen-limit')) {
            const sid = e.target.getAttribute('data-id');
            const limit = parseInt(e.target.value) || 8;
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === sid);
            if (session) {
                session.screenViewLimit = limit;
                DataManager.addExamSession(session);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Görünüm süresi ${limit} dk olarak güncellendi`,
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        }
    });

    window.deleteExamSession = function (id) {
        Swal.fire({
            title: 'Oturumu Sil',
            text: "Bu sınav oturum planını silmek istediğinize emin misiniz?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'İptal'
        }).then((result) => {
            if (result.isConfirmed) {
                DataManager.removeExamSession(id);
                window.renderExamSessionsList();
            }
        });
    };

    window.toggleSessionPublish = function (id) {
        // This function is kept for backward compatibility if any other part of the app calls it,
        // but it now just cycles via the new logic if needed, or we can just point it to a no-op/update logic.
        const sessions = DataManager.getExamSessions();
        const ses = sessions.find(s => s.id === id);
        if (ses) {
            // Simply toggle between published and unpublished if called this way
            window.updateSessionStatus(id, ses.isPublished ? 1 : 0);
        }
    };

    // --- School Logo Handler ---
    window.handleLogoUpload = function (input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64 = e.target.result;
                const school = DataManager.getSchoolSettings();
                DataManager.saveSchoolSettings({ ...school, logo: base64 });

                const preview = document.getElementById('schoolLogoPreview');
                if (preview) preview.innerHTML = `<img src="${base64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;

                Swal.fire({
                    icon: 'success',
                    title: 'Logo Yüklendi',
                    text: 'Okul amblemi başarıyla kaydedildi.',
                    timer: 1500,
                    showConfirmButton: false
                });
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    // ─────── PRINT HELPERS (Queue-based with PDF Overlay) ───────────
    window._printQueue = [];
    window._isProcessingPrint = false;
    window._cachedFonts = {};

    // Merkezi DataManager fonksiyonlarını kullan (Yedekleme ve Google Drive desteği için)
    window.getFileBytes = async function (url) {
        return await DataManager.getFileBytes(url);
    };

    window.loadRequiredFonts = async function (pdfDoc) {
        return await DataManager.loadRequiredFonts(pdfDoc);
    };

    window.finalizeAndPrint = (blobUrl, onFinalize = null) => {
        window.openSafePdf(blobUrl, 'Sınav Dosyası');
        if (onFinalize) onFinalize();
    };


    window.printFile = function (path, studentInfo = null) {
        if (!path) {
            Swal.fire({
                title: 'Soru Kağıdı Bulunamadı',
                text: `${studentInfo?.name ? studentInfo.name + ' için ' : ''}soru kağıdı PDF adresi girilmemiş. Lütfen ayarlardan soru kağıdı linkini ekleyin.`,
                icon: 'warning'
            });
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            window._printQueue.push({ path: path.trim(), info: studentInfo, resolve });
            if (!window._isProcessingPrint) window._processPrintQueue();
        });
    };


    window._processPrintQueue = async function () {
        if (window._printQueue.length === 0) {
            window._isProcessingPrint = false;
            return;
        }
        window._isProcessingPrint = true;
        let item = window._printQueue.shift();
        let { path, info, resolve } = item;

        // Clean & Format Path
        let printPath = path;
        if (printPath.match(/^[a-zA-Z]:\\/) || printPath.match(/^[a-zA-Z]:\//)) {
            printPath = 'file:///' + printPath.replace(/\\/g, '/');
        }

        const finalize = (iframe) => {
            if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
            if (resolve) resolve();
            setTimeout(() => window._processPrintQueue(), 1000);
        };


        let currentStep = "Dosya haz\u0131rlan\u0131yor";

        // Show a non-blocking loader for queue processing if not already showing one
        if (!Swal.isVisible()) {
            Swal.fire({
                title: 'Yazdırmaya Hazırlanıyor...',
                text: 'Lütfen bekleyin...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
        }

        try {
            // 1. Fetch PDF Bytes
            currentStep = "Soru ka\u011f\u0131d\u0131 okunuyor (" + path.split(/[\\\/]/).pop() + ")";
            const pdfBytes = await window.getFileBytes(printPath);
            if (!pdfBytes) {
                Swal.fire({ icon: 'error', title: 'Hata', text: 'Soru kağıdı verdiğiniz adreste bulunamadı' });
                if (typeof finalize === 'function') finalize(null);
                return;
            }

            // OPTIMIZATION: If we already have a blob and NO info to overlay, skip processing
            if (path.startsWith('blob:') && (!info || Object.keys(info).length === 0)) {
                return window.finalizeAndPrint(path, () => finalize(null));
            }

            // 2. Load pdf-lib and Overlay
            currentStep = "PDF i\u015fleniyor";
            if (typeof PDFLib === 'undefined') throw new Error("PDF k\u00fct\u00fcphanesi (pdf-lib) yüklenemedi.");

            const { PDFDocument, rgb, degrees } = PDFLib;
            const pdfDoc = await PDFDocument.load(pdfBytes);

            if (typeof fontkit !== 'undefined') {
                pdfDoc.registerFontkit(fontkit);
            } else {
                console.warn("Fontkit yüklenemedi, Türkçe karakterler hatalı görünebilir.");
            }

            // Fetch and embed required fonts (Optimized via shared helper)
            currentStep = "Yaz\u0131 tipleri haz\u0131rlan\u0131yor";
            const fonts = await window.loadRequiredFonts(pdfDoc);
            let { mainFont, nameFont, schoolFont } = fonts;
            const customFont = mainFont; // Used by cleanTurkishChars helper fallback check


            const school = DataManager.getSchoolSettings();
            const pages = pdfDoc.getPages();

            const docImageCache = {}; // Cache PDFImages only for THIS pdfDoc

            currentStep = "Bilgiler ekleniyor";
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                const A4_W = 595.28, A4_H = 841.89;
                const sf = 1 / Math.min(A4_W / width, A4_H / height);
                if (i === 0 && info && Object.keys(info).length > 0) {
                    await window.renderStudentPDFHeader(pdfDoc, page, info, {
                        mainFont, nameFont, schoolFont, sf,
                        metadata: info.metadata,
                        imageCache: docImageCache
                    });
                }
            }


            const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);

            if (Swal.isVisible()) {
                const title = Swal.getTitle();
                if (title && title.innerText === 'Yazdırmaya Hazırlanıyor...') Swal.close();
            }
            return window.finalizeAndPrint(blobUrl, () => finalize(null));

        } catch (e) {
            // ... (rest of error handler)
            console.error("PDF Overlay Error:", e);

            let htmlMsg = `<div style="text-align:left; font-size:0.95rem;">
                             <b>Adım:</b> ${currentStep}<br>
                             <b>Hata:</b> ${e.message}<br><br>`;

            if (printPath.includes("file://") || printPath.includes("C:") || printPath.includes("D:")) {
                htmlMsg += `<b style="color:#e11d48;">UYARI:</b> Sistemi bir internet sunucusunda çalıştırırken, bilgisayarınızdaki yerel dosyalara (C:\\ veya D:\\) erişilemez. Güvenlik nedeniyle tarayıcılar buna izin vermez.<br><br>
                 <b>ÇÖZÜM:</b> Soru kağıdı PDF'lerinizi OneDrive, Google Drive veya Firebase gibi bir buluta yükleyip <b>'Herkesin görebileceği' bir internet linkini (https://...)</b> buraya yapıştırmalısınız.`;
            } else if (printPath.includes('script.google.com') || printPath.includes('googleusercontent.com')) {
                htmlMsg += `<b style="color:#e11d48;">UYARI:</b> Google Drive / Makro bağlantısında veya dosya izinlerinde (CORS) bir hata oluştu.<br><br>
                 <b>ÇÖZÜM:</b> Sorunu aşmak için dosyayı "Yeni Sekmede" açarak manuel olarak yazdırabilirsiniz (Oturum Listesindeki yazdırma butonu bunu yapmaya çalışır)`;
            } else {
                htmlMsg += `<small><i>Dosya yolu hatalı olabilir veya internetten çektiğiniz linkin (CORS) indirme izni yoktur.</i></small>`;
            }
            htmlMsg += `</div>`;

            Swal.fire({
                title: 'Dosya Okuma uyarısı',
                html: htmlMsg,
                icon: 'warning',
                width: 600
            });

            console.warn("Attempting fallback print mechanism...");
        }

        // Fallback: Open in new window instead of hidden iframe print
        window.openSafePdf(printPath, 'Soru Kağıdı');
        finalize(null);
    };

    // ─── Toplu Soru Kağıdı ZIP İhracı ───────────────────────────────────────────
    window.exportBatchPDFs = async function (session, mode, filterValue, selectedExams = null, groupByLevel = false) {
        try {
            if (typeof JSZip === 'undefined') {
                Swal.fire('Hata', 'JSZip kütüphanesi yüklenemedi. Lütfen sayfayı ctrl+f5 ile yenileyin.', 'error');
                return;
            }

            const metadata = session.subjectMetadata || {};

            // Extract flat list of students from session.results (which is an array of Rooms)
            let allStudentsInSession = [];
            (session.results || []).forEach(room => {

                let ctr = 1;
                const seatToNum = {};
                for (let g = 1; g <= room.groups; g++) {
                    const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                    for (let r = 1; r <= cf.rows; r++) {
                        for (let c = 1; c <= cf.cols; c++) {
                            const sid = `G${g}-S${r}-C${c}`;
                            if (!(room.disabledSeats || []).includes(sid)) {
                                seatToNum[sid] = ctr++;
                            }
                        }
                    }
                }

                Object.keys(room.seats || {}).forEach(seatId => {
                    const std = room.seats[seatId];
                    if (std) {
                        allStudentsInSession.push({
                            ...std,
                            room: room.name,
                            seatNum: seatToNum[seatId] || '-'
                        });
                    }
                });
            });

            const studentsToExport = allStudentsInSession.filter(s => {
                if (!filterValue) return true;
                if (mode === 'class') return s.class === filterValue;
                if (mode === 'room') return s.room === filterValue;
                return true;
            }).filter(s => {
                const subName = s._matchedSubject || '-';
                if (selectedExams && !selectedExams.includes(subName)) return false;
                return true;
            });

            if (studentsToExport.length === 0) return;

            let validStudents = [];
            let errors = new Set();

            studentsToExport.forEach(s => {
                const subName = s._matchedSubject || '-';
                const group = s._groupLabel || s.group || 'default';
                const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
                const papers = meta.papers || {};

                let path = '';
                if (typeof papers === 'string') path = papers;
                else path = papers[group] || papers['default'] || '';

                if (path) {
                    validStudents.push({
                        path: path,
                        info: {
                            no: s.no,
                            name: s.name,
                            class: s.class,
                            room: s.room,
                            seat: s.seatNum || '-',
                            subject: subName,
                            group: group,
                            examNo: meta.examNo || meta.examNumber || ''
                        }
                    });
                } else {
                    errors.add(subName);
                }
            });

            if (errors.size > 0) {
                Swal.fire({
                    title: 'Eksik Soru Kağıdı Adresi',
                    html: `Şu dersler atlanacak (Soru kağıdı ayarlanmamış):<br><br><b>${[...errors].join('<br>')}</b>`,
                    icon: 'warning',
                    toast: true,
                    position: 'top-end',
                    timer: 5000
                });
            }

            if (validStudents.length === 0) {
                Swal.fire('Hata', 'Dışa aktarılacak geçerli soru kağıdı bulunamadı!', 'error');
                return;
            }

            // If group by level is checked, sort validStudents by grade level and subject name
            if (groupByLevel) {
                validStudents.sort((a, b) => {
                    const getGradeLevel = (subject) => {
                        const match = subject.match(/\b(9|10|11|12)\b/) || subject.match(/\d+/);
                        return match ? parseInt(match[0], 10) : 999;
                    };
                    const subA = a.info.subject || '';
                    const subB = b.info.subject || '';
                    const lvlA = getGradeLevel(subA);
                    const lvlB = getGradeLevel(subB);
                    if (lvlA !== lvlB) return lvlA - lvlB;
                    return subA.localeCompare(subB, 'tr');
                });
            }

            const zip = new JSZip();
            const school = DataManager.getSchoolSettings();

            // Prepare fonts
            if (!window._cachedFonts) window._cachedFonts = {};
            const fetchOrGet = async (key, urls) => {
                if (!window._cachedFonts[key]) {
                    for (const url of urls) {
                        try {
                            const bytes = await window.getFileBytes(url);
                            if (bytes && bytes.byteLength > 1000) { window._cachedFonts[key] = bytes; break; }
                        } catch (e) {
                            console.warn("Font fetch err for:", key, e);
                        }
                    }
                }
            };

            // Initialize combined PDF document for immediate printing
            let combinedPdfDoc = null;
            if (typeof PDFLib !== 'undefined') {
                combinedPdfDoc = await PDFLib.PDFDocument.create();
            }

            Swal.fire({
                title: 'Soru Kağıtları Hazırlanıyor',
                html: `Fontlar yükleniyor...`,
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading() }
            });

            await fetchOrGet('main', ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf']);


            const sessDom = window.currentRenderedSession || {};
            let termDom = '';
            try { const el = document.getElementById('academicTerm'); if (el) termDom = el.value; } catch (e) { }

            let successCount = 0;
            let lastError = null;
            let hadLocalFileError = false;

            // Process each student
            for (let i = 0; i < validStudents.length; i++) {
                const req = validStudents[i];
                Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name}</small>` });

                try {
                    let printPath = req.path;
                    if (printPath.match(/^[a-zA-Z]:\\/) || printPath.match(/^[a-zA-Z]:\//)) {
                        printPath = 'file:///' + printPath.replace(/\\/g, '/');
                    }
                    if (printPath.includes("file://") || printPath.includes("C:") || printPath.includes("D:")) {
                        hadLocalFileError = true;
                    }

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - PDF İndiriliyor...</small>` });
                    const pdfBytes = await window.getFileBytes(printPath);
                    if (typeof PDFLib === 'undefined') continue;

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - PDFLib Yükleniyor...</small>` });
                    const { PDFDocument, rgb } = PDFLib;
                    const pdfDoc = await PDFDocument.load(pdfBytes);
                    if (typeof fontkit !== 'undefined') pdfDoc.registerFontkit(fontkit);

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - Fontlar Gömülüyor...</small>` });
                    let mainFont = null, nameFont = null, schoolFont = null;
                    if (window._cachedFonts.main) mainFont = await pdfDoc.embedFont(window._cachedFonts.main);
                    if (window._cachedFonts.nameFont) nameFont = await pdfDoc.embedFont(window._cachedFonts.nameFont);
                    if (window._cachedFonts.schoolFont) schoolFont = await pdfDoc.embedFont(window._cachedFonts.schoolFont);

                    const fallbackPdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
                    const customFont = mainFont ? mainFont : null;
                    mainFont = mainFont || fallbackPdfFont;
                    nameFont = nameFont || mainFont;
                    schoolFont = schoolFont || mainFont;

                    Swal.update({ html: `Öğrenci işleniyor: <b>${i + 1} / ${validStudents.length}</b><br><small>${req.info.name} - Düzenleniyor...</small>` });
                    const pages = pdfDoc.getPages();
                    for (let pg = 0; pg < (pages.length > 0 ? 1 : 0); pg++) { // Only Page 1
                        const page = pages[pg];
                        const { width, height } = page.getSize();

                        const cleanTurkishChars = (text) => {
                            if (!text) return '';
                            if (customFont) return text;
                            return text.replace(/\u0130/g, 'I').replace(/\u0131/g, 'i')
                                .replace(/\u011e/g, 'G').replace(/\u011f/g, 'g').replace(/\u015e/g, 'S').replace(/\u015f/g, 's')
                                .replace(/\u00c7/g, 'C').replace(/\u00e7/g, 'c').replace(/\u00d6/g, 'O').replace(/\u00f6/g, 'o')
                                .replace(/\u00dc/g, 'U').replace(/\u00fc/g, 'u');
                        };
                        const drawCenterText = (str, cx, cy, cw, ch, sz, fnt) => {
                            if (!str) return;
                            const cl = cleanTurkishChars(str).toString();
                            const tw = fnt ? fnt.widthOfTextAtSize(cl, sz) : cl.length * (sz * 0.6);
                            const tx = cx + Math.max(0, (cw - tw) / 2);
                            const ty = cy + (ch / 2) - (sz * 0.35);
                            page.drawText(cl, { x: tx, y: ty, size: sz, font: fnt || undefined, color: rgb(0, 0, 0) });
                        };
                        const drawLeftText = (str, cx, cy, cw, ch, sz, fnt) => {
                            if (!str) return;
                            const cl = cleanTurkishChars(str).toString();
                            const tx = cx + 5;
                            const ty = cy + (ch / 2) - (sz * 0.35);
                            page.drawText(cl, { x: tx, y: ty, size: sz, font: fnt || undefined, color: rgb(0, 0, 0) });
                        };

                        const margin = 14.17; const limitY = 85.04; const outerStroke = 1.6; const strokeOffset = outerStroke / 2 + 1;
                        const ox = margin + strokeOffset; const oy = height - limitY + strokeOffset;
                        const ow = width - (margin * 2) - (strokeOffset * 2); const oh = limitY - margin - (strokeOffset * 2);
                        const gap = 2; const ix = ox + gap; const iy = oy + gap; const iw = ow - (gap * 2); const ih = oh - (gap * 2);
                        const leftW = 65; const rightW = 85; const midW = iw - leftW - rightW;
                        const row3H = 25; const row2H = 19; const row1H = ih - row3H - row2H;
                        const midCol2W = 30; const midCol4W = 30; const midCol5W = 75; const midCol6W = 30;
                        const midCol3W = midW - midCol2W - midCol4W - midCol5W - midCol6W;

                        const gradTopY = iy + row3H + row2H;
                        const strips = [{ c: 0.82, h: 4 }, { c: 0.94, h: 4 }, { c: 1.0, h: row1H - 15 }, { c: 0.94, h: 4 }, { c: 0.82, h: 3 }];
                        let curStripY = gradTopY;
                        for (let s of strips) { page.drawRectangle({ x: ix + leftW, y: curStripY, width: midW, height: s.h, color: rgb(s.c, s.c, s.c) }); curStripY += s.h; }
                        page.drawRectangle({ x: ix + leftW + midCol2W, y: iy, width: midCol3W, height: row3H, color: rgb(0.96, 0.96, 0.96) });
                        page.drawRectangle({ x: ix + leftW + midCol2W + midCol3W, y: iy, width: midW - (midCol2W + midCol3W), height: row3H, color: rgb(0.88, 0.88, 0.88) });

                        page.drawLine({ start: { x: ix + leftW, y: iy }, end: { x: ix + leftW, y: iy + ih }, thickness: 0.75 });
                        page.drawLine({ start: { x: ix + leftW + midW, y: iy }, end: { x: ix + leftW + midW, y: iy + ih }, thickness: 0.75 });
                        let curX = ix + leftW + midCol2W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); curX += midCol3W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); curX += midCol4W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 }); curX += midCol5W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: 0.75 });
                        page.drawLine({ start: { x: ix + leftW, y: iy + row3H + row2H }, end: { x: ix + leftW + midW, y: iy + row3H + row2H }, thickness: 0.75 });
                        page.drawLine({ start: { x: ix, y: iy + row3H }, end: { x: ix + leftW + midW, y: iy + row3H }, thickness: 0.75 });

                        const drawExplicitOppositeFrame = (x, y, w, h, r, thickness) => {
                            page.drawLine({ start: { x: x + r, y: y + h }, end: { x: x + w, y: y + h }, thickness });
                            page.drawLine({ start: { x: x + w, y: y + h }, end: { x: x + w, y: y + r }, thickness });
                            page.drawLine({ start: { x: x + w - r, y: y }, end: { x: x, y: y }, thickness });
                            page.drawLine({ start: { x: x, y: y }, end: { x: x, y: y + h - r }, thickness });
                            const segments = 12;
                            for (let j = 0; j < segments; j++) {
                                const a1 = Math.PI / 2 + (Math.PI / 2) * (j / segments); const a2 = Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                                page.drawLine({ start: { x: x + r + r * Math.cos(a1), y: y + h - r + r * Math.sin(a1) }, end: { x: x + r + r * Math.cos(a2), y: y + h - r + r * Math.sin(a2) }, thickness });
                            }
                            for (let j = 0; j < segments; j++) {
                                const a1 = -Math.PI / 2 + (Math.PI / 2) * (j / segments); const a2 = -Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                                page.drawLine({ start: { x: x + w - r + r * Math.cos(a1), y: y + r + r * Math.sin(a1) }, end: { x: x + w - r + r * Math.cos(a2), y: y + r + r * Math.sin(a2) }, thickness });
                            }
                        };
                        drawExplicitOppositeFrame(ox, oy, ow, oh, 6, 1.5);
                        drawExplicitOppositeFrame(ix, iy, iw, ih, 4, 0.5);

                        let sName = (school.name || '').replace(/i/g, 'İ').toUpperCase().split('').join(' ');
                        drawCenterText(sName, ix + leftW, iy + row3H + row2H, midW, row1H, 11, schoolFont);

                        const rawTermForPdf = (sessDom.academicTerm || termDom || '').trim();
                        const termNumForPdf = (() => {
                            const s = rawTermForPdf.toUpperCase();
                            if (/\bII\b/.test(s) || /\b2\b/.test(s) || s.startsWith('II.') || s.startsWith('2.')) return 2;
                            return 1;
                        })();
                        const subNorm = (req.info.subject || '').replace(/İ/g,'i').replace(/I/g,'ı').replace(/ı/g,'i').toLowerCase();
                        let termStr;
                        if (subNorm.includes('ingilizce') || subNorm.includes('english')) {
                            termStr = termNumForPdf === 2 ? '2nd Term' : '1st Term';
                        } else if (subNorm.includes('almanca') || subNorm.includes('deutsch')) {
                            termStr = termNumForPdf === 2 ? '2. Halbjahr' : '1. Halbjahr';
                        } else if (subNorm.includes('fransizca') || subNorm.includes('francais')) {
                            termStr = termNumForPdf === 2 ? '2ème Semestre' : '1er Semestre';
                        } else {
                            termStr = termNumForPdf === 2 ? 'II. DÖNEM' : 'I. DÖNEM';
                        }

                        const examNoStr = req.info.examNo || '';
                        let examText;
                        if (subNorm.includes('ingilizce') || subNorm.includes('english')) {
                            const getOrd = (n) => { const s=["th","st","nd","rd"],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
                            const engExamNo = getOrd(parseInt(examNoStr) || 1);
                            const gradeLevel = (req.info.subject || '').match(/\d+/);
                            const gradeStr = gradeLevel ? ` FOR ${getOrd(parseInt(gradeLevel[0]))} GRADERS` : '';
                            let subClean = (req.info.subject || '').replace(/\d+/g,'').replace(/İ/g,'i').toLowerCase();
                            subClean = subClean.charAt(0).toUpperCase() + subClean.slice(1).trim();
                            examText = `${school.academicYear || ''} ACADEMIC YEAR ${termStr} ${engExamNo} ${subClean} EXAM${gradeStr}`.toUpperCase();
                        } else if (subNorm.includes('almanca') || subNorm.includes('deutsch')) {
                            examText = `${school.academicYear || ''} SCHULJAHR ${termStr} ${(req.info.subject||'').toUpperCase()} ${examNoStr ? `${examNoStr}. ` : ''}SCHRIFTLICHE PRÜFUNG`.toUpperCase();
                        } else if (subNorm.includes('fransizca') || subNorm.includes('francais')) {
                            examText = `${school.academicYear || ''} ANNÉE SCOLAIRE ${termStr} ${(req.info.subject||'').toUpperCase()} ${examNoStr ? `${examNoStr}. ` : ''}EXAMEN ÉCRIT`.toUpperCase();
                        } else {
                            examText = `${school.academicYear || ''} ÖĞRETİM YILI ${termStr} ${req.info.subject || ''} DERSİ ${examNoStr ? `${examNoStr}. ` : ''}YAZILI SINAVI`.trim().toUpperCase();
                        }

                        let row2Sz = 14;
                        let examTextWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(examText), row2Sz) : examText.length * (row2Sz * 0.6);
                        while (examTextWidth > (midW - 10) && row2Sz > 5) {
                            row2Sz -= 0.5; examTextWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(examText), row2Sz) : examText.length * (row2Sz * 0.6);
                        }
                        drawCenterText(examText, ix + leftW, iy + row3H, midW, row2H, row2Sz, mainFont);

                        drawCenterText(req.info.class, ix, iy, leftW, row3H, 16, mainFont);
                        drawCenterText(req.info.no, ix + leftW, iy, midCol2W, row3H, 12, mainFont);

                        let nameStr = req.info.name.replace(/i/g, 'İ').toUpperCase();
                        let nameSz = 28;
                        let nameWidth = nameFont ? nameFont.widthOfTextAtSize(cleanTurkishChars(nameStr), nameSz) : nameStr.length * (nameSz * 0.5);
                        while (nameWidth > (midCol3W - 15) && nameSz > 8) {
                            nameSz -= 0.5; nameWidth = nameFont ? nameFont.widthOfTextAtSize(cleanTurkishChars(nameStr), nameSz) : nameStr.length * (nameSz * 0.5);
                        }
                        if (nameSz > 24) nameSz = 24;
                        drawLeftText(nameStr, ix + leftW + midCol2W, iy, midCol3W, row3H, nameSz, nameFont);
                        drawLeftText(nameStr, ix + leftW + midCol2W + 0.3, iy, midCol3W, row3H, nameSz, nameFont);
                        drawLeftText(nameStr, ix + leftW + midCol2W + 0.6, iy, midCol3W, row3H, nameSz, nameFont);

                        page.drawText("DERSLİK", { x: ix + leftW + midCol2W + midCol3W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                        page.drawText("SINAV", { x: ix + leftW + midCol2W + midCol3W + midCol4W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                        page.drawText("YER", { x: ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W + 2, y: iy + row3H - 6.5, size: 5.5, font: mainFont, color: rgb(0.4, 0.4, 0.4) });

                        drawCenterText(req.info.room, ix + leftW + midCol2W + midCol3W, iy - 2.5, midCol4W, row3H, 11, mainFont);
                        drawCenterText((req.info.subject || '').toUpperCase(), ix + leftW + midCol2W + midCol3W + midCol4W, iy - 2.5, midCol5W, row3H, 9.5, mainFont);
                        drawCenterText(req.info.seat, ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W, iy - 2.5, midCol6W, row3H, 14, mainFont);
                        page.drawText("PUAN", { x: ix + leftW + midW + 5, y: iy + ih - 10, size: 7, font: mainFont, color: rgb(0.5, 0.5, 0.5) });

                        // 5. LOGO
                        if (school.logo) {
                            try {
                                const logoBytes = await window.getFileBytes(school.logo);
                                let logoImage;
                                if (school.logo.includes('image/png') || school.logo.toLowerCase().endsWith('.png')) logoImage = await pdfDoc.embedPng(logoBytes);
                                else logoImage = await pdfDoc.embedJpg(logoBytes);
                                const logoDim = 26; const lx = ix + (leftW - logoDim) / 2; const ly = iy + row3H + (row2H + row1H - logoDim) / 2;
                                page.drawImage(logoImage, { x: lx, y: ly, width: logoDim, height: logoDim });
                            } catch (e) { }
                        }
                    }

                    const outBytes = await pdfDoc.save();
                    const fileName = `${req.info.class} ${req.info.no} ${req.info.name}.pdf`.replace(/[\/\\]/g, '-');
                    zip.file(fileName, outBytes);
                    successCount++;

                    // Add to combined document for immediate printing
                    if (combinedPdfDoc) {
                        const copiedPages = await combinedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
                        copiedPages.forEach((page) => combinedPdfDoc.addPage(page));

                        // DEUBL-SIDED PRINTING FIX: If odd pages, add a blank page so next student starts on a new sheet
                        if (copiedPages.length % 2 !== 0) {
                            combinedPdfDoc.addPage();
                        }
                    }

                } catch (e) {
                    console.error("Batch PDF err:", req.info.name, e);
                    lastError = e;
                }
            }

            if (successCount === 0) {
                let errorHtml = `<div style="text-align:left; font-size:0.95rem;">`;
                if (hadLocalFileError) {
                    errorHtml += `<b style="color:#e11d48;">UYARI:</b> Sistemi Vercel gibi bir internet sunucusunda çalıştırırken, bilgisayarınızdaki yerel dosyalara (C:\\ veya D:\\ vb.) erişilemez. Tarayıcı internet üzerindeki bir sitenin sizin yerel diskinize sızmasını engeller.<br><br>
                 <b>ÇÖZÜM:</b> Soru kağıdı PDF'lerinizi OneDrive, Google Drive veya Supabase depolama sistemine yükleyip, herkesin erişebileceği (https:// ile başlayan) linkleri ayarlardaki Soru Kağıdı bölümüne yapıştırmalısınız.`;
                } else {
                    errorHtml += `Hiçbir soru kağıdı indirilemedi. Dosya yolu hatalı, internet linkiniz kopuk veya (CORS) indirme izni ayarlanmamış olabilir.<br><br><b>Detay:</b> ${lastError ? lastError.message : 'Bilinmeyen Hata'}`;
                }
                errorHtml += `</div>`;

                Swal.fire({
                    title: 'Soru Kağıtları İndirilemedi',
                    html: errorHtml,
                    icon: 'error',
                    width: 600
                });
                return;
            }

            Swal.update({ html: `ZIP Dosyası Sıkıştırılıyor... Lütfen Bekleyin.` });
            try {
                const content = await zip.generateAsync({ type: "blob" });
                let modeSuffix = '';
                if (filterValue) {
                    if (mode === 'class') modeSuffix = ' Sınıfı';
                    if (mode === 'room') modeSuffix = ' Salonu';
                }
                const finalName = filterValue ? `Soru_Kagitlari_${filterValue.replace(/[\/\\]/g, '-')}${modeSuffix}.zip` : `Soru_Kagitlari_Tumu.zip`;

                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = finalName;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => document.body.removeChild(link), 100);

                let successMsg = `${successCount} adet soru kağıdı '${finalName}' olarak indirildi. Yazdırılıyor...`;
                if (successCount < validStudents.length) {
                    successMsg += `<br><br><small style="color:#e11d48;">Dikkat: ${validStudents.length - successCount} adet kağıt bağlantı hatası nedeniyle atlandı.</small>`;
                }

                Swal.fire({
                    title: 'Başarılı!',
                    html: successMsg,
                    icon: 'success',
                    timer: 4000,
                    showConfirmButton: false
                });

                // Trigger direct print of the combined PDF
                if (combinedPdfDoc && combinedPdfDoc.getPageCount() > 0) {
                    const combinedBytes = await combinedPdfDoc.save();
                    const sumBlob = new Blob([combinedBytes], { type: 'application/pdf' });
                    const sumUrl = URL.createObjectURL(sumBlob);

                    const newWin = window.open(sumUrl, '_blank');
                    if (!newWin) {
                        Swal.fire('Hata', 'Yeni sekme açılamadı! Lütfen tarayıcı ayarlarından açılır pencerelere izin verin.', 'error');
                    }
                }

            } catch (globalErr) {
                console.error("Global JSZip err:", globalErr);
                Swal.fire({
                    title: 'Kritik İhracat Hatası',
                    html: `Toplu indirme işleminde beklenmeyen bir hata oluştu:<br><br><b>${globalErr.message}</b><br><br><small>Tarayıcı konsolunu kontrol edin.</small>`,
                    icon: 'error'
                });
            }
        } catch (setupErr) {
            console.error(setupErr);
            Swal.fire('Hata', setupErr.message, 'error');
        }
    };

    window.getEffectiveSubjectGroupCount = function (session, subName) {
        if (!session || !subName) return 1;
        const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
        const papers = meta.papers || {};
        if (typeof papers === 'string') {
            return 1;
        }
        if (typeof papers === 'object' && papers !== null) {
            const filledKeys = Object.keys(papers).filter(k => typeof papers[k] === 'string' && papers[k].trim().length > 0);
            return filledKeys.length > 0 ? filledKeys.length : 1;
        }
        return 1;
    };
    const getEffectiveSubjectGroupCount = window.getEffectiveSubjectGroupCount;

    // ─── Oturumu Yazdır ────────────────────────────────────────────────────────
    window.printSessionDistribution = async function (id, filterValue = null, forcePrintPapers = false) {
        let selectedExams = null;
        let selectedGroupByLevel = false;
        const session = DataManager.getExamSessions().find(s => s.id === id);
        if (!session || !session.results) {
            Swal.fire('Bilgi', 'Bu oturum için dağıtım henüz yapılmamış.', 'info');
            return;
        }
        window.currentRenderedSession = session;

        // Seçili modu DOM'dan oku
        const modeEl = document.getElementById(`mode-select-${id}`);
        const mode = modeEl ? modeEl.value : (session.type === 'uygulama' ? 'class' : 'seating');

        // SESSION-WIDE BATCH PRINT DETECTION
        // Ask for Print options if general print (no filterValue)
        if (!filterValue) {
            const modeLabelsMap = { class: 'Sınıf', room: 'Salon', seating: 'Şema' };
            const result = await Swal.fire({
                title: 'Yazdırma Seçenekleri',
                html: `<div style="text-align: left; font-size: 10.5pt; color: #1e293b; line-height: 1.5;">
                        Tüm <b>${modeLabelsMap[mode]}</b> listeleri yazdırılacaktır.<br>
                        Onaylıyor musunuz?<br><br>
                        <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: ${(session.type !== 'uygulama' || mode === 'class') ? 'block' : 'none'};">
                            <label style="display: flex; align-items: center; gap:10px; cursor: pointer; font-weight: 700; color:var(--primary);">
                                <input type="checkbox" id="meta-batch-paper-print" style="width: 20px; height: 20px;">
                                <i class="fa-solid fa-file-pdf" style="font-size:1.2rem; color:var(--secondary);"></i> Soru Kağıdı Yazdır (Toplu)
                            </label>
                        </div>
                       </div>`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-print"></i> Evet, Yazdır',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#6366f1',
                preConfirm: () => {
                    const cb = document.getElementById('meta-batch-paper-print');
                    return {
                        batchPaperPrintEnabled: cb ? cb.checked : false
                    }
                }
            });

            if (!result.isConfirmed) return;

            // Update session and local flag
            session.batchPaperPrintEnabled = result.value.batchPaperPrintEnabled;
            DataManager.addExamSession(session);
        }

        const isSessionWideBatch = !filterValue && session.batchPaperPrintEnabled && mode !== 'seating';

        if (isSessionWideBatch) {
            // 1. Get List of Groups
            let groups = [];
            if (mode === 'class') {
                const classSet = new Set();
                session.results.forEach(r => Object.values(r.seats || {}).forEach(s => classSet.add(s.class)));
                groups = Array.from(classSet).sort(sortByNum);
            } else if (mode === 'room') {
                groups = session.results.map(r => r.name).sort(sortByNum);
            }

            if (groups.length === 0) {
                Swal.fire('Hata', 'Yazdırılacak grup (Sınıf/Salon) bulunamadı.', 'error');
                return;
            }

            // PAPER STATUS CHECK
            const metadata = session.subjectMetadata || {};
            const missing = new Set();
            const loaded = new Set();
            session.results.forEach(room => {
                Object.values(room.seats || {}).forEach(s => {
                    const sub = s._matchedSubject || '-';
                    if (sub === '-') return;
                    const meta = DataManager.getSanitizedSubjectMetadata(session, sub);
                    const papers = meta.papers || {};
                    const hasPaper = typeof papers === 'string' ? papers.trim().length > 0 : Object.values(papers).some(p => typeof p === 'string' && p.trim().length > 0);
                    if (hasPaper) loaded.add(sub);
                    else missing.add(sub);
                });
            });

            let statusHtml = '';
            if (missing.size > 0 || loaded.size > 0) {
                statusHtml = '<div style="text-align:left; font-size:0.85rem; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin:10px 0;">';
                statusHtml += '<div style="font-weight:900; color:var(--primary); margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">Soru Kağıdı Durumu:</div>';
                if (loaded.size > 0) statusHtml += `<div><b style="color:#16a34a;">Yüklü:</b> ${Array.from(loaded).sort().join(', ')}</div>`;
                if (missing.size > 0) statusHtml += `<div style="margin-top:5px;"><b style="color:var(--danger);">EKSİK:</b> ${Array.from(missing).sort().join(', ')}</div>`;
                statusHtml += '</div>';
            }

            const hasAnyLoaded = loaded.size > 0;
            // 2. Ask for Mode
            const result = await Swal.fire({
                title: 'Toplu Yazdırma Başlatılsın mı?',
                html: hasAnyLoaded
                    ? `<b>${groups.length}</b> adet ${mode === 'class' ? 'sınıf' : 'salon'} grubu sırayla yazdırılacak.${statusHtml ? statusHtml : ''}<br>Yazdırma yöntemini seçin:`
                    : `<div style="color:var(--danger); font-weight:bold; margin-bottom:10px;">UYARI: Bu oturum için hiçbir soru kağıdı yüklenmemiş.</div>${statusHtml}`,
                icon: hasAnyLoaded ? 'question' : 'error',
                showConfirmButton: hasAnyLoaded,
                showDenyButton: hasAnyLoaded,
                showCancelButton: true,
                confirmButtonText: 'Sürekli (Otomatik)',
                denyButtonText: 'Duraklamalı (Onaylı)',
                cancelButtonText: hasAnyLoaded ? 'İptal' : 'Kapat',
                confirmButtonColor: '#4f46e5',
                denyButtonColor: '#6366f1'
            });

            if (result.isDismissed) return;

            const isPaused = result.isDenied;

            // 3. Process Each Group
            for (let i = 0; i < groups.length; i++) {
                const groupName = groups[i];

                if (!isPaused) {
                    // Small toast for continuous progress
                    Swal.fire({
                        title: 'Toplu Yazdırma',
                        html: `İşleniyor: <b>${groupName}</b> (${i + 1} / ${groups.length})`,
                        timer: 1500,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                    await new Promise(r => setTimeout(r, 1000));
                }

                // Call self for individual group with forcePrintPapers enabled
                await window.printSessionDistribution(id, groupName, true);

                if (isPaused && i < groups.length - 1) {
                    const nextG = groups[i + 1];
                    const confirmNext = await Swal.fire({
                        title: `Sıradaki: ${nextG}`,
                        html: `<b>${groupName}</b> tamamlandı.<br>Sonraki gruba geçilsin mi?<br><br><small>${i + 2} / ${groups.length}</small>`,
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Evet, Devam',
                        cancelButtonText: 'Durdur'
                    });
                    if (!confirmNext.isConfirmed) break;
                }
            }
            return; // Exit session-wide flow
        }

        // BATCH EXPORT INTERCEPT
        let isBulkExportChecked = false;
        if (filterValue) {
            const cbClass = document.querySelector(`.class-paper-check[data-class="${filterValue}"]`);
            const cbRoom = document.querySelector(`.room-paper-check[data-room="${filterValue}"]`);
            if (cbClass && cbClass.checked) isBulkExportChecked = true;
            if (cbRoom && cbRoom.checked) isBulkExportChecked = true;
        }

        // If bulk export (Class/Room level paper check) is on, ask for Print vs ZIP
        if (isBulkExportChecked && !forcePrintPapers) {
            // PAPER STATUS CHECK for this group
            const metadata = session.subjectMetadata || {};
            const missing = new Set();
            const loaded = new Set();
            session.results.forEach(room => {
                Object.values(room.seats || {}).forEach(s => {
                    if (mode === 'class' && s.class !== filterValue) return;
                    if (mode === 'room' && room.name !== filterValue) return;
                    if (mode === 'seating' && room.name !== filterValue) return;
                    const sub = s._matchedSubject || '-';
                    if (sub === '-') return;
                    const meta = DataManager.getSanitizedSubjectMetadata(session, sub);
                    const papers = meta.papers || {};
                    const hasPaper = typeof papers === 'string' ? papers.trim().length > 0 : Object.values(papers).some(p => typeof p === 'string' && p.trim().length > 0);
                    if (hasPaper) loaded.add(sub);
                    else missing.add(sub);
                });
            });

            let statusHtml = '';
            if (missing.size > 0 || loaded.size > 0) {
                statusHtml = '<div style="text-align:left; font-size:0.85rem; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin:10px 0;">';
                if (loaded.size > 0) statusHtml += `<div><b style="color:#16a34a;">Yüklü:</b> ${Array.from(loaded).sort().join(', ')}</div>`;
                if (missing.size > 0) statusHtml += `<div style="margin-top:5px;"><b style="color:var(--danger);">EKSİK:</b> ${Array.from(missing).sort().join(', ')}</div>`;
                statusHtml += '</div>';
            }

            const hasAnyLoaded = loaded.size > 0;
            
            let selectionHtml = '';
            if (hasAnyLoaded) {
                const allExams = Array.from(new Set([...loaded, ...missing])).sort((a, b) => {
                    const getGradeLevel = (subject) => {
                        const match = subject.match(/\b(9|10|11|12)\b/) || subject.match(/\d+/);
                        return match ? parseInt(match[0], 10) : 999;
                    };
                    const lvlA = getGradeLevel(a);
                    const lvlB = getGradeLevel(b);
                    if (lvlA !== lvlB) return lvlA - lvlB;
                    return a.localeCompare(b, 'tr');
                });
                
                selectionHtml = `
                    <div style="margin-top: 15px; margin-bottom: 15px; text-align: left; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <label style="display: flex; align-items: center; gap: 10px; font-weight: 700; cursor: pointer; color: var(--primary);">
                            <input type="checkbox" id="swal-group-by-level" style="width: 18px; height: 18px; accent-color: var(--primary);">
                            Düzey Düzey Gruplandır
                        </label>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px; margin-left: 28px; line-height: 1.3;">
                            Soru kağıtları düzey düzey (örneğin önce Fizik 9, sonra Fizik 10, Fizik 11 vb.) gruplandırılarak sırayla yazdırılır.
                        </div>
                    </div>
                    
                    <div style="text-align: left; margin-bottom: 15px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <div style="font-weight: 700; font-size: 0.9rem; color: #1e293b; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
                            Yazdırılacak Sınavlar
                        </div>
                        <div style="max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
                            ${allExams.map(sub => {
                                const hasPaper = loaded.has(sub);
                                const isChecked = hasPaper ? 'checked' : '';
                                const paperStatusHtml = hasPaper 
                                    ? `<span style="color: #16a34a; font-size: 0.75rem; font-weight: bold; margin-left: auto;"><i class="fa-solid fa-circle-check"></i> Soru Kağıdı Var</span>` 
                                    : `<span style="color: #ef4444; font-size: 0.75rem; font-weight: bold; margin-left: auto;"><i class="fa-solid fa-circle-xmark"></i> Soru Kağıdı Yok!</span>`;
                                return `
                                    <label style="display: flex; align-items: center; gap: 10px; cursor: ${hasPaper ? 'pointer' : 'not-allowed'}; font-size: 0.85rem; color: ${hasPaper ? '#1e293b' : '#94a3b8'}; padding: 4px 6px; border-radius: 4px; transition: background 0.2s;">
                                        <input type="checkbox" class="swal-exam-checkbox" data-subject="${sub}" ${isChecked} ${hasPaper ? '' : 'disabled'} style="width: 16px; height: 16px; accent-color: var(--primary);">
                                        <span style="font-weight: 600;">${sub}</span>
                                        ${paperStatusHtml}
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            const choiceResult = await Swal.fire({
                title: 'Yazdırma Seçeneği',
                html: hasAnyLoaded
                    ? `<b>${filterValue}</b> için soru kağıtları ne yapılsın?${statusHtml}${selectionHtml}`
                    : `<div style="color:var(--danger); font-weight:bold; margin-bottom:10px;">UYARI: Bu grup için henüz hiçbir soru kağıdı yüklenmemiş.</div>${statusHtml}`,
                icon: hasAnyLoaded ? 'question' : 'error',
                showConfirmButton: hasAnyLoaded,
                showDenyButton: hasAnyLoaded,
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-print"></i> Sırayla Yazdır',
                denyButtonText: '<i class="fa-solid fa-file-zipper"></i> ZIP İndir',
                cancelButtonText: hasAnyLoaded ? 'İptal' : 'Kapat',
                confirmButtonColor: '#4f46e5',
                denyButtonColor: '#10b981',
                preConfirm: () => {
                    selectedGroupByLevel = document.getElementById('swal-group-by-level')?.checked || false;
                    selectedExams = Array.from(document.querySelectorAll('.swal-exam-checkbox:checked')).map(cb => cb.dataset.subject);
                    return true;
                },
                preDeny: () => {
                    selectedGroupByLevel = document.getElementById('swal-group-by-level')?.checked || false;
                    selectedExams = Array.from(document.querySelectorAll('.swal-exam-checkbox:checked')).map(cb => cb.dataset.subject);
                    return true;
                }
            });

            if (choiceResult.isConfirmed) {
                forcePrintPapers = true;
            } else if (choiceResult.isDenied) {
                setTimeout(() => window.exportBatchPDFs(session, mode, filterValue, selectedExams, selectedGroupByLevel), 100);
                return; // Exit, as user chose ZIP
            } else {
                return; // User cancelled
            }
        }


        const printPapersForGroupBatch = async (targetStudents, session, groupLabel) => {
            const { PDFLib, fontkit } = window;
            const { PDFDocument } = PDFLib;
            Swal.fire({
                title: `${groupLabel} Hazırlanıyor...`,
                html: `Öğrenci kağıtları birleştiriliyor, lütfen bekleyin.<br><br><div id="batch-progress" style="font-weight:bold; font-size:1.2rem;">0 / ${targetStudents.length}</div>`,
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
            try {
                const mergedPdf = await PDFDocument.create();
                if (fontkit) mergedPdf.registerFontkit(fontkit);
                const fonts = await window.loadRequiredFonts(mergedPdf);
                const imageCache = {}; // Local image cache for this merged document
                const docCache = {}; // Local document object cache for this batch

                // PRE-SCAN: Load PDFs and find max page count to determine double-sided printing needs
                let maxPageCount = 1;
                for (let i = 0; i < targetStudents.length; i++) {
                    const s = targetStudents[i];
                    const subName = s._matchedSubject || '-';
                    const groupLabel_s = s._groupLabel || s.group || 'default';
                    const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
                    if (!meta) continue;
                    const papers = meta.papers || {};
                    let path = typeof papers === 'string' ? papers : (papers[groupLabel_s] || papers['default'] || '');
                    if (!path) continue;
                    if (path.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac)$/)) continue;
                    let printPath = path;
                    if (printPath.match(/^[a-zA-Z]:\\/) || printPath.match(/^[a-zA-Z]:\//)) printPath = 'file:///' + printPath.replace(/\\/g, '/');

                    if (!docCache[printPath]) {
                        try {
                            if (!window._pdfTemplateCache) window._pdfTemplateCache = {};
                            let bytes = window._pdfTemplateCache[printPath];
                            if (!bytes) {
                                bytes = await window.getFileBytes(printPath);
                                window._pdfTemplateCache[printPath] = bytes;
                            }
                            if (bytes) docCache[printPath] = await PDFDocument.load(bytes);
                        } catch (e) {}
                    }
                    if (docCache[printPath]) {
                        const pc = docCache[printPath].getPageCount();
                        if (pc > maxPageCount) maxPageCount = pc;
                    }
                }
                const isDoubleSidedMode = maxPageCount > 1;

                for (let i = 0; i < targetStudents.length; i++) {
                    // YIELD TO BROWSER TO PREVENT UI FREEZING
                    if (i % 5 === 0) await new Promise(r => setTimeout(r, 5));

                    const s = targetStudents[i];
                    const progressEl = document.getElementById('batch-progress');
                    if (progressEl) progressEl.innerText = `${i + 1} / ${targetStudents.length}`;
                    const subName = s._matchedSubject || '-';
                    const groupLabel_s = s._groupLabel || s.group || 'default';
                    const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
                    if (!meta) continue;

                    const papers = meta.papers || {};
                    let path = typeof papers === 'string' ? papers : (papers[groupLabel_s] || papers['default'] || '');
                    if (!path) continue;
                    if (path.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac)$/)) continue;
                    let printPath = path;
                    if (printPath.match(/^[a-zA-Z]:\\/) || printPath.match(/^[a-zA-Z]:\//)) printPath = 'file:///' + printPath.replace(/\\/g, '/');

                    let studentPdf;
                    try {
                        if (docCache[printPath]) {
                            studentPdf = docCache[printPath];
                        } else {
                            if (!window._pdfTemplateCache) window._pdfTemplateCache = {};
                            let bytes;
                            if (window._pdfTemplateCache[printPath]) {
                                bytes = window._pdfTemplateCache[printPath];
                            } else {
                                bytes = await window.getFileBytes(printPath);
                                window._pdfTemplateCache[printPath] = bytes;
                            }
                            if (bytes) {
                                studentPdf = await PDFDocument.load(bytes);
                                docCache[printPath] = studentPdf;
                            }
                        }
                    } catch (e) { console.error("PDF Template Load Error:", printPath, e); continue; }
                    if (!studentPdf) continue;

                    const pages = await mergedPdf.copyPages(studentPdf, studentPdf.getPageIndices());

                    const studentInfo = {
                        no: s.no, name: s.name, class: s.class, room: s.room,
                        seat: s.seatNum || s.seat || '-', subject: subName, group: groupLabel_s,
                        examNo: meta.examNo || meta.examNumber || ''
                    };
                    const firstPage = pages[0];
                    const { width, height } = firstPage.getSize();
                    const A4_W = 595.28, A4_H = 841.89;
                    const sf = 1 / Math.min(A4_W / width, A4_H / height);
                    await window.renderStudentPDFHeader(mergedPdf, firstPage, studentInfo, { ...fonts, sf, session: session, metadata: meta, imageCache });
                    pages.forEach(p => mergedPdf.addPage(p));
                    if (isDoubleSidedMode && pages.length % 2 !== 0) {
                        mergedPdf.addPage([A4_W, A4_H]);
                    }
                }
                if (mergedPdf.getPageCount() === 0) {
                    Swal.fire('Bilgi', 'Bu grup için yazdırılacak PDF sayfası bulunamadı. Lütfen geçerli bir soru kağıdı yüklediğinizden emin olun.', 'warning');
                    return;
                }
                const mergedBytes = await mergedPdf.save();
                const blob = new Blob([mergedBytes], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                await new Promise((resolve) => {
                    Swal.fire({
                        title: 'Kağıtlar Hazır',
                        html: `PDF dosyası başarıyla oluşturuldu.<br><br>
                               <button id="direct-print-btn" style="background:#4f46e5; color:white; padding:12px; border-radius:8px; font-weight:bold; font-size:1.1rem; margin-top:10px; width:100%; border:none; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px;">
                                   <span><i class="fa-solid fa-print"></i> Yazdır</span>
                                   <span style="font-size:0.85rem; font-weight:normal;">Lütfen Yazıcınızı <u style="font-weight:bold;">${isDoubleSidedMode ? 'Arkalı Önlü' : 'Tek Yüze'}</u> Yazdıracak Şekilde Ayarlayın.</span>
                               </button>`,
                        icon: 'success',
                        showConfirmButton: false,
                        showCancelButton: true,
                        cancelButtonText: 'Kapat',
                        allowOutsideClick: false,
                        didOpen: () => {
                            const btn = document.getElementById('direct-print-btn');
                            if (btn) {
                                btn.addEventListener('click', () => {
                                    window.finalizeAndPrint(blobUrl);
                                    Swal.close();
                                });
                            }
                        }
                    }).then(() => resolve());
                });


                // Clear temporary batch cache
                window._pdfTemplateCache = {};
            } catch (err) {
                console.error("Batch Merge Error:", err);
                Swal.fire('Hata', 'Toplu PDF oluşturulurken hata: ' + err.message, 'error');
            }
        };

        // AUTOMATIC PAPER PRINTING HELPER
        const printPapersForGroup = async (fVal) => {
            const metadata = session.subjectMetadata || {};
            let allStudentsInSession = [];
            (session.results || []).forEach(room => {
                let ctr = 1; const seatToNum = {};
                for (let g = 1; g <= room.groups; g++) {
                    const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                    for (let r = 1; r <= cf.rows; r++)
                        for (let c = 1; c <= cf.cols; c++) {
                            const sid = `G${g}-S${r}-C${c}`;
                            if (!(room.disabledSeats || []).includes(sid)) seatToNum[sid] = ctr++;
                        }
                }
                Object.entries(room.seats).forEach(([sid, s]) => {
                    allStudentsInSession.push({ ...s, room: room.name, seat: seatToNum[sid] || '-' });
                });
            });

            const studentsInFilter = allStudentsInSession.filter(s => {
                if (mode === 'class') return s.class === fVal;
                if (mode === 'room') return s.room === fVal;
                if (mode === 'seating') return s.room === fVal;
                return true;
            }).filter(s => {
                const subName = s._matchedSubject || '-';
                if (selectedExams && !selectedExams.includes(subName)) return false;
                return true;
            });

            if (selectedGroupByLevel) {
                studentsInFilter.sort((a, b) => {
                    const getGradeLevel = (subject) => {
                        const match = subject.match(/\b(9|10|11|12)\b/) || subject.match(/\d+/);
                        return match ? parseInt(match[0], 10) : 999;
                    };
                    const subA = a._matchedSubject || '';
                    const subB = b._matchedSubject || '';
                    const lvlA = getGradeLevel(subA);
                    const lvlB = getGradeLevel(subB);
                    if (lvlA !== lvlB) return lvlA - lvlB;
                    return subA.localeCompare(subB, 'tr');
                });
            }

            // QUICK VALIDATION
            const validStudents = [];
            const missingExams = new Set();
            studentsInFilter.forEach(s => {
                const subName = s._matchedSubject || '-';
                const group = s._groupLabel || s.group || 'default';
                const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
                const papers = meta.papers || {};
                let path = typeof papers === 'string' ? papers : (papers[group] || papers['default'] || '');
                if (path) {
                    validStudents.push(s);
                } else {
                    missingExams.add(subName);
                }
            });

            if (validStudents.length === 0) {
                Swal.fire({
                    title: 'Soru Kağıdı Bulunamadı',
                    html: `Bu listedeki hiçbir sınav için soru kağıdı yüklenmemiş!<br><br>Eksik Dersler:<br><b>${Array.from(missingExams).join('<br>')}</b>`,
                    icon: 'error'
                });
                return;
            }

            if (missingExams.size > 0) {
                const result = await Swal.fire({
                    title: 'Eksik Soru Kağıtları',
                    html: `Bazı sınavlar için soru kağıdı adresi girilmemiş ve <b>atlanacak</b>:<br><br><b>${Array.from(missingExams).join('<br>')}</b><br><br>Geri kalan <b>${validStudents.length}</b> öğrenci için yazdırmaya devam edilsin mi?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Devam Et',
                    cancelButtonText: 'İptal',
                    confirmButtonColor: '#4f46e5'
                });
                if (!result.isConfirmed) return;
            }

            // USE BATCH PRINTING INSTEAD OF INDIVIDUAL
            await printPapersForGroupBatch(validStudents, session, `${mode === 'class' ? 'Sınıf' : 'Salon'}: ${fVal}`);
        };


        const modeLabels = { class: 'Sınıf', room: 'Salon', seating: 'Şema' };
        const modeLabel = modeLabels[mode];
        const isSeating = mode === 'seating';

        // ─────── SORU KAĞIDI YAZDIRMA (MANUEL SEÇİM INTERCEPT) ─────────
        // Eğer öğrenci checkboxları seçiliyse listeyi değil, kağıtları yazdır/aç. (Batch export harici manuel seçimler)
        const checkedStudents = Array.from(document.querySelectorAll('.student-paper-check:checked')).filter(cb => {
            if (!filterValue) return true; // Genel liste, hepsini al
            const currentMode = modeEl ? modeEl.value : 'class';
            if (currentMode === 'class') return cb.dataset.class === filterValue;
            if (currentMode === 'room') return cb.dataset.room === filterValue;
            if (currentMode === 'seating') return cb.dataset.room === filterValue;
            return true;
        });

        if (checkedStudents.length > 0 && !isBulkExportChecked && !forcePrintPapers) {
            const metadata = session.subjectMetadata || {};
            let errors = [];
            const targetStudents = [];

            checkedStudents.forEach(cb => {
                const subName = cb.dataset.sub;
                const group = cb.dataset.group || 'default';
                const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
                const papers = meta.papers || {};

                let path = '';
                if (typeof papers === 'string') path = papers;
                else path = papers[group] || papers['default'] || '';

                if (path) {
                    targetStudents.push({
                        no: cb.dataset.studentNo,
                        name: cb.dataset.studentName,
                        class: cb.dataset.class,
                        room: cb.dataset.room,
                        seat: cb.dataset.seat || cb.dataset.seatNum || '-',
                        _matchedSubject: subName,
                        _groupLabel: group,
                        examNo: meta.examNo || meta.examNumber || ''
                    });
                } else {
                    errors.push(subName);
                }
            });

            if (errors.length > 0) {
                const uniqueErrors = [...new Set(errors)];
                if (targetStudents.length === 0) {
                    Swal.fire({
                        title: 'Soru Kağıdı Hatası',
                        html: `Seçilen öğrenciler için soru kağıdı adresi yok ya da yanlış:<br><br><b>${uniqueErrors.join('<br>')}</b>`,
                        icon: 'error'
                    });
                    return;
                } else {
                    const result = await Swal.fire({
                        title: 'Eksik Soru Kağıtları',
                        html: `Bazı seçilen öğrenciler için soru kağıdı yüklü değil ve <b>atlanacak</b>:<br><br><b>${uniqueErrors.join('<br>')}</b><br><br>Geri kalan <b>${targetStudents.length}</b> öğrenci için yazdırmaya devam edilsin mi?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Evet, Devam Et',
                        cancelButtonText: 'İptal',
                        confirmButtonColor: '#4f46e5'
                    });
                    if (!result.isConfirmed) return;
                }
            }

            if (targetStudents.length === 1) {
                // DIRECT PATH for single student: Much faster
                const s = targetStudents[0];
                const meta = DataManager.getSanitizedSubjectMetadata(session, s._matchedSubject);
                const papers = meta.papers || {};
                let path = typeof papers === 'string' ? papers : (papers[s._groupLabel] || papers['default'] || '');
                if (path) {
                    window.printFile(path, {
                        no: s.no, name: s.name, class: s.class, room: s.room,
                        seat: s.seat, subject: s._matchedSubject, group: s._groupLabel, examNo: s.examNo,
                        metadata: meta
                    });
                    return;
                }
            }

            if (targetStudents.length > 0) {
                await printPapersForGroupBatch(targetStudents, session, 'Seçili Öğrenciler');
                return;
            }
        }

        // Filtre varsa direkt yazdır, yoksa onay al
        const startPrint = async (isPreview = false) => {
            let examTeachersData = { classrooms: {}, globalSpares: [] };
            if (DataManager.calculateExamTeachers) {
                examTeachersData = DataManager.calculateExamTeachers(session, window.globalTeachersDb || {});
            }

            // ── Sayfa CSS ──────────────────────────────────────────────────
            const pageCss = `
                @page { ${isSeating ? 'size: A4 landscape;' : 'size: A4 portrait;'} margin: 0; }
                html, body { overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; background: #fff; }
                
                .page { 
                    width: ${isSeating ? '297mm' : '210mm'}; 
                    height: ${isSeating ? '210mm' : '297mm'};
                    padding: 8mm; 
                    box-sizing: border-box; 
                    page-break-after: always; 
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                }
                .page:last-child { page-break-after: avoid; }

                .page-header { 
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 2px solid #6366f1; margin-bottom: 15px; padding-bottom: 8px;
                }
                .page-header h2 { margin: 0; font-size: 18pt; color: #4f46e5; font-weight: 900; }
                .page-header .info { text-align: right; font-size: 10pt; color: #1e293b; font-weight: 600; }

                table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
                th { background: #f8fafc; padding: 5px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; font-size: 8.5pt; }
                td { padding: 0 6px; border: 1px solid #e2e8f0; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; height: 13pt; font-size: 8.2pt; }
                tr:nth-child(even) td { background: #fcfcfc; }

                .msg-box {
                    margin-top: auto; padding: 12px 15px; border: 2px solid #6366f1; border-radius: 10px;
                    background: #f5f7ff; color: #1e293b; font-size: 9.5pt; line-height: 1.5;
                }
                .msg-box strong { color: #4f46e5; display: flex; align-items: center; margin-bottom: 6px; font-size: 1.1em; }
                .msg-box .icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #ef4444; color: white; border-radius: 50%; margin-right: 10px; font-size: 14px; }

                /* Seating schema centering */
                .schema-container { display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 10px; overflow: hidden; flex: 1; }
                .classroom-walls { 
                    border: 3px solid #334155; padding: 15px; border-radius: 16px; background: #fff;
                    display: inline-block; position: relative; box-shadow: 0 5px 20px rgba(0,0,0,0.06);
                    transform-origin: center; margin: auto;
                }
                .front-side { display: flex; justify-content: space-around; align-items: flex-start; margin-top: 15px; width: 100%; border-top: 2px solid #334155; padding-top: 10px; }
                .teacher-desk { 
                    width: 110px; height: 50px; border: 2px solid #475569; background: #f1f5f9;
                    display: flex; align-items: center; justify-content: center; font-size: 8pt; font-weight: bold; color: #1e293b;
                    border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .board { 
                    background: #0f172a; color: white; padding: 8px 50px; border-radius: 4px; font-size: 10pt;
                    font-weight: bold; letter-spacing: 3px; border: 3px solid #475569; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
                .groups-row { display: flex; gap: 30px; justify-content: center; flex-wrap: wrap; }
                .desk-group { display: grid; gap: 8px; padding: 8px; border: 1.5px dashed #cbd5e1; border-radius: 10px; background: #fafafa; }
                .desk { width: 95px; height: 80px; border: 1.8px solid #6366f1; border-radius: 8px;
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        font-size: 8pt; text-align: center; background: white; padding: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);
                        position: relative; overflow: visible; }
                .desk.empty { border: 1.8px dashed #ef4444; color: #ef4444; background: #fff5f5; font-weight: bold; }
                .desk-num { width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; border: 1px solid #cbd5e1; color: #1e293b; font-size: 10pt; font-weight: 900; 
                           display: flex; align-items: center; justify-content: center; 
                           position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); background: white; z-index: 10;
                           box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

                .print-fab {
                    position: fixed; top: 30px; right: 30px; width: 64px; height: 64px;
                    background: #4f46e5; color: white; border-radius: 50%; border: none;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4); cursor: pointer;
                    z-index: 10000; transition: transform 0.2s;
                }
                .print-fab:hover { transform: scale(1.1); background: #4338ca; }
                .print-fab i { font-size: 28px; }
                @media print { .no-print { display: none !important; } }
            `;

            const formatDate = (d) => {
                if (!d) return '';
                const parts = d.split('-');
                return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
            };

            const hdr = (title, roomName = null) => {
                let gorevliHtml = '';
                if (roomName && examTeachersData.classrooms[roomName]) {
                    const gorevli = examTeachersData.classrooms[roomName].gorevli;
                    if (gorevli) {
                        gorevliHtml = `<div style="font-size:12pt; font-weight:700; color:#dc2626; border: 2px dashed #ef4444; border-radius: 6px; padding: 4px 10px; background: #fef2f2; display: inline-block; white-space: nowrap;">Görevli Öğretmen: ${gorevli}</div>`;
                    }
                }
                return `
                <div class="page-header" style="justify-content: space-between; align-items: center; flex-wrap: nowrap; gap: 10px;">
                    <div style="flex: 1 1 0%; min-width: 0;">
                        <h2 style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</h2>
                    </div>
                    <div style="flex: 1.5 1 0%; text-align:center; min-width: 0;">
                        ${gorevliHtml}
                    </div>
                    <div class="info" style="flex: 1 1 0%; text-align: right; min-width: 0; white-space: nowrap;">
                        <div>${session.name}</div>
                        <div style="font-size: 9pt; color: #64748b; font-weight: 400;">
                            ${formatDate(session.date)} ${session.time || ''}
                        </div>
                    </div>
                </div>`;
            };

            const abbr = (n, lim = 15) => window.shortenSubject(n, lim);

            let body = '';

            // ─────── SINIF MODU ───────────────────────────────────────────
            if (mode === 'class') {
                const flatList = [];
                session.results.forEach(room => {
                    let ctr = 1; const seatToNum = {};
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        for (let r = 1; r <= cf.rows; r++)
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                if (!(room.disabledSeats || []).includes(sid)) seatToNum[sid] = ctr++;
                            }
                    }
                    Object.entries(room.seats).forEach(([sid, std]) =>
                        flatList.push({ ...std, room: room.name, seatNum: seatToNum[sid] || '-' }));
                });
                const byClass = {};
                flatList.forEach(s => {
                    if (filterValue && s.class !== filterValue) return;
                    (byClass[s.class] = byClass[s.class] || []).push(s);
                });

                const sorted = Object.keys(byClass).sort(sortByNum);
                const studentMsg = (session.studentMsg || '').trim();

                for (let clsIdx = 0; clsIdx < sorted.length; clsIdx++) {
                    const cls = sorted[clsIdx];
                    await new Promise(r => setTimeout(r, 5)); // Yield to prevent thread lock

                    const students = byClass[cls].sort((a, b) => parseInt(a.no) - parseInt(b.no));
                    
                    let titleSuffix = '';
                    const classRoomName = students[0]?.room;
                    if (session.type === 'uygulama' && classRoomName) {
                        const gorevli = examTeachersData.classrooms[classRoomName]?.gorevli;
                        if (gorevli) {
                            titleSuffix = ` - Görevli: ${gorevli}`;
                        }
                    }

                    const PAGE_SIZE = 50;
                    for (let p = 0; p < students.length; p += PAGE_SIZE) {
                        const chunk = students.slice(p, p + PAGE_SIZE);
                        const pageNum = Math.floor(p / PAGE_SIZE) + 1;
                        const totalPages = Math.ceil(students.length / PAGE_SIZE);

                        const rows = chunk.map(s => {
                            const meta = DataManager.getSanitizedSubjectMetadata(session, s._matchedSubject);
                            const examNo = meta.examNo || meta.examNumber || '';
                            const eNum = examNo ? ` <small>(${examNo})</small>` : '';


                            return `<tr>
                                <td style="width:10%;"><b>${s.no}</b></td>
                                <td style="width:40%;">${s.name}</td>
                                <td style="width:30%;">${window.shortenSubject(s._matchedSubject || '-', 18)}${eNum}</td>
                                <td style="width:12%;">${s.room}</td>
                                <td style="width:8%; text-align:center;"><b>${s.seatNum}</b></td></tr>`;
                        }).join('');

                        body += `<div class="page">
                            ${hdr(`${cls} Sınıf Listesi${titleSuffix} ${totalPages > 1 ? `(Sayfa ${pageNum}/${totalPages})` : ''}`, session.type === 'uygulama' ? classRoomName : null)}
                            <table>
                                <thead><tr>
                                    <th style="width:10%;">No</th><th style="width:40%;">Ad Soyad</th>
                                    <th style="width:30%;">Sınav Dersi</th><th style="width:12%;">Derslik</th>
                                    <th style="width:8%;">Sıra</th>
                                </tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                            ${(studentMsg && (p + PAGE_SIZE >= students.length)) ? `<div class="msg-box"><strong><span class="icon">!</span> Lütfen Dikkat!!!</strong>${studentMsg}</div>` : ""}
                        </div>`;
                    }
                }

                // ─────── SALON MODU ───────────────────────────────────────────
            } else if (mode === 'room') {
                const sortedRooms = [...session.results].filter(r => !filterValue || r.name === filterValue).sort((a, b) => sortByNum(a.name, b.name));
                for (let rIdx = 0; rIdx < sortedRooms.length; rIdx++) {
                    const room = sortedRooms[rIdx];
                    await new Promise(r => setTimeout(r, 5)); // Yield thread execution

                    let ctr = 1; const seatToNum = {};
                    const seatIds = [];
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        for (let r = 1; r <= cf.rows; r++)
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                if (!(room.disabledSeats || []).includes(sid)) { seatToNum[sid] = ctr++; seatIds.push(sid); }
                            }
                    }
                    const sortedSeatIds = seatIds.sort((a, b) => {
                        const pa = a.match(/\d+/g).map(Number), pb = b.match(/\d+/g).map(Number);
                        for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
                        return 0;
                    });
                    const PAGE_SIZE = 50;
                    for (let p = 0; p < sortedSeatIds.length; p += PAGE_SIZE) {
                        const chunk = sortedSeatIds.slice(p, p + PAGE_SIZE);
                        const pageNum = Math.floor(p / PAGE_SIZE) + 1;
                        const totalPages = Math.ceil(sortedSeatIds.length / PAGE_SIZE);

                        const rows = chunk.map(sid => {
                            const s = room.seats[sid];
                            if (s) {
                                const effCount = getEffectiveSubjectGroupCount(session, s._matchedSubject);
                                const groupSuffix = (effCount > 1 && (s._groupLabel || s.group)) ? ` (${s._groupLabel || s.group})` : '';
                                return `<tr><td style="text-align:center;"><b>${seatToNum[sid] || '-'}</b></td>
                                    <td>${s.class}</td><td style="text-align:center;"><b>${s.no}</b></td>
                                    <td>${s.name}${groupSuffix}</td><td>${abbr(s._matchedSubject || '-', 15)}</td>
                                    <td style="border-bottom:1px solid #eee;"></td></tr>`;
                            } else {
                                return `<tr style="color: #64748b; background: #fff5f5;"><td style="text-align:center;"><b>${seatToNum[sid] || '-'}</b></td>
                                    <td colspan="4" style="text-align:center; font-weight: bold; letter-spacing: 2px;">BOŞ BIRAKILDI</td>
                                    <td></td></tr>`;
                            }
                        }).join('');

                        const studentsInRoom = Object.values(room.seats || {});
                        const roomClasses = [...new Set(studentsInRoom.map(s => s.class))].sort(sortByNum);
                        const teacherMsg = (session.teacherMsg || '').trim();

                        let summaryListHtml = ''; let roomTotal = 0;
                        roomClasses.forEach(cls => {
                            const classStudents = studentsInRoom.filter(s => s.class === cls);
                            const classExams = [...new Set(classStudents.map(s => s._matchedSubject || '-'))].sort();
                            classExams.forEach(ex => {
                                const count = classStudents.filter(s => (s._matchedSubject || '-') === ex).length;
                                summaryListHtml += `<div style="padding: 2px 0; border-bottom: 1px dashed #e2e8f0; font-size: 8.5pt;"><b>${cls}</b> ${abbr(ex, 12)} => <b>${count}</b> Öğrenci</div>`;
                                roomTotal += count;
                            });
                        });
                        const examsInRoom = [...new Set(studentsInRoom.map(s => s._matchedSubject || '-'))].sort();
                        let examSummaryRows = examsInRoom.map(ex => {
                            const count = studentsInRoom.filter(s => (s._matchedSubject || '-') === ex).length;
                            return `<tr><td>${abbr(ex)}</td><td style="text-align:center; font-weight:bold;">${count}</td></tr>`;
                        }).join('');

                        const summaryContent = (p + PAGE_SIZE >= sortedSeatIds.length) ? `
                            <div style="flex-shrink:0; width:45mm; margin-left:10px;">
                                <div style="background:#f8fafc; padding:6px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:10px;">
                                    <div style="font-size:8.5pt; font-weight:900; color:#4f46e5; border-bottom:2px solid #6366f1; padding-bottom:3px; margin-bottom:6px;">DERSLİK ÖZETİ</div>
                                    <div style="line-height:1.2;">${summaryListHtml}<div style="margin-top:5px; padding-top:3px; border-top:2px solid #6366f1; font-weight:900; color:#4f46e5; text-align:right; font-size:8.5pt;">TOPLAM: ${roomTotal}</div></div>
                                </div>
                                <div style="background:#fff7ed; padding:6px; border-radius:10px; border:1px solid #ffedd5;">
                                    <div style="font-size:8.5pt; font-weight:900; color:#c2410c; border-bottom:2px solid #f97316; padding-bottom:3px; margin-bottom:6px;">SINAV TOPLAMLARI</div>
                                    <table style="font-size:7.5pt; border-collapse:collapse; background:white;">
                                        <thead><tr style="background:#fff7ed;"><th style="padding:2px 4px; width:75%;">Sınav</th><th style="padding:2px 4px; width:25%;">Sayı</th></tr></thead>
                                        <tbody>${examSummaryRows}</tbody>
                                    </table>
                                </div>
                            </div>` : '';

                        let sigHtml = '';
                        if (p + PAGE_SIZE >= sortedSeatIds.length) {
                            const gorevliName = examTeachersData.classrooms[room.name]?.gorevli || '';
                            const safeName = gorevliName ? gorevliName.replace(' (İdare)', '') : 'Gözetmen Öğretmen';
                            sigHtml = `
                            <div style="margin-top: 15px; display: flex; justify-content: flex-end; padding-right: 30px;">
                                <div style="text-align: center; width: 250px;">
                                    <div style="font-weight: 600; font-size: 10pt;">${safeName}</div>
                                    <div style="font-size: 9pt; color: #64748b; margin-top: 2px;">Salon Gözetmeni</div>
                                    <div style="margin-top: 25px; border-top: 1px dotted #94a3b8; width: 100%;"></div>
                                    <div style="font-size: 8pt; color: #94a3b8; margin-top: 3px;">İmza</div>
                                </div>
                            </div>`;
                        }

                        body += `<div class="page">${hdr(`${room.name} Salonu - Oturma Listesi ${totalPages > 1 ? `(Sayfa ${pageNum}/${totalPages})` : ''}`, room.name)}
                            <div style="display:flex; gap:0; align-items:flex-start; flex:1;">
                                <div style="flex:1;">
                                    <table style="table-layout:fixed;">
                                        <thead><tr>
                                            <th style="width:6%;">Sıra</th><th style="width:7%;">Sınıf</th>
                                            <th style="width:7%;">No</th><th style="width:50%;">Ad Soyad</th>
                                            <th style="width:15%;">Sınav</th><th style="width:15%;">Açıklama</th>
                                        </tr></thead>
                                        <tbody>${rows}</tbody>
                                    </table>
                                </div>
                                ${summaryContent}
                            </div>
                            ${(teacherMsg && (p + PAGE_SIZE >= sortedSeatIds.length)) ? `<div class="msg-box" style="border-color:#ca8a04; background:#fffaf0;"><strong><span class="icon" style="background:#ea580c;">!</span> Lütfen Dikkat!!!</strong>${teacherMsg}</div>` : ""}
                            ${sigHtml}
                        </div>`;
                    }
                }

                // ─────── ŞEMA MODU ────────────────────────────────────────────
                } else if (mode === 'seating') {
                    const seatingRooms = session.results.filter(r => !filterValue || r.name === filterValue);
                for (let sIdx = 0; sIdx < seatingRooms.length; sIdx++) {
                    const room = seatingRooms[sIdx];
                    await new Promise(r => setTimeout(r, 5)); // Yield thread execution
                    let ctr = 1; const seatToNum = {};
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        for (let r = 1; r <= cf.rows; r++)
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                if (!(room.disabledSeats || []).includes(sid)) seatToNum[sid] = ctr++;
                            }
                    }
                    let groupsHtml = '<div class="groups-row">';
                    for (let g = 1; g <= room.groups; g++) {
                        const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                        groupsHtml += `<div class="desk-group" style="grid-template-columns:repeat(${cf.cols},1fr)">`;
                        for (let r = cf.rows; r >= 1; r--) {
                            for (let c = 1; c <= cf.cols; c++) {
                                const sid = `G${g}-S${r}-C${c}`;
                                const isDisabled = (room.disabledSeats || []).includes(sid);
                                const student = room.seats?.[sid];
                                const num = seatToNum[sid] || '-';
                                let bg = '';
                                if (student) {
                                    const sub = student._matchedSubject || '-';
                                    let hasStrict = false, hasVertical = false;
                                    const neighbors = [{ dr: 0, dc: -1, type: 'h' }, { dr: 0, dc: 1, type: 'h' }, { dr: -1, dc: -1, type: 'd' }, { dr: -1, dc: 1, type: 'd' }, { dr: 1, dc: -1, type: 'd' }, { dr: 1, dc: 1, type: 'd' }, { dr: -1, dc: 0, type: 'v' }, { dr: 1, dc: 0, type: 'v' }];
                                    neighbors.forEach(n => {
                                        const nstd = room.seats[`G${g}-S${r + n.dr}-C${c + n.dc}`];
                                        if (nstd && (nstd._matchedSubject || '-') === sub) { if (n.type === 'v') hasVertical = true; else hasStrict = true; }
                                    });
                                    if (hasStrict) bg = 'background-color:#fee2e2;'; else if (hasVertical) bg = 'background-color:#fef9c3;';
                                }
                                if (isDisabled) { groupsHtml += `<div class="desk" style="opacity:0.3; border-color:#ccc; border-style:dotted;">KAPALI</div>`; }
                                else if (student) {
                                    groupsHtml += `<div class="desk" style="${bg} border:1px solid #cbd5e1; border-radius:6px;">
                                        <div style="font-size:6.5pt;color:#64748b;font-weight:700;border-bottom:0.1pt solid #eee;margin-bottom:2pt;padding-bottom:1pt;width:100%;">${student.class} / ${student.no}</div>
                                        <div style="font-weight:700;font-size:7.5pt;line-height:1.1; color:#0f172a; flex:1; display:flex; align-items:center; justify-content:center;">${student.name}</div>
                                        <div class="desk-num">${num}</div></div>`;
                                } else {
                                    groupsHtml += `<div class="desk empty">
                                            <div style="font-weight:900; font-size:6pt; color:#dc2626; letter-spacing:0.5px; line-height:1.2;">BOŞ<br>BIRAKINIZ</div>
                                            <div class="desk-num" style="background:#fee2e2; color:#ef4444; border-color:#fecaca;">${num}</div></div>`;
                                }
                            }
                        }
                        groupsHtml += '</div>';
                    }
                    groupsHtml += '</div>';
                    body += `<div class="page">${hdr(`${room.name} Salonu - Oturma Şeması`, room.name)}
                        <div class="schema-container"><div class="classroom-walls">${groupsHtml}
                            <div class="front-side">${room.teacherDeskPos === 'left' ? `<div class="teacher-desk">ÖĞRETMEN<br>MASASI</div><div class="board">Y A Z I &nbsp; T A H T A S I</div><div style="width:110px;"></div>` : `<div style="width:110px;"></div><div class="board">Y A Z I &nbsp; T A H T A S I</div><div class="teacher-desk">ÖĞRETMEN<br>MASASI</div>`}</div>
                        </div></div></div>`;
                }

                body += `<script>
                    window.addEventListener('load', () => {
                        document.querySelectorAll('.schema-container').forEach(wrap => {
                            const wall = wrap.querySelector('.classroom-walls');
                            if (!wall) return;
                            const scale = Math.min((wrap.clientWidth - 20) / wall.offsetWidth, (wrap.clientHeight - 20) / wall.offsetHeight);
                            wall.style.transform = "scale(" + Math.min(scale, 2.5) + ")";
                        });
                    });
                </script>`;
            }

            const win = window.open('', '_blank');
            win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${session.name} - ${modeLabel}</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>${pageCss}</style></head><body>
                <button class="print-fab no-print" onclick="window.print()" title="Yazdır">
                    <i class="fa-solid fa-print"></i>
                </button>
                ${body}
                <script>window.onload=()=>setTimeout(()=>{if(!${isPreview}){window.focus();}},500);</script>
            </body></html>`);
            win.document.close();

        };

        if (filterValue) {
            if (forcePrintPapers) {
                await printPapersForGroup(filterValue);
            } else {
                await startPrint(false);
            }
        } else {
            await startPrint(false);
        }
    };



    // ─────── METADATA HELPERS ─────────────────────────────────────
    window.pasteToInput = async function (btn) {
        try {
            let text = await navigator.clipboard.readText();
            if (text) {
                // Clean text: remove only quotes and commas as per user request
                text = text.replace(/[",]/g, '').trim();

                const input = btn.closest('.input-group').querySelector('input');
                if (input) {
                    input.value = text;
                    Swal.showValidationMessage(''); // Clear any previous errors if in Swal
                }
            }
        } catch (err) {
            console.error('Paste failed:', err);
        }
    };

    window.browseToInput = function (btn) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/pdf';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.type !== "application/pdf") {
                    Swal.fire("Sadece PDF türünde dosyalar yükleyebilirsiniz.", "", "warning");
                    return;
                }

                // Show loading spinner
                const originalBtnHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                btn.disabled = true;

                try {
                    const publicUrl = await DataManager.uploadFileToSupabase(file);
                    // More robust way to find the input within the same group
                    const inputGroup = btn.closest('.input-group');
                    const input = inputGroup ? inputGroup.querySelector('input.meta-paper-input, input.meta-paper-pdf-input') : null;

                    if (input) {
                        input.value = publicUrl;
                        // Force UI refresh and ensure it's picked up by any listeners
                        input.setAttribute('value', publicUrl);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        // Fallback: try finding ANY input in the same row
                        const parentRow = btn.closest('.meta-subject-row');
                        if (parentRow) {
                            const sub = btn.dataset.sub;
                            const group = btn.dataset.group;
                            const selector = group ? `input.meta-paper-input[data-sub="${sub}"][data-group="${group}"]` : `input.meta-paper-input[data-sub="${sub}"]`;
                            const altInput = parentRow.querySelector(selector);
                            if (altInput) {
                                altInput.value = publicUrl;
                                altInput.setAttribute('value', publicUrl);
                                altInput.dispatchEvent(new Event('input', { bubbles: true }));
                                altInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }

                    // Button success state
                    const originalColor = btn.style.backgroundColor;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Yüklendi';
                    btn.style.backgroundColor = '#10b981';
                    btn.style.color = '#fff';

                    setTimeout(() => {
                        btn.innerHTML = originalBtnHtml;
                        btn.style.backgroundColor = '';
                        btn.style.color = '';
                        btn.disabled = false;
                    }, 3000);

                } catch (err) {
                    console.error("Yükleme Hatası:", err);
                    btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Hata!';
                    btn.style.backgroundColor = '#ef4444';
                    btn.style.color = '#fff';
                    setTimeout(() => {
                        btn.innerHTML = originalBtnHtml;
                        btn.style.backgroundColor = '';
                        btn.style.color = '';
                        btn.disabled = false;
                    }, 3000);
                }
            }
        };
        fileInput.click();
    };

    window.showCloudFiles = async function (btn) {
        const inputGroup = btn.closest('.input-group') || btn.parentElement;
        const input = inputGroup ? inputGroup.querySelector('input.meta-paper-input, input.meta-paper-pdf-input') : null;
        if (!input) {
            console.error("Target input not found for cloud selection");
            btn.innerHTML = '<i class="fa-solid fa-cloud"></i> Buluttan Seç';
            btn.disabled = false;
            return;
        }

        try {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;
            const files = await DataManager.listSupabaseFiles();
            btn.innerHTML = '<i class="fa-solid fa-cloud"></i> Buluttan Seç';
            btn.disabled = false;

            if (files.length === 0) {
                alert('Bulut Boş: Henüz hiç dosya yüklenmemiş.');
                return;
            }

            let listHtml = '<div style="max-height: 400px; overflow-y: auto;"><table class="table table-sm"><thead><tr><th>Dosya Adı</th><th>Tarih</th><th>İşlem</th></tr></thead><tbody>';
            files.forEach(f => {
                const date = new Date(f.created_at).toLocaleString('tr-TR');
                listHtml += `
                    <tr id="cloud-row-${f.name.replace(/[^a-zA-Z0-9]/g, '_')}">
                        <td style="font-size:0.8rem; text-align:left; word-break:break-all;">${f.name}</td>
                        <td style="font-size:0.7rem;">${date}</td>
                        <td style="display:flex; gap:5px;">
                            <button class="btn btn-primary btn-sm" onclick="window.selectCloudFile('${f.url}', this)">Seç</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteCloudFile('${f.name}', this)"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
            listHtml += '</tbody></table></div>';

            window.deleteCloudFile = async (name, btnEl) => {
                if (!confirm(`'${name}' dosyasını buluttan silmek istediğinize emin misiniz?`)) return;
                try {
                    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    btnEl.disabled = true;
                    await DataManager.deleteSupabaseFile(name);
                    const row = btnEl.closest('tr');
                    if (row) row.remove();
                } catch (e) {
                    alert('Silme hatası: ' + e.message);
                    btnEl.innerHTML = '<i class="fa-solid fa-trash"></i>';
                    btnEl.disabled = false;
                }
            };

            window.selectCloudFile = (url, pickBtn) => {
                input.value = url;
                input.setAttribute('value', url);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                const dialog = pickBtn.closest('dialog');
                if (dialog) {
                    dialog.close();
                    dialog.remove();
                }
            };

            const dialog = document.createElement('dialog');
            dialog.className = 'custom-modal';
            dialog.style.padding = '0';
            dialog.style.border = 'none';
            dialog.style.borderRadius = '16px';
            dialog.style.boxShadow = '0 20px 50px rgba(0,0,0,0.3)';
            dialog.style.maxWidth = '90%';
            dialog.style.width = '500px';
            dialog.style.zIndex = '9999';
            dialog.style.position = 'fixed';
            dialog.style.top = '50%';
            dialog.style.left = '50%';
            dialog.style.transform = 'translate(-50%, -50%)';
            dialog.style.margin = '0';
            dialog.style.overflow = 'hidden';
            dialog.innerHTML = `
                <div style="background:linear-gradient(135deg, var(--primary), var(--primary-dark)); color:white; padding:1.25rem; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700;"><i class="fa-solid fa-cloud"></i> Buluttaki Dosyalar</h3>
                    <button type="button" onclick="this.closest('dialog').close(); this.closest('dialog').remove();" style="background:rgba(255,255,255,0.2); border:none; color:white; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:1rem; background:white; max-height:80vh; overflow-y:auto;">
                    <div class="table-responsive">
                        ${listHtml}
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            dialog.showModal();

        } catch (err) {
            alert('Hata: ' + err.message);
            btn.innerHTML = '<i class="fa-solid fa-cloud"></i> Buluttan Seç';
            btn.disabled = false;
        }
    };


    window.openSessionMetadataEditor = function (id) {
        const sessions = DataManager.getExamSessions();
        const ses = sessions.find(s => s.id === id);
        if (!ses) return;

        // Extract ALL unique full subject names (e.g., "Matematik 10") present in the results
        // Extract ALL unique full subject names (e.g., "Matematik 10") and map them to student counts
        const subjectStats = {};
        if (ses.results) {
            ses.results.forEach(room => {
                Object.values(room.seats || {}).forEach(std => {
                    const sub = std._matchedSubject;
                    if (sub) {
                        if (!subjectStats[sub]) subjectStats[sub] = { count: 0, classes: new Set() };
                        subjectStats[sub].count++;
                        subjectStats[sub].classes.add(std.class);
                    }
                });
            });
        }

        const subjectNames = Object.keys(subjectStats).length > 0
            ? Object.keys(subjectStats).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
            : (ses.subjects || []).map(s => typeof s === 'object' ? s.name : s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const metadata = ses.subjectMetadata || {};
        const hasGroups = ses.hasGroups;
        const groupCount = ses.groupCount || 2;
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        let subjectsHtml = '';
        subjectNames.forEach((sub, idx) => {
            const data = DataManager.getSanitizedSubjectMetadata(ses, sub);
            const subExamNum = data.examNo || data.examNumber || '';
            const subPapers = data.papers || {};
            const subHeader = data.pdfHeaderDesign || '1'; // Inject subHeader variable

            let paperInputs = '';
            if (ses.type === 'uygulama') {
                const files = Array.isArray(subPapers.uygulamaFiles) ? subPapers.uygulamaFiles : (typeof subPapers === 'string' && subPapers ? [subPapers] : ['']);
                
                paperInputs = `
                    <div class="input-group" style="display:flex; align-items:center; gap:3px; margin-top:4px; margin-bottom:8px;">
                        <span style="font-size:0.7rem; font-weight:700; color:var(--danger); min-width:60px;"><i class="fa-solid fa-file-pdf"></i> Soru Kağıdı</span>
                        <input type="text" class="swal2-input meta-paper-pdf-input" data-sub="${sub}" style="flex:1; margin:0; height:30px; font-size:0.8rem; padding:0 6px;" value="${typeof subPapers['default'] === 'string' ? subPapers['default'] : ''}" placeholder="Soru kağıdı PDF / URL">
                        <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem; background:#6366f1; border-color:#6366f1;" onclick="const inp=this.closest('div').querySelector('input.meta-paper-pdf-input'); if(inp && inp.value) window.openSafePdf(inp.value, 'Soru Kağıdı Önizleme'); else Swal.showValidationMessage('Önce bir PDF yükleyin veya link girin');" title="Soru Kağıdı Test"><i class="fa-solid fa-eye"></i> Test</button>
                        <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem; background:#6366f1; border-color:#6366f1;" onclick="window.testSpecificRow(this, '${ses.type}')" title="Örnek Öğrenci Testi"><i class="fa-solid fa-file-circle-check"></i></button>
                        <button type="button" class="btn btn-info btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.showCloudFiles(this)" title="Buluttan Seç"><i class="fa-solid fa-cloud"></i></button>
                        <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.browseToInput(this)" title="Yükle"><i class="fa-solid fa-cloud-arrow-up"></i></button>
                    </div>
                    <div class="uygulama-files-container" id="uyg-container-${sub}">`;
                files.forEach((fileLink, fIdx) => {
                    paperInputs += `
                    <div class="input-group uygulama-file-row" style="display:flex; align-items:center; gap:3px; margin-top:4px;">
                        <span style="font-size:0.7rem; font-weight:700; color:var(--gray-500); min-width:60px;">${fIdx + 1}. dosya</span>
                        <input type="text" class="swal2-input meta-paper-input" data-sub="${sub}" data-uyg-idx="${fIdx}" style="flex:1; margin:0; height:30px; font-size:0.8rem; padding:0 6px;" value="${fileLink}" placeholder="Uygulama dosyası linki">
                        <button type="button" class="btn btn-secondary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="const inp=this.closest('div').querySelector('input.meta-paper-input'); if(inp && inp.value) window.open(inp.value, '_blank'); else Swal.showValidationMessage('Önce bir link girin');" title="Linki Aç"><i class="fa-solid fa-external-link"></i></button>
                        <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem; background:#6366f1; border-color:#6366f1;" onclick="window.testUygulamaMedia(this)" title="Medya Test"><i class="fa-solid fa-play"></i> Test</button>
                        <button type="button" class="btn btn-info btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.showCloudFiles(this)" title="Buluttan Seç"><i class="fa-solid fa-cloud"></i></button>
                        <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.browseToInput(this)" title="Yükle"><i class="fa-solid fa-cloud-arrow-up"></i></button>
                        <button type="button" class="btn btn-danger btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="this.closest('.uygulama-file-row').remove();" title="Sil"><i class="fa-solid fa-trash"></i></button>
                    </div>`;
                });
                paperInputs += `</div>
                <div style="margin-top: 5px; text-align: right;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.addUygulamaFileRow('${sub}')" style="font-size: 0.75rem;"><i class="fa-solid fa-plus"></i> Ekle</button>
                </div>`;
            } else if (hasGroups) {
                for (let i = 0; i < groupCount; i++) {
                    const groupLetter = alphabet[i];
                    paperInputs += `
                    <div style="margin-top:6px; margin-bottom:2px; text-align:left;">
                        <span style="font-size:0.75rem; font-weight:700; color:var(--primary); display:block; margin-bottom:2px;">${groupLetter} Grubu İçin Soru Kağıdı Adresi</span>
                        <div class="input-group" style="display:flex; align-items:center; gap:3px;">
                            <input type="text" class="swal2-input meta-paper-input" data-sub="${sub}" data-group="${groupLetter}" style="flex:1; margin:0; height:32px; font-size:0.8rem; padding:0 8px;" value="${subPapers[groupLetter] || ''}" placeholder="${groupLetter} Grubu İçin Soru Kağıdı Adresi (PDF URL)">
                            <button type="button" class="btn btn-secondary btn-sm" style="height:32px; padding:0 7px; font-size:0.7rem;" onclick="const inp=this.closest('div').querySelector('input.meta-paper-input'); if(inp && inp.value) window.openSafePdf(inp.value, '${groupLetter} Grubu Soru Kağıdı Önizleme'); else Swal.showValidationMessage('Önce bir PDF yükleyin veya link girin');" title="Linki Aç"><i class="fa-solid fa-external-link"></i></button>
                            <button type="button" class="btn btn-primary btn-sm" style="height:32px; padding:0 7px; font-size:0.7rem; background:#6366f1; border-color:#6366f1;" onclick="window.testSpecificRow(this, '${ses.type}')" title="Örnek Öğrenci Testi"><i class="fa-solid fa-file-circle-check"></i></button>
                            <button type="button" class="btn btn-info btn-sm" style="height:32px; padding:0 7px; font-size:0.7rem;" onclick="window.showCloudFiles(this)" title="Buluttan Seç"><i class="fa-solid fa-cloud"></i></button>
                            <button type="button" class="btn btn-primary btn-sm" style="height:32px; padding:0 7px; font-size:0.7rem;" onclick="window.browseToInput(this)" title="Yükle"><i class="fa-solid fa-cloud-arrow-up"></i></button>
                        </div>
                    </div>`;
                }
            } else {
                paperInputs = `
                    <div class="input-group" style="display:flex; align-items:center; gap:3px; margin-top:4px;">
                        <input type="text" class="swal2-input meta-paper-input" data-sub="${sub}" style="flex:1; margin:0; height:30px; font-size:0.8rem; padding:0 6px;" value="${typeof subPapers === 'string' ? subPapers : (subPapers['default'] || '')}" placeholder="PDF yol / URL">
                        <button type="button" class="btn btn-secondary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="const inp=this.closest('div').querySelector('input.meta-paper-input'); if(inp && inp.value) window.openSafePdf(inp.value, 'Soru Kağıdı Önizleme'); else Swal.showValidationMessage('Önce bir PDF yükleyin veya link girin');" title="Linki Aç"><i class="fa-solid fa-external-link"></i></button>
                            <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem; background:#6366f1; border-color:#6366f1;" onclick="window.testSpecificRow(this, '${ses.type}')" title="Örnek Öğrenci Testi"><i class="fa-solid fa-file-circle-check"></i></button>
                        <button type="button" class="btn btn-info btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.showCloudFiles(this)" title="Buluttan Seç"><i class="fa-solid fa-cloud"></i></button>
                        <button type="button" class="btn btn-primary btn-sm" style="height:30px; padding:0 7px; font-size:0.7rem;" onclick="window.browseToInput(this)" title="Yükle"><i class="fa-solid fa-cloud-arrow-up"></i></button>
                    </div>`;
            }

            subjectsHtml += `
                <div class="meta-subject-row" style="padding:8px 10px; margin-bottom:6px;">
                    <div class="meta-subject-header" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; width:100%;">
                        <input type="checkbox" class="meta-sub-check" checked data-sub="${sub}" style="width:18px; height:18px; flex-shrink:0;">
                        <strong style="color:var(--primary); font-size:0.9rem; white-space:nowrap;">${sub}</strong>
                        <span style="font-size:0.7rem; color:var(--gray-400);">(${subjectStats[sub]?.count || 0} Öğrenci)</span>
                        <select class="swal2-select meta-header-design-select" data-sub="${sub}" style="margin:0; height:30px; font-size:0.75rem; width:130px; padding:0 4px; flex-shrink:0;">
                            <option value="1" ${subHeader === '1' ? 'selected' : ''}>Klasik</option>
                            <option value="2" ${subHeader === '2' ? 'selected' : ''}>Modern</option>
                            <option value="3" ${subHeader === '3' ? 'selected' : ''}>Köşe Zarif</option>
                            <option value="4" ${subHeader === '4' ? 'selected' : ''}>Osmanlı</option>
                            <option value="5" ${subHeader === '5' ? 'selected' : ''}>Japonya</option>
                            <option value="6" ${subHeader === '6' ? 'selected' : ''}>Seddülbahir</option>
                            <option value="7" ${subHeader === '7' ? 'selected' : ''}>Latin</option>
                            <option value="8" ${subHeader === '8' ? 'selected' : ''}>Arap</option>
                            <option value="9" ${subHeader === '9' ? 'selected' : ''}>Atatürk</option>
                            <option value="10" ${subHeader === '10' ? 'selected' : ''}>Bulut</option>
                            <option value="11" ${subHeader === '11' ? 'selected' : ''}>Testere</option>
                        </select>
                        <div style="display:flex; align-items:center; gap:3px; flex-shrink:0;">
                            <label style="font-size:0.7rem; font-weight:700; color:var(--gray-500);">No:</label>
                            <input type="text" class="swal2-input meta-exam-num-input" data-sub="${sub}" style="width:45px; margin:0; height:30px; font-size:0.8rem; text-align:center; padding:0;" value="${subExamNum}">
                        </div>
                    </div>
                    ${paperInputs}
                </div>
    `;
        });

        Swal.fire({
            title: 'Oturum Bilgilerini Düzenle',
            customClass: { popup: 'swal2-responsive-popup' },
            width: 'auto',
            allowOutsideClick: false,
            backdrop: true,
            html: `
                <div class="modal-body-wrapper" style="text-align: left;">
                    <div class="modal-row" style="margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                        <div class="modal-form-group" style="flex: 1; min-width: 180px; max-width: 220px;">
                            <label style="font-weight:700;">Sınav Tarihi</label>
                            <input type="date" id="meta-date" class="swal2-input" style="width:100%; margin:0; height:40px;" value="${window.formatDateToInput(ses.date) || ''}">
                        </div>
                        <div class="modal-form-group" style="flex: 1; min-width: 140px; max-width: 180px;">
                            <label style="font-weight:700;">Ders Saati</label>
                            ${(() => {
                                const school = DataManager.getSchoolSettings();
                                const lessonTimes = school.lessonTimes || {};
                                const dailyLessons = parseInt(school.dailyLessons) || 0;
                                let options = '<option value="">Hızlı Seçim</option>';
                                for (let i = 1; i <= dailyLessons; i++) {
                                    const start = lessonTimes[`${i}_start`];
                                    if (start) {
                                        const isSelected = (ses.time === start || ses.time === `${i}. Ders`) ? 'selected' : '';
                                        options += `<option value="${start}" ${isSelected}>${i}. Ders (${start})</option>`;
                                    }
                                }
                                return `
                                    <select id="meta-lesson" class="swal2-input" style="width:100%; margin:0; height:40px; font-size:0.9rem; padding:0 10px;">
                                        ${options}
                                    </select>
                                `;
                            })()}
                        </div>
                        <div class="modal-form-group" style="flex: 1; min-width: 120px; max-width: 160px;">
                            <label style="font-weight:700;">Saat / Dakika</label>
                            <input type="time" id="meta-time" class="swal2-input" style="width:100%; margin:0; height:40px; font-size:0.9rem;" value="" required>
                        </div>
                        <div class="modal-form-group" style="flex: 1; min-width: 150px; max-width: 180px;">
                            <label style="font-weight:700;">Sınav Süresi (dk)</label>
                            <input type="number" id="meta-duration" class="swal2-input" style="width:100%; margin:0; height:40px; text-align:center;" value="${ses.examDuration || 40}" min="1">
                            <div id="duration-timer-preview" style="font-size: 0.9rem; font-weight: 800; color: #ef4444; margin-top: 5px; text-align: center; font-family: monospace; background: #fee2e2; border-radius: 4px; padding: 2px 0;">00:40:00</div>
                        </div>
                    </div>

                    <div class="modal-form-card" style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap; padding: 1rem; background: var(--gray-50); border-radius: 12px; border: 1px solid var(--gray-200);">
                        <div style="display:flex; align-items:center; gap:0.8rem;">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--primary); font-size:1.2rem;"></i>
                            <div>
                                <strong style="display:block; font-size:0.85rem;">Toplu Sınav No Uygula</strong>
                                <small style="color:var(--gray-500); font-size:0.75rem;">Seçili tüm derslere aynı numarayı girin.</small>
                            </div>
                        </div>
                        <div style="display:flex; gap:0.3rem; align-items:center;">
                            <input type="text" id="bulk-exam-num" class="swal2-input" style="width:60px; margin:0; height:32px; text-align:center; font-size:0.8rem; padding:0;" placeholder="No">
                            <button type="button" class="btn btn-primary btn-sm" style="height:32px; padding:0 10px; font-size:0.75rem;" onclick="const val=document.getElementById('bulk-exam-num').value; document.querySelectorAll('.meta-subject-row').forEach(row => { const cb=row.querySelector('.meta-sub-check'); if(cb && cb.checked){ const input=row.querySelector('.meta-exam-num-input'); if(input) input.value=val; } })">Uygula</button>
                        </div>
                        
                        <div style="flex:1; min-width:20px;"></div>

                        <div class="modal-form-group" style="display:flex; align-items:center; gap:0.8rem;">
                            <label style="font-weight:700; margin:0; font-size:0.85rem; color: var(--gray-700);">Ekran Görünümü</label>
                            <div style="display:flex; align-items:center; gap:0.5rem; background:white; padding:4px 8px; border-radius:8px; border:1px solid var(--gray-200);">
                                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; margin:0;" title="Öğrenci Panelinde oturma planını göster">
                                    <input type="checkbox" id="meta-screen-check" ${ses.screenViewEnabled !== false ? 'checked' : ''} style="width:16px; height:16px;">
                                    <i class="fa-solid fa-desktop" style="color:var(--info); font-size:0.9rem;"></i>
                                </label>
                                <input type="number" id="meta-screen-limit" value="${ses.screenViewLimit !== undefined ? ses.screenViewLimit : (DataManager.getSchoolSettings()?.defaultTimes?.defaultScreenViewLimit || 8)}" min="0" max="9999" style="width:65px; height:28px; text-align:center; border:1px solid var(--gray-200); border-radius:4px; font-weight:bold; font-size:0.85rem;">
                                <span style="font-size:0.75rem; font-weight:600; color:var(--gray-500);">dk</span>
                                <div style="width:1px; height:16px; background:var(--gray-300); margin:0 4px;"></div>
                                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; margin:0;" title="Akıllı Tahta Yansıtma Modunda Zaman Sayacını Göster">
                                    <input type="checkbox" id="meta-screen-timer-check" ${ses.screenViewTimerEnabled !== false ? 'checked' : ''} style="width:16px; height:16px;">
                                    <i class="fa-solid fa-stopwatch" style="color:var(--warning); font-size:0.9rem;"></i>
                                    <span style="font-size:0.75rem; font-weight:600; color:var(--gray-600);">Sayaç</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div id="meta-subjects-list" style="max-height: 400px; overflow-y: auto; padding-right:0.5rem;">
                        ${subjectsHtml}
                    </div>

                    <hr style="margin:1.5rem 0; border:0; border-top:1px solid var(--gray-300);">

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display:block; margin-bottom:0.5rem; font-weight:bold;">Öğrenciye Mesaj / Uyarılar</label>
                        <textarea id="meta-std-msg" class="swal2-textarea" style="width:100%; margin:0; height:80px;" placeholder="Optik formları dikkatli doldurkan...">${ses.studentMsg || ''}</textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display:block; margin-bottom:0.5rem; font-weight:bold;">Öğretmen Mesajı / Talimatlar</label>
                        <textarea id="meta-tch-msg" class="swal2-textarea" style="width:100%; margin:0; height:80px;" placeholder="Sınav süresi ${DataManager.getSchoolSettings().defaultTimes?.defaultExamDuration || 40} dakikadır...">${ses.teacherMsg || ''}</textarea>
                    </div>

                    <hr style="margin:1.5rem 0; border:0; border-top:2px dashed #6366f1;">

                    <div style="background:linear-gradient(135deg,#eef2ff,#f5f3ff); border:1.5px solid #6366f1; border-radius:12px; padding:1.2rem; display:flex; align-items:center; gap:1.2rem;">
                        <i class="fa-solid fa-shuffle" style="font-size:1.8rem; color:#6366f1;"></i>
                        <div style="flex:1;">
                            <strong style="display:block; font-size:0.95rem; color:#1e293b;">Dağıtımı Yenile</strong>
                            <small style="color:#64748b;">Mevcut ayarlar korunarak tüm öğrenciler algoritmaya göre sıfırdan yerleştirilir. Bu işlem geri alınamaz.</small>
                        </div>
                        <button type="button" class="btn btn-primary" style="white-space:nowrap; display:flex; align-items:center; gap:8px; padding:0.6rem 1.2rem; font-weight:700;"
                            onclick="Swal.close(); setTimeout(() => window.redistributeSession('${ses.id}'), 150);">
                            <i class="fa-solid fa-arrows-rotate"></i> Tekrar Dağıt
                        </button>
                    </div>
                </div>
`,
            showCancelButton: true,
            confirmButtonText: 'Tümünü Kaydet',
            cancelButtonText: 'İptal',
            didOpen: () => {
                // Ensure values are selected even if template literal had issues
                const dateInp = document.getElementById('meta-date');
                const timeInp = document.getElementById('meta-time');
                if (dateInp && ses.date) dateInp.value = window.formatDateToInput(ses.date);
                
                let timeVal = ses.time || "";
                if (timeVal.includes('. Ders')) {
                    const lNum = parseInt(timeVal);
                    const school = DataManager.getSchoolSettings();
                    const lessonTimes = school.lessonTimes || {};
                    if (lessonTimes[`${lNum}_start`]) timeVal = lessonTimes[`${lNum}_start`];
                }
                if (timeVal.includes(':')) {
                    const [h, m] = timeVal.split(':');
                    timeVal = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
                }
                if (timeInp) timeInp.value = timeVal;

                const lessonSelect = document.getElementById('meta-lesson');
                if (lessonSelect && timeInp) {
                    lessonSelect.addEventListener('change', (e) => {
                        if (e.target.value) timeInp.value = e.target.value;
                    });
                }

                const durationInp = document.getElementById('meta-duration');
                const timerPreview = document.getElementById('duration-timer-preview');
                const updateTimer = (mins) => {
                    const m = parseInt(mins) || 0;
                    const h = Math.floor(m / 60);
                    const mm = m % 60;
                    const hh = h.toString().padStart(2, '0');
                    const mmm = mm.toString().padStart(2, '0');
                    if (timerPreview) timerPreview.innerText = `${hh}.${mmm}:00`;
                };
                if (durationInp) {
                    durationInp.addEventListener('input', (e) => updateTimer(e.target.value));
                    updateTimer(durationInp.value);
                }
            },
            preConfirm: () => {
                const newMetadata = ses.subjectMetadata ? JSON.parse(JSON.stringify(ses.subjectMetadata)) : {};
                subjectNames.forEach(sub => {
                    const examNumInput = document.querySelector(`.meta-exam-num-input[data-sub="${sub}"]`);
                    const examNum = examNumInput ? examNumInput.value.trim() : '';
                    const papers = {};
                    const paperInputs = document.querySelectorAll(`.meta-paper-input[data-sub="${sub}"]`);

                    if (ses.type === 'uygulama') {
                        papers.uygulamaFiles = [];
                        paperInputs.forEach(inp => {
                            const val = inp.value.trim();
                            if (val) papers.uygulamaFiles.push(val);
                        });
                        const pdfInp = document.querySelector(`.meta-paper-pdf-input[data-sub="${sub}"]`);
                        if (pdfInp) papers['default'] = pdfInp.value.trim();
                    } else if (hasGroups) {
                        paperInputs.forEach(inp => {
                            const group = inp.dataset.group;
                            papers[group] = inp.value.trim();
                        });
                    } else if (paperInputs[0]) {
                        papers['default'] = paperInputs[0].value.trim();
                    }

                    const headerSelect = document.querySelector(`.meta-header-design-select[data-sub="${sub}"]`);
                    const headerDesign = headerSelect ? headerSelect.value : '1';

                    const safeSub = DataManager.sanitizeFirebaseKey(sub);
                    const existingMeta = newMetadata[safeSub] || {};
                    newMetadata[safeSub] = {
                        ...existingMeta,
                        examNo: examNum,
                        pdfHeaderDesign: headerDesign,
                        papers: papers
                    };

                });

                return {
                    subjectMetadata: newMetadata,
                    date: window.formatDateToStandard(document.getElementById('meta-date').value),
                    time: document.getElementById('meta-time').value.trim(),
                    examDuration: parseInt(document.getElementById('meta-duration').value) || 40,
                    studentMsg: document.getElementById('meta-std-msg').value.trim(),
                    teacherMsg: document.getElementById('meta-tch-msg').value.trim(),
                    screenViewEnabled: document.getElementById('meta-screen-check').checked,
                    screenViewTimerEnabled: document.getElementById('meta-screen-timer-check').checked,
                    screenViewLimit: (function() {
                        const val = parseInt(document.getElementById('meta-screen-limit').value);
                        return isNaN(val) ? (DataManager.getSchoolSettings()?.defaultTimes?.defaultScreenViewLimit || 8) : val;
                    })()
                };
            }
        })
            .then((result) => {
                if (result.isConfirmed) {
                    const updatedSes = { ...ses, ...result.value };
                    DataManager.addExamSession(updatedSes);
                    window.renderExamSessionsList();
                    Swal.fire('Kaydedildi', 'Tüm ders bilgileri başarıyla güncellendi.', 'success');
                }
            });
    };

    // ─── Oturumu Tekrar Dağıt ──────────────────────────────────────────────
    window.redistributeSession = function (id) {
        Swal.fire({
            title: 'Tekrar Dağıt',
            html: 'Bu işlem mevcut oturumu <b>sıfırdan</b> dağıtır.<br>Mevcut koltuk atamaları silinir. Devam etmek için şifreyi girin:',
            icon: 'warning',
            input: 'password',
            inputPlaceholder: 'Şifre (1234)',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-arrows-rotate"></i> Doğrula ve Dağıt',
            cancelButtonText: 'İptal',
            confirmButtonColor: '#6366f1',
            inputValidator: (value) => {
                if (!value) return 'Şifre girmelisiniz!';
                if (value !== '1234') return 'Hatalı şifre!';
            }
        }).then(res => {
            if (!res.isConfirmed) return;

            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === id);
            if (!session) return;

            const allRooms = DataManager.getClassrooms();

            // ── Öğrencileri session.results'ten çıkar ──────────────────────
            // Bu yöntem selectedClasses/selectedClassrooms'a BAĞIMLI DEĞİL.
            let targetStudents = [];
            let targetRooms = [];

            // Oturumun derslerini her iki dalda kullanmak için önceden hazırla
            const sessionSubjectsForMerge = (session.subjects || []).map(s =>
                typeof s === 'object' ? s.name : s
            ).filter(Boolean);
            if (!sessionSubjectsForMerge.length && session.subject) sessionSubjectsForMerge.push(session.subject);

            if (session.results && session.results.length) {
                // Öğrencileri mevcut dağıtımdan al (_matchedSubject zaten var)
                const seen = new Set();
                session.results.forEach(room => {
                    Object.values(room.seats || {}).forEach(student => {
                        if (student && !seen.has(student.no)) {
                            seen.add(student.no);
                            targetStudents.push({ ...student });
                        }
                    });
                });

                // ── YENİ: Sonradan eklenen öğrencileri DataManager'dan çek ve ekle ──
                // Mevcut dağıtımda olmayan ama oturumun dersine uygun öğrencileri bul
                const allStudentsNow = DataManager.getStudents();
                allStudentsNow.forEach(s => {
                    if (seen.has(s.no?.toString()) || seen.has(s.no)) return; // zaten var
                    if (session.excludedStudents?.includes(s.no?.toString())) return; // hariç tutulan
                    if (!s.dersler?.length) return;
                    let matched = null;
                    const ok = sessionSubjectsForMerge.length === 0 || s.dersler.some(d => {
                        const dt = d.trim();
                        const hit = sessionSubjectsForMerge.some(base =>
                            dt === base || dt.startsWith(base + ' ') || dt.startsWith(base + '-')
                        );
                        if (hit) matched = dt;
                        return hit;
                    });
                    if (ok) {
                        const studentCopy = { ...s };
                        if (matched) studentCopy._matchedSubject = matched;
                        targetStudents.push(studentCopy);
                        seen.add(s.no?.toString());
                    }
                });

                // Derslik isimlerini sonuçlardan al, DataManager'dan eşleştir
                const resultRoomNames = session.results.map(r => r.name);
                targetRooms = allRooms.filter(r => resultRoomNames.includes(r.name));

                // Eşleşen derslik bulunamadıysa tüm dersliklerden sonuç adıyla ara
                if (!targetRooms.length) {
                    targetRooms = allRooms.filter(r =>
                        resultRoomNames.some(n => n === r.name || r.name.includes(n) || n.includes(r.name))
                    );
                }
            }

            // ── Fallback: DataManager üzerinden filtrele ───────────────────
            if (!targetStudents.length || !targetRooms.length) {
                const allStudents = DataManager.getStudents();

                targetStudents = allStudents.filter(s => {
                    if (session.excludedStudents?.includes(s.no?.toString())) return false;
                    if (!s.dersler?.length) return false;
                    let matched = null;
                    const ok = sessionSubjectsForMerge.length === 0 || s.dersler.some(d => {
                        const dt = d.trim();
                        const hit = sessionSubjectsForMerge.some(base =>
                            dt === base || dt.startsWith(base + ' ') || dt.startsWith(base + '-')
                        );
                        if (hit) matched = dt;
                        return hit;
                    });
                    if (ok) s._matchedSubject = matched;
                    return ok;
                });

                // Derslikler
                if (session.selectedClassrooms?.length) {
                    targetRooms = allRooms.filter(r => session.selectedClassrooms.includes(r.name));
                }
                if (!targetRooms.length) targetRooms = allRooms;
            }

            if (!targetStudents.length || !targetRooms.length) {
                Swal.fire('Eksik Bilgi',
                    `Dağıtım verisi bulunamadı. (Öğrenci: ${targetStudents.length}, Derslik: ${targetRooms.length})`,
                    'error');
                return;
            }

            window._distributeWithRetry([...targetStudents], targetRooms, session, (res) => {
                if (!res) { Swal.fire('Hata', 'Dağıtım sonucu alınamadı.', 'error'); return; }
                session.results = res;
                DataManager.addExamSession(session);
                window._currentExamResults = res;
                window.currentRenderedSession = session;
                window.renderExamSessionsList();
                window._renderExamResults(res);
                setTimeout(() => {
                    if (typeof window.viewSessionDistribution === 'function') {
                        window.viewSessionDistribution(id, null, true);
                    }
                }, 100);
            });
        });
    };

    window.viewSessionDistribution = function (id, forceMode = null, isModeSwitch = false, isAutoRefresh = false) {

        try {
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === id);
            if (!session) return;

            const accordionBody = document.getElementById(`accordion-body-${id}`);
            const resultsContainer = document.getElementById(`results-container-${id}`);
            const arrow = document.getElementById(`arrow-${id}`);

            // Toggle logic ONLY if it's NOT a mode switch or auto-refresh
            if (!isModeSwitch && !isAutoRefresh) {
                const isCurrentlyHidden = accordionBody.classList.contains('hidden');

                // Close others
                document.querySelectorAll('[id^="accordion-body-"]').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('[id^="arrow-"]').forEach(el => el.style.transform = 'rotate(0deg)');

                if (isCurrentlyHidden) {
                    accordionBody.classList.remove('hidden');
                    if (arrow) arrow.style.transform = 'rotate(90deg)';
                    window._currentlyOpenSessionId = id;
                } else {
                    accordionBody.classList.add('hidden');
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                    window._currentlyOpenSessionId = null;
                    window._activeResultsContainer = null;
                    return; // Just closed it
                }
            } else {
                // If it's a mode switch but the accordion is closed (shouldn't happen but safe-guard)
                if (accordionBody.classList.contains('hidden') && !isAutoRefresh) return;
            }

            window._activeResultsContainer = resultsContainer;

            const modeEl = document.getElementById(`mode-select-${id}`);
            const mode = forceMode || (modeEl ? modeEl.value : (session.type === 'uygulama' ? 'class' : 'seating'));
            
            // Save current mode for state persistence
            window._currentlyOpenSessionMode[id] = mode;

            if (!session.results) {
                return window.startSessionDistribution(id);
            }

            window.currentRenderedSession = session;

            let examTeachersData = { classrooms: {}, globalSpares: [] };
            if (DataManager.calculateExamTeachers) {
                examTeachersData = DataManager.calculateExamTeachers(session, window.globalTeachersDb || {});
            }
            window._currentExamTeachersData = examTeachersData;

            resultsContainer.innerHTML = '';

            if (mode === 'class') {
                renderClasswiseList(session, resultsContainer, true);
            } else if (mode === 'room') {
                renderRoomwiseList(session, resultsContainer, true);
            } else {
                window._currentExamResults = session.results;
                window._renderExamResults(session, resultsContainer, true);
            }



        } catch (err) {
            console.error("Error in viewSessionDistribution:", err);
            Swal.fire('Görüntüleme Hatası', err.message, 'error');
        }
    };

    function renderRoomwiseList(session, targetContainer = null, appendMode = false) {
        const view = targetContainer || document.getElementById('examClassroomsView');
        if (!appendMode) view.innerHTML = '';

        session.results.forEach((room, idx) => {
            const roomId = `nested-room-list-${idx}-${Math.random().toString(36).substr(2, 5)}`;
            const roomPanel = document.createElement('div');
            roomPanel.style.marginBottom = '1rem';

            // Assign visual Sequence Nos consistently (Rule: Bottom-Left = 1)
            let roomSeatCounter = 1;
            const seatToNum = {};
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                // Sequence from Front to Back: 1 to rows
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(room.disabledSeats && room.disabledSeats.includes(sid))) {
                            seatToNum[sid] = roomSeatCounter++;
                        }
                    }
                }
            }

            // Extract students from seats and sort by seat ID (G..S..C..)
            let allHavePdf = true;
            const sortedSeats = Object.keys(room.seats).sort((a, b) => {
                const partsA = a.match(/\d+/g).map(Number);
                const partsB = b.match(/\d+/g).map(Number);
                for (let i = 0; i < partsA.length; i++) {
                    if (partsA[i] !== partsB[i]) return partsA[i] - partsB[i];
                }
                return 0;
            });

        const metadata = session.subjectMetadata || {};

        let tableRows = sortedSeats.map(seatId => {
            const s = room.seats[seatId];
            
            const subName = s._matchedSubject || '-';
            const group = s._groupLabel || s.group || 'default';
            const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
            const papers = meta.papers || {};
            let path = typeof papers === 'string' ? papers : (papers[group] || papers['default'] || '');
            const hasPdf = path && path.trim().length > 0;
            
            if (!hasPdf) allHavePdf = false;
            
            let checkboxHtml = '';
            if (hasPdf) {
                checkboxHtml = `<input type="checkbox" class="student-paper-check" 
                            data-student-no="${s.no}" 
                            data-student-name="${s.name}"
                            data-sub="${s._matchedSubject || '-'}" 
                            data-group="${s._groupLabel || ''}" 
                            data-room="${room.name}"
                            data-class="${s.class}"
                            data-seat="${seatToNum[seatId] || '-'}"
                            style="width:15px; height:15px;">`;
            }

            const effCount = getEffectiveSubjectGroupCount(session, s._matchedSubject);
            const groupSuffix = (effCount > 1 && (s._groupLabel || s.group)) ? ` (${s._groupLabel || s.group})` : '';

            return `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee;"><b>${seatToNum[seatId] || '-'}</b></td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${s.class}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;"><b>${s.no}</b></td>
                    <td style="padding:8px; border-bottom:1px solid #eee;"><b>${s.name}${groupSuffix}</b></td>
                    <td style="padding:8px; border-bottom:1px solid #eee; font-size:0.8rem;">${window.shortenSubject(s._matchedSubject || '-', 15)}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                        ${checkboxHtml}
                    </td>
                </tr>
`;
        }).join('');

            roomPanel.innerHTML = `
                <div class="nested-accordion-header" onclick="toggleNestedAccordion('${roomId}')" style="background:var(--gray-50); padding:1rem; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <h3 style="margin:0; font-size:1.1rem;"><i class="fa-solid fa-door-open" style="color:var(--secondary);"></i> ${room.name} Salonu</h3>
                        ${(window._currentExamTeachersData?.classrooms?.[room.name]?.gorevli) ? 
                            `<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px; margin-left:10px;">Görevli: ${window._currentExamTeachersData.classrooms[room.name].gorevli}</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        ${(allHavePdf && session.type !== 'uygulama') ? `<label style="display:flex; align-items:center; gap:5px; margin:0; cursor:pointer; font-size:0.85rem; font-weight:700; color:var(--primary);" onclick="event.stopPropagation();">
                            <input type="checkbox" class="room-paper-check" data-room="${room.name}" style="width:16px; height:16px;"> Soru Kağıdı
                        </label>` : ''}
                        <i class="fa-solid fa-print" style="color:var(--gray-400); cursor:pointer;" title="Bu Salonu Yazdır" onclick="event.stopPropagation(); window.printSessionDistribution('${session.id}', '${room.name}')"></i>
                        <i id="icon-${roomId}" class="fa-solid fa-chevron-right" style="color:var(--gray-400);"></i>
                    </div>
                </div>
    <div id="${roomId}" class="hidden" style="padding:1.5rem; border:1px solid var(--gray-200); border-top:none; border-bottom-left-radius:8px; border-bottom-right-radius:8px; background:white; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
            <thead>
                <tr style="background:var(--gray-50); color:var(--gray-700);">
                    <th style="padding:8px; width:60px;">Sıra</th>
                    <th style="padding:8px; width:80px;">Sınıf</th>
                    <th style="padding:8px; width:80px;">No</th>
                    <th style="padding:8px;">Ad Soyad</th>
                    <th style="padding:8px;">Sınav Dersi</th>
                    <th style="padding:8px; width:100px; text-align:center;">Soru Kağıdı</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
`;
            view.appendChild(roomPanel);
        });
    }

    function renderClasswiseList(session, targetContainer = null, appendMode = false) {
        const view = targetContainer || document.getElementById('examClassroomsView');
        if (!appendMode) view.innerHTML = '';

        // Flatten with sequence numbers
        const flatList = [];
        session.results.forEach(room => {
            // Re-calculate visual numbers for this room (Rule: Bottom-Left = 1)
            let roomSeatCounter = 1;
            const seatToNum = {};
            for (let g = 1; g <= room.groups; g++) {
                const conf = room.groupConfigs ? room.groupConfigs[g - 1] : { rows: room.rows || 1, cols: room.cols || 1 };
                // Sequence from Front to Back: 1 to rows
                for (let r = 1; r <= conf.rows; r++) {
                    for (let c = 1; c <= conf.cols; c++) {
                        const sid = `G${g}-S${r}-C${c}`;
                        if (!(room.disabledSeats && room.disabledSeats.includes(sid))) {
                            seatToNum[sid] = roomSeatCounter++;
                        }
                    }
                }
            }

            Object.entries(room.seats).forEach(([seatId, std]) => {
                flatList.push({
                    ...std,
                    room: room.name,
                    seatNum: seatToNum[seatId] || '-'
                });
            });
        });

        // Group by class
        const byClass = {};
        flatList.forEach(s => {
            if (!byClass[s.class]) byClass[s.class] = [];
            byClass[s.class].push(s);
        });

        const sortedClasses = Object.keys(byClass).sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b);
        });

        sortedClasses.forEach((className, idx) => {
            const classId = `nested-class-list-${idx}-${Math.random().toString(36).substr(2, 5)}`;
            const classPanel = document.createElement('div');
            classPanel.style.marginBottom = '1rem';

            let teacherSpan = '';
            if (session.type === 'uygulama') {
                const firstStudent = byClass[className]?.[0];

                if (firstStudent && firstStudent.room) {
                    const roomName = firstStudent.room;
                    const teachersData = window._currentExamTeachersData || {};
                    const gorevli = teachersData.classrooms?.[roomName]?.gorevli;
                    if (gorevli) {
                        teacherSpan = `<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px; margin-left:10px;">Görevli: ${gorevli}</span>`;
                    }
                }
            }

            const metadata = session.subjectMetadata || {};
            let allHavePdf = true;
            let tableRows = byClass[className]
                .sort((a, b) => parseInt(a.no) - parseInt(b.no))
                .map(s => {
                    const subName = s._matchedSubject || '-';
                    const group = s._groupLabel || s.group || 'default';
                    const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
                    const papers = meta.papers || {};
                    let path = typeof papers === 'string' ? papers : (papers[group] || papers['default'] || '');
                    const hasPdf = path && path.trim().length > 0;
                    
                    if (!hasPdf) allHavePdf = false;
                    
                    let checkboxHtml = '';
                    if (hasPdf) {
                        checkboxHtml = `<input type="checkbox" class="student-paper-check" 
                                data-student-no="${s.no}" 
                                data-student-name="${s.name}"
                                data-sub="${s._matchedSubject || '-'}" 
                                data-group="${s._groupLabel || ''}" 
                                data-room="${s.room}"
                                data-class="${className}"
                                data-seat="${s.seatNum}"
                                style="width:15px; height:15px;">`;
                    }
                    
                    return `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><b>${s.no}${s._groupLabel ? ` (${s._groupLabel})` : ''}</b></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${s.name}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; font-size:0.8rem;">${window.shortenSubject(s._matchedSubject || '-', 15)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${s.room}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><b>${s.seatNum}</b></td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                            ${checkboxHtml}
                        </td>
                    </tr>
`;
                }).join('');

            classPanel.innerHTML = `
                <div class="nested-accordion-header" onclick="toggleNestedAccordion('${classId}')" style="background:var(--gray-50); padding:1rem; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <h3 style="margin:0; font-size:1.1rem;"><i class="fa-solid fa-users" style="color:var(--primary);"></i> ${className} Sınıf Listesi</h3>
                        ${teacherSpan}
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        ${allHavePdf ? `<label style="display:flex; align-items:center; gap:5px; margin:0; cursor:pointer; font-size:0.85rem; font-weight:700; color:var(--primary);" onclick="event.stopPropagation();">
                            <input type="checkbox" class="class-paper-check" data-class="${className}" style="width:16px; height:16px;"> Soru Kağıdı
                        </label>` : ''}
                        <i class="fa-solid fa-print" style="color:var(--gray-400); cursor:pointer;" title="Bu Sınıfı Yazdır" onclick="event.stopPropagation(); window.printSessionDistribution('${session.id}', '${className}')"></i>
                        <i id="icon-${classId}" class="fa-solid fa-chevron-right" style="color:var(--gray-400);"></i>
                    </div>
                </div>
    <div id="${classId}" class="hidden" style="padding:1.5rem; border:1px solid var(--gray-200); border-top:none; border-bottom-left-radius:8px; border-bottom-right-radius:8px; background:white; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
            <thead>
                <tr style="background:var(--gray-50); color:var(--gray-700);">
                    <th style="padding:8px; width:70px;">No</th>
                    <th style="padding:8px;">Ad Soyad</th>
                    <th style="padding:8px;">Sınav Dersi</th>
                    <th style="padding:8px;">Derslik</th>
                    <th style="padding:8px; width:60px;">Sıra</th>
                    <th style="padding:8px; width:100px; text-align:center;">Soru Kağıdı</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
`;
            view.appendChild(classPanel);
        });
    }

    window.startSessionDistribution = function (id) {
        const session = DataManager.getExamSessions().find(s => s.id === id);
        if (!session) return;

        // 1. Filter Classrooms
        const allRooms = DataManager.getClassrooms();
        const targetRooms = allRooms.filter(r => session.selectedClassrooms.includes(r.name));

        // 2. Filter Students
        const allStudents = DataManager.getStudents();
        const sessionSubjects = session.subjects || [session.subject];

        const targetStudents = allStudents.filter(s => {
            const poolId = `${s.class}| ${s.alan || ""} `;
            if (!session.selectedClasses.includes(poolId) && !session.selectedClasses.includes(s.class)) return false;

            let matchedSubject = null;
            const hasSub = s.dersler && s.dersler.some(d => {
                const found = sessionSubjects.some(base => d.trim() === base || d.trim().startsWith(base + " "));
                if (found) matchedSubject = d.trim();
                return found;
            });
            if (!hasSub) return false;

            if (session.excludedStudents && session.excludedStudents.includes(s.no.toString())) return false;

            s._matchedSubject = matchedSubject;
            return true;
        });

        if (targetStudents.length === 0 || targetRooms.length === 0) {
            Swal.fire('Eksik Bilgi', 'Oturum için yeterli hedef öğrenci veya onaylı derslik bulunamadı!', 'error');
            return;
        }

        window._distributeWithRetry([...targetStudents], targetRooms, session, (res) => {
            if (!res) { Swal.fire('Hata', 'Dağıtım sonucu alınamadı.', 'error'); return; }
            session.results = res;
            DataManager.addExamSession(session);
            window._currentExamResults = res;
            document.getElementById('examSetupPanel').classList.add('hidden');
            document.getElementById('examResultsPanel').classList.remove('hidden');
            window.currentRenderedSession = session;
            window._renderExamResults(res);
        });
    };

    // --- End Exam Session Wizard Logic ---
});
