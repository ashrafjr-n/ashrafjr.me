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
const RAISE = 1.5;
/** The diorama's lowest point, the pivot of its lean. */
const BOTTOM = -22.88;
/** Top leans over the camera, bottom stays put: its hollow fills the top of the frame. */
const TILT = 16 * Math.PI / 180;

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
    {/* On the portal's scene (a direct child); scaled with the diorama (×20/11) so its colours keep. */}
    <fog attach="fog" args={['#000000', 27, 82]} />
    <group position={[0, RAISE, 0]}>
      {/* The camera stands inside the diorama: its sky wall behind the cards,
          big enough to fill the frame at any pan, its ground clear of them. */}
      <group position={[0, BOTTOM, 0]} rotation={[TILT, 0, 0]}>
        <StarryNight scale={new THREE.Vector3(20, 20, 20)} position={new THREE.Vector3(11.64, -38.14 - BOTTOM, -15.18)}/>
      </group>
      <ProjectsCarousel />
      { isActive && isMobile && <TouchPanControls /> }
    </group>
  </>);
};

export default Projects;
