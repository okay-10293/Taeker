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

    setLoading(true);

    try{

        const user=await window.Auth.getCurrentUser();

        if(!user){

            window.Taecker?.toast?.("로그인이 필요합니다.");

            setTimeout(()=>{ location.href="login.html"; },600);

            return;

        }

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

        window.Taecker?.toast?.("문의 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

    finally{

        setLoading(false);

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

});

})();
