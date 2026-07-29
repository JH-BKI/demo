import{d as h,a7 as m,a8 as g,u as A,g as v,Y as u}from"./index-D84JDEVq.js";const k="help",p="scene-help-dialog",d="scene-attributions-dialog",x="sceneHelpButton";let o=null,i=null,s=null,r="";function y(){const t="scene-help-control-icon h-10 w-10 shrink-0 fill-current text-base-content";return`
        <div class="scene-help-controls flex flex-wrap items-start justify-center gap-6 sm:gap-10">
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${u("icon_help_orbit",t)}
                <p class="font-bold mb-2 text-base-content">Look around</p>
                <p class="text-sm leading-snug text-base-content/80">Left click + drag or one finger drag (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${u("icon_help_zoom",t)}
                <p class="font-bold mb-2 text-base-content">Zoom</p>
                <p class="text-sm leading-snug text-base-content/80">Mouse scroll wheel or pinch (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${u("icon_help_pan",t)}
                <p class="font-bold mb-2 text-base-content">Pan</p>
                <p class="text-sm leading-snug text-base-content/80">Right click + drag or two fingers drag (touch)</p>
            </div>
        </div>
    `}function D(t){const n=typeof t=="string"?t.trim():"",e=n?`<div class="divider my-4"></div><div class="scene-help-custom-content description-content">
            <h4>This is an immersive activity.</h4><p>Explore this content using the control methods above.</p>
            ${n}</div>`:"";return`
        <div class="card bg-transparent shadow-none">
            <div class="card-body p-4 pt-2">
                ${y()}
                ${e}
            </div>
        </div>
    `}function b(){const t=A(),e=v(t)?.attribution,l=Array.isArray(e)?e:[];return console.log(`[help.js]: [N/A] - [getAttributionsFromConfig] - currentSceneId has a value of ${t}, attributions has a value of ${l.length} items.`),l}function B(t){return`<ul class="scene-attributions-list list-disc list-inside space-y-2">${t.map(e=>`<li class="text-sm">${e}</li>`).join("")}</ul>`}function C(){return i||(i=g({id:d,title:"Attributions",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureAttributionsDialogApi] - attributionsDialogApi has a value of ${d}.`)),i}function w(){const t=b();C().open({title:"Attributions",bodyHtml:B(t),footerHtml:'<button type="button" class="btn btn-neutral" data-action="close">Close</button>'}),console.log("[help.js]: [N/A] - [openAttributionsDialog] - attributionsDialogOpened has a value of true.")}function H(){const t=document.getElementById("onboarding-dialog");return t&&(t.remove(),console.log("[help.js]: [N/A] - [ensureDialogApi] - legacyOnboardingRemoved has a value of true.")),o||(o=g({id:p,title:"Help",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureDialogApi] - dialogApi has a value of ${p}.`)),o}function N(){const t=H(),e=b().length>0;t.open({title:"How to use this activity",bodyHtml:D(r),footerHtml:"",bind:({footerEl:l,close:f})=>{if(l.classList.toggle("scene-help-footer--split",e),e){const c=document.createElement("button");c.type="button",c.className="btn btn-primary",c.textContent="Attributions",c.addEventListener("click",()=>{console.log("[help.js]: [N/A] - [openHelpDialog] - attributionsButtonClicked has a value of true."),f(),w()}),l.appendChild(c)}const a=document.createElement("button");a.type="button",a.className="btn btn-neutral",a.setAttribute("data-action","close"),a.textContent="Close",l.appendChild(a)}}),console.log(`[help.js]: [N/A] - [openHelpDialog] - sceneHelpContentLength has a value of ${r.length}, showAttributionsButton has a value of ${e}.`)}function I(){if(h()){console.log("[help.js]: [N/A] - [buildButton] - help-plugin - Skipping HUD button because WebXR is active.");return}const t=document.getElementById("uiContainer-footer-start");if(!t){console.warn("[help.js]: [N/A] - [buildButton] - help-plugin - uiContainer-footer-start not found; button not added.");return}s=m(x,"accent",{iconName:"icon_help",iconOnly:!0},{text:"Help",tooltipPosition:"top"},()=>{const e=s?.querySelector("button");e?.classList.contains("btn-ping")&&(e.classList.remove("btn-ping"),console.log("[help.js]: [N/A] - [buildButton] - btnPingRemoved has a value of true.")),N()});const n=s.querySelector("button");n&&n.classList.add("btn-ping"),t.appendChild(s)}function $(){s&&(s.remove(),s=null)}function S(){i&&(i.close(),i.dispose(),i=null)}function j(){S(),o&&(o.close(),o.dispose(),o=null)}async function L(t){const n=t?.pluginConfig?.showHudButton!==!1;r=typeof t?.pluginConfig?.["scene-help-content"]=="string"?t.pluginConfig["scene-help-content"]:"",n&&I()}async function O(){$(),j(),r=""}export{O as dispose,k as id,L as init};
