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

/* ---------- FILE ATTACH ---------- */

const MAX_FILES=5;
const MAX_BYTES=10*1024*1024;
const EXT_MIME={hwp:"application/x-hwp",hwpx:"application/vnd.hancom.hwpx",heic:"image/heic",heif:"image/heif",
    pdf:"application/pdf",txt:"text/plain",zip:"application/zip",doc:"application/msword",
    docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt:"application/vnd.ms-powerpoint",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation"};
const picked=[];
const fileInput=document.getElementById("writeFiles");
const fileList=document.getElementById("writeFileList");

function fmtSize(n){ return n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB"; }
function extOf(name){ const m=/\.([A-Za-z0-9]{1,8})$/.exec(name||""); return m?m[1].toLowerCase():""; }

function renderFiles(){
    if(!fileList) return;
    fileList.innerHTML="";
    picked.forEach((f,i)=>{
        const li=document.createElement("li");
        li.className="attach-item";
        const nm=document.createElement("span");
        nm.className="attach-name"; nm.textContent=f.name;
        const sz=document.createElement("span");
        sz.className="attach-size"; sz.textContent=fmtSize(f.size);
        const rm=document.createElement("button");
        rm.type="button"; rm.className="attach-remove"; rm.setAttribute("aria-label","첨부 취소"); rm.textContent="✕";
        rm.onclick=()=>{ picked.splice(i,1); renderFiles(); };
        li.append(nm,sz,rm);
        fileList.appendChild(li);
    });
}

document.getElementById("writeFilesBtn")?.addEventListener("click",()=>fileInput?.click());
fileInput?.addEventListener("change",()=>{
    for(const f of fileInput.files){
        if(picked.length>=MAX_FILES){ window.Taecker?.toast?.("파일은 최대 5개까지 첨부할 수 있어요."); break; }
        if(f.size>MAX_BYTES){ window.Taecker?.toast?.(`${f.name}: 10MB를 넘어서 첨부할 수 없어요.`); continue; }
        if(f.size===0) continue;
        picked.push(f);
    }
    fileInput.value="";
    renderFiles();
});

async function uploadAttachments(postId,password){
    const c=window.sb; if(!c||!picked.length) return {ok:0,fail:0};
    const done=[]; let fail=0;
    for(let i=0;i<picked.length;i++){
        const f=picked[i];
        const ext=extOf(f.name);
        const path=`${postId}/${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2,6)}${ext?"."+ext:""}`;
        const mime=f.type||EXT_MIME[ext]||"application/octet-stream";
        const {error}=await c.storage.from("post-files").upload(path,f,{contentType:mime,upsert:false});
        if(error){ console.warn("첨부 업로드 실패:",error.message); fail++; continue; }
        done.push({path,name:f.name,size:f.size,mime});
    }
    if(done.length){
        try{ await window.AnonAPI.addAttachments({postId,password,files:done}); }
        catch(e){ console.warn(e); fail+=done.length; return {ok:0,fail}; }
    }
    return {ok:done.length,fail};
}

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

el.cancelBtn?.addEventListener("click",async()=>{

    if(el.title.value.trim() || el.content.value.trim()){

        const leave=await uiConfirm("작성 중인 내용이 사라집니다. 나가시겠습니까?",{ok:"나가기"});

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

    const fx=window.TaeckerFixed?.get?.();
    const nickname=fx ? fx.nickname : ((el.nickname?.value || "").trim() || "태성인");
    const password=fx ? fx.token : (el.password?.value || "");

    if(!password){

        window.Taecker?.toast?.("비밀번호를 입력해주세요. 나중에 글을 수정·삭제할 때 필요해요.");
        el.password.focus();
        return;

    }

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

        if(!fx) window.AnonAPI.saveNick(nickname);

        let attachFail=0;
        if(picked.length){
            const r=await uploadAttachments(id,password);
            attachFail=r.fail;
        }

        window.Taecker?.toast?.(attachFail ? "글은 등록됐지만 일부 파일은 올리지 못했어요." : "글이 등록되었습니다.");

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
