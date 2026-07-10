/* =====================================================
   TAECKER SCHOOL
   school.html 전용 - 급식 / 시간표 / 학사일정
   NEIS(나이스 교육정보 개방 포털) Open API 연동
   설정값(인증키·학교코드)은 Supabase의 school_config 테이블에서 가져온다.
===================================================== */

"use strict";

(function(){

const el={

    loginRequired:document.getElementById("schoolLoginRequired"),
    wrap:document.getElementById("schoolWrap"),
    configWarning:document.getElementById("schoolConfigWarning"),

    tabs:document.getElementById("schoolTabs"),
    panelMeal:document.getElementById("panelMeal"),
    panelTimetable:document.getElementById("panelTimetable"),
    panelSchedule:document.getElementById("panelSchedule"),

    mealCard:document.getElementById("mealCard"),
    mealDateLabel:document.getElementById("mealDateLabel"),
    mealPrevBtn:document.getElementById("mealPrevBtn"),
    mealNextBtn:document.getElementById("mealNextBtn"),
    mealTodayBtn:document.getElementById("mealTodayBtn"),

    timetableCard:document.getElementById("timetableCard"),
    ttDateLabel:document.getElementById("ttDateLabel"),
    ttPrevBtn:document.getElementById("ttPrevBtn"),
    ttNextBtn:document.getElementById("ttNextBtn"),
    ttTodayBtn:document.getElementById("ttTodayBtn"),
    ttGradeSelect:document.getElementById("ttGradeSelect"),
    ttClassSelect:document.getElementById("ttClassSelect"),

    scheduleList:document.getElementById("scheduleList"),
    scheduleDateLabel:document.getElementById("scheduleDateLabel"),
    schedulePrevBtn:document.getElementById("schedulePrevBtn"),
    scheduleNextBtn:document.getElementById("scheduleNextBtn")

};

if(!el.wrap) return;

/* =====================================================
   STATE
===================================================== */

const params=new URLSearchParams(location.search);

const state={

    config:null,
    activeTab:params.get("tab") || "meal",

    mealDate:new Date(),
    ttDate:new Date(),
    ttGrade:Storage.get("school_grade","1"),
    ttClass:Storage.get("school_class","1"),

    scheduleMonth:new Date()

};

/* =====================================================
   UTIL
===================================================== */

function escapeHtml(str){

    return String(str ?? "").replace(/[&<>"']/g,(c)=>({

        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"

    }[c]));

}

function ymd(date){

    const y=date.getFullYear();
    const m=String(date.getMonth()+1).padStart(2,"0");
    const d=String(date.getDate()).padStart(2,"0");

    return `${y}${m}${d}`;

}

function formatDateLabel(date){

    return date.toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"});

}

function formatMonthLabel(date){

    return date.toLocaleDateString("ko-KR",{year:"numeric",month:"long"});

}

function getClient(){

    return window.sb || null;

}

/* =====================================================
   NEIS API
===================================================== */

const NEIS_BASE="https://open.neis.go.kr/hub/";

async function callNeis(endpoint,params){

    if(!state.config?.neis_api_key || !state.config?.atpt_ofcdc_sc_code || !state.config?.sd_schul_code){

        throw new Error("NOT_CONFIGURED");

    }

    const query=new URLSearchParams({

        KEY:state.config.neis_api_key,
        Type:"json",
        pIndex:"1",
        pSize:"100",
        ATPT_OFCDC_SC_CODE:state.config.atpt_ofcdc_sc_code,
        SD_SCHUL_CODE:state.config.sd_schul_code,
        ...params

    });

    const res=await fetch(`${NEIS_BASE}${endpoint}?${query.toString()}`);

    if(!res.ok){

        throw new Error(`HTTP_${res.status}`);

    }

    const data=await res.json();

    const root=data[endpoint];

    if(!root){

        /* RESULT 코드만 온 경우 (오류 또는 데이터 없음) */

        const code=data.RESULT?.CODE || "";

        if(code.includes("INFO-200")){

            return [];

        }

        throw new Error(code || "UNKNOWN_ERROR");

    }

    const head=root[0]?.head;
    const resultCode=head?.[1]?.RESULT?.CODE;

    if(resultCode && resultCode.includes("INFO-200")){

        return [];

    }

    return root[1]?.row || [];

}

/* =====================================================
   CONFIG 로드
===================================================== */

async function loadConfig(){

    const client=getClient();

    if(!client) return null;

    try{

        const {data,error}=await client
            .from("school_config")
            .select("neis_api_key,atpt_ofcdc_sc_code,sd_schul_code,school_name")
            .eq("id",1)
            .maybeSingle();

        if(error) throw error;

        return data;

    }

    catch(error){

        console.warn("학교 설정을 불러오지 못했습니다:",error.message || error);

        return null;

    }

}

function isConfigured(){

    return !!(state.config?.neis_api_key && state.config?.atpt_ofcdc_sc_code && state.config?.sd_schul_code);

}

/* =====================================================
   급식
===================================================== */

async function loadMeal(){

    if(el.mealDateLabel) el.mealDateLabel.textContent=formatDateLabel(state.mealDate);

    if(!isConfigured()){

        el.mealCard.innerHTML=`<p class="widget-empty">학교 정보 연동이 아직 설정되지 않았습니다.</p>`;

        return;

    }

    el.mealCard.innerHTML=`<p class="widget-empty">불러오는 중...</p>`;

    try{

        const rows=await callNeis("mealServiceDietInfo",{MLSV_YMD:ymd(state.mealDate)});

        if(!rows.length){

            el.mealCard.innerHTML=`<p class="widget-empty">해당 날짜에는 급식 정보가 없습니다.</p>`;

            return;

        }

        const order={"조식":0,"중식":1,"석식":2};

        const sorted=[...rows].sort((a,b)=>(order[a.MMEAL_SC_NM] ?? 9)-(order[b.MMEAL_SC_NM] ?? 9));

        el.mealCard.innerHTML=sorted.map((meal)=>{

            const dishes=String(meal.DDISH_NM || "")
                .split("<br/>")
                .map((d)=>d.replace(/\.[\d.]*$/,"").trim())
                .filter(Boolean);

            return `
                <div class="meal-block">
                    <div class="meal-block-title">${escapeHtml(meal.MMEAL_SC_NM)}</div>
                    <ul class="meal-dish-list">
                        ${dishes.map((d)=>`<li>${escapeHtml(d)}</li>`).join("")}
                    </ul>
                    ${meal.CAL_INFO ? `<div class="meal-cal">${escapeHtml(meal.CAL_INFO)}</div>` : ""}
                </div>
            `;

        }).join("");

    }

    catch(error){

        console.warn("급식 정보를 불러오지 못했습니다:",error.message || error);

        el.mealCard.innerHTML=`<p class="widget-empty">급식 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>`;

    }

}

el.mealPrevBtn?.addEventListener("click",()=>{

    state.mealDate=new Date(state.mealDate.getTime()-86400000);

    loadMeal();

});

el.mealNextBtn?.addEventListener("click",()=>{

    state.mealDate=new Date(state.mealDate.getTime()+86400000);

    loadMeal();

});

el.mealTodayBtn?.addEventListener("click",()=>{

    state.mealDate=new Date();

    loadMeal();

});

/* =====================================================
   시간표 (고등학교 기준 hisTimetable)
===================================================== */

async function loadTimetable(){

    if(el.ttDateLabel) el.ttDateLabel.textContent=formatDateLabel(state.ttDate);

    if(!isConfigured()){

        el.timetableCard.innerHTML=`<p class="widget-empty">학교 정보 연동이 아직 설정되지 않았습니다.</p>`;

        return;

    }

    el.timetableCard.innerHTML=`<p class="widget-empty">불러오는 중...</p>`;

    try{

        const rows=await callNeis("hisTimetable",{

            ALL_TI_YMD:ymd(state.ttDate),
            GRADE:state.ttGrade,
            CLASS_NM:state.ttClass

        });

        if(!rows.length){

            el.timetableCard.innerHTML=`<p class="widget-empty">해당 날짜에는 시간표 정보가 없습니다. (주말·방학 등)</p>`;

            return;

        }

        const grouped=new Map();

        for(const row of rows){

            const perio=Number(row.PERIO);

            if(!Number.isFinite(perio)) continue;

            const subject=(row.ITRT_CNTNT || "").trim();

            if(!subject) continue;

            if(!grouped.has(perio)) grouped.set(perio,new Set());

            grouped.get(perio).add(subject);

        }

        if(grouped.size===0){

            el.timetableCard.innerHTML=`<p class="widget-empty">해당 날짜에는 시간표 정보가 없습니다. (주말·방학 등)</p>`;

            return;

        }

        /* NEIS는 실제 수업이 있는 교시만 내려주고 공강(빈 교시)은 아예 응답에서
           빠지기 때문에, 받은 교시들 중 가장 큰 번호까지 1교시부터 채워서
           공강도 하나의 교시로 보이도록 한다. */

        const maxPerio=Math.max(...grouped.keys());

        const periods=Array.from({length:maxPerio},(_,i)=>i+1);

        el.timetableCard.innerHTML=`
            <ul class="timetable-list">
                ${periods.map((perio)=>{

                    const subjects=grouped.get(perio);
                    const label=subjects ? Array.from(subjects).join(" / ") : "공강";

                    return `
                        <li class="timetable-item${subjects ? "" : " timetable-item-empty"}">
                            <span class="timetable-perio">${perio}교시</span>
                            <span class="timetable-subject">${escapeHtml(label)}</span>
                        </li>
                    `;

                }).join("")}
            </ul>
        `;

    }

    catch(error){

        console.warn("시간표를 불러오지 못했습니다:",error.message || error);

        el.timetableCard.innerHTML=`<p class="widget-empty">시간표를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>`;

    }

}

el.ttPrevBtn?.addEventListener("click",()=>{

    state.ttDate=new Date(state.ttDate.getTime()-86400000);

    loadTimetable();

});

el.ttNextBtn?.addEventListener("click",()=>{

    state.ttDate=new Date(state.ttDate.getTime()+86400000);

    loadTimetable();

});

el.ttTodayBtn?.addEventListener("click",()=>{

    state.ttDate=new Date();

    loadTimetable();

});

el.ttGradeSelect?.addEventListener("change",()=>{

    state.ttGrade=el.ttGradeSelect.value;

    Storage.set("school_grade",state.ttGrade);

    loadTimetable();

});

el.ttClassSelect?.addEventListener("change",()=>{

    state.ttClass=el.ttClassSelect.value;

    Storage.set("school_class",state.ttClass);

    loadTimetable();

});

if(el.ttGradeSelect) el.ttGradeSelect.value=state.ttGrade;
if(el.ttClassSelect) el.ttClassSelect.value=state.ttClass;

/* =====================================================
   학사일정
===================================================== */

async function loadSchedule(){

    if(el.scheduleDateLabel) el.scheduleDateLabel.textContent=formatMonthLabel(state.scheduleMonth);

    if(!isConfigured()){

        el.scheduleList.innerHTML=`<p class="widget-empty">학교 정보 연동이 아직 설정되지 않았습니다.</p>`;

        return;

    }

    el.scheduleList.innerHTML=`<p class="widget-empty">불러오는 중...</p>`;

    try{

        const year=state.scheduleMonth.getFullYear();
        const month=state.scheduleMonth.getMonth();

        const from=new Date(year,month,1);
        const to=new Date(year,month+1,0);

        const rows=await callNeis("SchoolSchedule",{

            AA_FROM_YMD:ymd(from),
            AA_TO_YMD:ymd(to)

        });

        if(!rows.length){

            el.scheduleList.innerHTML=`<p class="widget-empty">이번 달에는 등록된 학사일정이 없습니다.</p>`;

            return;

        }

        const sorted=[...rows].sort((a,b)=>Number(a.AA_YMD)-Number(b.AA_YMD));

        el.scheduleList.innerHTML=`
            <ul class="schedule-list">
                ${sorted.map((row)=>{

                    const d=row.AA_YMD || "";
                    const dateLabel=d.length===8 ? `${Number(d.slice(4,6))}.${Number(d.slice(6,8))}` : d;

                    return `
                        <li class="schedule-item">
                            <span class="schedule-date">${escapeHtml(dateLabel)}</span>
                            <span class="schedule-event">${escapeHtml(row.EVENT_NM || "")}</span>
                        </li>
                    `;

                }).join("")}
            </ul>
        `;

    }

    catch(error){

        console.warn("학사일정을 불러오지 못했습니다:",error.message || error);

        el.scheduleList.innerHTML=`<p class="widget-empty">학사일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>`;

    }

}

el.schedulePrevBtn?.addEventListener("click",()=>{

    state.scheduleMonth=new Date(state.scheduleMonth.getFullYear(),state.scheduleMonth.getMonth()-1,1);

    loadSchedule();

});

el.scheduleNextBtn?.addEventListener("click",()=>{

    state.scheduleMonth=new Date(state.scheduleMonth.getFullYear(),state.scheduleMonth.getMonth()+1,1);

    loadSchedule();

});

/* =====================================================
   탭 전환
===================================================== */

function setActiveTab(tab){

    state.activeTab=tab;

    el.tabs?.querySelectorAll(".feed-tab").forEach((btn)=>{

        btn.classList.toggle("active",btn.dataset.tab===tab);

    });

    el.panelMeal?.classList.toggle("hidden",tab!=="meal");
    el.panelTimetable?.classList.toggle("hidden",tab!=="timetable");
    el.panelSchedule?.classList.toggle("hidden",tab!=="schedule");

    const url=new URL(location.href);

    url.searchParams.set("tab",tab);

    history.replaceState(null,"",url);

    if(tab==="meal") loadMeal();
    if(tab==="timetable") loadTimetable();
    if(tab==="schedule") loadSchedule();

}

el.tabs?.addEventListener("click",(e)=>{

    const btn=e.target.closest(".feed-tab");

    if(!btn) return;

    setActiveTab(btn.dataset.tab);

});

/* =====================================================
   INIT
===================================================== */

window.addEventListener("load",async()=>{

    if(!window.Auth){

        return;

    }

    const user=await window.Auth.getCurrentUser();

    if(!user){

        el.loginRequired?.classList.remove("hidden");
        el.wrap?.classList.add("hidden");

        return;

    }

    el.loginRequired?.classList.add("hidden");
    el.wrap?.classList.remove("hidden");

    state.config=await loadConfig();

    if(!isConfigured()){

        el.configWarning?.classList.remove("hidden");

    }else{

        el.configWarning?.classList.add("hidden");

    }

    setActiveTab(state.activeTab==="timetable" || state.activeTab==="schedule" ? state.activeTab : "meal");

});

})();
