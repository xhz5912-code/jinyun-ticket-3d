import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// 轻色散 pass：常驻 amount 0，转场时脉冲拉高
const ChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      vec2 off = dir * uAmount * 0.012;
      float r = texture2D(tDiffuse, vUv + off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - off).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloomPass: UnrealBloomPass;
  private readonly chromaPass: ShaderPass;
  private chromaAmount = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 6.2);
    this.camera.lookAt(0, 0, 0);

    // 暖色环境光 + 正面柔光 + 侧逆金光
    this.scene.add(new THREE.AmbientLight(0xf5e6c8, 0.85));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.1);
    key.position.set(2, 3, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd4af37, 0.5);
    rim.position.set(-3, -1, -2);
    this.scene.add(rim);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, // strength
      0.5,  // radius
      0.7,  // threshold（不低于 0.6）
    );
    this.composer.addPass(this.bloomPass);

    this.chromaPass = new ShaderPass(ChromaticShader);
    this.composer.addPass(this.chromaPass);

    this.composer.addPass(new OutputPass());
  }

  /** 转场时脉冲色散，随后自然衰减回 0 */
  pulseChroma(amount: number) {
    this.chromaAmount = Math.max(this.chromaAmount, amount);
  }

  update(dt: number) {
    this.chromaAmount = Math.max(0, this.chromaAmount - dt * 2.2);
    this.chromaPass.uniforms.uAmount.value = this.chromaAmount;
  }

  render() {
    this.composer.render();
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }
}
