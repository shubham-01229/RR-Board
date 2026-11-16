/**
 * App — main orchestrator for the Royals Board dashboard.
 */
(function () {
  'use strict';

  var batterRankCtrl = null;
  var bowlerRankCtrl = null;

  /* ══════════════════════════════════════════════════════════════════
     ANIMATED COUNTER
     ══════════════════════════════════════════════════════════════════ */
  function animateCounter(el, target, duration) {
    duration = duration || 1500;
    var start = null;
    target = Number(target) || 0;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var ease = 1 - (1 - progress) * (1 - progress);
      var current = Math.floor(target * ease);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ══════════════════════════════════════════════════════════════════
     KPI RENDERING
     ══════════════════════════════════════════════════════════════════ */
  function renderKPIs(overview) {
    var grid = document.getElementById('kpi-grid');
    if (!grid) return;

    var kpis = [
      { icon: '🏏', value: overview.total_matches || 0, label: 'Matches Analysed', color: 'border-blue' },
      { icon: '⚡', value: overview.total_deliveries || 0, label: 'Deliveries Analysed', color: 'border-pink' },
      { icon: '👤', value: overview.total_players || 0, label: 'Players Analysed', color: 'border-gold' },
      { icon: '🏃', value: overview.total_runs || 0, label: 'Total Runs', color: 'border-blue' },
      { icon: '🎯', value: overview.total_wickets || 0, label: 'Total Wickets', color: 'border-pink' },
      { icon: '🔥', value: overview.high_pressure_performances || 0, label: 'High-Pressure Performers', color: 'border-gold' },
    ];

    grid.innerHTML = kpis.map(function (k) {
      return '<div class="kpi-card ' + k.color + '">' +
        '<span class="kpi-icon">' + k.icon + '</span>' +
        '<span class="kpi-value" data-target="' + k.value + '">0</span>' +
        '<span class="kpi-label">' + k.label + '</span>' +
        '</div>';
    }).join('');

    // Animate each counter
    var valueEls = grid.querySelectorAll('.kpi-value');
    valueEls.forEach(function (el) {
      animateCounter(el, parseInt(el.getAttribute('data-target')));
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SECTION RENDERERS
     ══════════════════════════════════════════════════════════════════ */
  function fmt(v, dec) {
    if (v == null) return '—';
    return typeof v === 'number' ? v.toFixed(dec != null ? dec : 1) : v;
  }

  function renderTopBattersTable(containerId, top) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var html = '<table class="rankings-table"><thead><tr>';
    html += '<th>#</th><th>Player</th><th>Team</th><th>Mat</th><th>Runs</th><th>Avg</th><th>SR</th><th>Boundary%</th><th>Death SR</th><th>Pressure</th>';
    html += '</tr></thead><tbody>';
    top.forEach(function (b, i) {
      html += '<tr><td>' + (i + 1) + '</td><td class="player-name">' + b.name + '</td><td>' + b.team + '</td>';
      html += '<td>' + b.matches + '</td><td>' + b.runs + '</td><td>' + fmt(b.average, 2) + '</td>';
      html += '<td>' + fmt(b.strike_rate, 2) + '</td><td>' + fmt(b.boundary_pct, 1) + '%</td>';
      html += '<td>' + fmt(b.death_sr, 1) + '</td>';
      html += '<td><span class="badge badge-elite">' + fmt(b.pressure_score, 1) + '</span></td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function renderTopBowlersTable(containerId, top) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var html = '<table class="rankings-table"><thead><tr>';
    html += '<th>#</th><th>Player</th><th>Team</th><th>Mat</th><th>Wkts</th><th>Econ</th><th>Dot%</th><th>Death Econ</th><th>Pressure</th>';
    html += '</tr></thead><tbody>';
    top.forEach(function (b, i) {
      html += '<tr><td>' + (i + 1) + '</td><td class="player-name">' + b.name + '</td><td>' + b.team + '</td>';
      html += '<td>' + b.matches + '</td><td>' + b.wickets + '</td><td>' + fmt(b.economy, 2) + '</td>';
      html += '<td>' + fmt(b.dot_pct, 1) + '%</td><td>' + fmt(b.death_economy, 2) + '</td>';
      html += '<td><span class="badge badge-elite">' + fmt(b.pressure_score, 1) + '</span></td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function renderBattingSection(batters) {
    var top = Analytics.getTopBatters(batters, 10, 'pressure_score');

    // Top 10 table
    renderTopBattersTable('top-batters-table', top);

    // Top batters bar chart
    Charts.createBarChart('chart-top-batters',
      top.map(function (b) { return b.name; }),
      [{ label: 'Pressure Score', data: top.map(function (b) { return b.pressure_score; }) }]
    );

    // SR vs Average scatter
    var topN = batters.slice(0, 100);
    Charts.createScatterChart('chart-sr-vs-avg',
      Analytics.getScatterData(topN, 'average', 'strike_rate'),
      'Batting Average', 'Strike Rate'
    );

    // Phase runs stacked bar
    var phase = Analytics.getBattingPhaseData(top.slice(0, 8));
    Charts.createBarChart('chart-batting-phase', phase.labels, phase.datasets, {
      scales: {
        x: { stacked: true, ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
        y: { stacked: true, ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
      },
    });

    // Pressure distribution
    var dist = Analytics.getPressureDistribution(batters);
    Charts.createBarChart('chart-batting-pressure-dist', dist.labels,
      [{ label: 'Players', data: dist.data }]
    );
  }

  function renderBowlingSection(bowlers) {
    var top = Analytics.getTopBowlers(bowlers, 10, 'pressure_score');

    // Top 10 table
    renderTopBowlersTable('top-bowlers-table', top);

    // Top bowlers bar chart
    Charts.createBarChart('chart-top-bowlers',
      top.map(function (b) { return b.name; }),
      [{ label: 'Pressure Score', data: top.map(function (b) { return b.pressure_score; }) }]
    );

    // Economy vs Wickets scatter
    var topN = bowlers.slice(0, 100);
    Charts.createScatterChart('chart-econ-vs-wickets',
      Analytics.getScatterData(topN, 'economy', 'wickets'),
      'Economy Rate', 'Wickets'
    );

    // Phase wickets stacked bar
    var phase = Analytics.getBowlingPhaseData(top.slice(0, 8));
    Charts.createBarChart('chart-bowling-phase', phase.labels, phase.datasets, {
      scales: {
        x: { stacked: true, ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
        y: { stacked: true, ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
      },
    });

    // Pressure distribution
    var dist = Analytics.getPressureDistribution(bowlers);
    Charts.createBarChart('chart-bowling-pressure-dist', dist.labels,
      [{ label: 'Players', data: dist.data }]
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     METHODOLOGY
     ══════════════════════════════════════════════════════════════════ */
  function renderMethodology() {
    var meth = DataStore.getMethodology();
    if (!meth) return;

    // Batting methodology
    var batDesc = document.getElementById('bat-methodology-desc');
    var batComp = document.getElementById('bat-methodology-components');
    var batSit  = document.getElementById('bat-pressure-situations');
    if (batDesc && meth.batting) {
      batDesc.textContent = meth.batting.description;
      var html = '';
      (meth.batting.components || []).forEach(function (c) {
        html += '<div class="methodology-component">';
        html += '<div class="methodology-bar" style="width:' + (c.max_weight) + '%"></div>';
        html += '<span class="methodology-name">' + c.name + '</span>';
        html += '<span class="methodology-weight">Max: ' + c.max_weight + '</span>';
        html += '<p class="methodology-detail">' + c.description + '</p>';
        html += '</div>';
      });
      if (batComp) batComp.innerHTML = html;
      if (batSit) batSit.innerHTML = '<strong>Pressure Situations:</strong> ' + meth.batting.pressure_situations;
    }

    // Bowling methodology
    var bowlDesc = document.getElementById('bowl-methodology-desc');
    var bowlComp = document.getElementById('bowl-methodology-components');
    var bowlSit  = document.getElementById('bowl-pressure-situations');
    if (bowlDesc && meth.bowling) {
      bowlDesc.textContent = meth.bowling.description;
      var html2 = '';
      (meth.bowling.components || []).forEach(function (c) {
        html2 += '<div class="methodology-component">';
        html2 += '<div class="methodology-bar" style="width:' + (c.max_weight) + '%"></div>';
        html2 += '<span class="methodology-name">' + c.name + '</span>';
        html2 += '<span class="methodology-weight">Max: ' + c.max_weight + '</span>';
        html2 += '<p class="methodology-detail">' + c.description + '</p>';
        html2 += '</div>';
      });
      if (bowlComp) bowlComp.innerHTML = html2;
      if (bowlSit) bowlSit.innerHTML = '<strong>Pressure Situations:</strong> ' + meth.bowling.pressure_situations;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PRESSURE CHARTS
     ══════════════════════════════════════════════════════════════════ */
  function renderPressureCharts(batters, bowlers) {
    // Top pressure batters horizontal bar
    var topPBat = Analytics.getTopBatters(batters, 12, 'pressure_score');
    Charts.createBarChart('chart-pressure-batters',
      topPBat.map(function (b) { return b.name; }),
      [{
        label: 'Pressure Score',
        data: topPBat.map(function (b) { return b.pressure_score; }),
        backgroundColor: 'rgba(230, 6, 147, 0.6)',
        borderColor: '#E60693',
      }],
      { indexAxis: 'y' }
    );

    // Top pressure bowlers horizontal bar
    var topPBowl = Analytics.getTopBowlers(bowlers, 12, 'pressure_score');
    Charts.createBarChart('chart-pressure-bowlers',
      topPBowl.map(function (b) { return b.name; }),
      [{
        label: 'Pressure Score',
        data: topPBowl.map(function (b) { return b.pressure_score; }),
        backgroundColor: 'rgba(37, 74, 165, 0.6)',
        borderColor: '#254AA5',
      }],
      { indexAxis: 'y' }
    );

    // Death-over batting specialists
    var deathBat = Analytics.getTopBatters(batters.filter(function(b){ return b.death_balls >= 30; }), 10, 'death_sr');
    Charts.createBarChart('chart-death-batting',
      deathBat.map(function (b) { return b.name; }),
      [
        { label: 'Death SR', data: deathBat.map(function (b) { return b.death_sr; }), backgroundColor: 'rgba(230, 6, 147, 0.5)', borderColor: '#E60693' },
        { label: 'Overall SR', data: deathBat.map(function (b) { return b.strike_rate; }), backgroundColor: 'rgba(37, 74, 165, 0.5)', borderColor: '#254AA5' },
      ]
    );

    // Death-over bowling specialists
    var deathBowl = bowlers.filter(function(b){ return b.death_balls >= 30; }).slice().sort(function(a,b){ return a.death_economy - b.death_economy; }).slice(0, 10);
    Charts.createBarChart('chart-death-bowling',
      deathBowl.map(function (b) { return b.name; }),
      [
        { label: 'Death Econ', data: deathBowl.map(function (b) { return b.death_economy; }), backgroundColor: 'rgba(203, 169, 43, 0.5)', borderColor: '#CBA92B' },
        { label: 'Overall Econ', data: deathBowl.map(function (b) { return b.economy; }), backgroundColor: 'rgba(37, 74, 165, 0.5)', borderColor: '#254AA5' },
      ]
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     RECOMMENDATIONS (AUCTION PICKS)
     ══════════════════════════════════════════════════════════════════ */
  function renderRecommendations(recommendations) {
    var mustTarget = document.getElementById('must-target-cards');
    var highPriority = document.getElementById('high-priority-cards');
    var valuePick = document.getElementById('value-pick-cards');

    var buckets = { 'MUST TARGET': [], 'HIGH PRIORITY': [], 'VALUE PICK': [] };
    recommendations.forEach(function (rec) {
      if (buckets[rec.category]) buckets[rec.category].push(rec);
    });

    function renderCards(container, recs) {
      if (!container) return;
      if (!recs.length) {
        container.innerHTML = '<p class="no-data">No players match current filters.</p>';
        return;
      }
      container.innerHTML = recs.map(function (rec) {
        var isBatter = rec.type === 'Batter';
        var badgeCls = rec.reliability === 'Elite' ? 'badge-elite' : (rec.reliability === 'High' ? 'badge-high' : 'badge-promising');
        return '<div class="auction-card glass-card">' +
          '<div class="auction-card-header">' +
            '<div><h4 class="auction-name">' + rec.name + '</h4>' +
            '<span class="auction-team">' + (rec.team || '—') + '</span></div>' +
            '<span class="badge ' + badgeCls + '">' + rec.reliability + '</span>' +
          '</div>' +
          '<div class="auction-card-body">' +
            '<div class="auction-stats">' +
              '<div class="auction-stat"><span class="auction-stat-value text-pink">' + fmt(rec.pressure_score, 1) + '</span><span class="auction-stat-label">Pressure</span></div>' +
              '<div class="auction-stat"><span class="auction-stat-value">' + rec.matches + '</span><span class="auction-stat-label">Matches</span></div>' +
              (isBatter ?
                '<div class="auction-stat"><span class="auction-stat-value">' + rec.runs + '</span><span class="auction-stat-label">Runs</span></div>' +
                '<div class="auction-stat"><span class="auction-stat-value">' + fmt(rec.strike_rate, 1) + '</span><span class="auction-stat-label">SR</span></div>' +
                '<div class="auction-stat"><span class="auction-stat-value">' + fmt(rec.average, 1) + '</span><span class="auction-stat-label">Avg</span></div>' +
                '<div class="auction-stat"><span class="auction-stat-value">' + fmt(rec.death_sr, 1) + '</span><span class="auction-stat-label">Death SR</span></div>'
              :
                '<div class="auction-stat"><span class="auction-stat-value">' + rec.wickets + '</span><span class="auction-stat-label">Wkts</span></div>' +
                '<div class="auction-stat"><span class="auction-stat-value">' + fmt(rec.economy, 2) + '</span><span class="auction-stat-label">Econ</span></div>' +
                '<div class="auction-stat"><span class="auction-stat-value">' + fmt(rec.death_economy, 2) + '</span><span class="auction-stat-label">Death Econ</span></div>' +
                '<div class="auction-stat"><span class="auction-stat-value">' + fmt(rec.dot_pct, 1) + '%</span><span class="auction-stat-label">Dot%</span></div>'
              ) +
            '</div>' +
            '<div class="auction-meta">' +
              '<span class="role-tag">' + (rec.role || rec.type) + '</span>' +
              '<span class="confidence-tag">Confidence: ' + (rec.confidence || '—') + '</span>' +
            '</div>' +
            '<div class="auction-reasons">' +
              '<p class="reasons-title">Why target:</p>' +
              '<ul>' + (rec.reasons || []).map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    renderCards(mustTarget, buckets['MUST TARGET']);
    renderCards(highPriority, buckets['HIGH PRIORITY']);
    renderCards(valuePick, buckets['VALUE PICK']);
  }

  /* ══════════════════════════════════════════════════════════════════
     COMPARISON
     ══════════════════════════════════════════════════════════════════ */
  var compareType = 'batting';

  function populateCompareDropdowns(type) {
    var list = type === 'bowling' ? DataStore.getBowlers() : DataStore.getBatters();
    list = list.slice().sort(function (a, b) { return (b.pressure_score || 0) - (a.pressure_score || 0); });
    var sel1 = document.getElementById('compare-player1');
    var sel2 = document.getElementById('compare-player2');
    [sel1, sel2].forEach(function (sel) {
      if (!sel) return;
      sel.innerHTML = '<option value="">Select Player</option>';
      list.slice(0, 100).forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.player_id;
        opt.textContent = p.name + ' (' + (p.team || '') + ')';
        sel.appendChild(opt);
      });
    });
  }

  function initComparison() {
    var batBtn = document.getElementById('compare-batting-btn');
    var bowlBtn = document.getElementById('compare-bowling-btn');
    var compareBtn = document.getElementById('compare-btn');
    var resultDiv = document.getElementById('comparison-result');

    if (batBtn) batBtn.addEventListener('click', function () {
      compareType = 'batting';
      batBtn.classList.add('active');
      if (bowlBtn) bowlBtn.classList.remove('active');
      populateCompareDropdowns('batting');
    });

    if (bowlBtn) bowlBtn.addEventListener('click', function () {
      compareType = 'bowling';
      bowlBtn.classList.add('active');
      if (batBtn) batBtn.classList.remove('active');
      populateCompareDropdowns('bowling');
    });

    if (compareBtn) compareBtn.addEventListener('click', function () {
      var sel1 = document.getElementById('compare-player1');
      var sel2 = document.getElementById('compare-player2');
      if (!sel1 || !sel2 || !sel1.value || !sel2.value || sel1.value === sel2.value) return;

      var list = compareType === 'bowling' ? DataStore.getBowlers() : DataStore.getBatters();
      var p1 = list.find(function (p) { return p.player_id === sel1.value; });
      var p2 = list.find(function (p) { return p.player_id === sel2.value; });
      if (!p1 || !p2) return;

      if (resultDiv) resultDiv.style.display = 'block';

      var comparison = Analytics.comparePlayersData(p1, p2);
      Charts.createRadarChart('chart-comparison-radar', comparison.labels, comparison.datasets);

      // Stats table
      var statsEl = document.getElementById('comparison-stats');
      if (statsEl) {
        var html = '<table class="rankings-table comparison-table"><thead><tr><th>Metric</th><th>' + p1.name + '</th><th>' + p2.name + '</th></tr></thead><tbody>';
        comparison.labels.forEach(function (label, i) {
          var v1 = comparison.raw.player1[i];
          var v2 = comparison.raw.player2[i];
          var cls1 = v1 > v2 ? ' class="text-pink"' : '';
          var cls2 = v2 > v1 ? ' class="text-pink"' : '';
          html += '<tr><td>' + label + '</td><td' + cls1 + '>' + fmt(v1, 1) + '</td><td' + cls2 + '>' + fmt(v2, 1) + '</td></tr>';
        });
        html += '</tbody></table>';
        statsEl.innerHTML = html;
      }
    });

    // Initial populate
    populateCompareDropdowns('batting');
  }

  /* ══════════════════════════════════════════════════════════════════
     RANKINGS TOGGLE
     ══════════════════════════════════════════════════════════════════ */
  function initRankingsToggle() {
    var batBtn = document.getElementById('btn-batter-rankings');
    var bowlBtn = document.getElementById('btn-bowler-rankings');
    var batDiv = document.getElementById('batter-rankings');
    var bowlDiv = document.getElementById('bowler-rankings');

    if (batBtn) batBtn.addEventListener('click', function () {
      batBtn.classList.add('active');
      if (bowlBtn) bowlBtn.classList.remove('active');
      if (batDiv) batDiv.style.display = 'block';
      if (bowlDiv) bowlDiv.style.display = 'none';
    });

    if (bowlBtn) bowlBtn.addEventListener('click', function () {
      bowlBtn.classList.add('active');
      if (batBtn) batBtn.classList.remove('active');
      if (bowlDiv) bowlDiv.style.display = 'block';
      if (batDiv) batDiv.style.display = 'none';
    });

    // Rankings search
    var searchInput = document.getElementById('rankings-search');
    if (searchInput) {
      var debounce = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          var term = searchInput.value.trim();
          if (batterRankCtrl && batterRankCtrl.search) batterRankCtrl.search(term);
          if (bowlerRankCtrl && bowlerRankCtrl.search) bowlerRankCtrl.search(term);
        }, 200);
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SIDEBAR NAV
     ══════════════════════════════════════════════════════════════════ */
  function initNavigation() {
    var navLinks = document.querySelectorAll('.sidebar-nav a[data-section]');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = link.getAttribute('data-section');
        var target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close mobile sidebar
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        // Active state
        navLinks.forEach(function (l) { l.classList.remove('active'); });
        link.classList.add('active');
      });
    });
  }

  function initSidebarToggle() {
    var hamburger = document.getElementById('hamburger');
    var sidebar = document.getElementById('sidebar');
    var closeBtn = document.getElementById('sidebar-close');

    if (hamburger && sidebar) {
      hamburger.addEventListener('click', function () {
        sidebar.classList.toggle('open');
      });
    }
    if (closeBtn && sidebar) {
      closeBtn.addEventListener('click', function () {
        sidebar.classList.remove('open');
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SCROLL SPY — highlight sidebar nav based on scroll position
     ══════════════════════════════════════════════════════════════════ */
  function initScrollSpy() {
    var sections = document.querySelectorAll('.dashboard-section');
    var navLinks = document.querySelectorAll('.sidebar-nav a[data-section]');
    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY + 120;
      sections.forEach(function (section) {
        if (section.offsetTop <= scrollY && (section.offsetTop + section.offsetHeight) > scrollY) {
          navLinks.forEach(function (l) { l.classList.remove('active'); });
          var active = document.querySelector('.sidebar-nav a[data-section="' + section.id + '"]');
          if (active) active.classList.add('active');
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER ALL
     ══════════════════════════════════════════════════════════════════ */
  function renderAll(filters) {
    filters = filters || (window.Filters ? Filters.getActiveFilters() : {});

    var overview = DataStore.getOverview(filters);
    var batters = DataStore.getBatters(filters);
    var bowlers = DataStore.getBowlers(filters);
    var recommendations = DataStore.getRecommendations(filters);

    // 1. KPIs
    renderKPIs(overview);

    // 2. Batting section
    renderBattingSection(batters);

    // 3. Bowling section
    renderBowlingSection(bowlers);

    // 4. Methodology
    renderMethodology();

    // 5. Pressure charts
    renderPressureCharts(batters, bowlers);

    // 6. Full ranking tables
    batterRankCtrl = Rankings.renderBatterTable('batter-rankings', batters);
    bowlerRankCtrl = Rankings.renderBowlerTable('bowler-rankings', bowlers);

    // 7. Recommendations
    renderRecommendations(recommendations);

    // Update comparison dropdowns
    populateCompareDropdowns(compareType);
  }

  /* ══════════════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    var loadingScreen = document.getElementById('loading-screen');
    var dashboardContent = document.getElementById('dashboard-content');

    DataStore.init()
      .then(function () {
        Filters.init();
        Filters.onFilterChange(function (filters) {
          renderAll(filters);
        });

        initNavigation();
        initSidebarToggle();
        initScrollSpy();
        initComparison();
        initRankingsToggle();

        renderAll();

        // Hide loading, show content
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (dashboardContent) dashboardContent.style.display = 'block';

        // Update refresh indicator
        var refreshEl = document.getElementById('last-refresh');
        if (refreshEl) {
          refreshEl.innerHTML = '<span class="refresh-dot"></span> Data loaded — ' + new Date().toLocaleDateString();
        }
      })
      .catch(function (err) {
        console.error('Dashboard init failed:', err);
        if (loadingScreen) {
          loadingScreen.innerHTML = '<div class="loading-error"><h2>⚠ Failed to load data</h2><p>' + err.message + '</p><p>Make sure you ran: <code>python scripts/process_data.py</code></p></div>';
        }
      });
  });

  window.App = { renderAll: renderAll };
})();
