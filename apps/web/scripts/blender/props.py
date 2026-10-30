# Objetos 3D de las zonas, modelados en Blender por código: el tótem de racha (Hábitos),
# los peldaños, la bandera y el cofre (Misiones), los hobbies (Recreación), las pesas
# (Coliseo), la moneda (Finanzas) y los trofeos (Logros).
#
# Estilo: formas mínimas con biseles suaves, sin texturas. Cada parte (body, glow, metal,
# dark, accent, paint0…4) se modela con su material; al exportar, el número de la parte pasa
# al atributo `_PART` (k/255) y cada objeto queda en una sola primitiva. El visor pinta cada
# parte con los colores del tema: un mismo .glb sirve para Aurora, oscuro y los temas de la
# Tienda. Los hobbies, las pesas, la moneda y los trofeos salen dos veces: `nombre_lo`
# con pocos segmentos en props-<set>.glb (lo que se descarga siempre) y `nombre` con todos
# en props-<set>-hd.glb (el visor lo pide solo si el lienzo es grande: LOD progresivo).
#
# Coordenadas de Blender (z arriba, el frente mira a −y); el exportador las pasa a las de
# three.js (y arriba, el frente a +z). Los pivotes de las piezas que se mueven (tapa y
# candado del cofre) van en `extras` ya en coordenadas de three.js.
#
# Uso: blender -b --factory-startup -P props.py -- --sets habits,goals --dir out/ [--render qa.png]
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

PARTS = ('body', 'glow', 'metal', 'dark', 'accent', 'paint0', 'paint1', 'paint2', 'paint3', 'paint4')
P = {name: i for i, name in enumerate(PARTS)}
# Solo para la lámina de control (el visor usa los tokens del tema).
QA = {
    'body': (0.80, 0.86, 0.84), 'glow': (0.25, 0.95, 0.7), 'metal': (0.78, 0.66, 0.36), 'dark': (0.12, 0.14, 0.15),
    'accent': (0.13, 0.6, 0.5), 'paint0': (0.9, 0.3, 0.3), 'paint1': (0.95, 0.7, 0.2), 'paint2': (0.3, 0.75, 0.4),
    'paint3': (0.3, 0.55, 0.95), 'paint4': (0.7, 0.45, 0.9),
}


def arg(name, default=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default


def T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def R(deg, axis):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def S(x, y=None, z=None):
    return Matrix.Diagonal((x, x if y is None else y, x if z is None else z, 1.0))


def three(v):
    """Blender (x, y, z) → three.js (x, z, −y)."""
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]


# ───────── Primitivas (cada una en su propio bmesh) ─────────

def done(bm, M=None):
    if M is not None:
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def box(sx, sy, sz, M=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return done(bm, M)


def cyl(r1, r2, depth, segs, M=None, caps=True):
    """Cilindro o cono sobre z, centrado en el origen."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
    return done(bm, M)


def ico(r, sub=1, M=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    return done(bm, M)


def sphere(r, u, v, M=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    return done(bm, M)


def revolve(loop, segs, M=None, closed=True, radial=None):
    """Sólido de revolución alrededor de z. `loop`: puntos (r, z); cerrado → un tubo (toro
    generalizado); abierto → perfil que empieza y acaba en el eje (r = 0) o con tapas."""
    bm = bmesh.new()
    rows = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ca, sa = math.cos(a), math.sin(a)
        row = []
        for k, (r, z) in enumerate(loop):
            rr = r * (radial(a, k, r) if radial else 1.0)
            row.append(bm.verts.new((rr * ca, rr * sa, z)))
        rows.append(row)
    n = len(loop)
    for i in range(segs):
        i2 = (i + 1) % segs
        for k in range(n if closed else n - 1):
            k2 = (k + 1) % n
            bm.faces.new([rows[i][k], rows[i2][k], rows[i2][k2], rows[i][k2]])
    if not closed:
        if loop[0][0] > 1e-6:
            bm.faces.new([rows[i][0] for i in range(segs)][::-1])
        if loop[-1][0] > 1e-6:
            bm.faces.new([rows[i][n - 1] for i in range(segs)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return done(bm, M)


def torus(R_, ra, rb, segs, ring, arc=None, start=0.0, M=None):
    """Toro en el plano XY (eje z) con tubo elíptico: `ra` hacia fuera, `rb` sobre z.
    Con `arc` (radianes) queda un arco con tapas."""
    bm = bmesh.new()
    closed = arc is None
    span = 2 * math.pi if closed else arc
    count = segs if closed else segs + 1
    rows = []
    for i in range(count):
        a = start + span * i / segs
        c = Vector((math.cos(a), math.sin(a), 0.0))
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            row.append(bm.verts.new(c * (R_ + ra * math.cos(b)) + Vector((0, 0, rb * math.sin(b)))))
        rows.append(row)
    for i in range(segs):
        i2 = (i + 1) % count
        for j in range(ring):
            j2 = (j + 1) % ring
            bm.faces.new([rows[i][j], rows[i2][j], rows[i2][j2], rows[i][j2]])
    if not closed:
        bm.faces.new(rows[0][::-1])
        bm.faces.new(rows[-1])
    return done(bm, M)


def slab(outline, z0, z1, M=None):
    """Prisma de un contorno (x, y) entre z0 y z1."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in outline]
    hi = [bm.verts.new((x, y, z1)) for x, y in outline]
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    return done(bm, M)


def outline_of(sdf, n, rmax=0.8):
    """Contorno de una forma 2D (función de distancia con signo) visto desde el origen:
    para cada ángulo, el último punto dentro de la forma."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        last, t = 0.0, 0.0
        while t < rmax:
            if sdf(ca * t, sa * t) <= 0:
                last = t
            t += 0.0015
        pts.append((ca * last, sa * last))
    return pts


def star_outline(n, R_, r):
    return [((R_ if i % 2 == 0 else r) * math.cos(math.pi / 2 + i * math.pi / n), (R_ if i % 2 == 0 else r) * math.sin(math.pi / 2 + i * math.pi / n)) for i in range(2 * n)]


def smin(a, b, k):
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def round_box(x, y, hx, hy, r):
    qx, qy = abs(x) - hx + r, abs(y) - hy + r
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def bevel_sharp(bm, width, segments=2, angle=35):
    bm.normal_update()
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(angle)]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type='OFFSET', segments=segments, profile=0.5,
                        affect='EDGES', clamp_overlap=True)


# ───────── Modelo: partes con su material, luego un objeto ─────────

class Model:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.extras = {}

    def add(self, src, part='body', smooth=False, bevel=0.0, segments=2, angle=35):
        """`part`: nombre, función de la cara o None (conserva el material ya puesto en src)."""
        for f in src.faces:
            if part is not None:
                f.material_index = P[part(f) if callable(part) else part]
            f.smooth = smooth
        if bevel > 0:
            bevel_sharp(src, bevel, segments, angle)
        vmap = {v: self.bm.verts.new(v.co) for v in src.verts}
        for f in src.faces:
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            nf.material_index = f.material_index
            nf.smooth = f.smooth
        src.free()
        return self

    def build(self, M=None, sharp=38):
        bm = self.bm
        if M is not None:
            bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
        bm.normal_update()
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for p in PARTS:
            me.materials.append(MATERIALS[p])
        me.set_sharp_from_angle(angle=math.radians(sharp))
        obj = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(obj)
        lo = [min(v.co[i] for v in me.vertices) for i in range(3)]
        hi = [max(v.co[i] for v in me.vertices) for i in range(3)]
        c = Vector([(lo[i] + hi[i]) / 2 for i in range(3)])
        obj['radius'] = round(max((v.co - c).length for v in me.vertices), 4)
        obj['center'] = three(c)
        obj['tris'] = sum(len(p.vertices) - 2 for p in me.polygons)
        for k, v in self.extras.items():
            obj[k] = v
        return obj


def suffix(d):
    return '' if d else '_lo'


# ───────── Hábitos: tótem de cristal ─────────

def crystal():
    """Monolito de cuarzo hexagonal con puntas desiguales y facetas trianguladas. En la web, el
    shader estira todo lo que está por encima de y = 0 (la racha alarga el cuerpo sin
    deformar la punta)."""
    m = Model('crystal')
    bm = bmesh.new()
    rings = [(-0.44, 0.19, 0.0), (-0.1, 0.23, 0.12), (0.0, 0.232, 0.1), (0.44, 0.205, -0.05)]
    rows = []
    for z, r, tw in rings:
        row = []
        for i in range(6):
            a = 2 * math.pi * i / 6 + tw
            k = 1 + 0.07 * math.sin(i * 2.3 + z * 7.0)
            row.append(bm.verts.new((r * k * math.cos(a), r * k * math.sin(a), z)))
        rows.append(row)
    top = bm.verts.new((0.035, -0.02, 0.98))
    bot = bm.verts.new((-0.02, 0.015, -0.76))
    for k in range(len(rows) - 1):
        for i in range(6):
            j = (i + 1) % 6
            bm.faces.new([rows[k][i], rows[k][j], rows[k + 1][j], rows[k + 1][i]])
    for i in range(6):
        j = (i + 1) % 6
        bm.faces.new([rows[-1][i], rows[-1][j], top])
        bm.faces.new([rows[0][j], rows[0][i], bot])
    bmesh.ops.triangulate(bm, faces=bm.faces)
    m.add(done(bm), 'body')
    return m.build()


def shard():
    m = Model('shard')
    c = bmesh.new()
    pts = [c.verts.new((0.05 * math.cos(2 * math.pi * i / 5), 0.05 * math.sin(2 * math.pi * i / 5), 0.0)) for i in range(5)]
    tip, root = c.verts.new((0, 0, 0.12)), c.verts.new((0, 0, -0.07))
    for i in range(5):
        j = (i + 1) % 5
        c.faces.new([pts[i], pts[j], tip])
        c.faces.new([pts[j], pts[i], root])
    m.add(done(c), 'body')
    return m.build()


def pedestal():
    """Isla flotante hexagonal: losa con anillo de luz, dais central y una pirámide invertida
    debajo. Las siete marcas de la semana son otra malla (`notch`), instanciada."""
    m = Model('pedestal')
    m.add(cyl(0.56, 0.56, 0.12, 6, T(0, 0, -0.06) @ R(30, 'Z')), 'body', smooth=True, bevel=0.022, segments=3)
    m.add(torus(0.455, 0.012, 0.006, 6, 4, M=T(0, 0, 0.004) @ R(30, 'Z')), 'glow')
    m.add(cyl(0.2, 0.17, 0.045, 6, T(0, 0, 0.022) @ R(30, 'Z')), 'body', smooth=True, bevel=0.01, segments=2)
    m.add(torus(0.17, 0.007, 0.004, 6, 4, M=T(0, 0, 0.046) @ R(30, 'Z')), 'glow')
    m.add(cyl(0.5, 0.06, 0.36, 6, T(0, 0, -0.3) @ R(30, 'Z')), 'dark')
    return m.build()


def notch():
    m = Model('notch')
    m.add(box(0.1, 0.045, 0.022), 'glow', smooth=True, bevel=0.008, segments=2)
    return m.build()


# ───────── Misiones: monumento y cofre ─────────

def tier():
    """Peldaño del monumento (1 × 1, alto 0,14): losa biselada sobre una franja de luz."""
    m = Model('tier')
    m.add(box(1.0, 1.0, 0.12, T(0, 0, 0.08)), 'body', smooth=True, bevel=0.022, segments=3)
    m.add(box(0.965, 0.965, 0.024, T(0, 0, 0.012)), 'glow')
    return m.build()


def flag():
    """Mástil con remate y banderín (el visor lo ondea desde el mástil)."""
    m = Model('flag')
    m.add(cyl(0.011, 0.011, 0.5, 10, T(0, 0, 0.25)), 'metal', smooth=True)
    m.add(ico(0.024, 2, T(0, 0, 0.51)), 'metal', smooth=True)
    bm = bmesh.new()
    nx, nz = 10, 4
    grid = [[bm.verts.new((0.011 + 0.28 * i / nx, 0.0, 0.3 + 0.17 * j / nz - 0.035 * (i / nx) ** 2)) for j in range(nz + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(nz):
            bm.faces.new([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]])
    # Cara trasera con el orden invertido: se ve por los dos lados sin doble cara.
    back = [[bm.verts.new(v.co + Vector((0, 0.0015, 0))) for v in col] for col in grid]
    for i in range(nx):
        for j in range(nz):
            bm.faces.new([back[i][j], back[i][j + 1], back[i + 1][j + 1], back[i + 1][j]])
    m.add(bm, 'accent', smooth=True)
    m.extras['waveFrom'] = 0.011
    return m.build()


CHEST_W, CHEST_D, CHEST_H = 0.9, 0.56, 0.44


def chest():
    W, D, H = CHEST_W, CHEST_D, CHEST_H
    out = []
    # Cuerpo: caja hueca (dentro, un fondo que brilla al abrir) con flejes de metal.
    body = Model('chest_body')
    bm = box(W, D, H, T(0, 0, H / 2))
    top = [f for f in bm.faces if f.normal.z > 0.9]
    bmesh.ops.inset_region(bm, faces=top, thickness=0.05, depth=0.0)
    ext = bmesh.ops.extrude_face_region(bm, geom=top)
    bmesh.ops.translate(bm, vec=(0, 0, -0.3), verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)])
    bm.normal_update()

    def body_part(f):
        c = f.calc_center_median()
        inside = abs(c.x) < W / 2 - 0.045 and abs(c.y) < D / 2 - 0.045
        if inside and abs(f.normal.z) > 0.9 and c.z < H - 0.1:
            return 'glow'
        if inside and abs(f.normal.z) < 0.5:
            return 'dark'
        return 'body'
    body.add(done(bm), body_part, smooth=True, bevel=0.02, segments=3)
    for x in (-0.3, 0.3):
        body.add(box(0.07, 0.012, H - 0.02, T(x, -D / 2 - 0.004, H / 2)), 'metal', smooth=True, bevel=0.004)
        body.add(box(0.07, 0.012, H - 0.02, T(x, D / 2 + 0.004, H / 2)), 'metal', smooth=True, bevel=0.004)
        body.add(box(0.07, D, 0.012, T(x, 0, -0.004)), 'metal', smooth=True, bevel=0.004)
    body.add(box(0.17, 0.02, 0.12, T(0, -D / 2 - 0.008, H - 0.075)), 'metal', smooth=True, bevel=0.008)
    for x in (-W / 2 + 0.06, W / 2 - 0.06):
        for y in (-D / 2 + 0.06, D / 2 - 0.06):
            body.add(cyl(0.035, 0.03, 0.03, 12, T(x, y, -0.02)), 'dark', smooth=True)
    out.append(body.build())

    # Tapa abovedada: media caña con borde y flejes; gira sobre la arista trasera.
    lid = Model('chest_lid')
    vault = cyl(D / 2, D / 2, W, 28, R(90, 'Y'))
    bmesh.ops.bisect_plane(vault, geom=vault.verts[:] + vault.edges[:] + vault.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    boundary = [e for e in vault.edges if e.is_boundary]
    bmesh.ops.edgeloop_fill(vault, edges=boundary)
    lid.add(done(vault, T(0, 0, H + 0.04) @ S(1, 1, 0.55)), 'body', smooth=True, bevel=0.012, segments=2)
    lid.add(box(W, D, 0.04, T(0, 0, H + 0.02)), 'body', smooth=True, bevel=0.012, segments=2)
    for x in (-0.3, 0.3):
        band = cyl(D / 2 + 0.008, D / 2 + 0.008, 0.07, 28, R(90, 'Y'))
        bmesh.ops.bisect_plane(band, geom=band.verts[:] + band.edges[:] + band.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
        bmesh.ops.edgeloop_fill(band, edges=[e for e in band.edges if e.is_boundary])
        lid.add(done(band, T(x, 0, H + 0.04) @ S(1, 1, 0.58)), 'metal', smooth=True)
        lid.add(box(0.07, D + 0.008, 0.044, T(x, 0, H + 0.02)), 'metal', smooth=True, bevel=0.004)
    lid.add(box(0.12, 0.022, 0.07, T(0, -D / 2 - 0.009, H + 0.012)), 'metal', smooth=True, bevel=0.008)
    lid.extras['pivot'] = three((0, D / 2, H))
    out.append(lid.build())

    # Candado: cuerpo con bocallave y arco aparte (salta al abrir, gira sobre su pata derecha).
    ly = -D / 2 - 0.06
    lz = H - 0.1
    lock = Model('chest_lock')
    lock.add(box(0.17, 0.06, 0.15, T(0, ly, lz)), 'metal', smooth=True, bevel=0.024, segments=3)
    lock.add(cyl(0.017, 0.017, 0.012, 14, T(0, ly - 0.03, lz + 0.015) @ R(90, 'X')), 'dark')
    lock.add(box(0.011, 0.012, 0.032, T(0, ly - 0.03, lz - 0.01)), 'dark')
    lock.extras['pivot'] = three((0, ly, lz))
    out.append(lock.build())

    shackle = Model('chest_shackle')
    top = lz + 0.075
    shackle.add(torus(0.05, 0.012, 0.012, 16, 8, arc=math.pi, M=T(0, ly, top + 0.03) @ R(90, 'X')), 'metal', smooth=True)
    for x in (-0.05, 0.05):
        shackle.add(cyl(0.012, 0.012, 0.06, 10, T(x, ly, top)), 'metal', smooth=True)
    shackle.extras['pivot'] = three((0.05, ly, top))
    out.append(shackle.build())
    return out


# ───────── Recreación: hobbies ─────────

def gamepad(d):
    m = Model('gamepad' + suffix(d))

    def sdf(x, y):
        body = round_box(x, y - 0.02, 0.27, 0.115, 0.1)
        return smin(smin(body, math.hypot(x + 0.2, y + 0.09) - 0.125, 0.07), math.hypot(x - 0.2, y + 0.09) - 0.125, 0.07)
    m.add(slab(outline_of(sdf, 72 if d else 40), -0.05, 0.05), 'body', smooth=True, bevel=0.034 if d else 0.03, segments=2 if d else 1, angle=28)
    z = 0.05
    m.add(box(0.075, 0.024, 0.02, T(-0.19, 0.03, z + 0.004)), 'dark', smooth=True, bevel=0.005 if d else 0)
    m.add(box(0.024, 0.075, 0.02, T(-0.19, 0.03, z + 0.004)), 'dark', smooth=True, bevel=0.005 if d else 0)
    for (dx, dy), paint in zip(((0, 0.036), (0.036, 0), (0, -0.036), (-0.036, 0)), ('paint1', 'paint0', 'paint2', 'paint3')):
        m.add(cyl(0.016, 0.016, 0.022, 16 if d else 8, T(0.19 + dx, 0.03 + dy, z + 0.004)), paint, smooth=True, bevel=0.004 if d else 0)
    for x in (-0.08, 0.08):
        m.add(cyl(0.036, 0.036, 0.014, 20 if d else 10, T(x, -0.065, z)), 'dark', smooth=True)
        m.add(cyl(0.022, 0.03, 0.03, 20 if d else 10, T(x, -0.065, z + 0.02)), 'dark', smooth=True, bevel=0.006 if d else 0)
    m.add(box(0.07, 0.014, 0.012, T(0, 0.075, z)), 'glow', smooth=True, bevel=0.005 if d else 0)
    for x in (-0.19, 0.19):
        m.add(box(0.13, 0.04, 0.05, T(x, 0.13, 0.0)), 'accent', smooth=True, bevel=0.016 if d else 0.012, segments=2 if d else 1)
    # La cara de los botones mira al frente; las empuñaduras, abajo.
    return m.build(R(90, 'X'))


def headphones(d):
    m = Model('headphones' + suffix(d))
    seg, ring = (32, 8) if d else (16, 6)
    arc = math.radians(200)
    m.add(torus(0.36, 0.013, 0.032, seg, ring, arc=arc, start=math.radians(-10), M=R(90, 'X')), 'body', smooth=True)
    m.add(torus(0.343, 0.008, 0.024, seg // 2, ring, arc=math.radians(110), start=math.radians(35), M=R(90, 'X')), 'dark', smooth=True)
    for s in (-1, 1):
        x = 0.385 * s
        m.add(box(0.022, 0.05, 0.07, T(0.358 * s, 0, -0.07)), 'metal', smooth=True, bevel=0.006 if d else 0)
        m.add(cyl(0.12, 0.112, 0.075, 24 if d else 12, T(x, 0, -0.16) @ R(90 * s, 'Y')), 'body', smooth=True, bevel=0.02 if d else 0.015, segments=3 if d else 1)
        m.add(cyl(0.082, 0.082, 0.012, 24 if d else 12, T(x + 0.04 * s, 0, -0.16) @ R(90, 'Y')), 'accent', smooth=True, bevel=0.004 if d else 0)
        m.add(torus(0.098, 0.006, 0.006, 24 if d else 12, 4, M=T(x + 0.04 * s, 0, -0.16) @ R(90, 'Y')), 'glow', smooth=True)
        m.add(torus(0.085, 0.032, 0.026, 20 if d else 12, 8 if d else 6, M=T(x - 0.05 * s, 0, -0.16) @ R(90, 'Y')), 'dark', smooth=True)
    return m.build()


def d20(d):
    m = Model('d20' + suffix(d))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.45)
    # Paneles grabados: cada cara se hunde dentro de su marco; luego se biselan solo las
    # aristas del icosaedro (entre marcos), así los paneles siguen siendo las caras originales.
    panels = list(bm.faces)
    normals = [f.normal.copy() for f in panels]
    bmesh.ops.inset_individual(bm, faces=panels, thickness=0.05, depth=-0.014)
    inner = set(panels)
    bm.normal_update()
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and not any(f in inner for f in e.link_faces) and e.calc_face_angle(0.0) > math.radians(30)]
    bmesh.ops.bevel(bm, geom=edges, offset=0.02 if d else 0.014, offset_type='OFFSET', segments=2 if d else 1, profile=0.5, affect='EDGES', clamp_overlap=True)
    bm.normal_update()
    # El bisel rehace caras: un panel es la que conserva la normal de una cara del icosaedro.
    for f in bm.faces:
        f.material_index = P['accent' if max(f.normal.dot(n) for n in normals) > 0.9995 else 'body']
    m.add(done(bm), None, smooth=False)
    return m.build(R(18, 'X') @ R(12, 'Z'))


def palette(d):
    m = Model('palette' + suffix(d))

    def sdf(x, y):
        e = (math.hypot(x / 0.46, y / 0.33) - 1.0) * 0.33
        return max(e, -(math.hypot(x + 0.43, y - 0.06) - 0.12))
    m.add(slab(outline_of(sdf, 64 if d else 36), -0.018, 0.018), 'body', smooth=True, bevel=0.012 if d else 0.01, segments=2 if d else 1, angle=28)
    m.add(cyl(0.055, 0.055, 0.004, 24 if d else 10, T(-0.2, 0.03, 0.017)), 'dark', smooth=True)
    for i, (x, y) in enumerate(((0.02, 0.2), (0.2, 0.17), (0.32, 0.04), (0.25, -0.13), (0.06, -0.19))):
        m.add(sphere(0.062, 12 if d else 8, 6 if d else 5, T(x, y, 0.024) @ S(1, 1, 0.32)), f'paint{i}', smooth=True)
    # Pincel cruzado sobre la paleta: mango, virola de metal y cerdas con pintura.
    brush = T(0.02, -0.02, 0.07) @ R(-32, 'Z') @ R(90, 'Y')
    m.add(cyl(0.012, 0.019, 0.42, 16 if d else 8, brush @ T(0, 0, -0.06)), 'accent', smooth=True)
    m.add(cyl(0.02, 0.02, 0.06, 16 if d else 8, brush @ T(0, 0, 0.18)), 'metal', smooth=True)
    m.add(cyl(0.02, 0.004, 0.075, 16 if d else 8, brush @ T(0, 0, 0.245)), 'paint2', smooth=True)
    return m.build(R(64, 'X'))


def clapper(d):
    m = Model('clapper' + suffix(d))
    th = 0.035
    m.add(box(0.6, th, 0.4, T(0, 0, 0.2)), 'dark', smooth=True, bevel=0.012 if d else 0.008, segments=2 if d else 1)
    for z in (0.09, 0.17, 0.25):
        m.add(box(0.5, 0.004, 0.012, T(0, -th / 2 - 0.001, z)), 'body')

    def stripes(z0, h, s, M):
        w = 0.6 / 6
        for i in range(6):
            x0 = -0.3 + i * w
            pts = [(x0, 0.0), (x0 + w, 0.0), (x0 + w + s, h), (x0 + s, h)]
            pts = [(min(max(x, -0.3), 0.3), y) for x, y in pts]
            m.add(slab(pts, -th / 2, th / 2, M @ T(0, 0, 0) @ R(90, 'X') @ T(0, z0, 0)), 'body' if i % 2 == 0 else 'accent', smooth=False)
    stripes(0.33, 0.07, 0.04, Matrix())
    hinge = T(-0.3, 0, 0.42) @ R(-17, 'Y') @ T(0.3, 0, -0.42)
    stripes(0.43, 0.075, 0.04, hinge)
    m.add(cyl(0.018, 0.018, th + 0.012, 14 if d else 8, T(-0.3, 0, 0.42) @ R(90, 'X')), 'metal', smooth=True)
    return m.build()


# ───────── Coliseo: pesas ─────────

def dumbbell(d):
    m = Model('dumbbell' + suffix(d))
    ax = R(90, 'Y')
    m.add(cyl(0.028, 0.028, 0.34, 20 if d else 8, ax), 'metal', smooth=True)
    for s in (-1, 1):
        m.add(cyl(0.046, 0.046, 0.03, 20 if d else 8, T(0.155 * s, 0, 0) @ ax), 'metal', smooth=True)
        m.add(cyl(0.122, 0.122, 0.14, 6, T(0.24 * s, 0, 0) @ ax @ R(30, 'Z')), 'dark', smooth=True, bevel=0.02 if d else 0.014, segments=3 if d else 1)
        m.add(cyl(0.126, 0.126, 0.014, 6, T(0.24 * s, 0, 0) @ ax @ R(30, 'Z')), 'glow', smooth=False)
        m.add(cyl(0.06, 0.06, 0.008, 20 if d else 8, T((0.31 + 0.004) * s, 0, 0) @ ax), 'accent', smooth=True)
    return m.build()


def barbell(d):
    """Barra olímpica sin discos (los discos son `plate`, instanciados según la asistencia)."""
    m = Model('barbell' + suffix(d))
    ax = R(90, 'Y')
    seg = 18 if d else 8
    m.add(cyl(0.016, 0.016, 1.12, seg, ax), 'metal', smooth=True)
    for s in (-1, 1):
        m.add(cyl(0.042, 0.042, 0.032, seg, T(0.576 * s, 0, 0) @ ax), 'metal', smooth=True, bevel=0.006 if d else 0)
        m.add(cyl(0.027, 0.027, 0.3, seg, T(0.74 * s, 0, 0) @ ax), 'metal', smooth=True)
        m.add(cyl(0.031, 0.031, 0.014, seg, T(0.897 * s, 0, 0) @ ax), 'accent', smooth=True)
    return m.build()


def plate(d):
    m = Model('plate' + suffix(d))
    seg = 32 if d else 16
    ax = R(90, 'Y')
    m.add(revolve([(0.028, -0.03), (0.06, -0.03), (0.06, 0.03), (0.028, 0.03)], seg, ax), 'metal', smooth=True)
    m.add(revolve([(0.06, -0.025), (0.2, -0.025), (0.22, -0.011), (0.22, 0.011), (0.2, 0.025), (0.06, 0.025)], seg, ax), 'dark', smooth=True)
    m.add(revolve([(0.158, -0.0262), (0.18, -0.0262), (0.18, 0.0262), (0.158, 0.0262)], seg, ax), 'accent', smooth=True)
    return m.build()


def kettlebell(d):
    m = Model('kettlebell' + suffix(d))
    seg = 24 if d else 12
    m.add(revolve([(0.0, 0.0), (0.1, 0.0), (0.142, 0.028), (0.17, 0.1), (0.162, 0.18), (0.115, 0.238), (0.06, 0.258), (0.0, 0.262)], seg, closed=False), 'dark', smooth=True)
    m.add(torus(0.171, 0.006, 0.006, seg, 6 if d else 4, M=T(0, 0, 0.1)), 'glow', smooth=True)
    m.add(torus(0.1, 0.022, 0.022, 20 if d else 10, 10 if d else 6, arc=math.pi, M=T(0, 0, 0.3) @ R(90, 'X')), 'metal', smooth=True)
    for s in (-1, 1):
        m.add(cyl(0.022, 0.024, 0.07, 10 if d else 6, T(0.1 * s, 0, 0.268)), 'metal', smooth=True)
    return m.build()


# ───────── Finanzas: moneda ─────────

def coin(d):
    """Moneda con canto estriado y la N de NoutLife en relieve por las dos caras."""
    m = Model('coin' + suffix(d))
    seg = 144 if d else 40
    face, rim = 0.026, 0.034
    profile = [(0.0, face), (0.31, face), (0.335, rim), (0.385, rim), (0.4, 0.024), (0.4, -0.024), (0.385, -rim), (0.335, -rim), (0.31, -face), (0.0, -face)]
    reeds = (lambda a, k, r: 1.0 - 0.011 * (0.5 + 0.5 * math.cos(a * 72)) if r >= 0.399 else 1.0) if d else None
    m.add(revolve(profile, seg, closed=False, radial=reeds), 'metal', smooth=True)
    # N del sello (BrandMark: M41 63V43l18 20V40) escalada a la cara de la moneda.
    k, w, h = 0.36 / 23, 0.062, 0.012
    pts = [((x - 50) * k, -(y - 51.5) * k) for x, y in ((41, 63), (41, 43), (59, 63), (59, 40))]
    for side in (1, -1):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            dx, dy = x1 - x0, y1 - y0
            length = math.hypot(dx, dy)
            M = T(side * (x0 + x1) / 2, (y0 + y1) / 2, side * (face + h / 2)) @ R(math.degrees(math.atan2(dy, dx * side)), 'Z')
            m.add(box(length, w, h, M), 'accent', smooth=True, bevel=0.005 if d else 0)
        for x, y in pts:
            m.add(cyl(w / 2, w / 2, h, 16 if d else 8, T(side * x, y, side * (face + h / 2))), 'accent', smooth=True)
    return m.build(R(90, 'X'))


# ───────── Logros: copa, medalla y estrella ─────────

def cup(d):
    m = Model('cup' + suffix(d))
    seg = 36 if d else 18
    m.add(box(0.4, 0.4, 0.1, T(0, 0, 0.05)), 'dark', smooth=True, bevel=0.016 if d else 0.01, segments=3 if d else 1)
    m.add(box(0.41, 0.41, 0.014, T(0, 0, 0.05)), 'glow')
    profile = [(0.0, 0.1), (0.12, 0.1), (0.12, 0.128), (0.05, 0.17), (0.038, 0.3), (0.075, 0.33), (0.04, 0.362), (0.05, 0.42),
               (0.16, 0.5), (0.235, 0.62), (0.268, 0.77), (0.282, 0.8), (0.268, 0.806), (0.25, 0.78), (0.22, 0.64), (0.15, 0.54), (0.0, 0.51)]
    m.add(revolve(profile, seg, closed=False), 'metal', smooth=True)
    for s in (-1, 1):
        m.add(torus(0.085, 0.017, 0.017, 14 if d else 8, 8 if d else 6, arc=math.radians(200), start=math.radians(-100 if s > 0 else 80),
                    M=T(0.255 * s, 0, 0.64) @ R(90, 'X')), 'metal', smooth=True)
    return m.build()


def medal(d):
    m = Model('medal' + suffix(d))
    seg = 48 if d else 24
    profile = [(0.0, 0.02), (0.22, 0.02), (0.24, 0.03), (0.28, 0.03), (0.295, 0.016), (0.295, -0.016), (0.28, -0.03), (0.24, -0.03), (0.22, -0.02), (0.0, -0.02)]
    m.add(revolve(profile, seg, closed=False), 'metal', smooth=True)
    m.add(slab(star_outline(5, 0.15, 0.064), 0.018, 0.036), 'accent', smooth=False, bevel=0.004 if d else 0)
    m.add(torus(0.035, 0.01, 0.01, 16 if d else 8, 8 if d else 5, M=T(0, 0.31, 0) @ R(90, 'X')), 'metal', smooth=True)
    for s in (-1, 1):
        strip = T(0.055 * s, 0.5, -0.012) @ R(-16 * s, 'Z')
        m.add(box(0.12, 0.34, 0.006, strip), 'accent', smooth=True)
        m.add(box(0.03, 0.34, 0.008, strip), 'glow', smooth=True)
    return m.build(R(90, 'X'))


def star(d):
    m = Model('star' + suffix(d))
    bm = slab(star_outline(5, 0.42, 0.18), -0.045, 0.045)
    caps = [f for f in bm.faces if abs(f.normal.z) > 0.9]
    bmesh.ops.poke(bm, faces=caps, offset=0.075)
    m.add(done(bm), 'metal', smooth=False)
    return m.build(R(90, 'X'))


SETS = {
    'habits': lambda: [crystal(), shard(), pedestal(), notch()],
    'goals': lambda: [tier(), flag(), *chest()],
    'hobbies': lambda: [f(d) for f in (gamepad, headphones, d20, palette, clapper) for d in (1, 0)],
    'gym': lambda: [f(d) for f in (dumbbell, barbell, plate, kettlebell) for d in (1, 0)],
    'finance': lambda: [coin(1), coin(0)],
    'trophies': lambda: [f(d) for f in (cup, medal, star) for d in (1, 0)],
}

MATERIALS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIALS.clear()
    for p in PARTS:
        mat = bpy.data.materials.new(p)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        col = QA[p]
        bsdf.inputs['Base Color'].default_value = (*col, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.25 if p == 'metal' else 0.45
        bsdf.inputs['Metallic'].default_value = 1.0 if p == 'metal' else 0.0
        if p == 'glow':
            bsdf.inputs['Emission Color'].default_value = (*col, 1.0)
            bsdf.inputs['Emission Strength'].default_value = 3.0
        MATERIALS[p] = mat


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    single = bpy.data.materials.get('prop') or bpy.data.materials.new('prop')
    for o in objs:
        # Las partes no comparten vértices (Model.add los duplica): el atributo por vértice
        # no se mezcla en los bordes.
        me = o.data
        part = [0.0] * len(me.vertices)
        for poly in me.polygons:
            for v in poly.vertices:
                part[v] = poly.material_index / 255.0
        attr = me.attributes.new('_PART', 'FLOAT', 'POINT')
        attr.data.foreach_set('value', part)
        for poly in me.polygons:
            poly.material_index = 0
        me.materials.clear()
        me.materials.append(single)
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
        export_normals=True, export_texcoords=False, export_tangents=False, export_materials='EXPORT',
        export_vertex_color='NONE', export_attributes=True, export_extras=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
    )
    tris = sum(o['tris'] for o in objs)
    print(f'glb {path}: {len(objs)} objetos, {tris} triángulos, {os.path.getsize(path)} bytes')
    for o in objs:
        print(f'  {o.name}: {o["tris"]} triángulos, radio {o["radius"]}')


def render(objs, path):
    """Lámina de control: todos los objetos en rejilla, de frente y algo desde arriba."""
    cols = 6
    for i, o in enumerate(objs):
        r = max(o['radius'], 0.05)
        o.scale = (0.45 / r,) * 3
        c = Vector(o['center'])
        cx, cz = (i % cols) * 1.1, -(i // cols) * 1.1
        o.location = (cx - c[0] * o.scale[0], c[2] * o.scale[0], cz - c[1] * o.scale[0])
    rows = (len(objs) + cols - 1) // cols
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(cols, rows * 1.6) * 1.12
    cam.location = ((cols - 1) * 0.55, -12, -(rows - 1) * 0.55 + 3.2)
    cam.rotation_euler = (math.radians(75), 0, 0)
    bpy.context.scene.camera = cam
    for rot, energy in (((50, 10, -30), 3.0), ((60, -20, 140), 1.2)):
        sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
        sun.data.energy = energy
        sun.rotation_euler = tuple(math.radians(a) for a in rot)
        bpy.context.scene.collection.objects.link(sun)
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.52, 0.55, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    bpy.context.scene.world = world
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x, scene.render.resolution_y = 1800, int(1800 * rows * 1.6 / max(cols, rows * 1.6) * 0.62 + 300)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('render', path)


def main():
    names = (arg('--sets') or ','.join(SETS)).split(',')
    folder = arg('--dir', '.')
    every = []
    for name in names:
        reset()
        objs = SETS[name]()
        lo = [o for o in objs if o.name.endswith('_lo')]
        if lo:
            export(lo, os.path.join(folder, f'props-{name}.glb'))
            export([o for o in objs if o not in lo], os.path.join(folder, f'props-{name}-hd.glb'))
        else:
            export(objs, os.path.join(folder, f'props-{name}.glb'))
        if arg('--render'):
            every.append(name)
    if arg('--render'):
        reset()
        objs = []
        for name in every:
            for o in SETS[name]():
                if o.name.endswith('_lo'):
                    bpy.data.objects.remove(o)
                else:
                    objs.append(o)
        render(objs, arg('--render'))


main()
