import * as THREE from 'three';
import { TICKET_W, TICKET_H, Ticket } from './ticket';

export interface Hotspot {
  id: string;
  name: string;
  /** 票面 UV（左上角原点，u 向右，v = 1 - y/h） */
  u: number;
  v: number;
  radius: number;
}

export const HOTSPOTS: Hotspot[] = [
  { id: 'xitai', name: '古戏台', u: 0.5, v: 0.51, radius: 0.18 },
  { id: 'yueqin', name: '月琴', u: 0.115, v: 0.76, radius: 0.1 },
  { id: 'kuaiban', name: '快板', u: 0.115, v: 0.33, radius: 0.1 },
];

export class Hotspots {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private hovered: Hotspot | null = null;
  private glowIntensity = 0;

  constructor(private readonly ticket: Ticket) {}

  /** 由 NDC 指针坐标做射线拾取，返回命中的热点 */
  pick(nx: number, ny: number, camera: THREE.Camera): Hotspot | null {
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObject(this.ticket.pickPlane, false);
    if (hits.length === 0) return null;
    const uv = hits[0].uv;
    if (!uv) return null;
    // three PlaneGeometry 的 uv 原点为左下，转为左上角原点 v'=1-y
    const u = uv.x;
    const v = 1 - uv.y;
    for (const h of HOTSPOTS) {
      const du = (u - h.u) * TICKET_W;
      const dv = (v - h.v) * TICKET_H;
      const rr = h.radius * Math.max(TICKET_W, TICKET_H);
      if (Math.hypot(du, dv) <= rr) return h;
    }
    return null;
  }

  /** 热点中心的世界坐标（供粒子转场收拢用） */
  worldCenter(h: Hotspot, out: THREE.Vector3): THREE.Vector3 {
    out.set((h.u - 0.5) * TICKET_W, (0.5 - h.v) * TICKET_H, 0.06);
    return this.ticket.pivot.localToWorld(out);
  }

  /** 每帧更新悬停高亮泛光 */
  updateHover(dt: number, target: Hotspot | null) {
    this.hovered = target;
    const goal = target ? 0.85 : 0;
    this.glowIntensity += (goal - this.glowIntensity) * (1 - Math.exp(-dt * 8));
    if (this.glowIntensity < 0.01) this.glowIntensity = 0;
    const h = this.hovered ?? this.lastShown;
    if (h && this.glowIntensity > 0) {
      this.ticket.setGlow(h.u, h.v, h.radius, this.glowIntensity);
      this.lastShown = h;
    } else if (this.glowIntensity === 0) {
      this.ticket.setGlow(0.5, 0.5, 0.1, 0);
    }
  }

  private lastShown: Hotspot | null = null;
}
