/* =====================================================
   TAECKER INQUIRY
   inquiry.html 전용 문의하기 로직 (비로그인)
   - 문의 접수 → 접수번호 발급 (AnonAPI.submitInquiry)
   - 접수번호로 문의/답변 조회 (AnonAPI.lookupInquiry)
===================================================== */

"use strict";

(function(){

const el={

    form:document.getElementById("inquiryForm"),
    name:document.getElementById("inquiryName"),
    contact:document.getElementById("inquiryContact"),
    content:document.getElementById("inquiryContent"),
    contentCount:document.getElementById("inquiryContentCount"),
    submitBtn:document.getElementById("inquirySubmitBtn"),

    receipt:document.getElementById("inquiryReceipt"),
    receiptCode:document.getElementById("inquiryReceiptCode"),
    copyBtn:document.getElementById("inquiryCopyBtn"),

    lookupForm:document.getElementById("inquiryLookupForm"),
    lookupCode:document.getElementById("inquiryLookupCode"),
    lookupBtn:document.getElementById("inquiryLookupBtn"),
    myCodes:document.getElementById("inquiryMyCodes"),
    myList:document.getElementById("myInquiryList")

};

if(!el.form) return;

const CODES_KEY="taeker_inquiry_codes";

function toast(message){

    window.Taecker?.toast?.(message);

}

function escapeHtml(str){

    return String(str ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#39;");

}

function formatDate(iso){

    if(!iso) return "";

    const d=new Date(iso);

    if(isNaN(d)) return "";

    return d.toLocaleString("ko-KR",{year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});

}

/* ---------- 내가 접수한 번호 (이 기기에만 저장) ---------- */

function getSavedCodes(){

    try{

        const raw=JSON.parse(localStorage.getItem(CODES_KEY) || "[]");

        return Array.isArray(raw) ? raw.filter((c)=>typeof c==="string") : [];

    }

    catch(error){

        return [];

    }

}

function saveCode(code){

    try{

        const codes=[code,...getSavedCodes().filter((c)=>c!==code)].slice(0,10);

        localStorage.setItem(CODES_KEY,JSON.stringify(codes));

    }

    catch(error){ /* 저장 실패는 무시 */ }

}

function renderCodeChips(){

    if(!el.myCodes) return;

    const codes=getSavedCodes();

    if(!codes.length){

        el.myCodes.innerHTML="";

        return;

    }

    el.myCodes.innerHTML=`<span style="font-size:12px;color:var(--sub);align-self:center;">내가 접수한 번호</span>`+
        codes.map((code)=>`<button type="button" class="btn btn-outline" data-code="${escapeHtml(code)}" style="padding:4px 10px;font-size:12px;">${escapeHtml(code)}</button>`).join("");

}

el.myCodes?.addEventListener("click",(e)=>{

    const btn=e.target.closest("[data-code]");

    if(!btn) return;

    el.lookupCode.value=btn.dataset.code;

    lookup(btn.dataset.code);

});

/* ---------- CONTENT COUNTER ---------- */

el.content?.addEventListener("input",()=>{

    if(el.contentCount){

        el.contentCount.textContent=`${el.content.value.length} / 2000`;

    }

});

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

        toast("문의 내용을 입력해주세요.");
        el.content.focus();
        return;

    }

    if(!window.AnonAPI){

        toast("잠시 후 다시 시도해주세요.");
        return;

    }

    setLoading(true);

    try{

        const code=await window.AnonAPI.submitInquiry({

            nickname:el.name.value.trim(),
            contact:el.contact.value.trim(),
            content

        });

        saveCode(code);
        renderCodeChips();

        el.receiptCode.textContent=code;
        el.receipt.classList.remove("hidden");
        el.receipt.scrollIntoView({behavior:"smooth",block:"center"});

        el.form.reset();

        if(el.contentCount) el.contentCount.textContent="0 / 2000";

        toast("문의가 등록되었습니다. 접수번호를 꼭 저장하세요!");

    }

    catch(error){

        console.error("문의 등록 실패:",error.message || error);

        toast(error.message || "문의 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

    finally{

        setLoading(false);

    }

});

/* ---------- COPY ---------- */

el.copyBtn?.addEventListener("click",async()=>{

    const code=el.receiptCode.textContent.trim();

    if(!code) return;

    try{

        await navigator.clipboard.writeText(code);

        toast("접수번호를 복사했어요.");

    }

    catch(error){

        toast("복사하지 못했어요. 번호를 길게 눌러 직접 복사해주세요.");

    }

});

/* ---------- LOOKUP ---------- */

function inquiryHTML(code,inquiry){

    const answered=inquiry.status==="answered";

    return `
        <div class="card" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;${answered ? "background:#DCFCE7;color:#15803D;" : "background:#FEF3C7;color:#B45309;"}">
                    ${answered ? "답변완료" : "답변대기"}
                </span>
                <span style="font-size:12px;color:var(--sub);">접수번호 ${escapeHtml(code)} · ${escapeHtml(formatDate(inquiry.created_at))}</span>
            </div>
            <p style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(inquiry.content)}</p>
            ${answered ? `
                <div style="margin-top:12px;padding:12px;border-radius:12px;background:var(--background);">
                    <p style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:4px;">운영진 답변 · ${escapeHtml(formatDate(inquiry.replied_at))}</p>
                    <p style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(inquiry.admin_reply || "")}</p>
                </div>
            ` : `<p style="margin-top:10px;font-size:13px;color:var(--sub);">아직 답변이 등록되지 않았어요. 나중에 다시 조회해주세요.</p>`}
        </div>
    `;

}

async function lookup(rawCode){

    const code=String(rawCode || "").trim().toUpperCase();

    if(!code){

        toast("접수번호를 입력해주세요.");
        el.lookupCode.focus();
        return;

    }

    if(!window.AnonAPI){

        toast("잠시 후 다시 시도해주세요.");
        return;

    }

    el.lookupBtn.disabled=true;
    el.myList.innerHTML=`<p class="widget-empty">불러오는 중...</p>`;

    try{

        const inquiry=await window.AnonAPI.lookupInquiry(code);

        if(!inquiry){

            el.myList.innerHTML=`<p class="widget-empty">해당 접수번호를 찾을 수 없어요.</p>`;

            return;

        }

        saveCode(code);
        renderCodeChips();

        el.myList.innerHTML=inquiryHTML(code,inquiry);

    }

    catch(error){

        console.warn("문의 조회 실패:",error.message || error);

        el.myList.innerHTML=`<p class="widget-empty">${escapeHtml(error.message || "문의를 불러오지 못했어요.")}</p>`;

    }

    finally{

        el.lookupBtn.disabled=false;

    }

}

el.lookupForm?.addEventListener("submit",(event)=>{

    event.preventDefault();

    lookup(el.lookupCode.value);

});

/* ---------- INIT ---------- */

window.addEventListener("load",()=>{

    renderCodeChips();

});

})();
