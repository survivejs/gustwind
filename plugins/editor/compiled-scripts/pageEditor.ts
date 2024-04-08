import{draggable as y}from"https://cdn.skypack.dev/dragjs@v0.13.4?min";import{produce as C}from"https://cdn.skypack.dev/immer@9.0.16?min";function g(n,t){let i=[],e=n.parentElement;for(let o=0;o<1e5&&e;o++)e.hasAttribute(t)&&i.push(e),e=e.parentElement;return i}function h(n,t){let i=document.createElement(t),e=n.cloneNode(!0);for(;e.firstChild;)i.appendChild(e.firstChild);for(let o of e.attributes)i.setAttribute(o.name,o.value);return i}function m(n,t){let i=0;function e(o,r){Array.isArray(o)?o.forEach(a=>e(a,r)):(r(o,i),i++)}e(n,t)}var b="document-tree-element",L="controls-element";async function S(n,t,i){console.log("create editor");let[e,o,r,a]=await Promise.all([fetch("/components.json").then(l=>l.json()),fetch("./context.json").then(l=>l.json()),fetch("./layout.json").then(l=>l.json()),fetch("./route.json").then(l=>l.json())]),s=M(r,a),c=await w(e,o,n,t,i);s.append(c);let d=await H(e,o,n);s.append(d),document.body.appendChild(s),evaluateAllDirectives();let p=T(s);globalThis.onclick=({target:l})=>p(l),globalThis.ontouchstart=({target:l})=>p(l)}function T(n){return function(i){if(!i)return;let e=i,o=e.hasAttribute("data-id")?e:g(e,"data-id")[0];if(!o||o.nodeName==="BODY")return;let r=o.getAttribute("data-id"),{editor:{layout:a}}=getState(n);setState({selectionId:r},{element:n,parent:"editor"}),o&&v(n,o,a)}}var u;function v(n,t,i){let e,o=t.dataset.id;if(!o){console.log("target doesn't have a selection id");return}let r=s=>{!s||!s.target||x(n,i,o,s.target,e)},a=s=>{if(!s.target){console.warn("inputListener - No element found");return}s.preventDefault(),t.removeAttribute("contenteditable"),t.removeEventListener("input",r),t.removeEventListener("focusout",a)};u&&(u.classList.remove("border"),u.classList.remove("border-red-800")),u=t,t.classList.add("border"),t.classList.add("border-red-800"),t.children.length===0&&t.textContent&&(e=t.textContent,t.setAttribute("contenteditable","true"),t.addEventListener("focusout",a),t.addEventListener("input",r),t.focus())}function x(n,t,i,e,o){let r=e.textContent;if(o===r){console.log("content didn't change");return}if(typeof r!="string")return;let a=C(t,c=>{m(c,d=>{d?.attributes?.["data-id"]===i&&(d.children=r)})}),s=n.children[0];setState({layout:a},{element:s,parent:"editor"})}var f="editors";function M(n,t){let i=document.getElementById(f),e={layout:n,meta:t.meta,selectionId:void 0};return i?.remove(),i=document.createElement("div"),i.id=f,i.style.visibility="visible",i.setAttribute("x-state",JSON.stringify(e)),i.setAttribute("x-label","editor"),i}function k(){let n=document.getElementById(f);n&&(n.style.visibility=n.style.visibility==="visible"?"hidden":"visible")}async function w(n,t,i,e,o){console.log("creating page editor");let r=document.createElement("div");r.id=b,r.innerHTML=await breezewind({component:n.PageEditor,components:n,context:t,extensions:[breezeExtensions.visibleIf,breezeExtensions.classShortcut(i),breezeExtensions.foreach],globalUtilities:e,componentUtilities:o});let a=r.children[0],s=a.children[0];return y({element:a,handle:s}),r}async function H(n,t,i){let e=document.createElement("div");e.id=L,e.innerHTML=await breezewind({component:n.ComponentEditor,components:n,context:t,extensions:[breezeExtensions.visibleIf,breezeExtensions.classShortcut(i),breezeExtensions.foreach]});let o=e.children[0],r=o.children[0];return y({element:o,handle:r,xPosition:"right"}),e}function I(n,t){let{editor:{meta:i}}=getState(n),e=n.dataset.field;if(!e){console.error(`${e} was not found in ${n.dataset}`);return}if(e==="title"){let o=document.querySelector("title");o?o.innerHTML=t||"":console.warn("The page doesn't have a <title>!")}else{let o=document.head.querySelector("meta[name='"+e+"']");o?o.setAttribute("content",t):console.warn(`The page doesn't have a ${e} meta element!`)}setState({meta:{...i,[e]:t}},{element:n,parent:"editor"})}function A(n,t){let{editor:{layout:i,selectionId:e}}=getState(n),o=E(i,e,(r,a)=>{a.forEach(s=>{s.innerHTML=t}),r.children=t});setState({layout:o},{element:n,parent:"editor"})}function P(n,t){let{editor:{layout:i,selectionId:e}}=getState(n),o=E(i,e,(r,a)=>{Array.isArray(r)||(a.forEach(s=>s.setAttribute("class",t)),r.class=t)});setState({layout:o},{element:n,parent:"editor"})}function D(n,t){let{editor:{layout:i,selectionId:e}}=getState(n),o=E(i,e,(r,a)=>{Array.isArray(r)||(a.forEach(s=>s.replaceWith(h(s,t))),r.type=t)});setState({layout:o},{element:n,parent:"editor"})}function E(n,t,i){return C(n,e=>{m(e,o=>{o?.attributes?.["data-id"]===t&&i(o,Array.from(document.querySelectorAll(`*[data-id="${t}"]`)))})})}function j(n){let{layout:t,selectionId:i}=n;if(!i)return{};let e;return m(t,o=>{o?.attributes?.["data-id"]===i&&(e=o)}),e}"Deno"in globalThis||(console.log("Hello from the page editor"),window.createEditor=S,window.classChanged=P,window.contentChanged=A,window.getSelectedComponent=j,window.metaChanged=I,window.elementChanged=D);export{S as createEditor,k as toggleEditorVisibility};
