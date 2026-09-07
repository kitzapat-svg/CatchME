# CatchME Project Handoff

## Project
**CatchME — Medication Error Cat B Quick Reporter**

Tagline:

> **Catch ME before it reaches the patient.**

CatchME is an internal hospital pharmacy web app for rapidly recording **Medication Error Category B / Near Miss** events that are detected and corrected before reaching the patient.

The main product goal is:

> **พบ Error → เปิด CatchME → กดไมค์ → พูด → ตรวจ → บันทึก**

Typical reporting time target: **10–20 seconds**

---

## 1. Start Here — Read These in Order

Before changing code or architecture, inspect the following files in this order:

1. `CatchME_Implementation_Master_Prompt`
   - Primary product and engineering requirements.
   - Defines scope, architecture, no-login Quick Reporter, Git/GitHub/clasp workflow, deployment, safety rules, and acceptance criteria.

2. `Medication_Error_CatB_Mapping_Master_V2_Speech_Tested.xlsx`
   - Source of truth for hospital Medication Error taxonomy and legacy risk codes.
   - Contains process/error mapping and speech test cases.
   - Do **not** invent replacement taxonomy.

3. `Medication_Error_CatB_Parser_Rules_OPD_IPD_V1.xlsx`
   - Source of truth for rule-based speech parsing.
   - Contains OPD/IPD parser dictionaries, normalization, confidence logic, and clarification rules.

4. `Medication_Error_CatB_Data_Schema_GoogleSheets_V1.xlsx`
   - Source of truth for Google Sheets data structure and backend data contract.
   - Important: where older fields conflict with the latest no-login requirement, follow the Master Prompt:
     - use `reporter_alias`
     - use `device_session_id`
     - do not require `reporter_email`

5. Google Stitch UX/UI output
   - Source of truth for visual hierarchy and screen interaction.
   - Functional/safety requirements override visual design if they conflict.

---

## 2. Source of Truth Priority

If requirements conflict, use this priority:

1. **Medication safety / Category B safety rules**
2. **Latest CatchME Implementation Master Prompt**
3. **Excel mapping / parser / schema files**
4. **Google Stitch UX/UI**
5. Existing code

Do not silently change taxonomy, database fields, or agreed workflow.

If a real conflict is found, document it before making a breaking change.

---

## 3. Product Scope — V1

CatchME V1 is a **Category B Quick Reporter**, not a full incident reporting system.

For a valid Quick Report:

- `severity = B`
- `patient_reached = No`

The reporter must **not** choose A–I severity.

If the error has already reached the patient, CatchME must stop the normal Quick Report flow and direct the user to the hospital's normal risk-reporting workflow.

Examples of reached-patient clues:

- จ่ายไปแล้ว
- คนไข้ได้รับแล้ว
- คนไข้กินแล้ว
- พยาบาลให้ยาแล้ว
- ให้ยาไปแล้ว

Examples that may still be Cat B:

- วอร์ดเจอก่อนให้คนไข้
- พยาบาลพบก่อนถึงผู้ป่วย

---

## 4. No-Login Quick Reporter

Normal pharmacy staff should be able to open CatchME and report without application login.

Do **not** require:

- Google sign-in
- username/password
- OAuth
- account selection
- Google permission prompt

before Quick Report.

Use lightweight local device preferences:

- `catchmeMode`
- `catchmeReporterAlias`
- `catchmeDeviceId`

`reporter_alias` is not authenticated identity.

`device_session_id` is only for technical scoping, deduplication, and same-device recent reports.

Never expose the whole hospital report database to no-login users.

---

## 5. OPD / IPD Working Mode

OPD/IPD is selected from the UI.

The reporter should **not** need to say “OPD” or “IPD” in every speech entry.

Requirements:

- current mode always visible
- mode persists in `localStorage`
- user can switch at any time
- parser must never silently change mode
- mode is stored in every report

If speech strongly conflicts with selected mode, show a warning and let the user choose.

---

## 6. Core Workflow

High-confidence event:

1. Open CatchME
2. Current OPD/IPD mode already selected
3. Tap microphone
4. Speak one sentence
5. Parser categorizes event
6. Show confirmation
7. Tap **บันทึก**
8. Save to Google Sheets
9. Show success

Target interaction:

> **tap microphone → speak → tap Save**

Speech must have a text-entry fallback.

---

## 7. Parser Principles

The parser is rule-based and should be independently testable.

Core function concept:

```javascript
parseMedicationError(text, mode)
```

Pipeline:

```text
Selected OPD/IPD Mode
        ↓
Normalize transcript
        ↓
Cat B safety gate
        ↓
Detect actor
        ↓
Detect process stage
        ↓
Detect error semantic
        ↓
Extract medication entities
        ↓
Extract actual / expected
        ↓
Detect interception stage
        ↓
Mapping lookup
        ↓
Confidence
        ↓
Confirm / Clarify
```

Do not scatter parser rules across unrelated UI code.

Do not optimize for always returning a legacy code.

If uncertain, ask one clarification rather than guessing.

Maximum clarification questions: **1**

---

## 8. Important Parser Distinctions

Do not collapse these:

### Wrong strength
`Amlodipine 10 mg แทน 5 mg`

### Wrong dose
`Prednisolone ครั้งละ 5 เม็ด แต่ต้อง 2 เม็ด`

### Wrong quantity
`จัด 30 เม็ด แต่ต้อง 60 เม็ด`

Important ambiguous cases include:

- prescribing quantity vs pharmacy entry quantity vs picking quantity
- dose vs strength
- IPD B25 vs B34
- IPD STAT B22 vs E11
- order reception vs transcription/รคส.

Use the supplied Parser Rules workbook.

---

## 9. Critical Regression Examples

### OPD — picking quantity

Speech:

> คนจัด amlodipine มา 30 เม็ด แต่ต้อง 60 เภสัชเช็คเจอ

Expected:

- Pre-dispensing
- PS04
- Wrong quantity
- B29
- DS04
- Category B

### OPD — prescribing strength

Speech:

> หมอสั่ง amlodipine 10 มิล แต่เดิม 5 มิล เภสัชทวนเจอ

Expected:

- Prescribing
- PS01
- Wrong strength
- A05
- DS01
- Category B

### OPD — pharmacy instruction

Speech:

> คีย์ฉลาก metformin วันละครั้ง แต่ใบสั่งวันละสองครั้ง

Expected:

- Pre-dispensing
- PS02
- Wrong instruction
- B06

### IPD — order type

Speech:

> รับ order เป็น continue แต่หมอสั่ง one day

Expected:

- Pre-dispensing
- PS03
- Wrong order type
- B21

### IPD — STAT ambiguity

Speech:

> stat ตก

Expected:

- `requiresClarification = true`
- do not guess B22/E11

### Cat B hard stop

Speech:

> จ่ายยาไปแล้ว คนไข้กินไปหนึ่งเม็ด

Expected:

- must **not** save as Category B

---

## 10. Google Sheets Database

Core V1 sheets:

- `ME_Log`
- `App_Settings`
- `Audit_Log`
- mapping/parser master sheets

Later:

- `ME_Review`
- `Drug_Master`
- protected Admin/Reviewer data

### Recommended no-login identity fields

Use:

- `reporter_alias`
- `device_session_id`

Do not require:

- `reporter_email`
- authenticated `confirmed_by`

If legacy columns remain in an existing schema, leave them blank rather than breaking compatibility.

---

## 11. Data Integrity

Every successful report should have:

- unique `record_id`
- server-generated `created_at`
- OPD/IPD mode
- raw transcript preserved
- parser version
- validated legacy code
- `severity = B`
- `patient_reached = No`
- `confirmed_at`
- minimal CREATE audit record

Use:

```javascript
Utilities.getUuid()
```

Use server timestamps.

Use `LockService` around critical sheet writes.

Prevent duplicate Save taps.

Never generate IDs from row numbers.

---

## 12. Privacy

Quick Report must not require:

- patient name
- national ID
- phone
- address

HN/AN may be optional if trace-back is required.

Do not put patient identifiers or transcripts in:

- URL parameters
- browser console logs
- `localStorage`

No-login users must not be able to browse all hospital Medication Error reports.

Recent Reports should be limited to the current `device_session_id`, or omitted if not safe.

---

## 13. Technology

Preferred stack:

- Google Apps Script
- Google Sheets
- HTML
- CSS
- vanilla JavaScript
- Web Speech API
- rule-based parser
- Git
- GitHub
- clasp

Do not introduce unless clearly justified:

- React
- Vue
- Next.js
- Supabase
- Firebase
- external backend
- Docker
- TypeScript build pipeline
- paid AI APIs
- PWA/offline sync

Keep the architecture simple:

```text
Browser
   ↓
Google Apps Script
   ↓
Google Sheets
```

---

## 14. Git / GitHub / clasp

GitHub is the source of truth for source code.

Normal source workflow:

```text
Local repo
   ↓
Git
   ↓
GitHub
   ↓
clasp
   ↓
Google Apps Script
```

The Apps Script online editor is not the normal editing location.

Use a private GitHub repository unless explicitly decided otherwise.

Recommended repo name:

`CatchME`

Recommended branches:

- `main`
- `feature/*`
- `fix/*`

Do not use GitFlow.

---

## 15. Multi-Machine Development

The project must be easy to continue from different Windows computers.

A normal workstation should only need:

```bash
git clone <repo>
cd CatchME
npm ci
```

Normal editing/testing should not require Google authentication.

Use project-local clasp via `package.json`, not a required global clasp install.

Commit `package-lock.json`.

Never commit clasp/OAuth credentials.

---

## 16. Deployment

Production should use one stable Apps Script Web App URL.

Do not create a new production deployment on every release.

Create:

`scripts/deploy.ps1`

Deployment concept:

```text
verify source
↓
run parser tests
↓
clasp push
↓
create immutable Apps Script version
↓
update existing production deployment
```

Use the exact commands supported by the installed clasp version.

Before implementing scripts:

```bash
npx clasp --version
npx clasp --help
```

Deployment authentication is still required for the trusted deployment environment.

The **app reporters** are the users who should not need login.

---

## 17. Recommended Phase 1 Structure

```text
CatchME/
│
├── src/
│   ├── Code.gs
│   ├── Database.gs
│   ├── Parser.gs
│   ├── Reports.gs
│   ├── Index.html
│   ├── Styles.html
│   ├── App.html
│   └── Scripts.html
│
├── tests/
│   └── parser-tests.js
│
├── scripts/
│   ├── setup-machine.ps1
│   └── deploy.ps1
│
├── docs/
│   ├── architecture.md
│   └── data-schema.md
│
├── package.json
├── package-lock.json
├── appsscript.json
├── .clasp.json
├── .claspignore
├── .gitignore
├── README.md
└── CHANGELOG.md
```

Do not create dozens of tiny modules.

---

## 18. Phase 0

Implement only:

- Git/GitHub-ready repo
- project-local clasp
- Apps Script connection
- `appsscript.json`
- basic file structure
- `README.md`
- `CHANGELOG.md`
- `setup-machine.ps1`
- `deploy.ps1`
- `setupDatabase()`
- basic CatchME shell
- first-use setup
- reporter alias
- device ID
- persistent OPD/IPD mode
- verify no-login Web App feasibility

Do not proceed blindly if no-login access is not supported by the actual Workspace/deployment configuration.

---

## 19. Phase 1

Implement only:

- Quick Report home
- speech recognition
- text fallback
- rule parser
- confidence classification
- maximum one clarification
- Cat B safety gate
- confirmation screen
- minimal manual correction
- save to `ME_Log`
- CREATE audit record
- success state
- same-device recent reports

---

## 20. Explicitly Out of Phase 1

Do not build yet:

- analytics dashboard
- charts
- full report search
- Admin dashboard
- User Admin
- Parser Rules Admin UI
- Drug Master Admin UI
- complex export
- notifications
- PWA
- offline sync
- external AI
- GitHub Actions
- full Reviewer dashboard
- complex RCA workflow

Do not add placeholder architecture for these features.

---

## 21. Google Stitch

Use Stitch as the visual source of truth.

Prioritize these MVP screens:

1. First-use OPD/IPD setup
2. Quick Report
3. Recording
4. Processing
5. Clarification
6. Confirmation
7. Cat B hard stop
8. Save success
9. Minimal manual edit
10. Same-device recent reports

Functional and medication-safety requirements override Stitch if there is a conflict.

---

## 22. UX Principle

Do not make reporters:

- think about taxonomy
- choose severity
- perform RCA
- select many dropdowns
- say OPD/IPD every time
- enter patient name
- login before reporting

The core interaction should feel faster than paper.

---

## 23. Initial Agent Response Required

Before large code changes, first return:

### A. Understanding
Summarize CatchME and the intended Quick Report workflow.

### B. Scope Check
State exactly what is in/out of Phase 0 and Phase 1.

### C. File Review
Confirm which supplied source-of-truth files were inspected.

### D. Conflict Check
List any contradictions between prompt, Excel files, Stitch output, and existing code.

### E. No-Login Feasibility
Verify the actual Apps Script Web App access/deployment configuration needed for no-login use.

### F. Minimal File Structure
Propose only the files actually needed now.

### G. Git + GitHub + clasp Plan
Explain source-of-truth, multi-machine workflow, deployment, and rollback.

### H. Implementation Plan
Give small sequential milestones.

### I. First Milestone
Start only with:

```text
CatchME repository
↓
GitHub-ready
↓
project-local clasp
↓
Apps Script connected
↓
basic deployable Web App
↓
verify no-login access
↓
setupDatabase()
↓
first-use setup
↓
OPD/IPD shell
```

Do not build the full application before this milestone is verified.

---

## 24. Final Principle

CatchME succeeds only if pharmacy staff actually use it.

The desired user experience is:

> **พบ Error → เปิด CatchME → กดไมค์ → พูด → ตรวจ → บันทึก**

And the product idea is captured by:

> **Catch ME before it reaches the patient.**

Keep the codebase, workflow, and deployment boring, predictable, and maintainable.
