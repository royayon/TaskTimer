import os
from PIL import Image, ImageDraw

assets_dir = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
os.makedirs(assets_dir, exist_ok=True)

# 1. High-Res App Icon (256x256)
size = 256
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Squircle dark background
padding = 10
rx = 55
bg_box = [padding, padding, size - padding, size - padding]
draw.rounded_rectangle(bg_box, radius=rx, fill=(15, 15, 18, 255), outline=(45, 45, 50, 255), width=3)

# Glowing circle / track
cx, cy = size // 2, size // 2 + 8
r = 80
draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(38, 38, 42, 255), width=14)

# Active timer arc (iOS Amber/Orange #FF9F0A)
draw.arc([cx - r, cy - r, cx + r, cy + r], start=270, end=140, fill=(255, 159, 10, 255), width=14)

# Top stopwatch button
btn_w, btn_h = 28, 12
draw.rounded_rectangle([cx - btn_w//2, padding + 16, cx + btn_w//2, padding + 16 + btn_h], radius=4, fill=(255, 159, 10, 255))

# Center knob & timer hand
draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 255, 255, 255))
draw.line([cx, cy, cx, cy - 50], fill=(255, 255, 255, 255), width=6)
draw.line([cx, cy, cx + 36, cy + 18], fill=(255, 159, 10, 255), width=5)

icon_path = os.path.join(assets_dir, 'icon.png')
img.save(icon_path, 'PNG')
print(f"Saved {icon_path}")

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

tray_path = os.path.join(assets_dir, 'tray.png')
tray_img.save(tray_path, 'PNG')
print(f"Saved {tray_path}")

# 3. Active Alert Tray Icon (32x32)
active_img = Image.new('RGBA', (tray_size, tray_size), (0, 0, 0, 0))
active_draw = ImageDraw.Draw(active_img)
active_draw.ellipse([tcx - tr, tcy - tr, tcx + tr, tcy + tr], fill=(255, 159, 10, 70), outline=(255, 159, 10, 255), width=3)
active_draw.rectangle([14, 2, 18, 5], fill=(255, 159, 10, 255))
active_draw.line([tcx, tcy, tcx, tcy - 6], fill=(255, 255, 255, 255), width=2)
active_draw.ellipse([tcx - 2, tcy - 2, tcx + 2, tcy + 2], fill=(255, 255, 255, 255))

active_path = os.path.join(assets_dir, 'tray-active.png')
active_img.save(active_path, 'PNG')
print(f"Saved {active_path}")
