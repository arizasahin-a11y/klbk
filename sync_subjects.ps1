$subjectsFile = "extracted_subjects.json"
$baseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app"

if (Test-Path $subjectsFile) {
    $content = Get-Content $subjectsFile -Raw -Encoding UTF8
    $json = $content | ConvertFrom-Json
    
    foreach ($property in $json.PSObject.Properties) {
        $key = $property.Name
        $schoolData = $property.Value
        $payload = $schoolData | ConvertTo-Json -Depth 10 -Compress
        
        Write-Host ("Syncing subjects for {0}..." -f $key)
        $url = "{0}/app_store/{1}.json" -f $baseUrl, $key
        
        try {
            $response = Invoke-RestMethod -Uri $url -Method Patch -Body $payload -ContentType "application/json; charset=utf-8"
            Write-Host ("Success for {0}" -f $key)
        } catch {
            Write-Host ("Failed to sync {0}" -f $key)
            Write-Host $_.Exception.Message
        }
    }
} else {
    Write-Error "File not found: $subjectsFile"
}
