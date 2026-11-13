/* =====================================================
   TAECKER CALENDAR
   calendar.html 전용 - 누구나 일정 추가 (비로그인, 닉네임 + 비밀번호)
   읽기: calendar_events 직접 조회 / 쓰기: RPC (sql/calendar_setup.sql)
===================================================== */

"use strict";

(function(){

const $=(id)=>document.getElementById(id);
const grid=$("calGrid");
if(!grid) return;

const sb=()=>window.sb||null;
const esc=(s)=>typeof escapeHtml==="function"?escapeHtml(String(s??"")):String(s??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const say=(m)=>{ if(typeof toast==="function") toast(m); else alert(m); };

const pad=(n)=>String(n).padStart(2,"0");
const ymd=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const now=new Date();
const TODAY=ymd(now.getFullYear(),now.getMonth(),now.getDate());

let year=now.getFullYear(), month=now.getMonth();
let selected=TODAY;
let events={};   /* date -> [event] */

/* ---------- 데이터 ---------- */

async function load(){

    const first=ymd(year,month,1);
    const next=month===11?ymd(year+1,0,1):ymd(year,month+1,1);
    const c=sb();
    events={};
    if(c){
        const {data,error}=await c.from("calendar_events")
            .select("id,event_date,title,memo,nickname,created_at")
            .gte("event_date",first).lt("event_date",next)
            .order("created_at",{ascending:true}).limit(1000);
        if(error){ console.warn(error); say("일정을 불러오지 못했어요."); }
        (data||[]).forEach((e)=>{ (events[e.event_date]=events[e.event_date]||[]).push(e); });
    }
    render();
}

/* ---------- 렌더링 ---------- */

function render(){

    $("calLabel").textContent=`${year}년 ${month+1}월`;

    const startDow=new Date(year,month,1).getDay();
    const days=new Date(year,month+1,0).getDate();
    let h="";
    for(let i=0;i<startDow;i++) h+='<div class="cal-cell cal-empty"></div>';
    for(let d=1;d<=days;d++){
        const key=ymd(year,month,d);
        const list=events[key]||[];
        const dow=(startDow+d-1)%7;
        const cls=["cal-cell"];
        if(key===TODAY) cls.push("today");
        if(key===selected) cls.push("selected");
        if(dow===0) cls.push("sun");
        if(dow===6) cls.push("sat");
        h+=`<button type="button" class="${cls.join(" ")}" data-date="${key}">
            <span class="cal-num">${d}</span>
            ${list.slice(0,2).map((e)=>`<span class="cal-chip">${esc(e.title)}</span>`).join("")}
            ${list.length>2?`<span class="cal-more">+${list.length-2}</span>`:""}
        </button>`;
    }
    grid.innerHTML=h;
    renderDay();
}

function renderDay(){

    const [y,m,d]=selected.split("-").map(Number);
    const dow="일월화수목금토"[new Date(y,m-1,d).getDay()];
    $("calDayTitle").textContent=`${m}월 ${d}일 (${dow})`;

    const list=events[selected]||[];
    $("calDayList").innerHTML=list.length?list.map((e)=>`
        <div class="cal-item" data-id="${e.id}">
            <div class="cal-item-main">
                <strong>${esc(e.title)}</strong>
                ${e.memo?`<p>${esc(e.memo)}</p>`:""}
                <span class="cal-by">${esc(e.nickname)}</span>
            </div>
            <button type="button" class="cal-del" data-del="${e.id}" aria-label="일정 삭제">삭제</button>
        </div>`).join(""):'<p class="widget-empty">등록된 일정이 없어요.</p>';
}

/* ---------- 이벤트 ---------- */

grid.addEventListener("click",(e)=>{
    const b=e.target.closest(".cal-cell[data-date]");
    if(!b) return;
    selected=b.dataset.date;
    grid.querySelectorAll(".cal-cell.selected").forEach((x)=>x.classList.remove("selected"));
    b.classList.add("selected");
    renderDay();
});

function shift(delta){
    month+=delta;
    if(month<0){ month=11; year--; }
    if(month>11){ month=0; year++; }
    selected=ymd(year,month,1);
    if(year===now.getFullYear()&&month===now.getMonth()) selected=TODAY;
    load();
}
$("calPrev").onclick=()=>shift(-1);
$("calNext").onclick=()=>shift(1);
$("calToday").onclick=()=>{ year=now.getFullYear(); month=now.getMonth(); selected=TODAY; load(); };

const modal=$("calModal");
function openModal(){
    $("calDate").value=selected;
    $("calTitle").value=""; $("calMemo").value=""; $("calPw").value="";
    $("calNick").value=window.AnonAPI?.getSavedNick?.()||"";
    modal.classList.add("active");
    setTimeout(()=>$("calTitle").focus(),50);
}
function closeModal(){ modal.classList.remove("active"); }
$("calAddBtn").onclick=openModal;
$("calCancel").onclick=closeModal;
modal.addEventListener("click",(e)=>{ if(e.target===modal) closeModal(); });
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeModal(); });

$("calForm").addEventListener("submit",async(e)=>{
    e.preventDefault();
    const c=sb(), btn=$("calSubmit");
    if(!c){ say("서버에 연결할 수 없어요."); return; }
    const date=$("calDate").value, nick=$("calNick").value.trim();
    btn.disabled=true;
    try{
        const {error}=await c.rpc("create_calendar_event",{
            p_date:date,
            p_title:$("calTitle").value.trim(),
            p_memo:$("calMemo").value,
            p_nickname:nick,
            p_password:$("calPw").value,
            p_client_id:window.AnonAPI?.getClientId?.()
        });
        if(error) throw new Error(error.code==="P0001"?error.message:"일정을 등록하지 못했어요. 잠시 후 다시 시도해주세요.");
        window.AnonAPI?.saveNick?.(nick);
        closeModal();
        say("일정을 등록했어요.");
        const [y,m]=date.split("-").map(Number);
        year=y; month=m-1; selected=date;
        await load();
    }catch(err){
        say(err.message);
    }finally{
        btn.disabled=false;
    }
});

$("calDayList").addEventListener("click",async(e)=>{
    const b=e.target.closest("[data-del]");
    if(!b) return;
    const pw=prompt("일정을 등록할 때 정한 비밀번호를 입력하세요.");
    if(pw===null) return;
    const c=sb(); if(!c) return;
    const {data,error}=await c.rpc("delete_calendar_event",{p_id:Number(b.dataset.del),p_password:pw});
    if(error){ say("삭제하지 못했어요."); return; }
    if(data==="ok"){ say("삭제했어요."); load(); return; }
    say(window.AnonAPI?.explainStatus?.(data)||"삭제하지 못했어요.");
});

load();

})();
