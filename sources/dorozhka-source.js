/* Дорожка: собственный адаптер каталога Internet Archive. */
(function (root) {
  'use strict';
  var API = 'https://archive.org';
  var records = Object.create(null);
  function clean(v) { return String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim(); }
  var aliases = {
    'медкид':['медкид','madk1d'], 'тёмный принц':['тёмный принц','darkprinceee'],
    'темный принц':['темный принц','darkprinceee'], 'кишлак':['кишлак','kishlak'],
    'ярче солнца':['ярче солнца'], 'зоха':['зоха','zoha'], 'апфс':['апфс','автостопом по фазе сна'],
    'конец солнечных дней':['конец солнечных дней'], 'auratoshi':['auratoshi']
  };
  function terms(q) { var v=clean(q).toLocaleLowerCase('ru'); return aliases[v] || [clean(q)]; }
  function searchOne(q) {
    var params = new URLSearchParams();
    params.set('q','('+q+') AND mediatype:audio');
    ['identifier','title','creator','description'].forEach(function(k){params.append('fl[]',k);});
    params.set('rows','25'); params.set('sort[]','downloads desc'); params.set('output','json');
    return fetch(API+'/advancedsearch.php?'+params.toString(),{headers:{Accept:'application/json'},cache:'no-store'})
      .then(function(r){if(!r.ok)throw new Error('Internet Archive HTTP '+r.status);return r.json();})
      .then(function(j){return (j.response&&j.response.docs)||[];});
  }
  function search(q) {
    var list=terms(q).slice(0,4);
    return Promise.all(list.map(function(t){return searchOne(t).catch(function(){return [];});})).then(function(sets){
      var seen=Object.create(null),out=[];
      sets.forEach(function(set){set.forEach(function(d){
        if(!d||!d.identifier||seen[d.identifier])return;
        seen[d.identifier]=1;
        var x={id:String(d.identifier),title:clean(d.title)||String(d.identifier),
          creator:Array.isArray(d.creator)?clean(d.creator[0]):clean(d.creator),
          description:clean(d.description),provider:'Internet Archive',landing:'https://archive.org/details/'+encodeURIComponent(d.identifier)};
        records[x.id]=x;out.push(x);
      });});
      return out.slice(0,40);
    });
  }
  root.DorozhkaSource={name:'Дорожка · собственный каталог',search:search,get:function(id){return records[id]||null;}};
}(window));
