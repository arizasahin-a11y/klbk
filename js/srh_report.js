// srh_report.js

const urlParams = new URLSearchParams(window.location.search);
const appId = urlParams.get('appId');

const FIREBASE_DB_URL_SRH = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
let appData = null;
let studentsData = null;
let answersData = null;

async function initReport() {
    if (!appId) {
        Swal.fire('Hata', 'Uygulama ID bulunamadı.', 'error');
        return;
    }

    try {
        await DataManager.initCloud();
        
        const token = DataManager._getAuthToken ? DataManager._getAuthToken() : '';
        const authQuery = token ? `&auth=${token}` : '';

        // 1. Uygulamanın verisini çek
        const appRes = await fetch(`${FIREBASE_DB_URL_SRH}/app_store/srh_data/${appId}.json?_=` + Date.now() + authQuery);
        appData = await appRes.json();

        if (!appData) throw new Error("Uygulama verisi bulunamadı.");
        
        document.getElementById('toolbarTitle').innerText = appData.name || "Risk Haritası Raporu";

        // 2. Öğrencileri çek
        let students = DataManager.getStudents ? DataManager.getStudents() : null;
        if (!students || students.length === 0) {
            const sRes = await fetch(`${FIREBASE_DB_URL_SRH}/school/students.json?_=` + Date.now() + authQuery);
            const sData = await sRes.json();
            students = Array.isArray(sData) ? sData : Object.values(sData || {});
        }
        studentsData = students;

        // 3. Öğrenci cevaplarını çek
        const ansRes = await fetch(`${FIREBASE_DB_URL_SRH}/app_store/srh_answers/${appId}.json?_=` + Date.now() + authQuery);
        answersData = await ansRes.json() || {};

        generateReport();

    } catch (err) {
        console.error(err);
        document.getElementById('reportContainer').innerHTML = `<div style="color:red; margin-top:50px;">Hata: ${err.message} <br><br> Lütfen Admin hesabıyla giriş yaptığınızdan emin olun.</div>`;
    }
}

function generateReport() {
    const container = document.getElementById('reportContainer');
    container.innerHTML = ''; 

    // Sınıflara göre grupla
    const classGroups = {};
    studentsData.forEach(s => {
        const cls = (s.class || s.sinif || '').trim();
        if (!cls) return;
        if (!classGroups[cls]) classGroups[cls] = [];
        classGroups[cls].push(s);
    });

    const sortedClasses = Object.keys(classGroups).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

    if (sortedClasses.length === 0) {
        container.innerHTML = 'Gösterilecek öğrenci verisi bulunamadı.';
        return;
    }

    const questions = appData.questions || [];

    sortedClasses.forEach(cls => {
        // Öğrencileri listele (Cevap veren/vermeyen hepsi)
        const classStudents = classGroups[cls].sort((a,b) => parseInt(a.no) - parseInt(b.no));

        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        
        const title = document.createElement('h3');
        title.className = 'class-title';
        title.innerText = `${cls} SINIFI RİSK HARİTASI`;
        pageDiv.appendChild(title);

        const table = document.createElement('table');
        
        // -- HEADER --
        const thead = document.createElement('thead');
        
        let numRowHtml = `<tr class="num-row"><th></th><th></th><th></th>`;
        questions.forEach((q, i) => {
            numRowHtml += `<th>${i+1}</th>`;
        });
        numRowHtml += `</tr>`;
        
        let headerRowHtml = `
            <tr class="header-row">
                <th style="vertical-align: middle;">SIRA</th>
                <th style="vertical-align: middle;">OKUL NUMARASI</th>
                <th style="vertical-align: middle;">ADI SOYADI</th>
        `;
        questions.forEach(q => {
            headerRowHtml += `<th><span class="vertical-text" title="${q.text}">${q.text}</span></th>`;
        });
        headerRowHtml += `</tr>`;

        thead.innerHTML = numRowHtml + headerRowHtml;
        table.appendChild(thead);

        // -- BODY --
        const tbody = document.createElement('tbody');
        const colTotals = new Array(questions.length).fill(0);

        classStudents.forEach((s, index) => {
            const tr = document.createElement('tr');
            const no = String(s.no || s.number || '');
            const ansObj = answersData[no] ? answersData[no].answers : null;
            const isFilled = !!ansObj;

            let fullName = `${s.name || ''} ${s.surname || ''}`.trim();
            const nameParts = fullName.split(/\s+/);
            if (nameParts.length > 2) {
                const first = nameParts[0];
                const last = nameParts[nameParts.length - 1];
                let middle = '';
                for (let i = 1; i < nameParts.length - 1; i++) {
                    middle += nameParts[i].charAt(0).toUpperCase() + '. ';
                }
                fullName = `${first} ${middle}${last}`;
            }
            
            let rowHtml = `
                <td class="center">${index + 1}</td>
                <td class="center">${no}</td>
                <td>${fullName}</td>
            `;

            questions.forEach((q, qIndex) => {
                let cellVal = '';
                if (isFilled && ansObj) {
                    const ans = ansObj.find(a => a.questionIndex === qIndex);
                    if (ans) {
                        if (ans.answer === true) { 
                            cellVal = 'X';
                            colTotals[qIndex]++;
                        } else if (ans.answer === 'X' || (typeof ans.answer === 'string' && ans.answer.toUpperCase() === 'X')) { 
                            cellVal = 'X';
                            colTotals[qIndex]++;
                        } else if (ans.answer && ans.answer !== false) {
                            cellVal = ans.answer; 
                            // tik atma harici diğer tipteki cevaplar yazılır ancak toplanmaz
                            if (appData.type === 'tik_atma') colTotals[qIndex]++;
                        }
                    }
                }
                
                rowHtml += `<td class="center">${cellVal}</td>`;
            });

            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });

        // -- FOOTER (TOPLAM) --
        const tfoot = document.createElement('tfoot');
        let footerHtml = `
            <tr class="total-row">
                <td colspan="3" style="text-align: right; padding-right: 10px;">TOPLAM</td>
        `;
        questions.forEach((q, i) => {
            const t = colTotals[i];
            footerHtml += `<td class="total-val">${t > 0 ? t : ''}</td>`;
        });
        footerHtml += `</tr>`;
        tfoot.innerHTML = footerHtml;

        table.appendChild(tbody);
        table.appendChild(tfoot);
        
        pageDiv.appendChild(table);
        container.appendChild(pageDiv);
    });
}

function exportToExcel() {
    try {
        const wb = XLSX.utils.book_new();
        const pages = document.querySelectorAll('.page');
        
        if (pages.length === 0) {
            Swal.fire('Uyarı', 'Dışa aktarılacak veri yok.', 'warning');
            return;
        }

        pages.forEach(page => {
            const clsTitle = page.querySelector('.class-title').innerText.replace(' RİSK HARİTASI', '').trim();
            const table = page.querySelector('table');
            const ws = XLSX.utils.table_to_sheet(table);
            
            const wscols = [
                {wpx: 40}, 
                {wpx: 80}, 
                {wpx: 150}, 
            ];
            const qCount = table.rows[0].cells.length - 3;
            for(let i=0; i<qCount; i++) wscols.push({wpx: 30});
            ws['!cols'] = wscols;

            let safeSheetName = clsTitle.replace(/[\[\]\*\?\:\/\\]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        });

        let safeName = (appData.name || 'Rapor').replace(/[^a-z0-9ğüşöçİĞÜŞÖÇ]/gi, '_');
        XLSX.writeFile(wb, `${safeName}.xlsx`);
    } catch (err) {
        console.error(err);
        Swal.fire('Hata', 'Excel oluşturulurken bir sorun oluştu.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', initReport);
