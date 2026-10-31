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
      'тёмный принц': ['тёмный принц', 'darkprinceee'],
      'темный принц': ['темный принц', 'darkprinceee'],
      'кишлак': ['кишлак', 'kishlak'],
      'зоха': ['зоха', 'zoha'],
      'апфс': ['апфс', 'автостопом по фазе сна'],
      'auratoshi': ['auratoshi']
    };
    var key = q.toLocaleLowerCase('ru');
    return aliases[key] || [q];
  }
  function request(term) {
    var params = new URLSearchParams({
      q: term,
      category: 'music',
      page_size: '20',
      filter_dead: 'true',
      mature: 'false',
      license: LICENSES
    });
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 7500) : null;
    return fetch(API + '?' + params.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error('Openverse HTTP ' + response.status);
      return response.json();
    }).then(function (payload) {
      return Array.isArray(payload.results) ? payload.results : [];
    }).finally(function () {
      if (timer) clearTimeout(timer);
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
      duration: Math.max(0, Math.round((Number(item.duration) || 0) / 1000)),
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
    var terms = searchTerms(query).slice(0, 2);
    // One fast request first; only try the common Latin/Cyrillic alias if it returned nothing.
    return request(terms[0]).then(function (first) {
      var primary = first.map(normalize).filter(Boolean);
      if (primary.length || terms.length < 2) return primary;
      return request(terms[1]).then(function (second) {
        return second.map(normalize).filter(Boolean);
      });
    }).then(function (results) {
      var seen = Object.create(null);
      results = results.filter(function (record) {
        if (seen[record.id]) return false;
        seen[record.id] = true;
        return true;
      });
      return results.slice(0, 30);
    });
  }
  root.DorozhkaSource = {
    name: 'Дорожка · открытый каталог',
    search: search,
    get: function (id) { return records[id] || null; }
  };
}(window));
