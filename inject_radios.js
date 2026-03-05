const fs = require('fs');
const path = require('path');

const htmlPath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'ogretmen.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// The block we missed was after the subjectsObj.forEach loop.
// Let's find: html += `   </div></div>`; \n                    }); \n                    html += `</div></div>`; \n                });

const searchPattern = /html \+= `   <\/div><\/div>`;\s*\}\);\s*html \+= `<\/div><\/div>`;\s*\}\);/g;

const printModesInjection = `html += \`   </div></div>\`;
                    });

                    const printModesHtml = \\\`
                        <div class="print-tools" style="margin-top: 20px; padding: 20px; background: white; border-radius: 12px; border: 1px solid var(--gray-200); box-shadow: var(--shadow-sm);">
                            <h5 style="margin-top: 0; margin-bottom: 15px; color: var(--primary); font-weight: 800; font-size: 0.9rem;"><i class="fa-solid fa-print"></i> Yazdırma Seçenekleri</h5>
                            <div style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 600; color: var(--gray-700);">
                                    <input type="radio" name="printMode-\\\${ses.id}" value="class" style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);">
                                    Sınıf Listesi
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 600; color: var(--gray-700);">
                                    <input type="radio" name="printMode-\\\${ses.id}" value="room" checked style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);">
                                    Salon Listesi
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 600; color: var(--gray-700);">
                                    <input type="radio" name="printMode-\\\${ses.id}" value="seating" style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);">
                                    Oturma Şeması
                                </label>
                                <button class="btn btn-primary" style="margin-left: auto; padding: 0.6rem 1.5rem; font-weight: 800; border-radius: 8px;" onclick="printSession('\\\${ses.id}')">
                                    <i class="fa-solid fa-print"></i> YAZDIR
                                </button>
                            </div>
                        </div>
                    \\\`;
                    html += printModesHtml;

                    html += \`</div></div>\`;
                });`;

if (searchPattern.test(html)) {
    html = html.replace(searchPattern, printModesInjection);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log("Radio buttons injected successfully.");
} else {
    console.error("Could not find the target HTML loop boundary.");
}
