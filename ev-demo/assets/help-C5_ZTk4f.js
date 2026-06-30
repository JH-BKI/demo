import{Jz as f,JU as m,Js as g,a as A,Jy as p}from"./index-CrSZ4RlP.js";const _="help",r="scene-help-dialog",d="scene-attributions-dialog",v="sceneHelpButton";let o=null,s=null,a=null,c="";function x(){const t="scene-help-control-icon h-10 w-10 shrink-0 fill-current text-base-content";return`
        <div class="scene-help-controls flex flex-wrap items-start justify-center gap-6 sm:gap-10">
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${p("icon_help_orbit",t)}
                <p class="font-bold mb-2 text-base-content">Look around</p>
                <p class="text-sm leading-snug text-base-content/80">Left click + drag or</p>
                <p class="text-sm leading-snug text-base-content/80">One finger drag (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${p("icon_help_zoom",t)}
                <p class="font-bold mb-2 text-base-content">Zoom</p>
                <p class="text-sm leading-snug text-base-content/80">Double click on model</p>
                <p class="text-sm leading-snug text-base-content/80">Mouse scroll wheel or</p>
                <p class="text-sm leading-snug text-base-content/80">Pinch (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${p("icon_help_pan",t)}
                <p class="font-bold mb-2 text-base-content">Pan</p>
                <p class="text-sm leading-snug text-base-content/80">Right click + drag or</p>
                <p class="text-sm leading-snug text-base-content/80">Two fingers drag (touch)</p>
            </div>
        </div>
    `}function D(t){const e=typeof t=="string"?t.trim():"",n=e?`<div class="divider my-4"></div><div class="scene-help-custom-content description-content">
            <h4>This is an immersive activity.</h4><p>Explore this content using the control methods above.</p>
            ${e}</div>`:"";return`
        <div class="card bg-transparent shadow-none">
            <div class="card-body p-4 pt-2">
                ${x()}
                ${n}
            </div>
        </div>
    `}function b(){const e=A()?.general?.attribution,n=Array.isArray(e)?e:[];return console.log(`[help.js]: [N/A] - [getAttributionsFromConfig] - attributions has a value of ${n.length} items.`),n}function y(t){return`<ul class="scene-attributions-list list-disc list-inside space-y-2">${t.map(n=>`<li class="text-sm">${n}</li>`).join("")}</ul>`}function B(){return s||(s=g({id:d,title:"Attributions",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureAttributionsDialogApi] - attributionsDialogApi has a value of ${d}.`)),s}function H(){const t=b();B().open({title:"Attributions",bodyHtml:y(t),footerHtml:'<button type="button" class="btn btn-neutral" data-action="close">Close</button>'}),console.log("[help.js]: [N/A] - [openAttributionsDialog] - attributionsDialogOpened has a value of true.")}function w(){const t=document.getElementById("onboarding-dialog");return t&&(t.remove(),console.log("[help.js]: [N/A] - [ensureDialogApi] - legacyOnboardingRemoved has a value of true.")),o||(o=g({id:r,title:"Help",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureDialogApi] - dialogApi has a value of ${r}.`)),o}function C(){const t=w(),n=b().length>0;t.open({title:"How to use this activity",bodyHtml:D(c),footerHtml:"",bind:({footerEl:u,close:h})=>{if(u.classList.toggle("scene-help-footer--split",n),n){const i=document.createElement("button");i.type="button",i.className="btn btn-secondary text-base-content/80 hover:text-base-content",i.textContent="Attributions",i.addEventListener("click",()=>{console.log("[help.js]: [N/A] - [openHelpDialog] - attributionsButtonClicked has a value of true."),h(),H()}),u.appendChild(i)}const l=document.createElement("button");l.type="button",l.className="btn btn-neutral",l.setAttribute("data-action","close"),l.textContent="Close",u.appendChild(l)}}),console.log(`[help.js]: [N/A] - [openHelpDialog] - sceneHelpContentLength has a value of ${c.length}, showAttributionsButton has a value of ${n}.`)}function N(){if(f()){console.log("[help.js]: [N/A] - [buildButton] - help-plugin - Skipping HUD button because WebXR is active.");return}const t=document.getElementById("uiContainer-footer-start");if(!t){console.warn("[help.js]: [N/A] - [buildButton] - help-plugin - uiContainer-footer-start not found; button not added.");return}a=m(v,"primary",{iconName:"icon_help",iconOnly:!0},{text:"Help",tooltipPosition:"top"},C),t.appendChild(a),console.log("[help.js]: [N/A] - [buildButton] - help-plugin - HUD help button mounted in footer-start.")}function j(){a&&(a.remove(),a=null,console.log("[help.js]: [N/A] - [removeButton] - help-plugin - HUD help button removed."))}function $(){s&&(s.close(),s.dispose(),s=null,console.log("[help.js]: [N/A] - [disposeAttributionsDialog] - help-plugin - attributions dialog disposed."))}function I(){$(),o&&(o.close(),o.dispose(),o=null,console.log("[help.js]: [N/A] - [disposeDialog] - help-plugin - dialog disposed."))}async function O(t){const e=t?.pluginConfig?.showHudButton!==!1;c=typeof t?.pluginConfig?.["scene-help-content"]=="string"?t.pluginConfig["scene-help-content"]:"",console.log(`[help.js]: [N/A] - [init] - help-plugin - sceneId has a value of ${t?.sceneId||"unknown"}, showHudButton has a value of ${e}, sceneHelpContentLength has a value of ${c.length}.`),e&&N()}async function L(){j(),I(),c="",console.log("[help.js]: [N/A] - [dispose] - help-plugin - plugin disposed.")}export{L as dispose,_ as id,O as init};
