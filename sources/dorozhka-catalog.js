/* Free To Use public music catalog. No account, API key, VPS or storage setup. */
(function(root){
  'use strict';
  var cache=Object.create(null),CACHE_MS=120000;
  var API='https://api.freetouse.com/v3/music/tracks/search';
  function artistName(track){
    var artists=Array.isArray(track.artists)?track.artists:[];
    return artists.map(function(item){var a=Array.isArray(item)?item[1]:item;return a&&a.name||'';}).filter(Boolean).join(', ');
  }
  function normalize(track){
    var files=track.files||{},thumbs=track.thumbnails||{};
    var tags=Array.isArray(track.tags)?track.tags.map(function(x){return Array.isArray(x)?x[1]:x;}).filter(Boolean):[];
    var cats=Array.isArray(track.categories)?track.categories.map(function(x){var c=Array.isArray(x)?x[1]:x;return c&&c.name||'';}).filter(Boolean):[];
    return {
      id:String(track.id),title:track.title||'Без названия',creator:artistName(track),
      album:track.record_label||'Free To Use',genre:track.genre||tags.concat(cats).join(', '),
      duration:Number(track.duration)||0,url:files.mp3||'',
      thumbnail:thumbs.md||thumbs.sm||thumbs.lg||'',
      provider:'Free To Use',license:'Free To Use License',
      permalink:'https://freetouse.com/'
    };
  }
  function search(query){
    var q=String(query||'').trim();
    if(!q)return Promise.resolve([]);
    var key=q.toLocaleLowerCase(),now=Date.now();
    if(cache[key]&&now-cache[key].at<CACHE_MS)return Promise.resolve(cache[key].items);
    var url=API+'?query='+encodeURIComponent(q)+'&limit=30&offset=0&order=plays&sort=desc';
    return fetch(url,{headers:{Accept:'application/json'}}).then(function(r){
      if(!r.ok)throw new Error('Free To Use API HTTP '+r.status);
      return r.json();
    }).then(function(data){
      if(data&&data.ok===false)throw new Error(data.error||'Free To Use API вернул ошибку');
      var items=(data&&Array.isArray(data.data)?data.data:[]).map(normalize).filter(function(t){return t.url;});
      cache[key]={at:Date.now(),items:items};return items;
    });
  }
  function get(id){
    var keys=Object.keys(cache);
    for(var i=0;i<keys.length;i++){
      var items=cache[keys[i]].items;
      for(var j=0;j<items.length;j++)if(items[j].id===String(id))return items[j];
    }
    return null;
  }
  function health(){
    return fetch('https://api.freetouse.com/v3/music/tracks/all?limit=1&offset=0',{headers:{Accept:'application/json'}}).then(function(r){
      if(!r.ok)throw new Error('Free To Use API HTTP '+r.status);
      return r.json();
    }).then(function(data){return {ok:!!(data&&data.ok),source:'Free To Use',available:!!(data&&data.ok)};});
  }
  function setBase(){return true;}
  function base(){return 'Free To Use';}
  root.DorozhkaCatalog={name:'Free To Use',search:search,get:get,health:health,setBase:setBase,base:base};
}(window));
