# Figuras atléticas del mapa muscular del Coliseo (masculina y femenina), en Blender.
#
# Parten de las mallas humanas realistas de Blender Studio («Human Base Meshes» v1.4.1,
# CC0, https://www.blender.org/download/demo/ → Asset Bundles), que traen una malla de
# quads limpia (10 582 vértices) y una escultura multires encima. El script:
#   1. Ajusta esa malla base a la escultura (multires «Apply Base»): es la malla web.
#      Sus UV (repartidas en varios mosaicos UDIM) se reempaquetan en un solo atlas de densidad pareja.
#   2. Refuerza la definición del escultor (alto relieve × AMP, más en abdomen y pecho,
#      suave bajo la ropa) y suma un volumen atlético medido en milímetros por músculo
#      (hombros, dorsales, glúteos, piernas), siempre por regiones suaves: nada se pega encima.
#   3. Hornea con Cycles un mapa de normales de la escultura (~680 000 caras) sobre la
#      malla web y la oclusión ambiental por vértice: pocos polígonos, aspecto de escultura.
#   4. Marca cada vértice con sus dos músculos principales de lib/coliseo y su peso
#      (`_MUSCLE0`/`_MUSCLE1` = id/255 y peso), con transiciones de varios centímetros.
#   5. Ropa deportiva (shorts; top con tirantes en la figura femenina) como campos con signo
#      (`_SURF` = a, u, v; ±12 cm → ±1): el shader corta la tela con un borde recto y nítido
#      entre vértices, también en tirantes más finos que una cara. Los ojos quedan fuera de la tela.
#   6. Exporta .glb (normales, tangentes, UV, oclusión en COLOR_0, mapa de normales WebP).
#      scripts/build-avatars.mjs lo cuantiza y comprime con meshopt (gltf-transform).
#
# Ejes de Blender: x lateral, −y al frente, z arriba (el .glb sale con y arriba y +z al frente).
#
# Uso: blender -b --factory-startup --disable-autoexec <human_base_meshes_bundle.blend>
#        -P avatar.py -- --gender male|female --out f.glb [--render lamina.png] [--ids]
import math
import os
import sys

import bmesh
import bpy
import numpy as np

MUSCLES = ['chest', 'frontDelts', 'sideDelts', 'rearDelts', 'triceps', 'biceps', 'forearms', 'traps',
           'lats', 'lowerBack', 'abs', 'obliques', 'glutes', 'quads', 'hamstrings', 'calves']
MI = {m: i for i, m in enumerate(MUSCLES)}
SKIN = 255
CLOTH_RANGE = 0.12  # m: _SURF = campo / CLOTH_RANGE (con caras de hasta 4 cm, recortar antes desplazaba el borde)


def arg(name, default=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default


GENDER = arg('--gender', 'male')
F = GENDER == 'female'
HEIGHT = 1.68 if F else 1.78
AMP = float(arg('--amp', 1.85 if F else 1.45))  # refuerzo de la definición esculpida sobre los músculos
AMP_CLOTH = 0.35                                 # bajo la tela la superficie se alisa
# Donde el escultor marcó el abdomen y el pecho, un poco más de relieve.
AMP_MUSCLE = {'abs': 2.4, 'obliques': 1.9, 'chest': 1.6, 'sideDelts': 1.6} if F else \
             {'abs': 2.1, 'obliques': 1.7, 'chest': 1.5, 'lats': 1.5}
# Volumen atlético por músculo, en metros, hacia afuera de la piel.
LIFT = ({'frontDelts': .003, 'sideDelts': .0045, 'rearDelts': .003, 'triceps': .002, 'biceps': .002, 'forearms': .001,
         'traps': .002, 'lats': .003, 'glutes': .006, 'quads': .004, 'hamstrings': .003, 'calves': .004} if F else
        {'chest': .002, 'frontDelts': .004, 'sideDelts': .006, 'rearDelts': .004, 'triceps': .003, 'biceps': .003,
         'forearms': .002, 'traps': .003, 'lats': .005, 'glutes': .002, 'quads': .003, 'hamstrings': .002, 'calves': .003})
CLOTH_LIFT = 0.0018  # la tela queda un poco por encima de la piel


def sstep(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def box(v, a, b, s):
    """Ventana suave: 1 entre a y b, con bordes de ancho 2·s."""
    return sstep(a - s, a + s, v) * (1 - sstep(b - s, b + s, v))


def ang_box(phi, a, b, s):
    """Ventana suave en ángulo (grados), con el giro de ±180 resuelto."""
    best = np.zeros_like(phi)
    for k in (-360, 0, 360):
        best = np.maximum(best, box(phi + k, a, b, s))
    return best


# ───────── Malla, grupos de caras y articulaciones ─────────

def mesh_arrays(me):
    n = len(me.vertices)
    P = np.empty(n * 3)
    me.vertices.foreach_get('co', P)
    loops = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get('vertex_index', loops)
    starts = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get('loop_start', starts)
    tot = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get('loop_total', tot)
    return P.reshape(-1, 3), loops, starts, tot


def face_sets(me):
    fs = np.zeros(len(me.polygons), dtype=np.int64)
    me.attributes['.sculpt_face_set'].data.foreach_get('value', fs)
    return fs


def vertex_set(n, loops, starts, tot, fs):
    """Grupo de cada vértice: el de la mayoría de sus caras (los dedos cuentan como mano o pie)."""
    fs = fs.copy()
    fs[fs >= 64] = np.where(fs[fs >= 64] % 2 == 0, 9, 10)
    fs[(fs >= 25) & (fs < 64)] = 14
    face_of_loop = np.repeat(np.arange(len(starts)), tot)
    pairs = np.stack([loops, fs[face_of_loop]], axis=1)
    out = np.zeros(n, dtype=np.int64)
    best = np.zeros(n)
    for s in np.unique(fs):
        cnt = np.bincount(pairs[pairs[:, 1] == s, 0], minlength=n)
        take = cnt > best
        out[take] = s
        best[take] = cnt[take]
    return out


def landmarks(P, loops, starts, tot, fs):
    """Centros de las articulaciones: el centroide de la frontera entre dos grupos de caras."""
    face_of_loop = np.repeat(np.arange(len(starts)), tot)
    sets_of = {}
    for v, s in zip(loops, fs[face_of_loop]):
        sets_of.setdefault(int(v), set()).add(int(s))

    def seam(a, b):
        vs = [v for v, ss in sets_of.items() if a in ss and b in ss]
        return P[vs].mean(axis=0)

    L = {}
    for side, (arm, fore, hand, thigh, shin, foot) in {1: (21, 12, 9, 24, 15, 14), -1: (20, 11, 10, 23, 16, 13)}.items():
        L[('S', side)] = seam(1, arm)
        L[('E', side)] = seam(arm, fore)
        L[('W', side)] = seam(hand, fore)
        L[('H', side)] = seam(18, thigh)
        L[('K', side)] = seam(shin, thigh)
        L[('A', side)] = seam(foot, shin)
    L['neck'] = seam(1, 17)
    L['chest'] = seam(1, 19)
    L['waist'] = seam(18, 19)
    return L


def limb_coords(P, a, b, side):
    """t a lo largo del hueso (0 en a) y φ alrededor: 0 al frente (−y), +90 hacia afuera, ±180 atrás."""
    u = b - a
    ln = np.linalg.norm(u)
    u = u / ln
    front = np.array([0.0, -1.0, 0.0])
    front = front - u * front.dot(u)
    front /= np.linalg.norm(front)
    lat = np.cross(u, front)
    if lat[0] * side < 0:
        lat = -lat
    d = P - a
    t = d @ u / ln
    r = d - np.outer(d @ u, u)
    phi = np.degrees(np.arctan2(r @ lat, r @ front))
    return t, phi


# ───────── Regiones musculares ─────────

def regions(P, vs, L):
    """Peso de cada músculo en cada vértice (0–1), por zonas anatómicas con bordes suaves."""
    n = len(P)
    W = np.zeros((n, len(MUSCLES)))
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    torso = np.isin(vs, [1, 18, 19])
    # Marco del tronco por alturas: semiancho, centro y semifondo en cada franja de 1 cm.
    zs = np.round(z / 0.01).astype(int)
    hw, ym, hd = np.zeros(n), np.zeros(n), np.ones(n)
    for k in np.unique(zs[torso]):
        sel = torso & (np.abs(zs - k) <= 1)
        y0, y1 = y[sel].min(), y[sel].max()
        rows = zs == k
        hw[rows], ym[rows], hd[rows] = np.abs(x[sel]).max(), (y0 + y1) / 2, max(1e-3, (y1 - y0) / 2)
    zS = (L[('S', 1)][2] + L[('S', -1)][2]) / 2
    zW = L['waist'][2]
    zH = (L[('H', 1)][2] + L[('H', -1)][2]) / 2
    hz = (z - zW) / (zS - zW)
    ux = np.abs(x) / np.maximum(hw, 1e-3)
    fr = (ym - y) / hd                       # +1 al frente, −1 atrás
    T = torso.astype(float)

    W[:, MI['chest']] = T * box(hz, 0.62, 1.24, 0.08) * sstep(0.05, 0.32, fr) * box(ux, 0.04, 0.9, 0.05)
    W[:, MI['abs']] = T * box(hz, -0.18, 0.64, 0.06) * sstep(0.28, 0.52, fr) * (1 - sstep(0.27, 0.39, ux))
    W[:, MI['obliques']] = T * box(hz, -0.12, 0.6, 0.08) * box(ux, 0.36, 1.05, 0.07) * box(fr, -0.4, 0.86, 0.14)
    W[:, MI['lats']] = T * box(hz, 0.22, 0.95, 0.1) * (1 - sstep(-0.18, 0.08, fr)) * box(ux, 0.24, 1.05, 0.07)
    W[:, MI['lowerBack']] = T * box(hz, -0.25, 0.44, 0.08) * (1 - sstep(-0.38, -0.12, fr)) * (1 - sstep(0.29, 0.41, ux))
    traps = T * sstep(0.7, 0.86, hz) * (1 - sstep(-0.12, 0.12, fr)) * (1 - sstep(0.62, 0.78, ux))
    traps = np.maximum(traps, T * sstep(1.0, 1.14, hz) * (1 - sstep(0.72, 0.88, ux)) * (1 - sstep(0.05, 0.35, fr)))
    zn = L['neck'][2]
    neck = ((vs == 17) & (z < zn + 0.07)).astype(float)
    traps = np.maximum(traps, neck * (1 - sstep(-0.3, 0.2, fr)) * sstep(0.2, 0.5, ux) * (1 - sstep(zn + 0.03, zn + 0.07, z)))
    W[:, MI['traps']] = traps

    glute = np.isin(vs, [18, 23, 24]) * box(z, zH - 0.12, (zW + zH) / 2 + 0.05, 0.035) * (1 - sstep(-0.25, 0.05, fr)) * (1 - sstep(0.9, 1.02, ux))
    W[:, MI['glutes']] = glute

    for side in (1, -1):
        half = (x * side) > 0
        S, E, Wr = L[('S', side)], L[('E', side)], L[('W', side)]
        H, K, A = L[('H', side)], L[('K', side)], L[('A', side)]
        t, phi = limb_coords(P, S, E, side)
        arm = (np.isin(vs, [20, 21]) & half).astype(float)
        # Deltoides: arriba del brazo y la caperuza del hombro (vértices del tronco junto a la articulación).
        cap = (torso & half) * (1 - sstep(0.075, 0.115, np.linalg.norm(P - S, axis=1))) * sstep(S[2] - 0.035, S[2] + 0.01, z) * sstep(0.5, 0.7, ux)
        delt = np.maximum(arm * (1 - sstep(0.3, 0.46, t)), cap)
        W[:, MI['frontDelts']] += delt * ang_box(phi, -85, 22, 18)
        W[:, MI['sideDelts']] += delt * ang_box(phi, 22, 118, 18)
        W[:, MI['rearDelts']] += delt * ang_box(phi, 118, 205, 18)
        W[:, MI['biceps']] += arm * box(t, 0.3, 0.93, 0.06) * ang_box(phi, -78, 55, 18)
        W[:, MI['triceps']] += arm * box(t, 0.24, 0.96, 0.06) * ang_box(phi, 112, 262, 20)
        tf, _ = limb_coords(P, E, Wr, side)
        fore = (np.isin(vs, [11, 12]) & half).astype(float)
        W[:, MI['forearms']] += fore * (1 - sstep(0.6, 0.86, tf))
        tt, pt = limb_coords(P, H, K, side)
        thigh = (np.isin(vs, [23, 24]) & half).astype(float)
        W[:, MI['quads']] += thigh * box(tt, 0.1, 0.97, 0.06) * ang_box(pt, -78, 108, 18)
        W[:, MI['hamstrings']] += thigh * box(tt, 0.16, 0.92, 0.06) * ang_box(pt, 128, 232, 20) * (1 - glute)
        ts, ps = limb_coords(P, K, A, side)
        shin = (np.isin(vs, [15, 16]) & half).astype(float)
        W[:, MI['calves']] += shin * box(ts, 0.04, 0.72, 0.07) * ang_box(ps, 108, 252, 22)

    # Donde se pisan dos zonas, se reparten; nunca suman más de 1.
    total = W.sum(axis=1, keepdims=True)
    W = np.where(total > 1, W / np.maximum(total, 1e-9), W)
    return W, dict(zS=zS, zW=zW, zH=zH, hz=hz, ux=ux, fr=fr)


def neighbors(loops, starts, tot):
    """Aristas únicas de la malla (para suavizar sobre la superficie)."""
    a = np.concatenate([loops[s:s + c] for s, c in zip(starts, tot)])
    b = np.concatenate([np.roll(loops[s:s + c], -1) for s, c in zip(starts, tot)])
    return np.unique(np.sort(np.stack([a, b], 1), axis=1), axis=0)


def smooth(values, edges, n, iters):
    """Media con los vecinos, `iters` veces: las transiciones se abren varios centímetros."""
    v = values.astype(float).copy()
    deg = np.maximum(np.bincount(edges.ravel(), minlength=n).astype(float), 1)
    if v.ndim > 1:
        deg = deg[:, None]
    for _ in range(iters):
        acc = np.zeros_like(v)
        np.add.at(acc, edges[:, 0], v[edges[:, 1]])
        np.add.at(acc, edges[:, 1], v[edges[:, 0]])
        v = 0.5 * v + 0.5 * acc / deg
    return v


def vertex_normals(P, loops, starts, tot):
    N = np.zeros_like(P)
    for k in np.unique(tot):
        sel = tot == k
        ring = loops[starts[sel][:, None] + np.arange(k)[None, :]]
        for j in range(1, k - 1):
            a, b, c = P[ring[:, 0]], P[ring[:, j]], P[ring[:, j + 1]]
            fn = np.cross(b - a, c - a)
            for col in (0, j, j + 1):
                np.add.at(N, ring[:, col], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


# ───────── Ropa deportiva ─────────

STRAP = 0.0135  # m, medio ancho de los tirantes
LIMBS = [9, 10, 11, 12, 13, 14, 15, 16, 20, 21, 23, 24]  # grupos de caras de manos, brazos, pies y piernas


def cloth_fields(P, vs, R, L):
    """Campos de la tela (m, recortados a ±CLOTH_RANGE), interpolados entre vértices:
    a = distancia con signo al borde de shorts y banda (> 0 dentro); u = |x| − eje del tirante;
    v = altura sobre el borde de abajo del top. Tela donde max(a, min(STRAP − |u|, v)) > 0: el
    valor absoluto se toma por píxel, así un tirante más estrecho que dos caras sale recto."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    n = len(P)
    waist = R['zW'] + (0.0 if F else 0.012)
    hem = R['zH'] - (0.105 if F else 0.15)
    legs = np.isin(vs, [23, 24])
    shorts = np.minimum(waist - z, np.where(legs, z - hem, 1.0))
    a = np.where(np.isin(vs, [18, 19]) | legs, shorts, -1.0)
    u, v = np.ones(n), -np.ones(n)
    if F:
        # Top deportivo: banda bajo el pecho, escote en U al frente, banda baja atrás y tirantes.
        bust = (vs == 1) & (np.abs(x) > 0.04) & (np.abs(x) < 0.13)
        z_peak = z[bust][np.argmin(y[bust])]
        under = z_peak - 0.07
        sx = 0.42 * abs(L[('S', 1)][0]) + 0.035
        ax = np.abs(x)
        # Escote en U entre los tirantes; por fuera de ellos el borde baja y pasa bajo la axila.
        top_back = z_peak - 0.005
        top_front = np.where(ax <= sx, z_peak + 0.045 + 0.04 * (ax / sx) ** 2, z_peak + 0.085 - 1.2 * (ax - sx))
        top = top_back + sstep(-0.1, 0.35, R['fr']) * np.maximum(top_front - top_back, 0)
        # Todo menos brazos y piernas (la espalda alta no siempre es del grupo del pecho).
        upper = ~np.isin(vs, LIMBS)
        a = np.where(upper, np.maximum(a, np.minimum(z - under, top - z)), a)
        u = ax - sx
        v = np.where(upper, np.minimum(z - under, L['neck'][2] + 0.08 - z), -1.0)  # hasta pasar el hombro
    return np.stack([np.clip(f, -CLOTH_RANGE, CLOTH_RANGE) for f in (a, u, v)], 1)


def cloth_sdf(fields):
    a, u, v = fields.T
    return np.maximum(a, np.minimum(STRAP - np.abs(u), v))


# ───────── Programa ─────────

def link(obj):
    sc = bpy.context.scene
    if obj.name not in sc.collection.objects:
        sc.collection.objects.link(obj)
    obj.hide_viewport = False
    obj.hide_render = False


def pack_uvs(obj):
    """Un solo atlas 0–1 con la misma densidad de texel en todo el cuerpo."""
    for o in bpy.context.scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(udim_source='ACTIVE_UDIM', rotate=True, margin_method='FRACTION', margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    uv = np.empty(len(obj.data.loops) * 2)
    obj.data.uv_layers.active.data.foreach_get('uv', uv)
    print('uv', uv.reshape(-1, 2).min(0), uv.reshape(-1, 2).max(0))


def main():
    out = arg('--out')
    work = os.path.dirname(os.path.abspath(out or arg('--render')))
    body = bpy.data.objects[f'GEO-body_{GENDER}_realistic']
    eyes = [c for c in body.children if 'eye' in c.name.lower()]
    keep = {body.name, *[e.name for e in eyes]}
    for o in list(bpy.data.objects):
        if o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in [body, *eyes]:
        link(o)
    inv = body.matrix_world.inverted()
    eye_meshes = []
    for e in eyes:
        me = e.data.copy()
        me.transform(inv @ e.matrix_world)
        eye_meshes.append(me)
        bpy.data.objects.remove(e, do_unlink=True)

    # 1. La malla base se ajusta a la escultura; UV en un solo atlas.
    mr = next(m for m in body.modifiers if m.type == 'MULTIRES')
    with bpy.context.temp_override(object=body, active_object=body, selected_objects=[body], selected_editable_objects=[body]):
        bpy.ops.object.multires_base_apply(modifier=mr.name)
    cage = body.data
    P0, loops, starts, tot = mesh_arrays(cage)
    n = len(P0)
    fs = face_sets(cage)
    vs = vertex_set(n, loops, starts, tot, fs)
    L = landmarks(P0, loops, starts, tot, fs)
    W, R = regions(P0, vs, L)
    edges = neighbors(loops, starts, tot)
    Ws = smooth(W, edges, n, 3)
    fields = cloth_fields(P0, vs, R, L)
    sdf = cloth_sdf(fields)
    cloth_v = smooth(sstep(-0.012, 0.004, sdf), edges, n, 2)
    lift = Ws @ np.array([LIFT.get(m, 0.0) for m in MUSCLES]) + CLOTH_LIFT * cloth_v
    # El refuerzo solo vive sobre los músculos: cara, manos, pies y pliegues quedan como los esculpió.
    amp = 1 + Ws @ np.array([AMP_MUSCLE.get(m, AMP) - 1 for m in MUSCLES])
    amp = amp + (AMP_CLOTH - amp) * np.clip(cloth_v, 0, 1)

    # 2. El volumen atlético mueve la malla base (la escultura multires la sigue) y el relieve
    #    del escultor se refuerza en alta resolución: escultura = liso + amp · (detalle).
    C = P0 + vertex_normals(P0, loops, starts, tot) * lift[:, None]
    cage.vertices.foreach_set('co', C.astype(np.float32).ravel())
    cage.update()
    mr.levels = mr.sculpt_levels = mr.render_levels = mr.total_levels
    dg = bpy.context.evaluated_depsgraph_get()
    hi_me = bpy.data.meshes.new_from_object(body.evaluated_get(dg))
    Ph = mesh_arrays(hi_me)[0]

    def subdivide(values):
        """Catmull-Clark de la malla base aplicado a `values` (n×3): mismo orden de vértices que
        la escultura y una interpolación suave (con el vecino más cercano salía un enrejado)."""
        me = cage.copy()
        me.vertices.foreach_set('co', values.astype(np.float32).ravel())
        tmp = bpy.data.objects.new('sub', me)
        link(tmp)
        tmp.modifiers.clear()
        sub = tmp.modifiers.new('sub', 'SUBSURF')
        sub.levels = sub.render_levels = mr.total_levels
        res = mesh_arrays(bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())))[0]
        bpy.data.objects.remove(tmp, do_unlink=True)
        return res

    Ps = subdivide(C)
    amp_h = subdivide(np.stack([amp, np.zeros(n), np.zeros(n)], 1))[:, 0]
    aligned = len(Ps) == len(Ph) and float(np.abs(Ps - Ph).mean()) < 0.004
    dev = np.linalg.norm(Ph - Ps, axis=1) if aligned else np.zeros(1)
    print('escultura', len(Ph), 'vértices; liso alineado:', aligned, 'detalle mm p50/p99/máx',
          [round(float(v) * 1000, 2) for v in np.percentile(dev, [50, 99, 100])])
    H = Ps + amp_h[:, None] * (Ph - Ps) if aligned else Ph.copy()

    # Escala y suelo: pies en z = 0, alto final HEIGHT.
    z0 = min(C[:, 2].min(), H[:, 2].min())
    s = HEIGHT / (C[:, 2].max() - z0)

    def norm(Q):
        return (Q - np.array([0, 0, z0])) * s

    C, H = norm(C), norm(H)
    hi_me.vertices.foreach_set('co', H.astype(np.float32).ravel())
    hi_me.update()
    hi = bpy.data.objects.new('escultura', hi_me)
    link(hi)
    body.modifiers.clear()
    cage.vertices.foreach_set('co', C.astype(np.float32).ravel())
    cage.update()
    body.location = (0, 0, 0)
    body.rotation_euler = (0, 0, 0)
    body.scale = (1, 1, 1)
    pack_uvs(body)
    # Triángulos fijos antes de hornear: horneado, exportación y web usan la misma diagonal en cada quad.
    bm = bmesh.new()
    bm.from_mesh(cage)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    bm.to_mesh(cage)
    bm.free()

    # 3. Mapa de normales (Cycles, de la escultura a la malla web) y oclusión por vértice.
    size = int(arg('--tex', 1024))
    nimg = bpy.data.images.new(f'normal-{GENDER}', size, size, alpha=False)
    nimg.colorspace_settings.name = 'Non-Color'
    skin = bpy.data.materials.new('skin')
    skin.use_nodes = True
    nt = skin.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.78, 0.74, 0.7, 1)
    bsdf.inputs['Roughness'].default_value = 0.55
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = nimg
    nmap = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tex.outputs['Color'], nmap.inputs['Color'])
    nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    nt.nodes.active = tex  # destino del horneado
    cage.materials.clear()
    cage.materials.append(skin)
    cage.polygons.foreach_set('use_smooth', np.ones(len(cage.polygons), bool))
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 8
    bk = sc.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = 0.006
    bk.max_ray_distance = 0.014
    bk.normal_space = 'TANGENT'
    bk.margin = 8
    bk.target = 'IMAGE_TEXTURES'
    for o in sc.objects:
        o.select_set(o in (hi, body))
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.bake(type='NORMAL')
    # En pliegues cerrados (axilas, labios, dedos) el rayo a veces toca la otra pared: ninguna
    # normal se inclina más de ~53° respecto de la malla.
    px = np.array(nimg.pixels[:], dtype=np.float32).reshape(-1, 4)
    nrm = px[:, :3] * 2 - 1
    steep = nrm[:, 2] < 0.6
    xy = np.linalg.norm(nrm[steep, :2], axis=1, keepdims=True)
    nrm[steep, :2] *= 0.8 / np.maximum(xy, 1e-6)
    nrm[steep, 2] = 0.6
    px[:, :3] = nrm * 0.5 + 0.5
    nimg.pixels.foreach_set(px.ravel())
    print('normales recortadas', int(steep.sum()))
    nimg.filepath_raw = os.path.join(work, f'normal-{GENDER}.png')
    nimg.file_format = 'PNG'
    nimg.save()
    print('mapa de normales', nimg.filepath_raw)
    bpy.data.objects.remove(hi, do_unlink=True)

    cage.color_attributes.new('ao', 'BYTE_COLOR', 'POINT')
    cage.color_attributes.active_color_name = 'ao'
    sc.world = sc.world or bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.14
    bk.use_selected_to_active = False
    bk.target = 'VERTEX_COLORS'
    sc.cycles.samples = 48
    for o in sc.objects:
        o.select_set(o == body)
    bpy.ops.object.bake(type='AO')
    ao = np.empty(n * 4, dtype=np.float32)
    cage.color_attributes['ao'].data.foreach_get('color', ao)
    ao = 0.35 + 0.65 * ao.reshape(-1, 4)[:, 0]
    cage.color_attributes['ao'].data.foreach_set('color', np.repeat(ao, 4).astype(np.float32))

    # 4. Músculos: los dos de más peso por vértice (id/255 y peso). 5. Tela y fuerza del relieve.
    order = np.argsort(-Ws, axis=1)
    i0, i1 = order[:, 0], order[:, 1]
    w0, w1 = Ws[np.arange(n), i0], Ws[np.arange(n), i1]
    attrs = {
        '_MUSCLE0': np.stack([np.where(w0 > 0.02, i0, SKIN) / 255.0, np.where(w0 > 0.02, w0, 0)], 1),
        '_MUSCLE1': np.stack([np.where(w1 > 0.02, i1, SKIN) / 255.0, np.where(w1 > 0.02, w1, 0)], 1),
        '_SURF': fields / CLOTH_RANGE,
    }
    for name, val in attrs.items():
        kind = 'FLOAT_VECTOR' if val.shape[1] == 3 else 'FLOAT2'
        cage.attributes.new(name, kind, 'POINT').data.foreach_set('vector', val.astype(np.float32).ravel())
    print('vértices por músculo:', {m: int(((i0 == k) & (w0 > 0.5)).sum()) for k, m in enumerate(MUSCLES)})
    print('vértices de tela:', int((sdf > 0).sum()))

    # Ojos: material propio (segunda primitiva del .glb), sin músculo, tela ni mapa de normales.
    eye_mat = bpy.data.materials.new('eye')
    objs = [body]
    for me in eye_meshes:
        Q = mesh_arrays(me)[0]
        k = len(me.vertices)
        me.vertices.foreach_set('co', norm(Q).astype(np.float32).ravel())
        me.materials.clear()
        me.materials.append(eye_mat)
        for name, val in (('_MUSCLE0', [1.0, 0.0]), ('_MUSCLE1', [1.0, 0.0]), ('_SURF', [-1.0, 1.0, -1.0])):
            kind = 'FLOAT_VECTOR' if len(val) == 3 else 'FLOAT2'
            me.attributes.new(name, kind, 'POINT').data.foreach_set('vector', np.tile(val, k).astype(np.float32))
        me.color_attributes.new('ao', 'BYTE_COLOR', 'POINT').data.foreach_set('color', np.full(k * 4, 0.8, np.float32))
        me.color_attributes.active_color_name = 'ao'
        me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
        o = bpy.data.objects.new('eye', me)
        link(o)
        objs.append(o)
    with bpy.context.temp_override(active_object=body, object=body, selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    body.data.color_attributes.active_color_name = 'ao'
    body.name = f'body-{GENDER}'

    if out:
        for o in sc.objects:
            o.select_set(o == body)
        bpy.ops.export_scene.gltf(
            filepath=out, export_format='GLB', use_selection=True, export_attributes=True, export_vertex_color='ACTIVE',
            export_normals=True, export_texcoords=True, export_tangents=True, export_materials='EXPORT',
            export_image_format='WEBP', export_image_quality=int(arg('--quality', 90)), export_yup=True, export_apply=False,
            export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        )
        print('glb', out, os.path.getsize(out), 'bytes')
    if arg('--render'):
        render(body, Ws, arg('--render'), bool(arg('--ids', False)))


PALETTE = np.array([[0.86, 0.33, 0.3], [0.95, 0.6, 0.25], [0.98, 0.8, 0.3], [0.7, 0.45, 0.2], [0.35, 0.6, 0.9], [0.3, 0.8, 0.85],
                    [0.55, 0.5, 0.95], [0.85, 0.45, 0.8], [0.4, 0.75, 0.4], [0.25, 0.5, 0.3], [0.95, 0.85, 0.6], [0.7, 0.85, 0.3],
                    [0.9, 0.5, 0.55], [0.45, 0.55, 0.85], [0.6, 0.3, 0.6], [0.3, 0.7, 0.6]])


def render(obj, Ws, path, ids):
    """Lámina de control: EEVEE con mapa de normales y tela, o regiones musculares en color (--ids)."""
    sc = bpy.context.scene
    me = obj.data
    if ids:
        col = np.ones((len(me.vertices), 4)) * 0.8
        k = len(Ws)
        col[:k, :3] = Ws @ PALETTE + (1 - Ws.sum(axis=1, keepdims=True)) * 0.8
        ca = me.color_attributes.new('ids', 'FLOAT_COLOR', 'POINT')
        ca.data.foreach_set('color', col.astype(np.float32).ravel())
        me.color_attributes.active_color_name = 'ids'
        sc.render.engine = 'BLENDER_WORKBENCH'
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'VERTEX'
    else:
        # La tela se corta por píxel con max(a, min(STRAP − |u|, v)) > 0, como en el shader de la web.
        nt = me.materials[0].node_tree
        attr = nt.nodes.new('ShaderNodeAttribute')
        attr.attribute_name = '_SURF'
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(attr.outputs['Vector'], sep.inputs[0])

        def node(op, a, b=None):
            n_ = nt.nodes.new('ShaderNodeMath')
            n_.operation = op
            for i, val in enumerate((a, b)):
                if isinstance(val, float):
                    n_.inputs[i].default_value = val
                elif val is not None:
                    nt.links.new(val, n_.inputs[i])
            return n_.outputs[0]

        strap = node('MINIMUM', node('SUBTRACT', STRAP / CLOTH_RANGE, node('ABSOLUTE', sep.outputs['Y'])), sep.outputs['Z'])
        gt = node('GREATER_THAN', node('MAXIMUM', sep.outputs['X'], strap), 0.0)
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        sock = {s.identifier: s for s in mix.inputs}
        sock['A_Color'].default_value = (0.78, 0.74, 0.7, 1)
        sock['B_Color'].default_value = (0.1, 0.11, 0.12, 1)
        nt.links.new(gt, sock['Factor_Float'])
        out_color = next(s for s in mix.outputs if s.identifier == 'Result_Color')
        nt.links.new(out_color, nt.nodes['Principled BSDF'].inputs['Base Color'])
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
        sc.world.use_nodes = True
        bg = sc.world.node_tree.nodes['Background']
        bg.inputs['Color'].default_value = (0.32, 0.33, 0.35, 1)
        bg.inputs['Strength'].default_value = 0.7
        for ang, energy in (((50, 0, -35), 3.5), ((60, 0, 150), 2.2)):
            ld = bpy.data.lights.new('sol', 'SUN')
            ld.energy = energy
            ld.use_shadow = False  # como en la web: sin sombras proyectadas
            lo = bpy.data.objects.new('sol', ld)
            lo.rotation_euler = tuple(math.radians(a) for a in ang)
            sc.collection.objects.link(lo)
    sc.render.resolution_x, sc.render.resolution_y = 520, 900
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    sc.collection.objects.link(cam)
    sc.camera = cam
    # Cuerpo entero y, aparte, cabeza y tronco de cerca (-close.png).
    for sheet_path, cam_y, scale in ((path, 0.9, 1.95), (path.replace('.png', '-close.png'), HEIGHT - 0.36, 0.72)):
        cam.data.ortho_scale = scale
        shots = []
        for name, az in (('front', 0), ('side', 90), ('back', 180), ('quarter', 35)):
            a = math.radians(az)
            cam.location = (5 * math.sin(a), -5 * math.cos(a), cam_y)
            cam.rotation_euler = (math.pi / 2, 0, a)
            f = sheet_path.replace('.png', f'-{name}.png')
            sc.render.filepath = f
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(f)
            shots.append(np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4))
        sheet = np.concatenate(shots, axis=1)
        im = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0])
        im.pixels = sheet.ravel()
        im.filepath_raw = sheet_path
        im.file_format = 'PNG'
        im.save()
        print('lámina', sheet_path)


main()
