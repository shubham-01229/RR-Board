/**
 * DataStore — loads and serves all processed JSON data with filtering support.
 */
(function () {
  'use strict';

  const BASE = 'src/data/processed/';

  const store = {
    overview: null,
    batting: null,
    bowling: null,
    recommendations: null,
    methodology: null,
    competitions: null,
    _ready: false,
  };

  /* ── helpers ─────────────────────────────────────────────────────── */

  function fetchJSON(file) {
    return fetch(BASE + file).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + file + ': ' + r.status);
      return r.json();
    });
  }

  function matchesSearch(player, term) {
    if (!term) return true;
    var lower = term.toLowerCase();
    return (
      (player.name && player.name.toLowerCase().indexOf(lower) !== -1) ||
      (player.team && player.team.toLowerCase().indexOf(lower) !== -1)
    );
  }

  function matchesSeason(player, season) {
    if (!season) return true;
    return Array.isArray(player.seasons) && player.seasons.indexOf(season) !== -1;
  }

  function matchesCompetition(player, comp) {
    if (!comp) return true;
    return Array.isArray(player.competitions) && player.competitions.indexOf(comp) !== -1;
  }

  function applyPlayerFilters(list, filters) {
    if (!filters) return list.slice();
    return list.filter(function (p) {
      return (
        matchesSeason(p, filters.season) &&
        matchesCompetition(p, filters.competition) &&
        matchesSearch(p, filters.search)
      );
    });
  }

  /* ── public API ──────────────────────────────────────────────────── */

  var DataStore = {};

  /**
   * Load every JSON file. Returns a Promise that resolves when all are ready.
   */
  DataStore.init = function () {
    return Promise.all([
      fetchJSON('overview.json'),
      fetchJSON('batting.json'),
      fetchJSON('bowling.json'),
      fetchJSON('recommendations.json'),
      fetchJSON('methodology.json'),
      fetchJSON('competitions.json'),
    ]).then(function (results) {
      store.overview = results[0];
      store.batting = results[1];
      store.bowling = results[2];
      store.recommendations = results[3];
      store.methodology = results[4];
      store.competitions = results[5];
      store._ready = true;
      return store;
    });
  };

  /**
   * Return filtered batting array.
   */
  DataStore.getBatters = function (filters) {
    return applyPlayerFilters(store.batting || [], filters);
  };

  /**
   * Return filtered bowling array.
   */
  DataStore.getBowlers = function (filters) {
    return applyPlayerFilters(store.bowling || [], filters);
  };

  /**
   * Return overview KPIs, optionally recalculated for the filtered data set.
   */
  DataStore.getOverview = function (filters) {
    var o = store.overview;
    if (!o) return {};

    if (!filters || (!filters.season && !filters.competition && !filters.search)) {
      return Object.assign({}, o);
    }

    // Recalculate from filtered sets
    var batters = DataStore.getBatters(filters);
    var bowlers = DataStore.getBowlers(filters);

    // Unique player IDs
    var playerIds = {};
    batters.forEach(function (b) { playerIds[b.player_id] = true; });
    bowlers.forEach(function (b) { playerIds[b.player_id] = true; });

    var totalRuns = batters.reduce(function (s, b) { return s + (b.runs || 0); }, 0);
    var totalWickets = bowlers.reduce(function (s, b) { return s + (b.wickets || 0); }, 0);
    var totalMatches = 0;
    var matchSet = {};
    batters.forEach(function (b) {
      if (!matchSet[b.player_id]) { totalMatches += (b.matches || 0); matchSet[b.player_id] = true; }
    });
    bowlers.forEach(function (b) {
      if (!matchSet[b.player_id]) { totalMatches += (b.matches || 0); matchSet[b.player_id] = true; }
    });

    var highPressure = batters.filter(function (b) { return b.pressure_score >= 70; }).length +
                       bowlers.filter(function (b) { return b.pressure_score >= 70; }).length;

    return {
      total_matches: totalMatches,
      total_deliveries: o.total_deliveries, // can't recalculate per-filter
      total_players: Object.keys(playerIds).length,
      total_runs: totalRuns,
      total_wickets: totalWickets,
      high_pressure_performances: highPressure,
      seasons: o.seasons,
      competitions: o.competitions,
    };
  };

  /**
   * Return filtered recommendations.
   */
  DataStore.getRecommendations = function (filters) {
    if (!store.recommendations) return [];
    if (!filters || (!filters.season && !filters.competition && !filters.search)) {
      return store.recommendations.slice();
    }
    return store.recommendations.filter(function (r) {
      return (
        matchesSeason(r, filters.season) &&
        matchesCompetition(r, filters.competition) &&
        matchesSearch(r, filters.search)
      );
    });
  };

  /**
   * Return methodology data.
   */
  DataStore.getMethodology = function () {
    return store.methodology;
  };

  /**
   * Return raw competitions list.
   */
  DataStore.getCompetitions = function () {
    return store.competitions || [];
  };

  /**
   * Return seasons list from overview.
   */
  DataStore.getSeasons = function () {
    return (store.overview && store.overview.seasons) || [];
  };

  window.DataStore = DataStore;
})();
