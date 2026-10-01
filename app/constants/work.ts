import * as THREE from "three";
import { WorkTimelinePoint } from "../types";

// The camera follows this path through the café (work/index.tsx): low on the
// cobbles, past the terrace, up toward the stars. Every label sits on the
// right, over the dark street and sky; the café on the left is too bright
// for white text.
export const WORK_TIMELINE: WorkTimelinePoint[] = [
  {
    point: new THREE.Vector3(0, 0, 0),
    year: '2023',
    title: 'Gulf College',
    subtitle: 'Computer Science · Muscat',
    position: 'right',
  },
  {
    point: new THREE.Vector3(-1.68, 1.2, -1.68),
    year: '2024',
    title: 'AI Major',
    subtitle: 'Specialising in Artificial Intelligence',
    position: 'right',
  },
  {
    point: new THREE.Vector3(-2.16, 3, -3.24),
    year: '2025',
    title: 'Full-Stack',
    subtitle: 'Building for the web, end to end',
    position: 'right',
  },
  {
    point: new THREE.Vector3(-0.6, 4.08, -6.24),
    year: new Date().toLocaleDateString('default', { year: 'numeric' }),
    title: 'Now',
    subtitle: 'Building toward AI',
    position: 'right',
  }
]
