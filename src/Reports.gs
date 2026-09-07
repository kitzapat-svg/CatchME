/**
 * CatchME — Medication Error Cat B Quick Reporter
 * Reports.gs — Backend Report Persistence & Query Operations
 */

/**
 * Saves a quick Cat B medication error report to ME_Log and Audit_Log.
 * Enforces Cat B safety rules (severity = B, patient_reached = No).
 *
 * @param {Object} reportData
 * @returns {Object} { success: boolean, recordId: string, createdAt: string, error?: string }
 */
function saveQuickReport(reportData) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 15 seconds to acquire lock
    lock.waitLock(15000);
  } catch (e) {
    return {
      success: false,
      error: 'ระบบกำลังมีการบันทึกข้อมูลพร้อมกัน กรุณาลองใหม่อีกครั้ง (Lock timeout)'
    };
  }

  try {
    if (!reportData) {
      throw new Error('ไม่พบข้อมูลสำหรับบันทึก');
    }

    // Safety check: Cat B hard stop verification
    if (reportData.catBEligible === false || reportData.patientReached === 'Yes') {
      throw new Error('เหตุการณ์นี้ยาถึงตัวผู้ป่วยแล้ว ไม่สามารถบันทึกเป็น Category B ได้');
    }

    var ss = getDatabaseSpreadsheet();
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    var auditSheet = ss.getSheetByName(DB_CONFIG.SHEETS.AUDIT_LOG);

    if (!meLogSheet) {
      setupDatabase();
      meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
      auditSheet = ss.getSheetByName(DB_CONFIG.SHEETS.AUDIT_LOG);
    }

    var recordId = Utilities.getUuid();
    var now = new Date();
    var nowIso = Utilities.formatDate(now, 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");

    var reporterAlias = String(reportData.reporterAlias || 'Anon').trim();
    var deviceSessionId = String(reportData.deviceSessionId || '').trim();
    var mode = String(reportData.mode || 'OPD').toUpperCase();

    // Row mapping according to DB_CONFIG.HEADERS.ME_LOG
    var newRow = [
      recordId,
      nowIso,
      mode,
      reporterAlias,
      deviceSessionId,
      reportData.rawTranscript || '',
      reportData.normalizedTranscript || '',
      reportData.parserVersion || '1.0.0',
      reportData.confidence || 'High',
      reportData.neededClarification ? 'Yes' : 'No',
      reportData.clarificationId || '',
      reportData.process || '',
      reportData.processStage || '',
      reportData.standardErrorCode || '',
      reportData.errorType || '',
      reportData.legacyCode || '',
      reportData.legacyEvent || '',
      reportData.detectedStage || '',
      reportData.drugName || (reportData.extractedEntities && reportData.extractedEntities.drugs ? reportData.extractedEntities.drugs.join(', ') : ''),
      reportData.strength || '',
      reportData.actual || '',
      reportData.expected || '',
      reportData.hn || '',
      reportData.an || '',
      reportData.wardClinic || '',
      'B',     // severity strictly B
      'No',    // patient_reached strictly No
      'Confirmed',
      nowIso,  // confirmed_at
      (reportData.confidence !== 'High') ? 'Yes' : 'No', // review_required
      '',      // reviewed_at
      ''       // reviewed_by
    ];

    meLogSheet.appendRow(newRow);

    // Audit Log Entry
    if (auditSheet) {
      var auditId = Utilities.getUuid();
      var auditRow = [
        auditId,
        nowIso,
        recordId,
        reporterAlias,
        deviceSessionId,
        'CREATE_REPORT',
        'ALL',
        '',
        JSON.stringify({
          legacyCode: reportData.legacyCode,
          errorType: reportData.errorType,
          mode: mode
        }),
        'QuickReporter'
      ];
      auditSheet.appendRow(auditRow);
    }

    return {
      success: true,
      recordId: recordId,
      createdAt: nowIso
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || String(err)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retrieves recent reports for the same device session.
 * Privacy-first: Does NOT expose hospital-wide reports.
 *
 * @param {string} deviceSessionId
 * @param {number} [limit=5]
 * @returns {Array<Object>}
 */
function getRecentReports(deviceSessionId, limit) {
  if (!deviceSessionId) return [];
  var maxItems = limit || 5;

  try {
    var ss = getDatabaseSpreadsheet();
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    if (!meLogSheet || meLogSheet.getLastRow() <= 1) return [];

    var lastRow = meLogSheet.getLastRow();
    // Read the recent 100 rows to find device session matches
    var startRow = Math.max(2, lastRow - 100);
    var numRows = lastRow - startRow + 1;
    var data = meLogSheet.getRange(startRow, 1, numRows, 32).getValues();

    var results = [];
    // Iterate from newest to oldest
    for (var i = data.length - 1; i >= 0; i--) {
      var row = data[i];
      var rowDeviceSession = String(row[4] || '');
      if (rowDeviceSession === deviceSessionId) {
        results.push({
          recordId: row[0],
          createdAt: row[1],
          mode: row[2],
          reporterAlias: row[3],
          legacyCode: row[15],
          errorType: row[14],
          process: row[11],
          drugName: row[18],
          actual: row[20],
          expected: row[21],
          status: row[27]
        });
        if (results.length >= maxItems) break;
      }
    }

    return results;
  } catch (e) {
    return [];
  }
}
