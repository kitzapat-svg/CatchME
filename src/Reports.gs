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
      reportData.tradeName || ''
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

