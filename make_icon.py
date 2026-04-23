from PIL import Image, ImageDraw, ImageFont
import os

# Navy (dominant, ~75%) left -> Red (accent, ~25%) right
COLOR_NAVY  = (2,   22,  46)
COLOR_RED   = (208, 32,  43)
COLOR_TEXT  = (255, 255, 255)

def lerp(a, b, t):
    return int(a + (b - a) * t)

def make_gradient(size):
    """Gradient: navy dominates (0-75%), red only in last 25%."""
    img = Image.new('RGBA', (size, size))
    pixels = img.load()
    split = 0.72  # blue until 72% of width, then transitions to red
    for x in range(size):
        frac = x / max(size - 1, 1)
        if frac < split:
            t = 0.0
        else:
            t = (frac - split) / (1.0 - split)
        r = lerp(COLOR_NAVY[0], COLOR_RED[0], t)
        g = lerp(COLOR_NAVY[1], COLOR_RED[1], t)
        b = lerp(COLOR_NAVY[2], COLOR_RED[2], t)
        for y in range(size):
            pixels[x, y] = (r, g, b, 255)
    return img

def make_frame(size):
    img = make_gradient(size)
    d = ImageDraw.Draw(img)

    # Text — very large, fills the icon like a navbar logo
    font_size = max(8, int(size * 0.65))
    font = None
    for path in [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    ]:
        try:
            font = ImageFont.truetype(path, font_size)
            break
        except:
            pass
    if font is None:
        font = ImageFont.load_default()

    text = 'EMS'
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2
    ty = (size - th) // 2 - int(size * 0.02)

    # Subtle shadow for legibility
    shadow = max(1, size // 64)
    d.text((tx + shadow, ty + shadow), text, fill=(0, 0, 0, 160), font=font)
    # White text
    d.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)

    return img

sizes = [256, 64, 48, 32, 16]
frames = [make_frame(s) for s in sizes]
out = '/out/ems-icon.ico'
frames[0].save(out, format='ICO', sizes=[(s, s) for s in sizes], append_images=frames[1:])
print('Done:', os.path.getsize(out), 'bytes')
