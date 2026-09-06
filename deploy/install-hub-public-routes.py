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
if "import { registerHubPublicRoutes }" not in old:
    new = "import { registerHubPublicRoutes } from './hub-public-routes.mjs';\n" + old
    new = new.replace(anchor, 'registerHubPublicRoutes(app);\n\n' + anchor)
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
