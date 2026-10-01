import { ScrollControls } from "@react-three/drei";
import { usePortalStore, useScrollStore } from "@stores";
import { useEffect } from "react";
import * as THREE from "three";
import { VanGogh } from "../../models/VanGogh";
import Timeline from "./Timeline";

/**
 * The café diorama around the camera's path (WORK_TIMELINE): the first point
 * opens low on the cobbles, the café on the left and the tree on the right,
 * and the path rises toward the stars. Turned so that view looks down −z,
 * where the camera always looks; numbers checked so the frame stays covered.
 */
const SCENE_SCALE = 12;
const SCENE_POSITION = new THREE.Vector3(-12.458, -12.6, -0.78);
const SCENE_ROTATION = new THREE.Euler(0, 2.3996, 0);

const Work = () => {
  const isActive = usePortalStore((state) => state.activePortalId === 'work');
  const { scrollProgress, setScrollProgress } = useScrollStore();

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight - target.clientHeight;
    const progress = Math.min(Math.max(scrollTop / scrollHeight, 0), 1);
    setScrollProgress(progress);
  }

  // Hack: If the portal is active, add the scroll event listener to the scroll
  // wrapper div. If the portal is not active, remove the scroll event listener.
  // ScrollControls doesn't work out of the box, so we have to manually handle
  // the scroll event.
  useEffect(() => {
    if (isActive) {
      const scrollWrapper = document.querySelector('div[style*="z-index: -1"]') as HTMLElement;
      const originalScrollWrapper = document.querySelector('div[style*="z-index: 1"]') as HTMLElement;
      setScrollProgress(0);
      scrollWrapper.addEventListener('scroll', handleScroll)
      scrollWrapper.style.zIndex = '1';
      originalScrollWrapper.style.zIndex = '-1';
    } else {
      const scrollWrapper = document.querySelector('div[style*="z-index: 1"]') as HTMLElement;
      const originalScrollWrapper = document.querySelector('div[style*="z-index: -1"]') as HTMLElement;

      if (scrollWrapper) {
        scrollWrapper.scrollTo({ top: 0, behavior: 'smooth' });
        setScrollProgress(0);
        scrollWrapper.removeEventListener('scroll', handleScroll);
        scrollWrapper.style.zIndex = '-1';
        originalScrollWrapper.style.zIndex = '1';
      }
    }
  }, [isActive]);

  return (
    <group>
      <mesh receiveShadow>
        <planeGeometry args={[4, 4, 1]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
      <ScrollControls style={{ zIndex: -1}} pages={2} maxSpeed={0.4}>
        <VanGogh scale={SCENE_SCALE} position={SCENE_POSITION} rotation={SCENE_ROTATION}/>
        <Timeline progress={isActive ? scrollProgress : 0} />
      </ScrollControls>
    </group>
  );
};

export default Work;