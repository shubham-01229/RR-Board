/**
 * Rankings — sortable HTML tables for batters and bowlers.
 */
(function () {
  'use strict';

  var Rankings = {};

  /* ── helpers ─────────────────────────────────────────────────────── */

  function badgeClass(reliability) {
    switch ((reliability || '').toLowerCase()) {
      case 'elite':     return 'badge-elite';
      case 'high':      return 'badge-high';
      case 'promising': return 'badge-promising';
      default:          return 'badge-promising';
    }
  }

  function arrow(dir) {
    return dir === 'asc' ? ' ▲' : ' ▼';
  }

  function fmt(v, decimals) {
    if (v == null) return '—';
    return typeof v === 'number' ? v.toFixed(decimals || 1) : v;
  }

  /* ── generic table builder ───────────────────────────────────────── */

  function buildTable(containerId, rows, columns, defaultSort, defaultDir) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var sortField = defaultSort;
    var sortDir   = defaultDir || 'desc';
    var searchTerm = '';

    function sortedRows() {
      var filtered = rows;
      if (searchTerm) {
        var lower = searchTerm.toLowerCase();
        filtered = rows.filter(function (r) {
          return (r.name && r.name.toLowerCase().indexOf(lower) !== -1) ||
                 (r.team && r.team.toLowerCase().indexOf(lower) !== -1);
        });
      }
      return filtered.slice().sort(function (a, b) {
        var va = a[sortField], vb = b[sortField];
        if (va == null) va = sortDir === 'desc' ? -Infinity : Infinity;
        if (vb == null) vb = sortDir === 'desc' ? -Infinity : Infinity;
        if (typeof va === 'string') {
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    function render() {
      var sorted = sortedRows();
      var html = '<table class="rankings-table"><thead><tr>';
      html += '<th>#</th>';
      columns.forEach(function (col) {
        var active = sortField === col.field;
        var cls = active ? ' class="sort-active"' : '';
        var arrowStr = active ? arrow(sortDir) : '';
        html += '<th' + cls + ' data-field="' + col.field + '">' + col.label + arrowStr + '</th>';
      });
      html += '</tr></thead><tbody>';

      sorted.forEach(function (row, i) {
        html += '<tr>';
        html += '<td>' + (i + 1) + '</td>';
        columns.forEach(function (col) {
          if (col.field === 'reliability') {
            var badge = badgeClass(row.reliability);
            html += '<td><span class="badge ' + badge + '">' + (row.reliability || '—') + '</span></td>';
          } else if (col.field === 'name') {
            html += '<td class="player-name" data-player-id="' + (row.player_id || '') + '">' + (row.name || '—') + '</td>';
          } else {
            html += '<td>' + fmt(row[col.field], col.dec) + '</td>';
          }
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;

      // Attach header click handlers
      var ths = container.querySelectorAll('th[data-field]');
      ths.forEach(function (th) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', function () {
          var field = th.getAttribute('data-field');
          if (sortField === field) {
            sortDir = sortDir === 'desc' ? 'asc' : 'desc';
          } else {
            sortField = field;
            sortDir = 'desc';
          }
          render();
        });
      });
    }

    render();

    // Return control object for search
    return {
      search: function (term) {
        searchTerm = term || '';
        render();
      },
      refresh: function (newRows) {
        rows = newRows;
        render();
      },
    };
  }

  /* ── batter table ────────────────────────────────────────────────── */

  Rankings.renderBatterTable = function (containerId, batters) {
    var cols = [
      { field: 'name',           label: 'Player'          },
      { field: 'team',           label: 'Team'            },
      { field: 'matches',        label: 'Mat',   dec: 0   },
      { field: 'runs',           label: 'Runs',  dec: 0   },
      { field: 'average',        label: 'Avg',   dec: 2   },
      { field: 'strike_rate',    label: 'SR',    dec: 2   },
      { field: 'pressure_score', label: 'Pressure', dec: 1},
      { field: 'reliability',    label: 'Reliability'     },
    ];
    return buildTable(containerId, batters, cols, 'pressure_score', 'desc');
  };

  /* ── bowler table ────────────────────────────────────────────────── */

  Rankings.renderBowlerTable = function (containerId, bowlers) {
    var cols = [
      { field: 'name',           label: 'Player'          },
      { field: 'team',           label: 'Team'            },
      { field: 'matches',        label: 'Mat',   dec: 0   },
      { field: 'wickets',        label: 'Wkts',  dec: 0   },
      { field: 'economy',        label: 'Econ',  dec: 2   },
      { field: 'pressure_score', label: 'Pressure', dec: 1},
      { field: 'reliability',    label: 'Reliability'     },
    ];
    return buildTable(containerId, bowlers, cols, 'pressure_score', 'desc');
  };

  window.Rankings = Rankings;
})();
