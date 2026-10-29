# Figura atlética del mapa muscular del Coliseo, modelada en Blender por código.
#
# Se esculpe como en arcilla, con un campo de distancia en dos capas:
#   1. La base (huesos, grasa y piel): elipsoides y conos redondeados con una
#      unión suave amplia, para que la piel pase de una forma a otra sin costuras.
#   2. Los músculos: cada uno es un trazo de su origen a su inserción que se
#      apoya sobre esa piel (como una tira de arcilla), con su ancho y su relieve
#      en milímetros. Entre músculos la unión es estrecha y deja el surco que los
#      separa; con la piel se funden más suave.
# OpenVDB convierte el campo en malla, Blender la suaviza y la diezma, y cada
# vértice guarda su músculo de lib/coliseo (255 = piel), su peso (0 en el surco)
# y su oclusión (Cycles hornea la sombra ambiental y se suman los surcos), para
# que el visor coloree por fatiga sin bordes duros y se lea la definición.
#
# Coordenadas como en three.js: metros, y arriba, z al frente, pies en y = 0.
# Se modela el lado +x; el -x es su espejo. Salida: NLM2
# (src/components/coliseo/muscle3d/nlm.ts) y, si se pide, una lámina de control.
#
# Uso: blender -b --factory-startup -P avatar.py -- --gender male|female --out f.nlm [--render f.png] [--ids]
import math
import struct
import sys

import bmesh
import bpy
import numpy as np
import openvdb as vdb

MUSCLES = ['chest', 'frontDelts', 'sideDelts', 'rearDelts', 'triceps', 'biceps', 'forearms', 'traps',
           'lats', 'lowerBack', 'abs', 'obliques', 'glutes', 'quads', 'hamstrings', 'calves']
BODY = 255


def arg(name, default=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default


F = arg('--gender', 'male') == 'female'

V = lambda x, y, z: np.array([x, y, z], dtype=float)
unit = lambda v: v / np.linalg.norm(v)
FWD, BACK, OUT, UP = V(0, 0, 1), V(0, 0, -1), V(1, 0, 0), V(0, 1, 0)


def basis(long_axis, out):
    """Columnas: ancho, largo y fondo (hacia `out`, ortogonal al largo)."""
    u = unit(long_axis)
    d = out - u * np.dot(out, u)
    d = unit(d) if np.linalg.norm(d) > 1e-6 else unit(np.cross(u, OUT))
    return np.stack([np.cross(d, u), u, d], axis=1)


BASE, STROKES = [], []


def ell(c, r, B=None, k=0.02):
    BASE.append({'kind': 'ell', 'c': np.asarray(c, float), 'r': np.asarray(r, float), 'B': np.eye(3) if B is None else B, 'k': k})


def hollow(c, r, k=0.008):
    """Hueco tallado en la base (resta suave): las cuencas de los ojos."""
    BASE.append({'kind': 'ell', 'c': np.asarray(c, float), 'r': np.asarray(r, float), 'B': np.eye(3), 'k': k, 'neg': True})


def cap(a, b, ra, rb, k=0.02):
    BASE.append({'kind': 'cap', 'a': np.asarray(a, float), 'b': np.asarray(b, float), 'ra': ra, 'rb': rb, 'k': k})


def stroke(points, w, lift, m=None, peak=0.5, ends=0.45, flat=0.7):
    """Músculo como trazo sobre la piel: `w` semiancho máximo, `lift` relieve máximo (m), `peak` dónde es más grueso."""
    STROKES.append({'pts': [np.asarray(p, float) for p in points], 'w': w, 'lift': lift, 'm': m, 'peak': peak, 'ends': ends, 'flat': flat})


def pad(c, half_w, half_h, lift, m, tilt=V(0, 1, 0.12)):
    """Bloque (abdominal): un solo elipsoide apoyado en la piel."""
    STROKES.append({'pad': np.asarray(c, float), 'w': half_w, 'h': half_h, 'lift': lift, 'm': m, 'tilt': tilt})


# ───────── Proporciones ─────────
# Mismas articulaciones que el maniquí anterior (el encuadre y las pruebas de toque siguen
# valiendo) con volúmenes de un cuerpo atlético de 1,78 m: brazo de ~34 cm, muslo de
# ~58 cm, pecho de ~104 cm y cintura de ~80 cm. La figura femenina estrecha hombros y
# cintura, ensancha la pelvis, baja el relieve muscular y al final mide 1,69 m.
Mu = 0.72 if F else 1.0   # relieve de brazos, hombros, pecho y espalda
Ml = 0.85 if F else 1.0   # relieve de piernas y glúteos
S = V(0.172 if F else 0.185, 1.395, -0.006)
E = V(0.244 if F else 0.252, 1.118, -0.016)
W = V(0.306 if F else 0.318, 0.878, 0.014)
H = V(0.094 if F else 0.088, 0.905, 0.0)
K = V(0.097, 0.49, 0.012)
A = V(0.103, 0.088, -0.014)


def frame(a, b):
    u = unit(b - a)
    f = unit(FWD - u * u[2])
    l = np.cross(u, f)
    return u, f, (l if l[0] >= 0 else -l)


def on(a, b, t, f=0.0, l=0.0):
    _, Fv, L = frame(a, b)
    return a + (b - a) * t + Fv * f + L * l


# ───────── Base: huesos, grasa y piel ─────────
hip = 1.1 if F else 1.0
nar = 0.88 if F else 1.0
ell(V(0, 0.935, -0.016), (0.143 * hip, 0.096, 0.106), k=0.05 if F else 0.035)                 # pelvis
ell(V(0, 1.07, -0.006), (0.138 * (0.84 if F else 1.0), 0.115, 0.092), k=0.045)                 # abdomen
ell(V(0, 1.268, -0.02), (0.142 * nar, 0.168, 0.103), k=0.045)                 # caja torácica
ell(V(0, 1.405, -0.024), (0.14 * nar, 0.064, 0.088), k=0.04)                  # cintura escapular
cap(V(0, 0.97, -0.066), V(0, 1.43, -0.06), 0.052, 0.052, k=0.035)            # masa de la espalda
cap(V(0, 1.42, -0.016), V(0, 1.6, 0.0), 0.062 * nar, 0.052 * nar, k=0.04)  # cuello
cap(V(0.02, 1.446, 0.054), V(S[0] - 0.022, 1.446, 0.01), 0.0085, 0.0078, k=0.014)  # clavícula
ell(V(0.085, 1.345, -0.088), (0.056, 0.072, 0.014), basis(V(0.25, 1, 0), BACK), k=0.03)  # escápula

hs = 0.94 if F else 1.0
hc = V(0, 1.672, 0.004)
ell(hc + V(0, 0.008, -0.012) * hs, V(0.075, 0.092, 0.094) * hs, k=0.02)      # cráneo
ell(hc + V(0, -0.036, 0.036) * hs, V(0.062, 0.07, 0.056) * hs, k=0.03)       # cara
ell(hc + V(0, -0.097, 0.056) * hs, V(0.035 if F else 0.041, 0.023, 0.029) * hs, k=0.018)  # mentón
ell(hc + V(0.046, -0.072, 0.01) * hs, V(0.022, 0.03, 0.03) * hs, k=0.022)    # ángulo de la mandíbula
ell(hc + V(0.043, -0.028, 0.058) * hs, V(0.017, 0.011, 0.012) * hs, k=0.012)  # pómulo
ell(hc + V(0.075, -0.022, -0.006) * hs, V(0.008, 0.026, 0.016) * hs, k=0.006)  # oreja
hollow(hc + V(0.03, -0.012, 0.086) * hs, V(0.017, 0.012, 0.013) * hs)              # cuenca del ojo
ell(hc + V(0.029, -0.014, 0.07) * hs, V(0.0115, 0.0105, 0.011) * hs, k=0.004)   # ojo y párpado
ell(hc + V(0, 0.004, 0.076) * hs, V(0.05, 0.011, 0.014) * hs, k=0.014)       # arco superciliar
ell(hc + V(0, -0.028, 0.088) * hs, V(0.0085, 0.021, 0.011) * hs, basis(V(0, 1, -0.3), FWD), k=0.01)  # nariz
ell(hc + V(0.011, -0.046, 0.084) * hs, V(0.0075, 0.006, 0.007) * hs, k=0.006)  # aleta de la nariz
ell(hc + V(0, -0.068, 0.076) * hs, V(0.02, 0.0065, 0.008) * hs, k=0.008)     # labios
if F:
    ell(hc + V(0, 0.03, -0.088) * hs, V(0.05, 0.046, 0.042), k=0.014)        # moño
    ell(hc + V(0, 0.036, -0.014) * hs, V(0.081, 0.08, 0.093) * hs, k=0.006)  # pelo recogido

# Brazo: hueso, grasa y músculo profundo (los vientres van en la capa muscular).
ell(S, (0.05,) * 3, k=0.024)
cap(S, E, 0.044 * (0.88 if F else 1.0), 0.035 * (0.88 if F else 1.0), k=0.026)
ell(on(S, E, 1.0, -0.024), (0.019, 0.02, 0.016), k=0.012)                     # olécranon
cap(E, W, 0.042 * (0.84 if F else 1.0), 0.021, k=0.024)
u, f, l = frame(E, W)
hb = np.stack([l, u, f], 1)
ell(W, (0.025, 0.013, 0.017), hb, k=0.012)                                     # muñeca
palm = W + u * 0.052
ell(palm, (0.037, 0.049, 0.0148), hb, k=0.012)                                 # palma
for dl, ln in [(-0.028, 0.066), (-0.0095, 0.078), (0.0095, 0.074), (0.028, 0.06)]:
    k0 = palm + u * 0.044 + l * dl * (0.95 if F else 1.0)
    k1 = k0 + u * ln * 0.55 + f * 0.01
    cap(k0, k1, 0.0082, 0.0074, k=0.002)
    cap(k1, k1 + u * ln * 0.45 + f * 0.014, 0.0074, 0.0064, k=0.002)
t0 = W + u * 0.024 - l * 0.028 + f * 0.012                                     # pulgar
t1 = t0 + u * 0.034 - l * 0.014 + f * 0.022
cap(t0, t1, 0.0105, 0.0085, k=0.004)
cap(t1, t1 + u * 0.026 + f * 0.012, 0.0085, 0.0072, k=0.002)

# Pierna
cap(H, K, 0.077 * (1.1 if F else 1.0), 0.054, k=0.04)
ell(K, (0.048, 0.044, 0.046), k=0.02)                                          # rodilla
ell(K + V(0, 0.004, 0.044), (0.022, 0.025, 0.013), k=0.012)                    # rótula
cap(K, A, 0.053, 0.028, k=0.03)
ell(A + V(-0.017, 0.002, 0), (0.011, 0.015, 0.013), k=0.008)                   # maléolo interno
ell(A + V(0.018, -0.006, -0.004), (0.011, 0.015, 0.013), k=0.008)              # maléolo externo
toe_out = lambda x, y, z: V(x + z * 0.12, y, z)                                 # punta del pie un poco hacia afuera
ell(toe_out(0.1, 0.036, -0.034), (0.033, 0.036, 0.036), k=0.016)               # talón
ell(toe_out(0.106, 0.03, 0.055), (0.042, 0.105, 0.028), basis(V(0.12, -0.08, 1), UP), k=0.02)  # planta
ell(toe_out(0.103, 0.058, 0.03), (0.033, 0.07, 0.032), basis(V(0.1, -0.35, 1), UP), k=0.022)   # empeine
ell(toe_out(0.11, 0.022, 0.13), (0.047, 0.021, 0.04), k=0.014)                 # metatarsos
ell(toe_out(0.087, 0.018, 0.182), (0.015, 0.015, 0.026), k=0.008)              # dedo gordo
ell(toe_out(0.121, 0.015, 0.168), (0.029, 0.013, 0.024), k=0.008)              # dedos
if F:
    ell(V(0.118, 0.9, -0.014), (0.05, 0.1, 0.064), k=0.07)                       # cadera

# ───────── Músculos (trazos sobre la piel) ─────────
I = on(S, E, 0.18, 0.034, -0.01)  # inserción del pectoral, delante de la axila
stroke([V(0.045, 1.44, 0.07), V(0.11, 1.428, 0.072), I], 0.026, 0.01 * Mu, 'chest', peak=0.4, ends=0.55)
stroke([V(0.016, 1.34, 0.096), V(0.09, 1.334, 0.106), I], 0.054, 0.019 * Mu, 'chest', peak=0.45, ends=0.62, flat=0.4)
if F:
    pad(V(0.084, 1.266, 0.11), 0.056, 0.05, 0.042, 'chest', tilt=V(0.12, 1, -0.15))   # pecho

dI = on(S, E, 0.42, 0.006, 0.024)
stroke([V(S[0] - 0.042, 1.448, 0.046), S + V(0.024, -0.01, 0.045), dI], 0.03, 0.021 * Mu, 'frontDelts', peak=0.42, ends=0.55)
stroke([V(S[0] + 0.004, 1.465, -0.004), S + V(0.055, -0.045, -0.004), dI], 0.034, 0.025 * Mu, 'sideDelts', peak=0.42, ends=0.55)
stroke([V(S[0] - 0.042, 1.44, -0.062), S + V(0.024, -0.01, -0.05), dI], 0.03, 0.019 * Mu, 'rearDelts', peak=0.42, ends=0.55)

stroke([on(S, E, 0.2, 0.04), on(S, E, 0.55, 0.045), on(S, E, 0.9, 0.035)], 0.023, 0.02 * Mu, 'biceps', peak=0.6)
stroke([on(S, E, 0.5, 0.0, 0.04), on(S, E, 0.96, 0.012, 0.034)], 0.013, 0.007 * Mu, None)                       # braquial
stroke([on(S, E, 0.1, -0.04), on(S, E, 0.5, -0.045), on(S, E, 0.86, -0.04)], 0.023, 0.017 * Mu, 'triceps', peak=0.45)
stroke([on(S, E, 0.15, -0.022, 0.034), on(S, E, 0.45, -0.028, 0.034), on(S, E, 0.68, -0.034, 0.022)], 0.019, 0.015 * Mu, 'triceps')

stroke([on(S, E, 0.7, 0.012, 0.034), on(E, W, 0.15, 0.024, 0.034), on(E, W, 0.6, 0.018, 0.022)], 0.019, 0.014 * Mu, 'forearms', peak=0.35)
stroke([on(E, W, 0.0, 0.022, -0.028), on(E, W, 0.35, 0.03, -0.016), on(E, W, 0.7, 0.018, -0.004)], 0.023, 0.013 * Mu, 'forearms', peak=0.3)
stroke([on(E, W, 0.05, -0.018, 0.028), on(E, W, 0.4, -0.024, 0.022), on(E, W, 0.75, -0.014, 0.014)], 0.021, 0.012 * Mu, 'forearms', peak=0.3)

stroke([V(0.022, 1.59, -0.036), V(0.085, 1.515, -0.044), V(S[0] - 0.026, 1.462, -0.026)], 0.034, 0.02 * Mu, 'traps', peak=0.38, ends=0.6)
stroke([V(0.01, 1.45, -0.092), V(0.07, 1.442, -0.09), V(0.135, 1.43, -0.072)], 0.022, 0.008 * Mu, 'traps')
stroke([V(0.008, 1.21, -0.108), V(0.04, 1.31, -0.108), V(0.076, 1.4, -0.102)], 0.022, 0.007 * Mu, 'traps')
stroke([V(0.04, 1.03, -0.1), V(0.1, 1.17, -0.094), V(0.152, 1.33, -0.052)], 0.045, 0.012 * Mu, 'lats', peak=0.55)
stroke([V(0.116, 1.1, -0.066), V(0.152, 1.22, -0.05), V(0.17, 1.32, -0.03)], 0.026, 0.014 * Mu, 'lats', peak=0.5)
stroke([V(0.095, 1.28, -0.098), V(0.16, 1.35, -0.056)], 0.018, 0.006 * Mu, None)                                  # redondo mayor
stroke([V(0.06, 1.32, -0.104), V(0.14, 1.37, -0.076)], 0.026, 0.004 * Mu, None)                                   # infraespinoso
stroke([V(0.028, 0.96, -0.104), V(0.032, 1.1, -0.114), V(0.034, 1.24, -0.114)], 0.018, 0.014 * (0.8 if F else 1.0), 'lowerBack')

al = 0.005 if F else 0.0065
for y, hh, hw in [(1.212, 0.024, 0.0185), (1.152, 0.025, 0.019), (1.092, 0.025, 0.0185), (1.024, 0.03, 0.017)]:
    pad(V(0.0215, y, 0.09), hw, hh, al * (0.8 if y < 1.05 else 1.0), 'abs')
stroke([V(0.13, 1.22, 0.03), V(0.127, 1.11, 0.046), V(0.11, 1.0, 0.056)], 0.03, 0.009 * (0.75 if F else 1.0), 'obliques', peak=0.4)
for y in (1.235, 1.265, 1.295):                                                   # serrato
    stroke([V(0.118, y - 0.01, 0.054), V(0.142, y + 0.015, 0.026)], 0.01, 0.006 * Mu, None, ends=0.6)

gl = 1.12 if F else 1.0
stroke([V(0.03, 1.0, -0.104), V(0.09, 0.92, -0.114), V(0.142, 0.83, -0.066)], 0.06 * gl, 0.028 * Ml * gl, 'glutes', peak=0.45)
stroke([V(0.1, 1.01, -0.046), V(0.146, 0.92, -0.022)], 0.026, 0.009 * Ml, 'glutes')

stroke([on(H, K, 0.06, 0.08), on(H, K, 0.45, 0.092), on(H, K, 0.88, 0.064)], 0.025, 0.014 * Ml, 'quads', peak=0.45)
stroke([on(H, K, 0.1, 0.01, 0.084), on(H, K, 0.5, 0.024, 0.088), on(H, K, 0.9, 0.034, 0.056)], 0.03, 0.016 * Ml, 'quads', peak=0.5)
stroke([on(H, K, 0.55, 0.045, -0.062), on(H, K, 0.8, 0.05, -0.056), on(H, K, 0.96, 0.04, -0.034)], 0.022, 0.015 * Ml, 'quads', peak=0.7)
stroke([on(H, K, 0.02, 0.0, -0.066), on(H, K, 0.35, 0.0, -0.078), on(H, K, 0.62, 0.0, -0.056)], 0.03, 0.012 * Ml, None)  # aductores
stroke([V(0.125, 0.97, 0.066), on(H, K, 0.5, 0.066, -0.034), on(H, K, 0.95, 0.0, -0.054)], 0.009, 0.004, None, ends=0.8)  # sartorio
stroke([V(0.142, 0.96, 0.036), on(H, K, 0.3, 0.022, 0.084)], 0.016, 0.004, None)                                       # tensor de la fascia
stroke([on(H, K, 0.12, -0.078, 0.022), on(H, K, 0.5, -0.084, 0.04), on(H, K, 0.92, -0.05, 0.044)], 0.024, 0.014 * Ml, 'hamstrings')
stroke([on(H, K, 0.1, -0.078, -0.022), on(H, K, 0.5, -0.084, -0.034), on(H, K, 0.92, -0.05, -0.04)], 0.024, 0.014 * Ml, 'hamstrings')

stroke([on(K, A, 0.04, -0.044, -0.024), on(K, A, 0.24, -0.052, -0.034), on(K, A, 0.48, -0.036, -0.018)], 0.026, 0.027 * Ml, 'calves', peak=0.4, ends=0.5)
stroke([on(K, A, 0.04, -0.042, 0.02), on(K, A, 0.22, -0.052, 0.024), on(K, A, 0.42, -0.04, 0.014)], 0.023, 0.022 * Ml, 'calves', peak=0.4, ends=0.5)
stroke([on(K, A, 0.34, -0.03, 0.026), on(K, A, 0.6, -0.028, 0.024), on(K, A, 0.84, -0.02, 0.016)], 0.016, 0.008 * Ml, 'calves')
stroke([on(K, A, 0.34, -0.03, -0.026), on(K, A, 0.6, -0.028, -0.024), on(K, A, 0.84, -0.02, -0.016)], 0.016, 0.008 * Ml, 'calves')
stroke([on(K, A, 0.08, 0.04, 0.016), on(K, A, 0.45, 0.04, 0.016), on(K, A, 0.8, 0.028, 0.01)], 0.012, 0.006, None)    # tibial anterior
stroke([V(0.05, 1.595, -0.012), V(0.035, 1.53, 0.022), V(0.016, 1.455, 0.054)], 0.012, 0.005, None)                 # esternocleidomastoideo


# ───────── Campo de distancia ─────────

def mirrored(p):
    q = dict(p)
    for key in ('c', 'a', 'b', 'pad'):
        if key in p:
            q[key] = p[key] * V(-1, 1, 1)
    if 'B' in p:
        q['B'] = np.diag([-1.0, 1, 1]) @ p['B']
    if 'pts' in p:
        q['pts'] = [x * V(-1, 1, 1) for x in p['pts']]
    if 'tilt' in p:
        q['tilt'] = p['tilt'] * V(-1, 1, 1)
    return q


def side_of(p):
    if 'c' in p:
        return p['c'][0]
    if 'a' in p:
        return max(p['a'][0], p['b'][0])
    if 'pad' in p:
        return p['pad'][0]
    return max(x[0] for x in p['pts'])


def mirror(items):
    out = []
    for p in items:
        out.append(p)
        if side_of(p) > 0.004:
            out.append(mirrored(p))
    return out


def sdf_ell(P, p):
    q = (P - p['c']) @ p['B']
    r = p['r']
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sdf_cap(P, p):
    a, b, ra, rb = p['a'], p['b'], p['ra'], p['rb']
    ba = b - a
    l2 = ba @ ba
    rr = ra - rb
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = P - a
    y = pa @ ba
    z = y - l2
    x2 = np.sum((pa * l2 - np.outer(y, ba)) ** 2, axis=1)
    y2, z2 = y * y * l2, z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d_end = np.sqrt(x2 + z2) * il2 - rb
    d_start = np.sqrt(x2 + y2) * il2 - ra
    d_side = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - ra
    return np.where(np.sign(z) * a2 * z2 > k, d_end, np.where(np.sign(y) * a2 * y2 < k, d_start, d_side))


def sdf(P, p):
    return sdf_ell(P, p) if p['kind'] == 'ell' else sdf_cap(P, p)


def box_of(p, margin):
    if p['kind'] == 'ell':
        ext = np.sqrt(((p['B'] * p['r']) ** 2).sum(axis=1)) + margin
        return p['c'] - ext, p['c'] + ext
    lo = np.minimum(p['a'], p['b']) - max(p['ra'], p['rb']) - margin
    hi = np.maximum(p['a'], p['b']) + max(p['ra'], p['rb']) + margin
    return lo, hi


VOX = float(arg('--voxel', 0.0032))
LO, HI = V(-0.48, -0.015, -0.22), V(0.48, 1.8, 0.25)
DIMS = np.ceil((HI - LO) / VOX).astype(int) + 1
BAND = 0.06
K_CHAIN, K_SAME, K_MUSCLE, K_JOIN = 0.014, 0.01, 0.0055, 0.014


def index_window(lo, hi):
    i0 = np.clip(np.floor((lo - LO) / VOX).astype(int), 0, DIMS - 1)
    i1 = np.clip(np.ceil((hi - LO) / VOX).astype(int) + 1, 1, DIMS)
    return i0, i1


def points(i0, i1):
    axes = [LO[d] + np.arange(i0[d], i1[d]) * VOX for d in range(3)]
    X, Y, Z = np.meshgrid(*axes, indexing='ij')
    return np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1), X.shape


def sl(i0, i1):
    return tuple(slice(i0[d], i1[d]) for d in range(3))


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def splat(field, p, k, origin=None):
    """Une la forma `p` al campo (todo el volumen o una ventana local que empieza en `origin`)."""
    lo, hi = box_of(p, k * 2 + 0.006)
    i0, i1 = index_window(lo, hi)
    if origin is not None:
        o0, o1 = origin
        i0, i1 = np.maximum(i0, o0), np.minimum(i1, o1)
        if np.any(i1 <= i0):
            return
        P, shape = points(i0, i1)
        s = sl(i0 - o0, i1 - o0)
    else:
        P, shape = points(i0, i1)
        s = sl(i0, i1)
    d = sdf(P, p).reshape(shape)
    field[s] = -smin(-field[s], d, k) if p.get('neg') else smin(field[s], d, k)


class Sampler:
    """Lee el campo de la base en cualquier punto (trilineal) y proyecta puntos sobre la piel."""

    def __init__(self, field):
        self.f = field
        self.g = np.stack(np.gradient(field, VOX), axis=-1)

    def _lerp(self, arr, P):
        u = np.clip((P - LO) / VOX, 0, DIMS - 1.001)
        i = np.floor(u).astype(int)
        t = u - i
        out = 0
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    wgt = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                    v = arr[i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz]
                    out = out + (wgt[:, None] * v if v.ndim > 1 else wgt * v)
        return out

    def project(self, P):
        P = np.array(P, float)
        for _ in range(6):
            d = self._lerp(self.f, P)
            n = self._lerp(self.g, P)
            n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
            P = P - d[:, None] * n
        n = self._lerp(self.g, P)
        return P, n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


def catmull(pts, n):
    pts = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    segs = len(pts) - 3
    for i in range(n):
        t = i / (n - 1) * segs
        s = min(int(t), segs - 1)
        u = t - s
        p0, p1, p2, p3 = pts[s], pts[s + 1], pts[s + 2], pts[s + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return np.array(out)


def chain(st, sampler):
    """Los elipsoides de un músculo: muestras del trazo apoyadas en la piel, más gruesas en el vientre."""
    if 'pad' in st:
        P, N = sampler.project(st['pad'][None, :])
        sink = 0.5 * st['w']  # hundido según el ancho: el borde entra en la piel en vez de flotar
        d = st['lift'] + sink
        c = P[0] - N[0] * sink
        return [{'kind': 'ell', 'c': c, 'r': np.array([st['w'], st['h'], d]), 'B': basis(st['tilt'], N[0]), 'm': st['m']}]
    rough = catmull(st['pts'], 40)
    length = np.linalg.norm(np.diff(rough, axis=0), axis=1).sum()
    n = max(6, int(length / 0.012) + 1)
    P, N = sampler.project(catmull(st['pts'], n))
    a = math.log(0.5) / math.log(st['peak'])
    out = []
    for j in range(n):
        t = j / (n - 1)
        s = math.sin(math.pi * min(1.0, max(0.0, t)) ** a) ** st['flat']
        lift = st['lift'] * (0.15 + 0.85 * s)
        w = st['w'] * (st['ends'] + (1 - st['ends']) * s)
        tang = P[min(j + 1, n - 1)] - P[max(j - 1, 0)]
        sink = 0.5 * w + 0.002
        d = lift + sink
        out.append({'kind': 'ell', 'c': P[j] - N[j] * sink, 'r': np.array([w, length / (n - 1) * 1.9, d]), 'B': basis(tang, N[j]), 'm': st['m']})
    return out


def build(base, strokes):
    fb = np.full(DIMS, BAND, np.float32)
    for p in base:
        splat(fb, p, p['k'])
    sampler = Sampler(fb)
    fm = np.full(DIMS, BAND, np.float32)
    shapes = []
    groups = {}
    for n, st in enumerate(strokes):
        side = 0 if st['m'] is None else (1 if side_of(st) > 0 else -1)
        groups.setdefault((st['m'], side) if st['m'] and 'pad' not in st else n, []).append(st)
    for group in groups.values():
        chains = [chain(st, sampler) for st in group]
        shapes.extend(chains)
        boxes = [box_of(p, K_CHAIN * 2 + 0.006) for parts in chains for p in parts]
        i0, i1 = index_window(np.min([b[0] for b in boxes], 0), np.max([b[1] for b in boxes], 0))
        own = np.full(tuple(i1 - i0), BAND, np.float32)
        for st, parts in zip(group, chains):
            local = np.full(tuple(i1 - i0), BAND, np.float32)
            for p in parts:
                splat(local, p, 0.02 if 'pad' in st and st['m'] == 'chest' else K_CHAIN, origin=(i0, i1))
            own = smin(own, local, K_SAME)
        s = sl(i0, i1)
        fm[s] = smin(fm[s], own, K_MUSCLE)
    field = np.clip(smin(fb, fm, K_JOIN), -BAND, BAND)
    return field, [p for parts in shapes for p in parts]


def to_mesh(field):
    g = vdb.FloatGrid()
    g.background = BAND
    g.copyFromArray(field)
    pts, tris, quads = g.convertToPolygons(0.0, 0.0)
    P = LO + pts.astype(float) * VOX
    faces = np.concatenate([quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]] + ([tris] if len(tris) else []), axis=0)
    me = bpy.data.meshes.new('body')
    me.vertices.add(len(P))
    me.vertices.foreach_set('co', P.astype(np.float32).ravel())
    me.loops.add(len(faces) * 3)
    me.loops.foreach_set('vertex_index', faces.astype(np.int32).ravel())
    me.polygons.add(len(faces))
    me.polygons.foreach_set('loop_start', np.arange(0, len(faces) * 3, 3, dtype=np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(faces), 3, np.int32))
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return me


def finish(me, smooth_iter, target_tris):
    obj = bpy.data.objects.new('raw', me)
    bpy.context.scene.collection.objects.link(obj)
    if smooth_iter:
        sm = obj.modifiers.new('smooth', 'LAPLACIANSMOOTH')
        sm.iterations = smooth_iter
        sm.lambda_factor = 0.5
        sm.use_volume_preserve = True
    if target_tris:
        dc = obj.modifiers.new('decimate', 'DECIMATE')
        dc.ratio = min(1.0, target_tris / max(1, len(me.polygons)))
    dg = bpy.context.evaluated_depsgraph_get()
    out = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    bpy.data.objects.remove(obj)
    print(f'malla {len(me.polygons)} triángulos -> {len(out.polygons)}')
    return out


def drop_fragments(P, T, min_verts=300):
    parent = np.arange(len(P))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    tri = T.reshape(-1, 3)
    for a, b in ((0, 1), (1, 2)):
        for u, v in zip(tri[:, a], tri[:, b]):
            ru, rv = find(u), find(v)
            if ru != rv:
                parent[ru] = rv
    roots = np.array([find(i) for i in range(len(P))])
    ids, counts = np.unique(roots, return_counts=True)
    keep_roots = set(ids[counts >= min_verts])
    keep = np.array([r in keep_roots for r in roots])
    remap = np.cumsum(keep) - 1
    tri = tri[keep[tri[:, 0]]]
    print('piezas', len(ids), 'conservadas', len(keep_roots), 'vértices fuera', int((~keep).sum()))
    return P[keep], remap[tri].ravel().astype(np.int32)


def mesh_arrays(me):
    me.calc_loop_triangles()
    P = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', P)
    T = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
    me.loop_triangles.foreach_get('vertices', T)
    return P.reshape(-1, 3).astype(float), T


def smooth01(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def assign(P, base, parts):
    """Músculo de cada vértice (255 = piel) y su peso: 1 en el vientre, 0 en el surco."""
    Dm = np.stack([sdf(P, p) for p in parts], axis=1)
    ids = np.array([BODY if p['m'] is None else MUSCLES.index(p['m']) for p in parts])
    db = np.stack([sdf(P, p) for p in base if not p.get('neg')], axis=1).min(axis=1)
    best = np.argmin(Dm, axis=1)
    dm = Dm[np.arange(len(P)), best]
    owner = ids[best]
    rival = np.minimum(np.where(ids[None, :] == owner[:, None], np.inf, Dm).min(axis=1), db + 0.004)
    weight = smooth01((rival - dm) / 0.006)
    owner = np.where((dm <= db + 0.004) & (owner != BODY), owner, BODY).astype(np.uint8)
    return owner, np.where(owner == BODY, 0.0, weight)


def vertex_normals(P, tri):
    fn = np.cross(P[tri[:, 1]] - P[tri[:, 0]], P[tri[:, 2]] - P[tri[:, 0]])
    vn = np.zeros_like(P)
    for k in range(3):
        np.add.at(vn, tri[:, k], fn)
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)


def neighbor_mean(values, tri, n):
    acc = np.zeros((n,) + values.shape[1:])
    cnt = np.zeros(n)
    for a, b in ((0, 1), (1, 2), (2, 0)):
        np.add.at(acc, tri[:, a], values[tri[:, b]])
        np.add.at(cnt, tri[:, a], 1)
        np.add.at(acc, tri[:, b], values[tri[:, a]])
        np.add.at(cnt, tri[:, b], 1)
    shape = (-1,) + (1,) * (values.ndim - 1)
    return acc / np.maximum(cnt, 1).reshape(shape)


def cavity(P, T):
    """Surcos más oscuros: curvatura cóncava (el vértice queda por debajo de sus vecinos), suavizada."""
    tri = T.reshape(-1, 3)
    n = len(P)
    lap = neighbor_mean(P, tri, n) - P
    edge = np.linalg.norm(P[tri[:, 0]] - P[tri[:, 1]], axis=1).mean()
    c = np.sum(lap * vertex_normals(P, tri), axis=1) / edge
    for _ in range(3):
        c = neighbor_mean(c, tri, n)
    return np.clip(1 - 2.4 * np.maximum(c, 0), 0.62, 1.0)


def bake_ao(P, T):
    """Oclusión ambiental horneada con Cycles en un atributo de color por vértice."""
    me = bpy.data.meshes.new('ao')
    me.from_pydata(P.tolist(), [], T.reshape(-1, 3).tolist())
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    obj = bpy.data.objects.new('ao', me)
    sc = bpy.context.scene
    sc.collection.objects.link(obj)
    obj.data.materials.append(bpy.data.materials.new('ao'))
    me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color_name = 'ao'
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.world = sc.world or bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.14
    sc.render.bake.target = 'VERTEX_COLORS'
    for o in sc.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='AO')
    col = np.empty(len(me.vertices) * 4, dtype=np.float32)
    me.color_attributes['ao'].data.foreach_get('color', col)
    bpy.data.objects.remove(obj)
    return np.clip(col.reshape(-1, 4)[:, 0], 0, 1)


def write_nlm(path, P, T, owner, weight, ao):
    lo, hi = P.min(axis=0), P.max(axis=0)
    q = np.round((P - lo) / (hi - lo) * 65535).astype('<u2')
    n, m = len(P), len(T)
    with open(path, 'wb') as f:
        f.write(b'NLM2')
        f.write(struct.pack('<II', n, m))
        f.write(struct.pack('<6f', *lo, *hi))
        f.write(q.tobytes())
        f.write(owner.astype('u1').tobytes())
        f.write(np.round(weight * 255).astype('u1').tobytes())
        f.write(np.round(ao * 255).astype('u1').tobytes())
        f.write(b'\0' * ((-(36 + n * 9)) % 4))
        f.write(T.astype('<u2' if n <= 65535 else '<u4').tobytes())
    print(f'{path}: {n} vértices, {m // 3} triángulos, alto {hi[1] - lo[1]:.3f} m')


PALETTE = np.array([[0.86, 0.33, 0.3], [0.95, 0.6, 0.25], [0.98, 0.8, 0.3], [0.7, 0.45, 0.2], [0.35, 0.6, 0.9], [0.3, 0.8, 0.85],
                    [0.55, 0.5, 0.95], [0.85, 0.45, 0.8], [0.4, 0.75, 0.4], [0.25, 0.5, 0.3], [0.95, 0.85, 0.6], [0.7, 0.85, 0.3],
                    [0.9, 0.5, 0.55], [0.45, 0.55, 0.85], [0.6, 0.3, 0.6], [0.3, 0.7, 0.6]])


def render_sheet(me, owner, weight, path, ids):
    obj = bpy.data.objects.new('Final', me)
    bpy.context.scene.collection.objects.link(obj)
    obj.rotation_euler = (math.pi / 2, 0, 0)  # y arriba (three) → z arriba (Blender)
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    if ids:
        col = np.ones((len(me.vertices), 4)) * 0.82
        msk = owner != BODY
        col[msk, :3] = PALETTE[owner[msk]] * weight[msk, None] + 0.82 * (1 - weight[msk, None])
        me.color_attributes.new('ids', 'FLOAT_COLOR', 'POINT').data.foreach_set('color', col.astype(np.float32).ravel())
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'VERTEX' if ids else 'SINGLE'
    sh.single_color = (0.8, 0.78, 0.74)
    sh.show_cavity = not ids
    sh.cavity_type = 'WORLD'
    sc.render.resolution_x, sc.render.resolution_y = 520, 900
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = float(arg('--cam-scale', 1.95))
    sc.collection.objects.link(cam)
    sc.camera = cam
    shots = []
    for name, az in (('front', 0), ('side', 90), ('back', 180), ('quarter', 35)):
        a = math.radians(az)
        cam.location = (5 * math.sin(a), -5 * math.cos(a), float(arg('--cam-y', 0.9)))
        cam.rotation_euler = (math.pi / 2, 0, a)
        f = path.replace('.png', f'-{name}.png')
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(f)
        shots.append(np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4))
    sheet = np.concatenate(shots, axis=1)
    out = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0])
    out.pixels = sheet.ravel()
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    print('lámina', path)


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    base, strokes = mirror(BASE), mirror(STROKES)
    field, parts = build(base, strokes)
    me = finish(to_mesh(field), int(arg('--smooth', 2)), int(arg('--tris', 28000)))
    P, T = drop_fragments(*mesh_arrays(me))
    if arg('--render'):
        me = bpy.data.meshes.new('clean')
        me.from_pydata(P.tolist(), [], T.reshape(-1, 3).tolist())
    if F:  # 1,69 m
        s = 1.69 / P[:, 1].max()
        P *= s
        for p in base + parts:
            for key in ('c', 'a', 'b', 'r'):
                if key in p:
                    p[key] = p[key] * s
            if p['kind'] == 'cap':
                p['ra'] *= s
                p['rb'] *= s
        me.vertices.foreach_set('co', P.astype(np.float32).ravel())
    owner, weight = assign(P, base, parts)
    print('vértices por músculo:', {MUSCLES[i]: int((owner == i).sum()) for i in range(16)}, 'piel', int((owner == BODY).sum()))
    if arg('--out'):
        ao = (0.35 + 0.65 * bake_ao(P, T)) * cavity(P, T)
        print('oclusión media', round(float(ao.mean()), 3), 'mínima', round(float(ao.min()), 3))
        write_nlm(arg('--out'), P, T, owner, weight, ao)
    if arg('--render'):
        render_sheet(me, owner, weight, arg('--render'), bool(arg('--ids', False)))


main()
