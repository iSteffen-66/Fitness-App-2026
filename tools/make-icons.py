#!/usr/bin/env python3
"""Erzeugt die App-Icons (Hantel auf dunklem Grund).   Aufruf: python3 tools/make-icons.py"""
import os
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'app', 'icons')
os.makedirs(out, exist_ok=True)

def draw(size, maskable=False):
    S = size * 4
    im = Image.new('RGB', (S, S), '#0f1115')
    d = ImageDraw.Draw(im)
    pad = 0 if maskable else 0
    if not maskable:
        d.rounded_rectangle((0, 0, S, S), radius=int(S * 0.22), fill='#0f1115')
    sc = 0.62 if maskable else 0.78
    cx, cy = S / 2, S / 2
    w, h = S * sc, S * sc * 0.5
    col = '#ff5a3c'
    u = w / 10
    d.rounded_rectangle((cx - 3.2 * u, cy - 0.35 * u, cx + 3.2 * u, cy + 0.35 * u), radius=int(u * .3), fill='#f2f4f8')
    for sgn in (-1, 1):
        d.rounded_rectangle((cx + sgn * 3.2 * u - 0.5 * u, cy - 2.2 * u, cx + sgn * 3.2 * u + 0.5 * u, cy + 2.2 * u), radius=int(u * .3), fill=col)
        x0 = cx + sgn * 4.2 * u
        d.rounded_rectangle((min(x0, x0 + sgn * 0.8 * u), cy - 1.6 * u, max(x0, x0 + sgn * 0.8 * u), cy + 1.6 * u), radius=int(u * .25), fill=col)
    return im.resize((size, size), Image.LANCZOS)

draw(192).save(os.path.join(out, 'icon-192.png'))
draw(512).save(os.path.join(out, 'icon-512.png'))
draw(512, True).save(os.path.join(out, 'icon-maskable-512.png'))
draw(180).save(os.path.join(out, 'apple-touch-icon.png'))
print('Icons erzeugt')
