$file = "users_final.json"
$content = Get-Content $file -Raw
try { $json = $content | ConvertFrom-Json } catch { 
    $content = Get-Content $file -Encoding Unicode -Raw
    $json = $content | ConvertFrom-Json 
}

$schoolMap = @{}
$userCount = 0
foreach ($p in $json.psobject.Properties) {
    $userCount++
    $u = $p.Value
    if ($u.storeKey -and $u.branch) {
        $sk = $u.storeKey
        if (-not $schoolMap.ContainsKey($sk)) { $schoolMap[$sk] = New-Object System.Collections.Generic.List[string] }
        foreach ($b in $u.branch) {
            $bn = $b.ToString().Trim()
            if ($bn -ne "" -and -not $schoolMap[$sk].Contains($bn)) { $schoolMap[$sk].Add($bn) }
        }
    }
}

Write-Host "Total users found in backup: $userCount"
Write-Host "Unique schools (storeKeys) found: $($schoolMap.Count)"

$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($sk in $schoolMap.Keys) {
    $subs = $schoolMap[$sk]
    Write-Host "Syncing school $sk with $($subs.Count) branches..."
    
    $payload = @{ school = @{ subjects = $subs } } | ConvertTo-Json -Compress
    $tempFile = "payload_$sk.json"
    
    # Write UTF8 WITHOUT BOM
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $tempFile), $payload, $Utf8NoBom)
    
    $url = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/$sk.json"
    # Execute curl and capture output
    $resp = curl.exe -s -X PATCH -H "Content-Type: application/json" -d "@$tempFile" $url
    Write-Host "Response: $resp"
    
    Remove-Item $tempFile
}
