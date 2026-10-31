/* Official Apple Music + Spotify catalog integrations for Dorozhka. */
(function(root){
  'use strict';
  var appleToken='',spotifyClientId='',spotifyRedirect='',spotifyToken='',spotifyDevice='',spotifyPlayer=null;
  var appleRecords=Object.create(null),spotifyRecords=Object.create(null),appleMusic=null;
  var APPLE_TOKEN_KEY='dorozhkaAppleDeveloperToken',SPOTIFY_ID_KEY='dorozhkaSpotifyClientId',SPOTIFY_REDIRECT_KEY='dorozhkaSpotifyRedirectUri';
  function read(key){try{return localStorage.getItem(key)||'';}catch(e){return '';}}
  function write(key,value){try{localStorage.setItem(key,value);}catch(e){throw new Error('Не удалось сохранить настройку на устройстве.');}}
  function clean(v){return String(v||'').replace(/[\u0000-\u001f]/g,' ').trim();}
  function appleInstance(){
    if(!appleToken)throw new Error('Добавь Apple Music Developer Token в настройках источников.');
    if(!root.MusicKit)throw new Error('MusicKit JS не загрузился. Проверь подключение к интернету.');
    if(!appleMusic){
      root.MusicKit.configure({developerToken:appleToken,app:{name:'Дорожка',build:'1.0.0'}});
      appleMusic=root.MusicKit.getInstance();
    }
    return appleMusic;
  }
  function setAppleToken(value){
    appleToken=clean(value);
    if(appleToken && appleToken.split('.').length!==3)throw new Error('Developer Token должен быть JWT из трёх частей.');
    write(APPLE_TOKEN_KEY,appleToken);appleMusic=null;appleRecords=Object.create(null);
  }
  function appleBase(){return appleToken;}
  function searchApple(query){
    var music=appleInstance(),q=clean(query);
    if(!q)return Promise.resolve([]);
    return music.api.search(q,{types:'songs',limit:20}).then(function(data){
      var songs=data&&data.songs&&data.songs.data||[];
      return songs.map(function(song){
        var a=song.attributes||{},id=String(song.id||'');
        var art=(a.artwork&&a.artwork.url||'').replace('{w}',300).replace('{h}',300);
        var item={id:id,title:clean(a.name)||'Без названия',creator:clean(a.artistName),album:clean(a.albumName),
          duration:Math.round((Number(a.durationInMillis)||0)/1000),thumbnail:art,url:a.url||'',preview:(a.previews&&a.previews[0]&&a.previews[0].url)||'',provider:'Apple Music'};
        appleRecords[id]=item;return item;
      });
    });
  }
  function playApple(id){
    var music=appleInstance(),item=appleRecords[String(id)];
    if(!item)return Promise.reject(new Error('Трек Apple Music больше не найден. Повтори поиск.'));
    return Promise.resolve(music.isAuthorized?true:music.authorize()).then(function(){
      return music.setQueue({song:String(id)});
    }).then(function(){return music.play();});
  }
  function setSpotify(clientId,redirectUri){
    spotifyClientId=clean(clientId);spotifyRedirect=clean(redirectUri);
    if(spotifyClientId&&!/^[A-Za-z0-9]+$/.test(spotifyClientId))throw new Error('Проверь Spotify Client ID.');
    if(spotifyRedirect){
      try{var u=new URL(spotifyRedirect);if(!/^https?:$/.test(u.protocol)&&!/^([a-z][a-z0-9+.-]*):$/i.test(u.protocol))throw new Error();}
      catch(e){throw new Error('Проверь Redirect URI.');}
    }
    write(SPOTIFY_ID_KEY,spotifyClientId);write(SPOTIFY_REDIRECT_KEY,spotifyRedirect);
  }
  function spotifyBase(){return {clientId:spotifyClientId,redirectUri:spotifyRedirect};}
  function b64url(bytes){
    var s='';for(var i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function randomString(n){
    var a=new Uint8Array(n);root.crypto.getRandomValues(a);return b64url(a);
  }
  function redirectUri(){return spotifyRedirect||root.location.href.split('?')[0].split('#')[0];}
  function authorizeSpotify(){
    if(!spotifyClientId)return Promise.reject(new Error('Сначала сохрани Spotify Client ID.'));
    if(!root.crypto||!root.crypto.subtle)return Promise.reject(new Error('Для Spotify OAuth нужен защищённый HTTPS-контекст.'));
    var verifier=randomString(64),state=randomString(16),scopes='user-read-private user-read-email user-modify-playback-state user-read-playback-state streaming';
    return root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)).then(function(hash){
      try{sessionStorage.setItem('dorozhkaSpotifyVerifier',verifier);sessionStorage.setItem('dorozhkaSpotifyState',state);}catch(e){}
      var params=new URLSearchParams({client_id:spotifyClientId,response_type:'code',redirect_uri:redirectUri(),code_challenge_method:'S256',code_challenge:b64url(new Uint8Array(hash)),state:state,scope:scopes});
      root.location.href='https://accounts.spotify.com/authorize?'+params.toString();
    });
  }
  function exchangeCode(){
    var params=new URLSearchParams(root.location.search),code=params.get('code'),state=params.get('state');
    if(!code)return Promise.resolve(false);
    var verifier='',expected='';
    try{verifier=sessionStorage.getItem('dorozhkaSpotifyVerifier')||'';expected=sessionStorage.getItem('dorozhkaSpotifyState')||'';}catch(e){}
    if(!verifier||!state||state!==expected)return Promise.reject(new Error('Spotify OAuth: проверка state не пройдена.'));
    var body=new URLSearchParams({client_id:spotifyClientId,grant_type:'authorization_code',code:code,redirect_uri:redirectUri(),code_verifier:verifier});
    return fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()})
      .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error_description||j.error||'Spotify token error');return j;});})
      .then(function(j){
        spotifyToken=j.access_token;
        try{sessionStorage.setItem('dorozhkaSpotifyAccessToken',spotifyToken);sessionStorage.setItem('dorozhkaSpotifyTokenExpiry',String(Date.now()+Number(j.expires_in||3600)*1000));sessionStorage.removeItem('dorozhkaSpotifyVerifier');sessionStorage.removeItem('dorozhkaSpotifyState');}catch(e){}
        root.history.replaceState({},'',redirectUri());initSpotifyPlayer();return true;
      });
  }
  function token(){
    if(spotifyToken)return spotifyToken;
    try{
      var expiry=Number(sessionStorage.getItem('dorozhkaSpotifyTokenExpiry')||0);
      if(expiry>Date.now()+30000)spotifyToken=sessionStorage.getItem('dorozhkaSpotifyAccessToken')||'';
    }catch(e){}
    return spotifyToken;
  }
  function spotifyRequest(url,options){
    options=options||{};options.headers=options.headers||{};options.headers.Authorization='Bearer '+token();
    return fetch(url,options).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw new Error((j.error&&j.error.message)||('Spotify HTTP '+r.status));return j;});});
  }
  function searchSpotify(query){
    var q=clean(query);if(!token())return Promise.reject(new Error('Подключи Spotify в настройках и войди в аккаунт.'));
    if(!q)return Promise.resolve([]);
    return spotifyRequest('https://api.spotify.com/v1/search?type=track&limit=20&q='+encodeURIComponent(q)).then(function(data){
      var tracks=data.tracks&&data.tracks.items||[];
      return tracks.map(function(t){
        var id=String(t.id||''),images=t.album&&t.album.images||[];
        var item={id:id,title:clean(t.name)||'Без названия',creator:(t.artists||[]).map(function(a){return clean(a.name);}).join(', '),
          album:clean(t.album&&t.album.name),duration:Math.round((Number(t.duration_ms)||0)/1000),
          thumbnail:images[images.length-1]&&images[images.length-1].url||'',url:t.external_urls&&t.external_urls.spotify||('https://open.spotify.com/track/'+id),
          uri:t.uri||('spotify:track:'+id),provider:'Spotify'};
        spotifyRecords[id]=item;return item;
      });
    });
  }
  function initSpotifyPlayer(){
    var t=token();
    if(!t||spotifyPlayer||!root.Spotify||!root.Spotify.Player)return;
    try{
      spotifyPlayer=new root.Spotify.Player({name:'Дорожка',getOAuthToken:function(cb){cb(token());},volume:0.8});
      spotifyPlayer.addListener('ready',function(e){spotifyDevice=e.device_id||'';});
      spotifyPlayer.addListener('not_ready',function(){spotifyDevice='';});
      spotifyPlayer.addListener('initialization_error',function(){spotifyPlayer=null;});
      spotifyPlayer.addListener('authentication_error',function(){spotifyPlayer=null;});
      spotifyPlayer.addListener('account_error',function(){spotifyPlayer=null;});
      spotifyPlayer.connect().catch(function(){spotifyPlayer=null;});
    }catch(e){spotifyPlayer=null;}
  }
  root.onSpotifyWebPlaybackSDKReady=function(){initSpotifyPlayer();};
  function playSpotify(id){
    var item=spotifyRecords[String(id)];
    if(!item)return Promise.reject(new Error('Трек Spotify больше не найден. Повтори поиск.'));
    initSpotifyPlayer();
    if(!spotifyPlayer||!spotifyDevice){root.open(item.url,'_blank','noopener');return Promise.resolve({external:true});}
    return spotifyPlayer.activateElement().then(function(){
      return spotifyRequest('https://api.spotify.com/v1/me/player/play?device_id='+encodeURIComponent(spotifyDevice),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({uris:[item.uri]})});
    });
  }
  function getApple(id){return appleRecords[String(id)]||null;}
  function getSpotify(id){return spotifyRecords[String(id)]||null;}
  appleToken=read(APPLE_TOKEN_KEY);spotifyClientId=read(SPOTIFY_ID_KEY);spotifyRedirect=read(SPOTIFY_REDIRECT_KEY);
  try{exchangeCode().catch(function(e){root.console&&console.warn('Spotify authorization:',e.message);});}catch(e){}
  if(token())initSpotifyPlayer();
  root.DorozhkaMajorCatalogs={setAppleToken:setAppleToken,appleBase:appleBase,searchApple:searchApple,playApple:playApple,getApple:getApple,
    setSpotify:setSpotify,spotifyBase:spotifyBase,authorizeSpotify:authorizeSpotify,searchSpotify:searchSpotify,playSpotify:playSpotify,getSpotify:getSpotify};
}(window));