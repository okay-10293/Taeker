/* =====================================================
   TAECKER ADMIN
   admin.html 전용 - 신고 내역 확인 / 계정 정지 · 영구정지
   접근 가능 대상: profiles.is_admin = true 인 계정만
===================================================== */

"use strict";

(function(){

const el={

    denied:document.getElementById("adminDenied"),
    deniedText:document.getElementById("adminDeniedText"),
    wrap:document.getElementById("adminWrap"),

    mainTabs:document.querySelectorAll(".admin-tabs")[0]?.querySelectorAll(".admin-tab"),
    panelReports:document.getElementById("panelReports"),
    panelMembers:document.getElementById("panelMembers"),
    panelNotices:document.getElementById("panelNotices"),
    panelSchool:document.getElementById("panelSchool"),
    panelImpersonation:document.getElementById("panelImpersonation"),
    panelInquiries:document.getElementById("panelInquiries"),

    impersonationStatusTabs:document.querySelectorAll("#panelImpersonation .admin-tab"),
    impersonationList:document.getElementById("impersonationList"),

    inquiryStatusTabs:document.querySelectorAll("#panelInquiries .admin-tab"),
    inquiryList:document.getElementById("inquiryList"),

    schoolApiKeyInput:document.getElementById("schoolApiKeyInput"),
    schoolNameInput:document.getElementById("schoolNameInput"),
    schoolSearchBtn:document.getElementById("schoolSearchBtn"),
    schoolSearchResult:document.getElementById("schoolSearchResult"),
    schoolOfficeCodeInput:document.getElementById("schoolOfficeCodeInput"),
    schoolCodeInput:document.getElementById("schoolCodeInput"),
    schoolConfigSaveBtn:document.getElementById("schoolConfigSaveBtn"),
    schoolConfigStatus:document.getElementById("schoolConfigStatus"),

    statusTabs:document.querySelectorAll("#panelReports .admin-tab"),
    reportList:document.getElementById("reportList"),

    memberSearchInput:document.getElementById("memberSearchInput"),
    memberSearchBtn:document.getElementById("memberSearchBtn"),
    memberList:document.getElementById("memberList"),

    noticeTitleInput:document.getElementById("noticeTitleInput"),
    noticeContentInput:document.getElementById("noticeContentInput"),
    noticeSaveDraftBtn:document.getElementById("noticeSaveDraftBtn"),
    noticePublishBtn:document.getElementById("noticePublishBtn"),
    noticeList:document.getElementById("noticeList")

};

if(!el.wrap) return;

const TARGET_LABEL={
    post:"게시글",
    comment:"댓글",
    profile:"회원"
};

const GRADE_LABEL={1:"1학년",2:"2학년",3:"3학년"};

let statusFilter="pending";
let impersonationStatusFilter="pending";
let inquiryStatusFilter="pending";

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

function memberMetaText(profile){

    if(!profile) return "";

    if(profile.is_teacher) return "선생님";

    const parts=[];

    if(profile.grade) parts.push(GRADE_LABEL[profile.grade] || `${profile.grade}학년`);
    if(profile.class_number) parts.push(`${profile.class_number}반`);
    if(profile.student_number) parts.push(`${profile.student_number}번`);

    return parts.join(" ");

}

function statusPillHTML(profile){

    if(!profile){

        return `<span class="status-pill status-active">대상 정보 없음</span>`;

    }

    if(profile.banned){

        return `<span class="status-pill status-banned">영구 정지</span>`;

    }

    if(profile.suspended_until && new Date(profile.suspended_until).getTime()>Date.now()){

        const until=new Date(profile.suspended_until).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});

        return `<span class="status-pill status-suspended">정지중 (~${until})</span>`;

    }

    return `<span class="status-pill status-active">정상</span>`;

}

function getClient(){

    return window.sb || null;

}

/* ---------- 접근 제어 ---------- */

async function guard(){

    if(!window.Auth){

        el.deniedText.textContent="인증 모듈을 불러오지 못했습니다. 새로고침 해주세요.";
        return false;

    }

    const user=await window.Auth.getCurrentUser();

    if(!user){

        el.deniedText.textContent="로그인이 필요합니다. 잠시 후 로그인 페이지로 이동합니다.";

        setTimeout(()=>{ location.href="login.html"; },1200);

        return false;

    }

    const profile=await window.Auth.getProfile();

    if(!profile?.is_admin && !profile?.is_teacher){

        el.deniedText.textContent="관리자 또는 선생님만 접근할 수 있는 페이지입니다. 잠시 후 홈으로 이동합니다.";

        setTimeout(()=>{ location.href="index.html"; },1200);

        return false;

    }

    return {user,profile,isAdmin:!!profile?.is_admin,isTeacher:!!profile?.is_teacher};

}

/* ---------- 선생님 전용 뷰 (공지사항만 접근 가능) ---------- */

function restrictToTeacherView(){

    el.mainTabs?.forEach((tab)=>{

        if(tab.dataset.tab!=="notices"){

            tab.classList.add("hidden");

        }else{

            tab.classList.add("active");

        }

    });

    el.panelReports?.classList.remove("active");
    el.panelMembers?.classList.remove("active");
    el.panelSchool?.classList.remove("active");
    el.panelImpersonation?.classList.remove("active");
    el.panelInquiries?.classList.remove("active");
    el.panelNotices?.classList.add("active");

    const notice=document.createElement("p");

    notice.className="admin-item-sub";
    notice.style.marginBottom="16px";
    notice.textContent="선생님 계정으로 접속 중입니다. 공지사항 작성/관리만 가능해요.";

    el.panelNotices?.parentElement?.insertBefore(notice,el.panelNotices);

}

/* ---------- 신고 내역 ---------- */

function reportItemHTML(report){

    const targetLabel=TARGET_LABEL[report.target_type] || report.target_type;
    const reporterName=escapeHtml(report.reporter?.nickname || "알 수 없음");
    const targetProfile=report.target_profile;
    const targetName=escapeHtml(targetProfile?.nickname || "알 수 없음");
    const targetMeta=escapeHtml(memberMetaText(targetProfile));

    const statusClass=
        report.status==="resolved" ? "status-resolved" :
        report.status==="rejected" ? "status-rejected" : "status-pending";

    const statusText=
        report.status==="resolved" ? "처리완료" :
        report.status==="rejected" ? "반려됨" : "대기중";

    const canAct = !!report.target_user_id;

    const suspendRow = canAct ? `
        <div class="admin-suspend-row hidden" data-role="suspend-row">
            <input type="number" class="input" data-role="suspend-days-input" min="1" step="1" value="1">
            <span class="admin-suspend-unit">일 정지</span>
            <textarea class="input" data-role="suspend-reason-input" rows="2" maxlength="200" placeholder="정지 사유 (정지당한 사람에게 그대로 보여요)"></textarea>
            <div class="admin-suspend-row-buttons">
                <button class="btn-warn" data-action="suspend-save" data-user="${report.target_user_id}">기간 정지 적용</button>
                <button class="btn-danger" data-action="ban-save" data-user="${report.target_user_id}">영구 정지 적용</button>
                <button data-action="suspend-cancel" data-user="${report.target_user_id}">취소</button>
            </div>
        </div>
    ` : "";

    const suspendButtons = canAct ? `
        <button data-action="suspend-toggle" data-user="${report.target_user_id}">정지</button>
        <button data-action="unsuspend" data-user="${report.target_user_id}">정지 해제</button>
    ` : `<span class="admin-item-sub">신고 대상 계정 정보가 없어 정지 처리를 할 수 없습니다.</span>`;

    const resolveButtons = report.status==="pending" ? `
        <button class="btn-ok" data-action="resolve" data-report="${report.id}">처리완료로 표시</button>
        <button data-action="reject" data-report="${report.id}">반려</button>
    ` : `<button class="btn-danger" data-action="delete-report" data-report="${report.id}">신고 삭제</button>`;

    return `
        <div class="admin-item" data-report-id="${report.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">[${targetLabel}] ${escapeHtml(report.reason)}</div>
                    <div class="admin-item-sub">
                        신고자: ${reporterName} · 대상: ${targetName}${targetMeta ? " ("+targetMeta+")" : ""} · ${timeAgo(report.created_at)}
                    </div>
                </div>
                <span class="status-pill ${statusClass}">${statusText}</span>
            </div>
            ${targetProfile ? `<div style="margin-bottom:6px;">${statusPillHTML(targetProfile)}</div>` : ""}
            ${suspendRow}
            <div class="admin-actions">
                ${suspendButtons}
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
            .select(`
                id,target_type,target_id,target_user_id,reason,status,created_at,
                reporter:reporter_id(nickname),
                target_profile:target_user_id(nickname,grade,class_number,student_number,is_teacher,banned,suspended_until)
            `)
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

        el.reportList.innerHTML=data.map(reportItemHTML).join("");

    }

    catch(error){

        console.warn("신고 내역을 불러오지 못했습니다:",error.message || error);

        el.reportList.innerHTML=`<div class="admin-empty">신고 내역을 불러오지 못했습니다. (reports 테이블이 아직 없다면 sql/admin_setup.sql을 먼저 실행해주세요)</div>`;

    }

}

/* ---------- 신고 삭제 (처리완료/반려된 신고만) ---------- */

async function deleteReport(reportId){

    const client=getClient();

    if(!client) return;

    try{

        const {error}=await client
            .from("reports")
            .delete()
            .eq("id",reportId);

        if(error) throw error;

        window.Taecker?.toast?.("신고 내역을 삭제했습니다.");

        await loadReports();

    }

    catch(error){

        console.warn("신고 삭제에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

/* ---------- 개인 공지 보내기 ---------- */

async function sendPersonalNotice(userId,title,content){

    const client=getClient();

    if(!client || !userId) return false;

    try{

        const {error}=await client
            .from("notices")
            .insert({

                title,
                content,
                target_user_id:userId,
                is_published:true,
                published_at:new Date().toISOString(),
                created_by:adminId

            });

        if(error) throw error;

        window.Taecker?.toast?.("개인 공지를 보냈습니다.");

        return true;

    }

    catch(error){

        console.error("개인 공지 전송 실패:",error.message || error);

        window.Taecker?.toast?.("전송에 실패했습니다. 잠시 후 다시 시도해주세요.");

        return false;

    }

}

/* ---------- 계정 정지 처리 ---------- */

async function applySuspension(userId,mode,days,reason){

    const client=getClient();

    if(!client || !userId) return;

    let payload;

    if(mode==="suspendCustom"){

        const safeDays=Math.max(1,Math.floor(Number(days)||1));

        const until=new Date(Date.now()+safeDays*24*60*60*1000).toISOString();

        payload={suspended_until:until,banned:false,suspended_reason:(reason || "").trim() || null};

    }else if(mode==="ban"){

        payload={banned:true,suspended_until:null,suspended_reason:(reason || "").trim() || null};

    }else{

        payload={banned:false,suspended_until:null,suspended_reason:null};

    }

    try{

        const {error}=await client
            .from("profiles")
            .update(payload)
            .eq("id",userId);

        if(error) throw error;

        window.Taecker?.toast?.(
            mode==="suspendCustom" ? `${Math.max(1,Math.floor(Number(days)||1))}일 정지 처리했습니다.` :
            mode==="ban" ? "영구 정지 처리했습니다." :
            "정지를 해제했습니다."
        );

        await loadReports();

        if(el.panelMembers.classList.contains("active")){

            const member=allMembers.find((m)=>m.id===userId);

            if(member) Object.assign(member,payload);

            renderMemberList();

        }

    }

    catch(error){

        console.warn("정지 처리에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

async function updateReportStatus(reportId,status,adminId){

    const client=getClient();

    if(!client || !reportId) return;

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

        window.Taecker?.toast?.(status==="resolved" ? "처리완료로 표시했습니다." : "반려 처리했습니다.");

        await loadReports();

    }

    catch(error){

        console.warn("신고 상태 변경에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

/* ---------- 학번 도용 신고 ---------- */

function impersonationItemHTML(report){

    const statusClass=
        report.status==="resolved" ? "status-resolved" :
        report.status==="rejected" ? "status-rejected" : "status-pending";

    const statusText=
        report.status==="resolved" ? "확정(처리완료)" :
        report.status==="rejected" ? "반려됨" : "대기중";

    const victimMeta=`${GRADE_LABEL[report.victim_grade] || report.victim_grade+"학년"} ${report.victim_class}반 ${report.victim_number}번`;

    const accused=report.accused_profile;

    const accusedInfo=accused
        ? `${escapeHtml(accused.nickname || "닉네임 없음")} (${escapeHtml(accused.email || "이메일 없음")})${accused.banned ? " · 이미 영구정지됨" : ""}`
        : "일치하는 계정을 찾지 못했습니다. 회원 검색 탭에서 직접 확인해주세요.";

    const actionButtons = report.status==="pending" ? `
        <button class="btn-danger" data-action="confirm-impersonation" data-report="${report.id}" ${accused ? "" : "disabled"}>도용 확정 (계정 삭제)</button>
        <button data-action="reject-impersonation" data-report="${report.id}">반려</button>
    ` : "";

    return `
        <div class="admin-item" data-impersonation-id="${report.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">피해 학번: ${escapeHtml(victimMeta)}</div>
                    <div class="admin-item-sub">
                        신고자 연락처: ${escapeHtml(report.reporter_contact_email)} · ${timeAgo(report.created_at)}
                    </div>
                </div>
                <span class="status-pill ${statusClass}">${statusText}</span>
            </div>
            <div class="admin-item-sub" style="margin-bottom:6px;">현재 이 학번을 쓰는 계정: ${accusedInfo}</div>
            ${report.message ? `<div class="admin-item-sub" style="margin-bottom:6px;">신고 내용: ${escapeHtml(report.message)}</div>` : ""}
            <div class="admin-actions">
                ${actionButtons}
            </div>
        </div>
    `;

}

async function loadImpersonationReports(){

    const client=getClient();

    if(!client || !el.impersonationList) return;

    el.impersonationList.innerHTML=`<div class="admin-empty">불러오는 중...</div>`;

    try{

        let query=client
            .from("impersonation_reports")
            .select(`
                id,reporter_contact_email,victim_grade,victim_class,victim_number,message,
                accused_profile_id,status,created_at,
                accused_profile:accused_profile_id(nickname,email,banned)
            `)
            .order("created_at",{ascending:false});

        if(impersonationStatusFilter!=="all"){

            query=query.eq("status",impersonationStatusFilter);

        }

        const {data,error}=await query;

        if(error) throw error;

        if(!data || data.length===0){

            el.impersonationList.innerHTML=`<div class="admin-empty">해당 조건의 도용 신고가 없습니다.</div>`;

            return;

        }

        el.impersonationList.innerHTML=data.map(impersonationItemHTML).join("");

    }

    catch(error){

        console.warn("도용 신고 목록을 불러오지 못했습니다:",error.message || error);

        el.impersonationList.innerHTML=`<div class="admin-empty">도용 신고 목록을 불러오지 못했습니다.</div>`;

    }

}

/* ---------- 문의하기 ---------- */

function inquiryItemHTML(inquiry){

    const answered=inquiry.status==="answered";
    const author=inquiry.author;

    const authorInfo=author
        ? `${escapeHtml(author.nickname || "닉네임 없음")} (${escapeHtml(author.email || "이메일 없음")})`
        : "탈퇴했거나 알 수 없는 회원";

    return `
        <div class="admin-item" data-inquiry-id="${inquiry.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">${authorInfo}</div>
                    <div class="admin-item-sub">${timeAgo(inquiry.created_at)}</div>
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
                    <textarea class="input" data-role="inquiry-reply-input" rows="3" maxlength="1000" placeholder="답변을 입력하세요"></textarea>
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
            .select("id,content,status,admin_reply,created_at,author:user_id(nickname,email)")
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

        window.Taecker?.toast?.("답변이 등록되었습니다.");

        await loadInquiries();

        return true;

    }

    catch(error){

        console.error("답변 등록 실패:",error.message || error);

        window.Taecker?.toast?.("답변 등록에 실패했습니다.");

        return false;

    }

}

async function confirmImpersonation(reportId){

    const client=getClient();

    if(!client || !reportId) return;

    try{

        const {error}=await client.rpc("confirm_impersonation",{p_report_id:Number(reportId)});

        if(error) throw error;

        window.Taecker?.toast?.("도용을 확정 처리했습니다. 해당 계정은 영구 정지되고 이메일은 재가입이 차단됩니다.");

        await loadImpersonationReports();

    }

    catch(error){

        console.warn("도용 확정 처리에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

async function rejectImpersonation(reportId){

    const client=getClient();

    if(!client || !reportId) return;

    try{

        const {error}=await client
            .from("impersonation_reports")
            .update({

                status:"rejected",
                resolved_at:new Date().toISOString(),
                resolved_by:adminId

            })
            .eq("id",reportId);

        if(error) throw error;

        window.Taecker?.toast?.("반려 처리했습니다.");

        await loadImpersonationReports();

    }

    catch(error){

        console.warn("반려 처리에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");

    }

}

/* ---------- 회원 목록 (전체 목록 + 클라이언트 필터링) ---------- */

let allMembers=[];

function memberItemHTML(profile){

    return `
        <div class="admin-item admin-member-item" data-user-id="${profile.id}">
            <button type="button" class="admin-member-summary" data-action="member-toggle">
                <div>
                    <div class="admin-item-title" data-role="nickname-display">${escapeHtml(profile.nickname || "닉네임 없음")}</div>
                    <div class="admin-item-sub">${escapeHtml(memberMetaText(profile)) || "학년/반/번호 미입력"} · ${escapeHtml(profile.email || "")}</div>
                </div>
                <div class="admin-member-summary-right">
                    ${statusPillHTML(profile)}
                    <span class="admin-member-chevron" data-role="chevron">▾</span>
                </div>
            </button>
            <div class="admin-member-detail hidden" data-role="member-detail">
                ${(profile.suspended_reason && (profile.banned || (profile.suspended_until && new Date(profile.suspended_until).getTime()>Date.now()))) ? `
                    <div class="admin-item-sub" style="margin-bottom:10px;padding:8px 10px;border-radius:10px;background:#FEF2F2;color:#B91C1C;">
                        현재 정지 사유: ${escapeHtml(profile.suspended_reason)}
                    </div>
                ` : ""}
                <div class="admin-rename-row hidden" data-role="rename-row">
                    <input type="text" class="input" data-role="rename-input" value="${escapeHtml(profile.nickname || "")}" maxlength="20">
                    <button class="btn-ok" data-action="rename-save" data-user="${profile.id}">저장</button>
                    <button data-action="rename-cancel" data-user="${profile.id}">취소</button>
                </div>
                <div class="admin-suspend-row hidden" data-role="suspend-row">
                    <input type="number" class="input" data-role="suspend-days-input" min="1" step="1" value="1">
                    <span class="admin-suspend-unit">일 정지</span>
                    <textarea class="input" data-role="suspend-reason-input" rows="2" maxlength="200" placeholder="정지 사유 (정지당한 사람에게 그대로 보여요)"></textarea>
                    <div class="admin-suspend-row-buttons">
                        <button class="btn-warn" data-action="suspend-save" data-user="${profile.id}">기간 정지 적용</button>
                        <button class="btn-danger" data-action="ban-save" data-user="${profile.id}">영구 정지 적용</button>
                        <button data-action="suspend-cancel" data-user="${profile.id}">취소</button>
                    </div>
                </div>
                <div class="admin-memo-row">
                    <textarea class="input" data-role="memo-input" rows="2" maxlength="200" placeholder="메모 (예: 수학 선생님 · 관리자만 볼 수 있음)">${escapeHtml(profile.admin_memo || "")}</textarea>
                    <button class="btn-ok" data-action="memo-save" data-user="${profile.id}">메모 저장</button>
                </div>
                <div class="admin-memo-row hidden" data-role="notice-row">
                    <input type="text" class="input" data-role="notice-title-input" maxlength="60" placeholder="제목">
                    <textarea class="input" data-role="notice-content-input" rows="3" maxlength="500" placeholder="이 회원에게만 보이는 개인 공지 내용"></textarea>
                    <button class="btn-ok" data-action="notice-send" data-user="${profile.id}">공지 보내기</button>
                </div>
                <div class="admin-actions">
                    <button data-action="suspend-toggle" data-user="${profile.id}">정지</button>
                    <button data-action="unsuspend" data-user="${profile.id}">정지 해제</button>
                    <button data-action="rename-toggle" data-user="${profile.id}">닉네임 변경</button>
                    <button data-action="notice-toggle" data-user="${profile.id}">개인 공지 보내기</button>
                </div>
            </div>
        </div>
    `;

}

function memberMatchesKeyword(profile,keyword){

    if(!keyword) return true;

    const haystack=[
        profile.nickname,
        profile.email,
        profile.student_number,
        profile.admin_memo,
        memberMetaText(profile)
    ].filter(Boolean).join(" ").toLowerCase();

    return haystack.includes(keyword.toLowerCase());

}

function renderMemberList(){

    if(!el.memberList) return;

    const keyword=el.memberSearchInput?.value.trim() || "";

    const filtered=allMembers.filter((profile)=>memberMatchesKeyword(profile,keyword));

    if(filtered.length===0){

        el.memberList.innerHTML=`<div class="admin-empty">${keyword ? "일치하는 회원이 없습니다." : "가입된 회원이 없습니다."}</div>`;

        return;

    }

    el.memberList.innerHTML=filtered.map(memberItemHTML).join("");

}

async function renameMember(userId,newNickname){

    const client=getClient();

    if(!client || !userId) return false;

    const trimmed=(newNickname || "").trim();

    if(!trimmed){

        window.Taecker?.toast?.("닉네임을 입력해주세요.");

        return false;

    }

    try{

        const {error}=await client
            .from("profiles")
            .update({nickname:trimmed})
            .eq("id",userId);

        if(error) throw error;

        window.Taecker?.toast?.("닉네임을 변경했습니다.");

        const member=allMembers.find((m)=>m.id===userId);

        if(member) member.nickname=trimmed;

        renderMemberList();

        return true;

    }

    catch(error){

        console.warn("닉네임 변경에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("닉네임 변경에 실패했습니다. 잠시 후 다시 시도해주세요.");

        return false;

    }

}

async function updateMemberMemo(userId,memo){

    const client=getClient();

    if(!client || !userId) return false;

    const trimmed=(memo || "").trim();

    try{

        const {error}=await client
            .from("profiles")
            .update({admin_memo:trimmed})
            .eq("id",userId);

        if(error) throw error;

        window.Taecker?.toast?.("메모를 저장했습니다.");

        const member=allMembers.find((m)=>m.id===userId);

        if(member) member.admin_memo=trimmed;

        return true;

    }

    catch(error){

        console.warn("메모 저장에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("메모 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");

        return false;

    }

}

async function loadAllMembers(){

    const client=getClient();

    if(!client || !el.memberList) return;

    el.memberList.innerHTML=`<div class="admin-empty">불러오는 중...</div>`;

    try{

        const {data,error}=await client
            .from("profiles")
            .select("id,nickname,email,grade,class_number,student_number,is_teacher,admin_memo,banned,suspended_until,suspended_reason")
            .order("grade",{ascending:true,nullsFirst:false})
            .order("class_number",{ascending:true,nullsFirst:false})
            .order("student_number",{ascending:true,nullsFirst:false})
            .limit(1000);

        if(error) throw error;

        allMembers=data || [];

        renderMemberList();

    }

    catch(error){

        console.warn("회원 목록을 불러오지 못했습니다:",error.message || error);

        el.memberList.innerHTML=`<div class="admin-empty">회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>`;

    }

}

/* ---------- 공지사항 ---------- */

function noticeItemHTML(notice){

    const statusHTML=notice.is_published
        ? `<span class="status-pill status-resolved">배포됨</span>`
        : `<span class="status-pill status-pending">임시저장</span>`;

    const dateLabel=notice.is_published
        ? `배포일시 ${new Date(notice.published_at).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}`
        : `작성일시 ${new Date(notice.created_at).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}`;

    const authorName=notice.author?.nickname
        ? `${escapeHtml(notice.author.nickname)}${notice.author?.is_teacher ? " (선생님)" : ""} · `
        : "";

    const canManage=isAdminUser || notice.created_by===adminId;

    return `
        <div class="admin-item" data-notice-id="${notice.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">${escapeHtml(notice.title)}</div>
                    <div class="admin-item-sub">${authorName}${dateLabel}</div>
                </div>
                ${statusHTML}
            </div>
            <div class="admin-item-sub" style="white-space:pre-wrap;margin-bottom:6px;">${escapeHtml(notice.content)}</div>
            ${canManage ? `
                <div class="admin-actions">
                    ${
                        notice.is_published
                            ? `<button data-action="unpublish-notice" data-notice="${notice.id}">배포 취소</button>`
                            : `<button class="btn-ok" data-action="publish-notice" data-notice="${notice.id}">배포하기</button>`
                    }
                    <button class="btn-danger" data-action="delete-notice" data-notice="${notice.id}">삭제</button>
                </div>
            ` : ""}
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
            .select("id,title,content,is_published,created_at,published_at,created_by,author:created_by(nickname,is_teacher)")
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

        window.Taecker?.toast?.("제목과 내용을 모두 입력해주세요.");

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

        window.Taecker?.toast?.(publish ? "공지사항을 배포했습니다." : "임시저장했습니다.");

        el.noticeTitleInput.value="";
        el.noticeContentInput.value="";

        await loadNotices();

    }

    catch(error){

        console.warn("공지사항 등록에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("등록에 실패했습니다. 잠시 후 다시 시도해주세요.");

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

        window.Taecker?.toast?.(publish ? "공지사항을 배포했습니다." : "배포를 취소했습니다.");

        await loadNotices();

    }

    catch(error){

        console.warn("공지사항 상태 변경에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");

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

        window.Taecker?.toast?.("공지사항을 삭제했습니다.");

        await loadNotices();

    }

    catch(error){

        console.warn("공지사항 삭제에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");

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

        window.Taecker?.toast?.("먼저 NEIS 인증키를 입력해주세요.");

        return;

    }

    if(!schoolName){

        window.Taecker?.toast?.("학교명을 입력해주세요.");

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

    window.Taecker?.toast?.("학교 코드를 입력했습니다. 아래 저장 버튼을 눌러주세요.");

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

        window.Taecker?.toast?.("학교설정을 저장했습니다.");

        await loadSchoolConfig();

    }

    catch(error){

        console.warn("학교설정 저장에 실패했습니다:",error.message || error);

        window.Taecker?.toast?.("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");

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

/* ---------- 탭 전환 ---------- */

function setupMainTabs(){

    el.mainTabs?.forEach((tab)=>{

        tab.addEventListener("click",()=>{

            el.mainTabs.forEach((t)=>t.classList.remove("active"));
            tab.classList.add("active");

            const target=tab.dataset.tab;

            el.panelReports.classList.toggle("active",target==="reports");
            el.panelMembers.classList.toggle("active",target==="members");
            el.panelNotices.classList.toggle("active",target==="notices");
            el.panelSchool?.classList.toggle("active",target==="school");
            el.panelImpersonation?.classList.toggle("active",target==="impersonation");
            el.panelInquiries?.classList.toggle("active",target==="inquiries");

            if(target==="notices"){

                loadNotices();

            }

            if(target==="members"){

                loadAllMembers();

            }

            if(target==="school"){

                loadSchoolConfig();

            }

            if(target==="impersonation"){

                loadImpersonationReports();

            }

            if(target==="inquiries"){

                loadInquiries();

            }

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

function setupImpersonationStatusTabs(){

    el.impersonationStatusTabs?.forEach((tab)=>{

        tab.addEventListener("click",()=>{

            el.impersonationStatusTabs.forEach((t)=>t.classList.remove("active"));
            tab.classList.add("active");

            impersonationStatusFilter=tab.dataset.impersonationStatus;

            loadImpersonationReports();

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

/* ---------- 액션 위임 (정지 버튼 클릭) ---------- */

let adminId=null;
let isAdminUser=false;

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

                window.Taecker?.toast?.("답변 내용을 입력해주세요.");
                return;

            }

            btn.disabled=true;

            replyToInquiry(inquiryId,replyText).then(()=>{

                btn.disabled=false;

            });

            return;

        }

        if(action==="member-toggle"){

            const item=btn.closest(".admin-item");
            const detail=item?.querySelector('[data-role="member-detail"]');
            const chevron=btn.querySelector('[data-role="chevron"]');

            if(!detail) return;

            const nowOpen=detail.classList.toggle("hidden")===false;

            item?.classList.toggle("admin-member-item-open",nowOpen);
            if(chevron) chevron.textContent=nowOpen ? "▴" : "▾";

            return;

        }

        if(action==="unsuspend"){

            const userId=btn.dataset.user;

            if(!userId) return;

            if(confirm("정지를 해제할까요?")){

                applySuspension(userId,"unsuspend");

            }

            return;

        }

        if(action==="suspend-toggle"){

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="suspend-row"]');

            if(!row) return;

            row.classList.toggle("hidden");

            if(!row.classList.contains("hidden")){

                const input=row.querySelector('[data-role="suspend-days-input"]');
                input?.focus();
                input?.select();

            }

            return;

        }

        if(action==="suspend-cancel"){

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="suspend-row"]');

            row?.classList.add("hidden");

            return;

        }

        if(action==="suspend-save"){

            const userId=btn.dataset.user;

            if(!userId) return;

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="suspend-row"]');
            const input=row?.querySelector('[data-role="suspend-days-input"]');
            const reasonInput=row?.querySelector('[data-role="suspend-reason-input"]');

            if(!input) return;

            const days=Math.max(1,Math.floor(Number(input.value)||1));
            const reason=reasonInput?.value.trim() || "";

            if(!reason){

                window.Taecker?.toast?.("정지 사유를 입력해주세요.");
                reasonInput?.focus();
                return;

            }

            if(confirm(`이 계정을 ${days}일 정지할까요?\n사유: ${reason}`)){

                applySuspension(userId,"suspendCustom",days,reason);
                row?.classList.add("hidden");

            }

            return;

        }

        if(action==="ban-save"){

            const userId=btn.dataset.user;

            if(!userId) return;

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="suspend-row"]');
            const reasonInput=row?.querySelector('[data-role="suspend-reason-input"]');

            const reason=reasonInput?.value.trim() || "";

            if(!reason){

                window.Taecker?.toast?.("정지 사유를 입력해주세요.");
                reasonInput?.focus();
                return;

            }

            if(confirm(`이 계정을 영구 정지할까요?\n사유: ${reason}`)){

                applySuspension(userId,"ban",null,reason);
                row?.classList.add("hidden");

            }

            return;

        }

        if(action==="memo-save"){

            const userId=btn.dataset.user;

            if(!userId) return;

            const item=btn.closest(".admin-item");
            const textarea=item?.querySelector('[data-role="memo-input"]');

            if(!textarea) return;

            btn.disabled=true;

            updateMemberMemo(userId,textarea.value).then(()=>{

                btn.disabled=false;

            });

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

        if(action==="notice-toggle"){

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="notice-row"]');

            if(!row) return;

            row.classList.toggle("hidden");

            if(!row.classList.contains("hidden")){

                row.querySelector('[data-role="notice-title-input"]')?.focus();

            }

            return;

        }

        if(action==="notice-send"){

            const userId=btn.dataset.user;

            if(!userId) return;

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="notice-row"]');
            const titleInput=row?.querySelector('[data-role="notice-title-input"]');
            const contentInput=row?.querySelector('[data-role="notice-content-input"]');

            const title=titleInput?.value.trim() || "";
            const content=contentInput?.value.trim() || "";

            if(!title || !content){

                window.Taecker?.toast?.("제목과 내용을 모두 입력해주세요.");
                return;

            }

            btn.disabled=true;

            sendPersonalNotice(userId,title,content).then((ok)=>{

                btn.disabled=false;

                if(ok){

                    if(titleInput) titleInput.value="";
                    if(contentInput) contentInput.value="";
                    row?.classList.add("hidden");

                }

            });

            return;

        }

        if(action==="rename-toggle"){

            const userId=btn.dataset.user;

            if(!userId) return;

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="rename-row"]');

            if(!row) return;

            row.classList.toggle("hidden");

            if(!row.classList.contains("hidden")){

                const input=row.querySelector('[data-role="rename-input"]');
                input?.focus();
                input?.select();

            }

            return;

        }

        if(action==="rename-cancel"){

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="rename-row"]');
            const input=row?.querySelector('[data-role="rename-input"]');
            const display=item?.querySelector('[data-role="nickname-display"]');

            if(input && display) input.value=display.textContent;

            row?.classList.add("hidden");

            return;

        }

        if(action==="rename-save"){

            const userId=btn.dataset.user;

            if(!userId) return;

            const item=btn.closest(".admin-item");
            const row=item?.querySelector('[data-role="rename-row"]');
            const input=row?.querySelector('[data-role="rename-input"]');

            if(!input) return;

            btn.disabled=true;

            renameMember(userId,input.value).then((success)=>{

                btn.disabled=false;

                if(success) row?.classList.add("hidden");

            });

            return;

        }

        if(action==="resolve" || action==="reject"){

            const reportId=btn.dataset.report;

            if(!reportId) return;

            updateReportStatus(reportId,action==="resolve" ? "resolved" : "rejected",adminId);

            return;

        }

        if(action==="confirm-impersonation"){

            const reportId=btn.dataset.report;

            if(!reportId) return;

            if(confirm("이 신고를 도용으로 확정할까요?\n해당 계정과 작성한 글·댓글이 모두 즉시 삭제되고, 이메일은 다시는 가입할 수 없게 됩니다. 되돌릴 수 없습니다.")){

                confirmImpersonation(reportId);

            }

            return;

        }

        if(action==="reject-impersonation"){

            const reportId=btn.dataset.report;

            if(!reportId) return;

            if(confirm("이 신고를 반려할까요?")){

                rejectImpersonation(reportId);

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

el.memberSearchBtn?.addEventListener("click",()=>{

    loadAllMembers();

});

el.memberSearchInput?.addEventListener("input",()=>{

    renderMemberList();

});

el.memberSearchInput?.addEventListener("keydown",(e)=>{

    if(e.key==="Enter"){

        e.preventDefault();

    }

});

window.addEventListener("load",async()=>{

    const result=await guard();

    if(!result){

        el.denied.classList.remove("hidden");
        el.wrap.classList.add("hidden");

        return;

    }

    adminId=result.user.id;
    isAdminUser=result.isAdmin;

    el.denied.classList.add("hidden");
    el.wrap.classList.remove("hidden");

    if(!result.isAdmin && result.isTeacher){

        restrictToTeacherView();

    }

    setupMainTabs();
    setupStatusTabs();
    setupActionDelegation();
    setupNoticeForm();
    setupSchoolForm();
    setupImpersonationStatusTabs();
    setupInquiryStatusTabs();

    if(!result.isAdmin && result.isTeacher){

        await loadNotices();

    }else{

        await loadReports();

    }

});

})();
