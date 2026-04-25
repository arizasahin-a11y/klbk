// PDF Başlık Render - ui.js ile ortak (dashboard + ogretmen)
window.renderStudentPDFHeader = async function (pdfDoc, page, info, options = {}) {
    const { PDFLib, DataManager } = window;
    const { rgb, degrees } = PDFLib;
    const { mainFont, nameFont, schoolFont } = options;
    const { width, height } = page.getSize();
    const sf = options.sf || 1;

    const customFont = mainFont;
    const reflectsStandard = (f) => f && (f.name === 'Helvetica' || f.name === 'Helvetica-Bold' || f.name === 'Times-Roman' || f.name === 'Times-Bold' || f.name === 'Courier' || f.name === 'Courier-Bold');
    const cleanTurkishChars = (text) => {
        if (!text) return '';
        // Only skip cleaning if we have a non-standard (embedded) font
        if (customFont && !reflectsStandard(customFont)) return text;
        return text
            .replace(/\u0130/g, 'I').replace(/\u0131/g, 'i')
            .replace(/\u011e/g, 'G').replace(/\u011f/g, 'g')
            .replace(/\u015e/g, 'S').replace(/\u015f/g, 's')
            .replace(/\u00c7/g, 'C').replace(/\u00e7/g, 'c')
            .replace(/\u00d6/g, 'O').replace(/\u00f6/g, 'o')
            .replace(/\u00dc/g, 'U').replace(/\u00fc/g, 'u');
    };

    const drawCenterText = (str, cx, cy, cw, ch, sz, fnt) => {
        const s_sz = sz * sf;
        if (!str) return;
        const cl = cleanTurkishChars(str).toString();
        const tw = fnt ? fnt.widthOfTextAtSize(cl, s_sz) : cl.length * (s_sz * 0.6);
        const tx = cx + Math.max(0, (cw - tw) / 2);
        const ty = cy + (ch / 2) - (s_sz * 0.35);
        page.drawText(cl, { x: tx, y: ty, size: s_sz, font: fnt || undefined, color: rgb(0, 0, 0) });
    };

    const drawLeftText = (str, cx, cy, cw, ch, sz, fnt) => {
        const s_sz = sz * sf;
        if (!str) return;
        const cl = cleanTurkishChars(str).toString();
        const tx = cx + (5 * sf);
        const ty = cy + (ch / 2) - (s_sz * 0.35);
        page.drawText(cl, { x: tx, y: ty, size: s_sz, font: fnt || undefined, color: rgb(0, 0, 0) });
    };

    const drawRightText = (str, cx, cy, cw, ch, sz, fnt) => {
        const s_sz = sz * sf;
        if (!str) return;
        const cl = cleanTurkishChars(str).toString();
        const tw = fnt ? fnt.widthOfTextAtSize(cl, s_sz) : cl.length * (s_sz * 0.6);
        const tx = cx + cw - tw - (5 * sf);
        const ty = cy + (ch / 2) - (s_sz * 0.35);
        page.drawText(cl, { x: tx, y: ty, size: s_sz, font: fnt || undefined, color: rgb(0, 0, 0) });
    };

    const getFitSize = (txt, mw, bs, fnt = mainFont) => {
        let sz = bs;
        let tw = (fnt || mainFont).widthOfTextAtSize(cleanTurkishChars(txt), sz * sf);
        while (tw > mw && sz > 4) {
            sz -= 0.5;
            tw = (fnt || mainFont).widthOfTextAtSize(cleanTurkishChars(txt), sz * sf);
        }
        return sz;
    };

    const school = options.school || (window.DataManager ? window.DataManager.getSchoolSettings() : {});

    const sess = options.session || window.currentRenderedSession || {};
    const subjectName = info?.subject || '';
    const metadata = options.metadata || (DataManager.getSanitizedSubjectMetadata ? DataManager.getSanitizedSubjectMetadata(sess, subjectName) : (sess.subjectMetadata?.[subjectName] || {})) || {};
    const designType = options.designType || metadata.pdfHeaderDesign || '1';

    const margin = 14.17 * sf;
    const limitY = 85.04 * sf;
    const outerStroke = 1.6 * sf;
    const strokeOffset = outerStroke / 2 + (1 * sf);
    const ox = margin + strokeOffset;
    const oy = height - limitY + strokeOffset;
    const ow = width - (margin * 2) - (strokeOffset * 2);
    const oh = limitY - margin - (strokeOffset * 2);

    const gap = 2 * sf;
    const ix = ox + gap;
    const iy = oy + gap;
    const iw = ow - (gap * 2);
    const ih = oh - (gap * 2);

    const leftW = 50.83 * sf; // 65 - 14.17 (0.5cm)
    const rightW = 85 * sf;
    const midW = iw - leftW - rightW;

    const row3H = 25 * sf;
    const row2H = 19 * sf;
    const row1H = ih - row3H - row2H;

    const midCol2W = 44.17 * sf; // 30 + 14.17 (0.5cm)
    const midCol4W = 30 * sf;
    const midCol5W = 75 * sf;
    const midCol6W = 30 * sf;
    const midCol3W = midW - midCol2W - midCol4W - midCol5W - midCol6W;
    const getTranslations = (subject) => {
        const rawSub = (subject || '');
        const shortenedSub = window.shortenSubject ? window.shortenSubject(rawSub, 35) : rawSub;
        // Normalize for comparison
        const normalized = rawSub.replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase();
        
        const isEnglish = normalized.includes('ingilizce') || normalized.includes('english');
        const isGerman = normalized.includes('almanca') || normalized.includes('deutsch');
        const isFrench = normalized.includes('fransizca') || normalized.includes('francais');

        let translatedSubject = shortenedSub.replace(/i/g, 'İ').toUpperCase();

        if (isEnglish) {
            if (translatedSubject.includes('İNGİLİZCE')) translatedSubject = translatedSubject.replace(/İNGİLİZCE/g, 'ENGLISH');
            else if (translatedSubject.includes('INGILIZCE')) translatedSubject = translatedSubject.replace(/INGILIZCE/g, 'ENGLISH');
            return { year: 'ACADEMIC YEAR', term: 'TERM', class: 'CLASS', no: 'NO', name: 'NAME SURNAME', room: 'ROOM', exam: 'EXAM', seat: 'SEAT', score: 'SCORE', written: 'WRITTEN EXAM', subject: translatedSubject };
        }
        if (isGerman) {
            translatedSubject = translatedSubject.replace(/ALMANCA/g, 'DEUTSCH');
            return { year: 'SCHULJAHR', term: 'HALBJAHR', class: 'KLASSE', no: 'NR', name: 'NAME VORNAME', room: 'RAUM', exam: 'PRÜFUNG', seat: 'PLATZ', score: 'PUNKTE', written: 'SCHRIFTLICHE PRÜFUNG', subject: translatedSubject };
        }
        if (isFrench) {
            translatedSubject = translatedSubject.replace(/FRANSIZCA/g, 'FRANÇAIS');
            return { year: 'ANNÉE SCOLAIRE', term: 'SEMESTRE', class: 'CLASSE', no: 'N°', name: 'NOM PRÉNOM', room: 'SALLE', exam: 'EXAMEN', seat: 'PLACE', score: 'NOTE', written: 'EXAMEN ÉCRIT', subject: translatedSubject };
        }
        return { year: 'ÖĞRETİM YILI', term: 'DÖNEM', class: 'SINIFI', no: 'NO', name: 'ADI SOYADI', room: 'DERSLİK', exam: 'SINAV', seat: 'YER', score: 'PUAN', written: 'YAZILI SINAVI', subject: translatedSubject };
    };


    const lang = getTranslations(info?.subject);
    // Use an ultra-robust normalized string for language detection throughout header construction
    const normalizedSubForHeader = (info?.subject || '').replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase();
    
    let termDom = '';
    try { const el = document.getElementById('academicTerm'); if (el) termDom = el.value; } catch (e) { }

    // Fallback chain: session object → DOM input → DataManager school settings → date-based auto-detect
    let rawTermInput = (sess.academicTerm || termDom || '').trim();
    if (!rawTermInput) {
        try {
            const schoolSettings = window.DataManager ? window.DataManager.getSchoolSettings() : null;
            rawTermInput = (schoolSettings && schoolSettings.academicTerm) ? schoolSettings.academicTerm : '';
        } catch (e) { }
    }
    if (!rawTermInput) {
        // Date-based auto-detect: Sep–Dec = I. Dönem, Jan = I. Dönem, Feb–Aug = II. Dönem
        const _m = new Date().getMonth() + 1; // 1-12
        rawTermInput = (_m >= 2 && _m <= 8) ? 'II' : 'I';
    }

    /**
     * Detects if the raw term string refers to Term 1 or Term 2.
     * Handles: "1", "2", "I", "II", "1.", "2.", "I.", "II.", "1. Dönem", "2. Dönem", etc.
     * Returns 1 or 2 (defaults to 1 if ambiguous).
     */
    const detectTermNumber = (raw) => {
        const s = raw.toUpperCase().trim();
        // Check for "2" or "II" indicators
        if (/\bII\b/.test(s) || /\b2\b/.test(s) || s.startsWith('II.') || s.startsWith('2.')) return 2;
        return 1;
    };

    const termNum = detectTermNumber(rawTermInput);

    // Format term string according to detected language
    let termStr;
    const isEnglishSubject = normalizedSubForHeader.includes('ingilizce') || normalizedSubForHeader.includes('english');
    const isGermanSubject = normalizedSubForHeader.includes('almanca') || normalizedSubForHeader.includes('deutsch');
    const isFrenchSubject = normalizedSubForHeader.includes('fransizca') || normalizedSubForHeader.includes('francais');

    if (isEnglishSubject) {
        termStr = termNum === 2 ? '2nd Term' : '1st Term';
    } else if (isGermanSubject) {
        termStr = termNum === 2 ? '2. Halbjahr' : '1. Halbjahr';
    } else if (isFrenchSubject) {
        termStr = termNum === 2 ? '2ème Semestre' : '1er Semestre';
    } else {
        // Turkish (default)
        termStr = termNum === 2 ? `II. ${lang.term}` : `I. ${lang.term}`;
    }
    const examNoStr = info?.examNo || metadata?.examNo || '';
    
    const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const rawSchoolName = (school.name || '').replace(/i/g, 'İ').toUpperCase();
    let sName = rawSchoolName.split('').join(' ');
    if (schoolFont.widthOfTextAtSize(cleanTurkishChars(sName), 9 * sf) > midW) sName = rawSchoolName;

    let examText = '';
    if (isEnglishSubject) {
        // English: "2025-2026 ACADEMIC YEAR 1st Term 1st English Exam for 9th Graders"
        let engExamNo = getOrdinal(parseInt(examNoStr) || 1);
        let gradeLevel = (info?.subject || '').match(/\d+/);
        let gradeStr = gradeLevel ? ` for ${getOrdinal(parseInt(gradeLevel[0]))} Graders` : '';
        let subjectClean = (lang.subject || '').replace(/\d+/g, '').replace(/İ/g,'i').toLowerCase();
        subjectClean = subjectClean.charAt(0).toUpperCase() + subjectClean.slice(1).trim();
        examText = `${school.academicYear || ''} ${lang.year} ${termStr} ${engExamNo} ${subjectClean} Exam${gradeStr}`.toUpperCase();
    } else if (isGermanSubject || isFrenchSubject) {
        // German/French: use localized year, term and subject labels
        examText = `${school.academicYear || ''} ${lang.year} ${termStr} ${lang.subject || ''} ${examNoStr ? `${examNoStr}. ` : ''}${lang.written}`.toUpperCase();
    } else {
        // Turkish: "2023-2024 ÖĞRETİM YILI I. DÖNEM FİZİK 9 DERSİ 1. SINAVI"
        examText = `${school.academicYear || ''} ${lang.year} ${termStr} ${lang.subject || ''} DERSİ ${examNoStr ? `${examNoStr}. ` : ''}SINAVI`.toUpperCase();
    }
    

    const drawExplicitOppositeFrame = (x, y, w, h, r, th, rColor) => {
        const col = rColor || rgb(0, 0, 0);
        page.drawLine({ start: { x: x + r, y: y + h }, end: { x: x + w - r, y: y + h }, thickness: th, color: col });
        page.drawLine({ start: { x: x + w, y: y + h - r }, end: { x: x + w, y: y + r }, thickness: th, color: col });
        page.drawLine({ start: { x: x + w - r, y: y }, end: { x: x + r, y: y }, thickness: th, color: col });
        page.drawLine({ start: { x: x, y: y + r }, end: { x: x, y: y + h - r }, thickness: th, color: col });
        if (r > 0) {
            const segs = 6;
            for (let j = 0; j < segs; j++) {
                const a1 = Math.PI / 2 + (Math.PI / 2) * (j / segs); const a2 = Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segs);
                page.drawLine({ start: { x: x + r + r * Math.cos(a1), y: y + h - r + r * Math.sin(a1) }, end: { x: x + r + r * Math.cos(a2), y: y + h - r + r * Math.sin(a2) }, thickness: th, color: col });
            }
            for (let j = 0; j < segs; j++) {
                const a1 = 0 + (Math.PI / 2) * (j / segs); const a2 = 0 + (Math.PI / 2) * ((j + 1) / segs);
                page.drawLine({ start: { x: x + w - r + r * Math.cos(a1), y: y + h - r + r * Math.sin(a1) }, end: { x: x + w - r + r * Math.cos(a2), y: y + h - r + r * Math.sin(a2) }, thickness: th, color: col });
            }
            for (let j = 0; j < segs; j++) {
                const a1 = -Math.PI / 2 + (Math.PI / 2) * (j / segs); const a2 = -Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segs);
                page.drawLine({ start: { x: x + w - r + r * Math.cos(a1), y: y + r + r * Math.sin(a1) }, end: { x: x + w - r + r * Math.cos(a2), y: y + r + r * Math.sin(a2) }, thickness: th, color: col });
            }
            for (let j = 0; j < segs; j++) {
                const a1 = Math.PI + (Math.PI / 2) * (j / segs); const a2 = Math.PI + (Math.PI / 2) * ((j + 1) / segs);
                page.drawLine({ start: { x: x + r + r * Math.cos(a1), y: y + r + r * Math.sin(a1) }, end: { x: x + r + r * Math.cos(a2), y: y + r + r * Math.sin(a2) }, thickness: th, color: col });
            }
        }
    };

    const drawLogo = async (lx, ly, dim) => {
        if (!school.logo) return;
        try {
            const bytes = await window.getFileBytes(school.logo);
            if (!bytes) return;
            let img;
            if (options.imageCache && options.imageCache[school.logo]) {
                img = options.imageCache[school.logo];
            } else {
                img = school.logo.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
                if (options.imageCache) options.imageCache[school.logo] = img;
            }
            page.drawImage(img, { x: lx, y: ly, width: dim, height: dim });
        } catch (e) { }
    };

    const drawStudentName = (tx, ty, tw, th) => {
        if (!info) return;
        let n = info.name.replace(/i/g, 'İ').toUpperCase();
        
        let sz;
        if (designType === '9') {
            // Atatürk teması için mevcut boyut (önceden %15 küçültülmüş)
            sz = Math.min(20.4, getFitSize(n, tw - 10 * sf, 23.8, nameFont));
        } else {
            // Diğer temalar için mevcut boyuttan ilave %15 daha küçültülmüş değerler
            // 20.4 * 0.85 = 17.34, 23.8 * 0.85 = 20.23
            sz = Math.min(17.34, getFitSize(n, tw - 10 * sf, 20.23, nameFont));
        }

        drawLeftText(n, tx, ty, tw, th, sz, nameFont);
        drawLeftText(n, tx + 0.3 * sf, ty, tw, th, sz, nameFont);
    };

    const drawCommon = (bx, by, bL, b2, b3, b4, b5, b6) => {
        drawCenterText(lang.class, bx, by + row3H - 8 * sf, bL, 8 * sf, 6, mainFont);
        drawCenterText(info?.class || '', bx, by - 2 * sf, bL, row3H, 16, mainFont);
        drawCenterText(lang.no, bx + bL, by + row3H - 8 * sf, b2, 8 * sf, 6, mainFont);
        drawCenterText(info?.no || '', bx + bL, by - 2 * sf, b2, row3H, 12, mainFont);
        drawStudentName(bx + bL + b2, by, b3, row3H);
        page.drawText(lang.room, { x: bx + bL + b2 + b3 + 2 * sf, y: by + row3H - 6.5 * sf, size: 5.5 * sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
        drawCenterText(info?.room || '', bx + bL + b2 + b3, by - 2.5 * sf, b4, row3H, 11, mainFont);
        page.drawText(lang.exam, { x: bx + bL + b2 + b3 + b4 + 2 * sf, y: by + row3H - 6.5 * sf, size: 5.5 * sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
        const shortSubInBox = window.shortenSubject ? window.shortenSubject(info?.subject || '', 20) : (info?.subject || '');
        drawCenterText(shortSubInBox.toUpperCase(), bx + bL + b2 + b3 + b4, by - 2.5 * sf, b5, row3H, 9.5, mainFont);
        page.drawText(lang.seat, { x: bx + bL + b2 + b3 + b4 + b5 + 2 * sf, y: by + row3H - 6.5 * sf, size: 5.5 * sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
        drawCenterText(info?.seat || '', bx + bL + b2 + b3 + b4 + b5, by - 2.5 * sf, b6, row3H, 14, mainFont);
    };

    const drawDivs = (bx, by, bL, b2, b3, b4, b5, col, th) => {
        let c = bx + bL; page.drawLine({ start: { x: c, y: by }, end: { x: c, y: by + row3H }, thickness: th, color: col });
        c += b2; page.drawLine({ start: { x: c, y: by }, end: { x: c, y: by + row3H }, thickness: th, color: col });
        c += b3; page.drawLine({ start: { x: c, y: by }, end: { x: c, y: by + row3H }, thickness: th, color: col });
        c += b4; page.drawLine({ start: { x: c, y: by }, end: { x: c, y: by + row3H }, thickness: th, color: col });
        c += b5; page.drawLine({ start: { x: c, y: by }, end: { x: c, y: by + row3H }, thickness: th, color: col });
    };

    if (designType === '1') {
        drawExplicitOppositeFrame(ox, oy, ow, oh, 6 * sf, 1.5 * sf);
        drawExplicitOppositeFrame(ix, iy, iw, ih, 4 * sf, 0.5 * sf);
        const rad = 3.5 * sf;
        [ix + rad + 1 * sf, ix + iw - rad - 1 * sf].forEach(tx => { [iy + rad + 1 * sf, iy + ih - rad - 1 * sf].forEach(ty => { page.drawCircle({ x: tx, y: ty, size: rad, color: rgb(0.85, 0.85, 0.85), borderColor: rgb(0, 0, 0), borderWidth: 0.5 * sf }); }); });
        page.drawLine({ start: { x: ix + leftW, y: iy }, end: { x: ix + leftW, y: iy + ih }, thickness: 0.75 * sf });
        page.drawLine({ start: { x: ix + leftW + midW, y: iy }, end: { x: ix + leftW + midW, y: iy + ih }, thickness: 0.75 * sf });
        drawDivs(ix, iy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, rgb(0, 0, 0), 0.75 * sf);
        page.drawLine({ start: { x: ix + leftW, y: iy + row3H + row2H }, end: { x: ix + leftW + midW, y: iy + row3H + row2H }, thickness: 0.75 * sf });
        page.drawLine({ start: { x: ix, y: iy + row3H }, end: { x: ix + leftW + midW, y: iy + row3H }, thickness: 0.75 * sf });
        drawCenterText(sName, ix + leftW, iy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 11, schoolFont), schoolFont);
        drawCenterText(examText, ix + leftW, iy + row3H, midW, row2H, getFitSize(examText, midW, 14), mainFont);
        page.drawText(lang.score, { x: ix + leftW + midW + 5 * sf, y: iy + ih - 10 * sf, size: 7 * sf, font: mainFont, color: rgb(0.5, 0.5, 0.5) });
        if (info) drawCommon(ix, iy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        const lDim = 26 * sf;
        await drawLogo(ix + (leftW - lDim) / 2, iy + row3H + (ih - row3H - lDim) / 2, lDim);
    } else if (designType === '2') {
        // Modern Tasarım
        drawExplicitOppositeFrame(ox, oy, ow, oh, 0, 1 * sf);
        const notch = 4 * sf;
        page.drawRectangle({ x: ox - notch / 2, y: oy + oh / 2 - notch, width: notch, height: notch * 2, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 * sf });
        page.drawRectangle({ x: ox + ow - notch / 2, y: oy + oh / 2 - notch, width: notch, height: notch * 2, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 * sf });
        page.drawRectangle({ x: ox, y: oy + oh - 3 * sf, width: ow, height: 3 * sf, color: rgb(0.3, 0.3, 0.3) });
        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh - 3 * sf, color: rgb(0.97, 0.97, 0.97) });
        const gc = rgb(0.8, 0.8, 0.8);
        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh - 3 * sf }, thickness: 1 * sf, color: gc });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh - 3 * sf }, thickness: 1 * sf, color: gc });
        page.drawLine({ start: { x: ox + leftW, y: oy + row3H + row2H }, end: { x: ox + leftW + midW, y: oy + row3H + row2H }, thickness: 1 * sf, color: gc });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 1 * sf, color: gc });
        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, gc, 1 * sf);
        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 12, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 15), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        page.drawText(lang.score, { x: ox + leftW + midW + 5 * sf, y: oy + oh - 12 * sf, size: 7 * sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
        const lDim = 28 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);
    } else if (designType === '3') {
        const ac = rgb(0.2, 0.3, 0.5);
        drawExplicitOppositeFrame(ox, oy, ow, oh, 10 * sf, 1 * sf, ac);
        drawExplicitOppositeFrame(ox + 2 * sf, oy + 2 * sf, ow - 4 * sf, oh - 4 * sf, 8 * sf, 0.5 * sf, rgb(0.7, 0.7, 0.7));
        const rd = 3 * sf;
        [ox + 10 * sf, ox + ow - 10 * sf].forEach(tx => { [oy + 10 * sf, oy + oh - 10 * sf].forEach(ty => { page.drawCircle({ x: tx, y: ty, size: rd, color: rgb(1, 1, 1), borderColor: ac, borderWidth: 1 * sf }); }); });
        page.drawRectangle({ x: ox + leftW, y: oy + row3H, width: midW, height: row1H + row2H, color: rgb(0.98, 0.98, 0.99) });
        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh }, thickness: 1 * sf, color: ac });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh }, thickness: 1 * sf, color: ac });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 1 * sf, color: ac });
        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, rgb(0.7, 0.7, 0.7), 1 * sf);
        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 12, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 13), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        page.drawText(lang.score, { x: ox + leftW + midW + 5 * sf, y: oy + oh - 10 * sf, size: 7 * sf, font: mainFont, color: ac });
        const lDim = 25 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);
    } else if (designType === '4') {
        const dr = rgb(0.45, 0.08, 0.08); const gd = rgb(0.72, 0.53, 0.04);
        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh, color: rgb(0.99, 0.98, 0.94) });
        drawExplicitOppositeFrame(ox, oy, ow, oh, 0, 2 * sf, dr);
        drawExplicitOppositeFrame(ox + 3 * sf, oy + 3 * sf, ow - 6 * sf, oh - 6 * sf, 0, 0.75 * sf, gd);
        const kw = 60 * sf; const kh = 6 * sf;
        page.drawEllipse({ x: ox + ow / 2, y: oy + oh, xScale: kw, yScale: kh, color: rgb(0.99, 0.98, 0.94), borderColor: dr, borderWidth: 1 * sf });
        page.drawEllipse({ x: ox + ow / 2, y: oy, xScale: kw, yScale: kh, color: rgb(0.99, 0.98, 0.94), borderColor: dr, borderWidth: 1 * sf });
        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh }, thickness: 1 * sf, color: gd });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh }, thickness: 1 * sf, color: gd });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 1 * sf, color: dr });
        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, gd, 0.5 * sf);
        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 12, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 14), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        page.drawText(lang.score, { x: ox + leftW + midW + 5 * sf, y: oy + oh - 10 * sf, size: 7 * sf, font: mainFont, color: dr });
        const lDim = 28 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);

        // Ottoman Icon: Dagger (Hancer)
        const hx = ox + 4 * sf, hy = oy + oh - 8 * sf;
        page.drawLine({ start: { x: hx, y: hy }, end: { x: hx + 10 * sf, y: hy + 4 * sf }, thickness: 1.5 * sf, color: gd }); // blade
        page.drawCircle({ x: hx, y: hy, size: 1.5 * sf, color: dr }); // hilt base
    } else if (designType === '5') {
        const ink = rgb(0.1, 0.1, 0.1); const red = rgb(0.78, 0.1, 0.18);
        page.drawLine({ start: { x: ox, y: oy + oh }, end: { x: ox + ow, y: oy + oh }, thickness: 2.5 * sf, color: ink });
        page.drawLine({ start: { x: ox - 5 * sf, y: oy + oh + 2 * sf }, end: { x: ox + 15 * sf, y: oy + oh + 2 * sf }, thickness: 2 * sf, color: red });
        page.drawLine({ start: { x: ox + ow - 15 * sf, y: oy + oh + 2 * sf }, end: { x: ox + ow + 5 * sf, y: oy + oh + 2 * sf }, thickness: 2 * sf, color: red });
        page.drawRectangle({ x: ox + leftW + midW + 5 * sf, y: oy + oh - 25 * sf, width: rightW - 10 * sf, height: 20 * sf, color: rgb(1, 1, 1), borderColor: red, borderWidth: 1 * sf });
        drawCenterText(lang.score, ox + leftW + midW + 5 * sf, oy + oh - 25 * sf, rightW - 10 * sf, 20 * sf, 8, mainFont);
        page.drawLine({ start: { x: ox + leftW, y: oy + row3H }, end: { x: ox + leftW, y: oy + oh - 5 * sf }, thickness: 0.5 * sf, color: rgb(0.7, 0.7, 0.7) });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + ow, y: oy + row3H }, thickness: 0.5 * sf, color: ink });
        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, rgb(0.8, 0.8, 0.8), 0.5 * sf);
        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 12, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 14), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        const lDim = 28 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);

        // Japanese Icon: Sword (Kilic/Katana)
        const sx = ox + 5 * sf, sy = oy + oh - 6 * sf;
        page.drawLine({ start: { x: sx, y: sy }, end: { x: sx + 12 * sf, y: sy }, thickness: 1 * sf, color: ink }); // blade
        page.drawCircle({ x: sx + 3 * sf, y: sy, size: 1.5 * sf, color: red }); // tsuba
    } else if (designType === '6') {
        const ed = rgb(0.24, 0.16, 0.11); const em = rgb(0.53, 0.35, 0.22);
        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh, color: rgb(0.97, 0.95, 0.92) });
        drawExplicitOppositeFrame(ox, oy, ow, oh, 12 * sf, 2 * sf, ed);
        for (let k = 0; k < 12; k++) {
            const tx = ox + (ow / 12) * k + 5 * sf;
            page.drawRectangle({ x: tx, y: oy + oh - 2 * sf, width: 4 * sf, height: 4 * sf, color: em, rotate: degrees(45) });
            page.drawRectangle({ x: tx, y: oy - 2 * sf, width: 4 * sf, height: 4 * sf, color: em, rotate: degrees(45) });
        }
        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh }, thickness: 1 * sf, color: ed });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh }, thickness: 1 * sf, color: ed });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 1.5 * sf, color: em });
        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, ed, 0.75 * sf);
        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 12, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 14), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        page.drawText(lang.score, { x: ox + leftW + midW + 5 * sf, y: oy + oh - 10 * sf, size: 7 * sf, font: mainFont, color: ed });
        const lDim = 28 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);
    } else if (designType === '7') {
        // LATIN THEME
        const stone = rgb(0.29, 0.29, 0.29); const paper = rgb(0.98, 0.98, 0.94);
        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh, color: paper });
        drawExplicitOppositeFrame(ox, oy, ow, oh, 0, 1.5 * sf, stone);
        drawExplicitOppositeFrame(ox + 3 * sf, oy + 3 * sf, ow - 6 * sf, oh - 6 * sf, 0, 0.5 * sf, stone);
        const colW = 6 * sf;
        [ox, ox + ow - colW].forEach(tx => {
            page.drawRectangle({ x: tx, y: oy, width: colW, height: oh, color: stone });
            page.drawLine({ start: { x: tx + colW / 2, y: oy + 5 * sf }, end: { x: tx + colW / 2, y: oy + oh - 5 * sf }, thickness: 0.5 * sf, color: paper });
        });
        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh }, thickness: 1 * sf, color: stone });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh }, thickness: 1 * sf, color: stone });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 1 * sf, color: stone });
        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, stone, 0.75 * sf);
        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 11, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 14), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        const lDim = 28 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);

        // Latin Icon: Chili Pepper (Aci Biber)
        const cx_ = ox + 6 * sf, cy_ = oy + oh - 7 * sf;
        page.drawEllipse({ x: cx_, y: cy_, xScale: 4 * sf, yScale: 2 * sf, color: rgb(0.8, 0, 0), rotate: degrees(-30) }); // pepper body
        page.drawLine({ start: { x: cx_ - 2 * sf, y: cy_ + 1 * sf }, end: { x: cx_ - 4 * sf, y: cy_ + 3 * sf }, thickness: 1 * sf, color: rgb(0, 0.5, 0) }); // stem
    } else if (designType === '8') {
        // ARABIC THEME
        const emerald = rgb(0, 0.41, 0.31); const gold = rgb(0.83, 0.69, 0.22);
        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh, color: rgb(0.99, 0.96, 0.9) });
        drawExplicitOppositeFrame(ox, oy, ow, oh, 10 * sf, 2 * sf, emerald);
        const diamondSz = 4 * sf;
        for (let k = 0; k < ow / (diamondSz * 3); k++) {
            const tx = ox + k * diamondSz * 3 + diamondSz;
            page.drawRectangle({ x: tx, y: oy + oh - 2 * sf, width: diamondSz, height: diamondSz, color: gold, rotate: degrees(45) });
            page.drawRectangle({ x: tx, y: oy - 2 * sf, width: diamondSz, height: diamondSz, color: gold, rotate: degrees(45) });
        }
        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh }, thickness: 1.5 * sf, color: emerald });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh }, thickness: 1.5 * sf, color: emerald });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 1.2 * sf, color: emerald });
        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, emerald, 1 * sf);
        const spacedName = sName.length > 20 ? sName : sName.split('').join(' ');
        drawCenterText(spacedName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(spacedName, midW, 10.5, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H + 2 * sf, midW, row2H - 4 * sf, getFitSize(examText, midW, 13.5), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W);
        const lDim = 30 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);

        // Arabic Icon: Snake (Yilan)
        const snX = ox + 8 * sf, snY1 = oy + oh - 8 * sf, snY2 = oy + oh - 4 * sf;
        page.drawLine({ start: { x: snX, y: snY1 }, end: { x: snX + 4 * sf, y: snY1 + 2 * sf }, thickness: 1 * sf, color: emerald });
        page.drawLine({ start: { x: snX + 4 * sf, y: snY1 + 2 * sf }, end: { x: snX + 2 * sf, y: snY2 }, thickness: 1 * sf, color: emerald });
        page.drawCircle({ x: snX + 2 * sf, y: snY2, size: 0.8 * sf, color: gold }); // snake head
    } else if (designType === '9') {
        // Atatürk Teması (v3 Görsel Çerçeve + Düzenlemeler)
        const cmToPt = 28.35;
        const cropBottom = 0.5 * cmToPt * sf;
        const targetH = (3 * cmToPt + 4.17) * sf - cropBottom; // Expansion +1mm (Total +4.17 points from base)
        const extraW = 1.0 * cmToPt * sf;
        const shiftLeft = 5.67 * sf; // 2mm move to left

        const drawH = Math.max(oh, targetH);
        const drawW = ow + extraW + shiftLeft;
        const drawX = ox - shiftLeft;

        // Move bottom limit to precisely 3cm (height - 85.05pt) from top
        const drawY = height - (3 * cmToPt * sf); 

        try {
            const headerUrl = 'ata_header_v4.png';
            const headerBytes = await window.getFileBytes(headerUrl);
            if (headerBytes) {
                let headerImg;
                if (options.imageCache && options.imageCache[headerUrl]) {
                    headerImg = options.imageCache[headerUrl];
                } else {
                    headerImg = await pdfDoc.embedPng(headerBytes);
                    if (options.imageCache) options.imageCache[headerUrl] = headerImg;
                }
                page.drawImage(headerImg, { x: drawX, y: drawY, width: drawW, height: drawH });
            }
        } catch (e) { console.warn("Ata header v3 load failed", e); }

        const textNarrow = 3.0 * cmToPt * sf;
        const textUp = 1 * cmToPt * sf;
        const contentMidW = ow - 100 * sf - textNarrow;
        const contentX = ox + 50 * sf + (textNarrow / 2);

        // Stabilized contentBaseY to keep text fixed while header grows up
        const d9LowTextShift = 4.8 * sf; // Adjusted shift for 3cm height
        const contentBaseY = drawY - cropBottom + (oh * 0.15) + textUp + (10.5 * sf) - d9LowTextShift; 
        const d9Oy = drawY + 2.835 * sf; // Moved student info box 1mm (2.835pt) UP from bottom limit

        // School name position: 1mm down relative to the content base
        drawCenterText(sName.toUpperCase(), contentX, contentBaseY + 13.5 * sf, contentMidW, row1H, getFitSize(sName.toUpperCase(), contentMidW, 11, schoolFont), schoolFont);
        drawCenterText(examText, contentX, contentBaseY, contentMidW, row2H, getFitSize(examText, contentMidW, 13), mainFont);

        const sNameStr = sName.toUpperCase();
        const sSize = getFitSize(sNameStr, contentMidW, 11, schoolFont);
        const twName = schoolFont ? schoolFont.widthOfTextAtSize(cleanTurkishChars(sNameStr), sSize * sf) : cleanTurkishChars(sNameStr).length * (sSize * sf * 0.6);
        
        const examSize = getFitSize(examText, contentMidW, 13);
        const twExam = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(examText), examSize * sf) : cleanTurkishChars(examText).length * (examSize * sf * 0.6);
        
        const widestText = Math.max(twName, twExam);
        const startX = contentX + Math.max(0, (contentMidW - widestText) / 2);

        const logoDim = 26 * sf;
        const logoX = startX - logoDim - (8 * sf);
        const logoY = contentBaseY + (13.5 * sf + row1H - logoDim) / 2;
        await drawLogo(logoX, logoY, logoDim);

        const scoreDivX = ox + leftW + midW;

        // Yatay Çizgi: Sol sütun bitişinden Puan sütunu başlangıcına kadar
        const lineX1 = (ox + leftW);
        const lineX2 = (scoreDivX);
        const lineY = contentBaseY - 0.75 * sf; // Moved significantly up to ensure visibility (approx 1.5mm higher than the previous 0.5mm attempt)
        page.drawLine({ start: { x: lineX1, y: lineY }, end: { x: lineX2, y: lineY }, thickness: 0.5 * sf, color: rgb(0, 0, 0) });

        const gc = rgb(0.8, 0.8, 0.8);
        const lineTopY = (drawY + drawH) - 8.505 * sf;
        if (info) {
            const d9LeftW = leftW + 15 * sf;
            const d9MidCol2W = midCol2W - 15 * sf;
            const d9MidCol3W = midCol3W;

            // Alttaki dikey ayraçlar (Yatay çizgi kullanıcı isteğiyle kaldırıldı)
            drawDivs(ox, d9Oy, d9LeftW, d9MidCol2W, d9MidCol3W, midCol4W, midCol5W, gc, 0.5 * sf);
            // ALT ÇİZGİ KALDIRILDI

            // Puan yazısının soluna dikey çizgi (YER kutusu sağındaki çizgi) - Üstten 3mm (8.5pt) kısaltıldı
            page.drawLine({ start: { x: scoreDivX, y: d9Oy }, end: { x: scoreDivX, y: lineTopY }, thickness: 0.5 * sf, color: gc });

            drawRightText(lang.class, ox, d9Oy + row3H - 8 * sf, d9LeftW, 8 * sf, 6, mainFont);
            drawRightText(info.class || '', ox, d9Oy - 2 * sf, d9LeftW, row3H, 16, mainFont);

            drawCenterText(lang.no, ox + d9LeftW, d9Oy + row3H - 8 * sf, d9MidCol2W, 8 * sf, 6, mainFont);
            drawCenterText(info.no || '', ox + d9LeftW, d9Oy - 2 * sf, d9MidCol2W, row3H, 12, mainFont);
            drawStudentName(ox + d9LeftW + d9MidCol2W, d9Oy, d9MidCol3W, row3H);
            page.drawText(lang.room, { x: ox + d9LeftW + d9MidCol2W + d9MidCol3W + 2 * sf, y: d9Oy + row3H - 6.5 * sf, size: 5.5 * sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
            drawCenterText(info.room || '', ox + d9LeftW + d9MidCol2W + d9MidCol3W, d9Oy - 2.5 * sf, midCol4W, row3H, 11, mainFont);
            page.drawText(lang.exam, { x: ox + d9LeftW + d9MidCol2W + d9MidCol3W + midCol4W + 2 * sf, y: d9Oy + row3H - 6.5 * sf, size: 5.5 * sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
            drawCenterText((info.subject || '').toUpperCase(), ox + d9LeftW + d9MidCol2W + d9MidCol3W + midCol4W, d9Oy - 2.5 * sf, midCol5W, row3H, 9.5, mainFont);
            page.drawText(lang.seat, { x: ox + d9LeftW + d9MidCol2W + d9MidCol3W + midCol4W + midCol5W + 2 * sf, y: d9Oy + row3H - 6.5 * sf, size: 5.5 * sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
            drawCenterText(info.seat || '', ox + d9LeftW + d9MidCol2W + d9MidCol3W + midCol4W + midCol5W, d9Oy - 2.5 * sf, midCol6W, row3H, 14, mainFont);
        }
        page.drawText(lang.score, { x: ox + leftW + midW + 5 * sf, y: lineTopY - 10 * sf, size: 7 * sf, font: mainFont, color: rgb(0.2, 0.2, 0.2) });

    } else if (designType === '10') {
        // CLOUD THEME (FLATTER CURVES: 4x Length, Original Bulge)
        const edgeColor = rgb(0.1, 0.1, 0.1);
        const cloudWhite = rgb(1, 1, 1);
        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh, color: cloudWhite });

        // Geometry: R=20, Offset=12 -> Protrusion=8, Length=32 (~4x original 8-9)
        const r = 20 * sf, offset = 12 * sf, segLen = 32 * sf;
        const drawFlatterEdge = (x1, y1, x2, y2, isVert, isTopRight) => {
            const dist = isVert ? Math.abs(y2 - y1) : Math.abs(x2 - x1);
            const count = Math.max(1, Math.round(dist / segLen));
            const step = dist / count;
            const sign = isTopRight ? 1 : -1;
            for (let i = 0; i < count; i++) {
                const mid = (i + 0.5) * step;
                const cx = isVert ? x1 + offset * sign : x1 + mid;
                const cy = isVert ? y1 + mid : y1 + offset * sign;
                page.drawCircle({ x: cx, y: cy, size: r, color: cloudWhite, borderColor: edgeColor, borderWidth: 1 * sf });
            }
        };
        drawFlatterEdge(ox, oy + oh, ox + ow, oy + oh, false, false); // Top (center is below line)
        drawFlatterEdge(ox, oy, ox + ow, oy, false, true);          // Bottom (center is above line)
        drawFlatterEdge(ox, oy, ox, oy + oh, true, true);           // Left (center is to right)
        drawFlatterEdge(ox + ow, oy, ox + ow, oy + oh, true, false); // Right (center is to left)

        // Inner mask to clean up the interiors of the large circles
        page.drawRectangle({ x: ox + 1 * sf, y: oy + 1 * sf, width: ow - 2 * sf, height: oh - 2 * sf, color: cloudWhite });

        // Internal lines
        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh }, thickness: 0.5 * sf, color: edgeColor });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh }, thickness: 0.5 * sf, color: edgeColor });
        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 0.5 * sf, color: edgeColor });

        drawDivs(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, edgeColor, 0.5 * sf);
        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName, midW, 11, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 14), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W, 0);

        page.drawText(lang.score, { x: ox + leftW + midW + 5 * sf, y: oy + oh - 12 * sf, size: 7 * sf, font: mainFont, color: edgeColor });
        const lDim = 28 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);
    } else if (designType === '11') {
        // SAWTOOTH THEME (TESTERE DİŞİ)
        const darkMetal = rgb(0.2, 0.2, 0.2); const lightGray = rgb(0.96, 0.96, 0.96);
        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh, color: lightGray });

        // Sawtooth Path Generator
        const stPts = [];
        const toothD = 5 * sf;
        const tCountW = Math.floor(ow / toothD);
        const tCountH = Math.floor(oh / toothD);
        const actW = ow / tCountW;
        const actH = oh / tCountH;

        // Top Edge (Left to Right)
        for (let i = 0; i < tCountW; i++) { stPts.push({ x: ox + i * actW, y: oy + oh }); stPts.push({ x: ox + i * actW + actW / 2, y: oy + oh - toothD }); }
        stPts.push({ x: ox + ow, y: oy + oh });
        // Right Edge (Top to Bottom)
        for (let i = 0; i < tCountH; i++) { stPts.push({ x: ox + ow, y: oy + oh - i * actH }); stPts.push({ x: ox + ow - toothD, y: oy + oh - i * actH - actH / 2 }); }
        stPts.push({ x: ox + ow, y: oy });
        // Bottom Edge (Right to Left)
        for (let i = 0; i < tCountW; i++) { stPts.push({ x: ox + ow - i * actW, y: oy }); stPts.push({ x: ox + ow - i * actW - actW / 2, y: oy + toothD }); }
        stPts.push({ x: ox, y: oy });
        // Left Edge (Bottom to Top)
        for (let i = 0; i < tCountH; i++) { stPts.push({ x: ox, y: oy + i * actH }); stPts.push({ x: ox + toothD, y: oy + i * actH + actH / 2 }); }
        stPts.push({ x: ox, y: oy + oh });

        for (let i = 0; i < stPts.length - 1; i++) {
            page.drawLine({ start: stPts[i], end: stPts[i + 1], thickness: 1 * sf, color: darkMetal });
        }

        // Inner boundary constraints so content doesn't hit teeth
        const tOff = toothD + 1 * sf;

        page.drawLine({ start: { x: ox + leftW, y: oy + tOff }, end: { x: ox + leftW, y: oy + oh - tOff }, thickness: 1 * sf, color: darkMetal });
        page.drawLine({ start: { x: ox + leftW + midW, y: oy + tOff }, end: { x: ox + leftW + midW, y: oy + oh - tOff }, thickness: 1 * sf, color: darkMetal });
        page.drawLine({ start: { x: ox + tOff, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: 1 * sf, color: darkMetal });

        drawDivs(ox, oy + tOff, leftW, midCol2W, midCol3W, midCol4W, midCol5W, darkMetal, 0.75 * sf);
        drawCenterText(sName.toUpperCase(), ox + leftW, oy + row3H + row2H, midW, row1H, getFitSize(sName.toUpperCase(), midW, 11, schoolFont), schoolFont);
        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW, 14), mainFont);
        if (info) drawCommon(ox, oy, leftW, midCol2W, midCol3W, midCol4W, midCol5W, midCol6W, tOff);

        page.drawText(lang.score, { x: ox + leftW + midW + 5 * sf, y: oy + oh - 12 * sf, size: 7 * sf, font: mainFont, color: darkMetal });
        const lDim = 28 * sf;
        await drawLogo(ox + (leftW - lDim) / 2, oy + row3H + (oh - row3H - lDim) / 2, lDim);
    }
};

window.openSafePdf = function (url, title = 'PDF Görüntüleyici') {
    if (!url) return;
    
    // Google Drive linklerini iframe uyumlu /preview formatına çevir
    if (url.includes('drive.google.com') && !url.includes('/preview')) {
        url = url.replace(/\/view\?usp=sharing$/, '/preview')
                 .replace(/\/view$/, '/preview')
                 .replace(/\/edit\?usp=sharing$/, '/preview')
                 .replace(/\/edit$/, '/preview');
        
        // Eğer hala /preview yoksa ve dosya ID'si varsa manuel ekle
        if (!url.includes('/preview')) {
            const driveIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (driveIdMatch) {
                url = `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`;
            }
        }
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        window.open(url, '_blank');
        return;
    }

    const newWin = window.open('', '_blank');
    if (!newWin) {
        window.open(url, '_blank');
        return;
    }

    newWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #525659; }
                iframe { width: 100%; height: 100%; border: none; }
                .floating-print-btn { 
                    position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px; 
                    background: #4f46e5; color: white; border: none; border-radius: 50%; 
                    cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
                    display: flex; align-items: center; justify-content: center; 
                    font-size: 24px; z-index: 10000; transition: all 0.3s; 
                }
                .floating-print-btn:hover { background: #4338ca; transform: scale(1.1); }
                @media print { .floating-print-btn { display: none !important; } }
            </style>
        </head>
        <body>
            <iframe src="${url}" name="printFrame"></iframe>
            <button class="floating-print-btn" onclick="try { window.frames['printFrame'].focus(); window.frames['printFrame'].print(); } catch(e) { window.print(); }" title="Yazdır">
                <i class="fas fa-print"></i>
            </button>
            <script>
                window.onload = function() {
                    setTimeout(() => { try { window.frames['printFrame'].focus(); } catch(e) {} }, 500);
                };
            </script>
        </body>
        </html>
    `);
    newWin.document.close();
    return newWin;
};
