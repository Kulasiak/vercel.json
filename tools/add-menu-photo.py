#!/usr/bin/env python3
"""Aggiunge una foto a una categoria del menu.

Uso:
    python3 tools/add-menu-photo.py <file-immagine> <id-categoria>

Esempio:
    python3 tools/add-menu-photo.py ~/Download/bistecca.jpg carne

Ridimensiona e comprime l'immagine (max 1600px di larghezza, JPEG di qualita'
82), la salva in src/assets/img/<id-categoria>.jpg e imposta il campo "photo"
della categoria in src/menu.json. Poi basta lanciare `node build.mjs`.

Richiede Pillow:  pip install Pillow
"""
import json
import re
import pathlib
import sys

MAX_W = 1600
QUALITY = 82
ROOT = pathlib.Path(__file__).resolve().parent.parent
MENU = ROOT / "src" / "menu.json"
IMG_DIR = ROOT / "src" / "assets" / "img"


def die(msg):
    print(f"errore: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    if len(sys.argv) != 3:
        die("uso: add-menu-photo.py <file-immagine> <id-categoria>")

    src, cat_id = pathlib.Path(sys.argv[1]).expanduser(), sys.argv[2]
    if not src.is_file():
        die(f"immagine non trovata: {src}")

    raw = MENU.read_text(encoding="utf-8")
    menu = json.loads(raw)
    ids = [c["id"] for c in menu["categories"]]
    if cat_id not in ids:
        die(f"categoria '{cat_id}' inesistente. Disponibili: {', '.join(ids)}")

    try:
        from PIL import Image, ImageOps
    except ImportError:
        die("Pillow non installato. Esegui: pip install Pillow")

    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        IMG_DIR.mkdir(parents=True, exist_ok=True)
        out = IMG_DIR / f"{cat_id}.jpg"
        im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        size = im.size

    # Modifica chirurgica: tocca solo la riga della categoria, il resto del
    # file (indentazione, colonne allineate dei piatti) resta identico.
    line = re.compile(
        r'^(?P<pad>[ \t]*)"id":\s*"%s"(?P<rest>.*)$' % re.escape(cat_id), re.M
    )
    m = line.search(raw)
    if not m:
        die(f'riga della categoria "{cat_id}" non trovata in menu.json')
    rest = re.sub(r',?\s*"photo":\s*"[^"]*"', "", m.group("rest"))
    updated = f'{m.group("pad")}"id": "{cat_id}"{rest.rstrip()} "photo": "{out.name}",'
    raw = raw[: m.start()] + updated + raw[m.end() :]
    json.loads(raw)  # il file deve restare JSON valido
    MENU.write_text(raw, encoding="utf-8")

    kb = out.stat().st_size / 1024
    print(f"{out.relative_to(ROOT)}  {size[0]}x{size[1]}  {kb:.0f} KB")
    print(f'menu.json: categoria "{cat_id}" -> "photo": "{out.name}"')
    print("ora lancia: node build.mjs")


if __name__ == "__main__":
    main()
