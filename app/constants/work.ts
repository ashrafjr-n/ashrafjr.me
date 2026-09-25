import * as THREE from "three";
import { WorkTimelinePoint } from "../types";

export const WORK_TIMELINE: WorkTimelinePoint[] = [
  {
    point: new THREE.Vector3(0, 0, 0),
    year: '2023',
    title: 'Gulf College',
    subtitle: 'Computer Science · Muscat',
    position: 'right',
  },
  {
    point: new THREE.Vector3(-4, -4, -3),
    year: '2024',
    title: 'AI Major',
    subtitle: 'Specialising in Artificial Intelligence',
    position: 'left',
  },
  {
    point: new THREE.Vector3(-3, -1, -6),
    year: '2025',
    title: 'Full-Stack',
    subtitle: 'Building for the web, end to end',
    position: 'left',
  },
  {
    point: new THREE.Vector3(1, 1, -12),
    year: new Date().toLocaleDateString('default', { year: 'numeric' }),
    title: 'Now',
    subtitle: 'Building toward AI',
    position: 'right',
  }
]
