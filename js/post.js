/* =====================================================
   TAECKER POST DETAIL
   post.html 전용 게시글 상세 / 좋아요 / 댓글 로직
===================================================== */

"use strict";

(function(){

const el={

    wrap:document.getElementById("postDetailWrap"),
    skeleton:document.getElementById("postSkeleton"),
    detail:document.getElementById("postDetail"),

    categoryBadge:document.getElementById("postCategoryBadge"),
    title:document.getElementById("postTitle"),
    author:document.getElementById("postAuthor"),
    date:document.getElementById("postDate"),
    viewCount:document.getElementById("postViewCount"),
    content:document.getElementById("postContent"),

    likeBtn:document.getElementById("likeBtn"),
    likeIcon:document.getElementById("likeIcon"),
    likeCount:document.getElementById("likeCount"),
    commentCountText:document.getElementById("commentCountText"),

    commentSection:document.getElementById("commentSection"),
    commentSectionCount:document.getElementById("commentSectionCount"),
    commentForm:document.getElementById("commentForm"),
    commentInput:document.getElementById("commentInput"),
    commentSubmitBtn:document.getElementById("commentSubmitBtn"),
    commentList:document.getElementById("commentList"),

    editPostBtn:document.getElementById("editPostBtn"),
    deletePostBtn:document.getElementById("deletePostBtn"),
    commentNickname:document.getElementById("commentNickname"),
    commentPassword:document.getElementById("commentPassword"),
    reportPostBtn:document.getElementById("reportPostBtn"),
    reportModal:document.getElementById("reportModal"),
    reportModalTarget:document.getElementById("reportModalTarget"),
    reportForm:document.getElementById("reportForm"),
    reportReason:document.getElementById("reportReason"),
    reportFormMessage:document.getElementById("reportFormMessage"),
    reportSubmitBtn:document.getElementById("reportSubmitBtn"),
    reportCancelBtn:document.getElementById("reportCancelBtn")

};

if(!el.wrap) return;

const CATEGORY_LABEL={

    notice:"공지사항",
    free:"자유게시판",
    question:"질문게시판",
    info:"정보게시판",

    grade1:"1학년 게시판",
    grade2:"2학년 게시판",
    grade3:"3학년 게시판"

};

const params=new URLSearchParams(location.search);
const postId=params.get("id");

const state={

    post:null,
    liked:false,
    isAdmin:false,
    reportTarget:null

};

/* ---------- UTIL ---------- */

function escapeHtml(str){

    return String(str ?? "").replace(/[&<>"']/g,(c)=>({

        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"

    }[c]));

}

function timeAgo(dateStr){

    const date=new Date(dateStr);

    if(isNaN(date)) return "";

    const diff=Math.floor((Date.now()-date.getTime())/1000);

    if(diff<60) return "방금 전";
    if(diff<3600) return Math.floor(diff/60)+"분 전";
    if(diff<86400) return Math.floor(diff/3600)+"시간 전";
    if(diff<604800) return Math.floor(diff/86400)+"일 전";

    return date.toLocaleDateString("ko-KR",{year:"numeric",month:"numeric",day:"numeric"});

}

function getClient(){

    return window.sb || null;

}

function showError(message){

    el.skeleton?.classList.add("hidden");

    el.wrap.innerHTML=`
        <div class="card post-detail-error">
            <h3>${escapeHtml(message)}</h3>
            <p><a href="board.html" class="btn btn-outline" style="margin-top:14px;display:inline-flex;">게시판으로 돌아가기</a></p>
        </div>
    `;

}

/* ---------- 입력 팝업 (비밀번호 등) ----------
   window.prompt()는 모바일/인앱 브라우저에서 막히는 경우가 있어 직접 만든 팝업을 쓴다. */

function askDialog({title,desc,fields,okText}){

    return new Promise((resolve)=>{

        const wrapEl=document.createElement("div");

        wrapEl.className="modal active";

        wrapEl.innerHTML=`
            <div class="modal-content">
                <h3 style="margin-bottom:6px;">${escapeHtml(title)}</h3>
                ${desc ? `<p style="color:var(--sub);font-size:13px;margin-bottom:14px;">${escapeHtml(desc)}</p>` : ""}
                <form>
                    ${fields.map((f)=>`
                        <div class="form-group">
                            <label>${escapeHtml(f.label)}</label>
                            ${f.multiline
                                ? `<textarea class="input" name="${f.key}" rows="8" maxlength="${f.max || 4000}"></textarea>`
                                : `<input class="input" name="${f.key}" type="${f.type || "text"}" maxlength="${f.max || 100}" autocomplete="off">`}
                        </div>`).join("")}
                    <div class="write-actions">
                        <button type="button" class="btn btn-outline" data-cancel>취소</button>
                        <button type="submit" class="btn">${escapeHtml(okText || "확인")}</button>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(wrapEl);

        const form=wrapEl.querySelector("form");

        fields.forEach((f)=>{ if(f.value!=null) form.elements[f.key].value=f.value; });

        const first=form.elements[fields[0].key];

        setTimeout(()=>first?.focus(),50);

        function close(result){

            wrapEl.remove();
            resolve(result);

        }

        wrapEl.querySelector("[data-cancel]").addEventListener("click",()=>close(null));
        wrapEl.addEventListener("click",(e)=>{ if(e.target===wrapEl) close(null); });

        form.addEventListener("submit",(e)=>{

            e.preventDefault();

            const out={};

            fields.forEach((f)=>{ out[f.key]=form.elements[f.key].value; });

            close(out);

        });

    });

}

/* 관리자로 로그인해 있으면 비밀번호 없이 수정/삭제 가능 */

async function checkAdmin(){

    try{

        state.isAdmin=!!(window.Auth && await window.Auth.isAdmin());

    }

    catch(error){

        state.isAdmin=false;

    }

}

/* ---------- LOAD POST ---------- */

async function loadPost(){

    if(!postId){

        showError("잘못된 접근입니다. 게시글 ID가 없습니다.");

        return;

    }

    const client=getClient();

    if(!client){

        showError("게시글을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");

        return;

    }

    try{

        const {data,error}=await client
            .from("posts")
            .select("id,title,content,category,view_count,like_count,comment_count,created_at,nickname,source_notice_id")
            .eq("id",postId)
            .single();

        if(error || !data){

            showError("존재하지 않거나 삭제된 게시글입니다.");

            return;

        }

        state.post=data;

        renderPost(data);

        el.skeleton?.classList.add("hidden");
        el.detail?.classList.remove("hidden");
        el.commentSection?.classList.remove("hidden");

    }

    catch(error){

        console.error("게시글을 불러오지 못했습니다:",error.message || error);

        showError("게시글을 불러오지 못했습니다.");

        return;

    }

    /* 조회수 증가는 화면 렌더 이후 백그라운드로 처리 (실패해도 화면엔 영향 없음) */

    client.rpc("increment_view_count",{post_id:postId}).then(({error:rpcError})=>{

        if(rpcError) console.warn("조회수 증가 실패:",rpcError.message);

    });

    /* 게시글 자체는 이미 화면에 표시된 상태이므로,
       좋아요 상태/댓글 로딩이 실패해도 게시글 화면을 지우지 않고
       각자 알아서 실패를 처리하도록 분리 (전체 에러 화면으로 덮어쓰지 않음) */

    try{

        await refreshLikeState();

    }

    catch(error){

        console.warn("좋아요 상태를 불러오지 못했습니다:",error.message || error);

    }

    try{

        await loadComments();

    }

    catch(error){

        console.warn("댓글을 불러오지 못했습니다:",error.message || error);

        if(el.commentList){

            el.commentList.innerHTML=`<div class="comment-empty">댓글을 불러오지 못했습니다.</div>`;

        }

    }

}

function renderPost(post){

    const nickname=post.nickname || "익명";

    if(el.categoryBadge) el.categoryBadge.textContent=CATEGORY_LABEL[post.category] || "일반";
    if(el.title) el.title.textContent=post.title;

    if(el.author) el.author.textContent=nickname;

    /* 관리자 패널 공지에서 자동 생성된 글은 관리자 패널에서만 수정/삭제 */
    const isSystemNotice=!!post.source_notice_id;

    el.editPostBtn?.classList.toggle("hidden",isSystemNotice);
    el.deletePostBtn?.classList.toggle("hidden",isSystemNotice);

    if(el.date) el.date.textContent=timeAgo(post.created_at);
    if(el.viewCount) el.viewCount.textContent=`조회 ${post.view_count ?? 0}`;
    if(el.content) el.content.textContent=post.content;
    if(el.likeCount) el.likeCount.textContent=post.like_count ?? 0;
    if(el.commentCountText) el.commentCountText.textContent=`댓글 ${post.comment_count ?? 0}`;
    if(el.commentSectionCount) el.commentSectionCount.textContent=`(${post.comment_count ?? 0})`;

    document.title=`${post.title} | 태커`;

}

/* ---------- LIKE ---------- */

async function refreshLikeState(){

    if(!window.AnonAPI) return;

    try{

        state.liked=!!(await window.AnonAPI.hasLiked(postId));

    }

    catch(error){

        state.liked=false;

    }

    updateLikeButton();

}

function updateLikeButton(){

    if(!el.likeBtn) return;

    el.likeBtn.classList.toggle("active",state.liked);
    el.likeBtn.setAttribute("aria-pressed",String(state.liked));

    if(el.likeIcon) el.likeIcon.innerHTML = state.liked
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5C12 20.5 3 15 3 8.8C3 5.9 5.3 3.5 8.2 3.5C9.9 3.5 11.3 4.3 12 5.6C12.7 4.3 14.1 3.5 15.8 3.5C18.7 3.5 21 5.9 21 8.8C21 15 12 20.5 12 20.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20.5C12 20.5 3 15 3 8.8C3 5.9 5.3 3.5 8.2 3.5C9.9 3.5 11.3 4.3 12 5.6C12.7 4.3 14.1 3.5 15.8 3.5C18.7 3.5 21 5.9 21 8.8C21 15 12 20.5 12 20.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

}

let likeBusy=false;

el.likeBtn?.addEventListener("click",async()=>{

    if(likeBusy || !window.AnonAPI) return;

    likeBusy=true;

    try{

        const result=await window.AnonAPI.toggleLike(postId);

        state.liked=!!result?.liked;

        updateLikeButton();

        if(el.likeCount) el.likeCount.textContent=result?.like_count ?? 0;

    }

    catch(error){

        console.error("추천 처리 실패:",error.message || error);

        window.Taecker?.toast?.(error.message || "추천 처리에 실패했습니다.");

    }

    finally{

        likeBusy=false;

    }

});

/* ---------- EDIT / DELETE POST (비밀번호) ---------- */

let postBusy=false;

el.deletePostBtn?.addEventListener("click",async()=>{

    if(postBusy || !postId || !window.AnonAPI) return;

    let password="";

    if(!state.isAdmin){

        const answer=await askDialog({
            title:"글 삭제",
            desc:"글을 쓸 때 정한 비밀번호를 입력해주세요. 삭제하면 복구할 수 없어요.",
            fields:[{key:"password",label:"비밀번호",type:"password",max:30}],
            okText:"삭제"
        });

        if(!answer) return;

        password=answer.password;

    }

    else if(!confirm("관리자 권한으로 게시글을 삭제합니다. 복구할 수 없어요.")) return;

    postBusy=true;

    try{

        const status=await window.AnonAPI.deletePost(postId,password);

        if(status!=="ok"){

            window.Taecker?.toast?.(window.AnonAPI.explainStatus(status));

            return;

        }

        window.Taecker?.toast?.("게시글이 삭제되었습니다.");

        setTimeout(()=>{ location.href="board.html"; },500);

    }

    catch(error){

        console.error("게시글 삭제 실패:",error.message || error);

        window.Taecker?.toast?.(error.message || "게시글 삭제에 실패했습니다.");

    }

    finally{

        postBusy=false;

    }

});

el.editPostBtn?.addEventListener("click",async()=>{

    if(postBusy || !postId || !state.post || !window.AnonAPI) return;

    const fields=[
        {key:"title",label:"제목",value:state.post.title,max:100},
        {key:"content",label:"내용",value:state.post.content,multiline:true,max:4000}
    ];

    if(!state.isAdmin) fields.push({key:"password",label:"비밀번호",type:"password",max:30});

    const answer=await askDialog({title:"글 수정",fields,okText:"수정"});

    if(!answer) return;

    postBusy=true;

    try{

        const status=await window.AnonAPI.updatePost({
            id:postId,
            password:answer.password || "",
            title:answer.title,
            content:answer.content
        });

        if(status!=="ok"){

            window.Taecker?.toast?.(window.AnonAPI.explainStatus(status));

            return;

        }

        state.post.title=answer.title.trim();
        state.post.content=answer.content.trim();

        if(el.title) el.title.textContent=state.post.title;
        if(el.content) el.content.textContent=state.post.content;

        window.Taecker?.toast?.("글이 수정되었습니다.");

    }

    catch(error){

        console.error("게시글 수정 실패:",error.message || error);

        window.Taecker?.toast?.(error.message || "게시글 수정에 실패했습니다.");

    }

    finally{

        postBusy=false;

    }

});

/* ---------- COMMENTS ---------- */

function commentItemHTML(comment){

    const nickname=escapeHtml(comment.nickname || "익명");

    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-item-head">
                <span class="comment-item-author">${nickname}</span>
                <span class="comment-item-time">${timeAgo(comment.created_at)}</span>
                <button type="button" class="comment-item-delete" data-delete-id="${comment.id}">삭제</button>
                <button type="button" class="comment-item-report" data-report-comment-id="${comment.id}">신고</button>
            </div>
            <div class="comment-item-content">${escapeHtml(comment.content)}</div>
        </div>
    `;

}

async function loadComments(){

    const client=getClient();

    if(!client || !el.commentList) return;

    try{

        const {data,error}=await client
            .from("comments")
            .select("id,content,created_at,nickname")
            .eq("post_id",postId)
            .order("created_at",{ascending:true});

        if(error) throw error;

        if(!data || data.length===0){

            el.commentList.innerHTML=`<div class="comment-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</div>`;

            return;

        }

        el.commentList.innerHTML=data.map((c)=>commentItemHTML(c)).join("");

    }

    catch(error){

        console.warn("댓글을 불러오지 못했습니다:",error.message || error);

        el.commentList.innerHTML=`<div class="comment-empty">댓글을 불러오지 못했습니다.</div>`;

    }

}

el.commentList?.addEventListener("click",async(e)=>{

    const reportBtn=e.target.closest("[data-report-comment-id]");

    if(reportBtn){

        openReportModal("comment",reportBtn.dataset.reportCommentId,"이 댓글을 신고합니다.");

        return;

    }

    const btn=e.target.closest("[data-delete-id]");

    if(!btn || !window.AnonAPI) return;

    const commentId=btn.dataset.deleteId;

    let password="";

    if(!state.isAdmin){

        const answer=await askDialog({
            title:"댓글 삭제",
            desc:"댓글을 쓸 때 정한 비밀번호를 입력해주세요.",
            fields:[{key:"password",label:"비밀번호",type:"password",max:30}],
            okText:"삭제"
        });

        if(!answer) return;

        password=answer.password;

    }

    try{

        const status=await window.AnonAPI.deleteComment(commentId,password);

        if(status!=="ok"){

            window.Taecker?.toast?.(window.AnonAPI.explainStatus(status));

            return;

        }

        btn.closest(".comment-item")?.remove();

        if(!el.commentList.querySelector(".comment-item")){

            el.commentList.innerHTML=`<div class="comment-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</div>`;

        }

        const remaining=el.commentList.querySelectorAll(".comment-item").length;

        if(el.commentCountText) el.commentCountText.textContent=`댓글 ${remaining}`;
        if(el.commentSectionCount) el.commentSectionCount.textContent=`(${remaining})`;

    }

    catch(error){

        console.error("댓글 삭제 실패:",error.message || error);

        window.Taecker?.toast?.(error.message || "댓글 삭제에 실패했습니다.");

    }

});

el.commentForm?.addEventListener("submit",async(event)=>{

    event.preventDefault();

    const content=el.commentInput?.value.trim();
    const nickname=el.commentNickname?.value.trim() || "태성인";
    const password=el.commentPassword?.value || "";

    if(password.length<4){ window.Taecker?.toast?.("비밀번호는 4자 이상 입력해주세요."); el.commentPassword?.focus(); return; }
    if(!content){ el.commentInput?.focus(); return; }

    if(!window.AnonAPI) return;

    if(el.commentSubmitBtn) el.commentSubmitBtn.disabled=true;

    try{

        await window.AnonAPI.createComment({postId,nickname,password,content});

        window.AnonAPI.saveNick(nickname);

        el.commentInput.value="";

        await loadComments();

        const total=el.commentList.querySelectorAll(".comment-item").length;

        if(el.commentCountText) el.commentCountText.textContent=`댓글 ${total}`;
        if(el.commentSectionCount) el.commentSectionCount.textContent=`(${total})`;

    }

    catch(error){

        console.error("댓글 등록 실패:",error.message || error);

        window.Taecker?.toast?.(error.message || "댓글 등록에 실패했습니다.");

    }

    finally{

        if(el.commentSubmitBtn) el.commentSubmitBtn.disabled=false;

    }

});

/* ---------- REPORT ---------- */

function openReportModal(targetType,targetId,label){

    state.reportTarget={targetType,targetId};

    if(el.reportModalTarget) el.reportModalTarget.textContent=label;
    if(el.reportReason) el.reportReason.value="";
    if(el.reportFormMessage) el.reportFormMessage.textContent="";

    window.Taecker?.openModal?.("reportModal");

}

function closeReportModal(){

    window.Taecker?.closeModal?.("reportModal");

    state.reportTarget=null;

}

el.reportPostBtn?.addEventListener("click",()=>{

    if(!postId) return;

    openReportModal("post",postId,"이 게시글을 신고합니다.");

});

el.reportCancelBtn?.addEventListener("click",closeReportModal);

el.reportModal?.addEventListener("click",(e)=>{

    if(e.target===el.reportModal) closeReportModal();

});

el.reportForm?.addEventListener("submit",async(event)=>{

    event.preventDefault();

    if(!state.reportTarget) return;

    const reason=el.reportReason?.value.trim();

    if(!reason){

        if(el.reportFormMessage){

            el.reportFormMessage.textContent="신고 사유를 입력해주세요.";
            el.reportFormMessage.style.color="#DC2626";

        }

        el.reportReason?.focus();

        return;

    }

    if(!window.AnonAPI) return;

    if(el.reportSubmitBtn) el.reportSubmitBtn.disabled=true;

    try{

        await window.AnonAPI.submitReport({
            targetType:state.reportTarget.targetType,
            targetId:state.reportTarget.targetId,
            reason
        });

        window.Taecker?.toast?.("신고가 접수되었습니다.");

        closeReportModal();

    }

    catch(error){

        console.error("신고 접수 실패:",error.message || error);

        if(el.reportFormMessage){

            el.reportFormMessage.textContent=error.message || "신고 접수에 실패했습니다. 잠시 후 다시 시도해주세요.";
            el.reportFormMessage.style.color="#DC2626";

        }

    }

    finally{

        if(el.reportSubmitBtn) el.reportSubmitBtn.disabled=false;

    }

});

/* ---------- INIT ---------- */

window.addEventListener("load",async()=>{

    await checkAdmin();

    if(el.commentNickname && window.AnonAPI) el.commentNickname.value=window.AnonAPI.getSavedNick() || "태성인";

    loadPost();

});

})();
