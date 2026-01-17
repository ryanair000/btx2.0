"""
Premier League Player Stats Scraper
Scrapes current season player statistics from FBref
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import os
from datetime import datetime

# FBref Premier League stats page
FBREF_PL_URL = "https://fbref.com/en/comps/9/stats/Premier-League-Stats"
FBREF_BASE = "https://fbref.com"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_fbref_player_stats():
    """Scrape player stats from FBref"""
    print(f"[Scraper] Fetching FBref Premier League stats...")
    
    try:
        response = requests.get(FBREF_PL_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"[Scraper] Error fetching page: {e}")
        return None
    
    soup = BeautifulSoup(response.content, "html.parser")
    
    # Find the main stats table
    table = soup.find("table", {"id": "stats_standard"})
    if not table:
        print("[Scraper] Could not find stats table")
        return None
    
    # Parse headers
    thead = table.find("thead")
    headers = []
    for th in thead.find_all("tr")[-1].find_all("th"):
        headers.append(th.get_text(strip=True))
    
    # Parse rows
    tbody = table.find("tbody")
    rows = []
    
    for tr in tbody.find_all("tr"):
        if tr.get("class") and "thead" in tr.get("class"):
            continue
        
        row = []
        for td in tr.find_all(["th", "td"]):
            row.append(td.get_text(strip=True))
        
        if len(row) >= len(headers):
            rows.append(row[:len(headers)])
    
    df = pd.DataFrame(rows, columns=headers)
    
    print(f"[Scraper] Found {len(df)} players")
    return df


def scrape_understat_xg():
    """Scrape xG data from Understat"""
    import json
    
    UNDERSTAT_URL = "https://understat.com/league/EPL"
    
    print(f"[Scraper] Fetching Understat xG data...")
    
    try:
        response = requests.get(UNDERSTAT_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"[Scraper] Error fetching Understat: {e}")
        return None
    
    soup = BeautifulSoup(response.content, "html.parser")
    
    # Find the script containing player data
    scripts = soup.find_all("script")
    player_data = None
    
    for script in scripts:
        if script.string and "playersData" in script.string:
            # Extract JSON from script
            text = script.string
            start = text.find("playersData") + len("playersData") + 4
            end = text.find("]", start) + 1
            
            # Decode unicode escapes
            json_str = text[start:end].encode().decode('unicode_escape')
            player_data = json.loads(json_str)
            break
    
    if not player_data:
        print("[Scraper] Could not find player data in Understat")
        return None
    
    # Convert to DataFrame
    df = pd.DataFrame(player_data)
    
    print(f"[Scraper] Found {len(df)} players with xG data")
    return df


def scrape_transfermarkt_injuries():
    """Scrape current injuries from Transfermarkt"""
    TM_INJURIES_URL = "https://www.transfermarkt.com/premier-league/verletztespieler/wettbewerb/GB1"
    
    print(f"[Scraper] Fetching injury data...")
    
    try:
        response = requests.get(TM_INJURIES_URL, headers={
            **HEADERS,
            "Accept-Language": "en-US,en;q=0.9"
        }, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"[Scraper] Error fetching injuries: {e}")
        return None
    
    soup = BeautifulSoup(response.content, "html.parser")
    
    injuries = []
    table = soup.find("table", class_="items")
    
    if table:
        for row in table.find_all("tr", class_=["odd", "even"]):
            cells = row.find_all("td")
            if len(cells) >= 5:
                player_link = cells[0].find("a")
                team_link = cells[2].find("a")
                
                injuries.append({
                    "player": player_link.get_text(strip=True) if player_link else "",
                    "team": team_link.get("title", "") if team_link else "",
                    "injury": cells[3].get_text(strip=True),
                    "since": cells[4].get_text(strip=True),
                    "expected_return": cells[5].get_text(strip=True) if len(cells) > 5 else ""
                })
    
    df = pd.DataFrame(injuries)
    print(f"[Scraper] Found {len(df)} injured players")
    return df


def save_to_csv(df, filename):
    """Save DataFrame to CSV in data folder"""
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(data_dir, exist_ok=True)
    
    filepath = os.path.join(data_dir, filename)
    df.to_csv(filepath, index=False)
    print(f"[Scraper] Saved to {filepath}")
    return filepath


def main():
    print("=" * 50)
    print("Premier League Data Scraper")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)
    
    # 1. Scrape FBref player stats
    print("\n--- FBref Player Stats ---")
    fbref_df = scrape_fbref_player_stats()
    if fbref_df is not None:
        save_to_csv(fbref_df, f"players_fbref_{datetime.now().strftime('%Y%m%d')}.csv")
        time.sleep(3)  # Be respectful to servers
    
    # 2. Scrape Understat xG data
    print("\n--- Understat xG Data ---")
    understat_df = scrape_understat_xg()
    if understat_df is not None:
        save_to_csv(understat_df, f"players_xg_{datetime.now().strftime('%Y%m%d')}.csv")
        time.sleep(3)
    
    # 3. Scrape injury data
    print("\n--- Injury Data ---")
    injuries_df = scrape_transfermarkt_injuries()
    if injuries_df is not None:
        save_to_csv(injuries_df, f"injuries_{datetime.now().strftime('%Y%m%d')}.csv")
    
    print("\n" + "=" * 50)
    print("Scraping complete!")
    print("=" * 50)


if __name__ == "__main__":
    main()
