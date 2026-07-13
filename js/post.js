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

    deletePostBtn:document.getElementById("deletePostBtn"),
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

    grade1:"학년별 게시판",
    grade2:"학년별 게시판",
    grade3:"학년별 게시판"

};

const params=new URLSearchParams(location.search);
const postId=params.get("id");

const state={

    post:null,
    liked:false,
    currentUser:null,
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
            .select("id,title,content,category,view_count,like_count,comment_count,created_at,author_id,profiles(nickname)")
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

        await refreshDeletePermission();

    }

    catch(error){

        console.warn("삭제 권한을 확인하지 못했습니다:",error.message || error);

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

    const nickname=post.profiles?.nickname || "익명";

    if(el.categoryBadge) el.categoryBadge.textContent=CATEGORY_LABEL[post.category] || "일반";
    if(el.title) el.title.textContent=post.title;
    if(el.author) el.author.textContent=nickname;
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

    const client=getClient();

    if(!client || !window.Auth) return;

    const user=await window.Auth.getCurrentUser();

    state.currentUser=user;

    if(!user){

        state.liked=false;
        updateLikeButton();
        return;

    }

    const {data}=await client
        .from("likes")
        .select("user_id")
        .eq("post_id",postId)
        .eq("user_id",user.id)
        .maybeSingle();

    state.liked=!!data;

    updateLikeButton();

}

function updateLikeButton(){

    if(!el.likeBtn) return;

    el.likeBtn.classList.toggle("active",state.liked);
    el.likeBtn.setAttribute("aria-pressed",String(state.liked));

    if(el.likeIcon) el.likeIcon.textContent=state.liked ? "❤️" : "🤍";

}

let likeBusy=false;

el.likeBtn?.addEventListener("click",async()=>{

    if(likeBusy) return;

    const client=getClient();

    if(!client || !window.Auth) return;

    const user=state.currentUser || await window.Auth.getCurrentUser();

    if(!user){

        window.Taecker?.toast?.("로그인이 필요합니다.");

        setTimeout(()=>{ location.href="login.html"; },600);

        return;

    }

    likeBusy=true;

    /* 낙관적 업데이트 */

    const wasLiked=state.liked;

    state.liked=!wasLiked;
    updateLikeButton();

    if(el.likeCount){

        const current=Number(el.likeCount.textContent) || 0;

        el.likeCount.textContent=wasLiked ? Math.max(current-1,0) : current+1;

    }

    try{

        if(wasLiked){

            const {error}=await client
                .from("likes")
                .delete()
                .eq("post_id",postId)
                .eq("user_id",user.id);

            if(error) throw error;

        }else{

            const {error}=await client
                .from("likes")
                .insert({post_id:postId,user_id:user.id});

            if(error) throw error;

        }

    }

    catch(error){

        console.error("좋아요 처리 실패:",error.message || error);

        /* 실패 시 롤백 */

        state.liked=wasLiked;
        updateLikeButton();

        if(el.likeCount){

            const current=Number(el.likeCount.textContent) || 0;

            el.likeCount.textContent=wasLiked ? current+1 : Math.max(current-1,0);

        }

        window.Taecker?.toast?.("좋아요 처리에 실패했습니다.");

    }

    finally{

        likeBusy=false;

    }

});

/* ---------- DELETE POST ---------- */

async function refreshDeletePermission(){

    if(!el.deletePostBtn) return;

    if(!state.currentUser || !state.post){

        el.deletePostBtn.classList.add("hidden");
        return;

    }

    const isOwner=state.post.author_id && state.post.author_id===state.currentUser.id;

    let isAdmin=false;

    if(!isOwner && window.Auth?.getProfile){

        try{

            const profile=await window.Auth.getProfile();

            isAdmin=!!profile?.is_admin;

        }

        catch(error){

            console.warn("관리자 여부를 확인하지 못했습니다:",error.message || error);

        }

    }

    el.deletePostBtn.classList.toggle("hidden",!(isOwner || isAdmin));

}

let deleteBusy=false;

el.deletePostBtn?.addEventListener("click",async()=>{

    if(deleteBusy || !postId) return;

    const confirmDelete=confirm("게시글을 삭제하시겠습니까? 삭제하면 복구할 수 없습니다.");

    if(!confirmDelete) return;

    const client=getClient();

    if(!client) return;

    deleteBusy=true;
    el.deletePostBtn.disabled=true;

    try{

        const {error}=await client
            .from("posts")
            .delete()
            .eq("id",postId);

        if(error) throw error;

        window.Taecker?.toast?.("게시글이 삭제되었습니다.");

        setTimeout(()=>{ location.href="board.html"; },500);

    }

    catch(error){

        console.error("게시글 삭제 실패:",error.message || error);

        window.Taecker?.toast?.("게시글 삭제에 실패했습니다.");

        deleteBusy=false;
        el.deletePostBtn.disabled=false;

    }

});

/* ---------- COMMENTS ---------- */

function commentItemHTML(comment,currentUserId){

    const nickname=escapeHtml(comment.profiles?.nickname || "익명");
    const isOwn=currentUserId && comment.author_id===currentUserId;

    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-item-head">
                <span class="comment-item-author">${nickname}</span>
                <span class="comment-item-time">${timeAgo(comment.created_at)}</span>
                ${isOwn
                    ? `<button type="button" class="comment-item-delete" data-delete-id="${comment.id}">삭제</button>`
                    : `<button type="button" class="comment-item-report" data-report-comment-id="${comment.id}" data-report-author-id="${comment.author_id || ""}">신고</button>`}
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
            .select("id,content,created_at,author_id,profiles(nickname)")
            .eq("post_id",postId)
            .order("created_at",{ascending:true});

        if(error) throw error;

        if(!data || data.length===0){

            el.commentList.innerHTML=`<div class="comment-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</div>`;

            return;

        }

        const currentUserId=state.currentUser?.id || null;

        el.commentList.innerHTML=data.map((c)=>commentItemHTML(c,currentUserId)).join("");

    }

    catch(error){

        console.warn("댓글을 불러오지 못했습니다:",error.message || error);

        el.commentList.innerHTML=`<div class="comment-empty">댓글을 불러오지 못했습니다.</div>`;

    }

}

el.commentList?.addEventListener("click",async(e)=>{

    const reportBtn=e.target.closest("[data-report-comment-id]");

    if(reportBtn){

        openReportModal("comment",reportBtn.dataset.reportCommentId,"이 댓글을 신고합니다.",reportBtn.dataset.reportAuthorId || null);

        return;

    }

    const btn=e.target.closest("[data-delete-id]");

    if(!btn) return;

    const commentId=btn.dataset.deleteId;

    const confirmDelete=confirm("댓글을 삭제하시겠습니까?");

    if(!confirmDelete) return;

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from("comments")
            .delete()
            .eq("id",commentId);

        if(error) throw error;

        btn.closest(".comment-item")?.remove();

        if(!el.commentList.querySelector(".comment-item")){

            el.commentList.innerHTML=`<div class="comment-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</div>`;

        }

        /* 댓글 수 텍스트 갱신 (트리거가 DB의 comment_count는 알아서 줄여줌) */

        const remaining=el.commentList.querySelectorAll(".comment-item").length;

        if(el.commentCountText) el.commentCountText.textContent=`댓글 ${remaining}`;
        if(el.commentSectionCount) el.commentSectionCount.textContent=`(${remaining})`;

    }

    catch(error){

        console.error("댓글 삭제 실패:",error.message || error);

        window.Taecker?.toast?.("댓글 삭제에 실패했습니다.");

    }

});

el.commentForm?.addEventListener("submit",async(event)=>{

    event.preventDefault();

    const content=el.commentInput?.value.trim();

    if(!content){

        el.commentInput?.focus();

        return;

    }

    const client=getClient();

    if(!client || !window.Auth) return;

    const user=state.currentUser || await window.Auth.getCurrentUser();

    if(!user){

        window.Taecker?.toast?.("로그인이 필요합니다.");

        setTimeout(()=>{ location.href="login.html"; },600);

        return;

    }

    if(el.commentSubmitBtn) el.commentSubmitBtn.disabled=true;

    try{

        const {error}=await client
            .from("comments")
            .insert({

                post_id:postId,
                author_id:user.id,
                content

            });

        if(error) throw error;

        el.commentInput.value="";

        await loadComments();

        const total=el.commentList.querySelectorAll(".comment-item").length;

        if(el.commentCountText) el.commentCountText.textContent=`댓글 ${total}`;
        if(el.commentSectionCount) el.commentSectionCount.textContent=`(${total})`;

    }

    catch(error){

        console.error("댓글 등록 실패:",error.message || error);

        window.Taecker?.toast?.("댓글 등록에 실패했습니다.");

    }

    finally{

        if(el.commentSubmitBtn) el.commentSubmitBtn.disabled=false;

    }

});

/* ---------- REPORT ---------- */

function openReportModal(targetType,targetId,label,targetUserId){

    state.reportTarget={targetType,targetId,targetUserId:targetUserId || null};

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

    openReportModal("post",postId,"이 게시글을 신고합니다.",state.post?.author_id);

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

    const client=getClient();

    if(!client || !window.Auth) return;

    const user=state.currentUser || await window.Auth.getCurrentUser();

    if(!user){

        window.Taecker?.toast?.("로그인이 필요합니다.");

        setTimeout(()=>{ location.href="login.html"; },600);

        return;

    }

    if(state.reportTarget.targetUserId && state.reportTarget.targetUserId===user.id){

        if(el.reportFormMessage){

            el.reportFormMessage.textContent="본인이 작성한 글/댓글은 신고할 수 없습니다.";
            el.reportFormMessage.style.color="#DC2626";

        }

        return;

    }

    if(el.reportSubmitBtn) el.reportSubmitBtn.disabled=true;

    try{

        const {error}=await client
            .from("reports")
            .insert({

                reporter_id:user.id,
                target_type:state.reportTarget.targetType,
                target_id:state.reportTarget.targetId,
                target_user_id:state.reportTarget.targetUserId,
                reason

            });

        if(error) throw error;

        window.Taecker?.toast?.("신고가 접수되었습니다.");

        closeReportModal();

    }

    catch(error){

        console.error("신고 접수 실패:",error.message || error);

        if(el.reportFormMessage){

            el.reportFormMessage.textContent="신고 접수에 실패했습니다. 잠시 후 다시 시도해주세요.";
            el.reportFormMessage.style.color="#DC2626";

        }

    }

    finally{

        if(el.reportSubmitBtn) el.reportSubmitBtn.disabled=false;

    }

});

/* ---------- INIT ---------- */

window.addEventListener("load",()=>{

    loadPost();

});

})();
