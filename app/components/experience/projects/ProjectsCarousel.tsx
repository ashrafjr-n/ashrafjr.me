import { useMemo, useState } from "react";
import { isMobile } from "react-device-detect";
import ProjectTile from "./ProjectTile";

import { PROJECTS } from "@constants";
import { usePortalStore } from "@stores";

/** Up to this many projects stand in a single row. */
const MAX_SINGLE_ROW = 6;
/** Widest gap between columns: a tile (~22° at distance 11) plus a little. */
const MAX_STEP = Math.PI / 7;

const ProjectsCarousel = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const isActive = usePortalStore((state) => state.activePortalId === "projects");
  const activeId = isActive ? selectedId : null;

  const onClick = (id: number) => {
    if (!isMobile) return;
    setSelectedId(id === selectedId ? null : id);
  };
  const tiles = useMemo(() => {
    const fov = Math.PI;
    const distance = 11;

    // Few projects sit in one row, more in the reference's two. The arc is
    // centred straight ahead (π / 2), a tile's width plus a gap apart at most,
    // so a handful gather in front instead of trailing off to one side.
    const rows = PROJECTS.length > MAX_SINGLE_ROW ? 2 : 1;
    const columns = Math.ceil(PROJECTS.length / rows);
    const step = Math.min(fov / columns, MAX_STEP);

    return PROJECTS.map((project, i) => {
      const row = i % rows;
      const column = Math.floor(i / rows);

      const angle = Math.PI / 2 + (column - (columns - 1) / 2) * step;

      const z = -distance * Math.sin(angle);
      const x = -distance * Math.cos(angle);

      const rotY = Math.PI / 2 - angle;

      // vertical stacking; one row sits halfway between the two
      const y = rows === 1 ? 2.125 : row === 0 ? 3.25 : 1;
      const datePosition = rows === 2 && row === 0 ? 'top' : 'bottom';
      return (
        <ProjectTile
          key={i}
          datePosition={datePosition}
          project={project}
          index={i}
          position={[x, y, z]}
          rotation={[0, rotY, 0]}
          activeId={activeId}
          onClick={() => onClick(i)}
        />
      );
    });
  }, [activeId, isActive]);

  return (
    <group rotation={[0, -Math.PI / 12, 0]}>
      {tiles}
    </group>
  );
};

export default ProjectsCarousel;