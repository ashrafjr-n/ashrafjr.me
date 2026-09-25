/**
 * The statements' tunnel: a triangular shaft under the cloud ring, with one
 * statement running down each of its three walls, into the depth.
 *
 * There are no walls, only the type. Nothing of it shows from the hero: once
 * the camera is inside the ring, each statement **rises out of the depth**
 * along its wall into place, fading up as it comes, one wall after another.
 * Then the camera travels down the shaft's axis (`three/scene.ts`), so each
 * statement runs from huge at the edge of the frame to the vanishing point in
 * the middle, and the shaft turns a quarter as the camera goes.
 *
 * Set in DM Serif Display (`public/fonts/`, OFL) with troika's SDF text, which
 * stays sharp however close a letter comes.
 */
import { Group, Matrix4, Vector3 } from 'three'
import { Text } from 'troika-three-text'

const STATEMENTS = ['COMPUTER SCIENCE', 'FULL-STACK DEVELOPER', 'BUILDING TOWARD AI']
export const TUNNEL_FONT = '/fonts/DMSerifDisplay-Regular.ttf'
/** Where the shaft opens, just under the ring, and how far off the axis each wall is. */
const TOP = -2
const APOTHEM = 1.15
const FONT_SIZE = 2.1
/** How far down its wall each statement starts, so the three are not level. */
const STAGGER = [0.4, 2.2, 1.2]
/** The turn the shaft makes as the camera goes through, radians. */
const TWIST = Math.PI / 2
/** How far down its wall a statement starts its rise, world units. */
const RISE = 16

export interface Tunnel {
  group: Group
  /** `reveal` is each statement's rise, 0..1; `twist` is 0..1 of the turn. */
  update(reveal: readonly number[], twist: number): void
}

export function createTunnel(): Tunnel {
  const group = new Group()
  const down = new Vector3(0, -1, 0)
  const inward = new Vector3()
  const across = new Vector3()
  const basis = new Matrix4()
  const texts: Text[] = []
  const homes: number[] = []

  STATEMENTS.forEach((statement, k) => {
    // One wall at the bottom of the screen, the other two up to either side:
    // the camera looks straight down with world -z as screen-up.
    const angle = Math.PI / 2 + (k * 2 * Math.PI) / 3
    const text = new Text()
    text.text = statement
    text.font = TUNNEL_FONT
    text.fontSize = FONT_SIZE
    text.sdfGlyphSize = 128
    text.anchorX = 'left'
    text.anchorY = 'middle'
    text.color = 0xffffff

    // Reading down into the depth, facing the axis, so the camera on the axis
    // sees each one from the front and none is mirrored.
    inward.set(-Math.cos(angle), 0, -Math.sin(angle))
    across.crossVectors(inward, down)
    basis.makeBasis(down, across, inward)
    text.quaternion.setFromRotationMatrix(basis)
    text.position.set(-inward.x * APOTHEM, TOP - STAGGER[k], -inward.z * APOTHEM)
    text.visible = false
    text.sync()
    group.add(text)
    texts.push(text)
    homes.push(text.position.y)
  })

  function update(reveal: readonly number[], twist: number): void {
    group.rotation.y = twist * TWIST
    texts.forEach((text, k) => {
      const r = reveal[k]
      text.visible = r > 0
      text.position.y = homes[k] - (1 - r) * RISE
      text.fillOpacity = r
    })
  }

  return { group, update }
}
