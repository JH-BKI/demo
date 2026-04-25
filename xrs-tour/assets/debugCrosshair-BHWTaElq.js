import"./index-D_PaJXMQ.js";let y=!1,e=null,n=null,d=null,h=null,A=null,C=null;const P=3e3;let x=null,N=!1;function z(t,o,i=!0){if(y){console.warn("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair already initialized.");return}if(!t){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Scene is required.");return}if(!o){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Camera is required.");return}if(y=i,!i){console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair disabled.");return}h=t,A=o,$(),console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair initialized. Press K to start a 2s capture.")}function v(){e=document.createElement("div"),e.id="debugCrosshair",e.style.cssText=`
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 44px;
        height: 44px;
        pointer-events: none;
        z-index: 1000;
    `;const t=44,o=18,i=3,u=t/2,m=2*Math.PI*o,c=document.createElementNS("http://www.w3.org/2000/svg","svg");c.setAttribute("width",String(t)),c.setAttribute("height",String(t)),c.setAttribute("viewBox",`0 0 ${t} ${t}`),c.style.cssText=`
        position: absolute;
        inset: 0;
        transform: rotate(-90deg);
        opacity: 0.95;
    `;const g=document.createElementNS("http://www.w3.org/2000/svg","circle");g.setAttribute("cx",String(u)),g.setAttribute("cy",String(u)),g.setAttribute("r",String(o)),g.setAttribute("fill","none"),g.setAttribute("stroke","rgba(255, 255, 255, 0.18)"),g.setAttribute("stroke-width",String(i)),n=document.createElementNS("http://www.w3.org/2000/svg","circle"),n.setAttribute("cx",String(u)),n.setAttribute("cy",String(u)),n.setAttribute("r",String(o)),n.setAttribute("fill","none"),n.setAttribute("stroke","rgba(255, 255, 255, 0.95)"),n.setAttribute("stroke-width",String(i)),n.setAttribute("stroke-linecap","round"),n.setAttribute("stroke-dasharray",String(m)),n.setAttribute("stroke-dashoffset",String(m)),c.appendChild(g),c.appendChild(n);const w=document.createElement("div");w.style.cssText=`
        position: absolute;
        top: 50%;
        left: 50%;
        width: 22px;
        height: 2px;
        background-color: rgba(255, 255, 255, 0.8);
        transform: translate(-50%, -50%);
    `;const p=document.createElement("div");p.style.cssText=`
        position: absolute;
        left: 50%;
        top: 50%;
        width: 2px;
        height: 22px;
        background-color: rgba(255, 255, 255, 0.8);
        transform: translate(-50%, -50%);
    `;const a=document.createElement("div");a.style.cssText=`
        position: absolute;
        top: 50%;
        left: 50%;
        width: 4px;
        height: 4px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        transform: translate(-50%, -50%);
    `,e.appendChild(c),e.appendChild(w),e.appendChild(p),e.appendChild(a);const r=document.getElementById("uiContainer");r?r.appendChild(e):document.body.appendChild(e),e.style.display="none"}function $(){C=t=>{t.target&&(t.target.tagName==="INPUT"||t.target.tagName==="TEXTAREA")||t.code==="KeyK"&&(t.repeat||N||(D(),console.log("[debugCrosshair.js]: [N/A] - [setupKeyboardHandlers] - K key pressed - timed capture started.")))},window.addEventListener("keydown",C)}function D(){!h||!A||(N=!0,x=performance.now(),E(),S(0),d&&(h.onBeforeRenderObservable.remove(d),d=null),d=h.onBeforeRenderObservable.add(()=>{const t=performance.now()-x,o=Math.max(0,Math.min(1,t/P));S(o),t>=P&&(j(A,h),k())}))}function k(){d&&h&&(h.onBeforeRenderObservable.remove(d),d=null),N=!1,x=null,R()}function E(){e||v(),e&&(e.style.display="block")}function R(){e&&(e.style.display="none")}function S(t){if(!n)return;const o=Number(n.getAttribute("r")||0),i=2*Math.PI*o,u=i*(1-t);n.setAttribute("stroke-dasharray",String(i)),n.setAttribute("stroke-dashoffset",String(u))}function M(t,o=null){return t}function j(t,o){if(!t||!o)return;const i=t.alpha,u=t.beta,m=t.radius,c=(i*180/Math.PI).toFixed(2),g=(u*180/Math.PI).toFixed(2);console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Camera Rotation - Alpha: ${i.toFixed(4)} rad (${c}°), Beta: ${u.toFixed(4)} rad (${g}°), Radius: ${m.toFixed(2)}.`);const p=o.getEngine().getRenderingCanvas();if(p){const a=o.pick(p.width/2,p.height/2,r=>{const s=r.name&&(r.name.includes("360PhotoDome")||r.name.includes("PhotoDome")),l=r.renderingGroupId===0;return r.isPickable&&s&&l},!1,t);if(a&&a.hit&&a.pickedPoint){const r=a.pickedPoint,s=M(r,null),l=Math.round(s.x*100)/100,b=Math.round(s.y*100)/100,f=Math.round(s.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Picked point on PhotoDome - Cartesian coordinates: [${l}, ${b}, ${f}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${l}, ${b}, ${f}], "positionType": "cartesian".`)}else{const r=t.getForwardRay(10),s=r.origin.add(r.direction.scale(10)),l=Math.round(s.x*100)/100,b=Math.round(s.y*100)/100,f=Math.round(s.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - No PhotoDome hit - Using forward ray fallback - Cartesian coordinates: [${l}, ${b}, ${f}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${l}, ${b}, ${f}], "positionType": "cartesian".`)}}else{const a=t.position,r=Math.round(a.x*100)/100,s=Math.round(a.y*100)/100,l=Math.round(a.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Canvas not available - Using camera position - Cartesian coordinates: [${r}, ${s}, ${l}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${r}, ${s}, ${l}], "positionType": "cartesian".`)}}function O(t){y&&(k(),d&&t&&(t.onBeforeRenderObservable.remove(d),d=null),C&&(window.removeEventListener("keydown",C),C=null),e&&e.parentNode&&(e.parentNode.removeChild(e),e=null),n=null,y=!1,h=null,A=null,console.log("[debugCrosshair.js]: [N/A] - [destroyDebugCrosshair] - Debug crosshair destroyed."))}export{O as destroyDebugCrosshair,z as initDebugCrosshair};
