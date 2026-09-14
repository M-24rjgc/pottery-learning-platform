from pathlib import Path
from zipfile import ZipFile
import hashlib
import json

root = Path(__file__).resolve().parents[1]
delivery = root.parents[1] / '05_交付归档' / '安卓APP'
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
apk = delivery / f'非遗之手-{version}-debug.apk'
sha = hashlib.sha256(apk.read_bytes()).hexdigest().upper()
assert apk.with_suffix('.apk.sha256').read_text(encoding='utf-8-sig').startswith(sha)
with ZipFile(apk) as archive:
    assert archive.testzip() is None
    assert 'AndroidManifest.xml' in archive.namelist()
    assert any(n.startswith('classes') and n.endswith('.dex') for n in archive.namelist())
    for path in (root / 'dist').rglob('*'):
        if path.is_file():
            name = 'assets/public/' + path.relative_to(root / 'dist').as_posix()
            assert archive.read(name) == path.read_bytes(), name
    config = json.loads(archive.read('assets/capacitor.config.json'))
    assert config['appId'] == 'cn.pottery.glove.companion'
    assert not config.get('server', {}).get('url'), 'App must load bundled UI'
with ZipFile(delivery / f'非遗之手-App源码-{version}.zip') as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert 'pottery-app/android/gradlew.bat' in names
    assert 'pottery-app/package-lock.json' in names
    assert not any('/node_modules/' in n or '/.toolchain/' in n or n.endswith('local.properties') for n in names)
print(json.dumps({'apkBytes':apk.stat().st_size,'sha256':sha,'webAssetsMatch':True,'sourceArchiveVerified':True},indent=2))
