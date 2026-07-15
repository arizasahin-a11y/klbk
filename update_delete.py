import re
import os

filepath = r'a:\TOOLS\kodlama\km\KLBK FRVR\yoklama_ogretmen.html'

with open(filepath, 'r', encoding='windows-1254') as f:
    content = f.read()

# Replace Header
header_search = r'<h3 style="font-weight: 800; font-size: 1\.25rem; margin-bottom: 1\.5rem; color: var\(--dark\); display: flex; align-items: center; gap: 8px;">\s*<i class="fa-solid fa-clock-rotate-left"></i> Aldığınız Yoklamalar \(Son 14 Gün\)\s*</h3>'

header_replace = """<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 10px;">
                    <h3 style="font-weight: 800; font-size: 1.25rem; margin: 0; color: var(--dark); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-clock-rotate-left"></i> Aldığınız Yoklamalar (Son 14 Gün)
                    </h3>
                    <button class="btn btn-secondary" style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600;" onclick="promptDeleteAllRecords()">
                        <i class="fa-solid fa-trash-can"></i> Tüm Yoklamaları Sil
                    </button>
                </div>"""

# Ensure header match
if re.search(header_search, content):
    content = re.sub(header_search, header_replace, content)
    print("Header replaced.")
else:
    print("Header not found! Please check the regex.")


# Replace deletePastAttendance and inject promptDeleteAllRecords
# We can find the function signature and replace up to `.then(async (result) => {`
delete_search = r"""Swal\.fire\(\{\s*title: 'Emin misiniz\?',\s*text: `\$\{date\} tarihli \$\{hour\}\. ders \$\{className\} sınıfı yoklaması kalıcı olarak silinecek!`,\s*icon: 'warning',\s*showCancelButton: true,\s*confirmButtonColor: '#ef4444',\s*cancelButtonColor: '#6b7280',\s*confirmButtonText: 'Evet, Sil',\s*cancelButtonText: 'İptal'\s*\}\)"""

delete_replace = """Swal.fire({
                title: 'Onay ve Şifre',
                text: `${date} tarihli ${hour}. ders ${className} sınıfı yoklaması kalıcı olarak silinecek! Lütfen şifrenizi girin.`,
                icon: 'warning',
                input: 'password',
                inputPlaceholder: 'Şifrenizi girin',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'İptal',
                preConfirm: (password) => {
                    if (password !== '1234') {
                        Swal.showValidationMessage('Hatalı şifre girdiniz!');
                        return false;
                    }
                    return true;
                }
            })"""

if re.search(delete_search, content):
    content = re.sub(delete_search, delete_replace, content)
    print("Delete Swal replaced.")
else:
    print("Delete Swal not found!")

# Now add promptDeleteAllRecords function after deletePastAttendance
add_all_records_fn = """

        function promptDeleteAllRecords() {
            Swal.fire({
                title: 'Tüm Yoklamaları Sil',
                text: 'Son 14 gündeki tüm yoklama kayıtlarınız kalıcı olarak silinecek! Lütfen şifrenizi girin.',
                icon: 'warning',
                input: 'password',
                inputPlaceholder: 'Şifrenizi girin',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Hepsini Sil',
                cancelButtonText: 'İptal',
                preConfirm: (password) => {
                    if (password !== '1234') {
                        Swal.showValidationMessage('Hatalı şifre girdiniz!');
                        return false;
                    }
                    return true;
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const dbData = DataManager._getData();
                        if (dbData.attendance) {
                            let deletedCount = 0;
                            const minDateObj = getTRTime();
                            minDateObj.setDate(getTRTime().getDate() - 14);
                            const min_yyyy = minDateObj.getFullYear();
                            const min_mm = String(minDateObj.getMonth() + 1).padStart(2, '0');
                            const min_dd = String(minDateObj.getDate()).padStart(2, '0');
                            const minDateStr = `${min_yyyy}-${min_mm}-${min_dd}`;

                            for (let date in dbData.attendance) {
                                if (date < minDateStr) continue;
                                for (let hour in dbData.attendance[date]) {
                                    for (let cls in dbData.attendance[date][hour]) {
                                        const record = dbData.attendance[date][hour][cls];
                                        if (record.teacher === activeTeacherUsername) {
                                            delete dbData.attendance[date][hour][cls];
                                            deletedCount++;
                                        }
                                    }
                                    if (Object.keys(dbData.attendance[date][hour]).length === 0) delete dbData.attendance[date][hour];
                                }
                                if (Object.keys(dbData.attendance[date]).length === 0) delete dbData.attendance[date];
                            }
                            
                            if (deletedCount > 0) {
                                await DataManager._saveData(dbData);
                                Swal.fire({
                                    icon: 'success',
                                    title: 'Silindi!',
                                    text: `${deletedCount} adet yoklama kaydı başarıyla silindi.`,
                                    timer: 1500,
                                    showConfirmButton: false
                                });
                                loadHistory();
                            } else {
                                Swal.fire('Bilgi', 'Silinecek size ait bir yoklama bulunamadı.', 'info');
                            }
                        }
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Hata', 'Tüm yoklamalar silinirken bir hata oluştu.', 'error');
                    }
                }
            });
        }
"""

if "function promptDeleteAllRecords" not in content:
    # insert before function editPastAttendance
    content = content.replace("function editPastAttendance(date, hour, className) {", add_all_records_fn + "\n        function editPastAttendance(date, hour, className) {")
    print("promptDeleteAllRecords function injected.")

with open(filepath, 'w', encoding='windows-1254') as f:
    f.write(content)
print("File updated and saved.")
