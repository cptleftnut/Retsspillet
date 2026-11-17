import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type {
  CounselGestureType,
  CourtRole,
  EquippedCosmetics,
  EvidenceItem,
  TrialPhase,
} from '../types';

export type CameraPreset =
  | 'title'
  | 'overview'
  | 'judge'
  | 'prosecution'
  | 'defense'
  | 'witness'
  | 'evidence';

export type CourtMoodLevel = 'warm' | 'neutral' | 'tense';

export interface CourtroomCallbacks {
  onSelectEvidence?: (evidenceId: string) => void;
  onHoverEvidence?: (evidenceId: string | null) => void;
  onSelectJuror?: (jurorIndex: number) => void;
}

// Pre-allocated scratch vectors & colors for zero-GC animation loop
const _camPosTarget = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _camLookCurrent = new THREE.Vector3(0, 1.4, -1.5);
const _spotTargetTarget = new THREE.Vector3(0, 0.9, -0.35);
const _pointer = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _moodKeyTarget = new THREE.Color(0xffe8c2);
const _moodRimTarget = new THREE.Color(0x9fb8db);
const _moodSpotTarget = new THREE.Color(0xffe3aa);
const _moodBenchTarget = new THREE.Color(0xffc578);
const _moodHemiSkyTarget = new THREE.Color(0xc9d7ea);
const _moodBgTarget = new THREE.Color(0x28211b);
const _moodWarmTint = new THREE.Color(0x3a2a16);
const _moodTenseTint = new THREE.Color(0x162235);

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

const CourtroomAtmosphereShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignetteDarkness: { value: 0.34 },
    uWarmth: { value: 0.045 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignetteDarkness;
    uniform float uWarmth;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 centered = vUv - 0.5;
      float dist = dot(centered, centered);
      float vignette = smoothstep(0.58, 0.12, dist);
      vec3 col = texel.rgb;
      col.r += uWarmth * (1.0 - dist);
      col.g += uWarmth * 0.45 * (1.0 - dist);
      col *= mix(1.0 - uVignetteDarkness, 1.0, vignette);
      gl_FragColor = vec4(col, texel.a);
    }
  `,
};

function createProceduralWoodTexture(baseHex: string, grainHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Staggered oak parquet planks & fine grain
  const plankH = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    const toneShift = ((row * 17) % 5) - 2;
    if (toneShift !== 0) {
      ctx.fillStyle = toneShift > 0 ? 'rgba(255,235,205,0.035)' : 'rgba(0,0,0,0.045)';
      ctx.fillRect(0, y, 512, plankH);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, y, 512, 2);

    // Staggered vertical plank seams
    const seamOffset = (row % 2) * 128;
    ctx.fillRect(seamOffset, y, 2, plankH);
    ctx.fillRect((seamOffset + 256) % 512, y, 2, plankH);

    for (let g = 0; g < 16; g++) {
      ctx.strokeStyle = grainHex;
      ctx.globalAlpha = 0.07 + (g % 4) * 0.035;
      ctx.lineWidth = 1 + (g % 2) * 0.6;
      ctx.beginPath();
      const gy = y + 5 + g * 3.7;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(
        170,
        gy + ((g % 3) - 1) * 3.5,
        340,
        gy - ((g % 3) - 1) * 3.5,
        512,
        gy
      );
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function createProceduralWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#EAE2D0';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle architectural plaster mottling
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    const r = 12 + (i % 24);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,250,240,0.045)' : 'rgba(120,98,74,0.035)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createProceduralBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = '#525252';
    ctx.fillRect(0, y, 256, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

interface CharacterRig {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  hatSlot: THREE.Group;
  paperProp: THREE.Mesh;
  penProp: THREE.Mesh;
  robeMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  baseY: number;
  baseYaw: number;
  speakingTimer: number;
  gesture: CounselGestureType;
  gestureTimer: number;
}

function buildCourtCharacter(
  skinHex: number,
  robeHex: number,
  accentHex: number,
  scale = 1,
  baseYaw = 0
): CharacterRig {
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  root.rotation.y = baseYaw;

  const robeMat = new THREE.MeshStandardMaterial({
    color: robeHex,
    roughness: 0.75,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.44,
    metalness: 0.14,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.62,
    metalness: 0.02,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.85,
  });

  // 1. Plinth/shoes (bottom-center pivot y = 0)
  const baseGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.1, 14);
  const baseMesh = new THREE.Mesh(baseGeo, darkMat);
  baseMesh.position.y = 0.05;
  baseMesh.castShadow = true;
  root.add(baseMesh);

  // 2. Contact shadow disc
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x120e0a,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // 3. Lower & upper torso (tapered robe)
  const robeGeo = new THREE.CylinderGeometry(0.23, 0.33, 1.05, 16);
  const robeMesh = new THREE.Mesh(robeGeo, robeMat);
  robeMesh.position.y = 0.62;
  robeMesh.castShadow = true;
  root.add(robeMesh);

  // 4. Judicial sash / collar trim
  const collarGeo = new THREE.TorusGeometry(0.18, 0.045, 8, 16);
  const collarMesh = new THREE.Mesh(collarGeo, accentMat);
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.y = 1.13;
  root.add(collarMesh);

  // White jabot / shirt bib
  const bibMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.24, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.55 })
  );
  bibMesh.position.set(0, 1.0, 0.21);
  root.add(bibMesh);

  // 5. Head & facial features group
  const head = new THREE.Group();
  head.position.set(0, 1.34, 0);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), skinMat);
  skull.scale.set(0.95, 1.06, 0.98);
  skull.castShadow = true;
  head.add(skull);

  const eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, darkMat);
  leftEye.position.set(-0.065, 0.02, 0.165);
  const rightEye = new THREE.Mesh(eyeGeo, darkMat);
  rightEye.position.set(0.065, 0.02, 0.165);
  head.add(leftEye, rightEye);

  const hatSlot = new THREE.Group();
  hatSlot.position.set(0, 0.13, 0);
  head.add(hatSlot);
  root.add(head);

  // 6 & 7. Left and right articulated arms + held gesture props
  const buildArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 1.08, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.48, 10), robeMat);
    sleeve.position.y = -0.2;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), skinMat);
    hand.position.y = -0.46;
    pivot.add(sleeve, hand);
    return pivot;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Paper dossier sheet held during 'read_papers' and 'note_points'
  const paperProp = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.015, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf7f1e3, roughness: 0.8 })
  );
  paperProp.position.set(0.08, -0.46, 0.14);
  paperProp.rotation.x = 0.25;
  paperProp.visible = false;
  leftArm.add(paperProp);

  // Brass & ebony pen held during 'note_points'
  const penProp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.008, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0xb88b32, roughness: 0.3, metalness: 0.8 })
  );
  penProp.position.set(-0.02, -0.48, 0.08);
  penProp.rotation.x = Math.PI * 0.35;
  penProp.visible = false;
  rightArm.add(penProp);

  root.add(leftArm, rightArm);

  return {
    root,
    head,
    leftArm,
    rightArm,
    hatSlot,
    paperProp,
    penProp,
    robeMat,
    accentMat,
    baseY: 0,
    baseYaw,
    speakingTimer: 0,
    gesture: 'idle',
    gestureTimer: 0,
  };
}

function setHatOnSlot(slot: THREE.Group, hatId: string, accentHex: number) {
  while (slot.children.length > 0) {
    slot.remove(slot.children[0]);
  }
  if (hatId === 'hat-none' || !hatId) return;

  if (hatId === 'hat-wig') {
    const wigMat = new THREE.MeshStandardMaterial({ color: 0xeae4d7, roughness: 0.72 });
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      wigMat
    );
    crown.position.y = -0.02;
    const leftCurl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.28, 10), wigMat);
    leftCurl.position.set(-0.18, -0.11, -0.02);
    const rightCurl = leftCurl.clone();
    rightCurl.position.x = 0.18;
    const backCurl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.12), wigMat);
    backCurl.position.set(0, -0.1, -0.15);
    slot.add(crown, leftCurl, rightCurl, backCurl);
  } else if (hatId === 'hat-fedora') {
    const beretMat = new THREE.MeshStandardMaterial({ color: 0x33302c, roughness: 0.75 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.09, 16), beretMat);
    disc.position.set(0.02, 0.04, 0);
    disc.rotation.z = -0.18;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.018, 6, 16),
      new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.4, metalness: 0.3 })
    );
    band.rotation.x = Math.PI / 2;
    slot.add(disc, band);
  } else if (hatId === 'hat-tophat') {
    const silkMat = new THREE.MeshStandardMaterial({
      color: 0x181615,
      roughness: 0.35,
      metalness: 0.15,
    });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 20), silkMat);
    brim.position.y = 0.02;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.28, 18), silkMat);
    crown.position.y = 0.16;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.176, 0.176, 0.045, 18),
      new THREE.MeshStandardMaterial({ color: 0xb88b32, roughness: 0.28, metalness: 0.8 })
    );
    band.position.y = 0.06;
    slot.add(brim, crown, band);
  }
}

export class CourtroomSceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private atmospherePass: ShaderPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private callbacks: CourtroomCallbacks;

  private preset: CameraPreset = 'title';
  private activeSpeaker: CourtRole | null = null;
  private trauma = 0;
  private gavelTimer = 0;
  private gavelImpactStep = 0;
  private gavelImpactAge = 0;
  private gavelPivot: THREE.Group;
  private soundBlockMesh!: THREE.Mesh;
  private gavelImpactRing!: THREE.Mesh;
  private gavelImpactMat!: THREE.MeshBasicMaterial;
  private dragYaw = 0;
  private dragPitch = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private characters = new Map<CourtRole, CharacterRig>();
  private jurors: CharacterRig[] = [];
  private evidenceGroup = new THREE.Group();
  private clickableMeshes: THREE.Object3D[] = [];
  private hoveredEvidenceId: string | null = null;
  private selectedEvidenceId: string | null = null;
  private activeAttachmentAnim: {
    evidenceId: string;
    isKeyEvidence: boolean;
    startTime: number;
    duration: number;
  } | null = null;

  // Innovative graphics engine props & shaders
  private speakerSpotLight!: THREE.SpotLight;
  private godRayMaterials: THREE.ShaderMaterial[] = [];
  private dustPointsMat: THREE.ShaderMaterial | null = null;
  private evidenceHaloMesh!: THREE.Mesh;
  private evidenceHaloMat!: THREE.ShaderMaterial;

  private floorMat!: THREE.MeshStandardMaterial;
  private woodMat!: THREE.MeshStandardMaterial;
  private wallMat!: THREE.MeshStandardMaterial;
  private accentGoldMat!: THREE.MeshPhysicalMaterial;
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private benchLight!: THREE.PointLight;
  private evidenceSpot!: THREE.PointLight;
  private baseMoodState: CourtMoodLevel = 'neutral';
  private manualMoodOverride: CourtMoodLevel | 'auto' = 'auto';
  private criticalMoodTimer = 0;
  private judgeExpressionMode: 'normal' | 'head_shake' | 'intense_focus' = 'normal';
  private baseThemeBgHex = 0x28211b;

  constructor(container: HTMLElement, callbacks: CourtroomCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x28211b);
    this.scene.fog = new THREE.FogExp2(0x28211b, 0.013);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 80);
    this.camera.position.set(5.5, 4.4, 8.6);
    this.camera.lookAt(_camLookCurrent);

    this.gavelPivot = new THREE.Group();
    this.buildLighting();
    this.buildArchitecture();
    this.buildAtmosphericShaders();
    this.buildCharacters();
    this.buildEvidenceHalo();
    this.scene.add(this.evidenceGroup);

    if (!this.isSoftwareGl) {
      this.setupPostProcessing(w, h);
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.tick();
  }

  private setupPostProcessing(w: number, h: number) {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2))),
      0.24,
      0.38,
      0.86
    );
    this.composer.addPass(this.bloomPass);

    this.atmospherePass = new ShaderPass(CourtroomAtmosphereShader);
    this.composer.addPass(this.atmospherePass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  private buildLighting() {
    // Balanced cool sky/ground fill against rich amber key light for architectural depth
    this.hemiLight = new THREE.HemisphereLight(0xc9d7ea, 0x2e2116, 0.58);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe8c2, 1.85);
    this.keyLight.position.set(6, 9, 5);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    const d = 9;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 25;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x9fb8db, 0.72);
    this.rimLight.position.set(-7, 5, -6);
    this.scene.add(this.rimLight);

    // Warm brass sconce accents
    this.benchLight = new THREE.PointLight(0xffc578, 3.0, 12, 2);
    this.benchLight.position.set(0, 3.0, -3.5);
    this.evidenceSpot = new THREE.PointLight(0xfff0d0, 2.4, 8, 2);
    this.evidenceSpot.position.set(0, 2.75, 0.25);
    this.scene.add(this.benchLight, this.evidenceSpot);

    // Dynamic active-speaker overhead spotlight
    this.speakerSpotLight = new THREE.SpotLight(0xffe3aa, 9.0, 16, Math.PI / 8, 0.62, 1.5);
    this.speakerSpotLight.position.set(0, 6.6, -0.5);
    this.speakerSpotLight.target.position.copy(_spotTargetTarget);
    this.scene.add(this.speakerSpotLight, this.speakerSpotLight.target);
  }

  private buildArchitecture() {
    const woodTex = createProceduralWoodTexture('#6b4423', '#3b2210');
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    woodTex.anisotropy = maxAniso;
    const wallTex = createProceduralWallTexture();
    wallTex.anisotropy = maxAniso;
    const bumpTex = createProceduralBumpTexture();

    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodTex,
      bumpMap: bumpTex,
      bumpScale: 0.015,
      roughness: 0.54,
      metalness: 0.05,
    });
    this.woodMat = new THREE.MeshStandardMaterial({
      color: 0x4b2d15,
      bumpMap: bumpTex,
      bumpScale: 0.012,
      roughness: 0.42,
      metalness: 0.07,
    });
    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0xded3be,
      map: wallTex,
      roughness: 0.86,
      metalness: 0.0,
    });
    this.accentGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xc2953c,
      roughness: 0.22,
      metalness: 0.9,
      clearcoat: 0.88,
      clearcoatRoughness: 0.14,
    });

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Center court rug with golden border trim (offset +0.02 to prevent Z-fighting)
    const rugBorder = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 0.02, 6.4),
      new THREE.MeshStandardMaterial({ color: 0x8f6b2c, roughness: 0.8 })
    );
    rugBorder.position.set(0, 0.015, 0.2);
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(6.25, 0.025, 6.05),
      new THREE.MeshStandardMaterial({ color: 0x5f2121, roughness: 0.92 })
    );
    rug.position.set(0, 0.022, 0.2);
    rug.receiveShadow = true;
    this.scene.add(rugBorder, rug);

    // Courtroom walls + coffered ceiling
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 7.6, 0.4), this.wallMat);
    backWall.position.set(0, 3.8, -6.5);
    backWall.receiveShadow = true;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.6, 18), this.wallMat);
    leftWall.position.set(-9.5, 3.8, 1);
    const rightWall = leftWall.clone();
    rightWall.position.x = 9.5;
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 18),
      new THREE.MeshStandardMaterial({ color: 0x2e241b, roughness: 0.88 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 7.4, 1);
    this.scene.add(backWall, leftWall, rightWall, ceiling);

    // Coffered Oak Ceiling Beams
    for (const beamZ of [-5.2, -2.0, 1.2, 4.4]) {
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.34, 0.36), this.woodMat);
      crossBeam.position.set(0, 7.22, beamZ);
      this.scene.add(crossBeam);
    }
    for (const beamX of [-4.6, 0, 4.6]) {
      const longBeam = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 17.5), this.woodMat);
      longBeam.position.set(beamX, 7.25, 1);
      this.scene.add(longBeam);
    }

    // Two suspended brass courtroom pendant globes
    const pendantGlassMat = new THREE.MeshStandardMaterial({
      color: 0xfff5de,
      emissive: 0xffd28a,
      emissiveIntensity: 0.72,
      roughness: 0.18,
    });
    for (const [lx, lz] of [
      [-2.2, -1.8],
      [2.2, -1.8],
    ]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8), this.accentGoldMat);
      rod.position.set(lx, 6.25, lz);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.12, 14), this.accentGoldMat);
      collar.position.set(lx, 5.3, lz);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), pendantGlassMat);
      globe.position.set(lx, 5.05, lz);
      this.scene.add(rod, collar, globe);
    }

    // Wainscoting panels, wainscot rail, pilasters & warm brass wall sconces
    const backWainscot = new THREE.Mesh(new THREE.BoxGeometry(19.6, 2.1, 0.14), this.woodMat);
    backWainscot.position.set(0, 1.05, -6.26);
    const wainscotCap = new THREE.Mesh(new THREE.BoxGeometry(19.6, 0.07, 0.22), this.accentGoldMat);
    wainscotCap.position.set(0, 2.12, -6.22);
    this.scene.add(backWainscot, wainscotCap);

    const pilasterGeo = new THREE.BoxGeometry(0.42, 7.2, 0.26);
    for (const px of [-6.4, -3.2, 3.2, 6.4]) {
      const pilaster = new THREE.Mesh(pilasterGeo, this.woodMat);
      pilaster.position.set(px, 3.6, -6.22);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.34), this.woodMat);
      cap.position.set(px, 6.85, -6.2);
      this.scene.add(pilaster, cap);

      // Wall sconce on each pilaster
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.18), this.accentGoldMat);
      bracket.position.set(px, 3.45, -6.02);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), pendantGlassMat);
      bulb.position.set(px, 3.62, -5.94);
      this.scene.add(bracket, bulb);
    }

    // Architectural Crown Molding & Pediment Frame behind Judge
    const crownMolding = new THREE.Mesh(new THREE.BoxGeometry(20, 0.24, 0.34), this.woodMat);
    crownMolding.position.set(0, 7.08, -6.24);
    const pedimentBar = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 0.22), this.woodMat);
    pedimentBar.position.set(0, 5.55, -6.18);
    const pedimentGold = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.045, 0.24), this.accentGoldMat);
    pedimentGold.position.set(0, 5.45, -6.16);
    this.scene.add(crownMolding, pedimentBar, pedimentGold);

    // Scales of Justice Emblem behind Judge
    const emblemGroup = new THREE.Group();
    emblemGroup.position.set(0, 4.15, -6.18);
    const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.09, 28), this.woodMat);
    plaque.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.045, 12, 32), this.accentGoldMat);
    ring.position.z = 0.055;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), this.accentGoldMat);
    beam.position.set(0, 0.19, 0.065);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.042, 0.78, 10), this.accentGoldMat);
    pillar.position.set(0, -0.09, 0.065);
    const panL = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.04, 16), this.accentGoldMat);
    panL.position.set(-0.39, -0.08, 0.065);
    const panR = panL.clone();
    panR.position.x = 0.39;
    emblemGroup.add(plaque, ring, beam, pillar, panL, panR);
    this.scene.add(emblemGroup);

    // Tall Arched Courtroom Side Windows with Wooden Muntin Bars
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xf7f1e3,
      emissive: 0xffe8be,
      emissiveIntensity: 0.65,
      roughness: 0.18,
    });
    for (const zPos of [-3.2, 0.4, 4.0]) {
      const winL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.3, 1.55), windowMat);
      winL.position.set(-9.24, 3.65, zPos);
      const winArch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.775, 0.775, 0.12, 16, 1, false, 0, Math.PI),
        windowMat
      );
      winArch.rotation.z = Math.PI / 2;
      winArch.rotation.y = Math.PI / 2;
      winArch.position.set(-9.24, 5.3, zPos);

      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.55, 1.75), this.woodMat);
      frameL.position.set(-9.28, 3.65, zPos);
      const muntinV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.06), this.woodMat);
      muntinV.position.set(-9.18, 3.65, zPos);
      const muntinH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 1.55), this.woodMat);
      muntinH.position.set(-9.18, 3.65, zPos);
      this.scene.add(frameL, winL, winArch, muntinV, muntinH);
    }

    // Judge Dais & Composite Bench
    const daisGroup = new THREE.Group();
    daisGroup.position.set(0, 0, -4.3);
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.25, 2.8), this.woodMat);
    step1.position.y = 0.125;
    step1.receiveShadow = true;
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 2.1), this.woodMat);
    step2.position.y = 0.4;
    step2.receiveShadow = true;
    const benchBody = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.96, 0.9), this.woodMat);
    benchBody.position.set(0, 1.03, 0.45);
    benchBody.castShadow = true;
    benchBody.receiveShadow = true;
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.09, 1.12), this.woodMat);
    benchTop.position.set(0, 1.54, 0.45);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 0.05), this.accentGoldMat);
    trim.position.set(0, 1.4, 0.92);

    // Judge brass desk lamp & brass gooseneck mic
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 12), this.accentGoldMat);
    lampBase.position.set(-1.35, 1.6, 0.55);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), this.accentGoldMat);
    lampStem.position.set(-1.35, 1.77, 0.55);
    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.16, 0.12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x214e34,
        roughness: 0.3,
        emissive: 0x163823,
        emissiveIntensity: 0.35,
      })
    );
    lampShade.position.set(-1.35, 1.94, 0.55);

    const judgeMicStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.24, 8),
      this.accentGoldMat
    );
    judgeMicStem.position.set(-0.22, 1.7, 0.65);
    const judgeMicHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x262320, roughness: 0.4, metalness: 0.7 })
    );
    judgeMicHead.position.set(-0.22, 1.82, 0.61);

    // Leather-bound law volumes on Judge bench
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x6c2424, roughness: 0.7 })
    );
    book1.position.set(-1.02, 1.61, 0.52);
    const book2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.045, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.7 })
    );
    book2.position.set(-1.01, 1.655, 0.52);
    book2.rotation.y = 0.09;

    // Sound block + Gavel assembly
    const soundBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.05, 16), this.woodMat);
    soundBlock.position.set(0.85, 1.61, 0.6);
    this.soundBlockMesh = soundBlock;

    this.gavelImpactMat = new THREE.MeshBasicMaterial({
      color: 0xe6c77e,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.gavelImpactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.16, 24),
      this.gavelImpactMat
    );
    this.gavelImpactRing.rotation.x = -Math.PI / 2;
    this.gavelImpactRing.position.set(0.85, 1.639, 0.6);
    this.gavelImpactRing.visible = false;

    this.gavelPivot.position.set(0.85, 1.69, 0.82);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.28, 10), this.woodMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -0.08;
    const gavelHead = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 12), this.woodMat);
    gavelHead.rotation.z = Math.PI / 2;
    gavelHead.position.z = -0.22;
    const gavelRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.058, 0.03, 12),
      this.accentGoldMat
    );
    gavelRing.rotation.z = Math.PI / 2;
    gavelRing.position.z = -0.22;
    this.gavelPivot.add(handle, gavelHead, gavelRing);

    daisGroup.add(
      step1,
      step2,
      benchBody,
      benchTop,
      trim,
      lampBase,
      lampStem,
      lampShade,
      judgeMicStem,
      judgeMicHead,
      book1,
      book2,
      soundBlock,
      this.gavelImpactRing,
      this.gavelPivot
    );
    this.scene.add(daisGroup);

    // Prosecution & Defense Lectern Tables with Law Books & Desk Microphones
    const buildLecternTable = (x: number, z: number, trimColor: number) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.0), this.woodMat);
      top.position.y = 0.82;
      top.castShadow = true;
      top.receiveShadow = true;
      const front = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.78, 0.08), this.woodMat);
      front.position.set(0, 0.39, -0.44);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.85), this.woodMat);
      legL.position.set(-0.92, 0.4, 0);
      const legR = legL.clone();
      legR.position.x = 0.92;
      const runner = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.015, 0.6),
        new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.7 })
      );
      runner.position.set(0, 0.87, 0);

      // Desk folder stack & brass mic
      const deskBook = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.045, 0.34),
        new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.65 })
      );
      deskBook.position.set(-0.55, 0.89, 0.12);
      deskBook.rotation.y = 0.14;
      const deskPaper = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.02, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.85 })
      );
      deskPaper.position.set(0.35, 0.885, 0.06);
      const micStand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.014, 0.22, 8),
        this.accentGoldMat
      );
      micStand.position.set(0.02, 0.97, -0.18);

      const deskShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.35, 1.25),
        new THREE.MeshBasicMaterial({ color: 0x0e0a07, transparent: true, opacity: 0.28, depthWrite: false })
      );
      deskShadow.rotation.x = -Math.PI / 2;
      deskShadow.position.y = 0.038;

      grp.add(top, front, legL, legR, runner, deskBook, deskPaper, micStand, deskShadow);
      this.scene.add(grp);
    };

    buildLecternTable(-2.7, -0.2, 0x7c2d2d); // Prosecution (Anklager)
    buildLecternTable(2.7, -0.2, 0x1e3a5f); // Defense (Forsvarer & Tiltalte)

    // Central Evidence Table
    const evTable = new THREE.Group();
    evTable.position.set(0, 0, -0.35);
    const evTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.25), this.woodMat);
    evTop.position.y = 0.78;
    evTop.castShadow = true;
    evTop.receiveShadow = true;
    const evBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.74, 0.8), this.woodMat);
    evBase.position.y = 0.37;
    const evCloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.02, 0.98),
      new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.9 })
    );
    evCloth.position.y = 0.83;
    const evShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x0e0a07, transparent: true, opacity: 0.3, depthWrite: false })
    );
    evShadow.rotation.x = -Math.PI / 2;
    evShadow.position.y = 0.038;
    evTable.add(evTop, evBase, evCloth, evShadow);
    this.scene.add(evTable);

    // Witness Stand (left-back beside Judge)
    const witnessStand = new THREE.Group();
    witnessStand.position.set(-3.4, 0, -3.2);
    const wPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 1.4), this.woodMat);
    wPlinth.position.y = 0.125;
    const wRail = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.1), this.woodMat);
    wRail.position.set(0, 0.7, 0.6);
    const wMic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.014, 0.2, 8),
      this.accentGoldMat
    );
    wMic.position.set(0.2, 1.22, 0.56);
    witnessStand.add(wPlinth, wRail, wMic);
    this.scene.add(witnessStand);

    // Jury Box (right side, sized for 6 jurors)
    const juryBox = new THREE.Group();
    juryBox.position.set(5.6, 0, -2.0);
    const jPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.25, 4.9), this.woodMat);
    jPlinth.position.y = 0.125;
    const jRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 4.8), this.woodMat);
    jRail.position.set(-0.76, 0.7, 0);
    const jTrim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 4.82), this.accentGoldMat);
    jTrim.position.set(-0.76, 1.16, 0);
    juryBox.add(jPlinth, jRail, jTrim);
    this.scene.add(juryBox);

    // Gallery Bar & Spectator Benches (Folket)
    const barDivider = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.85, 0.14), this.woodMat);
    barDivider.position.set(0, 0.425, 2.5);
    const barCap = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.06, 0.2), this.accentGoldMat);
    barCap.position.set(0, 0.86, 2.5);
    this.scene.add(barDivider, barCap);

    const benchGeo = new THREE.BoxGeometry(3.8, 0.45, 0.55);
    const benchBackGeo = new THREE.BoxGeometry(3.8, 0.55, 0.1);
    for (const rowZ of [3.9, 5.4]) {
      for (const sideX of [-2.5, 2.5]) {
        const seat = new THREE.Mesh(benchGeo, this.woodMat);
        seat.position.set(sideX, 0.225, rowZ);
        const back = new THREE.Mesh(benchBackGeo, this.woodMat);
        back.position.set(sideX, 0.65, rowZ + 0.22);
        this.scene.add(seat, back);
      }
    }
  }

  private buildAtmosphericShaders() {
    // Volumetric diagonal sunlit god-ray shafts streaming from the 3 left arched windows
    const godRayVertex = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const godRayFragment = `
      uniform float uTime;
      uniform float uPhase;
      varying vec2 vUv;
      void main() {
        float beamFadeY = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.22, vUv.y);
        float edgeX = sin(vUv.x * 3.14159265);
        float streaks = 0.72 + 0.28 * sin(vUv.x * 16.0 + uPhase);
        float shimmer = 0.9 + 0.1 * sin(uTime * 0.7 + uPhase + vUv.x * 4.0);
        float alpha = pow(edgeX, 2.5) * beamFadeY * 0.078 * streaks * shimmer;
        vec3 warmSun = vec3(1.0, 0.88, 0.66);
        gl_FragColor = vec4(warmSun, alpha);
      }
    `;

    for (const [idx, zPos] of [-3.2, 0.4, 4.0].entries()) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: idx * 1.3 },
        },
        vertexShader: godRayVertex,
        fragmentShader: godRayFragment,
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this.godRayMaterials.push(mat);

      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 8.2), mat);
      shaft.position.set(-5.4, 3.0, zPos);
      shaft.rotation.z = -Math.PI / 3.4;
      shaft.rotation.y = 0.08;
      this.scene.add(shaft);
    }

    // Floating sunlit dust motes via custom GPU ShaderMaterial Points
    const count = 130;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.65) * 11.5;
      positions[i * 3 + 1] = 0.7 + Math.random() * 4.8;
      positions[i * 3 + 2] = -4.5 + Math.random() * 9.5;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.dustPointsMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.45 + aSeed) * 0.18;
          p.x += cos(uTime * 0.3 + aSeed * 1.4) * 0.14;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(18.0 / -mv.z, 1.5, 4.5);
          vAlpha = 0.28 + 0.25 * sin(uTime * 0.9 + aSeed * 2.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float soft = smoothstep(0.5, 0.08, d);
          gl_FragColor = vec4(1.0, 0.92, 0.75, soft * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const dustPoints = new THREE.Points(dustGeo, this.dustPointsMat);
    this.scene.add(dustPoints);
  }

  private buildEvidenceHalo() {
    this.evidenceHaloMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
        uColor: { value: new THREE.Color(0xdcb15b) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float pulse = 0.55 + 0.45 * sin(uTime * 4.2);
          float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
          gl_FragColor = vec4(uColor, edge * 0.75 * pulse * uIntensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.evidenceHaloMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.29, 28),
      this.evidenceHaloMat
    );
    this.evidenceHaloMesh.rotation.x = -Math.PI / 2;
    this.evidenceHaloMesh.position.set(0, 0.85, -0.35);
    this.evidenceHaloMesh.visible = false;
    this.scene.add(this.evidenceHaloMesh);
  }

  private buildCharacters() {
    // Judge (seated high behind raised dais)
    const judge = buildCourtCharacter(0xf1c7a6, 0x1c1917, 0xa87c2d, 1.06, 0);
    judge.root.position.set(0, 0.88, -4.45);
    judge.baseY = 0.88;
    setHatOnSlot(judge.hatSlot, 'hat-wig', 0xa87c2d);
    this.scene.add(judge.root);
    this.characters.set('Dommer', judge);

    // Prosecution (Anklager)
    const pros = buildCourtCharacter(0xe8bca0, 0x252220, 0x7c2d2d, 1.0, 0.14);
    pros.root.position.set(-2.7, 0, -0.95);
    this.scene.add(pros.root);
    this.characters.set('Anklager', pros);

    // Defense (Forsvarer)
    const def = buildCourtCharacter(0xf3cbb0, 0x22262b, 0x1e3a5f, 1.0, -0.14);
    def.root.position.set(2.35, 0, -0.95);
    this.scene.add(def.root);
    this.characters.set('Forsvarer', def);

    // Defendant (Tiltalte)
    const defendant = buildCourtCharacter(0xe6b599, 0x4b5563, 0x9ca3af, 0.96, -0.08);
    defendant.root.position.set(3.25, 0, -0.95);
    this.scene.add(defendant.root);
    this.characters.set('Tiltalte', defendant);

    // Witness (Vidne)
    const witness = buildCourtCharacter(0xefbfa4, 0x3b4d3b, 0xd6cfc2, 0.98, Math.PI * 0.25);
    witness.root.position.set(-3.4, 0.25, -3.2);
    witness.baseY = 0.25;
    this.scene.add(witness.root);
    this.characters.set('Vidne', witness);

    // 6 Articulated Jury Members in the Jury Box with clickable name plates
    const jurorSkins = [0xf2cbb0, 0xe4b293, 0xd49a79, 0xf0c6a8, 0xe8ba9c, 0xcf9473];
    const jurorAccents = [0x8b7e6d, 0x6f6356, 0x7c2d2d, 0x1e3a5f, 0x8b7e6d, 0x6f6356];
    this.jurors = [];
    for (let i = 0; i < 6; i++) {
      const juror = buildCourtCharacter(
        jurorSkins[i],
        0x34312e,
        jurorAccents[i],
        0.86,
        -Math.PI / 2
      );
      juror.root.position.set(5.6, 0.25, -3.9 + i * 0.76);
      juror.baseY = 0.25;
      this.scene.add(juror.root);
      this.jurors.push(juror);

      // Clickable name plate mesh under juror bench
      const plateGeo = new THREE.BoxGeometry(0.38, 0.08, 0.44);
      const plateMat = new THREE.MeshStandardMaterial({
        color: 0x2b241e,
        roughness: 0.35,
        metalness: 0.7,
      });
      const plateMesh = new THREE.Mesh(plateGeo, plateMat);
      plateMesh.position.set(5.35, 0.12, -3.9 + i * 0.76);
      plateMesh.layers.set(1);
      plateMesh.userData.jurorIndex = i;
      this.clickableMeshes.push(plateMesh);
      this.scene.add(plateMesh);
    }
  }

  public setEvidenceItems(items: EvidenceItem[]) {
    while (this.evidenceGroup.children.length > 0) {
      this.evidenceGroup.remove(this.evidenceGroup.children[0]);
    }
    this.clickableMeshes = [];

    const count = Math.max(1, items.length);
    const spacing = Math.min(0.55, 1.85 / count);
    const startX = -((count - 1) * spacing) / 2;

    items.forEach((item, idx) => {
      const grp = new THREE.Group();
      grp.position.set(startX + idx * spacing, 0.84, -0.35);

      const folderColor =
        item.type === 'video'
          ? 0x263238
          : item.type === 'digital'
            ? 0x1e3a5f
            : item.type === 'physical'
              ? 0x7c2d2d
              : 0xd9cdb8;

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.04, 0.4),
        new THREE.MeshStandardMaterial({ color: folderColor, roughness: 0.58 })
      );
      base.position.y = 0.02;
      base.castShadow = true;

      const sheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.015, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.85 })
      );
      sheet.position.y = 0.046;

      const seal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.015, 12),
        new THREE.MeshStandardMaterial({
          color: item.isIrrelevant ? 0x6b7280 : 0xb88b32,
          roughness: 0.28,
          metalness: 0.78,
        })
      );
      seal.position.set(0.08, 0.056, 0.1);

      const hitProxy = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.25, 0.46),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.position.y = 0.1;
      hitProxy.layers.set(1);
      hitProxy.userData.evidenceId = item.id;
      this.clickableMeshes.push(hitProxy);

      grp.userData.evidenceId = item.id;
      grp.userData.baseRotY = grp.rotation.y;
      grp.userData.basePosY = grp.position.y;
      grp.add(base, sheet, seal, hitProxy);
      this.evidenceGroup.add(grp);
    });
  }

  public highlightEvidence(evidenceId: string | null) {
    this.selectedEvidenceId = evidenceId;
  }

  /**
   * Triggers a rich 3D levitation, rotation, and halo illumination animation
   * when an exhibit is attached or referenced in the procedural panel.
   */
  public animateExhibitAttachment(evidenceId: string, isKeyEvidence = false): void {
    this.selectedEvidenceId = evidenceId;
    this.activeAttachmentAnim = {
      evidenceId,
      isKeyEvidence,
      startTime: typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000,
      duration: isKeyEvidence ? 3.0 : 2.4,
    };
  }

  public applyCosmetics(role: CourtRole, equipped: EquippedCosmetics) {
    const rig = this.characters.get(role);
    if (!rig) return;

    const colorMap: Record<string, number> = {
      'color-burgundy': 0x7c2d2d,
      'color-navy': 0x1e3a5f,
      'color-gold': 0xa87c2d,
      'color-emerald': 0x234e3d,
    };
    const accentHex = colorMap[equipped.color] ?? 0x7c2d2d;
    rig.accentMat.color.setHex(accentHex);

    const outfitMap: Record<string, number> = {
      'outfit-classic': 0x1e1c1a,
      'outfit-suit': 0x2b3440,
      'outfit-ermine': 0x2a1414,
    };
    rig.robeMat.color.setHex(outfitMap[equipped.outfit] ?? 0x1e1c1a);
    setHatOnSlot(rig.hatSlot, equipped.hat, accentHex);

    // Apply Courtroom Theme
    if (equipped.courtroom === 'court-birch') {
      this.woodMat.color.setHex(0xc29b6c);
      this.wallMat.color.setHex(0xf5f1e7);
      this.baseThemeBgHex = 0x3a342c;
      this.scene.background = new THREE.Color(0x3a342c);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x3a342c);
    } else if (equipped.courtroom === 'court-marble') {
      this.woodMat.color.setHex(0x302e2c);
      this.wallMat.color.setHex(0xdcd9d0);
      this.baseThemeBgHex = 0x1f2226;
      this.scene.background = new THREE.Color(0x1f2226);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x1f2226);
    } else {
      this.woodMat.color.setHex(0x5c391c);
      this.wallMat.color.setHex(0xffffff);
      this.baseThemeBgHex = 0x28211b;
      this.scene.background = new THREE.Color(0x28211b);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x28211b);
    }
  }

  public setCameraPreset(preset: CameraPreset) {
    this.preset = preset;
    this.dragYaw = 0;
    this.dragPitch = 0;
  }

  public setActiveSpeaker(role: CourtRole | null) {
    this.activeSpeaker = role;
    if (role) {
      const rig = this.characters.get(role);
      if (rig) rig.speakingTimer = 2.4;
    }
  }

  /**
   * Triggers an articulated 3D courtroom gesture for a specific role
   * (e.g., opposing AI counsel reading papers, looking skeptical, or noting points
   * based on evaluated rebuttalScore).
   */
  public triggerCharacterGesture(
    role: CourtRole,
    gesture: CounselGestureType,
    durationSec = 3.2
  ) {
    const rig = this.characters.get(role);
    if (!rig) return;
    rig.gesture = gesture;
    rig.gestureTimer = durationSec;
    if (gesture === 'objection_point') {
      this.trauma = Math.min(1, this.trauma + 0.18);
    }
  }

  public triggerGavelSlam() {
    this.gavelTimer = 0.72;
    this.gavelImpactStep = 0;
    this.gavelImpactAge = 0;
    this.trauma = Math.min(1, this.trauma + 0.35);
    const judge = this.characters.get('Dommer');
    if (judge) judge.speakingTimer = Math.max(judge.speakingTimer, 0.9);
  }

  /**
   * Dynamically adapts courtroom lighting mood to trial phase and jury persuasion:
   * - 'warm': amber sunlit progression when coherence & jury favor are strong
   * - 'tense': cool intense slate-blue contrast on objections, warnings, or poor coherence
   * - 'neutral': balanced natural courtroom atmosphere
   */
  public setTrialMoodLighting(opts: {
    phase: TrialPhase;
    juryFavorRatio: number;
    playerAvgCoherence: number;
    hasWarningOrObjection: boolean;
    manualOverride?: CourtMoodLevel | 'auto';
  }) {
    if (opts.manualOverride !== undefined) {
      this.manualMoodOverride = opts.manualOverride;
    }
    if (
      opts.hasWarningOrObjection ||
      opts.playerAvgCoherence < 48 ||
      opts.juryFavorRatio < 0.42
    ) {
      this.baseMoodState = 'tense';
    } else if (
      opts.juryFavorRatio >= 0.56 ||
      (opts.playerAvgCoherence >= 66 &&
        (opts.phase === 'evidence' ||
          opts.phase === 'closing' ||
          opts.phase === 'verdict'))
    ) {
      this.baseMoodState = 'warm';
    } else {
      this.baseMoodState = 'neutral';
    }
  }

  public setManualMoodOverride(override: CourtMoodLevel | 'auto') {
    this.manualMoodOverride = override;
  }

  public setJudgeExpression(mode: 'normal' | 'head_shake' | 'intense_focus') {
    this.judgeExpressionMode = mode;
  }

  public triggerCriticalObjectionMood(durationSec = 4.2) {
    this.criticalMoodTimer = Math.max(this.criticalMoodTimer, durationSec);
  }

  private bindEvents() {
    const dom = this.renderer.domElement;

    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.composer) {
        this.composer.setSize(w, h);
      }
      if (this.bloomPass) {
        this.bloomPass.resolution.set(
          Math.max(1, Math.floor(w / 2)),
          Math.max(1, Math.floor(h / 2))
        );
      }
    };

    const updatePointer = (ev: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      _pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      this.isDragging = true;
      this.lastPointerX = ev.clientX;
      this.lastPointerY = ev.clientY;
    };

    let lastHoverCheck = 0;
    const onPointerMove = (ev: PointerEvent) => {
      if (this.isDragging) {
        const dx = ev.clientX - this.lastPointerX;
        const dy = ev.clientY - this.lastPointerY;
        this.lastPointerX = ev.clientX;
        this.lastPointerY = ev.clientY;
        this.dragYaw = THREE.MathUtils.clamp(this.dragYaw - dx * 0.004, -0.6, 0.6);
        this.dragPitch = THREE.MathUtils.clamp(this.dragPitch - dy * 0.003, -0.25, 0.35);
        return;
      }

      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;

      updatePointer(ev);
      _raycaster.layers.set(1);
      _raycaster.setFromCamera(_pointer, this.camera);
      const hits = _raycaster.intersectObjects(this.clickableMeshes, false);
      const hitId = hits.length > 0 ? (hits[0].object.userData.evidenceId as string) : null;
      if (hitId !== this.hoveredEvidenceId) {
        this.hoveredEvidenceId = hitId;
        dom.style.cursor = hitId ? 'pointer' : 'grab';
        this.callbacks.onHoverEvidence?.(hitId);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      const moved =
        Math.abs(ev.clientX - this.lastPointerX) + Math.abs(ev.clientY - this.lastPointerY);
      this.isDragging = false;
      if (moved < 6) {
        updatePointer(ev);
        _raycaster.layers.set(1);
        _raycaster.setFromCamera(_pointer, this.camera);
        const hits = _raycaster.intersectObjects(this.clickableMeshes, false);
        if (hits.length > 0) {
          const clickedObj = hits[0].object;
          const evId = clickedObj.userData.evidenceId as string;
          const jurorIdx = clickedObj.userData.jurorIndex as number;
          if (evId) {
            this.selectedEvidenceId = evId;
            this.callbacks.onSelectEvidence?.(evId);
          } else if (typeof jurorIdx === 'number') {
            this.callbacks.onSelectJuror?.(jurorIdx);
          }
        }
      }
    };

    window.addEventListener('resize', onResize);
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }

  private cleanupListeners: () => void = () => {};

  private updateCameraTargets(elapsed: number) {
    if (this.preset === 'title') {
      const pan = Math.sin(elapsed * 0.22);
      _camPosTarget.set(3.8 + pan * 2.2, 3.6 + Math.cos(elapsed * 0.18) * 0.35, 6.2);
      _camLookTarget.set(pan * 0.6, 1.35, -2.2);
      return;
    }

    switch (this.preset) {
      case 'judge':
        _camPosTarget.set(0.1, 2.7, -0.9);
        _camLookTarget.set(0, 1.85, -4.3);
        break;
      case 'prosecution':
        _camPosTarget.set(-0.6, 2.3, 2.5);
        _camLookTarget.set(-2.7, 1.25, -0.8);
        break;
      case 'defense':
        _camPosTarget.set(0.6, 2.3, 2.5);
        _camLookTarget.set(2.6, 1.25, -0.8);
        break;
      case 'witness':
        _camPosTarget.set(-0.8, 2.2, 0.3);
        _camLookTarget.set(-3.4, 1.35, -3.2);
        break;
      case 'evidence':
        _camPosTarget.set(0, 2.25, 1.5);
        _camLookTarget.set(0, 0.85, -0.35);
        break;
      case 'overview':
      default:
        _camPosTarget.set(0.0, 4.1, 6.4);
        _camLookTarget.set(0, 1.25, -1.7);
        break;
    }

    // Apply subtle user drag orbit around target
    _camPosTarget.x += this.dragYaw * 4.0;
    _camPosTarget.y = Math.max(1.2, _camPosTarget.y + this.dragPitch * 3.0);
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const elapsed = now / 1000;

    this.updateCameraTargets(elapsed);

    const k = 4.5;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camPosTarget.x, k, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camPosTarget.y, k, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camPosTarget.z, k, dt);

    _camLookCurrent.x = THREE.MathUtils.damp(_camLookCurrent.x, _camLookTarget.x, k, dt);
    _camLookCurrent.y = THREE.MathUtils.damp(_camLookCurrent.y, _camLookTarget.y, k, dt);
    _camLookCurrent.z = THREE.MathUtils.damp(_camLookCurrent.z, _camLookTarget.z, k, dt);
    this.camera.lookAt(_camLookCurrent);

    // Update atmospheric GLSL uniforms (god-rays, dust motes, evidence halo)
    for (const mat of this.godRayMaterials) {
      mat.uniforms.uTime.value = elapsed;
    }
    if (this.dustPointsMat) {
      this.dustPointsMat.uniforms.uTime.value = elapsed;
    }
    this.evidenceHaloMat.uniforms.uTime.value = elapsed;

    // Dynamic Trial Phase & Jury Mood Lighting interpolation
    if (this.criticalMoodTimer > 0) {
      this.criticalMoodTimer = Math.max(0, this.criticalMoodTimer - dt);
    }
    const effectiveMood: CourtMoodLevel =
      this.manualMoodOverride !== 'auto'
        ? this.manualMoodOverride
        : this.criticalMoodTimer > 0
          ? 'tense'
          : this.baseMoodState;

    let targetKeyIntensity = 1.85;
    let targetRimIntensity = 0.72;
    let targetSpotIntensity = 9.0;
    let targetBenchIntensity = 3.0;
    let targetHemiIntensity = 0.58;
    let targetWarmth = 0.045;
    let targetExposure = 1.12;

    if (effectiveMood === 'warm') {
      _moodKeyTarget.setHex(0xffd68e);
      _moodRimTarget.setHex(0xf0c27b);
      _moodSpotTarget.setHex(0xffe09c);
      _moodBenchTarget.setHex(0xffb85c);
      _moodHemiSkyTarget.setHex(0xe8d9be);
      _moodBgTarget.setHex(this.baseThemeBgHex).lerp(_moodWarmTint, 0.35);
      targetKeyIntensity = 2.2;
      targetRimIntensity = 0.58;
      targetSpotIntensity = 10.8;
      targetBenchIntensity = 3.5;
      targetHemiIntensity = 0.64;
      targetWarmth = 0.085;
      targetExposure = 1.16;
    } else if (effectiveMood === 'tense') {
      _moodKeyTarget.setHex(0xa2c5ec);
      _moodRimTarget.setHex(0x689ae8);
      _moodSpotTarget.setHex(0xd6e9ff);
      _moodBenchTarget.setHex(0x799fd1);
      _moodHemiSkyTarget.setHex(0x8fb0dc);
      _moodBgTarget.setHex(this.baseThemeBgHex).lerp(_moodTenseTint, 0.45);
      targetKeyIntensity = 1.42;
      targetRimIntensity = 1.45;
      targetSpotIntensity = 12.8;
      targetBenchIntensity = 2.1;
      targetHemiIntensity = 0.48;
      targetWarmth = -0.045;
      targetExposure = 1.06;
    } else {
      _moodKeyTarget.setHex(0xffe8c2);
      _moodRimTarget.setHex(0x9fb8db);
      _moodSpotTarget.setHex(0xffe3aa);
      _moodBenchTarget.setHex(0xffc578);
      _moodHemiSkyTarget.setHex(0xc9d7ea);
      _moodBgTarget.setHex(this.baseThemeBgHex);
    }

    const moodAlpha = Math.min(1, dt * 3.4);
    this.keyLight.color.lerp(_moodKeyTarget, moodAlpha);
    this.rimLight.color.lerp(_moodRimTarget, moodAlpha);
    this.speakerSpotLight.color.lerp(_moodSpotTarget, moodAlpha);
    this.benchLight.color.lerp(_moodBenchTarget, moodAlpha);
    this.hemiLight.color.lerp(_moodHemiSkyTarget, moodAlpha);

    this.keyLight.intensity = THREE.MathUtils.damp(this.keyLight.intensity, targetKeyIntensity, 4, dt);
    this.rimLight.intensity = THREE.MathUtils.damp(this.rimLight.intensity, targetRimIntensity, 4, dt);
    this.speakerSpotLight.intensity = THREE.MathUtils.damp(this.speakerSpotLight.intensity, targetSpotIntensity, 4, dt);
    this.benchLight.intensity = THREE.MathUtils.damp(this.benchLight.intensity, targetBenchIntensity, 4, dt);
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, targetHemiIntensity, 4, dt);
    this.renderer.toneMappingExposure = THREE.MathUtils.damp(
      this.renderer.toneMappingExposure,
      targetExposure,
      4,
      dt
    );

    if (this.keyLight && this.keyLight.shadow) {
      const targetBias = effectiveMood === 'tense' ? -0.0008 : effectiveMood === 'warm' ? -0.00035 : -0.0005;
      this.keyLight.shadow.bias = THREE.MathUtils.damp(this.keyLight.shadow.bias, targetBias, 6, dt);
    }

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(_moodBgTarget, moodAlpha);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.lerp(_moodBgTarget, moodAlpha);
    }
    if (this.atmospherePass) {
      this.atmospherePass.uniforms.uWarmth.value = THREE.MathUtils.damp(
        this.atmospherePass.uniforms.uWarmth.value,
        targetWarmth,
        4,
        dt
      );
    }

    // Smooth overhead speaker spotlight tracking
    if (this.activeSpeaker && this.characters.has(this.activeSpeaker)) {
      const spRig = this.characters.get(this.activeSpeaker)!;
      _spotTargetTarget.set(
        spRig.root.position.x,
        spRig.baseY + 1.15,
        spRig.root.position.z
      );
    } else {
      _spotTargetTarget.set(0, 0.9, -0.35);
    }
    this.speakerSpotLight.target.position.x = THREE.MathUtils.damp(
      this.speakerSpotLight.target.position.x,
      _spotTargetTarget.x,
      5,
      dt
    );
    this.speakerSpotLight.target.position.y = THREE.MathUtils.damp(
      this.speakerSpotLight.target.position.y,
      _spotTargetTarget.y,
      5,
      dt
    );
    this.speakerSpotLight.target.position.z = THREE.MathUtils.damp(
      this.speakerSpotLight.target.position.z,
      _spotTargetTarget.z,
      5,
      dt
    );

    // Decaying trauma shake on gavel impact / sharp objection
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * 0.04;
      this.camera.rotation.z += (Math.random() * 2 - 1) * shake;
      this.camera.rotation.x += (Math.random() * 2 - 1) * shake * 0.5;
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    }

    // Gavel slam strike & sound-block impact physics
    let gavelAngle = 0;
    if (this.gavelTimer > 0) {
      this.gavelTimer = Math.max(0, this.gavelTimer - dt);
      const p = 1 - this.gavelTimer / 0.72;

      if (p < 0.09) {
        const t = p / 0.09;
        gavelAngle = THREE.MathUtils.lerp(0, 0.85, 1 - Math.pow(1 - t, 2));
      } else if (p < 0.19) {
        const t = (p - 0.09) / 0.1;
        gavelAngle = THREE.MathUtils.lerp(0.85, 0, t * t);
      } else if (p < 0.34) {
        if (this.gavelImpactStep < 1) {
          this.gavelImpactStep = 1;
          this.gavelImpactAge = 0.001;
          this.trauma = Math.min(1, this.trauma + 0.42);
          this.soundBlockMesh.position.y = 1.596;
        }
        const t = (p - 0.19) / 0.15;
        gavelAngle = Math.sin(t * Math.PI * 0.5) * 0.94;
      } else if (p < 0.46) {
        const t = (p - 0.34) / 0.12;
        gavelAngle = THREE.MathUtils.lerp(0.94, 0, t * t);
      } else if (p < 0.62) {
        if (this.gavelImpactStep < 2) {
          this.gavelImpactStep = 2;
          this.gavelImpactAge = 0.001;
          this.trauma = Math.min(1, this.trauma + 0.55);
          this.soundBlockMesh.position.y = 1.594;
        }
        const t = (p - 0.46) / 0.16;
        gavelAngle = Math.sin(t * Math.PI) * 0.18;
      } else {
        gavelAngle = 0;
      }

      this.gavelPivot.rotation.x = gavelAngle;
    } else {
      this.gavelPivot.rotation.x = THREE.MathUtils.damp(this.gavelPivot.rotation.x, 0, 12, dt);
    }

    // Sound block recoil recovery & expanding gold impact ring
    this.soundBlockMesh.position.y = THREE.MathUtils.damp(
      this.soundBlockMesh.position.y,
      1.61,
      18,
      dt
    );
    if (this.gavelImpactAge > 0) {
      this.gavelImpactAge += dt;
      const ringT = this.gavelImpactAge / 0.26;
      if (ringT >= 1) {
        this.gavelImpactAge = 0;
        this.gavelImpactRing.visible = false;
        this.gavelImpactMat.opacity = 0;
      } else {
        this.gavelImpactRing.visible = true;
        const s = 0.9 + ringT * 1.65;
        this.gavelImpactRing.scale.set(s, s, 1);
        this.gavelImpactMat.opacity = (1 - ringT) * 0.9;
      }
    }

    // Character breathing, speaking, gavel sync & 3D gesture animations
    this.characters.forEach((rig, role) => {
      const isSpeaking = this.activeSpeaker === role || rig.speakingTimer > 0;
      if (rig.speakingTimer > 0) rig.speakingTimer = Math.max(0, rig.speakingTimer - dt);
      if (rig.gestureTimer > 0) {
        rig.gestureTimer = Math.max(0, rig.gestureTimer - dt);
        if (rig.gestureTimer === 0) rig.gesture = 'idle';
      }

      const breathe = Math.sin(elapsed * 2.1 + rig.root.position.x) * 0.012;
      const extraLift = rig.gesture === 'objection_point' && rig.gestureTimer > 0 ? 0.07 : 0;
      rig.root.position.y = rig.baseY + breathe + extraLift;

      // Toggle held hand props cleanly based on active gesture
      const activeGesture = rig.gestureTimer > 0 ? rig.gesture : 'idle';
      rig.paperProp.visible =
        activeGesture === 'read_papers' || activeGesture === 'note_points';
      rig.penProp.visible = activeGesture === 'note_points';

      if (role === 'Dommer' && this.gavelTimer > 0) {
        rig.rightArm.rotation.x = -0.32 - gavelAngle * 0.85;
        rig.rightArm.rotation.z = THREE.MathUtils.damp(rig.rightArm.rotation.z, 0, 8, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.25, 8, dt);
        rig.leftArm.rotation.z = THREE.MathUtils.damp(rig.leftArm.rotation.z, 0, 8, dt);
        rig.head.rotation.x = Math.max(-0.08, -gavelAngle * 0.09);
        rig.head.rotation.z = THREE.MathUtils.damp(rig.head.rotation.z, 0, 8, dt);
      } else if (role === 'Dommer' && this.judgeExpressionMode === 'head_shake') {
        rig.head.rotation.y = Math.sin(elapsed * 12.0) * 0.24;
        rig.head.rotation.x = 0.12;
        rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, -0.88, 8, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.4, 8, dt);
      } else if (role === 'Dommer' && this.judgeExpressionMode === 'intense_focus') {
        rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, 0.38, 10, dt);
        rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, 0, 10, dt);
        rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, -0.65, 10, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.65, 10, dt);
      } else if (activeGesture === 'read_papers') {
        rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, 0.28, 8, dt);
        rig.head.rotation.y = Math.sin(elapsed * 2.6) * 0.09;
        rig.head.rotation.z = THREE.MathUtils.damp(rig.head.rotation.z, 0, 8, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.94, 8, dt);
        rig.leftArm.rotation.z = THREE.MathUtils.damp(rig.leftArm.rotation.z, -0.2, 8, dt);
        rig.rightArm.rotation.x = THREE.MathUtils.damp(
          rig.rightArm.rotation.x,
          -0.78 + Math.sin(elapsed * 3.1) * 0.06,
          8,
          dt
        );
        rig.rightArm.rotation.z = THREE.MathUtils.damp(rig.rightArm.rotation.z, 0.16, 8, dt);
      } else if (activeGesture === 'skeptical') {
        rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, -0.06, 8, dt);
        rig.head.rotation.z = THREE.MathUtils.damp(rig.head.rotation.z, 0.16, 8, dt);
        rig.head.rotation.y = Math.sin(elapsed * 6.8) * 0.19;
        rig.rightArm.rotation.x = THREE.MathUtils.damp(
          rig.rightArm.rotation.x,
          -1.08 + Math.sin(elapsed * 5.2) * 0.12,
          9,
          dt
        );
        rig.rightArm.rotation.z = THREE.MathUtils.damp(rig.rightArm.rotation.z, 0.28, 9, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.35, 8, dt);
        rig.leftArm.rotation.z = THREE.MathUtils.damp(rig.leftArm.rotation.z, -0.2, 8, dt);
      } else if (activeGesture === 'note_points') {
        rig.head.rotation.x = THREE.MathUtils.damp(
          rig.head.rotation.x,
          0.22 + Math.sin(elapsed * 4.5) * 0.05,
          8,
          dt
        );
        rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, 0.06, 8, dt);
        rig.head.rotation.z = THREE.MathUtils.damp(rig.head.rotation.z, 0, 8, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.76, 8, dt);
        rig.leftArm.rotation.z = THREE.MathUtils.damp(rig.leftArm.rotation.z, -0.15, 8, dt);
        rig.rightArm.rotation.x = -0.72 + Math.sin(elapsed * 14.0) * 0.13;
        rig.rightArm.rotation.z = 0.08 * Math.cos(elapsed * 11.0);
      } else if (activeGesture === 'objection_point') {
        rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, -0.06, 10, dt);
        rig.head.rotation.y = Math.sin(elapsed * 4.2) * 0.08;
        rig.head.rotation.z = THREE.MathUtils.damp(rig.head.rotation.z, 0, 8, dt);
        rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, -1.42, 12, dt);
        rig.rightArm.rotation.z = THREE.MathUtils.damp(rig.rightArm.rotation.z, 0.06, 10, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.3, 8, dt);
        rig.leftArm.rotation.z = THREE.MathUtils.damp(rig.leftArm.rotation.z, 0, 8, dt);
      } else if (isSpeaking) {
        rig.rightArm.rotation.x = -0.8 + Math.sin(elapsed * 8.5) * 0.35;
        rig.rightArm.rotation.z = THREE.MathUtils.damp(rig.rightArm.rotation.z, 0, 6, dt);
        rig.leftArm.rotation.x = -0.4 + Math.cos(elapsed * 6.5) * 0.2;
        rig.leftArm.rotation.z = THREE.MathUtils.damp(rig.leftArm.rotation.z, 0, 6, dt);
        rig.head.rotation.y = Math.sin(elapsed * 3.2) * 0.12;
        rig.head.rotation.z = THREE.MathUtils.damp(rig.head.rotation.z, 0, 6, dt);
      } else {
        rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 0, 6, dt);
        rig.rightArm.rotation.z = THREE.MathUtils.damp(rig.rightArm.rotation.z, 0, 6, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0, 6, dt);
        rig.leftArm.rotation.z = THREE.MathUtils.damp(rig.leftArm.rotation.z, 0, 6, dt);
        rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, 0, 5, dt);
        rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, 0, 5, dt);
        rig.head.rotation.z = THREE.MathUtils.damp(rig.head.rotation.z, 0, 5, dt);
      }
    });

    // Subtle Jury attentiveness: 6 jurors gently angle toward active speaker
    const juryTargetYaw =
      this.activeSpeaker === 'Anklager'
        ? -0.22
        : this.activeSpeaker === 'Forsvarer'
          ? 0.18
          : this.activeSpeaker === 'Dommer'
            ? -0.34
            : 0;
    for (let i = 0; i < this.jurors.length; i++) {
      const juror = this.jurors[i];
      juror.root.position.y = juror.baseY + Math.sin(elapsed * 1.9 + i * 0.8) * 0.008;
      juror.head.rotation.y = THREE.MathUtils.damp(
        juror.head.rotation.y,
        juryTargetYaw + Math.sin(elapsed * 0.9 + i) * 0.04,
        4,
        dt
      );
    }

    // Lift, Fresnel inspection ring, and dynamic 3D attachment animation on evidence exhibits
    let activeHaloTarget: THREE.Object3D | null = null;
    let haloScale = 1.0;
    let haloExtraIntensity = 0.0;

    const anim = this.activeAttachmentAnim;
    let animProgress = -1;
    if (anim) {
      const animElapsed = elapsed - anim.startTime;
      if (animElapsed >= anim.duration) {
        this.activeAttachmentAnim = null;
      } else {
        animProgress = Math.min(1.0, Math.max(0, animElapsed / anim.duration));
      }
    }

    for (const child of this.evidenceGroup.children) {
      const id = child.userData.evidenceId as string;
      const isSelected = id === this.selectedEvidenceId;
      const isHovered = id === this.hoveredEvidenceId;
      const isAnimating = anim && anim.evidenceId === id && animProgress >= 0;

      if (isAnimating) {
        // 3D Levitation & Presentation: lifts up from desk (0.84) to mid-air (1.30m), floats and turns to camera
        const flightCurve = Math.sin(animProgress * Math.PI); // 0 -> 1 -> 0
        const floatBob = Math.sin(animProgress * Math.PI * 4) * 0.035;
        const targetY = 0.84 + flightCurve * 0.44 + floatBob;
        child.position.y = THREE.MathUtils.damp(child.position.y, targetY, 12, dt);

        const baseRotY = (child.userData.baseRotY as number) || 0;
        child.rotation.y = baseRotY + flightCurve * 0.72 + Math.sin(elapsed * 2.5) * 0.06;
        child.rotation.x = Math.sin(animProgress * Math.PI) * 0.12;

        activeHaloTarget = child;
        haloScale = anim.isKeyEvidence ? 2.6 : 1.9;
        haloExtraIntensity = flightCurve * 1.8;

        if (this.evidenceSpot) {
          this.evidenceSpot.intensity = THREE.MathUtils.damp(
            this.evidenceSpot.intensity,
            anim.isKeyEvidence ? 7.2 : 4.8,
            8,
            dt
          );
        }
      } else {
        const targetY = isSelected ? 0.96 : isHovered ? 0.9 : 0.84;
        child.position.y = THREE.MathUtils.damp(child.position.y, targetY, 10, dt);
        const baseRotY = (child.userData.baseRotY as number) || 0;
        child.rotation.y = THREE.MathUtils.damp(child.rotation.y, baseRotY, 8, dt);
        child.rotation.x = THREE.MathUtils.damp(child.rotation.x, 0, 8, dt);
        if (isSelected || (!this.selectedEvidenceId && isHovered)) {
          activeHaloTarget = child;
          haloScale = 1.0;
        }
      }
    }

    if (activeHaloTarget) {
      this.evidenceHaloMesh.visible = true;
      this.evidenceHaloMesh.position.x = activeHaloTarget.position.x;
      this.evidenceHaloMesh.position.z = activeHaloTarget.position.z;
      this.evidenceHaloMesh.position.y = Math.min(activeHaloTarget.position.y - 0.02, 1.25);
      this.evidenceHaloMesh.scale.set(haloScale, haloScale, 1.0);
      this.evidenceHaloMesh.rotation.z = elapsed * (haloScale > 1.5 ? 2.4 : 0.9);
      if (this.evidenceHaloMat?.uniforms?.uIntensity) {
        this.evidenceHaloMat.uniforms.uIntensity.value = 1.0 + haloExtraIntensity;
      }
    } else {
      this.evidenceHaloMesh.visible = false;
      if (this.evidenceSpot && !anim) {
        this.evidenceSpot.intensity = THREE.MathUtils.damp(this.evidenceSpot.intensity, 2.4, 6, dt);
      }
    }

    if (!this.isSoftwareGl && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    if (this.disposed) return;
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } catch {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.cleanupListeners();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat?.dispose();
        }
      }
    });

    if (this.composer) {
      this.composer.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
