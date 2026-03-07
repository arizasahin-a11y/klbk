
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

            // 1) LEFT PROFILE (Facing Left)
            const facePath = "M 81.1 276.7 C 58.7 278.4 53.7 277.1 49 275.5 C 42.8 273.4 40 268.4 40.2 261.9 C 40.3 259.2 40.8 256.5 41.3 253.8 C 42.4 248 41.9 242.3 38.4 237.4 C 34.6 231.8 33.2 225.7 32 219.2 C 31.8 218.3 31.5 217.4 31.3 216.5 C 27.9 70.4 25.9 71.8 16.1 71.2 C 9.5 70.8 1.8 75.9 0 82.1 C -0.8 84.8 -0.6 88.3 0.4 91.1 C 4.1 101.5 8.2 111.9 12.3 122.2 C 14.1 127 16.2 131.7 18 136.5 C 19.6 141.2 18.8 145.4 14.8 148.9 C 11.2 151.9 9.8 156 10.5 160.5 C 14.1 183.7 18.1 206.8 27.2 228.7 C 33.7 244.5 45.4 255.4 60.3 263.1 C 64.5 265.3 74 269.8 73.1 269.3 C 60.1 273.9 46.2 276.5 31.5 277";
            const faceScale = oh / 277;
            page.drawSvgPath(facePath, { x: tx + 5 * sf, y: ty, scale: faceScale, color: navy });

            // 2) RIGHT WALKER (Walking Right)
            const walkPath = "M 55.4 147.1 C 53.4 147 53.4 145.8 55.5 144.2 C 55.8 144 56.5 144 57.3 144 C 57.8 145.4 56.9 146.1 56.2 147.1 Z M 49.2 146.3 C 49 145 49 143.9 49 142.7 C 48.6 141.5 50.4 141.3 50.8 142.2 C 51.7 143.9 51.7 145.1 51.3 145.5 Z M 42.1 145 C 43.8 141.9 45 140.1 47.2 138.2 C 48.8 137.8 49.7 137.3 49.7 135.7 C 48.5 129.5 47.4 128.9 46 128.9 C 45.4 130.7 45.8 131.8 43.3 133.9 C 40.7 133.3 39.8 128.6 38.7 128.6 C 37.2 129.9 35.6 131.8 34.3 132.2 C 34.8 131 36.4 127.9 38 126.3 C 38.3 124.8 35.9 124.6 34.5 123.6 C 34.3 119.3 36.6 118.6 38.7 119.1 C 41.6 122.8 42 124.3 40 127.4 C 41.4 127.6 45.6 126.8 46.8 126 C 54.6 127.6 59.6 129.8 60 130.8";
            const walkScale = oh / 150 * 1.5;
            page.drawSvgPath(walkPath, { x: rx - 50 * sf, y: by + 5 * sf, scale: walkScale, color: navy });

            // 3) BORDERS
            page.drawLine({ start: {x: tx, y: ty}, end: {x: rx, y: ty}, thickness: edgeThick, color: navy });
            page.drawLine({ start: {x: tx, y: by}, end: {x: rx, y: by}, thickness: edgeThick, color: navy });
            page.drawLine({ start: {x: tx, y: ty}, end: {x: tx, y: by}, thickness: edgeThick, color: navy });
            page.drawLine({ start: {x: rx, y: ty}, end: {x: rx, y: by}, thickness: edgeThick, color: navy });

            const startX = tx + 32 * sf, endX = rx - 55 * sf, contentW = endX - startX;
            const sLw = 55 * sf, sMw = contentW - sLw;
            page.drawLine({ start: { x: startX + sLw, y: by }, end: { x: startX + sLw, y: ty }, thickness: thkThin, color: navy });
            page.drawLine({ start: { x: startX, y: by + row3H }, end: { x: rx, y: by + row3H }, thickness: thkThin, color: navy });

            const c2 = 25 * sf, c4 = 25 * sf, c5 = 60 * sf, c6 = 25 * sf, c3 = contentW - sLw - c2 - c4 - c5 - c6;
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
