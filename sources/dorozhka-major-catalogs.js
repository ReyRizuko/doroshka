/* Official Apple Music + Spotify catalog integrations for Dorozhka. */
(function(root){
  'use strict';
  var appleToken='',spotifyClientId='',spotifyRedirect='',spotifyToken='',spotifyDevice='',spotifyPlayer=null;
  var appleRecords=Object.create(null),spotifyRecords=Object.create(null),appleMusic=null,spotifyLastState=null,spotifyEndedTrack='',spotifyReadyWaiters=[],spotifyRefreshPromise=null,spotifyAuthGeneration=0;
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
    var music=appleInstance();
    return Promise.resolve(music.isAuthorized?true:music.authorize()).then(function(){
      return music.setQueue({song:String(id)});
    }).then(function(){return music.play();});
  }
  function setSpotify(clientId,redirectUri){
    var nextId=clean(clientId),nextRedirect=clean(redirectUri);
    if(nextId&&!/^[A-Za-z0-9]+$/.test(nextId))throw new Error('Проверь Spotify Client ID.');
    if(nextRedirect){
      try{var u=new URL(nextRedirect);if(!/^https?:$/.test(u.protocol)&&!/^([a-z][a-z0-9+.-]*):$/i.test(u.protocol))throw new Error();}
      catch(e){throw new Error('Проверь Redirect URI.');}
    }
    if(nextId!==spotifyClientId||nextRedirect!==spotifyRedirect){
      spotifyAuthGeneration++;spotifyRefreshPromise=null;
      spotifyToken='';spotifyDevice='';spotifyLastState=null;spotifyEndedTrack='';
      if(spotifyPlayer){try{spotifyPlayer.disconnect();}catch(e){}spotifyPlayer=null;}
      try{['dorozhkaSpotifyAccessToken','dorozhkaSpotifyTokenExpiry','dorozhkaSpotifyRefreshToken','dorozhkaSpotifyVerifier','dorozhkaSpotifyState'].forEach(function(k){sessionStorage.removeItem(k);});}catch(e){}
    }
    spotifyClientId=nextId;spotifyRedirect=nextRedirect;
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
  function redirectUri(){return spotifyRedirect||(root.SpotifyOAuth?'doroshka://spotify-callback':root.location.href.split('?')[0].split('#')[0]);}
  function authorizeSpotify(){
    if(!spotifyClientId)return Promise.reject(new Error('Сначала сохрани Spotify Client ID.'));
    if(!root.crypto||!root.crypto.subtle)return Promise.reject(new Error('Для Spotify OAuth нужен защищённый HTTPS-контекст.'));
    var verifier=randomString(64),state=randomString(16),scopes='user-read-private user-read-email user-modify-playback-state user-read-playback-state streaming';
    return root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)).then(function(hash){
      try{sessionStorage.setItem('dorozhkaSpotifyVerifier',verifier);sessionStorage.setItem('dorozhkaSpotifyState',state);}catch(e){}
      var params=new URLSearchParams({client_id:spotifyClientId,response_type:'code',redirect_uri:redirectUri(),code_challenge_method:'S256',code_challenge:b64url(new Uint8Array(hash)),state:state,scope:scopes});
      var authUrl='https://accounts.spotify.com/authorize?'+params.toString();
      if(root.SpotifyOAuth&&typeof root.SpotifyOAuth.openAuthUrl==='function')root.SpotifyOAuth.openAuthUrl(authUrl);
      else root.location.href=authUrl;
    });
  }
  function exchangeCode(){
    var params=new URLSearchParams(root.location.search);
    if(!params.get('code')&&root.SpotifyOAuth&&typeof root.SpotifyOAuth.getPendingUrl==='function'){
      try{
        var pending=root.SpotifyOAuth.getPendingUrl();
        if(pending){params=new URL(pending).searchParams;root.SpotifyOAuth.clearPendingUrl();}
      }catch(e){}
    }
    var code=params.get('code'),state=params.get('state'),oauthError=params.get('error');
    if(oauthError)return Promise.reject(new Error('Spotify: авторизация отклонена ('+oauthError+').'));
    if(!code)return Promise.resolve(false);
    var verifier='',expected='';
    try{verifier=sessionStorage.getItem('dorozhkaSpotifyVerifier')||'';expected=sessionStorage.getItem('dorozhkaSpotifyState')||'';}catch(e){}
    if(!verifier||!state||state!==expected)return Promise.reject(new Error('Spotify OAuth: проверка state не пройдена.'));
    var body=new URLSearchParams({client_id:spotifyClientId,grant_type:'authorization_code',code:code,redirect_uri:redirectUri(),code_verifier:verifier});
    return fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()})
      .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error_description||j.error||'Spotify token error');return j;});})
      .then(function(j){
        spotifyToken=j.access_token;
        try{sessionStorage.setItem('dorozhkaSpotifyAccessToken',spotifyToken);sessionStorage.setItem('dorozhkaSpotifyTokenExpiry',String(Date.now()+Number(j.expires_in||3600)*1000));if(j.refresh_token)sessionStorage.setItem('dorozhkaSpotifyRefreshToken',j.refresh_token);sessionStorage.removeItem('dorozhkaSpotifyVerifier');sessionStorage.removeItem('dorozhkaSpotifyState');}catch(e){}
        try{
          if(root.location.origin===new URL(redirectUri()).origin)root.history.replaceState({},'',redirectUri());
        }catch(e){}
        initSpotifyPlayer();
        try{root.dispatchEvent(new Event('dorozhka-spotify-auth'));}catch(e){}
        return true;
      });
  }
  function token(){
    try{
      var expiry=Number(sessionStorage.getItem('dorozhkaSpotifyTokenExpiry')||0);
      if(expiry>Date.now()+30000){
        if(!spotifyToken)spotifyToken=sessionStorage.getItem('dorozhkaSpotifyAccessToken')||'';
        return spotifyToken;
      }
    }catch(e){}
    spotifyToken='';
    return '';
  }
  function refreshSpotifyToken(){
    if(spotifyRefreshPromise)return spotifyRefreshPromise;
    var refresh='',generation=spotifyAuthGeneration;
    try{refresh=sessionStorage.getItem('dorozhkaSpotifyRefreshToken')||'';}catch(e){}
    if(!refresh||!spotifyClientId)return Promise.reject(new Error('Сессия Spotify истекла. Войди в Spotify ещё раз.'));
    var body=new URLSearchParams({grant_type:'refresh_token',refresh_token:refresh,client_id:spotifyClientId});
    var request=fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw new Error(j.error_description||j.error||'Spotify token refresh failed');return j;});})
      .then(function(j){
        if(generation!==spotifyAuthGeneration)throw new Error('Настройки Spotify изменились. Повтори подключение.');
        spotifyToken=j.access_token||'';
        if(!spotifyToken)throw new Error('Spotify не вернул новый access token.');
        try{
          sessionStorage.setItem('dorozhkaSpotifyAccessToken',spotifyToken);
          sessionStorage.setItem('dorozhkaSpotifyTokenExpiry',String(Date.now()+Number(j.expires_in||3600)*1000));
          if(j.refresh_token)sessionStorage.setItem('dorozhkaSpotifyRefreshToken',j.refresh_token);
        }catch(e){}
        return spotifyToken;
      })
      .catch(function(error){
        if(generation===spotifyAuthGeneration&&error&&/invalid_grant|invalid refresh token/i.test(error.message||'')){
          try{['dorozhkaSpotifyAccessToken','dorozhkaSpotifyTokenExpiry','dorozhkaSpotifyRefreshToken'].forEach(function(k){sessionStorage.removeItem(k);});}catch(e){}
          spotifyToken='';
        }
        throw error;
      });
    spotifyRefreshPromise=request;
    request.then(function(){if(spotifyRefreshPromise===request)spotifyRefreshPromise=null;},function(){if(spotifyRefreshPromise===request)spotifyRefreshPromise=null;});
    return request;
  }
  function ensureSpotifyToken(){var current=token();return current?Promise.resolve(current):refreshSpotifyToken();}
  function spotifyRequest(url,options){
    return ensureSpotifyToken().then(function(accessToken){
      options=options||{};options.headers=options.headers||{};options.headers.Authorization='Bearer '+accessToken;
      return fetch(url,options).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw new Error((j.error&&j.error.message)||('Spotify HTTP '+r.status));return j;});});
    });
  }
  function searchSpotify(query){
    var q=clean(query);
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
      spotifyPlayer=new root.Spotify.Player({name:'Дорожка',getOAuthToken:function(cb){ensureSpotifyToken().then(cb).catch(function(){cb('');});},volume:0.8});
      spotifyPlayer.addListener('ready',function(e){
        spotifyDevice=e.device_id||'';
        var waiters=spotifyReadyWaiters.splice(0);
        waiters.forEach(function(w){clearTimeout(w.timer);if(spotifyDevice)w.resolve(spotifyDevice);else w.reject(new Error('Spotify не сообщил ID устройства.'));});
      });
      spotifyPlayer.addListener('player_state_changed',function(state){
        if(!state){
          var last=spotifyLastState,lastTrack=last&&last.track_window&&last.track_window.current_track;
          if(last&&lastTrack&&last.duration>0&&last.position>=last.duration-900&&spotifyEndedTrack!==lastTrack.id){
            spotifyEndedTrack=lastTrack.id;
            try{root.dispatchEvent(new CustomEvent('dorozhka-provider-ended',{detail:{provider:'Spotify',trackId:lastTrack.id}}));}catch(e){}
          }
          return;
        }
        var track=state.track_window&&state.track_window.current_track;
        if(track&&spotifyEndedTrack&&spotifyEndedTrack!==track.id)spotifyEndedTrack='';
        if(track&&state.duration>0&&state.position>=state.duration-750&&state.paused&&spotifyEndedTrack!==track.id){
          spotifyEndedTrack=track.id;
          try{root.dispatchEvent(new CustomEvent('dorozhka-provider-ended',{detail:{provider:'Spotify',trackId:track.id}}));}catch(e){}
        }
        spotifyLastState=state;
      });
      spotifyPlayer.addListener('not_ready',function(){
        spotifyDevice='';
        var waiters=spotifyReadyWaiters.splice(0);
        waiters.forEach(function(w){clearTimeout(w.timer);w.reject(new Error('Spotify-плеер отключился от устройства.'));});
      });
      function failSpotifyReady(message){
        spotifyPlayer=null;spotifyDevice='';
        var waiters=spotifyReadyWaiters.splice(0);
        waiters.forEach(function(w){clearTimeout(w.timer);w.reject(new Error(message));});
      }
      spotifyPlayer.addListener('initialization_error',function(){failSpotifyReady('Spotify SDK не удалось инициализировать.');});
      spotifyPlayer.addListener('authentication_error',function(){failSpotifyReady('Spotify не принял авторизацию.');});
      spotifyPlayer.addListener('account_error',function(){failSpotifyReady('Аккаунт Spotify не поддерживает Web Playback.');});
      spotifyPlayer.connect().then(function(ok){if(!ok)failSpotifyReady('Spotify Web Playback не подключился.');}).catch(function(){failSpotifyReady('Spotify Web Playback не подключился.');});
    }catch(e){spotifyPlayer=null;}
  }
  root.onSpotifyWebPlaybackSDKReady=function(){initSpotifyPlayer();};
  function handleSpotifyReturn(){
    exchangeCode().catch(function(e){
      root.console&&console.warn('Spotify authorization:',e.message);
      try{root.dispatchEvent(new CustomEvent('dorozhka-spotify-auth-error',{detail:{message:e.message}}));}catch(x){}
    });
  }
  root.addEventListener('focus',handleSpotifyReturn);
  if(root.document)root.document.addEventListener('visibilitychange',function(){if(!root.document.hidden)handleSpotifyReturn();});
  function waitForSpotifyDevice(){
    if(spotifyDevice)return Promise.resolve(spotifyDevice);
    initSpotifyPlayer();
    if(!spotifyPlayer)return Promise.reject(new Error('Spotify Web Playback SDK не готов. Проверьте подключение и авторизацию.'));
    return new Promise(function(resolve,reject){
      var waiter={resolve:resolve,reject:reject,timer:null};
      waiter.timer=setTimeout(function(){
        var i=spotifyReadyWaiters.indexOf(waiter);
        if(i>=0)spotifyReadyWaiters.splice(i,1);
        reject(new Error('Spotify не подготовил устройство за 15 секунд. Попробуйте ещё раз.'));
      },15000);
      spotifyReadyWaiters.push(waiter);
    });
  }
  function playSpotify(id){
    var item=spotifyRecords[String(id)],uri=item&&item.uri||('spotify:track:'+String(id));
    spotifyEndedTrack='';spotifyLastState=null;
    return ensureSpotifyToken().then(function(){initSpotifyPlayer();return waitForSpotifyDevice();}).then(function(deviceId){
      if(!spotifyPlayer)throw new Error('Spotify Web Playback недоступен.');
      return spotifyPlayer.activateElement().then(function(){
        return spotifyRequest('https://api.spotify.com/v1/me/player/play?device_id='+encodeURIComponent(deviceId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({uris:[uri]})});
      });
    });
  }
  function play(provider,id){
    if(provider==='Apple Music')return playApple(id);
    if(provider==='Spotify')return playSpotify(id);
    return Promise.reject(new Error('Неизвестный движок воспроизведения: '+provider));
  }
  function pause(provider){
    if(provider==='Apple Music')return Promise.resolve(appleInstance().pause());
    if(provider==='Spotify'&&spotifyPlayer)return spotifyPlayer.pause();
    return Promise.reject(new Error('Движок '+provider+' не подключён.'));
  }
  function resume(provider){
    if(provider==='Apple Music')return Promise.resolve(appleInstance().play());
    if(provider==='Spotify'&&spotifyPlayer)return spotifyPlayer.resume();
    return Promise.reject(new Error('Движок '+provider+' не подключён.'));
  }
  function seek(provider,seconds){
    var value=Math.max(0,Number(seconds)||0);
    if(provider==='Apple Music')return Promise.resolve(appleInstance().seekToTime(value));
    if(provider==='Spotify'&&spotifyPlayer){if(value<=1)spotifyEndedTrack='';return spotifyPlayer.seek(value*1000);}
    return Promise.reject(new Error('Перемотка для '+provider+' недоступна.'));
  }
  function setVolume(provider,value){
    var volume=Math.max(0,Math.min(1,Number(value)||0));
    if(provider==='Apple Music'){appleInstance().volume=volume;return Promise.resolve();}
    if(provider==='Spotify'&&spotifyPlayer)return spotifyPlayer.setVolume(volume);
    return Promise.reject(new Error('Громкость для '+provider+' недоступна.'));
  }
  function getState(provider){
    if(provider==='Apple Music'){
      var music=appleInstance();
      return Promise.resolve({currentTime:Number(music.currentPlaybackTime)||0,duration:Number(music.currentPlaybackDuration)||0,paused:!music.isPlaying,playing:!!music.isPlaying});
    }
    if(provider==='Spotify'&&spotifyPlayer){
      return spotifyPlayer.getCurrentState().then(function(state){
        if(state)spotifyLastState=state;
        var current=state||spotifyLastState;
        if(!current)return {currentTime:0,duration:0,paused:true,playing:false};
        var track=current.track_window&&current.track_window.current_track;
        var ended=!!(track&&spotifyEndedTrack===track.id);
        return {currentTime:ended?(current.duration||0)/1000:(current.position||0)/1000,duration:(current.duration||0)/1000,paused:!state||!!state.paused,playing:!!state&&!state.paused};
      });
    }
    return Promise.reject(new Error('Состояние '+provider+' недоступно.'));
  }
  function getApple(id){return appleRecords[String(id)]||null;}
  function getSpotify(id){return spotifyRecords[String(id)]||null;}
  appleToken=read(APPLE_TOKEN_KEY);spotifyClientId=read(SPOTIFY_ID_KEY);spotifyRedirect=read(SPOTIFY_REDIRECT_KEY);
  try{exchangeCode().catch(function(e){root.console&&console.warn('Spotify authorization:',e.message);});}catch(e){}
  if(token())initSpotifyPlayer();
  root.DorozhkaMajorCatalogs={setAppleToken:setAppleToken,appleBase:appleBase,searchApple:searchApple,playApple:playApple,getApple:getApple,
    setSpotify:setSpotify,spotifyBase:spotifyBase,authorizeSpotify:authorizeSpotify,searchSpotify:searchSpotify,playSpotify:playSpotify,getSpotify:getSpotify,play:play,pause:pause,resume:resume,seek:seek,setVolume:setVolume,getState:getState,
    isSpotifyConnected:function(){return !!token();}};
}(window));