import{f as T,i as I}from"./index-eaMdFM3I.js";function z(t){return{target:[t.target.x,t.target.y,t.target.z],alpha:t.alpha,beta:t.beta,radius:t.radius}}let $=!1,e=null,s=null,c=null,p=null,S=null,C=null;const k=3e3;let x=null,N=!1;function X(t,n,l=!0){if($){console.warn("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair already initialized.");return}if(!t){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Scene is required.");return}if(!n){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Camera is required.");return}if($=l,!l){console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair disabled.");return}p=t,S=n,O(),console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair initialized. Press K to start a timed capture (scene camera always; cameraView snippet also emitted in 3d-viewer scenes).")}function F(){e=document.createElement("div"),e.id="debugCrosshair",e.style.cssText=`
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 44px;
        height: 44px;
        pointer-events: none;
        z-index: 1000;
    `;const t=44,n=18,l=3,d=t/2,f=2*Math.PI*n,u=document.createElementNS("http://www.w3.org/2000/svg","svg");u.setAttribute("width",String(t)),u.setAttribute("height",String(t)),u.setAttribute("viewBox",`0 0 ${t} ${t}`),u.style.cssText=`
        position: absolute;
        inset: 0;
        transform: rotate(-90deg);
        opacity: 0.95;
    `;const g=document.createElementNS("http://www.w3.org/2000/svg","circle");g.setAttribute("cx",String(d)),g.setAttribute("cy",String(d)),g.setAttribute("r",String(n)),g.setAttribute("fill","none"),g.setAttribute("stroke","rgba(255, 255, 255, 0.18)"),g.setAttribute("stroke-width",String(l)),s=document.createElementNS("http://www.w3.org/2000/svg","circle"),s.setAttribute("cx",String(d)),s.setAttribute("cy",String(d)),s.setAttribute("r",String(n)),s.setAttribute("fill","none"),s.setAttribute("stroke","rgba(255, 255, 255, 0.95)"),s.setAttribute("stroke-width",String(l)),s.setAttribute("stroke-linecap","round"),s.setAttribute("stroke-dasharray",String(f)),s.setAttribute("stroke-dashoffset",String(f)),u.appendChild(g),u.appendChild(s);const w=document.createElement("div");w.style.cssText=`
        position: absolute;
        top: 50%;
        left: 50%;
        width: 22px;
        height: 2px;
        background-color: rgba(255, 255, 255, 0.8);
        transform: translate(-50%, -50%);
    `;const m=document.createElement("div");m.style.cssText=`
        position: absolute;
        left: 50%;
        top: 50%;
        width: 2px;
        height: 22px;
        background-color: rgba(255, 255, 255, 0.8);
        transform: translate(-50%, -50%);
    `;const y=document.createElement("div");y.style.cssText=`
        position: absolute;
        top: 50%;
        left: 50%;
        width: 4px;
        height: 4px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        transform: translate(-50%, -50%);
    `,e.appendChild(u),e.appendChild(w),e.appendChild(m),e.appendChild(y);const A=document.getElementById("uiContainer");A?A.appendChild(e):document.body.appendChild(e),e.style.display="none"}function O(){C=t=>{t.target&&(t.target.tagName==="INPUT"||t.target.tagName==="TEXTAREA")||t.code==="KeyK"&&(t.repeat||N||(B(),console.log("[debugCrosshair.js]: [N/A] - [setupKeyboardHandlers] - K key pressed - timed capture started.")))},window.addEventListener("keydown",C)}function B(){!p||!S||(N=!0,x=performance.now(),V(),M(0),c&&(p.onBeforeRenderObservable.remove(c),c=null),c=p.onBeforeRenderObservable.add(()=>{const t=performance.now()-x,n=Math.max(0,Math.min(1,t/k));M(n),t>=k&&(H(S,p),P())}))}function P(){c&&p&&(p.onBeforeRenderObservable.remove(c),c=null),N=!1,x=null,K()}function V(){e||F(),e&&(e.style.display="block")}function K(){e&&(e.style.display="none")}function M(t){if(!s)return;const n=Number(s.getAttribute("r")||0),l=2*Math.PI*n,d=l*(1-t);s.setAttribute("stroke-dasharray",String(l)),s.setAttribute("stroke-dashoffset",String(d))}function U(t,n=null){return t}function H(t,n){if(!t||!n)return;const l=t.alpha,d=t.beta,f=t.radius,u=(l*180/Math.PI).toFixed(2),g=(d*180/Math.PI).toFixed(2);console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Camera Rotation - Alpha: ${l.toFixed(4)} rad (${u}°), Beta: ${d.toFixed(4)} rad (${g}°), Radius: ${f.toFixed(2)}.`);const w=Math.round(t.target.x*100)/100,m=Math.round(t.target.y*100)/100,y=Math.round(t.target.z*100)/100,A=typeof t.fov=="number"?Math.round(t.fov*100)/100:null,D=`"alpha": ${l.toFixed(4)},
"beta": ${d.toFixed(4)},
"radius": ${f.toFixed(4)},
"fov": ${A},
"target": [${w}, ${m}, ${y}],`;console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - SCENE CAMERA snippet (paste into scene "camera" block — applies to whole scene; 360 or 3d-viewer):
${D}`);try{const i=T?.(),o=i?I?.(i):null,a=o?.type==="3d-viewer";if(console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - currentSceneId has a value of ${i||"null"}, isViewerScene has a value of ${a}.`),a){const r=z(t),h=Math.round(r.target[0]*100)/100,b=Math.round(r.target[1]*100)/100,E=Math.round(r.target[2]*100)/100,R=typeof o?.camera?.lerpDurationMs=="number"?o.camera.lerpDurationMs:800,j=`"cameraView": {
  "target": [${h}, ${b}, ${E}],
  "alpha": ${r.alpha.toFixed(4)},
  "beta": ${r.beta.toFixed(4)},
  "radius": ${r.radius.toFixed(4)},
  "durationMs": ${R}
}`;console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - ORBIT/VIEW CAMERA snippet (paste into a hotspot inside a 3d-viewer scene — controls per-hotspot focus lerp):
${j}`)}}catch(i){console.warn(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - cameraViewSnippetError has a value of ${i?.message||i}.`)}const v=n.getEngine().getRenderingCanvas();if(v){const i=n.pick(v.width/2,v.height/2,o=>{const a=o.name&&(o.name.includes("360PhotoDome")||o.name.includes("PhotoDome")),r=o.renderingGroupId===0;return o.isPickable&&a&&r},!1,t);if(i&&i.hit&&i.pickedPoint){const o=i.pickedPoint,a=U(o,null),r=Math.round(a.x*100)/100,h=Math.round(a.y*100)/100,b=Math.round(a.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Picked point on PhotoDome - Cartesian coordinates: [${r}, ${h}, ${b}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${r}, ${h}, ${b}], "positionType": "cartesian".`)}else{const o=t.getForwardRay(10),a=o.origin.add(o.direction.scale(10)),r=Math.round(a.x*100)/100,h=Math.round(a.y*100)/100,b=Math.round(a.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - No PhotoDome hit - Using forward ray fallback - Cartesian coordinates: [${r}, ${h}, ${b}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${r}, ${h}, ${b}], "positionType": "cartesian".`)}}else{const i=t.position,o=Math.round(i.x*100)/100,a=Math.round(i.y*100)/100,r=Math.round(i.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Canvas not available - Using camera position - Cartesian coordinates: [${o}, ${a}, ${r}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${o}, ${a}, ${r}], "positionType": "cartesian".`)}}function q(t){$&&(P(),c&&t&&(t.onBeforeRenderObservable.remove(c),c=null),C&&(window.removeEventListener("keydown",C),C=null),e&&e.parentNode&&(e.parentNode.removeChild(e),e=null),s=null,$=!1,p=null,S=null,console.log("[debugCrosshair.js]: [N/A] - [destroyDebugCrosshair] - Debug crosshair destroyed."))}export{q as destroyDebugCrosshair,X as initDebugCrosshair};
