/*
Van Gogh (Café Terrace at Night), Tilt Brush
Files: van_gogh.glb [31.79MB] > gltf-transform unlit, optimize (meshopt, webp) [5.87MB]
Author: Alicezq (https://sketchfab.com/Alisa.Nozhnina)
License: CC-BY-SA-4.0 (http://creativecommons.org/licenses/by-sa/4.0/)
Source: https://sketchfab.com/3d-models/van-gogh-d828cf07eacd4f14bb48576731ec7833
Title: Van Gogh
*/

import * as THREE from 'three'
import { JSX } from 'react'
import { Clone, useGLTF } from '@react-three/drei'

const URL = 'models/van_gogh.glb'

/** The same curve as StarryNight's: Tilt Brush's colours, as painted. */
const DARKEN = 2.2

/** Pushes the darks and mid-tones down, once per geometry (useGLTF caches them). */
function darken(scene: THREE.Object3D) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const { geometry } = object
    const color = geometry.getAttribute('color')
    if (!color || geometry.userData.darkened) return
    for (let i = 0; i < color.count; i++) {
      for (let c = 0; c < 3; c++) color.setComponent(i, c, color.getComponent(i, c) ** DARKEN)
    }
    color.needsUpdate = true
    geometry.userData.darkened = true
  })
}

/** 292 brush meshes, so the scene is cloned whole rather than listed (it is shown twice: here and in the Preloader). */
export function VanGogh(props: JSX.IntrinsicElements['group']) {
  const { scene } = useGLTF(URL)
  darken(scene)
  return (
    <group {...props} dispose={null}>
      <Clone object={scene} />
    </group>
  )
}

useGLTF.preload(URL)
