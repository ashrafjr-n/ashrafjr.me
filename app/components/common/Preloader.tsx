'use client'

import { StarryNight } from '../models/StarryNight'
import { VanGogh } from '../models/VanGogh'
import WindowModel from '../models/WindowModel'

// List of models to preload.
const MODELS = [WindowModel, VanGogh, StarryNight];

// Hidden from the start: <Preload all /> shows them just long enough to
// compile and upload them. Mounted visible, they flashed in front of the hero
// camera when loading ended after the canvas had begun fading in.
const Preloader = () => (<>
  {MODELS.map((Component, index) => (
    <Component key={index} visible={false}/>
  ))}
</>)

export default Preloader;
