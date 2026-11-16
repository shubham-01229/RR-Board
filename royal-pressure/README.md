# 🏏 Royals Board — IPL 2027 Auction Intelligence

> **Premium Cricket Analytics Dashboard for Rajasthan Royals**

A visually stunning, data-driven dashboard that identifies the most reliable players under pressure for the IPL 2027 mega auction.

## 🔥 Features

- **Overview KPIs** — Matches, deliveries, players, runs, wickets analyzed
- **Batting Intelligence** — Top batters by pressure score with interactive charts
- **Bowling Intelligence** — Top bowlers ranked by clutch performance
- **Pressure Performance** — Proprietary 0-100 pressure scoring with documented methodology
- **Player Rankings** — Sortable, searchable leaderboards with reliability badges
- **Auction Picks** — Data-backed recommendations: Must Target, High Priority, Value Pick
- **Player Comparison** — Head-to-head radar chart comparison
- **Interactive Filters** — Season, competition, and player search
- **Glassmorphism Design** — Premium dark theme with Rajasthan Royals branding

## 📊 Data

- **200,999** ball-by-ball deliveries analyzed
- **883** T20 & T20I matches (2022–2026)
- **573** batters and **524** bowlers evaluated
- **141** competitions across all T20 cricket

## 🚀 Quick Start

### 1. Process Data
```bash
python scripts/process_data.py
```

### 2. Run Locally
```bash
npx serve .
```
Then open `http://localhost:3000` in your browser.

### 3. Deploy to Vercel

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Set **Framework Preset** to `Other`
4. Set **Output Directory** to `.` (root)
5. Click **Deploy**

No environment variables or secrets needed — the dashboard is fully static.

## 📁 Project Structure

```
royal-pressure/
├── index.html              # Main dashboard page
├── package.json            # Project metadata
├── vercel.json             # Vercel deployment config
├── README.md               # This file
├── public/
│   ├── logo/
│   └── assets/
├── src/
│   ├── css/
│   │   ├── style.css       # Main styles
│   │   ├── glassmorphism.css # Glass effect classes
│   │   └── responsive.css  # Mobile responsive
│   ├── js/
│   │   ├── app.js          # Main orchestrator
│   │   ├── data-loader.js  # JSON data loading
│   │   ├── analytics.js    # Statistical computations
│   │   ├── charts.js       # Chart.js wrapper
│   │   ├── filters.js      # Filter management
│   │   └── rankings.js     # Sortable tables
│   └── data/
│       └── processed/      # Generated JSON data
│           ├── overview.json
│           ├── batting.json
│           ├── bowling.json
│           ├── recommendations.json
│           ├── methodology.json
│           └── competitions.json
└── scripts/
    └── process_data.py     # Data processing pipeline
```

## 🎨 Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Royal Blue | `#254AA5` | Primary |
| Royal Pink | `#E60693` | Highlights, active state |
| Vintage Gold | `#CBA92B` | Premium indicators |
| Deep Navy | `#07152E` | Background |
| Dark Blue | `#0B1F46` | Secondary bg |

## 📐 Pressure Score Methodology

### Batting (0–100)
| Component | Max Weight | What it Measures |
|-----------|-----------|-----------------|
| Death Over SR | 25 | Strike rate in overs 17–20 |
| Chase Performance | 20 | SR when batting second |
| Close Match Impact | 20 | Runs in tight games (≤15 runs / ≤2 wickets) |
| Pressure Consistency | 15 | Average in all pressure situations |
| Win Contribution | 10 | Team win % when playing |
| Sample Size | 10 | Reliability bonus |

### Bowling (0–100)
| Component | Max Weight | What it Measures |
|-----------|-----------|-----------------|
| Death Over Economy | 25 | Economy in overs 17–20 |
| Death Over Wickets | 20 | Wicket-taking at death |
| Close Match Economy | 15 | Economy in tight games |
| Pressure Dot Ball % | 15 | Dot balls under pressure |
| Win Contribution | 10 | Team win % when bowling |
| Sample Size | 10 | Reliability bonus |
| Economy Bonus | 5 | Overall economy < 8 |

## ⚖️ License

MIT

