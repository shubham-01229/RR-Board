#!/usr/bin/env python3
"""
ROYAL PRESSURE - Data Processing Pipeline
Processes raw cricket CSV data into optimized JSON for the dashboard.
All statistics are calculated from actual data - nothing is fabricated.
"""

import csv
import json
import os
import sys
from collections import defaultdict
from math import sqrt

# Paths
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data_raw', 'Data Pack')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'processed')

os.makedirs(OUTPUT_DIR, exist_ok=True)

def read_csv(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'r', encoding='utf-8') as f:
        return list(csv.DictReader(f))

print("Loading data...")
ball_by_ball = read_csv('ball_by_ball.csv')
matches = read_csv('matches.csv')
competitions = read_csv('competitions.csv')
teams_data = read_csv('teams.csv')
playing_eleven = read_csv('playing_eleven.csv')
player_mapping = read_csv('competition_team_player_mapping.csv')

print(f"  Balls: {len(ball_by_ball)}")
print(f"  Matches: {len(matches)}")
print(f"  Competitions: {len(competitions)}")

# Build lookup maps
comp_map = {c['comp_id']: c for c in competitions}
match_map = {m['match_id']: m for m in matches}

# Build player name lookup from player_mapping
player_names = {}
player_teams = {}
for pm in player_mapping:
    player_names[pm['player_id']] = pm['player_name']
    player_teams[pm['player_id']] = pm['team_name']

# Also get names from ball_by_ball
for b in ball_by_ball:
    if b['striker_id'] and b['striker_name']:
        player_names[b['striker_id']] = b['striker_name']
    if b['bowler_id'] and b['bowler_name']:
        player_names[b['bowler_id']] = b['bowler_name']

# Build season/competition info per match
match_comp = {}
match_season = {}
match_format = {}
for m in matches:
    cid = m['comp_id']
    match_comp[m['match_id']] = comp_map.get(cid, {}).get('comp_name', 'Unknown')
    match_season[m['match_id']] = comp_map.get(cid, {}).get('season', 'Unknown')
    match_format[m['match_id']] = comp_map.get(cid, {}).get('match_format', 'T20')

# Determine IPL comp_ids
ipl_comp_ids = set()
for c in competitions:
    if 'IPL' in c['comp_name'].upper():
        ipl_comp_ids.add(c['comp_id'])

# Determine match innings totals for chase analysis
print("Computing match context...")
innings_totals = defaultdict(lambda: defaultdict(int))  # match_id -> innings -> runs
innings_wickets = defaultdict(lambda: defaultdict(int))
innings_balls = defaultdict(lambda: defaultdict(int))

for b in ball_by_ball:
    mid = b['match_id']
    inn = int(b['innings'])
    runs = int(b['runs']) + int(b.get('extras1_runs', 0) or 0) + int(b.get('extras_2_runs', 0) or 0)
    innings_totals[mid][inn] += runs
    innings_balls[mid][inn] += 1
    if b['is_wicket'] == 'true':
        innings_wickets[mid][inn] += 1

# Determine close matches (margin ≤ 15 runs or ≤ 2 wickets from result text)
close_match_ids = set()
for m in matches:
    result = m.get('result', '')
    r_lower = result.lower()
    if 'won by' in r_lower:
        # Extract margin
        try:
            parts = r_lower.split('won by')[1].strip()
            if 'run' in parts:
                margin = int(parts.split()[0])
                if margin <= 15:
                    close_match_ids.add(m['match_id'])
            elif 'wicket' in parts:
                margin = int(parts.split()[0])
                if margin <= 2:
                    close_match_ids.add(m['match_id'])
        except:
            pass
    elif 'tie' in r_lower or 'super over' in r_lower:
        close_match_ids.add(m['match_id'])

print(f"  Close matches: {len(close_match_ids)}")

# Classify overs into phases
def get_phase(over_id):
    o = int(over_id)
    if o <= 6:
        return 'powerplay'
    elif o <= 15:
        return 'middle'
    else:
        return 'death'

# ============================================================
# BATTING ANALYTICS
# ============================================================
print("Computing batting analytics...")

batter_stats = defaultdict(lambda: {
    'name': '', 'player_id': '', 'team': '', 'matches': set(),
    'runs': 0, 'balls': 0, 'fours': 0, 'sixes': 0,
    'dismissals': 0, 'innings': set(),
    'phase_runs': defaultdict(int), 'phase_balls': defaultdict(int),
    'death_runs': 0, 'death_balls': 0, 'death_fours': 0, 'death_sixes': 0,
    'chase_runs': 0, 'chase_balls': 0, 'chase_innings': set(),
    'close_match_runs': 0, 'close_match_balls': 0, 'close_match_innings': set(),
    'pressure_runs': 0, 'pressure_balls': 0, 'pressure_dismissals': 0,
    'competitions': set(), 'seasons': set(),
    'win_contrib_matches': set(),  # matches where batter scored and team won
    'batting_team_ids': set(),
})

# Get winning teams per match
match_winners = {}
for m in matches:
    match_winners[m['match_id']] = m.get('win_team_id', '')

for b in ball_by_ball:
    sid = b['striker_id']
    mid = b['match_id']
    inn = int(b['innings'])
    over = int(b['overid'])
    runs = int(b['runs'])
    phase = get_phase(over)

    if not sid:
        continue

    s = batter_stats[sid]
    s['name'] = b['striker_name']
    s['player_id'] = sid
    s['matches'].add(mid)
    s['innings'].add(f"{mid}_{inn}")
    s['runs'] += runs
    s['balls'] += 1
    s['phase_runs'][phase] += runs
    s['phase_balls'][phase] += 1

    if b['is_four'] == 'true':
        s['fours'] += 1
    if b['is_six'] == 'true':
        s['sixes'] += 1

    # Dismissal
    if b['is_wicket'] == 'true' and str(b.get('dismissed_player_id', '')) == str(sid):
        s['dismissals'] += 1

    # Death over batting
    if phase == 'death':
        s['death_runs'] += runs
        s['death_balls'] += 1
        if b['is_four'] == 'true':
            s['death_fours'] += 1
        if b['is_six'] == 'true':
            s['death_sixes'] += 1

    # Chase performance (2nd innings)
    if inn == 2:
        s['chase_runs'] += runs
        s['chase_balls'] += 1
        s['chase_innings'].add(mid)

    # Close match performance
    if mid in close_match_ids:
        s['close_match_runs'] += runs
        s['close_match_balls'] += 1
        s['close_match_innings'].add(mid)

    # Pressure situations: death overs OR close matches OR chasing in 2nd innings last 5 overs
    is_pressure = (phase == 'death') or (mid in close_match_ids) or (inn == 2 and over >= 16)
    if is_pressure:
        s['pressure_runs'] += runs
        s['pressure_balls'] += 1
        if b['is_wicket'] == 'true' and str(b.get('dismissed_player_id', '')) == str(sid):
            s['pressure_dismissals'] += 1

    # Track team and competitions
    s['batting_team_ids'].add(b['batting_team_id'])
    comp_id = match_map.get(mid, {}).get('comp_id', '')
    if comp_id:
        s['competitions'].add(comp_id)
        season = comp_map.get(comp_id, {}).get('season', '')
        if season:
            s['seasons'].add(season)

    # Win contribution
    winner = match_winners.get(mid, '')
    if winner == b['batting_team_id']:
        s['win_contrib_matches'].add(mid)

# Now compute final batting metrics
batting_results = []
for pid, s in batter_stats.items():
    if s['balls'] < 30:  # minimum threshold
        continue

    num_matches = len(s['matches'])
    num_innings = len(s['innings'])
    avg = s['runs'] / s['dismissals'] if s['dismissals'] > 0 else s['runs']
    sr = (s['runs'] / s['balls']) * 100 if s['balls'] > 0 else 0
    boundary_pct = ((s['fours'] + s['sixes']) * 100) / s['balls'] if s['balls'] > 0 else 0

    death_sr = (s['death_runs'] / s['death_balls']) * 100 if s['death_balls'] > 0 else 0
    chase_sr = (s['chase_runs'] / s['chase_balls']) * 100 if s['chase_balls'] > 0 else 0

    pressure_sr = (s['pressure_runs'] / s['pressure_balls']) * 100 if s['pressure_balls'] > 0 else 0
    pressure_avg = s['pressure_runs'] / s['pressure_dismissals'] if s['pressure_dismissals'] > 0 else s['pressure_runs']

    close_match_sr = (s['close_match_runs'] / s['close_match_balls']) * 100 if s['close_match_balls'] > 0 else 0

    win_pct = len(s['win_contrib_matches']) / num_matches * 100 if num_matches > 0 else 0

    # ====== PRESSURE SCORE (0-100) ======
    # Methodology:
    # 1. Death Over SR (0-25): Higher SR in death overs = better under pressure
    # 2. Chase Performance (0-20): SR and contribution when chasing
    # 3. Close Match Impact (0-20): Runs in close matches
    # 4. Consistency (0-15): Batting average under pressure
    # 5. Win Contribution (0-10): % of matches won when playing
    # 6. Sample Size Bonus (0-10): More matches = more reliable

    # Death over component (max 25)
    death_component = min(25, (death_sr / 200) * 25) if s['death_balls'] >= 10 else min(15, (death_sr / 200) * 15)

    # Chase component (max 20)
    chase_component = min(20, (chase_sr / 180) * 20) if s['chase_balls'] >= 10 else min(10, (chase_sr / 180) * 10)

    # Close match component (max 20)
    close_runs_per_inn = s['close_match_runs'] / len(s['close_match_innings']) if len(s['close_match_innings']) > 0 else 0
    close_component = min(20, (close_runs_per_inn / 40) * 15 + (close_match_sr / 180) * 5) if s['close_match_balls'] >= 5 else 0

    # Consistency (max 15)
    consistency_component = min(15, (pressure_avg / 50) * 15) if s['pressure_balls'] >= 10 else min(8, (pressure_avg / 50) * 8)

    # Win contribution (max 10)
    win_component = min(10, (win_pct / 100) * 10)

    # Sample size bonus (max 10)
    sample_component = min(10, (num_matches / 50) * 10)

    pressure_score = round(death_component + chase_component + close_component + consistency_component + win_component + sample_component, 1)
    pressure_score = min(100, max(0, pressure_score))

    # Get team name
    team_name = player_teams.get(pid, '')
    if not team_name:
        # Try from teams_data using batting_team_ids
        for tid in s['batting_team_ids']:
            for td in teams_data:
                if td['team_id'] == tid:
                    team_name = td['team_name']
                    break
            if team_name:
                break

    # Reliability rating
    if pressure_score >= 70 and num_matches >= 20:
        reliability = 'Elite'
    elif pressure_score >= 50 and num_matches >= 15:
        reliability = 'High'
    elif pressure_score >= 35:
        reliability = 'Promising'
    else:
        reliability = 'Developing'

    batting_results.append({
        'player_id': pid,
        'name': s['name'],
        'team': team_name,
        'matches': num_matches,
        'innings': num_innings,
        'runs': s['runs'],
        'balls': s['balls'],
        'average': round(avg, 2),
        'strike_rate': round(sr, 2),
        'fours': s['fours'],
        'sixes': s['sixes'],
        'boundary_pct': round(boundary_pct, 2),
        'death_runs': s['death_runs'],
        'death_balls': s['death_balls'],
        'death_sr': round(death_sr, 2),
        'chase_runs': s['chase_runs'],
        'chase_balls': s['chase_balls'],
        'chase_sr': round(chase_sr, 2),
        'close_match_runs': s['close_match_runs'],
        'close_match_sr': round(close_match_sr, 2),
        'pressure_runs': s['pressure_runs'],
        'pressure_balls': s['pressure_balls'],
        'pressure_sr': round(pressure_sr, 2),
        'pressure_avg': round(pressure_avg, 2),
        'pressure_score': pressure_score,
        'win_pct': round(win_pct, 2),
        'reliability': reliability,
        'phase_runs': dict(s['phase_runs']),
        'phase_balls': dict(s['phase_balls']),
        'seasons': sorted(list(s['seasons'])),
        'competitions': list(s['competitions']),
    })

batting_results.sort(key=lambda x: x['pressure_score'], reverse=True)

# ============================================================
# BOWLING ANALYTICS
# ============================================================
print("Computing bowling analytics...")

bowler_stats = defaultdict(lambda: {
    'name': '', 'player_id': '', 'team': '', 'matches': set(),
    'balls': 0, 'runs_conceded': 0, 'wickets': 0, 'dots': 0,
    'fours_conceded': 0, 'sixes_conceded': 0,
    'phase_wickets': defaultdict(int), 'phase_balls': defaultdict(int),
    'phase_runs': defaultdict(int),
    'death_wickets': 0, 'death_balls': 0, 'death_runs': 0,
    'powerplay_wickets': 0, 'powerplay_balls': 0, 'powerplay_runs': 0,
    'close_match_wickets': 0, 'close_match_balls': 0, 'close_match_runs': 0,
    'close_match_matches': set(),
    'pressure_wickets': 0, 'pressure_balls': 0, 'pressure_runs': 0,
    'pressure_dots': 0,
    'bowling_team_ids': set(),
    'competitions': set(), 'seasons': set(),
    'win_contrib_matches': set(),
    'bowling_type': '',
    'pace_or_spin': '',
    'innings_set': set(),
})

for b in ball_by_ball:
    bid = b['bowler_id']
    mid = b['match_id']
    inn = int(b['innings'])
    over = int(b['overid'])
    phase = get_phase(over)
    runs = int(b['runs']) + int(b.get('extras1_runs', 0) or 0) + int(b.get('extras_2_runs', 0) or 0)
    batter_runs = int(b['runs'])

    if not bid:
        continue

    s = bowler_stats[bid]
    s['name'] = b['bowler_name']
    s['player_id'] = bid
    s['matches'].add(mid)
    s['innings_set'].add(f"{mid}_{inn}")
    s['balls'] += 1
    s['runs_conceded'] += runs
    s['bowling_type'] = b.get('bowling_type', '')
    s['pace_or_spin'] = b.get('pace_or_spin', '')

    if batter_runs == 0 and b.get('extras_type', '') == 'None':
        s['dots'] += 1

    if b['is_four'] == 'true':
        s['fours_conceded'] += 1
    if b['is_six'] == 'true':
        s['sixes_conceded'] += 1

    if b['is_wicket'] == 'true':
        dtype = b.get('dismissal_type', '').lower()
        if dtype not in ['run out', 'retired hurt', 'retired out', 'obstructing the field']:
            s['wickets'] += 1

    s['phase_wickets'][phase] += (1 if b['is_wicket'] == 'true' else 0)
    s['phase_balls'][phase] += 1
    s['phase_runs'][phase] += runs

    # Death overs
    if phase == 'death':
        s['death_balls'] += 1
        s['death_runs'] += runs
        if b['is_wicket'] == 'true':
            dtype = b.get('dismissal_type', '').lower()
            if dtype not in ['run out', 'retired hurt', 'retired out']:
                s['death_wickets'] += 1

    # Powerplay
    if phase == 'powerplay':
        s['powerplay_balls'] += 1
        s['powerplay_runs'] += runs
        if b['is_wicket'] == 'true':
            dtype = b.get('dismissal_type', '').lower()
            if dtype not in ['run out', 'retired hurt', 'retired out']:
                s['powerplay_wickets'] += 1

    # Close match
    if mid in close_match_ids:
        s['close_match_balls'] += 1
        s['close_match_runs'] += runs
        s['close_match_matches'].add(mid)
        if b['is_wicket'] == 'true':
            s['close_match_wickets'] += 1

    # Pressure: death overs, close matches, defending in 2nd innings death
    is_pressure = (phase == 'death') or (mid in close_match_ids) or (inn == 2 and over >= 16)
    if is_pressure:
        s['pressure_balls'] += 1
        s['pressure_runs'] += runs
        if b['is_wicket'] == 'true':
            s['pressure_wickets'] += 1
        if batter_runs == 0 and b.get('extras_type', '') == 'None':
            s['pressure_dots'] += 1

    s['bowling_team_ids'].add(b['bowling_team_id'])
    comp_id = match_map.get(mid, {}).get('comp_id', '')
    if comp_id:
        s['competitions'].add(comp_id)
        season = comp_map.get(comp_id, {}).get('season', '')
        if season:
            s['seasons'].add(season)

    winner = match_winners.get(mid, '')
    if winner == b['bowling_team_id']:
        s['win_contrib_matches'].add(mid)

bowling_results = []
for pid, s in bowler_stats.items():
    if s['balls'] < 30:
        continue

    num_matches = len(s['matches'])
    overs = s['balls'] / 6
    economy = s['runs_conceded'] / overs if overs > 0 else 0
    avg = s['runs_conceded'] / s['wickets'] if s['wickets'] > 0 else 999
    sr = s['balls'] / s['wickets'] if s['wickets'] > 0 else 999
    dot_pct = (s['dots'] / s['balls']) * 100 if s['balls'] > 0 else 0

    death_econ = (s['death_runs'] / (s['death_balls'] / 6)) if s['death_balls'] >= 6 else 0
    pp_econ = (s['powerplay_runs'] / (s['powerplay_balls'] / 6)) if s['powerplay_balls'] >= 6 else 0

    pressure_econ = (s['pressure_runs'] / (s['pressure_balls'] / 6)) if s['pressure_balls'] >= 6 else 0
    pressure_dot_pct = (s['pressure_dots'] / s['pressure_balls']) * 100 if s['pressure_balls'] > 0 else 0

    win_pct = len(s['win_contrib_matches']) / num_matches * 100 if num_matches > 0 else 0

    # ====== BOWLING PRESSURE SCORE (0-100) ======
    # 1. Death Over Economy (0-25): Lower economy in death = better
    # 2. Death Over Wickets (0-20): More wickets at death = more impactful
    # 3. Close Match Economy (0-15): Economy in close matches
    # 4. Pressure Dot Ball % (0-15): Dots under pressure
    # 5. Win Contribution (0-10): Team win % when bowling
    # 6. Sample Size (0-10): More data = more reliable
    # 7. Overall Economy Bonus (0-5): General efficiency

    # Death economy (max 25) - lower is better, baseline ~10
    if s['death_balls'] >= 12:
        death_econ_score = max(0, min(25, (1 - (death_econ - 6) / 10) * 25))
    else:
        death_econ_score = max(0, min(12, (1 - (death_econ - 6) / 10) * 12)) if s['death_balls'] >= 6 else 0

    # Death wickets (max 20)
    death_wick_rate = s['death_wickets'] / (s['death_balls'] / 6) if s['death_balls'] >= 6 else 0
    death_wick_score = min(20, death_wick_rate * 15) if s['death_balls'] >= 6 else 0

    # Close match economy (max 15)
    if s['close_match_balls'] >= 12:
        close_econ = s['close_match_runs'] / (s['close_match_balls'] / 6)
        close_econ_score = max(0, min(15, (1 - (close_econ - 6) / 10) * 15))
    else:
        close_econ_score = 0

    # Pressure dots (max 15)
    pressure_dot_score = min(15, (pressure_dot_pct / 50) * 15) if s['pressure_balls'] >= 12 else min(8, (pressure_dot_pct / 50) * 8)

    # Win contribution (max 10)
    win_score = min(10, (win_pct / 100) * 10)

    # Sample size (max 10)
    sample_score = min(10, (num_matches / 50) * 10)

    # Economy bonus (max 5) - overall economy below 8 gets bonus
    econ_bonus = max(0, min(5, (1 - (economy - 6) / 6) * 5))

    pressure_score = round(death_econ_score + death_wick_score + close_econ_score + pressure_dot_score + win_score + sample_score + econ_bonus, 1)
    pressure_score = min(100, max(0, pressure_score))

    team_name = player_teams.get(pid, '')
    if not team_name:
        for tid in s['bowling_team_ids']:
            for td in teams_data:
                if td['team_id'] == tid:
                    team_name = td['team_name']
                    break
            if team_name:
                break

    if pressure_score >= 65 and num_matches >= 20:
        reliability = 'Elite'
    elif pressure_score >= 45 and num_matches >= 15:
        reliability = 'High'
    elif pressure_score >= 30:
        reliability = 'Promising'
    else:
        reliability = 'Developing'

    bowling_results.append({
        'player_id': pid,
        'name': s['name'],
        'team': team_name,
        'matches': num_matches,
        'innings': len(s['innings_set']),
        'balls': s['balls'],
        'runs_conceded': s['runs_conceded'],
        'wickets': s['wickets'],
        'economy': round(economy, 2),
        'average': round(avg, 2) if avg < 999 else None,
        'bowling_sr': round(sr, 2) if sr < 999 else None,
        'dot_pct': round(dot_pct, 2),
        'dots': s['dots'],
        'death_wickets': s['death_wickets'],
        'death_balls': s['death_balls'],
        'death_runs': s['death_runs'],
        'death_economy': round(death_econ, 2),
        'powerplay_wickets': s['powerplay_wickets'],
        'powerplay_balls': s['powerplay_balls'],
        'powerplay_economy': round(pp_econ, 2),
        'close_match_wickets': s['close_match_wickets'],
        'close_match_balls': s['close_match_balls'],
        'pressure_wickets': s['pressure_wickets'],
        'pressure_balls': s['pressure_balls'],
        'pressure_economy': round(pressure_econ, 2),
        'pressure_dot_pct': round(pressure_dot_pct, 2),
        'pressure_score': pressure_score,
        'win_pct': round(win_pct, 2),
        'reliability': reliability,
        'bowling_type': s['bowling_type'],
        'pace_or_spin': s['pace_or_spin'],
        'phase_wickets': dict(s['phase_wickets']),
        'phase_balls': dict(s['phase_balls']),
        'phase_runs': dict(s['phase_runs']),
        'seasons': sorted(list(s['seasons'])),
        'competitions': list(s['competitions']),
    })

bowling_results.sort(key=lambda x: x['pressure_score'], reverse=True)

# ============================================================
# OVERVIEW / KPI DATA
# ============================================================
print("Computing overview KPIs...")

total_matches = len(matches)
total_deliveries = len(ball_by_ball)
all_player_ids = set()
for b in ball_by_ball:
    if b['striker_id']:
        all_player_ids.add(b['striker_id'])
    if b['bowler_id']:
        all_player_ids.add(b['bowler_id'])
total_players = len(all_player_ids)

total_runs = sum(int(b['runs']) + int(b.get('extras1_runs', 0) or 0) + int(b.get('extras_2_runs', 0) or 0) for b in ball_by_ball)
total_wickets = sum(1 for b in ball_by_ball if b['is_wicket'] == 'true')

# High pressure performances: top 100 batting + top 100 bowling pressure performances
hp_bat = len([b for b in batting_results if b['pressure_score'] >= 50])
hp_bowl = len([b for b in bowling_results if b['pressure_score'] >= 50])

overview = {
    'total_matches': total_matches,
    'total_deliveries': total_deliveries,
    'total_players': total_players,
    'total_runs': total_runs,
    'total_wickets': total_wickets,
    'high_pressure_performances': hp_bat + hp_bowl,
    'seasons': sorted(list(set(match_season.values()))),
    'competitions': [{'id': c['comp_id'], 'name': c['comp_name'], 'season': c['season'], 'format': c['match_format']} for c in competitions],
    'close_matches': len(close_match_ids),
}

# ============================================================
# COMPETITION & SEASON FILTER DATA
# ============================================================
comp_filter = []
for c in competitions:
    comp_filter.append({
        'id': c['comp_id'],
        'name': c['comp_name'],
        'season': c['season'],
        'format': c['match_format']
    })

# ============================================================
# AUCTION RECOMMENDATIONS
# ============================================================
print("Generating auction recommendations...")

# Top batters by pressure score
top_batters = batting_results[:30]
# Top bowlers by pressure score
top_bowlers = bowling_results[:30]

def get_bat_recommendation(player):
    ps = player['pressure_score']
    matches = player['matches']
    if ps >= 65 and matches >= 20:
        return 'MUST TARGET'
    elif ps >= 50 and matches >= 15:
        return 'HIGH PRIORITY'
    elif ps >= 40 and matches >= 10:
        return 'VALUE PICK'
    return None

def get_bowl_recommendation(player):
    ps = player['pressure_score']
    matches = player['matches']
    if ps >= 60 and matches >= 20:
        return 'MUST TARGET'
    elif ps >= 45 and matches >= 15:
        return 'HIGH PRIORITY'
    elif ps >= 35 and matches >= 10:
        return 'VALUE PICK'
    return None

def get_bat_reason(p):
    reasons = []
    if p['death_sr'] > 140:
        reasons.append(f"Explosive death-over batter (SR: {p['death_sr']})")
    if p['chase_sr'] > 130:
        reasons.append(f"Proven chase specialist (SR: {p['chase_sr']})")
    if p['pressure_avg'] > 30:
        reasons.append(f"Consistent under pressure (Avg: {p['pressure_avg']})")
    if p['boundary_pct'] > 15:
        reasons.append(f"High boundary percentage ({p['boundary_pct']}%)")
    if p['average'] > 30:
        reasons.append(f"Strong overall average ({p['average']})")
    if p['strike_rate'] > 140:
        reasons.append(f"Aggressive stroke play (SR: {p['strike_rate']})")
    if p['win_pct'] > 55:
        reasons.append(f"Strong match-winner ({p['win_pct']}% win rate)")
    if not reasons:
        reasons.append(f"Reliable performer with pressure score of {p['pressure_score']}")
    return reasons

def get_bowl_reason(p):
    reasons = []
    if p['death_economy'] > 0 and p['death_economy'] < 9:
        reasons.append(f"Excellent death bowling (Econ: {p['death_economy']})")
    if p['death_wickets'] > 5:
        reasons.append(f"Death-over wicket-taker ({p['death_wickets']} wickets)")
    if p['economy'] < 7.5:
        reasons.append(f"Economical bowler (Econ: {p['economy']})")
    if p['dot_pct'] > 40:
        reasons.append(f"High dot-ball percentage ({p['dot_pct']}%)")
    if p['pressure_dot_pct'] > 35:
        reasons.append(f"Builds pressure with dots ({p['pressure_dot_pct']}%)")
    if p['wickets'] > 15:
        reasons.append(f"Proven wicket-taker ({p['wickets']} wickets)")
    if p['win_pct'] > 55:
        reasons.append(f"Match-winning impact ({p['win_pct']}% win rate)")
    if not reasons:
        reasons.append(f"Reliable bowler with pressure score of {p['pressure_score']}")
    return reasons

def get_bat_role(p):
    if p.get('phase_runs', {}).get('powerplay', 0) > p.get('phase_runs', {}).get('death', 0):
        if p['strike_rate'] > 140:
            return 'Aggressive Opener'
        return 'Top-Order Anchor'
    elif p.get('phase_runs', {}).get('death', 0) > 100:
        return 'Death-Over Finisher'
    elif p['average'] > 35:
        return 'Middle-Order Anchor'
    else:
        return 'Impact Middle-Order'

def get_bowl_role(p):
    if p['pace_or_spin'] == 'Spin':
        if p['economy'] < 7:
            return 'Economical Spinner'
        return 'Wicket-Taking Spinner'
    else:
        if p['death_wickets'] > 5:
            return 'Death-Over Specialist'
        elif p['powerplay_wickets'] > 5:
            return 'Powerplay Strike Bowler'
        return 'New Ball / Middle-Over Pacer'

bat_recommendations = []
for p in top_batters:
    rec = get_bat_recommendation(p)
    if rec:
        bat_recommendations.append({
            'player_id': p['player_id'],
            'name': p['name'],
            'team': p['team'],
            'type': 'Batter',
            'category': rec,
            'pressure_score': p['pressure_score'],
            'matches': p['matches'],
            'runs': p['runs'],
            'average': p['average'],
            'strike_rate': p['strike_rate'],
            'death_sr': p['death_sr'],
            'reliability': p['reliability'],
            'reasons': get_bat_reason(p),
            'role': get_bat_role(p),
            'confidence': 'High' if p['matches'] >= 30 else ('Medium' if p['matches'] >= 15 else 'Low'),
        })

bowl_recommendations = []
for p in top_bowlers:
    rec = get_bowl_recommendation(p)
    if rec:
        bowl_recommendations.append({
            'player_id': p['player_id'],
            'name': p['name'],
            'team': p['team'],
            'type': 'Bowler',
            'category': rec,
            'pressure_score': p['pressure_score'],
            'matches': p['matches'],
            'wickets': p['wickets'],
            'economy': p['economy'],
            'death_economy': p['death_economy'],
            'dot_pct': p['dot_pct'],
            'reliability': p['reliability'],
            'reasons': get_bowl_reason(p),
            'role': get_bowl_role(p),
            'confidence': 'High' if p['matches'] >= 30 else ('Medium' if p['matches'] >= 15 else 'Low'),
        })

all_recommendations = bat_recommendations + bowl_recommendations
all_recommendations.sort(key=lambda x: x['pressure_score'], reverse=True)

# ============================================================
# PRESSURE METHODOLOGY
# ============================================================
methodology = {
    'batting': {
        'description': 'Batting Pressure Score measures a player\'s ability to perform in high-stakes situations on a 0-100 scale.',
        'components': [
            {'name': 'Death Over Strike Rate', 'max_weight': 25, 'description': 'Strike rate in overs 17-20. Higher SR = better finisher.'},
            {'name': 'Chase Performance', 'max_weight': 20, 'description': 'Strike rate and impact when batting second in run chases.'},
            {'name': 'Close Match Impact', 'max_weight': 20, 'description': 'Runs per innings and SR in matches decided by ≤15 runs or ≤2 wickets.'},
            {'name': 'Pressure Consistency', 'max_weight': 15, 'description': 'Batting average in all pressure situations (death overs + close matches + late chases).'},
            {'name': 'Win Contribution', 'max_weight': 10, 'description': 'Percentage of matches won when the player batted.'},
            {'name': 'Sample Size', 'max_weight': 10, 'description': 'Bonus for larger sample of matches (up to 50 matches for full credit).'},
        ],
        'pressure_situations': 'Death overs (17-20), close matches (≤15 runs or ≤2 wickets margin), 2nd innings overs 16-20.'
    },
    'bowling': {
        'description': 'Bowling Pressure Score measures a bowler\'s effectiveness in high-pressure situations on a 0-100 scale.',
        'components': [
            {'name': 'Death Over Economy', 'max_weight': 25, 'description': 'Economy rate in overs 17-20. Lower economy = more restrictive.'},
            {'name': 'Death Over Wickets', 'max_weight': 20, 'description': 'Wicket-taking rate at death. Higher = more impactful.'},
            {'name': 'Close Match Economy', 'max_weight': 15, 'description': 'Economy rate in close matches. Lower = more clutch.'},
            {'name': 'Pressure Dot Ball %', 'max_weight': 15, 'description': 'Percentage of dot balls in pressure situations.'},
            {'name': 'Win Contribution', 'max_weight': 10, 'description': 'Percentage of matches won when the player bowled.'},
            {'name': 'Sample Size', 'max_weight': 10, 'description': 'Bonus for larger sample of matches.'},
            {'name': 'Overall Economy Bonus', 'max_weight': 5, 'description': 'Bonus for overall economy below 8.'},
        ],
        'pressure_situations': 'Death overs (17-20), close matches, defending in 2nd innings death overs.'
    }
}

# ============================================================
# WRITE OUTPUT JSON FILES
# ============================================================
print("Writing JSON files...")

def write_json(filename, data):
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Written: {filename} ({os.path.getsize(path)} bytes)")

write_json('overview.json', overview)
write_json('batting.json', batting_results)
write_json('bowling.json', bowling_results)
write_json('recommendations.json', all_recommendations)
write_json('methodology.json', methodology)
write_json('competitions.json', comp_filter)

print("\n✅ Data processing complete!")
print(f"  Batters analyzed: {len(batting_results)}")
print(f"  Bowlers analyzed: {len(bowling_results)}")
print(f"  Recommendations: {len(all_recommendations)}")
print(f"  Output directory: {OUTPUT_DIR}")

