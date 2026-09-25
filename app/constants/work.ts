import * as THREE from "three";
import { WorkTimelinePoint } from "../types";

// Placeholders (YYYY / University / Company / Role) until the real history is in.
export const WORK_TIMELINE: WorkTimelinePoint[] = [
  {
    point: new THREE.Vector3(0, 0, 0),
    year: 'YYYY',
    title: 'University',
    subtitle: 'Computer Science',
    position: 'right',
  },
  {
    point: new THREE.Vector3(-4, -4, -3),
    year: 'YYYY',
    title: 'Company',
    subtitle: 'Role',
    position: 'left',
  },
  {
    point: new THREE.Vector3(-3, -1, -6),
    year: 'YYYY',
    title: 'Company',
    subtitle: 'Role',
    position: 'left',
  },
  {
    point: new THREE.Vector3(0, -1, -10),
    year: 'YYYY',
    title: 'Company',
    subtitle: 'Role',
    position: 'left',
  },
  {
    point: new THREE.Vector3(1, 1, -12),
    year: new Date().toLocaleDateString('default', { year: 'numeric' }),
    title: 'Living...',
    subtitle: 'Building toward AI',
    position: 'right',
  }
]
