/**
 * KLBK Oturum ve Ders Yoklama / Katılım Raporu Modülü
 * Hem dashboard.html hem de ogretmen.html tarafından ortak kullanılır.
 * Sınıf, salon, durum ve arama filtreleri desteklenir.
 */

window.openSessionAttendanceReport = async function (sesId, encodedSub = null, defaultClass = null) {
    if (window.DataManager && typeof window.DataManager.initCloud === 'function') {
        try {
            await window.DataManager.initCloud();
        } catch (e) {
            console.warn('Attendance report sync warning:', e);
        }
    }

    let sessions = [];
    if (window.DataManager && typeof window.DataManager.getExamSessions === 'function') {
        sessions = window.DataManager.getExamSessions() || [];
    } else if (Array.isArray(window.exams)) {
        sessions = window.exams;
    } else if (Array.isArray(window.allExams)) {
        sessions = window.allExams;
    }
    const ses = sessions.find(s => String(s.id) === String(sesId));
    if (!ses) {
        Swal.fire('Hata', 'Sınav oturumu bulunamadı.', 'error');
        return;
    }

    if (!ses.results || !Array.isArray(ses.results) || ses.results.length === 0) {
        Swal.fire('Bilgi', 'Bu sınav oturumu için henüz öğrenci salon dağıtımı yapılmamış.', 'info');
        return;
    }

    const filterSubject = encodedSub ? decodeURIComponent(encodedSub).trim() : null;

    const schoolSettings = (window.DataManager && window.DataManager.getSchoolSettings) ? window.DataManager.getSchoolSettings() : {};
    const schoolName = (schoolSettings && schoolSettings.name) ? schoolSettings.name : (sessionStorage.getItem('klbk_schoolName') || 'T.C. MİLLÎ EĞİTİM BAKANLIĞI');

    const statuses = ses.studentStatuses || {};

    // Extract all students from results
    const allStudents = [];
    const seenMap = new Map();

    ses.results.forEach(room => {
        const roomName = room.name || 'Belirtilmemiş';
        if (room.seats) {
            Object.entries(room.seats).forEach(([seatId, seat]) => {
                const std = seat.student || seat;
                if (std && std.no) {
                    const noKey = String(std.no).trim();
                    const rawStatus = statuses[noKey] || statuses[std.no];
                    const status = rawStatus || 'GELDİ';

                    const sClass = (std.class || '-').trim();
                    const sName = (std.name || '').trim();
                    const sSurname = (std.surname || '').trim();
                    const fullName = (sName + ' ' + sSurname).trim() || `Öğrenci #${noKey}`;
                    const subject = std._matchedSubject || std.subject || '-';

                    const uniqueKey = `${roomName}_${noKey}_${seatId}`;
                    if (!seenMap.has(uniqueKey)) {
                        seenMap.set(uniqueKey, true);
                        const isSubjectMatch = (!filterSubject) || (subject === filterSubject);
                        allStudents.push({
                            no: noKey,
                            name: fullName,
                            class: sClass,
                            room: roomName,
                            subject: subject,
                            status: status,
                            seatId: seatId,
                            isSubjectMatch: isSubjectMatch
                        });
                    }
                }
            });
        }
    });

    if (allStudents.length === 0) {
        Swal.fire('Bilgi', 'Bu oturumda yerleştirilmiş öğrenci verisi bulunamadı.', 'info');
        return;
    }

    // Default active list: if opened for a subject, filter to subject, else all
    let targetStudents = filterSubject ? allStudents.filter(s => s.isSubjectMatch) : allStudents;
    if (targetStudents.length === 0 && filterSubject) {
        targetStudents = allStudents; // Fallback to all if matching subject has no explicit students
    }

    // Sort students by class, then by student no
    targetStudents.sort((a, b) => {
        const cComp = a.class.localeCompare(b.class, 'tr', { numeric: true });
        if (cComp !== 0) return cComp;
        return (parseInt(a.no, 10) || 0) - (parseInt(b.no, 10) || 0);
    });

    const totalCount = targetStudents.length;
    const geldiCount = targetStudents.filter(s => s.status === 'GELDİ').length;
    const gelmediCount = targetStudents.filter(s => s.status === 'GELMEDİ').length;
    const kopyaCount = targetStudents.filter(s => s.status === 'KOPYA').length;
    const digerCount = targetStudents.filter(s => s.status === 'DİĞER').length;
    const flaggedCount = gelmediCount + kopyaCount + digerCount;
    const attendancePct = totalCount > 0 ? ((geldiCount / totalCount) * 100).toFixed(1) : '0';

    // 1. Sınıf Özeti ve Haritası (Class Summary)
    const classMap = {};
    targetStudents.forEach(s => {
        const c = s.class || 'Belirtilmemiş';
        if (!classMap[c]) {
            classMap[c] = { total: 0, geldi: 0, gelmedi: 0, kopya: 0, diger: 0 };
        }
        classMap[c].total++;
        if (s.status === 'GELDİ') classMap[c].geldi++;
        else if (s.status === 'GELMEDİ') classMap[c].gelmedi++;
        else if (s.status === 'KOPYA') classMap[c].kopya++;
        else if (s.status === 'DİĞER') classMap[c].diger++;
    });

    const classNamesSorted = Object.keys(classMap).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

    const classOptionsHtml = classNamesSorted.map(cName => {
        const c = classMap[cName];
        const cFlagged = c.gelmedi + c.kopya + c.diger;
        const note = cFlagged > 0 ? ` (${cFlagged} devamsız)` : '';
        return `<option value="${cName}">${cName} (${c.total} Öğrenci${note})</option>`;
    }).join('');

    const classPillsHtml = classNamesSorted.map(cName => {
        const c = classMap[cName];
        const cFlagged = c.gelmedi + c.kopya + c.diger;
        const badge = cFlagged > 0 ? `<span class="class-pill-badge">${cFlagged}</span>` : '';
        return `<button class="class-pill-btn" data-class="${cName}" onclick="applyClassFilter('${cName}', this)">${cName} ${badge}</button>`;
    }).join('');

    const classSummaryHtml = classNamesSorted.map(cName => {
        const c = classMap[cName];
        const cFlagged = c.gelmedi + c.kopya + c.diger;
        return `
            <tr class="summary-click-row" onclick="selectClassFromSummary('${cName}')" title="${cName} sınıfını filtrelemek için tıklayın">
                <td style="font-weight:700; padding:8px 12px; border:1px solid #e2e8f0; color:var(--primary);">
                    <i class="fa-solid fa-graduation-cap" style="margin-right:6px;"></i>${cName}
                </td>
                <td style="text-align:center; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${c.total}</td>
                <td style="text-align:center; color:#059669; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${c.geldi}</td>
                <td style="text-align:center; color:#dc2626; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${c.gelmedi}</td>
                <td style="text-align:center; color:#7f1d1d; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${c.kopya}</td>
                <td style="text-align:center; color:#0284c7; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${c.diger}</td>
                <td style="text-align:center; font-weight:800; color:${cFlagged > 0 ? '#dc2626' : '#64748b'}; padding:8px 12px; border:1px solid #e2e8f0;">${cFlagged}</td>
                <td style="text-align:center; padding:8px 12px; border:1px solid #e2e8f0;">
                    <span class="btn-mini-filter"><i class="fa-solid fa-arrow-down"></i> Listele</span>
                </td>
            </tr>
        `;
    }).join('');

    // 2. Salon Özeti ve Haritası (Room Summary)
    const roomsMap = {};
    targetStudents.forEach(s => {
        if (!roomsMap[s.room]) {
            roomsMap[s.room] = { total: 0, geldi: 0, gelmedi: 0, kopya: 0, diger: 0 };
        }
        roomsMap[s.room].total++;
        if (s.status === 'GELDİ') roomsMap[s.room].geldi++;
        else if (s.status === 'GELMEDİ') roomsMap[s.room].gelmedi++;
        else if (s.status === 'KOPYA') roomsMap[s.room].kopya++;
        else if (s.status === 'DİĞER') roomsMap[s.room].diger++;
    });

    const roomNamesSorted = Object.keys(roomsMap).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

    const roomOptionsHtml = roomNamesSorted.map(rName => {
        const r = roomsMap[rName];
        const rFlagged = r.gelmedi + r.kopya + r.diger;
        const note = rFlagged > 0 ? ` (${rFlagged} devamsız)` : '';
        return `<option value="${rName}">${rName} (${r.total} Öğrenci${note})</option>`;
    }).join('');

    const roomSummaryHtml = roomNamesSorted.map(rName => {
        const r = roomsMap[rName];
        const rFlagged = r.gelmedi + r.kopya + r.diger;
        return `
            <tr class="summary-click-row" onclick="selectRoomFromSummary('${rName}')" title="${rName} salonunu filtrelemek için tıklayın">
                <td style="font-weight:700; padding:8px 12px; border:1px solid #e2e8f0; color:#0284c7;">
                    <i class="fa-solid fa-door-open" style="margin-right:6px;"></i>${rName}
                </td>
                <td style="text-align:center; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${r.total}</td>
                <td style="text-align:center; color:#059669; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${r.geldi}</td>
                <td style="text-align:center; color:#dc2626; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${r.gelmedi}</td>
                <td style="text-align:center; color:#7f1d1d; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${r.kopya}</td>
                <td style="text-align:center; color:#0284c7; font-weight:700; padding:8px 12px; border:1px solid #e2e8f0;">${r.diger}</td>
                <td style="text-align:center; font-weight:800; color:${rFlagged > 0 ? '#dc2626' : '#64748b'}; padding:8px 12px; border:1px solid #e2e8f0;">${rFlagged}</td>
                <td style="text-align:center; padding:8px 12px; border:1px solid #e2e8f0;">
                    <span class="btn-mini-filter"><i class="fa-solid fa-arrow-down"></i> Listele</span>
                </td>
            </tr>
        `;
    }).join('');

    // Student rows
    const studentRowsHtml = targetStudents.map((s, idx) => {
        let badgeClass = 'badge-geldi';
        if (s.status === 'GELMEDİ') badgeClass = 'badge-gelmedi';
        else if (s.status === 'KOPYA') badgeClass = 'badge-kopya';
        else if (s.status === 'DİĞER') badgeClass = 'badge-diger';

        const isFlagged = s.status !== 'GELDİ';
        const searchStr = `${s.class} ${s.no} ${s.name} ${s.room} ${s.subject} ${s.status}`.toLocaleLowerCase('tr');

        return `
            <tr class="student-row ${isFlagged ? 'row-flagged' : ''}" 
                data-status="${s.status}" 
                data-class="${s.class}"
                data-room="${s.room}"
                data-flagged="${isFlagged ? '1' : '0'}"
                data-search="${searchStr}">
                <td class="row-idx" style="text-align:center; color:#64748b; font-size:0.85rem; padding:8px 10px; border:1px solid #e2e8f0;">${idx + 1}</td>
                <td style="font-weight:700; padding:8px 10px; border:1px solid #e2e8f0;">
                    <span class="class-pill">${s.class}</span>
                </td>
                <td style="font-weight:800; color:#4f46e5; padding:8px 10px; border:1px solid #e2e8f0;">${s.no}</td>
                <td style="font-weight:600; padding:8px 10px; border:1px solid #e2e8f0;">${s.name}</td>
                <td style="padding:8px 10px; border:1px solid #e2e8f0;"><span class="room-pill">${s.room}</span></td>
                <td style="font-size:0.9rem; padding:8px 10px; border:1px solid #e2e8f0;">${s.subject}</td>
                <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center;"><span class="status-badge ${badgeClass}">${s.status}</span></td>
            </tr>
        `;
    }).join('');

    const nowStr = new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const win = window.open('', '_blank', 'width=1150,height=900,scrollbars=yes,resizable=yes');
    if (!win) {
        Swal.fire('Hata', 'Yazdırma penceresi tarayıcı tarafından engellendi. Lütfen pop-up engelleyicisini kapatıp tekrar deneyin.', 'error');
        return;
    }

    const headerScopeTitle = filterSubject ? `${filterSubject} Dersi Yoklama ve Katılım Raporu` : 'Sınav Oturumu Yoklama ve Durum Raporu';
    const sanitizedFileName = (ses.name + (filterSubject ? '_' + filterSubject : '')).replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]/g, '_');

    const safeScopeTitle = JSON.stringify(headerScopeTitle);
    const safeFilterSubjectSub = JSON.stringify(filterSubject ? `${filterSubject} Dersi Alanlar` : 'Sınava Kayıtlı');
    const safeDefaultTeacher = JSON.stringify(filterSubject || 'Ders Sorumlusu');
    const safeSesId = JSON.stringify(String(ses.id));
    const safeEncodedSub = JSON.stringify(String(encodedSub || ''));
    const safeFileName = JSON.stringify(sanitizedFileName);
    const safeDefaultClass = JSON.stringify(defaultClass || 'ALL');

    const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${ses.name}${filterSubject ? ' - ' + filterSubject : ''} - Yoklama ve Katılım Raporu</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-dark: #4338ca;
            --success: #059669;
            --danger: #dc2626;
            --warning: #d97706;
            --maroon: #7f1d1d;
            --info: #0284c7;
            --dark: #0f172a;
            --gray-50: #f8fafc;
            --gray-100: #f1f5f9;
            --gray-200: #e2e8f0;
            --gray-300: #cbd5e1;
            --gray-500: #64748b;
            --gray-700: #334155;
        }

        * { box-sizing: border-box; }

        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f1f5f9;
            color: var(--dark);
            margin: 0;
            padding: 24px 16px;
            -webkit-font-smoothing: antialiased;
        }

        .report-wrapper {
            max-width: 1150px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
            padding: 32px 36px;
            border: 1px solid var(--gray-200);
        }

        /* Top Bar */
        .top-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding-bottom: 20px;
            margin-bottom: 24px;
            border-bottom: 2px solid var(--gray-100);
            flex-wrap: wrap;
        }

        .toolbar-left { display: flex; align-items: center; gap: 10px; }
        .toolbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 16px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 0.88rem;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            outline: none;
            font-family: inherit;
        }

        .btn:hover { transform: translateY(-1px); }

        .btn-primary {
            background: var(--primary);
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
        }
        .btn-primary:hover { background: var(--primary-dark); }

        .btn-success {
            background: var(--success);
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(5, 150, 105, 0.3);
        }
        .btn-success:hover { background: #047857; }

        .btn-light {
            background: var(--gray-100);
            color: var(--gray-700);
            border: 1px solid var(--gray-300);
        }
        .btn-light:hover { background: var(--gray-200); color: var(--dark); }

        /* Header Info */
        .report-header {
            text-align: center;
            margin-bottom: 28px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--gray-200);
        }

        .school-title {
            font-size: 1.05rem;
            font-weight: 800;
            color: var(--gray-500);
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .report-title {
            font-size: 1.6rem;
            font-weight: 900;
            color: var(--dark);
            margin: 4px 0 12px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .meta-chips-row {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            font-size: 0.92rem;
            color: var(--gray-700);
            margin-top: 8px;
        }

        .meta-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--gray-50);
            padding: 5px 12px;
            border-radius: 8px;
            border: 1px solid var(--gray-200);
            font-weight: 600;
        }

        .meta-chip i { color: var(--primary); }

        .meta-chip-highlight {
            background: #eef2ff;
            border-color: #c7d2fe;
            color: #3730a3;
            font-weight: 800;
        }

        /* KPI Cards */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 14px;
            margin-bottom: 28px;
        }

        .kpi-card {
            border-radius: 12px;
            padding: 16px 18px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            border: 1px solid var(--gray-200);
            background: #ffffff;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .kpi-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0,0,0,0.05);
        }

        .kpi-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.82rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .kpi-val { font-size: 2rem; font-weight: 900; line-height: 1.1; }

        .kpi-sub {
            font-size: 0.78rem;
            font-weight: 600;
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .kpi-card.kpi-total {
            background: linear-gradient(135deg, #eef2ff, #ffffff);
            border-color: #c7d2fe;
            color: #3730a3;
        }
        .kpi-card.kpi-total .kpi-val { color: #4338ca; }

        .kpi-card.kpi-geldi {
            background: linear-gradient(135deg, #f0fdf4, #ffffff);
            border-color: #bbf7d0;
            color: #166534;
        }
        .kpi-card.kpi-geldi .kpi-val { color: #15803d; }

        .kpi-card.kpi-gelmedi {
            background: linear-gradient(135deg, #fef2f2, #ffffff);
            border-color: #fecaca;
            color: #991b1b;
        }
        .kpi-card.kpi-gelmedi .kpi-val { color: #dc2626; }

        .kpi-card.kpi-kopya {
            background: linear-gradient(135deg, #fff1f2, #ffffff);
            border-color: #fecdd3;
            color: #881337;
        }
        .kpi-card.kpi-kopya .kpi-val { color: #7f1d1d; }

        .kpi-card.kpi-diger {
            background: linear-gradient(135deg, #f0f9ff, #ffffff);
            border-color: #bae6fd;
            color: #075985;
        }
        .kpi-card.kpi-diger .kpi-val { color: #0284c7; }

        /* Summary Boxes (Class & Room Summaries) */
        .summary-panels-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
        }

        @media (max-width: 850px) {
            .summary-panels-grid { grid-template-columns: 1fr; }
        }

        .summary-box {
            background: #ffffff;
            border: 1px solid var(--gray-200);
            border-radius: 12px;
            overflow: hidden;
        }

        .summary-header {
            padding: 12px 18px;
            background: var(--gray-50);
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 800;
            font-size: 0.95rem;
            color: var(--dark);
            border-bottom: 1px solid var(--gray-200);
            user-select: none;
            transition: background-color 0.2s ease;
        }
        .summary-header:hover { background: #f1f5f9; }

        .summary-click-row {
            transition: background-color 0.15s ease;
            cursor: pointer;
        }
        .summary-click-row:hover {
            background-color: #f0fdf4 !important;
        }

        .btn-mini-filter {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #eef2ff;
            color: var(--primary);
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            border: 1px solid #c7d2fe;
        }

        /* Filter Controls */
        .filter-section {
            background: var(--gray-50);
            border-radius: 12px;
            padding: 16px 18px;
            border: 1px solid var(--gray-200);
            margin-bottom: 22px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .filter-row-primary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .filter-row-secondary {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            padding-top: 12px;
            border-top: 1px dashed var(--gray-300);
        }

        .filter-select-group {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #ffffff;
            padding: 5px 12px;
            border-radius: 8px;
            border: 1px solid var(--gray-300);
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        .filter-select {
            border: none;
            outline: none;
            background: transparent;
            font-family: inherit;
            font-size: 0.86rem;
            font-weight: 700;
            color: var(--dark);
            cursor: pointer;
            padding: 3px 6px;
        }

        .filter-select:focus {
            outline: 2px solid var(--primary);
            border-radius: 4px;
        }

        .filter-tabs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

        .tab-btn {
            padding: 6px 12px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 0.82rem;
            border: 1px solid var(--gray-300);
            background: #ffffff;
            color: var(--gray-700);
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
        }

        .tab-btn:hover { border-color: var(--primary); color: var(--primary); }

        .tab-btn.active {
            background: var(--primary);
            color: #ffffff;
            border-color: var(--primary);
            box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
        }

        .quick-pills-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            padding-top: 4px;
        }

        .class-pill-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.78rem;
            border: 1px solid var(--gray-300);
            background: #ffffff;
            color: var(--gray-700);
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
        }

        .class-pill-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
            background: #eef2ff;
        }

        .class-pill-btn.active {
            background: #3730a3;
            color: #ffffff;
            border-color: #3730a3;
            box-shadow: 0 1px 4px rgba(55, 48, 163, 0.3);
        }

        .class-pill-badge {
            background: #dc2626;
            color: #ffffff;
            border-radius: 10px;
            padding: 1px 5px;
            font-size: 0.7rem;
            font-weight: 800;
            line-height: 1;
        }

        .search-box { position: relative; min-width: 240px; }
        .search-box i {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--gray-500);
            font-size: 0.85rem;
        }

        .search-input {
            width: 100%;
            padding: 8px 12px 8px 34px;
            border-radius: 8px;
            border: 1px solid var(--gray-300);
            font-size: 0.85rem;
            outline: none;
            font-family: inherit;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .search-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        /* Table */
        .table-responsive {
            overflow-x: auto;
            border-radius: 12px;
            border: 1px solid var(--gray-200);
            background: #ffffff;
        }

        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.88rem;
            text-align: left;
        }

        .report-table thead tr {
            background: var(--gray-50);
            color: var(--gray-700);
            font-weight: 800;
        }

        .report-table th {
            padding: 12px 14px;
            border-bottom: 2px solid var(--gray-200);
            white-space: nowrap;
        }

        .report-table td {
            padding: 10px 14px;
            border-bottom: 1px solid var(--gray-200);
            vertical-align: middle;
        }

        .report-table tbody tr:nth-child(even) { background-color: #fafbfc; }
        .report-table tbody tr:hover { background-color: #f1f5f9; }

        .report-table tbody tr.row-flagged { background-color: #fff7ed !important; }
        .report-table tbody tr.row-flagged:hover { background-color: #ffedd5 !important; }

        /* Badges */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 0.76rem;
            letter-spacing: 0.3px;
            white-space: nowrap;
        }

        .badge-geldi { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
        .badge-gelmedi { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
        .badge-kopya { background: #7f1d1d; color: #ffffff; border: 1px solid #7f1d1d; }
        .badge-diger { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }

        .room-pill {
            background: var(--gray-100);
            color: var(--dark);
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.8rem;
            border: 1px solid var(--gray-200);
        }

        .class-pill {
            background: #eef2ff;
            color: #3730a3;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.82rem;
            border: 1px solid #c7d2fe;
        }

        /* Print Signatures */
        .print-signatures {
            display: none;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px dashed var(--gray-300);
        }

        .signature-col { text-align: center; width: 30%; }
        .signature-title { font-weight: 800; font-size: 0.95rem; color: var(--dark); margin-bottom: 4px; }
        .signature-role { font-size: 0.82rem; color: var(--gray-500); margin-bottom: 40px; }
        .signature-line { border-top: 1px dotted var(--gray-400); width: 80%; margin: 0 auto; }

        /* Print Media */
        @media print {
            .no-print { display: none !important; }
            body { background: #ffffff !important; padding: 0 !important; color: #000000 !important; }
            .report-wrapper { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
            .kpi-grid { grid-template-columns: repeat(5, 1fr) !important; gap: 8px !important; margin-bottom: 16px !important; }
            .kpi-card { padding: 8px 10px !important; border: 1px solid #94a3b8 !important; box-shadow: none !important; }
            .kpi-card .kpi-val { font-size: 1.4rem !important; }
            .report-table th, .report-table td { padding: 6px 8px !important; font-size: 8.5pt !important; border: 1px solid #cbd5e1 !important; }
            .report-table tbody tr.row-flagged { background-color: #fef2f2 !important; }
            tr { page-break-inside: avoid !important; }
            .print-signatures { display: flex !important; justify-content: space-around !important; page-break-inside: avoid !important; }
            @page { size: A4 portrait; margin: 12mm 10mm; }
        }
    </style>
</head>
<body>

    <div class="report-wrapper">

        <!-- Top Actions Bar -->
        <div class="top-toolbar no-print">
            <div class="toolbar-left">
                <span style="font-weight: 800; font-size: 1rem; color: var(--primary);">
                    <i class="fa-solid fa-circle-info"></i> <span id="topScopeTitle">${headerScopeTitle}</span>
                </span>
            </div>
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="window.print()" title="Raporu Yazdır">
                    <i class="fa-solid fa-print"></i> Yazdır
                </button>
                <button class="btn btn-success" onclick="exportToCSV()" title="Excel / CSV Olarak İndir">
                    <i class="fa-solid fa-file-excel"></i> Excel / CSV
                </button>
                <button class="btn btn-light" onclick="refreshReport()" title="Canlı Verileri Yenile">
                    <i class="fa-solid fa-rotate"></i> Yenile
                </button>
                <button class="btn btn-light" onclick="window.close()" title="Pencereyi Kapat">
                    <i class="fa-solid fa-xmark"></i> Kapat
                </button>
            </div>
        </div>

        <!-- Official Header -->
        <div class="report-header">
            <div class="school-title">${schoolName}</div>
            <h1 class="report-title">
                <i class="fa-solid fa-clipboard-check" style="color: var(--primary);"></i>
                <span id="mainReportHeading">${headerScopeTitle}</span>
            </h1>
            <div class="meta-chips-row">
                <div class="meta-chip"><i class="fa-solid fa-calendar-check"></i> <b>Sınav:</b> ${ses.name}</div>
                ${filterSubject ? `<div class="meta-chip"><i class="fa-solid fa-book"></i> <b>Ders:</b> ${filterSubject}</div>` : ''}
                <div class="meta-chip" id="printClassChip" style="display:none;"><i class="fa-solid fa-graduation-cap"></i> <b>Sınıf:</b> <span id="printClassVal"></span></div>
                <div class="meta-chip" id="printRoomChip" style="display:none;"><i class="fa-solid fa-door-open"></i> <b>Salon:</b> <span id="printRoomVal"></span></div>
                <div class="meta-chip" id="printStatusChip" style="display:none;"><i class="fa-solid fa-filter"></i> <b>Durum:</b> <span id="printStatusVal"></span></div>
                <div class="meta-chip"><i class="fa-solid fa-calendar-day"></i> <b>Tarih:</b> ${ses.date || '-'}</div>
                <div class="meta-chip"><i class="fa-solid fa-clock"></i> <b>Saat:</b> ${ses.time || '-'}</div>
                <div class="meta-chip"><i class="fa-solid fa-shapes"></i> <b>Tür:</b> ${ses.type === 'uygulama' ? 'Uygulama Sınavı' : 'Yazılı Sınav'}</div>
                <div class="meta-chip"><i class="fa-solid fa-print"></i> <b>Rapor Zamanı:</b> ${nowStr}</div>
            </div>
        </div>

        <!-- KPI Stat Cards -->
        <div class="kpi-grid">
            <div class="kpi-card kpi-total">
                <div class="kpi-header">
                    <span>Toplam Öğrenci</span>
                    <i class="fa-solid fa-users" style="font-size:1.1rem;"></i>
                </div>
                <div class="kpi-val" id="kpiTotalVal">${totalCount}</div>
                <div class="kpi-sub" id="kpiTotalSub"><i class="fa-solid fa-chart-pie"></i> ${filterSubject ? 'Dersi Alanlar' : 'Sınava Kayıtlı'}</div>
            </div>

            <div class="kpi-card kpi-geldi">
                <div class="kpi-header">
                    <span>Gelen Öğrenci (Geldiler)</span>
                    <i class="fa-solid fa-circle-check" style="font-size:1.1rem;"></i>
                </div>
                <div class="kpi-val" id="kpiGeldiVal">${geldiCount}</div>
                <div class="kpi-sub" id="kpiPctVal"><i class="fa-solid fa-percent"></i> %${attendancePct} Katılım Oranı</div>
            </div>

            <div class="kpi-card kpi-gelmedi">
                <div class="kpi-header">
                    <span>Gelmeyen Öğrenci</span>
                    <i class="fa-solid fa-circle-xmark" style="font-size:1.1rem;"></i>
                </div>
                <div class="kpi-val" id="kpiGelmediVal">${gelmediCount}</div>
                <div class="kpi-sub"><i class="fa-solid fa-user-slash"></i> Sınava Girmedi</div>
            </div>

            <div class="kpi-card kpi-kopya">
                <div class="kpi-header">
                    <span>Kopya Çeken</span>
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:1.1rem;"></i>
                </div>
                <div class="kpi-val" id="kpiKopyaVal">${kopyaCount}</div>
                <div class="kpi-sub"><i class="fa-solid fa-file-circle-xmark"></i> Kopya İşlemi</div>
            </div>

            <div class="kpi-card kpi-diger">
                <div class="kpi-header">
                    <span>Diğer Durum</span>
                    <i class="fa-solid fa-circle-question" style="font-size:1.1rem;"></i>
                </div>
                <div class="kpi-val" id="kpiDigerVal">${digerCount}</div>
                <div class="kpi-sub"><i class="fa-solid fa-asterisk"></i> Özel / Muaf / Diğer</div>
            </div>
        </div>

        <!-- Summary Panels: Class Summary & Room Summary -->
        <div class="summary-panels-grid no-print">
            <!-- 1. Sınıf Bazında Özet Panel -->
            <div class="summary-box">
                <div class="summary-header" onclick="toggleSummary('classSummaryContent', 'classSummaryChevron')">
                    <span>
                        <i class="fa-solid fa-graduation-cap" style="color:var(--primary); margin-right:8px;"></i>
                        Sınıf Bazında Katılım Dağılımı (${classNamesSorted.length} Sınıf)
                    </span>
                    <i class="fa-solid fa-chevron-down" id="classSummaryChevron"></i>
                </div>
                <div id="classSummaryContent" style="display:none; padding:10px 14px;">
                    <div class="table-responsive">
                        <table class="report-table" style="font-size:0.83rem;">
                            <thead>
                                <tr>
                                    <th>Sınıf / Şube</th>
                                    <th style="text-align:center;">Toplam</th>
                                    <th style="text-align:center; color:#059669;">Geldi</th>
                                    <th style="text-align:center; color:#dc2626;">Gelmedi</th>
                                    <th style="text-align:center; color:#7f1d1d;">Kopya</th>
                                    <th style="text-align:center; color:#0284c7;">Diğer</th>
                                    <th style="text-align:center;">Özel Durum</th>
                                    <th style="text-align:center;">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${classSummaryHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 2. Salon Bazında Özet Panel -->
            <div class="summary-box">
                <div class="summary-header" onclick="toggleSummary('roomSummaryContent', 'roomSummaryChevron')">
                    <span>
                        <i class="fa-solid fa-door-open" style="color:#0284c7; margin-right:8px;"></i>
                        Salon Bazında Katılım Dağılımı (${roomNamesSorted.length} Salon)
                    </span>
                    <i class="fa-solid fa-chevron-down" id="roomSummaryChevron"></i>
                </div>
                <div id="roomSummaryContent" style="display:none; padding:10px 14px;">
                    <div class="table-responsive">
                        <table class="report-table" style="font-size:0.83rem;">
                            <thead>
                                <tr>
                                    <th>Salon (Derslik)</th>
                                    <th style="text-align:center;">Toplam</th>
                                    <th style="text-align:center; color:#059669;">Geldi</th>
                                    <th style="text-align:center; color:#dc2626;">Gelmedi</th>
                                    <th style="text-align:center; color:#7f1d1d;">Kopya</th>
                                    <th style="text-align:center; color:#0284c7;">Diğer</th>
                                    <th style="text-align:center;">Özel Durum</th>
                                    <th style="text-align:center;">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roomSummaryHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-section no-print" id="filterBarSection">
            <!-- Row 1: Status Filter Tabs & Search -->
            <div class="filter-row-primary">
                <div class="filter-tabs">
                    <span style="font-weight:800; font-size:0.82rem; color:var(--gray-500); margin-right:4px;">Durum:</span>
                    <button class="tab-btn active" data-status="ALL" onclick="applyStatusFilter('ALL', this)">Tümü (${totalCount})</button>
                    <button class="tab-btn" data-status="FLAGGED" onclick="applyStatusFilter('FLAGGED', this)" style="${flaggedCount > 0 ? 'border-color:#f87171; color:#dc2626;' : ''}">
                        Özel Durumlar (${flaggedCount})
                    </button>
                    <button class="tab-btn" data-status="GELMEDİ" onclick="applyStatusFilter('GELMEDİ', this)">Gelmeyenler (${gelmediCount})</button>
                    <button class="tab-btn" data-status="KOPYA" onclick="applyStatusFilter('KOPYA', this)">Kopya (${kopyaCount})</button>
                    <button class="tab-btn" data-status="DİĞER" onclick="applyStatusFilter('DİĞER', this)">Diğer (${digerCount})</button>
                    <button class="tab-btn" data-status="GELDİ" onclick="applyStatusFilter('GELDİ', this)">Gelenler (${geldiCount})</button>
                </div>

                <div class="search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="searchInput" class="search-input" placeholder="Öğrenci ara (ad, no, sınıf, salon)..." oninput="filterTable()">
                </div>
            </div>

            <!-- Row 2: Class Filter & Room Filter Selects -->
            <div class="filter-row-secondary">
                <div class="filter-select-group">
                    <i class="fa-solid fa-graduation-cap" style="color:var(--primary);"></i>
                    <label for="classFilter" style="font-weight:700; font-size:0.82rem; color:var(--gray-700);">Sınıf Filtresi:</label>
                    <select id="classFilter" class="filter-select" onchange="onClassSelectChange(this.value)">
                        <option value="ALL">Tüm Sınıflar (${classNamesSorted.length} Sınıf)</option>
                        ${classOptionsHtml}
                    </select>
                </div>

                <div class="filter-select-group">
                    <i class="fa-solid fa-door-open" style="color:#0284c7;"></i>
                    <label for="roomFilter" style="font-weight:700; font-size:0.82rem; color:var(--gray-700);">Salon Filtresi:</label>
                    <select id="roomFilter" class="filter-select" onchange="onRoomSelectChange(this.value)">
                        <option value="ALL">Tüm Salonlar (${roomNamesSorted.length} Salon)</option>
                        ${roomOptionsHtml}
                    </select>
                </div>

                <button class="btn btn-light" id="resetFiltersBtn" onclick="resetAllFilters()" style="padding:6px 14px; font-size:0.82rem; display:none;">
                    <i class="fa-solid fa-filter-circle-xmark" style="color:#dc2626;"></i> Filtreleri Temizle
                </button>
            </div>

            <!-- Row 3: Quick Class Pills -->
            ${classNamesSorted.length > 0 ? `
            <div class="quick-pills-row">
                <span style="font-weight:700; font-size:0.78rem; color:var(--gray-500); margin-right:4px;">
                    <i class="fa-solid fa-bolt" style="color:#f59e0b;"></i> Hızlı Sınıf:
                </span>
                <button class="class-pill-btn active" data-class="ALL" onclick="applyClassFilter('ALL', this)">Tüm Sınıflar</button>
                ${classPillsHtml}
            </div>
            ` : ''}
        </div>

        <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:0.84rem; color:var(--gray-500); flex-wrap:wrap; gap:8px;">
            <div id="filterStatusText">Gösterilen Öğrenci: <b>${totalCount}</b> / ${totalCount}</div>
            <div style="color:var(--gray-500); font-style:italic;">
                <i class="fa-regular fa-lightbulb" style="color:#f59e0b;"></i> İpucu: Seçtiğiniz sınıfa veya duruma göre yazdırma butonuna basarsanız doğrudan filtrelenmiş liste yazdırılır.
            </div>
        </div>

        <!-- Student List Table -->
        <div class="table-responsive" id="studentTableWrapper">
            <table class="report-table" id="studentTable">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align:center;">#</th>
                        <th style="width: 80px;">Sınıf</th>
                        <th style="width: 90px;">Okul No</th>
                        <th>Ad Soyad</th>
                        <th style="width: 140px;">Sınav Salonu</th>
                        <th>Sınav Dersi</th>
                        <th style="width: 120px; text-align:center;">Durum</th>
                    </tr>
                </thead>
                <tbody id="studentTableBody">
                    ${studentRowsHtml}
                </tbody>
            </table>
        </div>

        <!-- Official Signatures (Shown on Print) -->
        <div class="print-signatures">
            <div class="signature-col">
                <div class="signature-title">Ders / Şube Rehber Öğretmeni</div>
                <div class="signature-role" id="sigTeacherRole">${filterSubject || 'Ders Sorumlusu'}</div>
                <div class="signature-line"></div>
            </div>
            <div class="signature-col">
                <div class="signature-title">Sınav Komisyonu</div>
                <div class="signature-role">Komisyon Üyesi</div>
                <div class="signature-line"></div>
            </div>
            <div class="signature-col">
                <div class="signature-title">Okul Müdürü</div>
                <div class="signature-role">Onay / Mühür</div>
                <div class="signature-line"></div>
            </div>
        </div>

    </div>

    <script>
        let currentStatusFilter = 'ALL';
        let currentClassFilter = ${safeDefaultClass};
        let currentRoomFilter = 'ALL';
        const baseScopeTitle = ${safeScopeTitle};
        const totalSessionStudents = ${totalCount};

        function toggleSummary(contentId, chevronId) {
            const content = document.getElementById(contentId);
            const chevron = document.getElementById(chevronId);
            if (!content || !chevron) return;
            if (content.style.display === 'none') {
                content.style.display = 'block';
                chevron.classList.remove('fa-chevron-down');
                chevron.classList.add('fa-chevron-up');
            } else {
                content.style.display = 'none';
                chevron.classList.remove('fa-chevron-up');
                chevron.classList.add('fa-chevron-down');
            }
        }

        function applyStatusFilter(status, btn) {
            currentStatusFilter = status;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
            filterTable();
        }

        function applyClassFilter(cls, btn) {
            currentClassFilter = cls;
            const selectEl = document.getElementById('classFilter');
            if (selectEl) selectEl.value = cls;

            document.querySelectorAll('.class-pill-btn').forEach(b => {
                if (b.getAttribute('data-class') === cls) b.classList.add('active');
                else b.classList.remove('active');
            });

            filterTable();
        }

        function onClassSelectChange(val) {
            currentClassFilter = val;
            document.querySelectorAll('.class-pill-btn').forEach(b => {
                if (b.getAttribute('data-class') === val) b.classList.add('active');
                else b.classList.remove('active');
            });
            filterTable();
        }

        function onRoomSelectChange(val) {
            currentRoomFilter = val;
            filterTable();
        }

        function selectClassFromSummary(cls) {
            applyClassFilter(cls);
            // Scroll smoothly to filter section
            const filterSec = document.getElementById('filterBarSection');
            if (filterSec) filterSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function selectRoomFromSummary(room) {
            currentRoomFilter = room;
            const selectEl = document.getElementById('roomFilter');
            if (selectEl) selectEl.value = room;
            filterTable();
            const filterSec = document.getElementById('filterBarSection');
            if (filterSec) filterSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function resetAllFilters() {
            currentStatusFilter = 'ALL';
            currentClassFilter = 'ALL';
            currentRoomFilter = 'ALL';

            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';

            const classSelect = document.getElementById('classFilter');
            if (classSelect) classSelect.value = 'ALL';

            const roomSelect = document.getElementById('roomFilter');
            if (roomSelect) roomSelect.value = 'ALL';

            document.querySelectorAll('.tab-btn').forEach(b => {
                if (b.getAttribute('data-status') === 'ALL') b.classList.add('active');
                else b.classList.remove('active');
            });

            document.querySelectorAll('.class-pill-btn').forEach(b => {
                if (b.getAttribute('data-class') === 'ALL') b.classList.add('active');
                else b.classList.remove('active');
            });

            filterTable();
        }

        function filterTable() {
            const searchVal = (document.getElementById('searchInput').value || '').toLocaleLowerCase('tr').trim();
            const rows = document.querySelectorAll('#studentTableBody .student-row');
            
            let visibleCount = 0;
            let visibleGeldi = 0;
            let visibleGelmedi = 0;
            let visibleKopya = 0;
            let visibleDiger = 0;

            rows.forEach(row => {
                const status = row.getAttribute('data-status');
                const sClass = row.getAttribute('data-class');
                const sRoom = row.getAttribute('data-room');
                const isFlagged = row.getAttribute('data-flagged') === '1';
                const searchStr = row.getAttribute('data-search') || '';

                // Status match
                let statusMatches = false;
                if (currentStatusFilter === 'ALL') {
                    statusMatches = true;
                } else if (currentStatusFilter === 'FLAGGED') {
                    statusMatches = isFlagged;
                } else {
                    statusMatches = (status === currentStatusFilter);
                }

                // Class match
                const classMatches = (currentClassFilter === 'ALL' || sClass === currentClassFilter);

                // Room match
                const roomMatches = (currentRoomFilter === 'ALL' || sRoom === currentRoomFilter);

                // Search match
                let searchMatches = true;
                if (searchVal.length > 0) {
                    searchMatches = searchStr.includes(searchVal);
                }

                if (statusMatches && classMatches && roomMatches && searchMatches) {
                    row.style.display = '';
                    visibleCount++;
                    if (status === 'GELDİ') visibleGeldi++;
                    else if (status === 'GELMEDİ') visibleGelmedi++;
                    else if (status === 'KOPYA') visibleKopya++;
                    else if (status === 'DİĞER') visibleDiger++;

                    // Re-number visible row for clean sequential print
                    const idxEl = row.querySelector('.row-idx');
                    if (idxEl) idxEl.textContent = visibleCount;
                } else {
                    row.style.display = 'none';
                }
            });

            // Update Dynamic KPI Cards
            const kpiTotalEl = document.getElementById('kpiTotalVal');
            const kpiGeldiEl = document.getElementById('kpiGeldiVal');
            const kpiGelmediEl = document.getElementById('kpiGelmediVal');
            const kpiKopyaEl = document.getElementById('kpiKopyaVal');
            const kpiDigerEl = document.getElementById('kpiDigerVal');
            const kpiPctEl = document.getElementById('kpiPctVal');
            const kpiTotalSub = document.getElementById('kpiTotalSub');

            if (kpiTotalEl) kpiTotalEl.textContent = visibleCount;
            if (kpiGeldiEl) kpiGeldiEl.textContent = visibleGeldi;
            if (kpiGelmediEl) kpiGelmediEl.textContent = visibleGelmedi;
            if (kpiKopyaEl) kpiKopyaEl.textContent = visibleKopya;
            if (kpiDigerEl) kpiDigerEl.textContent = visibleDiger;

            if (kpiPctEl) {
                const pct = visibleCount > 0 ? ((visibleGeldi / visibleCount) * 100).toFixed(1) : '0';
                kpiPctEl.innerHTML = '<i class="fa-solid fa-percent"></i> %' + pct + ' Katılım Oranı';
            }

            if (kpiTotalSub) {
                if (currentClassFilter !== 'ALL') {
                    kpiTotalSub.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> ' + currentClassFilter + ' Sınıfı';
                } else if (currentRoomFilter !== 'ALL') {
                    kpiTotalSub.innerHTML = '<i class="fa-solid fa-door-open"></i> ' + currentRoomFilter + ' Salonu';
                } else {
                    kpiTotalSub.innerHTML = '<i class="fa-solid fa-chart-pie"></i> ' + ${safeFilterSubjectSub};
                }
            }

            // Update Status summary text
            const statEl = document.getElementById('filterStatusText');
            if (statEl) {
                let filterNotes = [];
                if (currentClassFilter !== 'ALL') filterNotes.push('Sınıf: <b>' + currentClassFilter + '</b>');
                if (currentRoomFilter !== 'ALL') filterNotes.push('Salon: <b>' + currentRoomFilter + '</b>');
                if (currentStatusFilter !== 'ALL') filterNotes.push('Durum: <b>' + currentStatusFilter + '</b>');
                if (searchVal.length > 0) filterNotes.push('Arama: "<b>' + searchVal + '</b>"');

                const filterSuffix = filterNotes.length > 0 ? ' (' + filterNotes.join(' | ') + ')' : '';
                statEl.innerHTML = 'Gösterilen Öğrenci: <b>' + visibleCount + '</b> / ' + totalSessionStudents + filterSuffix;
            }

            // Reset filters button visibility
            const isAnyFilterActive = (currentStatusFilter !== 'ALL' || currentClassFilter !== 'ALL' || currentRoomFilter !== 'ALL' || searchVal.length > 0);
            const resetBtn = document.getElementById('resetFiltersBtn');
            if (resetBtn) {
                resetBtn.style.display = isAnyFilterActive ? 'inline-flex' : 'none';
            }

            // Update Print Header Chips
            const printClassChip = document.getElementById('printClassChip');
            const printClassVal = document.getElementById('printClassVal');
            if (printClassChip && printClassVal) {
                if (currentClassFilter !== 'ALL') {
                    printClassVal.textContent = currentClassFilter;
                    printClassChip.style.display = 'inline-flex';
                    printClassChip.classList.add('meta-chip-highlight');
                } else {
                    printClassChip.style.display = 'none';
                    printClassChip.classList.remove('meta-chip-highlight');
                }
            }

            const printRoomChip = document.getElementById('printRoomChip');
            const printRoomVal = document.getElementById('printRoomVal');
            if (printRoomChip && printRoomVal) {
                if (currentRoomFilter !== 'ALL') {
                    printRoomVal.textContent = currentRoomFilter;
                    printRoomChip.style.display = 'inline-flex';
                } else {
                    printRoomChip.style.display = 'none';
                }
            }

            const printStatusChip = document.getElementById('printStatusChip');
            const printStatusVal = document.getElementById('printStatusVal');
            if (printStatusChip && printStatusVal) {
                if (currentStatusFilter !== 'ALL') {
                    printStatusVal.textContent = currentStatusFilter;
                    printStatusChip.style.display = 'inline-flex';
                } else {
                    printStatusChip.style.display = 'none';
                }
            }

            // Update main headings for print
            const mainHeading = document.getElementById('mainReportHeading');
            if (mainHeading) {
                if (currentClassFilter !== 'ALL') {
                    mainHeading.textContent = baseScopeTitle + ' (' + currentClassFilter + ' Sınıfı)';
                } else if (currentRoomFilter !== 'ALL') {
                    mainHeading.textContent = baseScopeTitle + ' (' + currentRoomFilter + ' Salonu)';
                } else {
                    mainHeading.textContent = baseScopeTitle;
                }
            }

            // Update signature role if class filtered
            const sigTeacherRole = document.getElementById('sigTeacherRole');
            if (sigTeacherRole) {
                if (currentClassFilter !== 'ALL') {
                    sigTeacherRole.textContent = currentClassFilter + ' Şube Rehber Öğretmeni';
                } else {
                    sigTeacherRole.textContent = ${safeDefaultTeacher};
                }
            }
        }

        function refreshReport() {
            if (window.opener && typeof window.opener.openSessionAttendanceReport === 'function') {
                window.opener.openSessionAttendanceReport(${safeSesId}, ${safeEncodedSub}, currentClassFilter !== 'ALL' ? currentClassFilter : null);
                window.close();
            } else {
                window.location.reload();
            }
        }

        function exportToCSV() {
            const rows = Array.from(document.querySelectorAll('#studentTable tbody tr')).filter(r => r.style.display !== 'none');
            if (rows.length === 0) {
                alert('Dışa aktarılacak öğrenci bulunamadı.');
                return;
            }

            const CRLF = String.fromCharCode(13, 10);
            let csv = String.fromCharCode(0xFEFF);
            csv += 'Sira,Sinif,OkulNo,AdSoyad,Salon,SinavDersi,Durum' + CRLF;

            rows.forEach((r, i) => {
                const cols = r.querySelectorAll('td');
                const sNo = i + 1;
                const sClass = cols[1] ? cols[1].innerText.trim() : '';
                const sNum = cols[2] ? cols[2].innerText.trim() : '';
                const sName = '"' + ((cols[3] ? cols[3].innerText.trim() : '')).replace(/"/g, '""') + '"';
                const sRoom = cols[4] ? cols[4].innerText.trim() : '';
                const sSub = '"' + ((cols[5] ? cols[5].innerText.trim() : '')).replace(/"/g, '""') + '"';
                const sStat = cols[6] ? cols[6].innerText.trim() : '';

                csv += [sNo, sClass, sNum, sName, sRoom, sSub, sStat].join(',') + CRLF;
            });

            let fileSuffix = '';
            if (currentClassFilter !== 'ALL') fileSuffix += '_Sinif_' + currentClassFilter;
            if (currentRoomFilter !== 'ALL') fileSuffix += '_Salon_' + currentRoomFilter;
            if (currentStatusFilter !== 'ALL') fileSuffix += '_' + currentStatusFilter;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = ${safeFileName} + fileSuffix + '_Yoklama_Raporu.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Initialize with default class if requested
        if (currentClassFilter !== 'ALL') {
            const selectEl = document.getElementById('classFilter');
            if (selectEl) selectEl.value = currentClassFilter;
            document.querySelectorAll('.class-pill-btn').forEach(b => {
                if (b.getAttribute('data-class') === currentClassFilter) b.classList.add('active');
                else b.classList.remove('active');
            });
            filterTable();
        }
    </script>
</body>
</html>`;

    win.document.open();
    win.document.write(htmlContent);
    win.document.close();
};
