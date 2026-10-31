/* Doroshka Music: public GitHub Releases catalog (no VPS, R2 or database). */
(function(root){
  'use strict';
  var records=Object.create(null), cache=null, cacheAt=0, CACHE_MS=180000, DEFAULT_REPO='ReyRizuko/doroshka';
  function base(){
    var value='';
    try{value=localStorage.getItem('dorozhkaMusicGithubRepo');}catch(e){}
    if(!value) value=DEFAULT_REPO;
    return value.trim();
  }
  function validRepo(value){
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
  }
  function requestPage(repo,page){
    var url='https://api.github.com/repos/'+repo+'/releases?per_page=100&page='+page;
    return fetch(url,{headers:{Accept:'application/vnd.github+json'}}).then(function(r){
      if(!r.ok) return r.text().then(function(t){throw new Error('GitHub API HTTP '+r.status+(r.status===403?' · возможно, исчерпан лимит запросов':'')+(t?' · '+t.slice(0,100):''));});
      return r.json();
    });
  }
  function releases(force){
    var repo=base();
    if(!repo) return Promise.reject(new Error('Укажи публичный репозиторий GitHub в формате владелец/репозиторий'));
    if(!validRepo(repo)) return Promise.reject(new Error('Неверный формат. Пример: ReyRizuko/doroshka'));
    if(!force && cache && cache.repo===repo && Date.now()-cacheAt<CACHE_MS) return Promise.resolve(cache.items);
    var pages=[],page=1;
    function next(){
      return requestPage(repo,page).then(function(items){
        pages=pages.concat(items.filter(function(r){return !r.draft && !r.prerelease;}));
        if(items.length===100 && page<10){page++;return next();}
        cache={repo:repo,items:pages};cacheAt=Date.now();return pages;
      });
    }
    return next();
  }
  function field(body,name){
    var re=new RegExp('^'+name+'\\s*:\\s*(.+)$','im'),m=(body||'').match(re);
    return m?m[1].trim():'';
  }
  function tracksFrom(release){
    var assets=release.assets||[],audio=assets.filter(function(a){return /\.(mp3|m4a|aac|ogg|opus|flac|wav)$/i.test(a.name||'');});
    var cover=assets.filter(function(a){return /\.(jpg|jpeg|png|webp)$/i.test(a.name||'');})[0];
    var body=release.body||'',artist=field(body,'Artist'),album=field(body,'Album'),genre=field(body,'Genre');
    var license=field(body,'License'),attribution=field(body,'Attribution');
    return audio.map(function(asset){
      var title=(audio.length===1?(release.name||''):asset.name).replace(/\.(mp3|m4a|aac|ogg|opus|flac|wav)$/i,'').trim();
      var duration=Number(field(body,'Duration'))||0;
      var track={
        id:String(asset.id),title:title||'Без названия',creator:artist,album:album||release.name||'',
        genre:genre,duration:duration,thumbnail:cover?cover.browser_download_url:'',
        url:asset.browser_download_url,provider:'Doroshka Music · GitHub Releases',
        license:license,attribution:attribution,releaseUrl:release.html_url
      };
      records[track.id]=track;return track;
    });
  }
  function search(query){
    var q=String(query||'').trim().toLocaleLowerCase();
    return releases(false).then(function(items){
      var all=[];
      items.forEach(function(r){all=all.concat(tracksFrom(r));});
      if(!q)return all.slice(0,100);
      return all.filter(function(t){
        return [t.title,t.creator,t.album,t.genre,t.license,t.attribution].join(' ').toLocaleLowerCase().indexOf(q)!==-1;
      }).slice(0,100);
    });
  }
  function get(id){return records[String(id)]||null;}
  function health(){
    return releases(true).then(function(items){
      var count=items.reduce(function(n,r){return n+(r.assets||[]).filter(function(a){return /\.(mp3|m4a|aac|ogg|opus|flac|wav)$/i.test(a.name||'');}).length;},0);
      return {ok:true,repository:base(),releases:items.length,tracks:count};
    });
  }
  function setBase(value){
    var v=String(value||'').trim().replace(/^https?:\/\//i,'').replace(/\.git$/i,'').replace(/\/+$/,'');
    if(v && !validRepo(v)) throw new Error('Укажи публичный репозиторий в формате владелец/репозиторий');
    localStorage.setItem('dorozhkaMusicGithubRepo',v);cache=null;cacheAt=0;records=Object.create(null);
  }
  root.DorozhkaCatalog={name:'Doroshka Music',search:search,get:get,health:health,setBase:setBase,base:base};
}(window));
