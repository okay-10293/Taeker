/* =====================================================
   TAECKER INQUIRY
   inquiry.html 전용 문의하기 로직
===================================================== */

"use strict";

(function(){

const el={

    form:document.getElementById("inquiryForm"),
    content:document.getElementById("inquiryContent"),
    contentCount:document.getElementById("inquiryContentCount"),
    submitBtn:document.getElementById("inquirySubmitBtn"),
    myList:document.getElementById("myInquiryList")

};

if(!el.form) return;

const DAILY_LIMIT=3;

/* ---------- DAILY LIMIT HELPERS ---------- */

// KST(Asia/Seoul) 기준 "오늘" 00:00:00의 ISO 문자열을 반환합니다.
function kstTodayStartISO(){

    const now=new Date();
    const kstMs=now.getTime()+(now.getTimezoneOffset()*60000)+(9*60*60000);
    const kst=new Date(kstMs);

    kst.setHours(0,0,0,0);

    // kst는 "로컬 타임존인 척"하는 KST 시각이므로, 다시 UTC 기준 ISO로 변환합니다.
    const utcMs=kst.getTime()-(9*60*60000);

    return new Date(utcMs).toISOString();

}

async function getTodayInquiryCount(userId){

    const client=getClient();

    if(!client) return 0;

    const {count,error}=await client
        .from("inquiries")
        .select("id",{count:"exact",head:true})
        .eq("user_id",userId)
        .gte("created_at",kstTodayStartISO());

    if(error){

        console.warn("오늘 문의 건수를 확인하지 못했습니다:",error.message || error);

        return 0;

    }

    return count || 0;

}

async function refreshDailyLimitUI(userId){

    if(!el.submitBtn) return 0;

    const todayCount=await getTodayInquiryCount(userId);
    const remaining=Math.max(0,DAILY_LIMIT-todayCount);

    if(remaining<=0){

        el.submitBtn.disabled=true;

        const text=el.submitBtn.querySelector(".button-text");

        if(text) text.textContent="오늘의 문의 횟수를 모두 사용했어요";

        window.Taecker?.toast?.(`문의는 하루에 ${DAILY_LIMIT}건까지만 등록할 수 있어요.`);

    }

    else{

        el.submitBtn.disabled=false;

        const text=el.submitBtn.querySelector(".button-text");

        if(text) text.textContent="문의 등록하기";

    }

    return remaining;

}

/* ---------- SUPABASE ---------- */

function getClient(){

    return window.sb || null;

}

function escapeHtml(str){

    return String(str ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#39;");

}

function timeAgo(iso){

    if(!iso) return "";

    const diffMs=Date.now()-new Date(iso).getTime();
    const min=Math.floor(diffMs/60000);

    if(min<1) return "방금 전";
    if(min<60) return `${min}분 전`;

    const hour=Math.floor(min/60);

    if(hour<24) return `${hour}시간 전`;

    const day=Math.floor(hour/24);

    if(day<7) return `${day}일 전`;

    return new Date(iso).toLocaleDateString("ko-KR");

}

/* ---------- CONTENT COUNTER ---------- */

el.content?.addEventListener("input",()=>{

    if(el.contentCount){

        el.contentCount.textContent=`${el.content.value.length} / 2000`;

    }

});

/* ---------- MY INQUIRY LIST ---------- */

function inquiryItemHTML(inquiry){

    const answered=inquiry.status==="answered";

    return `
        <div class="card" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;${answered ? "background:#DCFCE7;color:#15803D;" : "background:#FEF3C7;color:#B45309;"}">
                    ${answered ? "답변완료" : "답변대기"}
                </span>
                <span style="font-size:12px;color:var(--sub);">${timeAgo(inquiry.created_at)}</span>
            </div>
            <p style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(inquiry.content)}</p>
            ${answered ? `
                <div style="margin-top:12px;padding:12px;border-radius:12px;background:var(--background);">
                    <p style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:4px;">운영진 답변</p>
                    <p style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(inquiry.admin_reply || "")}</p>
                </div>
            ` : ""}
        </div>
    `;

}

async function loadMyInquiries(userId){

    const client=getClient();

    if(!client || !el.myList) return;

    el.myList.innerHTML=`<p class="widget-empty">불러오는 중...</p>`;

    try{

        const {data,error}=await client
            .from("inquiries")
            .select("id,content,status,admin_reply,created_at")
            .eq("user_id",userId)
            .order("created_at",{ascending:false});

        if(error) throw error;

        if(!data || data.length===0){

            el.myList.innerHTML=`<p class="widget-empty">아직 남긴 문의가 없어요.</p>`;

            return;

        }

        el.myList.innerHTML=data.map(inquiryItemHTML).join("");

    }

    catch(error){

        console.warn("문의 내역을 불러오지 못했습니다:",error.message || error);

        el.myList.innerHTML=`<p class="widget-empty">문의 내역을 불러오지 못했습니다.</p>`;

    }

}

/* ---------- SUBMIT ---------- */

function setLoading(state){

    if(!el.submitBtn) return;

    el.submitBtn.disabled=state;

    const text=el.submitBtn.querySelector(".button-text");
    const loader=el.submitBtn.querySelector(".button-loader");

    if(text) text.style.display=state ? "none" : "inline-flex";
    if(loader) loader.classList.toggle("hidden",!state);

}

el.form.addEventListener("submit",async(event)=>{

    event.preventDefault();

    const content=el.content.value.trim();

    if(!content){

        window.Taecker?.toast?.("문의 내용을 입력해주세요.");
        el.content.focus();
        return;

    }

    const client=getClient();

    if(!client || !window.Auth){

        window.Taecker?.toast?.("잠시 후 다시 시도해주세요.");
        return;

    }

    const user=await window.Auth.getCurrentUser();

    if(!user){

        window.Taecker?.toast?.("로그인이 필요합니다.");

        setTimeout(()=>{ location.href="login.html"; },600);

        return;

    }

    const remaining=await refreshDailyLimitUI(user.id);

    if(remaining<=0) return;

    setLoading(true);

    try{

        const {error}=await client
            .from("inquiries")
            .insert({

                content,
                user_id:user.id

            });

        if(error) throw error;

        window.Taecker?.toast?.("문의가 등록되었습니다.");

        el.form.reset();

        if(el.contentCount) el.contentCount.textContent="0 / 2000";

        loadMyInquiries(user.id);

    }

    catch(error){

        console.error("문의 등록 실패:",error.message || error);

        if(error?.code==="P0001" || /하루에 문의는/.test(error?.message || "")){

            window.Taecker?.toast?.(`문의는 하루에 ${DAILY_LIMIT}건까지만 등록할 수 있어요.`);

        }

        else{

            window.Taecker?.toast?.("문의 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");

        }

    }

    finally{

        setLoading(false);

        // setLoading(false)가 버튼을 다시 활성화하므로, 오늘 남은 문의 가능 건수를
        // 최종 반영해 버튼 상태(활성/비활성, 문구)를 정확히 맞춥니다.
        refreshDailyLimitUI(user.id);

    }

});

/* ---------- INIT ---------- */

window.addEventListener("load",async()=>{

    if(!window.Auth) return;

    const user=await window.Auth.getCurrentUser();

    if(!user){

        if(el.myList){

            el.myList.innerHTML=`<p class="widget-empty">로그인하면 내가 남긴 문의 내역을 볼 수 있어요.</p>`;

        }

        return;

    }

    loadMyInquiries(user.id);
    refreshDailyLimitUI(user.id);

});

})();
