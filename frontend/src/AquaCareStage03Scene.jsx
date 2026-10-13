import React from 'react';
import scene from './aquacare-stage03-map.json';
// Visual-only, no API, state, permission, navigation or business handlers.
const base='/aquacare-stage03/';
export function AquaCareStage03Scene(){return <div className="aquacare-stage03-scene" aria-hidden="true"><div className="aquacare-stage03-canvas">{scene.layers.map(layer=><img key={layer.id} alt="" draggable="false" className="aquacare-stage03-layer" src={base+layer.asset} style={{left:(layer.x/1536*100)+'%',top:(layer.y/1024*100)+'%',width:(layer.width/1536*100)+'%',height:(layer.height/1024*100)+'%',zIndex:layer.z,opacity:layer.opacity??1,filter:layer.brightness==null?undefined:`brightness(${layer.brightness})`,transform:`scaleX(${layer.flip_x?-1:1}) rotate(${-(layer.rotation_degrees||0)}deg)`}}/>)}</div></div>}
