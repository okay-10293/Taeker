/* =====================================================
   TAECKER WRITE
   write.html 전용 글쓰기 로직
===================================================== */

"use strict";

(function(){

const el={

    form:document.getElementById("writeForm"),
    category:document.getElementById("writeCategory"),
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

        const {data,error}=await client
            .from("posts")
            .insert({

                title,
                content,
                category,
                author_id:user.id

            })
            .select("id")
            .single();

        if(error) throw error;

        window.Taecker?.toast?.("글이 등록되었습니다.");

        setTimeout(()=>{

            location.href=`post.html?id=${encodeURIComponent(data.id)}`;

        },500);

    }

    catch(error){

        console.error("글 등록 실패:",error.message || error);

        window.Taecker?.toast?.("글 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

    finally{

        setLoading(false);

    }

});

/* ---------- AUTH GUARD ---------- */

const GRADE_CATEGORY_LABEL={

    grade1:"1학년 게시판",
    grade2:"2학년 게시판",
    grade3:"3학년 게시판"

};

async function injectGradeOption(){

    if(!el.category || !window.Auth) return;

    try{

        const profile=await window.Auth.getProfile();
        const grade=profile?.grade;

        if(!grade || grade<1 || grade>3) return;

        const category=`grade${grade}`;

        if(Array.from(el.category.options).some((opt)=>opt.value===category)) return;

        const option=document.createElement("option");

        option.value=category;
        option.textContent=GRADE_CATEGORY_LABEL[category];

        el.category.appendChild(option);

    }

    catch(error){

        console.warn("학년 게시판 옵션을 추가하지 못했습니다:",error.message || error);

    }

}

window.addEventListener("load",async()=>{

    if(!window.Auth) return;

    const loggedIn=await window.Auth.requireAuth();

    if(!loggedIn){

        el.form.classList.add("hidden");

        return;

    }

    await injectGradeOption();

    applyCategoryPrefill();

});

})();
