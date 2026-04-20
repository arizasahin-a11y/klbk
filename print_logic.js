window.printSession = async function (id) {
    const sessions = DataManager.getExamSessions();
    const session = sessions.find(s => s.id === id);

    if (!session || !session.results || session.results.length === 0) {
        Swal.fire('Bilgi', 'Bu oturum için henüz sınav dağıtımı yapılmamış.', 'info');
        return;
    }

    const modeRadio = document.querySelector(`input[name="printMode-${id}"]:checked`);
    if (!modeRadio) return;
    const mode = modeRadio.value;

    let entities = [];
    let entityTypeStr = '';

    if (mode === 'class') {
        const classSet = new Set();
        session.results.forEach(room => {
            Object.values(room.seats || {}).forEach(std => classSet.add(std.class));
        });
        entities = Array.from(classSet).sort(sortByNum);
        entityTypeStr = 'Sınıflar';
    } else {
        entities = session.results.map(r => r.name).sort(sortByNum);
        entityTypeStr = 'Salonlar';
    }

    if (entities.length === 0) {
        Swal.fire('Bilgi', 'Yazdırılacak veri bulunamadı.', 'info');
        return;
    }

    let checkboxesHtml = entities.map(entity => `
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 5px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; transition: 0.2s;">
                    <input type="checkbox" name="printEntity" value="${entity}" checked style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
                    <span style="font-size: 1.05rem; font-weight: 700; color: #1e293b;">${entity}</span>
                </label>
            `).join('');

    Swal.fire({
        title: `Yazdırılacak ${entityTypeStr}`,
        html: `
                    <div style="text-align: left; padding: 10px; margin-bottom: 10px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; width: 100%;">
                            <input type="checkbox" id="selectAllEntities" checked style="width: 22px; height: 22px; cursor: pointer; accent-color: var(--primary);" onchange="document.querySelectorAll('input[name=printEntity]').forEach(cb => cb.checked = this.checked)">
                            <span style="font-size: 1.1rem; font-weight: 900; color: var(--primary);">Tümünü Seç</span>
                        </label>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; max-height: 250px; overflow-y: auto; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 15px;">
                            ${checkboxesHtml}
                        </div>
                    </div>
                `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-print"></i> YAZDIR',
        cancelButtonText: 'İptal',
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: 'var(--gray-500)',
        width: 600,
        preConfirm: () => {
            const selected = Array.from(document.querySelectorAll('input[name="printEntity"]:checked')).map(cb => cb.value);
            if (selected.length === 0) {
                Swal.showValidationMessage('Lütfen en az bir tane seçin.');
            }
            return selected;
        }
    }).then((result) => {
        if (result.isConfirmed && result.value.length > 0) {
            executePrintSession(id, mode, result.value);
        }
    });
}

async function executePrintSession(id, mode, filterArray) {
    const sessions = DataManager.getExamSessions();
    const session = sessions.find(s => s.id === id);

    if (!session || !session.results || session.results.length === 0) return;

    let examTeachersData = { classrooms: {}, globalSpares: [] };
    if (window.DataManager && window.DataManager.getSchoolTeachers) {
        const teachersDb = await window.DataManager.getSchoolTeachers();
        examTeachersData = window.DataManager.calculateExamTeachers(session, teachersDb);
    }

    // --- SINAV KAĞIDI YAZDIRMA MANTIĞI ---
    const paperCheck = document.getElementById(`paperCheck-${id}`);
    if (paperCheck && paperCheck.checked) {
        const myBranches = JSON.parse(sessionStorage.getItem('myBranches') || '[]');
        const pdfUrls = [];
        const seenPdfs = new Set();
        
        const branchMatches = (sName) => {
            if (!sName) return false;
            const name = sName.toLowerCase().trim();
            return myBranches.some(b => {
                const bn = b.toLowerCase().trim();
                return name === bn || name.startsWith(bn + " ");
            });
        };

        const subjectList = session.subjects ? session.subjects.map(s => typeof s === 'object' ? s.name : s) : [];
        
        subjectList.forEach(subName => {
            const meta = DataManager.getSanitizedSubjectMetadata(session, subName);
            if (!meta) return;

            const isMine = branchMatches(subName);
            const isShared = meta.isShared === true;

            if (isMine || isShared) {
                if (meta.papers) {
                    const papers = typeof meta.papers === 'string' ? { default: meta.papers } : meta.papers;
                    Object.values(papers).forEach(url => {
                        if (url && url.trim() && !seenPdfs.has(url)) {
                            pdfUrls.push({ url, subject: subName });
                            seenPdfs.add(url);
                        }
                    });
                }
            }
        });

        if (pdfUrls.length > 0) {
            mergeAndPrintPapers(pdfUrls, session.name);
        }
    }
    // ------------------------------------


    const pageCss = `
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 0; padding: 0; background: #e2e8f0; }
                
                @media print {
                    body { background: white; }
                    .page { box-shadow: none !important; margin: 0 !important; }
                }
                @page { margin: 0; }
                @page portrait_page { size: A4 portrait; margin: 0; }
                @page landscape_page { size: A4 landscape; margin: 0; }
                
                .page { 
                    padding: 8mm; 
                    box-sizing: border-box; 
                    page-break-after: always; 
                    display: flex; 
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                    background: white;
                }
                .page:last-child { page-break-after: avoid; }

                /* Explicitly assign page rules for modern browsers to respect per-page orientation */
                .page.portrait { page: portrait_page; width: 210mm; height: 297mm; }
                .page.landscape { page: landscape_page; width: 297mm; height: 210mm; }

                .page-header { 
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 2px solid #6366f1; margin-bottom: 15px; padding-bottom: 8px;
                }
                .page-header h2 { margin: 0; font-size: 18pt; color: #4f46e5; font-weight: 900; }
                .page-header .info { text-align: right; font-size: 10pt; color: #1e293b; font-weight: 600; }

                table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
                th { background: #f8fafc; padding: 5px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; font-size: 8.5pt; }
                td { padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; height: 14pt; font-size: 8.5pt; }
                tr:nth-child(even) td { background: #fcfcfc; }

                .msg-box {
                    margin-top: auto; padding: 12px 15px; border: 2px solid #6366f1; border-radius: 10px;
                    background: #f5f7ff; color: #1e293b; font-size: 9.5pt; line-height: 1.5;
                }
                .msg-box strong { color: #4f46e5; display: flex; align-items: center; margin-bottom: 6px; font-size: 1.1em; }
                .msg-box .icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #ef4444; color: white; border-radius: 50%; margin-right: 10px; font-size: 14px; }

                .schema-container { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 10px; overflow: hidden; }
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
                .desk-group { display: grid; gap: 8px; padding: 12px; border: 1.5px dashed #cbd5e1; border-radius: 10px; background: #fafafa; }
                .desk { width: 95px; height: 80px; border: 1.8px solid #6366f1; border-radius: 8px;
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        font-size: 8pt; text-align: center; background: white; padding: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);
                        position: relative; overflow: visible; }
                .desk.empty { border: 1.8px dashed #ef4444; color: #ef4444; background: #fff5f5; font-weight: bold; }
                .desk-num { width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; border: 1px solid #cbd5e1; color: #1e293b; font-size: 10pt; font-weight: 900; 
                           display: flex; align-items: center; justify-content: center; 
                           position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); background: white; z-index: 10;
                           box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            `;

    const formatDate = (d) => {
        if (!d) return '';
        const parts = d.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
    };

    const abbr = (n) => {
        if (!n || n === '-') return n;
        return n.replace(/Matematik/gi, 'Mat.').replace(/Edebiyat/gi, 'Edb.').replace(/İngilizce/gi, 'İng.').replace(/Fizik/gi, 'Fiz.').replace(/Kimya/gi, 'Kim.').replace(/Biyoloji/gi, 'Biyo.').replace(/Tarih/gi, 'Tar.').replace(/Coğrafya/gi, 'Coğ.').replace(/Felsefe/gi, 'Fel.').replace(/Din Kültürü/gi, 'Din.').replace(/Almanca/gi, 'Alm.').replace(/Görsel Sanatlar/gi, 'Grs.').replace(/Müzik/gi, 'Müz.').replace(/Beden Eğitimi/gi, 'Bed.').replace(/Bilişim/gi, 'Biliş.');
    };

    const hdr = (title, roomName = null) => {
        let gorevliHtml = '';
        if (roomName && examTeachersData.classrooms[roomName]) {
            const gorevli = examTeachersData.classrooms[roomName].gorevli;
            if (gorevli) {
                gorevliHtml = `<div style="font-size:12pt; font-weight:700; color:#dc2626; border: 2px dashed #ef4444; border-radius: 6px; padding: 4px 8px; background: #fef2f2; display: inline-block;">GÖREVLİ Öğretmen: ${gorevli}</div>`;
            }
        }
        
        return `
                <div class="page-header" style="align-items:flex-start;">
                    <div style="flex:1;"><h2>${title}</h2></div>
                    ${gorevliHtml ? `<div style="flex:1.5; text-align:center;">${gorevliHtml}</div>` : ''}
                    <div class="info" style="flex:1; text-align:right;">
                        <div>${session.name}</div>
                        <div style="font-size: 9pt; color: #64748b; font-weight: 400;">
                            ${formatDate(session.date)} ${session.time || ''}
                        </div>
                    </div>
                </div>`;
    };

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
        flatList.forEach(s => (byClass[s.class] = byClass[s.class] || []).push(s));
        const sorted = Object.keys(byClass).filter(c => filterArray.includes(c)).sort(sortByNum);
        const studentMsg = (session.studentMsg || '').trim();

        sorted.forEach(cls => {
            const students = byClass[cls].sort((a, b) => parseInt(a.no) - parseInt(b.no));
            const PAGE_SIZE = 45;
            for (let p = 0; p < students.length; p += PAGE_SIZE) {
                const chunk = students.slice(p, p + PAGE_SIZE);
                const rows = chunk.map(s => `<tr><td style="width:10%;"><b>${s.no}</b></td><td style="width:40%; text-transform:uppercase;">${s.name}</td><td style="width:30%;">${s._matchedSubject || '-'}</td><td style="width:12%;">${s.room}</td><td style="width:8%; text-align:center;"><b>${s.seatNum}</b></td></tr>`).join('');
                body += `<div class="page portrait">${hdr(`${cls} Sınıf Listesi`, cls)}<table><thead><tr><th style="width:10%;">No</th><th style="width:40%;">Ad Soyad</th><th style="width:30%;">Sınav Dersi</th><th style="width:12%;">Derslik</th><th style="width:8%;">Sıra</th></tr></thead><tbody>${rows}</tbody></table>${(studentMsg && (p + PAGE_SIZE >= students.length)) ? `<div class="msg-box"><strong><span class="icon">!</span> Dikkat: </strong>${studentMsg}</div>` : ""}</div>`;
            }
        });

        // ─────── SALON MODU ───────────────────────────────────────────
    } else if (mode === 'room') {
        const sortedRooms = [...session.results].filter(r => filterArray.includes(r.name)).sort((a, b) => sortByNum(a.name, b.name));
        sortedRooms.forEach(room => {
            let ctr = 1; const seatToNum = {}; const seatIds = [];
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
            const PAGE_SIZE = 45;
            for (let p = 0; p < sortedSeatIds.length; p += PAGE_SIZE) {
                const chunk = sortedSeatIds.slice(p, p + PAGE_SIZE);
                const rows = chunk.map(sid => {
                    const s = room.seats[sid];
                    if (s) return `<tr><td style="text-align:center; width:6%;"><b>${seatToNum[sid] || '-'}</b></td><td style="width:7%;">${s.class}</td><td style="text-align:center; width:7%;"><b>${s.no}</b></td><td style="width:45%; text-transform:uppercase;">${s.name}</td><td style="width:20%;">${abbr(s._matchedSubject || '-')}</td><td style="width:15%; border-bottom:1px solid #eee;"></td></tr>`;
                    else return `<tr style="color:#64748b; background:#fff5f5;"><td style="text-align:center;"><b>${seatToNum[sid] || '-'}</b></td><td colspan="4" style="text-align:center; font-weight:bold; letter-spacing:2px;">BOŞ</td><td></td></tr>`;
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
                        summaryListHtml += `<div style="padding: 2px 0; border-bottom: 1px dashed #e2e8f0; font-size: 8.5pt;"><b>${cls}</b> ${abbr(ex)} => <b>${count}</b></div>`;
                        roomTotal += count;
                    });
                });
                let examSummaryRows = [...new Set(studentsInRoom.map(s => s._matchedSubject || '-'))].sort().map(ex => {
                    const count = studentsInRoom.filter(s => (s._matchedSubject || '-') === ex).length;
                    return `<tr><td style="padding:2px 4px;">${ex}</td><td style="text-align:center; font-weight:bold;">${count}</td></tr>`;
                }).join('');
                const summaryContent = (p + PAGE_SIZE >= sortedSeatIds.length) ? `
                            <div style="flex-shrink:0; width:45mm; margin-left:10px;">
                                <div style="background:#f8fafc; padding:6px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:10px;">
                                    <div style="font-size:8.5pt; font-weight:900; color:#4f46e5; border-bottom:2px solid #6366f1; padding-bottom:3px; margin-bottom:6px;">DERSLİK ÖZETİ</div>
                                    <div style="line-height:1.2;">${summaryListHtml}<div style="margin-top:5px; padding-top:3px; border-top:2px solid #6366f1; font-weight:900; color:#4f46e5; text-align:right; font-size:8.5pt;">TOPLAM: ${roomTotal}</div></div>
                                </div>
                                <div style="background:#fff7ed; padding:6px; border-radius:10px; border:1px solid #ffedd5;">
                                    <div style="font-size:8.5pt; font-weight:900; color:#c2410c; border-bottom:2px solid #f97316; padding-bottom:3px; margin-bottom:6px;">SINAV TOPLAMLARI</div>
                                    <table style="font-size:7.5pt;"><thead><tr><th style="padding:2px 4px; width:75%;">Sınav</th><th style="padding:2px 4px; width:25%;">Sayı</th></tr></thead><tbody>${examSummaryRows}</tbody></table>
                                </div>
                            </div>` : '';
                
                let sigHtml = '';
                if (p + PAGE_SIZE >= sortedSeatIds.length) {
                    const gorevliName = examTeachersData.classrooms[room.name] ? examTeachersData.classrooms[room.name].gorevli : '';
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

                body += `<div class="page portrait">${hdr(`${room.name} Salonu - Oturma Listesi`, room.name)}<div style="display:flex; flex:1;"><div style="flex:1;"><table><thead><tr><th>Sıra</th><th>Sınıf</th><th>No</th><th>Ad Soyad</th><th>Sınav</th><th>Açıklama</th></tr></thead><tbody>${rows}</tbody></table></div>${summaryContent}</div>${(teacherMsg && (p + PAGE_SIZE >= sortedSeatIds.length)) ? `<div class="msg-box" style="border-color:#ca8a04; background:#fffaf0; margin-bottom:5px;"><strong><span class="icon" style="background:#ea580c;">!</span> Dikkat: </strong>${teacherMsg}</div>` : ""}${sigHtml}</div>`;
            }
        });

        // ─────── OTURMA ŞEMASI ───────────────────────────────────────────
    } else if (mode === 'seating') {
        const sortedRooms = [...session.results].filter(r => filterArray.includes(r.name)).sort((a, b) => sortByNum(a.name, b.name));
        sortedRooms.forEach(room => {
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
                        if (isDisabled) groupsHtml += `<div class="desk" style="opacity:0.3; border-style:dotted;">KAPALI</div>`;
                        else if (student) groupsHtml += `<div class="desk"><div style="font-size:7pt;color:#64748b;font-weight:700;margin-bottom:2px;">${student.class} / ${student.no}</div><div style="font-weight:900;font-size:8.5pt;color:#1e293b; text-transform:uppercase;">${student.name}</div><div style="font-size:6.5pt;color:#4f46e5;margin-top:3px;font-weight:600;">${abbr(student._matchedSubject || '-')}</div><div class="desk-num">${num}</div></div>`;
                        else groupsHtml += `<div class="desk empty">BOŞ<div class="desk-num" style="background:#fee2e2; color:#ef4444;">${num}</div></div>`;
                    }
                }
                groupsHtml += '</div>';
            }
            groupsHtml += '</div>';
            body += `<div class="page landscape">${hdr(`${room.name} Salonu - Oturma Şeması`, room.name)}<div class="schema-container"><div class="classroom-walls">${groupsHtml}<div class="front-side">${room.teacherDeskPos === 'left' ? `<div class="teacher-desk">ÖĞRETMEN MASASI</div><div class="board">YAZI TAHTASI</div><div style="width:110px;"></div>` : `<div style="width:110px;"></div><div class="board">YAZI TAHTASI</div><div class="teacher-desk">ÖĞRETMEN MASASI</div>`}</div></div></div></div>`;
        });
    }

    if (body !== '') {
        body += `<script>window.addEventListener('load', () => { setTimeout(() => { document.querySelectorAll('.schema-container').forEach(wrap => { const wall = wrap.querySelector('.classroom-walls'); const wrapW = wrap.clientWidth - 20; const wrapH = wrap.clientHeight - 20; const scale = Math.min(wrapW / wall.offsetWidth, wrapH / wall.offsetHeight, 2.5); wall.style.transform = "scale(" + scale + ")"; }); }, 150); });<\/script>`;
    }
    const win = window.open('', '_blank');
    if (!win) {
        Swal.fire('Hata', 'Yeni sekme açılamadı! Lütfen tarayıcı ayarlarından açılır pencerelere izin verin.', 'error');
        return;
    }
    const doc = win.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + session.name + '</title>');
    doc.write('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">');
    doc.write('<style>' + pageCss + ' .floating-print-btn { position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px; background: #4f46e5; color: white; border: none; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; z-index: 10000; transition: all 0.3s; } .floating-print-btn:hover { background: #4338ca; transform: scale(1.1); } @media print { .floating-print-btn { display: none !important; } }</style>');
    doc.write('</head><body>' + body);
    doc.write('<button class="floating-print-btn" onclick="window.print()" title="Yazdır"><i class="fas fa-print"></i></button>');
    doc.write('</body></html>');
    doc.close();
}

async function mergeAndPrintPapers(pdfUrls, sessionName) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Hazırlanıyor...',
            text: 'Soru kağıtları birleştiriliyor, lütfen bekleyin.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        });
    }

    try {
        const { PDFLib, DataManager } = window;
        if (!PDFLib) throw new Error("PDFLib kütüphanesi yüklenemedi.");
        
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        for (const item of pdfUrls) {
            try {
                const bytes = await DataManager.getFileBytes(item.url);
                if (!bytes) continue;
                const pdf = await PDFLib.PDFDocument.load(bytes);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            } catch (err) {
                console.error("PDF load error:", item.url, err);
            }
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        if (typeof Swal !== 'undefined') Swal.close();
        
        if (window.openSafePdf) {
            window.openSafePdf(url, sessionName + ' - Soru Kağıtları');
        } else {
            window.open(url, '_blank');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') {
            Swal.close();
            Swal.fire('Hata', 'Soru kağıtları birleştirilemedi: ' + err.message, 'error');
        }
        console.error("Merge error:", err);
    }
}
