/**
 * CatchME — Medication Error Cat B Quick Reporter
 * Automated Test Runner: 30 Speech Test Cases & Cat B Safety Gate
 * 
 * Usage:
 *   node tests/parser-tests.js
 *   npm test
 */

const { parseMedicationError, normalizeTranscript, checkCatBSafetyGate, PARSER_VERSION } = require('../src/Parser.gs');

console.log('================================================================');
console.log(`CatchME Parser Test Suite — Version ${PARSER_VERSION}`);
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. 30 Speech Test Cases from Medication_Error_CatB_Mapping_Master_V2
// -----------------------------------------------------------------------------

const SPEECH_TEST_CASES = [
  {
    id: 'T01',
    setting: 'OPD',
    phrase: 'โอพีดี หมอสั่ง amoxicillin ทั้งที่คนไข้มีประวัติแพ้ penicillin เภสัชเช็คเจอก่อนจ่าย',
    expectedLegacyCode: 'A01',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ความคลาดเคลื่อนเกี่ยวกับประวัติแพ้ยา',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T02',
    setting: 'OPD',
    phrase: 'หมอสั่ง amlodipine 10 มิล แต่ยาประจำคนไข้เป็น 5 มิล เภสัชทวนเจอ',
    expectedLegacyCode: 'A05',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ผิดความแรง',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T03',
    setting: 'OPD',
    phrase: 'หมอสั่ง prednisolone ห้าเม็ดต่อครั้ง แต่ควรสองเม็ด เภสัชเช็คเจอ',
    expectedLegacyCode: 'A07',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ผิดขนาดยา',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T04',
    setting: 'OPD',
    phrase: 'หมอลืมคีย์ metformin ใน HOSxP เภสัชทวนยาประจำแล้วเจอ',
    expectedLegacyCode: 'A16',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ยาตกหล่น/ไม่ครบรายการ',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T05',
    setting: 'OPD',
    phrase: 'หมอคีย์ simvastatin มาแต่ไม่ได้คีย์วิธีใช้ เภสัชเช็คเจอ',
    expectedLegacyCode: 'A15',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'คำสั่งยาไม่ครบ/ไม่ชัด',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T06',
    setting: 'OPD',
    phrase: 'หมอกด remed มาจาก visit เก่า ผิด visit เภสัชตรวจเจอ',
    expectedLegacyCode: 'A17',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ผิด visit',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T07',
    setting: 'OPD',
    phrase: 'หมอสั่ง losartan ซ้ำสองรายการ เภสัชทวนก่อนจ่ายเจอ',
    expectedLegacyCode: 'A11',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ยาซ้ำ/ซ้ำซ้อน',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T08',
    setting: 'OPD',
    phrase: 'หมอสั่ง warfarin คู่กับ cotrimoxazole เภสัชเช็ค interaction แล้วโทรแก้ก่อนจ่าย',
    expectedLegacyCode: 'A08',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ปฏิกิริยาระหว่างยา',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T09',
    setting: 'OPD',
    phrase: 'หมอสั่ง amlodipine 30 เม็ด แต่วันนัดต้องใช้ 60 เม็ด เภสัชเช็คเจอ',
    expectedLegacyCode: 'A10',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ผิดจำนวน/ปริมาณ',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'Medium',
    expectedNeedsConfirm: true,
    expectedCatB: true
  },
  {
    id: 'T10',
    setting: 'OPD',
    phrase: 'ห้องยาคีย์ gliclazide เป็น glipizide เภสัชเช็คฉลากเจอ',
    expectedLegacyCode: 'B03',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดชนิดยา',
    expectedDetectedStage: 'DS02',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T11',
    setting: 'OPD',
    phrase: 'คีย์ฉลาก metformin เป็นวันละครั้ง แต่ใบสั่งวันละสองครั้ง ตรวจฉลากเจอ',
    expectedLegacyCode: 'B06',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'วิธีใช้/วิธีบริหารยาผิด',
    expectedDetectedStage: 'DS02',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T12',
    setting: 'OPD',
    phrase: 'คีย์ยาถึงแค่สามสิบวันแต่คนไข้นัดหกสิบวัน เภสัชตรวจเจอ',
    expectedLegacyCode: 'B09',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดระยะเวลา/ช่วงวันที่',
    expectedDetectedStage: 'DS02',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T13',
    setting: 'OPD',
    phrase: 'คนจัดหยิบ tramadol แทน paracetamol เภสัชเช็คเจอก่อนจ่าย',
    expectedLegacyCode: 'B26',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดชนิดยา',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T14',
    setting: 'OPD',
    phrase: 'คนจัด amlodipine 10 มิลมาแทน 5 มิล เภสัช final check เจอ',
    expectedLegacyCode: 'B28',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดความแรง',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T15',
    setting: 'OPD',
    phrase: 'คนจัด simvastatin มา 240 เม็ด แต่ฉลาก 120 เม็ด เภสัชเช็คเจอ',
    expectedLegacyCode: 'B29',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดจำนวน/ปริมาณ',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T16',
    setting: 'OPD',
    phrase: 'ใบสั่งมีห้ารายการแต่คนจัดมาแค่สี่รายการ เภสัชตรวจเจอยาตกหนึ่งตัว',
    expectedLegacyCode: 'B30',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ยาตกหล่น/ไม่ครบรายการ',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T17',
    setting: 'OPD',
    phrase: 'คนจัดมียาเกินมาอีกหนึ่งรายการที่หมอไม่ได้สั่ง เภสัชเช็คเจอ',
    expectedLegacyCode: 'B31',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ยาเกินรายการ/ไม่ได้สั่ง',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T18',
    setting: 'OPD',
    phrase: 'เภสัชเช็คเจอยาหมดอายุอยู่ในตะกร้าก่อนจ่ายคนไข้',
    expectedLegacyCode: 'B32',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ยาหมดอายุ/เสื่อมสภาพ',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T19',
    setting: 'OPD',
    phrase: 'จัด nifedipine ที่ต้องกันแสงมาแต่ไม่ได้ใส่ซองสีชา เภสัชเช็คเจอ',
    expectedLegacyCode: 'B35',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'บรรจุภัณฑ์/การป้องกันยาไม่เหมาะสม',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T20',
    setting: 'OPD',
    phrase: 'ติดสติ๊กเกอร์ชื่อคนไข้ผิดคนที่ใบสั่งยา แล้วห้องยาตรวจเจอก่อนจ่าย',
    expectedLegacyCode: 'E06',
    expectedProcess: 'Transcribing',
    expectedErrorType: 'ฉลากระบุตัวผู้ป่วยผิด/ขาด',
    expectedDetectedStage: 'DS02',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T21',
    setting: 'OPD',
    phrase: 'สแกนใบสั่งยาไม่ชัด เภสัชอ่านคำสั่งไม่ได้เลยให้สแกนใหม่ก่อนจัดยา',
    expectedLegacyCode: 'E05',
    expectedProcess: 'Transcribing',
    expectedErrorType: 'ปัญหาการสแกน/ภาพเอกสาร',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T22',
    setting: 'IPD',
    phrase: 'ไอพีดี หมอสั่ง ceftriaxone ทั้งที่คนไข้มีประวัติแพ้ cephalosporin เภสัชทวน order เจอ',
    expectedLegacyCode: 'A01',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ความคลาดเคลื่อนเกี่ยวกับประวัติแพ้ยา',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T23',
    setting: 'IPD',
    phrase: 'รับ order ยาเป็น continue แต่หมอสั่ง one day เภสัชเช็ค drug profile เจอ',
    expectedLegacyCode: 'B21',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดประเภทคำสั่งยา',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T24',
    setting: 'IPD',
    phrase: 'มีคำสั่ง stat meropenem แต่ห้องยาไม่ได้รับ stat เภสัชมาเจอก่อนส่งยาให้วอร์ด',
    expectedLegacyCode: 'B22',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ตกหล่นคำสั่ง STAT/ด่วน',
    expectedDetectedStage: 'DS05',
    expectedConfidence: 'Medium',
    expectedNeedsConfirm: true,
    expectedCatB: true
  },
  {
    id: 'T25',
    setting: 'IPD',
    phrase: 'หมอสั่ง off enoxaparin แล้วแต่ใน drug profile ยังไม่ได้ off เภสัชตรวจเจอ',
    expectedLegacyCode: 'B23',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ไม่หยุดยาตามคำสั่ง',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T26',
    setting: 'IPD',
    phrase: 'รับคำสั่ง potassium chloride 20 mEq เป็น 40 mEq เภสัชทวนแล้วเจอ',
    expectedLegacyCode: 'B16',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดความแรง',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'Medium',
    expectedNeedsConfirm: true,
    expectedCatB: true
  },
  {
    id: 'T27',
    setting: 'IPD',
    phrase: 'วอร์ดส่ง order มาสามรายการแต่ห้องยารับเข้ามาแค่สองรายการ เภสัชทวนเจอ',
    expectedLegacyCode: 'B18',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ยาตกหล่น/ไม่ครบรายการ',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T28',
    setting: 'IPD',
    phrase: 'คนจัดยาใส่ยาของคนไข้เตียงข้าง ๆ มาทั้งถุง เภสัช final check เจอก่อนส่งวอร์ด',
    expectedLegacyCode: 'B25',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดผู้ป่วย',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'Medium',
    expectedNeedsConfirm: true,
    expectedCatB: true
  },
  {
    id: 'T29',
    setting: 'IPD',
    phrase: 'วอร์ดเปิดถุงยาแล้วเจอยาของผู้ป่วยอีกคนปนมา แต่ยังไม่ได้เอาไปให้คนไข้',
    expectedLegacyCode: 'B34',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดผู้ป่วย',
    expectedDetectedStage: 'DS06',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T30',
    setting: 'IPD',
    phrase: 'พยาบาลรับคำสั่งโทรศัพท์ cefazolin เป็น ceftazidime แล้วเภสัชทวนเจอก่อนจัดยา',
    expectedLegacyCode: 'E08',
    expectedProcess: 'Transcribing',
    expectedErrorType: 'ถ่ายทอด/รับคำสั่งคลาดเคลื่อน',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true
  },
  {
    id: 'T31',
    setting: 'OPD',
    phrase: 'จัด Metoprolol ไม่ครบ จัด ครึ่ง เม็ด มา 2 ส่วน แต่จริงๆ ต้องจัด ครึ่งเม็ด 3 ส่วน',
    expectedLegacyCode: 'B29',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดจำนวน/ปริมาณ',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true,
    expectedDrug: 'Metoprolol'
  },
  {
    id: 'T32',
    setting: 'OPD',
    phrase: 'จัด เมโทโพรลอล ไม่ครบ จัด ครึ่ง เม็ด มา สอง ส่วน แต่จริงๆ ต้องจัด ครึ่งเม็ด สาม ส่วน',
    expectedLegacyCode: 'B29',
    expectedProcess: 'Pre-dispensing',
    expectedErrorType: 'ผิดจำนวน/ปริมาณ',
    expectedDetectedStage: 'DS04',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true,
    expectedDrug: 'Metoprolol'
  },
  {
    id: 'T33',
    setting: 'OPD',
    phrase: 'หมอสั่ง แอมโล 10 มิล แต่ยาประจำคนไข้เป็น 5 มิล เภสัชทวนเจอ',
    expectedLegacyCode: 'A05',
    expectedProcess: 'Prescribing',
    expectedErrorType: 'ผิดความแรง',
    expectedDetectedStage: 'DS01',
    expectedConfidence: 'High',
    expectedNeedsConfirm: false,
    expectedCatB: true,
    expectedDrug: 'Amlodipine'
  }
];

// -----------------------------------------------------------------------------
// 2. Hard Stop Cases (Cat B Safety Gate: Patient Reached)
// -----------------------------------------------------------------------------

const HARD_STOP_CASES = [
  {
    id: 'HS01',
    setting: 'OPD',
    phrase: 'จ่ายยาไปแล้ว คนไข้กินไปหนึ่งเม็ด',
    expectedCatB: false,
    expectedReached: 'Yes'
  },
  {
    id: 'HS02',
    setting: 'IPD',
    phrase: 'พยาบาลให้ยาคนไข้แล้ว คนไข้ได้รับยาแล้ว',
    expectedCatB: false,
    expectedReached: 'Yes'
  },
  {
    id: 'HS03',
    setting: 'OPD',
    phrase: 'คนไข้กินยาผิดขนาดไปแล้วสามวัน',
    expectedCatB: false,
    expectedReached: 'Yes'
  }
];

// -----------------------------------------------------------------------------
// 3. Test Execution & Reporting
// -----------------------------------------------------------------------------

let totalPassed = 0;
let totalFailed = 0;

console.log('--- RUNNING SPEECH TEST CASES ---\n');

SPEECH_TEST_CASES.forEach((tc) => {
  const result = parseMedicationError(tc.phrase, tc.setting);

  const passCode = result.legacyCode === tc.expectedLegacyCode;
  const passProcess = result.process === tc.expectedProcess;
  const passError = result.errorType === tc.expectedErrorType;
  const passStage = result.detectedStage === tc.expectedDetectedStage;
  const passConf = result.confidence === tc.expectedConfidence;
  const passCatB = result.catBEligible === tc.expectedCatB;
  const passDrug = !tc.expectedDrug || (result.extractedEntities && result.extractedEntities.drugs && result.extractedEntities.drugs.includes(tc.expectedDrug));

  const isAllPass = passCode && passProcess && passError && passStage && passConf && passCatB && passDrug;

  if (isAllPass) {
    totalPassed++;
    const drugInfo = (result.extractedEntities && result.extractedEntities.drugs.length > 0) ? ` [${result.extractedEntities.drugs.join(', ')}]` : '';
    console.log(`\x1b[32m[PASS]\x1b[0m ${tc.id} (${tc.setting}) -> ${result.legacyCode} | ${result.process} | ${result.errorType} | ${result.detectedStage} (${result.confidence})${drugInfo}`);
  } else {
    totalFailed++;
    console.log(`\x1b[31m[FAIL]\x1b[0m ${tc.id} (${tc.setting}) "${tc.phrase}"`);
    if (!passCode) console.log(`   - Legacy Code: expected "${tc.expectedLegacyCode}", got "${result.legacyCode}"`);
    if (!passProcess) console.log(`   - Process:     expected "${tc.expectedProcess}", got "${result.process}"`);
    if (!passError) console.log(`   - Error Type:  expected "${tc.expectedErrorType}", got "${result.errorType}"`);
    if (!passStage) console.log(`   - Stage:       expected "${tc.expectedDetectedStage}", got "${result.detectedStage}"`);
    if (!passConf) console.log(`   - Confidence:  expected "${tc.expectedConfidence}", got "${result.confidence}"`);
    if (!passCatB) console.log(`   - Cat B Gate:  expected ${tc.expectedCatB}, got ${result.catBEligible}`);
    if (!passDrug) console.log(`   - Drug:        expected "${tc.expectedDrug}", got "${JSON.stringify(result.extractedEntities.drugs)}"`);
  }
});

console.log('\n--- RUNNING CAT B SAFETY GATE (HARD STOP) CASES ---\n');

HARD_STOP_CASES.forEach((tc) => {
  const result = parseMedicationError(tc.phrase, tc.setting);
  const passCatB = result.catBEligible === tc.expectedCatB;
  const passReached = result.patientReached === tc.expectedReached;

  if (passCatB && passReached) {
    totalPassed++;
    console.log(`\x1b[32m[PASS]\x1b[0m ${tc.id} (${tc.setting}) Hard Stop Triggered -> CatB: ${result.catBEligible}, Reached: ${result.patientReached}`);
  } else {
    totalFailed++;
    console.log(`\x1b[31m[FAIL]\x1b[0m ${tc.id} (${tc.setting}) "${tc.phrase}"`);
    console.log(`   - CatB:    expected ${tc.expectedCatB}, got ${result.catBEligible}`);
    console.log(`   - Reached: expected "${tc.expectedReached}", got "${result.patientReached}"`);
  }
});

// -----------------------------------------------------------------------------
// 4. Summary
// -----------------------------------------------------------------------------

const totalTests = totalPassed + totalFailed;
const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

console.log('\n================================================================');
console.log(`Test Summary: ${totalPassed} / ${totalTests} Passed (${passRate}%)`);
if (totalFailed === 0) {
  console.log('\x1b[32mALL TEST CASES PASSED SUCCESSFULLY! 100% REGRESSION COMPLIANT.\x1b[0m');
} else {
  console.log(`\x1b[31m${totalFailed} TEST(S) FAILED. Please review parser rules.\x1b[0m`);
}
console.log('================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

