const fs = require('fs');
const path = require('path');

const filePath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'ogretmen.html');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `            const abbr = (n) => {
                if (!n || n === '-') return n;
                return n.replace(/Matematik/gi, 'Mat.').replace(/Edebiyat/gi, 'Edb.').replace(/İngilizce/gi, 'İng.').replace(/Fizik/gi, 'Fiz.').replace(/Kimya/gi, 'Kim.').replace(/Biyoloji/gi, 'Biyo.').replace(/Tarih/gi, 'Tar.').replace(/Coğrafya/gi, 'Coğ.').replace(/Felsefe/gi, 'Fel.').replace(/Din Kültürü/gi, 'Din.').replace(/Almanca/gi, 'Alm.').replace(/Görsel Sanatlar/gi, 'Grs.').replace(/Müzik/gi, 'Müz.').replace(/Beden Eğitimi/gi, 'Bed.').replace(/Bilişim/gi, 'Biliş.');
            };`;

const startIdx = content.indexOf(targetStr);
const endIdx = content.lastIndexOf('        };');

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const before = content.substring(0, startIdx);
    // Include the actual script end that we are preserving
    const after = content.substring(endIdx + '        };'.length);

    fs.writeFileSync(filePath, before + after, 'utf8');
    console.log("Cleanup successful");
} else {
    console.log("Could not find the bounds to clean up");
}
