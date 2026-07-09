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
===================================================== */

writeBtn?.addEventListener("click",()=>{

    toast("글쓰기 기능은 곧 추가됩니다.");

});

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

    anchor.addEventListener("click",(e)=>{

        const target=document.querySelector(

            anchor.getAttribute("href")

        );

        if(!target) return;

        e.preventDefault();

        target.scrollIntoView({

            behavior:"smooth"

        });

    });

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
