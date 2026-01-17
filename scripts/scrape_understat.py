"""
Understat Premier League Stats Scraper
Scrapes xG data from Understat.com using their JSON API

Understat provides excellent xG data including:
- Player xG, xA, xGChain, xGBuildup
- Team xG for/against
- Match-by-match xG
- Shot data with xG per shot

The data is embedded as JSON in script tags, making it easier to extract.
"""

import requests
import pandas as pd
import json
import re
import time
from pathlib import Path
from datetime import datetime

DATA_DIR = Path(__file__).parent.parent / "data"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

UNDERSTAT_BASE = "https://understat.com"


def extract_json_data(html: str, var_name: str) -> dict | list | None:
    """Extract JSON data from Understat's embedded JavaScript"""
    # Understat embeds data as: var playersData = JSON.parse('...')
    pattern = rf"var\s+{var_name}\s*=\s*JSON\.parse\('(.+?)'\)"
    match = re.search(pattern, html)
    
    if match:
        json_str = match.group(1)
        # Understat uses unicode escapes
        json_str = json_str.encode().decode('unicode_escape')
        return json.loads(json_str)
    
    return None


def scrape_league_players():
    """Scrape all Premier League player stats"""
    print("\n👥 Scraping Player Stats from Understat...")
    
    url = f"{UNDERSTAT_BASE}/league/EPL/2024"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        html = response.text
        
        # Extract player data
        players_data = extract_json_data(html, "playersData")
        
        if players_data:
            df = pd.DataFrame(players_data)
            
            # Convert numeric columns
            numeric_cols = ["games", "time", "goals", "xG", "assists", "xA", 
                          "shots", "key_passes", "yellow_cards", "red_cards",
                          "npg", "npxG", "xGChain", "xGBuildup"]
            
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            
            # Calculate per 90 stats
            df["minutes"] = df["time"]
            df["xG_per90"] = (df["xG"] / df["minutes"]) * 90
            df["xA_per90"] = (df["xA"] / df["minutes"]) * 90
            df["xGI_per90"] = df["xG_per90"] + df["xA_per90"]
            
            # Save
            filepath = DATA_DIR / "understat_players.csv"
            df.to_csv(filepath, index=False)
            
            print(f"   ✅ Saved {len(df)} players to {filepath.name}")
            print(f"   Columns: {', '.join(df.columns[:12])}...")
            
            # Show top 10 by xG
            print("\n   📊 Top 10 Players by xG:")
            top = df.nlargest(10, "xG")[["player_name", "team_title", "games", "goals", "xG", "assists", "xA"]]
            print(top.to_string(index=False))
            
            return df
        else:
            print("   ⚠️ Could not find player data in page")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return None


def scrape_league_teams():
    """Scrape team-level xG stats"""
    print("\n🏟️ Scraping Team Stats from Understat...")
    
    url = f"{UNDERSTAT_BASE}/league/EPL/2024"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        html = response.text
        
        # Extract team data
        teams_data = extract_json_data(html, "teamsData")
        
        if teams_data:
            teams_list = []
            
            for team_id, team_info in teams_data.items():
                team_name = team_info.get("title", "Unknown")
                history = team_info.get("history", [])
                
                # Aggregate season stats
                total_xG = sum(float(m.get("xG", 0)) for m in history)
                total_xGA = sum(float(m.get("xGA", 0)) for m in history)
                total_scored = sum(int(m.get("scored", 0)) for m in history)
                total_missed = sum(int(m.get("missed", 0)) for m in history)  # goals conceded
                total_wins = sum(1 for m in history if m.get("result") == "w")
                total_draws = sum(1 for m in history if m.get("result") == "d")
                total_losses = sum(1 for m in history if m.get("result") == "l")
                
                teams_list.append({
                    "team": team_name,
                    "id": team_id,
                    "played": len(history),
                    "wins": total_wins,
                    "draws": total_draws,
                    "losses": total_losses,
                    "goals_for": total_scored,
                    "goals_against": total_missed,
                    "goal_diff": total_scored - total_missed,
                    "points": total_wins * 3 + total_draws,
                    "xG": round(total_xG, 2),
                    "xGA": round(total_xGA, 2),
                    "xG_diff": round(total_xG - total_xGA, 2),
                    "xG_per_game": round(total_xG / len(history), 2) if history else 0,
                    "xGA_per_game": round(total_xGA / len(history), 2) if history else 0,
                })
            
            df = pd.DataFrame(teams_list)
            df = df.sort_values("points", ascending=False).reset_index(drop=True)
            df.index = df.index + 1
            
            # Save
            filepath = DATA_DIR / "understat_teams.csv"
            df.to_csv(filepath, index=True, index_label="Position")
            
            print(f"   ✅ Saved {len(df)} teams to {filepath.name}")
            print("\n   📊 League Table with xG:")
            display_cols = ["team", "played", "wins", "draws", "losses", "goals_for", "xG", "xGA", "points"]
            print(df[display_cols].to_string())
            
            return df
        else:
            print("   ⚠️ Could not find team data in page")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return None


def scrape_team_fixtures(team_name: str):
    """Scrape fixture-level xG for a specific team"""
    # Map team names to Understat URLs
    team_urls = {
        "Arsenal": "Arsenal",
        "Liverpool": "Liverpool", 
        "Manchester City": "Manchester_City",
        "Manchester United": "Manchester_United",
        "Chelsea": "Chelsea",
        "Tottenham": "Tottenham",
        "Newcastle": "Newcastle_United",
        "Aston Villa": "Aston_Villa",
        "Brighton": "Brighton",
        "West Ham": "West_Ham",
        "Fulham": "Fulham",
        "Brentford": "Brentford",
        "Crystal Palace": "Crystal_Palace",
        "Wolverhampton": "Wolverhampton_Wanderers",
        "Bournemouth": "Bournemouth",
        "Nottingham Forest": "Nottingham_Forest",
        "Everton": "Everton",
        "Leicester": "Leicester",
        "Southampton": "Southampton",
        "Ipswich": "Ipswich",
    }
    
    url_name = team_urls.get(team_name, team_name.replace(" ", "_"))
    url = f"{UNDERSTAT_BASE}/team/{url_name}/2024"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        html = response.text
        
        # Extract match data
        dates_data = extract_json_data(html, "datesData")
        
        if dates_data:
            matches = []
            for match in dates_data:
                matches.append({
                    "date": match.get("datetime", ""),
                    "home_team": match.get("h", {}).get("title", ""),
                    "away_team": match.get("a", {}).get("title", ""),
                    "home_goals": match.get("goals", {}).get("h", 0),
                    "away_goals": match.get("goals", {}).get("a", 0),
                    "home_xG": float(match.get("xG", {}).get("h", 0)),
                    "away_xG": float(match.get("xG", {}).get("a", 0)),
                    "result": match.get("result", ""),
                })
            
            return pd.DataFrame(matches)
            
    except Exception as e:
        print(f"   ❌ Error fetching {team_name}: {e}")
    
    return None


def scrape_all_fixtures():
    """Scrape all Premier League fixtures with xG"""
    print("\n📅 Scraping All Fixtures with xG...")
    
    url = f"{UNDERSTAT_BASE}/league/EPL/2024"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        html = response.text
        
        # Extract dates/fixtures data
        dates_data = extract_json_data(html, "datesData")
        
        if dates_data:
            fixtures = []
            for match in dates_data:
                fixtures.append({
                    "id": match.get("id", ""),
                    "is_result": match.get("isResult", False),
                    "date": match.get("datetime", ""),
                    "home_team": match.get("h", {}).get("title", ""),
                    "away_team": match.get("a", {}).get("title", ""),
                    "home_goals": match.get("goals", {}).get("h", 0) if match.get("isResult") else None,
                    "away_goals": match.get("goals", {}).get("a", 0) if match.get("isResult") else None,
                    "home_xG": float(match.get("xG", {}).get("h", 0)) if match.get("isResult") else None,
                    "away_xG": float(match.get("xG", {}).get("a", 0)) if match.get("isResult") else None,
                })
            
            df = pd.DataFrame(fixtures)
            
            # Split into results and upcoming
            results = df[df["is_result"] == True].copy()
            upcoming = df[df["is_result"] == False].copy()
            
            # Save results
            if len(results) > 0:
                results_path = DATA_DIR / "understat_results.csv"
                results.to_csv(results_path, index=False)
                print(f"   ✅ Saved {len(results)} results to {results_path.name}")
            
            # Save upcoming
            if len(upcoming) > 0:
                upcoming_path = DATA_DIR / "understat_upcoming.csv"
                upcoming.to_csv(upcoming_path, index=False)
                print(f"   ✅ Saved {len(upcoming)} upcoming fixtures to {upcoming_path.name}")
            
            return df
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return None


def main():
    """Main scraping function"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("📊 Understat Premier League Scraper")
    print("   Season: 2024-25")
    print("=" * 60)
    
    # Scrape player stats
    scrape_league_players()
    time.sleep(2)
    
    # Scrape team stats
    scrape_league_teams()
    time.sleep(2)
    
    # Scrape all fixtures
    scrape_all_fixtures()
    
    print("\n" + "=" * 60)
    print("✅ Understat scraping complete!")
    print(f"📁 Data saved to: {DATA_DIR}")
    print("=" * 60)
    
    # List files
    print("\n📂 Understat files:")
    for f in sorted(DATA_DIR.glob("understat_*.csv")):
        size = f.stat().st_size / 1024
        print(f"   {f.name} ({size:.1f} KB)")


if __name__ == "__main__":
    main()
