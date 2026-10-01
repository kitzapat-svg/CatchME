/**
 * CatchME — Medication Error Cat B Quick Reporter
 * Database Operations & Sheet Schema Management
 */

const DB_CONFIG = {
  SHEETS: {
    ME_LOG: 'ME_Log',
    APP_SETTINGS: 'App_Settings',
    AUDIT_LOG: 'Audit_Log',
    DRUG_MASTER: 'Drug_Master',
    LASA_MASTER: 'LASA_Master'
  },
  HEADERS: {
    ME_LOG: [
      'record_id', 'created_at', 'mode', 'reporter_alias', 'device_session_id',
      'raw_transcript', 'normalized_transcript', 'parser_version', 'parser_confidence',
      'needed_clarification', 'clarification_id', 'process', 'process_stage_code',
      'standard_error_code', 'error_type_th', 'legacy_code', 'legacy_event',
      'detected_stage_code', 'drug_name', 'strength', 'actual_value', 'expected_value',
      'hn', 'an', 'ward_clinic', 'severity', 'patient_reached', 'status',
      'confirmed_at', 'review_required', 'reviewed_at', 'reviewed_by',
      'is_lasa', 'lasa_type', 'lasa_prescribed_drug', 'lasa_dispensed_drug', 'lasa_pair_key', 'trade_name'
    ],
    APP_SETTINGS: ['setting_key', 'setting_value', 'description', 'updated_at'],
    AUDIT_LOG: [
      'audit_id', 'timestamp', 'record_id', 'reporter_alias', 'device_session_id',
      'action', 'field_name', 'old_value', 'new_value', 'source'
    ],
    DRUG_MASTER: [
      'drug_id', 'standard_name', 'strength', 'dosage_form', 'aliases', 'active', 'high_alert', 'notes'
    ],
    LASA_MASTER: [
      'pair_id', 'drug_1', 'drug_2', 'lasa_type', 'scope', 'risk_level', 'tallman_1', 'tallman_2', 'notes', 'active', 'updated_at'
    ]
  }
};

/**
 * Gets the active or configured database spreadsheet.
 * @param {string} [customSpreadsheetId]
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getDatabaseSpreadsheet(customSpreadsheetId) {
  var props = PropertiesService.getScriptProperties();
  var sheetId = customSpreadsheetId || props.getProperty('SPREADSHEET_ID') || '1HOnuMkVE8ujOvGoZYHpdRnrJ6pOvJLOBH5HW9cd_yuI';

  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      console.warn('Failed to open spreadsheet by configured ID:', e);
    }
  }

  // Fallback if container-bound
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      props.setProperty('SPREADSHEET_ID', active.getId());
      return active;
    }
  } catch (e) {
    // Standalone script without active spreadsheet
  }

  // If no spreadsheet is found or configured, create a new one automatically
  var newSheet = SpreadsheetApp.create('CatchME_Database');
  props.setProperty('SPREADSHEET_ID', newSheet.getId());
  return newSheet;
}

/**
 * Idempotently sets up all required sheets and headers for CatchME.
 * Preserves existing data. Safe to run repeatedly.
 *
 * @param {string} [spreadsheetId] Optional target spreadsheet ID
 * @returns {object} Status result of the setup operation
 */
function setupDatabase(spreadsheetId) {
  var ss = getDatabaseSpreadsheet(spreadsheetId);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var now = new Date().toISOString();

    // 1. Setup ME_Log
    ensureSheetWithHeaders(ss, DB_CONFIG.SHEETS.ME_LOG, DB_CONFIG.HEADERS.ME_LOG);

    // 2. Setup Audit_Log
    ensureSheetWithHeaders(ss, DB_CONFIG.SHEETS.AUDIT_LOG, DB_CONFIG.HEADERS.AUDIT_LOG);

    // 3. Setup Drug_Master
    ensureSheetWithHeaders(ss, DB_CONFIG.SHEETS.DRUG_MASTER, DB_CONFIG.HEADERS.DRUG_MASTER);

    // 4. Setup App_Settings
    var settingsSheet = ensureSheetWithHeaders(ss, DB_CONFIG.SHEETS.APP_SETTINGS, DB_CONFIG.HEADERS.APP_SETTINGS);
    populateDefaultSettingsIfEmpty(settingsSheet, now);

    // 5. Setup LASA_Master
    var lasaSheet = ensureSheetWithHeaders(ss, DB_CONFIG.SHEETS.LASA_MASTER, DB_CONFIG.HEADERS.LASA_MASTER);
    populateDefaultLasaMasterIfEmpty(lasaSheet, now);

    // Remove default "Sheet1" if empty and our sheets exist
    var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่นงาน1');
    if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }

    return {
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      message: 'Database setup completed successfully.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to ensure a sheet exists and has the required header row.
 */
function ensureSheetWithHeaders(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#F8F9FA');
  } else {
    // If existing sheet has fewer columns, append missing headers
    var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existingHeaders.length < headers.length) {
      for (var i = existingHeaders.length; i < headers.length; i++) {
        sheet.getRange(1, i + 1).setValue(headers[i]).setFontWeight('bold').setBackground('#F8F9FA');
      }
    }
  }

  return sheet;
}

/**
 * Inserts default application settings if the App_Settings sheet is empty.
 */
function populateDefaultSettingsIfEmpty(sheet, timestamp) {
  if (sheet.getLastRow() <= 1) {
    var defaults = [
      ['app_name', 'CatchME', 'CatchME Quick Reporter', timestamp],
      ['app_version', APP_VERSION, 'Database schema and app version', timestamp],
      ['allow_mode_switch', 'true', 'Allows users to toggle between OPD and IPD', timestamp],
      ['cat_b_strict_mode', 'true', 'Enforces strict Category B Near-Miss validation', timestamp],
      ['retention_days', '365', 'Data retention policy in days', timestamp]
    ];
    var range = sheet.getRange(2, 1, defaults.length, 4);
    range.setValues(defaults);
  }
}

/**
 * Populates default Hospital LASA drug pairs if the LASA_Master sheet is empty.
 */
function populateDefaultLasaMasterIfEmpty(sheet, timestamp) {
  if (sheet.getLastRow() <= 1) {
    var initialPairs = [
      // --- ห้องยาผู้ป่วยนอก (OPD) 10 อันดับแรก ---
      ['LASA-OPD-01', 'propranolol 10 mg', 'propranolol 40 mg', 'Look-alike', 'OPD', 'Standard', 'propranolol 10 mg', 'propranolol 40 mg', 'เม็ดยาและแผงต่างความแรง (อันดับ 1 OPD 13 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-02', 'amlodipine 5 mg', 'manidipine 20 mg', 'Sound-alike', 'OPD', 'Standard', 'amLODIPine 5 mg', 'maniDIPine 20 mg', 'ชื่อลงท้าย -dipine คล้ายกัน (อันดับ 2 OPD 11 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-03', 'urea cream', 'urea + 0.02% ta cream', 'Look-alike', 'OPD', 'Standard', 'Urea cream', 'Urea + 0.02% TA cream', 'หลอดยาทาบรรจุภัณฑ์ภายนอกคล้ายกัน (อันดับ 3 OPD 9 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-04', 'risperidone 1 mg', 'risperidone 2 mg', 'Look-alike', 'OPD', 'High Alert Drug', 'risperidone 1 mg', 'risperidone 2 mg', 'ยาจิตเวชต่างความแรง (อันดับ 4 OPD 8 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-05', 'seretide evohaler 25/250', 'seretide evohaler 25/50', 'Look-alike', 'OPD', 'Standard', 'Seretide 25/250', 'Seretide 25/50', 'กระบอกยาพ่นสูดรูปร่างเหมือนกัน (อันดับ 5 OPD 8 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-06', '0.02% ta cream', '0.1% ta cream', 'Look-alike', 'OPD', 'Standard', '0.02% TA cream', '0.1% TA cream', 'หลอดยาสเตียรอยด์ต่างความเข้มข้น (อันดับ 6 OPD 6 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-07', 'diazepam 5 mg', 'diazepam 2 mg', 'Look-alike', 'OPD', 'High Alert Drug', 'diazepam 5 mg', 'diazepam 2 mg', 'ยานอนหลับต่างความแรง (อันดับ 7 OPD 6 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-08', 'ferrous sulfate 200 mg', 'furosemide 40 mg', 'Sound-alike', 'OPD', 'Standard', 'FERROUS sulfate', 'furosemide', 'ชื่อขึ้นต้นและออกเสียงคล้ายกัน เฟอร์รัส vs ฟูโรซีไมด์ (อันดับ 8 OPD 6 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-09', 'ibuprofen 200 mg', 'ibuprofen 400 mg', 'Look-alike', 'OPD', 'Standard', 'ibuprofen 200 mg', 'ibuprofen 400 mg', 'ยาแก้ปวดต่างความแรง (อันดับ 9 OPD 6 เหตุการณ์)', true, timestamp],
      ['LASA-OPD-10', 'simvastatin 10 mg', 'simvastatin 20 mg', 'Look-alike', 'OPD', 'Standard', 'simvastatin 10 mg', 'simvastatin 20 mg', 'ยาลดไขมันต่างความแรง (อันดับ 10 OPD 6 เหตุการณ์)', true, timestamp],

      // --- ห้องยาผู้ป่วยใน (IPD) ---
      ['LASA-IPD-01', 'ceftriaxone', 'ceftazidime', 'Both', 'IPD', 'Standard', 'cefTRIAXone', 'cefTAZidime', 'ผงยาฉีด 1g vial รูปลักษณ์และชื่อพ้อง (ห้องยาใน)', true, timestamp],
      ['LASA-IPD-02', 'norepinephrine', 'amiodarone', 'Look-alike', 'IPD', 'High Alert Drug', 'norEPINephrine', 'amiodarone', 'แอมพูลขนาดใกล้เคียงกัน ยา HAD ห้องยาใน', true, timestamp],
      ['LASA-IPD-03', 'aminophylline', 'amiodarone', 'Sound-alike', 'IPD', 'High Alert Drug', 'aminoPHYLLine', 'amiodarone', 'ชื่อพ้องเสียงคล้าย ยา HAD ห้องยาใน', true, timestamp],
      ['LASA-IPD-04', 'phenytoin 100 mg', 'phenytoin 50 mg', 'Look-alike', 'IPD', 'High Alert Drug', 'phenytoin 100 mg', 'phenytoin 50 mg', 'แคปซูลต่างความแรง HAD ห้องยาใน', true, timestamp],
      ['LASA-IPD-05', 'azathioprine', 'azithromycin', 'Sound-alike', 'IPD', 'High Alert Drug', 'azaTHIOprine', 'aziTHROmycin', 'ชื่อพ้องเสียงคล้าย ยากดภูมิ vs ยาฆ่าเชื้อ ห้องยาใน', true, timestamp]
    ];
    var range = sheet.getRange(2, 1, initialPairs.length, initialPairs[0].length);
    range.setValues(initialPairs);
  }
}
