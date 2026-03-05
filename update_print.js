const fs = require('fs');
const path = require('path');

const filePath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'ogretmen.html');
let content = fs.readFileSync(filePath, 'utf8');

const newCode = `        window.testPdfLink = function(sesId, encodedSub, groupLetter = null) {
            const inputId = groupLetter ? \`pdfLink-\${sesId}-\${encodedSub}-\${groupLetter}\` : \`pdfLink-\${sesId}-\${encodedSub}\`;
            const el = document.getElementById(inputId);
            if (el && el.value.trim().length > 0) {
                window.open(el.value.trim(), '_blank');
            } else {
                Swal.fire('Uyarı', 'Test edilecek bir bağlantı bulunamadı. Lütfen önce geçerli bir PDF bağlantısı girin.', 'warning');
            }
        }

        window.printSession = async function (id) {
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === id);

            if (!session || !session.results || session.results.length === 0) {
                Swal.fire('Bilgi', 'Bu oturum için henüz sınav dağıtımı yapılmamış.', 'info');
                return;
            }

            Swal.fire({
                title: 'Yazdırılacak Listeler',
                html: \`
                    <div style="text-align: left; padding: 15px 10px; display: flex; flex-direction: column; gap: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 1.1rem; font-weight: 700; color: #1e293b; padding: 5px;">
                            <input type="checkbox" id="printMode-class" value="class" style="width: 22px; height: 22px; cursor: pointer; accent-color: var(--primary);">
                            <i class="fa-solid fa-users" style="color: var(--primary); width: 24px;"></i> Sınıf Listesi
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 1.1rem; font-weight: 700; color: #1e293b; padding: 5px;">
                            <input type="checkbox" id="printMode-room" value="room" checked style="width: 22px; height: 22px; cursor: pointer; accent-color: var(--primary);">
                            <i class="fa-solid fa-door-open" style="color: var(--primary); width: 24px;"></i> Salon Listesi
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 1.1rem; font-weight: 700; color: #1e293b; padding: 5px;">
                            <input type="checkbox" id="printMode-seating" value="seating" style="width: 22px; height: 22px; cursor: pointer; accent-color: var(--primary);">
                            <i class="fa-solid fa-chair" style="color: var(--primary); width: 24px;"></i> Oturma Şeması
                        </label>
                    </div>
                    <div style="font-size: 0.85rem; color: #64748b; margin-top: 15px; font-weight: 600;">İstediğiniz listeleri seçip tek seferde yazdırabilirsiniz.</div>
                \`,
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-print"></i> YAZDIR',
                cancelButtonText: 'İptal',
                confirmButtonColor: 'var(--primary)',
                cancelButtonColor: 'var(--gray-500)',
                preConfirm: () => {
                    const selected = [];
                    if (document.getElementById('printMode-class').checked) selected.push('class');
                    if (document.getElementById('printMode-room').checked) selected.push('room');
                    if (document.getElementById('printMode-seating').checked) selected.push('seating');
                    if (selected.length === 0) {
                        Swal.showValidationMessage('Lütfen en az bir liste türü seçin.');
                    }
                    return selected;
                }
            }).then((result) => {
                if (result.isConfirmed && result.value.length > 0) {
                    executePrintSession(id, result.value);
                }
            });
        }

        async function executePrintSession(id, modes) {
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === id);
            
            if (!session || !session.results || session.results.length === 0) return;

            const pageCss = \`
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 0; padding: 0; background: #e2e8f0; }
                
                @media print {
                    body { background: white; }
                    .page { box-shadow: none !important; margin: 0 !important; }
                }

                @page { margin: 0; }
                
                @page portrait_page { size: A4 portrait; margin: 0; }
                @page landscape_page { size: A4 landscape; margin: 0; }
                
                .page { 
                    padding: 12mm; 
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
                    border: 4px solid #334155; padding: 35px; border-radius: 24px; background: #fff;
                    display: inline-block; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,0.08);
                    transform-origin: center;
                }
                .front-side { display: flex; justify-content: space-around; align-items: flex-start; margin-top: 40px; width: 100%; border-top: 3px solid #334155; padding-top: 20px; }
                .teacher-desk { 
                    width: 130px; height: 70px; border: 3px solid #475569; background: #f1f5f9;
                    display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: bold; color: #1e293b;
                    border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .board { 
                    background: #0f172a; color: white; padding: 12px 70px; border-radius: 6px; font-size: 11pt;
                    font-weight: bold; letter-spacing: 4px; border: 4px solid #475569; box-shadow: 0 6px 12px rgba(0,0,0,0.2);
                }
                .groups-row { display: flex; gap: 50px; justify-content: center; flex-wrap: wrap; }
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
            \`;

            const formatDate = (d) => {
                if (!d) return '';
                const parts = d.split('-');
                return parts.length === 3 ? \`\${parts[2]}.\${parts[1]}.\${parts[0]}\` : d;
            };

            const abbr = (n) => {
                if (!n || n === '-') return n;
                return n.replace(/Matematik/gi, 'Mat.').replace(/Edebiyat/gi, 'Edb.').replace(/İngilizce/gi, 'İng.').replace(/Fizik/gi, 'Fiz.').replace(/Kimya/gi, 'Kim.').replace(/Biyoloji/gi, 'Biyo.').replace(/Tarih/gi, 'Tar.').replace(/Coğrafya/gi, 'Coğ.').replace(/Felsefe/gi, 'Fel.').replace(/Din Kültürü/gi, 'Din.').replace(/Almanca/gi, 'Alm.').replace(/Görsel Sanatlar/gi, 'Grs.').replace(/Müzik/gi, 'Müz.').replace(/Beden Eğitimi/gi, 'Bed.').replace(/Bilişim/gi, 'Biliş.');
            };

            const hdr = (title) => \`
                <div class="page-header">
                    <h2>\${title}</h2>
                    <div class="info">
                        <div>\${session.name}</div>
                        <div style="font-size: 9pt; color: #64748b; font-weight: 400;">
                            \${formatDate(session.date)} \${session.time || ''}
                        </div>
                    </div>
                </div>\`;

            let body = '';

            modes.forEach(mode => {
                if (mode === 'class') {
                    const flatList = [];
                    session.results.forEach(room => {
                        let ctr = 1; const seatToNum = {};
                        for (let g = 1; g <= room.groups; g++) {
                            const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                            for (let r = 1; r <= cf.rows; r++)
                                for (let c = 1; c <= cf.cols; c++) {
                                    const sid = \`G\${g}-S\${r}-C\${c}\`;
                                    if (!(room.disabledSeats || []).includes(sid)) seatToNum[sid] = ctr++;
                                }
                        }
                        Object.entries(room.seats).forEach(([sid, std]) =>
                            flatList.push({ ...std, room: room.name, seatNum: seatToNum[sid] || '-' }));
                    });
                    const byClass = {};
                    flatList.forEach(s => (byClass[s.class] = byClass[s.class] || []).push(s));
                    const sorted = Object.keys(byClass).sort(sortByNum);
                    const studentMsg = (session.studentMsg || '').trim();

                    sorted.forEach(cls => {
                        const students = byClass[cls].sort((a, b) => parseInt(a.no) - parseInt(b.no));
                        const PAGE_SIZE = 45;
                        for (let p = 0; p < students.length; p += PAGE_SIZE) {
                            const chunk = students.slice(p, p + PAGE_SIZE);
                            const rows = chunk.map(s => \`<tr><td style="width:10%;"><b>\${s.no}</b></td><td style="width:40%; text-transform:uppercase;">\${s.name}</td><td style="width:30%;">\${s._matchedSubject || '-'}</td><td style="width:12%;">\${s.room}</td><td style="width:8%; text-align:center;"><b>\${s.seatNum}</b></td></tr>\`).join('');
                            body += \`<div class="page portrait">\${hdr(\`\${cls} Sınıf Listesi\`)}<table><thead><tr><th style="width:10%;">No</th><th style="width:40%;">Ad Soyad</th><th style="width:30%;">Sınav Dersi</th><th style="width:12%;">Derslik</th><th style="width:8%;">Sıra</th></tr></thead><tbody>\${rows}</tbody></table>\${(studentMsg && (p + PAGE_SIZE >= students.length)) ? \`<div class="msg-box"><strong><span class="icon">!</span> Dikkat: </strong>\${studentMsg}</div>\` : ""}</div>\`;
                        }
                    });

                } else if (mode === 'room') {
                    const sortedRooms = [...session.results].sort((a, b) => sortByNum(a.name, b.name));
                    sortedRooms.forEach(room => {
                        let ctr = 1; const seatToNum = {}; const seatIds = [];
                        for (let g = 1; g <= room.groups; g++) {
                            const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                            for (let r = 1; r <= cf.rows; r++)
                                for (let c = 1; c <= cf.cols; c++) {
                                    const sid = \`G\${g}-S\${r}-C\${c}\`;
                                    if (!(room.disabledSeats || []).includes(sid)) { seatToNum[sid] = ctr++; seatIds.push(sid); }
                                }
                        }
                        const sortedSeatIds = seatIds.sort((a, b) => {
                            const pa = a.match(/\\d+/g).map(Number), pb = b.match(/\\d+/g).map(Number);
                            for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
                            return 0;
                        });
                        const PAGE_SIZE = 45;
                        for (let p = 0; p < sortedSeatIds.length; p += PAGE_SIZE) {
                            const chunk = sortedSeatIds.slice(p, p + PAGE_SIZE);
                            const rows = chunk.map(sid => {
                                const s = room.seats[sid];
                                if (s) return \`<tr><td style="text-align:center; width:6%;"><b>\${seatToNum[sid] || '-'}</b></td><td style="width:7%;">\${s.class}</td><td style="text-align:center; width:7%;"><b>\${s.no}</b></td><td style="width:45%; text-transform:uppercase;">\${s.name}</td><td style="width:20%;">\${abbr(s._matchedSubject || '-')}</td><td style="width:15%; border-bottom:1px solid #eee;"></td></tr>\`;
                                else return \`<tr style="color:#64748b; background:#fff5f5;"><td style="text-align:center;"><b>\${seatToNum[sid] || '-'}</b></td><td colspan="4" style="text-align:center; font-weight:bold; letter-spacing:2px;">BOŞ</td><td></td></tr>\`;
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
                                    summaryListHtml += \`<div style="padding: 2px 0; border-bottom: 1px dashed #e2e8f0; font-size: 8.5pt;"><b>\${cls}</b> \${abbr(ex)} => <b>\${count}</b></div>\`;
                                    roomTotal += count;
                                });
                            });
                            let examSummaryRows = [...new Set(studentsInRoom.map(s => s._matchedSubject || '-'))].sort().map(ex => {
                                const count = studentsInRoom.filter(s => (s._matchedSubject || '-') === ex).length;
                                return \`<tr><td style="padding:2px 4px;">\${ex}</td><td style="text-align:center; font-weight:bold;">\${count}</td></tr>\`;
                            }).join('');
                            const summaryContent = (p + PAGE_SIZE >= sortedSeatIds.length) ? \`
                                <div style="flex-shrink:0; width:45mm; margin-left:10px;">
                                    <div style="background:#f8fafc; padding:6px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:10px;">
                                        <div style="font-size:8.5pt; font-weight:900; color:#4f46e5; border-bottom:2px solid #6366f1; padding-bottom:3px; margin-bottom:6px;">DERSLİK ÖZETİ</div>
                                        <div style="line-height:1.2;">\${summaryListHtml}<div style="margin-top:5px; padding-top:3px; border-top:2px solid #6366f1; font-weight:900; color:#4f46e5; text-align:right; font-size:8.5pt;">TOPLAM: \${roomTotal}</div></div>
                                    </div>
                                    <div style="background:#fff7ed; padding:6px; border-radius:10px; border:1px solid #ffedd5;">
                                        <div style="font-size:8.5pt; font-weight:900; color:#c2410c; border-bottom:2px solid #f97316; padding-bottom:3px; margin-bottom:6px;">SINAV TOPLAMLARI</div>
                                        <table style="font-size:7.5pt;"><thead><tr><th style="padding:2px 4px; width:75%;">Sınav</th><th style="padding:2px 4px; width:25%;">Sayı</th></tr></thead><tbody>\${examSummaryRows}</tbody></table>
                                    </div>
                                </div>\` : '';
                            body += \`<div class="page portrait">\${hdr(\`\${room.name} Salonu - Oturma Listesi\`)}<div style="display:flex; flex:1;"><div style="flex:1;"><table><thead><tr><th>Sıra</th><th>Sınıf</th><th>No</th><th>Ad Soyad</th><th>Sınav</th><th>Açıklama</th></tr></thead><tbody>\${rows}</tbody></table></div>\${summaryContent}</div>\${(teacherMsg && (p + PAGE_SIZE >= sortedSeatIds.length)) ? \`<div class="msg-box" style="border-color:#ca8a04; background:#fffaf0;"><strong><span class="icon" style="background:#ea580c;">!</span> Dikkat: </strong>\${teacherMsg}</div>\` : ""}</div>\`;
                        }
                    });

                } else if (mode === 'seating') {
                    const sortedRooms = [...session.results].sort((a, b) => sortByNum(a.name, b.name));
                    sortedRooms.forEach(room => {
                        let ctr = 1; const seatToNum = {};
                        for (let g = 1; g <= room.groups; g++) {
                            const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                            for (let r = 1; r <= cf.rows; r++)
                                for (let c = 1; c <= cf.cols; c++) {
                                    const sid = \`G\${g}-S\${r}-C\${c}\`;
                                    if (!(room.disabledSeats || []).includes(sid)) seatToNum[sid] = ctr++;
                                }
                        }
                        let groupsHtml = '<div class="groups-row">';
                        for (let g = 1; g <= room.groups; g++) {
                            const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                            groupsHtml += \`<div class="desk-group" style="grid-template-columns:repeat(\${cf.cols},1fr)">\`;
                            for (let r = cf.rows; r >= 1; r--) {
                                for (let c = 1; c <= cf.cols; c++) {
                                    const sid = \`G\${g}-S\${r}-C\${c}\`;
                                    const isDisabled = (room.disabledSeats || []).includes(sid);
                                    const student = room.seats?.[sid];
                                    const num = seatToNum[sid] || '-';
                                    if (isDisabled) groupsHtml += \`<div class="desk" style="opacity:0.3; border-style:dotted;">KAPALI</div>\`;
                                    else if (student) groupsHtml += \`<div class="desk"><div style="font-size:7pt;color:#64748b;font-weight:700;margin-bottom:2px;">\${student.class} / \${student.no}</div><div style="font-weight:900;font-size:8.5pt;color:#1e293b; text-transform:uppercase;">\${student.name}</div><div style="font-size:6.5pt;color:#4f46e5;margin-top:3px;font-weight:600;">\${abbr(student._matchedSubject || '-')}</div><div class="desk-num">\${num}</div></div>\`;
                                    else groupsHtml += \`<div class="desk empty">BOŞ<div class="desk-num" style="background:#fee2e2; color:#ef4444;">\${num}</div></div>\`;
                                }
                            }
                            groupsHtml += '</div>';
                        }
                        groupsHtml += '</div>';
                        body += \`<div class="page landscape">\${hdr(\`\${room.name} Salonu - Oturma Şeması\`)}<div class="schema-container"><div class="classroom-walls">\${groupsHtml}<div class="front-side">\${room.teacherDeskPos === 'left' ? \`<div class="teacher-desk">ÖĞRETMEN MASASI</div><div class="board">YAZI TAHTASI</div><div style="width:130px;"></div>\` : \`<div style="width:130px;"></div><div class="board">YAZI TAHTASI</div><div class="teacher-desk">ÖĞRETMEN MASASI</div>\`}</div></div></div></div>\`;
                    });
                }
            });

            if (body !== '') {
                body += \`<script>window.addEventListener('load', () => { setTimeout(() => { document.querySelectorAll('.schema-container').forEach(wrap => { const wall = wrap.querySelector('.classroom-walls'); const wrapW = wrap.clientWidth - 60; const wrapH = wrap.clientHeight - 60; const scale = Math.min(wrapW / wall.offsetWidth, wrapH / wall.offsetHeight, 1.4); wall.style.transform = "scale(" + scale + ")"; }); }, 150); });<\\/script>\`;
            }
            const win = window.open('', '_blank');
            win.document.write(\`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>\${session.name}</title><style>\${pageCss}</style></head><body>\${body}</body></html>\`);
            win.document.close();
        }`;

const startIdx = content.indexOf('window.printSession = async function (id) {');
const endIdxStr = '        };';
const endIdx = content.indexOf(endIdxStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + endIdxStr.length);
    content = before + newCode + after;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced the block in ogretmen.html");
} else {
    console.error("Could not find start or end block in ogretmen.html");
}
