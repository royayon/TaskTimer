import os
from PIL import Image, ImageDraw

base_dir = os.path.dirname(__file__)
assets_dir = os.path.join(base_dir, '..', 'src', 'assets')
build_dir = os.path.join(base_dir, '..', 'build')

os.makedirs(assets_dir, exist_ok=True)
os.makedirs(build_dir, exist_ok=True)

# 1. High-Res App Icon (512x512)
size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

padding = 24
rx = 110
bg_box = [padding, padding, size - padding, size - padding]
draw.rounded_rectangle(bg_box, radius=rx, fill=(15, 15, 18, 255), outline=(50, 50, 56, 255), width=6)

# Glowing circle / track
cx, cy = size // 2, size // 2 + 16
r = 160
draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(40, 40, 46, 255), width=28)

# Active timer arc (iOS Amber/Orange #FF9F0A)
draw.arc([cx - r, cy - r, cx + r, cy + r], start=270, end=140, fill=(255, 159, 10, 255), width=28)

# Top stopwatch button
btn_w, btn_h = 56, 24
draw.rounded_rectangle([cx - btn_w//2, padding + 32, cx + btn_w//2, padding + 32 + btn_h], radius=8, fill=(255, 159, 10, 255))

# Center knob & timer hand
draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(255, 255, 255, 255))
draw.line([cx, cy, cx, cy - 100], fill=(255, 255, 255, 255), width=12)
draw.line([cx, cy, cx + 72, cy + 36], fill=(255, 159, 10, 255), width=10)

# Save 512x512 PNGs
img.save(os.path.join(assets_dir, 'icon.png'), 'PNG')
img.save(os.path.join(build_dir, 'icon.png'), 'PNG')

# Save multi-size ICO
ico_sizes = [(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)]
img.save(os.path.join(assets_dir, 'icon.ico'), format='ICO', sizes=ico_sizes)
img.save(os.path.join(build_dir, 'icon.ico'), format='ICO', sizes=ico_sizes)
print("Saved 512x512 icon.png and icon.ico in both src/assets and build/")

# 2. Tray Icon (32x32)
tray_size = 32
tray_img = Image.new('RGBA', (tray_size, tray_size), (0, 0, 0, 0))
tray_draw = ImageDraw.Draw(tray_img)

tcx, tcy = 16, 17
tr = 11
tray_draw.ellipse([tcx - tr, tcy - tr, tcx + tr, tcy + tr], outline=(240, 240, 240, 255), width=2)
tray_draw.arc([tcx - tr, tcy - tr, tcx + tr, tcy + tr], start=270, end=90, fill=(255, 159, 10, 255), width=3)
tray_draw.rectangle([14, 2, 18, 5], fill=(240, 240, 240, 255))
tray_draw.line([tcx, tcy, tcx, tcy - 6], fill=(255, 159, 10, 255), width=2)
tray_draw.ellipse([tcx - 2, tcy - 2, tcx + 2, tcy + 2], fill=(255, 255, 255, 255))

tray_img.save(os.path.join(assets_dir, 'tray.png'), 'PNG')

# 3. Active Alert Tray Icon (32x32)
active_img = Image.new('RGBA', (tray_size, tray_size), (0, 0, 0, 0))
active_draw = ImageDraw.Draw(active_img)
active_draw.ellipse([tcx - tr, tcy - tr, tcx + tr, tcy + tr], fill=(255, 159, 10, 70), outline=(255, 159, 10, 255), width=3)
active_draw.rectangle([14, 2, 18, 5], fill=(255, 159, 10, 255))
active_draw.line([tcx, tcy, tcx, tcy - 6], fill=(255, 255, 255, 255), width=2)
active_draw.ellipse([tcx - 2, tcy - 2, tcx + 2, tcy + 2], fill=(255, 255, 255, 255))

active_img.save(os.path.join(assets_dir, 'tray-active.png'), 'PNG')
print("All icons successfully updated!")
