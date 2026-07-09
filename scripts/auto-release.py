#!/usr/bin/env python3
"""
Auto-Release Script for MoDuL's Hub
Detects version changes and generates changelogs automatically
"""

import re
import os
import subprocess
from pathlib import Path
from datetime import datetime

# Define script directories
SCRIPT_CONFIG = {
    'pit-guru': {
        'userjs': 'pit-guru/pit-guru.user.js',
        'changelog': 'pit-guru/changelog.txt',
        'display_name': "MoDuL's Pit Guru"
    },
    'custom-race-filter': {
        'userjs': 'custom-race-filter/custom-race-filter.user.js',
        'changelog': 'custom-race-filter/changelog.txt',
        'display_name': 'Custom Race Filter'
    },
    'eggsterminator': {
        'userjs': 'eggsterminator/eggsterminator.user.js',
        'changelog': 'eggsterminator/changelog.txt',
        'display_name': 'EggsTerminator'
    },
    'smuggler': {
        'userjs': 'smuggler/smuggler.js',
        'changelog': 'smuggler/changelog.txt',
        'display_name': 'Smuggler'
    },
    'pythagoras-project-cis': {
        'userjs': 'pythagoras-project-cis/pythagoras-project-cis.user.js',
        'changelog': 'pythagoras-project-cis/changelog.txt',
        'display_name': 'Pythagoras Project - CIS'
    },
    'race-theme-changer': {
        'userjs': 'race-theme-changer/racing-theme-changer.user.js',
        'changelog': 'race-theme-changer/changelog.txt',
        'display_name': 'Race Theme Changer'
    },
    'stock-x': {
        'userjs': 'stock-x/stock-x.js',
        'changelog': 'stock-x/changelog.txt',
        'display_name': 'Stock-X'
    },
    'restore-og-names': {
        'userjs': 'restore-og-names/restore-og-car-names.user.js',
        'changelog': 'restore-og-names/changelog.txt',
        'display_name': 'Restore OG Names'
    },
    'landlord-tenant-ledger': {
        'userjs': 'landlord-tenant-ledger/landlord-tenant-ledger.user.js',
        'changelog': 'landlord-tenant-ledger/changelog.txt',
        'display_name': 'Landlord Tenant Ledger'
    }
}

def get_git_commits(since_tag=None):
    """Get recent git commits."""
    try:
        if since_tag:
            cmd = f"git log {since_tag}..HEAD --pretty=format:'%h|%s|%b|%ad' --date=short"
        else:
            cmd = "git log --pretty=format:'%h|%s|%b|%ad' -20 --date=short"
        
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=Path.cwd())
        commits = []
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split('|', 3)
                if len(parts) >= 2:
                    commits.append({
                        'hash': parts[0],
                        'subject': parts[1],
                        'body': parts[2] if len(parts) > 2 else '',
                        'date': parts[3] if len(parts) > 3 else ''
                    })
        return commits
    except Exception as e:
        print(f"Error getting git commits: {e}")
        return []

def parse_conventional_commit(message):
    """Parse conventional commit message."""
    pattern = r'^(feat|fix|docs|style|refactor|test|chore)(\([^)]+\))?:\s*(.+)'
    match = re.match(pattern, message.strip())
    if match:
        return {
            'type': match.group(1),
            'scope': match.group(2),
            'description': match.group(3)
        }
    return {'type': 'chore', 'scope': None, 'description': message}

def get_script_version(userjs_path):
    """Get version from @version metadata."""
    if not os.path.exists(userjs_path):
        return None
    
    with open(userjs_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'@version\s+([^\n]+)', content)
    if match:
        return match.group(1).strip()
    return None

def parse_version(version_str):
    """Convert version string to tuple for comparison."""
    try:
        parts = re.findall(r'\d+', version_str)
        return tuple(int(p) for p in parts) if parts else (0,)
    except:
        return (0,)

def generate_changelog_entry(commit, script_name):
    """Generate changelog entry from commit."""
    parsed = parse_conventional_commit(commit['subject'])
    
    type_mapping = {
        'feat': 'New Feature',
        'fix': 'Bug Fix',
        'docs': 'Documentation',
        'style': 'Style',
        'refactor': 'Refactoring',
        'test': 'Testing',
        'chore': 'Miscellaneous'
    }
    
    category = type_mapping.get(parsed['type'], 'Miscellaneous')
    
    # Add scope if available
    scope = f" ({parsed['scope'].strip('()')})" if parsed['scope'] else ""
    
    return f"- **{category}{scope}**: {parsed['description']}"

def generate_changelog(script_name, config, commits):
    """Generate changelog content for a script."""
    version = get_script_version(config['userjs'])
    if not version:
        return None, None
    
    # Filter commits relevant to this script
    script_keywords = [script_name.replace('-', ' '), script_name.split('-')[0]]
    relevant_commits = []
    
    for commit in commits:
        subject_lower = commit['subject'].lower()
        if any(keyword in subject_lower for keyword in script_keywords):
            relevant_commits.append(commit)
    
    if not relevant_commits:
        return None, version
    
    # Group commits by type
    grouped = {}
    for commit in relevant_commits:
        parsed = parse_conventional_commit(commit['subject'])
        category = parsed['type']
        if category not in grouped:
            grouped[category] = []
        grouped[category].append(generate_changelog_entry(commit, script_name))
    
    # Build changelog content
    today = datetime.now().strftime('%Y-%m-%d')
    lines = [f"## v{version} ({today})"]
    lines.append("")
    
    type_order = ['feat', 'fix', 'docs', 'refactor', 'test', 'style', 'chore']
    type_headers = {
        'feat': '### Features',
        'fix': '### Bug Fixes',
        'docs': '### Documentation',
        'refactor': '### Refactoring',
        'test': '### Testing',
        'style': '### Style',
        'chore': '### Miscellaneous'
    }
    
    for commit_type in type_order:
        if commit_type in grouped:
            lines.append(type_headers.get(commit_type, f'### {commit_type.capitalize()}'))
            lines.append("")
            for entry in grouped[commit_type]:
                lines.append(entry)
            lines.append("")
    
    return '\n'.join(lines), version

def update_changelog_file(changelog_path, new_content):
    """Update changelog file with new entry at the top."""
    if not os.path.exists(changelog_path):
        # Create new changelog
        with open(changelog_path, 'w', encoding='utf-8') as f:
            f.write(f"# {Path(changelog_path).parent.name} Changelog\n")
            f.write("=" * 40 + "\n\n")
            f.write(new_content + "\n")
        return True
    
    # Read existing content
    with open(changelog_path, 'r', encoding='utf-8') as f:
        existing = f.read()
    
    # Insert new content at the top (after header if exists)
    if existing.startswith('#'):
        # Find end of header section
        lines = existing.split('\n')
        insert_pos = 0
        for i, line in enumerate(lines):
            if line.strip() == '' and i > 0 and lines[i-1].strip() == '':
                insert_pos = i
                break
        lines.insert(insert_pos, new_content + "\n")
        new_content = '\n'.join(lines)
    else:
        new_content = new_content + "\n\n" + existing
    
    with open(changelog_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True

def main():
    print("=" * 70)
    print("MoDuL's Hub - Auto-Release Tool")
    print("=" * 70)
    
    base_dir = Path.cwd()
    
    # Get recent commits
    print("\n📋 Fetching recent git commits...\n")
    commits = get_git_commits()
    print(f"Found {len(commits)} recent commits\n")
    
    results = []
    
    for script_name, config in SCRIPT_CONFIG.items():
        userjs_path = base_dir / config['userjs']
        changelog_path = base_dir / config['changelog']
        
        if not userjs_path.exists():
            continue
        
        version = get_script_version(str(userjs_path))
        if not version:
            continue
        
        changelog_content, detected_version = generate_changelog(script_name, config, commits)
        
        if changelog_content:
            print(f"📝 {config['display_name']}: v{version}")
            print(f"   Generated changelog with {len(re.findall(r'^-', changelog_content, re.MULTILINE))} entries")
            
            # Update changelog file
            if update_changelog_file(str(changelog_path), changelog_content):
                print(f"   ✅ Updated {config['changelog']}")
                results.append({
                    'script': config['display_name'],
                    'version': version,
                    'changelog_updated': True
                })
            else:
                print(f"   ❌ Failed to update changelog")
        else:
            print(f"ℹ️  {config['display_name']}: v{version} (no new commits)")
    
    print("\n" + "=" * 70)
    print(f"✅ Auto-release complete. {len(results)} changelogs updated.")
    print("=" * 70)

if __name__ == '__main__':
    main()
