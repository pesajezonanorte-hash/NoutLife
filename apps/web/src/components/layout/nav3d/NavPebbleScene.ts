// Canto rodado del navbar: la pestaña activa con volumen. El modelo sale de Blender (juego nav de
// scripts/blender/calm.py) y el clip nav_travel marca cómo se estira al viajar y se asienta al
// llegar. La posición en X/Y la lleva CSS (.lq-nav-pebble, solo transform): el canto cruza la barra
// en el compositor y no se traba mientras React monta la página nueva. Esta escena solo dibuja lo
// que cambia: al navegar unas décimas de segundo y, en reposo, nada.
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, ShaderMaterial, Texture, Vector3 } from 'three';
import navUrl from '@/assets/models/calm-nav.glb?url';
import { Stage, type StageOptions } from '@/components/three3d/stage';
import { calmGeometry, calmNormalBitmap, clipLength, loadCalm, sampleClip } from '@/components/three3d/calmModels';
import { KEY_LIGHT, morphVertex, readCalmTones, setWeights, studioChunk, studioUniforms } from '@/components/three3d/calmMaterial';
import type { GlbClip } from '@/components/three3d/glb';
import type { PropPalette } from '@/components/three3d/palette';
import { buildTube, sampleStrokes, type TubeMesh } from './iconTube';

/** Px CSS por unidad del modelo: el canto mide 1,75 × 1 unidades y 56 × 32 px en la barra. */
const PX = 32;
const TILT = (13 * Math.PI) / 180;
const FOV = 18;
const CROWN = 0.2;
/** Unidades del modelo por unidad del icono (24 × 24 px). */
const ICON = 1 / PX;

const pebbleFrag = /* glsl */ `
  ${studioChunk}
  uniform vec3 uClay;
  uniform float uGloss;
  void main() {
    vec3 n = surfaceNormal();
    vec3 v = normalize(vV);
    vec3 col = clayLight(uClay, n, v, uGloss);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const iconVert = /* glsl */ `
  attribute vec3 aC;
  uniform float uInflate;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // Con uInflate = 0, el tubo aplastado sobre la cara: el mismo trazo plano del ícono.
    vec3 p = vec3(aC.xy + (position.xy - aC.xy) * (0.86 + 0.14 * uInflate), position.z * uInflate * 0.9 + 0.012);
    vec3 n = normalize(vec3(normal.xy, normal.z + (1.0 - uInflate) * 2.0));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(transpose(inverse(mat3(modelMatrix))) * n);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const iconFrag = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uKey;
  uniform float uOpacity;
  uniform float uDark;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float wrap = clamp((dot(n, uKey) + 0.5) / 1.5, 0.0, 1.0);
    vec3 col = uInk * (0.82 + 0.3 * wrap);
    vec3 r = reflect(-v, n);
    col += vec3(1.0) * smoothstep(0.09, 0.012, 1.0 - dot(r, uKey)) * (0.05 + 0.1 * uDark);
    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }`;

// Sombra de contacto: se separa y se abre cuando el canto se levanta en el viaje.
const shadowVert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const shadowFrag = /* glsl */ `
  uniform vec2 uHalf;
  uniform float uSoft;
  uniform float uStrength;
  uniform vec3 uTint;
  varying vec2 vP;
  void main() {
    vec2 q = abs(vP) - uHalf + 0.4;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.4;
    float a = smoothstep(uSoft, -uSoft * 0.4, d);
    gl_FragColor = vec4(uTint, a * a * uStrength);
    #include <colorspace_fragment>
  }`;

export interface NavPebbleOptions extends StageOptions {
  /** Eje de la barra: x en la inferior del móvil, y en la lateral. */
  axis: 'x' | 'y';
  /** Tamaño del canto en px CSS. */
  width: number;
  height: number;
}

interface IconState {
  mesh: Mesh;
  material: ShaderMaterial;
  inflate: number;
  /** Tiempo desde que debe aparecer; deshincharse no espera. */
  delay: number;
  leaving: boolean;
}

export class NavPebbleScene extends Stage {
  private axis: 'x' | 'y';
  /** Inclinación del viaje, en ejes de la pantalla; dentro, el canto con su tumbado fijo. */
  private lean = new Group();
  private group = new Group();
  private pebble: Mesh | null = null;
  private clay: ShaderMaterial;
  private shadow: Mesh;
  private shadowMaterial: ShaderMaterial;
  private map: Texture | null = null;
  private travel: GlbClip | null = null;
  private t = 1e3;
  private w: number[] = [0, 0, 0];
  private sign = 1;
  private lift = 0;
  private icons: IconState[] = [];
  private tubes = new WeakMap<SVGSVGElement, TubeMesh>();
  private pendingIcon: { svg: SVGSVGElement; animate: boolean } | null = null;
  private iconColor = new Color();
  private dark = false;
  private scaleX: number;
  private scaleZ: number;

  constructor(host: HTMLElement, opts: NavPebbleOptions) {
    super(host, { ...opts, fov: FOV, maxDpr: 3 });
    this.axis = opts.axis;
    this.scaleX = opts.width / 56;
    this.scaleZ = opts.height / 32;
    this.clay = new ShaderMaterial({
      vertexShader: morphVertex(3),
      fragmentShader: pebbleFrag,
      uniforms: { ...studioUniforms(), uClay: { value: new Color() }, uGloss: { value: 1.25 } },
    });
    this.shadowMaterial = new ShaderMaterial({
      vertexShader: shadowVert,
      fragmentShader: shadowFrag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uHalf: { value: [0.875 * this.scaleX, 0.5 * this.scaleZ] },
        uSoft: { value: 0.2 },
        uStrength: { value: 0.3 },
        uTint: { value: new Color() },
      },
    });
    const quad = new BufferGeometry();
    const hx = 1.5 * this.scaleX + 0.4;
    const hy = 1 * this.scaleZ + 0.4;
    quad.setAttribute('position', new BufferAttribute(new Float32Array([-hx, -hy, 0, hx, -hy, 0, hx, hy, 0, -hx, hy, 0]), 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    this.shadow = new Mesh(quad, this.shadowMaterial);
    this.shadow.renderOrder = -1;
    this.lean.add(this.group);
    this.scene.add(this.shadow, this.lean);
    this.group.rotation.x = Math.PI / 2 - TILT;
    this.applyPalette(opts.palette);
    this.loading = true;
    void this.load();
    this.start();
  }

  private async load() {
    try {
      const set = await loadCalm(navUrl);
      const model = set.models.get('pebble');
      this.travel = set.clips.get('nav_travel') ?? null;
      if (!model || this.disposed) { if (!model) this.fail(); return; }
      const bitmap = await calmNormalBitmap(set);
      if (this.disposed) return;
      if (bitmap) {
        const tex = (this.map = new Texture(bitmap));
        tex.flipY = false; // UV de glTF
        tex.needsUpdate = true;
        this.clay.uniforms.uMap.value = tex;
        this.clay.uniforms.uHasMap.value = 1;
      }
      this.pebble = new Mesh(calmGeometry(model, ['stretch_x', 'stretch_y', 'squash']), this.clay);
      this.pebble.scale.set(this.scaleX, 1, this.scaleZ);
      this.pebble.position.y = -0.09;
      this.group.add(this.pebble);
      this.loading = false;
      if (this.pendingIcon) {
        const { svg, animate } = this.pendingIcon;
        this.pendingIcon = null;
        this.setIcon(svg, animate);
      }
      this.request();
    } catch {
      this.fail();
    }
  }

  protected applyPalette(p: PropPalette) {
    const tones = readCalmTones(p);
    this.dark = p.dark;
    (this.clay.uniforms.uClay.value as Color).copy(tones.clayAccent);
    this.clay.uniforms.uDark.value = p.dark ? 1 : 0;
    this.iconColor.copy(tones.ink);
    (this.shadowMaterial.uniforms.uTint.value as Color).copy(p.dark ? new Color(0, 0, 0) : tones.ink);
    this.shadowMaterial.uniforms.uStrength.value = p.dark ? 0.55 : 0.2;
    for (const icon of this.icons) {
      (icon.material.uniforms.uInk.value as Color).copy(this.iconColor);
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
    this.t = 0;
    this.request();
  }

  /** Pone el ícono de la pestaña activa. Con `animate`, hincha el nuevo al llegar el canto. */
  setIcon(svg: SVGSVGElement, animate: boolean) {
    if (!this.pebble) {
      this.pendingIcon = { svg, animate };
      return;
    }
    let tube = this.tubes.get(svg);
    if (!tube) {
      tube = buildTube(sampleStrokes(svg));
      this.tubes.set(svg, tube);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(tube.position, 3));
    geometry.setAttribute('normal', new BufferAttribute(tube.normal, 3));
    geometry.setAttribute('aC', new BufferAttribute(tube.center, 3));
    geometry.setIndex(new BufferAttribute(tube.index, 1));
    const material = new ShaderMaterial({
      vertexShader: iconVert,
      fragmentShader: iconFrag,
      transparent: true,
      uniforms: {
        uInk: { value: this.iconColor.clone() },
        uKey: { value: KEY_LIGHT.clone() },
        uInflate: { value: animate && !this.reduceMotion ? 0 : 1 },
        uOpacity: { value: animate && !this.reduceMotion ? 0 : 1 },
        uDark: { value: this.dark ? 1 : 0 },
      },
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    // El ícono mira hacia quien usa la app: su plano es el de la cara del canto.
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(ICON);
    mesh.position.y = CROWN - 0.09;
    this.group.add(mesh);
    for (const old of this.icons) old.leaving = true;
    this.icons.push({ mesh, material, inflate: animate && !this.reduceMotion ? 0 : 1, delay: animate ? 0.2 : 0, leaving: false });
    this.request();
  }

  protected step(dt: number): boolean {
    let busy = false;
    const clip = this.travel;
    let stretch = 0;
    let squash = 0;
    if (clip && this.t < clipLength(clip)) {
      this.t += dt;
      sampleClip(clip, this.t, this.w);
      stretch = this.axis === 'x' ? this.w[0] : this.w[1];
      squash = this.w[2];
      busy = true;
    }
    if (this.axis === 'x') setWeights(this.clay, stretch, 0, squash);
    else setWeights(this.clay, 0, stretch, squash);

    // En el viaje se levanta: la sombra se abre y se separa; la luz corre sobre la cara.
    const liftTo = clip && this.t < clipLength(clip) * 0.72 ? 1 : 0;
    this.lift = liftTo + (this.lift - liftTo) * Math.exp(-dt / 0.07);
    if (Math.abs(this.lift - liftTo) < 0.004) this.lift = liftTo;
    else busy = true;
    const lift = this.lift;
    const scale = 1 + lift * 0.055;
    this.group.scale.setScalar(scale);
    // Se inclina hacia donde va, como un guijarro que se lanza.
    if (this.axis === 'x') this.lean.rotation.y = this.sign * stretch * 0.2;
    else this.lean.rotation.x = -this.sign * stretch * 0.18;
    const u = this.shadowMaterial.uniforms;
    u.uSoft.value = 0.16 + lift * 0.22;
    this.shadow.position.set(0, -0.09 - lift * 0.12, -0.5);
    const key = this.clay.uniforms.uKey.value as Vector3;
    if (this.axis === 'x') key.copy(KEY_LIGHT).setX(KEY_LIGHT.x - this.sign * stretch * 0.32);
    else key.copy(KEY_LIGHT).setY(KEY_LIGHT.y + this.sign * stretch * 0.28);
    key.normalize();

    const crown = (CROWN - 0.09) * (1 - squash * 0.3) * (1 - stretch * 0.1);
    for (let i = this.icons.length - 1; i >= 0; i--) {
      const icon = this.icons[i];
      icon.mesh.position.y = crown;
      if (icon.leaving) {
        icon.inflate = Math.max(0, icon.inflate - dt / 0.09);
        icon.material.uniforms.uOpacity.value = Math.min(1, icon.inflate * 1.6);
        if (icon.inflate <= 0) {
          this.group.remove(icon.mesh);
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
          // Sube rápido y se asienta: un poco de más y vuelve.
          icon.material.uniforms.uOpacity.value = Math.min(1, icon.inflate * 4);
        }
        busy = true;
      }
      const k = icon.inflate;
      icon.material.uniforms.uInflate.value = k + Math.sin(k * Math.PI) * 0.12;
      (icon.material.uniforms.uKey.value as Vector3).copy(key);
    }
    return busy;
  }

  dispose() {
    this.map?.dispose();
    super.dispose();
  }
}
