# La rosa del Jardín (zona Relaciones), modelada en Blender por código.
#
# Cada pétalo es una superficie que nace cerca del centro y se enrolla alrededor del
# eje de la flor: los de dentro, pequeños y cerrados, envuelven el corazón; los de
# fuera, anchos, se abren y doblan el borde hacia atrás como en una rosa de verdad.
# Se colocan en espiral con el ángulo áureo (137,5°). La malla se genera dos veces
# con la misma topología, en capullo y abierta, y el visor anima entre las dos.
# Sépalos, tallo con espinas y dos hojas aserradas completan la planta.
#
# Coordenadas como en three.js: metros, y arriba. Salida NLF1
# (src/components/love/rose/nlf.ts) y, si se pide, una lámina de control.
#
# Uso: blender -b --factory-startup -P rose.py -- --out f.nlf [--render f.png]
import math
import struct
import sys

import bpy
import numpy as np


def arg(name, default=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default


GOLDEN = math.radians(137.507764)
NU, NV = 11, 14  # resolución de cada pétalo (ancho × largo)

# Colores (sRGB lineal aproximado para el atributo; el visor no los corrige)
CRIMSON = np.array([0.36, 0.02, 0.05])
ROSE = np.array([0.74, 0.07, 0.13])
BLUSH = np.array([0.93, 0.36, 0.4])
LEAF = np.array([0.16, 0.38, 0.12])
LEAF_LIGHT = np.array([0.36, 0.58, 0.22])
STEM = np.array([0.22, 0.42, 0.14])


def smooth01(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


class Mesh:
    def __init__(self):
        self.closed, self.open, self.color, self.tris = [], [], [], []
        self.n = 0

    def grid(self, closed, opened, color):
        """Rejilla nu×nv (ya calculada en los dos estados) con dos triángulos por celda."""
        nv, nu = closed.shape[:2]
        base = self.n
        self.closed.append(closed.reshape(-1, 3))
        self.open.append(opened.reshape(-1, 3))
        self.color.append(color.reshape(-1, 3))
        for j in range(nv - 1):
            for i in range(nu - 1):
                a = base + j * nu + i
                b, c, d = a + 1, a + nu, a + nu + 1
                self.tris += [(a, c, b), (b, c, d)]
        self.n += nu * nv

    def arrays(self):
        return np.concatenate(self.closed), np.concatenate(self.open), np.concatenate(self.color), np.array(self.tris, dtype=np.int64)


def petal(k, count, bloom):
    """Pétalo k (0 = el más interno) en el estado `bloom` (0 capullo, 1 abierta): rejilla NV×NU×3."""
    f = k / (count - 1)                      # 0 dentro, 1 fuera
    theta = k * GOLDEN
    length = 0.026 + 0.034 * f ** 0.8        # largo del pétalo
    width = 0.55 + 0.75 * f ** 0.9           # semiancho como ángulo (rad) alrededor del eje
    r0 = 0.002 + 0.012 * f                   # radio donde nace
    y0 = 0.012 * f                           # los de fuera nacen un poco más abajo
    o = bloom * smooth01((f - 0.08) / 0.92) * (0.35 + 0.65 * f)  # apertura propia
    tilt0 = 0.05 + 0.35 * o                  # inclinación en la base
    tilt1 = 0.1 + 1.65 * o                   # inclinación en la punta (se abre y se dobla)
    v = np.linspace(0, 1, NV)
    u = np.linspace(-1, 1, NU)
    # Línea media en el plano (radio, alto): la inclinación crece hacia la punta.
    # En capullo, las puntas de los pétalos de fuera se cierran hacia el centro (forma de huevo).
    lean = (1 - bloom) * 0.42 * f ** 1.3
    phi = tilt0 + (tilt1 - tilt0) * v ** 1.6 + (1 - bloom) * 0.22 * f * (1 - v) - lean * v ** 2
    ds = length / (NV - 1)
    rad = r0 + np.concatenate([[0], np.cumsum(np.sin(phi[:-1]) * ds)])
    hgt = y0 + np.concatenate([[0], np.cumsum(np.cos(phi[:-1]) * ds)])
    # Ancho: estrecho en la base, ancho y redondo arriba (y un poco hendido en el centro de la punta).
    wv = np.sin(np.pi * np.clip(v, 0.0, 1.0) ** 0.62) ** 0.55
    wv = np.maximum(wv, 0.18)
    out = np.zeros((NV, NU, 3))
    col = np.zeros((NV, NU, 3))
    for j in range(NV):
        span = width * wv[j]
        for i in range(NU):
            uu = u[i]
            # Copa: el centro del pétalo se aparta del eje y los bordes se acercan (envuelven);
            # abierto, el borde superior se dobla hacia afuera.
            cup = (1 - uu * uu) * 0.0035 * (1 - 0.7 * o)
            roll = o * 0.009 * v[j] ** 2.4 * uu * uu
            notch = 0.0016 * math.exp(-(uu / 0.18) ** 2) * v[j] ** 6
            ang = theta + uu * span
            rr = rad[j] + cup + roll
            yy = hgt[j] - notch - roll * 0.6 * o
            out[j, i] = [rr * math.cos(ang), yy, rr * math.sin(ang)]
            shade = 0.25 + 0.75 * v[j]
            base = CRIMSON * (1 - shade) + ROSE * shade
            edge = smooth01((v[j] - 0.75) / 0.25) * (0.25 + 0.35 * f) * (0.4 + 0.6 * abs(uu))
            col[j, i] = base * (1 - edge) + BLUSH * edge
            col[j, i] *= 0.82 + 0.18 * f  # los de dentro, en sombra
    return out, col


def tube(path, radius, color, sides=10):
    """Tubo a lo largo de una polilínea (tallo)."""
    path = np.asarray(path, float)
    rings = []
    for j in range(len(path)):
        t = path[min(j + 1, len(path) - 1)] - path[max(j - 1, 0)]
        t /= np.linalg.norm(t)
        a = np.cross(t, [1, 0, 0])
        if np.linalg.norm(a) < 1e-6:
            a = np.cross(t, [0, 0, 1])
        a /= np.linalg.norm(a)
        b = np.cross(t, a)
        r = radius(j / (len(path) - 1))
        ring = [path[j] + (a * math.cos(s) + b * math.sin(s)) * r for s in np.linspace(0, 2 * math.pi, sides + 1)]
        rings.append(ring)
    pts = np.array(rings)
    return pts, np.broadcast_to(color, pts.shape).copy()


def leaf(base, direction, length, width, droop, color_a, color_b):
    """Hoja aserrada con nervio central plegado: rejilla a lo largo × a lo ancho."""
    d = np.asarray(direction, float)
    d /= np.linalg.norm(d)
    side = np.cross(d, [0, 1, 0])
    side /= np.linalg.norm(side)
    up = np.cross(side, d)
    nv, nu = 12, 9
    pts = np.zeros((nv, nu, 3))
    col = np.zeros((nv, nu, 3))
    for j, v in enumerate(np.linspace(0, 1, nv)):
        w = width * math.sin(math.pi * v ** 0.8) ** 0.8
        serr = 1 + 0.08 * math.sin(v * 38)  # dientes del borde
        for i, uu in enumerate(np.linspace(-1, 1, nu)):
            fold = abs(uu) * w * 0.35                   # nervio plegado
            sag = droop * v * v                         # la punta cae
            p = np.asarray(base, float) + d * (v * length) + side * (uu * w * (serr if abs(uu) > 0.8 else 1)) + up * (fold - sag)
            pts[j, i] = p
            col[j, i] = color_a * (1 - abs(uu) * 0.5) + color_b * abs(uu) * 0.5
    return pts, col


def build(m: Mesh):
    count = 21
    for k in range(count):
        c, col = petal(k, count, 0.0)
        o, _ = petal(k, count, 1.0)
        lift = np.array([0, 0.36, 0])
        m.grid(c + lift, o + lift, col)
    # Sépalos: cinco hojitas puntiagudas bajo la flor; abiertas, se separan más.
    for s in range(5):
        a = s * 2 * math.pi / 5 + 0.3
        for state in (0, 1):
            pass
        closed = np.zeros((6, 5, 3))
        opened = np.zeros((6, 5, 3))
        col = np.zeros((6, 5, 3))
        for j, v in enumerate(np.linspace(0, 1, 6)):
            for i, uu in enumerate(np.linspace(-1, 1, 5)):
                w = 0.32 * (1 - v) ** 0.9
                for arr, spread in ((closed, 0.35), (opened, 1.05)):
                    r = 0.006 + math.sin(spread * v) * 0.03
                    y = 0.355 + math.cos(spread * v) * 0.03 * v - 0.004 * v * v
                    ang = a + uu * w
                    arr[j, i] = [r * math.cos(ang), y, r * math.sin(ang)]
                col[j, i] = LEAF * (1 - v) + LEAF_LIGHT * v
        m.grid(closed, opened, col)
    # Tallo con una leve curva y espinas.
    path = [[0.004 * math.sin(t * 3), t * 0.36, 0.006 * math.sin(t * 2)] for t in np.linspace(0, 1, 16)]
    pts, col = tube(path, lambda t: 0.0045 - 0.0012 * t, STEM)
    m.grid(pts, pts, col)
    for k, (t, a) in enumerate([(0.2, 0.4), (0.38, 2.6), (0.55, 4.4), (0.72, 1.3)]):
        p = np.array(path[int(t * 15)])
        dirv = np.array([math.cos(a), 0.35, math.sin(a)])
        thorn, tcol = tube([p, p + dirv * 0.007, p + dirv * 0.012 + np.array([0, 0.003, 0])], lambda s: 0.0028 * (1 - s) + 0.0002, STEM * 0.8, sides=6)
        m.grid(thorn, thorn, tcol)
    # Dos hojas.
    for base_t, d, ln in [(0.33, [1, 0.45, 0.25], 0.075), (0.5, [-0.9, 0.55, -0.3], 0.065)]:
        b = np.array(path[int(base_t * 15)])
        pts, col = leaf(b, d, ln, 0.022, 0.012, LEAF, LEAF_LIGHT)
        m.grid(pts, pts, col)


def write_nlf(path, closed, opened, color, tris):
    allp = np.concatenate([closed, opened])
    lo, hi = allp.min(axis=0), allp.max(axis=0)
    q = lambda P: np.round((P - lo) / (hi - lo) * 65535).astype('<u2')
    n, m = len(closed), tris.size
    rgb = np.round(np.clip(color, 0, 1) ** (1 / 2.2) * 255).astype('u1')  # a sRGB
    with open(path, 'wb') as f:
        f.write(b'NLF1')
        f.write(struct.pack('<II', n, m))
        f.write(struct.pack('<6f', *lo, *hi))
        f.write(q(closed).tobytes())
        f.write(q(opened).tobytes())
        f.write(rgb.tobytes())
        f.write(b'\0' * ((-(36 + n * 15)) % 4))
        f.write(tris.astype('<u2').tobytes())
    print(f'{path}: {n} vértices, {m // 3} triángulos')


def render(closed, opened, color, tris, path):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    shots = []
    for name, P in (('bud', closed), ('bloom', opened)):
        me = bpy.data.meshes.new(name)
        me.from_pydata(P.tolist(), [], tris.tolist())
        me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
        attr = me.color_attributes.new('col', 'FLOAT_COLOR', 'POINT')
        attr.data.foreach_set('color', np.c_[color, np.ones(len(color))].astype(np.float32).ravel())
        obj = bpy.data.objects.new(name, me)
        obj.rotation_euler = (math.pi / 2, 0, 0)
        sc.collection.objects.link(obj)
        sc.render.engine = 'BLENDER_WORKBENCH'
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'VERTEX'
        sh.show_backface_culling = False
        sc.render.resolution_x, sc.render.resolution_y = 600, 600
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = float(arg('--scale', 0.16))
        sc.collection.objects.link(cam)
        sc.camera = cam
        down = math.radians(float(arg('--down', 28)))  # mira hacia el centro de la flor desde arriba
        cy = float(arg('--cy', 0.385))
        cam.location = (0, -1.2 * math.cos(down), cy + 1.2 * math.sin(down))
        cam.rotation_euler = (math.pi / 2 - down, 0, 0)
        f = path.replace('.png', f'-{name}.png')
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(f)
        shots.append(np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4))
        bpy.data.objects.remove(obj)
        bpy.data.objects.remove(cam)
    sheet = np.concatenate(shots, axis=1)
    out = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0])
    out.pixels = sheet.ravel()
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    print('lámina', path)


def main():
    m = Mesh()
    build(m)
    closed, opened, color, tris = m.arrays()
    if arg('--out'):
        write_nlf(arg('--out'), closed, opened, color, tris)
    if arg('--render'):
        render(closed, opened, color, tris, arg('--render'))


main()
