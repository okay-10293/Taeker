/* =====================================================
   TAECKER AUTH (비로그인 운영 버전)

   - 일반 사용자는 로그인하지 않는다. 글/댓글은 닉네임 + 비밀번호로 작성하고
     수정/삭제도 그 비밀번호로 한다 (디시인사이드 방식).
   - Supabase 로그인은 "관리자 전용"으로만 남아 있다 (login.html → admin.html).
   - window.sb      : Supabase 클라이언트
   - window.Auth    : 관리자 세션 헬퍼
   - window.AnonAPI : 비로그인 글/댓글/추천/신고/문의 API (DB의 RPC 함수 호출)
===================================================== */

"use strict";

/* =====================================================
   SUPABASE
===================================================== */

const SUPABASE_URL="https://tywbdarlmyxitskxwreu.supabase.co";

const SUPABASE_KEY="sb_publishable_iRkBObTciH_A31nh_XWaQA_c7Xz7MC0";

/*
    주의: 변수명을 "supabase"로 지으면 CDN이 전역에 심어둔 window.supabase와
    이름이 겹치므로 클라이언트는 sb 라는 이름으로 만들고, 다른 파일에서는
    항상 window.sb 로 접근한다.
*/

let sb=null;

try{

    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

}

catch(error){

    console.error("Supabase 클라이언트 생성 실패:",error);

}

window.sb=sb;

/* =====================================================
   ADMIN AUTH (관리자만 로그인)
===================================================== */

async function getCurrentUser(){

    if(!sb) return null;

    try{

        const {data}=await sb.auth.getSession();

        return data?.session?.user ?? null;

    }

    catch(error){

        return null;

    }

}

/* 로그인한 계정의 프로필 (관리자 계정만 존재). 로그인 상태가 아니면 null */

let profileCache=null;

async function getProfile(){

    const user=await getCurrentUser();

    if(!user){

        profileCache=null;

        return null;

    }

    if(profileCache && profileCache.id===user.id) return profileCache;

    const {data,error}=await sb
        .from("profiles")
        .select("*")
        .eq("id",user.id)
        .maybeSingle();

    if(error || !data) return null;

    profileCache=data;

    return data;

}

const getCachedProfile=getProfile;

async function isAdmin(){

    const profile=await getProfile();

    return profile?.is_admin===true;

}

async function login(email,password){

    if(!sb) throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.");

    const {data,error}=await sb.auth.signInWithPassword({email,password});

    if(error){

        throw new Error(
            /invalid login credentials/i.test(error.message)
                ? "이메일 또는 비밀번호가 올바르지 않아요."
                : error.message
        );

    }

    profileCache=null;

    const profile=await getProfile();

    if(!profile?.is_admin){

        await sb.auth.signOut();

        throw new Error("관리자 계정이 아니에요.");

    }

    return data;

}

async function logout(){

    try{ await sb?.auth.signOut(); }

    catch(error){ /* 무시 */ }

    profileCache=null;

    window.Taecker?.toast?.("로그아웃되었습니다.");

    setTimeout(()=>{ location.href="index.html"; },400);

}

/* 관리자 전용 페이지 가드: 관리자가 아니면 로그인 페이지로 */

async function requireAuth(){

    if(await isAdmin()) return true;

    window.Taecker?.toast?.("관리자 로그인이 필요합니다.");

    setTimeout(()=>{ location.href="login.html"; },600);

    return false;

}

async function refreshSession(){

    const {data,error}=await sb.auth.refreshSession();

    return error ? null : data.session;

}

async function isLoggedIn(){

    return !!(await getCurrentUser());

}

async function getAccessToken(){

    const {data}=await sb.auth.getSession();

    return data?.session?.access_token ?? null;

}

window.Auth={

    login,
    logout,
    getCurrentUser,
    getProfile,
    getCachedProfile,
    isAdmin,
    requireAuth,
    refreshSession,
    isLoggedIn,
    getAccessToken

};

window.TaeckerAuth={ supabase:sb, Auth:window.Auth };

/* =====================================================
   ANON API (비로그인 글/댓글/추천/신고/문의)
   모든 쓰기는 DB의 RPC 함수로만 이루어진다 (sql/anonymous_mode.sql).
   수정/삭제 계열은 'ok' | 'wrong' | 'locked' | 'notfound' 를 돌려준다.
===================================================== */

const CLIENT_ID_KEY="taeker_client_id";

const NICK_KEY="taeker_nick";

let memoryClientId=null;

/* 기기 식별값: 추천 중복 방지/도배 방지/신고 중복 방지에만 쓰이는 임의의 문자열 */

function getClientId(){

    try{

        let id=localStorage.getItem(CLIENT_ID_KEY);

        if(id && id.length>=8) return id;

        id=makeRandomId();

        localStorage.setItem(CLIENT_ID_KEY,id);

        return id;

    }

    catch(error){

        if(!memoryClientId) memoryClientId=makeRandomId();

        return memoryClientId;

    }

}

function makeRandomId(){

    if(window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g,"");

    return Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join("");

}

/* 마지막으로 쓴 닉네임을 기억해서 다음에 자동으로 채워준다 (비밀번호는 저장하지 않음) */

function getSavedNick(){

    try{ return localStorage.getItem(NICK_KEY) || ""; }

    catch(error){ return ""; }

}

function saveNick(nick){

    try{ localStorage.setItem(NICK_KEY,nick); }

    catch(error){ /* 무시 */ }

}

const STATUS_MESSAGE={

    wrong:"비밀번호가 일치하지 않아요.",
    locked:"비밀번호를 여러 번 틀려서 10분 동안 잠겼어요.",
    notfound:"이미 삭제되었거나 수정할 수 없는 글이에요."

};

/* 'ok'가 아닌 상태 문자열 → 사용자에게 보여줄 문구 */

function explainStatus(status){

    return STATUS_MESSAGE[status] || "요청을 처리하지 못했어요.";

}

async function rpc(name,args){

    if(!sb) throw new Error("서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.");

    const {data,error}=await sb.rpc(name,args);

    if(error){

        /* DB 함수가 직접 던진 안내 문구(errcode P0001)는 그대로 보여주고, 나머지는 일반 문구로 */

        throw new Error(
            error.code==="P0001" && error.message
                ? error.message
                : "요청에 실패했어요. 잠시 후 다시 시도해주세요."
        );

    }

    return data;

}

window.AnonAPI={

    getClientId,
    getSavedNick,
    saveNick,
    explainStatus,

    createPost({nickname,password,title,content,category}){

        return rpc("create_post",{
            p_nickname:nickname,
            p_password:password,
            p_title:title,
            p_content:content,
            p_category:category,
            p_client_id:getClientId()
        });

    },

    updatePost({id,password,title,content}){

        return rpc("update_post",{p_id:id,p_password:password,p_title:title,p_content:content});

    },

    deletePost(id,password){

        return rpc("delete_post",{p_id:id,p_password:password});

    },

    createComment({postId,nickname,password,content}){

        return rpc("create_comment",{
            p_post_id:postId,
            p_nickname:nickname,
            p_password:password,
            p_content:content,
            p_client_id:getClientId()
        });

    },

    deleteComment(id,password){

        return rpc("delete_comment",{p_id:id,p_password:password});

    },

    /* → {liked:boolean, like_count:number} */

    toggleLike(postId){

        return rpc("toggle_like",{p_post_id:postId,p_client_id:getClientId()});

    },

    hasLiked(postId){

        return rpc("has_liked",{p_post_id:postId,p_client_id:getClientId()});

    },

    submitReport({targetType,targetId,reason}){

        return rpc("submit_report",{
            p_target_type:targetType,
            p_target_id:targetId,
            p_reason:reason,
            p_client_id:getClientId()
        });

    },

    /* → 접수번호(문자열). 이 번호로 답변을 조회한다 */

    submitInquiry({nickname,contact,content}){

        return rpc("submit_inquiry",{
            p_nickname:nickname || "",
            p_contact:contact || "",
            p_content:content,
            p_client_id:getClientId()
        });

    },

    /* → {content,status,admin_reply,created_at,replied_at} | null */

    async lookupInquiry(code){

        const rows=await rpc("lookup_inquiry",{p_code:code});

        return Array.isArray(rows) && rows.length ? rows[0] : null;

    }

};

console.log("Taeker Auth Loaded");
