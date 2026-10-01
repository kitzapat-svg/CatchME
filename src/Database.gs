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
    LASA_MASTER: 'LASA_Master',
    HAD_MASTER: 'HAD_Master',
    ME_REVIEW: 'ME_Review'
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
      'is_lasa', 'lasa_type', 'lasa_prescribed_drug', 'lasa_dispensed_drug', 'lasa_pair_key', 'trade_name',
      'is_had', 'had_category', 'had_drug', 'void_reason', 'updated_at'
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
    ],
    HAD_MASTER: [
      'had_id', 'generic_name', 'trade_names', 'dosage_form', 'strengths', 'category_no', 'category_name', 'alert_message', 'active', 'updated_at'
    ],
    ME_REVIEW: [
      'review_id', 'record_id', 'reviewed_at', 'reviewed_by', 'lasa', 'lasa_pair', 'had', 'had_drug', 'contributing_factors', 'root_cause_note', 'immediate_action', 'corrective_action', 'follow_up_required', 'follow_up_due', 'review_status', 'review_note'
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

    // 6. Setup HAD_Master (29 Items - Sawankhalok Hospital)
    var hadSheet = ensureSheetWithHeaders(ss, DB_CONFIG.SHEETS.HAD_MASTER, DB_CONFIG.HEADERS.HAD_MASTER);
    populateDefaultHadMasterIfEmpty(hadSheet, now);

    // 7. Setup ME_Review
    ensureSheetWithHeaders(ss, DB_CONFIG.SHEETS.ME_REVIEW, DB_CONFIG.HEADERS.ME_REVIEW);

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
 * Inserts default application settings if the App_Settings sheet is empty or missing keys.
 */
function populateDefaultSettingsIfEmpty(sheet, timestamp) {
  var defaults = [
    ['app_name', 'CatchME', 'CatchME Quick Reporter', timestamp],
    ['app_version', APP_VERSION, 'Database schema and app version', timestamp],
    ['allow_mode_switch', 'true', 'Allows users to toggle between OPD and IPD', timestamp],
    ['cat_b_strict_mode', 'true', 'Enforces strict Category B Near-Miss validation', timestamp],
    ['retention_days', '365', 'Data retention policy in days', timestamp],
    ['admin_pin', '8888', 'Admin & Analytics 4-digit PIN protection', timestamp],
    ['alert_enabled', 'false', 'Real-time Telegram safety alerts enabled', timestamp],
    ['alert_had_only', 'true', 'Trigger alerts only for High Alert Drugs (HAD)', timestamp],
    ['telegram_bot_token', '', 'Telegram Bot Token from @BotFather', timestamp],
    ['telegram_chat_id', '', 'Telegram Group or Channel Chat ID', timestamp],
    ['gemini_api_key', '', 'Google Gemini API Key for intelligent fallback parsing', timestamp],
    ['gemini_model', 'gemini-2.5-flash', 'Gemini AI Model identifier (e.g. gemini-2.5-flash)', timestamp],
    ['gemini_enabled', 'true', 'Enable Gemini AI for smart parsing and fallback', timestamp]
  ];

  if (sheet.getLastRow() <= 1) {
    var range = sheet.getRange(2, 1, defaults.length, 4);
    range.setValues(defaults);
    return;
  }

  // If sheet already has rows, ensure missing default keys are added idempotently
  var existingData = sheet.getDataRange().getValues();
  var existingKeys = {};
  for (var i = 1; i < existingData.length; i++) {
    existingKeys[String(existingData[i][0]).trim()] = true;
  }

  defaults.forEach(function(row) {
    if (!existingKeys[row[0]]) {
      sheet.appendRow(row);
    }
  });
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

/**
 * Populates default Sawankhalok Hospital High Alert Drugs (29 items across 3 categories)
 * if the HAD_Master sheet is empty.
 */
function populateDefaultHadMasterIfEmpty(sheet, timestamp) {
  if (sheet.getLastRow() <= 1) {
    var initialHad = [
      // --- หมวดที่ 1: ยาที่มีช่วงความปลอดภัยในการรักษาแคบ หรือผลของความคลาดเคลื่อนก่อให้เกิดผลเสียรุนแรงต่อผู้ป่วย (22 รายการ) ---
      ['HAD-01', 'adrenaline', 'Adrenaline', 'injection', '1 mg/ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ระวังหัวใจเต้นผิดจังหวะ / ความดันโลหิตสูงวิกฤต', true, timestamp],
      ['HAD-02', 'norepinephrine', 'Levophed', 'injection', '4 mg/4ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ห้าม IV push เด็ดขาด ต้องให้ผ่าน Infusion pump และระวัง Extravasation', true, timestamp],
      ['HAD-03', 'dobutamine', 'Dobutrex', 'injection', '250 mg/5ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ติดตาม HR, BP, ECG อย่างใกล้ชิด', true, timestamp],
      ['HAD-04', 'dopamine', 'Inotropin', 'injection', '250 mg/10ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ควบคุมผ่าน Infusion pump ระวัง Extravasation', true, timestamp],
      ['HAD-05', 'digoxin', 'Lanoxin', 'injection', '0.25 mg/ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ช่วงการรักษาแคบ ตรวจสอบ HR และระดับ K+ ก่อนให้ยา', true, timestamp],
      ['HAD-06', 'nicardipine', 'Cardene', 'injection', '10 mg/10ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ระวังความดันโลหิตตกอย่างรวดเร็ว ตรวจวัด BP ทุก 5-15 นาที', true, timestamp],
      ['HAD-07', 'nitroglycerine', 'NTG', 'injection', '50 mg/10ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ใช้สายให้ยา Non-PVC ติดตาม BP อย่างสม่ำเสมอ', true, timestamp],
      ['HAD-08', 'adenosine', 'Adenocor', 'injection', '6 mg/2ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'Rapid IV push ตามด้วย NSS flush ทันที ติดตาม ECG', true, timestamp],
      ['HAD-09', 'amiodarone', 'Cordarone', 'injection', '150 mg/3ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ผสมใน D5W เท่านั้น ห้ามผสม NSS ติดตาม BP และ ECG', true, timestamp],
      ['HAD-10', 'cisatracurium', 'Nimbex', 'injection', '10 mg/5ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ยาหย่อนกล้ามเนื้อ ต้องมั่นใจว่าผู้ป่วยใส่ท่อช่วยหายใจแล้วเท่านั้น', true, timestamp],
      ['HAD-11', 'oxytocin', 'Syntocinon', 'injection', '10 unit/ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ควบคุมผ่าน Infusion pump ระวัง Uterine rupture / Fetal distress', true, timestamp],
      ['HAD-12', 'terbutaline', 'Bricanyl', 'injection', '0.5 mg/ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ระวัง Tachycardia, Tremor, Hypokalemia', true, timestamp],
      ['HAD-13', 'apixaban', 'Eliquis', 'tablet', '5 mg', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ยากลุ่ม NOAC ระวังภาวะเลือดออกผิดปกติ และปรับขนาดยาตามไต/อายุ/น้ำหนัก', true, timestamp],
      ['HAD-14', 'enoxaparin', 'Clexane', 'injection', '60 mg/0.6ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ฉีด Subcut บริเวณหน้าท้อง ห้ามไล่ฟองอากาศในเข็มสำเร็จรูป', true, timestamp],
      ['HAD-15', 'heparin', 'Unfractionated Heparin', 'injection', '25000 IU/5ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ติดตาม aPTT สม่ำเสมอ ระวังภาวะเลือดออกและ HIT', true, timestamp],
      ['HAD-16', 'streptokinase', 'Streptase', 'injection', '1.5 mIU/Vial', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ยาสลายลิ่มเลือด ระวัง Major bleeding และ Allergic reaction', true, timestamp],
      ['HAD-17', 'warfarin', 'Coumadin, Orfarin', 'tablet', '1 mg, 3 mg', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ติดตามค่า INR สม่ำเสมอ ระวัง Drug Interaction สูง', true, timestamp],
      ['HAD-18', '3% sodium chloride', '3% NaCl', 'sterile solution', '500 ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'โซเดียมเข้มข้นสูง ระวัง Hypernatremia / ODS ให้ผ่าน Infusion pump', true, timestamp],
      ['HAD-19', '10% calcium gluconate', 'Calcium gluconate', 'injection', '1 g/10ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ห้ามฉีดเร็ว อาจเกิด Cardiac arrest หรือ Extravasation necrosis', true, timestamp],
      ['HAD-20', 'magnesium sulfate', 'MgSO4', 'injection', '1 g/10ml (10%), 1 g/2ml (50%)', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ติดตาม DTR, RR, Urine output ระวัง Mg toxicity', true, timestamp],
      ['HAD-21', 'potassium chloride', 'KCl', 'injection', '20 mEq/10ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ห้าม IV push เด็ดขาด ต้องเจือจางและให้ผ่าน Infusion pump เท่านั้น', true, timestamp],
      ['HAD-22', 'regular insulin', 'Actrapid, Humulin R', 'injection', '1000 IU/10ml', 1, 'ยาที่มีช่วงความปลอดภัยแคบ / รุนแรงสูง', 'ระวัง Hypoglycemia ใช้เข็มฉีด Insulin โดยเฉพาะ', true, timestamp],

      // --- หมวดที่ 2: ยาเสพติดให้โทษประเภทที่ 2 และ วัตถุออกฤทธิ์ต่อจิตประสาทประเภท 2 (5 รายการ) ---
      ['HAD-23', 'fentanyl', 'Sublimaze', 'injection', '50 mcg/ml (2ml, 10ml)', 2, 'ยาเสพติดให้โทษประเภทที่ 2', 'กดการหายใจรุนแรง ต้องมี Naloxone พร้อมใช้', true, timestamp],
      ['HAD-24', 'morphine', 'Morphine sulfate', 'injection', '10 mg/ml', 2, 'ยาเสพติดให้โทษประเภทที่ 2', 'ติดตามอัตราการหายใจ (RR < 10/min) และระดับความรู้สึกตัว', true, timestamp],
      ['HAD-25', 'pethidine', 'Demerol', 'injection', '50 mg/ml', 2, 'ยาเสพติดให้โทษประเภทที่ 2', 'ระวังพิษสะสม Norpethidine ชักได้ หลีกเลี่ยงในผู้ป่วยไตบกพร่อง', true, timestamp],
      ['HAD-26', 'midazolam', 'Dormicum', 'injection', '5 mg/ml (1ml, 3ml)', 2, 'วัตถุออกฤทธิ์ต่อจิตประสาทประเภท 2', 'ระวัง Respiratory depression และ Sedation ลึกเกินไป', true, timestamp],
      ['HAD-27', 'ketamine', 'Ketalar', 'injection', '500 mg/10ml', 2, 'วัตถุออกฤทธิ์ต่อจิตประสาทประเภท 2', 'เฝ้าระวังความดันโลหิต ชีพจร และ Hallucination ขณะฟื้นตัว', true, timestamp],

      // --- หมวดที่ 3: ยาที่เกิดอุบัติการณ์ความคลาดเคลื่อนทางยาในระดับรุนแรง (2 รายการ) ---
      ['HAD-28', 'allopurinol', 'Zyloric', 'tablet', '100 mg', 3, 'ยาที่เกิดอุบัติการณ์ระดับรุนแรง', 'เสี่ยงแพ้ยารุนแรง SCARs/SJS/TEN ต้องตรวจยีน HLA-B*5801 และปรับตามไต', true, timestamp],
      ['HAD-29', 'phenytoin', 'Dilantin', 'oral, injection', 'oral 50 mg, 100 mg, inj 50mg/ml', 3, 'ยาที่เกิดอุบัติการณ์ระดับรุนแรง', 'ช่วงการรักษาแคบ ระวัง Purple glove syndrome, Arrythmia, Nystagmus, Ataxia', true, timestamp]
    ];
    var range = sheet.getRange(2, 1, initialHad.length, initialHad[0].length);
    range.setValues(initialHad);
  }
}

