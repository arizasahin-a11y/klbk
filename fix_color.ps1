$path = "ogretmen.html"
$content = [System.IO.File]::ReadAllText($path)

$target = "const statusColor = status === 'GELMEDİ' ? 'var(--danger)' : (status === 'KOPYA' ? '#7f1d1d' : 'var(--gray-500)');"
$target2 = "const statusText = status || '<i class=""fa-solid fa-circle-info"" title=""Durum İşaretle"" style=""font-size:0.9rem;""></i>';"

if ($content.Contains($target)) {
    $repl = "const statusColor = status === 'GELMEDİ' ? 'var(--danger)' : (status === 'KOPYA' ? '#7f1d1d' : 'var(--danger)');"
    $repl2 = "const statusText = status || '<i class=""fa-solid fa-circle-info"" title=""Durum İşaretle"" style=""font-size:1.3rem; vertical-align: middle;""></i>';"
    
    $content = $content.Replace($target, $repl).Replace($target2, $repl2)
    [System.IO.File]::WriteAllText($path, $content)
    Write-Host "Color and size replacement succeeded!"
} else {
    Write-Host "Target not found!"
}
