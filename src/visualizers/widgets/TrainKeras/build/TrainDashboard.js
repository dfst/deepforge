define((function(){"use strict";function t(){}function e(t){return t()}function n(){return Object.create(null)}function l(t){t.forEach(e)}function o(t){return"function"==typeof t}function r(t,e){return t!=t?e==e:t!==e||t&&"object"==typeof t||"function"==typeof t}function u(t,e){t.appendChild(e)}function c(t,e,n){t.insertBefore(e,n||null)}function i(t){t.parentNode.removeChild(t)}function a(t,e){for(let n=0;n<t.length;n+=1)t[n]&&t[n].d(e)}function f(t){return document.createElement(t)}function s(t){return document.createTextNode(t)}function p(){return s(" ")}function d(t,e,n,l){return t.addEventListener(e,n,l),()=>t.removeEventListener(e,n,l)}function h(t,e,n){null==n?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function m(t){return""===t?void 0:+t}function g(t,e){e=""+e,t.wholeText!==e&&(t.data=e)}function v(t,e){t.value=null==e?"":e}function y(t,e,n,l){t.style.setProperty(e,n,l?"important":"")}function b(t,e){for(let n=0;n<t.options.length;n+=1){const l=t.options[n];if(l.__value===e)return void(l.selected=!0)}}function _(t){const e=t.querySelector(":checked")||t.options[0];return e&&e.__value}let $;function x(t){$=t}const A=[],j=[],w=[],z=[],C=Promise.resolve();let E=!1;function q(t){w.push(t)}let S=!1;const k=new Set;function L(){if(!S){S=!0;do{for(let t=0;t<A.length;t+=1){const e=A[t];x(e),O(e.$$)}for(A.length=0;j.length;)j.pop()();for(let t=0;t<w.length;t+=1){const e=w[t];k.has(e)||(k.add(e),e())}w.length=0}while(A.length);for(;z.length;)z.pop()();E=!1,S=!1,k.clear()}}function O(t){if(null!==t.fragment){t.update(),l(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(q)}}const P=new Set;function T(t,e){-1===t.$$.dirty[0]&&(A.push(t),E||(E=!0,C.then(L)),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function N(r,u,c,a,f,s,p=[-1]){const d=$;x(r);const h=u.props||{},m=r.$$={fragment:null,ctx:null,props:s,update:t,not_equal:f,bound:n(),on_mount:[],on_destroy:[],before_update:[],after_update:[],context:new Map(d?d.$$.context:[]),callbacks:n(),dirty:p};let g=!1;if(m.ctx=c?c(r,h,(t,e,...n)=>{const l=n.length?n[0]:e;return m.ctx&&f(m.ctx[t],m.ctx[t]=l)&&(m.bound[t]&&m.bound[t](l),g&&T(r,t)),e}):[],m.update(),g=!0,l(m.before_update),m.fragment=!!a&&a(m.ctx),u.target){if(u.hydrate){const t=function(t){return Array.from(t.childNodes)}(u.target);m.fragment&&m.fragment.l(t),t.forEach(i)}else m.fragment&&m.fragment.c();u.intro&&((v=r.$$.fragment)&&v.i&&(P.delete(v),v.i(y))),function(t,n,r){const{fragment:u,on_mount:c,on_destroy:i,after_update:a}=t.$$;u&&u.m(n,r),q(()=>{const n=c.map(e).filter(o);i?i.push(...n):l(n),t.$$.on_mount=[]}),a.forEach(q)}(r,u.target,u.anchor),L()}var v,y;x(d)}function B(t,e,n){const l=t.slice();return l[33]=e[n],l[34]=e,l[35]=n,l}function V(t,e,n){const l=t.slice();return l[36]=e[n],l}function F(t,e,n){const l=t.slice();return l[33]=e[n],l[39]=e,l[40]=n,l}function M(t,e,n){const l=t.slice();return l[44]=e[n],l}function R(t,e,n){const l=t.slice();return l[41]=e[n],l}function D(t,e,n){const l=t.slice();return l[47]=e[n],l}function G(t){let e,n,l,o=t[47].name+"";return{c(){e=f("option"),n=s(o),e.__value=l=t[47].id,e.value=e.__value},m(t,l){c(t,e,l),u(e,n)},p(t,r){256&r[0]&&o!==(o=t[47].name+"")&&g(n,o),256&r[0]&&l!==(l=t[47].id)&&(e.__value=l,e.value=e.__value)},d(t){t&&i(e)}}}function H(t){let e,n,l,o=t[44].name+"";return{c(){e=f("option"),n=s(o),e.__value=l=t[44],e.value=e.__value},m(t,l){c(t,e,l),u(e,n)},p(t,r){128&r[0]&&o!==(o=t[44].name+"")&&g(n,o),128&r[0]&&l!==(l=t[44])&&(e.__value=l,e.value=e.__value)},d(t){t&&i(e)}}}function I(t){let e,n,l=t[41][1],o=[];for(let e=0;e<l.length;e+=1)o[e]=H(M(t,l,e));return{c(){e=f("optgroup");for(let t=0;t<o.length;t+=1)o[t].c();h(e,"label",n=t[41][0])},m(t,n){c(t,e,n);for(let t=0;t<o.length;t+=1)o[t].m(e,null)},p(t,r){if(128&r[0]){let n;for(l=t[41][1],n=0;n<l.length;n+=1){const u=M(t,l,n);o[n]?o[n].p(u,r):(o[n]=H(u),o[n].c(),o[n].m(e,null))}for(;n<o.length;n+=1)o[n].d(1);o.length=l.length}128&r[0]&&n!==(n=t[41][0])&&h(e,"label",n)},d(t){t&&i(e),a(o,t)}}}function J(t){let e,n,l,o,r,a,y=t[33].name+"";function b(){t[20].call(o,t[39],t[40])}return{c(){e=f("label"),n=s(y),l=p(),o=f("input"),h(o,"type","number")},m(i,f){c(i,e,f),u(e,n),c(i,l,f),c(i,o,f),v(o,t[33].value),r||(a=d(o,"input",b),r=!0)},p(e,l){t=e,64&l[0]&&y!==(y=t[33].name+"")&&g(n,y),192&l[0]&&m(o.value)!==t[33].value&&v(o,t[33].value)},d(t){t&&i(e),t&&i(l),t&&i(o),r=!1,a()}}}function K(e){return{c:t,m:t,p:t,d:t}}function Q(t){let e,n,l,o,r,a,m=t[33].name+"";function y(){t[19].call(o,t[39],t[40])}return{c(){e=f("label"),n=s(m),l=p(),o=f("input"),h(o,"type","text")},m(i,f){c(i,e,f),u(e,n),c(i,l,f),c(i,o,f),v(o,t[33].value),r||(a=d(o,"input",y),r=!0)},p(e,l){t=e,64&l[0]&&m!==(m=t[33].name+"")&&g(n,m),192&l[0]&&o.value!==t[33].value&&v(o,t[33].value)},d(t){t&&i(e),t&&i(l),t&&i(o),r=!1,a()}}}function U(e){return{c:t,m:t,p:t,d:t}}function W(t){let e;function n(t,e){return"boolean"===t[33].type?U:"string"===t[33].type?Q:"reduction"===t[33].type?K:J}let l=n(t),o=l(t);return{c(){e=f("div"),o.c(),h(e,"class","form-group")},m(t,n){c(t,e,n),o.m(e,null)},p(t,r){l===(l=n(t))&&o?o.p(t,r):(o.d(1),o=l(t),o&&(o.c(),o.m(e,null)))},d(t){t&&i(e),o.d()}}}function X(t){let e,n,l,o=t[36].name+"";return{c(){e=f("option"),n=s(o),e.__value=l=t[36],e.value=e.__value},m(t,l){c(t,e,l),u(e,n)},p(t,r){32&r[0]&&o!==(o=t[36].name+"")&&g(n,o),32&r[0]&&l!==(l=t[36])&&(e.__value=l,e.value=e.__value)},d(t){t&&i(e)}}}function Y(t){let e,n,l,o,r,a,y=t[33].name+"";function b(){t[23].call(o,t[34],t[35])}return{c(){e=f("label"),n=s(y),l=p(),o=f("input"),h(o,"type","number")},m(i,f){c(i,e,f),u(e,n),c(i,l,f),c(i,o,f),v(o,t[33].value),r||(a=d(o,"input",b),r=!0)},p(e,l){t=e,16&l[0]&&y!==(y=t[33].name+"")&&g(n,y),48&l[0]&&m(o.value)!==t[33].value&&v(o,t[33].value)},d(t){t&&i(e),t&&i(l),t&&i(o),r=!1,a()}}}function Z(e){return{c:t,m:t,p:t,d:t}}function tt(t){let e,n,l,o,r,a,m=t[33].name+"";function y(){t[22].call(o,t[34],t[35])}return{c(){e=f("label"),n=s(m),l=p(),o=f("input"),h(o,"type","text")},m(i,f){c(i,e,f),u(e,n),c(i,l,f),c(i,o,f),v(o,t[33].value),r||(a=d(o,"input",y),r=!0)},p(e,l){t=e,16&l[0]&&m!==(m=t[33].name+"")&&g(n,m),48&l[0]&&o.value!==t[33].value&&v(o,t[33].value)},d(t){t&&i(e),t&&i(l),t&&i(o),r=!1,a()}}}function et(e){return{c:t,m:t,p:t,d:t}}function nt(t){let e;function n(t,e){return"boolean"===t[33].type?et:"string"===t[33].type?tt:"reduction"===t[33].type?Z:Y}let l=n(t),o=l(t);return{c(){e=f("div"),o.c(),h(e,"class","form-group")},m(t,n){c(t,e,n),o.m(e,null)},p(t,r){l===(l=n(t))&&o?o.p(t,r):(o.d(1),o=l(t),o&&(o.c(),o.m(e,null)))},d(t){t&&i(e),o.d()}}}function lt(e){let n,o,r,s,g,_,$,x,A,j,w,z,C,E,S,k,L,O,P,T,N,M,H,J,K,Q,U,Y,Z,tt,et,lt,ot,rt,ut,ct,it,at,ft,st,pt,dt,ht,mt,gt,vt,yt,bt,_t,$t,xt,At=e[8],jt=[];for(let t=0;t<At.length;t+=1)jt[t]=G(D(e,At,t));let wt=e[7],zt=[];for(let t=0;t<wt.length;t+=1)zt[t]=I(R(e,wt,t));let Ct=e[6].arguments,Et=[];for(let t=0;t<Ct.length;t+=1)Et[t]=W(F(e,Ct,t));let qt=e[5],St=[];for(let t=0;t<qt.length;t+=1)St[t]=X(V(e,qt,t));let kt=e[4].arguments,Lt=[];for(let t=0;t<kt.length;t+=1)Lt[t]=nt(B(e,kt,t));return{c(){n=f("main"),o=f("div"),r=f("div"),s=f("h3"),s.textContent="Training Parameters",g=p(),_=f("div"),$=f("form"),x=f("div"),A=f("label"),A.textContent="Architecture:",j=p(),w=f("select");for(let t=0;t<jt.length;t+=1)jt[t].c();z=p(),C=f("div"),E=f("label"),E.textContent="Loss Function:",S=p(),k=f("select");for(let t=0;t<zt.length;t+=1)zt[t].c();L=p(),O=f("span"),P=p();for(let t=0;t<Et.length;t+=1)Et[t].c();T=p(),N=f("div"),M=f("label"),M.textContent="Optimizer:",H=p(),J=f("select");for(let t=0;t<St.length;t+=1)St[t].c();K=p();for(let t=0;t<Lt.length;t+=1)Lt[t].c();Q=p(),U=f("div"),Y=f("label"),Y.textContent="Learning Rate:",Z=p(),tt=f("input"),et=p(),lt=f("div"),ot=f("label"),ot.textContent="Batch Size",rt=p(),ut=f("input"),ct=p(),it=f("div"),at=f("label"),at.textContent="Epochs",ft=p(),st=f("input"),pt=p(),dt=f("div"),ht=f("label"),ht.textContent="Validation Split",mt=p(),gt=f("input"),vt=p(),yt=f("div"),bt=p(),_t=f("div"),_t.textContent="test",h(A,"for","arch"),h(w,"id","arch"),void 0===e[9]&&q(()=>e[17].call(w)),h(x,"class","form-group"),h(E,"for","loss"),h(k,"id","loss"),void 0===e[6]&&q(()=>e[18].call(k)),h(O,"class","glyphicon glyphicon-info-sign"),h(O,"aria-hidden","true"),h(C,"class","form-group"),h(M,"for","optimizer"),h(J,"id","optimizer"),void 0===e[4]&&q(()=>e[21].call(J)),h(N,"class","form-group"),h(tt,"type","number"),h(U,"class","form-group"),h(ut,"type","number"),h(lt,"class","form-group"),h(st,"type","number"),h(it,"class","form-group"),h(gt,"type","number"),h(dt,"class","form-group"),h(_,"class","well"),h(r,"class","config-panel svelte-1jqbxjb"),h(yt,"class","plot-container"),y(yt,"flex-grow","4"),y(_t,"display","none"),h(_t,"class","output-panel svelte-1jqbxjb"),h(o,"class","row svelte-1jqbxjb"),h(n,"class","svelte-1jqbxjb")},m(t,l){c(t,n,l),u(n,o),u(o,r),u(r,s),u(r,g),u(r,_),u(_,$),u($,x),u(x,A),u(x,j),u(x,w);for(let t=0;t<jt.length;t+=1)jt[t].m(w,null);b(w,e[9]),u($,z),u($,C),u(C,E),u(C,S),u(C,k);for(let t=0;t<zt.length;t+=1)zt[t].m(k,null);b(k,e[6]),u(C,L),u(C,O),u($,P);for(let t=0;t<Et.length;t+=1)Et[t].m($,null);u($,T),u($,N),u(N,M),u(N,H),u(N,J);for(let t=0;t<St.length;t+=1)St[t].m(J,null);b(J,e[4]),u($,K);for(let t=0;t<Lt.length;t+=1)Lt[t].m($,null);u($,Q),u($,U),u(U,Y),u(U,Z),u(U,tt),v(tt,e[3]),u($,et),u($,lt),u(lt,ot),u(lt,rt),u(lt,ut),v(ut,e[0]),u($,ct),u($,it),u(it,at),u(it,ft),u(it,st),v(st,e[1]),u($,pt),u($,dt),u(dt,ht),u(dt,mt),u(dt,gt),v(gt,e[2]),u(o,vt),u(o,yt),e[28](yt),u(o,bt),u(o,_t),$t||(xt=[d(w,"change",e[17]),d(k,"change",e[18]),d(J,"change",e[21]),d(tt,"input",e[24]),d(ut,"input",e[25]),d(st,"input",e[26]),d(gt,"input",e[27])],$t=!0)},p(t,e){if(256&e[0]){let n;for(At=t[8],n=0;n<At.length;n+=1){const l=D(t,At,n);jt[n]?jt[n].p(l,e):(jt[n]=G(l),jt[n].c(),jt[n].m(w,null))}for(;n<jt.length;n+=1)jt[n].d(1);jt.length=At.length}if(768&e[0]&&b(w,t[9]),128&e[0]){let n;for(wt=t[7],n=0;n<wt.length;n+=1){const l=R(t,wt,n);zt[n]?zt[n].p(l,e):(zt[n]=I(l),zt[n].c(),zt[n].m(k,null))}for(;n<zt.length;n+=1)zt[n].d(1);zt.length=wt.length}if(192&e[0]&&b(k,t[6]),64&e[0]){let n;for(Ct=t[6].arguments,n=0;n<Ct.length;n+=1){const l=F(t,Ct,n);Et[n]?Et[n].p(l,e):(Et[n]=W(l),Et[n].c(),Et[n].m($,T))}for(;n<Et.length;n+=1)Et[n].d(1);Et.length=Ct.length}if(32&e[0]){let n;for(qt=t[5],n=0;n<qt.length;n+=1){const l=V(t,qt,n);St[n]?St[n].p(l,e):(St[n]=X(l),St[n].c(),St[n].m(J,null))}for(;n<St.length;n+=1)St[n].d(1);St.length=qt.length}if(48&e[0]&&b(J,t[4]),16&e[0]){let n;for(kt=t[4].arguments,n=0;n<kt.length;n+=1){const l=B(t,kt,n);Lt[n]?Lt[n].p(l,e):(Lt[n]=nt(l),Lt[n].c(),Lt[n].m($,Q))}for(;n<Lt.length;n+=1)Lt[n].d(1);Lt.length=kt.length}8&e[0]&&m(tt.value)!==t[3]&&v(tt,t[3]),1&e[0]&&m(ut.value)!==t[0]&&v(ut,t[0]),2&e[0]&&m(st.value)!==t[1]&&v(st,t[1]),4&e[0]&&m(gt.value)!==t[2]&&v(gt,t[2])},i:t,o:t,d(t){t&&i(n),a(jt,t),a(zt,t),a(Et,t),a(St,t),a(Lt,t),e[28](null),$t=!1,l(xt)}}}function ot(t,e,n){const l={name:"",arguments:[]};let o,r,u=null,c=32,i=50,a=.1,f=.005,s=l,p=[],d=l,h=[],g=[];const v=[{name:"Training",type:"scatter",y:[.1,.15,.2,.25]},{name:"Validation",type:"scatter",y:[.1,.12,.18,.2]}],y={title:"Accuracy"};return[c,i,a,f,s,p,d,h,g,o,r,function(t,e){!function(t){t.losses.concat(t.optimizers).forEach(t=>{t.arguments=t.arguments.filter(t=>"name"!==t.name).map(t=>{if(void 0===t.default)throw console.log(t),new Error("no default provided");return t.type=typeof t.default,t.value=t.default,t})})}(e),n(5,p=e.optimizers),n(4,s=p[0]);const l={};e.losses.forEach(t=>{l[t.category]||(l[t.category]=[]),l[t.category].push(t)}),n(7,h=Object.entries(l)),n(6,d=e.losses[0]),u=t,v&&u.newPlot(r,v,y)},function(t){n(8,g=g.concat(t))},function(t){n(8,g=g.map(e=>e.id===t.id?t:e))},function(t){n(8,g=g.filter(e=>e.id!==t))},function(t){n(6,d=t.loss||d),n(4,s=t.optimizer||s),n(8,g=t.architectures||g)},function(){return{batchSize:c,validation:a,optimizer:s,epochs:i,lr:f,loss:d}},function(){o=_(this),n(9,o),n(8,g)},function(){d=_(this),n(6,d),n(7,h)},function(t,e){t[e].value=this.value,n(6,d),n(7,h)},function(t,e){t[e].value=m(this.value),n(6,d),n(7,h)},function(){s=_(this),n(4,s),n(5,p)},function(t,e){t[e].value=this.value,n(4,s),n(5,p)},function(t,e){t[e].value=m(this.value),n(4,s),n(5,p)},function(){f=m(this.value),n(3,f)},function(){c=m(this.value),n(0,c)},function(){i=m(this.value),n(1,i)},function(){a=m(this.value),n(2,a)},function(t){j[t?"unshift":"push"](()=>{r=t,n(10,r)})}]}return class extends class{$destroy(){!function(t,e){const n=t.$$;null!==n.fragment&&(l(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}(this,1),this.$destroy=t}$on(t,e){const n=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return n.push(e),()=>{const t=n.indexOf(e);-1!==t&&n.splice(t,1)}}$set(){}}{constructor(t){super(),N(this,t,ot,lt,r,{initialize:11,addArchitecture:12,updateArchitecture:13,removeArchitecture:14,set:15,data:16},[-1,-1])}get initialize(){return this.$$.ctx[11]}get addArchitecture(){return this.$$.ctx[12]}get updateArchitecture(){return this.$$.ctx[13]}get removeArchitecture(){return this.$$.ctx[14]}get set(){return this.$$.ctx[15]}get data(){return this.$$.ctx[16]}}}));
//# sourceMappingURL=TrainDashboard.js.map
