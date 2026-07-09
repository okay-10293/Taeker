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

        message:"사용 가능한 이메일입니다."

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

        message:"사용 가능한 비밀번호입니다."

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
===================================================== */

if(emailInput){

    emailInput.addEventListener("input",()=>{

        const result=

            validateEmail(emailInput.value);

        setMessage(

            emailMessage,

            result.message,

            result.valid

                ? "#16A34A"

                : "#DC2626"

        );

    });

}

if(passwordInput){

    passwordInput.addEventListener("input",()=>{

        const result=

            validatePassword(

                passwordInput.value

            );

        setMessage(

            passwordMessage,

            result.message,

            result.valid

                ? "#16A34A"

                : "#DC2626"

        );

        updateStrength(

            passwordInput.value

        );

    });

}

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

    setMessage(

        emailMessage,

        email.message,

        email.valid

            ? "#16A34A"

            : "#DC2626"

    );

    setMessage(

        passwordMessage,

        password.message,

        password.valid

            ? "#16A34A"

            : "#DC2626"

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
   FORM SUBMIT
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

                /*
                 실제 Supabase 로그인은
                 Part 4에서 연결
                */

            }

            finally{

                finishLogin();

            }

        }

    );

}
/* =====================================================
   SUPABASE
===================================================== */

const SUPABASE_URL=

    "https://tywbdarlmyxitskxwreu.supabase.co";

const SUPABASE_KEY=

    "sb_publishable_iRkBObTciH_A31nh_XWaQA_c7Xz7MC0";

const supabase=

    window.supabase.createClient(

        SUPABASE_URL,

        SUPABASE_KEY

    );

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

    await supabase.auth.signInWithPassword({

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

    await supabase.auth.getSession();

    if(

        data.session

    ){

        location.href=

            "index.html";

    }

}

/* =====================================================
   SUBMIT
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

                await login();

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

                console.error(error);

                toast(

                    error.message ||

                    "로그인에 실패했습니다."

                );

            }

            finally{

                finishLogin();

            }

        }

    );

}

/* =====================================================
   AUTO LOGIN
===================================================== */

checkSession();
/* =====================================================
   PROFILE
===================================================== */

async function ensureProfile(user){

    const {data,error}=

    await supabase

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

    const nickname=

        user.email.split("@")[0];

    const {error:insertError}=

    await supabase

    .from("profiles")

    .insert({

        id:user.id,

        email:user.email,

        nickname

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
