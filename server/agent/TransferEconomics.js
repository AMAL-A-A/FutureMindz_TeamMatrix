// ============================================================
// Stage 5: Transfer Recommendation Engine
// Generates transfer quantities + routes with cost-benefit
// analysis, safety stock compliance, and rejection of
// uneconomical transfers (THE TRAP).
// ============================================================

class TransferEconomics {
  /**
   * Generate transfer recommendations from excess to shortage locations
   * @param {Object} imbalances - from Stage 4
   * @param {Object} data - full dataset for distances, SKUs, etc.
   * @param {Object} inventoryData - from Stage 2
   * @param {Object} forecastData - from Stage 3
   * @param {Object} strategicPlan - business profile & constraints
   * @returns {Object} ranked recommendations + rejected transfers
   */
  static recommend(imbalances, data, inventoryData, forecastData, strategicPlan) {
    const { excesses, shortages } = imbalances;
    const { distances, skus, locations } = data;
    const constraints = strategicPlan?.operationalConstraints || {
      maxTransferCostPercent: 15,
      minTransferROI: 1.2,
      respectShelfLife: true,
      requireHumanApproval: true,
    };
    const priorities = strategicPlan?.agentPriorities || {};

    const recommendations = [];
    const rejected = [];

    // Group excesses and shortages by SKU
    const excessBySku = {};
    for (const ex of excesses) {
      if (!excessBySku[ex.skuId]) excessBySku[ex.skuId] = [];
      excessBySku[ex.skuId].push(ex);
    }

    const shortageBySku = {};
    for (const sh of shortages) {
      if (!shortageBySku[sh.skuId]) shortageBySku[sh.skuId] = [];
      shortageBySku[sh.skuId].push(sh);
    }

    // Match excess to shortage for same SKU
    for (const skuId of Object.keys(excessBySku)) {
      const skuExcesses = excessBySku[skuId];
      const skuShortages = shortageBySku[skuId];
      if (!skuShortages) continue;

      for (const excess of skuExcesses) {
        for (const shortage of skuShortages) {
          if (excess.locationId === shortage.locationId) continue;

          // Calculate transfer
          const analysis = this.analyzeTransfer(excess, shortage, data, strategicPlan);

          if (analysis.isEconomical) {
            recommendations.push(analysis);
          } else {
            rejected.push({
              ...analysis,
              rejectionReason: analysis.rejectionReason,
            });
          }
        }
      }
    }

    // Sort recommendations by priority/benefit
    recommendations.sort((a, b) => b.netBenefit - a.netBenefit);
    rejected.sort((a, b) => (b.transferValue || 0) - (a.transferValue || 0));

    return {
      recommendations,
      rejected,
      constraints,
      summary: {
        totalRecommended: recommendations.length,
        totalRejected: rejected.length,
        totalNetBenefit: recommendations.reduce((s, r) => s + r.netBenefit, 0),
        totalTransferCost: recommendations.reduce((s, r) => s + r.transferCost, 0),
        totalUnits: recommendations.reduce((s, r) => s + r.quantity, 0),
      },
    };
  }

  static analyzeTransfer(excess, shortage, data, strategicPlan) {
    const { distances, skus, locations } = data;
    const sku = skus.find(s => s.skuId === excess.skuId);
    const fromLoc = locations.find(l => l.locationId === excess.locationId);
    const toLoc = locations.find(l => l.locationId === shortage.locationId);

    // Distance
    const distanceKey = [excess.locationId, shortage.locationId].sort().join('|');
    const distance = distances?.[distanceKey] || 100;

    // Transfer cost estimation (simplified: $0.50/unit/100km + flat $25 handling)
    const handlingCost = 25;
    const perUnitPer100km = 0.50;
    const distanceCost = (distance / 100) * perUnitPer100km;
    const transferLeadTimeDays = Math.ceil(distance / 500) + 1; // ~500km/day transit

    // --- TRANSFER TRAP CHECK: Shelf life ---
    let shelfLifeWarning = null;
    let shelfLifeRejection = false;

    if (excess.perishable && excess.remainingShelfLife != null) {
      const remainingShelfLifeAfterTransfer = excess.remainingShelfLife - transferLeadTimeDays;
      if (remainingShelfLifeAfterTransfer <= 0) {
        shelfLifeRejection = true;
        shelfLifeWarning = `REJECTED: ${sku.name} at ${fromLoc.name} has ${excess.remainingShelfLife} days shelf life remaining. Transfer takes ${transferLeadTimeDays} days — product would expire in transit or immediately upon arrival.`;
      } else if (remainingShelfLifeAfterTransfer <= 2) {
        shelfLifeWarning = `WARNING: After ${transferLeadTimeDays}-day transfer, only ${remainingShelfLifeAfterTransfer} days shelf life remains. High waste risk. Transfer marginally viable only if demand at destination is very high.`;
      }
    }

    // --- Transfer quantity ---
    // Transfer enough to cover the shortage but not more than excess available
    const shortageQty = Math.max(0, shortage.safetyStock * 2 - shortage.available); // bring to 2x safety stock
    const transferQty = Math.min(excess.excessQty, shortageQty);

    if (transferQty <= 0) {
      return {
        isEconomical: false,
        rejectionReason: 'No transferable quantity (excess or shortage mismatch)',
        excess, shortage, sku,
      };
    }

    // --- Costs ---
    const transferCost = handlingCost + (distanceCost * transferQty);
    const stockValueTransferred = transferQty * sku.unitCost;

    // --- Benefits ---
    // 1. Avoided stockout cost (lost sales)
    const avoidedStockoutValue = transferQty * (sku.unitPrice - sku.unitCost);
    // 2. Reduced holding/ageing cost at source
    const dailyHoldingCost = stockValueTransferred * 0.001; // 0.1% of value per day
    const holdingDaysSaved = Math.min(30, excess.daysOfCover || 30);
    const avoidedHoldingCost = dailyHoldingCost * holdingDaysSaved;
    // 3. Avoided waste (for perishables near expiry)
    let avoidedWaste = 0;
    if (excess.perishable && excess.remainingShelfLife != null && excess.remainingShelfLife <= 5) {
      avoidedWaste = stockValueTransferred * 0.5; // 50% of stock would likely be wasted
    }

    const totalBenefit = avoidedStockoutValue + avoidedHoldingCost + avoidedWaste;
    const netBenefit = totalBenefit - transferCost;
    const roi = totalBenefit / Math.max(1, transferCost);

    // --- Feasibility checks ---
    const constraints = strategicPlan?.operationalConstraints || {};
    const costPercent = (transferCost / Math.max(1, stockValueTransferred)) * 100;

    const rejectionReasons = [];

    if (shelfLifeRejection) {
      rejectionReasons.push(shelfLifeWarning);
    }

    if (costPercent > (constraints.maxTransferCostPercent || 15)) {
      rejectionReasons.push(`Transfer cost ${costPercent.toFixed(1)}% of stock value exceeds max allowed ${constraints.maxTransferCostPercent || 15}%`);
    }

    if (roi < (constraints.minTransferROI || 1.2)) {
      rejectionReasons.push(`Transfer ROI ${roi.toFixed(2)}x is below minimum required ${constraints.minTransferROI || 1.2}x`);
    }

    // --- Check if waiting for PO is better ---
    const incomingPO = (data.inboundOrders || []).find(o =>
      o.skuId === shortage.skuId && o.locationId === shortage.locationId && o.status !== 'cancelled'
    );
    let poComparison = null;
    if (incomingPO) {
      const poDaysAway = daysUntil(incomingPO.expectedDate);
      const daysUntilStockout = shortage.daysOfCover;
      if (poDaysAway <= daysUntilStockout + 2) {
        // PO arrives before or shortly after stockout
        const poBenefit = incomingPO.quantity * (sku.unitPrice - sku.unitCost) * 0.3; // lower since PO already coming
        if (poBenefit > netBenefit * 0.7) {
          rejectionReasons.push(`Inbound PO ${incomingPO.orderId} arriving in ${poDaysAway} days (before projected stockout). Waiting for PO may be more cost-effective than expedited transfer.`);
          poComparison = {
            poId: incomingPO.orderId,
            poArrivalDays: poDaysAway,
            projectedStockoutDays: Math.round(daysUntilStockout),
            recommendation: 'Wait for PO — transfer benefit is marginal given imminent replenishment.',
          };
        }
      }
    }

    const isEconomical = rejectionReasons.length === 0 && netBenefit > 0;

    return {
      transferId: `TRF-${excess.skuId}-${excess.locationId}-${shortage.locationId}`,
      isEconomical,
      rejectionReason: rejectionReasons.length > 0 ? rejectionReasons.join('; ') : null,
      // Details
      skuId: excess.skuId,
      skuName: excess.skuName,
      category: excess.category,
      fromLocation: {
        locationId: excess.locationId,
        locationName: excess.locationName,
        availableStock: excess.available,
        excessQty: excess.excessQty,
      },
      toLocation: {
        locationId: shortage.locationId,
        locationName: shortage.locationName,
        currentStock: shortage.available,
        safetyStock: shortage.safetyStock,
        avgDailyDemand: shortage.avgDailyDemand,
        daysOfCover: shortage.daysOfCover,
        projectedStockoutDate: shortage.projectedStockoutDate,
      },
      // Transfer specs
      quantity: Math.round(transferQty),
      distance,
      transferLeadTimeDays,
      transferCost: Math.round(transferCost * 100) / 100,
      stockValueTransferred: Math.round(stockValueTransferred),
      // Economics
      benefits: {
        avoidedStockoutValue: Math.round(avoidedStockoutValue),
        avoidedHoldingCost: Math.round(avoidedHoldingCost * 100) / 100,
        avoidedWaste: Math.round(avoidedWaste),
        totalBenefit: Math.round(totalBenefit),
      },
      netBenefit: Math.round(netBenefit),
      roi: Math.round(roi * 100) / 100,
      costPercentOfValue: Math.round(costPercent * 10) / 10,
      // Constraints
      shelfLifeWarning,
      poComparison,
      // Priority
      priority: netBenefit > 5000 ? 'critical' : netBenefit > 1000 ? 'high' : netBenefit > 200 ? 'medium' : 'low',
      // Assumptions
      assumptions: [
        'Transfer demand at destination based on forecast with stated confidence interval',
        shelfLifeWarning ? `Shelf-life risk flagged: ${shelfLifeWarning}` : null,
        poComparison ? `PO comparison: ${poComparison.recommendation}` : null,
      ].filter(Boolean),
      requiresApproval: true, // ALWAYS require human approval
    };
  }
}

function daysUntil(dateStr) {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

module.exports = TransferEconomics;
