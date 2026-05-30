import{f as T,i as I}from"./index-CNOIWktX.js";import{c as F}from"./modelViewerCamera-BPN7sUwp.js";let $=!1,t=null,s=null,d=null,p=null,S=null,m=null;const k=3e3;let x=null,N=!1;function q(e,n,l=!0){if($){console.warn("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair already initialized.");return}if(!e){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Scene is required.");return}if(!n){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Camera is required.");return}if($=l,!l){console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair disabled.");return}p=e,S=n,O(),console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair initialized. Press K to start a timed capture (scene camera always; cameraView snippet also emitted in 3d-viewer scenes).")}function z(){t=document.createElement("div"),t.id="debugCrosshair",t.style.cssText=`
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 44px;
        height: 44px;
        pointer-events: none;
        z-index: 1000;
    `;const e=44,n=18,l=3,c=e/2,f=2*Math.PI*n,u=document.createElementNS("http://www.w3.org/2000/svg","svg");u.setAttribute("width",String(e)),u.setAttribute("height",String(e)),u.setAttribute("viewBox",`0 0 ${e} ${e}`),u.style.cssText=`
        position: absolute;
        inset: 0;
        transform: rotate(-90deg);
        opacity: 0.95;
    `;const g=document.createElementNS("http://www.w3.org/2000/svg","circle");g.setAttribute("cx",String(c)),g.setAttribute("cy",String(c)),g.setAttribute("r",String(n)),g.setAttribute("fill","none"),g.setAttribute("stroke","rgba(255, 255, 255, 0.18)"),g.setAttribute("stroke-width",String(l)),s=document.createElementNS("http://www.w3.org/2000/svg","circle"),s.setAttribute("cx",String(c)),s.setAttribute("cy",String(c)),s.setAttribute("r",String(n)),s.setAttribute("fill","none"),s.setAttribute("stroke","rgba(255, 255, 255, 0.95)"),s.setAttribute("stroke-width",String(l)),s.setAttribute("stroke-linecap","round"),s.setAttribute("stroke-dasharray",String(f)),s.setAttribute("stroke-dashoffset",String(f)),u.appendChild(g),u.appendChild(s);const C=document.createElement("div");C.style.cssText=`
        position: absolute;
        top: 50%;
        left: 50%;
        width: 22px;
        height: 2px;
        background-color: rgba(255, 255, 255, 0.8);
        transform: translate(-50%, -50%);
    `;const w=document.createElement("div");w.style.cssText=`
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
    `,t.appendChild(u),t.appendChild(C),t.appendChild(w),t.appendChild(y);const A=document.getElementById("uiContainer");A?A.appendChild(t):document.body.appendChild(t),t.style.display="none"}function O(){m=e=>{e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")||e.code==="KeyK"&&(e.repeat||N||(B(),console.log("[debugCrosshair.js]: [N/A] - [setupKeyboardHandlers] - K key pressed - timed capture started.")))},window.addEventListener("keydown",m)}function B(){!p||!S||(N=!0,x=performance.now(),V(),M(0),d&&(p.onBeforeRenderObservable.remove(d),d=null),d=p.onBeforeRenderObservable.add(()=>{const e=performance.now()-x,n=Math.max(0,Math.min(1,e/k));M(n),e>=k&&(H(S,p),P())}))}function P(){d&&p&&(p.onBeforeRenderObservable.remove(d),d=null),N=!1,x=null,K()}function V(){t||z(),t&&(t.style.display="block")}function K(){t&&(t.style.display="none")}function M(e){if(!s)return;const n=Number(s.getAttribute("r")||0),l=2*Math.PI*n,c=l*(1-e);s.setAttribute("stroke-dasharray",String(l)),s.setAttribute("stroke-dashoffset",String(c))}function U(e,n=null){return e}function H(e,n){if(!e||!n)return;const l=e.alpha,c=e.beta,f=e.radius,u=(l*180/Math.PI).toFixed(2),g=(c*180/Math.PI).toFixed(2);console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Camera Rotation - Alpha: ${l.toFixed(4)} rad (${u}°), Beta: ${c.toFixed(4)} rad (${g}°), Radius: ${f.toFixed(2)}.`);const C=Math.round(e.target.x*100)/100,w=Math.round(e.target.y*100)/100,y=Math.round(e.target.z*100)/100,A=typeof e.fov=="number"?Math.round(e.fov*100)/100:null,D=`"alpha": ${l.toFixed(4)},
"beta": ${c.toFixed(4)},
"radius": ${f.toFixed(4)},
"fov": ${A},
"target": [${C}, ${w}, ${y}],`;console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - SCENE CAMERA snippet (paste into scene "camera" block — applies to whole scene; 360 or 3d-viewer):
${D}`);try{const i=T?.(),o=i?I?.(i):null,a=o?.type==="3d-viewer";if(console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - currentSceneId has a value of ${i||"null"}, isViewerScene has a value of ${a}.`),a){const r=F(e),h=Math.round(r.target[0]*100)/100,b=Math.round(r.target[1]*100)/100,E=Math.round(r.target[2]*100)/100,R=typeof o?.camera?.lerpDurationMs=="number"?o.camera.lerpDurationMs:800,j=`"cameraView": {
  "target": [${h}, ${b}, ${E}],
  "alpha": ${r.alpha.toFixed(4)},
  "beta": ${r.beta.toFixed(4)},
  "radius": ${r.radius.toFixed(4)},
  "durationMs": ${R}
}`;console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - ORBIT/VIEW CAMERA snippet (paste into a hotspot inside a 3d-viewer scene — controls per-hotspot focus lerp):
${j}`)}}catch(i){console.warn(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - cameraViewSnippetError has a value of ${i?.message||i}.`)}const v=n.getEngine().getRenderingCanvas();if(v){const i=n.pick(v.width/2,v.height/2,o=>{const a=o.name&&(o.name.includes("360PhotoDome")||o.name.includes("PhotoDome")),r=o.renderingGroupId===0;return o.isPickable&&a&&r},!1,e);if(i&&i.hit&&i.pickedPoint){const o=i.pickedPoint,a=U(o,null),r=Math.round(a.x*100)/100,h=Math.round(a.y*100)/100,b=Math.round(a.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Picked point on PhotoDome - Cartesian coordinates: [${r}, ${h}, ${b}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${r}, ${h}, ${b}], "positionType": "cartesian".`)}else{const o=e.getForwardRay(10),a=o.origin.add(o.direction.scale(10)),r=Math.round(a.x*100)/100,h=Math.round(a.y*100)/100,b=Math.round(a.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - No PhotoDome hit - Using forward ray fallback - Cartesian coordinates: [${r}, ${h}, ${b}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${r}, ${h}, ${b}], "positionType": "cartesian".`)}}else{const i=e.position,o=Math.round(i.x*100)/100,a=Math.round(i.y*100)/100,r=Math.round(i.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Canvas not available - Using camera position - Cartesian coordinates: [${o}, ${a}, ${r}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${o}, ${a}, ${r}], "positionType": "cartesian".`)}}function G(e){$&&(P(),d&&e&&(e.onBeforeRenderObservable.remove(d),d=null),m&&(window.removeEventListener("keydown",m),m=null),t&&t.parentNode&&(t.parentNode.removeChild(t),t=null),s=null,$=!1,p=null,S=null,console.log("[debugCrosshair.js]: [N/A] - [destroyDebugCrosshair] - Debug crosshair destroyed."))}export{G as destroyDebugCrosshair,q as initDebugCrosshair};
