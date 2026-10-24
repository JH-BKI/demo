import{H as _,at as g,au as w,n as k,D as O,av as T,aw as H,ax as y,ay as j,k as P,d as I,E as v,az as R,aA as F,aB as B,ae as h,aC as f,aD as C,aE as D,aF as z,aG as q}from"./index-C6zxRmIs.js";const le="help",A="scene-help-dialog",E="scene-attributions-dialog",G="sceneHelpButton";let a=null,c=null,r=null,m="",b=null;function x(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function M(){const e=T();let n="";if(e){const l=R(),u=z();n=`
            <div class="scene-help-font-picker min-w-0">
                <p class="text-sm font-semibold mb-2 text-base-content">Text style</p>
                <div class="flex flex-col gap-1">${l.map(s=>{const L=s.key===u?" checked":"",N=F(s);return`
            <label class="label cursor-pointer justify-start gap-2 py-1">
                <input type="radio" name="scene-help-font" class="radio radio-sm" value="${x(s.key)}"${L} />
                <span class="label-text scene-help-font-picker__preview" style="font-family: ${x(N)}">${x(s.label)}</span>
            </label>`}).join("")}</div>
            </div>`}const t=B(),o=f()<=C,i=f()>=D,d=`
        <div class="scene-help-text-size flex flex-col items-center shrink-0" role="group" aria-label="Text size">
            <p class="text-sm font-semibold mb-2 text-base-content text-center">Text size</p>
            <div class="flex flex-col items-center gap-2">
                <div class="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" class="btn btn-sm btn-square btn-ghost border border-base-300" data-text-scale="decrease" aria-label="Decrease text size"${o?" disabled":""}>−</button>
                    <span class="scene-help-text-size__label text-sm font-semibold tabular-nums min-w-12 text-center text-base-content" data-text-scale-label>${t}%</span>
                    <button type="button" class="btn btn-sm btn-square btn-ghost border border-base-300" data-text-scale="increase" aria-label="Increase text size"${i?" disabled":""}>+</button>
                </div>
                <button type="button" class="btn btn-sm btn-outline" data-text-scale="reset">Reset</button>
            </div>
        </div>`;return`
        <div class="scene-help-text-style mb-4 pb-4 border-b border-base-300">
            <p class="text-base font-bold mb-6 text-base-content">Accessibility options:</p>
            <div class="flex flex-row flex-wrap items-start justify-center gap-8 sm:gap-12">
                ${n}
                ${d}
            </div>
        </div>`}function U(e){T()&&e.querySelectorAll('input[name="scene-help-font"]').forEach(u=>{u.addEventListener("change",async p=>{const s=p.target;s.checked&&(console.log(`[help.js]: [N/A] - [wireTextStyleControls] - fontKey has a value of ${s.value}.`),await H(s.value))})});const n=e.querySelector(".scene-help-text-size");if(!n)return;const t=n.querySelector("[data-text-scale-label]"),o=n.querySelector('[data-text-scale="decrease"]'),i=n.querySelector('[data-text-scale="increase"]'),d=()=>{const l=B();t&&(t.textContent=`${l}%`),o&&(o.disabled=f()<=C),i&&(i.disabled=f()>=D),console.log(`[help.js]: [N/A] - [refreshSizeUi] - textScalePercent has a value of ${l}.`)};n.addEventListener("click",l=>{const p=l.target.closest("[data-text-scale]");if(!(p instanceof HTMLButtonElement)||p.disabled)return;const s=p.getAttribute("data-text-scale");if(s==="decrease")y(-.05);else if(s==="increase")y(q);else if(s==="reset")j();else return;console.log(`[help.js]: [N/A] - [wireTextStyleControls] - textScaleAction has a value of ${s}.`),d()})}function W(){const e="scene-help-control-icon h-10 w-10 shrink-0 fill-current text-base-content";return`
    <p class="text-base font-bold mb-6 text-base-content">Controls:</p>    
    <div class="scene-help-controls flex flex-wrap items-start justify-center gap-8 sm:gap-12">
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${h("icon_help_orbit",e)}
                <p class="font-bold mb-2 text-base-content">Look around</p>
                <p class="text-sm leading-snug text-base-content/80">Left click + drag or one finger drag (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${h("icon_help_zoom",e)}
                <p class="font-bold mb-2 text-base-content">Zoom</p>
                <p class="text-sm leading-snug text-base-content/80">Mouse scroll wheel or pinch (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${h("icon_help_pan",e)}
                <p class="font-bold mb-2 text-base-content">Pan</p>
                <p class="text-sm leading-snug text-base-content/80">Right click + drag or two fingers drag (touch)</p>
            </div>
        </div>
    `}function V(e){const n=typeof e=="string"?e.trim():"",t=n?`<div class="divider my-4"></div><div class="scene-help-custom-content description-content">
            <h4>This is an immersive activity.</h4><p>Explore this content using the control methods above.</p>
            ${n}</div>`:"";return`
        <div class="card bg-transparent shadow-none">
            <div class="card-body p-4 pt-2">
                ${M()}
                ${W()}
                ${t}
            </div>
        </div>
    `}function $(){const e=k(),t=O(e)?.attribution,o=Array.isArray(t)?t:[];return console.log(`[help.js]: [N/A] - [getAttributionsFromConfig] - currentSceneId has a value of ${e}, attributions has a value of ${o.length} items.`),o}function X(e){return`<ul class="scene-attributions-list list-disc list-inside space-y-2">${e.map(t=>`<li class="text-sm">${t}</li>`).join("")}</ul>`}function K(){return c||(c=w({id:E,title:"Attributions",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureAttributionsDialogApi] - attributionsDialogApi has a value of ${E}.`)),c}function Y(){const e=$(),n=K(),t=g("scene-attributions-close","neutral",{iconName:"",iconOnly:!1,iconPosition:"before"},{text:"Close",tooltipPosition:"top"},null);t.setAttribute("data-action","close"),n.open({title:"Attributions",bodyHtml:X(e),footerHtml:"",footerNode:t}),console.log("[help.js]: [N/A] - [openAttributionsDialog] - attributionsDialogOpened has a value of true.")}function S(e){const n=document.getElementById("debugPerformanceOverlay"),t=!!n&&!n.classList.contains("hidden");e.textContent=t?"DEBUG OFF":"DEBUG ON",e.setAttribute("aria-label",t?"Turn debug UI off":"Turn debug UI on")}function Z(e){if(!P())return;const t=e.getDialogElement()?.querySelector(".generic-dialog-panel-close-form");if(!(t instanceof HTMLFormElement))return;const o=document.createElement("button");o.type="button",o.className="scene-help-debug-toggle btn btn-md btn-outline",S(o),o.addEventListener("click",()=>{I(v.TOGGLE_PERFORMANCE_OVERLAY),console.log("[help.js]: [N/A] - [addDebugToggleButton] - debugToggleClicked has a value of true.")}),b=()=>{queueMicrotask(()=>S(o))},window.addEventListener(v.TOGGLE_PERFORMANCE_OVERLAY,b),t.before(o)}function J(){const e=document.getElementById("onboarding-dialog");return e&&(e.remove(),console.log("[help.js]: [N/A] - [ensureDialogApi] - legacyOnboardingRemoved has a value of true.")),a||(a=w({id:A,title:"Help",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),Z(a),console.log(`[help.js]: [N/A] - [ensureDialogApi] - dialogApi has a value of ${A}.`)),a}function Q(){const e=J(),t=$().length>0;e.open({title:"How to use this activity",bodyHtml:V(m),footerHtml:"",bind:({bodyEl:o,footerEl:i,close:d})=>{if(U(o),i.classList.toggle("scene-help-footer--split",t),t){const u=g("scene-help-attributions","primary",{iconName:"",iconOnly:!1,iconPosition:"before"},{text:"Attributions",tooltipPosition:"top"},()=>{console.log("[help.js]: [N/A] - [openHelpDialog] - attributionsButtonClicked has a value of true."),d(),Y()});i.appendChild(u)}const l=g("scene-help-close","neutral",{iconName:"",iconOnly:!1,iconPosition:"before"},{text:"Close",tooltipPosition:"top"},null);l.setAttribute("data-action","close"),i.appendChild(l)}}),console.log(`[help.js]: [N/A] - [openHelpDialog] - sceneHelpContentLength has a value of ${m.length}, showAttributionsButton has a value of ${t}.`)}function ee(){if(_()){console.log("[help.js]: [N/A] - [buildButton] - help-plugin - Skipping HUD button because WebXR is active.");return}const e=document.getElementById("uiContainer-footer-start");if(!e){console.warn("[help.js]: [N/A] - [buildButton] - help-plugin - uiContainer-footer-start not found; button not added.");return}r=g(G,"primary",{iconName:"icon_help",iconOnly:!0},{text:"Help",tooltipPosition:"top"},()=>{const t=r?.querySelector("button");t?.classList.contains("btn-ping")&&(t.classList.remove("btn-ping"),console.log("[help.js]: [N/A] - [buildButton] - btnPingRemoved has a value of true.")),Q()});const n=r.querySelector("button");n&&n.classList.add("btn-ping"),e.appendChild(r)}function te(){r&&(r.remove(),r=null)}function ne(){c&&(c.close(),c.dispose(),c=null)}function oe(){ne(),b&&(window.removeEventListener(v.TOGGLE_PERFORMANCE_OVERLAY,b),b=null),a&&(a.close(),a.dispose(),a=null)}async function ie(e){const n=e?.pluginConfig?.showHudButton!==!1;m=typeof e?.pluginConfig?.["scene-help-content"]=="string"?e.pluginConfig["scene-help-content"]:"",n&&ee()}async function ae(){te(),oe(),m=""}export{ae as dispose,le as id,ie as init};
