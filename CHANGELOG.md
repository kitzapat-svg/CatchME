# Changelog

All notable changes to the CatchME project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
