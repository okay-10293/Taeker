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

    statusTabs:document.querySelectorAll("#panelReports .admin-tab"),
    reportList:document.getElementById("reportList"),

    memberSearchInput:document.getElementById("memberSearchInput"),
    memberSearchBtn:document.getElementById("memberSearchBtn"),
    memberList:document.getElementById("memberList")

};

if(!el.wrap) return;

const TARGET_LABEL={
    post:"게시글",
    comment:"댓글",
    profile:"회원"
};

const GRADE_LABEL={1:"1학년",2:"2학년",3:"3학년"};

let statusFilter="pending";

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

    return date.toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"});

}

function memberMetaText(profile){

    if(!profile) return "";

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

    if(!profile?.is_admin){

        el.deniedText.textContent="관리자만 접근할 수 있는 페이지입니다. 잠시 후 홈으로 이동합니다.";

        setTimeout(()=>{ location.href="index.html"; },1200);

        return false;

    }

    return {user,profile};

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

    const suspendButtons = canAct ? `
        <button class="btn-warn" data-action="suspend1" data-user="${report.target_user_id}">1일 정지</button>
        <button class="btn-danger" data-action="ban" data-user="${report.target_user_id}">영구 정지</button>
        <button data-action="unsuspend" data-user="${report.target_user_id}">정지 해제</button>
    ` : `<span class="admin-item-sub">신고 대상 계정 정보가 없어 정지 처리를 할 수 없습니다.</span>`;

    const resolveButtons = report.status==="pending" ? `
        <button class="btn-ok" data-action="resolve" data-report="${report.id}">처리완료로 표시</button>
        <button data-action="reject" data-report="${report.id}">반려</button>
    ` : "";

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
                target_profile:target_user_id(nickname,grade,class_number,student_number,banned,suspended_until)
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

/* ---------- 계정 정지 처리 ---------- */

async function applySuspension(userId,mode){

    const client=getClient();

    if(!client || !userId) return;

    let payload;

    if(mode==="suspend1"){

        const until=new Date(Date.now()+24*60*60*1000).toISOString();

        payload={suspended_until:until,banned:false};

    }else if(mode==="ban"){

        payload={banned:true,suspended_until:null};

    }else{

        payload={banned:false,suspended_until:null};

    }

    try{

        const {error}=await client
            .from("profiles")
            .update(payload)
            .eq("id",userId);

        if(error) throw error;

        window.Taecker?.toast?.(
            mode==="suspend1" ? "1일 정지 처리했습니다." :
            mode==="ban" ? "영구 정지 처리했습니다." :
            "정지를 해제했습니다."
        );

        await loadReports();

        if(el.panelMembers.classList.contains("active") && el.memberSearchInput.value.trim()){

            await searchMembers(el.memberSearchInput.value.trim());

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

/* ---------- 회원 검색 ---------- */

function memberItemHTML(profile){

    return `
        <div class="admin-item" data-user-id="${profile.id}">
            <div class="admin-item-top">
                <div>
                    <div class="admin-item-title">${escapeHtml(profile.nickname || "닉네임 없음")}</div>
                    <div class="admin-item-sub">${escapeHtml(memberMetaText(profile)) || "학년/반/번호 미입력"} · ${escapeHtml(profile.email || "")}</div>
                </div>
                ${statusPillHTML(profile)}
            </div>
            <div class="admin-actions">
                <button class="btn-warn" data-action="suspend1" data-user="${profile.id}">1일 정지</button>
                <button class="btn-danger" data-action="ban" data-user="${profile.id}">영구 정지</button>
                <button data-action="unsuspend" data-user="${profile.id}">정지 해제</button>
            </div>
        </div>
    `;

}

async function searchMembers(keyword){

    const client=getClient();

    if(!client || !el.memberList) return;

    el.memberList.innerHTML=`<div class="admin-empty">검색 중...</div>`;

    try{

        const {data,error}=await client
            .from("profiles")
            .select("id,nickname,email,grade,class_number,student_number,banned,suspended_until")
            .ilike("nickname",`%${keyword}%`)
            .limit(20);

        if(error) throw error;

        if(!data || data.length===0){

            el.memberList.innerHTML=`<div class="admin-empty">검색 결과가 없습니다.</div>`;

            return;

        }

        el.memberList.innerHTML=data.map(memberItemHTML).join("");

    }

    catch(error){

        console.warn("회원 검색에 실패했습니다:",error.message || error);

        el.memberList.innerHTML=`<div class="admin-empty">검색에 실패했습니다. 잠시 후 다시 시도해주세요.</div>`;

    }

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

function setupActionDelegation(){

    document.addEventListener("click",(e)=>{

        const btn=e.target.closest("[data-action]");

        if(!btn) return;

        const action=btn.dataset.action;

        if(action==="suspend1" || action==="ban" || action==="unsuspend"){

            const userId=btn.dataset.user;

            if(!userId) return;

            const confirmText=

                action==="suspend1" ? "이 계정을 1일 정지할까요?" :
                action==="ban" ? "이 계정을 영구 정지할까요?" :
                "정지를 해제할까요?";

            if(confirm(confirmText)){

                applySuspension(userId,action);

            }

            return;

        }

        if(action==="resolve" || action==="reject"){

            const reportId=btn.dataset.report;

            if(!reportId) return;

            updateReportStatus(reportId,action==="resolve" ? "resolved" : "rejected",adminId);

        }

    });

}

/* ---------- INIT ---------- */

el.memberSearchBtn?.addEventListener("click",()=>{

    const keyword=el.memberSearchInput.value.trim();

    if(!keyword){

        el.memberList.innerHTML=`<div class="admin-empty">닉네임을 입력해주세요.</div>`;

        return;

    }

    searchMembers(keyword);

});

el.memberSearchInput?.addEventListener("keydown",(e)=>{

    if(e.key==="Enter"){

        e.preventDefault();
        el.memberSearchBtn?.click();

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

    el.denied.classList.add("hidden");
    el.wrap.classList.remove("hidden");

    setupMainTabs();
    setupStatusTabs();
    setupActionDelegation();

    await loadReports();

});

})();
