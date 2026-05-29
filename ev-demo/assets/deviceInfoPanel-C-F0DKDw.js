import{E,h as p,g as w,a as y,b as L,c as h}from"./index-eaMdFM3I.js";let u=!1,D=!1,x=null;function C(n){const t=b=>b??"N/A";let e=`Device Information
`;e+=`==================

`;const a=y?.(),l=t(a?.version);if(e+=`Version: ${l}

`,n.deviceDetectedTimestamp){const T=new Date(n.deviceDetectedTimestamp).toLocaleString();e+=`Detected: ${T}

`}const i=t(n.browser?.name),s=t(n.browser?.version);e+=`Browser: ${i}`,s!=="N/A"&&(e+=` ${s}`),e+=`
`;const f=t(n.os?.name),v=t(n.os?.version);e+=`Operating System: ${f}`,v!=="N/A"&&(e+=` ${v}`),e+=`
`;const m=t(n.device?.type),r=t(n.device?.vendor);e+=`Device: ${m}`,r!=="N/A"&&(e+=` (${r})`),e+=`
`;const o=t(n.engine?.name),c=t(n.engine?.version);e+=`Rendering Engine: ${o}`,c!=="N/A"&&(e+=` ${c}`),e+=`

`;const d=t(n.userAgentStringComplete);e+=`User Agent:
`,e+=d;const g=h();return g&&g.trim().length>0&&(e+=`

Event Log:
`,e+=`=========
`,e+=g),e}async function A(n){try{const t=C(n);return!navigator.clipboard||!navigator.clipboard.writeText?(console.warn("[deviceInfoPanel.js]: [N/A] - [copyDeviceInfoToClipboard] - Clipboard API not available."),!1):(await navigator.clipboard.writeText(t),console.log("[deviceInfoPanel.js]: [N/A] - [copyDeviceInfoToClipboard] - Device information copied to clipboard successfully."),!0)}catch(t){return console.error("[deviceInfoPanel.js]: [N/A] - [copyDeviceInfoToClipboard] - Error copying to clipboard:",t,"."),!1}}function N(n=null,t="top-left"){const e=n||w(),a={"top-right":"top-4 right-4","top-left":"top-4 left-4","bottom-right":"bottom-4 right-4","bottom-left":"bottom-4 left-4"},l=a[t]||a["top-left"],i=document.createElement("div");i.id="deviceInfoPanel",i.className=`fixed ${l} z-50 pointer-events-auto max-w-[calc(100vw-2rem)]`;const s=c=>c??"N/A",f=y?.(),v=s(f?.version);i.innerHTML=`
        <div class="card bg-base-100 shadow-2xl w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex flex-col">
            <div class="card-body p-4 flex flex-col flex-1 min-h-0">
                <div class="flex justify-between items-center mb-2 shrink-0">
                    <h2 class="card-title text-lg">Device Information</h2>
                    <div class="flex gap-2">
                        <button id="deviceInfoPanelCopy" class="btn btn-sm btn-secondary">Copy</button>
                        <button id="deviceInfoPanelClose" class="btn btn-sm btn-circle btn-ghost">✕</button>
                    </div>
                </div>

                <div class="space-y-3 text-sm overflow-y-auto flex-1 min-h-0">
                    <!-- Version -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Version</div>
                        <div class="pl-2">
                            <div class="text-xs">${v}</div>
                        </div>
                    </div>

                    <!-- Timestamp -->
                    ${e.deviceDetectedTimestamp?`
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Detected</div>
                        <div class="pl-2">
                            <div class="text-xs">${new Date(e.deviceDetectedTimestamp).toLocaleString()}</div>
                        </div>
                    </div>
                    `:""}

                    <!-- Browser -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Browser</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Name:</span> ${s(e.browser?.name)}</div>
                            <div><span class="font-medium">Version:</span> ${s(e.browser?.version)}</div>
                        </div>
                    </div>

                    <!-- OS -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Operating System</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Name:</span> ${s(e.os?.name)}</div>
                            <div><span class="font-medium">Version:</span> ${s(e.os?.version)}</div>
                        </div>
                    </div>

                    <!-- Device -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Device</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Type:</span> ${s(e.device?.type)}</div>
                            <div><span class="font-medium">Vendor:</span> ${s(e.device?.vendor)}</div>
                        </div>
                    </div>

                    <!-- Engine -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Rendering Engine</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Name:</span> ${s(e.engine?.name)}</div>
                            <div><span class="font-medium">Version:</span> ${s(e.engine?.version)}</div>
                        </div>
                    </div>

                    <!-- User Agent -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">User Agent</div>
                        <div class="pl-2">
                            <div class="text-xs break-all text-base-content/60 font-mono">${s(e.userAgentStringComplete)}</div>
                        </div>
                    </div>

                    <!-- Event Log -->
                    <div>
                        <div class="font-semibold text-base-content/70 mb-1">Event Log</div>
                        <div class="pl-2">
                            <div id="deviceInfoPanelEventLog" class="text-xs font-mono whitespace-pre-wrap wrap-break-word text-base-content/60 max-h-40 overflow-y-auto space-y-2"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;const m=i.querySelector("#deviceInfoPanelEventLog");L(m instanceof HTMLElement?m:null);const r=i.querySelector("#deviceInfoPanelClose");r instanceof HTMLElement&&r.addEventListener("click",()=>{i.remove(),console.log("[deviceInfoPanel.js]: [N/A] - [createDeviceInfoPanel] - Device info panel closed.")});const o=i.querySelector("#deviceInfoPanelCopy");return o instanceof HTMLButtonElement&&o.addEventListener("click",async()=>{if(await A(e)){const d=o.textContent;o.textContent="Copied!",o.classList.add("btn-success"),o.classList.remove("btn-ghost"),setTimeout(()=>{o.textContent=d,o.classList.remove("btn-success"),o.classList.add("btn-ghost")},2e3)}else{const d=o.textContent;o.textContent="Failed",o.classList.add("btn-error"),o.classList.remove("btn-ghost"),setTimeout(()=>{o.textContent=d,o.classList.remove("btn-error"),o.classList.add("btn-ghost")},2e3)}}),console.log("[deviceInfoPanel.js]: [N/A] - [createDeviceInfoPanel] - Device info panel created (not appended)."),i}function P(){const n=Array.from(document.querySelectorAll("dialog.modal[open]")).filter(t=>t instanceof HTMLDialogElement&&!!t.querySelector(".generic-dialog-panel-modal-box"));return n.length>0?n[n.length-1]:null}function I(){const n=document.getElementById("deviceInfoPanel");if(!(n instanceof HTMLElement))return;const t=P();if(t){t.contains(n)||(t.appendChild(n),console.log("[deviceInfoPanel.js]: [N/A] - [reconcileDeviceInfoPanelContainer] - deviceInfoPanel moved into open generic dialog.")),p();return}n.parentElement!==document.body&&(document.body.appendChild(n),console.log("[deviceInfoPanel.js]: [N/A] - [reconcileDeviceInfoPanelContainer] - deviceInfoPanel moved back to document.body.")),p()}function $(){D||(D=!0,x=new MutationObserver(()=>{I()}),x.observe(document.body,{subtree:!0,childList:!0,attributes:!0,attributeFilter:["open","class"]}),I(),console.log("[deviceInfoPanel.js]: [N/A] - [initDeviceInfoPanelDialogIntegration] - dialog observer registered."))}function V(n=null,t="top-left"){const e=document.getElementById("deviceInfoPanel");if(e)return e.remove(),console.log("[deviceInfoPanel.js]: [N/A] - [toggleDeviceInfoPanel] - Device info panel toggled off (hidden)."),null;const a=document.getElementById("deviceInfoPanel");a&&a.remove();const l=N(n,t),i=P();return i?i.appendChild(l):document.body.appendChild(l),p(),console.log("[deviceInfoPanel.js]: [N/A] - [toggleDeviceInfoPanel] - Device info panel toggled on (shown)."),l}function j(){u||($(),window.addEventListener(E.TOGGLE_DEBUGUI,()=>{console.log("[deviceInfoPanel.js]: [N/A] - [TOGGLE_DEBUGUI event listener] - toggleDebugUI event received."),V()}),u=!0,console.log("[deviceInfoPanel.js]: [N/A] - [initDeviceInfoPanelDebugToggle] - TOGGLE_DEBUGUI event listener registered."))}export{N as createDeviceInfoPanel,j as initDeviceInfoPanelDebugToggle,V as toggleDeviceInfoPanel};
