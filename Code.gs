// ══════════════════════════════════════════════════════════════
//  Google Apps Script — Supply Form Backend
//  Деплой: Развернуть → Новое развёртывание → Веб-приложение
//  Настройки: Файл → Свойства проекта → Свойства скрипта
//    CLAUDE_API_KEY — ключ Anthropic (вводится через интерфейс сайта)
//    SPREADSHEET_ID — ID Google Таблицы (создаётся автоматически)
// ══════════════════════════════════════════════════════════════

const SHEET_NAME         = 'Заявки';
const OBJECTS_SHEET_NAME = 'Объекты';

// ── Подключение HTML-файла ──────────────────────────────────────
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── Раздача HTML-интерфейса ─────────────────────────────────────
function doGet() {
  // При первом посещении — автоматически создаём таблицу
  tryAutoSetup_();

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Уведомление о поставке материалов')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── API для внешнего фронтенда (Netlify) ───────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let result;
    switch (data.action) {
      case 'isConfigured':
        tryAutoSetup_();
        result = isConfigured();
        break;
      case 'saveApiKey':
        result = saveApiKey(data.key);
        break;
      case 'getObjectsList':
        result = getObjectsList();
        break;
      case 'recognizeImageGAS':
        result = recognizeImageGAS(data.base64Image, data.mimeType, data.supplier, data.deliveryDate);
        break;
      case 'saveToSheetGAS':
        result = saveToSheetGAS(data.supplier, data.contractor, data.object, data.rows, data.fileUrl);
        break;
      case 'setCalToken':
        result = setCalToken(data.token);
        break;
      case 'getCalendar':
        result = getCalendar(data.token);
        break;
      default:
        result = { error: 'Unknown action: ' + data.action };
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Первичная настройка (вызывается автоматически при первом doGet) ──
function tryAutoSetup_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SPREADSHEET_ID')) return;
  try {
    const ss = SpreadsheetApp.create('Поставки материалов');
    ss.getActiveSheet().setName(SHEET_NAME);

    const objSheet = ss.insertSheet(OBJECTS_SHEET_NAME);
    objSheet.getRange('A1:A5').setValues([
      ['Объект 1'], ['Объект 2'], ['Объект 3'], ['Объект 4'], ['Объект 5']
    ]);
    objSheet.getRange('A1:A5').setNote('Замените на реальные названия ваших объектов');

    props.setProperty('SPREADSHEET_ID', ss.getId());
    Logger.log('Таблица создана: ' + ss.getUrl());
  } catch (e) {
    Logger.log('AutoSetup error: ' + e);
  }
}

// ── Проверка наличия API-ключа (вызывается клиентом при загрузке) ──
function isConfigured() {
  const props = PropertiesService.getScriptProperties();
  return {
    hasApiKey:      !!props.getProperty('CLAUDE_API_KEY'),
    hasSpreadsheet: !!props.getProperty('SPREADSHEET_ID'),
    spreadsheetUrl: getSpreadsheetUrl_()
  };
}

// ── Первичная установка API-ключа (только один раз) ─────────────
function saveApiKey(key) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CLAUDE_API_KEY')) {
    throw new Error('Ключ уже установлен. Для изменения обратитесь к администратору.');
  }
  if (!key || key.trim().length < 20) {
    throw new Error('Неверный ключ — он должен начинаться на sk-ant-...');
  }
  props.setProperty('CLAUDE_API_KEY', key.trim());
  return true;
}

// ── Список объектов ─────────────────────────────────────────────
function getObjectsList() {
  try {
    const ss    = SpreadsheetApp.openById(getSpreadsheetId_());
    const sheet = ss.getSheetByName(OBJECTS_SHEET_NAME);
    if (!sheet) return [];
    return sheet.getDataRange().getValues().flat().filter(v => v !== '');
  } catch (e) {
    return [];
  }
}

// ── Распознавание изображения через Claude Vision ───────────────
function recognizeImageGAS(base64Image, mimeType, supplier, deliveryDate) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) throw new Error('API-ключ не настроен');

  const mediaType = (mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf'))
    ? mimeType : 'image/jpeg';

  // Сохраняем файл на Google Drive
  let fileUrl = null;
  try {
    fileUrl = saveFileToDrive_(base64Image, mediaType, supplier, deliveryDate);
  } catch (e) {
    Logger.log('Drive upload error: ' + e);
  }

  const prompt =
    'Это заявка на поставку товаров или материалов. ' +
    'Проанализируй документ и извлеки ВСЕ позиции из таблицы — любые товары, материалы, изделия. ' +
    'Верни ТОЛЬКО валидный JSON-массив без пояснений, без markdown-блоков, только чистый JSON:\n' +
    '[{"nomenclature":"название позиции","unit":"единица измерения","quantity":число}]\n' +
    'Если quantity не распознано — укажи 0. ' +
    'Если в документе нет таблицы с позициями — верни [].';

  const isPdf = mediaType === 'application/pdf';
  const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:             'post',
    contentType:        'application/json',
    headers:            headers,
    payload:            JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      messages:   [{
        role:    'user',
        content: [
          mediaType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Image } }
            : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: prompt }
        ]
      }]
    }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    const errText = response.getContentText();
    Logger.log('Claude API error: ' + errText);
    throw new Error('Claude API ' + response.getResponseCode() + ': ' + errText);
  }

  const text = JSON.parse(response.getContentText()).content[0].text.trim();
  let items = [];
  try {
    items = JSON.parse(text);
  } catch (_) {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) try { items = JSON.parse(m[0]); } catch (__) {}
  }

  return { items: Array.isArray(items) ? items : [], fileUrl: fileUrl };
}

// ── Сохранение файла на Google Drive ────────────────────────────
function saveFileToDrive_(base64Image, mimeType, supplier, deliveryDate) {
  const extMap = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };
  const ext = extMap[mimeType] || 'jpg';
  const safe = s => String(s || '').replace(/[\\/:*?"<>|();%&+#=@!$^{}\[\]]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
  const fileName = `${safe(supplier)}_${safe(deliveryDate)}.${ext}`;

  const folder = getOrCreateFolder_();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Image), mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
  return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
}

// ── Публичная функция для ручной авторизации Drive ──────────────
function initDriveFolder() {
  const folder = getOrCreateFolder_();
  Logger.log('Папка готова: ' + folder.getName() + ' | ID: ' + folder.getId());
}

function getOrCreateFolder_() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DRIVE_FOLDER_ID');
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (e) {}
  }
  const folder = DriveApp.createFolder('Заявки поставщиков');
  props.setProperty('DRIVE_FOLDER_ID', folder.getId());
  return folder;
}

// ── Сохранение в Google Таблицу ─────────────────────────────────
function saveToSheetGAS(supplier, contractor, object, rows, fileUrl) {
  const ss    = SpreadsheetApp.openById(getSpreadsheetId_());
  let   sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['Дата записи', 'Поставщик', 'Подрядчик', 'Объект', 'Плановая дата поставки', 'Номенклатура', 'Ед. изм.', 'Количество', 'Ссылка на заявку'];
    sheet.appendRow(headers);
    const hdr = sheet.getRange(1, 1, 1, headers.length);
    hdr.setFontWeight('bold').setBackground('#1e40af').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(5, 160);
    sheet.setColumnWidth(6, 320);
    sheet.setColumnWidth(9, 250);
  }

  const date = new Date();
  rows.forEach(row => {
    sheet.appendRow([
      date, supplier, contractor, object,
      row.deliveryDate || '', row.nomenclature, row.unit, row.quantity, fileUrl || ''
    ]);
  });

  return rows.length;
}

// ── Код доступа к календарю (устанавливается один раз) ──────────
function setCalToken(token) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CAL_TOKEN')) {
    throw new Error('Код доступа уже установлен. Для изменения обратитесь к администратору.');
  }
  if (!token || String(token).trim().length < 8) {
    throw new Error('Код доступа слишком короткий');
  }
  props.setProperty('CAL_TOKEN', String(token).trim());
  return true;
}

// ── Календарь поставок (только с кодом доступа) ─────────────────
function getCalendar(token) {
  const saved = PropertiesService.getScriptProperties().getProperty('CAL_TOKEN');
  if (!saved || String(token || '').trim() !== saved) {
    throw new Error('Нет доступа к календарю');
  }

  const ss    = SpreadsheetApp.openById(getSpreadsheetId_());
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return { days: [] };

  const tz     = Session.getScriptTimeZone();
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();

  const byKey = {};
  values.forEach(r => {
    const supplier   = String(r[1]).trim();
    const contractor = String(r[2]).trim();
    const object     = String(r[3]).trim();

    let dateStr = '';
    if (r[4] instanceof Date) {
      dateStr = Utilities.formatDate(r[4], tz, 'yyyy-MM-dd');
    } else {
      const s = String(r[4]).trim();
      const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
      dateStr = m ? (m[3] + '-' + m[2] + '-' + m[1]) : s.slice(0, 10);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

    const key = dateStr + '|' + supplier + '|' + contractor + '|' + object;
    if (!byKey[key]) byKey[key] = { date: dateStr, supplier: supplier, contractor: contractor, object: object, fileUrl: '', items: [] };
    if (!byKey[key].fileUrl && r[8]) byKey[key].fileUrl = String(r[8]);
    byKey[key].items.push({ n: String(r[5]), u: String(r[6]), q: String(r[7]) });
  });

  const byDate = {};
  Object.keys(byKey).forEach(k => {
    const d = byKey[k];
    (byDate[d.date] = byDate[d.date] || []).push(d);
  });

  return {
    days: Object.keys(byDate).sort().map(date => ({ date: date, deliveries: byDate[date] }))
  };
}

// ── Утилиты ─────────────────────────────────────────────────────
function getSpreadsheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID не настроен');
  return id;
}

function getSpreadsheetUrl_() {
  try {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    return id ? 'https://docs.google.com/spreadsheets/d/' + id : null;
  } catch (_) { return null; }
}
