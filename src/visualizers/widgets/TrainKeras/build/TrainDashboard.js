define((function(){"use strict";function t(){}function e(t){return t()}function n(){return Object.create(null)}function l(t){t.forEach(e)}function o(t){return"function"==typeof t}function i(t,e){return t!=t?e==e:t!==e||t&&"object"==typeof t||"function"==typeof t}function r(t,e){t.appendChild(e)}function c(t,e,n){t.insertBefore(e,n||null)}function u(t){t.parentNode.removeChild(t)}function a(t,e){for(let n=0;n<t.length;n+=1)t[n]&&t[n].d(e)}function s(t){return document.createElement(t)}function f(t){return document.createTextNode(t)}function d(){return f(" ")}function p(t,e,n,l){return t.addEventListener(e,n,l),()=>t.removeEventListener(e,n,l)}function h(t){return function(e){return e.preventDefault(),t.call(this,e)}}function g(t){return function(e){return e.stopPropagation(),t.call(this,e)}}function m(t,e,n){null==n?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function v(t){return""===t?void 0:+t}function $(t,e){e=""+e,t.wholeText!==e&&(t.data=e)}function _(t,e){t.value=null==e?"":e}function b(t,e,n,l){t.style.setProperty(e,n,l?"important":"")}function y(t,e){for(let n=0;n<t.options.length;n+=1){const l=t.options[n];if(l.__value===e)return void(l.selected=!0)}}function x(t){const e=t.querySelector(":checked")||t.options[0];return e&&e.__value}let C;function k(t){C=t}const w=[],A=[],E=[],T=[],z=Promise.resolve();let M=!1;function L(t){E.push(t)}let S=!1;const D=new Set;function P(){if(!S){S=!0;do{for(let t=0;t<w.length;t+=1){const e=w[t];k(e),O(e.$$)}for(w.length=0;A.length;)A.pop()();for(let t=0;t<E.length;t+=1){const e=E[t];D.has(e)||(D.add(e),e())}E.length=0}while(w.length);for(;T.length;)T.pop()();M=!1,S=!1,D.clear()}}function O(t){if(null!==t.fragment){t.update(),l(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(L)}}const N=new Set;function j(t,e){-1===t.$$.dirty[0]&&(w.push(t),M||(M=!0,z.then(P)),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function H(i,r,c,a,s,f,d=[-1]){const p=C;k(i);const h=r.props||{},g=i.$$={fragment:null,ctx:null,props:f,update:t,not_equal:s,bound:n(),on_mount:[],on_destroy:[],before_update:[],after_update:[],context:new Map(p?p.$$.context:[]),callbacks:n(),dirty:d,skip_bound:!1};let m=!1;if(g.ctx=c?c(i,h,(t,e,...n)=>{const l=n.length?n[0]:e;return g.ctx&&s(g.ctx[t],g.ctx[t]=l)&&(!g.skip_bound&&g.bound[t]&&g.bound[t](l),m&&j(i,t)),e}):[],g.update(),m=!0,l(g.before_update),g.fragment=!!a&&a(g.ctx),r.target){if(r.hydrate){const t=function(t){return Array.from(t.childNodes)}(r.target);g.fragment&&g.fragment.l(t),t.forEach(u)}else g.fragment&&g.fragment.c();r.intro&&((v=i.$$.fragment)&&v.i&&(N.delete(v),v.i($))),function(t,n,i){const{fragment:r,on_mount:c,on_destroy:u,after_update:a}=t.$$;r&&r.m(n,i),L(()=>{const n=c.map(e).filter(o);u?u.push(...n):l(n),t.$$.on_mount=[]}),a.forEach(L)}(i,r.target,r.anchor),P()}var v,$;k(p)}function q(t,e,n){const l=t.slice();return l[57]=e[n],l[58]=e,l[59]=n,l}function B(t,e,n){const l=t.slice();return l[60]=e[n],l[61]=e,l[62]=n,l}function U(t,e,n){const l=t.slice();return l[63]=e[n],l}function F(t,e,n){const l=t.slice();return l[68]=e[n],l}function G(t,e,n){const l=t.slice();return l[60]=e[n],l[66]=e,l[67]=n,l}function I(t,e,n){const l=t.slice();return l[74]=e[n],l}function R(t,e,n){const l=t.slice();return l[71]=e[n],l}function V(t,e,n){const l=t.slice();return l[77]=e[n],l}function W(t,e,n){const l=t.slice();return l[0]=e[n],l}function J(t){let e,n,l,o=t[0].name+"";return{c(){e=s("option"),n=f(o),e.__value=l=t[0],e.value=e.__value},m(t,l){c(t,e,l),r(e,n)},p(t,i){2048&i[0]&&o!==(o=t[0].name+"")&&$(n,o),2048&i[0]&&l!==(l=t[0])&&(e.__value=l,e.value=e.__value)},d(t){t&&u(e)}}}function K(t){let e,n,l,o=t[77].name+"";return{c(){e=s("option"),n=f(o),e.__value=l=t[77],e.value=e.__value},m(t,l){c(t,e,l),r(e,n)},p(t,i){512&i[0]&&o!==(o=t[77].name+"")&&$(n,o),512&i[0]&&l!==(l=t[77])&&(e.__value=l,e.value=e.__value)},d(t){t&&u(e)}}}function Q(t){let e,n,l,o=t[74].name+"";return{c(){e=s("option"),n=f(o),e.__value=l=t[74],e.value=e.__value},m(t,l){c(t,e,l),r(e,n)},p(t,i){256&i[0]&&o!==(o=t[74].name+"")&&$(n,o),256&i[0]&&l!==(l=t[74])&&(e.__value=l,e.value=e.__value)},d(t){t&&u(e)}}}function X(t){let e,n,l=t[71][1],o=[];for(let e=0;e<l.length;e+=1)o[e]=Q(I(t,l,e));return{c(){e=s("optgroup");for(let t=0;t<o.length;t+=1)o[t].c();m(e,"label",n=t[71][0])},m(t,n){c(t,e,n);for(let t=0;t<o.length;t+=1)o[t].m(e,null)},p(t,i){if(256&i[0]){let n;for(l=t[71][1],n=0;n<l.length;n+=1){const r=I(t,l,n);o[n]?o[n].p(r,i):(o[n]=Q(r),o[n].c(),o[n].m(e,null))}for(;n<o.length;n+=1)o[n].d(1);o.length=l.length}256&i[0]&&n!==(n=t[71][0])&&m(e,"label",n)},d(t){t&&u(e),a(o,t)}}}function Y(t){let e,n,l,o,i,a,h=t[60].name+"";function g(){t[42].call(o,t[66],t[67])}return{c(){e=s("label"),n=f(h),l=d(),o=s("input"),m(o,"type","number")},m(u,s){c(u,e,s),r(e,n),c(u,l,s),c(u,o,s),_(o,t[60].value),i||(a=p(o,"input",g),i=!0)},p(e,l){t=e,128&l[0]&&h!==(h=t[60].name+"")&&$(n,h),384&l[0]&&v(o.value)!==t[60].value&&_(o,t[60].value)},d(t){t&&u(e),t&&u(l),t&&u(o),i=!1,a()}}}function Z(t){let e,n,l,o,i,h,g=t[60].name+"",m=t[60].options,v=[];for(let e=0;e<m.length;e+=1)v[e]=nt(F(t,m,e));function _(){t[41].call(o,t[66],t[67])}return{c(){e=s("label"),n=f(g),l=d(),o=s("select");for(let t=0;t<v.length;t+=1)v[t].c();void 0===t[60].value&&L(_)},m(u,a){c(u,e,a),r(e,n),c(u,l,a),c(u,o,a);for(let t=0;t<v.length;t+=1)v[t].m(o,null);y(o,t[60].value),i||(h=p(o,"change",_),i=!0)},p(e,l){if(t=e,128&l[0]&&g!==(g=t[60].name+"")&&$(n,g),128&l[0]){let e;for(m=t[60].options,e=0;e<m.length;e+=1){const n=F(t,m,e);v[e]?v[e].p(n,l):(v[e]=nt(n),v[e].c(),v[e].m(o,null))}for(;e<v.length;e+=1)v[e].d(1);v.length=m.length}384&l[0]&&y(o,t[60].value)},d(t){t&&u(e),t&&u(l),t&&u(o),a(v,t),i=!1,h()}}}function tt(t){let e,n,l,o,i,a,h=t[60].name+"";function g(){t[40].call(o,t[66],t[67])}return{c(){e=s("label"),n=f(h),l=d(),o=s("input"),m(o,"type","text")},m(u,s){c(u,e,s),r(e,n),c(u,l,s),c(u,o,s),_(o,t[60].value),i||(a=p(o,"input",g),i=!0)},p(e,l){t=e,128&l[0]&&h!==(h=t[60].name+"")&&$(n,h),384&l[0]&&o.value!==t[60].value&&_(o,t[60].value)},d(t){t&&u(e),t&&u(l),t&&u(o),i=!1,a()}}}function et(e){return{c:t,m:t,p:t,d:t}}function nt(t){let e,n,l,o=t[68]+"";return{c(){e=s("option"),n=f(o),e.__value=l=t[68],e.value=e.__value},m(t,l){c(t,e,l),r(e,n)},p(t,i){128&i[0]&&o!==(o=t[68]+"")&&$(n,o),384&i[0]&&l!==(l=t[68])&&(e.__value=l,e.value=e.__value)},d(t){t&&u(e)}}}function lt(t){let e;function n(t,e){return"boolean"===t[60].type?et:"string"===t[60].type?tt:"enum"===t[60].type?Z:Y}let l=n(t),o=l(t);return{c(){e=s("div"),o.c(),m(e,"class","form-group")},m(t,n){c(t,e,n),o.m(e,null)},p(t,i){l===(l=n(t))&&o?o.p(t,i):(o.d(1),o=l(t),o&&(o.c(),o.m(e,null)))},d(t){t&&u(e),o.d()}}}function ot(t){let e,n,l,o=t[63].name+"";return{c(){e=s("option"),n=f(o),e.__value=l=t[63],e.value=e.__value},m(t,l){c(t,e,l),r(e,n)},p(t,i){64&i[0]&&o!==(o=t[63].name+"")&&$(n,o),64&i[0]&&l!==(l=t[63])&&(e.__value=l,e.value=e.__value)},d(t){t&&u(e)}}}function it(t){let e,n,l,o,i,a,h=t[60].name+"";function g(){t[45].call(o,t[61],t[62])}return{c(){e=s("label"),n=f(h),l=d(),o=s("input"),m(o,"type","number")},m(u,s){c(u,e,s),r(e,n),c(u,l,s),c(u,o,s),_(o,t[60].value),i||(a=p(o,"input",g),i=!0)},p(e,l){t=e,32&l[0]&&h!==(h=t[60].name+"")&&$(n,h),96&l[0]&&v(o.value)!==t[60].value&&_(o,t[60].value)},d(t){t&&u(e),t&&u(l),t&&u(o),i=!1,a()}}}function rt(t){let e,n,l,o,i,a,h=t[60].name+"";function g(){t[44].call(o,t[61],t[62])}return{c(){e=s("label"),n=f(h),l=d(),o=s("input"),m(o,"type","text")},m(u,s){c(u,e,s),r(e,n),c(u,l,s),c(u,o,s),_(o,t[60].value),i||(a=p(o,"input",g),i=!0)},p(e,l){t=e,32&l[0]&&h!==(h=t[60].name+"")&&$(n,h),96&l[0]&&o.value!==t[60].value&&_(o,t[60].value)},d(t){t&&u(e),t&&u(l),t&&u(o),i=!1,a()}}}function ct(e){return{c:t,m:t,p:t,d:t}}function ut(t){let e,n;function l(t,e){return"boolean"===t[60].type?ct:"string"===t[60].type?rt:it}let o=l(t),i=o(t);return{c(){e=s("div"),i.c(),n=d(),m(e,"class","form-group")},m(t,l){c(t,e,l),i.m(e,null),r(e,n)},p(t,r){o===(o=l(t))&&i?i.p(t,r):(i.d(1),i=o(t),i&&(i.c(),i.m(e,n)))},d(t){t&&u(e),i.d()}}}function at(e){let n;return{c(){n=s("a"),n.textContent="No Trained Models",m(n,"class","list-group-item"),b(n,"font-style","italic"),b(n,"color","#888")},m(t,e){c(t,n,e)},p:t,d(t){t&&u(n)}}}function st(t){let e,n=t[13],l=[];for(let e=0;e<n.length;e+=1)l[e]=pt(q(t,n,e));return{c(){for(let t=0;t<l.length;t+=1)l[t].c();e=f("")},m(t,n){for(let e=0;e<l.length;e+=1)l[e].m(t,n);c(t,e,n)},p(t,o){if(6840320&o[0]){let i;for(n=t[13],i=0;i<n.length;i+=1){const r=q(t,n,i);l[i]?l[i].p(r,o):(l[i]=pt(r),l[i].c(),l[i].m(e.parentNode,e))}for(;i<l.length;i+=1)l[i].d(1);l.length=n.length}},d(t){a(l,t),t&&u(e)}}}function ft(t){let e,n,l;function o(...e){return t[49](t[57],...e)}return{c(){e=s("span"),m(e,"class","glyphicon glyphicon-floppy-disk pull-right"),m(e,"aria-hidden","true")},m(t,i){c(t,e,i),n||(l=p(e,"click",g(h(o))),n=!0)},p(e,n){t=e},d(t){t&&u(e),n=!1,l()}}}function dt(t){let e,n,l,o,i=t[57].state[0].toUpperCase()+t[57].state.substring(1)+"";function a(...e){return t[48](t[57],...e)}return{c(){e=s("span"),n=f(i),m(e,"class","pull-right"),b(e,"color","#888"),b(e,"font-style","italic")},m(t,i){c(t,e,i),r(e,n),l||(o=p(e,"click",g(h(a))),l=!0)},p(e,l){t=e,8192&l[0]&&i!==(i=t[57].state[0].toUpperCase()+t[57].state.substring(1)+"")&&$(n,i)},d(t){t&&u(e),l=!1,o()}}}function pt(t){let e,n,o,i,a,f,v;function $(){t[47].call(n,t[58],t[59])}function _(t,e){return t[57].state?dt:ft}let y=_(t),x=y(t);function C(...e){return t[50](t[57],...e)}return{c(){e=s("a"),n=s("span"),o=d(),x.c(),i=d(),m(n,"contenteditable","true"),b(n,"cursor","text"),void 0===t[57].name&&L($),m(e,"class",a="list-group-item "+(t[14]===t[57]?"active":""))},m(l,u){c(l,e,u),r(e,n),void 0!==t[57].name&&(n.innerHTML=t[57].name),r(e,o),x.m(e,null),r(e,i),f||(v=[p(n,"input",$),p(e,"click",g(h(C)))],f=!0)},p(l,o){t=l,8192&o[0]&&t[57].name!==n.innerHTML&&(n.innerHTML=t[57].name),y===(y=_(t))&&x?x.p(t,o):(x.d(1),x=y(t),x&&(x.c(),x.m(e,i))),24576&o[0]&&a!==(a="list-group-item "+(t[14]===t[57]?"active":""))&&m(e,"class",a)},d(t){t&&u(e),x.d(),f=!1,l(v)}}}function ht(e){let n,o,i,x,C,k,w,A,E,T,z,M,S,D,P,O,N,j,H,q,F,I,Q,Y,Z,tt,et,nt,it,rt,ct,ft,dt,pt,ht,gt,mt,vt,$t,_t,bt,yt,xt,Ct,kt,wt,At,Et,Tt,zt,Mt,Lt,St,Dt,Pt,Ot,Nt,jt,Ht,qt,Bt,Ut,Ft,Gt,It,Rt,Vt,Wt,Jt,Kt,Qt,Xt,Yt=e[11],Zt=[];for(let t=0;t<Yt.length;t+=1)Zt[t]=J(W(e,Yt,t));let te=e[9],ee=[];for(let t=0;t<te.length;t+=1)ee[t]=K(V(e,te,t));let ne=e[8],le=[];for(let t=0;t<ne.length;t+=1)le[t]=X(R(e,ne,t));let oe=e[7].arguments,ie=[];for(let t=0;t<oe.length;t+=1)ie[t]=lt(G(e,oe,t));let re=e[6],ce=[];for(let t=0;t<re.length;t+=1)ce[t]=ot(U(e,re,t));let ue=e[5].arguments,ae=[];for(let t=0;t<ue.length;t+=1)ae[t]=ut(B(e,ue,t));function se(t,e){return t[13].length>0?st:at}let fe=se(e),de=fe(e);return{c(){n=s("main"),o=s("div"),i=s("div"),x=s("h3"),x.textContent="Training Parameters",C=d(),k=s("div"),w=s("form"),A=s("h5"),A.textContent="General",E=d(),T=s("div"),z=s("label"),z.textContent="Training Data:",M=d(),S=s("select");for(let t=0;t<Zt.length;t+=1)Zt[t].c();D=d(),P=s("div"),O=s("label"),O.textContent="Architecture:",N=d(),j=s("select");for(let t=0;t<ee.length;t+=1)ee[t].c();H=d(),q=s("div"),F=s("label"),F.textContent="Batch Size",I=d(),Q=s("input"),Y=d(),Z=s("div"),tt=s("label"),tt.textContent="Epochs",et=d(),nt=s("input"),it=d(),rt=s("div"),ct=s("label"),ct.textContent="Validation Split",ft=d(),dt=s("input"),pt=d(),ht=s("hr"),gt=d(),mt=s("h5"),mt.textContent="Loss",vt=d(),$t=s("div"),_t=s("label"),_t.textContent="Loss Function:",bt=d(),yt=s("select");for(let t=0;t<le.length;t+=1)le[t].c();xt=d(),Ct=s("span"),kt=d();for(let t=0;t<ie.length;t+=1)ie[t].c();wt=d(),At=s("hr"),Et=d(),Tt=s("h5"),Tt.textContent="Optimization",zt=d(),Mt=s("div"),Lt=s("label"),Lt.textContent="Optimizer:",St=d(),Dt=s("select");for(let t=0;t<ce.length;t+=1)ce[t].c();Pt=d(),Ot=s("span"),Nt=d();for(let t=0;t<ae.length;t+=1)ae[t].c();jt=d(),Ht=s("button"),qt=f(e[1]),Ut=d(),Ft=s("div"),Gt=d(),It=s("div"),Rt=s("h4"),Rt.textContent="Trained Models",Vt=d(),Wt=s("div"),de.c(),Jt=d(),Kt=s("div"),b(A,"text-align","left"),m(z,"for","dataset"),m(S,"id","dataset"),void 0===e[12]&&L(()=>e[34].call(S)),m(T,"class","form-group"),m(O,"for","arch"),m(j,"id","arch"),void 0===e[10]&&L(()=>e[35].call(j)),m(P,"class","form-group"),m(Q,"type","number"),m(q,"class","form-group"),m(nt,"type","number"),m(Z,"class","form-group"),m(dt,"type","number"),m(rt,"class","form-group"),b(ht,"border-top","1px solid #aaa"),b(mt,"text-align","left"),m(_t,"for","loss"),m(yt,"id","loss"),void 0===e[7]&&L(()=>e[39].call(yt)),m(Ct,"class","glyphicon glyphicon-info-sign"),m(Ct,"aria-hidden","true"),m($t,"class","form-group"),b(At,"border-top","1px solid #aaa"),b(Tt,"text-align","left"),m(Lt,"for","optimizer"),m(Dt,"id","optimizer"),void 0===e[5]&&L(()=>e[43].call(Dt)),m(Ot,"class","glyphicon glyphicon-info-sign"),m(Ot,"aria-hidden","true"),m(Mt,"class","form-group"),m(Ht,"type","button"),m(Ht,"class",Bt="btn btn-"+("Train"===e[1]?"primary":"warning")),m(k,"class","well"),b(k,"padding-top","5px"),m(i,"class","col-xs-12 col-sm-12 col-md-4 col-lg-3"),m(Ft,"class","col-xs-12 col-sm-12 col-md-6 col-lg-6 plot-container"),m(Wt,"class","list-group"),m(It,"class","col-xs-12 col-sm-12 col-md-2 col-lg-2"),m(o,"class","row svelte-193h8ui"),m(n,"class","svelte-193h8ui")},m(t,l){c(t,n,l),r(n,o),r(o,i),r(i,x),r(i,C),r(i,k),r(k,w),r(w,A),r(w,E),r(w,T),r(T,z),r(T,M),r(T,S);for(let t=0;t<Zt.length;t+=1)Zt[t].m(S,null);y(S,e[12]),r(w,D),r(w,P),r(P,O),r(P,N),r(P,j);for(let t=0;t<ee.length;t+=1)ee[t].m(j,null);y(j,e[10]),r(w,H),r(w,q),r(q,F),r(q,I),r(q,Q),_(Q,e[2]),r(w,Y),r(w,Z),r(Z,tt),r(Z,et),r(Z,nt),_(nt,e[3]),r(w,it),r(w,rt),r(rt,ct),r(rt,ft),r(rt,dt),_(dt,e[4]),r(w,pt),r(w,ht),r(w,gt),r(w,mt),r(w,vt),r(w,$t),r($t,_t),r($t,bt),r($t,yt);for(let t=0;t<le.length;t+=1)le[t].m(yt,null);y(yt,e[7]),r($t,xt),r($t,Ct),r(w,kt);for(let t=0;t<ie.length;t+=1)ie[t].m(w,null);r(w,wt),r(w,At),r(w,Et),r(w,Tt),r(w,zt),r(w,Mt),r(Mt,Lt),r(Mt,St),r(Mt,Dt);for(let t=0;t<ce.length;t+=1)ce[t].m(Dt,null);y(Dt,e[5]),r(Mt,Pt),r(Mt,Ot),r(w,Nt);for(let t=0;t<ae.length;t+=1)ae[t].m(w,null);r(k,jt),r(k,Ht),r(Ht,qt),r(o,Ut),r(o,Ft),e[46](Ft),r(o,Gt),r(o,It),r(It,Rt),r(It,Vt),r(It,Wt),de.m(Wt,null),r(Wt,Jt),r(Wt,Kt),e[51](n),Qt||(Xt=[p(S,"change",e[34]),p(j,"change",e[35]),p(Q,"input",e[36]),p(nt,"input",e[37]),p(dt,"input",e[38]),p(yt,"change",e[39]),p(Ct,"click",g(h(e[18]))),p(Dt,"change",e[43]),p(Ot,"click",g(h(e[20]))),p(Ht,"click",g(h(e[17])))],Qt=!0)},p(t,e){if(2048&e[0]){let n;for(Yt=t[11],n=0;n<Yt.length;n+=1){const l=W(t,Yt,n);Zt[n]?Zt[n].p(l,e):(Zt[n]=J(l),Zt[n].c(),Zt[n].m(S,null))}for(;n<Zt.length;n+=1)Zt[n].d(1);Zt.length=Yt.length}if(6144&e[0]&&y(S,t[12]),512&e[0]){let n;for(te=t[9],n=0;n<te.length;n+=1){const l=V(t,te,n);ee[n]?ee[n].p(l,e):(ee[n]=K(l),ee[n].c(),ee[n].m(j,null))}for(;n<ee.length;n+=1)ee[n].d(1);ee.length=te.length}if(1536&e[0]&&y(j,t[10]),4&e[0]&&v(Q.value)!==t[2]&&_(Q,t[2]),8&e[0]&&v(nt.value)!==t[3]&&_(nt,t[3]),16&e[0]&&v(dt.value)!==t[4]&&_(dt,t[4]),256&e[0]){let n;for(ne=t[8],n=0;n<ne.length;n+=1){const l=R(t,ne,n);le[n]?le[n].p(l,e):(le[n]=X(l),le[n].c(),le[n].m(yt,null))}for(;n<le.length;n+=1)le[n].d(1);le.length=ne.length}if(384&e[0]&&y(yt,t[7]),128&e[0]){let n;for(oe=t[7].arguments,n=0;n<oe.length;n+=1){const l=G(t,oe,n);ie[n]?ie[n].p(l,e):(ie[n]=lt(l),ie[n].c(),ie[n].m(w,wt))}for(;n<ie.length;n+=1)ie[n].d(1);ie.length=oe.length}if(64&e[0]){let n;for(re=t[6],n=0;n<re.length;n+=1){const l=U(t,re,n);ce[n]?ce[n].p(l,e):(ce[n]=ot(l),ce[n].c(),ce[n].m(Dt,null))}for(;n<ce.length;n+=1)ce[n].d(1);ce.length=re.length}if(96&e[0]&&y(Dt,t[5]),32&e[0]){let n;for(ue=t[5].arguments,n=0;n<ue.length;n+=1){const l=B(t,ue,n);ae[n]?ae[n].p(l,e):(ae[n]=ut(l),ae[n].c(),ae[n].m(w,null))}for(;n<ae.length;n+=1)ae[n].d(1);ae.length=ue.length}2&e[0]&&$(qt,t[1]),2&e[0]&&Bt!==(Bt="btn btn-"+("Train"===t[1]?"primary":"warning"))&&m(Ht,"class",Bt),fe===(fe=se(t))&&de?de.p(t,e):(de.d(1),de=fe(t),de&&(de.c(),de.m(Wt,Jt)))},i:t,o:t,d(t){t&&u(n),a(Zt,t),a(ee,t),a(le,t),a(ie,t),a(ce,t),a(ae,t),e[46](null),de.d(),e[51](null),Qt=!1,l(Xt)}}}function gt(t,e,n){const l={name:"",arguments:[]};let o,i,r,c,u,a="Train",s=null,f=32,d=50,p=.1,h=l,g=[],m=l,$=[],_=[],b=[],y=[];function C(t){const e=new CustomEvent("showModelInfo",{detail:t});u.dispatchEvent(e)}function k(t){const e=new CustomEvent("saveModel",{detail:t});u.dispatchEvent(e)}function w(t){n(14,r=t),r.config&&(n(10,o=r.config.architecture),n(12,i=r.config.dataset),n(2,f=r.config.batchSize),n(4,p=r.config.validation),n(5,h=r.config.optimizer),n(3,d=r.config.epochs),n(7,m=r.config.loss)),s&&s.react(c,r.plotData)}let E;return t.$$.update=()=>{16384&t.$$.dirty[0]&&(E=r&&r.plotData)},[function(){return{architecture:o,dataset:i,batchSize:f,validation:p,optimizer:h,epochs:d,loss:m}},a,f,d,p,h,g,m,$,_,o,b,i,y,r,c,u,function(){const t=new CustomEvent("onTrainClicked");u.dispatchEvent(t)},function(){const t=`https://keras.io/api/losses/${m.category.toLowerCase().replace(/ /g,"_")}/#${m.name.toLowerCase()+"-class"}/`;window.open(t,"_blank")},C,function(){const t=`https://keras.io/api/optimizers/${h.name.toLowerCase()}/`;window.open(t,"_blank")},k,w,function(t,e,l){!function(t){t.losses.concat(t.optimizers).forEach(e=>{e.arguments=e.arguments.filter(t=>"name"!==t.name).map(e=>(e.name.includes("reduction")?(e.type="enum",e.options=t.reductions):e.type=typeof e.default,e.value=e.default,e))})}(l),n(6,g=l.optimizers),n(5,h=g[0]);const o={};l.losses.forEach(t=>{o[t.category]||(o[t.category]=[]),o[t.category].push(t)}),n(8,$=Object.entries(o)),n(7,m=l.losses[0]),s=t,s.newPlot(c)},function(t){n(13,y=y.concat(t)),r||n(14,r=t)},function(){return u},function(t,e,l){const o=y.find(e=>e.id===t);o.state=e,o.info=l,n(13,y),!e?n(1,a="Train"):e.startsWith("Training")&&n(1,a="Restart")},function(t,e){const n=y.find(e=>e.id===t);n.plotData=e,n===r&&w(n)},function(t){n(11,b=b.concat(t)),i||n(12,i=b[0])},function(t){n(11,b=b.map(e=>e.id===t.id?t:e))},function(t){n(11,b=b.filter(e=>e.id!==t)),i&&i.id===t&&n(12,i=b[0])},function(t){n(9,_=_.concat(t)),o||n(10,o=_[0])},function(t){n(9,_=_.map(e=>e.id===t.id?t:e))},function(t){n(9,_=_.filter(e=>e.id!==t)),o&&o.id===t&&n(10,o=_[0])},function(){i=x(this),n(12,i),n(11,b)},function(){o=x(this),n(10,o),n(9,_)},function(){f=v(this.value),n(2,f)},function(){d=v(this.value),n(3,d)},function(){p=v(this.value),n(4,p)},function(){m=x(this),n(7,m),n(8,$)},function(t,e){t[e].value=this.value,n(7,m),n(8,$)},function(t,e){t[e].value=x(this),n(7,m),n(8,$)},function(t,e){t[e].value=v(this.value),n(7,m),n(8,$)},function(){h=x(this),n(5,h),n(6,g)},function(t,e){t[e].value=this.value,n(5,h),n(6,g)},function(t,e){t[e].value=v(this.value),n(5,h),n(6,g)},function(t){A[t?"unshift":"push"](()=>{c=t,n(15,c)})},function(t,e){t[e].name=this.innerHTML,n(13,y)},t=>C(t),t=>k(t),t=>w(t),function(t){A[t?"unshift":"push"](()=>{u=t,n(16,u)})}]}return class extends class{$destroy(){!function(t,e){const n=t.$$;null!==n.fragment&&(l(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}(this,1),this.$destroy=t}$on(t,e){const n=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return n.push(e),()=>{const t=n.indexOf(e);-1!==t&&n.splice(t,1)}}$set(t){var e;this.$$set&&(e=t,0!==Object.keys(e).length)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1)}}{constructor(t){super(),H(this,t,gt,ht,i,{initialize:23,addModel:24,events:25,setModelState:26,setPlotData:27,addArtifact:28,updateArtifact:29,removeArtifact:30,addArchitecture:31,updateArchitecture:32,removeArchitecture:33,data:0},[-1,-1,-1])}get initialize(){return this.$$.ctx[23]}get addModel(){return this.$$.ctx[24]}get events(){return this.$$.ctx[25]}get setModelState(){return this.$$.ctx[26]}get setPlotData(){return this.$$.ctx[27]}get addArtifact(){return this.$$.ctx[28]}get updateArtifact(){return this.$$.ctx[29]}get removeArtifact(){return this.$$.ctx[30]}get addArchitecture(){return this.$$.ctx[31]}get updateArchitecture(){return this.$$.ctx[32]}get removeArchitecture(){return this.$$.ctx[33]}get data(){return this.$$.ctx[0]}}}));
//# sourceMappingURL=TrainDashboard.js.map