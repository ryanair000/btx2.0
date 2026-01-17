"""
DataHub.io Premier League Data Downloader
Downloads historical Premier League data from DataHub.io's open datasets

Data includes:
- Season standings (1993-present)
- Match results with scores
- Team statistics

Source: https://datahub.io/core/english-premier-league
"""

import requests
import pandas as pd
import os
from pathlib import Path

# DataHub.io direct CSV links for English Premier League
DATAHUB_URLS = {
    "season_standings": "https://raw.githubusercontent.com/datasets/english-premier-league/main/data/season-standings.csv",
    "match_results": "https://raw.githubusercontent.com/datasets/english-premier-league/main/data/match-results.csv",
}

# Alternative: Football-Data.co.uk has excellent historical data with betting odds
FOOTBALL_DATA_UK_BASE = "https://www.football-data.co.uk/mmz4281"
FOOTBALL_DATA_SEASONS = [
    "2425",  # 2024-25
    "2324",  # 2023-24
    "2223",  # 2022-23
    "2122",  # 2021-22
    "2021",  # 2020-21
]

DATA_DIR = Path(__file__).parent.parent / "data"


def download_datahub_data():
    """Download data from DataHub.io GitHub repository"""
    print("=" * 60)
    print("Downloading from DataHub.io (GitHub datasets)")
    print("=" * 60)
    
    for name, url in DATAHUB_URLS.items():
        try:
            print(f"\n📥 Downloading {name}...")
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            filepath = DATA_DIR / f"datahub_{name}.csv"
            filepath.write_text(response.text, encoding="utf-8")
            
            # Load and preview
            df = pd.read_csv(filepath)
            print(f"   ✅ Saved: {filepath.name} ({len(df)} rows)")
            print(f"   Columns: {', '.join(df.columns[:8])}...")
            
        except Exception as e:
            print(f"   ❌ Failed: {e}")


def download_football_data_uk():
    """
    Download from Football-Data.co.uk - excellent source with:
    - Match results
    - Betting odds
    - Shot statistics
    - Cards, corners, etc.
    """
    print("\n" + "=" * 60)
    print("Downloading from Football-Data.co.uk")
    print("=" * 60)
    
    all_matches = []
    
    for season in FOOTBALL_DATA_SEASONS:
        url = f"{FOOTBALL_DATA_UK_BASE}/{season}/E0.csv"
        try:
            print(f"\n📥 Downloading season {season}...")
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            filepath = DATA_DIR / f"epl_{season}.csv"
            filepath.write_text(response.text, encoding="utf-8")
            
            df = pd.read_csv(filepath)
            df["Season"] = f"20{season[:2]}-{season[2:]}"
            all_matches.append(df)
            
            print(f"   ✅ Saved: {filepath.name} ({len(df)} matches)")
            
        except Exception as e:
            print(f"   ❌ Failed for {season}: {e}")
    
    # Combine all seasons
    if all_matches:
        combined = pd.concat(all_matches, ignore_index=True)
        combined_path = DATA_DIR / "epl_all_seasons.csv"
        combined.to_csv(combined_path, index=False)
        print(f"\n📦 Combined: {combined_path.name} ({len(combined)} total matches)")
        
        # Show available columns
        print(f"\n📊 Available columns ({len(combined.columns)}):")
        important_cols = [
            "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR",
            "HTHG", "HTAG", "HTR", "HS", "AS", "HST", "AST",
            "HF", "AF", "HC", "AC", "HY", "AY", "HR", "AR"
        ]
        available = [c for c in important_cols if c in combined.columns]
        print(f"   Match data: {', '.join(available)}")
        
        # Column legend
        print("\n📖 Column Legend:")
        print("   FTHG/FTAG = Full Time Home/Away Goals")
        print("   FTR = Full Time Result (H/D/A)")
        print("   HS/AS = Home/Away Shots")
        print("   HST/AST = Home/Away Shots on Target")
        print("   HF/AF = Home/Away Fouls")
        print("   HC/AC = Home/Away Corners")
        print("   HY/AY = Home/Away Yellow Cards")
        print("   HR/AR = Home/Away Red Cards")


def download_current_season_detailed():
    """Download the current season with maximum detail"""
    print("\n" + "=" * 60)
    print("Current Season 2024-25 Detailed Data")
    print("=" * 60)
    
    url = f"{FOOTBALL_DATA_UK_BASE}/2425/E0.csv"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        df = pd.read_csv(pd.io.common.StringIO(response.text))
        
        # Save raw
        filepath = DATA_DIR / "epl_current_season_detailed.csv"
        df.to_csv(filepath, index=False)
        
        print(f"\n✅ Current season: {len(df)} matches played")
        
        # Calculate team stats
        print("\n📊 Team Statistics (Current Season):")
        
        teams = set(df["HomeTeam"].unique()) | set(df["AwayTeam"].unique())
        team_stats = []
        
        for team in sorted(teams):
            home = df[df["HomeTeam"] == team]
            away = df[df["AwayTeam"] == team]
            
            home_wins = len(home[home["FTR"] == "H"])
            home_draws = len(home[home["FTR"] == "D"])
            home_losses = len(home[home["FTR"] == "A"])
            
            away_wins = len(away[away["FTR"] == "A"])
            away_draws = len(away[away["FTR"] == "D"])
            away_losses = len(away[away["FTR"] == "H"])
            
            goals_for = home["FTHG"].sum() + away["FTAG"].sum()
            goals_against = home["FTAG"].sum() + away["FTHG"].sum()
            
            # Shots if available
            shots_for = 0
            shots_against = 0
            if "HS" in df.columns:
                shots_for = home["HS"].sum() + away["AS"].sum()
                shots_against = home["AS"].sum() + away["HS"].sum()
            
            points = (home_wins + away_wins) * 3 + (home_draws + away_draws)
            played = len(home) + len(away)
            
            team_stats.append({
                "Team": team,
                "P": played,
                "W": home_wins + away_wins,
                "D": home_draws + away_draws,
                "L": home_losses + away_losses,
                "GF": goals_for,
                "GA": goals_against,
                "GD": goals_for - goals_against,
                "Pts": points,
                "Shots": shots_for,
                "ShotsAgainst": shots_against,
            })
        
        stats_df = pd.DataFrame(team_stats)
        stats_df = stats_df.sort_values("Pts", ascending=False).reset_index(drop=True)
        stats_df.index = stats_df.index + 1  # 1-based position
        
        # Save team stats
        stats_path = DATA_DIR / "epl_team_stats_current.csv"
        stats_df.to_csv(stats_path, index=True, index_label="Position")
        
        print(stats_df.to_string())
        print(f"\n💾 Saved to: {stats_path.name}")
        
        return stats_df
        
    except Exception as e:
        print(f"❌ Failed: {e}")
        return None


def main():
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    print("🏟️  Premier League Data Downloader")
    print("=" * 60)
    
    # 1. Try DataHub.io
    download_datahub_data()
    
    # 2. Download Football-Data.co.uk (more reliable, more data)
    download_football_data_uk()
    
    # 3. Current season detailed stats
    download_current_season_detailed()
    
    print("\n" + "=" * 60)
    print("✅ Download complete!")
    print(f"📁 Data saved to: {DATA_DIR}")
    print("=" * 60)
    
    # List all files
    print("\n📂 Downloaded files:")
    for f in sorted(DATA_DIR.glob("*.csv")):
        size = f.stat().st_size / 1024
        print(f"   {f.name} ({size:.1f} KB)")


if __name__ == "__main__":
    main()
