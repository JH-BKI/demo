import{f as T,a6 as k,a7 as y,z as H,g as _,a8 as A,a9 as j,aa as m,ab as E,ac as N,ad as L,ae as S,L as g,af as b,ag as w,ah as B,ai as I,aj as z}from"./index-BgBdVcTi.js";const Y="help",x="scene-help-dialog",v="scene-attributions-dialog",q="sceneHelpButton";let c=null,r=null,u=null,f="";function h(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function O(){const t=A();let e="";if(t){const o=N(),l=I();e=`
            <div class="scene-help-font-picker min-w-0">
                <p class="text-sm font-semibold mb-2 text-base-content">Text style</p>
                <div class="flex flex-col gap-1">${o.map(s=>{const $=s.key===l?" checked":"",D=L(s);return`
            <label class="label cursor-pointer justify-start gap-2 py-1">
                <input type="radio" name="scene-help-font" class="radio radio-sm" value="${h(s.key)}"${$} />
                <span class="label-text scene-help-font-picker__preview" style="font-family: ${h(D)}">${h(s.label)}</span>
            </label>`}).join("")}</div>
            </div>`}const n=S(),a=b()<=w,i=b()>=B,d=`
        <div class="scene-help-text-size flex flex-col items-center shrink-0" role="group" aria-label="Text size">
            <p class="text-sm font-semibold mb-2 text-base-content text-center">Text size</p>
            <div class="flex flex-col items-center gap-2">
                <div class="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" class="btn btn-sm btn-square btn-ghost border border-base-300" data-text-scale="decrease" aria-label="Decrease text size"${a?" disabled":""}>−</button>
                    <span class="scene-help-text-size__label text-sm font-semibold tabular-nums min-w-12 text-center text-base-content" data-text-scale-label>${n}%</span>
                    <button type="button" class="btn btn-sm btn-square btn-ghost border border-base-300" data-text-scale="increase" aria-label="Increase text size"${i?" disabled":""}>+</button>
                </div>
                <button type="button" class="btn btn-sm btn-outline" data-text-scale="reset">Reset</button>
            </div>
        </div>`;return`
        <div class="scene-help-text-style mb-4 pb-4 border-b border-base-300">
            <p class="text-base font-bold mb-6 text-base-content">Accessibility options:</p>
            <div class="flex flex-row flex-wrap items-start justify-center gap-8 sm:gap-12">
                ${e}
                ${d}
            </div>
        </div>`}function P(t){A()&&t.querySelectorAll('input[name="scene-help-font"]').forEach(l=>{l.addEventListener("change",async p=>{const s=p.target;s.checked&&(console.log(`[help.js]: [N/A] - [wireTextStyleControls] - fontKey has a value of ${s.value}.`),await j(s.value))})});const e=t.querySelector(".scene-help-text-size");if(!e)return;const n=e.querySelector("[data-text-scale-label]"),a=e.querySelector('[data-text-scale="decrease"]'),i=e.querySelector('[data-text-scale="increase"]'),d=()=>{const o=S();n&&(n.textContent=`${o}%`),a&&(a.disabled=b()<=w),i&&(i.disabled=b()>=B),console.log(`[help.js]: [N/A] - [refreshSizeUi] - textScalePercent has a value of ${o}.`)};e.addEventListener("click",o=>{const p=o.target.closest("[data-text-scale]");if(!(p instanceof HTMLButtonElement)||p.disabled)return;const s=p.getAttribute("data-text-scale");if(s==="decrease")m(-.05);else if(s==="increase")m(z);else if(s==="reset")E();else return;console.log(`[help.js]: [N/A] - [wireTextStyleControls] - textScaleAction has a value of ${s}.`),d()})}function R(){const t="scene-help-control-icon h-10 w-10 shrink-0 fill-current text-base-content";return`
    <p class="text-base font-bold mb-6 text-base-content">Controls:</p>    
    <div class="scene-help-controls flex flex-wrap items-start justify-center gap-8 sm:gap-12">
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${g("icon_help_orbit",t)}
                <p class="font-bold mb-2 text-base-content">Look around</p>
                <p class="text-sm leading-snug text-base-content/80">Left click + drag or one finger drag (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${g("icon_help_zoom",t)}
                <p class="font-bold mb-2 text-base-content">Zoom</p>
                <p class="text-sm leading-snug text-base-content/80">Mouse scroll wheel or pinch (touch)</p>
            </div>
            <div class="scene-help-control-col flex flex-1 min-w-36 max-w-48 flex-col items-center text-center">
                ${g("icon_help_pan",t)}
                <p class="font-bold mb-2 text-base-content">Pan</p>
                <p class="text-sm leading-snug text-base-content/80">Right click + drag or two fingers drag (touch)</p>
            </div>
        </div>
    `}function F(t){const e=typeof t=="string"?t.trim():"",n=e?`<div class="divider my-4"></div><div class="scene-help-custom-content description-content">
            <h4>This is an immersive activity.</h4><p>Explore this content using the control methods above.</p>
            ${e}</div>`:"";return`
        <div class="card bg-transparent shadow-none">
            <div class="card-body p-4 pt-2">
                ${O()}
                ${R()}
                ${n}
            </div>
        </div>
    `}function C(){const t=H(),n=_(t)?.attribution,a=Array.isArray(n)?n:[];return console.log(`[help.js]: [N/A] - [getAttributionsFromConfig] - currentSceneId has a value of ${t}, attributions has a value of ${a.length} items.`),a}function M(t){return`<ul class="scene-attributions-list list-disc list-inside space-y-2">${t.map(n=>`<li class="text-sm">${n}</li>`).join("")}</ul>`}function U(){return r||(r=y({id:v,title:"Attributions",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureAttributionsDialogApi] - attributionsDialogApi has a value of ${v}.`)),r}function X(){const t=C();U().open({title:"Attributions",bodyHtml:M(t),footerHtml:'<button type="button" class="btn btn-neutral" data-action="close">Close</button>'}),console.log("[help.js]: [N/A] - [openAttributionsDialog] - attributionsDialogOpened has a value of true.")}function K(){const t=document.getElementById("onboarding-dialog");return t&&(t.remove(),console.log("[help.js]: [N/A] - [ensureDialogApi] - legacyOnboardingRemoved has a value of true.")),c||(c=y({id:x,title:"Help",allowBackdropClose:!0,closeOnEscape:!0,footerAlign:"end"}),console.log(`[help.js]: [N/A] - [ensureDialogApi] - dialogApi has a value of ${x}.`)),c}function W(){const t=K(),n=C().length>0;t.open({title:"How to use this activity",bodyHtml:F(f),footerHtml:"",bind:({bodyEl:a,footerEl:i,close:d})=>{if(P(a),i.classList.toggle("scene-help-footer--split",n),n){const l=document.createElement("button");l.type="button",l.className="btn btn-primary",l.textContent="Attributions",l.addEventListener("click",()=>{console.log("[help.js]: [N/A] - [openHelpDialog] - attributionsButtonClicked has a value of true."),d(),X()}),i.appendChild(l)}const o=document.createElement("button");o.type="button",o.className="btn btn-neutral",o.setAttribute("data-action","close"),o.textContent="Close",i.appendChild(o)}}),console.log(`[help.js]: [N/A] - [openHelpDialog] - sceneHelpContentLength has a value of ${f.length}, showAttributionsButton has a value of ${n}.`)}function G(){if(T()){console.log("[help.js]: [N/A] - [buildButton] - help-plugin - Skipping HUD button because WebXR is active.");return}const t=document.getElementById("uiContainer-footer-start");if(!t){console.warn("[help.js]: [N/A] - [buildButton] - help-plugin - uiContainer-footer-start not found; button not added.");return}u=k(q,"accent",{iconName:"icon_help",iconOnly:!0},{text:"Help",tooltipPosition:"top"},()=>{const n=u?.querySelector("button");n?.classList.contains("btn-ping")&&(n.classList.remove("btn-ping"),console.log("[help.js]: [N/A] - [buildButton] - btnPingRemoved has a value of true.")),W()});const e=u.querySelector("button");e&&e.classList.add("btn-ping"),t.appendChild(u)}function Z(){u&&(u.remove(),u=null)}function J(){r&&(r.close(),r.dispose(),r=null)}function Q(){J(),c&&(c.close(),c.dispose(),c=null)}async function tt(t){const e=t?.pluginConfig?.showHudButton!==!1;f=typeof t?.pluginConfig?.["scene-help-content"]=="string"?t.pluginConfig["scene-help-content"]:"",e&&G()}async function et(){Z(),Q(),f=""}export{et as dispose,Y as id,tt as init};
