import{V as H,j as q,k as G,l as J}from"./index-atDm_1ui.js";import{r as Y,c as O,a as X}from"./modelViewerCamera-DEcmecL4.js";let P=!1,r=null,i=null,c=null,b=null,u=null,k=null;const T=6e4,W=8500,Z=["lowerRadiusLimit","upperRadiusLimit","lowerAlphaLimit","upperAlphaLimit","lowerBetaLimit","upperBetaLimit"];let E=null,v=!1,w=null,f=null,y={},N=!1;function pe(e,t,o=!0){if(P){console.warn("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair already initialized.");return}if(!e){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Scene is required.");return}if(!t){console.error("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Camera is required.");return}if(P=o,!o){console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair disabled.");return}b=e,u=t,ee(),console.log("[debugCrosshair.js]: [N/A] - [initDebugCrosshair] - Debug crosshair initialized. Press K to start a 10s capture (second K snaps early; arrows/+/- stamp limits; limits unlock for framing, then restore + snap pose).")}function Q(){r=document.createElement("div"),r.id="debugCrosshair",r.style.cssText=`
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 44px;
        height: 44px;
        pointer-events: none;
        z-index: 1000;
    `;const e=44,t=18,o=3,C=5,p=e/2,x=2*Math.PI*t,D="rgba(220, 30, 30, 0.95)",$=`0 0 0 1.5px ${D}`,d=document.createElementNS("http://www.w3.org/2000/svg","svg");d.setAttribute("width",String(e)),d.setAttribute("height",String(e)),d.setAttribute("viewBox",`0 0 ${e} ${e}`),d.style.cssText=`
        position: absolute;
        inset: 0;
        transform: rotate(-90deg);
        opacity: 0.95;
    `;const g=document.createElementNS("http://www.w3.org/2000/svg","circle");g.setAttribute("cx",String(p)),g.setAttribute("cy",String(p)),g.setAttribute("r",String(t)),g.setAttribute("fill","none"),g.setAttribute("stroke",D),g.setAttribute("stroke-width",String(C));const h=document.createElementNS("http://www.w3.org/2000/svg","circle");h.setAttribute("cx",String(p)),h.setAttribute("cy",String(p)),h.setAttribute("r",String(t)),h.setAttribute("fill","none"),h.setAttribute("stroke","rgba(255, 255, 255, 0.18)"),h.setAttribute("stroke-width",String(o)),i=document.createElementNS("http://www.w3.org/2000/svg","circle"),i.setAttribute("cx",String(p)),i.setAttribute("cy",String(p)),i.setAttribute("r",String(t)),i.setAttribute("fill","none"),i.setAttribute("stroke","rgba(255, 255, 255, 0.95)"),i.setAttribute("stroke-width",String(o)),i.setAttribute("stroke-linecap","round"),i.setAttribute("stroke-dasharray",String(x)),i.setAttribute("stroke-dashoffset",String(x)),d.appendChild(g),d.appendChild(h),d.appendChild(i);const L=document.createElement("div");L.style.cssText=`
        position: absolute;
        top: 50%;
        left: 50%;
        width: 22px;
        height: 2px;
        background-color: rgba(255, 255, 255, 0.8);
        box-shadow: ${$};
        transform: translate(-50%, -50%);
    `;const M=document.createElement("div");M.style.cssText=`
        position: absolute;
        left: 50%;
        top: 50%;
        width: 2px;
        height: 22px;
        background-color: rgba(255, 255, 255, 0.8);
        box-shadow: ${$};
        transform: translate(-50%, -50%);
    `;const R=document.createElement("div");R.style.cssText=`
        position: absolute;
        top: 50%;
        left: 50%;
        width: 4px;
        height: 4px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        box-shadow: ${$};
        transform: translate(-50%, -50%);
    `,r.appendChild(d),r.appendChild(L),r.appendChild(M),r.appendChild(R);const S=document.getElementById("uiContainer");S?S.appendChild(r):document.body.appendChild(r),r.style.display="none"}function ee(){k=e=>{if(!(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"))&&!e.repeat){if(e.code==="KeyK"){if(v){console.log("[debugCrosshair.js]: [N/A] - [setupKeyboardHandlers] - K key pressed - early snap requested."),K();return}se(),console.log("[debugCrosshair.js]: [N/A] - [setupKeyboardHandlers] - K key pressed - timed capture started.");return}v&&te(e)}},window.addEventListener("keydown",k)}function te(e){if(!u)return;let t=null,o=null;switch(e.code){case"ArrowLeft":t="lowerAlphaLimit",o=u.alpha;break;case"ArrowRight":t="upperAlphaLimit",o=u.alpha;break;case"ArrowDown":t="upperBetaLimit",o=u.beta;break;case"ArrowUp":t="lowerBetaLimit",o=u.beta;break;case"Equal":case"NumpadAdd":t="lowerRadiusLimit",o=u.radius;break;case"Minus":case"NumpadSubtract":t="upperRadiusLimit",o=u.radius;break;default:return}e.preventDefault(),y[t]=o,console.log(`[debugCrosshair.js]: [N/A] - [tryStampAuthoredLimit] - ${t} has a value of ${o.toFixed(4)}.`)}function I(e=""){const t=[];for(const o of Z)y[o]!==void 0&&t.push(`${e}"${o}": ${y[o].toFixed(4)},`);return t.length===0?"":`
${t.join(`
`)}`}function oe(e){N=!1;const t=e?.inputs?.attached?.keyboard;if(!t||typeof t.detachControl!="function"){console.log("[debugCrosshair.js]: [N/A] - [disableCameraKeyboardDuringCapture] - keyboardInputMissing has a value of true.");return}t.detachControl(),N=!0,console.log("[debugCrosshair.js]: [N/A] - [disableCameraKeyboardDuringCapture] - keyboardDetached has a value of true.")}function B(e){if(!N)return;const t=e?.inputs?.attached?.keyboard;t&&typeof t.attachControl=="function"&&(t.attachControl(),console.log("[debugCrosshair.js]: [N/A] - [restoreCameraKeyboardAfterCapture] - keyboardReattached has a value of true.")),N=!1}function re(e){e&&(y={},w=X(e),f=O(e),e.lowerRadiusLimit=null,e.upperRadiusLimit=null,e.lowerAlphaLimit=null,e.upperAlphaLimit=null,e.lowerBetaLimit=null,e.upperBetaLimit=null,e.panningDistanceLimit=null,J(),e.panningSensibility>0||(e.panningSensibility=W),e.panningOriginTarget.copyFrom(e.target),oe(e),console.log(`[debugCrosshair.js]: [N/A] - [unlockCameraForCapture] - limitsUnlocked has a value of true, allowPanningWas has a value of ${w.allowPanning}.`))}function ne(e){if(!e){w=null,f=null,y={},B(null);return}if(f){const t=f.target;e.alpha=f.alpha,e.beta=f.beta,e.radius=f.radius,e.setTarget(new H(t[0]??0,t[1]??0,t[2]??0)),console.log(`[debugCrosshair.js]: [N/A] - [restoreCameraAfterCapture] - poseRestored has a value of true, radius has a value of ${e.radius}.`)}w&&(Y(e,w),console.log("[debugCrosshair.js]: [N/A] - [restoreCameraAfterCapture] - limitsRestored has a value of true.")),B(e),w=null,f=null,y={}}function se(){!b||!u||(v=!0,E=performance.now(),re(u),ie(),F(0),c&&(b.onBeforeRenderObservable.remove(c),c=null),c=b.onBeforeRenderObservable.add(()=>{const e=performance.now()-E,t=Math.max(0,Math.min(1,e/T));F(t),e>=T&&(console.log("[debugCrosshair.js]: [N/A] - [startTimedCapture] - autoSnapFired has a value of true."),K())}))}function K(){v&&(ue(u,b),z())}function z(){c&&b&&(b.onBeforeRenderObservable.remove(c),c=null),ne(u),v=!1,E=null,ae()}function ie(){r||Q(),r&&(r.style.display="block")}function ae(){r&&(r.style.display="none")}function F(e){if(!i)return;const t=Number(i.getAttribute("r")||0),o=2*Math.PI*t,C=o*(1-e);i.setAttribute("stroke-dasharray",String(o)),i.setAttribute("stroke-dashoffset",String(C))}function le(e,t=null){return e}function ue(e,t){if(!e||!t)return;const o=e.alpha,C=e.beta,p=e.radius,x=(o*180/Math.PI).toFixed(2),D=(C*180/Math.PI).toFixed(2);console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Camera Rotation - Alpha: ${o.toFixed(4)} rad (${x}°), Beta: ${C.toFixed(4)} rad (${D}°), Radius: ${p.toFixed(2)}.`);const $=Math.round(e.target.x*100)/100,d=Math.round(e.target.y*100)/100,g=Math.round(e.target.z*100)/100,h=typeof e.fov=="number"?Math.round(e.fov*100)/100:null,L=I(""),M=`"alpha": ${o.toFixed(4)},
"beta": ${C.toFixed(4)},
"radius": ${p.toFixed(4)},
"fov": ${h},
"target": [${$}, ${d}, ${g}],`+L;console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - SCENE CAMERA snippet (paste into scene "camera" block — applies to whole scene; 360 or 3d-viewer):
${M}`);try{const a=q?.(),n=a?G?.(a):null,l=n?.type==="3d-viewer";if(console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - currentSceneId has a value of ${a||"null"}, isViewerScene has a value of ${l}.`),l){const s=O(e),m=Math.round(s.target[0]*100)/100,A=Math.round(s.target[1]*100)/100,U=Math.round(s.target[2]*100)/100,V=typeof n?.camera?.lerpDurationMs=="number"?n.camera.lerpDurationMs:800,j=I("  "),_=`"cameraView": {
  "target": [${m}, ${A}, ${U}],
  "alpha": ${s.alpha.toFixed(4)},
  "beta": ${s.beta.toFixed(4)},
  "radius": ${s.radius.toFixed(4)},
  "durationMs": ${V}`+(j?`,${j}`:"")+`
}`;console.log(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - ORBIT/VIEW CAMERA snippet (paste into a hotspot inside a 3d-viewer scene — controls per-hotspot focus lerp):
${_}`)}}catch(a){console.warn(`[debugCrosshair.js]: [N/A] - [takeSnapshot] - cameraViewSnippetError has a value of ${a?.message||a}.`)}const S=t.getEngine().getRenderingCanvas();if(S){const a=t.pick(S.width/2,S.height/2,n=>{const l=n.name&&(n.name.includes("360PhotoDome")||n.name.includes("PhotoDome")),s=n.renderingGroupId===0;return n.isPickable&&l&&s},!1,e);if(a&&a.hit&&a.pickedPoint){const n=a.pickedPoint,l=le(n,null),s=Math.round(l.x*100)/100,m=Math.round(l.y*100)/100,A=Math.round(l.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Picked point on PhotoDome - Cartesian coordinates: [${s}, ${m}, ${A}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${s}, ${m}, ${A}], "positionType": "cartesian".`)}else{const n=e.getForwardRay(10),l=n.origin.add(n.direction.scale(10)),s=Math.round(l.x*100)/100,m=Math.round(l.y*100)/100,A=Math.round(l.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - No PhotoDome hit - Using forward ray fallback - Cartesian coordinates: [${s}, ${m}, ${A}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${s}, ${m}, ${A}], "positionType": "cartesian".`)}}else{const a=e.position,n=Math.round(a.x*100)/100,l=Math.round(a.y*100)/100,s=Math.round(a.z*100)/100;console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - Canvas not available - Using camera position - Cartesian coordinates: [${n}, ${l}, ${s}].`),console.log(`[debugCrosshair.js]: [N/A] - [logPosition] - JSON format (copy/paste): "position": [${n}, ${l}, ${s}], "positionType": "cartesian".`)}}function ge(e){P&&(z(),c&&e&&(e.onBeforeRenderObservable.remove(c),c=null),k&&(window.removeEventListener("keydown",k),k=null),r&&r.parentNode&&(r.parentNode.removeChild(r),r=null),i=null,P=!1,b=null,u=null,w=null,f=null,y={},N=!1,console.log("[debugCrosshair.js]: [N/A] - [destroyDebugCrosshair] - Debug crosshair destroyed."))}export{ge as destroyDebugCrosshair,pe as initDebugCrosshair};
