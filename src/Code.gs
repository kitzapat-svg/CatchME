/**
 * CatchME — Medication Error Cat B Quick Reporter
 * Main Entry Point (Web App)
 */

const APP_VERSION = '0.2.0';

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
