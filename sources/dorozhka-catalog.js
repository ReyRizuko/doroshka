/* Jamendo public music catalog. Read-only API; a free developer client_id is required. */
(function(root){
  'use strict';
  var records=Object.create(null),cache=Object.create(null),CACHE_MS=120000;
  function clientId(){try{return localStorage.getItem('dorozhkaJamendoClientId')||'';}catch(e){return '';}}
  function jsonp(url){
    return new Promise(function(resolve,reject){
      var callback='__dorozhkaJamendo'+Date.now()+Math.floor(Math.random()*100000);
      var script=document.createElement('script'),done=false,timer;
      function cleanup(){if(done)return;done=true;clearTimeout(timer);try{delete root[callback];}catch(e){root[callback]=undefined;}if(script.parentNode)script.parentNode.removeChild(script);}
      root[callback]=function(data){cleanup();resolve(data);};
      script.onerror=function(){cleanup();reject(new Error('Jamendo API не ответил. Проверь Client ID и подключение к интернету.'));};
      timer=setTimeout(function(){cleanup();reject(new Error('Jamendo API: превышено время ожидания.'));},15000);
      script.src=url+'&callback='+callback;
      (document.head||document.documentElement).appendChild(script);
    });
  }
  function search(query){
    var id=clientId(),q=String(query||'').trim();
    if(!id)return Promise.reject(new Error('Для каталога Jamendo нужен бесплатный Client ID. Получить его можно на developer.jamendo.com; банковская карта для read-only API не требуется.'));
    if(!q)return Promise.resolve([]);
    var key=id+'|'+q.toLocaleLowerCase(),now=Date.now();
    if(cache[key]&&now-cache[key].at<CACHE_MS)return Promise.resolve(cache[key].items);
    var params='client_id='+encodeURIComponent(id)+'&format=json&limit=40&type=single+albumtrack&audioformat=mp32&include=licenses&search='+encodeURIComponent(q);
    return jsonp('https://api.jamendo.com/v3.0/tracks/?'+params).then(function(data){
      if(!data||!Array.isArray(data.results))throw new Error('Jamendo вернул неожиданный ответ.');
      var items=data.results.map(function(t){
        var item={id:String(t.id),title:t.name||'Без названия',creator:t.artist_name||'',
          album:t.album_name||'Jamendo',duration:Number(t.duration)||0,url:t.audio||'',
          thumbnail:t.album_image||t.image||'',provider:'Jamendo',
          license:t.license_ccname||'Creative Commons',licenseUrl:t.license_ccurl||'',
          permalink:t.shareurl||''};
        if(item.url)records[item.id]=item;
        return item;
      }).filter(function(t){return !!t.url;});
      cache[key]={at:Date.now(),items:items};return items;
    });
  }
  function health(){
    if(!clientId())return Promise.reject(new Error('Сначала добавь Jamendo Client ID.'));
    return search('ambient').then(function(items){return {ok:true,source:'Jamendo',tracks:items.length};});
  }
  function setBase(value){
    var v=String(value||'').trim();
    if(v && !/^[A-Za-z0-9_-]{6,100}$/.test(v))throw new Error('Похоже, Client ID имеет неверный формат.');
    try{localStorage.setItem('dorozhkaJamendoClientId',v);}catch(e){throw new Error('Не удалось сохранить Client ID на устройстве.');}
    cache=Object.create(null);records=Object.create(null);
  }
  function base(){return clientId();}
  root.DorozhkaCatalog={name:'Jamendo',search:search,get:function(id){return records[String(id)]||null;},health:health,setBase:setBase,base:base};
}(window));
