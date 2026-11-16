/**
 * Charts — Chart.js wrappers with Rajasthan Royals branding.
 */
(function () {
  'use strict';

  /* ── brand palette ───────────────────────────────────────────────── */
  var BLUE  = '#254AA5';
  var PINK  = '#E60693';
  var GOLD  = '#CBA92B';
  var WHITE = '#FFFFFF';

  var PALETTE = [BLUE, PINK, GOLD, '#4FC3F7', '#AB47BC', '#26A69A', '#FF7043', '#8D6E63'];
  var PALETTE_ALPHA = PALETTE.map(function (c) { return c + '99'; });

  var Charts = {};

  /** Map of canvasId → Chart instance */
  Charts.instances = {};

  /* ── shared defaults ─────────────────────────────────────────────── */

  var defaultFont = { family: "'Inter', 'Segoe UI', sans-serif", size: 12, weight: '400' };

  function baseOptions(overrides) {
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: WHITE, font: defaultFont, padding: 14 },
        },
        tooltip: {
          backgroundColor: 'rgba(20, 20, 40, 0.92)',
          titleColor: GOLD,
          bodyColor: WHITE,
          borderColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          bodyFont: defaultFont,
          titleFont: Object.assign({}, defaultFont, { weight: '600' }),
        },
      },
      scales: {},
    };

    if (overrides && overrides._noScales) {
      delete opts.scales;
      delete overrides._noScales;
    } else {
      opts.scales.x = {
        ticks: { color: 'rgba(255,255,255,0.7)', font: defaultFont },
        grid:  { color: 'rgba(255,255,255,0.1)' },
      };
      opts.scales.y = {
        ticks: { color: 'rgba(255,255,255,0.7)', font: defaultFont },
        grid:  { color: 'rgba(255,255,255,0.1)' },
      };
    }

    if (overrides) {
      // deep-ish merge
      Object.keys(overrides).forEach(function (k) {
        if (typeof overrides[k] === 'object' && opts[k] && typeof opts[k] === 'object') {
          Object.assign(opts[k], overrides[k]);
        } else {
          opts[k] = overrides[k];
        }
      });
    }

    return opts;
  }

  /* ── lifecycle ───────────────────────────────────────────────────── */

  Charts.destroyChart = function (canvasId) {
    if (Charts.instances[canvasId]) {
      Charts.instances[canvasId].destroy();
      delete Charts.instances[canvasId];
    }
  };

  function getCtx(canvasId) {
    Charts.destroyChart(canvasId);
    var el = document.getElementById(canvasId);
    if (!el) {
      console.warn('Charts: canvas #' + canvasId + ' not found');
      return null;
    }
    return el.getContext('2d');
  }

  /* ── bar chart ───────────────────────────────────────────────────── */

  Charts.createBarChart = function (canvasId, labels, datasets, options) {
    var ctx = getCtx(canvasId);
    if (!ctx) return null;

    // Apply palette colours if not specified
    datasets.forEach(function (ds, i) {
      if (!ds.backgroundColor) ds.backgroundColor = PALETTE_ALPHA[i % PALETTE_ALPHA.length];
      if (!ds.borderColor) ds.borderColor = PALETTE[i % PALETTE.length];
      if (ds.borderWidth == null) ds.borderWidth = 1;
      if (ds.borderRadius == null) ds.borderRadius = 4;
    });

    var chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: baseOptions(options),
    });
    Charts.instances[canvasId] = chart;
    return chart;
  };

  /* ── scatter chart ───────────────────────────────────────────────── */

  Charts.createScatterChart = function (canvasId, data, xLabel, yLabel) {
    var ctx = getCtx(canvasId);
    if (!ctx) return null;

    var chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: yLabel + ' vs ' + xLabel,
          data: data,
          backgroundColor: PINK + 'CC',
          borderColor: PINK,
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 8,
        }],
      },
      options: baseOptions({
        scales: {
          x: { title: { display: true, text: xLabel, color: WHITE, font: defaultFont }, ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { title: { display: true, text: yLabel, color: WHITE, font: defaultFont }, ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx2) {
                var p = ctx2.raw;
                return (p.name || '') + ' — ' + xLabel + ': ' + p.x.toFixed(1) + ', ' + yLabel + ': ' + p.y.toFixed(1);
              },
            },
          },
        },
      }),
    });
    Charts.instances[canvasId] = chart;
    return chart;
  };

  /* ── doughnut chart ──────────────────────────────────────────────── */

  Charts.createDoughnutChart = function (canvasId, labels, data) {
    var ctx = getCtx(canvasId);
    if (!ctx) return null;

    var colors = labels.map(function (_, i) { return PALETTE[i % PALETTE.length]; });

    var chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.map(function (c) { return c + 'CC'; }),
          borderColor: colors,
          borderWidth: 2,
        }],
      },
      options: baseOptions({ _noScales: true }),
    });
    Charts.instances[canvasId] = chart;
    return chart;
  };

  /* ── radar chart ─────────────────────────────────────────────────── */

  var NEON_COLORS = [
    { border: '#00F0FF', bg: 'rgba(0, 240, 255, 0.25)', point: '#00F0FF', shadow: 'rgba(0, 240, 255, 0.6)' },   // Neon Cyan
    { border: '#FF2D95', bg: 'rgba(255, 45, 149, 0.25)', point: '#FF2D95', shadow: 'rgba(255, 45, 149, 0.6)' },  // Neon Pink
    { border: '#FFD700', bg: 'rgba(255, 215, 0, 0.20)', point: '#FFD700', shadow: 'rgba(255, 215, 0, 0.5)' },    // Neon Gold
  ];

  Charts.createRadarChart = function (canvasId, labels, datasets) {
    var ctx = getCtx(canvasId);
    if (!ctx) return null;

    datasets.forEach(function (ds, i) {
      var nc = NEON_COLORS[i % NEON_COLORS.length];
      ds.backgroundColor = nc.bg;
      ds.borderColor = nc.border;
      ds.borderWidth = 3;
      ds.pointBackgroundColor = nc.point;
      ds.pointBorderColor = '#FFFFFF';
      ds.pointBorderWidth = 2;
      ds.pointRadius = 6;
      ds.pointHoverRadius = 9;
      ds.pointHoverBackgroundColor = '#FFFFFF';
      ds.pointHoverBorderColor = nc.border;
      ds.pointHoverBorderWidth = 3;
      ds.fill = true;
      ds.tension = 0.1;
    });

    var chart = new Chart(ctx, {
      type: 'radar',
      data: { labels: labels, datasets: datasets },
      options: baseOptions({
        _noScales: true,
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.12)', lineWidth: 1 },
            grid: { color: 'rgba(255, 255, 255, 0.08)', lineWidth: 1 },
            pointLabels: {
              color: '#FFFFFF',
              font: { family: "'Inter', 'Segoe UI', sans-serif", size: 13, weight: '700' },
              padding: 18,
            },
            ticks: { display: false, stepSize: 20 },
            suggestedMin: 0,
            suggestedMax: 100,
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          },
        },
        plugins: {
          legend: {
            labels: {
              color: '#FFFFFF',
              font: { family: "'Inter', 'Segoe UI', sans-serif", size: 13, weight: '700' },
              padding: 20,
              usePointStyle: true,
              pointStyleWidth: 14,
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: 'rgba(7, 21, 46, 0.95)',
            titleColor: '#FFD700',
            bodyColor: '#FFFFFF',
            borderColor: 'rgba(0, 240, 255, 0.4)',
            borderWidth: 1,
            cornerRadius: 10,
            padding: 14,
            titleFont: { size: 14, weight: '700' },
            bodyFont: { size: 13 },
          },
        },
        elements: {
          line: { borderJoinStyle: 'round' },
        },
      }),
    });
    Charts.instances[canvasId] = chart;
    return chart;
  };

  /* ── line chart ──────────────────────────────────────────────────── */

  Charts.createLineChart = function (canvasId, labels, datasets) {
    var ctx = getCtx(canvasId);
    if (!ctx) return null;

    datasets.forEach(function (ds, i) {
      var c = PALETTE[i % PALETTE.length];
      if (!ds.borderColor) ds.borderColor = c;
      if (!ds.backgroundColor) ds.backgroundColor = c + '33';
      if (ds.borderWidth == null) ds.borderWidth = 2;
      if (ds.tension == null) ds.tension = 0.3;
      if (ds.fill == null) ds.fill = true;
      if (ds.pointRadius == null) ds.pointRadius = 3;
      if (!ds.pointBackgroundColor) ds.pointBackgroundColor = c;
    });

    var chart = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: baseOptions(),
    });
    Charts.instances[canvasId] = chart;
    return chart;
  };

  window.Charts = Charts;
})();
