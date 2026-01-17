"""
FBref Premier League Stats Scraper
Scrapes detailed player and team statistics from FBref.com

FBref provides excellent data including:
- Player xG, xA, xGI
- Progressive passes/carries
- Shot-creating actions
- Defensive stats
- Advanced possession metrics

Note: FBref has Cloudflare protection, using cloudscraper to bypass.
"""

import cloudscraper
import pandas as pd
import time
import os
from pathlib import Path
from io import StringIO

# FBref URLs for Premier League 2024-25
FBREF_BASE = "https://fbref.com/en/comps/9"
FBREF_TABLES = {
    "standard": f"{FBREF_BASE}/stats/Premier-League-Stats",
    "shooting": f"{FBREF_BASE}/shooting/Premier-League-Stats",
    "passing": f"{FBREF_BASE}/passing/Premier-League-Stats",
    "gca": f"{FBREF_BASE}/gca/Premier-League-Stats",  # Goal/Shot creating actions
    "defense": f"{FBREF_BASE}/defense/Premier-League-Stats",
    "possession": f"{FBREF_BASE}/possession/Premier-League-Stats",
    "misc": f"{FBREF_BASE}/misc/Premier-League-Stats",
}

DATA_DIR = Path(__file__).parent.parent / "data"

# Create cloudscraper session
scraper = cloudscraper.create_scraper(
    browser={
        'browser': 'chrome',
        'platform': 'windows',
        'desktop': True
    }
)


def scrape_fbref_table(url: str, table_id: str = None) -> pd.DataFrame | None:
    """
    Scrape a table from FBref using cloudscraper
    FBref uses HTML comments to hide tables, need special handling
    """
    try:
        print(f"   Fetching: {url}")
        response = scraper.get(url, timeout=30)
        response.raise_for_status()
        
        html = response.text
        
        # FBref wraps some tables in HTML comments, we need to uncomment them
        # Look for commented tables
        import re
        commented_tables = re.findall(r'<!--\s*(<table[^>]*>.*?</table>)\s*-->', html, re.DOTALL)
        
        # Add commented tables back to HTML
        for table in commented_tables:
            html = html.replace(f"<!--{table}-->", table)
        
        # Parse all tables
        tables = pd.read_html(StringIO(html))
        
        if not tables:
            print(f"   ⚠️ No tables found")
            return None
        
        # Find the right table (usually the largest one with player data)
        player_tables = []
        for i, df in enumerate(tables):
            # Check if it looks like a player stats table
            cols = [str(c).lower() for c in df.columns.get_level_values(-1) if pd.notna(c)]
            if any(x in cols for x in ["player", "squad", "nation", "pos", "age"]):
                player_tables.append((i, len(df), df))
        
        if player_tables:
            # Get the largest player table
            player_tables.sort(key=lambda x: x[1], reverse=True)
            return player_tables[0][2]
        
        # Fallback: return largest table
        largest = max(tables, key=len)
        return largest
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None


def clean_fbref_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Clean FBref dataframe - handle multi-level columns"""
    if df is None:
        return None
    
    # Flatten multi-level columns
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = ['_'.join(str(c) for c in col if pd.notna(c) and str(c) != '').strip('_') 
                      for col in df.columns.values]
    
    # Remove duplicate rows (FBref repeats headers)
    df = df[df.iloc[:, 0] != df.columns[0]]
    
    # Convert numeric columns
    for col in df.columns:
        if col not in ["Player", "Squad", "Nation", "Pos", "Comp", "Born"]:
            try:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            except:
                pass
    
    return df


def scrape_standard_stats():
    """Scrape standard player statistics (goals, assists, xG, xA)"""
    print("\n📊 Scraping Standard Stats...")
    
    url = FBREF_TABLES["standard"]
    df = scrape_fbref_table(url)
    
    if df is not None:
        df = clean_fbref_dataframe(df)
        
        # Save raw
        filepath = DATA_DIR / "fbref_standard_stats.csv"
        df.to_csv(filepath, index=False)
        print(f"   ✅ Saved {len(df)} players to {filepath.name}")
        
        # Preview key columns
        key_cols = [c for c in df.columns if any(x in c.lower() for x in ["player", "squad", "gls", "ast", "xg", "xa", "min", "90"])]
        if key_cols:
            print(f"   Key columns: {', '.join(key_cols[:10])}")
        
        return df
    return None


def scrape_shooting_stats():
    """Scrape shooting statistics (shots, SoT, xG per shot)"""
    print("\n🎯 Scraping Shooting Stats...")
    
    url = FBREF_TABLES["shooting"]
    df = scrape_fbref_table(url)
    
    if df is not None:
        df = clean_fbref_dataframe(df)
        filepath = DATA_DIR / "fbref_shooting_stats.csv"
        df.to_csv(filepath, index=False)
        print(f"   ✅ Saved {len(df)} players to {filepath.name}")
        return df
    return None


def scrape_defensive_stats():
    """Scrape defensive statistics (tackles, interceptions, blocks)"""
    print("\n🛡️ Scraping Defensive Stats...")
    
    url = FBREF_TABLES["defense"]
    df = scrape_fbref_table(url)
    
    if df is not None:
        df = clean_fbref_dataframe(df)
        filepath = DATA_DIR / "fbref_defensive_stats.csv"
        df.to_csv(filepath, index=False)
        print(f"   ✅ Saved {len(df)} players to {filepath.name}")
        return df
    return None


def scrape_gca_stats():
    """Scrape goal/shot creating actions"""
    print("\n⚡ Scraping Goal Creating Actions...")
    
    url = FBREF_TABLES["gca"]
    df = scrape_fbref_table(url)
    
    if df is not None:
        df = clean_fbref_dataframe(df)
        filepath = DATA_DIR / "fbref_gca_stats.csv"
        df.to_csv(filepath, index=False)
        print(f"   ✅ Saved {len(df)} players to {filepath.name}")
        return df
    return None


def merge_all_stats():
    """Merge all scraped stats into one comprehensive file"""
    print("\n📦 Merging all stats...")
    
    files = {
        "standard": DATA_DIR / "fbref_standard_stats.csv",
        "shooting": DATA_DIR / "fbref_shooting_stats.csv",
        "defensive": DATA_DIR / "fbref_defensive_stats.csv",
        "gca": DATA_DIR / "fbref_gca_stats.csv",
    }
    
    dfs = {}
    for name, path in files.items():
        if path.exists():
            dfs[name] = pd.read_csv(path)
            print(f"   Loaded {name}: {len(dfs[name])} rows")
    
    if not dfs:
        print("   ❌ No files to merge")
        return None
    
    # Use standard stats as base
    if "standard" in dfs:
        merged = dfs["standard"].copy()
        
        # Find player identifier column
        player_col = None
        for col in ["Player", "player", "Unnamed: 0_level_1_Player"]:
            if col in merged.columns:
                player_col = col
                break
        
        if player_col:
            # Merge other dataframes
            for name, df in dfs.items():
                if name != "standard" and player_col in df.columns:
                    # Only add columns not already present
                    new_cols = [c for c in df.columns if c not in merged.columns or c == player_col]
                    if len(new_cols) > 1:
                        merged = merged.merge(df[new_cols], on=player_col, how="left")
        
        # Save merged
        merged_path = DATA_DIR / "fbref_all_stats.csv"
        merged.to_csv(merged_path, index=False)
        print(f"   ✅ Merged: {merged_path.name} ({len(merged)} players, {len(merged.columns)} columns)")
        
        return merged
    
    return None


def scrape_team_stats():
    """Scrape team-level statistics"""
    print("\n🏆 Scraping Team Stats...")
    
    # Team stats page
    url = f"{FBREF_BASE}/Premier-League-Stats"
    
    try:
        response = scraper.get(url, timeout=30)
        response.raise_for_status()
        
        html = response.text
        
        # Uncomment hidden tables
        import re
        commented_tables = re.findall(r'<!--\s*(<table[^>]*>.*?</table>)\s*-->', html, re.DOTALL)
        for table in commented_tables:
            html = html.replace(f"<!--{table}-->", table)
        
        tables = pd.read_html(StringIO(html))
        
        # Find squad stats table (usually has "Squad" in first column)
        for i, df in enumerate(tables):
            if len(df) >= 10 and len(df) <= 25:  # 20 PL teams
                cols = [str(c).lower() for c in df.columns.get_level_values(-1)]
                if any("squad" in c for c in cols):
                    df = clean_fbref_dataframe(df)
                    filepath = DATA_DIR / "fbref_team_stats.csv"
                    df.to_csv(filepath, index=False)
                    print(f"   ✅ Saved {len(df)} teams to {filepath.name}")
                    return df
        
        # Try first table with ~20 rows
        for df in tables:
            if 15 <= len(df) <= 25:
                df = clean_fbref_dataframe(df)
                filepath = DATA_DIR / "fbref_team_stats.csv"
                df.to_csv(filepath, index=False)
                print(f"   ✅ Saved {len(df)} teams to {filepath.name}")
                return df
                
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return None


def main():
    """Main scraping function"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("🌐 FBref Premier League Scraper")
    print("=" * 60)
    print("\n⚠️  Adding 3-second delays between requests to respect rate limits\n")
    
    # Scrape each category with delays
    scrape_standard_stats()
    time.sleep(3)
    
    scrape_shooting_stats()
    time.sleep(3)
    
    scrape_defensive_stats()
    time.sleep(3)
    
    scrape_gca_stats()
    time.sleep(3)
    
    scrape_team_stats()
    
    # Merge all player stats
    merge_all_stats()
    
    print("\n" + "=" * 60)
    print("✅ FBref scraping complete!")
    print(f"📁 Data saved to: {DATA_DIR}")
    print("=" * 60)
    
    # List FBref files
    print("\n📂 FBref files:")
    for f in sorted(DATA_DIR.glob("fbref_*.csv")):
        size = f.stat().st_size / 1024
        print(f"   {f.name} ({size:.1f} KB)")


if __name__ == "__main__":
    main()
