from PIL import Image, ImageDraw, ImageFont

COLOR_NAVY = (2, 22, 46)
COLOR_RED  = (208, 32, 43)

FONT_PATHS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
]

def lerp(a, b, t):
    return int(a + (b - a) * t)

def make_bg(size):
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

def get_ems_font(size):
    """Même logique que l'icône originale : EMS prend 78% de la largeur."""
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

def get_dev_font(size):
    """DEV en petite police — environ 28% de la hauteur de l'icône."""
    target = max(6, int(size * 0.22))
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, target)
        except:
            pass
    return ImageFont.load_default()

def make_frame(size):
    img = make_bg(size)
    d = ImageDraw.Draw(img)

    # Police EMS — identique à l'icône originale (grande)
    font_ems = get_ems_font(size)
    bb1 = d.textbbox((0, 0), 'EMS', font=font_ems)
    tw1, th1 = bb1[2] - bb1[0], bb1[3] - bb1[1]

    # Police DEV — petite, en bas
    font_dev = get_dev_font(size)
    bb2 = d.textbbox((0, 0), 'DEV', font=font_dev)
    tw2, th2 = bb2[2] - bb2[0], bb2[3] - bb2[1]

    # Décaler EMS légèrement vers le haut pour faire de la place à DEV
    gap = max(1, size // 20)
    total_h = th1 + gap + th2
    y1 = (size - total_h) // 2
    y2 = y1 + th1 + gap

    sh = max(1, size // 48)
    # EMS blanc avec ombre
    d.text(((size - tw1)//2 + sh, y1 + sh), 'EMS', fill=(0, 0, 0, 180), font=font_ems)
    d.text(((size - tw1)//2, y1), 'EMS', fill=(255, 255, 255, 255), font=font_ems)
    # DEV jaune avec ombre
    d.text(((size - tw2)//2 + sh, y2 + sh), 'DEV', fill=(0, 0, 0, 180), font=font_dev)
    d.text(((size - tw2)//2, y2), 'DEV', fill=(255, 220, 50, 255), font=font_dev)

    return img.convert('RGBA')

frames = [make_frame(s) for s in [16, 32, 48, 64, 128, 256]]
frames[0].save('/tmp/ems_dev.ico', format='ICO',
               sizes=[(s, s) for s in [16, 32, 48, 64, 128, 256]],
               append_images=frames[1:])
print('OK /tmp/ems_dev.ico')
