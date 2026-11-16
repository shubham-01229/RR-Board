/**
 * Analytics — derived data helpers for charts and tables.
 */
(function () {
  'use strict';

  var Analytics = {};

  /* ── sorting helpers ─────────────────────────────────────────────── */

  function sortDesc(arr, field) {
    return arr.slice().sort(function (a, b) {
      return (b[field] || 0) - (a[field] || 0);
    });
  }

  /* ── top-N ───────────────────────────────────────────────────────── */

  Analytics.getTopBatters = function (data, count, sortBy) {
    count = count || 10;
    sortBy = sortBy || 'pressure_score';
    return sortDesc(data, sortBy).slice(0, count);
  };

  Analytics.getTopBowlers = function (data, count, sortBy) {
    count = count || 10;
    sortBy = sortBy || 'pressure_score';
    // For economy, lower is better, so invert if needed
    if (sortBy === 'economy') {
      return data.slice().sort(function (a, b) {
        return (a[sortBy] || 999) - (b[sortBy] || 999);
      }).slice(0, count);
    }
    return sortDesc(data, sortBy).slice(0, count);
  };

  /* ── phase aggregation ───────────────────────────────────────────── */

  Analytics.getBattingPhaseData = function (batters) {
    var phases = ['powerplay', 'middle', 'death'];
    var labels = batters.map(function (b) { return b.name; });
    var datasets = phases.map(function (phase) {
      return {
        label: phase.charAt(0).toUpperCase() + phase.slice(1),
        data: batters.map(function (b) {
          return (b.phase_runs && b.phase_runs[phase]) || 0;
        }),
      };
    });
    return { labels: labels, datasets: datasets };
  };

  Analytics.getBowlingPhaseData = function (bowlers) {
    var phases = ['powerplay', 'middle', 'death'];
    var labels = bowlers.map(function (b) { return b.name; });
    var datasets = phases.map(function (phase) {
      return {
        label: phase.charAt(0).toUpperCase() + phase.slice(1),
        data: bowlers.map(function (b) {
          return (b.phase_wickets && b.phase_wickets[phase]) || 0;
        }),
      };
    });
    return { labels: labels, datasets: datasets };
  };

  /* ── pressure distribution histogram ─────────────────────────────── */

  Analytics.getPressureDistribution = function (data) {
    var buckets = [
      { label: '0–20',  min: 0,  max: 20  },
      { label: '20–40', min: 20, max: 40  },
      { label: '40–60', min: 40, max: 60  },
      { label: '60–70', min: 60, max: 70  },
      { label: '70–80', min: 70, max: 80  },
      { label: '80–90', min: 80, max: 90  },
      { label: '90–100',min: 90, max: 101 },
    ];

    var counts = buckets.map(function () { return 0; });

    data.forEach(function (p) {
      var s = p.pressure_score || 0;
      for (var i = 0; i < buckets.length; i++) {
        if (s >= buckets[i].min && s < buckets[i].max) {
          counts[i]++;
          break;
        }
      }
    });

    return {
      labels: buckets.map(function (b) { return b.label; }),
      data: counts,
    };
  };

  /* ── scatter data ────────────────────────────────────────────────── */

  Analytics.getScatterData = function (data, xField, yField) {
    return data
      .filter(function (p) {
        return p[xField] != null && p[yField] != null;
      })
      .map(function (p) {
        return {
          x: p[xField],
          y: p[yField],
          name: p.name,
          team: p.team,
          player_id: p.player_id,
        };
      });
  };

  /* ── player comparison radar ─────────────────────────────────────── */

  Analytics.comparePlayersData = function (player1, player2) {
    // Detect if batter or bowler by checking for 'runs' key
    var isBatter = player1.runs != null;

    var labels, d1, d2;

    if (isBatter) {
      labels = ['Pressure Score', 'Strike Rate', 'Average', 'Death SR', 'Chase SR', 'Boundary %'];
      d1 = [
        player1.pressure_score || 0,
        player1.strike_rate || 0,
        player1.average || 0,
        player1.death_sr || 0,
        player1.chase_sr || 0,
        player1.boundary_pct || 0,
      ];
      d2 = [
        player2.pressure_score || 0,
        player2.strike_rate || 0,
        player2.average || 0,
        player2.death_sr || 0,
        player2.chase_sr || 0,
        player2.boundary_pct || 0,
      ];
    } else {
      labels = ['Pressure Score', 'Wickets', 'Dot %', 'Death Wkts', 'Win %', 'P. Dot %'];
      d1 = [
        player1.pressure_score || 0,
        player1.wickets || 0,
        player1.dot_pct || 0,
        player1.death_wickets || 0,
        player1.win_pct || 0,
        player1.pressure_dot_pct || 0,
      ];
      d2 = [
        player2.pressure_score || 0,
        player2.wickets || 0,
        player2.dot_pct || 0,
        player2.death_wickets || 0,
        player2.win_pct || 0,
        player2.pressure_dot_pct || 0,
      ];
    }

    // Normalise each axis to 0-100 for radar readability
    var maxPerAxis = labels.map(function (_, i) {
      return Math.max(d1[i], d2[i], 1);
    });
    var norm1 = d1.map(function (v, i) { return (v / maxPerAxis[i]) * 100; });
    var norm2 = d2.map(function (v, i) { return (v / maxPerAxis[i]) * 100; });

    return {
      labels: labels,
      raw: { player1: d1, player2: d2 },
      datasets: [
        { label: player1.name, data: norm1 },
        { label: player2.name, data: norm2 },
      ],
    };
  };

  window.Analytics = Analytics;
})();
