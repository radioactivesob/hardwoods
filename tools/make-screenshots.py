#!/usr/bin/env python3
"""Compose App Store marketing screenshots: branded caption + screen inset.

The simulator status bar / Dynamic Island is trimmed by offsetting the image
inside its clip rect rather than rewriting the PNG (sips won't crop portrait).
"""
import base64, subprocess, os

SRC = "/Users/radioactivesob/Projects/hardwoods/appstore"
OUT = os.path.join(SRC, "marketing")
W, H = 1320, 2868
TRIM = 170                      # status-bar strip to hide (iPhone island)

BG, GOLD, GOLD_BR = "#241608", "#C8A040", "#FFC93C"
WHITE, SUB, EDGE = "#FFFFFF", "#9A8355", "#8B6914"
FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"

TOP, BOT = 490, 140
AVAIL = H - TOP - BOT

os.makedirs(OUT, exist_ok=True)
_cache = {}


def size(path):
    if path not in _cache:
        out = subprocess.check_output(["sips", "-g", "pixelWidth",
                                       "-g", "pixelHeight", path]).decode()
        w = int(out.split("pixelWidth:")[1].split()[0])
        h = int(out.split("pixelHeight:")[1].split()[0])
        _cache[path] = (w, h)
    return _cache[path]


def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def inset(path, x, y, box_w, idx):
    """Emit SVG for one screen inset, trimming the status bar via the clip."""
    sw, sh = size(path)
    portrait = sh > sw

    if portrait:                       # trim from the top
        scale = box_w / sw
        box_h = (sh - TRIM) * scale
        img_x, img_y = x, y - TRIM * scale
    else:                              # trim from the right edge
        scale = box_w / (sw - TRIM)
        box_h = sh * scale
        img_x, img_y = x, y

    return box_h, (
        f'<clipPath id="c{idx}"><rect x="{x:.1f}" y="{y:.1f}" '
        f'width="{box_w:.1f}" height="{box_h:.1f}" rx="34"/></clipPath>'
        f'<image x="{img_x:.1f}" y="{img_y:.1f}" width="{sw*scale:.1f}" '
        f'height="{sh*scale:.1f}" clip-path="url(#c{idx})" '
        f'xlink:href="data:image/png;base64,{b64(path)}"/>'
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{box_w:.1f}" height="{box_h:.1f}" '
        f'rx="34" fill="none" stroke="{EDGE}" stroke-width="5"/>'
    )


def eff_ar(path):
    sw, sh = size(path)
    return sw / (sh - TRIM) if sh > sw else (sw - TRIM) / sh


def frame(headline, subhead, shots, out_name):
    paths = [os.path.join(SRC, s) for s in shots]
    gap = 56

    if len(paths) == 1:
        ar = eff_ar(paths[0])
        if ar < 1:                                  # portrait screen
            box_w = min(W * 0.80, AVAIL * ar)
        else:                                       # landscape screen
            box_w = W * 0.94
        widths = [box_w]
    else:
        widths = [W * 0.91] * len(paths)

    heights = [w / eff_ar(p) for p, w in zip(paths, widths)]
    total = sum(heights) + gap * (len(paths) - 1)
    y = TOP + (AVAIL - total) / 2

    parts = []
    for i, (p, bw) in enumerate(zip(paths, widths)):
        bh, svg = inset(p, (W - bw) / 2, y, bw, i)
        parts.append(svg)
        y += bh + gap

    doc = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<rect width="{W}" height="{H}" fill="{BG}"/>
<text x="{W/2}" y="{196*W/1320:.0f}" font-family="{FONT}" font-size="{34*W/1320:.0f}" font-weight="bold"
      letter-spacing="{11*W/1320:.0f}" fill="{GOLD}" text-anchor="middle">HARDWOODS</text>
<rect x="{W/2-46*W/1320:.0f}" y="{232*W/1320:.0f}" width="{92*W/1320:.0f}" height="4" rx="2" fill="{GOLD_BR}"/>
<text x="{W/2}" y="{342*W/1320:.0f}" font-family="{FONT}" font-size="{76*W/1320:.0f}" font-weight="bold"
      fill="{WHITE}" text-anchor="middle">{headline}</text>
<text x="{W/2}" y="{412*W/1320:.0f}" font-family="{FONT}" font-size="{37*W/1320:.0f}"
      fill="{SUB}" text-anchor="middle">{subhead}</text>
{"".join(parts)}
</svg>'''

    tmp = f"/tmp/_f_{out_name}.svg"
    with open(tmp, "w") as f:
        f.write(doc)
    subprocess.run(["rsvg-convert", "-w", str(W), "-h", str(H), tmp,
                    "-o", os.path.join(OUT, out_name)], check=True)
    os.remove(tmp)
    print(f"  {out_name}")


IPAD_SRC = os.path.join(SRC, "ipad")
IPAD_FRAMES = [
    ("Watch them improve",    "Game-by-game trends, all season long",
     ["02-kidseason.png"],   "01-season.png"),
    ("Four ways to score",    "Pick the one that fits your night",
     ["01-landing.png"],     "02-modes.png"),
    ("See how you stack up",  "Every archived game, by team",
     ["03-teamseasons.png"], "03-teams.png"),
    ("Just need the score?",  "Two teams, no roster, no setup",
     ["04-simplegame.png"],  "04-simple.png"),
]

FRAMES = [
    ("Chart every shot",      "Shooting drills with a tap-to-record court",
     ["11-trainingresult.png"],                              "01-training.png"),
    ("Watch them improve",    "Game-by-game trends, all season long",
     ["07-kidseason.png"],                                   "02-season.png"),
    ("Run the official book", "Rosters, fouls, periods, box scores",
     ["02-scoreboard.png", "03-scoring.png", "04-scorebook.png"], "03-book.png"),
    ("Track your kid",        "From the stands, one tap at a time",
     ["06-kidgame.png"],                                     "04-track.png"),
    ("Send it to the family", "Stat cards you can text in a tap",
     ["08-sharecard.png"],                                   "05-share.png"),
    ("Just need the score?",  "Two teams, no roster, no setup",
     ["10-simplegame.png"],                                  "06-simple.png"),
    ("Five ways to use it",   "Pick the one that fits your night",
     ["01-landing.png"],                                     "07-modes.png"),
    ("Practice adds up",      "Every session, every zone, all season",
     ["12-traininghistory.png"],                             "08-history.png"),
]

print("iPhone frames:")
for f in FRAMES:
    frame(*f)

# iPad: bigger canvas, no notch to trim
SRC, OUT = IPAD_SRC, os.path.join(OUT, "ipad")
W, H = 2064, 2752
TRIM = 0
TOP, BOT = 780, 150
AVAIL = H - TOP - BOT
os.makedirs(OUT, exist_ok=True)
print("iPad frames:")
for f in IPAD_FRAMES:
    frame(*f)
print("done")
