import { useScroll } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect } from "react";
import { isMobile } from "react-device-detect";
import * as THREE from "three";
import { usePortalStore } from "@stores";
import { StarryNight } from "../../models/StarryNight";
import ProjectsCarousel from "./ProjectsCarousel";
import { TouchPanControls } from "./TouchPanControls";

/** Diorama and cards together, up from the camera: the scene is seen from lower down. */
const RAISE = 1;
/** The diorama's lowest point, the pivot of its lean. */
const BOTTOM = -12.06;
/** Top leans toward the camera, bottom stays put. Past ~4° its ground crosses the cards. */
const TILT = 4 * Math.PI / 180;

const Projects = () => {
  const { camera } = useThree();
  const isActive = usePortalStore((state) => state.activePortalId === "projects");
  const data = useScroll();

  useEffect(() => {
    // Hide scrollbar when active.
    data.el.style.overflow = isActive ? 'hidden' : 'auto';
    if (isActive) {
      if (isMobile) {
        gsap.to(camera.position, { z: 11.5, y: -39, x: 1, duration: 1 });
      } else {
        gsap.to(camera.position, { y: -39, x: 2, duration: 1 });
      }
    }
  }, [isActive]);

  useFrame((state, delta) => {
    if (isActive) {
      if (!isMobile) {
        // ±30° around the cards, whose arc sits π / 12 to the right (ProjectsCarousel).
        camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, -(Math.PI / 12 + (state.pointer.x * Math.PI) / 6), 0.03);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 11.5 - state.pointer.y, 7, delta);
      }
    }
  });

  return (<>
    {/* On the portal's scene (a direct child), the diorama's edges melt into the black. */}
    <fog attach="fog" args={['#000000', 15, 45]} />
    <group position={[0, RAISE, 0]}>
      {/* The camera stands inside the diorama: its sky wall behind the cards,
          its ground low enough that nothing crosses them. */}
      <group position={[0, BOTTOM, 0]} rotation={[TILT, 0, 0]}>
        <StarryNight scale={new THREE.Vector3(11, 11, 11)} position={new THREE.Vector3(4.4, -20.24 - BOTTOM, -12.54)}/>
      </group>
      <ProjectsCarousel />
      { isActive && isMobile && <TouchPanControls /> }
    </group>
  </>);
};

export default Projects;
