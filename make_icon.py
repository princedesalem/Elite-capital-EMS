from PIL import Image, ImageDraw, ImageFont
import os

COLOR_NAVY = (2,   22,  46)
COLOR_RED  = (208, 32,  43)

FONT_PATHS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
]

def lerp(a, b, t):
    return int(a + (b - a) * t)

def make_bg(size):
    """70% solid navy, rightmost 30% fades navy->red."""
    img = Image.new('RGBA', (size, size))
    pixels = img.load()
    split = 0.70
    for x in range(size):
        frac = x / max(size - 1, 1)
        t = 0.0 if frac < split else (frac - split) / (1.0 - split)
        c = (lerp(COLOR_NAVY[0], COLOR_RED[0], t),
             lerp(COLOR_NAVY[1], COLOR_RED[1], t),
             lerp(COLOR_NAVY[2], COLOR_RED[2], t), 255)
        for y in range(size):
            pixels[x, y] = c
    return img

def get_font(size):
    """Return the largest bold font where 'EMS' fits within 78% of icon width."""
    max_w = int(size * 0.78)
    for frac in [0.72, 0.65, 0.58, 0.50, 0.42]:
        fs = max(6, int(size * frac))
        for path in FONT_PATHS:
            try:
                f = ImageFont.truetype(path, fs)
                bb = ImageDraw.Draw(Image.new('RGBA', (size, size))).textbbox((0, 0), 'EMS', font=f)
                if bb[2] - bb[0] <= max_w:
                    return f
            except:
                pass
    return ImageFont.load_default()

def make_frame(size):
    img = make_bg(size)
    d = ImageDraw.Draw(img)
    font = get_font(size)

    text = 'EMS'
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx = (size - tw) // 2
    ty = (size - th) // 2

    # Shadow proportional to size
    sh = max(1, size // 48)
    d.text((tx + sh, ty + sh), text, fill=(0, 0, 0, 180), font=font)
    # White text
    d.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)
    return img

sizes = [256, 64, 48, 32, 16]
frames = [make_frame(s) for s in sizes]
out = '/out/ems-icon.ico'
frames[0].save(out, format='ICO', sizes=[(s, s) for s in sizes], append_images=frames[1:])
print('Done:', os.path.getsize(out), 'bytes')
