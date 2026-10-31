/* Dorozhka Source — first-party catalog adapter.
 * Searches Openverse's openly licensed audio index. It does not host or mirror tracks.
 * Playback URLs are returned by the upstream provider; attribution/license metadata stays visible.
 */
(function (root) {
  'use strict';
  var API = 'https://api.openverse.org/v1/audio/';
  var records = Object.create(null);
  var LICENSES = 'by,by-sa,by-nc,by-nc-sa,cc0,pdm';
  function clean(value) {
    return String(value || '').replace(/[\u0000-\u001f]/g, ' ').trim();
  }
  function searchTerms(query) {
    var q = clean(query);
    var aliases = {
      'медкид': ['медкид', 'madk1d'],
      'тёмный принц': ['тёмный принц', 'темный принц', 'darkprinceee'],
      'кишлак': ['кишлак', 'kishlak'],
      'ярче солнца': ['ярче солнца'],
      'зоха': ['зоха', 'zoha'],
      'апфс': ['апфс', 'автостопом по фазе сна'],
      'конец солнечных дней': ['конец солнечных дней'],
      'auratoshi': ['auratoshi']
    };
    var key = q.toLocaleLowerCase('ru');
    return aliases[key] || [q];
  }
  function request(term) {
    var params = new URLSearchParams({
      q: term,
      category: 'music',
      page_size: '30',
      extension: 'mp3',
      filter_dead: 'true',
      mature: 'false',
      license: LICENSES
    });
    return fetch(API + '?' + params.toString(), {
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Openverse HTTP ' + response.status);
      return response.json();
    }).then(function (payload) {
      return Array.isArray(payload.results) ? payload.results : [];
    });
  }
  function normalize(item) {
    if (!item || !item.id || !item.url) return null;
    var url = clean(item.url);
    if (!/^https:\/\//i.test(url)) return null;
    var record = {
      id: String(item.id),
      title: clean(item.title) || 'Без названия',
      creator: clean(item.creator),
      url: url,
      thumbnail: /^https:\/\//i.test(item.thumbnail || '') ? item.thumbnail : '',
      duration: Math.max(0, Math.round(Number(item.duration) || 0)),
      license: clean(item.license),
      licenseVersion: clean(item.license_version),
      licenseUrl: clean(item.license_url),
      provider: clean(item.provider || item.source),
      landing: clean(item.foreign_landing_url),
      attribution: clean(item.attribution)
    };
    records[record.id] = record;
    return record;
  }
  function search(query) {
    var terms = searchTerms(query).slice(0, 4);
    return Promise.all(terms.map(function (term) {
      return request(term).catch(function () { return []; });
    })).then(function (sets) {
      var seen = Object.create(null), results = [];
      sets.forEach(function (set) {
        set.forEach(function (item) {
          var record = normalize(item);
          if (record && !seen[record.id]) {
            seen[record.id] = true;
            results.push(record);
          }
        });
      });
      var q = clean(query).toLocaleLowerCase('ru');
      results.sort(function (a, b) {
        function score(x) {
          var text = (x.title + ' ' + x.creator).toLocaleLowerCase('ru');
          return (text.indexOf(q) >= 0 ? 10 : 0) + (x.license ? 1 : 0);
        }
        return score(b) - score(a);
      });
      return results.slice(0, 60);
    });
  }
  root.DorozhkaSource = {
    name: 'Дорожка · открытый каталог',
    search: search,
    get: function (id) { return records[id] || null; }
  };
}(window));
