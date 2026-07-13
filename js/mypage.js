/* =====================================================
   TAECKER MYPAGE
   mypage.html 전용 프로필 조회 / 수정 / 내가 쓴 글 로직
===================================================== */

"use strict";

(function(){

const el={

    loginRequired:document.getElementById("mypageLoginRequired"),
    wrap:document.getElementById("mypageWrap"),

    avatarImg:document.getElementById("mypageAvatarImg"),
    avatarInitial:document.getElementById("mypageAvatarInitial"),
    nickname:document.getElementById("mypageNickname"),
    teacherBadge:document.getElementById("mypageTeacherBadge"),
    meta:document.getElementById("mypageMeta"),
    email:document.getElementById("mypageEmail"),

    postCount:document.getElementById("mypagePostCount"),
    joinedAt:document.getElementById("mypageJoinedAt"),

    form:document.getElementById("mypageForm"),
    nicknameInput:document.getElementById("mypageNicknameInput"),
    grade:document.getElementById("mypageGrade"),
    classNumber:document.getElementById("mypageClassNumber"),
    studentNumber:document.getElementById("mypageStudentNumber"),
    bio:document.getElementById("mypageBio"),
    bioCount:document.getElementById("mypageBioCount"),
    formMessage:document.getElementById("mypageFormMessage"),
    saveBtn:document.getElementById("mypageSaveBtn"),
    logoutBtn:document.getElementById("mypageLogoutBtn"),

    postList:document.getElementById("mypagePostList")

};

if(!el.wrap) return;

const GRADE_LABEL={1:"1학년",2:"2학년",3:"3학년"};

const CATEGORY_LABEL={
    notice:"공지사항",
    free:"자유게시판",
    question:"질문게시판",
    info:"정보게시판",
    grade1:"학년별 게시판",
    grade2:"학년별 게시판",
    grade3:"학년별 게시판"
};

let currentUser=null;

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

function stripAndTruncate(str,len){

    const text=String(str ?? "").replace(/<[^>]*>/g,"").trim();

    return text.length>len ? text.slice(0,len)+"…" : text;

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

function formatDate(dateStr){

    const date=new Date(dateStr);

    if(isNaN(date)) return "-";

    return date.toLocaleDateString("ko-KR",{year:"numeric",month:"numeric",day:"numeric"});

}

function getClient(){

    return window.sb || null;

}

function setAvatarInitial(nickname){

    const initial=(nickname || "태").trim().charAt(0) || "태";

    if(el.avatarInitial) el.avatarInitial.textContent=initial;
    if(el.avatarImg) el.avatarImg.classList.add("hidden");

}

/* ---------- LOAD PROFILE ---------- */

async function loadProfile(){

    const profile=await window.Auth.getProfile();
    const user=await window.Auth.getCurrentUser();

    if(!profile || !user){

        el.formMessage.textContent="프로필 정보를 불러오지 못했습니다.";
        el.formMessage.style.color="#DC2626";

        return;

    }

    currentUser=user;

    /* ---- 프로필 요약 ---- */

    el.nickname.textContent=profile.nickname || "회원";

    el.teacherBadge?.classList.toggle("hidden",!profile.is_teacher);

    const metaParts=[];

    if(profile.grade) metaParts.push(GRADE_LABEL[profile.grade] || `${profile.grade}학년`);
    if(profile.class_number) metaParts.push(`${profile.class_number}반`);
    if(profile.student_number) metaParts.push(`${profile.student_number}번`);

    el.meta.textContent=metaParts.length ? metaParts.join(" · ") : "학년/반/번호 미입력";
    el.email.textContent=profile.email || user.email || "";

    if(profile.avatar_url && el.avatarImg){

        el.avatarImg.src=profile.avatar_url;
        el.avatarImg.classList.remove("hidden");
        if(el.avatarInitial) el.avatarInitial.style.display="none";

    }else{

        setAvatarInitial(profile.nickname);

    }

    el.joinedAt.textContent=formatDate(profile.created_at);

    /* ---- 수정 폼 초기값 ---- */

    el.nicknameInput.value=profile.nickname || "";
    el.grade.value=profile.grade || "";
    el.classNumber.value=profile.class_number || "";
    el.studentNumber.value=profile.student_number || "";
    el.bio.value=profile.bio || "";

    if(el.bioCount) el.bioCount.textContent=`${el.bio.value.length} / 100`;

}

el.bio?.addEventListener("input",()=>{

    if(el.bioCount) el.bioCount.textContent=`${el.bio.value.length} / 100`;

});

/* ---------- SAVE PROFILE ---------- */

function setSaving(state){

    if(!el.saveBtn) return;

    el.saveBtn.disabled=state;

    const text=el.saveBtn.querySelector(".button-text");
    const loader=el.saveBtn.querySelector(".button-loader");

    if(text) text.style.display=state ? "none" : "inline-flex";
    if(loader) loader.classList.toggle("hidden",!state);

}

el.form?.addEventListener("submit",async(event)=>{

    event.preventDefault();

    if(!currentUser) return;

    const nickname=el.nicknameInput.value.trim();

    if(!nickname){

        el.formMessage.textContent="닉네임을 입력해주세요.";
        el.formMessage.style.color="#DC2626";
        el.nicknameInput.focus();

        return;

    }

    const client=getClient();

    if(!client) return;

    setSaving(true);
    el.formMessage.textContent="";

    try{

        const {error}=await client
            .from("profiles")
            .update({

                nickname,
                grade:el.grade.value ? Number(el.grade.value) : null,
                bio:el.bio.value.trim()

            })
            .eq("id",currentUser.id);

        if(error) throw error;

        window.Taecker?.toast?.("프로필이 저장되었습니다.");

        el.formMessage.textContent="저장되었습니다.";
        el.formMessage.style.color="#16A34A";

        /* 헤더 닉네임 등에서 쓰는 캐시도 최신화 */

        const refreshed=await window.Auth.getProfile();

        if(refreshed){

            Storage.set("profile",refreshed);
            loadProfile();

        }

    }

    catch(error){

        console.error("프로필 저장 실패:",error.message || error);

        el.formMessage.textContent="저장에 실패했습니다. 잠시 후 다시 시도해주세요.";
        el.formMessage.style.color="#DC2626";

    }

    finally{

        setSaving(false);

    }

});

el.logoutBtn?.addEventListener("click",()=>{

    window.Auth?.logout?.();

});

/* ---------- 내가 쓴 글 ---------- */

function postCardHTML(post){

    const categoryLabel=CATEGORY_LABEL[post.category] || "일반";
    const commentBadge=post.comment_count
        ? `<span class="post-comment-count">[${post.comment_count}]</span>`
        : "";

    return `
        <a class="post-card post-card-link fade-in" href="post.html?id=${encodeURIComponent(post.id)}">
            <div class="post-row">
                <div class="post-row-main">
                    <span class="badge post-category-badge">${categoryLabel}</span>
                    <span class="post-title">${escapeHtml(post.title)}</span>
                    ${commentBadge}
                </div>
                <div class="post-row-meta">
                    <span>${timeAgo(post.created_at)}</span>
                    <span class="post-row-stats">
                        <span class="post-footer-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 12C3.5 7 7.5 4 12 4C16.5 4 20.5 7 22 12C20.5 17 16.5 20 12 20C7.5 20 3.5 17 2 12Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>${post.view_count ?? 0}</span>
                        <span class="post-footer-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20.5C12 20.5 3 15 3 8.8C3 5.9 5.3 3.5 8.2 3.5C9.9 3.5 11.3 4.3 12 5.6C12.7 4.3 14.1 3.5 15.8 3.5C18.7 3.5 21 5.9 21 8.8C21 15 12 20.5 12 20.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>${post.like_count ?? 0}</span>
                    </span>
                </div>
            </div>
        </a>
    `;

}

async function loadMyPosts(){

    const client=getClient();

    if(!client || !currentUser || !el.postList) return;

    try{

        const {data,error,count}=await client
            .from("posts")
            .select("id,title,content,category,view_count,like_count,comment_count,created_at",{count:"exact"})
            .eq("author_id",currentUser.id)
            .order("created_at",{ascending:false});

        if(error) throw error;

        if(el.postCount) el.postCount.textContent=count ?? (data ? data.length : 0);

        if(!data || data.length===0){

            el.postList.innerHTML=`
                <div class="card" style="text-align:center;color:var(--sub);">
                    <p>아직 작성한 글이 없습니다.</p>
                </div>
            `;

            return;

        }

        el.postList.innerHTML=data.map(postCardHTML).join("");

    }

    catch(error){

        console.warn("내가 쓴 글을 불러오지 못했습니다:",error.message || error);

        el.postList.innerHTML=`
            <div class="card" style="text-align:center;color:var(--sub);">
                <p>글 목록을 불러오지 못했습니다.</p>
            </div>
        `;

    }

}

/* ---------- INIT (AUTH GUARD) ---------- */

window.addEventListener("load",async()=>{

    if(!window.Auth){

        el.loginRequired?.classList.remove("hidden");

        return;

    }

    const user=await window.Auth.getCurrentUser();

    if(!user){

        el.loginRequired?.classList.remove("hidden");
        el.wrap?.classList.add("hidden");

        return;

    }

    el.loginRequired?.classList.add("hidden");
    el.wrap?.classList.remove("hidden");

    await loadProfile();
    await loadMyPosts();

});

})();
