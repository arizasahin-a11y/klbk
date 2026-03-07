
const fs = require('fs');
const path = 'a:/TOOLS/kodlama/km/KLBK FRVR/js/ui.js';
let content = fs.readFileSync(path, 'utf8');

const startMarker = "        } else if (designType === '9') {";
const endMarker = "        } else if (designType === '10') {";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

const newBlock = `        } else if (designType === '9') {
            const navy = rgb(0.1, 0.15, 0.25);
            page.drawRectangle({ x: ox, y: oy, width: ow, height: oh, color: rgb(0.99, 0.99, 1) });
            const tx = ox, rx = ox + ow, ty = oy + oh, by = oy;
            const thkThin = 0.5 * sf, edgeThick = 1 * sf;

            // 1) LEFT PROFILE (Refined Line Art)
            const facePath = "M 0 270 L 10 270 C 15 270 20 265 22 255 C 25 240 22 230 18 220 C 15 210 12 200 12 180 C 12 160 15 140 25 120 C 35 100 50 85 70 75 C 90 65 110 60 130 65 C 150 70 170 85 180 105 C 190 125 185 150 170 170 C 155 190 130 205 100 210 C 70 215 40 212 20 205 L 10 205 L 0 205 Z"; 
            const faceScale = oh / 280;
            page.drawSvgPath(facePath, { x: tx + 1 * sf, y: ty, scale: faceScale, color: navy });

            // 2) KOCATEPE WALKER (Refined Line Art)
            const walkPath = "M 50 150 L 60 150 C 65 145 68 135 65 125 C 62 115 55 105 45 100 C 35 95 25 98 18 105 C 11 112 8 125 12 135 C 16 145 25 150 35 150 L 50 150 Z";
            const walkScale = oh / 160 * 1.5;
            page.drawSvgPath(walkPath, { x: rx - 30 * sf, y: by + 2 * sf, scale: walkScale, color: navy });

            // 3) BORDERS
            page.drawLine({ start: {x: tx, y: ty}, end: {x: rx, y: ty}, thickness: edgeThick, color: navy });
            page.drawLine({ start: {x: tx, y: by}, end: {x: rx, y: by}, thickness: edgeThick, color: navy });
            page.drawLine({ start: {x: tx, y: ty}, end: {x: tx, y: by}, thickness: edgeThick, color: navy });
            page.drawLine({ start: {x: rx, y: ty}, end: {x: rx, y: by}, thickness: edgeThick, color: navy });

            const startX = tx + 20 * sf, endX = rx - 35 * sf, contentW = endX - startX;
            const sLw = 40 * sf, sMw = contentW - sLw;
            page.drawLine({ start: { x: startX + sLw, y: by }, end: { x: startX + sLw, y: ty }, thickness: thkThin, color: navy });
            page.drawLine({ start: { x: startX, y: by + row3H }, end: { x: rx, y: by + row3H }, thickness: thkThin, color: navy });

            const c2 = 40 * sf, c4 = 25 * sf, c5 = 60 * sf, c6 = 25 * sf, c3 = contentW - sLw - c2 - c4 - c5 - c6;
            const dInner = (bx, b1, b2, b3, b4, b5) => {
                let x = bx + b1; page.drawLine({ start:{x,y:by}, end:{x,y:by+row3H}, thickness:thkThin, color:navy });
                x += b2; page.drawLine({ start:{x,y:by}, end:{x,y:by+row3H}, thickness:thkThin, color:navy });
                x += b3; page.drawLine({ start:{x,y:by}, end:{x,y:by+row3H}, thickness:thkThin, color:navy });
                x += b4; page.drawLine({ start:{x,y:by}, end:{x,y:by+row3H}, thickness:thkThin, color:navy });
                x += b5; page.drawLine({ start:{x,y:by}, end:{x,y:by+row3H}, thickness:thkThin, color:navy });
            };
            dInner(startX, sLw, c2, c3, c4, c5);

            drawCenterText(sName.toUpperCase(), startX + sLw, by + row3H + row2H, sMw, row1H, getFitSize(sName.toUpperCase(), sMw, 11, schoolFont), schoolFont);
            drawCenterText(examText, startX + sLw, by + row3H, sMw, row2H, getFitSize(examText, sMw, 14), mainFont);
            if(info) {
                drawCenterText(lang.class, startX, by + row3H - 8*sf, sLw, 8*sf, 6, mainFont);
                drawCenterText(info.class||'', startX, by - 2*sf, sLw, row3H, 16, mainFont);
                drawCenterText(lang.no, startX+sLw, by + row3H - 8*sf, c2, 8*sf, 6, mainFont);
                drawCenterText(info.no||'', startX+sLw, by - 2*sf, c2, row3H, 12, mainFont);
                drawStudentName(startX+sLw+c2, by, c3, row3H);
                page.drawText(lang.room, { x: startX+sLw+c2+c3+2*sf, y: by+row3H-6.5*sf, size: 5.5*sf, font: mainFont, color: rgb(0.4,0.4,0.4) });
                drawCenterText(info.room||'', startX+sLw+c2+c3, by-2.5*sf, c4, row3H, 11, mainFont);
                page.drawText(lang.exam, { x: startX+sLw+c2+c3+c4+2*sf, y: by+row3H-6.5*sf, size: 5.5*sf, font: mainFont, color: rgb(0.4,0.4,0.4) });
                drawCenterText((info.subject||'').toUpperCase(), startX+sLw+c2+c3+c4, by-2.5*sf, c5, row3H, 9.5, mainFont);
                page.drawText(lang.seat, { x: startX+sLw+c2+c3+c4+c5+2*sf, y: by+row3H-6.5*sf, size: 5.5*sf, font: mainFont, color: rgb(0.4,0.4,0.4) });
                drawCenterText(info.seat||'', startX+sLw+c2+c3+c4+c5, by-2.5*sf, c6, row3H, 14, mainFont);
            }
            page.drawText(lang.score, { x: rx - 50 * sf, y: ty - 10 * sf, size: 8 * sf, font: mainFont, color: navy });
            await drawLogo(startX + (sLw - 28 * sf) / 2, by + row3H + (row2H + row1H - 28 * sf) / 2, 28 * sf);
`;

const updatedContent = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
fs.writeFileSync(path, updatedContent);
console.log("Successfully updated Atatürk theme block with verified high-precision silhouettes");
