$path = "ogretmen.html"
$utf8 = [System.Text.Encoding]::UTF8
$content = [System.IO.File]::ReadAllText($path, $utf8)

# 1. Optimize the loading in head (add defer to heavy PDF/Zip libraries)
$headScripts = @(
    @('<script src="https://unpkg.com/pdf-lib/dist/pdf-lib.min.js"></script>', '<script src="https://unpkg.com/pdf-lib/dist/pdf-lib.min.js" defer></script>'),
    @('<script src="https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.js"></script>', '<script src="https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.js" defer></script>'),
    @('<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" defer></script>')
)

foreach ($pair in $headScripts) {
    if ($content.Contains($pair[0])) {
        $content = $content.Replace($pair[0], $pair[1])
        Write-Host "Deferred head script: $($pair[0])"
    }
}

# 2. Optimize syncTime() function to be completely non-blocking and render UI instantly
# Define the new syncTime() function
$newSyncTime = @"
        async function syncTime() {
            const statusEl = document.getElementById('timeSyncStatus');
            const timeApis = [
                'https://worldtimeapi.org/api/ip',
                'https://ipapi.co/json/',
                'https://worldclockapi.com/api/json/est/now'
            ];

            // Set local fallback base time immediately so timers can start instantly!
            trustedBaseTime = Date.now();
            performanceAtSync = performance.now();

            // Run initial load (Cloud Data) instantly!
            try {
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Veriler Yükleniyor...';
                    statusEl.style.color = 'var(--primary)';
                }
                await DataManager.initCloud();
                lastSyncSessions = JSON.stringify(DataManager.getExamSessions().filter(s => s.isPublished));
            } catch (err) {
                console.error("Initial Cloud load failed:", err);
            }

            // Render UI instantly!
            if (statusEl) statusEl.classList.add('hidden');
            document.body.style.visibility = 'visible';

            if (window.DataManager && window.DataManager.getSchoolTeachers) {
                window.DataManager.getSchoolTeachers()
                    .then(db => {
                        window.globalTeachersDb = db;
                        try { renderExams(); } catch (e) { console.error(e); }
                    })
                    .catch(err => console.error(err));
            }

            try { renderExams(); } catch (e) { console.error("Initial renderExams failed:", e); }
            try { if (typeof renderPublishedFiles === 'function') renderPublishedFiles(); } catch (e) { console.error(e); }
            
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateAllTimers, 1000);
            
            // Set sync interval
            if (!window.hasSyncInterval) {
                window.hasSyncInterval = true;
                setInterval(backgroundSync, 2000);
            }

            // Fetch high-accuracy internet clock asynchronously in the background!
            (async () => {
                let syncSuccess = false;
                for (const apiUrl of timeApis) {
                    if (syncSuccess) break;
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 2000);
                        const response = await fetch(apiUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        const data = await response.json();
                        
                        let serverTime;
                        if (data.datetime) serverTime = new Date(data.datetime).getTime();
                        else if (data.utc_datetime) serverTime = new Date(data.utc_datetime).getTime();
                        else if (data.currentDateTime) serverTime = new Date(data.currentDateTime).getTime();
                        
                        if (serverTime) {
                            trustedBaseTime = serverTime;
                            performanceAtSync = performance.now();
                            console.log("Internet clock successfully synced in background!");
                            syncSuccess = true;
                        }
                    } catch (e) { /* silent fail, try next API */ }
                }
            })();
        }
"@

# Locate and replace the old syncTime() function in the content
# We will use a regex match that captures the whole syncTime() block precisely
$pattern = '(?ms)^\s*async function syncTime\(\) \{.*?setInterval\(backgroundSync, 2000\);[^\n]*\r?\n\s*\}\r?\n\s*\}'

if ($content -match $pattern) {
    Write-Host "Found old syncTime() block using regex!"
    $content = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $newSyncTime)
    [System.IO.File]::WriteAllText($path, $content, $utf8)
    Write-Host "Successfully optimized syncTime() and speeded up page loading!"
} else {
    Write-Host "Regex match for syncTime() block failed. Trying loose match..."
    # Loose fallback match
    $loosePattern = '(?ms)async function syncTime\(\) \{.*?setInterval\(backgroundSync, 2000\);.*?\r?\n\s*\}\r?\n\s*\}'
    if ($content -match $loosePattern) {
        $content = [System.Text.RegularExpressions.Regex]::Replace($content, $loosePattern, $newSyncTime)
        [System.IO.File]::WriteAllText($path, $content, $utf8)
        Write-Host "Loose pattern optimization succeeded!"
    } else {
        Write-Host "Optimization failed. Could not locate syncTime()."
    }
}
