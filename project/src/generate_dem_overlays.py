"""
Generate transparent RGBA PNG overlays for:
1. Watershed boundary (orange outline)
2. Drainage stream network (cyan stream paths)
for the demo sites in web/public/demo-data/.
These match the exact dimensions and CRS bounds of the satellite images so they
render as clean, toggleable Leaflet overlays.
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WEB_PUBLIC = Path(__file__).resolve().parents[2] / "web" / "public" / "demo-data"

SITES = ["kadwanchi_watershed", "tamhini_ghat_forest", "donimalai_barren", "jayakwadi_dam_water"]

def generate_overlays_for_site(site_dir: Path):
    # Find reference image
    ref_img_path = site_dir / "t2.png"
    if not ref_img_path.exists():
        ref_img_path = site_dir / "s1.png"
    if not ref_img_path.exists():
        print(f"Skipping {site_dir.name} (no t2/s1 found)")
        return

    ref_img = Image.open(ref_img_path)
    w, h = ref_img.size

    # 1. Watershed Boundary (orange line)
    boundary_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(boundary_img)

    # Semi-organic catchment perimeter polygon
    cx, cy = w * 0.5, h * 0.5
    rx, ry = w * 0.42, h * 0.44
    num_pts = 36
    angles = np.linspace(0, 2 * np.pi, num_pts, endpoint=False)
    
    np.random.seed(hash(site_dir.name) % 100000)
    radial_variations = 1.0 + 0.14 * np.sin(3 * angles) + 0.08 * np.cos(5 * angles) + np.random.uniform(-0.05, 0.05, num_pts)
    
    poly_pts = []
    for a, r_var in zip(angles, radial_variations):
        px = cx + np.cos(a) * rx * r_var
        py = cy + np.sin(a) * ry * r_var
        poly_pts.append((max(10, min(w - 10, px)), max(10, min(h - 10, py))))

    # Draw closed boundary line
    b_draw.line(poly_pts + [poly_pts[0]], fill=(255, 140, 0, 240), width=3)
    boundary_path = site_dir / "watershed_boundary.png"
    boundary_img.save(boundary_path)
    print(f"Saved {boundary_path}")

    # 2. Drainage Network (cyan stream branches)
    drainage_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d_draw = ImageDraw.Draw(drainage_img)

    # Pour point / lowest point (outlet)
    outlet_x = cx + rx * 0.65
    outlet_y = cy + ry * 0.60

    # Generate dendritic river branches converging to outlet
    def draw_branch(start_x, start_y, end_x, end_y, depth=0, max_depth=3):
        if depth > max_depth:
            return
        
        # Intermediate curving points
        mx = (start_x + end_x) / 2 + np.random.uniform(-25, 25)
        my = (start_y + end_y) / 2 + np.random.uniform(-25, 25)
        
        width = max(1, 4 - depth)
        d_draw.line([(start_x, start_y), (mx, my), (end_x, end_y)], fill=(0, 200, 255, 220), width=width)
        
        # Sub-tributaries
        if depth < max_depth:
            sub_count = np.random.randint(1, 3)
            for _ in range(sub_count):
                angle = np.random.uniform(0.3, 0.9) * (1 if np.random.rand() > 0.5 else -1)
                length = np.hypot(end_x - start_x, end_y - start_y) * 0.65
                dx = (mx - start_x) * np.cos(angle) - (my - start_y) * np.sin(angle)
                dy = (mx - start_x) * np.sin(angle) + (my - start_y) * np.cos(angle)
                norm = np.hypot(dx, dy) + 1e-5
                tx = mx - (dx / norm) * length
                ty = my - (dy / norm) * length
                draw_branch(tx, ty, mx, my, depth + 1, max_depth)

    # Main stream stems
    stems = [
        (cx - rx * 0.7, cy - ry * 0.6),
        (cx, cy - ry * 0.8),
        (cx - rx * 0.8, cy + ry * 0.1),
        (cx + rx * 0.2, cy - ry * 0.5),
    ]

    for sx, sy in stems:
        draw_branch(sx, sy, outlet_x, outlet_y, depth=0, max_depth=3)

    drainage_path = site_dir / "drainage_network.png"
    drainage_img.save(drainage_path)
    print(f"Saved {drainage_path}")

def main():
    for s in SITES:
        site_dir = WEB_PUBLIC / s
        if site_dir.exists():
            generate_overlays_for_site(site_dir)

if __name__ == "__main__":
    main()
