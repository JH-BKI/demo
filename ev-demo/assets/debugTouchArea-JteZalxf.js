import{d as T,E as m}from"./index-atDm_1ui.js";let o=null,a=0,i=0,u=0,s=0,r=!1,t=null;const d=2e3,n=5;function D(){if(r){console.warn("[debugTouchArea.js]: [N/A] - [initDebugTouchArea] - Debug touch area already initialized.");return}o=document.createElement("div"),o.id="debugTouchArea",o.style.cssText=`
        position: fixed;
        top: 0;
        right: 0;
        width: 65px;
        height: 65px;
        background: transparent;
        opacity: 0;
        z-index: 999;
        pointer-events: auto;
        touch-action: none;
    `,o.addEventListener("touchstart",p,{passive:!1}),o.addEventListener("touchend",A,{passive:!1}),o.addEventListener("mousedown",g,{passive:!1}),o.addEventListener("mouseup",v,{passive:!1}),document.body.appendChild(o),r=!0,console.log("[debugTouchArea.js]: [N/A] - [initDebugTouchArea] - Debug touch/click area initialized for all devices.")}function h(){t!==null&&clearTimeout(t),t=setTimeout(()=>{console.log(`[debugTouchArea.js]: [N/A] - [startTimer] - Timer expired before ${n} interactions completed, resetting counters.`),f()},d),console.log(`[debugTouchArea.js]: [N/A] - [startTimer] - Timer started, ${n} interactions must complete within ${d}ms.`)}function f(){a=0,i=0,u=0,s=0,t!==null&&(clearTimeout(t),t=null),console.log("[debugTouchArea.js]: [N/A] - [resetCounters] - All counters and timer reset.")}function p(e){a+i+u+s===0&&h(),a++,console.log(`[debugTouchArea.js]: [N/A] - [handleTouchStart] - touchStartCount has a value of ${a}.`),a<=n&&e.preventDefault(),c()}function A(e){i++,console.log(`[debugTouchArea.js]: [N/A] - [handleTouchEnd] - touchEndCount has a value of ${i}.`),i<=n&&e.preventDefault(),c()}function g(e){a+i+u+s===0&&h(),u++,console.log(`[debugTouchArea.js]: [N/A] - [handleMouseDown] - mouseDownCount has a value of ${u}.`),u<=n&&e.preventDefault(),c()}function v(e){s++,console.log(`[debugTouchArea.js]: [N/A] - [handleMouseUp] - mouseUpCount has a value of ${s}.`),s<=n&&e.preventDefault(),c()}function c(){const e=Math.min(a,i),l=Math.min(u,s);e+l>=n&&(t!==null&&(clearTimeout(t),t=null),console.log(`[debugTouchArea.js]: [N/A] - [checkAndFireEvent] - ${n} interaction pairs detected within time limit (touch: ${e}, mouse: ${l}), firing TOGGLE_DEBUGUI event.`),T(m.TOGGLE_DEBUGUI),f())}export{D as initDebugTouchArea};
