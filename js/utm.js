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
  var FIRST_TOUCH_KEY = 'rd_first_utm';
  var LAST_TOUCH_KEY = 'rd_last_utm';

  /**
   * Captura UTMs da URL atual.
   * Retorna objeto apenas com chaves que existem.
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
        if (last.utm_source || last.utm_medium || last.utm_campaign || last.utm_term) {
          return last;
        }
      }
    } catch (e) { /* ignore parse errors */ }

    // 3) First touch
    try {
      var firstRaw = localStorage.getItem(FIRST_TOUCH_KEY);
      if (firstRaw) {
        var first = JSON.parse(firstRaw);
        if (first.utm_source || first.utm_medium || first.utm_campaign || first.utm_term) {
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
