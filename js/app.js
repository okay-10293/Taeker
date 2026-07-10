/* =====================================================
   Taecker Community
   app.js Rev.2
===================================================== */

"use strict";

/* =====================================================
   ELEMENT
===================================================== */

const menuBtn = document.getElementById("menuBtn");

const sidebar = document.getElementById("sidebar");

const overlay = document.getElementById("overlay");

const writeBtn = document.getElementById("writeBtn");

/* =====================================================
   SIDEBAR
===================================================== */

function openSidebar(){

    sidebar.classList.add("active");

    overlay.classList.add("active");

    document.body.style.overflow="hidden";

}

function closeSidebar(){

    sidebar.classList.remove("active");

    overlay.classList.remove("active");

    document.body.style.overflow="";

}

function toggleSidebar(){

    sidebar.classList.toggle("active");

    overlay.classList.toggle("active");

    if(sidebar.classList.contains("active")){

        document.body.style.overflow="hidden";

    }else{

        document.body.style.overflow="";

    }

}

/* =====================================================
   EVENT
===================================================== */

menuBtn?.addEventListener("click",toggleSidebar);

overlay?.addEventListener("click",closeSidebar);

document.addEventListener("keydown",(e)=>{

    if(e.key==="Escape"){

        closeSidebar();

    }

});

/* =====================================================
   FAB
   (auth-aware handler attached in HOME FEED section below)
===================================================== */

/* =====================================================
   TOAST
===================================================== */

function toast(message){

    let toast=document.querySelector(".toast");

    if(!toast){

        toast=document.createElement("div");

        toast.className="toast";

        document.body.appendChild(toast);

    }

    toast.textContent=message;

    toast.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer=setTimeout(()=>{

        toast.classList.remove("show");

    },2500);

}

/* =====================================================
   CARD ANIMATION
===================================================== */

const cards=document.querySelectorAll(".card");

cards.forEach((card,index)=>{

    card.style.opacity="0";

    card.style.transform="translateY(18px)";

    setTimeout(()=>{

        card.style.transition=".35s ease";

        card.style.opacity="1";

        card.style.transform="translateY(0)";

    },index*80);

});
/* =====================================================
   ACTIVE NAVIGATION
===================================================== */

const currentPage = window.location.pathname.split("/").pop();

document.querySelectorAll(".bottom-nav a").forEach((link)=>{

    const href = link.getAttribute("href");

    if(href===currentPage){

        link.classList.add("active");

    }

});

/* =====================================================
   LOADING
===================================================== */

function showLoader(){

    let loader=document.querySelector(".loader-wrapper");

    if(loader) return;

    loader=document.createElement("div");

    loader.className="loader-wrapper";

    loader.innerHTML=`
        <div class="loader"></div>
    `;

    loader.style.position="fixed";
    loader.style.inset="0";
    loader.style.display="flex";
    loader.style.justifyContent="center";
    loader.style.alignItems="center";
    loader.style.background="rgba(255,255,255,.6)";
    loader.style.backdropFilter="blur(3px)";
    loader.style.zIndex="9999";

    document.body.appendChild(loader);

}

function hideLoader(){

    document
        .querySelector(".loader-wrapper")
        ?.remove();

}

/* =====================================================
   MODAL
===================================================== */

function openModal(id){

    document
        .getElementById(id)
        ?.classList
        .add("active");

}

function closeModal(id){

    document
        .getElementById(id)
        ?.classList
        .remove("active");

}

/* =====================================================
   PAGE MOVE
===================================================== */

function move(url){

    showLoader();

    setTimeout(()=>{

        location.href=url;

    },250);

}

/* =====================================================
   SMOOTH SCROLL
===================================================== */

document
.querySelectorAll('a[href^="#"]')
.forEach((anchor)=>{

    const href=anchor.getAttribute("href");

    if(!href || href.length<2) return;

    anchor.addEventListener("click",(e)=>{

        const target=document.querySelector(href);

        if(!target) return;

        e.preventDefault();

        target.scrollIntoView({

            behavior:"smooth"

        });

    });

});

/* =====================================================
   COMING SOON LINKS
===================================================== */

document.addEventListener("click",(e)=>{

    const el=e.target.closest("[data-soon]");

    if(!el) return;

    e.preventDefault();

    toast(el.dataset.soon);

});

/* =====================================================
   INIT
===================================================== */

window.addEventListener("load",()=>{

    hideLoader();

    console.log("Taecker Ready");

});
/* =====================================================
   LOCAL STORAGE
===================================================== */

const Storage = {

    set(key,value){

        localStorage.setItem(

            key,

            JSON.stringify(value)

        );

    },

    get(key,defaultValue=null){

        const value=localStorage.getItem(key);

        if(!value){

            return defaultValue;

        }

        try{

            return JSON.parse(value);

        }catch{

            return defaultValue;

        }

    },

    remove(key){

        localStorage.removeItem(key);

    }

};

/* =====================================================
   THEME
===================================================== */

const savedTheme=Storage.get("theme","light");

if(savedTheme==="dark"){

    document.body.classList.add("dark");

}

function toggleTheme(){

    document.body.classList.toggle("dark");

    Storage.set(

        "theme",

        document.body.classList.contains("dark")

            ? "dark"

            : "light"

    );

}

/* =====================================================
   FETCH
===================================================== */

async function request(url,options={}){

    try{

        const response=await fetch(url,options);

        if(!response.ok){

            throw new Error(response.status);

        }

        return await response.json();

    }

    catch(error){

        console.error(error);

        toast("네트워크 오류가 발생했습니다.");

        return null;

    }

}

/* =====================================================
   GLOBAL ERROR
===================================================== */

window.addEventListener("error",(event)=>{

    console.error(event.error);

});

/* =====================================================
   GLOBAL OBJECT
===================================================== */

window.Taecker={

    toast,

    move,

    request,

    openModal,

    closeModal,

    showLoader,

    hideLoader,

    toggleTheme,

    Storage

};

/* =====================================================
   READY
===================================================== */

console.log("Taecker App Loaded");

/* =====================================================
   HOME FEED
   Header auth state, dropdowns, search, categories,
   post list + popular list (Supabase-ready)
===================================================== */

(function(){

"use strict";

/* ---------- ELEMENTS ---------- */

const el={

    themeToggleBtn:document.getElementById("themeToggleBtn"),

    searchToggleBtn:document.getElementById("searchToggleBtn"),
    headerSearchWrap:document.getElementById("headerSearchWrap"),
    searchInput:document.getElementById("searchInput"),

    notifBtn:document.getElementById("notifBtn"),
    notifMenu:document.getElementById("notifMenu"),

    profileBtn:document.getElementById("profileBtn"),
    profileMenu:document.getElementById("profileMenu"),
    profileDropdown:document.getElementById("profileDropdown"),

    authArea:document.getElementById("authArea"),
    logoutBtn:document.getElementById("logoutBtn"),

    headerAvatarImg:document.getElementById("headerAvatarImg"),
    headerAvatarInitial:document.getElementById("headerAvatarInitial"),
    headerNickname:document.getElementById("headerNickname"),

    menuAvatarImg:document.getElementById("menuAvatarImg"),
    menuAvatarInitial:document.getElementById("menuAvatarInitial"),
    menuNickname:document.getElementById("menuNickname"),
    menuEmail:document.getElementById("menuEmail"),

    heroGreeting:document.getElementById("heroGreeting"),
    heroSubtext:document.getElementById("heroSubtext"),

    headerWriteBtn:document.getElementById("headerWriteBtn"),
    writeBtn:document.getElementById("writeBtn"),
    bottomNavMy:document.getElementById("bottomNavMy"),

    categoryBar:document.getElementById("categoryBar"),
    feedTabs:document.getElementById("feedTabs"),
    postList:document.getElementById("postList"),
    feedCount:document.getElementById("feedCount"),

    popularList:document.getElementById("popularList"),
    popularEmpty:document.getElementById("popularEmpty")

};

const CATEGORY_LABEL={

    notice:"공지",
    free:"자유",
    question:"질문",
    info:"정보"

};

const state={

    category:"",
    sort:"latest",
    keyword:"",
    loggedIn:false

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

/* ---------- DROPDOWNS ---------- */

function setupDropdown(triggerBtn,menuEl){

    if(!triggerBtn || !menuEl) return;

    triggerBtn.addEventListener("click",(e)=>{

        e.stopPropagation();

        const isActive=menuEl.classList.contains("active");

        closeAllDropdowns();

        if(!isActive){

            menuEl.classList.add("active");
            triggerBtn.setAttribute("aria-expanded","true");

        }

    });

}

function closeAllDropdowns(){

    document.querySelectorAll(".dropdown-menu.active").forEach((menu)=>{

        menu.classList.remove("active");

    });

    document.querySelectorAll('[aria-expanded="true"]').forEach((btn)=>{

        btn.setAttribute("aria-expanded","false");

    });

}

document.addEventListener("click",closeAllDropdowns);

document.addEventListener("keydown",(e)=>{

    if(e.key==="Escape") closeAllDropdowns();

});

setupDropdown(el.notifBtn,el.notifMenu);
setupDropdown(el.profileBtn,el.profileMenu);

/* ---------- THEME TOGGLE (HEADER ICON) ---------- */

el.themeToggleBtn?.addEventListener("click",()=>{

    window.Taecker?.toggleTheme?.();

});

/* ---------- SEARCH ---------- */

el.searchToggleBtn?.addEventListener("click",()=>{

    el.headerSearchWrap?.classList.toggle("header-search-mobile-open");

    el.searchInput?.focus();

});

el.searchInput?.addEventListener("input",debounce((e)=>{

    state.keyword=e.target.value.trim();

    fetchPosts();

},350));

/* ---------- CATEGORY CHIPS ---------- */

el.categoryBar?.addEventListener("click",(e)=>{

    const chip=e.target.closest(".chip");

    if(!chip) return;

    el.categoryBar.querySelectorAll(".chip").forEach((c)=>c.classList.remove("active"));

    chip.classList.add("active");

    state.category=chip.dataset.category || "";

    fetchPosts();

});

/* ---------- SORT TABS ---------- */

el.feedTabs?.addEventListener("click",(e)=>{

    const tab=e.target.closest(".feed-tab");

    if(!tab) return;

    el.feedTabs.querySelectorAll(".feed-tab").forEach((t)=>t.classList.remove("active"));

    tab.classList.add("active");

    state.sort=tab.dataset.sort;

    fetchPosts();

});

/* ---------- SUPABASE ACCESS ---------- */

function getClient(){

    return window.sb || null;

}

/* ---------- POST RENDERING ---------- */

function postCardHTML(post){

    const nickname=escapeHtml(post.profiles?.nickname || post.author_name || "익명");
    const categoryLabel=CATEGORY_LABEL[post.category] || "일반";
    const excerpt=stripAndTruncate(post.content,90);

    return `
        <a class="post-card post-card-link fade-in" href="board.html">
            <div class="post-header">
                <span class="post-title">
                    <span class="badge post-category-badge">${categoryLabel}</span>${escapeHtml(post.title)}
                </span>
            </div>
            <p class="post-excerpt">${escapeHtml(excerpt)}</p>
            <div class="post-meta" style="margin-bottom:10px;">${nickname} · ${timeAgo(post.created_at)}</div>
            <div class="post-footer">
                <span class="post-footer-item">👁 ${post.view_count ?? 0}</span>
                <span class="post-footer-item">❤ ${post.like_count ?? 0}</span>
                <span class="post-footer-item">💬 ${post.comment_count ?? 0}</span>
            </div>
        </a>
    `;

}

function renderSkeleton(){

    el.postList.innerHTML=Array.from({length:3}).map(()=>`
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

async function fetchPosts(){

    if(!el.postList) return;

    const client=getClient();

    if(!client){

        renderEmpty("게시글을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");

        return;

    }

    renderSkeleton();

    try{

        let query=client
            .from("posts")
            .select("id,title,content,category,view_count,like_count,comment_count,created_at,profiles(nickname)")
            .limit(20);

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

        if(!data || data.length===0){

            renderEmpty(
                state.keyword
                    ? "검색 결과가 없습니다."
                    : "아직 등록된 게시글이 없습니다. 첫 글을 작성해보세요!"
            );

            if(el.feedCount) el.feedCount.textContent="";

            return;

        }

        el.postList.innerHTML=data.map(postCardHTML).join("");

        if(el.feedCount) el.feedCount.textContent=`전체 ${data.length}개`;

    }

    catch(error){

        console.warn("게시글을 불러오지 못했습니다:",error.message || error);

        renderEmpty("아직 등록된 게시글이 없습니다. 첫 글을 작성해보세요!");

        if(el.feedCount) el.feedCount.textContent="";

    }

}

/* ---------- POPULAR LIST ---------- */

async function fetchPopular(){

    if(!el.popularList) return;

    const client=getClient();

    if(!client){

        if(el.popularEmpty) el.popularEmpty.textContent="인기 게시글을 불러올 수 없습니다.";

        return;

    }

    try{

        const {data,error}=await client
            .from("posts")
            .select("id,title,view_count")
            .order("view_count",{ascending:false})
            .limit(5);

        if(error) throw error;

        if(!data || data.length===0){

            if(el.popularEmpty) el.popularEmpty.textContent="아직 인기 게시글이 없습니다.";

            return;

        }

        el.popularList.innerHTML=data.map((post,index)=>`
            <a class="popular-item" href="board.html">
                <span class="popular-rank">${index+1}</span>
                <span class="popular-info">
                    <span class="popular-title">${escapeHtml(post.title)}</span>
                    <span class="popular-meta">조회 ${post.view_count ?? 0}</span>
                </span>
            </a>
        `).join("");

    }

    catch(error){

        console.warn("인기글을 불러오지 못했습니다:",error.message || error);

        if(el.popularEmpty) el.popularEmpty.textContent="아직 인기 게시글이 없습니다.";

    }

}

/* ---------- AUTH-AWARE HEADER ---------- */

function setAvatar(imgEl,initialEl,profile){

    const avatarUrl=profile?.avatar_url;

    if(avatarUrl && imgEl){

        imgEl.src=avatarUrl;
        imgEl.classList.remove("hidden");
        initialEl?.classList.add("hidden");

    }else{

        imgEl?.classList.add("hidden");
        initialEl?.classList.remove("hidden");

        if(initialEl){

            const nickname=profile?.nickname || "회원";
            initialEl.textContent=nickname.charAt(0);

        }

    }

}

async function renderAuthUI(){

    const client=getClient();

    if(!client || !window.Auth){

        state.loggedIn=false;

        return;

    }

    try{

        const user=await window.Auth.getCurrentUser();

        if(!user){

            state.loggedIn=false;

            el.authArea?.classList.remove("hidden");
            el.profileDropdown?.classList.add("hidden");

            if(el.heroGreeting) el.heroGreeting.textContent="안녕하세요, 태커에 오신 것을 환영합니다.";
            if(el.heroSubtext) el.heroSubtext.textContent="로그인하고 자유롭게 소통해보세요.";

            return;

        }

        state.loggedIn=true;

        const profile=await window.Auth.getCachedProfile();
        const nickname=profile?.nickname || user.email?.split("@")[0] || "회원";

        el.authArea?.classList.add("hidden");
        el.profileDropdown?.classList.remove("hidden");

        if(el.headerNickname) el.headerNickname.textContent=nickname;
        if(el.menuNickname) el.menuNickname.textContent=nickname;
        if(el.menuEmail) el.menuEmail.textContent=user.email || "";

        setAvatar(el.headerAvatarImg,el.headerAvatarInitial,{...profile,nickname});
        setAvatar(el.menuAvatarImg,el.menuAvatarInitial,{...profile,nickname});

        if(el.heroGreeting) el.heroGreeting.textContent=`안녕하세요, ${nickname}님.`;
        if(el.heroSubtext) el.heroSubtext.textContent="오늘도 좋은 하루 보내세요.";

        /* ---- 관리자 전용 메뉴 (is_admin 계정에게만 노출) ---- */

        if(profile?.is_admin && el.profileMenu && !document.getElementById("adminMenuLink")){

            const divider=el.profileMenu.querySelector(".dropdown-divider");

            const adminLink=document.createElement("a");

            adminLink.href="admin.html";
            adminLink.id="adminMenuLink";
            adminLink.className="dropdown-item";
            adminLink.textContent="관리자 패널";

            if(divider){

                el.profileMenu.insertBefore(adminLink,divider);

            }else{

                el.profileMenu.appendChild(adminLink);

            }

        }

    }

    catch(error){

        console.warn("로그인 상태를 확인하지 못했습니다:",error.message || error);

        state.loggedIn=false;

    }

}

/* ---------- LOGOUT ---------- */

el.logoutBtn?.addEventListener("click",()=>{

    window.Auth?.logout?.();

});

/* ---------- WRITE BUTTON (AUTH GUARD) ---------- */

function handleWriteClick(){

    if(!state.loggedIn){

        toast("로그인이 필요합니다.");

        setTimeout(()=>{ location.href="login.html"; },600);

        return;

    }

    toast("글쓰기 페이지는 준비 중입니다.");

}

el.headerWriteBtn?.addEventListener("click",handleWriteClick);
el.writeBtn?.addEventListener("click",handleWriteClick);

/* ---------- BOTTOM NAV "마이" ---------- */

el.bottomNavMy?.addEventListener("click",(e)=>{

    e.preventDefault();

    if(!state.loggedIn){

        location.href="login.html";

        return;

    }

    location.href="mypage.html";

});

/* ---------- INIT ---------- */

window.addEventListener("load",()=>{

    renderAuthUI();
    fetchPosts();
    fetchPopular();

});

})();
