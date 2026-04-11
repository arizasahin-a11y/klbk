
const supabaseUrl = "https://esdttjvkqyeaosdcsskr.supabase.co";
const supabaseKey = "sb_publishable_Rdl1xQ10AjWVZPxLwL_O_A_x4NYDxl6";

async function checkData() {
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/app_store?id=eq.klbk_users&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        if (res.ok) {
            const rows = await res.json();
            console.log("USERS DB:", JSON.stringify(rows[0]?.data, null, 2));
            
            // Also check admin data
            const res2 = await fetch(`${supabaseUrl}/rest/v1/app_store?id=eq.klbk_data_admin&select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            if (res2.ok) {
                 const rows2 = await res2.json();
                 console.log("ADMIN DATA EXIST:", rows2.length > 0);
                 if (rows2.length > 0) {
                     console.log("ADMIN DATA PREVIEW (School):", rows2[0].data?.school?.name);
                     console.log("ADMIN DATA PREVIEW (Students Count):", rows2[0].data?.students?.length);
                 }
            }
        } else {
            console.error("Fetch failed", res.status);
        }
    } catch (e) {
        console.error("Error", e);
    }
}

checkData();
