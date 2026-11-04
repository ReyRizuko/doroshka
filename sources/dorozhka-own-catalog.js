/* First-party Doroshka catalog connector: a self-hosted, rights-cleared library. */
(function(root){
'use strict';
var KEY='dorozhkaOwnCatalogUrl',records=Object.create(null),cache=Object.create(null);
function base(){try{return (localStorage.getItem(KEY)||'').replace(/\/+$/,'');}catch(e){return '';}}
function setBase(value){
 var raw=String(value||'').trim(),url;
 if(raw){try{url=new URL(raw);}catch(e){throw new Error('Укажи полный адрес API, например https://music.example.com');}
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&/^(localhost|127\.0\.0\.1)$/.test(url.hostname)))throw new Error('Каталог должен использовать HTTPS (HTTP разрешён только для localhost).');
 if(url.username||url.password||url.search||url.hash)throw new Error('В адресе API не должно быть логина, пароля, параметров или фрагмента.');
 raw=url.origin+url.pathname.replace(/\/+$/,'');}
 try{if(raw)localStorage.setItem(KEY,raw);else localStorage.removeItem(KEY);}catch(e){throw new Error('Не удалось сохранить адрес каталога на устройстве.');}
 records=Object.create(null);cache=Object.create(null);
}
function search(query){
 var origin=base(),q=String(query||'').trim();
 if(!origin)return Promise.reject(new Error('Добавь адрес собственного Doroshka Music API в настройках.'));
 if(!q)return Promise.resolve([]);
 var key=origin+'|'+q.toLocaleLowerCase(),now=Date.now();
 if(cache[key]&&now-cache[key].at<60000)return Promise.resolve(cache[key].items);
 return fetch(origin+'/api/v1/search?q='+encodeURIComponent(q)+'&limit=60',{headers:{Accept:'application/json'},credentials:'omit',cache:'no-store'})
 .then(function(r){if(!r.ok)throw new Error('Doroshka API: HTTP '+r.status);return r.json();})
 .then(function(data){
  if(!data||!Array.isArray(data.items))throw new Error('Doroshka API вернул некорректный каталог.');
  var items=data.items.map(function(t){
   if(!t||!t.stream_url)return null;var url;try{url=new URL(String(t.stream_url),origin);}catch(e){return null;}
   if(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname===new URL(origin).hostname&&/^(localhost|127\.0\.0\.1)$/.test(url.hostname)))return null;
   var item={id:String(t.id),title:String(t.title||'Без названия'),creator:String(t.artist||''),album:String(t.album||''),duration:Number(t.duration)||0,url:url.href,thumbnail:String(t.cover_url||''),provider:'Doroshka Music',license:String(t.license||''),attribution:String(t.attribution||'')};
   records[item.id]=item;return item;
  }).filter(Boolean);cache[key]={at:Date.now(),items:items};return items;
 });
}
function health(){var origin=base();if(!origin)return Promise.reject(new Error('Сначала укажи адрес собственного API.'));
 return fetch(origin+'/api/v1/health',{headers:{Accept:'application/json'},credentials:'omit',cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('API недоступен: HTTP '+r.status);return r.json();}).then(function(data){if(!data||data.ok!==true)throw new Error('Сервер не подтвердил готовность.');return data;});}
root.DorozhkaOwnCatalog={name:'Doroshka Music',base:base,setBase:setBase,search:search,get:function(id){return records[String(id)]||null;},health:health};
}(window));