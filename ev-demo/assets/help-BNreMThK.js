import{JB as f,K7 as m,JF as g,j as A,k as v,JE as r}from"./index-atDm_1ui.js";const O="help",p="scene-help-dialog",d="scene-attributions-dialog",x="sceneHelpButton";let o=null,s=null,c=null,u="";function D(){const t="scene-help-control-icon h-10 w-10 shrink-0 fill-current text-base-content";return`
        <div class="scene-help-controls flex flex-wrap items-start justify-center gap-6 sm:gap-10">
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${r("icon_help_orbit",t)}
                <p class="font-bold mb-2 text-base-content">Look around</p>
                <p class="text-sm leading-snug text-base-content/80">Left click + drag or</p>
                <p class="text-sm leading-snug text-base-content/80">One finger drag (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${r("icon_help_zoom",t)}
                <p class="font-bold mb-2 text-base-content">Zoom</p>
                <p class="text-sm leading-snug text-base-content/80">Double click on model</p>
                <p class="text-sm leading-snug text-base-content/80">Mouse scroll wheel or</p>
                <p class="text-sm leading-snug text-base-content/80">Pinch (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${r("icon_help_pan",t)}
                <p class="font-bold mb-2 text-base-content">Pan</p>
                <p class="text-sm leading-snug text-base-content/80">Right click + drag or</p>
                <p class="text-sm leading-snug text-base-content/80">Two fingers drag (touch)</p>
            </div>
        </div>
    `}function y(t){const n=typeof t=="string"?t.trim():"",e=n?`<div class="divider my-4"></div><div class="scene-help-custom-content description-content">
            <h4>This is an immersive activity.</h4><p>Explore this content using the control methods above.</p>
            ${n}</div>`:"";return`
        <div class="card bg-transparent shadow-none">
            <div class="card-body p-4 pt-2">
                ${D()}
                ${e}
            </div>
        </div>
    `}function b(){const t=A(),e=v(t)?.attribution,l=Array.isArray(e)?e:[];return console.log(`[help.js]: [N/A] - [getAttributionsFromConfig] - currentSceneId has a value of ${t}, attributions has a value of ${l.length} items.`),l}function B(t){return`<ul class="scene-attributions-list list-disc list-inside space-y-2">${t.map(e=>`<li class="text-sm">${e}</li>`).join("")}</ul>`}function C(){return s||(s=g({id:d,title:"Attributions",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureAttributionsDialogApi] - attributionsDialogApi has a value of ${d}.`)),s}function H(){const t=b();C().open({title:"Attributions",bodyHtml:B(t),footerHtml:'<button type="button" class="btn btn-neutral" data-action="close">Close</button>'}),console.log("[help.js]: [N/A] - [openAttributionsDialog] - attributionsDialogOpened has a value of true.")}function w(){const t=document.getElementById("onboarding-dialog");return t&&(t.remove(),console.log("[help.js]: [N/A] - [ensureDialogApi] - legacyOnboardingRemoved has a value of true.")),o||(o=g({id:p,title:"Help",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureDialogApi] - dialogApi has a value of ${p}.`)),o}function N(){const t=w(),e=b().length>0;t.open({title:"How to use this activity",bodyHtml:y(u),footerHtml:"",bind:({footerEl:l,close:h})=>{if(l.classList.toggle("scene-help-footer--split",e),e){const a=document.createElement("button");a.type="button",a.className="btn btn-secondary text-base-content/80 hover:text-base-content",a.textContent="Attributions",a.addEventListener("click",()=>{console.log("[help.js]: [N/A] - [openHelpDialog] - attributionsButtonClicked has a value of true."),h(),H()}),l.appendChild(a)}const i=document.createElement("button");i.type="button",i.className="btn btn-neutral",i.setAttribute("data-action","close"),i.textContent="Close",l.appendChild(i)}}),console.log(`[help.js]: [N/A] - [openHelpDialog] - sceneHelpContentLength has a value of ${u.length}, showAttributionsButton has a value of ${e}.`)}function j(){if(f()){console.log("[help.js]: [N/A] - [buildButton] - help-plugin - Skipping HUD button because WebXR is active.");return}const t=document.getElementById("uiContainer-footer-start");if(!t){console.warn("[help.js]: [N/A] - [buildButton] - help-plugin - uiContainer-footer-start not found; button not added.");return}c=m(x,"primary",{iconName:"icon_help",iconOnly:!0},{text:"Help",tooltipPosition:"top"},N),t.appendChild(c),console.log("[help.js]: [N/A] - [buildButton] - help-plugin - HUD help button mounted in footer-start.")}function $(){c&&(c.remove(),c=null,console.log("[help.js]: [N/A] - [removeButton] - help-plugin - HUD help button removed."))}function I(){s&&(s.close(),s.dispose(),s=null,console.log("[help.js]: [N/A] - [disposeAttributionsDialog] - help-plugin - attributions dialog disposed."))}function k(){I(),o&&(o.close(),o.dispose(),o=null,console.log("[help.js]: [N/A] - [disposeDialog] - help-plugin - dialog disposed."))}async function S(t){const n=t?.pluginConfig?.showHudButton!==!1;u=typeof t?.pluginConfig?.["scene-help-content"]=="string"?t.pluginConfig["scene-help-content"]:"",console.log(`[help.js]: [N/A] - [init] - help-plugin - sceneId has a value of ${t?.sceneId||"unknown"}, showHudButton has a value of ${n}, sceneHelpContentLength has a value of ${u.length}.`),n&&j()}async function E(){$(),k(),u="",console.log("[help.js]: [N/A] - [dispose] - help-plugin - plugin disposed.")}export{E as dispose,O as id,S as init};
