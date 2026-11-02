// Ícono activo del navbar con volumen: un gel translúcido que se ilumina por dentro. La pastilla es
// CSS (.lq-nav-clay) y sigue a la barra al desplegarse; esta escena solo dibuja el ícono, sobre fondo
// transparente, y únicamente mientras algo cambia. La luz sigue al dedo o al cursor y al presionar
// se enciende: la misma respuesta que la luz difusa de la pastilla.
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, ShaderMaterial } from 'three';
import { Stage, type StageOptions } from '@/components/three3d/stage';
import { KEY_LIGHT, readCalmTones } from '@/components/three3d/calmMaterial';
import { tokenColor, type PropPalette } from '@/components/three3d/palette';
import { buildTube, sampleStrokes, type TubeMesh } from './iconTube';

/** Px CSS por unidad de la escena: el ícono mide 24 × 24. */
const PX = 32;
const FOV = 18;
const ICON = 1 / PX;
const TILT = (9 * Math.PI) / 180;

const iconVert = /* glsl */ `
  attribute vec3 aC;
  uniform float uInflate;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // Con uInflate = 0, el tubo aplastado: el mismo trazo plano del ícono de al lado.
    vec3 p = vec3(aC.xy + (position.xy - aC.xy) * (0.86 + 0.14 * uInflate), position.z * uInflate * 0.9 + 0.012);
    vec3 n = normalize(vec3(normal.xy, normal.z + (1.0 - uInflate) * 2.0));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * n);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const iconFrag = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uLit;
  uniform vec3 uKey;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uDark;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float wrap = clamp((dot(n, uKey) + 0.45) / 1.45, 0.0, 1.0);
    // El centro del tubo deja pasar la luz de dentro; los lados se quedan con la tinta.
    float core = pow(max(dot(n, v), 0.0), 1.8);
    vec3 col = mix(uInk, uLit, core * (0.34 + 0.5 * uGlow)) * (0.74 + 0.42 * wrap);
    vec3 r = reflect(-v, n);
    col += vec3(1.0) * smoothstep(0.12, 0.015, 1.0 - dot(r, uKey)) * (0.16 + 0.12 * uDark + 0.1 * uGlow);
    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }`;

export interface NavPebbleOptions extends StageOptions {
  /** Eje de la barra: x en la inferior del móvil, y en la lateral. */
  axis: 'x' | 'y';
}

interface IconState {
  mesh: Mesh;
  material: ShaderMaterial;
  inflate: number;
  /** Tiempo hasta que debe aparecer; deshincharse no espera. */
  delay: number;
  leaving: boolean;
}

export class NavPebbleScene extends Stage {
  private axis: 'x' | 'y';
  private lean = new Group();
  private icons: IconState[] = [];
  private tubes = new WeakMap<SVGSVGElement, TubeMesh>();
  private ink = new Color();
  private lit = new Color();
  private dark = false;
  private key = KEY_LIGHT.clone();
  /** Viaje: 1 al salir y baja a 0; inclina el ícono hacia donde va. */
  private travel = 0;
  private sign = 1;
  /** Punto de luz (−1…1 sobre la pastilla) y presión, con su valor suavizado. */
  private light = { x: 0, y: 0, press: 0, tx: 0, ty: 0, tp: 0 };

  constructor(host: HTMLElement, opts: NavPebbleOptions) {
    super(host, { ...opts, fov: FOV, maxDpr: 3 });
    this.axis = opts.axis;
    this.lean.rotation.x = -TILT;
    this.scene.add(this.lean);
    this.applyPalette(opts.palette);
    this.start();
  }

  protected applyPalette(p: PropPalette) {
    const css = getComputedStyle(document.documentElement);
    this.dark = p.dark;
    this.ink.copy(p.dark ? tokenColor(css.getPropertyValue('--lq-jade-200'), '196 226 202') : readCalmTones(p).ink);
    this.lit.copy(tokenColor(css.getPropertyValue(p.dark ? '--lq-jade-50' : '--lq-jade-500'), p.dark ? '230 242 232' : '112 180 141'));
    for (const icon of this.icons) {
      (icon.material.uniforms.uInk.value as Color).copy(this.ink);
      (icon.material.uniforms.uLit.value as Color).copy(this.lit);
      icon.material.uniforms.uDark.value = p.dark ? 1 : 0;
    }
  }

  protected layout() {
    const h = this.height / PX;
    this.camera.position.set(0, 0, h / 2 / Math.tan(((this.camera.fov / 2) * Math.PI) / 180));
    this.camera.lookAt(0, 0, 0);
  }

  protected ambient() {
    return false;
  }

  /** Viaje hacia otra pestaña: `dir` = sentido en el eje de la barra. */
  move(dir: number) {
    if (this.reduceMotion) return;
    this.sign = dir >= 0 ? 1 : -1;
    this.travel = 1;
    this.request();
  }

  /** La luz va hacia (x, y), en −1…1 sobre la pastilla; `press` la enciende. */
  touch(x: number, y: number, press: boolean) {
    this.light.tx = x;
    this.light.ty = y;
    this.light.tp = press ? 1 : 0;
    this.request();
  }

  /** Pone el ícono de la pestaña activa. Con `animate`, hincha el nuevo cuando llega la pastilla. */
  setIcon(svg: SVGSVGElement, animate: boolean) {
    let tube = this.tubes.get(svg);
    if (!tube) {
      tube = buildTube(sampleStrokes(svg), 0.98);
      this.tubes.set(svg, tube);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(tube.position, 3));
    geometry.setAttribute('normal', new BufferAttribute(tube.normal, 3));
    geometry.setAttribute('aC', new BufferAttribute(tube.center, 3));
    geometry.setIndex(new BufferAttribute(tube.index, 1));
    const start = animate && !this.reduceMotion ? 0 : 1;
    const material = new ShaderMaterial({
      vertexShader: iconVert,
      fragmentShader: iconFrag,
      transparent: true,
      uniforms: {
        uInk: { value: this.ink.clone() },
        uLit: { value: this.lit.clone() },
        uKey: { value: this.key },
        uInflate: { value: start },
        uOpacity: { value: start },
        uGlow: { value: 0 },
        uDark: { value: this.dark ? 1 : 0 },
      },
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.scale.setScalar(ICON);
    this.lean.add(mesh);
    for (const old of this.icons) old.leaving = true;
    this.icons.push({ mesh, material, inflate: start, delay: animate ? 0.22 : 0, leaving: false });
    this.request();
  }

  protected step(dt: number): boolean {
    let busy = false;
    const l = this.light;
    const ease = 1 - Math.exp(-dt / 0.09);
    l.x += (l.tx - l.x) * ease;
    l.y += (l.ty - l.y) * ease;
    l.press += (l.tp - l.press) * ease;
    if (Math.abs(l.tx - l.x) + Math.abs(l.ty - l.y) + Math.abs(l.tp - l.press) > 0.004) busy = true;
    else {
      l.x = l.tx;
      l.y = l.ty;
      l.press = l.tp;
    }
    this.key.copy(KEY_LIGHT);
    this.key.x += l.x * 0.7;
    this.key.y += l.y * 0.7;
    this.key.normalize();

    if (this.travel > 0) {
      this.travel = Math.max(0, this.travel - dt / 0.42);
      busy = true;
    }
    const swing = Math.sin(this.travel * Math.PI) * this.sign;
    // Se inclina hacia donde va, y vuelve a mirar de frente al llegar.
    if (this.axis === 'x') this.lean.rotation.y = swing * 0.3;
    else this.lean.rotation.x = -TILT - swing * 0.3;
    const lift = 1 + Math.sin(this.travel * Math.PI) * 0.06 - l.press * 0.06;
    this.lean.scale.set(lift, lift, 1 - l.press * 0.35);

    for (let i = this.icons.length - 1; i >= 0; i--) {
      const icon = this.icons[i];
      if (icon.leaving) {
        icon.inflate = Math.max(0, icon.inflate - dt / 0.09);
        icon.material.uniforms.uOpacity.value = Math.min(1, icon.inflate * 1.6);
        if (icon.inflate <= 0) {
          this.lean.remove(icon.mesh);
          icon.mesh.geometry.dispose();
          icon.material.dispose();
          this.icons.splice(i, 1);
          continue;
        }
        busy = true;
      } else if (icon.inflate < 1) {
        if (icon.delay > 0) {
          icon.delay -= dt;
        } else {
          icon.inflate = Math.min(1, icon.inflate + dt / 0.26);
          icon.material.uniforms.uOpacity.value = Math.min(1, icon.inflate * 4);
        }
        busy = true;
      }
      // Sube rápido y se asienta: un poco de más y vuelve.
      icon.material.uniforms.uInflate.value = icon.inflate + Math.sin(icon.inflate * Math.PI) * 0.12;
      icon.material.uniforms.uGlow.value = Math.min(1, l.press + Math.hypot(l.x, l.y) * 0.5);
    }
    return busy;
  }
}
