#!/usr/bin/env python3
"""
Version Sync Script for MoDuL's Hub
Extracts latest versions from changelogs and updates index.html
"""

import re
import os
from pathlib import Path

# Define script directories and their files
SCRIPT_CONFIG = {
    'pit-guru': {
        'changelog': 'pit-guru/changelog.txt',
        'userjs': 'pit-guru/pit-guru.user.js',
        'display_name': 'MoDuL\'s Pit Guru'
    },
    'custom-race-filter': {
        'changelog': 'custom-race-filter/changelog.txt',
        'userjs': 'custom-race-filter/custom-race-filter.user.js',
        'display_name': 'Custom Race Filter'
    },
    'eggsterminator': {
        'changelog': 'eggsterminator/changelog.txt',
        'userjs': 'eggsterminator/eggsterminator.user.js',
        'display_name': 'EggsTerminator'
    },
    'smuggler': {
        'changelog': 'smuggler/changelog.txt',
        'userjs': 'smuggler/smuggler.js',  # Fixed: .js not .user.js
        'display_name': 'Smuggler'
    },
    'pythagoras-project-cis': {
        'changelog': 'pythagoras-project-cis/changelog.txt',
        'userjs': 'pythagoras-project-cis/pythagoras-project-cis.user.js',
        'display_name': 'Pythagoras Project - CIS'
    },
    'race-theme-changer': {
        'changelog': 'race-theme-changer/changelog.txt',
        'userjs': 'race-theme-changer/racing-theme-changer.user.js',
        'display_name': 'Race Theme Changer'
    },
    'stock-x': {
        'changelog': 'stock-x/changelog.txt',
        'userjs': 'stock-x/stock-x.js',  # Fixed: .js not .user.js
        'display_name': 'Stock-X'
    },
    'restore-og-names': {
        'changelog': 'restore-og-names/changelog.txt',
        'userjs': 'restore-og-names/restore-og-car-names.user.js',
        'display_name': 'Restore OG Names'
    },
    'landlord-tenant-ledger': {
        'changelog': 'landlord-tenant-ledger/changelog.txt',
        'userjs': 'landlord-tenant-ledger/landlord-tenant-ledger.user.js',
        'display_name': 'Landlord Tenant Ledger'
    }
}

def parse_version(version_str):
    """Convert version string to tuple for comparison."""
    try:
        parts = re.findall(r'\d+', version_str)
        return tuple(int(p) for p in parts) if parts else (0,)
    except:
        return (0,)

def get_latest_version_from_changelog(changelog_path):
    """Extract the latest version from a changelog file."""
    if not os.path.exists(changelog_path):
        return None
    
    with open(changelog_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Try multiple patterns:
    # 1. Line-start versions (v1.2.3 or 1.2.3 at start of line)
    matches = re.findall(r'^v?(\d+\.\d+(?:\.\d+)?)', content, re.MULTILINE)
    
    # 2. Markdown headers (## 1.2.3 or ## v1.2.3)
    if not matches:
        matches = re.findall(r'##\s*v?(\d+\.\d+(?:\.\d+)?)', content)
    
    # 3. Fallback: any "vX.Y.Z" pattern
    if not matches:
        matches = re.findall(r'v(\d+\.\d+(?:\.\d+)?)', content)
    
    if not matches:
        return None
    
    # Sort by version (highest first)
    sorted_versions = sorted(matches, key=parse_version, reverse=True)
    return sorted_versions[0]

def get_script_version_from_file(userjs_path):
    """Get version from @version metadata in .user.js file."""
    if not os.path.exists(userjs_path):
        return None
    
    with open(userjs_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'@version\s+([^\n]+)', content)
    if match:
        return match.group(1).strip()
    return None

def main():
    print("=" * 70)
    print("MoDuL's Hub - Version Sync Tool")
    print("=" * 70)
    
    # Use current working directory, not script directory
    base_dir = Path.cwd()
    html_path = base_dir / 'index.html'
    
    results = []
    
    print("\n📋 Scanning changelogs and script files...\n")
    print(f"{'Script':<30} {'Changelog':<12} {'File':<12} {'Status':<10}")
    print("-" * 70)
    
    for script_name, config in SCRIPT_CONFIG.items():
        changelog_path = base_dir / config['changelog']
        userjs_path = base_dir / config['userjs']
        
        changelog_version = get_latest_version_from_changelog(str(changelog_path))
        file_version = get_script_version_from_file(str(userjs_path))
        
        # Determine status
        if not changelog_version:
            status = "❌ No changelog"
        elif not file_version:
            status = "⚠️ No script file"
        elif changelog_version == file_version:
            status = "✅ Synced"
        else:
            status = f"⚠️ Mismatch"
        
        results.append({
            'name': config['display_name'],
            'script_name': script_name,
            'changelog_version': changelog_version,
            'file_version': file_version,
            'status': status
        })
        
        print(f"{config['display_name']:<30} {changelog_version or 'N/A':<12} {file_version or 'N/A':<12} {status:<10}")
    
    print("\n" + "=" * 70)
    
    # Identify mismatches
    mismatches = [r for r in results if r['changelog_version'] and r['file_version'] and r['changelog_version'] != r['file_version']]
    
    if mismatches:
        print(f"\n⚠️ Found {len(mismatches)} version mismatch(es):")
        print("-" * 70)
        for m in mismatches:
            print(f"  {m['name']}:")
            print(f"    Changelog: {m['changelog_version']}")
            print(f"    Script file: {m['file_version']}")
    else:
        print("\n✅ All versions are in sync!")
    
    # Check index.html versions
    if html_path.exists():
        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        print("\n📄 Checking index.html version displays...")
        print("-" * 70)
        
        for result in results:
            if result['changelog_version']:
                # Look for version in HTML
                pattern = rf'v?{re.escape(result["changelog_version"])}'
                if re.search(pattern, html_content):
                    print(f"  ✅ {result['name']}: v{result['changelog_version']} found in index.html")
                else:
                    print(f"  ❌ {result['name']}: v{result['changelog_version']} NOT found in index.html")
    
    print("\n" + "=" * 70)
    print("✓ Version scan complete")
    print("=" * 70)

if __name__ == '__main__':
    main()
