# Nout Sans: la tipografía de NoutLife, trazada por código.
#
# Cada letra es un esqueleto (líneas, arcos de elipse y alguna curva) que se recorre con una pluma
# elíptica, más ancha que alta: las horizontales salen un poco más finas que las verticales sin perder
# el aire monolineal. Los remates son cortes rectos con las esquinas suavizadas, ni romos ni bola: la
# señal de la familia. En los empalmes (el arco de la n al salir del asta) el trazo se adelgaza para
# que no se forme un nudo oscuro. Los dos maestros tienen los mismos puntos, así que la fuente variable
# (wght 300 a 700) sale de interpolarlos.
#
#   python nout_sans.py --web <carpeta woff2> --design <carpeta ttf>
#
# Lo lanza scripts/build-font.mjs con el Python de Blender, fontTools, brotli y skia-pathops.
import argparse
import math
import os
import shutil
import tempfile
import unicodedata
from array import array
from dataclasses import dataclass

from fontTools.agl import UV2AGL
from fontTools.designspaceLib import AxisDescriptor, DesignSpaceDocument, InstanceDescriptor, SourceDescriptor
from fontTools.fontBuilder import FontBuilder
from fontTools.otlLib.builder import buildStatTable
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import ttProgram
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates, flagOnCurve, flagOverlapSimple
from fontTools.varLib import build as build_variable
from fontTools.varLib import instancer

FAMILY = 'Nout Sans'
VERSION = '1.000'
UPM = 1000
X, CAP, ASC, DESC = 510, 700, 745, -190
OS = 10  # lo redondo se pasa un poco de la línea: si no, parece más bajo
OSC = 12
ASCENT, DESCENT = 960, -240  # caja de línea: centra las mayúsculas y deja sitio a las tildes
MATH = 315  # eje de los signos matemáticos
DASH = 248  # eje de los guiones
SOFT = 0.62  # esquina del remate, en fracción del medio trazo
STEP = 45.0  # grados por curva cuadrática
WEIGHTS = {300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold'}
SIDES = {'s': 68, 'r': 40, 'd': 12, 't': 26, 'c': 84, 'o': 46, 'n': 34, 'z': 30, 'p': 50}


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def norm(x, y):
    d = math.hypot(x, y) or 1.0
    return x / d, y / d


def polar(a):
    r = math.radians(a)
    return math.cos(r), math.sin(r)


# ───────── Segmentos del esqueleto ─────────

def line(x0, y0, x1, y1):
    return ('L', (x0, y0), (x1, y1))


def arc(cx, cy, rx, ry, a0, a1):
    return ('A', cx, cy, rx, ry, a0, a1)


def bez(p0, c0, c1, p1, spans=3):
    return ('B', p0, c0, c1, p1, spans)


def spans_of(seg):
    """Tramos de un segmento, cada uno con tres muestras (punto, tangente). También dice si es recto."""
    if seg[0] == 'L':
        (x0, y0), (x1, y1) = seg[1], seg[2]
        t = norm(x1 - x0, y1 - y0)
        return [[((x0, y0), t), (((x0 + x1) / 2, (y0 + y1) / 2), t), ((x1, y1), t)]], True
    if seg[0] == 'A':
        _, cx, cy, rx, ry, a0, a1 = seg
        n = max(1, math.ceil(abs(a1 - a0) / STEP - 1e-6))
        sign = 1 if a1 > a0 else -1

        def at(a):
            c, s = polar(a)
            return (cx + rx * c, cy + ry * s), norm(-rx * s * sign, ry * c * sign)
        return [[at(lerp(a0, a1, (i + f) / n)) for f in (0, 0.5, 1)] for i in range(n)], False
    _, p0, c0, c1, p1, n = seg

    def at_bez(t):
        u = 1 - t
        p = tuple(u ** 3 * p0[k] + 3 * u * u * t * c0[k] + 3 * u * t * t * c1[k] + t ** 3 * p1[k] for k in (0, 1))
        d = tuple(3 * u * u * (c0[k] - p0[k]) + 6 * u * t * (c1[k] - c0[k]) + 3 * t * t * (p1[k] - c1[k]) for k in (0, 1))
        return p, norm(*d)
    return [[at_bez((i + f) / n) for f in (0, 0.5, 1)] for i in range(n)], False


def chain(side, straight, modulated, reverse=False):
    """Comandos a lo largo de un lado del trazo. Lo recto solo es línea si el ancho no cambia."""
    cmds = []
    for i in (range(len(side) - 1, -1, -1) if reverse else range(len(side))):
        p0, pm, p1 = side[i][::-1] if reverse else side[i]
        if straight[i] and not modulated:
            cmds.append(('L', p1))
        else:
            cmds.append(('Q', (2 * pm[0] - (p0[0] + p1[0]) / 2, 2 * pm[1] - (p0[1] + p1[1]) / 2), p1))
    return cmds


def closed_contour(cmds):
    """El último comando vuelve al primer punto: en TrueType ese punto no se repite."""
    last = cmds[-1]
    return cmds[:-1] + ([('C', last[1])] if last[0] == 'Q' else [])


def transform(contours, fn):
    out = []
    for cmds in contours:
        moved = []
        for c in cmds:
            moved.append((c[0], *[fn(p) for p in c[1:]]))
        out.append(moved)
    return out


def shift(contours, dx=0.0, dy=0.0):
    return transform(contours, lambda p: (p[0] + dx, p[1] + dy))


def turned(contours, cx, cy):
    """Media vuelta alrededor de (cx, cy): ¿ de ?, 9 de 6. Conserva el sentido de los contornos."""
    return transform(contours, lambda p: (2 * cx - p[0], 2 * cy - p[1]))


def scaled(contours, k):
    return transform(contours, lambda p: (p[0] * k, p[1] * k))


class Pen:
    """La pluma de un maestro: a, medio ancho (lo que engorda una vertical); b, medio alto."""

    def __init__(self, wght):
        k = (wght - 300) / 400
        self.a = lerp(28.0, 64.0, k)
        self.b = lerp(25.5, 52.0, k)

    def support(self, nx, ny, s=1.0):
        d = math.sqrt((self.a * nx) ** 2 + (self.b * ny) ** 2) or 1.0
        return s * self.a * self.a * nx / d, s * self.b * self.b * ny / d

    def half_h(self, dx, dy):
        """Medio ancho, medido en horizontal, de una diagonal cortada en horizontal."""
        tx, ty = norm(dx, dy)
        qx, qy = self.support(-ty, tx)
        return abs(qx - qy * tx / (ty or 1e-6))

    def cap(self, kind, p, t, l_end, r_end, is_line):
        """Remate en un extremo que avanza hacia `t`, de la cadena izquierda a la derecha. Devuelve dónde
        terminan las dos cadenas (lo recto se recorta hasta el remate) y los comandos que las unen.
        kind: soft, butt, soft-h, butt-h (corte horizontal), soft-v (vertical)."""
        soft = kind.startswith('soft')
        plane = kind.split('-')[1] if '-' in kind else None
        r = SOFT * math.dist(l_end, r_end) / 2 if soft else 0.0
        if plane or is_line:
            n = (0.0, 1.0) if plane == 'h' else (1.0, 0.0) if plane == 'v' else t
            den = (t[0] * n[0] + t[1] * n[1]) or 1e-6

            def corner(q):
                u = ((p[0] - q[0]) * n[0] + (p[1] - q[1]) * n[1]) / den
                return q[0] + t[0] * u, q[1] + t[1] * u
            cl, cr = corner(l_end), corner(r_end)
            l_at = (cl[0] - t[0] * r, cl[1] - t[1] * r)
            r_at = (cr[0] - t[0] * r, cr[1] - t[1] * r)
        else:
            # En una curva el remate continúa la tangente.
            cl = (l_end[0] + t[0] * r, l_end[1] + t[1] * r)
            cr = (r_end[0] + t[0] * r, r_end[1] + t[1] * r)
            l_at, r_at = l_end, r_end
        if not soft:
            return l_at, r_at, [('L', r_at)]
        ax, ay = norm(cr[0] - cl[0], cr[1] - cl[1])
        return l_at, r_at, [('Q', cl, (cl[0] + ax * r, cl[1] + ay * r)), ('L', (cr[0] - ax * r, cr[1] - ay * r)), ('Q', cr, r_at)]

    def stroke(self, segs, cap0='soft', cap1='soft', t0=None, t1=None, fn=None, k=1.0, closed=False):
        """Contornos de un trazo. t0/t1 = (factor, largo): adelgaza el principio o el final; fn(u) escala
        a lo largo (u de 0 a 1); k, el trazo entero."""
        spans, straight, marks = [], [], []
        total = 0.0
        for seg in segs:
            parts, is_line = spans_of(seg)
            for sp in parts:
                d0 = math.dist(sp[0][0], sp[1][0])
                d1 = math.dist(sp[1][0], sp[2][0])
                spans.append(sp)
                straight.append(is_line)
                marks.append((total, total + d0, total + d0 + d1))
                total += d0 + d1

        def width(d):
            s = k
            if t0:
                s *= lerp(t0[0], 1.0, smoothstep(d / t0[1]))
            if t1:
                s *= lerp(t1[0], 1.0, smoothstep((total - d) / t1[1]))
            if fn:
                s *= fn(d / (total or 1.0))
            return s

        left, right = [], []
        for sp, ds in zip(spans, marks):
            ls, rs = [], []
            for (p, t), d in zip(sp, ds):
                qx, qy = self.support(-t[1], t[0], width(d))
                ls.append((p[0] + qx, p[1] + qy))
                rs.append((p[0] - qx, p[1] - qy))
            left.append(ls)
            right.append(rs)
        modulated = bool(t0 or t1 or fn)

        if closed:
            # Se recorre en sentido horario: la izquierda es el contorno de fuera; la derecha, el hueco.
            outer = [('M', left[0][0])] + chain(left, straight, modulated)
            inner = [('M', right[-1][2])] + chain(right, straight, modulated, True)
            return [closed_contour(outer), closed_contour(inner)]

        end_p, end_t = spans[-1][2]
        l1, r1, cap_end = self.cap(cap1, end_p, end_t, left[-1][2], right[-1][2], straight[-1])
        start_p, start_t = spans[0][0]
        r0, l0, cap_start = self.cap(cap0, start_p, (-start_t[0], -start_t[1]), right[0][0], left[0][0], straight[0])
        left[0][0], left[-1][2], right[-1][2], right[0][0] = l0, l1, r1, r0
        # Sentido horario: izquierda hacia delante, remate, derecha de vuelta, remate.
        return [closed_contour([('M', l0)] + chain(left, straight, modulated) + cap_end + chain(right, straight, modulated, True) + cap_start)]

    def dot(self, cx, cy, r):
        n = 6
        ring = [[(cx + r * c, cy + r * s) for c, s in (polar(90 - (i + f) * 360 / n) for f in (0, 0.5, 1))] for i in range(n)]
        cmds = [('M', ring[0][0])]
        for p0, pm, p1 in ring:
            cmds.append(('Q', (2 * pm[0] - (p0[0] + p1[0]) / 2, 2 * pm[1] - (p0[1] + p1[1]) / 2), p1))
        return [closed_contour(cmds)]


@dataclass
class Rec:
    contours: list  # con x = 0 en el borde izquierdo de la tinta
    width: float
    lb: float
    rb: float
    mid: float  # centro de las tildes
    top: float  # altura sobre la que se apoyan


# ───────── El alfabeto ─────────

class Face:
    """Todas las letras en un maestro."""

    def __init__(self, wght, digits_only=False):
        self.wght = wght
        self.pen = Pen(wght)
        self.a, self.b = self.pen.a, self.pen.b
        self.glyphs = {}
        self.tight = (self.a - 37) * 0.35  # con peso, los lados ceden y el color se mantiene parejo
        self._digits()
        if digits_only:
            return
        self._lowercase()
        self._uppercase()
        self._extra_letters()
        self._punctuation()
        self._symbols()
        self._spacing_marks()
        self._accents()

    def wid(self, n):
        return n + (self.a - 37) * 1.15

    def add(self, name, contours, width, left='s', right='s', mid=None, top=None, sides=None):
        lb, rb = sides if sides else (SIDES[left] - self.tight, SIDES[right] - self.tight)
        self.glyphs[name] = Rec(contours, width, lb, rb, width / 2 if mid is None else mid, top)

    def raw(self, name):
        return self.glyphs[name].contours

    def w(self, name):
        return self.glyphs[name].width

    def s(self, *segs, **kw):
        return self.pen.stroke(list(segs), **kw)

    def stem(self, x, y0, y1, **kw):
        return self.s(line(x, y0, x, y1), **kw)

    def bar(self, x0, x1, y, **kw):
        return self.s(line(x0, y, x1, y), **kw)

    def ell(self, cx, cy, rx, ry, fn=None, k=1.0):
        return self.pen.stroke([arc(cx, cy, rx, ry, 90, -270)], closed=True, fn=fn, k=k)

    def diag(self, x0, y0, x1, y1, cap0='soft-h', cap1='soft-h', **kw):
        return self.s(line(x0, y0, x1, y1), cap0=cap0, cap1=cap1, **kw)

    def ess(self, width, top, bot, k=0.955, term0=34, term1=214, narrow=0.94):
        """La s: dos arcos unidos por una recta tangente a los dos, el lomo inclinado."""
        a, b = self.a, self.b
        cx = width / 2
        r2 = width / 2 - a
        r1 = r2 * narrow
        height = (top - b) - (bot + b)
        e = height / ((r1 + r2) * (1 + 1 / k))
        y1 = top - b - e * r1
        y2 = bot + b + e * r2
        th = 180 + math.degrees(math.asin(k))
        ph = th - 180
        c1, s1 = polar(th)
        c2, s2 = polar(ph)
        return self.s(arc(cx, y1, r1, e * r1, term0, th), line(cx + r1 * c1, y1 + e * r1 * s1, cx + r2 * c2, y2 + e * r2 * s2), arc(cx, y2, r2, e * r2, ph, term1 - 360))

    def arch(self, x0, x1, foot=0.0, start=166, end=0):
        """Arco que sale del asta adelgazado y baja hasta `foot`."""
        rx = (x1 - x0) / 2
        ry = rx * 0.98
        cx = (x0 + x1) / 2
        cy = X + OS - self.b - ry
        return self.s(arc(cx, cy, rx, ry, start, end), line(x1, cy, x1, foot), cap0='butt', t0=(0.56, rx * 1.25))

    def vee(self, width, top, bottom, thin=0.6):
        """Dos diagonales que se juntan en un vértice estrecho: hacia él adelgazan."""
        h = self.pen.half_h(width / 2, top - bottom)
        length = math.hypot(width / 2 - h, top - bottom)
        return self.diag(h, top, width / 2, bottom, t1=(thin, length * 0.55)) + self.diag(width - h, top, width / 2, bottom, t1=(thin, length * 0.55))

    def double_vee(self, width, top):
        h = self.pen.half_h(width / 4, top)
        q1, q3 = width * 0.285, width * 0.715
        length = math.hypot(width * 0.25, top)
        taper = {'t1': (0.62, length * 0.5)}
        inner = {'t0': (0.66, length * 0.4), 'cap0': 'butt-h', **taper}
        return (self.diag(h, top, q1, 0, **taper) + self.diag(width / 2, top * 0.9, q1, 0, **inner)
                + self.diag(width / 2, top * 0.9, q3, 0, **inner) + self.diag(width - h, top, q3, 0, **taper))

    def _lowercase(self):
        a, b, wid = self.a, self.b, self.wid
        add, s, stem, bar, ell, diag, pen = self.add, self.s, self.stem, self.bar, self.ell, self.diag, self.pen

        # Cuencos de a, b, d, g, o, p, q: se adelgazan donde tocan el asta.
        w = wid(530)
        rx, ry, cx = w / 2 - a, X / 2 + OS - b, w / 2
        thin_r = lambda u: 1 - 0.34 * math.exp(-((u - 0.25) / 0.1) ** 2)
        thin_l = lambda u: 1 - 0.34 * math.exp(-((u - 0.75) / 0.1) ** 2)
        sx = w - a
        add('a', ell(cx, X / 2, rx, ry, thin_r) + stem(sx, 0, X), w, 'r', 's', mid=cx - 8)
        add('b', ell(cx, X / 2, rx, ry, thin_l) + stem(a, 0, ASC), w, 's', 'r', mid=cx + 8)
        add('d', ell(cx, X / 2, rx, ry, thin_r) + stem(sx, 0, ASC), w, 'r', 's', mid=cx - 8)
        add('p', ell(cx, X / 2, rx, ry, thin_l) + stem(a, DESC, X), w, 's', 'r', mid=cx + 8)
        add('q', ell(cx, X / 2, rx, ry, thin_r) + stem(sx, DESC, X), w, 'r', 's', mid=cx - 8)
        add('o', ell(cx, X / 2, rx, ry), w, 'r', 'r')
        add('thorn', ell(cx, X / 2, rx, ry, thin_l) + stem(a, DESC, ASC), w, 's', 'r', mid=cx + 8)
        hook_rx, hook_ry = rx * 0.9, 150.0
        hook_y = DESC + b + hook_ry - OS
        add('g', ell(cx, X / 2, rx, ry, thin_r) + s(line(sx, X, sx, hook_y), arc(sx - hook_rx, hook_y, hook_rx, hook_ry, 0, -128)), w, 'r', 's', mid=cx - 8)

        # c, e: el mismo círculo, abierto.
        c_end = 48
        cos_c = polar(c_end)[0]
        add('c', s(arc(cx, X / 2, rx, ry, c_end, 360 - c_end)), cx + rx * cos_c + a * 0.72, 'r', 't')
        # La barra de la e va inclinada, herencia del wordmark; el cuenco se abre abajo.
        e_top, e_end = 16, 46
        c_top, s_top = polar(e_top)
        e_bowl = s(arc(cx, X / 2, rx, ry, e_top, 360 - e_end), cap0='butt')
        e_bar = s(line(cx - rx + a * 0.2, X / 2 - 44, cx + rx * c_top, X / 2 + ry * s_top), cap0='butt', cap1='butt', k=0.92)
        add('e', e_bowl + e_bar, w - a * 0.1, 'r', 'r')
        self.round_w, self.round = w, (cx, X / 2, rx, ry)

        w = wid(478)
        add('n', stem(a, 0, X) + self.arch(a, w - a), w, 's', 's')
        add('h', stem(a, 0, ASC) + self.arch(a, w - a), w, 's', 's')
        wm = wid(770)
        add('m', stem(a, 0, X) + self.arch(a, wm / 2) + self.arch(wm / 2, wm - a), wm, 's', 's')
        ury = (w / 2 - a) * 0.98
        ucy = -OS + b + ury
        add('u', s(line(a, X, a, ucy), arc(w / 2, ucy, w / 2 - a, ury, 180, 346), cap1='butt', t1=(0.56, (w / 2 - a) * 1.25)) + stem(w - a, 0, X), w, 's', 's')
        rr, r_end = 148.0, 40
        add('r', stem(a, 0, X) + s(arc(a + rr, X + OS - b - rr, rr, rr, 166, r_end), cap0='butt', t0=(0.56, rr * 1.2)), a + rr + rr * polar(r_end)[0] + a * 0.7, 's', 't')

        # i, j, l, t, f: astas con su remate; la l y la t cierran con una cola corta.
        dr = a * 1.18 + 6
        dy = X + 138 + b * 0.3
        self.dot_r, self.dot_y = dr, dy
        w = 2 * max(a, dr)
        add('i', stem(w / 2, 0, X) + pen.dot(w / 2, dy, dr), w, 's', 's')
        add('dotlessi', stem(a, 0, X), 2 * a, 's', 's')
        jr = 118.0
        jx = jr * 1.42 + a
        jy = DESC + b + jr - OS
        j_tail = s(line(jx, X, jx, jy), arc(jx - jr, jy, jr, jr, 0, -115))
        side = (-34 - self.tight, SIDES['s'] - self.tight)
        add('j', j_tail + pen.dot(jx, dy, dr), jx + dr, mid=jx, sides=side)
        add('dotlessj', j_tail, jx + a, mid=jx, sides=side)
        lr, l_end = 78.0, 292
        add('l', s(line(a, ASC, a, lr + b - OS), arc(a + lr, lr + b - OS, lr, lr, 180, l_end)), a + lr + lr * polar(l_end)[0] + a * 0.5, 's', 'n', mid=a)
        tx, tr, t_end = a + 46, 88.0, 292
        t_right = tx + a + 104
        add('t', bar(tx - a - 34 + b, t_right, X - b, k=0.94) + s(line(tx, X + 158, tx, tr + b - OS), arc(tx + tr, tr + b - OS, tr, tr, 180, t_end)),
            max(t_right + b * 0.5, tx + tr + tr * polar(t_end)[0] + a * 0.5), 'n', 'n', mid=tx)
        fx, fr, f_end = a + 58, 104.0, 62
        f_right = fx + a + 96
        add('f', bar(fx - a - 34 + b, f_right, X - b, k=0.94) + s(line(fx, 0, fx, ASC + OS - b - fr), arc(fx + fr, ASC + OS - b - fr, fr, fr, 180, f_end)),
            max(f_right + b * 0.5, fx + fr + fr * polar(f_end)[0] + a * 0.3), mid=fx, sides=(SIDES['n'] - self.tight, 14 - self.tight))

        # Diagonales: corte horizontal.
        w = wid(470)
        add('v', self.vee(w, X, 0), w, 'd', 'd')
        w = wid(740)
        add('w', self.double_vee(w, X), w, 'd', 'd')
        w = wid(460)
        h = pen.half_h(w, X)
        add('x', diag(h, X, w - h, 0) + diag(w - h, X, h, 0, k=0.96), w, 'd', 'd')
        w = wid(474)
        h = pen.half_h(w / 2, X)
        length = math.hypot(w / 2 - h, X)
        tail_x = w / 2 - (w / 2 - h) * (-DESC / X)
        add('y', diag(w - h, X, tail_x, DESC) + diag(h, X, w / 2, 0, t1=(0.58, length * 0.55), cap1='butt-h'), w, 'd', 'd')
        w = wid(424)
        h = pen.half_h(w, X)
        add('z', bar(b * 0.5, w - b * 0.5, X - b, k=0.96) + bar(b * 0.5, w - b * 0.5, b, k=0.96) + diag(w - h - a * 0.2, X - b * 0.7, h + a * 0.2, b * 0.7, cap0='butt-h', cap1='butt-h', k=0.96), w, 'z', 'z')
        w = wid(446)
        kx = w - pen.half_h(w, X)
        ky = X * 0.37
        add('k', stem(a, 0, ASC) + diag(kx, X, a * 1.2, ky, cap1='butt', t1=(0.62, 120)) + diag(kx + 8, 0, a + (kx - a) * 0.3, ky + (X - ky) * 0.3, cap1='butt', t1=(0.7, 90)), w, 's', 'd')
        w = wid(420)
        add('s', self.ess(w, X + OS, -OS), w, 'n', 'n')

    def _uppercase(self):
        a, b, wid = self.a, self.b, self.wid
        add, s, stem, bar, ell, diag, pen = self.add, self.s, self.stem, self.bar, self.ell, self.diag, self.pen

        # Proporción clásica: la O casi un círculo; la E, la L y la S, estrechas.
        ow = wid(760)
        orx, ory, ocx = ow / 2 - a, CAP / 2 + OSC - b, ow / 2
        self.big = (ow, ocx, orx, ory)
        add('O', ell(ocx, CAP / 2, orx, ory), ow, 'o', 'o')
        add('Q', ell(ocx, CAP / 2, orx, ory) + diag(ow * 0.6, 170, ow - 16, -60, cap0='butt'), ow, 'o', 'o')
        c_end = 46
        add('C', s(arc(ocx, CAP / 2, orx, ory, c_end, 360 - c_end)), ocx + orx * polar(c_end)[0] + a * 0.7, 'o', 't')
        g_y = CAP / 2 + ory * polar(-5)[1]
        add('G', s(arc(ocx, CAP / 2, orx, ory, c_end, 355), cap1='butt') + bar(ocx + 20, ocx + orx + a * 0.5, g_y + 8, cap1='butt', k=0.94), ocx + orx + a, 'o', 's')
        w = wid(640)
        add('H', stem(a, 0, CAP) + stem(w - a, 0, CAP) + bar(a, w - a, CAP / 2 + 12, cap0='butt', cap1='butt', k=0.94), w, 'c', 'c')
        add('I', stem(a, 0, CAP), 2 * a, 'c', 'c')
        w = wid(346)
        jrx, jry = w / 2 + 34 - a, 182.0
        jcy = -OSC + b + jry
        add('J', s(line(w - a, CAP, w - a, jcy), arc(w - a - jrx, jcy, jrx, jry, 0, -150)), w, 'n', 'c', mid=w - a)
        w = wid(440)
        add('E', stem(a, 0, CAP) + bar(a, w - b * 0.3, CAP - b, cap0='butt', k=0.96) + bar(a, w - 30 - b * 0.3, CAP / 2 + 12, cap0='butt', k=0.94) + bar(a, w - b * 0.3, b, cap0='butt', k=0.96), w, 'c', 'n')
        w = wid(420)
        add('F', stem(a, 0, CAP) + bar(a, w - b * 0.3, CAP - b, cap0='butt', k=0.96) + bar(a, w - 34 - b * 0.3, CAP / 2 + 6, cap0='butt', k=0.94), w, 'c', 'n')
        w = wid(400)
        add('L', stem(a, 0, CAP) + bar(a, w - b * 0.3, b, cap0='butt', k=0.96), w, 'c', 'n')
        w = wid(510)
        add('T', stem(w / 2, 0, CAP - b) + bar(b * 0.3, w - b * 0.3, CAP - b, k=0.96), w, 'n', 'n')
        w = wid(600)
        ucy = -OSC + b + (w / 2 - a)
        add('U', s(line(a, CAP, a, ucy), arc(w / 2, ucy, w / 2 - a, w / 2 - a, 180, 360), line(w - a, ucy, w - a, CAP)), w, 'c', 'c')

        def bowl(top, bottom, x1):
            """Cuenco de B, D, P, R: dos rectas y un arco, cerrado contra el asta."""
            r = (top - bottom) / 2
            return s(line(a, top, x1, top), arc(x1, (top + bottom) / 2, r, r, 90, -90), line(x1, bottom, a, bottom), cap0='butt', cap1='butt', k=0.97)
        w = wid(630)
        dr = CAP / 2 - b
        add('D', stem(a, 0, CAP) + bowl(CAP - b, b, w - a - dr), w, 'c', 'o')
        w = wid(500)
        pr = 190.0
        self.bowl, self.p_r = bowl, pr
        add('P', stem(a, 0, CAP) + bowl(CAP - b, CAP - b - 2 * pr, w - a - pr), w, 'c', 'r')
        add('Thorn', stem(a, 0, CAP) + bowl(CAP - b - 130, CAP - b - 130 - 2 * pr, w - a - pr), w, 'c', 'r')
        w = wid(528)
        leg = CAP - b - 2 * pr
        add('R', stem(a, 0, CAP) + bowl(CAP - b, leg, w - a - pr - 14) + diag(w * 0.5, leg + b * 0.2, w - pen.half_h(w * 0.4, leg), 0, cap0='butt-h'), w, 'c', 'd')
        w = wid(520)
        tr = 158.0
        split = CAP - b - 2 * tr
        lr = (split - b) / 2
        add('B', stem(a, 0, CAP) + bowl(CAP - b, split, w - a - tr - 26) + bowl(split, b, w - a - lr), w, 'c', 'r')
        w = wid(680)
        h = pen.half_h(w / 2, CAP)
        length = math.hypot(w / 2, CAP)
        cross = CAP * 0.29
        inset = lerp(h, w / 2, cross / CAP)
        add('A', diag(h, 0, w / 2, CAP, t1=(0.62, length * 0.45)) + diag(w - h, 0, w / 2, CAP, t1=(0.62, length * 0.45)) + bar(inset + a * 0.2, w - inset - a * 0.2, cross, cap0='butt', cap1='butt', k=0.92), w, 'd', 'd')
        w = wid(650)
        add('V', self.vee(w, CAP, 0), w, 'd', 'd')
        w = wid(990)
        add('W', self.double_vee(w, CAP), w, 'd', 'd')
        w = wid(620)
        h = pen.half_h(w, CAP)
        add('X', diag(h, CAP, w - h, 0) + diag(w - h, CAP, h, 0, k=0.96), w, 'd', 'd')
        w = wid(600)
        h = pen.half_h(w / 2, CAP * 0.56)
        fork = CAP * 0.42
        length = math.hypot(w / 2, CAP - fork)
        add('Y', stem(w / 2, 0, fork + b, cap1='butt') + diag(h, CAP, w / 2, fork, cap1='butt', t1=(0.66, length * 0.45)) + diag(w - h, CAP, w / 2, fork, cap1='butt', t1=(0.66, length * 0.45)), w, 'd', 'd')
        w = wid(560)
        h = pen.half_h(w, CAP)
        add('Z', bar(b * 0.3, w - b * 0.3, CAP - b, k=0.96) + bar(b * 0.3, w - b * 0.3, b, k=0.96) + diag(w - h - a * 0.2, CAP - b * 0.7, h + a * 0.2, b * 0.7, cap0='butt-h', cap1='butt-h', k=0.96), w, 'z', 'z')
        w = wid(556)
        ky = CAP * 0.42
        kx = w - pen.half_h(w, CAP)
        add('K', stem(a, 0, CAP) + diag(kx, CAP, a * 1.2, ky, cap1='butt', t1=(0.62, 150)) + diag(kx + 10, 0, a + (kx - a) * 0.31, ky + (CAP - ky) * 0.31, cap1='butt', t1=(0.7, 120)), w, 'c', 'd')
        w = wid(800)
        h = pen.half_h(w / 2 - a, CAP)
        length = math.hypot(w / 2 - a, CAP)
        taper = {'t0': (0.72, length * 0.3), 't1': (0.62, length * 0.5), 'cap0': 'butt-h'}
        add('M', stem(a, 0, CAP) + stem(w - a, 0, CAP) + diag(a + h * 0.3, CAP, w / 2, 0, **taper) + diag(w - a - h * 0.3, CAP, w / 2, 0, **taper), w, 'c', 'c')
        w = wid(660)
        h = pen.half_h(w - 2 * a, CAP)
        length = math.hypot(w - 2 * a, CAP)
        add('N', stem(a, 0, CAP) + stem(w - a, 0, CAP) + diag(a + h * 0.3, CAP, w - a - h * 0.3, 0, t0=(0.72, length * 0.3), t1=(0.72, length * 0.3), cap0='butt-h', cap1='butt-h'), w, 'c', 'c')
        w = wid(500)
        add('S', self.ess(w, CAP + OSC, -OSC, term0=36, term1=216), w, 'n', 'n')

    def _extra_letters(self):
        a, b, wid = self.a, self.b, self.wid
        add, s, stem, bar, ell, diag, pen = self.add, self.s, self.stem, self.bar, self.ell, self.diag, self.pen
        raw, width = self.raw, self.w
        cx, cy, rx, ry = self.round
        rw = self.round_w
        ow, ocx, orx, ory = self.big
        thin_r = lambda u: 1 - 0.34 * math.exp(-((u - 0.25) / 0.1) ** 2)

        # Ligaduras: la a o la o se montan sobre la e.
        add('ae', raw('a') + shift(raw('e'), dx=rw - a * 2.3), rw - a * 2.3 + width('e'), 'r', 'r')
        add('oe', raw('o') + shift(raw('e'), dx=rw - a * 1.5), rw - a * 1.5 + width('e'), 'r', 'r')
        w = wid(900)
        e_x = w * 0.46
        add('AE', (diag(pen.half_h(e_x, CAP), 0, e_x + a * 0.5, CAP, t1=(0.7, 300)) + bar(e_x * 0.4, e_x + a, CAP * 0.29, cap0='butt', cap1='butt', k=0.92) + stem(e_x + a * 1.2, 0, CAP, cap1='butt')
                   + bar(e_x + a * 0.5, w - b * 0.3, CAP - b, cap0='butt', k=0.96) + bar(e_x + a * 1.2, w - 30 - b * 0.3, CAP / 2 + 12, cap0='butt', k=0.94) + bar(e_x + a * 1.2, w - b * 0.3, b, cap0='butt', k=0.96)), w, 'd', 'n')
        w = ow + wid(320)
        add('OE', (raw('O') + stem(ocx + 150, 0, CAP) + bar(ocx + 150, w - b * 0.3, CAP - b, cap0='butt', k=0.96)
                   + bar(ocx + 150, w - 30 - b * 0.3, CAP / 2 + 12, cap0='butt', k=0.94) + bar(ocx + 150, w - b * 0.3, b, cap0='butt', k=0.96)), w, 'o', 'n')

        # Letras con raya: la raya es un trazo más sobre la letra base.
        slash = lambda w_, top: diag(w_ * 0.86, top + 28, w_ * 0.14, -28, cap0='soft', cap1='soft', k=0.82)
        add('oslash', raw('o') + slash(rw, X), rw, 'r', 'r')
        add('Oslash', raw('O') + slash(ow, CAP), ow, 'o', 'o')
        dw = width('D')
        add('Eth', raw('D') + bar(-30, 200, CAP / 2, k=0.9), dw, 'c', 'o')
        add('Dcroat', raw('D') + bar(-30, 200, CAP / 2, k=0.9), dw, 'c', 'o')
        add('dcroat', raw('d') + bar(rw - a - 130, rw + 30, ASC - 130, k=0.86), rw, 'r', 'n', mid=cx - 8)
        add('hbar', raw('h') + bar(-24, a + 120, ASC - 130, k=0.86), width('h'), 'n', 's')
        add('Hbar', raw('H') + bar(-30, width('H') + 30, CAP - 165, k=0.86), width('H'), 'n', 'n')
        add('lslash', raw('l') + diag(-44, 300, a + 92, 440, cap0='soft', cap1='soft', k=0.82), width('l'), 'n', 'n', mid=a)
        add('Lslash', raw('L') + diag(-44, 270, a + 130, 450, cap0='soft', cap1='soft', k=0.82), width('L'), 'n', 'n')
        add('Tbar', raw('T') + bar(width('T') / 2 - 120, width('T') / 2 + 120, CAP / 2, k=0.86), width('T'), 'n', 'n')
        add('tbar', raw('t') + bar(0, width('t') * 0.92, 190, k=0.84), width('t'), 'n', 'n', mid=a + 46)
        # Las que no son una base más un signo.
        eth_tail = s(bez((cx + rx * 0.93, X * 0.72), (cx + rx * 0.8, ASC * 0.95), (cx - 20, ASC + 10), (cx - 130, ASC + 10)), cap0='butt')
        add('eth', raw('o') + eth_tail + diag(cx - 70, ASC - 150, cx + 150, ASC - 34, cap0='soft', cap1='soft', k=0.84), rw, 'r', 'r')
        w = wid(520)
        top_r = 150.0
        ss_stem = stem(a, 0, ASC - top_r, cap1='butt')
        ss_top = s(arc(a + top_r, ASC + OS - b - top_r, top_r, top_r, 180, 16), bez((a + top_r + top_r * polar(16)[0], ASC + OS - b - top_r + top_r * polar(16)[1]), (a + 2.05 * top_r, ASC - 240), (a + 1.6 * top_r, ASC - 300), (a + 100, ASC - 306)), cap0='butt', cap1='butt')
        ss_low = s(bez((a + 100, ASC - 306), (w - a + 16, ASC - 306), (w - a + 10, 34 + b), (a + 120, b)), cap0='butt')
        add('germandbls', ss_stem + ss_top + ss_low, w, 's', 'r')
        add('mu', stem(a, DESC, X) + raw('u'), width('u'), 's', 's')

    def _digits(self):
        a, b, wid = self.a, self.b, self.wid
        add, s, stem, bar, ell, diag, pen = self.add, self.s, self.stem, self.bar, self.ell, self.diag, self.pen
        D = CAP
        tab = wid(600)  # cifras tabulares: todas de este ancho

        def num(name, contours, width, left='n', right='n'):
            add(name, contours, width, left, right)
            lb = (tab - width) / 2
            self.glyphs[name + '.tf'] = Rec(contours, width, lb, tab - width - lb, width / 2, None)

        w = wid(540)
        num('zero', ell(w / 2, D / 2, w / 2 - a, D / 2 + OS - b), w, 'r', 'r')
        w = wid(250)
        sx = w - a
        num('one', stem(sx, 0, D) + diag(b * 0.3, D - 148, sx - a * 0.1, D - b * 0.3, cap1='butt', t1=(0.74, 100), k=0.96), w, 'n', 's')
        w = wid(490)
        r = w / 2 - a
        top = D + OS - b - r
        low = b + 8
        c30, s30 = polar(-30)
        p30 = (w / 2 + r * c30, top + r * s30)
        tan30 = (s30, -c30)
        num('two', s(arc(w / 2, top, r, r, 168, -30), bez(p30, (p30[0] + tan30[0] * 80, p30[1] + tan30[1] * 80), (a * 1.4 + 120, low + (p30[1] - low) * 0.34), (a * 0.9, low + 2)), cap1='butt-h') + bar(b * 0.3, w - b * 0.3, b, k=0.96), w, 'n', 'n')
        w = wid(480)
        r1 = 158.0
        split = D + OS - b - 2 * r1
        r2 = (split + OS - b) / 2
        rx2 = w / 2 - a
        num('three', s(arc(w / 2 - 6, D + OS - b - r1, rx2 * 0.9, r1, 156, -90), cap1='butt') + s(arc(w / 2 - 6, split - r2, rx2 + 6, r2, 90, -158), cap0='butt') + bar(w * 0.36, w / 2 - 2, split, cap0='butt', cap1='butt', k=0.92), w, 'n', 'r')
        w = wid(556)
        sx = w - a - 72
        length = math.hypot(sx, D)
        num('four', stem(sx, 0, D) + diag(sx, D - b * 0.2, pen.half_h(sx, D) * 0.6, 196, cap0='butt-h', cap1='butt-h', t0=(0.7, length * 0.3)) + bar(b * 0.2, w - b * 0.3, 196 - b * 0.1, k=0.94), w, 'z', 'z')
        w = wid(490)
        rb = 214.0
        cb = rb + b - OS
        num('five', bar(a * 2.2, w - 30 - b * 0.3, D - b, cap0='butt', k=0.96) + s(line(a * 1.7, D - b * 0.6, a * 1.05, cb + rb * 0.46), cap0='butt-h', cap1='butt', k=0.98) + s(arc(w / 2 - 6, cb, w / 2 - a + 8, rb, 142, -152), cap0='butt'), w, 'n', 'r')
        w = wid(520)
        r = w / 2 - a
        cy = r + b - OS
        six = ell(w / 2, cy, r, r) + s(line(w * 0.68, D, a * 1.2, cy + r * 0.28), cap0='soft-h', cap1='butt', t1=(0.88, 80))
        num('six', six, w, 'r', 'r')
        num('nine', turned(six, w / 2, D / 2), w, 'r', 'r')
        w = wid(480)
        num('seven', bar(b * 0.3, w - b * 0.3, D - b, k=0.96) + diag(w - pen.half_h(w * 0.7, D) - a * 0.3, D - b * 0.7, w * 0.26, 0, cap0='butt-h'), w, 'n', 'd')
        w = wid(510)
        r1 = 158.0
        rx2 = w / 2 - a
        r2 = (D + 2 * OS - 2 * b - 2 * r1) / 2 + b * 0.5
        num('eight', ell(w / 2, D + OS - b - r1, rx2 * 0.86, r1) + ell(w / 2, r2 + b - OS, rx2, r2), w, 'r', 'r')

    def _punctuation(self):
        a, b, wid = self.a, self.b, self.wid
        add, s, stem, bar, diag, pen = self.add, self.s, self.stem, self.bar, self.diag, self.pen
        r = a * 1.2 + 6
        self.punct_r = r
        none = (0.0, 0.0)
        add('space', [], 240 + (a - 37) * 0.4, sides=none)
        add('uni00A0', [], 240 + (a - 37) * 0.4, sides=none)
        add('period', pen.dot(r, r, r), 2 * r, 'p', 'p')

        def tick(x, y, drop=196, lean=46, k=1.0):
            """Coma y comillas: un trazo corto, inclinado, que adelgaza al caer."""
            return s(line(x + lean / 2, y, x - lean / 2, y - drop), t1=(0.72, drop), k=k)
        add('comma', tick(r, r * 1.5, 170, 42, 1.04), 2 * r, 'p', 'p')
        add('colon', pen.dot(r, r, r) + pen.dot(r, X - r, r), 2 * r, 'p', 'p')
        add('semicolon', tick(r, r * 1.5, 170, 42, 1.04) + pen.dot(r, X - r, r), 2 * r, 'p', 'p')
        exclam = stem(r, 190 + b, CAP, t0=(0.82, 300)) + pen.dot(r, r, r)
        add('exclam', exclam, 2 * r, 'p', 'p')
        add('exclamdown', shift(turned(exclam, r, CAP / 2), dy=-190), 2 * r, 'p', 'p')
        w = wid(400)
        qr = w / 2 - a
        qy = CAP + OSC - b - qr
        c46, s46 = polar(-46)
        qm = s(arc(w / 2, qy, qr, qr, 170, -46), bez((w / 2 + qr * c46, qy + qr * s46), (w / 2 + 12, qy - qr - 26), (w / 2, qy - qr - 40), (w / 2, 250 + b))) + pen.dot(w / 2, r, r)
        add('question', qm, w, 'n', 'n')
        add('questiondown', shift(turned(qm, w / 2, CAP / 2), dy=-190), w, 'n', 'n')
        add('hyphen', bar(b * 0.3, 216, DASH, k=0.92), 216 + b * 0.3, 'p', 'p')
        add('uni00AD', self.raw('hyphen'), self.w('hyphen'), 'p', 'p')
        add('endash', bar(0, 500, DASH, k=0.92), 500, sides=(26, 26))
        add('emdash', bar(0, 900, DASH, k=0.92), 900, sides=(50, 50))
        add('underscore', bar(0, 520, -96, k=0.86), 520, sides=none)
        add('quotesingle', stem(a, CAP - 210, CAP, t0=(0.74, 120)), 2 * a, 'p', 'p')
        add('quotedbl', stem(a, CAP - 210, CAP, t0=(0.74, 120)) + stem(3 * a + 120, CAP - 210, CAP, t0=(0.74, 120)), 120 + 4 * a, 'p', 'p')
        q = r + 6  # eje de la comilla
        q_w = 2 * q
        apos = lambda dx, dy: shift(tick(q, 0), dx=dx, dy=dy)
        open_q = lambda dx, dy: shift(turned(tick(q, 0), q, -98), dx=dx, dy=dy - 196)
        step = q_w + 42
        add('quoteleft', open_q(0, CAP + 8), q_w, 'p', 'p')
        add('quoteright', apos(0, CAP + 8), q_w, 'p', 'p')
        add('quotesinglbase', apos(0, r * 1.3), q_w, 'p', 'p')
        add('quotedblleft', open_q(0, CAP + 8) + open_q(step, CAP + 8), q_w + step, 'p', 'p')
        add('quotedblright', apos(0, CAP + 8) + apos(step, CAP + 8), q_w + step, 'p', 'p')
        add('quotedblbase', apos(0, r * 1.3) + apos(step, r * 1.3), q_w + step, 'p', 'p')

        def chev(dx=0.0):
            return shift(s(line(180 + a, 370, a, 250), cap1='butt') + s(line(180 + a, 130, a, 250), cap1='butt'), dx=dx)
        cw = 180 + 2 * a
        add('guilsinglleft', chev(), cw, 'p', 'p')
        add('guilsinglright', turned(chev(), cw / 2, 250), cw, 'p', 'p')
        dcw = cw + 150 + a
        add('guillemotleft', chev() + chev(150 + a), dcw, 'p', 'p')
        add('guillemotright', turned(chev() + chev(150 + a), dcw / 2, 250), dcw, 'p', 'p')
        prx, pry = 560.0, 700.0
        pw = a + prx * (1 + polar(142)[0]) + a * 0.7
        paren = s(arc(a + prx, 285, prx, pry, 142, 218), k=0.96)
        add('parenleft', paren, pw, sides=(46, 22))
        add('parenright', turned(paren, pw / 2, 285), pw, sides=(22, 46))
        add('bracketleft', stem(a, -150, 720, cap0='butt', cap1='butt') + bar(a, 200, 720 - b, cap0='butt', k=0.94) + bar(a, 200, -150 + b, cap0='butt', k=0.94), 200, sides=(60, 24))
        add('bracketright', stem(200 - a, -150, 720, cap0='butt', cap1='butt') + bar(0, 200 - a, 720 - b, cap1='butt', k=0.94) + bar(0, 200 - a, -150 + b, cap1='butt', k=0.94), 200, sides=(24, 60))
        bw = 240.0
        brace = s(bez((bw, 720 - b), (70 + a, 720 - b), (140 + a, 330), (a, 285)), cap1='butt', k=0.94) + s(bez((a, 285), (140 + a, 240), (70 + a, -150 + b), (bw, -150 + b)), cap0='butt', k=0.94)
        add('braceleft', brace, bw, sides=(46, 22))
        add('braceright', turned(brace, bw / 2, 285), bw, sides=(22, 46))
        sw = 330.0
        sl = pen.half_h(sw, 910)
        add('slash', diag(sl, -130, sw - sl, 780, k=0.92), sw, sides=(10, 10))
        add('backslash', diag(sw - sl, -130, sl, 780, k=0.92), sw, sides=(10, 10))
        add('bar', stem(a, -170, 790, k=0.86), 2 * a, sides=(112, 112))
        add('brokenbar', stem(a, -170, 240, k=0.86) + stem(a, 380, 790, k=0.86), 2 * a, sides=(112, 112))

    def _symbols(self):
        a, b, wid = self.a, self.b, self.wid
        add, s, stem, bar, ell, diag, pen = self.add, self.s, self.stem, self.bar, self.ell, self.diag, self.pen
        raw, width = self.raw, self.w
        r = self.punct_r
        w = wid(500)
        hw = (w - 2 * b) / 2
        thin = {'k': 0.94}
        add('plus', bar(0, w, MATH, **thin) + stem(w / 2, MATH - hw, MATH + hw, k=0.96), w, 'p', 'p')
        add('uni2212', bar(0, w, MATH, **thin), w, 'p', 'p')
        add('equal', bar(0, w, MATH + 90, **thin) + bar(0, w, MATH - 90, **thin), w, 'p', 'p')
        add('notequal', raw('equal') + diag(w * 0.78, MATH + 210, w * 0.22, MATH - 210, cap0='soft', cap1='soft', k=0.86), w, 'p', 'p')

        def wave(y):
            return s(bez((b * 0.2, y - 28), (w * 0.2, y + 80), (w * 0.34, y + 66), (w * 0.5, y)), bez((w * 0.5, y), (w * 0.66, y - 66), (w * 0.8, y - 80), (w - b * 0.2, y + 28)), **thin)
        add('asciitilde', wave(MATH), w, 'p', 'p')
        add('approxequal', wave(MATH + 95) + wave(MATH - 95), w, 'p', 'p')
        add('multiply', diag(w * 0.15, MATH + w * 0.35, w * 0.85, MATH - w * 0.35, cap0='soft', cap1='soft', **thin) + diag(w * 0.85, MATH + w * 0.35, w * 0.15, MATH - w * 0.35, cap0='soft', cap1='soft', **thin), w, 'p', 'p')
        add('divide', bar(0, w, MATH, **thin) + pen.dot(w / 2, MATH + 185, r * 0.92) + pen.dot(w / 2, MATH - 185, r * 0.92), w, 'p', 'p')
        add('plusminus', bar(0, w, MATH + 50, **thin) + stem(w / 2, MATH + 50 - hw * 0.8, MATH + 50 + hw * 0.8, k=0.96) + bar(0, w, 40, **thin), w, 'p', 'p')
        angle = s(line(w, MATH + 210, a, MATH), cap1='butt') + s(line(w, MATH - 210, a, MATH), cap1='butt')
        add('less', angle, w, 'p', 'p')
        add('greater', turned(angle, w / 2, MATH), w, 'p', 'p')
        add('lessequal', shift(angle, dy=60) + bar(0, w, 20, **thin), w, 'p', 'p')
        add('greaterequal', shift(turned(angle, w / 2, MATH), dy=60) + bar(0, w, 20, **thin), w, 'p', 'p')
        add('logicalnot', bar(0, w, MATH + 50, cap1='butt', **thin) + stem(w - a, MATH - 110, MATH + 50 + b * 0.6, cap1='butt'), w, 'p', 'p')
        add('asciicircum', diag(pen.half_h(160, 300), 340, w / 2, 700, t1=(0.7, 220)) + diag(w - pen.half_h(160, 300), 340, w / 2, 700, t1=(0.7, 220)), w, 'p', 'p')
        ar = 118.0
        add('asterisk', [c for i in range(5) for c in s(line(ar, CAP - ar, ar + ar * polar(90 + 72 * i)[0], CAP - ar + ar * polar(90 + 72 * i)[1]), cap0='butt', k=0.82)], 2 * ar, 'p', 'p')
        add('degree', ell(110, CAP - 110, 110 - a * 0.7, 110 - b * 0.7, k=0.7), 220, 'p', 'p')
        little = shift(ell(110, 100, 110 - a * 0.7, 100 - b * 0.7, k=0.7), dy=CAP - 200)
        add('ordmasculine', little, 220, 'p', 'p')
        add('ordfeminine', little + stem(220 - a * 0.7, CAP - 200, CAP, k=0.7), 220, 'p', 'p')
        w = wid(560)
        hx = w * 0.14
        add('numbersign', diag(w * 0.40, 660, w * 0.24, 40, k=0.92) + diag(w * 0.76, 660, w * 0.6, 40, k=0.92) + bar(hx * 0.2, w - hx * 0.2 + 20, 450, k=0.9) + bar(hx * 0.2 - 20, w - hx * 0.2, 250, k=0.9), w, 'p', 'p')
        w = wid(500)
        add('dollar', self.ess(w, CAP + OSC - 6, -OSC + 6, term0=36, term1=216) + stem(w / 2, -92, CAP + 90, k=0.82), w, 'n', 'n')
        w = wid(790)
        pc = 142.0
        ball = lambda x, y: ell(x, y, pc - a * 0.8, pc + 6 - b * 0.8, k=0.82)
        cut = diag(w * 0.73, CAP + 12, w * 0.27, -12, k=0.84)
        add('percent', ball(pc, CAP - pc - 40) + ball(w - pc, pc + 14) + cut, w, 'p', 'p')
        add('perthousand', ball(pc, CAP - pc - 40) + ball(w - pc, pc + 14) + ball(w + pc + 30, pc + 14) + cut, w + 2 * pc + 30, 'p', 'p')
        # El & se escribe de un trazo: pata, lazo arriba, cuenco abajo y remate.
        w = wid(650)
        amp = s(bez((w - a * 0.4, 0), (w * 0.55, 200), (w * 0.3, 360), (w * 0.2, 450)), arc(w * 0.335, 548, w * 0.14, 124, 200, -60),
                bez((w * 0.405, 441), (w * 0.3, 360), (a * 1.1, 330), (a, 180)), arc(a + 170, 180, 170, 190 - b, 180, 270),
                bez((a + 170, b - OS), (w * 0.58, b - OS), (w * 0.76, 110), (w * 0.85, 300)))
        add('ampersand', amp, w, 'n', 'n')
        w = wid(860)
        rx, ry = w / 2 - a * 0.84, 450.0
        cy = 270
        inner_x, inner = w * 0.47, 150.0
        foot = inner_x + inner + a * 0.1
        tail_r = (w - a * 0.84 - foot) / 2
        add('at', (s(line(foot, cy + inner + 10, foot, cy - inner + tail_r * 0.2), arc(foot + tail_r, cy - inner + tail_r * 0.2, tail_r, tail_r, 180, 360),
                     line(w - a * 0.84, cy - inner + tail_r * 0.2, w - a * 0.84, cy), arc(w / 2, cy, rx, ry, 0, 300), cap0='soft', k=0.84)
                   + ell(inner_x, cy, inner, inner + 12, k=0.84)), w, 'r', 'r')
        cw = width('c')
        add('cent', raw('c') + stem(cw * 0.55, -80, X + 80, k=0.8), cw, 'r', 't')
        w = wid(520)
        top = CAP + OSC - b
        add('sterling', (s(bez((w - a * 0.4, 530), (w - 20, 700), (w * 0.62, top), (w * 0.5, top)), bez((w * 0.5, top), (w * 0.28, top), (w * 0.24, 560), (w * 0.24, 430)), line(w * 0.24, 430, w * 0.24, 120), bez((w * 0.24, 120), (w * 0.24, 60), (w * 0.15, b + 2), (b * 0.2, b)), cap1='butt')
                         + bar(b * 0.2, w - 40, b, k=0.96) + bar(30, w * 0.66, 330, k=0.9)), w, 'n', 'n')
        yw = width('Y')
        add('yen', raw('Y') + bar(120, yw - 120, 240, k=0.84) + bar(120, yw - 120, 90, k=0.84), yw, 'd', 'd')
        add('Euro', raw('C') + bar(-40, 420, 420, k=0.88) + bar(-40, 390, 280, k=0.88), width('C'), 'n', 't')
        w = wid(470)
        ear = lambda x0, y0, x1, y1: diag(x0, y0, x1, y1, cap0='soft', cap1='butt', k=0.86)
        add('currency', ell(w / 2, MATH, 170, 170, k=0.9) + ear(w * 0.08, MATH + 200, w * 0.2, MATH + 95) + ear(w * 0.92, MATH + 200, w * 0.8, MATH + 95) + ear(w * 0.08, MATH - 200, w * 0.2, MATH - 95) + ear(w * 0.92, MATH - 200, w * 0.8, MATH - 95), w, 'p', 'p')
        w = wid(800)
        ring = ell(w / 2, CAP / 2, w / 2 - a * 0.8, CAP / 2 + 26 - b * 0.8, k=0.8)
        add('copyright', ring + s(arc(w / 2 + 6, CAP / 2, 136, 152, 50, 310), k=0.82), w, 'p', 'p')
        rx0 = w * 0.38
        add('registered', ring + stem(rx0, CAP / 2 - 170, CAP / 2 + 170, k=0.82)
            + s(line(rx0, CAP / 2 + 160, w * 0.52, CAP / 2 + 160), arc(w * 0.52, CAP / 2 + 70, 90, 90, 90, -90), line(w * 0.52, CAP / 2 - 20, rx0, CAP / 2 - 20), cap0='butt', cap1='butt', k=0.82)
            + diag(w * 0.52, CAP / 2 - 18, w * 0.65, CAP / 2 - 170, cap0='butt-h', k=0.82), w, 'p', 'p')
        tw = 330
        add('trademark', (bar(0, tw * 0.52, CAP - b * 0.7, k=0.72) + stem(tw * 0.26, CAP - 280, CAP - b * 0.7, cap1='butt', k=0.72)
                          + shift(stem(0, CAP - 280, CAP, k=0.72) + stem(tw * 0.6, CAP - 280, CAP, k=0.72) + diag(0, CAP, tw * 0.3, CAP - 280, cap0='butt-h', cap1='butt-h', k=0.66) + diag(tw * 0.6, CAP, tw * 0.3, CAP - 280, cap0='butt-h', cap1='butt-h', k=0.66), dx=tw * 0.66)), tw * 1.26, 'p', 'p')
        add('bullet', pen.dot(118, MATH, 118), 236, 'p', 'p')
        add('periodcentered', pen.dot(r, MATH, r), 2 * r, 'p', 'p')
        el = 2 * r + 56
        add('ellipsis', pen.dot(r, r, r) + pen.dot(r + el, r, r) + pen.dot(r + 2 * el, r, r), 2 * el + 2 * r, 'p', 'p')
        add('dagger', stem(120, -130, CAP) + bar(0, 240, CAP - 200, k=0.86), 240, 'p', 'p')
        add('daggerdbl', raw('dagger') + bar(0, 240, 110, k=0.86), 240, 'p', 'p')
        w = wid(420)
        one_s = self.ess(w, CAP + OSC, 170, term0=36, term1=216)
        add('section', one_s + turned(one_s, w / 2, 260), w, 'n', 'n')
        w = wid(520)
        add('paragraph', stem(w - a, -130, CAP) + stem(w * 0.58, -130, CAP) + ell(w * 0.36, CAP - 196, w * 0.36 - a, 196 - b), w, 'n', 's')

        # Flechas y la palomita: la interfaz las usa dentro de frases.
        aw = wid(760)
        arrow = bar(0, aw - a, MATH, cap1='butt', **thin) + s(line(aw - 230, MATH + 210, aw - a * 0.5, MATH), cap1='butt', **thin) + s(line(aw - 230, MATH - 210, aw - a * 0.5, MATH), cap1='butt', **thin)
        add('arrowright', arrow, aw, 'p', 'p')
        add('arrowleft', turned(arrow, aw / 2, MATH), aw, 'p', 'p')
        tip = MATH + 330
        uw = 470.0
        up = stem(uw / 2, MATH - 290, tip - a, cap1='butt', **thin) + s(line(uw / 2 - 215, tip - 230, uw / 2, tip - a * 0.3), cap1='butt', **thin) + s(line(uw / 2 + 215, tip - 230, uw / 2, tip - a * 0.3), cap1='butt', **thin)
        add('arrowup', up, uw, 'p', 'p')
        add('arrowdown', turned(up, uw / 2, MATH + 20), uw, 'p', 'p')
        add('uni2713', s(line(40, 300, 240, 80), cap1='butt') + s(line(760, 620, 240, 80), cap1='butt'), 760, 'p', 'p')
        iw = wid(800)
        add('infinity', ell(iw * 0.28, MATH, iw * 0.28 - a, 165, k=0.9) + ell(iw * 0.72, MATH, iw * 0.28 - a, 165, k=0.9), iw, 'p', 'p')

        # Cifras voladas y fracciones: las de texto al 60 %, de un maestro más pesado para que el
        # trazo quede del grosor justo una vez reducido.
        small = Face(min(700, self.wght + 60), digits_only=True)

        def tiny(name, dy=0.0):
            return shift(scaled(small.raw(name), 0.6), dy=dy), small.w(name) * 0.6
        for name, src in (('onesuperior', 'one'), ('twosuperior', 'two'), ('threesuperior', 'three')):
            c, adv = tiny(src, 300)
            add(name, c, adv, sides=(14, 14))
        add('fraction', diag(0, -8, 330, CAP + 8, k=0.84), 330, 'p', 'p')
        for name, num_, den in (('onequarter', 'one', 'four'), ('onehalf', 'one', 'two'), ('threequarters', 'three', 'four')):
            cn, an = tiny(num_, 300)
            cd, ad = tiny(den, -8)
            at = max(an + 80, 400)
            add(name, cn + diag(170, -8, 500, CAP + 8, k=0.72) + shift(cd, dx=at), at + ad, sides=(24, 24))

    # ───────── Tildes ─────────

    def mark(self, kind, x, y):
        """Un signo centrado en x, apoyado en y."""
        s, diag, pen = self.s, self.diag, self.pen
        k = 0.86
        span = {'k': k}
        if kind == 'acute':
            return s(line(x - 44, y, x + 56, y + 128), **span)
        if kind == 'grave':
            return s(line(x + 44, y, x - 56, y + 128), **span)
        if kind == 'circumflex':
            return s(line(x - 92, y, x, y + 122), cap1='butt', **span) + s(line(x + 92, y, x, y + 122), cap1='butt', **span)
        if kind == 'caron':
            return s(line(x - 92, y + 122, x, y), cap1='butt', **span) + s(line(x + 92, y + 122, x, y), cap1='butt', **span)
        if kind == 'tilde':
            return s(bez((x - 118, y + 18), (x - 76, y + 112), (x - 30, y + 96), (x, y + 62)), bez((x, y + 62), (x + 30, y + 28), (x + 76, y + 12), (x + 118, y + 106)), **span)
        if kind == 'dieresis':
            r = self.dot_r * 0.92
            return pen.dot(x - 90, y + r, r) + pen.dot(x + 90, y + r, r)
        if kind == 'dot':
            r = self.dot_r * 0.96
            return pen.dot(x, y + r, r)
        if kind == 'ring':
            return self.ell(x, y + 68, 66, 68, k=0.74)
        if kind == 'macron':
            return self.bar(x - 112, x + 112, y + 44, **span)
        if kind == 'breve':
            return s(arc(x, y + 96, 92, 92, 196, 344), **span)
        if kind == 'dblacute':
            return s(line(x - 90, y, x - 12, y + 128), **span) + s(line(x + 40, y, x + 118, y + 128), **span)
        raise ValueError(kind)

    def below(self, kind, x, cap=False):
        s, stem = self.s, self.stem
        if kind == 'cedilla':
            return s(line(x, 0, x, -74), arc(x - 60, -74, 60, 66, 0, -120), cap0='butt', k=0.84)
        if kind == 'ogonek':
            return s(arc(x - 4, -74, 76, 86, 120, 240 + 70), cap0='butt', k=0.84)
        if kind == 'commabelow':
            return s(line(x + 18, -52, x - 20, -190), t1=(0.72, 138), k=0.92)
        raise ValueError(kind)

    def _spacing_marks(self):
        """Los signos sueltos del teclado y de Latin-1."""
        for name, kind, y in (('grave', 'grave', X + 70), ('acute', 'acute', X + 70), ('dieresis', 'dieresis', X + 90), ('macron', 'macron', X + 90)):
            self.add(name, self.mark(kind, 150, y), 300, sides=(10, 10))
        self.add('cedilla', self.below('cedilla', 150), 300, sides=(10, 10))

    def _accents(self):
        marks = {'́': 'acute', '̀': 'grave', '̂': 'circumflex', '̌': 'caron', '̃': 'tilde', '̈': 'dieresis',
                 '̇': 'dot', '̊': 'ring', '̄': 'macron', '̆': 'breve', '̋': 'dblacute'}
        below = {'̧': 'cedilla', '̨': 'ogonek', '̦': 'commabelow'}
        for cp in CHARS:
            ch = chr(cp)
            parts = unicodedata.normalize('NFD', ch)
            if len(parts) != 2 or parts[1] not in {**marks, **below}:
                continue
            base, combining = parts
            name = glyph_name(cp)
            if name in self.glyphs:
                continue
            src = {'i': 'dotlessi', 'j': 'dotlessj'}.get(base, UV2AGL.get(ord(base)))
            if combining in below:
                src = UV2AGL.get(ord(base))
            rec = self.glyphs[src]
            is_cap = base.isupper()
            tall = base in 'bdfhkl'
            y = (CAP + 56) if is_cap else (ASC + 44) if tall else (X + 70)
            contours = rec.contours
            if ch in 'ďľťĽĎŤ':
                # Sobre un asta, el carón es un apóstrofo a su derecha.
                right = rec.width + 34
                contours = contours + self.s(line(right + 16, (CAP if is_cap else ASC) - 10, right - 16, (CAP if is_cap else ASC) - 130), t1=(0.72, 120), k=0.86)
                self.add(name, contours, rec.width + 50, sides=(rec.lb, rec.rb), mid=rec.mid)
                continue
            if ch == 'ģ':
                extra = turned(self.below('commabelow', rec.mid), rec.mid, (X + 70 - 100) / 2)
            elif combining in below:
                kind = below[combining]
                # La cedilla y la coma cuelgan del centro; la ogonek, del lado derecho.
                at = rec.width - self.a - (20 if is_cap else 0) if kind == 'ogonek' else rec.mid
                extra = self.below(kind, at)
            else:
                extra = self.mark(marks[combining], rec.mid, y)
            self.glyphs[name] = Rec(contours + extra, rec.width, rec.lb, rec.rb, rec.mid, None)


# ───────── Juego de caracteres ─────────

def charset():
    latin1 = [cp for cp in range(0x20, 0x7F)] + [cp for cp in range(0xA0, 0x100)]
    # Latin Extended-A completo salvo lo que casi nadie escribe: nombres de personas.
    ext = [cp for cp in range(0x100, 0x180) if unicodedata.category(chr(cp))[0] == 'L' and cp not in (0x132, 0x133, 0x138, 0x13F, 0x140, 0x149, 0x14A, 0x14B, 0x17F, 0x130)]
    extra = [0x0130, 0x0218, 0x0219, 0x021A, 0x021B, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203A, 0x2044, 0x20AC, 0x2122,
             0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x221E, 0x2248, 0x2260, 0x2264, 0x2265, 0x2713]
    return latin1 + ext + extra


CHARS = charset()
NAMES = {0xB2: 'twosuperior', 0xB3: 'threesuperior', 0xB9: 'onesuperior', 0x2212: 'uni2212', 0x2713: 'uni2713', 0xA0: 'uni00A0', 0xAD: 'uni00AD', 0x2044: 'fraction', 0xB5: 'mu', 0x131: 'dotlessi', 0x237: 'dotlessj', 0x2C6: 'circumflex', 0x2DC: 'tilde'}


def glyph_name(cp):
    return NAMES.get(cp) or UV2AGL.get(cp) or f'uni{cp:04X}'


# ───────── Kerning ─────────

FEATURES = """
languagesystem DFLT dflt;
languagesystem latn dflt;

@lc_round = [a c d e g o q];
@lc_x = [m n p r s u v w x y z];
@lc_diag = [v w y];
@punct_low = [period comma];
@cap_round = [C G O Q];
@cap_diag = [V W Y];

feature kern {
  pos T [@lc_round @lc_x] -72;
  pos T @punct_low -96;
  pos T hyphen -60;
  pos T A -62;
  pos T @cap_round -18;
  pos A T -62;
  pos L T -82;
  pos F @punct_low -96;
  pos P @punct_low -110;
  pos F A -46;
  pos P A -52;
  pos @cap_diag @lc_round -42;
  pos @cap_diag [m n p r s u x z] -26;
  pos @cap_diag @punct_low -84;
  pos @cap_diag hyphen -36;
  pos @cap_diag A -56;
  pos A @cap_diag -56;
  pos L @cap_diag -62;
  pos L y -26;
  pos A @cap_round -16;
  pos @cap_round A -16;
  pos @cap_round @cap_diag -14;
  pos @cap_diag @cap_round -14;
  pos D [A @cap_diag] -18;
  pos D @punct_low -26;
  pos O @punct_low -26;
  pos K @cap_round -18;
  pos R @cap_diag -10;
  pos A y -22;
  pos A [v w] -20;
  pos r @punct_low -62;
  pos r @lc_round -10;
  pos @lc_diag @punct_low -56;
  pos @lc_diag @lc_round -9;
  pos f @punct_low -38;
  pos f @lc_round -8;
  pos k @lc_round -12;
  pos x @lc_round -8;
  pos t @lc_round -5;
  pos quoteright [s t] -24;
  pos [quoteleft quotedblleft] [A] -40;
  pos quotedblright @punct_low -30;
  pos one one -12;
  pos seven @punct_low -70;
  pos seven four -28;
  pos four seven -18;
} kern;

feature tnum {
  sub zero by zero.tf;
  sub one by one.tf;
  sub two by two.tf;
  sub three by three.tf;
  sub four by four.tf;
  sub five by five.tf;
  sub six by six.tf;
  sub seven by seven.tf;
  sub eight by eight.tf;
  sub nine by nine.tf;
} tnum;
"""


# ───────── Compilación ─────────

def tt_glyph(contours, dx):
    """Glifo TrueType con los puntos tal cual: los dos maestros tienen que quedar iguales."""
    g = Glyph()
    coords, flags, ends = [], [], []
    for cmds in contours:
        for c in cmds:
            if c[0] in 'ML':
                coords.append(c[1])
                flags.append(flagOnCurve)
            elif c[0] == 'Q':
                coords.append(c[1])
                flags.append(0)
                coords.append(c[2])
                flags.append(flagOnCurve)
            elif c[0] == 'C':
                coords.append(c[1])
                flags.append(0)
        ends.append(len(coords) - 1)
    g.numberOfContours = len(contours)
    if contours:
        g.coordinates = GlyphCoordinates([(p[0] + dx, p[1]) for p in coords])
        g.coordinates.toInt()
        # Los trazos se montan unos sobre otros: se avisa para que el suavizado no marque los cruces.
        flags[0] |= flagOverlapSimple
        g.flags = array('B', flags)
        g.endPtsOfContours = ends
        g.program = ttProgram.Program()
        g.program.fromBytecode(b'')
    return g


def notdef():
    outer = [('M', (60, 0)), ('L', (60, CAP)), ('L', (440, CAP)), ('L', (440, 0))]
    inner = [('M', (110, 50)), ('L', (390, 50)), ('L', (390, CAP - 50)), ('L', (110, CAP - 50))]
    return [outer, inner]


def build_master(wght, path):
    face = Face(wght)
    order = ['.notdef']
    cmap = {}
    missing = [f'{glyph_name(cp)} ({chr(cp)})' for cp in CHARS if glyph_name(cp) not in face.glyphs]
    if missing:
        raise KeyError(f'faltan: {missing}')
    for cp in CHARS:
        name = glyph_name(cp)
        cmap[cp] = name
        if name not in order:
            order.append(name)
    for name in face.glyphs:
        if name not in order and name.endswith('.tf'):
            order.append(name)
    glyphs = {'.notdef': tt_glyph(notdef(), 0)}
    metrics = {'.notdef': (500, 60)}
    for name in order[1:]:
        rec = face.glyphs[name]
        glyphs[name] = tt_glyph(rec.contours, rec.lb)
        metrics[name] = (round(rec.lb + rec.width + rec.rb), 0)
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    glyf = fb.font['glyf']
    for name in order:
        g = glyf[name]
        metrics[name] = (metrics[name][0], getattr(g, 'xMin', 0) if g.numberOfContours else 0)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT, lineGap=0)
    style = WEIGHTS[wght]
    fb.setupNameTable({
        'copyright': 'Copyright 2026 NoutLife. Todos los derechos reservados.',
        'familyName': FAMILY if style == 'Regular' else f'{FAMILY} {style}',
        'styleName': 'Regular',
        'uniqueFontIdentifier': f'{VERSION};NOUT;NoutSans-{style}',
        'fullName': f'{FAMILY} {style}',
        'version': f'Version {VERSION}',
        'psName': f'NoutSans-{style}',
        'manufacturer': 'NoutLife',
        'designer': 'NoutLife',
        'description': 'La tipografía de NoutLife: geométrica, monolineal, de remates suaves.',
        'licenseDescription': 'Tipografía propietaria de NoutLife. No se permite su redistribución.',
        'typographicFamily': FAMILY,
        'typographicSubfamily': style,
    })
    fb.setupOS2(version=4, sTypoAscender=ASCENT, sTypoDescender=DESCENT, sTypoLineGap=0, usWinAscent=1060, usWinDescent=300, sxHeight=X, sCapHeight=CAP, usWeightClass=wght, fsType=0, fsSelection=0x40 | 0x80, achVendID='NOUT')
    fb.setupPost(underlinePosition=-110, underlineThickness=50, keepGlyphNames=True)
    fb.addOpenTypeFeatures(FEATURES)
    # Sin instrucciones de ajuste: se pide el suavizado en todos los tamaños (gasp y prep).
    gasp = newTable('gasp')
    gasp.gaspRange = {0xFFFF: 0x000F}
    fb.font['gasp'] = gasp
    prep = newTable('prep')
    prep.program = ttProgram.Program()
    prep.program.fromAssembly(['PUSHW[ ]', '511', 'SCANCTRL[ ]', 'PUSHB[ ]', '4', 'SCANTYPE[ ]'])
    fb.font['prep'] = prep
    fb.font['head'].flags |= 1 << 3  # tamaños en píxeles enteros: los anchos no bailan
    fb.font.save(path)
    return face


def build_family(web_dir, design_dir):
    tmp = tempfile.mkdtemp(prefix='nout-sans-')
    try:
        light, bold = os.path.join(tmp, 'light.ttf'), os.path.join(tmp, 'bold.ttf')
        build_master(300, light)
        build_master(700, bold)
        doc = DesignSpaceDocument()
        axis = AxisDescriptor()
        axis.tag, axis.name, axis.minimum, axis.default, axis.maximum = 'wght', 'Weight', 300, 300, 700
        doc.addAxis(axis)
        for path, value in ((light, 300), (bold, 700)):
            src = SourceDescriptor()
            src.path = path
            src.location = {'Weight': value}
            doc.addSource(src)
        for value, style in WEIGHTS.items():
            inst = InstanceDescriptor()
            inst.familyName, inst.styleName = FAMILY, style
            inst.location = {'Weight': value}
            doc.addInstance(inst)
        vf, _model, _masters = build_variable(doc, master_finder=lambda s: s, optimize=True)
        buildStatTable(vf, [{'tag': 'wght', 'name': 'Weight', 'values': [{'value': v, 'name': n, **({'flags': 2} if v == 400 else {})} for v, n in WEIGHTS.items()]}])
        name = vf['name']
        name.setName(FAMILY, 1, 3, 1, 0x409)
        name.setName('Regular', 2, 3, 1, 0x409)
        name.setName(f'{FAMILY}', 4, 3, 1, 0x409)
        name.setName('NoutSans-Variable', 6, 3, 1, 0x409)
        os.makedirs(web_dir, exist_ok=True)
        os.makedirs(design_dir, exist_ok=True)
        var_path = os.path.join(design_dir, 'NoutSans[wght].ttf')
        vf.save(var_path)
        web = TTFont(var_path)
        web.flavor = 'woff2'
        web['post'].formatType = 3.0  # en la web sobran los nombres de los glifos
        woff2 = os.path.join(web_dir, 'nout-sans.woff2')
        web.save(woff2)
        print(f'{woff2}: {os.path.getsize(woff2) / 1024:.1f} KB, {len(web.getGlyphOrder())} glifos')
        for value, style in WEIGHTS.items():
            inst = instancer.instantiateVariableFont(TTFont(var_path), {'wght': value}, overlap=instancer.OverlapMode.REMOVE, updateFontNames=True)
            out = os.path.join(design_dir, f'NoutSans-{style}.ttf')
            inst.save(out)
        check(var_path)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# Lo que la app escribe de verdad: si falta algo de esto, no se publica.
MUST_RENDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áéíóúüñÁÉÍÓÚÜÑ¿¡«»“”‘’…–—·•€$%&@#→←✓"


def check(path):
    font = TTFont(path)
    cmap = font.getBestCmap()
    missing = [c for c in MUST_RENDER if ord(c) not in cmap]
    assert not missing, f'faltan: {missing}'
    assert 'fvar' in font and 'gvar' in font and 'HVAR' in font, 'sin variaciones'
    axis = font['fvar'].axes[0]
    assert (axis.axisTag, axis.minValue, axis.maxValue) == ('wght', 300, 700), 'eje wght de 300 a 700'
    adv = font['hmtx']
    tabular = {adv[name][0] for name in font.getGlyphOrder() if name.endswith('.tf')}
    assert len(tabular) == 1, f'cifras tabulares de varios anchos: {tabular}'
    print(f'verificado: {len(cmap)} caracteres; tabulares de {tabular.pop()} unidades')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--web', required=True)
    parser.add_argument('--design', required=True)
    args = parser.parse_args()
    build_family(args.web, args.design)
