/**
 * CatchME — Medication Error Cat B Quick Reporter
 * Main Entry Point (Web App)
 */

const APP_VERSION = '0.5.0';

/**
 * Serves the HTML web app for the CatchME user interface.
 * Configured to run as USER_DEPLOYING with access ANYONE (No-Login required).
 */
function doGet(e) {
  var template;
  try {
    template = HtmlService.createTemplateFromFile('Index');
  } catch (err) {
    template = HtmlService.createTemplateFromFile('src/Index');
  }

  return template.evaluate()
    .setTitle('CatchME — Cat B Quick Reporter')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper to include partial HTML files into the main template.
 * Resolves both flat ("Styles") and folder-prefixed ("src/Styles") paths.
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    return HtmlService.createHtmlOutputFromFile('src/' + filename).getContent();
  }
}

/**
 * Returns initial application metadata for the client on load.
 */
function getInitialAppState(deviceId) {
  return {
    version: APP_VERSION,
    status: 'READY',
    serverTime: new Date().toISOString()
  };
}

/**
 * Client-callable endpoint to parse medication error speech/text.
 */
function apiParseMedicationError(transcript, mode) {
  return parseMedicationError(transcript, mode);
}

/**
 * Client-callable endpoint to save quick Cat B report.
 */
function apiSaveQuickReport(reportData) {
  return saveQuickReport(reportData);
}

/**
 * Client-callable endpoint to retrieve recent reports for this device.
 */
function apiGetRecentReports(deviceSessionId, limit) {
  return getRecentReports(deviceSessionId, limit);
}

/**
 * Client-callable endpoint to retrieve report detail.
 */
function apiGetReportDetail(recordId) {
  return getReportDetail(recordId);
}

/**
 * Client-callable endpoint to update a report.
 */
function apiUpdateReport(recordId, updateData, deviceSessionId, reporterAlias) {
  return updateReport(recordId, updateData, deviceSessionId, reporterAlias);
}

/**
 * Client-callable endpoint to mark a report as VOID.
 */
function apiVoidReport(recordId, reason, deviceSessionId, reporterAlias) {
  return voidReport(recordId, reason, deviceSessionId, reporterAlias);
}

/**
 * Client-callable endpoint to save medication review.
 */
function apiSaveMedicationReview(reviewData) {
  return saveMedicationReview(reviewData);
}

/**
 * Client-callable endpoint to retrieve active High Alert Drugs master list.
 */
function apiGetHadMasterList() {
  return getHadMasterList();
}

/**
 * Client-callable endpoint to retrieve LASA master list.
 */
function apiGetLasaMasterList() {
  return getLasaMasterList();
}

/**
 * Client-callable endpoint to retrieve emerging LASA pairs.
 */
function apiGetEmergingLasaPairs(mode, threshold) {
  return getEmergingLasaPairs(mode, threshold);
}

/**
 * Client-callable endpoint to promote an emerging pair into LASA master.
 */
function apiPromoteEmergingLasa(pairData) {
  return promoteEmergingLasa(pairData);
}

/**
 * Client-callable endpoint to verify admin PIN.
 */
function apiVerifyAdminPin(pin) {
  return verifyAdminPin(pin);
}

/**
 * Client-callable endpoint to retrieve safety analytics summary.
 */
function apiGetSafetyAnalytics(timeRange, filterMode, pin) {
  return getSafetyAnalytics(timeRange, filterMode, pin);
}

/**
 * Client-callable endpoint to export reports as UTF-8 BOM CSV.
 */
function apiExportReportsCsv(timeRange, filterMode, pin) {
  return exportReportsCsv(timeRange, filterMode, pin);
}

/**
 * Client-callable endpoint to get admin settings.
 */
function apiGetAppSettings(pin) {
  return getAppSettings(pin);
}

/**
 * Client-callable endpoint to update admin settings.
 */
function apiUpdateAppSettings(settingsObj, pin) {
  return updateAppSettings(settingsObj, pin);
}

/**
 * Client-callable endpoint to test Telegram bot alert.
 */
function apiTestTelegramAlert(token, chatId) {
  return testTelegramAlert(token, chatId);
}

/**
 * Handles incoming HTTP POST requests from external frontends (e.g. GitHub Pages).
 */
function doPost(e) {
  try {
    var rawData = e && e.postData ? e.postData.contents : '{}';
    var reportData = JSON.parse(rawData);
    var result = saveQuickReport(reportData);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message || String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
