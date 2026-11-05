"""Install only the reviewed UI UX Pro Max skill from the user-supplied ZIP."""
from pathlib import Path, PurePosixPath
import stat
import zipfile

root = Path(__file__).resolve().parents[1]
archive = Path('C:/Users/Admin/Desktop/ui-ux-pro-max-skill-main.zip')
destination = root / '.agents/skills/ui-ux-pro-max'
prefix = 'ui-ux-pro-max-skill-main/.claude/skills/ui-ux-pro-max/'

with zipfile.ZipFile(archive) as z:
    members = [i for i in z.infolist() if i.filename.startswith(prefix) and not i.is_dir()]
    if not members or sum(i.file_size for i in members) > 30_000_000:
        raise SystemExit('Unexpected skill archive contents')
    for info in members:
        relative = PurePosixPath(info.filename[len(prefix):])
        if relative.is_absolute() or '..' in relative.parts or stat.S_ISLNK(info.external_attr >> 16):
            raise SystemExit('Unsafe archive member rejected')
        target = (destination / str(relative)).resolve()
        if not target.is_relative_to(destination.resolve()):
            raise SystemExit('Archive path escaped skill directory')
        if target.exists():
            if target.read_bytes() != z.read(info):
                raise SystemExit('Existing skill differs; refusing overwrite: ' + str(relative))
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(z.read(info))
print(f'Installed {len(members)} skill resources in {destination}')
