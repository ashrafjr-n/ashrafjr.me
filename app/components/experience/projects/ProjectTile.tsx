import { Line, Text, useTexture } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";
import { isMobile } from "react-device-detect";
import * as THREE from "three";

import { usePortalStore } from "@stores";
import { Project } from "@types";

interface ProjectTileProps {
  project: Project;
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  activeId: number | null;
  onClick: () => void;
  datePosition: 'top' | 'bottom';
}

const FONT = "./Vercetti-Regular.woff";
/**
 * Vercetti has no Greek letters (only the π symbol), so a Greek title
 * (παλιγγενεσία) is set whole in GFS Didot. One font per title: troika 0.52
 * takes a single font URL (a list of fonts hangs the scene).
 */
const GREEK = "./fonts/gfs-didot/GFSDidot-Regular.ttf";
const titleFont = (title: string) => /[\u0370-\u03ff\u1f00-\u1fff]/.test(title) ? GREEK : FONT;

/** The card: a screenshot on top, a black band with the title below. */
const WIDTH = 4.2;
const IMAGE_HEIGHT = 2.3;
const BAND = 0.75;
const HEIGHT = IMAGE_HEIGHT + BAND;
const ROW_Y = -HEIGHT / 2 + BAND / 2;
const LEFT = -WIDTH / 2 + 0.25;

const TITLE_SIZE = 0.36;
const TITLE_ROOM = 3.4;

/** IN PROGRESS: a pill on the screenshot's top-right corner. */
const BADGE_WIDTH = 1.1;
const BADGE_HEIGHT = 0.26;

/** The technology pills shown on hover, below the band. */
const TAG_SIZE = 0.16;
const TAG_HEIGHT = 0.34;
const TAG_PAD = 0.14;
const TAG_GAP = 0.1;

/** A closed rounded rectangle for drei's Line, centred on 0. */
const pill = (w: number, h: number, r = h / 2): [number, number, number][] => {
  const points: [number, number, number][] = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]];
  for (const [x, y, quarter] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = (quarter + i / 6) * Math.PI / 2;
      points.push([x + r * Math.cos(a), y + r * Math.sin(a), 0]);
    }
  }
  points.push(points[0]);
  return points;
};

/** The same outline as a filled shape, for the badge's backing. */
const pillShape = (w: number, h: number) => new THREE.Shape(pill(w, h).map(([x, y]) => new THREE.Vector2(x, y)));

/** The pills rise this much as they appear. */
const TAG_RISE = 0.15;

/** Fades every text and line under a group (troika texts by fillOpacity). */
const fade = (group: THREE.Object3D, tl: gsap.core.Timeline, to: number, at: number, duration: number) => {
  group.traverse((child) => {
    if ('fillOpacity' in child) tl.to(child, { fillOpacity: to, duration }, at);
    else if (child instanceof THREE.Mesh) tl.to(child.material, { opacity: to, duration }, at);
  });
};

const ProjectTile = ({ project, index, position, rotation, activeId, onClick, datePosition }: ProjectTileProps) => {
  const projectRef = useRef<THREE.Group>(null);
  const backRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Group>(null);
  const tagsRef = useRef<THREE.Group>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const hoverAnimRef = useRef<gsap.core.Timeline | null>(null);
  const [desktopHovered, setDesktopHovered] = useState(false);
  const isProjectSectionActive = usePortalStore((state) => state.activePortalId === "projects");
  const hovered = isMobile ? activeId === index : desktopHovered && isProjectSectionActive;
  const isTop = datePosition === 'top';
  const isRepo = project.url?.includes('github.com');

  // The screenshot fills the image area like CSS `cover`, keeping its top.
  const texture = useTexture(project.image);
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const { width, height } = texture.image as HTMLImageElement;
    const ratio = (width / height) / (WIDTH / IMAGE_HEIGHT);
    if (ratio > 1) {
      texture.repeat.set(1 / ratio, 1);
      texture.offset.set((1 - 1 / ratio) / 2, 0);
    } else {
      texture.repeat.set(1, ratio);
      texture.offset.set(0, 1 - ratio);
    }
  }, [texture]);

  // The footer's GitHub icon, as an image: drei's <Svg> mangled its shape.
  const github = useTexture('icons/github.svg');
  const badgeShape = useMemo(() => pillShape(BADGE_WIDTH, BADGE_HEIGHT), []);

  // A title wider than its room is shrunk once (onSync runs after every render).
  const [titleSize, setTitleSize] = useState(TITLE_SIZE);
  const onTitleSync = (text: { textRenderInfo?: { blockBounds: number[] } }) => {
    const bounds = text.textRenderInfo?.blockBounds;
    if (!bounds || titleSize !== TITLE_SIZE) return;
    const width = bounds[2] - bounds[0];
    if (width > TITLE_ROOM) setTitleSize(TITLE_SIZE * TITLE_ROOM / width);
  };

  // Pills wrap into rows once every label has been measured.
  const [tagWidths, setTagWidths] = useState<number[]>([]);
  const tags = useMemo(() => {
    if (tagWidths.filter(Boolean).length < project.tech.length) return null;
    let x = 0, row = 0;
    const placed = tagWidths.map((textWidth) => {
      const w = textWidth + TAG_PAD * 2;
      if (x > 0 && x + w > WIDTH - 0.5) { x = 0; row++; }
      const tag = { x: LEFT + x + w / 2, y: -HEIGHT / 2 - 0.2 - TAG_HEIGHT / 2 - row * (TAG_HEIGHT + TAG_GAP), w };
      x += w + TAG_GAP;
      return tag;
    });
    return { placed, height: (row + 1) * (TAG_HEIGHT + TAG_GAP) + 0.3 };
  }, [tagWidths, project.tech.length]);

  useEffect(() => {
    if (!projectRef.current || !backRef.current || !lineRef.current || !tagsRef.current) return;
    hoverAnimRef.current?.kill();
    const extra = hovered && tags ? tags.height : 0;

    hoverAnimRef.current = gsap.timeline();
    hoverAnimRef.current
      .to(projectRef.current.position, { z: hovered ? 1 : 0, duration: 0.2 }, 0)
      .to(projectRef.current.position, { y: hovered ? isTop ? -2 : 0 : 0 }, 0)
      .to(projectRef.current.scale, {
        x: hovered ? 1.3 : 1,
        y: hovered ? 1.3 : 1,
        z: hovered ? 1.3 : 1,
      }, 0)
      // The black card grows down to hold the technologies.
      .to(backRef.current.scale, { y: (HEIGHT + extra) / HEIGHT }, 0)
      .to(backRef.current.position, { y: -extra / 2 }, 0)
      .to(lineRef.current.position, { y: -HEIGHT / 2 - extra }, 0);

    // The pills rise and fade in one after another once the card has grown,
    // and all leave at once.
    if (tags) {
      tagsRef.current.children.forEach((tag, i) => {
        const at = hovered ? 0.2 + i * 0.06 : 0;
        const duration = hovered ? 0.5 : 0.15;
        hoverAnimRef.current!.to(tag.position, { y: tags.placed[i].y - (hovered ? 0 : TAG_RISE), duration, ease: 'power3.out' }, at);
        fade(tag, hoverAnimRef.current!, hovered ? 1 : 0, at, duration);
      });
    }
  }, [hovered, tags]);

  useEffect(() => {
    if (projectRef.current) {
      gsap.to(projectRef.current.position, {
        y: isProjectSectionActive ? 0 : -11,
        duration: 1,
        delay: isProjectSectionActive ? index * 0.1 : 0,
      });
    }
  }, [isProjectSectionActive]);

  // The IN PROGRESS dot breathes.
  useEffect(() => {
    if (!dotRef.current) return;
    const pulse = gsap.to(dotRef.current.scale, { x: 1.6, y: 1.6, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    return () => { pulse.kill(); };
  }, []);

  const openProject = () => {
    if (project.url) setTimeout(() => window.open(project.url, '_blank'), 50);
  };

  // Desktop: the whole card opens the project. Mobile: a tap shows its
  // technologies (ProjectsCarousel), the button opens it.
  const handleCardClick = (e: ThreeEvent<MouseEvent>) => {
    if (isMobile) return onClick();
    e.stopPropagation();
    openProject();
  };

  const handleButtonClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const button = e.eventObject;
    gsap.to(button.scale, { x: 0.8, y: 0.8, duration: 0.1 })
      .then(() => gsap.to(button.scale, { x: 1, y: 1, duration: 0.3 }));
    openProject();
  };

  const handlePointerOver = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isMobile && isProjectSectionActive) {
      setDesktopHovered(true);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    if (isMobile) return;
    setDesktopHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={handleCardClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}>
      <group ref={projectRef}>
        <mesh ref={backRef}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial color="#000" toneMapped={false} />
        </mesh>

        <mesh position={[0, HEIGHT / 2 - IMAGE_HEIGHT / 2, 0.01]}>
          <planeGeometry args={[WIDTH, IMAGE_HEIGHT]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>

        {/* The date, as a chip on the screenshot's corner. */}
        <group position={[LEFT + 0.55, HEIGHT / 2 - 0.3, 0.02]}>
          <mesh>
            <planeGeometry args={[1.1, 0.3]} />
            <meshBasicMaterial color="#000" transparent opacity={0.75} toneMapped={false} />
          </mesh>
          <Text font={FONT} color="white" fontSize={0.14} letterSpacing={0.15} anchorX="center" anchorY="middle" position={[0, 0, 0.01]}>
            {project.date.toUpperCase()}
          </Text>
        </group>

        <Text
          font={titleFont(project.title)}
          color="white"
          position={[LEFT, ROW_Y, 0.02]}
          anchorX="left"
          anchorY="middle"
          fontSize={titleSize}
          onSync={onTitleSync}>
          {project.title}
        </Text>

        {project.inProgress && (
          <group position={[WIDTH / 2 - 0.15 - BADGE_WIDTH / 2, HEIGHT / 2 - 0.15 - BADGE_HEIGHT / 2, 0.02]}>
            <mesh>
              <shapeGeometry args={[badgeShape]} />
              <meshBasicMaterial color="#000" transparent opacity={0.75} toneMapped={false} />
            </mesh>
            <Line points={pill(BADGE_WIDTH, BADGE_HEIGHT)} color="#4c6ef5" lineWidth={1.5} position={[0, 0, 0.005]} />
            <mesh ref={dotRef} position={[-BADGE_WIDTH / 2 + 0.15, 0, 0.01]}>
              <circleGeometry args={[0.035, 24]} />
              <meshBasicMaterial color="#4c6ef5" toneMapped={false} />
            </mesh>
            <Text font={FONT} color="#8da2ff" fontSize={0.095} letterSpacing={0.15} anchorX="left" anchorY="middle" position={[-BADGE_WIDTH / 2 + 0.26, 0, 0.01]}>
              IN PROGRESS
            </Text>
          </group>
        )}

        {project.url && (
          <group position={[WIDTH / 2 - 0.4, ROW_Y, 0.02]} onClick={handleButtonClick}>
            {/* An invisible square so the whole button takes the click. */}
            <mesh>
              <planeGeometry args={[0.5, 0.5]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
            {isRepo
              ? <mesh position={[0, 0, 0.01]}>
                <planeGeometry args={[0.4, 0.4]} />
                <meshBasicMaterial map={github} transparent toneMapped={false} />
              </mesh>
              : <Text font={FONT} color="white" fontSize={0.42} anchorX="center" anchorY="middle">↗</Text>}
          </group>
        )}

        <group ref={lineRef} position={[0, -HEIGHT / 2, 0.02]}>
          <Line points={[[-WIDTH / 2, 0, 0], [WIDTH / 2, 0, 0]]} color="white" lineWidth={1} />
        </group>

        <group ref={tagsRef}>
          {project.tech.map((tech, i) => {
            const tag = tags?.placed[i];
            return (
              <group key={tech} position={tag ? [tag.x, tag.y - TAG_RISE, 0.02] : [0, 0, -1]}>
                {tag && <Line points={pill(tag.w, TAG_HEIGHT)} color="#666" lineWidth={1} transparent opacity={0} raycast={() => null} />}
                <Text
                  font={FONT}
                  color="white"
                  fontSize={TAG_SIZE}
                  letterSpacing={0.05}
                  anchorX="center"
                  anchorY="middle"
                  fillOpacity={0}
                  // Hidden pills sit below the card: they mustn't take the hover.
                  raycast={() => null}
                  onSync={(text: { textRenderInfo?: { blockBounds: number[] } }) => {
                    const bounds = text.textRenderInfo?.blockBounds;
                    if (!bounds || tagWidths[i]) return;
                    setTagWidths((widths) => Object.assign([...widths], { [i]: bounds[2] - bounds[0] }));
                  }}>
                  {tech}
                </Text>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
};

export default ProjectTile;
