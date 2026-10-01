'use client'

import { useEffect, useState } from 'react'
import { StarryNight } from '../models/StarryNight'
import { VanGogh } from '../models/VanGogh'
import WindowModel from '../models/WindowModel'

// List of models to preload.
const MODELS = [WindowModel, VanGogh, StarryNight];

const Preloader = () => {
  const [visible, setVisible] = useState(true);

  // Hacky way to preload the models by setting them on to the scene and
  // removing them after a timeout as the base canvas is shown after a delay.
  useEffect(() => {
    setTimeout(() => {
      setVisible(false);
    }, 0);
  }, []);

  return (<>
    {MODELS.map((Component, index) => (
      <Component key={index} visible={visible}/>
    ))}
  </>)
}

export default Preloader;
