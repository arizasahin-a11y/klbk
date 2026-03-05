const fs = require('fs');
const path = require('path');

const filePath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'ogretmen.html');
let content = fs.readFileSync(filePath, 'utf8');

const missingLogic = `
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
                    const sorted = Object.keys(byClass).sort((a, b) => {
                        const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
                        const letterA = a.replace(/[0-9]/g, '').trim();
                        const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
                        const letterB = b.replace(/[0-9]/g, '').trim();
                        if (numA !== numB) return numA - numB;
                        return letterA.localeCompare(letterB);
                    });
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
                    const sortedRooms = [...session.results].sort((a, b) => {
                        const numA = parseInt(a.name.replace(/[^0-9]/g, '')) || 0;
                        const letterA = a.name.replace(/[0-9]/g, '').trim();
                        const numB = parseInt(b.name.replace(/[^0-9]/g, '')) || 0;
                        const letterB = b.name.replace(/[0-9]/g, '').trim();
                        if (numA !== numB) return numA - numB;
                        return letterA.localeCompare(letterB);
                    });
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
                            const roomClasses = [...new Set(studentsInRoom.map(s => s.class))].sort((a, b) => {
                                const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
                                const letterA = a.replace(/[0-9]/g, '').trim();
                                const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
                                const letterB = b.replace(/[0-9]/g, '').trim();
                                if (numA !== numB) return numA - numB;
                                return letterA.localeCompare(letterB);
                            });
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
                    const sortedRooms = [...session.results].sort((a, b) => {
                        const numA = parseInt(a.name.replace(/[^0-9]/g, '')) || 0;
                        const letterA = a.name.replace(/[0-9]/g, '').trim();
                        const numB = parseInt(b.name.replace(/[^0-9]/g, '')) || 0;
                        const letterB = b.name.replace(/[0-9]/g, '').trim();
                        if (numA !== numB) return numA - numB;
                        return letterA.localeCompare(letterB);
                    });
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
        }
    </script>
</body>
</html>`;

const targetAnchor = 'const formatDate = (d) => {';
const startIdx = content.indexOf(targetAnchor);

if (startIdx !== -1) {
    const nextBrace = content.indexOf('};', startIdx) + 2;
    const beforePart = content.substring(0, nextBrace);

    fs.writeFileSync(filePath, beforePart + missingLogic, 'utf8');
    console.log("Restoration successful");
} else {
    console.log("Anchor not found");
}
