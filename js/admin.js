/* =====================================================
   TAECKER ADMIN
   admin.html 전용 - 신고 내역 / 게시글·댓글 관리 / 공지사항 / 문의 답변 / 학교설정
   (비로그인 운영 구조: 일반 회원 계정은 없고, 관리자만 로그인한다)
   접근 가능 대상: profiles.is_admin = true 인 계정만
===================================================== */

"use strict";

(function(){

const el={

    denied:document.getElementById("adminDenied"),
    deniedText:document.getElementById("adminDeniedText"),
    wrap:document.getElementById("adminWrap"),

    mainTabs:document.querySelectorAll(".admin-tabs")[0]?.querySelectorAll(".admin-tab"),

    panels:{
        reports:document.getElementById("panelReports"),
        posts:document.getElementById("panelPosts"),
        notices:document.getElementById("panelNotices"),
        inquiries:document.getElementById("panelInquiries"),
        school:document.getElementById("panelSchool")
    },

    statusTabs:document.querySelectorAll("#panelReports .admin-tab"),
    reportList:document.getElementById("reportList"),

    postList:document.getElementById("postList"),
    postRefreshBtn:document.getElementById("postRefreshBtn"),
    postMoreBtn:document.getElementById("postMoreBtn"),

    noticeTitleInput:document.getElementById("noticeTitleInput"),
    noticeContentInput:document.getElementById("noticeContentInput"),
    noticeSaveDraftBtn:document.getElementById("noticeSaveDraftBtn"),
    noticePublishBtn:document.getElementById("noticePublishBtn"),
    noticeList:document.getElementById("noticeList"),

    inquiryStatusTabs:document.querySelectorAll("#panelInquiries .admin-tab"),
    inquiryList:document.getElementById("inquiryList"),

    schoolApiKeyInput:document.getElementById("schoolApiKeyInput"),
    schoolNameInput:document.getElementById("schoolNameInput"),
    schoolSearchBtn:document.getElementById("schoolSearchBtn"),
    schoolSearchResult:document.getElementById("schoolSearchResult"),
    schoolOfficeCodeInput:document.getElementById("schoolOfficeCodeInput"),
    schoolCodeInput:document.getElementById("schoolCodeInput"),
    schoolConfigSaveBtn:document.getElementById("schoolConfigSaveBtn"),
    schoolConfigStatus:document.getElementById("schoolConfigStatus")

};

if(!el.wrap) return;

const TARGET_LABEL={
    post:"게시글",
    comment:"댓글"
};

const CATEGORY_LABEL={
    notice:"공지",
    free:"자유",
    question:"질문",
    info:"정보",
    grade1:"1학년",
    grade2:"2학년",
    grade3:"3학년"
};

const POSTS_PAGE_SIZE=30;

let adminId=null;

let statusFilter="pending";
let inquiryStatusFilter="pending";

let postsLoaded=0;

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

function truncate(str,len){

    const text=String(str ?? "").trim();

    return text.length>len ? text.slice(0,len)+"…" : text;

}

function getClient(){

    return window.sb || null;

}

function toast(message){

    window.Taecker?.toast?.(message);

}

/* ---------- 접근 제어 ---------- */

async function guard(){

    if(!window.Auth){

        el.deniedText.textContent="인증 모듈을 불러오지 못했습니다. 새로고침 해주세요.";
        return false;

    }

    /* 관리자가 아니면 requireAuth()가 안내 토스트를 띄우고 login.html 로 보낸다 */

    const ok=await window.Auth.requireAuth();

    if(!ok){

        el.deniedText.textContent="관리자 로그인이 필요합니다. 잠시 후 로그인 페이지로 이동합니다.";

        return false;

    }

    const user=await window.Auth.getCurrentUser();
    const profile=await window.Auth.getProfile();

    if(!user || !profile?.is_admin){

        el.deniedText.textContent="관리자만 접근할 수 있는 페이지입니다.";

        return false;

    }

    return {user,profile};

}

/* ---------- 신고 내역 ---------- */

/* 신고 대상(글/댓글)의 현재 내용을 한 번에 조회해서 미리보기에 쓴다 */

async function fetchReportTargets(reports){

    const client=getClient();

    const posts=new Map();
    const comments=new Map();

    if(!client) return {posts,comments};

    const postIds=[...new Set(reports.filter((r)=>r.target_type==="post").map((r)=>r.target_id))];
    const commentIds=[...new Set(reports.filter((r)=>r.target_type==="comment").map((r)=>r.target_id))];

    try{

        if(postIds.length){

            const {data}=await client
                .from("posts")
                .select("id,title,content,nickname,category,source_notice_id")
                .in("id",postIds);

            (data || []).forEach((p)=>posts.set(p.id,p));

        }

        if(commentIds.length){

            const {data}=await client
                .from("comments")
                .select("id,post_id,content,nickname")
                .in("id",commentIds);

            (data || []).forEach((c)=>comments.set(c.id,c));

        }

    }

    catch(error){

        console.warn("신고 대상을 불러오지 못했습니다:",error.message || error);

    }

    return {posts,comments};

}

function reportItemHTML(report,targets){

    const targetLabel=TARGET_LABEL[report.target_type] || report.target_type;

    const statusClass=
        report.status==="resolved" ? "status-resolved" :
        report.status==="rejected" ? "status-rejected" : "status-pending";

    const statusText=
        report.status==="resolved" ? "처리완료" :
        report.status==="rejected" ? "반려됨" : "대기중";

    const isPost=report.target_type==="post";

    const target=isPost
        ? targets.posts.get(report.target_id)
        : targets.comments.get(report.target_id);

    const viewPostId=isPost ? report.target_id : target?.post_id;

    let previewHTML;

    if(!target){

        previewHTML=`<div class="admin-preview admin-preview-gone">이미 삭제된 ${targetLabel}입니다.</div>`;

    }else if(isPost){

        previewHTML=`
            <div class="admin-preview">
                <strong>${escapeHtml(truncate(target.title,80))}</strong>
                <span class="admin-item-sub"> · ${escapeHtml(target.nickname || "익명")}</span>
                <div style="margin-top:6px;">${escapeHtml(truncate(target.content,200))}</div>
            </div>
        `;

    }else{

        previewHTML=`
            <div class="admin-preview">
                <span class="admin-item-sub">${escapeHtml(target.nickname || "익명")}</span>
                <div style="margin-top:6px;">${escapeHtml(truncate(target.content,200))}</div>
            </div>
        `;

    }

    /* 공지에서 동기화된 글은 여기서 지울 수 없다(공지사항 탭에서 삭제) */

    const isNoticePost=isPost && !!target?.source_notice_id;

    const deleteTargetButton = !target ? "" :
        isNoticePost
            ? `<span class="admin-item-sub">공지에서 만들어진 글이라 공지사항 탭에서 삭제해주세요.</span>`
            : `<button class="btn-danger" data-action="delete-report-target" data-report="${report.id}" data-type="${report.target_type}" data-target="${report.target_id}">${targetLabel} 삭제</button>`;

    const viewLink=viewPostId
        ? `<a class="btn" href="post.html?id=${encodeURIComponent(viewPostId)}" target="_blank" rel="noopener">원문 보기</a>`
        : "";

    const resolveButtons=report.status==="pending" ? `
        <button class="btn-ok" data-action="resolve" data-report="${report.id}">처리완료로 표시</button>
        <button data-action="reject" data-report="${report.id}">반려</button>
    ` : `<button class="btn-danger" data-action="delete-report" data-report="${report.id}">신고 삭제</button>`;

    return `
        <div class="admin-item" data-report-id="${report.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">[${targetLabel}] ${escapeHtml(report.reason)}</div>
                    <div class="admin-item-sub">익명 신고 · ${timeAgo(report.created_at)}</div>
                </div>
                <span class="status-pill ${statusClass}">${statusText}</span>
            </div>
            ${previewHTML}
            <div class="admin-actions">
                ${viewLink}
                ${deleteTargetButton}
                ${resolveButtons}
            </div>
        </div>
    `;

}

async function loadReports(){

    const client=getClient();

    if(!client || !el.reportList) return;

    el.reportList.innerHTML=`<div class="admin-empty">불러오는 중...</div>`;

    try{

        let query=client
            .from("reports")
            .select("id,target_type,target_id,reason,status,created_at")
            .order("created_at",{ascending:false});

        if(statusFilter!=="all"){

            query=query.eq("status",statusFilter);

        }

        const {data,error}=await query;

        if(error) throw error;

        if(!data || data.length===0){

            el.reportList.innerHTML=`<div class="admin-empty">해당 조건의 신고 내역이 없습니다.</div>`;

            return;

        }

        const targets=await fetchReportTargets(data);

        el.reportList.innerHTML=data.map((report)=>reportItemHTML(report,targets)).join("");

    }

    catch(error){

        console.warn("신고 내역을 불러오지 못했습니다:",error.message || error);

        el.reportList.innerHTML=`<div class="admin-empty">신고 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>`;

    }

}

async function updateReportStatus(reportId,status,silent){

    const client=getClient();

    if(!client || !reportId) return false;

    try{

        const {error}=await client
            .from("reports")
            .update({

                status,
                resolved_at:new Date().toISOString(),
                resolved_by:adminId

            })
            .eq("id",reportId);

        if(error) throw error;

        if(!silent) toast(status==="resolved" ? "처리완료로 표시했습니다." : "반려 처리했습니다.");

        await loadReports();

        return true;

    }

    catch(error){

        console.warn("신고 상태 변경에 실패했습니다:",error.message || error);

        toast("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");

        return false;

    }

}

/* 신고된 글/댓글을 삭제하고, 해당 신고는 처리완료로 표시한다 */

async function deleteReportTarget(reportId,type,targetId){

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from(type==="post" ? "posts" : "comments")
            .delete()
            .eq("id",targetId);

        if(error) throw error;

        toast(`${TARGET_LABEL[type] || "대상"}을 삭제했습니다.`);

        await updateReportStatus(reportId,"resolved",true);

    }

    catch(error){

        console.warn("신고 대상 삭제에 실패했습니다:",error.message || error);

        toast("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

/* 처리완료/반려된 신고 내역 삭제 */

async function deleteReport(reportId){

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from("reports")
            .delete()
            .eq("id",reportId);

        if(error) throw error;

        toast("신고 내역을 삭제했습니다.");

        await loadReports();

    }

    catch(error){

        console.warn("신고 삭제에 실패했습니다:",error.message || error);

        toast("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

/* ---------- 게시글 관리 ---------- */

function postItemHTML(post){

    const category=CATEGORY_LABEL[post.category] || "일반";
    const isNoticePost=!!post.source_notice_id;

    const deleteButton=isNoticePost
        ? `<span class="admin-item-sub">공지사항 탭에서 관리</span>`
        : `<button class="btn-danger" data-action="delete-post" data-post="${post.id}">글 삭제</button>`;

    return `
        <div class="admin-item" data-post-id="${post.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">[${escapeHtml(category)}] ${escapeHtml(truncate(post.title,80))}</div>
                    <div class="admin-item-sub">
                        ${escapeHtml(post.nickname || "익명")} · ${timeAgo(post.created_at)}
                        · 조회 ${post.view_count ?? 0} · 추천 ${post.like_count ?? 0}
                        · 댓글 <span data-role="comment-count">${post.comment_count ?? 0}</span>
                    </div>
                </div>
            </div>
            <div class="admin-actions">
                <a class="btn" href="post.html?id=${encodeURIComponent(post.id)}" target="_blank" rel="noopener">원문 보기</a>
                <button data-action="post-comments-toggle" data-post="${post.id}">댓글 보기</button>
                ${deleteButton}
            </div>
            <div class="admin-comments hidden" data-role="post-comments"></div>
        </div>
    `;

}

async function loadPosts(append){

    const client=getClient();

    if(!client || !el.postList) return;

    if(!append){

        postsLoaded=0;

        el.postList.innerHTML=`<div class="admin-empty">불러오는 중...</div>`;

    }

    if(el.postMoreBtn) el.postMoreBtn.disabled=true;

    try{

        const {data,error}=await client
            .from("posts")
            .select("id,title,category,nickname,created_at,view_count,like_count,comment_count,source_notice_id")
            .order("created_at",{ascending:false})
            .range(postsLoaded,postsLoaded+POSTS_PAGE_SIZE-1);

        if(error) throw error;

        const rows=data || [];

        if(!append) el.postList.innerHTML="";

        if(rows.length===0 && !append){

            el.postList.innerHTML=`<div class="admin-empty">등록된 게시글이 없습니다.</div>`;

        }else{

            el.postList.insertAdjacentHTML("beforeend",rows.map(postItemHTML).join(""));

        }

        postsLoaded+=rows.length;

        el.postMoreBtn?.classList.toggle("hidden",rows.length<POSTS_PAGE_SIZE);

    }

    catch(error){

        console.warn("게시글을 불러오지 못했습니다:",error.message || error);

        if(!append){

            el.postList.innerHTML=`<div class="admin-empty">게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>`;

        }

    }

    finally{

        if(el.postMoreBtn) el.postMoreBtn.disabled=false;

    }

}

async function deletePost(postId){

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from("posts")
            .delete()
            .eq("id",postId);

        if(error) throw error;

        toast("게시글을 삭제했습니다.");

        el.postList?.querySelector(`[data-post-id="${CSS.escape(String(postId))}"]`)?.remove();

        postsLoaded=Math.max(0,postsLoaded-1);

        if(!el.postList?.querySelector(".admin-item")){

            el.postList.innerHTML=`<div class="admin-empty">등록된 게시글이 없습니다.</div>`;

        }

    }

    catch(error){

        console.warn("게시글 삭제에 실패했습니다:",error.message || error);

        toast("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

function commentRowHTML(comment,postId){

    return `
        <div class="admin-preview" data-comment-id="${comment.id}">
            <span class="admin-item-sub">${escapeHtml(comment.nickname || "익명")} · ${timeAgo(comment.created_at)}</span>
            <div style="margin-top:4px;white-space:pre-wrap;">${escapeHtml(comment.content)}</div>
            <div class="admin-actions" style="margin-top:6px;">
                <button class="btn-danger" data-action="delete-comment" data-comment="${comment.id}" data-post="${postId}">댓글 삭제</button>
            </div>
        </div>
    `;

}

async function loadPostComments(postId,container){

    const client=getClient();

    if(!client || !container) return;

    container.innerHTML=`<div class="admin-item-sub">불러오는 중...</div>`;

    try{

        const {data,error}=await client
            .from("comments")
            .select("id,nickname,content,created_at")
            .eq("post_id",postId)
            .order("created_at",{ascending:true});

        if(error) throw error;

        if(!data || data.length===0){

            container.innerHTML=`<div class="admin-item-sub">댓글이 없습니다.</div>`;

            return;

        }

        container.innerHTML=data.map((comment)=>commentRowHTML(comment,postId)).join("");

    }

    catch(error){

        console.warn("댓글을 불러오지 못했습니다:",error.message || error);

        container.innerHTML=`<div class="admin-item-sub">댓글을 불러오지 못했습니다.</div>`;

    }

}

async function deleteComment(commentId,postId,btn){

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from("comments")
            .delete()
            .eq("id",commentId);

        if(error) throw error;

        toast("댓글을 삭제했습니다.");

        const item=btn?.closest(".admin-item");
        const container=item?.querySelector('[data-role="post-comments"]');
        const countEl=item?.querySelector('[data-role="comment-count"]');

        if(countEl) countEl.textContent=String(Math.max(0,(Number(countEl.textContent)||0)-1));

        if(container) await loadPostComments(postId,container);

    }

    catch(error){

        console.warn("댓글 삭제에 실패했습니다:",error.message || error);

        toast("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

/* ---------- 문의하기 ---------- */

function inquiryItemHTML(inquiry){

    const answered=inquiry.status==="answered";

    const authorName=inquiry.nickname ? escapeHtml(inquiry.nickname) : "익명";

    const metaParts=[];

    if(inquiry.contact) metaParts.push(`연락처: ${escapeHtml(inquiry.contact)}`);
    if(inquiry.receipt_code) metaParts.push(`접수번호: ${escapeHtml(inquiry.receipt_code)}`);

    metaParts.push(timeAgo(inquiry.created_at));

    return `
        <div class="admin-item" data-inquiry-id="${inquiry.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">${authorName}</div>
                    <div class="admin-item-sub">${metaParts.join(" · ")}</div>
                </div>
                <span class="status-pill ${answered ? "status-resolved" : "status-pending"}">${answered ? "답변완료" : "답변대기"}</span>
            </div>
            <div class="admin-item-sub" style="white-space:pre-wrap;margin-bottom:10px;color:var(--text);">${escapeHtml(inquiry.content)}</div>
            ${answered ? `
                <div class="admin-memo-row" style="margin-bottom:6px;">
                    <div style="flex:1;min-width:160px;padding:9px 12px;border-radius:10px;background:var(--background);font-size:13px;white-space:pre-wrap;">${escapeHtml(inquiry.admin_reply || "")}</div>
                </div>
                <div class="admin-actions">
                    <button data-action="inquiry-reply-toggle" data-inquiry="${inquiry.id}">답변 수정</button>
                </div>
                <div class="admin-memo-row hidden" data-role="inquiry-reply-row">
                    <textarea class="input" data-role="inquiry-reply-input" rows="3" maxlength="1000" placeholder="답변을 입력하세요">${escapeHtml(inquiry.admin_reply || "")}</textarea>
                    <button class="btn-ok" data-action="inquiry-reply-save" data-inquiry="${inquiry.id}">저장</button>
                </div>
            ` : `
                <div class="admin-memo-row" data-role="inquiry-reply-row">
                    <textarea class="input" data-role="inquiry-reply-input" rows="3" maxlength="1000" placeholder="답변을 입력하세요 (문의자는 접수번호로 확인해요)"></textarea>
                    <button class="btn-ok" data-action="inquiry-reply-save" data-inquiry="${inquiry.id}">답변 등록</button>
                </div>
            `}
        </div>
    `;

}

async function loadInquiries(){

    const client=getClient();

    if(!client || !el.inquiryList) return;

    el.inquiryList.innerHTML=`<div class="admin-empty">불러오는 중...</div>`;

    try{

        let query=client
            .from("inquiries")
            .select("id,content,status,admin_reply,created_at,nickname,contact,receipt_code")
            .order("created_at",{ascending:false});

        if(inquiryStatusFilter!=="all"){

            query=query.eq("status",inquiryStatusFilter);

        }

        const {data,error}=await query;

        if(error) throw error;

        if(!data || data.length===0){

            el.inquiryList.innerHTML=`<div class="admin-empty">해당 조건의 문의가 없습니다.</div>`;

            return;

        }

        el.inquiryList.innerHTML=data.map(inquiryItemHTML).join("");

    }

    catch(error){

        console.warn("문의 목록을 불러오지 못했습니다:",error.message || error);

        el.inquiryList.innerHTML=`<div class="admin-empty">문의 목록을 불러오지 못했습니다.</div>`;

    }

}

async function replyToInquiry(inquiryId,replyText){

    const client=getClient();

    if(!client) return false;

    try{

        const {error}=await client
            .from("inquiries")
            .update({

                admin_reply:replyText,
                status:"answered",
                replied_at:new Date().toISOString(),
                replied_by:adminId

            })
            .eq("id",inquiryId);

        if(error) throw error;

        toast("답변이 등록되었습니다.");

        await loadInquiries();

        return true;

    }

    catch(error){

        console.error("답변 등록 실패:",error.message || error);

        toast("답변 등록에 실패했습니다.");

        return false;

    }

}

/* ---------- 공지사항 (전체공개 공지만) ---------- */

function noticeItemHTML(notice){

    const statusHTML=notice.is_published
        ? `<span class="status-pill status-resolved">배포됨</span>`
        : `<span class="status-pill status-pending">임시저장</span>`;

    const dateLabel=notice.is_published
        ? `배포일시 ${new Date(notice.published_at).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}`
        : `작성일시 ${new Date(notice.created_at).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}`;

    return `
        <div class="admin-item" data-notice-id="${notice.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">${escapeHtml(notice.title)}</div>
                    <div class="admin-item-sub">${dateLabel}</div>
                </div>
                ${statusHTML}
            </div>
            <div class="admin-item-sub" style="white-space:pre-wrap;margin-bottom:6px;">${escapeHtml(notice.content)}</div>
            <div class="admin-actions">
                ${
                    notice.is_published
                        ? `<button data-action="unpublish-notice" data-notice="${notice.id}">배포 취소</button>`
                        : `<button class="btn-ok" data-action="publish-notice" data-notice="${notice.id}">배포하기</button>`
                }
                <button class="btn-danger" data-action="delete-notice" data-notice="${notice.id}">삭제</button>
            </div>
        </div>
    `;

}

async function loadNotices(){

    const client=getClient();

    if(!client || !el.noticeList) return;

    el.noticeList.innerHTML=`<div class="admin-empty">불러오는 중...</div>`;

    try{

        const {data,error}=await client
            .from("notices")
            .select("id,title,content,is_published,created_at,published_at,created_by")
            .is("target_user_id",null)
            .order("created_at",{ascending:false})
            .limit(50);

        if(error) throw error;

        if(!data || data.length===0){

            el.noticeList.innerHTML=`<div class="admin-empty">등록된 공지사항이 없습니다.</div>`;

            return;

        }

        el.noticeList.innerHTML=data.map(noticeItemHTML).join("");

    }

    catch(error){

        console.warn("공지사항을 불러오지 못했습니다:",error.message || error);

        el.noticeList.innerHTML=`<div class="admin-empty">공지사항을 불러오지 못했습니다. (notices 테이블이 아직 없다면 sql/notice_setup.sql을 먼저 실행해주세요)</div>`;

    }

}

async function createNotice(publish){

    const client=getClient();

    if(!client) return;

    const title=el.noticeTitleInput?.value.trim();
    const content=el.noticeContentInput?.value.trim();

    if(!title || !content){

        toast("제목과 내용을 모두 입력해주세요.");

        return;

    }

    const payload={
        title,
        content,
        created_by:adminId,
        is_published:publish,
        published_at:publish ? new Date().toISOString() : null
    };

    try{

        const {error}=await client
            .from("notices")
            .insert(payload);

        if(error) throw error;

        toast(publish ? "공지사항을 배포했습니다." : "임시저장했습니다.");

        el.noticeTitleInput.value="";
        el.noticeContentInput.value="";

        await loadNotices();

    }

    catch(error){

        console.warn("공지사항 등록에 실패했습니다:",error.message || error);

        toast("등록에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

async function setNoticePublished(noticeId,publish){

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from("notices")
            .update({
                is_published:publish,
                published_at:publish ? new Date().toISOString() : null
            })
            .eq("id",noticeId);

        if(error) throw error;

        toast(publish ? "공지사항을 배포했습니다." : "배포를 취소했습니다.");

        await loadNotices();

    }

    catch(error){

        console.warn("공지사항 상태 변경에 실패했습니다:",error.message || error);

        toast("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

async function deleteNotice(noticeId){

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from("notices")
            .delete()
            .eq("id",noticeId);

        if(error) throw error;

        toast("공지사항을 삭제했습니다.");

        await loadNotices();

    }

    catch(error){

        console.warn("공지사항 삭제에 실패했습니다:",error.message || error);

        toast("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

/* ---------- 학교설정 (NEIS 연동) ---------- */

async function loadSchoolConfig(){

    const client=getClient();

    if(!client) return;

    try{

        const {data,error}=await client
            .from("school_config")
            .select("neis_api_key,atpt_ofcdc_sc_code,sd_schul_code,school_name")
            .eq("id",1)
            .maybeSingle();

        if(error) throw error;

        if(data){

            if(el.schoolApiKeyInput) el.schoolApiKeyInput.value=data.neis_api_key || "";
            if(el.schoolOfficeCodeInput) el.schoolOfficeCodeInput.value=data.atpt_ofcdc_sc_code || "";
            if(el.schoolCodeInput) el.schoolCodeInput.value=data.sd_schul_code || "";
            if(el.schoolNameInput && data.school_name) el.schoolNameInput.value=data.school_name;

        }

        if(el.schoolConfigStatus){

            const ready=(data?.neis_api_key && data?.atpt_ofcdc_sc_code && data?.sd_schul_code);

            el.schoolConfigStatus.innerHTML=ready
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>현재 학교 정보 연동이 설정되어 있습니다.'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:4px;"><path d="M12 3L22 20H2L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10V14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>아직 설정이 완료되지 않았습니다.';

        }

    }

    catch(error){

        console.warn("학교설정을 불러오지 못했습니다:",error.message || error);

    }

}

async function searchSchoolCode(){

    const key=el.schoolApiKeyInput?.value.trim();
    const schoolName=el.schoolNameInput?.value.trim();

    if(!key){

        toast("먼저 NEIS 인증키를 입력해주세요.");

        return;

    }

    if(!schoolName){

        toast("학교명을 입력해주세요.");

        return;

    }

    if(el.schoolSearchResult) el.schoolSearchResult.innerHTML=`<p class="admin-item-sub">검색 중...</p>`;

    try{

        const query=new URLSearchParams({

            KEY:key,
            Type:"json",
            pIndex:"1",
            pSize:"10",
            SCHUL_NM:schoolName

        });

        const res=await fetch(`https://open.neis.go.kr/hub/schoolInfo?${query.toString()}`);

        if(!res.ok) throw new Error(`HTTP_${res.status}`);

        const data=await res.json();

        const rows=data.schoolInfo?.[1]?.row || [];

        if(!rows.length){

            if(el.schoolSearchResult) el.schoolSearchResult.innerHTML=`<p class="admin-item-sub">검색 결과가 없습니다. 학교명을 다시 확인해주세요.</p>`;

            return;

        }

        if(el.schoolSearchResult){

            el.schoolSearchResult.innerHTML=rows.map((row)=>`
                <div class="admin-item" data-office="${escapeHtml(row.ATPT_OFCDC_SC_CODE)}" data-school="${escapeHtml(row.SD_SCHUL_CODE)}" style="cursor:pointer;">
                    <div class="admin-item-title">${escapeHtml(row.SCHUL_NM)}</div>
                    <div class="admin-item-sub">${escapeHtml(row.ATPT_OFCDC_SC_CODE)} · ${escapeHtml(row.SD_SCHUL_CODE)} · ${escapeHtml(row.ORG_RDNMA || "")}</div>
                </div>
            `).join("");

        }

    }

    catch(error){

        console.warn("학교 검색에 실패했습니다:",error.message || error);

        if(el.schoolSearchResult) el.schoolSearchResult.innerHTML=`<p class="admin-item-sub">검색에 실패했습니다. 인증키를 확인해주세요.</p>`;

    }

}

el.schoolSearchResult?.addEventListener("click",(e)=>{

    const item=e.target.closest("[data-office]");

    if(!item) return;

    if(el.schoolOfficeCodeInput) el.schoolOfficeCodeInput.value=item.dataset.office;
    if(el.schoolCodeInput) el.schoolCodeInput.value=item.dataset.school;

    toast("학교 코드를 입력했습니다. 아래 저장 버튼을 눌러주세요.");

});

async function saveSchoolConfig(){

    const client=getClient();

    if(!client) return;

    const payload={

        neis_api_key:el.schoolApiKeyInput?.value.trim() || null,
        atpt_ofcdc_sc_code:el.schoolOfficeCodeInput?.value.trim() || null,
        sd_schul_code:el.schoolCodeInput?.value.trim() || null,
        school_name:el.schoolNameInput?.value.trim() || "태성고등학교",
        updated_at:new Date().toISOString(),
        updated_by:adminId

    };

    try{

        const {error}=await client
            .from("school_config")
            .update(payload)
            .eq("id",1);

        if(error) throw error;

        toast("학교설정을 저장했습니다.");

        await loadSchoolConfig();

    }

    catch(error){

        console.warn("학교설정 저장에 실패했습니다:",error.message || error);

        toast("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

function setupSchoolForm(){

    el.schoolSearchBtn?.addEventListener("click",searchSchoolCode);
    el.schoolConfigSaveBtn?.addEventListener("click",saveSchoolConfig);

}

function setupNoticeForm(){

    el.noticePublishBtn?.addEventListener("click",()=>{

        createNotice(true);

    });

    el.noticeSaveDraftBtn?.addEventListener("click",()=>{

        createNotice(false);

    });

}

function setupPostControls(){

    el.postRefreshBtn?.addEventListener("click",()=>{

        loadPosts(false);

    });

    el.postMoreBtn?.addEventListener("click",()=>{

        loadPosts(true);

    });

}

/* ---------- 탭 전환 ---------- */

function setupMainTabs(){

    el.mainTabs?.forEach((tab)=>{

        tab.addEventListener("click",()=>{

            el.mainTabs.forEach((t)=>t.classList.remove("active"));
            tab.classList.add("active");

            const target=tab.dataset.tab;

            Object.entries(el.panels).forEach(([name,panel])=>{

                panel?.classList.toggle("active",name===target);

            });

            if(target==="reports") loadReports();
            if(target==="posts") loadPosts(false);
            if(target==="notices") loadNotices();
            if(target==="inquiries") loadInquiries();
            if(target==="school") loadSchoolConfig();

        });

    });

}

function setupInquiryStatusTabs(){

    el.inquiryStatusTabs?.forEach((tab)=>{

        tab.addEventListener("click",()=>{

            el.inquiryStatusTabs.forEach((t)=>t.classList.remove("active"));
            tab.classList.add("active");

            inquiryStatusFilter=tab.dataset.inquiryStatus;

            loadInquiries();

        });

    });

}

function setupStatusTabs(){

    el.statusTabs?.forEach((tab)=>{

        tab.addEventListener("click",()=>{

            el.statusTabs.forEach((t)=>t.classList.remove("active"));
            tab.classList.add("active");

            statusFilter=tab.dataset.status;

            loadReports();

        });

    });

}

/* ---------- 액션 위임 ---------- */

function setupActionDelegation(){

    document.addEventListener("click",(e)=>{

        const btn=e.target.closest("[data-action]");

        if(!btn) return;

        const action=btn.dataset.action;

        if(action==="inquiry-reply-toggle"){

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="inquiry-reply-row"]');

            row?.classList.toggle("hidden");

            if(row && !row.classList.contains("hidden")){

                row.querySelector('[data-role="inquiry-reply-input"]')?.focus();

            }

            return;

        }

        if(action==="inquiry-reply-save"){

            const inquiryId=btn.dataset.inquiry;

            if(!inquiryId) return;

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="inquiry-reply-row"]');
            const input=row?.querySelector('[data-role="inquiry-reply-input"]');

            if(!input) return;

            const replyText=input.value.trim();

            if(!replyText){

                toast("답변 내용을 입력해주세요.");
                return;

            }

            btn.disabled=true;

            replyToInquiry(inquiryId,replyText).then(()=>{

                btn.disabled=false;

            });

            return;

        }

        if(action==="resolve" || action==="reject"){

            const reportId=btn.dataset.report;

            if(!reportId) return;

            updateReportStatus(reportId,action==="resolve" ? "resolved" : "rejected");

            return;

        }

        if(action==="delete-report"){

            const reportId=btn.dataset.report;

            if(!reportId) return;

            if(confirm("이 신고 내역을 삭제할까요? 되돌릴 수 없습니다.")){

                deleteReport(reportId);

            }

            return;

        }

        if(action==="delete-report-target"){

            const {report,type,target}=btn.dataset;

            if(!report || !type || !target) return;

            const label=TARGET_LABEL[type] || "대상";

            if(confirm(`신고된 ${label}을 삭제하고 신고를 처리완료로 표시할까요?\n되돌릴 수 없습니다.`)){

                deleteReportTarget(report,type,target);

            }

            return;

        }

        if(action==="post-comments-toggle"){

            const postId=btn.dataset.post;
            const item=btn.closest(".admin-item");
            const container=item?.querySelector('[data-role="post-comments"]');

            if(!postId || !container) return;

            const nowOpen=container.classList.toggle("hidden")===false;

            btn.textContent=nowOpen ? "댓글 닫기" : "댓글 보기";

            if(nowOpen) loadPostComments(postId,container);

            return;

        }

        if(action==="delete-post"){

            const postId=btn.dataset.post;

            if(!postId) return;

            if(confirm("이 게시글을 삭제할까요?\n댓글과 추천도 함께 삭제되고 되돌릴 수 없습니다.")){

                deletePost(postId);

            }

            return;

        }

        if(action==="delete-comment"){

            const commentId=btn.dataset.comment;
            const postId=btn.dataset.post;

            if(!commentId) return;

            if(confirm("이 댓글을 삭제할까요? 되돌릴 수 없습니다.")){

                deleteComment(commentId,postId,btn);

            }

            return;

        }

        if(action==="publish-notice" || action==="unpublish-notice"){

            const noticeId=btn.dataset.notice;

            if(!noticeId) return;

            setNoticePublished(noticeId,action==="publish-notice");

            return;

        }

        if(action==="delete-notice"){

            const noticeId=btn.dataset.notice;

            if(!noticeId) return;

            if(confirm("이 공지사항을 삭제할까요?")){

                deleteNotice(noticeId);

            }

        }

    });

}

/* ---------- INIT ---------- */

window.addEventListener("load",async()=>{

    const result=await guard();

    if(!result){

        el.denied.classList.remove("hidden");
        el.wrap.classList.add("hidden");

        return;

    }

    adminId=result.user.id;

    el.denied.classList.add("hidden");
    el.wrap.classList.remove("hidden");

    setupMainTabs();
    setupStatusTabs();
    setupActionDelegation();
    setupNoticeForm();
    setupSchoolForm();
    setupPostControls();
    setupInquiryStatusTabs();

    await loadReports();

});

})();
