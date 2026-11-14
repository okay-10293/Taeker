/* =====================================================
   TAECKER WRITE
   write.html 전용 글쓰기 로직
===================================================== */

"use strict";

(function(){

const el={

    form:document.getElementById("writeForm"),
    category:document.getElementById("writeCategory"),
    nickname:document.getElementById("writeNickname"),
    password:document.getElementById("writePassword"),
    title:document.getElementById("writeTitle"),
    titleMessage:document.getElementById("writeTitleMessage"),
    content:document.getElementById("writeContent"),
    contentCount:document.getElementById("writeContentCount"),
    submitBtn:document.getElementById("writeSubmitBtn"),
    cancelBtn:document.getElementById("writeCancelBtn")

};

if(!el.form) return;

/* ---------- SUPABASE ---------- */

function getClient(){

    return window.sb || null;

}

/* ---------- CATEGORY PREFILL (board.html?category=xxx → write.html?category=xxx) ---------- */

const params=new URLSearchParams(location.search);
const presetCategory=params.get("category");

function applyCategoryPrefill(){

    if(!presetCategory || !el.category) return;

    const validOption=Array.from(el.category.options)
        .some((opt)=>opt.value===presetCategory);

    if(validOption){

        el.category.value=presetCategory;

    }

}

applyCategoryPrefill();

/* ---------- CONTENT COUNTER ---------- */

el.content?.addEventListener("input",()=>{

    if(el.contentCount){

        el.contentCount.textContent=`${el.content.value.length} / 4000`;

    }

});

/* ---------- CANCEL ---------- */

el.cancelBtn?.addEventListener("click",()=>{

    if(el.title.value.trim() || el.content.value.trim()){

        const leave=confirm("작성 중인 내용이 사라집니다. 나가시겠습니까?");

        if(!leave) return;

    }

    history.length>1 ? history.back() : (location.href="board.html");

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

    const title=el.title.value.trim();
    const content=el.content.value.trim();
    const category=el.category.value;

    if(!title){

        window.Taecker?.toast?.("제목을 입력해주세요.");
        el.title.focus();
        return;

    }

    if(!content){

        window.Taecker?.toast?.("내용을 입력해주세요.");
        el.content.focus();
        return;

    }

    const nickname=(el.nickname?.value || "").trim() || "태성인";
    const password=el.password?.value || "";

    if(password.length<4){

        window.Taecker?.toast?.("비밀번호는 4자 이상 입력해주세요.");
        el.password.focus();
        return;

    }

    if(!window.AnonAPI){

        window.Taecker?.toast?.("잠시 후 다시 시도해주세요.");
        return;

    }

    setLoading(true);

    try{

        const id=await window.AnonAPI.createPost({nickname,password,title,content,category});

        window.AnonAPI.saveNick(nickname);

        window.Taecker?.toast?.("글이 등록되었습니다.");

        setTimeout(()=>{

            location.href=`post.html?id=${encodeURIComponent(id)}`;

        },500);

    }

    catch(error){

        console.error("글 등록 실패:",error.message || error);

        window.Taecker?.toast?.(error.message || "글 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

    finally{

        setLoading(false);

    }

});

/* ---------- INIT ---------- */

/* 마지막으로 쓴 닉네임 자동 입력 */
if(el.nickname && window.AnonAPI){

    el.nickname.value=window.AnonAPI.getSavedNick() || "태성인";

}

/* 관리자로 로그인해 있으면 공지사항 카테고리 추가 */
window.addEventListener("load",async()=>{

    try{

        if(!window.Auth || !el.category) return;

        if(await window.Auth.isAdmin()){

            if(!Array.from(el.category.options).some((o)=>o.value==="notice")){

                const option=document.createElement("option");

                option.value="notice";
                option.textContent="공지사항";

                el.category.insertBefore(option,el.category.firstChild);

            }

        }

    }

    catch(error){ /* 일반 방문자는 그냥 무시 */ }

    applyCategoryPrefill();

});

})();
