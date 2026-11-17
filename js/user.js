/* 고닉 프로필 - user.html?nick=닉네임 */
"use strict";
(function(){
const box=document.getElementById("userBox");
if(!box) return;
const esc=(s)=>typeof escapeHtml==="function"?escapeHtml(String(s??"")):String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nick=(new URLSearchParams(location.search).get("nick")||"").trim();
const fmt=(t)=>{const d=new Date(t);return isNaN(d)?"":`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;};
const empty=(m)=>{box.innerHTML=`<div class="card user-card"><p class="user-empty">${esc(m)}</p></div>`;};

async function run(){
    if(!nick) return empty("닉네임이 없어요.");
    const sb=window.sb;
    if(!sb) return empty("불러오지 못했어요.");
    const {data:p,error}=await sb.rpc("fixed_nick_profile",{p_nickname:nick});
    if(error) return empty("불러오지 못했어요.");
    if(!p) return empty("존재하지 않는 고정닉이에요.");
    const {data:posts}=await sb.from("posts")
        .select("id,title,like_count,comment_count,created_at")
        .eq("is_fixed",true).eq("nickname",p.nickname)
        .order("created_at",{ascending:false}).limit(100);
    const list=(posts||[]).map(x=>`
        <a class="user-post" href="post.html?id=${encodeURIComponent(x.id)}">
            <span class="user-post-title">${esc(x.title)}</span>
            <span class="user-post-meta">♥ ${x.like_count||0} · 댓글 ${x.comment_count||0} · ${fmt(x.created_at)}</span>
        </a>`).join("");
    box.innerHTML=`
        <div class="card user-card">
            <div class="user-head"><span class="user-name">${esc(p.nickname)}</span><span class="fixed-badge-sm">고닉</span></div>
            <div class="user-since">${fmt(p.since)}부터 활동</div>
            <div class="user-stats">
                <div><b>${p.post_count}</b><span>쓴 글</span></div>
                <div><b>${p.like_total}</b><span>받은 좋아요</span></div>
                <div><b>${p.comment_count}</b><span>쓴 댓글</span></div>
            </div>
        </div>
        <div class="card user-posts">
            <h3>쓴 글</h3>
            ${list||'<p class="user-empty">아직 쓴 글이 없어요.</p>'}
        </div>`;
    document.title=`${p.nickname} | 태커`;
}
run();
})();
