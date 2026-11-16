/**
 * Filters — populate dropdowns, read current values, attach change listeners.
 */
(function () {
  'use strict';

  var Filters = {};

  var _changeCallback = null;

  /* ── selectors ───────────────────────────────────────────────────── */

  function el(id) { return document.getElementById(id); }

  var IDS = {
    season: 'season-filter',
    competition: 'competition-filter',
    search: 'player-search',
    reset: 'reset-filters',
  };

  /* ── init: populate dropdowns from DataStore ─────────────────────── */

  Filters.init = function () {
    var seasonEl = el(IDS.season);
    var compEl   = el(IDS.competition);

    // Populate seasons
    if (seasonEl) {
      seasonEl.innerHTML = '<option value="">All Seasons</option>';
      var seasons = window.DataStore.getSeasons();
      seasons.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        seasonEl.appendChild(opt);
      });
    }

    // Populate competitions
    if (compEl) {
      compEl.innerHTML = '<option value="">All Competitions</option>';
      var comps = window.DataStore.getCompetitions();
      comps.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        compEl.appendChild(opt);
      });
    }

    // Wire up reset
    var resetBtn = el(IDS.reset);
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        Filters.resetFilters();
        if (_changeCallback) _changeCallback(Filters.getActiveFilters());
      });
    }

    // Wire up filter change events
    [IDS.season, IDS.competition].forEach(function (id) {
      var e = el(id);
      if (e) {
        e.addEventListener('change', function () {
          if (_changeCallback) _changeCallback(Filters.getActiveFilters());
        });
      }
    });

    var searchInput = el(IDS.search);
    if (searchInput) {
      var debounce = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          if (_changeCallback) _changeCallback(Filters.getActiveFilters());
        }, 300);
      });
    }
  };

  /* ── read current filter values ──────────────────────────────────── */

  Filters.getActiveFilters = function () {
    var seasonEl  = el(IDS.season);
    var compEl    = el(IDS.competition);
    var searchEl  = el(IDS.search);

    return {
      season:      seasonEl  ? (seasonEl.value  || null) : null,
      competition: compEl    ? (compEl.value     || null) : null,
      search:      searchEl  ? (searchEl.value.trim() || null) : null,
    };
  };

  /* ── attach external callback ────────────────────────────────────── */

  Filters.onFilterChange = function (callback) {
    _changeCallback = callback;
  };

  /* ── reset ───────────────────────────────────────────────────────── */

  Filters.resetFilters = function () {
    var seasonEl = el(IDS.season);
    var compEl   = el(IDS.competition);
    var searchEl = el(IDS.search);

    if (seasonEl)  seasonEl.value  = '';
    if (compEl)    compEl.value    = '';
    if (searchEl)  searchEl.value  = '';
  };

  window.Filters = Filters;
})();
