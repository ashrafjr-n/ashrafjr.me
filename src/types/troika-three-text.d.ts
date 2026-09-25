// troika-three-text ships no types; this covers what the site uses.
declare module 'troika-three-text' {
  import type { ColorRepresentation, Mesh } from 'three'

  export class Text extends Mesh {
    text: string
    font: string
    fontSize: number
    anchorX: number | 'left' | 'center' | 'right'
    anchorY: number | 'top' | 'middle' | 'bottom'
    letterSpacing: number
    color: ColorRepresentation
    fillOpacity: number
    sdfGlyphSize: number
    sync(callback?: () => void): void
    dispose(): void
  }
}
