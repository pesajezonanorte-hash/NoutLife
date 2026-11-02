# «Materia calma»: el volumen de la interfaz, modelado en Blender por código.
#
#   pad    Almohadilla de silicona de los hábitos (shape keys press, release, fill).
#   focus  Aro de vidrio esmerilado del enfoque (shape keys inhale, exhale, flow_a, flow_b).
#   card   Losa de las tarjetas (shape key lift) y su bisel horneado para CSS (9 cortes).
#   hero   Secuencia del splash: hojas → N → líquido → logo (shape keys scatter, puff, drop; los tiempos, en hero_tiempo).
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
import re
import sys

import bmesh
import bpy
import mathutils
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


# ───────── card: la losa de las tarjetas y su bisel para CSS ─────────

CARD_X = 1.5
CARD_Y = 1.0
CARD_R = 0.15  # 16 px en una tarjeta de 320 × 213
CARD_T = 0.05
CARD_ROLL = 0.05  # ancho del canto redondeado (5 px)


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


# ───────── hero: la secuencia del splash ─────────
#
# Hojas → N → líquido → logo. Coordenadas de la N: x a la derecha, y arriba, z hacia quien mira; la N
# mide 2 unidades de alto, centrada, y su contorno sale exacto de los trazados del logo
# (components/layout/Brand.tsx). Cada parte es una almohada con su pared: el trazo del logo es la línea
# donde la altura vale 0, y esa pared la abre la web hacia fuera (atributo _OUT) para tener una altura
# con signo alrededor del borde, con la que el líquido se funde con la N. Fuera de la web se ve como
# el canto de la pieza. Tres mallas en una: c, a y b, en el orden en que el logo las pinta.

HERO_LOGO = {
    'c': 'M474 198C581.2 230.2 670.1 305.6 669.0 500.0L669 760C669 776 666 783 662 785L500 600L474 489Z',
    'a': 'M1 0C124.1 148.2 331.6 191.3 474.0 489.0L662 785C314.2 532.2 633.0 710.9 118.0 399.0C-22.3 290.2 2.6 200.5 0.0 150.0L0 4Z',
    'b': 'M2 271C93.4 468.0 228.1 416.0 251.0 545.0L251 743C76.1 695.7 -13.2 587.2 0.0 380.0L0 275Z',
}
HERO_ORDER = ('c', 'a', 'b')
HERO_STEP = 0.042  # separación de los puntos del contorno, en unidades de la N
HERO_H = 0.15  # alto de la almohada
HERO_D = 0.17  # distancia al borde a la que deja de subir
HERO_BAND = (0.012, 0.03, 0.058, 0.1)  # anillos hacia dentro, donde más se curva
HERO_WALL = 0.28  # la pared baja esto; la web la abre hacia fuera
HERO_DROP_R = 0.6  # la gota en la que se recoge
HERO_DROP_H = 0.42
HERO_LEAVES = 118
HERO_LEAF_ROWS = 5
HERO_BIRTH = 1.3
HERO_OUTRO = 1.5
HERO_BREATH = 4.0
HERO_END = (-2.05, 1.5)  # dónde se posa, en el encuadre del .blend: la esquina del logo


def svg_to_n(p):
    return np.array([(p[0] - 335.0) / 393.0, (393.0 - p[1]) / 393.0])


def logo_outline(path):
    """Contorno de un trazado M/C/L/Z, con puntos a HERO_STEP y las esquinas intactas."""
    nums = [float(v) for v in re.findall(r'-?\d+\.?\d*', path)]
    cmds = re.findall(r'[MCLZ]', path)
    pts, at = [], 0
    current = None
    for cmd in cmds:
        if cmd == 'M':
            current = svg_to_n(nums[at:at + 2])
            at += 2
            pts.append(current)
        elif cmd == 'L':
            end = svg_to_n(nums[at:at + 2])
            at += 2
            n = max(1, round(np.linalg.norm(end - current) / HERO_STEP))
            pts += [current + (end - current) * k / n for k in range(1, n + 1)]
            current = end
        elif cmd == 'C':
            c0, c1, end = [svg_to_n(nums[at + i:at + i + 2]) for i in (0, 2, 4)]
            at += 6
            bez = lambda t: (1 - t) ** 3 * current + 3 * (1 - t) ** 2 * t * c0 + 3 * (1 - t) * t * t * c1 + t ** 3 * end
            dense = np.array([bez(t) for t in np.linspace(0, 1, 80)])
            s = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(dense, axis=0), axis=1))])
            n = max(2, round(s[-1] / HERO_STEP))
            want = np.linspace(0, s[-1], n + 1)[1:]
            pts += [np.array([np.interp(w, s, dense[:, 0]), np.interp(w, s, dense[:, 1])]) for w in want]
            current = end
    pts = np.array(pts)
    # Sin el último si repite el primero; sentido antihorario.
    if np.linalg.norm(pts[0] - pts[-1]) < 1e-3:
        pts = pts[:-1]
    x, y = pts[:, 0], pts[:, 1]
    if np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y) < 0:
        pts = pts[::-1]
    return pts


def seg_distance(points, poly):
    """Distancia de cada punto al contorno cerrado, y el tramo más cercano."""
    a, b = poly, np.roll(poly, -1, axis=0)
    ab = b - a
    ap = points[:, None, :] - a[None, :, :]
    t = np.clip((ap * ab[None]).sum(-1) / (ab * ab).sum(-1)[None], 0.0, 1.0)
    d = np.linalg.norm(ap - t[..., None] * ab[None], axis=-1)
    near = d.argmin(axis=1)
    return d[np.arange(len(points)), near], near


def inside_poly(points, poly):
    x, y = points[:, 0], points[:, 1]
    x0, y0 = poly[:, 0], poly[:, 1]
    x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
    cross = ((y0[None] > y[:, None]) != (y1[None] > y[:, None])) & (x[:, None] < (x1 - x0)[None] * (y[:, None] - y0[None]) / np.where(y1 - y0 == 0, 1e-9, y1 - y0)[None] + x0[None])
    return cross.sum(axis=1) % 2 == 1


def outward_normals(poly):
    """Normal hacia fuera en cada punto (antihorario: a la derecha del avance)."""
    t = np.roll(poly, -1, axis=0) - np.roll(poly, 1, axis=0)
    n = np.stack([t[:, 1], -t[:, 0]], axis=1)
    return n / np.linalg.norm(n, axis=1, keepdims=True)


def hero_part(poly):
    """La almohada de una parte de la N: vértices, caras y cuántos puntos son de la pared."""
    out = outward_normals(poly)
    # Anillos hacia dentro donde caben (no en las puntas) y una rejilla holgada en el centro.
    cloud = [poly]
    for off in HERO_BAND:
        ring = poly - out * off
        d, _ = seg_distance(ring, poly)
        cloud.append(ring[(d > off * 0.9) & inside_poly(ring, poly)])
    lo, hi = poly.min(axis=0), poly.max(axis=0)
    step = 0.082
    xs, ys = np.meshgrid(np.arange(lo[0], hi[0], step), np.arange(lo[1], hi[1], step * 0.866))
    xs[1::2] += step / 2
    grid = np.stack([xs.ravel(), ys.ravel()], axis=1)
    d, _ = seg_distance(grid, poly)
    cloud.append(grid[inside_poly(grid, poly) & (d > HERO_BAND[-1] + step * 0.45)])
    # Triangulación que respeta el contorno: la línea del logo queda hecha de aristas.
    n = len(poly)
    coords = [Vector(p) for p in np.concatenate(cloud)]
    edges = [(i, (i + 1) % n) for i in range(n)]
    verts2, _e, faces, orig, *_ = mathutils.geometry.delaunay_2d_cdt(coords, edges, [list(range(n))], 1, 1e-6, True)
    pts = np.array([v[:2] for v in verts2])
    rim = [0] * n
    for out_index, inputs in enumerate(orig):
        for i in inputs:
            if i < n:
                rim[i] = out_index
    d, _ = seg_distance(pts, poly)
    height = HERO_H * (1.0 - (1.0 - np.minimum(d / HERO_D, 1.0)) ** 2.3) ** (1 / 1.9)
    edge = np.zeros(len(pts), bool)
    edge[rim] = True
    height[edge] = 0.0
    # Suaviza la arista que deja la distancia sobre el eje de cada hoja: arcilla, no papel.
    neighbors = [set() for _ in pts]
    for f in faces:
        for a, b in zip(f, f[1:] + f[:1]):
            neighbors[a].add(b)
            neighbors[b].add(a)
    for _ in range(4):
        around = np.array([height[list(nb)].mean() if nb else h for nb, h in zip(neighbors, height)])
        height = np.where(edge, 0.0, height * 0.45 + around * 0.55)
    # La pared: copia del contorno, abajo, cerrada contra él.
    base = len(pts)
    verts = np.concatenate([np.column_stack([pts, height]), np.column_stack([poly, np.full(n, -HERO_WALL)])])
    wall = [(rim[k], base + k, base + (k + 1) % n, rim[(k + 1) % n]) for k in range(n)]
    return verts, [tuple(f) for f in faces] + wall, n


def hero_opening(co, poly):
    """_OUT: hacia dónde abre la pared la web."""
    _, near = seg_distance(co[:, :2], poly)
    opening = np.zeros((len(co), 3))
    walls = co[:, 2] < -HERO_WALL * 0.5
    opening[walls, :2] = outward_normals(poly)[near[walls]]
    return opening


def hero_lag(co):
    """_LAG: cuándo empieza a fundirse cada punto. Lo de arriba, antes; algo de ondulación para que no
    baje como una persiana."""
    wave = np.sin(co[:, 0] * 7.0 + 0.7) * np.sin(co[:, 1] * 5.0 + 1.3)
    return np.clip((1.0 - co[:, 1]) / 2.0 * 0.82 + 0.09 + wave * 0.09, 0.0, 1.0)


def hero_shade(co, above):
    """Lo que oscurece a una hoja la que tiene encima: 1 lejos de ella, baja al acercarse."""
    if above is None:
        return np.ones(len(co))
    d, _ = seg_distance(co[:, :2], above)
    outside = ~inside_poly(co[:, :2], above)
    return np.where(outside, 1.0 - 0.52 * np.exp(-(d / 0.085) ** 1.6), 1.0)


def hero_morphs(co, poly, centroid, lift):
    """puff: la hoja se hincha y su borde sale un poco. drop: todo a una gota, con su pared abajo."""
    out = outward_normals(poly)
    d, near = seg_distance(co[:, :2], poly)
    walls = co[:, 2] < -HERO_WALL * 0.5
    swell = np.exp(-(d / 0.07) ** 2)[:, None] * out[near] * 0.018
    puffed = co.copy()
    puffed[:, :2] += swell
    puffed[:, 2] = np.where(walls, co[:, 2], co[:, 2] * 1.5)
    # A la gota: cada punto conserva su ángulo alrededor del centro de la hoja y su fracción del radio
    # hasta el contorno en ese ángulo.
    v = co[:, :2] - centroid
    ang = np.arctan2(v[:, 1], v[:, 0])
    rad = np.linalg.norm(v, axis=1)
    edge_v = poly - centroid
    edge_ang = np.arctan2(edge_v[:, 1], edge_v[:, 0])
    edge_rad = np.linalg.norm(edge_v, axis=1)
    bins = 64
    reach = np.zeros(bins)
    idx = ((edge_ang + np.pi) / (2 * np.pi) * bins).astype(int) % bins
    np.maximum.at(reach, idx, edge_rad)
    for _ in range(3):
        reach = np.maximum(reach, (np.roll(reach, 1) + np.roll(reach, -1)) * 0.5 * 0.98)
    at = (ang + np.pi) / (2 * np.pi) * bins
    limit = np.interp(at, np.arange(bins + 1), np.append(reach, reach[0]))
    frac = np.clip(rad / np.maximum(limit, 1e-3), 0.0, 1.0)
    # El contorno de la hoja va siempre al borde de la gota, también donde es cóncavo.
    frac = np.where(d < 1e-4, 1.0, np.minimum(frac, 0.985))
    r = HERO_DROP_R * frac ** 0.8
    drop = co.copy()
    drop[:, 0] = np.cos(ang) * r
    drop[:, 1] = np.sin(ang) * r
    dome = HERO_DROP_H * np.sqrt(np.maximum(1.0 - (r / HERO_DROP_R) ** 2, 0.0)) ** 0.9
    drop[:, 2] = np.where(walls, -HERO_WALL, dome + lift)
    return puffed, drop


def hero_leaf_layout(parts, rng):
    """Mosaico de hojas sobre la silueta: las grandes por dentro, las pequeñas contra el borde, y cada
    una a lo largo de la dirección local de su parte (como escamas)."""
    candidates = []
    for name, poly in parts.items():
        lo, hi = poly.min(axis=0), poly.max(axis=0)
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0], 0.016), np.arange(lo[1], hi[1], 0.016))
        pts = np.stack([xs.ravel(), ys.ravel()], axis=1)
        pts = pts[inside_poly(pts, poly)]
        d, _ = seg_distance(pts, poly)
        for p, dist in zip(pts, d):
            candidates.append((dist, p, name))
    dense = {name: [c[1] for c in candidates if c[2] == name] for name in parts}
    dense = {k: np.array(v) for k, v in dense.items()}
    rng.shuffle(candidates)
    candidates.sort(key=lambda c: -round(c[0] / 0.012))
    placed = []
    gap = 0.86
    for dist, p, name in candidates:
        length = float(np.clip(dist * 3.0, 0.1, 0.5))
        if dist < 0.02:
            continue
        if any(np.linalg.norm(p - q[0]) < (length + q[1]) * 0.5 * gap * 0.62 for q in placed):
            continue
        # Dirección local: el eje principal de los puntos de la parte que hay alrededor.
        near = dense[name][np.linalg.norm(dense[name] - p, axis=1) < 0.3]
        cov = np.cov((near - p).T) if len(near) > 3 else np.eye(2)
        vals, vecs = np.linalg.eigh(cov)
        axis = vecs[:, 1]
        placed.append((p, length, name, math.atan2(axis[1], axis[0]) + rng.uniform(-0.2, 0.2)))
        if len(placed) >= HERO_LEAVES:
            break
    print(f'hero: {len(placed)} hojas en el mosaico')
    return placed


def leaf_grid(length, rows=HERO_LEAF_ROWS):
    """Una hoja: tres columnas (borde, nervio, borde), con las puntas cerradas, un pliegue y algo de arco."""
    width = length * 0.2
    verts = []
    for i in range(rows):
        t = i / (rows - 1)
        half = width * math.sin(math.pi * t) ** 0.72 * (1.0 + 0.22 * (0.5 - t))
        x = (t - 0.5) * length
        bow = 0.1 * length * math.sin(math.pi * t)
        fold = half * 0.34
        verts += [(x, -half, bow + fold), (x, 0.0, bow), (x, half, bow + fold)]
    faces = []
    for i in range(rows - 1):
        for j in range(2):
            a = i * 3 + j
            faces.append((a, a + 1, a + 4, a + 3))
    return verts, faces


def build_hero_leaves(parts):
    """Todas las hojas en una malla. La base es el mosaico armado; `scatter` las lleva a donde flotan.
    _PIVOT: su centro; _AXIS: eje del giro con el que llegan, por el número de vueltas; _LAG: cuándo salen."""
    rng = np.random.default_rng(41)
    layout = hero_leaf_layout(parts, rng)
    verts, faces, pivot, axis, lag, scatter = [], [], [], [], [], []
    order = sorted(range(len(layout)), key=lambda i: rng.random())
    for k, i in enumerate(order):
        p, length, _name, angle = layout[i]
        gv, gf = leaf_grid(length)
        c, s = math.cos(angle), math.sin(angle)
        z = 0.06 + rng.uniform(0.0, 0.06)
        base = len(verts)
        verts += [(p[0] + x * c - y * s, p[1] + x * s + y * c, z + zz) for x, y, zz in gv]
        faces += [tuple(base + v for v in f) for f in gf]
        turn = rng.normal(size=3)
        turn[2] *= 0.5
        turn = turn / np.linalg.norm(turn) * rng.uniform(0.35, 0.95)
        # Flotan alrededor de la N, a varias distancias: las de más lejos salen antes para llegar a la vez.
        ang = rng.uniform(0, 2 * math.pi)
        reach = rng.uniform(1.25, 3.0)
        fly = np.array([math.cos(ang) * reach * 0.92, math.sin(ang) * reach, rng.uniform(-1.1, 1.4)])
        pivot += [(p[0] / 4, p[1] / 4, z / 4)] * len(gv)
        axis += [tuple(turn)] * len(gv)
        lag += [float(np.clip(0.62 - (reach - 1.25) / 1.75 * 0.45 + rng.uniform(-0.1, 0.22), 0.0, 1.0))] * len(gv)
        scatter += [tuple(fly)] * len(gv)
    me = bpy.data.meshes.new('hero_hojas')
    me.from_pydata(verts, [], faces)
    me.update()
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    me.update()
    a = me.attributes.new('_PIVOT', 'FLOAT_VECTOR', 'POINT')
    a.data.foreach_set('vector', np.array(pivot, np.float32).ravel())
    a = me.attributes.new('_AXIS', 'FLOAT_VECTOR', 'POINT')
    a.data.foreach_set('vector', np.array(axis, np.float32).ravel())
    a = me.attributes.new('_LAG', 'FLOAT', 'POINT')
    a.data.foreach_set('value', np.array(lag, np.float32))
    leaves = link(bpy.data.objects.new('hero_hojas', me))
    mat = principled('hero_hoja', (0.62, 0.9, 0.76), 0.34, **{'Transmission_Weight': 0.62, 'IOR': 1.35, 'Specular_IOR_Level': 0.5})
    me.materials.append(mat)
    add_keys(leaves, {'scatter': co_of(me) + np.array(scatter)})
    print(f'hero_hojas: {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {len(me.vertices)} vértices')
    return leaves


def hero_timeline():
    """Los tiempos de la secuencia. No mueve nada: cada peso es una curva que la web lee del .glb."""
    me = bpy.data.meshes.new('hero_tiempo')
    me.from_pydata([(0, 0, 0), (1e-4, 0, 0), (0, 1e-4, 0)], [], [(0, 1, 2)])
    me.update()
    tl = link(bpy.data.objects.new('hero_tiempo', me))
    co = co_of(me)
    names = ('assemble', 'solid', 'puff', 'drop', 'liquid', 'pool', 'flow', 'reform', 'flat')
    add_keys(tl, {name: co + np.array([[1e-4 * (i + 1), 0, 0]] * 3) for i, name in enumerate(names)})
    # Nacer: las hojas vuelan, llegan y se funden en la N, que se asienta con un rebote blando.
    end = HERO_BIRTH
    steps = [k / 30 for k in range(0, 40)]
    add_clip(tl, 'hero_birth', {
        'assemble': [(0, 0.0), (1.08, 1.0), (end, 1.0)],
        'solid': [(0, 0.0), (0.78, 0.0), (0.9, 0.28), (1.06, 0.8), (1.22, 1.0), (end, 1.0)],
        'puff': [*((t, 0.75 * math.exp(-5.0 * (t - 1.02)) * math.sin(2 * math.pi * 1.5 * (t - 1.02)) if t > 1.02 else 0.0) for t in steps), (end, 0.0)],
    })
    # Respirar mientras la app carga.
    add_clip(tl, 'hero_breath', {'puff': [(0, 0.0), (HERO_BREATH * 0.42, 0.32), (HERO_BREATH, 0.0)]})
    # Salir: toma aire, se funde en una gota, corre hasta el logo y allí vuelve a ser la N.
    add_clip(tl, 'hero_outro', {
        'puff': [(0, 0.0), (0.12, 0.95), (0.3, 0.55), (0.5, 0.0), (HERO_OUTRO, 0.0)],
        'drop': [(0, 0.0), (0.08, 0.0), (0.3, 0.42), (0.55, 1.0), (HERO_OUTRO, 1.0)],
        'liquid': [(0, 0.0), (0.06, 0.0), (0.38, 1.0), (1.2, 1.0), (1.38, 0.0), (HERO_OUTRO, 0.0)],
        'pool': [(0, 1.0), (0.42, 1.0), (0.8, 0.42), (1.08, 0.0), (HERO_OUTRO, 0.0)],
        'flow': [(0, 0.0), (0.3, 0.0), (1.28, 1.0), (HERO_OUTRO, 1.0)],
        'reform': [(0, 0.0), (0.7, 0.0), (1.0, 0.35), (1.36, 1.0), (HERO_OUTRO, 1.0)],
        'flat': [(0, 0.0), (1.26, 0.0), (HERO_OUTRO, 1.0)],
    })
    return tl


def hero_key_light():
    """El estudio de toda la interfaz sobre el fondo de la app: la N no sale de un escenario aparte."""
    for o in [o for o in bpy.context.scene.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o)
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


def hero_sequence(n_obj, leaves):
    """La secuencia entera en una pista: es lo que ve quien abre el .blend o el .glb en otro visor. La web
    no la usa: dibuja el líquido con su propio campo y solo toma de aquí las mallas y los tiempos."""
    sc = bpy.context.scene
    rest = 0.45
    t_out = HERO_BIRTH + rest
    add_clip(leaves, 'hero_sequence', {'scatter': [(0, 1.0), (1.08, 0.0), (t_out + HERO_OUTRO, 0.0)]})
    # Las hojas se funden en la N: se encogen en su sitio mientras ella aparece.
    leaves.animation_data_create()
    for sec, s in ((0.0, 1.0), (0.95, 1.0), (1.26, 0.001), (t_out + HERO_OUTRO, 0.001)):
        leaves.scale = (s, s, s)
        leaves.keyframe_insert('scale', frame=round(sec * FPS))
    leaf_action = leaves.animation_data.action
    leaf_action.name = 'hero_sequence_hojas'
    leaf_action.use_fake_user = True
    leaf_track = leaves.animation_data.nla_tracks.new()
    leaf_track.name = 'hero_sequence'
    leaf_track.strips.new('hero_sequence', 0, leaf_action).extrapolation = 'NOTHING'
    leaves.animation_data.action = None
    leaves.scale = (1, 1, 1)
    add_clip(n_obj, 'hero_sequence', {
        'puff': [(0, 0.0), (t_out, 0.0), (t_out + 0.12, 0.95), (t_out + 0.5, 0.0), (t_out + HERO_OUTRO, 0.0)],
        'drop': [(0, 0.0), (t_out + 0.08, 0.0), (t_out + 0.52, 1.0), (t_out + 1.0, 1.0), (t_out + HERO_OUTRO - 0.08, 0.0), (t_out + HERO_OUTRO, 0.0)],
    })
    # La pieza aparece bajo las hojas, y como gota corre al rincón del logo, donde se posa pequeña.
    frames = [(0.0, (0, 0, 0), 0.001), (0.82, (0, 0, 0), 0.001), (1.22, (0, 0, 0), 1.0), (t_out + 0.42, (0, 0, 0), 1.0),
              (t_out + 0.76, (-0.5, -0.32, 0.1), 0.72), (t_out + 1.02, (-1.42, 0.2, 0.1), 0.42), (t_out + 1.26, (HERO_END[0], HERO_END[1], 0.05), 0.2), (t_out + HERO_OUTRO, (HERO_END[0], HERO_END[1], 0.0), 0.16)]
    n_obj.animation_data_create()
    for sec, loc, s in frames:
        frame = round(sec * FPS)
        n_obj.location = loc
        n_obj.scale = (s, s, s)
        n_obj.keyframe_insert('location', frame=frame)
        n_obj.keyframe_insert('scale', frame=frame)
    action = n_obj.animation_data.action
    action.name = 'hero_sequence_trs'
    action.use_fake_user = True
    track = n_obj.animation_data.nla_tracks.new()
    track.name = 'hero_sequence'
    strip = track.strips.new('hero_sequence', 0, action)
    strip.extrapolation = 'NOTHING'
    n_obj.animation_data.action = None
    n_obj.location = (0, 0, 0)
    n_obj.scale = (1, 1, 1)
    sc.frame_end = round((t_out + HERO_OUTRO) * FPS)
    return t_out


def hero_metaballs(t_out):
    """El líquido en el .blend: metabolas que salen de la gota y corren al logo, una tras otra."""
    meta = bpy.data.metaballs.new('hero_liquido')
    meta.resolution = 0.05
    meta.render_resolution = 0.03
    meta.threshold = 0.6
    obj = link(bpy.data.objects.new('hero_liquido', meta))
    mat = principled('hero_liquido', (0.42, 0.78, 0.62), 0.12, **{'Transmission_Weight': 0.35, 'IOR': 1.33, 'Specular_IOR_Level': 0.7, 'Coat_Weight': 0.6, 'Coat_Roughness': 0.08})
    meta.materials.append(mat)
    p0 = np.array([0.0, 0.0, 0.12])
    p1 = np.array([-0.4, -1.05, 0.14])
    p2 = np.array([HERO_END[0] - 0.05, -0.2, 0.14])
    p3 = np.array([HERO_END[0], HERO_END[1], 0.1])
    bez = lambda t: (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
    count = 26
    rng = np.random.default_rng(5)
    for i in range(count):
        e = meta.elements.new(type='BALL')
        lag = i / (count - 1)
        e.radius = 0.26 * (1.0 - 0.45 * lag) * rng.uniform(0.85, 1.1)
        side = rng.uniform(-0.05, 0.05)
        for k in range(13):
            t = k / 12
            sec = t_out + 0.3 + t * 0.98
            u = np.clip((t * (1 + 0.55) - lag * 0.55), 0.0, 1.0)
            u = u * u * (3 - 2 * u)
            p = bez(u)
            p[0] += side * math.sin(math.pi * u)
            e.co = tuple(p)
            # Bajo la gota hasta que sale; al llegar, se mete en la N pequeña.
            e.radius = (0.0 if u <= 0.0 or u >= 1.0 else 0.26 * (1.0 - 0.45 * lag))
            e.keyframe_insert('co', frame=round(sec * FPS))
            e.keyframe_insert('radius', frame=round(sec * FPS))
    return obj


def build_hero():
    reset('hero')
    hero_key_light()
    parts = {name: logo_outline(HERO_LOGO[name]) for name in HERO_ORDER}
    above = {'c': parts['a'], 'a': parts['b'], 'b': None}
    tones = {'c': (0.16, 0.42, 0.36), 'a': (0.08, 0.34, 0.29), 'b': (0.34, 0.62, 0.5)}
    verts, faces, materials = [], [], []
    opening, shade, puffed, drop = [], [], [], []
    base = 0
    for k, name in enumerate(HERO_ORDER):
        v, f, _rim = hero_part(parts[name])
        verts.append(v)
        faces += [tuple(i + base for i in face) for face in f]
        materials += [k] * len(f)
        opening.append(hero_opening(v, parts[name]))
        shade.append(hero_shade(v, above[name]))
        p, d = hero_morphs(v, parts[name], parts[name].mean(axis=0), k * 0.03)
        puffed.append(p)
        drop.append(d)
        base += len(v)
    co = np.concatenate(verts)
    me = bpy.data.meshes.new('hero_n')
    me.from_pydata(co.tolist(), [], faces)
    me.update()
    me.polygons.foreach_set('material_index', np.array(materials, np.int32))
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    for name in HERO_ORDER:
        me.materials.append(clay(f'hero_hoja_{name}', tones[name], rough=0.46))
    me.update()
    for attr_name, kind, field, data in (('_OUT', 'FLOAT_VECTOR', 'vector', np.concatenate(opening)), ('_LAG', 'FLOAT', 'value', hero_lag(co)), ('_SHADE', 'FLOAT', 'value', np.concatenate(shade))):
        attr = me.attributes.new(attr_name, kind, 'POINT')
        attr.data.foreach_set(field, np.asarray(data, np.float32).ravel())
    n_obj = link(bpy.data.objects.new('hero_n', me))
    add_keys(n_obj, {'puff': np.concatenate(puffed), 'drop': np.concatenate(drop)})
    leaves = build_hero_leaves(parts)
    tl = hero_timeline()
    t_out = hero_sequence(n_obj, leaves)
    hero_metaballs(t_out)
    cam = link(bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')))
    cam.data.lens = 85
    cam.location = (-0.9, 0.2, 13.5)
    cam.rotation_euler = (Vector((-0.9, 0.2, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 1280, 800
    print(f'hero_n: {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {len(me.vertices)} vértices')
    return [n_obj, leaves, tl]


def strip_sequence(objs):
    """La web no usa la pista de la secuencia completa: su .glb se exporta sin ella."""
    for o in objs:
        holders = [o.data.shape_keys.animation_data, o.animation_data]
        for anim in holders:
            if not anim:
                continue
            for track in list(anim.nla_tracks):
                if track.name == 'hero_sequence':
                    anim.nla_tracks.remove(track)


def hero_qa(path, samples):
    """Lámina de la secuencia: un fotograma por momento, en EEVEE."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = max(16, min(samples, 64))
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = 640, 400
    sc.render.image_settings.file_format = 'PNG'
    for label, sec in (('hojas', 0.25), ('llegan', 0.8), ('n', 1.5), ('funde', 2.2), ('corre', 2.75), ('llega', 3.0), ('logo', 3.24)):
        sc.frame_set(round(sec * FPS))
        sc.render.filepath = f'{path}-{label}.png'
        bpy.ops.render.render(write_still=True)
        print('render', sc.render.filepath)


# ───────── Exportación ─────────

def export(objs, path, frame_step=2):
    bpy.context.scene.frame_set(-1000)  # antes de todas las pistas
    for o in objs:
        for block in o.data.shape_keys.key_blocks:
            block.value = 0.0  # los pesos por defecto del .glb
        o.location = (0, 0, 0)  # el reposo de los que además se mueven (la secuencia del héroe)
        o.scale = (1, 1, 1)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
        export_normals=True, export_texcoords=True, export_tangents=False, export_materials='EXPORT',
        export_image_format='WEBP', export_image_quality=88,
        export_vertex_color='NONE', export_attributes=True, export_extras=True,
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
}

BUILD = {'pad': build_pad, 'focus': build_focus, 'card': build_card, 'hero': build_hero}
# Muestras de animación por juego: la respiración es lenta, con 5 por segundo basta.
FRAME_STEP = {'focus': 12, 'hero': 2}


def main():
    names = (arg('--sets') or ','.join(BUILD)).split(',')
    folder = arg('--dir', '.')
    blend = arg('--blend')
    render_dir = arg('--render')
    samples = int(arg('--samples', 48))
    for name in names:
        objs = BUILD[name]()
        if name == 'hero':
            export(objs, os.path.join(folder, 'calm-hero-secuencia.glb'), 2)
        else:
            export(objs, os.path.join(folder, f'calm-{name}.glb'), FRAME_STEP.get(name, 2))
        if blend:
            # Aquí y no antes: reset() vuelve a las preferencias de fábrica.
            bpy.context.preferences.filepaths.save_version = 0  # sin copias .blend1
            bpy.ops.file.pack_all()
            bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(blend, f'calm-{name}.blend')), compress=True)
        if render_dir and name == 'hero':
            hero_qa(os.path.join(render_dir, name), samples)
        elif render_dir and name in QA:
            qa_render(objs, os.path.join(render_dir, name), QA[name], samples)
        if name == 'hero':
            strip_sequence(objs)
            export(objs, os.path.join(folder, 'calm-hero.glb'), FRAME_STEP.get(name, 2))


main()
