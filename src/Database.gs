/**
 * CatchME — Medication Error Cat B Quick Reporter
 * Database Operations & Sheet Schema Management
 */

const DB_CONFIG = {
  SHEETS: {
    ME_LOG: 'ME_Log',
    APP_SETTINGS: 'App_Settings',
    AUDIT_LOG: 'Audit_Log',
    DRUG_MASTER: 'Drug_Master'
  },
  HEADERS: {
    ME_LOG: [
      'record_id', 'created_at', 'mode', 'reporter_alias', 'device_session_id',
      'raw_transcript', 'normalized_transcript', 'parser_version', 'parser_confidence',
      'needed_clarification', 'clarification_id', 'process', 'process_stage_code',
      'standard_error_code', 'error_type_th', 'legacy_code', 'legacy_event',
      'detected_stage_code', 'drug_name', 'strength', 'actual_value', 'expected_value',
      'hn', 'an', 'ward_clinic', 'severity', 'patient_reached', 'status',
      'confirmed_at', 'review_required', 'reviewed_at', 'reviewed_by'
    ],
    APP_SETTINGS: ['setting_key', 'setting_value', 'description', 'updated_at'],
    AUDIT_LOG: [
      'audit_id', 'timestamp', 'record_id', 'reporter_alias', 'device_session_id',
      'action', 'field_name', 'old_value', 'new_value', 'source'
    ],
    DRUG_MASTER: [
      'drug_id', 'standard_name', 'strength', 'dosage_form', 'aliases', 'active', 'high_alert', 'notes'
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
