/**
 * KLBK Sınav Sistemi Backend (Google Apps Script) - UNLIMITED CAPACITY VERSION
 * Verileri Google Drive'da JSON dosyaları olarak saklar, Sheets'i sadece indeks için kullanır.
 * Bu sayede 50.000 karakterlik hücre sınırı tamamen ortadan kalkar.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const UPLOAD_FOLDER_NAME = "KLBK_Yuklemeler";
const DB_FOLDER_NAME = "KLBK_Veritabani"; // Büyük veriler burada saklanır

/**
 * GET İsteklerini Karşılar
 */
function doGet(e) {
  const action = e.parameter.action;
  const id = e.parameter.id;
  
  try {
    if (action === "ping") {
      return responseJSON({ success: true, message: "Pong!", timestamp: new Date().toISOString() });
    }
    
    if (action === "get_users") {
      return responseJSON(getDataFromSheet("klbk_users"));
    }
    
    if (action === "get_data" && id) {
      return responseJSON(getDataFromSheet(id));
    }
    
    if (action === "proxy" && id) {
      const file = DriveApp.getFileById(id);
      const b64 = Utilities.base64Encode(file.getBlob().getBytes());
      return ContentService.createTextOutput(b64)
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    if (action === "list_files") {
      return responseJSON(listFiles());
    }

    return responseJSON({ error: "Geçersiz işlem veya eksik parametre" });
  } catch (err) {
    return responseJSON({ error: err.toString() });
  }
}

/**
 * POST İsteklerini Karşılar (JSON veya Form-Encoded)
 */
function doPost(e) {
  try {
    let postData;
    
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } 
    else if (e.parameter && e.parameter.payload) {
      postData = JSON.parse(e.parameter.payload);
    }
    else {
      postData = e.parameter;
    }

    const action = postData.action;
    const id = postData.id;
    const data = postData.data;

    if (action === "save_users") {
      saveDataToSheet("klbk_users", data);
      return responseJSON({ success: true });
    }

    if (action === "save_data" && id) {
      saveDataToSheet(id, data);
      return responseJSON({ success: true });
    }

    if (action === "upload_file") {
      const fileUrl = uploadFile(postData.fileName, postData.fileData, postData.mimeType);
      return responseJSON({ success: true, url: fileUrl });
    }
    
    if (action === "delete_file") {
      deleteFile(postData.fileName);
      return responseJSON({ success: true });
    }

    return responseJSON({ error: "Geçersiz action", received: Object.keys(postData) });
  } catch (err) {
    return responseJSON({ error: err.toString() });
  }
}

// --- Yardımcı Fonksiyonlar ---

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Veriyi Sheet'ten veya Drive Dosyasından okur
 */
function getDataFromSheet(id) {
  const sheet = getOrCreateSheet("AppStore");
  const dataRows = sheet.getDataRange().getValues();
  
  for (let i = 0; i < dataRows.length; i++) {
    if (dataRows[i][0] === id) {
      let val = dataRows[i][1];
      if (!val) return null;
      
      // Eğer değer bir FILE_ID referansı ise dosyadan oku
      if (val.indexOf("DRIVE_FILE_ID:") === 0) {
        const fileId = val.replace("DRIVE_FILE_ID:", "");
        try {
          const file = DriveApp.getFileById(fileId);
          const content = file.getBlob().getDataAsString();
          return JSON.parse(content);
        } catch (e) {
          console.error("Dosya okuma hatası:", e);
          return null;
        }
      }
      
      // Değilse doğrudan JSON olarak parse et (Geriye dönük uyumluluk)
      try {
        return JSON.parse(val);
      } catch(e) {
        return val;
      }
    }
  }
  return null;
}

/**
 * Büyük verileri Drive Dosyası olarak, küçükleri Sheet içinde saklar
 */
function saveDataToSheet(id, data) {
  const sheet = getOrCreateSheet("AppStore");
  const dataRows = sheet.getDataRange().getValues();
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  let finalValue = jsonStr;
  
  // Eğer veri büyükse (0.5KB'dan büyükse) veya ana veritabanı verisiyse dosyaya kaydet
  if (id !== "klbk_users" && (jsonStr.length > 500 || id.indexOf("klbk_data_") === 0)) {
    const fileId = saveToDriveFile(id, jsonStr);
    finalValue = "DRIVE_FILE_ID:" + fileId;
  }
  
  for (let i = 0; i < dataRows.length; i++) {
    if (dataRows[i][0] === id) {
      sheet.getRange(i + 1, 2).setValue(finalValue);
      return;
    }
  }
  sheet.appendRow([id, finalValue]);
}

/**
 * Veriyi Drive'daki klasöre dosya olarak kaydeder
 */
function saveToDriveFile(name, content) {
  const folder = getOrCreateFolder(DB_FOLDER_NAME);
  const fileName = name + ".json";
  const files = folder.getFilesByName(fileName);
  
  let file;
  if (files.hasNext()) {
    file = files.next();
    file.setContent(content);
  } else {
    file = folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
  }
  return file.getId();
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "AppStore") {
      sheet.appendRow(["ID", "JSON_DATA"]);
      sheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#f3f3f3");
    }
  }
  return sheet;
}

function uploadFile(name, base64Data, mimeType) {
  const folder = getOrCreateFolder(UPLOAD_FOLDER_NAME);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, name);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function deleteFile(name) {
  const folder = getOrCreateFolder(UPLOAD_FOLDER_NAME);
  const files = folder.getFilesByName(name);
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }
}

function listFiles() {
  const folder = getOrCreateFolder(UPLOAD_FOLDER_NAME);
  const files = folder.getFiles();
  const result = [];
  while (files.hasNext()) {
    const f = files.next();
    result.push({
      name: f.getName(),
      url: "https://drive.google.com/uc?export=view&id=" + f.getId(),
      created_at: f.getDateCreated()
    });
  }
  return result;
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}
