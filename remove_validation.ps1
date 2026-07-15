$content = [System.IO.File]::ReadAllText("a:\TOOLS\kodlama\km\KLBK FRVR\oeovvb.html", [System.Text.Encoding]::UTF8)

$storageKeyOverride = @"
        // Initialize DataManager with ?school=XYZ parameter
        DataManager._getStorageKey = function () {
            const urlParams = new URLSearchParams(window.location.search);
            const q = urlParams.get('school');
            
            if (q) {
                localStorage.setItem('klbk_last_school', q);
                return `"klbk_data_${q}`";
            }

            const lastSchool = localStorage.getItem('klbk_last_school');
            if (lastSchool) return `"klbk_data_${lastSchool}`";

            return `"klbk_data_admin`";
        };
"@

$content = $content.Replace($storageKeyOverride, "")

$validationBlock = @"
                if (schoolData && schoolData.name) {
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
                }
"@

$newValidation = @"
                if (schoolData && schoolData.name) {
                    document.getElementById('schoolNameDisplay').innerText = schoolData.name;
                    document.title = schoolData.name + " - OEOVVB";
                }
"@

$content = $content.Replace($validationBlock, $newValidation)

[System.IO.File]::WriteAllText("a:\TOOLS\kodlama\km\KLBK FRVR\oeovvb.html", $content, [System.Text.Encoding]::UTF8)
Write-Host "Modifications complete."
