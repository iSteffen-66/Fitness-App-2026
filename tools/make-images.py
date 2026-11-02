#!/usr/bin/env python3
"""Erzeugt die Standardbilder (WebP, max. 1200 px breit, EXIF-Ausrichtung korrigiert).
Die Originale in fotos/ bleiben unverändert.   Aufruf: python3 tools/make-images.py"""
import glob, os, re
from PIL import Image, ImageOps

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'app', 'img')
os.makedirs(out, exist_ok=True)
for f in sorted(glob.glob(os.path.join(root, 'fotos', '[0-9][0-9]-*.jp*g'))):
    nr = re.match(r'(\d\d)-', os.path.basename(f)).group(1)
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    if im.width > 1200:
        im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    dst = os.path.join(out, f'{nr}.webp')
    im.save(dst, 'WEBP', quality=78, method=6)
    print(os.path.basename(f), '->', dst, im.size, os.path.getsize(dst) // 1024, 'KB')
