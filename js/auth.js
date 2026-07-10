/* =====================================================
   TAECKER AUTH
===================================================== */

"use strict";

/* =====================================================
   STATE
===================================================== */

const AuthState={

    loading:false,

    remember:false,

    capslock:false,

    passwordVisible:false

};

/* =====================================================
   DOM
===================================================== */

const form=document.getElementById("loginForm");

const emailInput=document.getElementById("email");

const passwordInput=document.getElementById("password");

const loginButton=document.getElementById("loginButton");

const togglePasswordButton=document.getElementById("togglePassword");

const emailMessage=document.getElementById("emailMessage");

const passwordMessage=document.getElementById("passwordMessage");

const rememberCheckbox=document.getElementById("rememberMe");

const capslockMessage=document.getElementById("capsLockMessage");

const passwordStrengthBar=document.getElementById("passwordStrengthBar");

const passwordStrengthText=document.getElementById("passwordStrengthText");

/* =====================================================
   UTIL
===================================================== */

function setMessage(element,message,color="#64748B"){

    if(!element){

        return;

    }

    element.textContent=message;

    element.style.color=color;

}

function enableButton(){

    if(!loginButton){

        return;

    }

    loginButton.disabled=false;

}

function disableButton(){

    if(!loginButton){

        return;

    }

    loginButton.disabled=true;

}

function sanitize(value){

    return value.trim();

}

/* =====================================================
   EMAIL VALIDATION
===================================================== */

function validateEmail(email){

    email=sanitize(email);

    const regex=

        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(email.length===0){

        return{

            valid:false,

            message:"이메일을 입력하세요."

        };

    }

    if(!regex.test(email)){

        return{

            valid:false,

            message:"올바른 이메일 형식이 아닙니다."

        };

    }

    return{

        valid:true,

        message:"올바른 이메일 형식입니다."

    };

}

/* =====================================================
   PASSWORD VALIDATION
===================================================== */

function validatePassword(password){

    if(password.length===0){

        return{

            valid:false,

            message:"비밀번호를 입력하세요."

        };

    }

    if(password.length<8){

        return{

            valid:false,

            message:"8자 이상 입력해주세요."

        };

    }

    return{

        valid:true,

        message:"입력을 완료했습니다."

    };

}

/* =====================================================
   PASSWORD STRENGTH
===================================================== */

function calculateStrength(password){

    let score=0;

    if(password.length>=8){

        score++;

    }

    if(/[A-Z]/.test(password)){

        score++;

    }

    if(/[a-z]/.test(password)){

        score++;

    }

    if(/[0-9]/.test(password)){

        score++;

    }

    if(/[^A-Za-z0-9]/.test(password)){

        score++;

    }

    return score;

}

function updateStrength(password){

    if(

        !passwordStrengthBar ||

        !passwordStrengthText

    ){

        return;

    }

    const score=

        calculateStrength(password);

    let width="0%";

    let color="#DC2626";

    let text="매우 약함";

    switch(score){

        case 1:

            width="20%";

            break;

        case 2:

            width="40%";

            color="#F97316";

            text="약함";

            break;

        case 3:

            width="60%";

            color="#F59E0B";

            text="보통";

            break;

        case 4:

            width="80%";

            color="#22C55E";

            text="강함";

            break;

        case 5:

            width="100%";

            color="#16A34A";

            text="매우 강함";

            break;

    }

    passwordStrengthBar.style.width=width;

    passwordStrengthBar.style.background=color;

    passwordStrengthText.textContent=text;

}
/* =====================================================
   REALTIME VALIDATION
   (로그인 페이지는 회원가입 페이지가 아니므로,
   타이핑 중 "올바른 형식입니다" 같은 실시간 안내 문구는
   띄우지 않는다. 실제 로그인 실패 시 나오는
   "이메일 또는 비밀번호가 올바르지 않습니다." 안내는
   translateError()를 통해 toast로 그대로 유지된다.)
===================================================== */

/* =====================================================
   CAPS LOCK
===================================================== */

function updateCapsLock(event){

    if(!capslockMessage){

        return;

    }

    const enabled=

        event.getModifierState(

            "CapsLock"

        );

    AuthState.capslock=enabled;

    capslockMessage.classList.toggle(

        "hidden",

        !enabled

    );

}

if(passwordInput){

    passwordInput.addEventListener(

        "keyup",

        updateCapsLock

    );

    passwordInput.addEventListener(

        "keydown",

        updateCapsLock

    );

}

/* =====================================================
   PASSWORD TOGGLE
===================================================== */

function togglePassword(){

    if(!passwordInput){

        return;

    }

    AuthState.passwordVisible=

        !AuthState.passwordVisible;

    passwordInput.type=

        AuthState.passwordVisible

            ? "text"

            : "password";

    if(togglePasswordButton){

        togglePasswordButton.textContent=

            AuthState.passwordVisible

                ? "숨기기"

                : "보기";

    }

}

if(togglePasswordButton){

    togglePasswordButton.addEventListener(

        "click",

        togglePassword

    );

}

/* =====================================================
   REMEMBER ME
===================================================== */

const rememberedEmail=

    Storage.get(

        "rememberEmail",

        ""

    );

if(

    rememberedEmail &&

    emailInput

){

    emailInput.value=

        rememberedEmail;

    if(rememberCheckbox){

        rememberCheckbox.checked=true;

    }

    AuthState.remember=true;

}

if(rememberCheckbox){

    rememberCheckbox.addEventListener(

        "change",

        ()=>{

            AuthState.remember=

                rememberCheckbox.checked;

        }

    );

}

function saveRememberEmail(){

    if(!emailInput){

        return;

    }

    if(AuthState.remember){

        Storage.set(

            "rememberEmail",

            sanitize(

                emailInput.value

            )

        );

    }else{

        Storage.remove(

            "rememberEmail"

        );

    }

}

/* =====================================================
   ENTER LOGIN
===================================================== */

document.addEventListener(

    "keydown",

    (event)=>{

        if(

            event.key==="Enter" &&

            document.activeElement===passwordInput

        ){

            event.preventDefault();

            form?.requestSubmit();

        }

    }

);
/* =====================================================
   LOGIN LOADING
===================================================== */

function setLoading(state){

    AuthState.loading=state;

    if(!loginButton){

        return;

    }

    loginButton.disabled=state;

    const text=

        loginButton.querySelector(

            ".button-text"

        );

    const loader=

        loginButton.querySelector(

            ".button-loader"

        );

    if(text){

        text.style.display=

            state

                ? "none"

                : "inline-flex";

    }

    if(loader){

        loader.classList.toggle(

            "hidden",

            !state

        );

    }

    if(emailInput){

        emailInput.disabled=state;

    }

    if(passwordInput){

        passwordInput.disabled=state;

    }

    if(togglePasswordButton){

        togglePasswordButton.disabled=state;

    }

}

/* =====================================================
   FORM VALIDATION
===================================================== */

function validateForm(){

    const email=

        validateEmail(

            emailInput.value

        );

    const password=

        validatePassword(

            passwordInput.value

        );

    /* 유효할 때는 문구를 띄우지 않고, 형식이 잘못됐을 때만 안내한다 */

    setMessage(

        emailMessage,

        email.valid ? "" : email.message,

        "#DC2626"

    );

    setMessage(

        passwordMessage,

        password.valid ? "" : password.message,

        "#DC2626"

    );

    if(!email.valid){

        emailInput.focus();

        return false;

    }

    if(!password.valid){

        passwordInput.focus();

        return false;

    }

    return true;

}

/* =====================================================
   LOGIN PREPARE
===================================================== */

async function prepareLogin(){

    if(AuthState.loading){

        return false;

    }

    if(!validateForm()){

        return false;

    }

    saveRememberEmail();

    setLoading(true);

    return true;

}

/* =====================================================
   LOGIN FINISH
===================================================== */

function finishLogin(){

    setLoading(false);

}

/* =====================================================
   (구버전 FORM SUBMIT 리스너 제거됨 — 실제 로그인 처리는
   아래 SUBMIT 섹션의 최종 버전 하나만 사용)
===================================================== */
/* =====================================================
   SUPABASE
===================================================== */

const SUPABASE_URL=

    "https://tywbdarlmyxitskxwreu.supabase.co";

const SUPABASE_KEY=

    "sb_publishable_iRkBObTciH_A31nh_XWaQA_c7Xz7MC0";

/*
    주의: 변수명을 "supabase"로 지으면 CDN이 전역에 심어둔
    window.supabase(라이브러리 네임스페이스, createClient만 있음)와
    이름이 겹쳐서 다른 <script> 태그에서 sb.from(...) 같은
    호출을 할 때 라이브러리 객체를 잘못 참조하는 문제가 발생한다.
    그래서 클라이언트 인스턴스는 sb 라는 이름으로 만들고,
    다른 파일에서는 항상 window.sb 를 통해 접근한다.
*/

const sb=

    window.supabase.createClient(

        SUPABASE_URL,

        SUPABASE_KEY

    );

window.sb=sb;

/* =====================================================
   LOGIN
===================================================== */

async function login(){

    const email=

        sanitize(

            emailInput.value

        );

    const password=

        passwordInput.value;

    const {

        data,

        error

    }=

    await sb.auth.signInWithPassword({

        email,

        password

    });

    if(error){

        throw error;

    }

    return data;

}

/* =====================================================
   SESSION
===================================================== */

async function checkSession(){

    const {

        data

    }=

    await sb.auth.getSession();

    if(

        data.session

    ){

        location.href=

            "index.html";

    }

}

/* =====================================================
   (구버전 SUBMIT 리스너 제거됨 — 최종 버전은 아래
   LOGIN SUBMIT 섹션에 있음)

   (checkSession() 무조건 호출도 제거됨 — 페이지 구분 없이
   세션이 있으면 무조건 location.href="index.html"을 실행해서,
   index.html 자체에서 로그인 상태로 로드될 때마다
   자기 자신으로 재이동 → 새로고침 → 재이동 이 반복되며
   화면이 계속 깜빡이는(무한 새로고침 루프) 버그가 있었음.
   페이지를 올바르게 구분하는 redirectIfLoggedIn()이
   파일 하단에 이미 있으므로 그것만 사용.)
===================================================== */
/* =====================================================
   PROFILE
===================================================== */

async function ensureProfile(user){

    const {data,error}=

    await sb

    .from("profiles")

    .select("id")

    .eq("id",user.id)

    .maybeSingle();

    if(error){

        throw error;

    }

    if(data){

        return;

    }

    /*
     register.html의 signUp() options.data에 담아 보낸
     회원가입 정보(user_metadata)를 사용한다.
     메타데이터가 없는 경우(예: 다른 경로로 생성된 계정)에는
     이메일 앞부분을 닉네임으로 대체한다.
    */

    const meta=user.user_metadata || {};

    const nickname=

        meta.nickname ||

        user.email.split("@")[0];

    const {error:insertError}=

    await sb

    .from("profiles")

    .insert({

        id:user.id,

        email:user.email,

        nickname,

        grade:meta.grade ?? null,

        class_number:meta.class_number ?? null,

        student_number:

            (meta.student_number ?? null)===null

                ? null

                : String(meta.student_number),

        bio:meta.bio ?? ""

    });

    if(insertError){

        throw insertError;

    }

}

/* =====================================================
   ERROR MESSAGE
===================================================== */

function translateError(message){

    if(

        message.includes(

            "Invalid login credentials"

        )

    ){

        return "이메일 또는 비밀번호가 올바르지 않습니다.";

    }

    if(

        message.includes(

            "Email not confirmed"

        )

    ){

        return "이메일 인증이 필요합니다.";

    }

    if(

        message.includes(

            "network"

        )

    ){

        return "네트워크 오류가 발생했습니다.";

    }

    return message;

}

/* =====================================================
   LOGIN SUBMIT
===================================================== */

if(form){

    form.addEventListener(

        "submit",

        async(event)=>{

            event.preventDefault();

            const ready=

                await prepareLogin();

            if(!ready){

                return;

            }

            try{

                const result=

                    await login();

                await ensureProfile(

                    result.user

                );

                saveRememberEmail();

                toast(

                    "로그인되었습니다."

                );

                setTimeout(()=>{

                    location.href=

                        "index.html";

                },700);

            }

            catch(error){

                toast(

                    translateError(

                        error.message

                    )

                );

            }

            finally{

                finishLogin();

            }

        }

    );

}
/* =====================================================
   AUTH STATE
===================================================== */

sb.auth.onAuthStateChange(

    async(event,session)=>{

        switch(event){

            case "SIGNED_IN":

                console.log(

                    "SIGNED IN"

                );

                break;

            case "SIGNED_OUT":

                console.log(

                    "SIGNED OUT"

                );

                break;

            case "TOKEN_REFRESHED":

                console.log(

                    "TOKEN REFRESHED"

                );

                break;

        }

    }

);

/* =====================================================
   CURRENT USER
===================================================== */

async function getCurrentUser(){

    const {

        data,

        error

    }=

    await sb.auth.getUser();

    if(error){

        return null;

    }

    return data.user;

}

/* =====================================================
   PROFILE
===================================================== */

async function getProfile(){

    const user=

        await getCurrentUser();

    if(!user){

        return null;

    }

    const {

        data,

        error

    }=

    await sb

    .from("profiles")

    .select("*")

    .eq("id",user.id)

    .single();

    if(!error){

        return data;

    }

    /*
     프로필 row가 없는 경우(예: 로그인 폼을 거치지 않고
     세션이 복원된 경우) 여기서 한 번 더 생성을 시도한다.
     이렇게 해야 "내 정보를 불러올 수 없습니다" 상태로
     영구히 남는 걸 막을 수 있다.
    */

    try{

        await ensureProfile(user);

    }

    catch(ensureError){

        console.warn("프로필 생성 재시도 실패:",ensureError.message || ensureError);

        return null;

    }

    const retry=

    await sb

    .from("profiles")

    .select("*")

    .eq("id",user.id)

    .single();

    return retry.error ? null : retry.data;

}

/* =====================================================
   LOGOUT
===================================================== */

async function logout(){

    await sb.auth.signOut();

    Storage.remove(

        "rememberEmail"

    );

    toast(

        "로그아웃되었습니다."

    );

    setTimeout(()=>{

        location.href=

            "login.html";

    },500);

}

/* =====================================================
   GLOBAL
===================================================== */

window.Auth={

    login,

    logout,

    getCurrentUser,

    getProfile,

    checkSession,

    ensureProfile

};
/* =====================================================
   AUTH GUARD
===================================================== */

async function requireAuth(){

    const {

        data

    }=

    await sb.auth.getSession();

    if(!data.session){

        toast(

            "로그인이 필요합니다."

        );

        setTimeout(()=>{

            location.href=

                "login.html";

        },500);

        return false;

    }

    return true;

}

/* =====================================================
   LOGIN PAGE REDIRECT
===================================================== */

async function redirectIfLoggedIn(){

    const {

        data

    }=

    await sb.auth.getSession();

    if(

        data.session &&

        location.pathname.endsWith(

            "login.html"

        )

    ){

        location.replace(

            "index.html"

        );

    }

}

/* =====================================================
   SESSION REFRESH
===================================================== */

async function refreshSession(){

    const {

        data,

        error

    }=

    await sb.auth.refreshSession();

    if(error){

        console.error(error);

        return null;

    }

    return data.session;

}

/* =====================================================
   PROFILE CACHE
===================================================== */

async function cacheProfile(){

    const profile=

        await getProfile();

    if(profile){

        Storage.set(

            "profile",

            profile

        );

    }

}

async function getCachedProfile(){

    const cached=

        Storage.get(

            "profile",

            null

        );

    if(cached){

        return cached;

    }

    const profile=

        await getProfile();

    if(profile){

        Storage.set(

            "profile",

            profile

        );

    }

    return profile;

}

/* =====================================================
   INIT
===================================================== */

redirectIfLoggedIn();

cacheProfile();

/* =====================================================
   EXPORT
===================================================== */

Object.assign(

    window.Auth,

    {

        requireAuth,

        refreshSession,

        getCachedProfile

    }

);
/* =====================================================
   LOGIN LIMIT
===================================================== */

let loginAttempts=0;

const MAX_LOGIN_ATTEMPTS=5;

function resetAttempts(){

    loginAttempts=0;

}

function increaseAttempts(){

    loginAttempts++;

}

function canLogin(){

    return loginAttempts<MAX_LOGIN_ATTEMPTS;

}

/* =====================================================
   SAFE LOGIN
===================================================== */

async function safeLogin(){

    if(!canLogin()){

        toast(

            "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요."

        );

        return false;

    }

    try{

        const result=

            await login();

        resetAttempts();

        return result;

    }

    catch(error){

        increaseAttempts();

        throw error;

    }

}

/* =====================================================
   RESET FORM
===================================================== */

function resetForm(){

    if(form){

        form.reset();

    }

    if(emailMessage){

        emailMessage.textContent="";

    }

    if(passwordMessage){

        passwordMessage.textContent="";

    }

    if(passwordStrengthBar){

        passwordStrengthBar.style.width="0%";

    }

    if(passwordStrengthText){

        passwordStrengthText.textContent="";

    }

}

/* =====================================================
   AUTH INFO
===================================================== */

async function isLoggedIn(){

    const {

        data

    }=

    await sb.auth.getSession();

    return !!data.session;

}

async function getAccessToken(){

    const {

        data

    }=

    await sb.auth.getSession();

    return data.session?.access_token ?? null;

}

/* =====================================================
   GLOBAL
===================================================== */

Object.assign(

    window.Auth,

    {

        safeLogin,

        resetForm,

        resetAttempts,

        isLoggedIn,

        getAccessToken

    }

);

/* =====================================================
   DEV
===================================================== */

window.TaeckerAuth={

    supabase:sb,

    Auth

};

/* =====================================================
   READY
===================================================== */

console.log(

    "Taecker Auth Loaded"

);
