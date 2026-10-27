// ============================================================
// StockFlow AI - Test Suite
// Validates the full 6-stage pipeline for both scenarios
// Run: npm test
// ============================================================

const AgentOrchestrator = require('../agent/AgentOrchestrator');
const { normalScenario, difficultScenario } = require('../data/sampleData');
const { createStrategicPlan } = require('../data/businessProfiles');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n╔══════════════════════════════════════════╗');
console.log('║   StockFlow AI — Test Suite               ║');
console.log('╚══════════════════════════════════════════╝\n');

// ============================================================
// Test 1: Normal Scenario Pipeline
// ============================================================
console.log('━━━ Test 1: Normal Scenario Pipeline ━━━');

const normalPlan = createStrategicPlan('TechHub Retail', 'electronics', 'maximize_availability');
const orchestrator = new AgentOrchestrator();
const normalResults = orchestrator.run(normalScenario, normalPlan);

assert(normalResults.stages.length === 6, 'Pipeline runs all 6 stages');
assert(normalResults.stages.every(s => s.status === 'complete'), 'All stages complete successfully');
assert(normalResults.totalDurationMs < 5000, 'Pipeline completes in under 5 seconds');
assert(normalResults.stageResults.stage1_data.dataQualityReport.summary.qualityScore > 80, 'Normal scenario has high data quality (A grade)');

const normalShortages = normalResults.stageResults.stage4_imbalances.summary;
console.log(`  Shortages: ${normalShortages.totalShortages}, Excesses: ${normalShortages.totalExcesses}`);
assert(normalShortages.totalShortages > 0, 'Normal scenario detects shortages');
assert(normalShortages.totalExcesses > 0, 'Normal scenario detects excesses');

const normalTransfers = normalResults.stageResults.stage5_transfers;
console.log(`  Recommended: ${normalTransfers.summary.totalRecommended}, Rejected: ${normalTransfers.rejected.length}`);
assert(normalTransfers.rejected.length > 0, 'Normal scenario has rejected transfers (uneconomical)');
assert(normalTransfers.recommendations.every(t => t.requiresApproval === true), 'All transfers require human approval');

// Check that rejections have reasons
const normalRejected = normalTransfers.rejected[0];
assert(normalRejected.rejectionReason !== null && normalRejected.rejectionReason !== '', 'Rejected transfers have explicit rejection reasons');

console.log('');

// ============================================================
// Test 2: Difficult Scenario Pipeline
// ============================================================
console.log('━━━ Test 2: Difficult Scenario Pipeline ━━━');

const difficultPlan = createStrategicPlan('FreshTech Markets', 'mixed', 'minimize_waste_maximize_freshness');
const difficultResults = orchestrator.run(difficultScenario, difficultPlan);

assert(difficultResults.stages.length === 6, 'Difficult pipeline runs all 6 stages');
assert(difficultResults.stages.every(s => s.status === 'complete'), 'All stages complete in difficult scenario');

// Data quality should be lower
const dqReport = difficultResults.stageResults.stage1_data.dataQualityReport;
console.log(`  Data Quality: Grade ${dqReport.summary.qualityGrade}, Score ${dqReport.summary.qualityScore}`);
console.log(`  Missing records: ${dqReport.summary.missingRecords}, Stockout suppressed: ${dqReport.summary.stockoutSuppressedRecords}`);
assert(dqReport.summary.missingRecords > 0, 'Difficult scenario has missing data');
assert(dqReport.summary.stockoutSuppressedRecords > 0, 'Difficult scenario has stockout-suppressed records');

// Stockout distortion detection
const distorted = difficultResults.stageResults.stage4_imbalances.distortedHistory;
console.log(`  Stockout-distorted history detected: ${distorted.length} SKUs`);
assert(distorted.length > 0, 'Difficult scenario detects stockout-distorted history');

// Check de-biasing: debiased demand should be higher than naive
const milkDistortion = distorted.find(d => d.skuId === 'SKU-2001' && d.locationId === 'LOC-SEA');
if (milkDistortion) {
  console.log(`  Milk at SEA: Naive ${milkDistortion.naiveDemand}/day → De-biased ${milkDistortion.debiasedDemand}/day`);
  assert(milkDistortion.debiasedDemand > milkDistortion.naiveDemand, 'De-biased demand is higher than naive for stockout-distorted SKU');
} else {
  assert(false, 'Milk stockout distortion not detected');
}

// Disruption scoping - only SKU-2003 should be affected by DIS-001
const disruptions = difficultScenario.disruptions;
const audioTechDisruption = disruptions.find(d => d.disruptionId === 'DIS-001');
console.log(`  AudioTech disruption affects: ${audioTechDisruption.affectedSkus.join(', ')}`);
assert(audioTechDisruption.affectedSkus.length === 1 && audioTechDisruption.affectedSkus[0] === 'SKU-2003', 'Supply disruption scoped to specific SKU only (not blanket)');

// Transfer trap - PDX milk should be rejected
const rejectedMilk = difficultResults.stageResults.stage5_transfers.rejected.filter(r => r.skuId === 'SKU-2001');
console.log(`  Milk transfers rejected: ${rejectedMilk.length}`);
assert(rejectedMilk.length > 0, 'Transfer trap: PDX/DC milk transfers are rejected');

// Check rejection reasons mention cost or PO
const hasCostRejection = rejectedMilk.some(r => r.rejectionReason && r.rejectionReason.includes('cost'));
const hasPORejection = rejectedMilk.some(r => r.rejectionReason && r.rejectionReason.includes('PO'));
assert(hasCostRejection || hasPORejection, 'Transfer trap rejection includes cost or PO comparison reasoning');

// Shelf-life rejection for bananas
const rejectedBananas = difficultResults.stageResults.stage5_transfers.rejected.filter(r => r.skuId === 'SKU-2004');
if (rejectedBananas.length > 0) {
  const hasShelfLifeRejection = rejectedBananas.some(r => r.rejectionReason && r.rejectionReason.includes('expire'));
  console.log(`  Banana transfers rejected: ${rejectedBananas.length} (shelf-life check: ${hasShelfLifeRejection})`);
  assert(hasShelfLifeRejection, 'Bananas rejected due to shelf-life expiry in transit');
}

// Human approval gate
const impact = difficultResults.stageResults.stage6_impact;
assert(impact.approvalGate.status === 'pending_approval', 'Approval gate is pending');
assert(impact.approvalGate.pendingActions > 0, 'Pending actions exist for approval');
assert(impact.approvalGate.canRejectIndividual === true, 'Planner can reject individual transfers');
assert(impact.approvalGate.canEditQuantities === true, 'Planner can edit transfer quantities');

// Traceability
assert(impact.traceability.dataLineage.length === 6, 'Full data lineage traced through 6 stages');
assert(impact.traceability.assumptionsLog.length > 0, 'Assumptions are logged');

// AI Advisory
const advisory = difficultResults.stageResults.advisory;
assert(advisory.recommendations.length > 0, 'AI advisory generates recommendations');
assert(advisory.ethicalNotes.length >= 5, 'AI advisory includes ethical principles');
assert(advisory.disclaimer !== null && advisory.disclaimer !== '', 'AI advisory includes disclaimer');

console.log('');

// ============================================================
// Test 3: Forecasting Confidence
// ============================================================
console.log('━━━ Test 3: Forecasting Quality ━━━');

const forecasts = difficultResults.stageResults.stage3_forecast.forecasts;
assert(forecasts.length > 0, 'Forecasts are generated');

// All forecasts should have confidence intervals
assert(forecasts.every(f => f.confidenceInterval.lower !== null && f.confidenceInterval.upper !== null), 'All forecasts have confidence intervals');
assert(forecasts.every(f => f.confidenceInterval.lower <= f.confidenceInterval.upper), 'Confidence intervals are valid (lower <= upper)');

// All forecasts should have assumptions
assert(forecasts.every(f => f.assumptions.length > 0 || f.confidenceScore >= 75), 'Forecasts with low confidence have assumptions documented');

// De-biased forecasts should have data quality flags
const debiasedForecasts = forecasts.filter(f => f.hasStockoutDistortion);
assert(debiasedForecasts.every(f => f.dataQualityFlags.includes('STOCKOUT_DISTORTED')), 'De-biased forecasts flagged with STOCKOUT_DISTORTED');

// Missing data forecasts should be flagged
const missingDataForecasts = forecasts.filter(f => f.dataQualityFlags.includes('MISSING_DATA'));
console.log(`  Missing-data forecasts: ${missingDataForecasts.length}`);
assert(missingDataForecasts.length > 0, 'Missing data forecasts are flagged');

console.log('');

// ============================================================
// Test 4: Business Profiles
// ============================================================
console.log('━━━ Test 4: Business Profiles ━━━');

const { BUSINESS_PROFILES } = require('../data/businessProfiles');
const niches = Object.keys(BUSINESS_PROFILES);
console.log(`  Niches available: ${niches.join(', ')}`);
assert(niches.length >= 6, 'At least 6 business niches supported');
assert(niches.includes('electronics'), 'Electronics niche exists');
assert(niches.includes('grocery'), 'Grocery niche exists');
assert(niches.includes('fashion'), 'Fashion niche exists');
assert(niches.includes('automotive'), 'Automotive niche exists');
assert(niches.includes('appliances'), 'Appliances niche exists');
assert(niches.includes('mixed'), 'Mixed niche exists');

// Each niche should have agent priorities
for (const niche of niches) {
  const profile = BUSINESS_PROFILES[niche];
  assert(profile.agentPriorities !== null, `${niche} has agent priorities`);
  assert(profile.tips.length > 0, `${niche} has niche-specific tips`);
  assert(profile.strategies.length > 0, `${niche} has strategy options`);
}

console.log('');

// ============================================================
// Test 5: Ethical AI Compliance
// ============================================================
console.log('━━━ Test 5: Ethical AI Compliance ━━━');

// No transfer should execute without approval
const allTransfers = difficultResults.stageResults.stage5_transfers.recommendations;
assert(allTransfers.every(t => t.requiresApproval === true), 'NO transfer executes without human approval');

// No fabricated demand
const allForecasts = difficultResults.stageResults.stage3_forecast.forecasts;
assert(allForecasts.every(f => f.assumptions !== null), 'All forecasts have documented assumptions (no fabricated data)');

// Unsupported claims flagged
assert(impact.traceability.unsupportedFlags !== null, 'Traceability checks for unsupported claims');

// Disclaimer present
assert(advisory.disclaimer.includes('estimates') || advisory.disclaimer.includes('assumptions'), 'Advisory disclaimer states estimates/assumptions');

console.log('');

// ============================================================
// Summary
// ============================================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`  ${failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(failed > 0 ? 1 : 0);
