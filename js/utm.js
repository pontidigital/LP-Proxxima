/**
 * UTM Tracking Module
 * Conforme documento oficial de UTMs para RD Marketing.
 *
 * Mapping obrigatorio:
 *   traffic_source   = utm_source
 *   traffic_medium   = utm_medium
 *   traffic_campaign = utm_campaign
 *   traffic_value    = utm_term
 */

(function () {
  'use strict';

  var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term'];
  var CLICK_ID_PARAMS = ['gclid', 'fbclid', 'msclkid'];
  var FIRST_TOUCH_KEY = 'rd_first_utm';
  var LAST_TOUCH_KEY = 'rd_last_utm';

  /**
   * Inferir UTMs a partir de click IDs de midia paga.
   * Google Ads auto-tagging envia apenas gclid sem utm_source/utm_medium.
   * Meta Ads pode enviar apenas fbclid sem UTMs explicitos.
   */
  function inferUtmFromClickId(params) {
    var gclid = params.get('gclid');
    var fbclid = params.get('fbclid');
    var msclkid = params.get('msclkid');
    var inferred = {};

    if (gclid) {
      inferred.utm_source = inferred.utm_source || 'google';
      inferred.utm_medium = inferred.utm_medium || 'cpc';
      inferred.gclid = gclid;
    }
    if (fbclid) {
      inferred.utm_source = inferred.utm_source || 'facebook';
      inferred.utm_medium = inferred.utm_medium || 'cpc';
      inferred.fbclid = fbclid;
    }
    if (msclkid) {
      inferred.utm_source = inferred.utm_source || 'bing';
      inferred.utm_medium = inferred.utm_medium || 'cpc';
      inferred.msclkid = msclkid;
    }

    return Object.keys(inferred).length > 0 ? inferred : null;
  }

  /**
   * Captura UTMs da URL atual.
   * Retorna objeto apenas com chaves que existem.
   * Tambem infere UTMs a partir de gclid/fbclid quando UTMs explicitos nao estao presentes.
   */
  function getUtmFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var utm = {};
    var hasAny = false;

    UTM_PARAMS.forEach(function (key) {
      var val = params.get(key);
      if (val && val.trim()) {
        utm[key] = val.trim();
        hasAny = true;
      }
    });

    // Captura click IDs de midia paga (gclid, fbclid, msclkid)
    CLICK_ID_PARAMS.forEach(function (key) {
      var val = params.get(key);
      if (val && val.trim()) {
        utm[key] = val.trim();
        hasAny = true;
      }
    });

    // Se tem click ID mas nao tem UTMs explicitos, inferir source/medium
    if (hasAny && !utm.utm_source) {
      var inferred = inferUtmFromClickId(params);
      if (inferred) {
        if (!utm.utm_source && inferred.utm_source) utm.utm_source = inferred.utm_source;
        if (!utm.utm_medium && inferred.utm_medium) utm.utm_medium = inferred.utm_medium;
      }
    }

    return hasAny ? utm : null;
  }

  /**
   * Persiste UTMs em localStorage (first_touch e last_touch).
   */
  function persistUtm(utm) {
    if (!utm) return;

    var payload = JSON.stringify({
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      gclid: utm.gclid || null,
      fbclid: utm.fbclid || null,
      msclkid: utm.msclkid || null,
      captured_at: new Date().toISOString(),
      landing_url: window.location.href
    });

    // First touch: salva apenas se nao existir
    if (!localStorage.getItem(FIRST_TOUCH_KEY)) {
      localStorage.setItem(FIRST_TOUCH_KEY, payload);
    }

    // Last touch: sempre sobrescreve
    localStorage.setItem(LAST_TOUCH_KEY, payload);
  }

  /**
   * Resolve UTMs para envio ao RD.
   * Ordem de fallback: URL atual > last_touch > first_touch > vazio
   */
  function resolveUtmForRd() {
    // 1) UTMs atuais da URL
    var urlUtm = getUtmFromUrl();
    if (urlUtm) return urlUtm;

    // 2) Last touch
    try {
      var lastRaw = localStorage.getItem(LAST_TOUCH_KEY);
      if (lastRaw) {
        var last = JSON.parse(lastRaw);
        if (last.utm_source || last.utm_medium || last.utm_campaign || last.utm_term || last.gclid || last.fbclid || last.msclkid) {
          return last;
        }
      }
    } catch (e) { /* ignore parse errors */ }

    // 3) First touch
    try {
      var firstRaw = localStorage.getItem(FIRST_TOUCH_KEY);
      if (firstRaw) {
        var first = JSON.parse(firstRaw);
        if (first.utm_source || first.utm_medium || first.utm_campaign || first.utm_term || first.gclid || first.fbclid || first.msclkid) {
          return first;
        }
      }
    } catch (e) { /* ignore parse errors */ }

    // 4) Nada disponivel
    return {};
  }

  /**
   * Retorna os campos traffic_* prontos para o payload do RD.
   * Remove campos undefined/null.
   */
  function getTrafficPayload() {
    var resolved = resolveUtmForRd();
    var payload = {};

    if (resolved.utm_source) payload.traffic_source = resolved.utm_source;
    if (resolved.utm_medium) payload.traffic_medium = resolved.utm_medium;
    if (resolved.utm_campaign) payload.traffic_campaign = resolved.utm_campaign;
    if (resolved.utm_term) payload.traffic_value = resolved.utm_term;
    if (resolved.gclid) payload.gclid = resolved.gclid;
    if (resolved.fbclid) payload.fbclid = resolved.fbclid;
    if (resolved.msclkid) payload.msclkid = resolved.msclkid;

    // Diagnostico
    if (Object.keys(payload).length > 0) {
      console.log('[RD] payload traffic', payload);
    } else {
      console.warn('[RD] sem UTM para enviar', {
        currentUrl: window.location.href,
        lastUtm: localStorage.getItem(LAST_TOUCH_KEY),
        firstUtm: localStorage.getItem(FIRST_TOUCH_KEY)
      });
    }

    return payload;
  }

  // Rodar captura/persistencia no carregamento
  var utm = getUtmFromUrl();
  if (utm) {
    persistUtm(utm);
  }

  // Exportar para uso global
  window.ProxximaUTM = {
    getUtmFromUrl: getUtmFromUrl,
    resolveUtmForRd: resolveUtmForRd,
    getTrafficPayload: getTrafficPayload,
    persistUtm: persistUtm
  };
})();
