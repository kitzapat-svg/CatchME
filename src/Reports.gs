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
      '',      // reviewed_by
      (reportData.isLasa === true || reportData.isLasa === 'Yes') ? 'Yes' : 'No',
      reportData.lasaType || '',
      reportData.lasaPrescribed || '',
      reportData.lasaDispensed || '',
      reportData.lasaPairKey || '',
      reportData.tradeName || '',
      (reportData.isHad === true || reportData.isHad === 'Yes') ? 'Yes' : 'No',
      reportData.hadCategory || (reportData.hadDetails ? reportData.hadDetails.categoryName || reportData.hadDetails.category : ''),
      reportData.hadDrug || (reportData.hadDetails ? reportData.hadDetails.genericName : ''),
      '',      // void_reason
      ''       // updated_at
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
          mode: mode,
          isLasa: reportData.isLasa,
          isHad: reportData.isHad
        }),
        'QuickReporter'
      ];
      auditSheet.appendRow(auditRow);
    }

    // Real-time Telegram Safety Alert (Non-blocking)
    try {
      sendTelegramAlert(reportData, recordId, nowIso, mode, reporterAlias);
    } catch (alertErr) {
      console.warn('Telegram alert invocation failed:', alertErr);
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
 * @param {number} [limit=10]
 * @returns {Array<Object>}
 */
function getRecentReports(deviceSessionId, limit) {
  if (!deviceSessionId) return [];
  var maxItems = limit || 10;

  try {
    var ss = getDatabaseSpreadsheet();
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    if (!meLogSheet || meLogSheet.getLastRow() <= 1) return [];

    var lastRow = meLogSheet.getLastRow();
    // Read the recent 100 rows to find device session matches
    var startRow = Math.max(2, lastRow - 100);
    var numRows = lastRow - startRow + 1;
    var lastCol = Math.max(meLogSheet.getLastColumn(), 43);
    var data = meLogSheet.getRange(startRow, 1, numRows, lastCol).getValues();

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
          rawTranscript: row[5],
          legacyCode: row[15],
          errorType: row[14],
          process: row[11],
          drugName: row[18],
          strength: row[19],
          actual: row[20],
          expected: row[21],
          hn: row[22],
          an: row[23],
          wardClinic: row[24],
          status: row[27] || 'Confirmed',
          isLasa: (row[32] === 'Yes' || row[32] === true),
          lasaType: row[33] || '',
          lasaPairKey: row[36] || '',
          isHad: (row[38] === 'Yes' || row[38] === true),
          hadCategory: row[39] || '',
          hadDrug: row[40] || '',
          voidReason: row[41] || '',
          updatedAt: row[42] || '',
          reviewRequired: row[29] === 'Yes',
          reviewedAt: row[30] || '',
          reviewedBy: row[31] || ''
        });
        if (results.length >= maxItems) break;
      }
    }

    return results;
  } catch (e) {
    return [];
  }
}

/**
 * Retrieves the active LASA Master pairs from the LASA_Master sheet.
 * @returns {Array<Object>}
 */
function getLasaMasterList() {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(DB_CONFIG.SHEETS.LASA_MASTER);
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
    var list = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[9] === true || String(row[9]).toLowerCase() === 'true') { // active
        list.push({
          pairId: row[0],
          drug1: row[1],
          drug2: row[2],
          lasaType: row[3],
          scope: row[4],
          riskLevel: row[5],
          tallman1: row[6],
          tallman2: row[7],
          notes: row[8]
        });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

/**
 * Emerging LASA Surveillance:
 * Scans ME_Log for drug confusion pairs occurring frequently (count >= threshold)
 * that have not yet been enrolled in LASA_Master.
 *
 * @param {string} [mode] - 'OPD', 'IPD', or null for all
 * @param {number} [threshold=2] - Minimum occurrence count to flag
 * @returns {Array<Object>} List of emerging LASA pairs with count, last seen, and details
 */
function getEmergingLasaPairs(mode, threshold) {
  var minCount = (typeof threshold === 'number' && threshold > 0) ? threshold : 2;
  var filterMode = mode ? String(mode).toUpperCase() : null;

  try {
    var ss = getDatabaseSpreadsheet();
    var lasaSheet = ss.getSheetByName(DB_CONFIG.SHEETS.LASA_MASTER);
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);

    if (!meLogSheet || meLogSheet.getLastRow() <= 1) {
      return [];
    }

    // 1. Gather all existing pairs in LASA_Master (normalize keys)
    var masterKeys = {};
    if (lasaSheet && lasaSheet.getLastRow() > 1) {
      var lasaData = lasaSheet.getRange(2, 1, lasaSheet.getLastRow() - 1, 11).getValues();
      for (var m = 0; m < lasaData.length; m++) {
        var d1 = String(lasaData[m][1] || '').trim().toLowerCase();
        var d2 = String(lasaData[m][2] || '').trim().toLowerCase();
        if (d1 && d2) {
          var k = [d1, d2].sort().join('_');
          masterKeys[k] = true;
        }
      }
    }

    // 2. Scan ME_Log rows
    // Headers:
    // 0: record_id, 1: timestamp, 2: mode, 14: error_type, 15: legacy_code, 18: drug_name,
    // 20: actual_value, 21: expected_value, 32: is_lasa, 33: lasa_type, 34: lasa_prescribed,
    // 35: lasa_dispensed, 36: lasa_pair_key, 37: trade_name
    var lastRow = meLogSheet.getLastRow();
    var logData = meLogSheet.getRange(2, 1, lastRow - 1, 38).getValues();

    var candidates = {};

    for (var i = 0; i < logData.length; i++) {
      var row = logData[i];
      var rowMode = String(row[2] || '').toUpperCase();
      if (filterMode && rowMode !== filterMode) continue;

      var legacyCode = String(row[15] || '').toUpperCase();
      var isLasa = String(row[32] || '').toLowerCase() === 'yes';
      var lasaPairKey = String(row[36] || '').trim().toLowerCase();
      var actualVal = String(row[20] || '').trim();
      var expectedVal = String(row[21] || '').trim();
      var drugName = String(row[18] || '').trim();
      var timestamp = row[1];
      var rawTranscript = String(row[5] || '');
      var lasaType = String(row[33] || 'Look-alike');

      // Check if this error qualifies as drug confusion / wrong drug
      var isConfusionError = isLasa ||
        lasaPairKey !== '' ||
        legacyCode === 'B26' || legacyCode === 'B28' ||
        legacyCode === 'B03' || legacyCode === 'A03' ||
        legacyCode === 'A05' || legacyCode === 'E08';

      if (!isConfusionError) continue;

      // Determine the pair key and drug names
      var key = '';
      var dA = '';
      var dB = '';

      if (lasaPairKey) {
        key = lasaPairKey;
        dA = String(row[35] || actualVal || '').trim();
        dB = String(row[34] || expectedVal || '').trim();
      } else if (actualVal && expectedVal && actualVal.toLowerCase() !== expectedVal.toLowerCase()) {
        key = [actualVal.toLowerCase(), expectedVal.toLowerCase()].sort().join('_');
        dA = actualVal;
        dB = expectedVal;
      } else if (drugName && drugName.indexOf(',') !== -1) {
        var parts = drugName.split(',').map(function (s) { return s.trim(); });
        if (parts.length >= 2) {
          key = [parts[0].toLowerCase(), parts[1].toLowerCase()].sort().join('_');
          dA = parts[0];
          dB = parts[1];
        }
      }

      if (!key) continue;

      // Check if already in LASA_Master
      if (masterKeys[key]) continue;

      if (!candidates[key]) {
        candidates[key] = {
          pairKey: key,
          drug1: dA || key.split('_')[0],
          drug2: dB || key.split('_')[1],
          count: 0,
          mode: rowMode,
          lasaType: lasaType || 'Look-alike',
          riskLevel: (/high alert|had|ยากลุ่มเสี่ยง/i.test(rawTranscript) ? 'High Alert Drug' : 'Standard'),
          lastSeen: timestamp,
          samples: []
        };
      }

      candidates[key].count++;
      if (timestamp > candidates[key].lastSeen) {
        candidates[key].lastSeen = timestamp;
      }
      if (candidates[key].samples.length < 3 && rawTranscript) {
        candidates[key].samples.push(rawTranscript);
      }
    }

    // Filter by threshold
    var resultList = [];
    for (var k in candidates) {
      if (candidates[k].count >= minCount) {
        resultList.push(candidates[k]);
      }
    }

    // Sort descending by count, then by lastSeen
    resultList.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return (b.lastSeen > a.lastSeen) ? 1 : -1;
    });

    return resultList;
  } catch (err) {
    return [];
  }
}

/**
 * Promotes an emerging drug pair directly into the LASA_Master sheet.
 *
 * @param {Object} pairData { drug1, drug2, lasaType, scope, riskLevel, tallman1, tallman2, notes }
 * @returns {Object} { success: boolean, pairId?: string, message?: string, error?: string }
 */
function promoteEmergingToLasaMaster(pairData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: 'ระบบไม่สามารถเข้าถึงฐานข้อมูลพร้อมกันได้ (Lock timeout)' };
  }

  try {
    if (!pairData || !pairData.drug1 || !pairData.drug2) {
      throw new Error('กรุณาระบุชื่อยาคู่ให้ครบถ้วนทั้ง 2 รายการ');
    }

    var ss = getDatabaseSpreadsheet();
    var lasaSheet = ss.getSheetByName(DB_CONFIG.SHEETS.LASA_MASTER);
    var auditSheet = ss.getSheetByName(DB_CONFIG.SHEETS.AUDIT_LOG);

    if (!lasaSheet) {
      setupDatabase();
      lasaSheet = ss.getSheetByName(DB_CONFIG.SHEETS.LASA_MASTER);
      auditSheet = ss.getSheetByName(DB_CONFIG.SHEETS.AUDIT_LOG);
    }

    var scope = String(pairData.scope || 'OPD').toUpperCase();
    var now = new Date();
    var nowIso = Utilities.formatDate(now, 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Generate next pairId: e.g. LASA-OPD-11 or LASA-IPD-06
    var prefix = 'LASA-' + scope + '-';
    var maxIndex = 0;
    if (lasaSheet.getLastRow() > 1) {
      var ids = lasaSheet.getRange(2, 1, lasaSheet.getLastRow() - 1, 1).getValues();
      for (var r = 0; r < ids.length; r++) {
        var strId = String(ids[r][0] || '');
        if (strId.indexOf(prefix) === 0) {
          var num = parseInt(strId.substring(prefix.length), 10);
          if (!isNaN(num) && num > maxIndex) {
            maxIndex = num;
          }
        }
      }
    }

    var nextNum = maxIndex + 1;
    var newPairId = prefix + (nextNum < 10 ? '0' + nextNum : nextNum);

    var drug1 = String(pairData.drug1).trim();
    var drug2 = String(pairData.drug2).trim();
    var tallman1 = String(pairData.tallman1 || drug1).trim();
    var tallman2 = String(pairData.tallman2 || drug2).trim();
    var lasaType = pairData.lasaType || 'Look-alike';
    var riskLevel = pairData.riskLevel || 'Standard';
    var notes = pairData.notes || 'ตรวจพบจากระบบตรวจจับคู่ยาเสี่ยงใหม่อัตโนมัติ (Emerging LASA Surveillance)';

    var newRow = [
      newPairId,
      drug1.toLowerCase(),
      drug2.toLowerCase(),
      lasaType,
      scope,
      riskLevel,
      tallman1,
      tallman2,
      notes,
      true, // active
      nowIso
    ];

    lasaSheet.appendRow(newRow);

    // Audit log
    if (auditSheet) {
      auditSheet.appendRow([
        Utilities.getUuid(),
        nowIso,
        newPairId,
        'SYSTEM_SURVEILLANCE',
        '',
        'PROMOTE_EMERGING_LASA',
        'LASA_Master',
        '',
        JSON.stringify({ pairId: newPairId, drug1: drug1, drug2: drug2, scope: scope }),
        'EmergingLASASurveillance'
      ]);
    }

    return {
      success: true,
      pairId: newPairId,
      message: 'บรรจุคู่ยา ' + tallman1 + ' ⇄ ' + tallman2 + ' (' + newPairId + ') สู่บัญชีคู่ยา LASA Master ของโรงพยาบาลสำเร็จ'
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
 * Retrieves active Sawankhalok Hospital High Alert Drugs from HAD_Master sheet.
 * @returns {Array<Object>}
 */
function getHadMasterList() {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(DB_CONFIG.SHEETS.HAD_MASTER);
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
    var list = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[8] === true || String(row[8]).toLowerCase() === 'true') { // active
        list.push({
          hadId: row[0],
          genericName: row[1],
          tradeNames: row[2],
          dosageForm: row[3],
          strengths: row[4],
          categoryNo: row[5],
          categoryName: row[6],
          alertMessage: row[7]
        });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

/**
 * Retrieves full details for a single medication error report by recordId.
 * @param {string} recordId
 * @returns {Object|null}
 */
function getReportDetail(recordId) {
  if (!recordId) return null;
  try {
    var ss = getDatabaseSpreadsheet();
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    if (!meLogSheet || meLogSheet.getLastRow() <= 1) return null;

    var data = meLogSheet.getDataRange().getValues();
    var report = null;
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(recordId)) {
        var r = data[i];
        rowIndex = i + 1;
        report = {
          recordId: r[0],
          createdAt: r[1],
          mode: r[2],
          reporterAlias: r[3],
          deviceSessionId: r[4],
          rawTranscript: r[5],
          normalizedTranscript: r[6],
          parserVersion: r[7],
          confidence: r[8],
          neededClarification: r[9] === 'Yes',
          clarificationId: r[10],
          process: r[11],
          processStage: r[12],
          standardErrorCode: r[13],
          errorType: r[14],
          legacyCode: r[15],
          legacyEvent: r[16],
          detectedStage: r[17],
          drugName: r[18],
          strength: r[19],
          actual: r[20],
          expected: r[21],
          hn: r[22],
          an: r[23],
          wardClinic: r[24],
          severity: r[25],
          patientReached: r[26],
          status: r[27] || 'Confirmed',
          confirmedAt: r[28],
          reviewRequired: r[29] === 'Yes',
          reviewedAt: r[30],
          reviewedBy: r[31],
          isLasa: (r[32] === 'Yes' || r[32] === true),
          lasaType: r[33],
          lasaPrescribed: r[34],
          lasaDispensed: r[35],
          lasaPairKey: r[36],
          tradeName: r[37],
          isHad: (r[38] === 'Yes' || r[38] === true),
          hadCategory: r[39],
          hadDrug: r[40],
          voidReason: r[41] || '',
          updatedAt: r[42] || ''
        };
        break;
      }
    }

    if (!report) return null;

    // Check if ME_Review has a review for this record
    var reviewSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_REVIEW);
    if (reviewSheet && reviewSheet.getLastRow() > 1) {
      var rData = reviewSheet.getDataRange().getValues();
      for (var j = 1; j < rData.length; j++) {
        if (String(rData[j][1]) === String(recordId)) {
          var rv = rData[j];
          report.review = {
            reviewId: rv[0],
            reviewedAt: rv[2],
            reviewedBy: rv[3],
            lasa: rv[4],
            lasaPair: rv[5],
            had: rv[6],
            hadDrug: rv[7],
            contributingFactors: rv[8],
            rootCauseNote: rv[9],
            immediateAction: rv[10],
            correctiveAction: rv[11],
            followUpRequired: rv[12],
            followUpDue: rv[13],
            reviewStatus: rv[14],
            reviewNote: rv[15]
          };
          break;
        }
      }
    }

    return report;
  } catch (e) {
    return null;
  }
}

/**
 * Updates editable fields of a report (HN, AN, Ward/Clinic, Drug Name, Strength, Notes).
 * Enforces same device session scoping unless authorized.
 *
 * @param {string} recordId
 * @param {Object} updateData
 * @param {string} deviceSessionId
 * @param {string} reporterAlias
 * @returns {Object}
 */
function updateReport(recordId, updateData, deviceSessionId, reporterAlias) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: 'ระบบไม่สามารถเข้าถึงฐานข้อมูลได้ชั่วคราว (Lock timeout)' };
  }

  try {
    if (!recordId || !updateData) {
      throw new Error('ไม่พบข้อมูลสำหรับอัปเดต');
    }

    var ss = getDatabaseSpreadsheet();
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    var auditSheet = ss.getSheetByName(DB_CONFIG.SHEETS.AUDIT_LOG);

    if (!meLogSheet || meLogSheet.getLastRow() <= 1) {
      throw new Error('ไม่พบรายการข้อมูลในฐานข้อมูล');
    }

    var data = meLogSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var originalRow = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(recordId)) {
        targetRowIndex = i + 1; // 1-indexed
        originalRow = data[i];
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error('ไม่พบรายงาน ID: ' + recordId);
    }

    // Device session scoping check
    var existingDeviceSession = String(originalRow[4] || '');
    if (deviceSessionId && existingDeviceSession && existingDeviceSession !== deviceSessionId) {
      throw new Error('ท่านไม่มีสิทธิ์แก้ไขรายงานที่สร้างจากอุปกรณ์เครื่องอื่น');
    }

    // Check if report is already VOID
    if (originalRow[27] === 'VOID') {
      throw new Error('รายงานนี้ถูกยกเลิก (VOID) แล้ว ไม่สามารถแก้ไขได้');
    }

    var nowIso = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Update allowable fields:
    // col 19: drug_name, col 20: strength, col 21: actual, col 22: expected
    // col 23: hn, col 24: an, col 25: ward_clinic
    // col 43: updated_at
    if (updateData.drugName !== undefined) meLogSheet.getRange(targetRowIndex, 19).setValue(updateData.drugName);
    if (updateData.strength !== undefined) meLogSheet.getRange(targetRowIndex, 20).setValue(updateData.strength);
    if (updateData.actual !== undefined) meLogSheet.getRange(targetRowIndex, 21).setValue(updateData.actual);
    if (updateData.expected !== undefined) meLogSheet.getRange(targetRowIndex, 22).setValue(updateData.expected);
    if (updateData.hn !== undefined) meLogSheet.getRange(targetRowIndex, 23).setValue(updateData.hn);
    if (updateData.an !== undefined) meLogSheet.getRange(targetRowIndex, 24).setValue(updateData.an);
    if (updateData.wardClinic !== undefined) meLogSheet.getRange(targetRowIndex, 25).setValue(updateData.wardClinic);
    meLogSheet.getRange(targetRowIndex, 43).setValue(nowIso);

    // Audit log entry
    if (auditSheet) {
      auditSheet.appendRow([
        Utilities.getUuid(),
        nowIso,
        recordId,
        reporterAlias || originalRow[3],
        deviceSessionId || existingDeviceSession,
        'UPDATE_REPORT',
        'MULTI_FIELDS',
        JSON.stringify({
          hn: originalRow[22],
          an: originalRow[23],
          wardClinic: originalRow[24],
          drugName: originalRow[18]
        }),
        JSON.stringify(updateData),
        'QuickReporter_Edit'
      ]);
    }

    return {
      success: true,
      recordId: recordId,
      updatedAt: nowIso,
      message: 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว'
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
 * Marks a medication error report as VOID (cancelled).
 * Preserves audit trail — does NOT delete database row.
 *
 * @param {string} recordId
 * @param {string} reason
 * @param {string} deviceSessionId
 * @param {string} reporterAlias
 * @returns {Object}
 */
function voidReport(recordId, reason, deviceSessionId, reporterAlias) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: 'ระบบไม่สามารถเข้าถึงฐานข้อมูลได้ชั่วคราว (Lock timeout)' };
  }

  try {
    if (!recordId) {
      throw new Error('ไม่พบรหัสรายงาน');
    }
    if (!reason || !String(reason).trim()) {
      throw new Error('กรุณาระบุเหตุผลในการยกเลิกรายงาน (VOID)');
    }

    var ss = getDatabaseSpreadsheet();
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    var auditSheet = ss.getSheetByName(DB_CONFIG.SHEETS.AUDIT_LOG);

    if (!meLogSheet || meLogSheet.getLastRow() <= 1) {
      throw new Error('ไม่พบรายการข้อมูลในฐานข้อมูล');
    }

    var data = meLogSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var originalRow = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(recordId)) {
        targetRowIndex = i + 1;
        originalRow = data[i];
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error('ไม่พบรายงาน ID: ' + recordId);
    }

    var existingDeviceSession = String(originalRow[4] || '');
    if (deviceSessionId && existingDeviceSession && existingDeviceSession !== deviceSessionId) {
      throw new Error('ท่านไม่มีสิทธิ์ยกเลิกรายงานที่สร้างจากอุปกรณ์เครื่องอื่น');
    }

    if (originalRow[27] === 'VOID') {
      return { success: true, message: 'รายงานนี้ถูกยกเลิกแล้วก่อนหน้านี้' };
    }

    var nowIso = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Col 28: status -> 'VOID'
    // Col 42: void_reason -> reason
    // Col 43: updated_at -> nowIso
    meLogSheet.getRange(targetRowIndex, 28).setValue('VOID');
    meLogSheet.getRange(targetRowIndex, 42).setValue(String(reason).trim());
    meLogSheet.getRange(targetRowIndex, 43).setValue(nowIso);

    // Audit log entry
    if (auditSheet) {
      auditSheet.appendRow([
        Utilities.getUuid(),
        nowIso,
        recordId,
        reporterAlias || originalRow[3],
        deviceSessionId || existingDeviceSession,
        'VOID_REPORT',
        'status',
        originalRow[27],
        'VOID (เหตุผล: ' + String(reason).trim() + ')',
        'QuickReporter_Void'
      ]);
    }

    return {
      success: true,
      recordId: recordId,
      status: 'VOID',
      message: 'ยกเลิกรายงาน (VOID) เรียบร้อยแล้ว'
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
 * Saves a Medication Safety Review from Pharmacist Reviewer into ME_Review sheet
 * and updates ME_Log review columns.
 *
 * @param {Object} reviewData
 * @returns {Object}
 */
function saveMedicationReview(reviewData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: 'ระบบไม่สามารถเข้าถึงฐานข้อมูลได้ชั่วคราว (Lock timeout)' };
  }

  try {
    if (!reviewData || !reviewData.recordId) {
      throw new Error('ไม่พบข้อมูลเคสสำหรับบันทึกการทบทวน');
    }

    var ss = getDatabaseSpreadsheet();
    var reviewSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_REVIEW);
    var meLogSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    var auditSheet = ss.getSheetByName(DB_CONFIG.SHEETS.AUDIT_LOG);

    if (!reviewSheet) {
      setupDatabase();
      reviewSheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_REVIEW);
    }

    var reviewId = 'rv-' + Utilities.getUuid().substring(0, 8);
    var nowIso = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");
    var reviewer = String(reviewData.reviewedBy || 'Pharmacist Reviewer').trim();

    var newReviewRow = [
      reviewId,
      reviewData.recordId,
      nowIso,
      reviewer,
      reviewData.lasa === true || reviewData.lasa === 'Yes',
      reviewData.lasaPair || '',
      reviewData.had === true || reviewData.had === 'Yes',
      reviewData.hadDrug || '',
      Array.isArray(reviewData.contributingFactors) ? reviewData.contributingFactors.join('; ') : (reviewData.contributingFactors || ''),
      reviewData.rootCauseNote || '',
      reviewData.immediateAction || '',
      reviewData.correctiveAction || '',
      reviewData.followUpRequired === true || reviewData.followUpRequired === 'Yes',
      reviewData.followUpDue || '',
      reviewData.reviewStatus || 'CLOSED',
      reviewData.reviewNote || ''
    ];

    reviewSheet.appendRow(newReviewRow);

    // Update ME_Log row
    if (meLogSheet && meLogSheet.getLastRow() > 1) {
      var data = meLogSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(reviewData.recordId)) {
          var targetRow = i + 1;
          meLogSheet.getRange(targetRow, 30).setValue('No'); // review_required satisfied
          meLogSheet.getRange(targetRow, 31).setValue(nowIso); // reviewed_at
          meLogSheet.getRange(targetRow, 32).setValue(reviewer); // reviewed_by
          if (reviewData.reviewStatus === 'CLOSED') {
            meLogSheet.getRange(targetRow, 28).setValue('Reviewed'); // status
          }
          meLogSheet.getRange(targetRow, 43).setValue(nowIso); // updated_at
          break;
        }
      }
    }

    // Audit log entry
    if (auditSheet) {
      auditSheet.appendRow([
        Utilities.getUuid(),
        nowIso,
        reviewData.recordId,
        reviewer,
        '',
        'SAVE_REVIEW',
        'ME_Review',
        '',
        JSON.stringify({
          reviewId: reviewId,
          reviewStatus: reviewData.reviewStatus,
          had: reviewData.had,
          lasa: reviewData.lasa
        }),
        'MedicationSafetyReviewer'
      ]);
    }

    return {
      success: true,
      reviewId: reviewId,
      reviewedAt: nowIso,
      message: 'บันทึกผลการทบทวนความปลอดภัยทางยาเรียบร้อยแล้ว'
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

// ============================================================================
// PHASE 3: REAL-TIME SAFETY ALERTING (TELEGRAM BOT API) & ANALYTICS
// ============================================================================

/**
 * Escapes characters for Telegram HTML parse mode.
 */
function escapeTelegramHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Gets a specific setting value from App_Settings.
 */
function getAppSettingValue(key, defaultValue) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(DB_CONFIG.SHEETS.APP_SETTINGS);
    if (!sheet || sheet.getLastRow() <= 1) return defaultValue;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        var val = data[i][1];
        return (val != null && String(val).trim() !== '') ? String(val).trim() : defaultValue;
      }
    }
  } catch (e) {
    console.warn('getAppSettingValue error:', e);
  }
  return defaultValue;
}

/**
 * Verifies the 4-digit admin PIN.
 */
function verifyAdminPin(inputPin) {
  var actualPin = getAppSettingValue('admin_pin', '8888');
  if (String(inputPin).trim() === actualPin) {
    return { success: true };
  }
  return { success: false, error: 'รหัส PIN ไม่ถูกต้อง' };
}

/**
 * Sends a real-time safety alert to Telegram when criteria is met.
 * Non-blocking, fails gracefully.
 */
function sendTelegramAlert(reportData, recordId, timestamp, mode, reporterAlias) {
  try {
    var isEnabled = getAppSettingValue('alert_enabled', 'false') === 'true';
    if (!isEnabled) return;

    var hadOnly = getAppSettingValue('alert_had_only', 'true') === 'true';
    var isHad = reportData.isHad === true || reportData.isHad === 'Yes';

    // If alert_had_only is true, skip alert for non-HAD records
    if (hadOnly && !isHad) return;

    var botToken = getAppSettingValue('telegram_bot_token', '');
    var chatId = getAppSettingValue('telegram_chat_id', '');
    if (!botToken || !chatId) return;

    var deptName = (mode === 'IPD') ? 'IPD (ห้องยาผู้ป่วยใน)' : 'OPD (ห้องยาผู้ป่วยนอก)';
    var hadDrug = reportData.hadDrug || (reportData.hadDetails ? reportData.hadDetails.genericName : '') || '-';
    var hadCat = reportData.hadCategory || (reportData.hadDetails ? (reportData.hadDetails.categoryName || reportData.hadDetails.category) : '') || '-';
    var errorDesc = (reportData.legacyCode ? reportData.legacyCode + ' | ' : '') + (reportData.errorType || '-');
    var details = reportData.rawTranscript || reportData.normalizedTranscript || '-';
    var reporter = reporterAlias || 'ไม่ระบุ';

    var dateFormatted = Utilities.formatDate(new Date(timestamp || new Date()), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm น.');

    var msg = '🚨 <b>[CatchME Safety Alert] ' + (isHad ? 'ตรวจพบ Near Miss ยาความเสี่ยงสูง (HAD)!' : 'รายงาน Near Miss (Cat B)!') + '</b>\n\n' +
      '🏥 <b>หน่วยงาน:</b> ' + escapeTelegramHtml(deptName) + '\n' +
      (isHad ? ('💊 <b>ยา HAD:</b> ' + escapeTelegramHtml(hadDrug) + ' (' + escapeTelegramHtml(hadCat) + ')\n') : '') +
      '⚠️ <b>ข้อผิดพลาด:</b> ' + escapeTelegramHtml(errorDesc) + '\n' +
      '🔍 <b>รายละเอียด:</b> ' + escapeTelegramHtml(details) + '\n' +
      '👤 <b>ผู้ตรวจพบ:</b> ' + escapeTelegramHtml(reporter) + '\n' +
      '⏰ <b>เวลา:</b> ' + dateFormatted + '\n' +
      '✅ <b>สถานะ:</b> ดักจับได้สำเร็จ (Category B / ไม่ถึงตัวผู้ป่วย)';

    var url = 'https://api.telegram.org/bot' + botToken + '/sendMessage';
    var payload = {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.warn('sendTelegramAlert non-blocking error:', err);
  }
}

/**
 * Tests Telegram bot alert connection.
 */
function testTelegramAlert(token, chatId) {
  try {
    var tToken = (token || getAppSettingValue('telegram_bot_token', '')).trim();
    var tChatId = (chatId || getAppSettingValue('telegram_chat_id', '')).trim();

    if (!tToken || !tChatId) {
      return { success: false, error: 'กรุณาระบุ Telegram Bot Token และ Chat ID ให้ครบถ้วน' };
    }

    var nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss น.');
    var msg = '🔔 <b>[CatchME] ทดสอบการเชื่อมต่อระบบแจ้งเตือนสำเร็จ!</b>\n\n' +
      'ระบบ CatchME เชื่อมต่อกับ Telegram Bot เรียบร้อยแล้ว พร้อมส่งการแจ้งเตือนความปลอดภัยทางยาอัตโนมัติเมื่อตรวจพบ Near Miss ยาความเสี่ยงสูง (HAD)\n\n' +
      '⏰ <i>' + nowStr + '</i>';

    var url = 'https://api.telegram.org/bot' + tToken + '/sendMessage';
    var payload = {
      chat_id: tChatId,
      text: msg,
      parse_mode: 'HTML'
    };

    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var resCode = res.getResponseCode();
    var resText = res.getContentText();
    var parsed = JSON.parse(resText);

    if (resCode === 200 && parsed.ok) {
      return { success: true, message: 'ส่งข้อความทดสอบไปยัง Telegram สำเร็จแล้ว' };
    } else {
      return { success: false, error: 'Telegram API Error (' + resCode + '): ' + (parsed.description || resText) };
    }
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Aggregates safety analytics data from ME_Log.
 */
function getSafetyAnalytics(timeRange, filterMode, pin) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        success: true,
        summary: {
          totalNearMiss: 0,
          hadCount: 0,
          lasaCount: 0,
          topStage: '-',
          opdCount: 0,
          ipdCount: 0,
          stages: { Prescribing: 0, Transcribing: 0, 'Pre-dispensing': 0, Other: 0 },
          topErrors: [],
          hadBreakdown: { cat1: 0, cat2: 0, cat3: 0, topDrugs: [] },
          reviewedCount: 0,
          voidCount: 0
        }
      };
    }

    var data = sheet.getDataRange().getValues();
    var now = new Date();
    var cutoff = null;

    if (timeRange === '7d') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'month') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    var total = 0;
    var hadCount = 0;
    var lasaCount = 0;
    var opdCount = 0;
    var ipdCount = 0;
    var voidCount = 0;
    var reviewedCount = 0;
    var stages = { Prescribing: 0, Transcribing: 0, 'Pre-dispensing': 0, Other: 0 };
    var errorCounts = {};
    var hadCatCounts = { cat1: 0, cat2: 0, cat3: 0 };
    var hadDrugCounts = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var createdAt = new Date(row[1]);
      var rowMode = String(row[2] || '').toUpperCase();
      var voidReason = String(row[41] || '').trim();

      // Time Filter
      if (cutoff && createdAt < cutoff) continue;

      // Mode Filter
      if (filterMode && filterMode !== 'ALL' && rowMode !== filterMode.toUpperCase()) continue;

      if (voidReason !== '') {
        voidCount++;
        continue; // Do not count voided cases in safety stats
      }

      total++;
      if (rowMode === 'IPD') ipdCount++; else opdCount++;

      // Process stage
      var proc = String(row[11] || '').trim();
      var code = String(row[15] || '').trim();
      if (proc === 'Prescribing' || /^A\d+/i.test(code)) {
        stages.Prescribing++;
      } else if (proc === 'Transcribing' || /^E\d+/i.test(code)) {
        stages.Transcribing++;
      } else if (proc === 'Pre-dispensing' || /^B\d+/i.test(code)) {
        stages['Pre-dispensing']++;
      } else {
        stages.Other++;
      }

      // HAD
      var isHad = row[38] === true || String(row[38]).toLowerCase() === 'yes';
      if (isHad) {
        hadCount++;
        var hadCat = String(row[39] || '');
        var hadDrug = String(row[40] || '').trim();
        if (/กลุ่มที่ 1|หมวดที่ 1|รุนแรงสูง|แคบ/i.test(hadCat)) hadCatCounts.cat1++;
        else if (/กลุ่มที่ 2|หมวดที่ 2|เสพติด|จิตประสาท/i.test(hadCat)) hadCatCounts.cat2++;
        else if (/กลุ่มที่ 3|หมวดที่ 3|scar|รุนแรง/i.test(hadCat)) hadCatCounts.cat3++;
        else hadCatCounts.cat1++;

        if (hadDrug) {
          hadDrugCounts[hadDrug] = (hadDrugCounts[hadDrug] || 0) + 1;
        }
      }

      // LASA
      var isLasa = row[32] === true || String(row[32]).toLowerCase() === 'yes';
      if (isLasa) lasaCount++;

      // Error Type
      var errLabel = (code ? code + ': ' : '') + String(row[14] || 'ไม่ระบุ');
      errorCounts[errLabel] = (errorCounts[errLabel] || 0) + 1;

      // Review Status
      var reviewReq = String(row[29] || '').toLowerCase() === 'yes';
      var reviewedAt = String(row[30] || '').trim();
      if (reviewedAt !== '') reviewedCount++;
    }

    // Sort top errors
    var topErrors = [];
    for (var err in errorCounts) {
      topErrors.push({ name: err, count: errorCounts[err] });
    }
    topErrors.sort(function (a, b) { return b.count - a.count; });
    topErrors = topErrors.slice(0, 5);

    // Sort top HAD drugs
    var topHadDrugs = [];
    for (var d in hadDrugCounts) {
      topHadDrugs.push({ name: d, count: hadDrugCounts[d] });
    }
    topHadDrugs.sort(function (a, b) { return b.count - a.count; });
    topHadDrugs = topHadDrugs.slice(0, 5);

    // Find top stage
    var maxStageCount = 0;
    var topStage = '-';
    for (var s in stages) {
      if (stages[s] > maxStageCount) {
        maxStageCount = stages[s];
        topStage = s;
      }
    }

    return {
      success: true,
      summary: {
        totalNearMiss: total,
        hadCount: hadCount,
        lasaCount: lasaCount,
        topStage: topStage,
        opdCount: opdCount,
        ipdCount: ipdCount,
        stages: stages,
        topErrors: topErrors,
        hadBreakdown: {
          cat1: hadCatCounts.cat1,
          cat2: hadCatCounts.cat2,
          cat3: hadCatCounts.cat3,
          topDrugs: topHadDrugs
        },
        reviewedCount: reviewedCount,
        voidCount: voidCount
      }
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Generates and exports report data as UTF-8 BOM CSV.
 */
function exportReportsCsv(timeRange, filterMode, pin) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(DB_CONFIG.SHEETS.ME_LOG);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, error: 'ยังไม่มีข้อมูลรายงานในระบบ' };
    }

    var data = sheet.getDataRange().getValues();
    var now = new Date();
    var cutoff = null;

    if (timeRange === '7d') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'month') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    var csvHeaders = [
      'Record ID', 'วันที่-เวลา', 'แผนก', 'ผู้รายงาน', 'HN', 'AN', 'หอผู้ป่วย/คลินิก',
      'ขั้นตอนเกิดเหตุ', 'รหัสความเสี่ยง', 'รายละเอียดความคลาดเคลื่อน', 'รหัส DS',
      'ชื่อยา', 'ความแรง', 'ค่า/จำนวนที่จัดหรือสั่งจริง', 'ค่า/จำนวนที่ถูกต้อง',
      'ตรวจพบยา HAD', 'หมวดยา HAD', 'ชื่อยา HAD', 'ตรวจพบยา LASA', 'คู่ยา LASA',
      'สถานะการทบทวน', 'วันที่ทบทวน', 'ผู้ทบทวน', 'สถานะยกเลิก (VOID)', 'เหตุผลที่ยกเลิก'
    ];

    var csvRows = [csvHeaders];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var createdAt = new Date(row[1]);
      var rowMode = String(row[2] || '').toUpperCase();

      // Time filter
      if (cutoff && createdAt < cutoff) continue;

      // Mode filter
      if (filterMode && filterMode !== 'ALL' && rowMode !== filterMode.toUpperCase()) continue;

      var formattedDate = Utilities.formatDate(createdAt, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

      var csvRow = [
        row[0], // record_id
        formattedDate,
        row[2], // mode
        row[3], // reporter_alias
        row[22], // hn
        row[23], // an
        row[24], // ward_clinic
        row[11], // process
        row[15], // legacy_code
        row[14], // error_type_th
        row[17], // detected_stage_code
        row[18], // drug_name
        row[19], // strength
        row[20], // actual_value
        row[21], // expected_value
        row[38], // is_had
        row[39], // had_category
        row[40], // had_drug
        row[32], // is_lasa
        row[36], // lasa_pair_key
        row[27], // status
        row[30] ? Utilities.formatDate(new Date(row[30]), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss') : '', // reviewed_at
        row[31], // reviewed_by
        row[41] ? 'VOID' : 'ACTIVE', // void status
        row[41] // void_reason
      ];

      csvRows.push(csvRow);
    }

    // Build CSV string with UTF-8 BOM
    var csvContent = '\uFEFF' + csvRows.map(function (r) {
      return r.map(function (field) {
        var str = String(field == null ? '' : field).replace(/"/g, '""');
        if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
          return '"' + str + '"';
        }
        return str;
      }).join(',');
    }).join('\r\n');

    return {
      success: true,
      csvContent: csvContent,
      filename: 'CatchME_Quality_Report_' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd_HHmmss') + '.csv',
      rowCount: csvRows.length - 1
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Gets application settings for the authenticated admin.
 */
function getAppSettings(pin) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return { success: false, error: auth.error };

  return {
    success: true,
    settings: {
      alertEnabled: getAppSettingValue('alert_enabled', 'false') === 'true',
      alertHadOnly: getAppSettingValue('alert_had_only', 'true') === 'true',
      telegramBotToken: getAppSettingValue('telegram_bot_token', ''),
      telegramChatId: getAppSettingValue('telegram_chat_id', ''),
      adminPin: getAppSettingValue('admin_pin', '8888')
    }
  };
}

/**
 * Updates application settings from the authenticated admin.
 */
function updateAppSettings(settingsObj, pin) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(DB_CONFIG.SHEETS.APP_SETTINGS);
    if (!sheet) return { success: false, error: 'ไม่พบชีต App_Settings' };

    var nowIso = new Date().toISOString();
    var data = sheet.getDataRange().getValues();
    var keyRowMap = {};

    for (var i = 1; i < data.length; i++) {
      keyRowMap[String(data[i][0]).trim()] = i + 1;
    }

    function setKey(k, val, desc) {
      if (keyRowMap[k]) {
        sheet.getRange(keyRowMap[k], 2).setValue(String(val));
        sheet.getRange(keyRowMap[k], 4).setValue(nowIso);
      } else {
        sheet.appendRow([k, String(val), desc || '', nowIso]);
      }
    }

    if (settingsObj.alertEnabled !== undefined) {
      setKey('alert_enabled', settingsObj.alertEnabled ? 'true' : 'false', 'Real-time Telegram safety alerts enabled');
    }
    if (settingsObj.alertHadOnly !== undefined) {
      setKey('alert_had_only', settingsObj.alertHadOnly ? 'true' : 'false', 'Trigger alerts only for High Alert Drugs (HAD)');
    }
    if (settingsObj.telegramBotToken !== undefined) {
      setKey('telegram_bot_token', settingsObj.telegramBotToken.trim(), 'Telegram Bot Token from @BotFather');
    }
    if (settingsObj.telegramChatId !== undefined) {
      setKey('telegram_chat_id', settingsObj.telegramChatId.trim(), 'Telegram Group or Channel Chat ID');
    }
    if (settingsObj.newAdminPin !== undefined && settingsObj.newAdminPin.trim().length >= 4) {
      setKey('admin_pin', settingsObj.newAdminPin.trim(), 'Admin & Analytics 4-digit PIN protection');
    }

    return { success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}



