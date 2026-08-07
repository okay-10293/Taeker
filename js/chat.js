/* =====================================================
   TAEKER 1:1 채팅
   chat.html 전용 로직
===================================================== */

"use strict";

(function(){

const el={

    loginRequired:document.getElementById("chatLoginRequired"),
    wrap:document.getElementById("chatWrap"),

    layout:document.querySelector(".chat-layout"),

    list:document.getElementById("chatList"),
    listEmpty:document.getElementById("chatListEmpty"),
    listEmptyText:document.getElementById("chatListEmptyText"),

    threadEmpty:document.getElementById("chatThreadEmpty"),
    thread:document.getElementById("chatThread"),
    backBtn:document.getElementById("chatBackBtn"),

    partnerAvatarInitial:document.getElementById("chatPartnerAvatarInitial"),
    partnerName:document.getElementById("chatPartnerName"),

    messages:document.getElementById("chatMessages"),

    form:document.getElementById("chatForm"),
    input:document.getElementById("chatInput"),
    sendBtn:document.getElementById("chatSendBtn")

};

if(!el.wrap) return;

let me=null;
let conversations=[];
let profileCache={};
let currentConversationId=null;
let currentPartnerId=null;
let messageChannel=null;

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

    if(!dateStr) return "";

    const date=new Date(dateStr);

    if(isNaN(date)) return "";

    const diff=Math.floor((Date.now()-date.getTime())/1000);

    if(diff<60) return "방금";
    if(diff<3600) return Math.floor(diff/60)+"분 전";
    if(diff<86400) return Math.floor(diff/3600)+"시간 전";
    if(diff<604800) return Math.floor(diff/86400)+"일 전";

    return date.toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"});

}

function formatMsgTime(dateStr){

    const date=new Date(dateStr);

    if(isNaN(date)) return "";

    return date.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});

}

function getClient(){

    return window.sb || null;

}

function partnerIdOf(conv){

    return conv.user_a_id===me ? conv.user_b_id : conv.user_a_id;

}

/* ---------- PROFILE CACHE ---------- */

async function ensureProfiles(userIds){

    const client=getClient();

    const missing=[...new Set(userIds)].filter((id)=>id && !profileCache[id]);

    if(!client || missing.length===0) return;

    const {data,error}=await client
        .from("profiles")
        .select("id,nickname,is_teacher")
        .in("id",missing);

    if(error){

        console.warn("프로필을 불러오지 못했습니다:",error.message || error);

        return;

    }

    (data||[]).forEach((p)=>{ profileCache[p.id]=p; });

}

/* ---------- CONVERSATION LIST ---------- */

function conversationItemHTML(conv){

    const partnerId=partnerIdOf(conv);
    const partner=profileCache[partnerId] || {};
    const nickname=partner.nickname || "알 수 없음";
    const initial=nickname.trim().charAt(0) || "태";
    const preview=conv.last_message ? escapeHtml(conv.last_message) : "대화를 시작해보세요.";
    const isActive=conv.id===currentConversationId ? "chat-list-item-active" : "";

    return `
        <button type="button" class="chat-list-item ${isActive}" data-conversation-id="${conv.id}" data-partner-id="${partnerId}">
            <span class="avatar-sm">
                <span>${escapeHtml(initial)}</span>
            </span>
            <span class="chat-list-item-body">
                <span class="chat-list-item-top">
                    <span class="chat-list-item-name">${escapeHtml(nickname)}</span>
                    <span class="chat-list-item-time">${timeAgo(conv.last_message_at)}</span>
                </span>
                <span class="chat-list-item-preview">${preview}</span>
            </span>
        </button>
    `;

}

async function loadConversations(){

    const client=getClient();

    if(!client || !me) return;

    const {data,error}=await client
        .from("conversations")
        .select("id,user_a_id,user_b_id,last_message,last_message_at,created_at")
        .or(`user_a_id.eq.${me},user_b_id.eq.${me}`)
        .order("last_message_at",{ascending:false,nullsFirst:false})
        .order("created_at",{ascending:false});

    if(error){

        console.warn("대화 목록을 불러오지 못했습니다:",error.message || error);

        el.list.innerHTML="";
        el.list.classList.add("hidden");

        if(el.listEmptyText){

            el.listEmptyText.innerHTML="대화 목록을 불러오지 못했어요.<br>잠시 후 다시 시도해주세요.";

        }

        el.listEmpty?.classList.remove("hidden");

        return;

    }

    if(el.listEmptyText){

        el.listEmptyText.innerHTML="아직 대화가 없어요.<br>상대방 프로필에서 '1:1 대화하기'를 눌러 시작해보세요.";

    }

    conversations=data || [];

    await ensureProfiles(conversations.map(partnerIdOf));

    if(conversations.length===0){

        el.list.innerHTML="";
        el.list.classList.add("hidden");
        el.listEmpty?.classList.remove("hidden");

        return;

    }

    el.listEmpty?.classList.add("hidden");
    el.list.classList.remove("hidden");

    el.list.innerHTML=conversations.map(conversationItemHTML).join("");

    el.list.querySelectorAll(".chat-list-item").forEach((item)=>{

        item.addEventListener("click",()=>{

            openConversation(item.dataset.conversationId,item.dataset.partnerId);

        });

    });

}

/* ---------- MESSAGES ---------- */

function messageBubbleHTML(msg){

    const mine=msg.sender_id===me;

    return `
        <div class="chat-bubble-row ${mine ? "chat-bubble-row-mine" : ""}">
            <div class="chat-bubble ${mine ? "chat-bubble-mine" : ""}">
                <span class="chat-bubble-text">${escapeHtml(msg.content)}</span>
            </div>
            <span class="chat-bubble-time">${formatMsgTime(msg.created_at)}</span>
        </div>
    `;

}

function renderMessages(list){

    el.messages.innerHTML=list.map(messageBubbleHTML).join("");
    el.messages.scrollTop=el.messages.scrollHeight;

}

function appendMessage(msg){

    const wasNearBottom=
        el.messages.scrollHeight-el.messages.scrollTop-el.messages.clientHeight<80;

    el.messages.insertAdjacentHTML("beforeend",messageBubbleHTML(msg));

    if(wasNearBottom){

        el.messages.scrollTop=el.messages.scrollHeight;

    }

}

async function markRead(conversationId){

    const client=getClient();

    if(!client || !me) return;

    await client
        .from("messages")
        .update({read_at:new Date().toISOString()})
        .eq("conversation_id",conversationId)
        .neq("sender_id",me)
        .is("read_at",null);

}

function subscribeToConversation(conversationId){

    const client=getClient();

    if(!client) return;

    if(messageChannel){

        client.removeChannel(messageChannel);
        messageChannel=null;

    }

    messageChannel=client
        .channel(`messages-${conversationId}`)
        .on(
            "postgres_changes",
            {
                event:"INSERT",
                schema:"public",
                table:"messages",
                filter:`conversation_id=eq.${conversationId}`
            },
            (payload)=>{

                const msg=payload.new;

                appendMessage(msg);

                if(msg.sender_id!==me){

                    markRead(conversationId);

                }

                loadConversations();

            }
        )
        .subscribe();

}

async function openConversation(conversationId,partnerId){

    currentConversationId=conversationId;
    currentPartnerId=partnerId;

    el.layout?.classList.add("chat-show-thread");

    el.threadEmpty?.classList.add("hidden");
    el.thread?.classList.remove("hidden");

    await ensureProfiles([partnerId]);

    const partner=profileCache[partnerId] || {};
    const nickname=partner.nickname || "알 수 없음";

    if(el.partnerName){

        el.partnerName.textContent=nickname;
        el.partnerName.href=`profile.html?id=${encodeURIComponent(partnerId)}`;

    }

    if(el.partnerAvatarInitial){

        el.partnerAvatarInitial.textContent=nickname.trim().charAt(0) || "태";

    }

    el.list.querySelectorAll(".chat-list-item").forEach((item)=>{

        item.classList.toggle(
            "chat-list-item-active",
            item.dataset.conversationId===conversationId
        );

    });

    el.messages.innerHTML=`<p class="widget-empty">불러오는 중...</p>`;

    const client=getClient();

    const {data,error}=await client
        .from("messages")
        .select("id,sender_id,content,created_at")
        .eq("conversation_id",conversationId)
        .order("created_at",{ascending:true})
        .limit(200);

    if(error){

        console.warn("메시지를 불러오지 못했습니다:",error.message || error);
        el.messages.innerHTML=`<p class="widget-empty">메시지를 불러오지 못했습니다.</p>`;

        return;

    }

    renderMessages(data || []);

    markRead(conversationId);
    subscribeToConversation(conversationId);

}

function closeThreadOnMobile(){

    el.layout?.classList.remove("chat-show-thread");

}

/* ---------- SEND ---------- */

async function sendMessage(e){

    e.preventDefault();

    const content=el.input.value.trim();

    if(!content || !currentConversationId) return;

    const client=getClient();

    el.sendBtn.disabled=true;

    const {error}=await client
        .from("messages")
        .insert({
            conversation_id:currentConversationId,
            sender_id:me,
            content
        });

    el.sendBtn.disabled=false;

    if(error){

        console.warn("메시지를 보내지 못했습니다:",error.message || error);
        window.toast?.("메시지를 보내지 못했습니다.");

        return;

    }

    el.input.value="";
    el.input.style.height="auto";

}

function autoResizeInput(){

    el.input.style.height="auto";
    el.input.style.height=Math.min(el.input.scrollHeight,120)+"px";

}

/* ---------- ?with= 파라미터로 바로 대화 시작 ---------- */

async function openDirectConversation(targetId){

    const client=getClient();

    if(!client || !targetId || targetId===me) return;

    try{

        const {data,error}=await client.rpc(
            "get_or_create_conversation",
            {target_id:targetId}
        );

        if(error) throw error;

        await loadConversations();
        await openConversation(data,targetId);

    }

    catch(error){

        console.warn("대화방을 열지 못했습니다:",error.message || error);
        window.toast?.("대화방을 열지 못했습니다.");

    }

}

/* ---------- INIT ---------- */

el.form?.addEventListener("submit",sendMessage);

el.input?.addEventListener("keydown",(e)=>{

    if(e.key==="Enter" && !e.shiftKey){

        e.preventDefault();
        sendMessage(e);

    }

});

el.input?.addEventListener("input",autoResizeInput);

el.backBtn?.addEventListener("click",closeThreadOnMobile);

window.addEventListener("load",async ()=>{

    let user=null;

    try{

        user=await window.Auth?.getCurrentUser();

    }

    catch(error){

        console.warn("로그인 상태를 확인하지 못했습니다:",error.message || error);

    }

    if(!user){

        el.loginRequired?.classList.remove("hidden");
        el.wrap?.classList.add("hidden");

        return;

    }

    me=user.id;

    el.loginRequired?.classList.add("hidden");
    el.wrap?.classList.remove("hidden");

    try{

        await loadConversations();

    }

    catch(error){

        console.warn("대화 목록을 불러오는 중 오류가 발생했습니다:",error.message || error);

        el.list.innerHTML="";
        el.list.classList.add("hidden");

        if(el.listEmptyText){

            el.listEmptyText.innerHTML="대화 목록을 불러오지 못했어요.<br>잠시 후 다시 시도해주세요.";

        }

        el.listEmpty?.classList.remove("hidden");

    }

    const params=new URLSearchParams(location.search);
    const withId=params.get("with");

    if(withId){

        await openDirectConversation(withId);

    }

});

})();
