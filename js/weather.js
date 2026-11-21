/* 홈 날씨 카드 (Open-Meteo, 키 없음) - 태성고(용인시 처인구) 기준 */
"use strict";
(function(){
const card=document.getElementById("weatherCard");
if(!card) return;
const LAT=37.2346, LON=127.2024;
const URL_=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
 +`&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
 +`&timezone=Asia%2FSeoul&forecast_days=1`;
const CK="taeker_weather_v1";

const RAIN=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const SNOW=new Set([71,73,75,77,85,86]);
function kind(c){
    if(c===0||c===1) return ["맑음","sun"];
    if(c===2) return ["구름 조금","partly"];
    if(c===3) return ["흐림","cloud"];
    if(c===45||c===48) return ["안개","fog"];
    if(RAIN.has(c)) return [c>=95?"천둥·비":"비","rain"];
    if(SNOW.has(c)) return ["눈","snow"];
    return ["흐림","cloud"];
}
const ICON={
 sun:'<circle cx="12" cy="12" r="4.5" fill="#F5B93E"/><g stroke="#F5B93E" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>',
 partly:'<circle cx="9" cy="9" r="3.6" fill="#F5B93E"/><path d="M8 19h9.5a3.7 3.7 0 0 0 .4-7.4A5 5 0 0 0 8.2 12 3.5 3.5 0 0 0 8 19z" fill="#B8C4D6"/>',
 cloud:'<path d="M7 19h10.5a4 4 0 0 0 .5-8A5.6 5.6 0 0 0 7.2 9.6 4.7 4.7 0 0 0 7 19z" fill="#A9B6CA"/>',
 fog:'<g stroke="#A9B6CA" stroke-width="2.2" stroke-linecap="round"><path d="M4 8h16M3 12.5h18M5 17h14"/></g>',
 rain:'<path d="M7 14h10.5a4 4 0 0 0 .5-8A5.6 5.6 0 0 0 7.2 4.6 4.7 4.7 0 0 0 7 14z" fill="#8DA2BF"/><g stroke="#4D80E4" stroke-width="2" stroke-linecap="round"><path d="M8 17.5l-1 3M12.5 17.5l-1 3M17 17.5l-1 3"/></g>',
 snow:'<path d="M7 14h10.5a4 4 0 0 0 .5-8A5.6 5.6 0 0 0 7.2 4.6 4.7 4.7 0 0 0 7 14z" fill="#B8C4D6"/><g fill="#6C9BE8"><circle cx="8" cy="18" r="1.5"/><circle cx="12.5" cy="20" r="1.5"/><circle cx="17" cy="18" r="1.5"/></g>'
};

function applyGreeting(type){
    const g=document.getElementById("heroGreeting"), s=document.getElementById("heroSubtext");
    if(!g) return;
    let msg="";
    if(type==="rain") msg="비가 오니 우산을 챙겨가세요.";
    else if(type==="snow") msg="눈이 오니 우산을 챙겨가세요.";
    else if(type==="both") msg="비/눈이 오니 우산을 챙겨가세요.";
    if(!msg) return;
    g.textContent=msg; g.dataset.weather="1";
    if(s){ s.textContent="따뜻하게 입고 조심히 다녀와요."; s.dataset.weather="1"; }
}

function render(d){
    const t=Math.round(d.current.temperature_2m);
    const code=d.daily.weather_code[0];
    const cur=d.current.weather_code;
    const [label,ic]=kind(RAIN.has(cur)||SNOW.has(cur)?cur:code);
    const max=Math.round(d.daily.temperature_2m_max[0]), min=Math.round(d.daily.temperature_2m_min[0]);
    const pop=d.daily.precipitation_probability_max?.[0];
    const rain=RAIN.has(code)||RAIN.has(cur), snow=SNOW.has(code)||SNOW.has(cur);
    card.innerHTML=`
        <svg class="weather-ic" width="46" height="46" viewBox="0 0 24 24" aria-hidden="true">${ICON[ic]}</svg>
        <div class="weather-main"><span class="weather-temp">${t}°</span><span class="weather-label">${label}</span></div>
        <div class="weather-sub">최저 ${min}° · 최고 ${max}°${pop!=null?` · 강수확률 ${pop}%`:""}</div>`;
    card.classList.remove("hidden");
    applyGreeting(rain&&snow?"both":rain?"rain":snow?"snow":"");
}

async function run(){
    try{
        const c=JSON.parse(sessionStorage.getItem(CK)||"null");
        if(c && Date.now()-c.t<20*60*1000){ render(c.d); return; }
    }catch(e){}
    try{
        const r=await fetch(URL_);
        if(!r.ok) return;
        const d=await r.json();
        if(!d.current||!d.daily) return;
        try{ sessionStorage.setItem(CK,JSON.stringify({t:Date.now(),d})); }catch(e){}
        render(d);
    }catch(e){}
}
run();
})();
