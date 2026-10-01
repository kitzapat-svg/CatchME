# Changelog

All notable changes to the CatchME project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-10-01
### Changed
- **Header UI Polish**:
  - Replaced text "📊 สถิติ" in top navigation bar with clean, minimal icon-only button (`📊`), saving header width and eliminating wrapping on mobile viewports.
- **Dedicated Full-Page Analytics Experience**:
  - Converted the safety analytics dashboard from a cramped overlay popup into a dedicated full-page screen (`screen-analytics`).
  - Seamless integration with native application screen router (`showScreen`), enabling full-screen responsiveness, smooth animations, and header back button navigation (`←`).

## [0.5.0] - 2026-10-01
### Added
- **Safety Analytics Dashboard (`modal-safety-analytics`)**:
  - Interactive medication safety and Near Miss (Cat B) analytics dashboard accessible from top header.
  - Time range filters: 7 days, 30 days, current month, and all-time.
  - Department filters: ALL, OPD (ห้องยาผู้ป่วยนอก), IPD (ห้องยาผู้ป่วยใน).
  - KPI Cards: Total Near Miss, HAD Interception Count, LASA Events, and Top Interception Stage.
  - Stage Distribution Progress Meters for Prescribing (A01-A17), Transcribing (E01-E11), and Pre-dispensing (B01-B36).
  - Top 5 Frequency Error Types and High Alert Drug (HAD) surveillance category breakdown.
- **PIN Code Protection Layer (`modal-pin-auth`)**:
  - 4-digit PIN security lock protecting Analytics Dashboard and Admin Settings while keeping Quick Reporter no-login.
  - Sweet Cotton Candy styled numeric keypad with animated PIN dots and error feedback.
  - Default PIN `8888` stored securely in `App_Settings` sheet on Google Sheets (server-side verification only).
  - Session caching in `sessionStorage` with instant manual lock-out button (`🔒`).
- **Real-Time Safety Alerting via Telegram Bot API**:
  - Non-blocking real-time alert engine sending HTML formatted messages upon report submission.
  - Automatic department naming: `IPD (ห้องยาผู้ป่วยใน)` and `OPD (ห้องยาผู้ป่วยนอก)`.
  - Configurable alert filters: High Alert Drugs (HAD 29 items) priority alerting as default.
  - Admin settings modal (`modal-admin-settings`) with Telegram Bot Token, Chat ID, and Test Ping button.
- **Quality & HA Accreditation Report Export**:
  - Export report data to UTF-8 BOM CSV supporting Thai characters in Microsoft Excel without encoding issues.
  - Complete incident fields exported for Pharmacy & Therapeutics Committee (PTC) and Risk Management reviews.

## [0.4.0] - 2026-10-01
### Added
- **Sawankhalok Hospital High Alert Drugs (HAD) Surveillance**:
  - Integrated full 29-item High Alert Drug catalog across 3 official categories from กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลสวรรคโลก:
    - **Category 1 (22 items):** Narrow therapeutic index / high fatality risk (Adrenaline, Norepinephrine, Dobutamine, Dopamine, Digoxin, Nicardipine, Nitroglycerine, Adenosine, Amiodarone, Cisatracurium, Oxytocin, Terbutaline, Apixaban, Enoxaparin, Heparin, Streptokinase, Warfarin, 3% NaCl, 10% Calcium gluconate, MgSO4, KCl, Regular Insulin).
    - **Category 2 (5 items):** Narcotics & Psychotropics (Fentanyl, Morphine, Pethidine, Midazolam, Ketamine).
    - **Category 3 (2 items):** Serious Adverse Drug Reactions & SCARs (Allopurinol, Phenytoin).
  - Position-aware regex parser detection (`detectHadInfo`) with boundary enforcement.
  - High-visibility HAD alert cards with emergency red gradient, category badge, and warning indicator on Confirmation Card.
  - Interactive HAD Reference Dictionary modal displaying all 29 hospital items with categories, forms, and clinical notes.
  - Dedicated `HAD_MASTER` sheet in Google Sheets schema with automatic initial data population.
- **Report Management & Audit Trail**:
  - Report Detail drawer with complete incident information, timeline, and error classification.
  - Quick Edit capability allowing reporters from the same device to modify details (actual/expected drug, notes) within the recent report window.
  - VOID report marking with mandatory reason logging and audit trail preservation in `Audit_Log`.
- **Medication Safety Review Module (Pharmacist Reviewer)**:
  - Safety Review modal for in-depth pharmacist evaluation: Root Cause analysis, Contributing Factors (Environment, Patient, Human factors, System), Preventive Actions, and Severity Level.
  - Structured storage in `ME_Review` sheet linked by `report_id`.
- **Backend & API Expansion**:
  - Database schema expansion in `src/Database.gs` for `HAD_MASTER` and `ME_REVIEW`, plus HAD and VOID columns in `ME_Log`.
  - New GAS endpoints in `src/Code.gs` and `src/Reports.gs`: `apiGetReportDetail`, `apiUpdateReport`, `apiVoidReport`, `apiSaveMedicationReview`, and `apiGetHadMasterList`.
- **Test Suite Expansion**:
  - Added 13 HAD test cases covering Cat 1, 2, and 3 drugs in `tests/parser-tests.js`. Total test suite expanded to 64 tests with 100% pass rate.

## [0.3.0] - 2026-09-07
### Added
- Web Speech API integration in `src/Scripts.html` supporting Thai (`th-TH`) voice recording.
- Full UI screens and modals based on Google Stitch *Sweet Cotton Candy & Berry* design system (`src/App.html`, `src/Styles.html`):
  - Quick Report Home with responsive thumb-zone microphone trigger.
  - Recording state with pulsing waveform animation and real-time transcript preview.
  - Processing state with smooth transition indicator.
  - Confirmation Card displaying Category B status, Risk Code, Error Type, Medication, and comparison.
  - Clarification Bento Grid allowing 1-tap disambiguation for ambiguous speech reports.
  - Cat B Safety Gate Hard Stop Modal alerting users when medication has reached the patient.
  - Minimal Manual Correction Sheet for quick field edits before saving.
  - Save Success screen with unique record ID and next report action.
  - Text Input Fallback Modal for environments without microphone support.
- Backend report persistence in `src/Reports.gs` (`saveQuickReport` and `getRecentReports`) writing to Google Sheets `ME_Log` and `Audit_Log` with `LockService`.
- Client-callable API wrappers in `src/Code.gs` (`apiParseMedicationError`, `apiSaveQuickReport`, `apiGetRecentReports`).
- Standalone local browser preview in `tests/preview.html` with embedded parser and mock storage.

## [0.2.0] - 2026-09-07
### Added
- Deterministic Rule-Based Parser in `src/Parser.gs` supporting both OPD and IPD workflows.
- Cat B Safety Gate with hard stop logic (`patientReached: "Yes"`, `catBEligible: false`) when medication has reached the patient.
- Isomorphic architecture in `src/Parser.gs` compatible with both Google Apps Script V8 and Node.js testing.
- Automated test suite in `tests/parser-tests.js` covering 30 hospital speech test cases (T01–T30) and Cat B safety gate cases (HS01–HS03) with 100% pass rate.
- Entity extraction for common hospital medications, actual/expected strengths, doses, and quantities.
- Clarification questions and options generation (CL01–CL07) for ambiguous speech inputs.

## [0.1.0] - 2026-09-04
### Added
- Initial project structure with Git, clasp, and package configuration.
- Google Apps Script web app manifest (`appsscript.json`) with `USER_DEPLOYING` and `ANYONE` access.
- Modular HTML Service architecture (`Code.gs`, `Database.gs`, `Index.html`, `Styles.html`, `App.html`, `Scripts.html`).
- Automated machine setup script (`scripts/setup-machine.ps1`) and deployment script (`scripts/deploy.ps1`).
- Design System tokens based on Google Stitch *Sweet Cotton Candy & Berry* palette.
- First-use onboarding flow for OPD/IPD mode selection, reporter alias, and random device ID generation.
- Persistent local storage preferences and responsive mobile-first shell.
- Idempotent `setupDatabase()` implementation for `ME_Log`, `App_Settings`, `Audit_Log`, and `Drug_Master`.
