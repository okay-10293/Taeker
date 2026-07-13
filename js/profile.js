/* =====================================================
   TAEKER PUBLIC PROFILE
   profile.html?id=<user_id> 전용 로직
   닉네임 / 학생·선생님 여부 / 작성한 글만 공개, 학년·반·번호는 비공개
===================================================== */

"use strict";

(function(){

const el={

    notFound:document.getElementById("profileNotFound"),
    wrap:document.getElementById("profileWrap"),

    avatarInitial:document.getElementById("profileAvatarInitial"),
    nickname:document.getElementById("profileNickname"),
    teacherBadge:document.getElementById("profileTeacherBadge"),
    studentBadge:document.getElementById("profileStudentBadge"),
    bio:document.getElementById("profileBio"),

    postCount:document.getElementById("profilePostCount"),
    joinedAt:document.getElementById("profileJoinedAt"),

    postList:document.getElementById("profilePostList")

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

function formatDate(dateStr){

    const date=new Date(dateStr);

    if(isNaN(date)) return "-";

    return date.toLocaleDateString("ko-KR",{year:"numeric",month:"numeric",day:"numeric"});

}

function getClient(){

    return window.sb || null;

}

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
                        <span class="post-footer-item">👁 ${post.view_count ?? 0}</span>
                        <span class="post-footer-item">❤ ${post.like_count ?? 0}</span>
                    </span>
                </div>
            </div>
        </a>
    `;

}

async function loadPosts(userId){

    const client=getClient();

    if(!client || !el.postList) return;

    try{

        const {data,error}=await client
            .from("posts")
            .select("id,title,category,view_count,like_count,comment_count,created_at")
            .eq("author_id",userId)
            .order("created_at",{ascending:false})
            .limit(30);

        if(error) throw error;

        if(el.postCount) el.postCount.textContent=data?.length ?? 0;

        if(!data || data.length===0){

            el.postList.innerHTML=`<p class="widget-empty">아직 작성한 글이 없어요.</p>`;

            return;

        }

        el.postList.innerHTML=data.map(postCardHTML).join("");

    }

    catch(error){

        console.warn("작성한 글을 불러오지 못했습니다:",error.message || error);

        el.postList.innerHTML=`<p class="widget-empty">작성한 글을 불러오지 못했습니다.</p>`;

    }

}

async function loadProfile(userId){

    const client=getClient();

    if(!client) return;

    try{

        /* 공개 프로필: 닉네임 / 선생님 여부 / 자기소개 / 가입일만 조회.
           학년·반·번호·이메일 등은 아예 select하지 않는다 (화면에 노출 안 함). */

        const {data:profile,error}=await client
            .from("profiles")
            .select("nickname,is_teacher,bio,created_at")
            .eq("id",userId)
            .maybeSingle();

        if(error) throw error;

        if(!profile){

            el.notFound?.classList.remove("hidden");
            el.wrap?.classList.add("hidden");

            return;

        }

        el.wrap?.classList.remove("hidden");
        el.notFound?.classList.add("hidden");

        const nickname=profile.nickname || "닉네임 없음";

        if(el.nickname) el.nickname.textContent=nickname;

        if(el.avatarInitial){

            el.avatarInitial.textContent=nickname.trim().charAt(0) || "태";

        }

        el.teacherBadge?.classList.toggle("hidden",!profile.is_teacher);
        el.studentBadge?.classList.toggle("hidden",!!profile.is_teacher);

        if(el.bio){

            if(profile.bio && profile.bio.trim()){

                el.bio.textContent=profile.bio.trim();
                el.bio.classList.remove("hidden");

            }else{

                el.bio.classList.add("hidden");

            }

        }

        if(el.joinedAt) el.joinedAt.textContent=formatDate(profile.created_at);

        document.title=`${nickname} | 태커`;

        await loadPosts(userId);

    }

    catch(error){

        console.warn("프로필을 불러오지 못했습니다:",error.message || error);

        el.notFound?.classList.remove("hidden");
        el.wrap?.classList.add("hidden");

    }

}

/* ---------- INIT ---------- */

window.addEventListener("load",()=>{

    const params=new URLSearchParams(location.search);
    const userId=params.get("id");

    if(!userId){

        el.notFound?.classList.remove("hidden");
        el.wrap?.classList.add("hidden");

        return;

    }

    loadProfile(userId);

});

})();
