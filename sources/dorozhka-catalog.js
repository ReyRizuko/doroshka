/* Doroshka Music: собственный серверный каталог. */
(function(root){
  'use strict';
  var records=Object.create(null);
  function base(){
    var value='';
    try{value=localStorage.getItem('dorozhkaMusicApiUrl')||'';}catch(e){}
    return value.trim().replace(/\/+$/,'');
  }
  function api(path,options){
    var origin=base();
    if(!origin) return Promise.reject(new Error('Адрес сервера Doroshka Music не настроен'));
    return fetch(origin+path,Object.assign({headers:{Accept:'application/json'}},options||{}))
      .then(function(r){
        if(!r.ok) return r.text().then(function(t){throw new Error('Doroshka Music HTTP '+r.status+(t?' · '+t.slice(0,120):''));});
        return r.json();
      });
  }
  function normalize(item){
    var origin=base();
    var track={
      id:String(item.id),title:String(item.title||'Без названия'),
      creator:String(item.artist||''),album:String(item.album||''),
      duration:Number(item.duration)||0,thumbnail:item.cover_url||'',
      url:origin+item.stream_url,provider:'Doroshka Music',
      license:String(item.license||''),attribution:String(item.attribution||'')
    };
    records[track.id]=track;
    return track;
  }
  function search(query){
    return api('/api/v1/search?q='+encodeURIComponent(query)+'&limit=60')
      .then(function(data){return (data.items||[]).map(normalize);});
  }
  function get(id){return records[String(id)]||null;}
  function health(){return api('/api/v1/health');}
  function setBase(value){
    var v=String(value||'').trim().replace(/\/+$/,'');
    if(v && !/^https:\/\//i.test(v) && !/^http:\/\/localhost(?::\d+)?$/i.test(v) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(v))
      throw new Error('Используйте HTTPS-адрес сервера (HTTP допустим только для localhost)');
    localStorage.setItem('dorozhkaMusicApiUrl',v);
  }
  root.DorozhkaCatalog={name:'Doroshka Music',search:search,get:get,health:health,setBase:setBase,base:base};
}(window));
