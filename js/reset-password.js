/* =====================================================
   TAECKER RESET PASSWORD
   (login.html의 "비밀번호 찾기" 이메일 링크가 도착하는 페이지)
===================================================== */

"use strict";

const rpLoading=document.getElementById("resetPasswordLoading");
const rpCard=document.getElementById("resetPasswordCard");
const rpInvalid=document.getElementById("resetPasswordInvalid");

const rpForm=document.getElementById("resetPasswordForm");
const rpPassword=document.getElementById("newPassword");
const rpPasswordConfirm=document.getElementById("newPasswordConfirm");
const rpButton=document.getElementById("resetPasswordButton");
const rpMessage=document.getElementById("resetPasswordMessage");

let rpReady=false;
let rpResolved=false;

function rpShow(card){

    rpLoading?.classList.add("hidden");
    rpCard?.classList.add("hidden");
    rpInvalid?.classList.add("hidden");

    card?.classList.remove("hidden");

}

function rpMarkReady(){

    if(rpResolved){
        return;
    }

    rpResolved=true;
    rpReady=true;

    rpShow(rpCard);

}

function rpMarkInvalid(){

    if(rpResolved){
        return;
    }

    rpResolved=true;

    rpShow(rpInvalid);

}

/* 이메일 링크를 타고 들어오면 supabase-js가 URL의 토큰을 읽어
   자동으로 세션을 만들고 PASSWORD_RECOVERY 이벤트를 발생시킨다. */

window.sb.auth.onAuthStateChange((event,session)=>{

    if(event==="PASSWORD_RECOVERY" && session){
        rpMarkReady();
    }

});

window.addEventListener("load",async()=>{

    /* onAuthStateChange가 이미 처리했을 수도 있으니, 세션이
       있는지도 한 번 더 직접 확인한다. */

    const {data}=await window.sb.auth.getSession();

    if(data.session){
        rpMarkReady();
        return;
    }

    /* URL 처리가 조금 늦게 끝나는 경우를 대비해 잠시 기다렸다가
       그래도 세션이 없으면 링크가 잘못됐다고 안내한다. */

    setTimeout(async()=>{

        if(rpResolved){
            return;
        }

        const again=await window.sb.auth.getSession();

        if(again.data.session){
            rpMarkReady();
        }else{
            rpMarkInvalid();
        }

    },2000);

});

if(rpForm){

    rpForm.addEventListener("submit",async(event)=>{

        event.preventDefault();

        if(!rpReady){
            return;
        }

        const password=rpPassword.value;
        const passwordConfirm=rpPasswordConfirm.value;

        if(password.length<6){
            rpMessage.textContent="비밀번호는 6자 이상이어야 합니다.";
            rpMessage.style.color="#DC2626";
            return;
        }

        if(password!==passwordConfirm){
            rpMessage.textContent="비밀번호가 일치하지 않습니다.";
            rpMessage.style.color="#DC2626";
            return;
        }

        rpMessage.textContent="";
        rpButton.disabled=true;

        const {error}=await window.sb.auth.updateUser({password});

        rpButton.disabled=false;

        if(error){
            toast("비밀번호 변경에 실패했습니다. 다시 시도해주세요.");
            return;
        }

        toast("비밀번호가 변경되었습니다. 다시 로그인해주세요.");

        await window.sb.auth.signOut();

        setTimeout(()=>{
            location.href="login.html";
        },900);

    });

}
