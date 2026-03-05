const fs = require('fs');
const path = require('path');

const htmlPath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'ogretmen.html');
const logicPath = path.join('a:', 'TOOLS', 'kodlama', 'km', 'KLBK FRVR', 'print_logic.js');

let html = fs.readFileSync(htmlPath, 'utf8');
const logicContent = fs.readFileSync(logicPath, 'utf8');

// 1. Remove the YAZDIR button from the header
const printToolsHeaderRegex = /<div class="print-tools" style="display: flex; align-items: center; gap: 8px;" onclick="event\.stopPropagation\(\)">[\s\S]*?<\/div>/;
html = html.replace(printToolsHeaderRegex, '');

// 2. Inject printModesHtml into details-panel loop
const detailsPanelEndStr = `                        }
                        html += \`   </div></div>\`;
                    });
                    html += \`</div></div>\`;
                });`;

const replacementDetails = `                        }
                        html += \`   </div></div>\`;
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

html = html.replace(detailsPanelEndStr, replacementDetails);


// 3. Replace the actual printSession functions
const scriptStartIdx = html.indexOf('window.printSession = async function (id) {');
const scriptEndIdx = html.lastIndexOf('        };'); // Find end of executePrintSession
const scriptEndFullIdx = html.indexOf('</script>', scriptEndIdx);

if (scriptStartIdx !== -1 && scriptEndIdx !== -1) {
    const beforeBlock = html.substring(0, scriptStartIdx);
    const afterBlock = html.substring(scriptEndFullIdx);

    // logicContent is just the raw text of the replacement functions
    html = beforeBlock + logicContent + '\\n    ' + afterBlock;

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log("Injection complete!");
} else {
    console.error("COULD NOT FIND FUNCTION BLOCK");
}
