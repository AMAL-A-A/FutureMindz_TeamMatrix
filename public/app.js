// ============================================================
// StockFlow AI - Frontend Application Logic
// Handles navigation, pipeline execution, and rendering
// ============================================================

let currentScenario = 'normal';
let currentNiche = 'electronics';
let pipelineResults = null;
let approvedTransfers = new Set();
let rejectedTransfers = new Set();

// ============================================================
// Navigation
// ============================================================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    if (view) switchView(view);
  });
});

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  document.querySelector(`.nav-item[data-view="${viewName}"]`)?.classList.add('active');
}

// ============================================================
// Scenario Selection
// ============================================================
function selectScenario(scenario) {
  currentScenario = scenario;
  document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`[data-scenario="${scenario}"]`).classList.add('selected');

  // Auto-set niche based on scenario
  if (scenario === 'difficult') {
    document.getElementById('niche-select').value = 'mixed';
  } else {
    document.getElementById('niche-select').value = 'electronics';
  }
  currentNiche = document.getElementById('niche-select').value;
  updateStrategyOptions();
}

// ============================================================
// Niche/Strategy Selection
// ============================================================
document.getElementById('niche-select').addEventListener('change', (e) => {
  currentNiche = e.target.value;
  updateStrategyOptions();
});

function updateStrategyOptions() {
  fetch('/api/business-profiles')
    .then(r => r.json())
    .then(profiles => {
      const profile = profiles[currentNiche] || profiles.mixed;
      const select = document.getElementById('strategy-select');
      select.innerHTML = '<option value="">Auto (from niche)</option>';
      profile.strategies.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        select.appendChild(opt);
      });
    });
}

// ============================================================
// Pipeline Execution
// ============================================================
async function runPipeline() {
  const niche = document.getElementById('niche-select').value;
  const strategy = document.getElementById('strategy-select').value;

  // Show loading
  showLoading();

  try {
    // Simulate staged progress
    for (let i = 1; i <= 6; i++) {
      document.getElementById(`ls-${i}`).classList.add('active');
      document.getElementById('loading-text').textContent = `Running Stage ${i}...`;
      await new Promise(r => setTimeout(r, 400));
      document.getElementById(`ls-${i}`).classList.remove('active');
      document.getElementById(`ls-${i}`).classList.add('done');
    }

    const response = await fetch('/api/run-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: currentScenario, niche, strategy }),
    });

    pipelineResults = await response.json();
    hideLoading();
    renderAllViews();
    showToast('Pipeline completed successfully!');
  } catch (error) {
    hideLoading();
    showToast('Error: ' + error.message, 'error');
  }
}

function showLoading() {
  document.getElementById('loading-overlay').style.display = 'flex';
  for (let i = 1; i <= 6; i++) {
    document.getElementById(`ls-${i}`).classList.remove('active', 'done');
  }
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; padding: 12px 20px;
    border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 10000;
    background: ${type === 'error' ? '#ef4444' : '#22c55e'}; color: white;
    animation: slideIn 0.3s;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// Render All Views
// ============================================================
function renderAllViews() {
  renderOverview();
  renderPipelineDetail();
  renderInventoryDetail();
  renderForecastDetail();
  renderImbalancesDetail();
  renderTransfersDetail();
  renderLogisticsDetail();
  renderAdvisoryDetail();
  renderStrategyDetail();
  renderTranscriptDetail();
  renderSubscriptionDetail();
  renderEthicsDetail();

  // Update badges
  const shortages = pipelineResults.stageResults.stage4_imbalances.summary.totalShortages;
  const transfers = pipelineResults.stageResults.stage5_transfers.summary.totalRecommended;
  if (shortages > 0) {
    document.getElementById('imbalance-badge').style.display = 'inline-block';
    document.getElementById('imbalance-badge').textContent = shortages;
  }
  if (transfers > 0) {
    document.getElementById('transfer-badge').style.display = 'inline-block';
    document.getElementById('transfer-badge').textContent = transfers;
  }
}

// ============================================================
// Overview
// ============================================================
function renderOverview() {
  const { stage2_inventory, stage4_imbalances, stage5_transfers, stage6_impact } = pipelineResults.stageResults;

  document.getElementById('stat-inv-value').textContent = '$' + (stage2_inventory.totalInventoryValue || 0).toLocaleString();
  document.getElementById('stat-shortages').textContent = stage4_imbalances.summary.totalShortages;
  document.getElementById('stat-shortages-detail').textContent = `${stage4_imbalances.summary.criticalShortages} critical`;
  document.getElementById('stat-excess').textContent = '$' + (stage4_imbalances.summary.totalExcessValue || 0).toLocaleString();
  document.getElementById('stat-excess-detail').textContent = `${stage4_imbalances.summary.totalExcesses} excess items`;
  document.getElementById('stat-benefit').textContent = '$' + (stage5_transfers.summary.totalNetBenefit || 0).toLocaleString();
  document.getElementById('stat-benefit-detail').textContent = `${stage5_transfers.summary.totalRecommended} transfers recommended`;

  // Pipeline stage times
  pipelineResults.stages.forEach(stage => {
    document.getElementById(`stage${stage.stage}-time`).textContent = `${stage.durationMs}ms`;
  });

  // Advisory preview
  renderAdvisoryPreview();
}

function renderAdvisoryPreview() {
  const advisory = pipelineResults.stageResults.advisory;
  const container = document.getElementById('advisory-preview');
  const topRecs = advisory.recommendations.slice(0, 3);

  if (topRecs.length === 0) {
    container.innerHTML = '<div style="color: var(--text-secondary); font-size: 14px; padding: 20px; text-align: center;">No recommendations yet</div>';
    return;
  }

  container.innerHTML = topRecs.map(r => `
    <div class="card" style="margin-bottom: 8px;">
      <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 14px;">${r.title}</div>
        <span class="badge badge-${r.priority === 'critical' ? 'critical' : r.priority === 'high' ? 'high' : 'medium'}">${r.priority.toUpperCase()}</span>
      </div>
      <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">${r.message}</div>
      <div style="font-size: 13px;"><strong>Action:</strong> ${r.action}</div>
      ${r.isAssumption ? '<div class="assumption-box" style="margin-top: 8px; padding: 8px;">Expected impact is an estimate, not a certainty.</div>' : ''}
    </div>
  `).join('');
}

// ============================================================
// Pipeline Detail
// ============================================================
function renderPipelineDetail() {
  const container = document.getElementById('pipeline-detail');
  container.innerHTML = pipelineResults.stages.map(stage => `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Stage ${stage.stage}: ${stage.name}</div>
          <div class="card-subtitle">Completed in ${stage.durationMs}ms</div>
        </div>
        <span class="badge badge-low">✓ COMPLETE</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
        ${Object.entries(stage.summary).map(([key, val]) => `
          <div style="background: var(--bg-secondary); padding: 10px; border-radius: 8px;">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</div>
            <div style="font-size: 18px; font-weight: 600; margin-top: 2px;">${typeof val === 'object' ? JSON.stringify(val) : val}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ============================================================
// Inventory Detail
// ============================================================
function renderInventoryDetail() {
  const data = pipelineResults.stageResults.stage2_inventory;
  const container = document.getElementById('inventory-detail');

  // Summary by location
  let html = `
    <div class="grid-4">
      <div class="stat-card">
        <div class="stat-label">Total Inventory Value</div>
        <div class="stat-value">$${data.totalInventoryValue.toLocaleString()}</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">Total SKUs</div>
        <div class="stat-value">${data.totalSkus}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Total Locations</div>
        <div class="stat-value">${data.totalLocations}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Active Insights</div>
        <div class="stat-value">${data.insights.length}</div>
      </div>
    </div>
  `;

  // Location summary
  html += '<div class="card"><div class="card-header"><div class="card-title">By Location</div></div>';
  html += '<table class="table"><thead><tr><th>Location</th><th>Total Units</th><th>Total Value</th><th>SKUs</th><th>Critical Stocks</th></tr></thead><tbody>';
  data.summaryByLocation.forEach(loc => {
    html += `<tr>
      <td>${loc.locationName}</td>
      <td>${loc.totalUnits}</td>
      <td>$${loc.totalValue.toLocaleString()}</td>
      <td>${loc.skuCount}</td>
      <td>${loc.criticalStocks > 0 ? `<span class="badge badge-critical">${loc.criticalStocks}</span>` : '<span class="badge badge-low">0</span>'}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  // Inventory items
  html += '<div class="card"><div class="card-header"><div class="card-title">Inventory Items</div></div>';
  html += '<div style="overflow-x: auto;"><table class="table"><thead><tr><th>SKU</th><th>Location</th><th>Available</th><th>Reserved</th><th>Incoming</th><th>Age (days)</th><th>Age Category</th><th>Stock Value</th><th>Disruptions</th></tr></thead><tbody>';
  data.inventoryView.forEach(inv => {
    html += `<tr>
      <td><div style="font-weight: 600;">${inv.skuName}</div><div style="font-size: 11px; color: var(--text-muted);">${inv.skuId}</div></td>
      <td>${inv.locationName}</td>
      <td style="font-weight: 600; color: ${inv.available < inv.safetyStock ? 'var(--danger)' : 'var(--text-primary)'};">${inv.available}</td>
      <td>${inv.reserved}</td>
      <td>${inv.incoming > 0 ? `<span class="badge badge-info">+${inv.incoming}</span>` : '—'}</td>
      <td>${inv.stockAgeDays}</td>
      <td><span class="badge badge-${inv.ageRisk === 'critical' ? 'critical' : inv.ageRisk === 'high' ? 'high' : inv.ageRisk === 'medium' ? 'medium' : 'low'}">${inv.ageCategory}</span></td>
      <td>$${inv.stockValue.toLocaleString()}</td>
      <td>${inv.affectedDisruptions.length > 0 ? `<span class="badge badge-high">${inv.affectedDisruptions.join(', ')}</span>` : '—'}</td>
    </tr>`;
  });
  html += '</tbody></table></div></div>';

  container.innerHTML = html;
}

// ============================================================
// Forecast Detail
// ============================================================
function renderForecastDetail() {
  const data = pipelineResults.stageResults.stage3_forecast;
  const container = document.getElementById('forecast-detail');

  let html = `
    <div class="card">
      <div class="card-header"><div><div class="card-title">Methodology</div></div></div>
      <div style="font-size: 14px; color: var(--text-secondary);">${data.methodology}</div>
    </div>
  `;

  // Assumptions
  html += `<div class="card">
    <div class="card-header"><div class="card-title">Assumptions</div></div>
    <ul style="list-style: none; padding: 0;">
      ${data.assumptions.map(a => `<li style="padding: 6px 0; font-size: 13px; color: var(--text-secondary);">• ${a}</li>`).join('')}
    </ul>
  </div>`;

  // Limitations
  html += `<div class="card" style="border-color: var(--warning);">
    <div class="card-header"><div class="card-title">⚠ Limitations</div></div>
    <ul style="list-style: none; padding: 0;">
      ${data.limitations.map(l => `<li style="padding: 6px 0; font-size: 13px; color: var(--warning);">• ${l}</li>`).join('')}
    </ul>
  </div>`;

  // Forecasts table
  html += '<div class="card"><div class="card-header"><div class="card-title">SKU+Location Forecasts (30-day)</div></div>';
  html += '<div style="overflow-x: auto;"><table class="table"><thead><tr><th>SKU</th><th>Location</th><th>Avg Daily Demand</th><th>30-Day Total</th><th>Confidence Interval</th><th>Confidence Score</th><th>Data Quality Flags</th><th>Stockout Distortion</th></tr></thead><tbody>';

  data.forecasts.forEach(f => {
    const confColor = f.confidenceScore >= 75 ? 'var(--success)' : f.confidenceScore >= 50 ? 'var(--warning)' : 'var(--danger)';
    html += `<tr>
      <td><div style="font-weight: 600;">${f.skuName}</div><div style="font-size: 11px; color: var(--text-muted);">${f.skuId}</div></td>
      <td>${f.locationId}</td>
      <td>${f.avgDailyDemand}</td>
      <td style="font-weight: 700;">${f.total30DayDemand}</td>
      <td>[${f.confidenceInterval.lower} – ${f.confidenceInterval.upper}]</td>
      <td>
        <div class="confidence-meter">
          <div class="confidence-bar"><div class="confidence-fill" style="width: ${f.confidenceScore}%; background: ${confColor};"></div></div>
          <span class="confidence-text" style="color: ${confColor};">${f.confidenceScore}%</span>
        </div>
      </td>
      <td>${f.dataQualityFlags.length > 0 ? f.dataQualityFlags.map(flag => `<span class="badge badge-high" style="margin-right: 4px;">${flag}</span>`).join('') : '<span class="badge badge-low">CLEAN</span>'}</td>
      <td>${f.hasStockoutDistortion ? `<span class="badge badge-critical" data-tooltip="${f.stockoutDistortion.difference}">DISTORTED</span>` : '<span class="badge badge-low">NO</span>'}</td>
    </tr>`;
  });

  html += '</tbody></table></div></div>';

  // Detailed forecast charts for each SKU+location
  html += '<div class="card"><div class="card-header"><div class="card-title">Daily Forecast Detail</div></div>';
  html += '<div style="overflow-x: auto;"><table class="table"><thead><tr><th>SKU</th><th>Loc</th>';
  for (let d = 1; d <= 30; d++) html += `<th style="font-size: 10px;">D${d}</th>`;
  html += '</tr></thead><tbody>';
  data.forecasts.forEach(f => {
    html += `<tr><td style="font-size: 11px;">${f.skuId.slice(-4)}</td><td style="font-size: 11px;">${f.locationId.slice(-3)}</td>`;
    f.forecastDays.forEach(d => {
      const intensity = Math.min(1, d.pointEstimate / Math.max(1, f.avgDailyDemand * 2));
      const bg = `rgba(79, 124, 255, ${intensity * 0.6})`;
      html += `<td style="text-align: center; font-size: 10px; background: ${bg}; color: ${intensity > 0.5 ? 'white' : 'var(--text-primary)'};">${d.pointEstimate}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';

  // Stockout distortion details
  const distorted = data.forecasts.filter(f => f.hasStockoutDistortion);
  if (distorted.length > 0) {
    html += '<div class="distortion-callout"><div class="distortion-callout-title">⚠ Stockout-Distorted History Detected</div>';
    distorted.forEach(f => {
      html += `<div class="distortion-callout-body" style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px;">
        <strong>${f.skuName} (${f.locationId})</strong><br>
        Naive demand average: ${f.stockoutDistortion.naiveAvgDemand}/day<br>
        De-biased demand: ${f.stockoutDistortion.debiasedDemand}/day<br>
        ${f.stockoutDistortion.difference}<br>
        <em style="color: var(--warning);">The agent has corrected for this. Do NOT trust raw averages for this SKU+location.</em>
      </div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============================================================
// Imbalances Detail
// ============================================================
function renderImbalancesDetail() {
  const data = pipelineResults.stageResults.stage4_imbalances;
  const container = document.getElementById('imbalances-detail');

  let html = `
    <div class="grid-4">
      <div class="stat-card danger"><div class="stat-label">Total Shortages</div><div class="stat-value">${data.summary.totalShortages}</div><div class="stat-change negative">${data.summary.criticalShortages} critical</div></div>
      <div class="stat-card warning"><div class="stat-label">Excess Items</div><div class="stat-value">${data.summary.totalExcesses}</div><div class="stat-change">$${data.summary.totalExcessValue.toLocaleString()} excess value</div></div>
      <div class="stat-card info"><div class="stat-label">Ageing Items</div><div class="stat-value">${data.summary.totalAgeingItems}</div></div>
      <div class="stat-card" style="--accent: var(--purple);"><div class="stat-label">Distorted History</div><div class="stat-value">${data.summary.totalDistortedHistory}</div><div class="stat-change">Stockout-suppressed sales detected</div></div>
    </div>
  `;

  // Shortages
  html += '<div class="card"><div class="card-header"><div class="card-title">⚠ Shortages</div></div>';
  if (data.shortages.length === 0) {
    html += '<div style="color: var(--text-secondary); padding: 12px;">No shortages detected.</div>';
  } else {
    html += '<div style="overflow-x: auto;"><table class="table"><thead><tr><th>SKU</th><th>Location</th><th>Available</th><th>Safety Stock</th><th>Avg Daily Demand</th><th>Days of Cover</th><th>Projected Stockout</th><th>Severity</th><th>Action</th></tr></thead><tbody>';
    data.shortages.forEach(s => {
      html += `<tr>
        <td><div style="font-weight: 600;">${s.skuName}</div><div style="font-size: 11px; color: var(--text-muted);">${s.skuId}</div></td>
        <td>${s.locationName}</td>
        <td style="color: var(--danger); font-weight: 700;">${s.available}</td>
        <td>${s.safetyStock}</td>
        <td>${s.avgDailyDemand}</td>
        <td>${s.daysOfCover}</td>
        <td>${s.projectedStockoutDate}</td>
        <td><span class="badge badge-${s.severity === 'critical' ? 'critical' : s.severity === 'high' ? 'high' : 'medium'}">${s.severity.toUpperCase()}</span></td>
        <td style="font-size: 12px;">${s.recommendedAction}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';

  // Excesses
  html += '<div class="card"><div class="card-header"><div class="card-title">📦 Excess Inventory</div></div>';
  if (data.excesses.length === 0) {
    html += '<div style="color: var(--text-secondary); padding: 12px;">No excess inventory detected.</div>';
  } else {
    html += '<div style="overflow-x: auto;"><table class="table"><thead><tr><th>SKU</th><th>Location</th><th>On Hand</th><th>Excess Qty</th><th>30-Day Demand</th><th>Days of Cover</th><th>Excess Value</th><th>Age</th><th>Perishable</th></tr></thead><tbody>';
    data.excesses.forEach(e => {
      html += `<tr>
        <td><div style="font-weight: 600;">${e.skuName}</div><div style="font-size: 11px; color: var(--text-muted);">${e.skuId}</div></td>
        <td>${e.locationName}</td>
        <td>${e.onHand}</td>
        <td style="font-weight: 700; color: var(--warning);">${e.excessQty}</td>
        <td>${e.expected30DayDemand}</td>
        <td>${e.daysOfCover}</td>
        <td>$${e.excessValue.toLocaleString()}</td>
        <td><span class="badge badge-${e.ageRisk === 'high' ? 'high' : e.ageRisk === 'medium' ? 'medium' : 'low'}">${e.ageCategory}</span></td>
        <td>${e.perishable ? '<span class="badge badge-high">YES</span>' : '<span class="badge badge-low">No</span>'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';

  // Ageing items
  html += '<div class="card"><div class="card-header"><div class="card-title">⏰ Ageing Stock</div></div>';
  if (data.ageingItems.length === 0) {
    html += '<div style="color: var(--text-secondary); padding: 12px;">No ageing items.</div>';
  } else {
    html += '<div style="overflow-x: auto;"><table class="table"><thead><tr><th>SKU</th><th>Location</th><th>On Hand</th><th>Age (days)</th><th>Category</th><th>Shelf Life Left</th><th>Value</th><th>Recommendation</th></tr></thead><tbody>';
    data.ageingItems.forEach(a => {
      html += `<tr>
        <td><div style="font-weight: 600;">${a.skuName}</div></td>
        <td>${a.locationName}</td>
        <td>${a.onHand}</td>
        <td>${a.stockAgeDays}</td>
        <td><span class="badge badge-${a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'high' : 'medium'}">${a.ageCategory}</span></td>
        <td>${a.remainingShelfLife != null ? a.remainingShelfLife + ' days' : 'N/A'}</td>
        <td>$${a.stockValue.toLocaleString()}</td>
        <td style="font-size: 12px;">${a.recommendedAction}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';

  // Distorted history
  if (data.distortedHistory.length > 0) {
    html += '<div class="distortion-callout"><div class="distortion-callout-title">⚠ Stockout-Distorted Sales History</div><div class="distortion-callout-body">The following SKU+locations have historical sales data that was suppressed by stockouts. The raw data understates true demand. Forecasts have been de-biased.</div>';
    data.distortedHistory.forEach(d => {
      html += `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
        <strong>${d.skuName} — ${d.locationName}</strong><br>
        Naive average: ${d.naiveDemand}/day | De-biased: ${d.debiasedDemand}/day<br>
        ${d.warning}
      </div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============================================================
// Transfers Detail (with approval gate)
// ============================================================
function renderTransfersDetail() {
  const data = pipelineResults.stageResults.stage5_transfers;
  const impact = pipelineResults.stageResults.stage6_impact;
  const container = document.getElementById('transfers-detail');

  let html = '';

  // Before/After comparison
  html += '<div class="card"><div class="card-header"><div class="card-title">Impact Analysis: Before vs After</div></div>';
  html += '<div class="ba-comparison">';
  html += '<div class="ba-col before"><div class="ba-label">Before</div></div>';
  html += '<div class="ba-col arrow"><div class="ba-label">→</div></div>';
  html += '<div class="ba-col after"><div class="ba-label">After (Projected)</div></div>';
  html += '</div>';

  const ba = impact.beforeAfter;
  const metrics = [
    { label: 'Shortages', before: ba.before.totalShortages, after: ba.after.totalShortages, delta: ba.delta.shortagesResolved },
    { label: 'Critical Shortages', before: ba.before.criticalShortages, after: ba.after.criticalShortages, delta: ba.delta.criticalShortagesResolved },
    { label: 'Excess Items', before: ba.before.totalExcesses, after: ba.after.totalExcesses, delta: ba.delta.excessesCleared },
    { label: 'Excess Value', before: '$' + ba.before.totalExcessValue.toLocaleString(), after: '$' + ba.after.totalExcessValue.toLocaleString(), delta: '$' + ba.delta.excessValueReduced.toLocaleString() },
  ];

  html += '<div style="overflow-x: auto;"><table class="table"><thead><tr><th>Metric</th><th>Before</th><th>After (Projected)</th><th>Delta</th></tr></thead><tbody>';
  metrics.forEach(m => {
    html += `<tr>
      <td style="font-weight: 600;">${m.label}</td>
      <td style="color: var(--danger);">${m.before}</td>
      <td style="color: var(--success);">${m.after}</td>
      <td style="font-weight: 700; color: ${typeof m.delta === 'string' ? 'var(--success)' : m.delta > 0 ? 'var(--success)' : 'var(--text-secondary)'};">${typeof m.delta === 'string' ? m.delta : (m.delta > 0 ? '+' : '') + m.delta}</td>
    </tr>`;
  });
  html += '</tbody></table></div></div>';

  // Economic summary
  html += `<div class="grid-3">
    <div class="stat-card info"><div class="stat-label">Total Transfer Cost</div><div class="stat-value">$${data.summary.totalTransferCost.toLocaleString()}</div></div>
    <div class="stat-card success"><div class="stat-label">Total Net Benefit</div><div class="stat-value">$${data.summary.totalNetBenefit.toLocaleString()}</div></div>
    <div class="stat-card warning"><div class="stat-label">Total Units</div><div class="stat-value">${data.summary.totalUnits}</div></div>
  </div>`;

  // Approval gate warning
  html += `<div class="assumption-box">
    No transfer will be executed until explicitly approved by the planner (Sara). All forecasts are estimates with stated confidence intervals — NOT certainties.
  </div>`;

  // Recommended transfers
  html += '<div class="card"><div class="card-header"><div class="card-title">✅ Recommended Transfers</div><span class="badge badge-low">' + data.recommendations.length + ' pending approval</span></div>';
  if (data.recommendations.length === 0) {
    html += '<div style="color: var(--text-secondary); padding: 12px;">No economical transfers identified.</div>';
  } else {
    data.recommendations.forEach(t => {
      const isApproved = approvedTransfers.has(t.transferId);
      const isRejected = rejectedTransfers.has(t.transferId);
      html += renderTransferCard(t, isApproved, isRejected);
    });
  }
  html += '</div>';

  // Rejected transfers (the trap)
  html += '<div class="card"><div class="card-header"><div class="card-title">🚫 Rejected Transfers (Economics Engine)</div><span class="badge badge-critical">' + data.rejected.length + ' rejected</span></div>';
  html += '<div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">These transfers were evaluated but REJECTED because the economic benefit does not justify the cost, or because of shelf-life constraints, or because a pending PO makes them unnecessary.</div>';
  if (data.rejected.length === 0) {
    html += '<div style="color: var(--text-secondary); padding: 12px;">No transfers were rejected.</div>';
  } else {
    data.rejected.forEach(t => {
      html += `<div class="transfer-card rejected">
        <div class="transfer-header">
          <div class="transfer-route">${t.skuName}: ${t.fromLocation?.locationName || '—'} <span class="transfer-arrow">→</span> ${t.toLocation?.locationName || '—'}</div>
          <span class="badge badge-critical">REJECTED</span>
        </div>
        <div style="font-size: 13px; color: var(--danger); margin-bottom: 8px;"><strong>Reason:</strong> ${t.rejectionReason}</div>
        ${t.assumptions ? t.assumptions.map(a => `<div class="assumption-box">${a}</div>`).join('') : ''}
      </div>`;
    });
  }
  html += '</div>';

  // Traceability
  html += '<div class="card"><div class="card-header"><div class="card-title">🔍 Traceability</div></div>';
  html += '<div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Full data lineage and assumption log:</div>';
  html += '<ol style="padding-left: 20px; font-size: 13px; color: var(--text-secondary);">';
  impact.traceability.dataLineage.forEach(line => {
    html += `<li style="padding: 4px 0;">${line}</li>`;
  });
  html += '</ol>';
  if (impact.traceability.unsupportedFlags.length > 0) {
    html += '<div style="margin-top: 12px;"><strong style="color: var(--warning);">Unsupported Claims Flagged:</strong><ul style="padding-left: 20px; font-size: 13px;">';
    impact.traceability.unsupportedFlags.forEach(f => html += `<li style="padding: 4px 0;">${f}</li>`);
    html += '</ul></div>';
  }
  html += '</div>';

  container.innerHTML = html;
}

function renderTransferCard(t, isApproved, isRejected) {
  const statusBadge = isApproved ? '<span class="badge badge-low">APPROVED</span>' :
    isRejected ? '<span class="badge badge-critical">REJECTED</span>' :
    '<span class="badge badge-high">PENDING</span>';

  return `<div class="transfer-card ${isApproved ? 'approved' : ''} ${isRejected ? 'rejected' : ''}">
    <div class="transfer-header">
      <div class="transfer-route">
        ${t.skuName}: ${t.fromLocation.locationName} <span class="transfer-arrow">→</span> ${t.toLocation.locationName}
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="badge badge-${t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : 'medium'}">${t.priority.toUpperCase()}</span>
        ${statusBadge}
      </div>
    </div>
    <div class="transfer-economics">
      <div class="econ-item"><div class="econ-label">Quantity</div><div class="econ-value">${t.quantity} units</div></div>
      <div class="econ-item"><div class="econ-label">Transfer Cost</div><div class="econ-value">${t.transferCost ? '$' + t.transferCost.toLocaleString() : '—'}</div></div>
      <div class="econ-item"><div class="econ-label">Net Benefit</div><div class="econ-value positive">${t.netBenefit ? '$' + t.netBenefit.toLocaleString() : '—'}</div></div>
      <div class="econ-item"><div class="econ-label">ROI</div><div class="econ-value positive">${t.roi || '—'}x</div></div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; color: var(--text-secondary);">
      <div><strong>From:</strong> ${t.fromLocation.availableStock} available (excess: ${t.fromLocation.excessQty})</div>
      <div><strong>To:</strong> ${t.toLocation.currentStock} current (safety: ${t.toLocation.safetyStock}, ${t.toLocation.daysOfCover} days cover)</div>
      <div><strong>Distance:</strong> ${t.distance} km (${t.transferLeadTimeDays} days transit)</div>
      <div><strong>Stockout by:</strong> ${t.toLocation.projectedStockoutDate}</div>
    </div>
    ${t.shelfLifeWarning ? `<div class="assumption-box">${t.shelfLifeWarning}</div>` : ''}
    ${t.poComparison ? `<div style="background: var(--bg-secondary); padding: 10px; border-radius: 8px; font-size: 13px; margin-top: 8px;"><strong>PO Comparison:</strong> ${t.poComparison.recommendation}</div>` : ''}
    ${t.assumptions && t.assumptions.length > 0 ? t.assumptions.map(a => `<div class="assumption-box">${a}</div>`).join('') : ''}
    ${!isApproved && !isRejected ? `
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="btn btn-success btn-sm" onclick="approveTransfer('${t.transferId}')">✓ Approve</button>
        <button class="btn btn-danger btn-sm" onclick="rejectTransfer('${t.transferId}')">✗ Reject</button>
        <button class="btn btn-secondary btn-sm" onclick="editTransfer('${t.transferId}')">✎ Edit Quantity</button>
      </div>
    ` : ''}
  </div>`;
}

// ============================================================
// Transfer Approval/Rejection
// ============================================================
async function approveTransfer(transferId) {
  const t = pipelineResults.stageResults.stage5_transfers.recommendations.find(r => r.transferId === transferId);
  if (!t) return;

  try {
    const response = await fetch('/api/approve-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferId, action: 'approve', quantity: t.quantity }),
    });
    const result = await response.json();
    approvedTransfers.add(transferId);
    showToast(result.message);
    renderTransfersDetail();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function rejectTransfer(transferId) {
  try {
    const response = await fetch('/api/approve-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferId, action: 'reject', justification: 'Planner reviewed and decided not to proceed' }),
    });
    const result = await response.json();
    rejectedTransfers.add(transferId);
    showToast(result.message);
    renderTransfersDetail();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function editTransfer(transferId) {
  const t = pipelineResults.stageResults.stage5_transfers.recommendations.find(r => r.transferId === transferId);
  if (!t) return;
  const newQty = prompt(`Edit transfer quantity for ${t.skuName} (current: ${t.quantity}):`, t.quantity);
  if (newQty && !isNaN(newQty) && newQty > 0) {
    t.quantity = parseInt(newQty);
    showToast(`Quantity updated to ${newQty}. Re-evaluating economics...`);
    renderTransfersDetail();
  }
}

// ============================================================
// Logistics Map
// ============================================================
function renderLogisticsDetail() {
  const data = pipelineResults.stageResults.stage2_inventory;
  const transfers = pipelineResults.stageResults.stage5_transfers;
  const container = document.getElementById('logistics-detail');

  let html = '<div class="card"><div class="card-header"><div class="card-title">Network Map</div></div>';

  // Simple visual map with positioned nodes
  html += '<div class="map-container" style="height: 400px;">';
  const locations = pipelineResults.stageResults.stage1_data.locations;
  const positions = [
    { top: '20%', left: '15%' },
    { top: '30%', left: '70%' },
    { top: '60%', left: '25%' },
    { top: '65%', left: '65%' },
  ];

  locations.forEach((loc, i) => {
    const pos = positions[i] || positions[0];
    const locSummary = data.summaryByLocation.find(s => s.locationId === loc.locationId);
    const isCritical = locSummary?.criticalStocks > 0;
    const isWarehouse = loc.type === 'warehouse';
    html += `<div class="map-node ${isCritical ? 'critical' : ''} ${isWarehouse ? 'warehouse' : ''}" style="top: ${pos.top}; left: ${pos.left};">
      ${loc.name}<br><span style="font-size: 10px; color: var(--text-muted);">${locSummary?.totalUnits || 0} units | $${(locSummary?.totalValue || 0).toLocaleString()}</span>
      ${isCritical ? '<br><span style="color: var(--danger); font-size: 10px;">⚠ ' + locSummary.criticalStocks + ' critical</span>' : ''}
    </div>`;
  });

  // Transfer lines
  transfers.recommendations.forEach(t => {
    const fromIdx = locations.findIndex(l => l.locationId === t.fromLocation.locationId);
    const toIdx = locations.findIndex(l => l.locationId === t.toLocation.locationId);
    if (fromIdx >= 0 && toIdx >= 0) {
      const fromPos = positions[fromIdx];
      const toPos = positions[toIdx];
      const dx = parseFloat(toPos.left) - parseFloat(fromPos.left);
      const dy = parseFloat(toPos.top) - parseFloat(fromPos.top);
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      html += `<div class="map-line active" style="
        top: calc(${fromPos.top} + 15px);
        left: calc(${fromPos.left} + 80px);
        width: ${length * 3.5}px;
        transform: rotate(${angle}deg);
      "></div>`;
    }
  });

  html += '</div></div>';

  // Transfer list for logistics
  html += '<div class="card"><div class="card-header"><div class="card-title">Transfer Routes</div></div>';
  html += '<table class="table"><thead><tr><th>Transfer</th><th>From</th><th>To</th><th>Qty</th><th>Distance</th><th>Transit Days</th><th>Cost</th><th>Priority</th><th>Status</th></tr></thead><tbody>';
  transfers.recommendations.forEach(t => {
    const status = approvedTransfers.has(t.transferId) ? 'Approved' :
      rejectedTransfers.has(t.transferId) ? 'Rejected' : 'Pending';
    html += `<tr>
      <td style="font-size: 12px;">${t.skuName}</td>
      <td>${t.fromLocation.locationName}</td>
      <td>${t.toLocation.locationName}</td>
      <td>${t.quantity}</td>
      <td>${t.distance} km</td>
      <td>${t.transferLeadTimeDays} days</td>
      <td>$${t.transferCost}</td>
      <td><span class="badge badge-${t.priority === 'critical' ? 'critical' : 'high'}">${t.priority}</span></td>
      <td><span class="badge badge-${status === 'Approved' ? 'low' : status === 'Rejected' ? 'critical' : 'high'}">${status}</span></td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  container.innerHTML = html;
}

// ============================================================
// Advisory Detail
// ============================================================
function renderAdvisoryDetail() {
  const advisory = pipelineResults.stageResults.advisory;
  const container = document.getElementById('advisory-detail');

  let html = '';

  // Recommendations
  html += '<div class="card"><div class="card-header"><div class="card-title">🎯 Strategic Recommendations</div></div>';
  advisory.recommendations.forEach(r => {
    html += `<div class="card" style="margin-bottom: 12px;">
      <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 8px;">
        <div style="font-weight: 700; font-size: 15px;">${r.title}</div>
        <span class="badge badge-${r.priority === 'critical' ? 'critical' : r.priority === 'high' ? 'high' : 'medium'}">${r.priority.toUpperCase()}</span>
      </div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">${r.message}</div>
      <div style="font-size: 14px;"><strong>Recommended Action:</strong> ${r.action}</div>
      ${r.expectedImpact ? `<div style="font-size: 13px; margin-top: 8px; color: var(--success);"><strong>Expected Impact:</strong> ${r.expectedImpact}</div>` : ''}
      ${r.isAssumption ? '<div class="assumption-box">Impact is an estimate based on available data, not a guaranteed outcome.</div>' : ''}
    </div>`;
  });
  html += '</div>';

  // Insights
  html += '<div class="card"><div class="card-header"><div class="card-title">💡 Insights</div></div>';
  advisory.insights.forEach(i => {
    html += `<div style="padding: 12px; border-bottom: 1px solid var(--border);">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${i.title || i.type}</div>
      <div style="font-size: 13px; color: var(--text-secondary);">${i.message}</div>
      ${i.actionItems ? `<ul style="margin-top: 8px; padding-left: 20px; font-size: 13px;">${i.actionItems.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
    </div>`;
  });
  html += '</div>';

  // Customer experience
  html += '<div class="card"><div class="card-header"><div class="card-title">Experience & Perception</div></div>';
  const ce = advisory.customerExperience;
  html += `<div style="margin-bottom: 12px;"><strong>High-Tech Feel:</strong> ${ce.highTechFeel}</div>`;
  html += `<div style="margin-bottom: 12px;"><strong>B2B Perception:</strong> ${ce.b2bPerception}</div>`;
  html += `<div style="margin-bottom: 12px;"><strong>Customer Needs:</strong><ul style="padding-left: 20px; margin-top: 6px;">${ce.customerNeeds.map(n => `<li style="font-size: 13px;">${n}</li>`).join('')}</ul></div>`;
  html += `<div><strong>Customer Happiness:</strong> ${ce.customerHappiness}</div>`;
  html += '</div>';

  // Disclaimer
  html += `<div class="assumption-box" style="margin-top: 16px;">${advisory.disclaimer}</div>`;

  container.innerHTML = html;
}

// ============================================================
// Strategy Detail
// ============================================================
function renderStrategyDetail() {
  const sp = pipelineResults.strategicPlan;
  const container = document.getElementById('strategy-detail');

  let html = `<div class="card">
    <div class="card-header"><div class="card-title">Current Strategic Plan</div></div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div><strong>Business:</strong> ${sp?.businessName || '—'}</div>
      <div><strong>Niche:</strong> ${sp?.niche || '—'}</div>
      <div><strong>Strategy:</strong> ${sp?.strategyName || '—'}</div>
      <div><strong>Created:</strong> ${new Date(sp?.createdAt).toLocaleString()}</div>
    </div>
  </div>`;

  // Agent priorities
  html += `<div class="card">
    <div class="card-header"><div class="card-title">Agent Priority Weights</div><div class="card-subtitle">How the agent weights different factors</div></div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      ${Object.entries(sp?.agentPriorities || {}).map(([k, v]) => `
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
          <div style="font-size: 12px; color: var(--text-muted);">${k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</div>
          <div style="font-size: 20px; font-weight: 700;">${(v * 100).toFixed(0)}%</div>
          <div class="progress-bar"><div class="progress-fill" style="width: ${v * 100}%;"></div></div>
        </div>
      `).join('')}
    </div>
  </div>`;

  // Risk factors
  html += `<div class="card">
    <div class="card-header"><div class="card-title">Risk Factors</div></div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      ${Object.entries(sp?.riskFactors || {}).map(([k, v]) => `
        <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 13px;">${k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</span>
          <span class="badge badge-${v === 'high' || v === 'critical' ? 'critical' : v === 'medium' ? 'medium' : 'low'}">${v}</span>
        </div>
      `).join('')}
    </div>
  </div>`;

  // Operational constraints
  html += `<div class="card">
    <div class="card-header"><div class="card-title">Operational Constraints</div></div>
    <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
      ${Object.entries(sp?.operationalConstraints || {}).map(([k, v]) => `
        <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 13px;">${k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</span>
          <span style="font-weight: 600;">${typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}</span>
        </div>
      `).join('')}
    </div>
  </div>`;

  // Tips
  html += `<div class="card">
    <div class="card-header"><div class="card-title">Niche-Specific Tips</div></div>
    <ul style="list-style: none; padding: 0;">
      ${(sp?.tips || []).map(t => `<li style="padding: 8px 0; font-size: 14px; color: var(--text-secondary);">💡 ${t}</li>`).join('')}
    </ul>
  </div>`;

  container.innerHTML = html;
}

// ============================================================
// Transcript Upload
// ============================================================
function renderTranscriptDetail() {
  const container = document.getElementById('transcript-detail');

  let html = `<div class="card">
    <div class="card-header"><div class="card-title">Upload Meeting Transcript</div><div class="card-subtitle">The agent extracts relevant insights and adjusts recommendations</div></div>
    <div class="form-group" style="margin-bottom: 12px;">
      <label class="form-label">Department</label>
      <select id="transcript-dept">
        <option value="marketing">Marketing</option>
        <option value="operations">Operations</option>
        <option value="logistics">Logistics</option>
        <option value="sales">Sales</option>
        <option value="finance">Finance</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom: 12px;">
      <label class="form-label">Meeting Date</label>
      <input type="date" id="transcript-date" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div class="form-group" style="margin-bottom: 12px;">
      <label class="form-label">Transcript Text</label>
      <textarea id="transcript-text" rows="8" placeholder="Paste meeting transcript here..."></textarea>
    </div>
    <button class="btn btn-primary" onclick="uploadTranscript()">Upload & Parse</button>
  </div>`;

  html += `<div id="transcript-result" style="margin-top: 16px;"></div>`;

  container.innerHTML = html;
}

async function uploadTranscript() {
  const text = document.getElementById('transcript-text').value;
  const dept = document.getElementById('transcript-dept').value;
  const date = document.getElementById('transcript-date').value;

  if (!text.trim()) {
    showToast('Please paste a transcript first', 'error');
    return;
  }

  try {
    const response = await fetch('/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcriptText: text, department: dept, date }),
    });
    const result = await response.json();

    const container = document.getElementById('transcript-result');
    container.innerHTML = `<div class="card">
      <div class="card-header"><div class="card-title">Parsed Insights — ${result.department} Meeting (${result.date})</div></div>
      <div style="margin-bottom: 12px;"><strong>Extracted Insights:</strong><br>${result.extractedInsights}</div>
      <div><strong>Action Items:</strong><ul style="padding-left: 20px; margin-top: 8px;">${result.actionItems.map(a => `<li style="font-size: 13px;">${a}</li>`).join('')}</ul></div>
    </div>`;

    showToast('Transcript parsed successfully!');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ============================================================
// Subscription
// ============================================================
function renderSubscriptionDetail() {
  const advisory = pipelineResults?.stageResults?.advisory;
  const tiers = advisory?.customerExperience?.tiers || [
    { name: 'Starter', price: 'Free', features: ['Data ingestion', 'Basic forecasts', '1 location', 'Community support'] },
    { name: 'Professional', price: '$499/mo', features: ['Full 6-stage pipeline', 'Transfer economics', 'Up to 10 locations', 'Disruption tracking'] },
    { name: 'Enterprise', price: 'Custom', features: ['Unlimited locations', 'Strategic embedding', 'Meeting transcripts', 'API access'] },
  ];

  const container = document.getElementById('subscription-detail');
  let html = '<div class="sub-grid">';
  tiers.forEach((t, i) => {
    html += `<div class="sub-card ${i === 1 ? 'featured' : ''}">
      <div class="sub-name">${t.name}</div>
      <div class="sub-price">${t.price}</div>
      <ul class="sub-features">${t.features.map(f => `<li>${f}</li>`).join('')}</ul>
      <button class="btn ${i === 1 ? 'btn-primary' : 'btn-secondary'}" style="width: 100%; margin-top: 16px; justify-content: center;">${t.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}</button>
    </div>`;
  });
  html += '</div>';

  html += `<div class="card" style="margin-top: 16px;">
    <div class="card-header"><div class="card-title">What B2B Customers Get</div></div>
    <div style="font-size: 14px; color: var(--text-secondary);">
      <p style="margin-bottom: 12px;">StockFlow AI gives B2B inventory managers what they desperately need:</p>
      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 6px;">Real-time visibility across all locations</li>
        <li style="margin-bottom: 6px;">Evidence-based transfer recommendations with cost-benefit analysis</li>
        <li style="margin-bottom: 6px;">Confidence-scored forecasts that don't pretend certainty</li>
        <li style="margin-bottom: 6px;">Strategic plan embedding — the agent thinks like your business</li>
        <li style="margin-bottom: 6px;">Full human control — nothing executes without approval</li>
        <li style="margin-bottom: 6px;">Traceability — every recommendation traces back to source data</li>
      </ul>
    </div>
  </div>`;

  container.innerHTML = html;
}

// ============================================================
// Ethics
// ============================================================
function renderEthicsDetail() {
  const advisory = pipelineResults?.stageResults?.advisory;
  const container = document.getElementById('ethics-detail');

  let html = '<div class="ethics-grid">';
  (advisory?.ethicalNotes || []).forEach(note => {
    html += `<div class="ethics-item">
      <div class="ethics-principle">⚖️ ${note.principle}</div>
      <div class="ethics-impl">${note.implementation}</div>
    </div>`;
  });
  html += '</div>';

  html += `<div class="card" style="margin-top: 16px;">
    <div class="card-header"><div class="card-title">Data Privacy & Security</div></div>
    <div style="font-size: 14px; color: var(--text-secondary);">
      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 8px;">Each business's data is fully isolated — no cross-business data sharing</li>
        <li style="margin-bottom: 8px;">Role-based access control: Owner, Planner, Logistics, Viewer</li>
        <li style="margin-bottom: 8px;">All actions are logged with full audit trail</li>
        <li style="margin-bottom: 8px;">No data leaves your environment without explicit consent</li>
        <li style="margin-bottom: 8px;">GDPR/CCPA compliant data handling</li>
        <li style="margin-bottom: 8px;">Encryption at rest and in transit</li>
      </ul>
    </div>
  </div>`;

  html += `<div class="card">
    <div class="card-header"><div class="card-title">Human-in-the-Loop Guarantee</div></div>
    <div style="font-size: 14px;">
      <p style="margin-bottom: 12px;">The AI agent NEVER executes any inventory transfer, purchase order, or operational change without explicit human approval.</p>
      <p style="margin-bottom: 12px;">The planner (Sara) can:</p>
      <ul style="padding-left: 20px; margin-bottom: 12px;">
        <li>Review every recommendation with full evidence and assumptions</li>
        <li>Edit transfer quantities before approval</li>
        <li>Reject any recommendation with justification</li>
        <li>See before/after impact projections</li>
        <li>Override AI suggestions — human judgment always takes precedence</li>
      </ul>
    </div>
  </div>`;

  container.innerHTML = html;
}

// ============================================================
// Initialize
// ============================================================
updateStrategyOptions();
// Auto-run pipeline on load
setTimeout(() => runPipeline(), 500);
