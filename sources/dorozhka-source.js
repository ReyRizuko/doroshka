/* Дорожка: адаптер официального Audius API. */
(function (root) {
  'use strict';
  var API='https://api.audius.co/v1';
  var records=Object.create(null);
  var aliases={
    'медкид':['медкид','madk1d'],
    'тёмный принц':['тёмный принц','темный принц','darkprinceee'],
    'темный принц':['темный принц','тёмный принц','darkprinceee'],
    'кишлак':['кишлак','kishlak'],
    'ярче солнца':['ярче солнца','yarche solntsa'],
    'зоха':['зоха','zoha'],
    'апфс':['апфс','автостопом по фазе сна'],
    'конец солнечных дней':['конец солнечных дней','konets solnechnykh dney'],
    'auratoshi':['auratoshi']
  };
  function clean(v){return String(v||'').replace(/[\u0000-\u001f]/g,' ').trim();}
  function norm(v){return clean(v).toLocaleLowerCase('ru').replace(/ё/g,'е');}
  function terms(q){var n=norm(q);return aliases[n]||[clean(q)];}
  function request(path){
    return fetch(API+path,{headers:{Accept:'application/json'},cache:'no-store'})
      .then(function(r){if(!r.ok)throw new Error('Audius HTTP '+r.status);return r.json();})
      .then(function(j){if(j&&j.errors&&j.errors.length)throw new Error(clean(j.errors[0].message)||'Audius API error');return j.data||[];});
  }
  function search(q){
    var qs=terms(q).slice(0,4);
    return Promise.all(qs.map(function(term){
      return request('/tracks/search?query='+encodeURIComponent(term)+'&limit=25').catch(function(e){return {__error:e};});
    })).then(function(sets){
      var errors=sets.filter(function(x){return x&&x.__error;});
      var all=[],seen=Object.create(null);
      sets.forEach(function(set){if(!Array.isArray(set))return;set.forEach(function(t){
        if(!t||!t.id||!t.title||seen[t.id])return;
        seen[t.id]=1;
        var creator=t.user&&t.user.name||t.artist||'';
        var cover=t.artwork&&(t.artwork['480x480']||t.artwork['150x150']||t.artwork['1000x1000'])||'';
        var x={id:String(t.id),title:clean(t.title)||'Без названия',creator:clean(creator),
          duration:Number(t.duration)||0,thumbnail:cover,
          permalink:t.permalink&&/^https:\/\//i.test(t.permalink)?t.permalink:'',
          url:API+'/tracks/'+encodeURIComponent(t.id)+'/stream?app_name=Doroshka',
          provider:'Audius'};
        records[x.id]=x;all.push(x);
      });});
      if(!all.length&&errors.length===sets.length)throw errors[0].__error;
      var searchTerms=qs.map(norm);
      all.sort(function(a,b){
        function score(x){var artist=norm(x.creator),title=norm(x.title),v=0;
          if(searchTerms.some(function(t){return t&&artist.indexOf(t)>=0;}))v+=100;
          if(searchTerms.some(function(t){return t&&title.indexOf(t)>=0;}))v+=30;
          return v;
        }
        return score(b)-score(a);
      });
      return all.slice(0,60);
    });
  }
  root.DorozhkaSource={name:'Дорожка · Audius',search:search,get:function(id){return records[id]||null;}};
}(window));
