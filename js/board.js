/* =====================================================
   TAECKER BOARD
   board.html 전용 게시글 목록 로직
   (카테고리 / 정렬 / 검색 / 더보기 페이지네이션)
===================================================== */

"use strict";

(function(){

/* =====================================================
   ELEMENT
===================================================== */

const el={

    categoryBar:document.getElementById("boardCategoryBar"),
    feedTabs:document.getElementById("boardFeedTabs"),
    postList:document.getElementById("boardPostList"),
    feedCount:document.getElementById("boardFeedCount"),
    boardTitle:document.getElementById("boardTitle"),
    boardSubtitle:document.getElementById("boardSubtitle"),

    loadMoreWrap:document.getElementById("loadMoreWrap"),
    loadMoreBtn:document.getElementById("loadMoreBtn"),

    searchInput:document.getElementById("searchInput")

};

if(!el.postList){

    /* board.html이 아닌 페이지에서는 아무 것도 하지 않는다 */

    return;

}

/* =====================================================
   CONSTANT
===================================================== */

const PAGE_SIZE=10;

const CATEGORY_LABEL={

    notice:"공지사항",
    free:"자유게시판",
    question:"질문게시판",
    info:"정보게시판",
    grade1:"1학년 게시판",
    grade2:"2학년 게시판",
    grade3:"3학년 게시판"

};

/* =====================================================
   STATE
===================================================== */

const params=new URLSearchParams(location.search);

const state={

    category:params.get("category") || "",
    sort:"latest",
    keyword:"",
    page:0,
    hasMore:true,
    loading:false

};

/* =====================================================
   UTIL
===================================================== */

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

    return date.toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"});

}

function debounce(fn,delay){

    let timer=null;

    return (...args)=>{

        clearTimeout(timer);

        timer=setTimeout(()=>fn(...args),delay);

    };

}

function getClient(){

    return window.sb || null;

}

/* =====================================================
   HEADER TEXT
===================================================== */

function updateHeaderText(){

    if(!el.boardTitle || !el.boardSubtitle) return;

    if(!state.category){

        el.boardTitle.textContent="게시판";
        el.boardSubtitle.textContent="태성고등학교 학생들과 자유롭게 이야기를 나눠보세요.";

        return;

    }

    const label=CATEGORY_LABEL[state.category] || "게시판";

    el.boardTitle.textContent=label;
    el.boardSubtitle.textContent=`${label}의 게시글을 확인해보세요.`;

}

/* =====================================================
   CATEGORY CHIP INIT
===================================================== */

function syncCategoryChips(){

    el.categoryBar?.querySelectorAll(".chip").forEach((chip)=>{

        chip.classList.toggle(

            "active",

            (chip.dataset.category || "")===state.category

        );

    });

}

/* 로그인한 학생 본인 학년의 게시판 칩만 추가한다. (다른 학년 칩은 아예 만들지도 않음) */

async function injectGradeChip(){

    if(!el.categoryBar || !window.Auth) return;

    try{

        const user=await window.Auth.getCurrentUser();

        if(!user) return;

        const profile=await window.Auth.getProfile();

        const grade=profile?.grade;

        if(!grade || grade<1 || grade>3) return;

        const category=`grade${grade}`;

        if(el.categoryBar.querySelector(`[data-category="${category}"]`)) return;

        const chip=document.createElement("button");

        chip.className="chip";
        chip.dataset.category=category;
        chip.textContent=CATEGORY_LABEL[category];

        el.categoryBar.appendChild(chip);

        syncCategoryChips();

    }

    catch(error){

        console.warn("학년 게시판 칩을 추가하지 못했습니다:",error.message || error);

    }

}

el.categoryBar?.addEventListener("click",(e)=>{

    const chip=e.target.closest(".chip");

    if(!chip) return;

    state.category=chip.dataset.category || "";

    const url=new URL(location.href);

    if(state.category){

        url.searchParams.set("category",state.category);

    }else{

        url.searchParams.delete("category");

    }

    history.replaceState(null,"",url);

    syncCategoryChips();
    updateHeaderText();
    resetAndFetch();

});

/* =====================================================
   SORT TABS
===================================================== */

el.feedTabs?.addEventListener("click",(e)=>{

    const tab=e.target.closest(".feed-tab");

    if(!tab) return;

    el.feedTabs.querySelectorAll(".feed-tab").forEach((t)=>t.classList.remove("active"));

    tab.classList.add("active");

    state.sort=tab.dataset.sort;

    resetAndFetch();

});

/* =====================================================
   SEARCH
===================================================== */

el.searchInput?.addEventListener("input",debounce((e)=>{

    state.keyword=e.target.value.trim();

    resetAndFetch();

},350));

/* =====================================================
   RENDER
===================================================== */

function postCardHTML(post){

    const nickname=escapeHtml(post.profiles?.nickname || post.author_name || "익명");
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
                    <span>${nickname}</span>
                    <span>·</span>
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

function renderSkeleton(){

    el.postList.innerHTML=Array.from({length:4}).map(()=>`
        <div class="skeleton-post" aria-hidden="true">
            <div class="skeleton-line skeleton-line-sm"></div>
            <div class="skeleton-line skeleton-line-lg"></div>
            <div class="skeleton-line skeleton-line-md"></div>
        </div>
    `).join("");

}

function renderEmpty(message){

    el.postList.innerHTML=`
        <div class="card" style="text-align:center;color:var(--sub);">
            <p>${escapeHtml(message)}</p>
        </div>
    `;

}

function setLoadMoreVisible(visible){

    if(!el.loadMoreWrap) return;

    el.loadMoreWrap.classList.toggle("hidden",!visible);

}

/* =====================================================
   FETCH
===================================================== */

async function fetchPage(){

    const client=getClient();

    if(!client){

        renderEmpty("게시글을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");

        setLoadMoreVisible(false);

        return;

    }

    if(state.loading || !state.hasMore) return;

    state.loading=true;

    const isFirstPage=state.page===0;

    if(isFirstPage) renderSkeleton();

    try{

        const from=state.page*PAGE_SIZE;
        const to=from+PAGE_SIZE-1;

        let query=client
            .from("posts")
            .select("id,title,content,category,view_count,like_count,comment_count,created_at,profiles(nickname)")
            .range(from,to);

        if(state.category){

            query=query.eq("category",state.category);

        }

        if(state.keyword){

            query=query.or(`title.ilike.%${state.keyword}%,content.ilike.%${state.keyword}%`);

        }

        query=state.sort==="popular"
            ? query.order("view_count",{ascending:false})
            : query.order("created_at",{ascending:false});

        const {data,error}=await query;

        if(error) throw error;

        if(isFirstPage && (!data || data.length===0)){

            renderEmpty(

                state.keyword
                    ? "검색 결과가 없습니다."
                    : "아직 등록된 게시글이 없습니다. 첫 글을 작성해보세요!"

            );

            if(el.feedCount) el.feedCount.textContent="";

            setLoadMoreVisible(false);

            return;

        }

        if(isFirstPage){

            el.postList.innerHTML=(data || []).map(postCardHTML).join("");

        }else{

            el.postList.insertAdjacentHTML("beforeend",(data || []).map(postCardHTML).join(""));

        }

        state.hasMore=(data || []).length===PAGE_SIZE;

        state.page+=1;

        setLoadMoreVisible(state.hasMore);

        if(el.feedCount){

            const countEl=document.querySelectorAll("#boardPostList .post-card").length;

            el.feedCount.textContent=`${countEl}개 표시 중`;

        }

    }

    catch(error){

        console.warn("게시글을 불러오지 못했습니다:",error.message || error);

        if(isFirstPage){

            renderEmpty("아직 등록된 게시글이 없습니다. 첫 글을 작성해보세요!");

            if(el.feedCount) el.feedCount.textContent="";

        }

        setLoadMoreVisible(false);

    }

    finally{

        state.loading=false;

    }

}

function resetAndFetch(){

    state.page=0;
    state.hasMore=true;

    fetchPage();

}

el.loadMoreBtn?.addEventListener("click",fetchPage);

/* =====================================================
   INIT
===================================================== */

syncCategoryChips();
updateHeaderText();

window.addEventListener("load",()=>{

    injectGradeChip();
    resetAndFetch();

});

})();
