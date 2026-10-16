#!/usr/bin/env python3
"""Install only the public hub routes on the VM's Express entry point."""
import pathlib
import shutil
import subprocess
import sys
import tempfile

source = pathlib.Path(sys.argv[1]).resolve()
server = pathlib.Path('/opt/torn-licences-generator/src/server.js')
target = server.with_name('hub-public-routes.mjs')
old = server.read_text()
anchor = "const registerRawProxy = createRawProxy(app, express);"
if old.count(anchor) != 1:
    raise SystemExit('Unexpected server layout; no changes made')
new = old
old_import = "import { registerHubPublicRoutes } from './hub-public-routes.mjs';"
new_import = "import { registerHubActivityRoute, registerHubPublicRoutes } from './hub-public-routes.mjs';"
if old_import in new:
    new = new.replace(old_import, new_import, 1)
elif new_import not in new:
    new = new_import + "\n" + new
if "registerHubPublicRoutes(app);" not in new:
    new = new.replace(anchor, 'registerHubPublicRoutes(app);\n\n' + anchor)
activity_anchor = "app.use(cors({"
activity_call = "registerHubActivityRoute(app, { query, requestMeta });\n\n"
if new.count(activity_anchor) != 1:
    raise SystemExit('Unexpected CORS layout; no changes made')
if "registerHubActivityRoute(app" not in new:
    new = new.replace(activity_anchor, activity_call + activity_anchor, 1)

old_log_pattern = "return /^\\/(?:api|license|workspace|internal|tanoth)\\b/.test(req.path);"
new_log_pattern = "return /^\\/(?:api|license|workspace|internal|tanoth|racestats)\\b/.test(req.path);"
if old_log_pattern in new:
    new = new.replace(old_log_pattern, new_log_pattern, 1)
elif new_log_pattern not in new:
    raise SystemExit('Unexpected request logger layout; no changes made')
backup = pathlib.Path(tempfile.mkdtemp(prefix='hub-public-routes-', dir='/var/backups'))
shutil.copy2(server, backup / 'server.js')
if target.exists():
    shutil.copy2(target, backup / target.name)
try:
    shutil.copyfile(source, target)
    target.chmod(0o644)
    server.write_text(new)
    subprocess.run(['node', '--check', str(target)], check=True)
    subprocess.run(['node', '--check', str(server)], check=True)
except Exception:
    shutil.copy2(backup / 'server.js', server)
    if (backup / target.name).exists():
        shutil.copy2(backup / target.name, target)
    raise
print(f'Installed public hub routes. Backup: {backup}')
print('Restart pythagoras-license-api after reviewing syntax checks.')
