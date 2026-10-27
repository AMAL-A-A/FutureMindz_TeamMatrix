// ============================================================
// Stage 2: Inventory Understanding
// Produces a structured view of available/reserved/incoming stock
// with source tracking, timestamps, and age classification.
// ============================================================

class InventoryUnderstanding {
  /**
   * Build a structured inventory view from validated data
   * @param {Object} data - output from DataIngestion
   * @returns {Object} structured inventory + insights
   */
  static analyze(data) {
    const { inventory, skus, locations, inboundOrders, disruptions } = data;
    const skuMap = new Map(skus.map(s => [s.skuId, s]));
    const locMap = new Map(locations.map(l => [l.locationId, l]));

    // Build per-SKU-per-location inventory records
    const inventoryView = [];
    const insights = [];

    for (const inv of inventory) {
      const sku = skuMap.get(inv.skuId);
      const loc = locMap.get(inv.locationId);
      if (!sku || !loc) continue;

      // Find incoming orders for this SKU+location
      const incoming = (inboundOrders || []).filter(o =>
        o.skuId === inv.skuId && o.locationId === inv.locationId
      );

      const available = inv.onHand - inv.reserved;
      const incomingQty = incoming.reduce((s, o) => s + (o.status !== 'cancelled' ? o.quantity : 0), 0);

      // Age classification
      let ageCategory = 'fresh';
      let ageRisk = 'none';
      if (sku.shelfLifeDays) {
        const remainingShelfLife = sku.shelfLifeDays - inv.stockAgeDays;
        if (remainingShelfLife <= 0) { ageCategory = 'expired'; ageRisk = 'critical'; }
        else if (remainingShelfLife <= 2) { ageCategory = 'critical'; ageRisk = 'high'; }
        else if (remainingShelfLife <= 5) { ageCategory = 'near_expiry'; ageRisk = 'medium'; }
        else { ageCategory = 'fresh'; ageRisk = 'low'; }
      } else {
        // Non-perishable: age by days
        if (inv.stockAgeDays > 90) { ageCategory = 'aged'; ageRisk = 'medium'; }
        else if (inv.stockAgeDays > 60) { ageCategory = 'aging'; ageRisk = 'low'; }
      }

      // Check if affected by disruption
      const affectedDisruptions = (disruptions || []).filter(d =>
        (d.affectedSkus?.includes(inv.skuId) || d.affectedSkus?.includes('all')) &&
        (d.affectedLocations?.includes(inv.locationId) || d.affectedLocations?.includes('all'))
      );

      const record = {
        skuId: inv.skuId,
        skuName: sku.name,
        category: sku.category,
        locationId: inv.locationId,
        locationName: loc.name,
        locationType: loc.type,
        onHand: inv.onHand,
        reserved: inv.reserved,
        available: Math.max(0, available),
        incoming: incomingQty,
        incomingDetails: incoming.map(o => ({ orderId: o.orderId, quantity: o.quantity, expectedDate: o.expectedDate, status: o.status })),
        stockAgeDays: inv.stockAgeDays,
        ageCategory,
        ageRisk,
        shelfLifeDays: sku.shelfLifeDays,
        remainingShelfLife: sku.shelfLifeDays ? sku.shelfLifeDays - inv.stockAgeDays : null,
        unitCost: sku.unitCost,
        unitPrice: sku.unitPrice,
        safetyStock: sku.safetyStock,
        affectedDisruptions: affectedDisruptions.map(d => d.disruptionId),
        stockValue: inv.onHand * sku.unitCost,
        retailValue: inv.onHand * sku.unitPrice,
        lastUpdated: new Date().toISOString(),
        dataSource: 'inventory_snapshot',
      };

      inventoryView.push(record);

      // Generate insights
      if (available < sku.safetyStock && available >= 0) {
        insights.push({
          type: 'low_stock',
          severity: available === 0 ? 'critical' : 'high',
          skuId: inv.skuId,
          locationId: inv.locationId,
          message: `${sku.name} at ${loc.name}: ${available} available (safety stock: ${sku.safetyStock})`,
          currentStock: available,
          safetyStock: sku.safetyStock,
        });
      }
      if (ageRisk === 'high' || ageRisk === 'critical') {
        insights.push({
          type: 'shelf_life_risk',
          severity: ageRisk,
          skuId: inv.skuId,
          locationId: inv.locationId,
          message: `${sku.name} at ${loc.name}: ${ageCategory} (${inv.stockAgeDays} days old, ${record.remainingShelfLife} days shelf life remaining)`,
          stockAgeDays: inv.stockAgeDays,
          remainingShelfLife: record.remainingShelfLife,
        });
      }
    }

    // Summary by location
    const byLocation = {};
    for (const rec of inventoryView) {
      if (!byLocation[rec.locationId]) {
        byLocation[rec.locationId] = {
          locationId: rec.locationId,
          locationName: rec.locationName,
          totalUnits: 0,
          totalValue: 0,
          skuCount: 0,
          criticalStocks: 0,
        };
      }
      byLocation[rec.locationId].totalUnits += rec.onHand;
      byLocation[rec.locationId].totalValue += rec.stockValue;
      byLocation[rec.locationId].skuCount++;
      if (rec.available < rec.safetyStock) byLocation[rec.locationId].criticalStocks++;
    }

    return {
      inventoryView,
      insights,
      summaryByLocation: Object.values(byLocation),
      totalInventoryValue: inventoryView.reduce((s, r) => s + r.stockValue, 0),
      totalSkus: skus.length,
      totalLocations: locations.length,
    };
  }
}

module.exports = InventoryUnderstanding;
