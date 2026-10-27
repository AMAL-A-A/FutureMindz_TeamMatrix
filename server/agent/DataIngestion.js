// ============================================================
// Stage 1: Data Ingestion & Quality Assessment
// Accepts SKU master, sales history, inventory, inbound orders,
// and disruption signals. Flags data quality issues.
// ============================================================

class DataIngestion {
  /**
   * Ingest raw data and produce a validated, quality-assessed dataset
   * @param {Object} rawData - { skus, locations, distances, salesHistory, inventory, inboundOrders, disruptions }
   * @returns {Object} validated data + quality report
   */
  static ingest(rawData) {
    const issues = [];
    const warnings = [];

    // --- Validate SKU Master ---
    if (!rawData.skus || rawData.skus.length === 0) {
      issues.push({ severity: 'critical', message: 'No SKU master data provided' });
    }
    for (const sku of rawData.skus || []) {
      if (!sku.skuId) issues.push({ severity: 'critical', message: `SKU missing ID: ${JSON.stringify(sku)}` });
      if (sku.unitCost == null) warnings.push({ severity: 'warning', message: `SKU ${sku.skuId} missing unit cost` });
      if (sku.leadTimeDays == null) warnings.push({ severity: 'warning', message: `SKU ${sku.skuId} missing lead time` });
    }

    // --- Validate Sales History ---
    const salesBySkuLoc = {};
    let totalRecords = 0;
    let missingRecords = 0;
    let stockoutRecords = 0;

    for (const rec of rawData.salesHistory || []) {
      const key = `${rec.skuId}|${rec.locationId}`;
      if (!salesBySkuLoc[key]) salesBySkuLoc[key] = [];
      salesBySkuLoc[key].push(rec);
      totalRecords++;
      if (rec.dataQuality === 'missing') missingRecords++;
      if (rec.dataQuality === 'stockout_suppressed') stockoutRecords++;
    }

    if (missingRecords > 0) {
      warnings.push({
        severity: 'warning',
        message: `${missingRecords} sales records have missing data (gaps). Forecasts will be flagged as lower confidence.`,
        count: missingRecords,
      });
    }

    if (stockoutRecords > 0) {
      warnings.push({
        severity: 'warning',
        message: `${stockoutRecords} sales records are stockout-suppressed (zero sales due to no stock). These will be de-biased in forecasting.`,
        count: stockoutRecords,
      });
    }

    // --- Validate Inventory ---
    for (const inv of rawData.inventory || []) {
      if (inv.onHand < 0) issues.push({ severity: 'error', message: `Negative inventory: ${inv.skuId} at ${inv.locationId}` });
      if (inv.stockAgeDays > 60) warnings.push({ severity: 'info', message: `Aged inventory: ${inv.skuId} at ${inv.locationId} is ${inv.stockAgeDays} days old` });
    }

    // --- Validate Disruptions ---
    for (const dis of rawData.disruptions || []) {
      if (!dis.affectedSkus || dis.affectedSkus.length === 0) {
        warnings.push({ severity: 'warning', message: `Disruption ${dis.disruptionId} has no affected SKUs specified - treating as unscoped` });
      }
    }

    // --- Check coverage: every SKU+location in inventory should have sales history ---
    let coverageGaps = 0;
    for (const inv of rawData.inventory || []) {
      const key = `${inv.skuId}|${inv.locationId}`;
      if (!salesBySkuLoc[key]) {
        coverageGaps++;
        warnings.push({ severity: 'info', message: `No sales history for ${inv.skuId} at ${inv.locationId}` });
      }
    }

    const qualityScore = this.calculateQualityScore(totalRecords, missingRecords, stockoutRecords, coverageGaps, issues.length);

    return {
      ...rawData,
      dataQualityReport: {
        issues,
        warnings,
        summary: {
          totalSalesRecords: totalRecords,
          missingRecords,
          stockoutSuppressedRecords: stockoutRecords,
          coverageGaps,
          qualityScore,
          qualityGrade: qualityScore >= 90 ? 'A' : qualityScore >= 75 ? 'B' : qualityScore >= 60 ? 'C' : 'D',
        },
      },
      salesBySkuLoc,
    };
  }

  static calculateQualityScore(total, missing, stockout, gaps, criticalIssues) {
    if (total === 0) return 0;
    let score = 100;
    score -= (missing / total) * 30;
    score -= (stockout / total) * 15; // stockouts are expected, less penalty
    score -= gaps * 5;
    score -= criticalIssues * 10;
    return Math.max(0, Math.round(score));
  }
}

module.exports = DataIngestion;
