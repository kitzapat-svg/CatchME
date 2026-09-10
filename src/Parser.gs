/**
 * CatchME — Medication Error Cat B Quick Reporter
 * Parser.gs — Deterministic Rule-Based Speech & Text Parser
 * 
 * Pipeline:
 * 1. Mode Context (OPD / IPD from UI)
 * 2. Normalization (Common Dictionary: units, terms, Thai variants)
 * 3. Cat B Safety Gate (Hard Stop if error reached the patient)
 * 4. Actor & Stage Detection (Prescriber, Pharmacy Entry, Picker, Ward, etc.)
 * 5. Error Semantic Detection (Wrong drug, strength, dose, qty, allergy, etc.)
 * 6. Entity Extraction (Medication, actual, expected, quantity, unit)
 * 7. Interception Point / Detected Stage (DS01–DS06, DS99)
 * 8. Legacy Code Mapping (A01–A18, B01–B35, E01–E11)
 * 9. Confidence Scoring (High / Medium / Low)
 * 10. Clarification Generation (Max 1 question when ambiguous)
 * 
 * Architecture: Isomorphic (compatible with Google Apps Script V8 & Node.js)
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    var exp = factory();
    root.parseMedicationError = exp.parseMedicationError;
    root.normalizeTranscript = exp.normalizeTranscript;
    root.checkCatBSafetyGate = exp.checkCatBSafetyGate;
    root.PARSER_VERSION = exp.PARSER_VERSION;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PARSER_VERSION = '1.0.0';

  // ---------------------------------------------------------------------------
  // 1. Dictionaries & Masters
  // ---------------------------------------------------------------------------

  var DETECTED_STAGES = {
    DS01: { code: 'DS01', name: 'Pharmacist order review', nameTh: 'เภสัชกรทบทวนคำสั่งยา' },
    DS02: { code: 'DS02', name: 'Data entry / label check', nameTh: 'ตรวจการคีย์/ฉลาก' },
    DS03: { code: 'DS03', name: 'During picking / preparation', nameTh: 'ระหว่างหยิบ/จัด/เตรียมยา' },
    DS04: { code: 'DS04', name: 'Pharmacist final check', nameTh: 'เภสัชกรตรวจสอบยาขั้นสุดท้าย' },
    DS05: { code: 'DS05', name: 'Before sending to ward', nameTh: 'ก่อนส่งยาให้หอผู้ป่วย' },
    DS06: { code: 'DS06', name: 'Ward check before patient', nameTh: 'หอผู้ป่วยตรวจพบก่อนถึงผู้ป่วย' },
    DS99: { code: 'DS99', name: 'Other before reaching patient', nameTh: 'อื่น ๆ ก่อนถึงผู้ป่วย' }
  };

  // Unit normalization map
  var UNIT_MAP = [
    { patterns: [/มิลลิกรัม/g, /เอ็มจี/g, /\bmg\b/gi, /มิล(?!\w)/g], replacement: 'mg' },
    { patterns: [/ไมโครกรัม/g, /\bmcg\b/gi, /ไมโคร(?!\w)/g], replacement: 'mcg' },
    { patterns: [/มิลลิลิตร/g, /ซีซี/g, /\bcc\b/gi, /\bml\b/gi], replacement: 'mL' },
    { patterns: [/กรัม/g, /\bg\b/gi, /จี(?!\w)/g], replacement: 'g' },
    { patterns: [/แท็บเล็ต/g, /tablet/gi, /\btab\b/gi], replacement: 'เม็ด' },
    { patterns: [/แคปซูล/g, /capsule/gi, /\bcap\b/gi], replacement: 'แคปซูล' },
    { patterns: [/ไวอัล/g, /vial/gi], replacement: 'vial' },
    { patterns: [/แอมป์/g, /ampule/gi, /ampoule/gi, /\bamp\b/gi], replacement: 'amp' },
    { patterns: [/มิลลิอิควิวาเลนท์/g, /มิลลิอิควิวาเลนต์/g, /\bmEq\b/gi], replacement: 'mEq' },
    { patterns: [/ส่วน/g], replacement: 'ส่วน' },
    { patterns: [/แผง/g], replacement: 'แผง' }
  ];

  // Comprehensive Drug Dictionary (Canonical generic name, lowercase key, and speech regex patterns)
  var DRUG_DICTIONARY = [
    { name: 'Metoprolol', key: 'metoprolol', patterns: [/metoprolol/gi, /เมโทโพรลอล/gi, /เมโตโปรลอล/gi, /เมโทโปรลอล/gi, /เมโตโพรลอล/gi] },
    { name: 'Amlodipine', key: 'amlodipine', patterns: [/amlodipine/gi, /แอมโลดิปีน/gi, /แอมโลดิพีน/gi, /แอมโล(?![a-zA-Z])/gi] },
    { name: 'Prednisolone', key: 'prednisolone', patterns: [/prednisolone/gi, /เพรดนิโซโลน/gi, /พรีดนิโซโลน/gi, /เพรดนิ(?![a-zA-Z])/gi] },
    { name: 'Metformin', key: 'metformin', patterns: [/metformin/gi, /เมทฟอร์มิน/gi, /เมตฟอร์มิน/gi, /เม็ทฟอร์มิน/gi] },
    { name: 'Simvastatin', key: 'simvastatin', patterns: [/simvastatin/gi, /ซิมวาสแตติน/gi, /ซิมวาสเตติน/gi, /ซิมวาส(?![a-zA-Z])/gi] },
    { name: 'Losartan', key: 'losartan', patterns: [/losartan/gi, /ลอซาร์แทน/gi, /โลซาร์แทน/gi, /ลอซาแทน/gi, /ลอสาร์แทน/gi] },
    { name: 'Warfarin', key: 'warfarin', patterns: [/warfarin/gi, /วาร์ฟาริน/gi, /วอฟาริน/gi, /วาฟาริน/gi] },
    { name: 'Tramadol', key: 'tramadol', patterns: [/tramadol/gi, /ทรามาดอล/gi, /ทรามอล/gi] },
    { name: 'Paracetamol', key: 'paracetamol', patterns: [/paracetamol/gi, /พาราเซตามอล/gi, /พาราเซต/gi, /พารา(?![a-zA-Z])/gi] },
    { name: 'Amoxicillin', key: 'amoxicillin', patterns: [/amoxicillin/gi, /อะม็อกซีซิลลิน/gi, /อะม็อกซี/gi, /อาม็อกซี/gi, /อะมอกซี/gi] },
    { name: 'Penicillin', key: 'penicillin', patterns: [/penicillin/gi, /เพนนิซิลลิน/gi, /เพนิซิลลิน/gi] },
    { name: 'Cotrimoxazole', key: 'cotrimoxazole', patterns: [/cotrimoxazole/gi, /โคไตรม็อกซาโซล/gi, /โคไตร/gi] },
    { name: 'Gliclazide', key: 'gliclazide', patterns: [/gliclazide/gi, /ไกลคลาไซด์/gi, /กลิคลาไซด์/gi, /กลิคาไซด์/gi] },
    { name: 'Glipizide', key: 'glipizide', patterns: [/glipizide/gi, /กลิพิไซด์/gi, /ไกลพิไซด์/gi] },
    { name: 'Nifedipine', key: 'nifedipine', patterns: [/nifedipine/gi, /นิเฟดิปีน/gi] },
    { name: 'Ceftriaxone', key: 'ceftriaxone', patterns: [/ceftriaxone/gi, /เซฟไตรอะโซน/gi, /เซฟไตร/gi] },
    { name: 'Cephalosporin', key: 'cephalosporin', patterns: [/cephalosporin/gi, /เซฟาโลสปอริน/gi] },
    { name: 'Meropenem', key: 'meropenem', patterns: [/meropenem/gi, /เมโรพีเนม/gi, /เมโรเพเนม/gi] },
    { name: 'Enoxaparin', key: 'enoxaparin', patterns: [/enoxaparin/gi, /อีนอกซาพาริน/gi] },
    { name: 'Potassium chloride', key: 'potassium chloride', patterns: [/potassium\s*chloride/gi, /โพแทสเซียม\s*คลอไรด์/gi, /โปแตสเซียม\s*คลอไรด์/gi, /เคซีแอล/gi, /\bkcl\b/gi] },
    { name: 'Cefazolin', key: 'cefazolin', patterns: [/cefazolin/gi, /เซฟาโซลิน/gi] },
    { name: 'Ceftazidime', key: 'ceftazidime', patterns: [/ceftazidime/gi, /เซฟทาซิดิม/gi, /เซฟตาซิดิม/gi] },
    { name: 'Aspirin', key: 'aspirin', patterns: [/aspirin/gi, /แอสไพริน/gi] },
    { name: 'Clopidogrel', key: 'clopidogrel', patterns: [/clopidogrel/gi, /โคลพิโดเกรล/gi] },
    { name: 'Atorvastatin', key: 'atorvastatin', patterns: [/atorvastatin/gi, /อะทอร์วาสแตติน/gi, /อะตอร์วาสแตติน/gi] },
    { name: 'Omeprazole', key: 'omeprazole', patterns: [/omeprazole/gi, /โอเมพราโซล/gi] },
    { name: 'Insulatard', key: 'insulatard', patterns: [/insulatard/gi, /อินซูลาทาร์ด/gi] },
    { name: 'Mixtard', key: 'mixtard', patterns: [/mixtard/gi, /มิกซ์ทาร์ด/gi] },
    { name: 'Furosemide', key: 'furosemide', patterns: [/furosemide/gi, /ฟูโรซีไมด์/gi, /ฟูโรเซไมด์/gi, /ลาซิกซ์/gi] },
    { name: 'Vancomycin', key: 'vancomycin', patterns: [/vancomycin/gi, /แวนโคไมซิน/gi] },
    { name: 'Carvedilol', key: 'carvedilol', patterns: [/carvedilol/gi, /คาร์เวดิลอล/gi] },
    { name: 'Bisoprolol', key: 'bisoprolol', patterns: [/bisoprolol/gi, /บิโซโพรลอล/gi] },
    { name: 'Enalapril', key: 'enalapril', patterns: [/enalapril/gi, /อีนาลาพริล/gi] },
    { name: 'Captopril', key: 'captopril', patterns: [/captopril/gi, /แคปโตพริล/gi] },
    { name: 'Hydrochlorothiazide', key: 'hydrochlorothiazide', patterns: [/hydrochlorothiazide/gi, /ไฮโดรคลอโรไทอะไซด์/gi, /\bhctz\b/gi] },
    { name: 'Spironolactone', key: 'spironolactone', patterns: [/spironolactone/gi, /สไปโรโนแลกโทน/gi] },
    { name: 'Digoxin', key: 'digoxin', patterns: [/digoxin/gi, /ไดจอกซิน/gi] },
    { name: 'Dexamethasone', key: 'dexamethasone', patterns: [/dexamethasone/gi, /เดกซาเมทาโซน/gi, /เดกซ่า/gi] },
    { name: 'Diazepam', key: 'diazepam', patterns: [/diazepam/gi, /ไดอะซีแพม/gi] },
    { name: 'Lorazepam', key: 'lorazepam', patterns: [/lorazepam/gi, /ลอราซีแพม/gi] },
    { name: 'Alprazolam', key: 'alprazolam', patterns: [/alprazolam/gi, /อัลพราโซแลม/gi] },
    { name: 'Gabapentin', key: 'gabapentin', patterns: [/gabapentin/gi, /กาบาเพนติน/gi] },
    { name: 'Pregabalin', key: 'pregabalin', patterns: [/pregabalin/gi, /พรีการ์บาลิน/gi] }
  ];

  // Common phrase normalizations
  var TERM_MAP = [
    { pattern: /รีเมด|re-?med/gi, replacement: 'remed' },
    { pattern: /คอนทินิว|continue/gi, replacement: 'continue' },
    { pattern: /วันเดย์|one\s*day/gi, replacement: 'one day' },
    { pattern: /สแตท|stat/gi, replacement: 'STAT' },
    { pattern: /ออฟยา|ออฟ|discontinue/gi, replacement: 'off' },
    { pattern: /โอพีดี|opd/gi, replacement: 'OPD' },
    { pattern: /ไอพีดี|ipd/gi, replacement: 'IPD' },
    { pattern: /ดรักโปรไฟล์|drug\s*profile/gi, replacement: 'drug profile' }
  ];

  // Reached patient patterns (Hard stop for Cat B)
  var REACHED_PATIENT_PATTERNS = [
    /คนไข้(กิน|ทาน).*(ไป)?แล้ว/,
    /ผู้ป่วย(กิน|ทาน).*(ไป)?แล้ว/,
    /(กิน|ทาน)(ยา)?.*(ไป)?แล้ว/,
    /ฉีด(ยา)?.*(ไป)?แล้ว/,
    /คนไข้ได้รับ(ยา)?.*แล้ว/,
    /ผู้ป่วยได้รับ(ยา)?.*แล้ว/,
    /ได้รับ(ยา)?.*(ไป)?แล้ว/,
    /พยาบาลให้ยา.*แล้ว/,
    /ให้ยา.*(ไป)?แล้ว/,
    /จ่าย(ยา)?ไปแล้ว(?!\s*คนจัด|\s*เภสัช|\s*ตรวจ|\s*เช็ค)/
  ];

  // Intercepted before patient patterns (Safe Cat B indicator)
  var SAFE_INTERCEPT_PATTERNS = [
    /ก่อน(จ่าย|ถึงคนไข้|ถึงผู้ป่วย|ให้คนไข้|ให้ผู้ป่วย|กิน|ฉีด)/,
    /เจอก่อน(จ่าย|ถึงคนไข้|ถึงผู้ป่วย|ให้คนไข้|ให้ผู้ป่วย|ส่ง)/,
    /ตรวจเจอก่อน/,
    /เช็คเจอก่อน/,
    /ยังไม่ได้(เอาไป)?ให้(คนไข้|ผู้ป่วย)/,
    /วอร์ดเจอก่อน/,
    /พยาบาลเจอก่อน/
  ];

  // ---------------------------------------------------------------------------
  // 2. Normalization
  // ---------------------------------------------------------------------------

  function normalizeTranscript(text) {
    if (!text) return '';
    var normalized = String(text).trim();

    // Replace duplicate whitespace
    normalized = normalized.replace(/\s+/g, ' ');

    // Normalize Thai numbers to Arabic numerals
    var thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    for (var d = 0; d < 10; d++) {
      normalized = normalized.replace(new RegExp(thaiDigits[d], 'g'), String(d));
    }

    // Normalize Thai number words for quantities and strengths
    var thaiWords = [
      { w: /หนึ่ง/g, r: '1' },
      { w: /สอง/g, r: '2' },
      { w: /สาม/g, r: '3' },
      { w: /สี่/g, r: '4' },
      { w: /ห้า/g, r: '5' },
      { w: /หก/g, r: '6' },
      { w: /เจ็ด/g, r: '7' },
      { w: /แปด/g, r: '8' },
      { w: /เก้า/g, r: '9' },
      { w: /สิบ/g, r: '10' },
      { w: /ยี่สิบ/g, r: '20' },
      { w: /สามสิบ/g, r: '30' },
      { w: /สี่สิบ/g, r: '40' },
      { w: /ห้าสิบ/g, r: '50' },
      { w: /หกสิบ/g, r: '60' }
    ];
    thaiWords.forEach(function (tw) {
      normalized = normalized.replace(tw.w, tw.r);
    });

    // Normalize Thai drug phonetics to generic lowercase English keys
    DRUG_DICTIONARY.forEach(function (d) {
      d.patterns.forEach(function (p) {
        normalized = normalized.replace(p, d.key);
      });
    });

    // Normalize fractional tablets and partial units
    normalized = normalized.replace(/ครึ่ง\s*เม็ด/g, 'ครึ่งเม็ด');
    normalized = normalized.replace(/ครึ่ง\s*ส่วน/g, 'ครึ่งส่วน');
    normalized = normalized.replace(/1\/2\s*เม็ด/g, 'ครึ่งเม็ด');
    normalized = normalized.replace(/0\.5\s*เม็ด/g, 'ครึ่งเม็ด');

    // Normalize units
    UNIT_MAP.forEach(function (item) {
      item.patterns.forEach(function (p) {
        normalized = normalized.replace(p, item.replacement);
      });
    });

    // Normalize common medical/hospital terms
    TERM_MAP.forEach(function (item) {
      normalized = normalized.replace(item.pattern, item.replacement);
    });

    return normalized;
  }

  // ---------------------------------------------------------------------------
  // 3. Cat B Safety Gate
  // ---------------------------------------------------------------------------

  function checkCatBSafetyGate(text) {
    var raw = String(text || '');

    // Check if intercepted safely before patient
    var isSafeIntercept = SAFE_INTERCEPT_PATTERNS.some(function (p) {
      return p.test(raw);
    });

    // Check reached patient cues
    var reachedClue = null;
    for (var i = 0; i < REACHED_PATIENT_PATTERNS.length; i++) {
      var match = raw.match(REACHED_PATIENT_PATTERNS[i]);
      if (match) {
        reachedClue = match[0];
        break;
      }
    }

    if (reachedClue && !isSafeIntercept) {
      return {
        catBEligible: false,
        patientReached: 'Yes',
        severity: 'Reached',
        reason: 'พบคำระบุว่ายาถึงตัวผู้ป่วยแล้ว (' + reachedClue + ') ต้องรายงานผ่านระบบ Incident ปกติของ รพ.'
      };
    }

    return {
      catBEligible: true,
      patientReached: 'No',
      severity: 'B',
      reason: 'ตรวจพบและแก้ไขได้ก่อนถึงตัวผู้ป่วย เข้าเกณฑ์ Category B'
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Entity Extraction Helpers
  // ---------------------------------------------------------------------------

  function extractActualExpected(text) {
    var clean = text.replace(/^(?:โอพีดี|ไอพีดี)\s*/, '');
    clean = clean.replace(/\s*(?:เภสัช|วอร์ด|พยาบาล).*(?:เจอ|ตรวจ|เช็ค|ทวน|final check).*$/, '');

    // Pattern 1: [actual] แทน [expected]
    var matchA = clean.match(/(.+?)\s*(?:มา)?แทน\s*(.+)/);
    if (matchA && !/แต่/.test(clean)) {
      var actA = matchA[1].replace(/^(?:คนจัด|หมอ|ห้องยา)?\s*(?:หยิบ|จัด|สั่ง|คีย์)?\s*/, '').trim();
      var expA = matchA[2].replace(/^(?:คนจัด|หมอ|ห้องยา)?\s*(?:หยิบ|จัด|สั่ง|คีย์)?\s*/, '').trim();
      return { actual: actA, expected: expA };
    }

    // Pattern 2: [actual] แต่ [expected]
    var matchB = clean.match(/(.+?)\s*แต่\s*(.+)/);
    if (matchB) {
      var actB = matchB[1];
      var expB = matchB[2];

      var actDetailMatch = actB.match(/(?:จัด|สั่ง|คีย์|หยิบ|มี)\s*(?:ยา)?\s*(.+)$/);
      if (actDetailMatch) {
        actB = actDetailMatch[1];
      }
      actB = actB.replace(/^(?:คนจัด|หมอ|ห้องยา)?\s*(?:หยิบ|จัด|สั่ง|คีย์)?\s*/, '')
                 .replace(/^(?:ไม่ครบ|เกิน)\s*/, '')
                 .replace(/^มา\s*/, '')
                 .replace(/\s*มา\s*/, ' ')
                 .replace(/^.*?(?:ไม่ครบ|ขาดไป)\s*(?:จัด\s*)?/, '')
                 .trim();

      expB = expB.replace(/^(?:จริงๆ|ความจริง)?\s*(?:ต้อง|ควร|ฉลากระบุ|ฉลาก|ใบสั่ง|ยาประจำคนไข้เป็น|ยาประจำคนไข้|ยาประจำ|คนไข้นัด)?\s*(?:จัด|หยิบ|สั่ง|คีย์|เป็น|คือ)?\s*/, '')
                 .replace(/^(?:ต้อง|ควร|จัด|หยิบ|สั่ง|คีย์)\s*/, '').trim();

      return { actual: actB, expected: expB };
    }

    return { actual: '', expected: '' };
  }

  function extractEntities(text) {
    var lower = text.toLowerCase();
    var drugsFound = [];

    DRUG_DICTIONARY.forEach(function (d) {
      if (lower.indexOf(d.key) !== -1) {
        if (drugsFound.indexOf(d.name) === -1) {
          drugsFound.push(d.name);
        }
      }
    });

    // Extract numbers with units (e.g. 10 mg, 5 mg, 30 เม็ด, 60 เม็ด, 20 mEq, 2 ส่วน, ครึ่งเม็ด)
    var numUnitMatches = [];
    var regex = /(\d+(?:\.\d+)?|ครึ่ง)\s*(mg|mcg|g|mL|เม็ด|แคปซูล|vial|amp|mEq|ส่วน|แผง)/gi;
    var m;
    while ((m = regex.exec(text)) !== null) {
      numUnitMatches.push({
        value: m[1],
        unit: m[2],
        full: m[0]
      });
    }

    var comp = extractActualExpected(text);

    return {
      drugs: drugsFound,
      measurements: numUnitMatches,
      actual: comp.actual,
      expected: comp.expected
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Rule-Based Parser Core
  // ---------------------------------------------------------------------------

  function parseMedicationError(transcript, mode) {
    // Mode context: UI selected mode (defaults to OPD)
    var currentMode = (mode && String(mode).toUpperCase() === 'IPD') ? 'IPD' : 'OPD';

    // 1. Normalize
    var normalized = normalizeTranscript(transcript);

    // 2. Cat B Safety Gate
    var safetyGate = checkCatBSafetyGate(normalized);
    if (!safetyGate.catBEligible) {
      return {
        mode: currentMode,
        rawTranscript: transcript,
        normalizedTranscript: normalized,
        catBEligible: false,
        patientReached: safetyGate.patientReached,
        severity: safetyGate.severity,
        safetyStopReason: safetyGate.reason,
        requiresClarification: false,
        legacyCode: null,
        process: null,
        errorType: null,
        detectedStage: null,
        confidence: 'Low'
      };
    }

    var entities = extractEntities(normalized);

    // Run Mode-Specific Rule Evaluation
    var parseResult;
    if (currentMode === 'OPD') {
      parseResult = evaluateOpdRules(normalized, entities);
    } else {
      parseResult = evaluateIpdRules(normalized, entities);
    }

    return {
      parserVersion: PARSER_VERSION,
      mode: currentMode,
      rawTranscript: transcript,
      normalizedTranscript: normalized,
      catBEligible: true,
      patientReached: 'No',
      severity: 'B',
      legacyCode: parseResult.legacyCode,
      process: parseResult.process,
      processStage: parseResult.processStage,
      errorType: parseResult.errorType,
      detectedStage: parseResult.detectedStage,
      detectedStageName: DETECTED_STAGES[parseResult.detectedStage] ? DETECTED_STAGES[parseResult.detectedStage].nameTh : '',
      confidence: parseResult.confidence,
      needsConfirmation: parseResult.needsConfirmation || (parseResult.confidence !== 'High'),
      requiresClarification: parseResult.requiresClarification || false,
      clarification: parseResult.clarification || null,
      extractedEntities: {
        drugs: entities.drugs,
        measurements: entities.measurements,
        actual: parseResult.actual || entities.actual || '',
        expected: parseResult.expected || entities.expected || ''
      },
      ruleId: parseResult.ruleId || ''
    };
  }

  // ---------------------------------------------------------------------------
  // 6. OPD Rule Evaluation
  // ---------------------------------------------------------------------------

  function evaluateOpdRules(text, entities) {
    // A. Actor detection
    var isPrescriber = /หมอสั่ง|แพทย์สั่ง|หมอคีย์|หมอลืม|หมอกด/.test(text);
    var isPharmacyEntry = /ห้องยาคีย์|คีย์ฉลาก|พิมพ์ฉลาก|ตรวจฉลาก|คีย์ยา|คีย์.*เม็ด|คีย์.*วัน/.test(text) && !isPrescriber;
    var isPicker = /คนจัด|จัดยา|หยิบ|คนหยิบ|ตะกร้า|จัด.*เม็ด|จัด.*ส่วน|จัด.*มา|จัด.*แทน|จัด.*ไม่ครบ/.test(text);
    var isTranscribingDoc = /สแกน|สติ๊กเกอร์|ใบนำทาง|ใบสั่งยา/.test(text) && (/สแกนไม่ชัด|ผิดคน|สติ๊กเกอร์.*ผิด/.test(text));

    // B. Detected stage detection
    var detectedStage = 'DS01';
    if (/เช็คฉลาก|ตรวจฉลาก|ตรวจการคีย์|ตรวจคีย์/.test(text)) {
      detectedStage = 'DS02';
    } else if (/final check|เช็คเจอก่อนจ่าย|ตรวจเจอก่อนจ่าย|ทวนก่อนจ่าย|เช็คเจอ|ตรวจเจอ|เภสัชตรวจ|เภสัชเช็ค/.test(text)) {
      if (isPicker || isPharmacyEntry) {
        detectedStage = isPharmacyEntry ? 'DS02' : 'DS04';
      } else if (isPrescriber || isTranscribingDoc) {
        detectedStage = isTranscribingDoc && /ตรวจเจอก่อนจ่าย/.test(text) && /สติ๊กเกอร์/.test(text) ? 'DS02' : 'DS01';
      } else {
        detectedStage = 'DS04';
      }
    }

    // --- Specific Rule Matching (Ordered by precision) ---

    // 1. Transcribing errors (E05, E06)
    if (/สติ๊กเกอร์.*ผิดคน|ชื่อ.*ผิดคน|ติดสติ๊กเกอร์/.test(text)) {
      return {
        ruleId: 'OPD-TRANS-E06',
        process: 'Transcribing',
        processStage: 'PS07',
        errorType: 'ฉลากระบุตัวผู้ป่วยผิด/ขาด',
        legacyCode: 'E06',
        detectedStage: 'DS02',
        confidence: 'High',
        needsConfirmation: false
      };
    }

    if (/สแกน(ใบสั่งยา)?ไม่ชัด|อ่านคำสั่งไม่ได้/.test(text)) {
      return {
        ruleId: 'OPD-TRANS-E05',
        process: 'Transcribing',
        processStage: 'PS07',
        errorType: 'ปัญหาการสแกน/ภาพเอกสาร',
        legacyCode: 'E05',
        detectedStage: 'DS01',
        confidence: 'High',
        needsConfirmation: false
      };
    }

    // 2. Prescribing errors (A01 - A17)
    if (isPrescriber) {
      // Allergy (A01)
      if (/แพ้|ประวัติแพ้|allergy/.test(text)) {
        return {
          ruleId: 'OPD-A01',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ความคลาดเคลื่อนเกี่ยวกับประวัติแพ้ยา',
          legacyCode: 'A01',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Remed / Wrong visit (A17)
      if (/remed|ผิด visit|visit เก่า/.test(text)) {
        return {
          ruleId: 'OPD-A17',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ผิด visit',
          legacyCode: 'A17',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Drug-Drug Interaction (A08)
      if (/interaction|ปฏิกิริยา|คู่กับ|ตีกัน/.test(text)) {
        return {
          ruleId: 'OPD-A08',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ปฏิกิริยาระหว่างยา',
          legacyCode: 'A08',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Duplicate order (A11)
      if (/ซ้ำ|ซ้ำซ้อน|duplicate/.test(text)) {
        return {
          ruleId: 'OPD-A11',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ยาซ้ำ/ซ้ำซ้อน',
          legacyCode: 'A11',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Omission / Missed drug (A16)
      if (/ลืมคีย์|ยาตก|ไม่ครบรายการ|ตกหล่น|ลืมสั่ง/.test(text)) {
        return {
          ruleId: 'OPD-A16',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ยาตกหล่น/ไม่ครบรายการ',
          legacyCode: 'A16',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Incomplete instruction (A15)
      if (/ไม่ได้คีย์วิธีใช้|วิธีใช้ไม่ชัด|คำสั่งไม่ครบ|ไม่ระบุวิธีใช้/.test(text)) {
        return {
          ruleId: 'OPD-A15',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'คำสั่งยาไม่ครบ/ไม่ชัด',
          legacyCode: 'A15',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong dose per time (A07)
      if (/เม็ดต่อครั้ง|ครั้งละ|dose สูง|dose ต่ำ|ขนาดยา/.test(text) || (/ควร.*เม็ด|แต่ต้อง.*เม็ด/.test(text) && /ต่อครั้ง|ครั้งละ/.test(text))) {
        return {
          ruleId: 'OPD-A07',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ผิดขนาดยา',
          legacyCode: 'A07',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong strength (A05)
      if (/ผิดความแรง|มิล.*เดิม|มิล.*แต่|10 mg.*5 mg|5 mg.*10 mg|mg แทน/.test(text) || (/ยาประจำ.*(5|10|20)/.test(text) && /mg|มิล/.test(text))) {
        return {
          ruleId: 'OPD-A05',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ผิดความแรง',
          legacyCode: 'A05',
          detectedStage: 'DS01',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong quantity vs appointment day (A10)
      if (/วันนัด|แต่วันนัด|ไม่พอวันนัด|สั่ง.*เม็ด.*วันนัด/.test(text) || (/30 เม็ด.*60 เม็ด|60 เม็ด.*30 เม็ด/.test(text) && !isPicker)) {
        return {
          ruleId: 'OPD-A10',
          process: 'Prescribing',
          processStage: 'PS01',
          errorType: 'ผิดจำนวน/ปริมาณ',
          legacyCode: 'A10',
          detectedStage: 'DS01',
          confidence: 'Medium',
          needsConfirmation: true
        };
      }
    }

    // 3. Pre-dispensing: Pharmacy Entry errors (B03, B06, B08, B09)
    if (isPharmacyEntry || (/คีย์ฉลาก|ตรวจฉลาก|คีย์ยา/.test(text) && !isPicker)) {
      // Wrong duration / date / appointment (B09)
      if (/วันนัด|ถึงแค่.*วัน|ไม่ถึงวันนัด/.test(text)) {
        return {
          ruleId: 'OPD-B09',
          process: 'Pre-dispensing',
          processStage: 'PS02',
          errorType: 'ผิดระยะเวลา/ช่วงวันที่',
          legacyCode: 'B09',
          detectedStage: 'DS02',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong instruction / sig (B06)
      if (/วันละครั้ง|วันละสองครั้ง|วันละ|วิธีใช้|ฉลาก.*ใบสั่ง/.test(text)) {
        return {
          ruleId: 'OPD-B06',
          process: 'Pre-dispensing',
          processStage: 'PS02',
          errorType: 'วิธีใช้/วิธีบริหารยาผิด',
          legacyCode: 'B06',
          detectedStage: 'DS02',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong drug name entry (B03)
      if (/เป็น|แทน|ผิดตัว|ผิดชนิด/.test(text) && entities.drugs.length >= 2) {
        return {
          ruleId: 'OPD-B03',
          process: 'Pre-dispensing',
          processStage: 'PS02',
          errorType: 'ผิดชนิดยา',
          legacyCode: 'B03',
          detectedStage: 'DS02',
          confidence: 'High',
          needsConfirmation: false
        };
      }
    }

    // 4. Pre-dispensing: Picking & Preparation errors (B26 - B35)
    if (isPicker || /ตะกร้า|คนจัด|จัด.*แทน|จัด.*มา/.test(text)) {
      // Light protection / packaging (B35)
      if (/ซองสีชา|กันแสง|บรรจุภัณฑ์/.test(text)) {
        return {
          ruleId: 'OPD-B35',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'บรรจุภัณฑ์/การป้องกันยาไม่เหมาะสม',
          legacyCode: 'B35',
          detectedStage: 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Expired medication (B32)
      if (/หมดอายุ|expired|เสื่อมสภาพ/.test(text)) {
        return {
          ruleId: 'OPD-B32',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ยาหมดอายุ/เสื่อมสภาพ',
          legacyCode: 'B32',
          detectedStage: 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Extra unprescribed drug (B31)
      if (/เกินมา|ไม่ได้สั่ง|ยาเกิน/.test(text)) {
        return {
          ruleId: 'OPD-B31',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ยาเกินรายการ/ไม่ได้สั่ง',
          legacyCode: 'B31',
          detectedStage: 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Omission / missing drug item (B30)
      if (/ยาตก|ไม่ครบรายการ|ตกหล่น/.test(text) || (/จัดมาแค่/.test(text) && /รายการ/.test(text)) || (/ขาดไป/.test(text) && !/(เม็ด|ส่วน|แคปซูล|แผง|ขวด)/.test(text))) {
        return {
          ruleId: 'OPD-B30',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ยาตกหล่น/ไม่ครบรายการ',
          legacyCode: 'B30',
          detectedStage: 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong quantity (B29)
      if ((/เม็ด|ส่วน|แผง|แคปซูล|ขวด/.test(text) || /ไม่ครบ|ขาดไป/.test(text)) && !/แทน/.test(text)) {
        return {
          ruleId: 'OPD-B29',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ผิดจำนวน/ปริมาณ',
          legacyCode: 'B29',
          detectedStage: 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong strength (B28)
      if (/มิล.*แทน|mg.*แทน|ผิดความแรง/.test(text) || (/10 mg.*5 mg|5 mg.*10 mg/.test(text) && /แทน|มาแทน/.test(text))) {
        return {
          ruleId: 'OPD-B28',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ผิดความแรง',
          legacyCode: 'B28',
          detectedStage: 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Wrong drug (B26)
      if (/แทน|ผิดตัว|ผิดชนิด|หยิบ.*แทน/.test(text)) {
        return {
          ruleId: 'OPD-B26',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ผิดชนิดยา',
          legacyCode: 'B26',
          detectedStage: 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }
    }

    // Default Fallback / Clarification Check
    if (/จำนวนผิด|เม็ด/.test(text)) {
      return {
        ruleId: 'OPD-CL01',
        process: 'Pre-dispensing',
        processStage: 'PS04',
        errorType: 'ผิดจำนวน/ปริมาณ',
        legacyCode: 'B29',
        detectedStage: 'DS04',
        confidence: 'Medium',
        needsConfirmation: true,
        requiresClarification: true,
        clarification: {
          id: 'CL01',
          question: 'จำนวนผิดเกิดที่ขั้นตอนไหน?',
          choices: ['แพทย์สั่ง (A10)', 'ห้องยาคีย์ (B08)', 'คนจัดยา (B29)']
        }
      };
    }

    return {
      ruleId: 'OPD-UNKNOWN',
      process: 'Pre-dispensing',
      processStage: 'PS04',
      errorType: 'ไม่สามารถระบุได้ชัดเจน',
      legacyCode: null,
      detectedStage: detectedStage,
      confidence: 'Low',
      needsConfirmation: true
    };
  }

  // ---------------------------------------------------------------------------
  // 7. IPD Rule Evaluation
  // ---------------------------------------------------------------------------

  function evaluateIpdRules(text, entities) {
    // A. Actor / Stage indicators
    var isPrescriber = /หมอสั่ง|แพทย์สั่ง|หมอคีย์/.test(text);
    var isOrderReception = /รับ order|รับคำสั่ง|drug profile|continue|one day|off/.test(text);
    var isTranscription = /พยาบาลรับคำสั่ง|รคส|รับคำสั่งโทรศัพท์/.test(text);
    var isPicker = /คนจัด|จัดยา|หยิบ|ตะกร้า|ถุงยา|เตียงข้าง/.test(text);
    var isWardIntercept = /วอร์ดเปิดถุง|วอร์ดเจอ|พยาบาลเจอ|เปิดถุงยาแล้วเจอ/.test(text);

    // B. Detected Stage Default
    var detectedStage = 'DS01';
    if (isWardIntercept) {
      detectedStage = 'DS06';
    } else if (/ก่อนส่ง(ยา)?(ให้)?วอร์ด|ก่อนขึ้นวอร์ด/.test(text)) {
      detectedStage = 'DS05';
    } else if (/final check|เช็คเจอก่อนส่งวอร์ด|final check เจอ/.test(text)) {
      detectedStage = 'DS04';
    } else if (isOrderReception || isPrescriber || isTranscription) {
      detectedStage = 'DS01';
    }

    // --- Specific Rule Matching ---

    // 1. Transcription: Phone order (E08)
    if (isTranscription || /รับคำสั่งโทรศัพท์/.test(text)) {
      return {
        ruleId: 'IPD-TRANS-E08',
        process: 'Transcribing',
        processStage: 'PS03',
        errorType: 'ถ่ายทอด/รับคำสั่งคลาดเคลื่อน',
        legacyCode: 'E08',
        detectedStage: 'DS01',
        confidence: 'High',
        needsConfirmation: false
      };
    }

    // 2. Prescribing: Allergy (A01)
    if (isPrescriber && /แพ้|ประวัติแพ้|allergy/.test(text)) {
      return {
        ruleId: 'IPD-A01',
        process: 'Prescribing',
        processStage: 'PS01',
        errorType: 'ความคลาดเคลื่อนเกี่ยวกับประวัติแพ้ยา',
        legacyCode: 'A01',
        detectedStage: 'DS01',
        confidence: 'High',
        needsConfirmation: false
      };
    }

    // 3. STAT Ambiguity (B22 vs E11)
    if (/STAT|stat|ด่วน/i.test(text)) {
      if (/ไม่ได้ติดป้าย|ขอก่อน|ลืมติดป้าย/.test(text)) {
        return {
          ruleId: 'IPD-E11',
          process: 'Transcribing',
          processStage: 'PS07',
          errorType: 'ตกหล่นคำสั่ง STAT/ด่วน',
          legacyCode: 'E11',
          detectedStage: 'DS05',
          confidence: 'High',
          needsConfirmation: false
        };
      }
      return {
        ruleId: 'IPD-B22',
        process: 'Pre-dispensing',
        processStage: 'PS03',
        errorType: 'ตกหล่นคำสั่ง STAT/ด่วน',
        legacyCode: 'B22',
        detectedStage: 'DS05',
        confidence: 'Medium',
        needsConfirmation: true,
        clarification: {
          id: 'CL04',
          question: 'ปัญหา STAT เกิดจากสาเหตุใด?',
          choices: ['ห้องยาไม่ได้รับคำสั่ง STAT (B22)', 'วอร์ดไม่ได้ติดป้าย STAT/ขอก่อน (E11)']
        }
      };
    }

    // 4. Order type: continue vs one day (B21)
    if (/continue.*one day|one day.*continue|ผิดประเภทคำสั่ง/.test(text)) {
      return {
        ruleId: 'IPD-B21',
        process: 'Pre-dispensing',
        processStage: 'PS03',
        errorType: 'ผิดประเภทคำสั่งยา',
        legacyCode: 'B21',
        detectedStage: 'DS01',
        confidence: 'High',
        needsConfirmation: false
      };
    }

    // 5. Un-discontinued medication / Failed to off (B23)
    if (/ยังไม่ได้ off|ลืม off|ไม่ได้ off|หมอสั่ง off.*ยังไม่ได้ off/.test(text)) {
      return {
        ruleId: 'IPD-B23',
        process: 'Pre-dispensing',
        processStage: 'PS03',
        errorType: 'ไม่หยุดยาตามคำสั่ง',
        legacyCode: 'B23',
        detectedStage: 'DS01',
        confidence: 'High',
        needsConfirmation: false
      };
    }

    // 6. Pre-dispensing: Order Reception Strength error (B16)
    if (/รับคำสั่ง.*mEq|รับคำสั่ง.*mg|รับ.*เป็น.*mEq|รับ.*เป็น.*mg/.test(text) || (/20 mEq.*40 mEq|40 mEq.*20 mEq/.test(text) && /รับ/.test(text))) {
      return {
        ruleId: 'IPD-B16',
        process: 'Pre-dispensing',
        processStage: 'PS03',
        errorType: 'ผิดความแรง',
        legacyCode: 'B16',
        detectedStage: 'DS01',
        confidence: 'Medium',
        needsConfirmation: true
      };
    }

    // 7. Pre-dispensing: Order Reception Omission (B18)
    if ((/รับเข้ามาแค่|ตกคำสั่ง|order.*สามรายการ.*สองรายการ/.test(text)) && !isPicker) {
      return {
        ruleId: 'IPD-B18',
        process: 'Pre-dispensing',
        processStage: 'PS03',
        errorType: 'ยาตกหล่น/ไม่ครบรายการ',
        legacyCode: 'B18',
        detectedStage: 'DS01',
        confidence: 'High',
        needsConfirmation: false
      };
    }

    // 8. Wrong patient in Picking / Ward delivery (B25 vs B34)
    if (/ผิดคน|เตียงข้าง|คนไข้คนอื่น|ผู้ป่วยอีกคน|คนอื่นปน/.test(text)) {
      // Ward intercept mixed item (B34)
      if (/ปนมา|ปนบางรายการ|วอร์ดเปิดถุง/.test(text)) {
        return {
          ruleId: 'IPD-B34',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ผิดผู้ป่วย',
          legacyCode: 'B34',
          detectedStage: isWardIntercept ? 'DS06' : 'DS04',
          confidence: 'High',
          needsConfirmation: false
        };
      }

      // Entire bag / whole set (B25)
      if (/ทั้งถุง|ทั้งชุด|คนไข้เตียงข้าง/.test(text)) {
        return {
          ruleId: 'IPD-B25',
          process: 'Pre-dispensing',
          processStage: 'PS04',
          errorType: 'ผิดผู้ป่วย',
          legacyCode: 'B25',
          detectedStage: 'DS04',
          confidence: 'Medium',
          needsConfirmation: true,
          clarification: {
            id: 'CL03',
            question: 'ลักษณะผิดคนแบบไหน?',
            choices: ['ทั้งชุดเป็นของคนอื่น (B25)', 'มียาคนอื่นปนบางรายการ (B34)']
          }
        };
      }
    }

    // Default Fallback
    return {
      ruleId: 'IPD-UNKNOWN',
      process: 'Pre-dispensing',
      processStage: 'PS03',
      errorType: 'ไม่สามารถระบุได้ชัดเจน',
      legacyCode: null,
      detectedStage: detectedStage,
      confidence: 'Low',
      needsConfirmation: true
    };
  }

  // ---------------------------------------------------------------------------
  // Public Interface
  // ---------------------------------------------------------------------------

  return {
    PARSER_VERSION: PARSER_VERSION,
    normalizeTranscript: normalizeTranscript,
    checkCatBSafetyGate: checkCatBSafetyGate,
    parseMedicationError: parseMedicationError,
    DETECTED_STAGES: DETECTED_STAGES
  };
});
