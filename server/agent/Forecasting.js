// ============================================================
// Stage 3: Demand Forecasting with Uncertainty
// 30-day SKU+location forecasts with confidence intervals,
// assumptions, data-quality flags, and stockout-distortion
// detection & de-biasing.
// ============================================================

class Forecasting {
  /**
   * Generate 30-day forecasts for all SKU+location pairs
   * @param {Object} data - validated data from Stage 1
   * @param {Object} inventoryData - structured view from Stage 2
   * @returns {Object} forecasts with confidence, assumptions, flags
   */
  static forecast(data, inventoryData) {
    const { salesBySkuLoc, skus, locations, disruptions, inboundOrders } = data;
    const forecasts = [];

    for (const [key, history] of Object.entries(salesBySkuLoc)) {
      const [skuId, locationId] = key.split('|');
      const sku = skus.find(s => s.skuId === skuId);
      if (!sku) continue;

      const forecast = this.forecastSkuLocation(skuId, locationId, history, sku, disruptions, inboundOrders);
      forecasts.push(forecast);
    }

    return {
      forecasts,
      methodology: 'Linear trend + weekly seasonality with stockout de-biasing. Confidence intervals from historical variance.',
      assumptions: [
        'No major marketing campaigns or promotions during forecast period unless signaled',
        'No new competitor store openings within 5km of any location',
        'Weather conditions remain within seasonal norms',
        'Supply chain disruptions resolve as per their stated expectedResolutionDate',
      ],
      limitations: [
        '30-day forecast horizon. Confidence decreases significantly beyond 14 days.',
        'SKUs with <14 days of clean sales history have wide confidence intervals.',
        'De-biasing estimates true demand during stockouts; actual sales during stockout were zero.',
      ],
    };
  }

  static forecastSkuLocation(skuId, locationId, history, sku, disruptions, inboundOrders) {
    // --- 1. Separate valid (non-stockout) sales from stockout-suppressed ---
    const validRecords = history.filter(r => r.dataQuality === 'normal' || r.dataQuality === 'missing');
    const stockoutRecords = history.filter(r => r.dataQuality === 'stockout_suppressed');
    const missingRecords = history.filter(r => r.dataQuality === 'missing');

    // --- 2. Detect stockout distortion ---
    const hasStockoutDistortion = stockoutRecords.length > 0;
    const stockoutDuration = stockoutRecords.length;

    // --- 3. Calculate trend from valid records ---
    const dailySales = validRecords
      .filter(r => r.unitsSold != null)
      .map(r => r.unitsSold);

    let avgDailyDemand = 0;
    let trendSlope = 0;
    let variance = 0;
    let confidenceScore = 100;
    let assumptions = [];
    let dataQualityFlags = [];

    if (dailySales.length === 0) {
      // No valid data at all
      avgDailyDemand = sku.safetyStock / 7; // assumption-based fallback
      confidenceScore = 20;
      assumptions.push('No valid sales history. Forecast based on safety stock assumption only.');
      dataQualityFlags.push('NO_VALID_HISTORY');
    } else if (dailySales.length < 14) {
      avgDailyDemand = dailySales.reduce((a, b) => a + b, 0) / dailySales.length;
      confidenceScore = 40;
      assumptions.push(`Only ${dailySales.length} days of valid history. Low confidence forecast.`);
      dataQualityFlags.push('LIMITED_HISTORY');
    } else {
      avgDailyDemand = dailySales.reduce((a, b) => a + b, 0) / dailySales.length;

      // Simple linear regression for trend
      const n = dailySales.length;
      const xMean = (n - 1) / 2;
      const yMean = avgDailyDemand;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (dailySales[i] - yMean);
        den += (i - xMean) ** 2;
      }
      trendSlope = den !== 0 ? num / den : 0;

      // Variance
      variance = dailySales.reduce((s, v) => s + (v - yMean) ** 2, 0) / n;
      confidenceScore = Math.min(95, 50 + Math.min(45, n * 2) - Math.min(20, variance / Math.max(1, yMean) * 10));
    }

    // --- 4. De-bias stockout distortion ---
    let debiasedDemand = avgDailyDemand;
    let debiasExplanation = null;

    if (hasStockoutDistortion) {
      // True demand during stockout is estimated from the valid data average
      // This is the CRITICAL step: don't treat zero-sales as real low demand
      debiasedDemand = avgDailyDemand; // true demand is the clean average
      confidenceScore = Math.max(30, confidenceScore - 15); // reduce confidence
      assumptions.push(`${stockoutDuration} days of stockout-suppressed sales detected. True demand during stockout estimated at ${Math.round(debiasedDemand)}/day, NOT zero. Naive forecast would underestimate.`);
      dataQualityFlags.push('STOCKOUT_DISTORTED');
      debiasExplanation = {
        stockoutDays: stockoutDuration,
        naiveAvgDemand: (history.reduce((s, r) => s + (r.unitsSold || 0), 0) / history.length).toFixed(1),
        debiasedDemand: debiasedDemand.toFixed(1),
        difference: `Naive forecast would be ${(history.reduce((s, r) => s + (r.unitsSold || 0), 0) / history.length).toFixed(1)}/day. De-biased forecast is ${debiasedDemand.toFixed(1)}/day — a ${((debiasedDemand / Math.max(0.1, history.reduce((s, r) => s + (r.unitsSold || 0), 0) / history.length) - 1) * 100).toFixed(0)}% increase.`,
      };
    }

    // --- 5. Missing data impact ---
    if (missingRecords.length > 0) {
      confidenceScore = Math.max(25, confidenceScore - 10 * Math.min(3, missingRecords.length / 10));
      assumptions.push(`${missingRecords.length} days of missing data. Forecast interpolated from available records only.`);
      dataQualityFlags.push('MISSING_DATA');
    }

    // --- 6. Apply disruption adjustment ---
    const relevantDisruptions = (disruptions || []).filter(d =>
      (d.affectedSkus?.includes(skuId) || d.affectedSkus?.includes('all')) &&
      (d.affectedLocations?.includes(locationId) || d.affectedLocations?.includes('all'))
    );

    let disruptionAdjustment = 1.0;
    for (const dis of relevantDisruptions) {
      if (dis.type === 'supply_disruption') {
        // Supply disruption doesn't change demand, but it affects what we can fulfill
        assumptions.push(`Supply disruption ${dis.disruptionId} affects this SKU. Demand may shift to substitutes or be lost. Not adjusting demand forecast, but flagging supply risk.`);
        dataQualityFlags.push(`SUPPLY_DISRUPTION:${dis.disruptionId}`);
      } else if (dis.type === 'weather_event') {
        disruptionAdjustment *= 0.85; // weather events typically reduce foot traffic 15%
        assumptions.push(`Weather event ${dis.disruptionId} may reduce demand ~15% during event window.`);
        dataQualityFlags.push(`WEATHER_EVENT:${dis.disruptionId}`);
      }
    }

    debiasedDemand *= disruptionAdjustment;

    // --- 7. Weekly seasonality factor ---
    const seasonalFactors = [0.8, 1.0, 1.0, 1.0, 1.1, 1.4, 1.2]; // Sun-Sat

    // --- 8. Generate 30-day forecast ---
    const forecastDays = [];
    let cumulativeDemand = 0;
    for (let d = 0; d < 30; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d + 1);
      const dow = date.getDay();
      const seasonalFactor = seasonalFactors[dow];
      const trendFactor = 1 + (trendSlope / Math.max(1, avgDailyDemand)) * d;
      const dayDemand = Math.max(0, debiasedDemand * seasonalFactor * trendFactor);
      const stdDev = Math.sqrt(variance) || debiasedDemand * 0.3;

      // Confidence interval widens with forecast horizon
      const ciWidening = 1 + d * 0.03;
      const lower = Math.max(0, dayDemand - stdDev * 1.96 * ciWidening);
      const upper = dayDemand + stdDev * 1.96 * ciWidening;

      forecastDays.push({
        day: d + 1,
        date: date.toISOString().split('T')[0],
        pointEstimate: Math.round(dayDemand),
        lowerBound: Math.round(lower),
        upperBound: Math.round(upper),
        confidenceLevel: Math.round(Math.max(10, confidenceScore - d * 1.5)),
      });
      cumulativeDemand += dayDemand;
    }

    // --- 9. Summary ---
    const total30DayDemand = Math.round(cumulativeDemand);
    const stdDev = Math.sqrt(variance) || debiasedDemand * 0.3;
    const ciWideningAvg = 1 + 15 * 0.03;

    return {
      skuId,
      locationId,
      skuName: sku.name,
      category: sku.category,
      avgDailyDemand: Math.round(debiasedDemand * 10) / 10,
      trendSlope: Math.round(trendSlope * 1000) / 1000,
      total30DayDemand,
      confidenceInterval: {
        lower: Math.round(total30DayDemand - stdDev * 1.96 * ciWideningAvg * Math.sqrt(30)),
        upper: Math.round(total30DayDemand + stdDev * 1.96 * ciWideningAvg * Math.sqrt(30)),
      },
      confidenceScore: Math.round(confidenceScore),
      dataQualityFlags,
      assumptions,
      hasStockoutDistortion,
      stockoutDistortion: debiasExplanation,
      forecastDays,
      safetyStock: sku.safetyStock,
      leadTimeDays: sku.leadTimeDays,
    };
  }
}

module.exports = Forecasting;
