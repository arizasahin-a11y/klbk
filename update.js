const fs = require('fs');
const uiJsPath = 'a:/TOOLS/kodlama/km/KLBK FRVR/js/ui.js';
let content = fs.readFileSync(uiJsPath, 'utf8');

const regex = /\/\/ ONLY DRAW ON PAGE 1[\s\S]*?(?=const modifiedPdfBytes = await pdfDoc\.save\(\);)/;

if (!regex.test(content)) {
    console.error("Marker block not found via regex");
    process.exit(1);
}

const newDrawingLogic = `// ONLY DRAW ON PAGE 1
                if (i === 0) {
                    const designType = school.pdfHeaderDesign || '1';
                    
                    // --- PERFECT REPRODUCTION HEADER SHARED VARS ---
                    const margin = 14.17 * sf; // 0.5 cm offset points
                    const limitY = 85.04 * sf; // 3.0 cm from top

                    const outerStroke = 1.6 * sf;
                    const strokeOffset = outerStroke / 2 + (1 * sf); // Security margin

                    const ox = margin + strokeOffset;
                    const oy = height - limitY + strokeOffset;
                    const ow = width - (margin * 2) - (strokeOffset * 2);
                    const oh = limitY - margin - (strokeOffset * 2);

                    const gap = 2 * sf;
                    const ix = ox + gap;
                    const iy = oy + gap;
                    const iw = ow - (gap * 2);
                    const ih = oh - (gap * 2);

                    const leftW = 65 * sf;
                    const rightW = 85 * sf;
                    const midW = iw - leftW - rightW;

                    const row3H = 25 * sf;
                    const row2H = 19 * sf;
                    const row1H = ih - row3H - row2H;

                    // Mid section columns
                    const midCol2W = 30 * sf;
                    const midCol4W = 30 * sf;
                    const midCol5W = 75 * sf;
                    const midCol6W = 30 * sf;
                    const midCol3W = midW - midCol2W - midCol4W - midCol5W - midCol6W;

                    // Localization Helper for Foreign Language Exams
                    const getTranslations = (subject) => {
                        const sub = (subject || '').toLowerCase();
                        if (sub.includes('ingilizce') || sub.includes('english')) {
                            return { year: 'ACADEMIC YEAR', term: 'TERM', class: 'CLASS', no: 'NO', name: 'NAME SURNAME', room: 'ROOM', exam: 'EXAM', seat: 'SEAT', score: 'SCORE', written: 'WRITTEN EXAM', subject: 'ENGLISH' };
                        } else if (sub.includes('almanca') || sub.includes('deutsch')) {
                            return { year: 'SCHULJAHR', term: 'HALBJAHR', class: 'KLASSE', no: 'NR', name: 'NAME VORNAME', room: 'RAUM', exam: 'PRÜFUNG', seat: 'PLATZ', score: 'PUNKTE', written: 'SCHRIFTLICHE PRÜFUNG', subject: 'DEUTSCH' };
                        } else if (sub.includes('fransızca') || sub.includes('français') || sub.includes('fransizca')) {
                            return { year: 'ANNÉE SCOLAIRE', term: 'SEMESTRE', class: 'CLASSE', no: 'N°', name: 'NOM PRÉNOM', room: 'SALLE', exam: 'EXAMEN', seat: 'PLACE', score: 'NOTE', written: 'EXAMEN ÉCRIT', subject: 'FRANÇAIS' };
                        }
                        // Default Turkish
                        return { year: 'ÖĞRETİM YILI', term: 'DÖNEM', class: 'SINIFI', no: 'NO', name: 'ADI SOYADI', room: 'DERSLİK', exam: 'SINAV', seat: 'YER', score: 'PUAN', written: 'YAZILI SINAVI', subject: (subject || '').toUpperCase() };
                    };
                    const lang = getTranslations(info?.subject);

                    const sess = window.currentRenderedSession || {};
                    let termDom = '';
                    try { const termEl = document.getElementById('academicTerm'); if (termEl) termDom = termEl.value; } catch (e) { }

                    let termStr = (sess.academicTerm || termDom || '').toUpperCase();
                    if (termStr === '1. DÖNEM' || termStr === '1 DÖNEM' || termStr === '1. DONEM') termStr = \`I. \${lang.term}\`;
                    else if (termStr === '2. DÖNEM' || termStr === '2 DÖNEM' || termStr === '2. DONEM') termStr = \`II. \${lang.term}\`;
                    else termStr = termStr.replace('1.', '1.').replace('2.', '2.').replace('DÖNEM', lang.term).replace('DONEM', lang.term);
                    if (termStr && !termStr.includes(lang.term)) termStr += \` \${lang.term}\`;

                    const examNoStr = info?.examNo || info?.examNumber || '';
                    const examText = \`\${school.academicYear || ''} \${lang.year} \${termStr} \${lang.subject || ''} \${examNoStr ? \`\${examNoStr}. \` : ''}\${lang.written}\`.trim().toUpperCase();

                    let sName = (school.name || '').replace(/i/g, 'İ').toUpperCase().split('').join(' ');

                    const drawExplicitOppositeFrame = (x, y, w, h, r, thickness) => {
                        page.drawLine({ start: { x: x + r, y: y + h }, end: { x: x + w, y: y + h }, thickness });
                        page.drawLine({ start: { x: x + w, y: y + h }, end: { x: x + w, y: y + r }, thickness });
                        page.drawLine({ start: { x: x + w - r, y: y }, end: { x: x, y: y }, thickness });
                        page.drawLine({ start: { x: x, y: y }, end: { x: x, y: y + h - r }, thickness });
                        const segments = 12;
                        for (let j = 0; j < segments; j++) {
                            const a1 = Math.PI / 2 + (Math.PI / 2) * (j / segments);
                            const a2 = Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                            page.drawLine({ start: { x: x + r + r * Math.cos(a1), y: y + h - r + r * Math.sin(a1) }, end: { x: x + r + r * Math.cos(a2), y: y + h - r + r * Math.sin(a2) }, thickness });
                        }
                        for (let j = 0; j < segments; j++) {
                            const a1 = -Math.PI / 2 + (Math.PI / 2) * (j / segments);
                            const a2 = -Math.PI / 2 + (Math.PI / 2) * ((j + 1) / segments);
                            page.drawLine({ start: { x: x + w - r + r * Math.cos(a1), y: y + r + r * Math.sin(a1) }, end: { x: x + w - r + r * Math.cos(a2), y: y + r + r * Math.sin(a2) }, thickness });
                        }
                    };

                    const prepareLogo = async () => {
                        if (!school.logo) return null;
                        try {
                            const logoBytes = await window.getFileBytes(school.logo);
                            if (school.logo.includes('image/png') || school.logo.toLowerCase().endsWith('.png')) return await pdfDoc.embedPng(logoBytes);
                            return await pdfDoc.embedJpg(logoBytes);
                        } catch (e) {
                            console.warn("Logo error", e);
                            return null;
                        }
                    };

                    const drawLogo = async (lx, ly, logoDim) => {
                        const logoImage = await prepareLogo();
                        if (logoImage) page.drawImage(logoImage, { x: lx, y: ly, width: logoDim, height: logoDim });
                    };

                    const getFitSize = (text, maxWidth, baseSize) => {
                        let sz = baseSize;
                        let textWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(text), sz * sf) : text.length * (sz * sf * 0.6);
                        while (textWidth > maxWidth && sz > 5) {
                            sz -= 0.5;
                            textWidth = mainFont ? mainFont.widthOfTextAtSize(cleanTurkishChars(text), sz * sf) : text.length * (sz * sf * 0.6);
                        }
                        return sz;
                    };

                    const drawStudentName = (x, y, w, h) => {
                        if (!info) return;
                        let nameStr = info.name.replace(/i/g, 'İ').toUpperCase();
                        let nameSz = getFitSize(nameStr, w - (15*sf), 28);
                        if (nameSz > 24) nameSz = 24;
                        drawLeftText(nameStr, x, y, w, h, nameSz, nameFont);
                        drawLeftText(nameStr, x + (0.3 * sf), y, w, h, nameSz, nameFont);
                        drawLeftText(nameStr, x + (0.6 * sf), y, w, h, nameSz, nameFont);
                    };

                    if (designType === '1') {
                        // ==========================================
                        // DESIGN 1: CLASSIC
                        // ==========================================
                        const gradTopY = iy + row3H + row2H;
                        const strips = [{ c: 0.82, h: 4*sf }, { c: 0.94, h: 4*sf }, { c: 1.0, h: row1H-(15*sf) }, { c: 0.94, h: 4*sf }, { c: 0.82, h: 3*sf }];
                        let curStripY = gradTopY;
                        for (let s of strips) { page.drawRectangle({ x: ix + leftW, y: curStripY, width: midW, height: s.h, color: rgb(s.c, s.c, s.c) }); curStripY += s.h; }
                        page.drawRectangle({ x: ix + leftW + midCol2W, y: iy, width: midCol3W, height: row3H, color: rgb(0.96, 0.96, 0.96) });
                        page.drawRectangle({ x: ix + leftW + midCol2W + midCol3W, y: iy, width: midW - (midCol2W + midCol3W), height: row3H, color: rgb(0.88, 0.88, 0.88) });

                        const lineThin = 0.5 * sf; const lineMed = 0.75 * sf; const lineThick = 1.5 * sf;
                        page.drawLine({ start: { x: ix + leftW, y: iy }, end: { x: ix + leftW, y: iy + ih }, thickness: lineMed });
                        page.drawLine({ start: { x: ix + leftW + midW, y: iy }, end: { x: ix + leftW + midW, y: iy + ih }, thickness: lineMed });

                        let curX = ix + leftW + midCol2W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: lineMed }); curX += midCol3W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: lineMed }); curX += midCol4W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: lineMed }); curX += midCol5W;
                        page.drawLine({ start: { x: curX, y: iy }, end: { x: curX, y: iy + row3H }, thickness: lineMed });
                        page.drawLine({ start: { x: ix + leftW, y: iy + row3H + row2H }, end: { x: ix + leftW + midW, y: iy + row3H + row2H }, thickness: lineMed });
                        page.drawLine({ start: { x: ix, y: iy + row3H }, end: { x: ix + leftW + midW, y: iy + row3H }, thickness: lineMed });

                        drawExplicitOppositeFrame(ox, oy, ow, oh, 6 * sf, lineThick);
                        drawExplicitOppositeFrame(ix, iy, iw, ih, 4 * sf, lineThin);

                        drawCenterText(sName, ix + leftW, iy + row3H + row2H, midW, row1H, 11, schoolFont);
                        drawCenterText(examText, ix + leftW, iy + row3H, midW, row2H, getFitSize(examText, midW - (10*sf), 14), mainFont);

                        if (info) {
                            drawCenterText(info.class, ix, iy, leftW, row3H, 16, mainFont);
                            drawCenterText(info.no, ix + leftW, iy, midCol2W, row3H, 12, mainFont);
                            drawStudentName(ix + leftW + midCol2W, iy, midCol3W, row3H);
                            page.drawText(lang.room, { x: ix + leftW + midCol2W + midCol3W + (2*sf), y: iy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            page.drawText(lang.exam, { x: ix + leftW + midCol2W + midCol3W + midCol4W + (2*sf), y: iy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            page.drawText(lang.seat, { x: ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W + (2*sf), y: iy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText(info.room, ix + leftW + midCol2W + midCol3W, iy - (2.5*sf), midCol4W, row3H, 11, mainFont);
                            drawCenterText((info.subject || '').toUpperCase(), ix + leftW + midCol2W + midCol3W + midCol4W, iy - (2.5*sf), midCol5W, row3H, 9.5, mainFont);
                            drawCenterText(info.seat, ix + leftW + midCol2W + midCol3W + midCol4W + midCol5W, iy - (2.5*sf), midCol6W, row3H, 14, mainFont);
                        }
                        page.drawText(lang.score, { x: ix + leftW + midW + (5*sf), y: iy + ih - (10*sf), size: 7*sf, font: mainFont, color: rgb(0.5, 0.5, 0.5) });
                        
                        const logoDim = 26 * sf;
                        await drawLogo(ix + (leftW - logoDim) / 2, iy + row3H + (row2H + row1H - logoDim) / 2, logoDim);

                    } else if (designType === '2') {
                        // ==========================================
                        // DESIGN 2: MODERN FRAMELESS
                        // ==========================================
                        const lineMed = 1 * sf;

                        // Modern Accent Bar on Top
                        page.drawRectangle({ x: ox, y: oy + oh - (3*sf), width: ow, height: 3*sf, color: rgb(0.3, 0.3, 0.3) });

                        // Light uniform background for the main info body
                        page.drawRectangle({ x: ox, y: oy, width: ow, height: oh - (3*sf), color: rgb(0.97, 0.97, 0.97) });

                        // Lines separating regions
                        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh - (3*sf) }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) });
                        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh - (3*sf) }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) });
                        page.drawLine({ start: { x: ox + leftW, y: oy + row3H + row2H }, end: { x: ox + leftW + midW, y: oy + row3H + row2H }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) });
                        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) });

                        // Row 3 inner dividers
                        let curX = ox + leftW + midCol2W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) }); curX += midCol3W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) }); curX += midCol4W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) }); curX += midCol5W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineMed, color: rgb(0.8, 0.8, 0.8) });

                        // Text
                        drawCenterText(sName, ox + leftW, oy + row3H + row2H, midW, row1H, 12, schoolFont);
                        drawCenterText(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW - (10*sf), 15), mainFont);

                        if (info) {
                            drawCenterText(lang.class, ox, oy + row3H - (8*sf), leftW, 8*sf, 6, mainFont);
                            drawCenterText(info.class, ox, oy - (2*sf), leftW, row3H, 16, mainFont);
                            
                            drawCenterText(lang.no, ox + leftW, oy + row3H - (8*sf), midCol2W, 8*sf, 6, mainFont);
                            drawCenterText(info.no, ox + leftW, oy - (2*sf), midCol2W, row3H, 12, mainFont);

                            drawStudentName(ox + leftW + midCol2W, oy, midCol3W, row3H);

                            page.drawText(lang.room, { x: ox + leftW + midCol2W + midCol3W + (2*sf), y: oy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText(info.room, ox + leftW + midCol2W + midCol3W, oy - (2.5*sf), midCol4W, row3H, 11, mainFont);
                            
                            page.drawText(lang.exam, { x: ox + leftW + midCol2W + midCol3W + midCol4W + (2*sf), y: oy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText((info.subject || '').toUpperCase(), ox + leftW + midCol2W + midCol3W + midCol4W, oy - (2.5*sf), midCol5W, row3H, 9.5, mainFont);
                            
                            page.drawText(lang.seat, { x: ox + leftW + midCol2W + midCol3W + midCol4W + midCol5W + (2*sf), y: oy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText(info.seat, ox + leftW + midCol2W + midCol3W + midCol4W + midCol5W, oy - (2.5*sf), midCol6W, row3H, 14, mainFont);
                        }

                        page.drawText(lang.score, { x: ox + leftW + midW + (5*sf), y: oy + oh - (12*sf), size: 7*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });

                        const logoDim = 28 * sf;
                        await drawLogo(ox + (leftW - logoDim) / 2, oy + row3H + (row2H + row1H - logoDim) / 2, logoDim);

                    } else if (designType === '3') {
                        // ==========================================
                        // DESIGN 3: DARK ACCENT ELEGANT
                        // ==========================================
                        const lineThick = 1 * sf;
                        const accentColor = rgb(0.12, 0.12, 0.12);
                        const lightGray = rgb(0.9, 0.9, 0.9);

                        // Outer Frame
                        drawExplicitOppositeFrame(ox, oy, ow, oh, 0, lineThick);

                        // Row 1 & 2 Background (Dark)
                        page.drawRectangle({ x: ox + leftW, y: oy + row3H, width: midW, height: row1H + row2H, color: accentColor });
                        
                        // Seat info background
                        const rightColX = ox + leftW + midCol2W + midCol3W;
                        page.drawRectangle({ x: rightColX, y: oy, width: ow - rightColX, height: row3H, color: rgb(0.94, 0.94, 0.94) });

                        // Vertical bounds
                        page.drawLine({ start: { x: ox + leftW, y: oy }, end: { x: ox + leftW, y: oy + oh }, thickness: lineThick });
                        page.drawLine({ start: { x: ox + leftW + midW, y: oy }, end: { x: ox + leftW + midW, y: oy + oh }, thickness: lineThick });
                        
                        // Row 3 inner dividers
                        let curX = ox + leftW + midCol2W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineThick }); curX += midCol3W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineThick }); curX += midCol4W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineThick }); curX += midCol5W;
                        page.drawLine({ start: { x: curX, y: oy }, end: { x: curX, y: oy + row3H }, thickness: lineThick });

                        // Horizontal
                        page.drawLine({ start: { x: ox, y: oy + row3H }, end: { x: ox + leftW + midW, y: oy + row3H }, thickness: lineThick });
                        page.drawLine({ start: { x: ox + leftW, y: oy + row3H + row2H }, end: { x: ox + leftW + midW, y: oy + row3H + row2H }, thickness: 0.5 * sf, color: rgb(0.6, 0.6, 0.6) });

                        // Text drawing custom funcs for white text
                        const drawCenterTextWhite = (str, cx, cy, cw, ch, sz, fnt) => {
                            const s_sz = sz * sf; if (!str) return; const cl = cleanTurkishChars(str).toString();
                            const tw = fnt ? fnt.widthOfTextAtSize(cl, s_sz) : cl.length * (s_sz * 0.6);
                            page.drawText(cl, { x: cx + Math.max(0, (cw - tw) / 2), y: cy + (ch / 2) - (s_sz * 0.35), size: s_sz, font: fnt || undefined, color: rgb(1, 1, 1) });
                        };

                        drawCenterTextWhite(sName, ox + leftW, oy + row3H + row2H, midW, row1H, 11, schoolFont);
                        drawCenterTextWhite(examText, ox + leftW, oy + row3H, midW, row2H, getFitSize(examText, midW - (10*sf), 14), mainFont);

                        if (info) {
                            page.drawText(lang.class, { x: ox + leftW/2 - (10*sf), y: oy + row3H - (8*sf), size: 6*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText(info.class, ox, oy - (2*sf), leftW, row3H, 16, mainFont);
                            
                            drawCenterText(lang.no, ox + leftW, oy + row3H - (8*sf), midCol2W, 8*sf, 6, mainFont);
                            drawCenterText(info.no, ox + leftW, oy - (2*sf), midCol2W, row3H, 12, mainFont);

                            drawStudentName(ox + leftW + midCol2W, oy, midCol3W, row3H);

                            page.drawText(lang.room, { x: ox + leftW + midCol2W + midCol3W + (2*sf), y: oy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText(info.room, ox + leftW + midCol2W + midCol3W, oy - (2.5*sf), midCol4W, row3H, 11, mainFont);
                            
                            page.drawText(lang.exam, { x: ox + leftW + midCol2W + midCol3W + midCol4W + (2*sf), y: oy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText((info.subject || '').toUpperCase(), ox + leftW + midCol2W + midCol3W + midCol4W, oy - (2.5*sf), midCol5W, row3H, 9.5, mainFont);
                            
                            page.drawText(lang.seat, { x: ox + leftW + midCol2W + midCol3W + midCol4W + midCol5W + (2*sf), y: oy + row3H - (6.5*sf), size: 5.5*sf, font: mainFont, color: rgb(0.4, 0.4, 0.4) });
                            drawCenterText(info.seat, ox + leftW + midCol2W + midCol3W + midCol4W + midCol5W, oy - (2.5*sf), midCol6W, row3H, 14, mainFont);
                        }

                        // PUAN box using accent color
                        page.drawRectangle({ x: ox + leftW + midW, y: oy + row3H, width: ow - leftW - midW, height: row1H + row2H, color: accentColor });
                        page.drawText(lang.score, { x: ox + leftW + midW + (3*sf), y: oy + oh - (10*sf), size: 7*sf, font: mainFont, color: lightGray });

                        const logoDim = 28 * sf;
                        await drawLogo(ox + (leftW - logoDim) / 2, oy + row3H + (row2H + row1H - logoDim) / 2, logoDim);
                    }
                }
            `;

content = content.replace(regex, newDrawingLogic);

fs.writeFileSync(uiJsPath, content, 'utf8');
console.log('Update complete via regex');
