$path = "ogretmen.html"
$utf8 = [System.Text.Encoding]::UTF8
$content = [System.IO.File]::ReadAllText($path, $utf8)

# 1. Extract the correctly-encoded words directly from the file to avoid any encoding mangling!
$gelmedi = [regex]::Match($content, 'GELMED.').Value
$temizle = [regex]::Match($content, 'TEM.ZLE').Value
$durumGuncellendi = [regex]::Match($content, 'Durum g.ncellendi').Value

Write-Host "Extracted GELMEDİ as: $gelmedi"
Write-Host "Extracted TEMİZLE as: $temizle"
Write-Host "Extracted Durum güncellendi as: $durumGuncellendi"

# Define the new function block as a single-quoted string (totally literal!)
# We use placeholder tokens for the dynamic variables to avoid any PowerShell parsing errors!
$newFuncTemplate = '        window.setStudentStatus = function(sesId, studentNo) {
            const sessions = DataManager.getExamSessions();
            const session = sessions.find(s => s.id === sesId);
            if (!session) return;

            Swal.fire({
                title: ''<div style="font-weight:900; font-size:1.25rem; display:flex; align-items:center; gap:8px; justify-content:center;"><i class="fa-solid fa-user-pen" style="color:var(--primary);"></i> Öğrenci Durumu</div>'',
                html: `
                    <div style="margin-bottom: 20px; font-weight: 700; font-size: 0.95rem; color: var(--gray-600);">
                        <span style="color:var(--primary); font-weight:900;">${studentNo}</span> numaralı öğrenci için durum seçin:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="btn-kopya" class="btn" style="background: #7f1d1d; border: none; padding: 12px; font-weight: 800; color: white; border-radius: 8px; font-size: 0.9rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity=''0.9''" onmouseout="this.style.opacity=''1''">KOPYA</button>
                        <button id="btn-gelmedi" class="btn" style="background: var(--danger); border: none; padding: 12px; font-weight: 800; color: white; border-radius: 8px; font-size: 0.9rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity=''0.9''" onmouseout="this.style.opacity=''1''">_GELMEDI_</button>
                        <button id="btn-rahatsiz" class="btn" style="background: #0284c7; border: none; padding: 12px; font-weight: 800; color: white; border-radius: 8px; font-size: 0.9rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity=''0.9''" onmouseout="this.style.opacity=''1''">RAHATSIZLANDI</button>
                        <button id="btn-temizle" class="btn" style="background: var(--gray-500); border: none; padding: 12px; font-weight: 800; color: white; border-radius: 8px; font-size: 0.9rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity=''0.9''" onmouseout="this.style.opacity=''1''">_TEMIZLE_ (İPTAL)</button>
                    </div>
                `,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: ''Kapat'',
                cancelButtonColor: ''#e2e8f0'',
                customClass: {
                    cancelButton: ''text-dark font-weight-bold''
                },
                didOpen: () => {
                    const popup = Swal.getPopup();
                    popup.querySelector(''#btn-kopya'').onclick = () => Swal.clickConfirm(''KOPYA'');
                    popup.querySelector(''#btn-gelmedi'').onclick = () => Swal.clickConfirm(''_GELMEDI_'');
                    popup.querySelector(''#btn-rahatsiz'').onclick = () => Swal.clickConfirm(''RAHATSIZLANDI'');
                    popup.querySelector(''#btn-temizle'').onclick = () => Swal.clickConfirm(''_TEMIZLE_'');
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const statusVal = result.value;
                    if (!session.studentStatuses) session.studentStatuses = {};
                    
                    if (statusVal === ''KOPYA'') {
                        session.studentStatuses[studentNo] = ''KOPYA'';
                    } else if (statusVal === ''_GELMEDI_'') {
                        session.studentStatuses[studentNo] = ''_GELMEDI_'';
                    } else if (statusVal === ''RAHATSIZLANDI'') {
                        session.studentStatuses[studentNo] = ''RAHATSIZLANDI'';
                    } else if (statusVal === ''_TEMIZLE_'') {
                        delete session.studentStatuses[studentNo];
                    }

                    DataManager.addExamSession(session);
                    renderExams();
                    Swal.fire({
                        toast: true,
                        position: ''top-end'',
                        icon: ''success'',
                        title: ''_DURUM_GUNCELLE_'',
                        showConfirmButton: false,
                        timer: 800
                    });
                }
            });
        };'

# Replace placeholder tokens in the template
$newFunc = $newFuncTemplate.Replace("_GELMEDI_", $gelmedi).Replace("_TEMIZLE_", $temizle).Replace("_DURUM_GUNCELLE_", $durumGuncellendi)

# Locate the old setStudentStatus block and replace it
$patternFunc = '(?ms)^\s*window\.setStudentStatus = function\(sesId, studentNo\) \{.*?Swal\.fire\(\{.*?toast: true,.*?\}\);\s*\}\);\s*\};'
if ($content -match $patternFunc) {
    Write-Host "Found old setStudentStatus function using regex!"
    $content = [System.Text.RegularExpressions.Regex]::Replace($content, $patternFunc, $newFunc)
}

# 2. Update statusColor in proctor/myDuties list
$patternColor1 = 'const statusColor = status === ''GELMED[^'']+'' \? ''var\(--danger\)'' : \(status === ''KOPYA'' \? ''#7f1d1d'' : ''var\(--danger\)''\);'
$match1 = [regex]::Match($content, $patternColor1)
if ($match1.Success) {
    Write-Host "Matched statusColor in proctor list!"
    $replColor1 = "const statusColor = status === '$gelmedi' ? 'var(--danger)' : (status === 'KOPYA' ? '#7f1d1d' : (status === 'RAHATSIZLANDI' ? '#0284c7' : 'var(--danger)'));"
    $content = $content.Replace($match1.Value, $replColor1)
}

# 3. Update statusColor in subject-specific and global reports
$patternColorReports = 'const statusColor = std.status === ''GELMED[^'']+'' \? ''var\(--danger\)'' : ''#7f1d1d'';'
$matchReports = [regex]::Matches($content, $patternColorReports)
if ($matchReports.Count -gt 0) {
    Write-Host "Found $($matchReports.Count) statusColor matches in reports!"
    foreach ($m in $matchReports) {
        $replReports = "const statusColor = std.status === '$gelmedi' ? 'var(--danger)' : (std.status === 'RAHATSIZLANDI' ? '#0284c7' : '#7f1d1d');"
        $content = $content.Replace($m.Value, $replReports)
    }
}

# 4. Update statusColor in printing window functions
$patternColorPrint = 'color: \$\{std\.status === ''GELMED[^'']+'' \? ''#dc2626'' : ''#7f1d1d''\};'
$matchPrint = [regex]::Matches($content, $patternColorPrint)
if ($matchPrint.Count -gt 0) {
    Write-Host "Found $($matchPrint.Count) statusColor matches in print functions!"
    foreach ($m in $matchPrint) {
        # Using string double quotes to preserve dollar signs correctly
        $replPrint = 'color: ${std.status === ''' + $gelmedi + ''' ? ''#dc2626'' : (std.status === ''RAHATSIZLANDI'' ? ''#0284c7'' : ''#7f1d1d'')};'
        $content = $content.Replace($m.Value, $replPrint)
    }
}

[System.IO.File]::WriteAllText($path, $content, $utf8)
Write-Host "All replacements finished successfully!"
