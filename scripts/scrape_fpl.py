"""
Premier League Player Stats Scraper - Alternative Methods
Uses multiple sources and fallback methods
"""

import requests
import pandas as pd
import time
import os
import json
from datetime import datetime

# API-Football (using the key you already have)
API_FOOTBALL_KEY = os.getenv("API_FOOTBALL_KEY", "a9df420d23a441abd12b8209f524e8a1")
API_FOOTBALL_URL = "https://v3.football.api-sports.io"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def fetch_from_football_data_api():
    """
    Fetch player data from Football-Data.org (free tier)
    Limited but available
    """
    FOOTBALL_DATA_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "")
    if not FOOTBALL_DATA_KEY:
        print("[Scraper] No Football-Data.org API key found in env")
        return None
    
    url = "https://api.football-data.org/v4/competitions/PL/scorers"
    headers = {"X-Auth-Token": FOOTBALL_DATA_KEY}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        players = []
        for scorer in data.get("scorers", []):
            player = scorer.get("player", {})
            team = scorer.get("team", {})
            
            players.append({
                "name": player.get("name"),
                "team": team.get("name"),
                "position": player.get("position"),
                "nationality": player.get("nationality"),
                "goals": scorer.get("goals", 0),
                "assists": scorer.get("assists", 0),
                "penalties": scorer.get("penalties", 0),
            })
        
        df = pd.DataFrame(players)
        print(f"[Scraper] Fetched {len(df)} top scorers from Football-Data.org")
        return df
        
    except Exception as e:
        print(f"[Scraper] Error with Football-Data.org: {e}")
        return None


def fetch_from_api_football():
    """
    Fetch player data from API-Football
    Note: Free tier has limitations
    """
    print("[Scraper] Fetching from API-Football...")
    
    # Get Premier League ID = 39
    url = f"{API_FOOTBALL_URL}/players/topscorers"
    headers = {
        "x-rapidapi-key": API_FOOTBALL_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io"
    }
    params = {
        "league": 39,  # Premier League
        "season": 2025  # Current season
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        data = response.json()
        
        if data.get("errors"):
            print(f"[Scraper] API-Football error: {data['errors']}")
            return None
        
        players = []
        for item in data.get("response", []):
            player = item.get("player", {})
            stats = item.get("statistics", [{}])[0]
            
            players.append({
                "name": player.get("name"),
                "team": stats.get("team", {}).get("name"),
                "position": stats.get("games", {}).get("position"),
                "nationality": player.get("nationality"),
                "age": player.get("age"),
                "appearances": stats.get("games", {}).get("appearences"),
                "minutes": stats.get("games", {}).get("minutes"),
                "goals": stats.get("goals", {}).get("total", 0),
                "assists": stats.get("goals", {}).get("assists", 0),
                "shots": stats.get("shots", {}).get("total"),
                "shots_on": stats.get("shots", {}).get("on"),
                "passes": stats.get("passes", {}).get("total"),
                "pass_accuracy": stats.get("passes", {}).get("accuracy"),
                "tackles": stats.get("tackles", {}).get("total"),
                "interceptions": stats.get("tackles", {}).get("interceptions"),
                "duels_won": stats.get("duels", {}).get("won"),
                "dribbles_success": stats.get("dribbles", {}).get("success"),
                "fouls_committed": stats.get("fouls", {}).get("committed"),
                "yellow_cards": stats.get("cards", {}).get("yellow"),
                "red_cards": stats.get("cards", {}).get("red"),
            })
        
        df = pd.DataFrame(players)
        print(f"[Scraper] Fetched {len(df)} players from API-Football")
        return df
        
    except Exception as e:
        print(f"[Scraper] Error with API-Football: {e}")
        return None


def fetch_squad_from_api_football(team_id: int, team_name: str):
    """Fetch full squad for a team"""
    url = f"{API_FOOTBALL_URL}/players/squads"
    headers = {
        "x-rapidapi-key": API_FOOTBALL_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io"
    }
    params = {"team": team_id}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        data = response.json()
        
        players = []
        for item in data.get("response", []):
            for player in item.get("players", []):
                players.append({
                    "name": player.get("name"),
                    "age": player.get("age"),
                    "number": player.get("number"),
                    "position": player.get("position"),
                    "team": team_name
                })
        
        return players
    except Exception as e:
        print(f"[Scraper] Error fetching squad for {team_name}: {e}")
        return []


def download_kaggle_dataset():
    """
    Instructions to download from Kaggle
    """
    print("""
=== KAGGLE DATASET OPTION ===

For comprehensive player data, download from Kaggle:

1. Go to: https://www.kaggle.com/datasets/orkunaktas/all-football-players-stats-in-top-5-leagues-2024
   OR: https://www.kaggle.com/datasets/davidcariboo/player-scores

2. Download the CSV file

3. Place it in: C:\\Code\\btx2.0\\data\\

Alternative datasets:
- https://www.kaggle.com/datasets/davidcariboo/player-scores
- https://www.kaggle.com/datasets/nyagami/english-premier-league-match-data
- https://github.com/vaastav/Fantasy-Premier-League (FPL data)

=== FANTASY PREMIER LEAGUE API ===

Free, no auth required:
https://fantasy.premierleague.com/api/bootstrap-static/

This contains all current season players with:
- Goals, assists, clean sheets
- xG, xA (expected goals/assists)  
- ICT index (Influence, Creativity, Threat)
- Prices, ownership %
""")


def fetch_fpl_data():
    """
    Fetch from Fantasy Premier League API - FREE, no auth!
    Best source for current season data
    """
    print("[Scraper] Fetching from Fantasy Premier League API...")
    
    url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        # Get team mapping
        teams = {t["id"]: t["name"] for t in data.get("teams", [])}
        
        # Get player data
        players = []
        for p in data.get("elements", []):
            players.append({
                "name": p.get("web_name"),
                "full_name": f"{p.get('first_name')} {p.get('second_name')}",
                "team": teams.get(p.get("team"), "Unknown"),
                "position": ["GK", "DEF", "MID", "FWD"][p.get("element_type", 1) - 1],
                "price": p.get("now_cost", 0) / 10,
                "total_points": p.get("total_points"),
                "minutes": p.get("minutes"),
                "goals": p.get("goals_scored"),
                "assists": p.get("assists"),
                "clean_sheets": p.get("clean_sheets"),
                "goals_conceded": p.get("goals_conceded"),
                "own_goals": p.get("own_goals"),
                "penalties_saved": p.get("penalties_saved"),
                "penalties_missed": p.get("penalties_missed"),
                "yellow_cards": p.get("yellow_cards"),
                "red_cards": p.get("red_cards"),
                "saves": p.get("saves"),
                "bonus": p.get("bonus"),
                "bps": p.get("bps"),  # Bonus point system
                "influence": float(p.get("influence", 0)),
                "creativity": float(p.get("creativity", 0)),
                "threat": float(p.get("threat", 0)),
                "ict_index": float(p.get("ict_index", 0)),
                "xG": float(p.get("expected_goals", 0)),
                "xA": float(p.get("expected_assists", 0)),
                "xGI": float(p.get("expected_goal_involvements", 0)),
                "xGC": float(p.get("expected_goals_conceded", 0)),
                "form": float(p.get("form", 0)),
                "points_per_game": float(p.get("points_per_game", 0)),
                "selected_by_percent": float(p.get("selected_by_percent", 0)),
                "status": p.get("status"),  # a=available, i=injured, d=doubtful, s=suspended, u=unavailable
                "chance_of_playing": p.get("chance_of_playing_next_round"),
                "news": p.get("news"),  # Injury/suspension news
            })
        
        df = pd.DataFrame(players)
        print(f"[Scraper] Fetched {len(df)} players from FPL API")
        print(f"[Scraper] Includes: xG, xA, ICT index, injury status!")
        return df
        
    except Exception as e:
        print(f"[Scraper] Error with FPL API: {e}")
        return None


def save_to_csv(df, filename):
    """Save DataFrame to CSV"""
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(data_dir, exist_ok=True)
    
    filepath = os.path.join(data_dir, filename)
    df.to_csv(filepath, index=False, encoding='utf-8')
    print(f"[Scraper] Saved to {filepath}")
    return filepath


def main():
    print("=" * 60)
    print("Premier League Player Stats Scraper")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    
    # Best source: Fantasy Premier League API (free, comprehensive)
    print("\n--- Fantasy Premier League API ---")
    fpl_df = fetch_fpl_data()
    if fpl_df is not None and len(fpl_df) > 0:
        save_to_csv(fpl_df, "players_current_season.csv")
        
        # Print summary
        print(f"\nTop 10 by xG:")
        print(fpl_df.nlargest(10, "xG")[["name", "team", "goals", "xG", "xA"]].to_string())
        
        print(f"\nInjured/Doubtful players:")
        injured = fpl_df[fpl_df["status"].isin(["i", "d", "s"])]
        print(injured[["name", "team", "status", "news"]].head(20).to_string())
    
    # Fallback: Football-Data.org
    print("\n--- Football-Data.org Top Scorers ---")
    fd_df = fetch_from_football_data_api()
    if fd_df is not None:
        save_to_csv(fd_df, "top_scorers.csv")
    
    print("\n" + "=" * 60)
    print("Scraping complete!")
    print("=" * 60)
    
    download_kaggle_dataset()


if __name__ == "__main__":
    main()
