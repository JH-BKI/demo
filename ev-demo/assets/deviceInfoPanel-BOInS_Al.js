import{E,g,h as w,a as T,b as V,c as O,e as j,f as B}from"./index-Ba2CvrU_.js";let A=!1,P=!1,h=!1,L=null;function p(e,t){return e==null||t===null||t===void 0?"N/A":`${e} × ${t}`}function M(e){const t=o=>o??"N/A";return[`Orientation: ${t(e?.orientation)}`,`Viewport: ${p(e?.viewportWidth,e?.viewportHeight)}`,`Canvas: ${p(e?.canvasWidth,e?.canvasHeight)}`,`Aspect ratio: ${t(e?.aspectRatio)}`,`Canvas aspect ratio: ${t(e?.canvasAspectRatio)}`,`Device pixel ratio: ${t(e?.devicePixelRatio)}`].join(`
`)}function C(e=null){const t=e||g()?.environment;return j(t)}function $(e=null){const t=document.getElementById("deviceInfoPanel");if(!(t instanceof HTMLElement))return;const o=g()?.environment,n=e||o?.device;if(!n)return;const i=l=>l??"N/A",d={deviceInfoInputMethod:C(o),deviceInfoOrientation:i(n.orientation),deviceInfoViewport:p(n.viewportWidth,n.viewportHeight),deviceInfoCanvas:p(n.canvasWidth,n.canvasHeight),deviceInfoAspectRatio:i(n.aspectRatio),deviceInfoCanvasAspectRatio:i(n.canvasAspectRatio),deviceInfoDevicePixelRatio:i(n.devicePixelRatio)};Object.entries(d).forEach(([l,c])=>{const s=t.querySelector(`#${l}`);s&&s.textContent!==c&&(s.textContent=c)})}function b(e){if(!e)return"N/A";try{return new Date(e).toLocaleString()}catch{return"N/A"}}function y(){return g()?.environment?.deviceDetectedTimestamp??null}function H(e,t={}){const o=x=>x??"N/A";let n=`Device Information
`;n+=`==================

`;const i=V?.(),d=o(i?.version);n+=`Version: ${d}

`;const l=t.appInitTimestamp??y(),c=t.debugInitTimestamp??null;n+=`Detected:
`,n+=`App init: ${b(l)}
`,n+=`Debug init: ${b(c)}

`;const s=o(e.browser?.name),m=o(e.browser?.version);n+=`Browser: ${s}`,m!=="N/A"&&(n+=` ${m}`),n+=`
`;const I=o(e.os?.name),f=o(e.os?.version);n+=`Operating System: ${I}`,f!=="N/A"&&(n+=` ${f}`),n+=`
`;const u=o(e.device?.type),a=o(e.device?.vendor);n+=`Device: ${u}`,a!=="N/A"&&(n+=` (${a})`),n+=`
`,n+=`Input: ${C(e)}
`,n+=`${M(e.device)}
`;const r=o(e.engine?.name),v=o(e.engine?.version);n+=`Rendering Engine: ${r}`,v!=="N/A"&&(n+=` ${v}`),n+=`

`;const R=o(e.userAgentStringComplete);n+=`User Agent:
`,n+=R;const D=B();return D&&D.trim().length>0&&(n+=`

Event Log:
`,n+=`=========
`,n+=D),n}async function _(e,t={}){try{const o=H(e,t);return!navigator.clipboard||!navigator.clipboard.writeText?(console.warn("[deviceInfoPanel.js]: [N/A] - [copyDeviceInfoToClipboard] - Clipboard API not available."),!1):(await navigator.clipboard.writeText(o),console.log("[deviceInfoPanel.js]: [N/A] - [copyDeviceInfoToClipboard] - Device information copied to clipboard successfully."),!0)}catch(o){return console.error("[deviceInfoPanel.js]: [N/A] - [copyDeviceInfoToClipboard] - Error copying to clipboard:",o,"."),!1}}function G(e=null,t="top-left"){const o=y(),n=new Date().toISOString(),i=e||T(),d={"top-right":"top-4 right-4","top-left":"top-4 left-4","bottom-right":"bottom-4 right-4","bottom-left":"bottom-4 left-4"},l=d[t]||d["top-left"],c=document.createElement("div");c.id="deviceInfoPanel",c.dataset.debugInitTimestamp=n,c.className=`fixed ${l} z-50 pointer-events-auto max-w-[calc(100vw-2rem)]`;const s=r=>r??"N/A",m=V?.(),I=s(m?.version);c.innerHTML=`
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
                            <div class="text-xs">${I}</div>
                        </div>
                    </div>

                    <!-- Detected timestamps -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Detected</div>
                        <div class="pl-2 text-xs">
                            <div><span class="font-medium">App init:</span> ${b(o)}</div>
                            <div><span class="font-medium">Debug init:</span> ${b(n)}</div>
                        </div>
                    </div>

                    <!-- Browser -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Browser</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Name:</span> ${s(i.browser?.name)}</div>
                            <div><span class="font-medium">Version:</span> ${s(i.browser?.version)}</div>
                        </div>
                    </div>

                    <!-- OS -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Operating System</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Name:</span> ${s(i.os?.name)}</div>
                            <div><span class="font-medium">Version:</span> ${s(i.os?.version)}</div>
                        </div>
                    </div>

                    <!-- Device -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Device</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Type:</span> ${s(i.device?.type)}</div>
                            <div><span class="font-medium">Vendor:</span> ${s(i.device?.vendor)}</div>
                            <div><span class="font-medium">Input:</span> <span id="deviceInfoInputMethod">${C(i)}</span></div>
                            <div><span class="font-medium">Orientation:</span> <span id="deviceInfoOrientation">${s(i.device?.orientation)}</span></div>
                            <div><span class="font-medium">Viewport:</span> <span id="deviceInfoViewport">${p(i.device?.viewportWidth,i.device?.viewportHeight)}</span></div>
                            <div><span class="font-medium">Canvas:</span> <span id="deviceInfoCanvas">${p(i.device?.canvasWidth,i.device?.canvasHeight)}</span></div>
                            <div><span class="font-medium">Aspect ratio:</span> <span id="deviceInfoAspectRatio">${s(i.device?.aspectRatio)}</span></div>
                            <div><span class="font-medium">Canvas aspect ratio:</span> <span id="deviceInfoCanvasAspectRatio">${s(i.device?.canvasAspectRatio)}</span></div>
                            <div><span class="font-medium">Device pixel ratio:</span> <span id="deviceInfoDevicePixelRatio">${s(i.device?.devicePixelRatio)}</span></div>
                        </div>
                    </div>

                    <!-- Engine -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">Rendering Engine</div>
                        <div class="pl-2">
                            <div><span class="font-medium">Name:</span> ${s(i.engine?.name)}</div>
                            <div><span class="font-medium">Version:</span> ${s(i.engine?.version)}</div>
                        </div>
                    </div>

                    <!-- User Agent -->
                    <div class="border-b border-base-300 pb-2">
                        <div class="font-semibold text-base-content/70 mb-1">User Agent</div>
                        <div class="pl-2">
                            <div class="text-xs break-all text-base-content/60 font-mono">${s(i.userAgentStringComplete)}</div>
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
    `;const f=c.querySelector("#deviceInfoPanelEventLog");O(f instanceof HTMLElement?f:null);const u=c.querySelector("#deviceInfoPanelClose");u instanceof HTMLElement&&u.addEventListener("click",()=>{c.remove(),console.log("[deviceInfoPanel.js]: [N/A] - [createDeviceInfoPanel] - Device info panel closed.")});const a=c.querySelector("#deviceInfoPanelCopy");return a instanceof HTMLButtonElement&&a.addEventListener("click",async()=>{if(await _(T(),{appInitTimestamp:y(),debugInitTimestamp:c.dataset.debugInitTimestamp||null})){const v=a.textContent;a.textContent="Copied!",a.classList.add("btn-success"),a.classList.remove("btn-ghost"),setTimeout(()=>{a.textContent=v,a.classList.remove("btn-success"),a.classList.add("btn-ghost")},2e3)}else{const v=a.textContent;a.textContent="Failed",a.classList.add("btn-error"),a.classList.remove("btn-ghost"),setTimeout(()=>{a.textContent=v,a.classList.remove("btn-error"),a.classList.add("btn-ghost")},2e3)}}),console.log("[deviceInfoPanel.js]: [N/A] - [createDeviceInfoPanel] - Device info panel created (not appended)."),c}function S(){const e=Array.from(document.querySelectorAll("dialog.modal[open]")).filter(t=>t instanceof HTMLDialogElement&&!!t.querySelector(".generic-dialog-panel-modal-box"));return e.length>0?e[e.length-1]:null}function N(){const e=document.getElementById("deviceInfoPanel");if(!(e instanceof HTMLElement))return;const t=S();if(t){t.contains(e)||(t.appendChild(e),console.log("[deviceInfoPanel.js]: [N/A] - [reconcileDeviceInfoPanelContainer] - deviceInfoPanel moved into open generic dialog.")),w();return}e.parentElement!==document.body&&(document.body.appendChild(e),console.log("[deviceInfoPanel.js]: [N/A] - [reconcileDeviceInfoPanelContainer] - deviceInfoPanel moved back to document.body.")),w()}function U(){P||(P=!0,L=new MutationObserver(()=>{N()}),L.observe(document.body,{subtree:!0,childList:!0,attributes:!0,attributeFilter:["open","class"]}),N(),console.log("[deviceInfoPanel.js]: [N/A] - [initDeviceInfoPanelDialogIntegration] - dialog observer registered."))}function k(e=null,t="top-left"){const o=document.getElementById("deviceInfoPanel");if(o)return o.remove(),console.log("[deviceInfoPanel.js]: [N/A] - [toggleDeviceInfoPanel] - Device info panel toggled off (hidden)."),null;const n=document.getElementById("deviceInfoPanel");n&&n.remove();const i=G(e,t),d=S();return d?d.appendChild(i):document.body.appendChild(i),w(),console.log("[deviceInfoPanel.js]: [N/A] - [toggleDeviceInfoPanel] - Device info panel toggled on (shown)."),i}function q(){h||(window.addEventListener(E.ENVIRONMENT_DEVICE_DETECT,e=>{const t=e?.detail?.device||g()?.environment?.device;$(t)}),window.addEventListener(E.DEVICE_BODY_CLASSES_SYNCED,()=>{$()}),h=!0,console.log("[deviceInfoPanel.js]: [N/A] - [initDeviceViewportDisplayListener] - ENVIRONMENT_DEVICE_DETECT and DEVICE_BODY_CLASSES_SYNCED listeners registered."))}function Y(){A||(U(),q(),window.addEventListener(E.TOGGLE_DEBUGUI,()=>{console.log("[deviceInfoPanel.js]: [N/A] - [TOGGLE_DEBUGUI event listener] - toggleDebugUI event received."),k()}),A=!0,console.log("[deviceInfoPanel.js]: [N/A] - [initDeviceInfoPanelDebugToggle] - TOGGLE_DEBUGUI event listener registered."))}export{G as createDeviceInfoPanel,Y as initDeviceInfoPanelDebugToggle,k as toggleDeviceInfoPanel};
