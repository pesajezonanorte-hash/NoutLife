# «Materia calma»: el volumen de la interfaz, modelado en Blender por código.
#
#   pad    Almohadilla de silicona de los hábitos (shape keys press, release, fill).
#   focus  Aro de vidrio esmerilado del enfoque (shape keys inhale, exhale, flow_a, flow_b).
#   nav    Canto rodado del navbar (shape keys stretch_x, stretch_y, squash).
#   card   Losa de las tarjetas (shape key lift) y su bisel horneado para CSS (9 cortes).
#   hero   Escultura del splash (shape keys ridge_a, ridge_b, breath, mass, pebble).
#
# Cada juego sale como .blend (malla baja, malla alta de horneado, materiales procedurales,
# acciones en pistas NLA y mundo de estudio suave) y como .glb PBR estándar: los materiales son
# Principled BSDF (arcilla mate, vidrio con KHR_materials_transmission), las normales finas van
# en un mapa horneado y las microinteracciones como animaciones de pesos de morph. En la web el
# visor pinta cada material con los tokens del tema; las animaciones marcan el tiempo.
#
# Coordenadas de Blender: z arriba (lo que mira a quien usa la app) y x a la derecha. El
# exportador las pasa a three.js: (x, y, z) → (x, z, −y).
#
# Uso: blender -b --factory-startup --python-exit-code 1 -P calm.py -- --sets pad,focus \
#        --dir out/ [--blend carpeta/] [--render carpeta/] [--samples 64]
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

FPS = 60


def arg(name, default=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ───────── Malla ─────────

def resample_outline(fn, segs, dense=4000):
    """Contorno cerrado en `segs` puntos a igual distancia. fn(a) → (x, y), a en radianes."""
    pts = np.array([fn(2 * math.pi * i / dense) for i in range(dense + 1)])
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    t = np.linspace(0.0, s[-1], segs, endpoint=False)
    return np.stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])], axis=1)


def superellipse(a, b, n):
    def fn(t):
        c, s = math.cos(t), math.sin(t)
        r = (abs(c / a) ** n + abs(s / b) ** n) ** (-1.0 / n)
        return r * c, r * s
    return fn


def pillow(name, outline, rings, height, crown=2.6, wall=2.2, dish=0.0):
    """Almohada sobre z = 0: `outline` (N×2) es el borde de abajo. El perfil va del borde
    (s = 1, z = 0) al centro (s = 0) con anillos más juntos donde más se curva; `dish` hunde el
    centro para el dedo. Devuelve la malla (cerrada) y el radio normalizado s de cada vértice."""
    prof_s = 1.0 - (np.linspace(0.0, 1.0, rings) ** 1.7)  # 1 → 0, denso junto al borde
    prof_s = prof_s[:-1]
    prof_z = height * (1.0 - prof_s ** crown) ** (1.0 / wall)
    prof_z -= height * dish * (1.0 - prof_s) ** 2
    segs = len(outline)
    verts = []
    for s, z in zip(prof_s, prof_z):
        for x, y in outline:
            verts.append((x * s, y * s, z))
    top = len(verts)
    verts.append((0.0, 0.0, float(height * (1.0 - dish))))
    faces = []
    for i in range(len(prof_s) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            a, b = i * segs + j, i * segs + j2
            c, d = (i + 1) * segs + j2, (i + 1) * segs + j
            faces.append((a, b, c, d))
    last = (len(prof_s) - 1) * segs
    for j in range(segs):
        faces.append((last + j, last + (j + 1) % segs, top))
    faces.append(tuple(range(segs - 1, -1, -1)))  # la base cierra el volumen
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    me.update()
    radial = np.concatenate([np.repeat(prof_s, segs), [0.0]])
    return me, radial


def tube(points, radius, ring=8, cap=3):
    """Tubo con puntas redondas por una polilínea. Devuelve (verts, faces)."""
    pts = [np.array(p, dtype=float) for p in points]
    dirs = [pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)] for i in range(len(pts))]
    up = np.array([0.0, 0.0, 1.0])
    verts, faces, rows = [], [], []
    def add_ring(c, d, r):
        d = d / np.linalg.norm(d)
        side = np.cross(d, up)
        side /= np.linalg.norm(side)
        lift = np.cross(side, d)
        row = []
        for k in range(ring):
            a = 2 * math.pi * k / ring
            row.append(len(verts))
            verts.append(tuple(c + (side * math.cos(a) + lift * math.sin(a)) * r))
        rows.append(row)
    d0, d1 = dirs[0] / np.linalg.norm(dirs[0]), dirs[-1] / np.linalg.norm(dirs[-1])
    for i in range(cap, 0, -1):
        a = (math.pi / 2) * i / (cap + 1)
        add_ring(pts[0] - d0 * radius * math.sin(a), dirs[0], radius * math.cos(a))
    for p, d in zip(pts, dirs):
        add_ring(p, d, radius)
    for i in range(1, cap + 1):
        a = (math.pi / 2) * i / (cap + 1)
        add_ring(pts[-1] + d1 * radius * math.sin(a), dirs[-1], radius * math.cos(a))
    for a, b in zip(rows, rows[1:]):
        for k in range(ring):
            k2 = (k + 1) % ring
            faces.append((a[k], a[k2], b[k2], b[k]))
    faces.append(tuple(rows[0][::-1]))
    faces.append(tuple(rows[-1]))
    return verts, faces


def smooth_polyline(points, corner=0.32, sub=4):
    """Polilínea con las esquinas redondeadas (Bézier cuadrática en cada vértice)."""
    pts = [np.array(p, dtype=float) for p in points]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        p0 = b + (a - b) * corner
        p1 = b + (c - b) * corner
        for k in range(sub + 1):
            t = k / sub
            out.append((1 - t) ** 2 * p0 + 2 * t * (1 - t) * b + t ** 2 * p1)
    out.append(pts[-1])
    return out


def link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def volume(me, coords=None):
    bm = bmesh.new()
    bm.from_mesh(me)
    if coords is not None:
        for v, c in zip(bm.verts, coords):
            v.co = c
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    vol = bm.calc_volume(signed=False)
    bm.free()
    return vol


def co_of(me):
    c = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', c)
    return c.reshape(-1, 3).astype(np.float64)


def add_keys(obj, keys):
    """Shape keys desde coordenadas absolutas: {nombre: (N×3, valor mínimo, valor máximo)}."""
    if not obj.data.shape_keys:
        obj.shape_key_add(name='Basis', from_mix=False)
    for name, coords in keys.items():
        sk = obj.shape_key_add(name=name, from_mix=False)
        sk.data.foreach_set('co', np.asarray(coords, dtype=np.float32).ravel())
        sk.slider_min = -1.0
        sk.slider_max = 2.0
    obj.data.update()


def add_clip(obj, name, tracks, duration=None):
    """Acción de pesos en su propia pista NLA. tracks: {shape key: [(segundos, valor), …]}."""
    key = obj.data.shape_keys
    key.animation_data_create()
    anim = key.animation_data
    anim.action = None
    for block in key.key_blocks:
        block.value = 0.0
    last = 0
    for shape, frames in tracks.items():
        block = key.key_blocks[shape]
        for sec, value in frames:
            block.value = value
            frame = round(sec * FPS)
            block.keyframe_insert('value', frame=frame)
            last = max(last, frame)
    action = anim.action
    action.name = name
    action.use_fake_user = True
    track = anim.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.name = name
    strip.extrapolation = 'NOTHING'  # fuera de su tiempo no pisa los pesos (quedan en 0)
    anim.action = None
    for block in key.key_blocks:
        block.value = 0.0
    bpy.context.scene.frame_end = max(bpy.context.scene.frame_end, last)
    return action


# ───────── Materiales: Principled BSDF con nodos procedurales ─────────

def principled(name, base, rough, **inputs):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    for k, v in inputs.items():
        bsdf.inputs[k.replace('_', ' ')].default_value = v
    return mat


def clay(name, base, rough=0.58):
    """Arcilla o silicona mate: subsuperficie ligera y una capa de brillo muy abierta."""
    return principled(name, base, rough, **{
        'Subsurface_Weight': 0.35, 'Subsurface_Scale': 0.05, 'Specular_IOR_Level': 0.4,
        'Coat_Weight': 0.12, 'Coat_Roughness': 0.55,
    })


def frost(name, base):
    """Vidrio esmerilado: transmisión alta, rugosidad media y subsuperficie apenas."""
    return principled(name, base, 0.62, **{
        'Transmission_Weight': 0.82, 'IOR': 1.45, 'Subsurface_Weight': 0.08, 'Subsurface_Scale': 0.06, 'Specular_IOR_Level': 0.5,
    })


def glow(name, base, strength=1.6):
    mat = principled(name, base, 0.5)
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Emission Color'].default_value = (*base, 1.0)
    bsdf.inputs['Emission Strength'].default_value = strength
    return mat


def add_normal_map(mat, image, strength=1.0, repeat=None):
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.location = (-620, -260)
    if repeat:
        coord = nt.nodes.new('ShaderNodeTexCoord')
        coord.location = (-1100, -260)
        mapping = nt.nodes.new('ShaderNodeMapping')
        mapping.location = (-900, -260)
        mapping.inputs['Scale'].default_value = (repeat[0], repeat[1], 1.0)
        nt.links.new(coord.outputs['UV'], mapping.inputs['Vector'])
        nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    nmap = nt.nodes.new('ShaderNodeNormalMap')
    nmap.location = (-300, -260)
    nmap.inputs['Strength'].default_value = strength
    nt.links.new(tex.outputs['Color'], nmap.inputs['Color'])
    nt.links.new(nmap.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    nt.nodes.active = tex
    return tex


def drive_emission(mat, obj, shape, strength):
    """En el .blend la luz interna sigue al peso del shape key (en la web, un uniform)."""
    bsdf = mat.node_tree.nodes['Principled BSDF']
    index = list(bsdf.inputs).index(bsdf.inputs['Emission Strength'])
    fc = mat.node_tree.driver_add(f'nodes["Principled BSDF"].inputs[{index}].default_value')
    drv = fc.driver
    drv.type = 'SCRIPTED'
    var = drv.variables.new()
    var.name = 'w'
    var.type = 'SINGLE_PROP'
    var.targets[0].id_type = 'KEY'
    var.targets[0].id = obj.data.shape_keys
    var.targets[0].data_path = f'key_blocks["{shape}"].value'
    drv.expression = f'max(0, w) * {strength}'


def studio_world():
    """Estudio suave: cielo claro, suelo cálido y dos softboxes en el reflejo; nada de luz dura.
    El sombreador de la web (three3d/calmMaterial.ts) reproduce esta misma luz."""
    world = bpy.data.worlds.new('estudio_suave')
    world.use_nodes = True
    nt = world.node_tree
    nodes, links = nt.nodes, nt.links
    bg = nodes['Background']
    coord = nodes.new('ShaderNodeTexCoord')
    sep = nodes.new('ShaderNodeSeparateXYZ')
    links.new(coord.outputs['Generated'], sep.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    mapz = nodes.new('ShaderNodeMapRange')
    mapz.inputs['From Min'].default_value = -1.0
    links.new(sep.outputs['Z'], mapz.inputs['Value'])
    links.new(mapz.outputs['Result'], ramp.inputs['Fac'])
    ramp.color_ramp.elements[0].color = (0.46, 0.44, 0.42, 1)
    ramp.color_ramp.elements[1].color = (1.0, 0.99, 0.97, 1)
    links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.85
    bpy.context.scene.world = world
    for size, loc, energy in ((3.2, (-2.2, -2.6, 4.2), 70.0), (2.4, (3.4, -1.4, 2.6), 14.0)):
        light = bpy.data.lights.new('softbox', 'AREA')
        light.shape = 'DISK'
        light.size = size
        light.energy = energy
        light.color = (1.0, 0.98, 0.95)
        obj = link(bpy.data.objects.new('softbox', light))
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


def reset(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = name
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = 1
    studio_world()


# ───────── Mapas de normales ─────────

def bake_normals(low, high, size, name, extrusion, distance, samples=8):
    """Normales de la malla alta a la baja (Cycles, espacio tangente). Queda en la imagen `name`
    conectada al material de la malla baja."""
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    for mat in low.data.materials:
        if mat and mat.node_tree.nodes.get('Principled BSDF') and mat.get('takes_normal_map'):
            add_normal_map(mat, img)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    bk = sc.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = extrusion
    bk.max_ray_distance = distance
    bk.normal_space = 'TANGENT'
    bk.margin = 8
    bk.target = 'IMAGE_TEXTURES'
    for o in sc.objects:
        o.select_set(o in (low, high))
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type='NORMAL')
    img.pack()
    return img


def noise_normal_image(name, size, cutoff, strength, seed=7):
    """Grano fino que se repite sin costuras (ruido filtrado en frecuencia): el esmerilado."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((size, size))
    fx = np.fft.fftfreq(size)[:, None]
    fy = np.fft.rfftfreq(size)[None, :]
    band = np.exp(-((np.hypot(fx, fy) - cutoff) ** 2) / (2 * (cutoff * 0.55) ** 2))
    h = np.fft.irfft2(np.fft.rfft2(white) * band, s=(size, size))
    h /= np.abs(h).max()
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, -dy, np.ones_like(h)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgba = np.concatenate([n * 0.5 + 0.5, np.ones((size, size, 1))], axis=-1)
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.pack()
    return img


def set_uv(me, fn):
    uv = me.uv_layers.new(name='UVMap')
    data = np.empty(len(me.loops) * 2, np.float32)
    co = co_of(me)
    idx = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', idx)
    data[0::2], data[1::2] = fn(co[idx])
    uv.data.foreach_set('uv', data)


# ───────── pad: almohadilla de silicona ─────────

PAD_HALF = 0.5
PAD_H = 0.27
PAD_N = 3.4
PAD_SEGS = 48
PAD_RINGS = 11
PAD_BULGE = 0.1  # al presionar, las paredes salen un 10 %: la silicona cede hacia los lados
PAD_NARROW = 0.06  # en el rebote se estrecha lo que crece en alto: conserva el volumen


def pad_radial(co):
    """Radio normalizado en la planta (0 centro, 1 borde), con el mismo contorno del modelo."""
    x, y = np.abs(co[:, 0]) / PAD_HALF, np.abs(co[:, 1]) / PAD_HALF
    return (x ** PAD_N + y ** PAD_N) ** (1.0 / PAD_N)


def pad_press(co, bulge):
    """Compresión blanda: la corona baja mucho y el borde poco; las paredes salen `bulge`."""
    r = pad_radial(co)
    t = np.clip(co[:, 2] / PAD_H, 0.0, 1.2)
    drop = 0.3 * (1.0 - smoothstep(0.3, 1.0, r)) + 0.14
    out = co.copy()
    out[:, 2] = co[:, 2] * (1.0 - drop)
    belly = np.sin(np.pi * np.clip(t, 0.0, 1.0)) ** 0.8
    swell = 1.0 + bulge * belly * smoothstep(0.1, 0.9, r)
    out[:, 0] *= swell
    out[:, 1] *= swell
    return out


def pad_release(co, narrow):
    """Rebote: un poco más alta y más estrecha, con el mismo volumen."""
    r = pad_radial(co)
    t = np.clip(co[:, 2] / PAD_H, 0.0, 1.2)
    out = co.copy()
    out[:, 2] = co[:, 2] * (1.0 + 0.11 * (1.0 - 0.35 * r))
    pull = 1.0 - narrow * np.sin(np.pi * np.clip(t, 0.0, 1.0)) ** 0.8 * smoothstep(0.1, 0.9, r)
    out[:, 0] *= pull
    out[:, 1] *= pull
    return out


def pad_fill(co):
    """La luz llena la almohadilla: se hincha apenas, como si subiera la presión."""
    r = pad_radial(co)
    out = co.copy()
    out[:, 2] = co[:, 2] * (1.0 + 0.07 * (1.0 - 0.5 * r))
    out[:, 0] *= 1.012
    out[:, 1] *= 1.012
    return out


CHECK = [(20 - 12, 12 - 6), (9 - 12, 12 - 17), (4 - 12, 12 - 12)]  # lucide «check», centrado
CHECK_SCALE = 0.025
CHECK_RADIUS = 0.029


def pad_surface(x, y):
    """Altura de la corona de la almohadilla en (x, y): la misma función que el perfil."""
    s = ((abs(x) / PAD_HALF) ** PAD_N + (abs(y) / PAD_HALF) ** PAD_N) ** (1.0 / PAD_N)
    return PAD_H * (1.0 - s ** 2.6) ** (1.0 / 2.2) - PAD_H * 0.08 * (1.0 - s) ** 2


def build_pad():
    reset('pad')
    outline = resample_outline(superellipse(PAD_HALF, PAD_HALF, PAD_N), PAD_SEGS)
    me, _ = pillow('pad', outline, PAD_RINGS, PAD_H, dish=0.08)
    pad = link(bpy.data.objects.new('pad', me))
    shell = clay('pad_silicona', (0.78, 0.86, 0.82))
    shell['takes_normal_map'] = True
    me.materials.append(shell)
    set_uv(me, lambda c: (c[:, 0] / (2 * PAD_HALF) + 0.5, c[:, 1] / (2 * PAD_HALF) + 0.5))

    # Malla alta: mismo perfil y un labio fino alrededor de la corona (va al mapa de normales).
    hi_outline = resample_outline(superellipse(PAD_HALF, PAD_HALF, PAD_N), PAD_SEGS * 8)
    hi_me, hi_s = pillow('pad_alta', hi_outline, PAD_RINGS * 10, PAD_H, dish=0.08)
    hi_co = co_of(hi_me)
    hi_co[:, 2] += np.exp(-((hi_s - 0.7) ** 2) / (2 * 0.018 ** 2)) * 0.0045
    hi_me.vertices.foreach_set('co', hi_co.astype(np.float32).ravel())
    hi_me.update()
    high = link(bpy.data.objects.new('pad_alta', hi_me))
    bake_normals(pad, high, 256, 'pad_normal', 0.012, 0.03)
    high.hide_set(True)
    high.hide_render = True

    # La palomita: un tubo sobre la corona, escondido dentro hasta que se llena de luz.
    pts = smooth_polyline([(x * CHECK_SCALE, y * CHECK_SCALE, 0.0) for x, y in CHECK], corner=0.22, sub=3)
    pts = [(x, y, pad_surface(x, y) + 0.004) for x, y, _ in pts]
    cv, cf = tube(pts, CHECK_RADIUS, ring=8, cap=2)
    base_count = len(me.vertices)
    bm = bmesh.new()
    bm.from_mesh(me)
    mat_check = glow('pad_luz', (0.94, 1.0, 0.97), 1.2)
    me.materials.append(mat_check)
    bvs = [bm.verts.new(v) for v in cv]
    for f in cf:
        nf = bm.faces.new([bvs[i] for i in f])
        nf.smooth = True
        nf.material_index = 1
    bm.to_mesh(me)
    bm.free()
    me.update()
    set_uv_layer = me.uv_layers['UVMap']
    co = co_of(me)
    idx = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', idx)
    data = np.empty(len(me.loops) * 2, np.float32)
    data[0::2] = co[idx, 0] / (2 * PAD_HALF) + 0.5
    data[1::2] = co[idx, 1] / (2 * PAD_HALF) + 0.5
    set_uv_layer.data.foreach_set('uv', data)

    # Shape keys. El volumen se resuelve con la cáscara sola, sin la palomita.
    shell_me = bpy.data.meshes.new('tmp')
    shell_co = co[:base_count]
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    for v in [v for v in bm.verts if v.index >= base_count]:
        bm.verts.remove(v)
    bm.to_mesh(shell_me)
    bm.free()
    v0 = volume(shell_me)
    print(f'press: volumen {volume(shell_me, pad_press(shell_co, PAD_BULGE)) / v0:.3f}')
    print(f'release: volumen {volume(shell_me, pad_release(shell_co, PAD_NARROW)) / v0:.3f}')
    bpy.data.meshes.remove(shell_me)

    pressed, released, filled = pad_press(co, PAD_BULGE), pad_release(co, PAD_NARROW), pad_fill(co)
    # Palomita: escondida en la base; solo sale con `fill`, y al presionar sigue a la corona.
    hidden = co.copy()
    hidden[base_count:, 2] -= 0.08
    filled[base_count:, 2] += 0.008
    add_keys(pad, {'press': pressed + (hidden - co), 'release': released + (hidden - co), 'fill': filled})
    # Base = palomita escondida; `press` y `release` no la mueven de su sitio relativo.
    basis = pad.data.shape_keys.key_blocks['Basis']
    basis.data.foreach_set('co', hidden.astype(np.float32).ravel())
    pad.data.vertices.foreach_set('co', hidden.astype(np.float32).ravel())
    pad.data.update()

    add_clip(pad, 'pad_press', {'press': [(0, 0), (0.05, 0.62), (0.13, 1.0)]})
    add_clip(pad, 'pad_release', {
        'press': [(0, 1.0), (0.1, 0.0), (0.32, 0.0), (0.42, 0.16), (0.58, 0.0)],
        'release': [(0, 0.0), (0.1, 0.0), (0.2, 0.8), (0.34, 0.0), (0.58, 0.0)],
    })
    add_clip(pad, 'pad_fill', {'fill': [(0, 0), (0.18, 0.5), (0.4, 1.08), (0.62, 1.0)]})
    drive_emission(shell, pad, 'fill', 0.5)
    print(f'pad: {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {len(me.vertices)} vértices')
    return [pad]


# ───────── focus: aro de vidrio esmerilado ─────────

RING_R = 1.0
RING_A = 0.112  # radio del tubo hacia fuera
RING_B = 0.15   # radio del tubo hacia quien mira
RING_U = 80
RING_V = 16
FLOW_LOBES = 3
BREATH = 11.0  # segundos: 5,5 respiraciones por minuto, el ritmo de la respiración coherente
INHALE = 4.5   # inhalar es más corto que exhalar
FLOW_PERIOD = 26.0


def ring_points(r_scale=1.0, a_scale=1.0, b_scale=1.0, wave_cos=0.0, wave_sin=0.0):
    """Aro en el plano XY, recorrido en sentido horario desde arriba (12 en punto). La ola
    (3 lóbulos) ensancha el tubo, lo desplaza y lo enrosca un poco: el reflejo fluye con ella."""
    th = 2 * np.pi * np.arange(RING_U)[:, None] / RING_U
    ph = 2 * np.pi * np.arange(RING_V)[None, :] / RING_V
    wave = wave_cos * np.cos(FLOW_LOBES * th) + wave_sin * np.sin(FLOW_LOBES * th)
    a = RING_A * a_scale * (1 + 0.085 * wave)
    b = RING_B * b_scale * (1 - 0.06 * wave)
    roll = 0.24 * wave
    ca, cb = np.cos(ph) * a, np.sin(ph) * b
    radial = RING_R * r_scale * (1 + 0.009 * wave) + ca * np.cos(roll) - cb * np.sin(roll)
    z = ca * np.sin(roll) + cb * np.cos(roll)
    return np.stack([radial * np.sin(th), radial * np.cos(th), z], axis=-1).reshape(-1, 3)


def build_focus():
    reset('focus')
    verts = ring_points()
    faces = []
    for i in range(RING_U):
        i2 = (i + 1) % RING_U
        for j in range(RING_V):
            j2 = (j + 1) % RING_V
            faces.append((i * RING_V + j, i * RING_V + j2, i2 * RING_V + j2, i2 * RING_V + j))
    me = bpy.data.meshes.new('focus_ring')
    me.from_pydata(verts.tolist(), [], faces)
    me.update()
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    me.update()
    # UV por esquina: u = vuelta del aro (0 arriba, en sentido horario), v = vuelta del tubo. En la
    # costura la cara de cierre usa 1 en vez de 0; la topología sigue cerrada y la normal, continua.
    uv = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        i = p.index // RING_V
        j = p.index % RING_V
        corners = ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))
        for loop, (ci, cj) in zip(p.loop_indices, corners):
            uv.data[loop].uv = (ci / RING_U, cj / RING_V)
    ring = link(bpy.data.objects.new('focus_ring', me))
    glass = frost('focus_vidrio', (0.86, 0.93, 0.89))
    me.materials.append(glass)
    # Procedural → mapa: el grano del esmerilado, sin costuras, repetido a lo largo del aro.
    add_normal_map(glass, noise_normal_image('focus_esmerilado', 128, 0.22, 0.55), repeat=(14.0, 3.0))

    add_keys(ring, {
        'inhale': ring_points(r_scale=1.042, a_scale=1.14, b_scale=1.12),
        'exhale': ring_points(r_scale=0.982, a_scale=0.9, b_scale=0.92),
        'flow_a': ring_points(wave_cos=1.0),
        'flow_b': ring_points(wave_sin=1.0),
    })
    add_clip(ring, 'focus_breath', {
        'inhale': [(0, 0.0), (INHALE, 1.0), (BREATH, 0.0)],
        'exhale': [(0, 1.0), (INHALE, 0.0), (BREATH, 1.0)],
    })
    # La ola da la vuelta: dos ondas en cuadratura. Claves cada octavo de ciclo (curvas suaves).
    steps = [FLOW_PERIOD * k / 8 for k in range(9)]
    add_clip(ring, 'focus_flow', {
        'flow_a': [(t, math.cos(2 * math.pi * t / FLOW_PERIOD)) for t in steps],
        'flow_b': [(t, math.sin(2 * math.pi * t / FLOW_PERIOD)) for t in steps],
    })
    print(f'focus: {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {len(me.vertices)} vértices')
    return [ring]


# ───────── nav: canto rodado del navbar ─────────

PEBBLE_X = 0.875
PEBBLE_Y = 0.5
PEBBLE_H = 0.2


def rounded_rect(hx, hy, r):
    """Contorno de un rectángulo redondeado, visto desde el centro."""
    def fn(t):
        c, s = math.cos(t), math.sin(t)
        lo, hi = 0.0, hx + hy
        for _ in range(40):
            m = (lo + hi) / 2
            qx, qy = abs(c * m) - hx + r, abs(s * m) - hy + r
            d = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r
            lo, hi = (m, hi) if d < 0 else (lo, m)
        return lo * c, lo * s
    return fn


def build_nav():
    reset('nav')
    outline = resample_outline(rounded_rect(PEBBLE_X, PEBBLE_Y, 0.44), 72)
    me, _ = pillow('pebble', outline, 9, PEBBLE_H, crown=3.4, wall=2.5)
    pebble = link(bpy.data.objects.new('pebble', me))
    mat = clay('nav_arcilla', (0.72, 0.86, 0.78), rough=0.42)
    mat['takes_normal_map'] = True
    me.materials.append(mat)
    uv_of = lambda c: (c[:, 0] / (2 * PEBBLE_X) + 0.5, c[:, 1] / (2 * PEBBLE_X) + 0.5)
    set_uv(me, uv_of)

    hi_me, hi_s = pillow('pebble_alta', resample_outline(rounded_rect(PEBBLE_X, PEBBLE_Y, 0.44), 576), 90, PEBBLE_H, crown=3.4, wall=2.5)
    hi_co = co_of(hi_me)
    hi_co[:, 2] += np.exp(-((hi_s - 0.84) ** 2) / (2 * 0.016 ** 2)) * 0.0035
    hi_me.vertices.foreach_set('co', hi_co.astype(np.float32).ravel())
    hi_me.update()
    high = link(bpy.data.objects.new('pebble_alta', hi_me))
    bake_normals(pebble, high, 128, 'nav_normal', 0.012, 0.03)
    high.hide_set(True)
    high.hide_render = True

    co = co_of(me)
    def scaled(sx, sy, sz):
        out = co.copy()
        t = np.clip(co[:, 2] / PEBBLE_H, 0.0, 1.0)
        belly = np.sin(np.pi * t) ** 0.8
        out[:, 0] *= 1 + (sx - 1) * (0.6 + 0.4 * belly)
        out[:, 1] *= 1 + (sy - 1) * (0.6 + 0.4 * belly)
        out[:, 2] *= sz
        return out
    add_keys(pebble, {
        'stretch_x': scaled(1.2, 0.93, 0.9),
        'stretch_y': scaled(0.93, 1.22, 0.9),
        'squash': scaled(1.05, 1.07, 0.7),
    })
    travel = [(0, 0.0), (0.09, 0.55), (0.2, 1.0), (0.34, 0.2), (0.42, 0.0), (0.62, 0.0)]
    add_clip(pebble, 'nav_travel', {
        'stretch_x': travel,
        'stretch_y': travel,
        'squash': [(0, 0.0), (0.06, 0.32), (0.16, 0.0), (0.36, 0.0), (0.44, 0.62), (0.54, 0.0), (0.62, 0.0)],
    })
    print(f'nav: {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {len(me.vertices)} vértices')
    return [pebble]


# ───────── card: la losa de las tarjetas y su bisel para CSS ─────────

CARD_X = 1.5
CARD_Y = 1.0
CARD_R = 0.15  # 16 px en una tarjeta de 320 × 213
CARD_T = 0.05
CARD_ROLL = 0.05  # ancho del canto redondeado (5 px)


def slab(name, hx, hy, r, thick, roll, segs, rings):
    """Losa con el canto redondeado y la cara plana: anillos a distancia fija del borde (no
    escalados), así el bisel mide lo mismo en todo el contorno."""
    outline = resample_outline(rounded_rect(hx, hy, r), segs)
    tangent = np.roll(outline, -1, axis=0) - np.roll(outline, 1, axis=0)
    normal = np.stack([tangent[:, 1], -tangent[:, 0]], axis=1)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)
    verts, faces = [], []
    profile = [(roll * (1 - math.cos(a)), (thick - roll) + roll * math.sin(a)) for a in np.linspace(0, math.pi / 2, rings)]
    profile = [(0.0, 0.0), *profile]
    for d, z in profile:
        for p, n in zip(outline, normal):
            verts.append((p[0] - n[0] * d, p[1] - n[1] * d, z))
    for k in range(len(profile) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            faces.append((k * segs + j, k * segs + j2, (k + 1) * segs + j2, (k + 1) * segs + j))
    faces.append(tuple(range(segs * (len(profile) - 1), segs * len(profile))))
    faces.append(tuple(range(segs - 1, -1, -1)))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    me.validate()
    for p in me.polygons:
        p.use_smooth = len(p.vertices) == 4
    me.update()
    return me


def bake_card_bevel(path, samples):
    """Bisel para CSS (border-image): una losa pequeña de 50 × 50 px vista de frente, con la luz
    del estudio. Lo que importa es cuánto se aparta de la cara plana: más claro → blanco con alfa,
    más oscuro → negro con alfa; la cara queda transparente y el color lo pone el tema."""
    px = 0.02  # unidades por px de pantalla
    me = slab('bisel', 25 * px, 25 * px, 16 * px, 6 * px, 5 * px, 96, 7)
    obj = link(bpy.data.objects.new('bisel', me))
    mat = clay('bisel_arcilla', (0.8, 0.8, 0.8), rough=0.5)
    me.materials.append(mat)
    sc = bpy.context.scene
    # Vista cenital: +y es arriba en la pantalla. Las luces pasan arriba, como en toda la interfaz.
    for o in sc.objects:
        if o.type == 'LIGHT':
            o.location.y = abs(o.location.y)
            o.rotation_euler = (Vector((0, 0, 0)) - o.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = max(samples, 48)
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    size = 200  # 4× los 50 px
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '16'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    cam = link(bpy.data.objects.new('bisel_cam', bpy.data.cameras.new('bisel_cam')))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 50 * px
    cam.location = (0, 0, 2)
    sc.camera = cam
    tmp = path + '.tmp.png'
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    rgba = np.array(img.pixels[:], dtype=np.float64).reshape(size, size, 4)
    lum = rgba[..., :3].mean(axis=-1)
    face = np.median(lum[size // 2 - 8:size // 2 + 8, size // 2 - 8:size // 2 + 8])
    delta = (lum - face) / face
    # Solo el canto: más allá de los 7 px desde el borde queda transparente sin escalón.
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]) / 4.0
    fade = smoothstep(9.0, 5.0, edge)
    # Curva suave: el borde no se vuelve una línea. Lo oscuro pesa menos que lo claro.
    strength = np.where(delta > 0, 0.72, 0.3)
    alpha = strength * (1.0 - np.exp(-np.abs(delta) * 2.6)) * fade * rgba[..., 3]
    out = np.zeros_like(rgba)
    out[..., :3] = (delta > 0)[..., None] * 1.0
    out[..., 3] = alpha
    # Promedio 2×2: 100 × 100 px, con el suavizado que deja la reducción.
    small = out.reshape(h // 2, 2, w // 2, 2, 4).mean(axis=(1, 3))
    result = bpy.data.images.new('card_bevel', w // 2, h // 2, alpha=True)
    result.pixels.foreach_set(small.astype(np.float32).ravel())
    result.file_format = 'WEBP'
    result.filepath_raw = path
    result.save(quality=92)
    bpy.data.images.remove(img)
    os.remove(tmp)
    print('bisel', path, os.path.getsize(path), 'bytes, máximo alfa', round(float(small[..., 3].max()), 3))
    bpy.data.objects.remove(obj)
    bpy.data.objects.remove(cam)
    bpy.data.materials.remove(mat)
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'


def build_card():
    reset('card')
    bevel_out = arg('--bevel')
    if bevel_out:
        bake_card_bevel(bevel_out, int(arg('--samples', 64)))
    me = slab('card_slab', CARD_X, CARD_Y, CARD_R, CARD_T, CARD_ROLL, 80, 5)
    card = link(bpy.data.objects.new('card_slab', me))
    mat = clay('card_arcilla', (0.97, 0.96, 0.93))
    me.materials.append(mat)
    set_uv(me, lambda c: (c[:, 0] / (2 * CARD_X) + 0.5, c[:, 1] / (2 * CARD_Y) + 0.5))
    co = co_of(me)
    lifted = co.copy()
    lifted[:, 2] += 0.12
    pressed = co.copy()
    r = np.hypot(co[:, 0] / CARD_X, co[:, 1] / CARD_Y)
    pressed[:, 2] -= 0.012 * (1 - smoothstep(0.0, 1.0, r)) * (co[:, 2] > CARD_T * 0.5)
    add_keys(card, {'lift': lifted, 'press': pressed})
    add_clip(card, 'card_lift', {'lift': [(0, 0.0), (0.18, 1.04), (0.34, 1.0)]})
    add_clip(card, 'card_settle', {'lift': [(0, 1.0), (0.22, -0.03), (0.4, 0.0)]})
    print(f'card: {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {len(me.vertices)} vértices')
    return [card]


# ───────── hero: la escultura del splash ─────────
#
# Una cinta gruesa de Möbius con tres medias vueltas: sección de dos crestas (una lente de bordes
# suaves) que al cerrar el aro empalma cada lado con el otro. Quedan tres tramos a la vista y un
# agujero de tres lados (rutina, mente e ideas), pero es una sola cara y un solo canto, sin costura.
# La malla base es el toro liso; las crestas son una ola en cuadratura (ridge_a, ridge_b), así que
# girar la fase hace rodar la superficie sin mover el objeto.

HERO_R = 1.0
HERO_TUBE = 0.39
HERO_RIDGE = 0.46  # alto de la cresta, en fracción del tubo
HERO_LOBES = 2
HERO_TWIST = 3
HERO_U = 64
HERO_V = 24
HERO_UV_MARGIN = 1.08  # las caras que cruzan la costura del tubo necesitan pasarse un poco de 1
HERO_THROAT = 0.74 * np.pi  # hasta dónde del tubo (desde afuera) cubre la gota; el resto, por dentro
HERO_MASS = 0.92  # radio de la gota de la que nace
HERO_CORE = 0.9  # el núcleo de arcilla, en fracción del tubo
HERO_CORE_RIDGE = 0.444  # su cresta es más baja: el canto de la cinta queda lleno de vidrio
HERO_BREATH = 4.0  # segundos: lo que se alcanza a ver mientras carga la app
HERO_ROLL = 9.0


def hero_grid(segs_u=HERO_U, segs_v=HERO_V, follow=True):
    """u da la vuelta al aro; v, al tubo (0 afuera, ±π en el ecuador de adentro). Con `follow`, las
    filas de la malla van a lo largo de la cresta, a cualquier fase de la ola: con pocas caras la
    silueta sale limpia. Cerrar el aro corre media vuelta las filas (HERO_V tiene que ser par)."""
    u = 2 * np.pi * np.arange(segs_u)[:, None] / segs_u
    v = -np.pi + (np.arange(segs_v)[None, :] + 0.5) * 2 * np.pi / segs_v
    if follow:
        v = (v - (HERO_TWIST / HERO_LOBES) * u + np.pi) % (2 * np.pi) - np.pi
    return u, v


def hero_points(c=0.0, s=0.0, ring=1.0, tube=1.0, ridge=HERO_RIDGE, segs_u=HERO_U, segs_v=HERO_V, bump=None, follow=True):
    u, v = hero_grid(segs_u, segs_v, follow)
    th = HERO_LOBES * v + HERO_TWIST * u
    rad = HERO_TUBE * tube * (1 + ridge * (c * np.cos(th) + s * np.sin(th)))
    if bump is not None:
        rad = rad + bump
    rho = HERO_R * ring + rad * np.cos(v)
    return np.stack([rho * np.cos(u), rho * np.sin(u), rad * np.sin(v)], axis=-1).reshape(-1, 3)


def hero_fold(v):
    """Para cerrar el agujero sin dientes: de afuera hasta HERO_THROAT, la vuelta del tubo se estira
    a media esfera por lado (elevación de −90° a 90°); lo de adentro se dobla sobre el eje, hasta el
    centro, donde se juntan los dos lados. Es continuo y no depende de por dónde pasen las filas.
    Devuelve la elevación y, para lo doblado, cuánto baja hacia el centro (0 en el polo, 1 al llegar)."""
    side = np.sign(v)
    # Primero un margen de una cara en el polo mismo: si lo vecino de la superficie ya bajara por el
    # eje, quedaría un pozo en el polo.
    margin = 2 * np.pi * (1 / HERO_V + (HERO_TWIST / HERO_LOBES) / HERO_U)
    start = HERO_THROAT + margin
    fold = np.clip((np.abs(v) - start) / (np.pi - start), 0.0, 1.0)
    return side * np.minimum(np.abs(v) / HERO_THROAT, 1.0) * np.pi / 2, fold


def hero_mass():
    u, v = hero_grid()
    e, fold = hero_fold(v)
    z = np.sin(e) * (1.0 - fold)
    return (HERO_MASS * np.stack([np.cos(e) * np.cos(u), np.cos(e) * np.sin(u), z], axis=-1)).reshape(-1, 3)


def hero_pebble():
    """El canto rodado del navbar (build_nav): mismo contorno y perfil, centrado en su alto."""
    u, v = hero_grid()
    e, fold = hero_fold(v)
    edge = np.array([rounded_rect(PEBBLE_X, PEBBLE_Y, 0.44)(a) for a in u[:, 0]])
    s = 1.0 - (np.abs(e) / (np.pi / 2)) ** 1.7
    z = np.where(e > 0, PEBBLE_H * (1.0 - s ** 3.4) ** (1.0 / 2.5), 0.0)
    middle = PEBBLE_H * 0.5  # los dos lados se juntan por dentro, a media altura
    z = (z + (middle - z) * fold) - 0.09
    return np.stack([edge[:, 0, None] * s, edge[:, 1, None] * s, z], axis=-1).reshape(-1, 3)


def grid_mesh(name, coords, segs_u, segs_v, follow=True):
    seam = segs_v // 2 if follow else 0
    faces = []
    for i in range(segs_u):
        i2, s = (i + 1, 0) if i + 1 < segs_u else (0, seam)
        for j in range(segs_v):
            j2 = (j + 1) % segs_v
            faces.append((i * segs_v + j, i2 * segs_v + (j + s) % segs_v, i2 * segs_v + (j2 + s) % segs_v, i * segs_v + j2))
    me = bpy.data.meshes.new(name)
    me.from_pydata(coords.tolist(), [], faces)
    me.update()
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    me.update()
    # UV por esquina: x = vuelta del aro, y = vuelta del tubo (dividida por HERO_UV_MARGIN). La malla
    # sigue cerrada: al separar vértices en las costuras para el .glb, normales y shape keys son los mismos.
    v = np.broadcast_to(hero_grid(segs_u, segs_v, follow)[1], (segs_u, segs_v))
    uv = me.uv_layers.new(name='UVMap')
    data = np.empty(len(me.loops) * 2, np.float32)
    k = 0
    for p in me.polygons:
        i, j = p.index // segs_v, p.index % segs_v
        corners = ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))
        ys = [(v[0, (cj + seam) % segs_v] if ci == segs_u else v[ci, cj % segs_v]) for ci, cj in corners]
        ys = np.array(ys) / (2 * np.pi) + 0.5
        ys += np.round(ys[0] - ys)  # sin saltos dentro de la cara
        ys += ys.min() < 0
        for (ci, _), y in zip(corners, ys):
            data[k], data[k + 1] = ci / segs_u, y / HERO_UV_MARGIN
            k += 2
    uv.data.foreach_set('uv', data)
    return me


def hero_undulation(segs_u, segs_v, seed=11):
    """Lo que deja la mano en la arcilla: ondas muy bajas, periódicas en las dos vueltas (fft)."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((segs_u, segs_v))
    # Frecuencias físicas: ciclos por unidad a lo largo del aro y alrededor del tubo.
    fu = np.fft.fftfreq(segs_u, 2 * np.pi * HERO_R / segs_u)[:, None]
    fv = np.fft.rfftfreq(segs_v, 2 * np.pi * HERO_TUBE / segs_v)[None, :]
    f = np.hypot(fu, fv)
    h = 0.0
    for cycles, amp in ((1.2, 0.016), (4.5, 0.0028)):
        band = np.exp(-((f - cycles) ** 2) / (2 * (cycles * 0.4) ** 2))
        layer = np.fft.irfft2(np.fft.rfft2(white) * band, s=(segs_u, segs_v))
        h = h + layer / np.abs(layer).max() * amp
    return h


def hero_lights():
    """Tres puntos de estudio suave: principal tenue arriba a la izquierda (donde la pone toda la
    interfaz), relleno muy abierto y contraluz apenas para despegar la silueta."""
    for o in [o for o in bpy.context.scene.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o)
    # El fondo: el color de la app (#f9f7f3), parejo, para que el paso a la interfaz no se note.
    nodes = bpy.context.scene.world.node_tree.nodes
    links = bpy.context.scene.world.node_tree.links
    for link_ in list(nodes['Background'].inputs['Color'].links):
        links.remove(link_)
    nodes['Background'].inputs['Color'].default_value = (0.947, 0.93, 0.896, 1.0)
    nodes['Background'].inputs['Strength'].default_value = 1.0
    bpy.context.scene.view_settings.view_transform = 'Standard'
    bpy.context.scene.view_settings.look = 'None'
    for name, loc, energy, size in (('Key', (-3.1, 3.4, 5.4), 90.0, 4.5), ('Fill', (4.8, 0.4, 3.0), 16.0, 6.0), ('Rim', (1.8, 4.8, -3.0), 50.0, 3.2)):
        light = bpy.data.lights.new(name, 'AREA')
        light.shape = 'DISK'
        light.size = size
        light.energy = energy
        light.color = (1.0, 0.985, 0.96)
        obj = link(bpy.data.objects.new(name, light))
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


def hero_core(hero):
    """El núcleo de arcilla del .blend: mismo morph sin las crestas, siguiendo al vidrio con drivers.
    No va en el .glb: la web lo dibuja con la misma malla (splash/hero.ts), sin pesar el doble."""
    me = grid_mesh('hero_nucleo', hero_points(tube=HERO_CORE), HERO_U, HERO_V)
    core = link(bpy.data.objects.new('hero_nucleo', me))
    me.materials.append(clay('hero_arcilla', (0.62, 0.8, 0.7), rough=0.6))
    low = {'tube': HERO_CORE, 'ridge': HERO_CORE_RIDGE}
    add_keys(core, {
        'ridge_a': hero_points(c=1.0, **low),
        'ridge_b': hero_points(s=1.0, **low),
        'breath': hero_points(ring=1.03, tube=HERO_CORE * 1.05),
        'mass': hero_mass() * 0.46,
        'pebble': hero_pebble() * 0.97,
    })
    for name in ('ridge_a', 'ridge_b', 'breath', 'mass', 'pebble'):
        fc = core.data.shape_keys.driver_add(f'key_blocks["{name}"].value')
        drv = fc.driver
        drv.type = 'AVERAGE'
        var = drv.variables.new()
        var.name = 'w'
        var.type = 'SINGLE_PROP'
        var.targets[0].id_type = 'KEY'
        var.targets[0].id = hero.data.shape_keys
        var.targets[0].data_path = f'key_blocks["{name}"].value'
    return core


def spring(t, freq, decay):
    """Muelle amortiguado de 0 a 1: se pasa, vuelve y se asienta (el rebote blando de la masa)."""
    t = max(t, 0.0)
    return 1.0 - math.exp(-decay * t) * math.cos(2 * math.pi * freq * t)


def build_hero():
    reset('hero')
    hero_lights()
    me = grid_mesh('hero', hero_points(), HERO_U, HERO_V)
    hero = link(bpy.data.objects.new('hero', me))
    glass = frost('hero_vidrio', (0.8, 0.9, 0.84))
    glass['takes_normal_map'] = True
    me.materials.append(glass)

    # Malla alta: el mismo toro con la ondulación de la mano (va al mapa de normales).
    su, sv = HERO_U * 5, HERO_V * 5
    hi_me = grid_mesh('hero_alta', hero_points(segs_u=su, segs_v=sv, bump=hero_undulation(su, sv), follow=False), su, sv, follow=False)
    high = link(bpy.data.objects.new('hero_alta', hi_me))
    bake_normals(hero, high, 128, 'hero_normal', 0.02, 0.05)
    high.hide_set(True)
    high.hide_render = True

    add_keys(hero, {
        'ridge_a': hero_points(c=1.0),
        'ridge_b': hero_points(s=1.0),
        'breath': hero_points(ring=1.03, tube=1.05),
        'mass': hero_mass(),
        'pebble': hero_pebble(),
    })

    # Nacimiento: la gota se abre con un rebote blando y la cresta sube después, con su propio muelle.
    frames = [k / 30 for k in range(0, 39)]
    end = 1.3
    add_clip(hero, 'hero_birth', {
        'mass': [*((t, 1.0 - spring(t, 1.05, 4.1)) for t in frames), (end, 0.0)],
        'ridge_a': [*((t, spring(t - 0.3, 1.15, 4.6) if t > 0.3 else 0.0) for t in frames), (end, 1.0)],
        'breath': [*((t, 0.7 * math.exp(-3.4 * t) * math.sin(2 * math.pi * 1.6 * t)) for t in frames), (end, 0.0)],
    })
    add_clip(hero, 'hero_breath', {
        'ridge_a': [(0, 1.0), (HERO_BREATH, 1.0)],
        'breath': [(0, 0.0), (HERO_BREATH * 0.4, 1.0), (HERO_BREATH, 0.0)],
    })
    steps = [HERO_ROLL * k / 8 for k in range(9)]
    add_clip(hero, 'hero_roll', {
        'ridge_a': [(t, math.cos(2 * math.pi * t / HERO_ROLL)) for t in steps],
        'ridge_b': [(t, math.sin(2 * math.pi * t / HERO_ROLL)) for t in steps],
    })
    # Salida: toma aire, suelta las crestas y se recoge en el canto rodado antes de llegar.
    add_clip(hero, 'hero_outro', {
        'ridge_a': [(0, 1.0), (0.1, 1.0), (0.4, 0.0), (0.95, 0.0)],
        'breath': [(0, 0.0), (0.12, 0.7), (0.34, 0.0), (0.95, 0.0)],
        'pebble': [(0, 0.0), (0.14, 0.0), (0.42, 0.62), (0.62, 1.04), (0.78, 0.99), (0.95, 1.0)],
    })
    hero_core(hero)
    # Encuadre de cerca, de frente y un poco de lado, como en el splash.
    cam = link(bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')))
    cam.data.lens = 85
    cam.location = (-1.0, -3.2, 13.0)
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x = sc.render.resolution_y = 1024
    print(f'hero: {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {len(me.vertices)} vértices')
    return [hero]


# ───────── Exportación ─────────

def export(objs, path, frame_step=2):
    bpy.context.scene.frame_set(-1000)  # antes de todas las pistas
    for o in objs:
        for block in o.data.shape_keys.key_blocks:
            block.value = 0.0  # los pesos por defecto del .glb
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
        export_normals=True, export_texcoords=True, export_tangents=False, export_materials='EXPORT',
        export_image_format='WEBP', export_image_quality=88,
        export_vertex_color='NONE', export_attributes=False, export_extras=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=frame_step,
        export_optimize_animation_size=True, export_anim_slide_to_zero=False, export_bake_animation=False,
        export_morph=True, export_morph_normal=True, export_morph_animation=True, export_morph_reset_sk_data=True,
        export_skins=False, export_cameras=False, export_lights=False,
    )
    print(f'glb {path}: {os.path.getsize(path)} bytes')


def qa_render(objs, path, setups, samples):
    """Lámina de control: un fotograma por estado, en Cycles con el estudio suave."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = setups.get('denoise', False)
    sc.render.film_transparent = False
    cam = link(bpy.data.objects.new('qa_cam', bpy.data.cameras.new('qa_cam')))
    cam.data.lens = 85
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = setups['res']
    sc.render.image_settings.file_format = 'PNG'
    cam.location = setups['cam']
    cam.rotation_euler = (Vector(setups.get('look', (0, 0, 0))) - Vector(setups['cam'])).to_track_quat('-Z', 'Y').to_euler()
    floor = setups.get('floor')
    if floor is not None:
        bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, floor))
        plane = bpy.context.object
        plane.data.materials.append(clay('qa_suelo', (0.93, 0.92, 0.89), 0.8))
    obj = objs[0]
    key = obj.data.shape_keys
    # Las pistas NLA pisan los pesos a mano: se silencian mientras dura la lámina.
    for track in key.animation_data.nla_tracks:
        track.mute = True
    for label, weights in setups['states'].items():
        for block in key.key_blocks:
            block.value = weights.get(block.name, 0.0)
        bpy.context.view_layer.update()
        sc.render.filepath = f'{path}-{label}.png'
        bpy.ops.render.render(write_still=True)
        print('render', sc.render.filepath)
    for block in key.key_blocks:
        block.value = 0.0
    for track in key.animation_data.nla_tracks:
        track.mute = False


QA = {
    'pad': {
        'res': (640, 480), 'cam': (0, -3.2, 2.5), 'look': (0, 0, 0.1), 'floor': 0.0,
        'states': {'rest': {}, 'press': {'press': 1.0}, 'release': {'release': 1.0}, 'on': {'fill': 1.0}},
    },
    'focus': {
        'res': (640, 640), 'cam': (0, -5.5, 9.6), 'look': (0, 0, 0), 'floor': -0.6,
        'states': {'rest': {}, 'inhale': {'inhale': 1.0}, 'exhale': {'exhale': 1.0}, 'flow': {'flow_a': 1.0}},
    },
    'nav': {
        'res': (640, 400), 'cam': (0, -3.4, 5.0), 'look': (0, 0, 0.05), 'floor': 0.0,
        'states': {'rest': {}, 'stretch': {'stretch_x': 1.0}, 'squash': {'squash': 1.0}},
    },
    'hero': {
        'res': (640, 640), 'cam': (-1.0, -3.2, 13.0), 'look': (0, 0, 0), 'denoise': True,
        'states': {
            'rest': {'ridge_a': 1.0}, 'roll': {'ridge_a': 0.71, 'ridge_b': 0.71}, 'inhale': {'ridge_a': 1.0, 'breath': 1.0},
            'mass': {'mass': 1.0}, 'birth': {'mass': 0.45, 'ridge_a': 0.2}, 'outro': {'pebble': 0.55, 'ridge_a': 0.2}, 'pebble': {'pebble': 1.0},
        },
    },
}

BUILD = {'pad': build_pad, 'focus': build_focus, 'nav': build_nav, 'card': build_card, 'hero': build_hero}
# Muestras de animación por juego: la respiración es lenta, con 5 por segundo basta.
FRAME_STEP = {'focus': 12, 'hero': 4}


def main():
    names = (arg('--sets') or ','.join(BUILD)).split(',')
    folder = arg('--dir', '.')
    blend = arg('--blend')
    render_dir = arg('--render')
    samples = int(arg('--samples', 48))
    for name in names:
        objs = BUILD[name]()
        export(objs, os.path.join(folder, f'calm-{name}.glb'), FRAME_STEP.get(name, 2))
        if blend:
            # Aquí y no antes: reset() vuelve a las preferencias de fábrica.
            bpy.context.preferences.filepaths.save_version = 0  # sin copias .blend1
            bpy.ops.file.pack_all()
            bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(blend, f'calm-{name}.blend')), compress=True)
        if render_dir and name in QA:
            qa_render(objs, os.path.join(render_dir, name), QA[name], samples)


main()
