/* =====================================================
   TAECKER UI KIT
   브라우저(특히 사파리) 기본 UI 대신 쓰는 태커 전용 컴포넌트
   - select  → 커스텀 드롭다운 (자동 적용)
   - input[type=date] → 커스텀 날짜 선택 (자동 적용)
   - confirm / prompt  → window.uiConfirm / window.uiPrompt (Promise)
===================================================== */

"use strict";

(function(){

const NS="http://www.w3.org/2000/svg";
const CARET='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CAL_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function h(tag,cls,html){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(html!=null) e.innerHTML=html;
    return e;
}
const esc=(s)=>String(s??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* value 를 코드에서 바꿔도 화면이 따라오도록 인스턴스 프로퍼티를 가로챈다 */
function watchValue(el,proto,onChange){
    const d=Object.getOwnPropertyDescriptor(proto,"value");
    Object.defineProperty(el,"value",{
        configurable:true,
        get(){ return d.get.call(this); },
        set(v){ d.set.call(this,v); onChange(); }
    });
}

/* 열려 있는 팝업(드롭다운/달력)은 하나만 */
let openPop=null;
function closePop(){
    if(!openPop) return;
    openPop.close();
    openPop=null;
}
document.addEventListener("click",(e)=>{
    if(openPop && !openPop.root.contains(e.target)) closePop();
});
document.addEventListener("keydown",(e)=>{
    if(e.key==="Escape") closePop();
});
window.addEventListener("resize",closePop);

/* 팝업이 화면 아래로 잘리면 위로 띄운다 */
function placePop(root,pop){
    pop.classList.remove("up");
    const r=pop.getBoundingClientRect();
    const room=window.innerHeight-root.getBoundingClientRect().bottom;
    if(r.height>room-12 && root.getBoundingClientRect().top>r.height) pop.classList.add("up");
}

/* =====================================================
   CONFIRM / PROMPT
===================================================== */

function dialog(build){
    return new Promise((resolve)=>{
        const modal=h("div","modal ui-dialog active");
        const box=h("div","modal-content ui-dialog-box");
        modal.appendChild(box);
        const prevFocus=document.activeElement;
        const done=(v)=>{
            document.removeEventListener("keydown",onKey,true);
            modal.remove();
            try{ prevFocus?.focus?.(); }catch(e){}
            resolve(v);
        };
        const onKey=(e)=>{
            if(e.key==="Escape"){ e.stopPropagation(); done(build.cancelValue); }
        };
        document.addEventListener("keydown",onKey,true);
        modal.addEventListener("mousedown",(e)=>{ if(e.target===modal) done(build.cancelValue); });
        build.fill(box,done);
        document.body.appendChild(modal);
        build.focus?.(box);
    });
}

window.uiConfirm=function(message,opts={}){
    const {ok="확인",cancel="취소",danger=false,title=""}=opts;
    return dialog({
        cancelValue:false,
        fill(box,done){
            if(title) box.appendChild(h("h3","ui-dialog-title",esc(title)));
            box.appendChild(h("p","ui-dialog-msg",esc(message).replace(/\n/g,"<br>")));
            const row=h("div","ui-dialog-actions");
            const c=h("button","btn btn-outline",esc(cancel)); c.type="button";
            const o=h("button","btn ui-dialog-ok"+(danger?" danger":""),esc(ok)); o.type="button";
            c.onclick=()=>done(false); o.onclick=()=>done(true);
            row.append(c,o); box.appendChild(row);
        },
        focus(box){ box.querySelector(".ui-dialog-ok")?.focus(); }
    });
};

window.uiPrompt=function(message,opts={}){
    const {ok="확인",cancel="취소",password=false,placeholder="",title="",maxLength=60}=opts;
    return dialog({
        cancelValue:null,
        fill(box,done){
            if(title) box.appendChild(h("h3","ui-dialog-title",esc(title)));
            box.appendChild(h("p","ui-dialog-msg",esc(message).replace(/\n/g,"<br>")));
            const inp=h("input","input ui-dialog-input");
            inp.type=password?"password":"text"; inp.placeholder=placeholder; inp.maxLength=maxLength;
            inp.autocomplete="off";
            inp.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); done(inp.value); } });
            box.appendChild(inp);
            const row=h("div","ui-dialog-actions");
            const c=h("button","btn btn-outline",esc(cancel)); c.type="button";
            const o=h("button","btn ui-dialog-ok",esc(ok)); o.type="button";
            c.onclick=()=>done(null); o.onclick=()=>done(inp.value);
            row.append(c,o); box.appendChild(row);
        },
        focus(box){ box.querySelector(".ui-dialog-input")?.focus(); }
    });
};

/* =====================================================
   SELECT
===================================================== */

function enhanceSelect(sel){

    if(sel.dataset.uiSelect||sel.multiple) return;
    sel.dataset.uiSelect="1";

    const root=h("div","ui-select");
    const btn=h("button","ui-select-btn");
    btn.type="button";
    btn.setAttribute("aria-haspopup","listbox");
    btn.setAttribute("aria-expanded","false");
    const label=h("span","ui-select-label");
    btn.append(label,h("span","ui-select-caret",CARET));
    const pop=h("div","ui-pop ui-select-list");
    pop.setAttribute("role","listbox");
    pop.hidden=true;

    sel.parentNode.insertBefore(root,sel);
    root.append(btn,pop,sel);
    sel.classList.add("ui-select-native");
    sel.tabIndex=-1;
    sel.setAttribute("aria-hidden","true");

    let active=-1;

    function options(){ return [...sel.options]; }

    function renderLabel(){
        const o=sel.options[sel.selectedIndex];
        label.textContent=o?o.textContent:"";
        label.classList.toggle("placeholder",!o||o.value==="");
        btn.disabled=sel.disabled;
        root.classList.toggle("disabled",sel.disabled);
        pop.querySelectorAll(".ui-opt").forEach((n,i)=>{
            n.classList.toggle("selected",i===sel.selectedIndex);
            n.setAttribute("aria-selected",i===sel.selectedIndex?"true":"false");
        });
    }

    function build(){
        pop.innerHTML="";
        options().forEach((o,i)=>{
            const b=h("button","ui-opt");
            b.type="button";
            b.setAttribute("role","option");
            b.textContent=o.textContent;
            b.disabled=o.disabled;
            b.addEventListener("click",()=>{ choose(i); });
            pop.appendChild(b);
        });
        renderLabel();
    }

    function choose(i){
        const changed=sel.selectedIndex!==i;
        sel.selectedIndex=i;
        renderLabel();
        close();
        if(changed){
            sel.dispatchEvent(new Event("input",{bubbles:true}));
            sel.dispatchEvent(new Event("change",{bubbles:true}));
        }
        btn.focus();
    }

    function setActive(i){
        const items=[...pop.children];
        if(!items.length) return;
        active=Math.max(0,Math.min(items.length-1,i));
        items.forEach((n,k)=>n.classList.toggle("active",k===active));
        items[active].scrollIntoView({block:"nearest"});
    }

    function open(){
        if(sel.disabled||openPop?.root===root) return;
        closePop();
        pop.hidden=false;
        btn.setAttribute("aria-expanded","true");
        root.classList.add("open");
        placePop(root,pop);
        openPop={root,close};
        setActive(sel.selectedIndex);
    }
    function close(){
        pop.hidden=true;
        btn.setAttribute("aria-expanded","false");
        root.classList.remove("open");
        if(openPop?.root===root) openPop=null;
    }

    btn.addEventListener("click",()=>{ root.classList.contains("open")?close():open(); });
    btn.addEventListener("keydown",(e)=>{
        const isOpen=root.classList.contains("open");
        if(e.key==="ArrowDown"||e.key==="ArrowUp"){
            e.preventDefault();
            if(!isOpen) open(); else setActive(active+(e.key==="ArrowDown"?1:-1));
        }else if((e.key==="Enter"||e.key===" ")&&isOpen){
            e.preventDefault(); choose(active);
        }
    });

    watchValue(sel,HTMLSelectElement.prototype,renderLabel);
    const selIdx=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"selectedIndex");
    Object.defineProperty(sel,"selectedIndex",{configurable:true,get(){return selIdx.get.call(this);},set(v){selIdx.set.call(this,v);renderLabel();}});

    new MutationObserver(build).observe(sel,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["disabled"]});
    sel.addEventListener("change",renderLabel);

    /* <label for=id> 를 눌렀을 때 */
    if(sel.id) document.querySelectorAll(`label[for="${sel.id}"]`).forEach((l)=>l.addEventListener("click",(e)=>{ e.preventDefault(); btn.focus(); }));

    if(sel.id) btn.id=sel.id+"-ui";
    build();
}

/* =====================================================
   DATE PICKER
===================================================== */

const pad=(n)=>String(n).padStart(2,"0");
const DOW="일월화수목금토";

function parseYmd(s){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");
    return m?{y:+m[1],m:+m[2]-1,d:+m[3]}:null;
}
function fmt(s){
    const p=parseYmd(s);
    if(!p) return "";
    return `${p.y}년 ${p.m+1}월 ${p.d}일 (${DOW[new Date(p.y,p.m,p.d).getDay()]})`;
}

function enhanceDate(inp){

    if(inp.dataset.uiDate) return;
    inp.dataset.uiDate="1";

    const root=h("div","ui-date");
    const btn=h("button","ui-select-btn ui-date-btn");
    btn.type="button";
    btn.setAttribute("aria-haspopup","dialog");
    const label=h("span","ui-select-label");
    btn.append(label,h("span","ui-select-caret",CAL_ICON));
    const pop=h("div","ui-pop ui-date-pop");
    pop.hidden=true;

    inp.parentNode.insertBefore(root,inp);
    root.append(btn,pop,inp);
    inp.type="text";
    inp.classList.add("ui-select-native");
    inp.tabIndex=-1;
    inp.setAttribute("aria-hidden","true");
    inp.readOnly=true;

    const now=new Date();
    const TODAY=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    let vy=now.getFullYear(), vm=now.getMonth();

    function renderLabel(){
        const t=fmt(inp.value);
        label.textContent=t||"날짜 선택";
        label.classList.toggle("placeholder",!t);
    }

    function draw(){
        const sel=inp.value;
        const first=new Date(vy,vm,1).getDay();
        const days=new Date(vy,vm+1,0).getDate();
        let cells="";
        for(let i=0;i<first;i++) cells+='<span class="ui-day empty"></span>';
        for(let d=1;d<=days;d++){
            const key=`${vy}-${pad(vm+1)}-${pad(d)}`;
            const dow=(first+d-1)%7;
            const c=["ui-day"];
            if(key===TODAY) c.push("today");
            if(key===sel) c.push("selected");
            if(dow===0) c.push("sun");
            if(dow===6) c.push("sat");
            cells+=`<button type="button" class="${c.join(" ")}" data-d="${key}">${d}</button>`;
        }
        pop.innerHTML=`
            <div class="ui-date-head">
                <button type="button" class="ui-nav" data-nav="-1" aria-label="이전 달"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <strong>${vy}년 ${vm+1}월</strong>
                <button type="button" class="ui-nav" data-nav="1" aria-label="다음 달"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </div>
            <div class="ui-date-week">${[...DOW].map((w,i)=>`<span class="${i===0?"sun":i===6?"sat":""}">${w}</span>`).join("")}</div>
            <div class="ui-date-grid">${cells}</div>
            <div class="ui-date-foot"><button type="button" class="ui-link" data-today="1">오늘</button></div>`;
    }

    function pick(key){
        inp.value=key;
        inp.dispatchEvent(new Event("input",{bubbles:true}));
        inp.dispatchEvent(new Event("change",{bubbles:true}));
        close();
    }

    function open(){
        if(openPop?.root===root) return;
        closePop();
        const p=parseYmd(inp.value)||{y:now.getFullYear(),m:now.getMonth()};
        vy=p.y; vm=p.m;
        draw();
        pop.hidden=false;
        root.classList.add("open");
        placePop(root,pop);
        openPop={root,close};
    }
    function close(){
        pop.hidden=true;
        root.classList.remove("open");
        if(openPop?.root===root) openPop=null;
    }

    btn.addEventListener("click",()=>{ root.classList.contains("open")?close():open(); });
    pop.addEventListener("click",(e)=>{
        const nav=e.target.closest("[data-nav]");
        if(nav){
            vm+=Number(nav.dataset.nav);
            if(vm<0){ vm=11; vy--; } if(vm>11){ vm=0; vy++; }
            draw(); return;
        }
        const d=e.target.closest("[data-d]");
        if(d){ pick(d.dataset.d); return; }
        if(e.target.closest("[data-today]")) pick(TODAY);
    });

    watchValue(inp,HTMLInputElement.prototype,renderLabel);
    if(inp.id) btn.id=inp.id+"-ui";
    renderLabel();
}

/* =====================================================
   고닉 로그인 (닉네임+비밀번호로 로그인하면 닉네임 고정, 글/댓글에 비밀번호 불필요)
===================================================== */

const FX_KEY="taeker_fixed";
const Fixed={
    get(){ try{ const o=JSON.parse(localStorage.getItem(FX_KEY)||"null"); return o&&o.token&&o.nickname?o:null; }catch(e){ return null; } },
    set(o){ try{ localStorage.setItem(FX_KEY,JSON.stringify(o)); }catch(e){} sync(); },
    clear(){ try{ localStorage.removeItem(FX_KEY); }catch(e){} sync(); }
};
window.TaeckerFixed=Fixed;

function sync(){
    const fx=Fixed.get();
    document.querySelectorAll("[data-fixed-login-btn]").forEach(b=>{
        b.textContent=fx?fx.nickname:"로그인";
        b.classList.toggle("is-in",!!fx);
    });
    for(const id of ["writeNickname","commentNickname"]){
        const inp=document.getElementById(id); if(!inp) continue;
        const box=inp.closest(".input-box"); if(!box) continue;
        const group=box.parentElement;
        let bar=group.querySelector(":scope > .fixed-bar");
        box.style.display=fx?"none":"";
        group.querySelectorAll(":scope > .input-message").forEach(m=>m.style.display=fx?"none":"");
        if(fx){
            if(!bar){ bar=document.createElement("div"); bar.className="fixed-bar"; box.before(bar); }
            bar.innerHTML=`<span class="fixed-badge-sm" style="margin:0">고닉</span> <b></b> 로그인 중 <button type="button" class="fixed-nick-link" data-fixed-logout>로그아웃</button>`;
            bar.querySelector("b").textContent=fx.nickname;
        }else if(bar) bar.remove();
        group.querySelectorAll("[data-fixed-nick]").forEach(l=>l.style.display=fx?"none":"");
    }
}
async function verify(){
    const fx=Fixed.get(); if(!fx||!window.sb) return;
    try{
        const {data,error}=await window.sb.rpc("fixed_session_ok",{p_token:fx.token});
        if(!error && !data){ Fixed.clear(); if(typeof toast==="function") toast("고닉 로그인이 만료됐어요. 다시 로그인해주세요."); }
    }catch(e){}
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>{ sync(); verify(); });
else { sync(); verify(); }

function openFixedNickModal(){

    const say=(m)=>{ if(typeof toast==="function") toast(m); };
    let mode="login";

    dialog({
        cancelValue:null,
        fill(box,done){
            const title=h("h3","ui-dialog-title","고닉 로그인");
            const msg=h("p","ui-dialog-msg","로그인하면 닉네임이 고정되고, 글·댓글에 <b>고닉</b> 표시가 붙어요. 비밀번호는 안 써도 돼요.");
            const nick=h("input","input ui-dialog-input"); nick.type="text"; nick.maxLength=12; nick.placeholder="닉네임"; nick.autocomplete="off";
            const pw=h("input","input ui-dialog-input"); pw.type="password"; pw.maxLength=30; pw.placeholder="비밀번호"; pw.autocomplete="current-password";
            pw.style.marginTop="-14px";
            const sub=h("p","ui-dialog-sub","");
            const swap=h("button","fixed-nick-link",""); swap.type="button";
            const row=h("div","ui-dialog-actions");
            const c=h("button","btn btn-outline","취소"); c.type="button"; c.onclick=()=>done(null);
            const o=h("button","btn ui-dialog-ok","로그인"); o.type="button";
            const render=()=>{
                const reg=mode==="register";
                title.textContent=reg?"고닉 만들기":"고닉 로그인";
                msg.innerHTML=reg?"닉네임을 나만 쓸 수 있게 등록해요. 등록하면 바로 로그인돼요."
                                 :"로그인하면 닉네임이 고정되고, 글·댓글에 <b>고닉</b> 표시가 붙어요. 비밀번호는 안 써도 돼요.";
                pw.placeholder=reg?"비밀번호 (4자 이상)":"비밀번호";
                pw.autocomplete=reg?"new-password":"current-password";
                sub.textContent=reg?"비밀번호를 잊어버리면 그 닉네임을 다시 쓸 수 없어요.":"";
                sub.style.display=reg?"":"none";
                swap.textContent=reg?"이미 고닉이 있어요 (로그인)":"고닉 만들기";
                o.textContent=reg?"등록":"로그인";
            };
            swap.onclick=()=>{ mode=mode==="login"?"register":"login"; render(); nick.focus(); };
            const submit=async()=>{
                const n=nick.value.trim(), w=pw.value;
                if(!n){ say("닉네임을 입력해주세요."); nick.focus(); return; }
                if(!w){ say("비밀번호를 입력해주세요."); pw.focus(); return; }
                if(mode==="register" && w.length<4){ say("비밀번호는 4자 이상 입력해주세요."); pw.focus(); return; }
                if(!window.AnonAPI){ say("잠시 후 다시 시도해주세요."); return; }
                o.disabled=true;
                try{
                    if(mode==="register"){
                        const r=await window.AnonAPI.registerFixedNick({nickname:n,password:w});
                        if(r==="exists"){ say("이미 누가 쓰고 있는 닉네임이에요."); o.disabled=false; return; }
                    }
                    const r=await window.AnonAPI.fixedLogin({nickname:n,password:w});
                    if(r.status==="locked"){ say("비밀번호를 여러 번 틀려서 10분 동안 로그인할 수 없어요."); o.disabled=false; return; }
                    if(r.status!=="ok"){ say(r.status==="none"?"없는 고닉이에요. '고닉 만들기'로 먼저 등록해주세요.":"닉네임 또는 비밀번호가 맞지 않아요."); o.disabled=false; return; }
                    Fixed.set({nickname:r.nickname,token:r.token});
                    say(`${r.nickname} 님으로 로그인했어요.`);
                    done(true);
                }catch(e){ say(e.message||"로그인하지 못했어요."); o.disabled=false; }
            };
            o.onclick=submit;
            pw.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); submit(); } });
            row.append(c,o);
            box.append(title,msg,nick,pw,sub,swap,row);
            render();
        },
        focus(box){ box.querySelector(".ui-dialog-input")?.focus(); }
    });
}

document.addEventListener("click",async(e)=>{
    if(e.target.closest("[data-fixed-login-btn]")){
        const fx=Fixed.get();
        if(!fx) openFixedNickModal();
        else if(await uiConfirm(`${fx.nickname} 님, 로그아웃할까요?`,{ok:"로그아웃"})){
            window.sb?.rpc("fixed_logout",{p_token:fx.token});
            Fixed.clear();
            if(typeof toast==="function") toast("로그아웃했어요.");
        }
        return;
    }
    if(e.target.closest("[data-fixed-nick]")) openFixedNickModal();
    if(e.target.closest("[data-fixed-logout]")){
        const fx=Fixed.get();
        if(fx) window.sb?.rpc("fixed_logout",{p_token:fx.token});
        Fixed.clear();
        if(typeof toast==="function") toast("로그아웃했어요.");
    }
});
window.openFixedNickModal=openFixedNickModal;

/* =====================================================
   관리자: 작성자 정지 (sql/bans.sql)
===================================================== */
window.openBanDialog=async function(kind,id){
    const say=(m)=>{ if(typeof toast==="function") toast(m); };
    const sb=window.sb; if(!sb) return;
    let info;
    try{
        const r=await sb.rpc("admin_author_info",{p_kind:kind,p_id:Number(id)});
        if(r.error) throw new Error(r.error.message); info=r.data;
    }catch(e){ say("작성자 정보를 불러오지 못했어요."); return; }
    const fmtUntil=(u)=>u?new Date(u).toLocaleString("ko-KR",{month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})+"까지":"영구";
    const kindName={fixed:"고닉 계정",client:"기기",ip:"같은 IP"};
    dialog({
        cancelValue:null,
        fill(box,done){
            const name=info.nickname||"";
            box.appendChild(h("h3","ui-dialog-title",esc(name)+" 정지"));
            box.appendChild(h("p","ui-dialog-msg",info.is_fixed?"고닉 계정이에요.":"비로그인 작성자예요. 기기 단위로 정지돼요."));
            let hours=24, scope="account";
            const mk=(label,items,get,set)=>{
                box.appendChild(h("div","ban-label",label));
                const row=h("div","ban-chips");
                items.forEach(([t,v])=>{
                    const b=h("button","ban-chip"+(get()===v?" on":""),t); b.type="button";
                    b.onclick=()=>{ set(v); row.querySelectorAll(".ban-chip").forEach(x=>x.classList.remove("on")); b.classList.add("on"); };
                    row.appendChild(b);
                });
                box.appendChild(row);
            };
            mk("기간",[["1시간",1],["1일",24],["7일",168],["영구",null]],()=>hours,(v)=>hours=v);
            mk("대상",[[info.is_fixed?"이 고닉":"이 기기","account"],["같은 IP","ip"]],()=>scope,(v)=>scope=v);
            if(!info.has_ip) box.appendChild(h("p","ui-dialog-sub","이 글은 IP 기록이 없어서 'IP' 정지는 안 돼요. (이후 글부터 기록돼요)"));
            const reason=h("input","input ui-dialog-input"); reason.type="text"; reason.maxLength=60; reason.placeholder="사유 (선택)";
            box.appendChild(reason);
            if(info.bans?.length){
                box.appendChild(h("div","ban-label","현재 정지"));
                info.bans.forEach(b=>{
                    const r=h("div","ban-active",`<span>${kindName[b.kind]||b.kind} · ${fmtUntil(b.until)}</span>`);
                    const x=h("button","fixed-nick-link","해제"); x.type="button";
                    x.onclick=async()=>{ const {error}=await sb.rpc("admin_unban",{p_id:b.id}); say(error?"해제하지 못했어요.":"정지를 해제했어요."); if(!error) done(null); };
                    r.appendChild(x); box.appendChild(r);
                });
            }
            const row=h("div","ui-dialog-actions");
            const c=h("button","btn btn-outline","취소"); c.type="button"; c.onclick=()=>done(null);
            const o=h("button","btn ui-dialog-ok danger","정지"); o.type="button";
            o.onclick=async()=>{
                o.disabled=true;
                const {error}=await sb.rpc("admin_ban",{p_kind:kind,p_id:Number(id),p_scope:scope,p_hours:hours,p_reason:reason.value});
                if(error){ say(error.code==="P0001"?error.message:"정지하지 못했어요."); o.disabled=false; return; }
                say("정지했어요."); done(true);
            };
            row.append(c,o); box.appendChild(row);
        }
    });
};


/* =====================================================
   INIT
===================================================== */

function scan(rootEl){
    (rootEl||document).querySelectorAll("select:not([data-ui-select])").forEach(enhanceSelect);
    (rootEl||document).querySelectorAll('input[type="date"]:not([data-ui-date])').forEach(enhanceDate);
}

function init(){
    scan();
    /* 나중에 만들어지는 select/date 도 자동 적용 */
    new MutationObserver((muts)=>{
        for(const m of muts) for(const n of m.addedNodes){
            if(n.nodeType!==1) continue;
            if(n.matches?.("select,input[type=date]")) scan(n.parentNode);
            else if(n.querySelector?.("select,input[type=date]")) scan(n);
        }
    }).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
else init();

window.TaeckerUI={enhanceSelect,enhanceDate,scan};

})();
