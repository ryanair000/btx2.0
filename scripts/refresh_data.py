#!/usr/bin/env python3
"""
Quick data refresh script
Fetches latest Premier League data from multiple sources
Run this when you hit API rate limits
"""

import subprocess
import sys
from pathlib import Path

def run_scraper(script_name, description):
    """Run a scraper script"""
    script_path = Path(__file__).parent / script_name
    
    if not script_path.exists():
        print(f"⚠️  {script_name} not found")
        return False
    
    print(f"\n🔄 Running {description}...")
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            return True
        else:
            print(f"❌ {description} failed:")
            print(result.stderr)
            return False
    except subprocess.TimeoutExpired:
        print(f"⏱️  {description} timed out")
        return False
    except Exception as e:
        print(f"❌ Error running {description}: {e}")
        return False

def main():
    print("=" * 60)
    print("🔄 BTX 2.0 - Data Refresh Utility")
    print("=" * 60)
    print("\nThis will fetch fresh data from free sources:")
    print("  • FBRef (team stats & fixtures)")
    print("  • Understat (xG data)")
    print("  • FPL (player stats)")
    print()
    
    response = input("Continue? (y/n): ").strip().lower()
    if response != 'y':
        print("Cancelled.")
        return
    
    results = {}
    
    # Run scrapers in order of importance
    results['fbref'] = run_scraper('scrape_fbref.py', 'FBRef Scraper (Team Stats)')
    results['understat'] = run_scraper('scrape_understat.py', 'Understat Scraper (xG Data)')
    results['fpl'] = run_scraper('scrape_fpl.py', 'FPL Scraper (Player Stats)')
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 REFRESH SUMMARY")
    print("=" * 60)
    
    success_count = sum(1 for v in results.values() if v)
    total_count = len(results)
    
    for name, success in results.items():
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"{name.upper():<12} {status}")
    
    print(f"\nCompleted: {success_count}/{total_count}")
    
    if success_count > 0:
        print("\n✅ Your local data has been updated!")
        print("The app will now use this data instead of the API.")
    else:
        print("\n⚠️  No data was updated. Check your internet connection.")
    
    print("\nNext steps:")
    print("1. Restart your dev server: npm run dev")
    print("2. The app will automatically use local data")

if __name__ == "__main__":
    main()
