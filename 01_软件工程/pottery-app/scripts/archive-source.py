"""Create a source-only handoff; no dependency caches, personal data or keys."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import os
import json
root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
out = root.parents[1] / '05_交付归档' / '安卓APP' / f'非遗之手-App源码-{version}.zip'
out.parent.mkdir(parents=True, exist_ok=True)
excluded = {'node_modules', '.toolchain', '.gradle', 'build', 'dist', '.git', 'qa', 'xcuserdata', '.build'}
files = []
for folder, dirs, names in os.walk(root):
    dirs[:] = [name for name in dirs if name not in excluded]
    for name in names:
        path = Path(folder) / name
        if path.name == 'local.properties' or path.suffix in {'.log', '.keystore', '.jks'}:
            continue
        files.append(path)
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, Path('pottery-app') / path.relative_to(root))
print(f'{out}: {len(files)} files')
