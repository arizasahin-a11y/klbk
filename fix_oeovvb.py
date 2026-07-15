import sys

def main():
    with open('oeovvb.html', 'r', encoding='utf-8') as f:
        content = f.read()

    old_login_ui = """            <!-- Step 1: Okul No -->
            <div id="loginStep1">
                <div class="form-group">
                    <label class="form-label">Öğrenci Okul No</label>
                    <input type="number" id="studentNoInput" class="form-control" placeholder="Örn: 1234">
                </div>
                <button class="btn btn-primary" onclick="handleStep1()">
                    İleri <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>

            <!-- Step 2: Veli Telefon -->
            <div id="loginStep2" class="hidden">
                <div style="background: var(--gray-100); padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9rem;">
                    <b>Öğrenci:</b> <span id="verifyStudentName"></span>
                </div>
                
                <div id="phoneExistUI" class="hidden">
                    <div class="form-group">
                        <label class="form-label">Veli Telefonunun Son 6 Rakamı</label>
                        <input type="number" id="phoneVerifyInput" class="form-control" placeholder="Örn: 123456" maxlength="6">
                    </div>
                </div>

                <div id="phoneNewUI" class="hidden">
                    <div class="alert alert-warning mb-4" style="background: #fffbeb; color: #b45309; padding: 1rem; border-radius: 8px; font-size: 0.9rem; text-align: left;">
                        <i class="fa-solid fa-circle-info"></i> Sistemde veli telefon numaranız kayıtlı değil. Lütfen güvenlik ve bilgilendirme için numaranızı sisteme kaydedin.
                    </div>
                    <div class="form-group">
                        <label class="form-label">Veli Telefon Numarası (10 Hane)</label>
                        <input type="number" id="phoneNewInput" class="form-control" placeholder="Örn: 5551234567" maxlength="10">
                        <small style="color: var(--gray-700); margin-top: 5px; display: block;">Başında sıfır olmadan giriniz.</small>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline" style="flex: 1;" onclick="goBackToStep1()">
                        Geri
                    </button>
                    <button class="btn btn-primary" style="flex: 2;" onclick="handleStep2()">
                        Giriş Yap <i class="fa-solid fa-check"></i>
                    </button>
                </div>
            </div>"""

    new_login_ui = """            <!-- Unified Login Step -->
            <div id="loginStep1">
                <div class="form-group">
                    <label class="form-label">Öğrenci Okul No</label>
                    <input type="number" id="studentNoInput" class="form-control" placeholder="Örn: 1234">
                </div>
                <div class="form-group">
                    <label class="form-label">Veli Telefonunun Son 6 Rakamı</label>
                    <input type="number" id="phoneVerifyInput" class="form-control" placeholder="Örn: 123456" maxlength="6">
                </div>
                <button class="btn btn-primary" onclick="handleLogin()" style="width: 100%; margin-top: 10px;">
                    Giriş Yap <i class="fa-solid fa-check"></i>
                </button>
            </div>"""

    content = content.replace(old_login_ui, new_login_ui)

    storage_key_block = """        // Initialize DataManager with ?school=XYZ parameter
        DataManager._getStorageKey = function () {
            const urlParams = new URLSearchParams(window.location.search);
            const q = urlParams.get('school');
            
            if (q) {
                localStorage.setItem('klbk_last_school', q);
                return `klbk_data_${q}`;
            }

            const lastSchool = localStorage.getItem('klbk_last_school');
            if (lastSchool) return `klbk_data_${lastSchool}`;

            return `klbk_data_admin`;
        };"""

    content = content.replace(storage_key_block, '')

    old_onload = """                if (schoolData && schoolData.name) {
                    document.getElementById('schoolNameDisplay').innerText = schoolData.name;
                    document.title = schoolData.name + " - OEOVVB";
                } else {
                    document.getElementById('loadingOverlay').classList.add('hidden');
                    document.getElementById('loginPanel').innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--gray-700);">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                        <h3 style="margin-top: 0;">Hatalı Bağlantı</h3>
                        <p>Lütfen okul idaresinden veya öğretmeninizden aldığınız <b>tam bağlantı adresini (linki)</b> kullanarak sayfaya giriş yapın.</p>
                        <small style="color: #6b7280;">(Geçersiz veya eksik okul kodu)</small>
                    </div>`;
                    document.getElementById('loginPanel').classList.remove('hidden');
                    return;
                }"""

    new_onload = """                if (schoolData && schoolData.name) {
                    document.getElementById('schoolNameDisplay').innerText = schoolData.name;
                    document.title = schoolData.name + " - OEOVVB";
                }"""

    content = content.replace(old_onload, new_onload)

    old_logic = """        // --- LOGIN FLOW ---
        function handleStep1() {
            const noVal = document.getElementById('studentNoInput').value.trim();
            if (!noVal) {
                Swal.fire('Uyarı', 'Lütfen okul numaranızı girin.', 'warning');
                return;
            }

            const normalizeNo = (val) => String(val || '').trim().replace(/^0+/, '');
            const targetNo = normalizeNo(noVal);

            const student = allStudents.find(s => s && s.no && normalizeNo(s.no) === targetNo);
            
            if (!student) {
                Swal.fire('Hata', 'Öğrenci bulunamadı. Lütfen numarayı kontrol edin.', 'error');
                return;
            }

            currentStudent = student;
            document.getElementById('verifyStudentName').innerText = `${student.name} (${student.class})`;
            
            document.getElementById('loginStep1').classList.add('hidden');
            document.getElementById('loginStep2').classList.remove('hidden');

            // Find parentPhone from activities
            let foundParentPhone = null;
            const activities = schoolData.activities || [];
            activities.forEach(act => {
                if (act.students) {
                    const enrolled = act.students.find(s => String(s.no) === String(currentStudent.no));
                    if (enrolled && enrolled.parentPhone && String(enrolled.parentPhone).length >= 6) {
                        foundParentPhone = String(enrolled.parentPhone);
                    }
                }
            });
            currentStudent._activityParentPhone = foundParentPhone;

            if (foundParentPhone) {
                document.getElementById('phoneExistUI').classList.remove('hidden');
                document.getElementById('phoneNewUI').classList.add('hidden');
                document.getElementById('phoneVerifyInput').value = '';
                document.getElementById('phoneVerifyInput').focus();
            } else {
                document.getElementById('phoneExistUI').classList.add('hidden');
                document.getElementById('phoneNewUI').classList.remove('hidden');
                document.getElementById('phoneNewInput').value = '';
                document.getElementById('phoneNewInput').focus();
            }
        }

        function goBackToStep1() {
            document.getElementById('loginStep2').classList.add('hidden');
            document.getElementById('loginStep1').classList.remove('hidden');
            currentStudent = null;
        }

        async function handleStep2() {
            if (!currentStudent) return;

            if (currentStudent._activityParentPhone) {
                const val = document.getElementById('phoneVerifyInput').value.trim();
                if (val.length < 6) {
                    Swal.fire('Uyarı', 'Lütfen telefonun son 6 hanesini girin.', 'warning');
                    return;
                }
                const correctLast6 = currentStudent._activityParentPhone.slice(-6);
                if (val !== correctLast6) {
                    Swal.fire('Hata', 'Girdiğiniz son 6 hane sistemdeki telefonla eşleşmiyor.', 'error');
                    return;
                }
                // Login Success
                finalizeLogin();
            } else {
                const val = document.getElementById('phoneNewInput').value.trim();
                if (val.length !== 10) {
                    Swal.fire('Uyarı', 'Lütfen telefon numarasını başında sıfır olmadan 10 haneli olarak girin.', 'warning');
                    return;
                }
                
                // Save new phone
                currentStudent.parentPhone = val;
                
                // Sync to cloud
                document.getElementById('loadingOverlay').classList.remove('hidden');
                document.getElementById('loadingText').innerText = "Numara Kaydediliyor...";

                try {
                    const idx = allStudents.findIndex(s => s.no === currentStudent.no);
                    if (idx !== -1) {
                        allStudents[idx] = currentStudent;
                        DataManager.setStudents(allStudents);
                        await DataManager.forceSync();
                    }
                    document.getElementById('loadingOverlay').classList.add('hidden');
                    finalizeLogin();
                } catch (e) {
                    console.error("Save error:", e);
                    document.getElementById('loadingOverlay').classList.add('hidden');
                    Swal.fire('Hata', 'Kayıt sırasında bir sorun oluştu.', 'error');
                }
            }
        }"""

    new_logic = """        function findStudentByNo(targetNo) {
            if (!targetNo) return null;
            const normalizeNo = (val) => String(val || '').trim().replace(/^0+/, '');
            const tNo = normalizeNo(targetNo);
            
            // First check allStudents
            let student = allStudents.find(s => s && s.no && normalizeNo(s.no) === tNo);
            if (student) return student;

            // If not found, check inside activities
            const activities = schoolData.activities || [];
            for (let act of activities) {
                if (act.students) {
                    let actStudent = act.students.find(s => s && s.no && normalizeNo(s.no) === tNo);
                    if (actStudent) return actStudent;
                }
            }
            return null;
        }

        // --- LOGIN FLOW ---
        function handleLogin() {
            const noVal = document.getElementById('studentNoInput').value.trim();
            const phoneVal = document.getElementById('phoneVerifyInput').value.trim();
            
            if (!noVal || !phoneVal) {
                Swal.fire('Uyarı', 'Lütfen okul no ve telefonunuzun son 6 hanesini girin.', 'warning');
                return;
            }

            const student = findStudentByNo(noVal);
            if (!student) {
                Swal.fire('Hata', 'Sistemde numaranıza ait bir etkinlik kaydı bulunamadı. (Öğrenci bulunamadı)', 'error');
                return;
            }

            const storedPhone = String(student.parentPhone || '');
            if (storedPhone.length >= 6) {
                const correctLast6 = storedPhone.slice(-6);
                if (phoneVal !== correctLast6) {
                    Swal.fire('Hata', 'Girdiğiniz telefon bilgisi sistemdekiyle eşleşmiyor.', 'error');
                    return;
                }
                currentStudent = student;
                finalizeLogin();
            } else {
                Swal.fire('Kayıt Bulunamadı', 'Sistemde size ait telefon bilgisi bulunmuyor. Lütfen öğretmeninize başvurunuz.', 'error');
            }
        }"""

    content = content.replace(old_logic, new_logic)

    content = content.replace("const s = allStudents.find(st => st.no == savedNo);", "const s = findStudentByNo(savedNo);")

    # Remove the exact duplicated checkSession block using regex or exact string
    # We will just write it back since c3745a4 has the duplicate checkSession, wait, no, c3745a4 has duplicate checkSession!
    # Let me just find it and replace the first occurrence
    dup_block = """
        function checkSession() {
            const savedNo = localStorage.getItem('oeovvb_student_no');
            if (savedNo) {
                const s = allStudents.find(st => st.no == savedNo);
                if (s) {
                    currentStudent = s;
                    showDashboard();
                    return;
                }
            }
            document.getElementById('loginPanel').classList.remove('hidden');
        }"""
    # Replace second occurrence or whatever matches exactly
    import re
    content = re.sub(r'        function checkSession\(\) \{.*?        \}', '', content, flags=re.DOTALL, count=1)
    
    with open('oeovvb.html', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
