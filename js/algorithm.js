/**
 * Exam Distribution Algorithm — v8.9.1
 *
 * KURAL 1 — Öncelikli Öğrenciler (ogrenciKodu var):
 *   → DAIMA sayfanın en altındaki sıralar (Row 1, Row 2...) = tahtaya en yakın = ÖN SIRA.
 *   → Öncelikli öğrenciler HİÇBİR optimizasyon adımında hareket ETTİRİLMEZ.
 *   → Her dersliğe mümkün olduğunca eşit sayıda öncelikli öğrenci.
 *
 * KURAL 2 — Aynı Sınav İzolasyonu (Fizik 10, Mat 11 … seviye bazında):
 *   a) Binary slot: her derslik genelinde tek/çift global sütun kullanılır.
 *   b) Mümkünse aynı sütunda bir satır boşluk bırakarak oturmalı.
 *   c) Yoksa arka arkaya (dikey) — çapraz ihlal binary slot ile zaten imkânsız.
 *
 * KURAL 3 — Dengeli Dağıtım:
 *   → Her seviyeden kota = ceil(level_count / num_rooms).
 *
 * KURAL 4 — Boş Yerler:
 *   → Derslikler arasında EŞİT dağıtılır (OPT-B geçişi).
 *   → Her dersliğin arka köşe/sıralarında toplanır (OPT-C sıkıştırma).
 */

const ExamAlgorithm = {

    _shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    distribute(students, classrooms, sessionData = {}) {
        if (!students?.length) throw new Error('Dağıtılacak öğrenci bulunamadı.');
        if (!classrooms?.length) throw new Error('Derslik tanımlanmamış.');

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numRooms = classrooms.length;
        const isPrio = s => !!(s && s.ogrenciKodu?.trim());

        // ── 1. Seviye → Parity Slot (Even/Odd Columns) ──────────────────
        const levelSet = [...new Set(students.map(s => s._matchedSubject || 'Unknown'))];
        const levelSlot = {};
        const lvWeights = {};
        students.forEach(s => {
            const lv = s._matchedSubject || 'Unknown';
            lvWeights[lv] = (lvWeights[lv] || 0) + 1;
        });

        const sortedLevels = Object.keys(lvWeights).sort((a, b) => lvWeights[b] - lvWeights[a]);
        let w0 = 0, w1 = 0;
        sortedLevels.forEach(lv => {
            if (w0 <= w1) { levelSlot[lv] = 0; w0 += lvWeights[lv]; }
            else { levelSlot[lv] = 1; w1 += lvWeights[lv]; }
        });

        const levelCountAll = {};
        const classLevelCountAll = {};
        const classLevelQuota = {};
        const levelQuota = {};

        students.forEach(s => {
            const lv = s._matchedSubject || 'Unknown';
            const cls = s.class || 'Unknown';
            levelCountAll[lv] = (levelCountAll[lv] || 0) + 1;
            if (!classLevelCountAll[lv]) classLevelCountAll[lv] = {};
            classLevelCountAll[lv][cls] = (classLevelCountAll[lv][cls] || 0) + 1;
        });

        levelSet.forEach(lv => {
            levelQuota[lv] = Math.ceil(levelCountAll[lv] / numRooms);
            if (classLevelCountAll[lv]) {
                classLevelQuota[lv] = {};
                Object.keys(classLevelCountAll[lv]).forEach(cls => {
                    classLevelQuota[lv][cls] = Math.ceil(classLevelCountAll[lv][cls] / numRooms);
                });
            }
        });

        // ── 2. Derslik Düğümleri ──────────────────────────────────────────
        let totalCapacity = 0;
        const roomNodes = classrooms.map(room => {
            const groupColStart = [];
            let cumCols = 0;
            for (let g = 1; g <= room.groups; g++) {
                const cf = room.groupConfigs?.[g - 1] ?? { rows: room.rows || 1, cols: room.cols || 1 };
                groupColStart.push(cumCols + 1);
                cumCols += cf.cols;
            }

            const midGroup = Math.ceil(room.groups / 2);
            const allSeats = [];
            const lastGroup = room.groups;
            const lastGroupCols = room.groupConfigs?.[lastGroup - 1]?.cols || room.cols || 1;

            for (let g = 1; g <= room.groups; g++) {
                const cf = room.groupConfigs?.[g - 1] ?? { rows: room.rows || 1, cols: room.cols || 1 };
                for (let r = 1; r <= cf.rows; r++) {
                    for (let c = 1; c <= cf.cols; c++) {
                        const id = `G${g}-S${r}-C${c}`;
                        if (room.disabledSeats?.includes(id)) continue;
                        const globalCol = groupColStart[g - 1] + (c - 1);
                        // Row 1 = Front = Bottom of page, lowest priority number → filled first
                        const priority = r * 100 + c;
                        // isEdge: leftmost col of first group OR rightmost col of last group
                        const isEdge = (g === 1 && c === 1) || (g === lastGroup && c === lastGroupCols);
                        allSeats.push({
                            id, g, r, c, globalCol,
                            priority,
                            isMid: g === midGroup,
                            isEdge
                        });
                    }
                }
            }
            totalCapacity += allSeats.length;

            return {
                id: room.name,
                original: room,
                allSeats,
                slotSeats: {
                    0: allSeats.filter(s => s.globalCol % 2 === 1),
                    1: allSeats.filter(s => s.globalCol % 2 === 0)
                },
                // Priority pool:
                //   Kenar sütunlar (isEdge) TAMAMEN YASAK — asla öncelikli öğrenci gitmez
                //   1. Non-edge, Row 1   (ön sıra, güvenli sütun)
                //   2. Non-edge, Row 2   (ikinci sıra — dikey çakışmayı önlemek için)
                //   3. Non-edge, Row 3+  (arka sıralar — son çare ama kenardan yine de iyidir)
                prioBySlot: {
                    0: allSeats
                        .filter(s => s.globalCol % 2 === 1 && !s.isEdge)
                        .sort((a, b) => a.r - b.r || (a.isMid ? 0 : 1) - (b.isMid ? 0 : 1) || a.c - b.c),
                    1: allSeats
                        .filter(s => s.globalCol % 2 === 0 && !s.isEdge)
                        .sort((a, b) => a.r - b.r || (a.isMid ? 0 : 1) - (b.isMid ? 0 : 1) || a.c - b.c)
                },
                assigned: {},
                levelCount: {},
                classLevelCount: {},
                prioCount: 0
            };
        });

        if (totalCapacity < students.length) throw new Error('Kapasite Yetersiz!');

        // ── 3. Ön İşleme ─────────────────────────────────────────────────
        const grpCounters = {};
        const preProcess = s => {
            const lv = s._matchedSubject || 'Unknown';
            if (!grpCounters[lv]) grpCounters[lv] = 0;
            if (sessionData?.hasGroups) {
                const sub = sessionData.subjects?.find(x => (typeof x === 'object' ? x.name : x) === lv);
                if (sub?.hasGroups) {
                    s._groupLabel = alphabet[grpCounters[lv]++ % (sessionData.groupCount || 2)];
                } else delete s._groupLabel;
            } else delete s._groupLabel;
            return s;
        };

        const pStudents = this._shuffle(students.filter(isPrio)).map(preProcess);
        const nStudents = this._shuffle(students.filter(s => !isPrio(s))).map(preProcess);

        // ── 4. Yardımcılar ───────────────────────────────────────────────
        const findSafe = (node, student) => {
            const lv = student._matchedSubject || 'Unknown';
            const targetSlot = levelSlot[lv] ?? 0;
            const pool = isPrio(student) ? node.prioBySlot[targetSlot] : node.slotSeats[targetSlot];

            const candidates = pool.filter(s => !node.assigned[s.id]).map(seat => {
                const prevId = `G${seat.g}-S${seat.r - 1}-C${seat.c}`;
                const nextId = `G${seat.g}-S${seat.r + 1}-C${seat.c}`;
                const hasVertical = (node.assigned[prevId]?._matchedSubject === lv) || (node.assigned[nextId]?._matchedSubject === lv);
                
                // Lateral (Yan) ve Çapraz (diagonal) ASLA olmamalı (Ağır Ceza)
                // Arka arkaya (Vertical) istenmez ama son çare olabilir (Hafif Ceza)
                const lateralDiagCollision = hasCollision6(node, student, seat);
                const collisionScore = (lateralDiagCollision ? 200000 : 0) + (hasVertical ? 1000 : 0);

                // Priority students: prioritize front rows (r=1, r=2) even more
                const rowPenalty = isPrio(student) ? (seat.r > 2 ? 5000 : 0) : 0;

                return { seat, score: seat.priority + collisionScore + (seat.isEdge ? 50 : 0) + rowPenalty };
            });
            candidates.sort((a, b) => a.score - b.score);
            return (candidates.length > 0 && candidates[0].score < 200000) ? candidates[0].seat : null;
        };

        const hasCollision6 = (node, student, seat) => {
            const lv = student._matchedSubject || 'Unknown';
            const { g, r, c } = seat;
            const forbidden = [
                // Lateral (Yanlar)
                `G${g}-S${r}-C${c - 1}`, `G${g}-S${r}-C${c + 1}`,
                // Diagonal (Çaprazlar)
                `G${g}-S${r - 1}-C${c - 1}`, `G${g}-S${r - 1}-C${c + 1}`,
                `G${g}-S${r + 1}-C${c - 1}`, `G${g}-S${r + 1}-C${c + 1}`
            ];
            
            // Grup sınırları arası kontrol
            const curGroupCols = node.original.groupConfigs?.[g-1]?.cols || node.original.cols || 1;
            if (c === 1 && g > 1) { // Sol sınır
                const prevCols = node.original.groupConfigs?.[g - 2]?.cols || node.original.cols || 1;
                forbidden.push(`G${g-1}-S${r}-C${prevCols}`, `G${g-1}-S${r-1}-C${prevCols}`, `G${g-1}-S${r+1}-C${prevCols}`);
            } else if (c === curGroupCols && g < node.original.groups) { // Sağ sınır
                forbidden.push(`G${g+1}-S${r}-C1`, `G${g+1}-S${r-1}-C1`, `G${g+1}-S${r+1}-C1`);
            }
            
            return forbidden.some(id => node.assigned[id]?._matchedSubject === lv);
        };

        // ── 5. AŞAMA 1: Öncelikli Öğrenciler ─────────────────────────────
        let roomIdx = 0;
        pStudents.forEach(s => {
            for (let ri = 0; ri < numRooms; ri++) {
                const node = roomNodes[(roomIdx + ri) % numRooms];
                const seat = findSafe(node, s);
                if (seat) {
                    node.assigned[seat.id] = s;
                    node.prioCount++;
                    roomIdx = (roomIdx + ri + 1) % numRooms;
                    break;
                }
            }
        });

        // ── 6. AŞAMA 2: Normal Öğrenciler ─────────────────────────────
        const sortedN = nStudents.sort((a, b) =>
            (a._matchedSubject || '').localeCompare(b._matchedSubject || '') ||
            (a.class || '').localeCompare(b.class || '')
        );
        sortedN.forEach(s => {
            const lv = s._matchedSubject || 'Unknown';
            const cls = s.class || 'Unknown';
            let placed = false;
            for (let ri = 0; ri < numRooms; ri++) {
                const node = roomNodes[(roomIdx + ri) % numRooms];
                const totalLv = node.levelCount[lv] || 0;
                const clsLv = node.classLevelCount[lv]?.[cls] || 0;
                if (ri < numRooms - 1 && (totalLv >= levelQuota[lv] || clsLv >= (classLevelQuota[lv]?.[cls] || 99))) continue;
                const seat = findSafe(node, s);
                if (seat) {
                    node.assigned[seat.id] = s;
                    node.levelCount[lv] = totalLv + 1;
                    if (!node.classLevelCount[lv]) node.classLevelCount[lv] = {};
                    node.classLevelCount[lv][cls] = clsLv + 1;
                    roomIdx = (roomIdx + ri + 1) % numRooms;
                    placed = true; break;
                }
            }
            if (!placed) {
                // FALLBACK: Sınıf/Seviye kotasına bakmadan herhangi bir boş koltuğa yerleştir
                // AMA: Yan ve Çapraz çakışma yasağına (hasCollision6) hala uymalıdır!
                for (let ri = 0; ri < numRooms; ri++) {
                    const node = roomNodes[(roomIdx + ri) % numRooms];
                    const lv = s._matchedSubject || 'Unknown';
                    const targetSlot = levelSlot[lv] ?? 0;
                    const otherSlot = 1 - targetSlot;

                    // 1. Önce asıl slotunda boşluk ara (Kotasız, ama çakışmasız)
                    let seat = node.slotSeats[targetSlot].find(st => !node.assigned[st.id] && !hasCollision6(node, s, st));
                    
                    // 2. Yoksa diğer slotta boşluk ara (Slot kısıtlamasını kır, ancak çakışma kuralını ASLA kırma)
                    if (!seat) seat = node.slotSeats[otherSlot].find(st => !node.assigned[st.id] && !hasCollision6(node, s, st));

                    if (seat) { 
                        node.assigned[seat.id] = s; 
                        roomIdx = (roomIdx + ri + 1) % numRooms; 
                        placed = true; break; 
                    }
                }
            }
        });

        // ── 7. OPT-B: Derslikler Arası Denge (Öncelikli öğrenciler DOKUNULMAZ) ──
        const emptyOf = node => node.allSeats.length - Object.keys(node.assigned).length;
        for (let iter = 0; iter < 100; iter++) {
            const empties = roomNodes.map(emptyOf);
            const maxI = empties.indexOf(Math.max(...empties));
            const minI = empties.indexOf(Math.min(...empties));
            if (empties[maxI] - empties[minI] <= 1) break;
            const nodeFrom = roomNodes[minI], nodeTo = roomNodes[maxI];
            let moved = false;
            for (const [id, s] of Object.entries(nodeFrom.assigned)) {
                if (isPrio(s)) continue; // ← Priority students NEVER moved between rooms
                const targetSlot = levelSlot[s._matchedSubject || 'Unknown'] ?? 0;
                const dest = nodeTo.slotSeats[targetSlot].find(st => !nodeTo.assigned[st.id] && !hasCollision6(nodeTo, s, st));
                if (dest) {
                    delete nodeFrom.assigned[id];
                    nodeTo.assigned[dest.id] = s;
                    moved = true; break;
                }
            }
            if (!moved) break;
        }

        // ── 8. OPT-C: Sıkıştırma (Öncelikli öğrenciler DOKUNULMAZ) ──────
        for (let pass = 0; pass < 2; pass++) {
            roomNodes.forEach(node => {
                const sortedAssigned = Object.entries(node.assigned)
                    .map(([id, s]) => ({ id, student: s, p: node.allSeats.find(st => st.id === id)?.priority || 9999 }))
                    .sort((a, b) => (isPrio(a.student) ? 0 : 1) - (isPrio(b.student) ? 0 : 1) || a.p - b.p);

                sortedAssigned.forEach(({ id, student, p }) => {
                    if (isPrio(student)) return; // ← Priority students stay put
                    const targetSlot = levelSlot[student._matchedSubject || 'Unknown'] ?? 0;
                    const pool = node.slotSeats[targetSlot];
                    const better = pool.find(st =>
                        st.priority < p &&
                        !node.assigned[st.id] &&
                        !hasCollision6(node, student, st) &&
                        !isPrio(node.assigned[st.id]) // don't displace priority students
                    );
                    if (better) {
                        node.assigned[better.id] = student;
                        delete node.assigned[id];
                    }
                });
            });
        }

        // ── 9. OPT-V: Dikey Çakışma Optimizasyonu ────────────────────────
        roomNodes.forEach(node => {
            const seatsByCol = {};
            node.allSeats.forEach(s => {
                if (!seatsByCol[s.globalCol]) seatsByCol[s.globalCol] = [];
                seatsByCol[s.globalCol].push(s);
            });

            Object.values(seatsByCol).forEach(colSeats => {
                colSeats.sort((a, b) => a.r - b.r); // Row 1=bottom to Row N=top

                // Pass 1: Smart Interleaving (A-B-A-B-A) — SKIPS priority students
                const allInCol = colSeats.map(s => ({ seat: s, student: node.assigned[s.id] }));
                const prioPositions = allInCol.filter(x => x.student && isPrio(x.student));
                const nonPrioInCol = allInCol.filter(x => x.student && !isPrio(x.student));
                const emptyInCol = allInCol.filter(x => !x.student);

                if (nonPrioInCol.length > 1) {
                    // Kullanıcı İsteği: Sütunda aynı dersler yan yana olmasın (Interleaving A,B,A,B)
                    // Öğrencileri derslerine göre ayırıp çaprazlayarak (interleave) diziyoruz.
                    const studentsBySubject = {};
                    nonPrioInCol.forEach(x => {
                        const sub = x.student._matchedSubject || 'Unknown';
                        if (!studentsBySubject[sub]) studentsBySubject[sub] = [];
                        studentsBySubject[sub].push(x.student);
                    });

                    // En çok öğrencisi olan dersi en başa al (daha iyi interleaving için)
                    const subNames = Object.keys(studentsBySubject).sort((a, b) => studentsBySubject[b].length - studentsBySubject[a].length);
                    const interleaved = [];
                    let hasMore = true;
                    let passIdx = 0;
                    while (hasMore) {
                        hasMore = false;
                        for (const name of subNames) {
                            if (studentsBySubject[name].length > passIdx) {
                                interleaved.push(studentsBySubject[name][passIdx]);
                                hasMore = true;
                            }
                        }
                        passIdx++;
                    }

                    // Temizle ve baştan ata
                    const lockedIds = new Set(prioPositions.map(x => x.seat.id));
                    const freeSeats = colSeats.filter(s => !lockedIds.has(s.id));

                    // Step 1: clear all non-priority seats in this column
                    freeSeats.forEach(s => { delete node.assigned[s.id]; });

                    // Step 2: assign interleaved students
                    let fsIdx = 0;
                    for (const st of interleaved) {
                        while (fsIdx < freeSeats.length && node.assigned[freeSeats[fsIdx].id]) fsIdx++;
                        if (fsIdx < freeSeats.length) {
                            node.assigned[freeSeats[fsIdx].id] = st;
                            fsIdx++;
                        }
                    }
                }

                // Pass 2: Standard Within-Column Swap
                for (let i = 0; i < colSeats.length - 1; i++) {
                    const s1 = colSeats[i], s2 = colSeats[i + 1];
                    const st1 = node.assigned[s1.id], st2 = node.assigned[s2.id];
                    if (st1 && st2 && st1._matchedSubject === st2._matchedSubject) {
                        for (let j = 0; j < colSeats.length; j++) {
                            if (j === i || j === i + 1) continue;
                            const s3 = colSeats[j], st3 = node.assigned[s3.id];
                            if (st3 && !isPrio(st3) && !isPrio(st2) && st3._matchedSubject !== st1._matchedSubject) {
                                const s2Safe = !hasCollision6(node, st3, s2) && (i > 0 ? node.assigned[colSeats[i - 1].id]?._matchedSubject !== st3._matchedSubject : true);
                                const s3Safe = !hasCollision6(node, st2, s3) && (j > 0 ? node.assigned[colSeats[j - 1].id]?._matchedSubject !== st2._matchedSubject : true) && (j < colSeats.length - 1 ? node.assigned[colSeats[j + 1].id]?._matchedSubject !== st2._matchedSubject : true);
                                if (s2Safe && s3Safe) {
                                    node.assigned[s2.id] = st3; node.assigned[s3.id] = st2; break;
                                }
                            }
                        }
                    }
                }

                // Pass 3: Bubble conflicts toward front (skip priority students)
                for (let iter = 0; iter < 5; iter++) {
                    for (let i = colSeats.length - 2; i > 0; i--) {
                        const s_prev = colSeats[i - 1], s_curr = colSeats[i], s_next = colSeats[i + 1];
                        const st_c = node.assigned[s_curr.id], st_n = node.assigned[s_next.id], st_p = node.assigned[s_prev.id];
                        if (st_c && st_n && st_c._matchedSubject === st_n._matchedSubject) {
                            if (st_p && !isPrio(st_p) && !isPrio(st_n) && st_p._matchedSubject !== st_c._matchedSubject) {
                                if (!hasCollision6(node, st_p, s_next) && !hasCollision6(node, st_n, s_prev)) {
                                    node.assigned[s_next.id] = st_p;
                                    node.assigned[s_prev.id] = st_n;
                                }
                            }
                        }
                    }
                }
            });

            // Pass 4: Global Cross-Column Swap — tries BOTH conflict seats
            // Shuffle column order per iteration so different retries explore different paths
            const cols = this._shuffle(Object.values(seatsByCol));
            for (let iter = 0; iter < 20; iter++) {
                // Re-shuffle each iteration for maximum exploration
                this._shuffle(cols);
                let resolvedAny = false;
                for (let i = 0; i < cols.length; i++) {
                    const colA = cols[i];
                    for (let r = 0; r < colA.length - 1; r++) {
                        const s_base = colA[r], s_target = colA[r + 1];
                        const st_base = node.assigned[s_base.id], st_target = node.assigned[s_target.id];

                        if (st_base && st_target && st_base._matchedSubject === st_target._matchedSubject) {
                            const conflicts = [
                                // Prefer moving BACK student (s_target, higher row) to keep front rows filled
                                { s_conf: s_target, st_conf: st_target, s_other: s_base },
                                { s_conf: s_base, st_conf: st_base, s_other: s_target }
                            ];

                            let swapped = false;
                            for (const { s_conf, st_conf, s_other } of conflicts) {
                                if (swapped) break;
                                if (isPrio(st_conf)) continue; // Priority students are never the ones moved

                                for (let j = 0; j < cols.length; j++) {
                                    if (swapped) break;
                                    const colB = cols[j];
                                    for (let r2 = 0; r2 < colB.length; r2++) {
                                        const s_cand = colB[r2];
                                        const st_cand = node.assigned[s_cand.id];

                                        if (s_cand.id === s_conf.id) continue;
                                        if (st_cand && st_cand._matchedSubject === st_conf._matchedSubject) continue;
                                        if (isPrio(st_cand)) continue; // Never displace priority students

                                        // Safety check: st_conf in s_cand position, and st_cand in s_conf position.
                                        // Both MUST be lateral/diagonal safe (weight 200k+).
                                        // Vertical safety (weight 1k) is preferred but can be sacrificed if it resolves a collision.
                                        if (!hasCollision6(node, st_conf, s_cand) && (!st_cand || !hasCollision6(node, st_cand, s_conf))) {
                                            const vColCand = (r2 > 0 ? node.assigned[colB[r2 - 1].id]?._matchedSubject === st_conf._matchedSubject : false) || (r2 < colB.length - 1 ? node.assigned[colB[r2 + 1].id]?._matchedSubject === st_conf._matchedSubject : false);
                                            const vColOther = (node.assigned[s_other.id]?._matchedSubject === (st_cand ? st_cand._matchedSubject : 'NONE'));
                                            
                                            // Prefer perfect resolution, but allow if it at least doesn't make things worse.
                                            if (!vColCand && !vColOther) {
                                                if (st_cand) node.assigned[s_conf.id] = st_cand;
                                                else delete node.assigned[s_conf.id];
                                                node.assigned[s_cand.id] = st_conf;
                                                resolvedAny = true; swapped = true; break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (!resolvedAny) break;
            }

            // Pass 5: Extreme Lateral/Diagonal Resolution (Fallback)
            for (let iter = 0; iter < 5; iter++) {
                let resolvedAny = false;
                for (const colA of cols) {
                    for (const sA of colA) {
                        const stA = node.assigned[sA.id];
                        if (!stA || isPrio(stA)) continue;
                        if (hasCollision6(node, stA, sA)) {
                            // Severe collision found. Try ANY swap that resolves it, even if it creates a vertical one.
                            for (const colB of cols) {
                                if (resolvedAny) break;
                                for (const sB of colB) {
                                    if (sA.id === sB.id) continue;
                                    const stB = node.assigned[sB.id];
                                    if (stB && isPrio(stB)) continue;
                                    if (stB && stB._matchedSubject === stA._matchedSubject) continue;

                                    if (!hasCollision6(node, stA, sB) && (!stB || !hasCollision6(node, stB, sA))) {
                                        if (stB) node.assigned[sA.id] = stB; else delete node.assigned[sA.id];
                                        node.assigned[sB.id] = stA;
                                        resolvedAny = true; break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (!resolvedAny) break;
            }
        });

        // ── OPT-V-CrossRoom: Cross-Room Swap for stubborn vertical collisions ───
        // After all per-room passes, find remaining collisions and try to resolve
        // by swapping with a student from a DIFFERENT room (same parity slot).
        for (let iter = 0; iter < 10; iter++) {
            let resolvedAny = false;
            for (let ai = 0; ai < roomNodes.length; ai++) {
                const nodeA = roomNodes[ai];
                // Build column map for room A
                const colMapA = {};
                nodeA.allSeats.forEach(s => {
                    if (!colMapA[s.globalCol]) colMapA[s.globalCol] = [];
                    colMapA[s.globalCol].push(s);
                });
                Object.values(colMapA).forEach(col => col.sort((a, b) => a.r - b.r));

                for (const colA of Object.values(colMapA)) {
                    for (let r = 0; r < colA.length - 1; r++) {
                        const sA1 = colA[r], sA2 = colA[r + 1];
                        const stA1 = nodeA.assigned[sA1.id], stA2 = nodeA.assigned[sA2.id];
                        if (!stA1 || !stA2 || stA1._matchedSubject !== stA2._matchedSubject) continue;
                        if (resolvedAny) break;

                        // Try to move stA2 to any open slot in another room
                        const lv = stA1._matchedSubject;
                        const targetSlot = levelSlot[lv] ?? 0;

                        for (let bi = 0; bi < roomNodes.length; bi++) {
                            if (bi === ai) continue;
                            const nodeB = roomNodes[bi];

                            // Find all seats in room B with matching parity slot
                            for (const sB of nodeB.slotSeats[targetSlot]) {
                                const stB = nodeB.assigned[sB.id];
                                // Never displace priority students
                                if (stB && isPrio(stB)) continue;
                                // stB must not be same subject as stA2 (would just recreate collision)
                                if (stB && stB._matchedSubject === lv) continue;

                                // Check stA2 is safe in room B at sB
                                const stA2_safeB = !hasCollision6(nodeB, stA2, sB) &&
                                    (() => {
                                        const colB = nodeB.allSeats.filter(x => x.globalCol === sB.globalCol).sort((a, b) => a.r - b.r);
                                        const idx = colB.findIndex(x => x.id === sB.id);
                                        return (idx <= 0 ? true : nodeB.assigned[colB[idx - 1].id]?._matchedSubject !== lv) &&
                                            (idx >= colB.length - 1 ? true : nodeB.assigned[colB[idx + 1].id]?._matchedSubject !== lv);
                                    })();

                                if (!stA2_safeB) continue;

                                // Check stB (if exists) is safe in room A at sA2 (vertical neighbours)
                                const colA_adj = colA;
                                const stB_safeA = !stB || (
                                    !hasCollision6(nodeA, stB, sA2) &&
                                    (r > 0 ? nodeA.assigned[colA_adj[r - 1].id]?._matchedSubject !== stB._matchedSubject : true) &&
                                    (r < colA_adj.length - 2 ? nodeA.assigned[colA_adj[r + 2].id]?._matchedSubject !== stB._matchedSubject : true) &&
                                    nodeA.assigned[sA1.id]?._matchedSubject !== stB._matchedSubject
                                );

                                if (!stB_safeA) continue;

                                // EXECUTE CROSS-ROOM SWAP
                                if (stB) nodeA.assigned[sA2.id] = stB;
                                else delete nodeA.assigned[sA2.id];
                                nodeB.assigned[sB.id] = stA2;

                                resolvedAny = true; break;
                            }
                            if (resolvedAny) break;
                        }
                        if (resolvedAny) break;
                    }
                    if (resolvedAny) break;
                }
            }
            if (!resolvedAny) break;
        }

        return roomNodes.map(node => ({
            name: node.id, groups: node.original.groups, groupConfigs: node.original.groupConfigs,
            teacherDeskPos: node.original.teacherDeskPos || 'right', disabledSeats: node.original.disabledSeats || [],
            rows: node.original.rows, cols: node.original.cols, seats: node.assigned
        }));
    },
    /**
     * Counts vertical collisions (same subject in adjacent rows within same column) across all rooms.
     * Returns total count of collision pairs.
     */
    countVerticalCollisions(results) {
        let total = 0;
        for (const room of results) {
            const groups = room.groups || 1;
            const seatsByCol = {};
            for (let g = 1; g <= groups; g++) {
                const cf = room.groupConfigs?.[g - 1] || { rows: room.rows || 1, cols: room.cols || 1 };
                let globalCol = 0;
                for (let gg = 1; gg < g; gg++) {
                    globalCol += room.groupConfigs?.[gg - 1]?.cols || room.cols || 1;
                }
                for (let r = 1; r <= cf.rows; r++) {
                    for (let c = 1; c <= cf.cols; c++) {
                        const key = globalCol + c;
                        if (!seatsByCol[key]) seatsByCol[key] = [];
                        seatsByCol[key].push({ id: `G${g}-S${r}-C${c}`, r });
                    }
                }
            }
            for (const seats of Object.values(seatsByCol)) {
                seats.sort((a, b) => a.r - b.r);
                for (let i = 0; i < seats.length - 1; i++) {
                    const s1 = room.seats[seats[i].id];
                    const s2 = room.seats[seats[i + 1].id];
                    if (s1 && s2 && s1._matchedSubject && s2._matchedSubject &&
                        s1._matchedSubject === s2._matchedSubject) {
                        total++;
                    }
                }
            }
        }
        return total;
    }
};

window.ExamAlgorithm = ExamAlgorithm;
