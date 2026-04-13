/**
 * Form Module
 * Validacao, antispam (honeypot + rate limit), envio para Supabase e RD.
 */

(function () {
  'use strict';

  // ====== CONFIGURACAO ======
  var SUPABASE_URL = 'https://xaohhbinykgmzgojszzs.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhb2hoYmlueWtnbXpnb2pzenpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Nzc4ODQsImV4cCI6MjA5MDQ1Mzg4NH0.EUfdalAZ0OZXgYM9spaK6SMG4EcseCJx1nwV5ldpMe4';
  var RD_EVENT_NAME = 'Cadastro-LPB2B-Proxxima';

  // Rate limit: 1 envio a cada 30 segundos
  var RATE_LIMIT_MS = 30000;
  var lastSubmitTime = 0;

  // ====== VALIDACAO ======
  var validators = {
    nome: function (val) {
      if (!val.trim()) return 'Preencha este campo para continuar.';
      if (val.trim().length < 3) return 'Informe seu nome completo.';
      return '';
    },
    email: function (val) {
      if (!val.trim()) return 'Preencha este campo para continuar.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Informe um e-mail válido. Ex.: seu@email.com.br';
      return '';
    },
    telefone: function (val) {
      if (!val.trim()) return 'Preencha este campo para continuar.';
      var digits = val.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) return 'Informe um telefone válido com DDD.';
      return '';
    },
    cnpj: function (val) {
      if (!val.trim()) return 'Preencha este campo para continuar.';
      var digits = val.replace(/\D/g, '');
      if (digits.length !== 14) return 'Informe um CNPJ válido. Ex.: 00.000.000/0000-00';
      return '';
    },
    segmento: function (val) {
      if (!val || !val.trim()) return 'Selecione um segmento.';
      return '';
    },
    cidade: function (val) {
      if (!val.trim()) return 'Preencha este campo para continuar.';
      return '';
    }
  };

  function validateField(name, value) {
    return validators[name] ? validators[name](value) : '';
  }

  function showError(name, message) {
    var input = document.getElementById(name);
    var errorSpan = document.querySelector('[data-error="' + name + '"]');
    if (message) {
      input.classList.add(input.tagName === 'SELECT' ? 'form__select--error' : 'form__input--error');
      errorSpan.textContent = message;
      errorSpan.classList.add('form__error--visible');
    } else {
      input.classList.remove('form__input--error', 'form__select--error');
      errorSpan.textContent = '';
      errorSpan.classList.remove('form__error--visible');
    }
  }

  function validateForm(data) {
    var isValid = true;
    var fields = ['nome', 'email', 'telefone', 'cnpj', 'segmento', 'cidade'];

    fields.forEach(function (field) {
      var error = validateField(field, data[field] || '');
      showError(field, error);
      if (error) isValid = false;
    });

    return isValid;
  }

  // ====== MASCARAS ======
  function maskTelefone(value) {
    var digits = value.replace(/\D/g, '').substring(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return '(' + digits.substring(0, 2) + ') ' + digits.substring(2);
    if (digits.length <= 10) return '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 6) + '-' + digits.substring(6);
    return '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 7) + '-' + digits.substring(7);
  }

  function maskCNPJ(value) {
    var digits = value.replace(/\D/g, '').substring(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.substring(0, 2) + '.' + digits.substring(2);
    if (digits.length <= 8) return digits.substring(0, 2) + '.' + digits.substring(2, 5) + '.' + digits.substring(5);
    if (digits.length <= 12) return digits.substring(0, 2) + '.' + digits.substring(2, 5) + '.' + digits.substring(5, 8) + '/' + digits.substring(8);
    return digits.substring(0, 2) + '.' + digits.substring(2, 5) + '.' + digits.substring(5, 8) + '/' + digits.substring(8, 12) + '-' + digits.substring(12);
  }

  // ====== ENVIO PARA SUPABASE ======
  async function sendToSupabase(data) {
    var response = await fetch(SUPABASE_URL + '/rest/v1/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Supabase error: ' + response.status);
    }

    var rows = await response.json();
    return rows[0].id;
  }

  // ====== ATUALIZAR SYNC STATUS NO SUPABASE ======
  async function updateSyncStatus(leadId, syncData) {
    var response = await fetch(SUPABASE_URL + '/rest/v1/leads?id=eq.' + leadId, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify(syncData)
    });

    if (!response.ok) {
      console.error('[Sync] falha ao atualizar status:', response.status);
    } else {
      console.log('[Sync] status atualizado para lead', leadId);
    }
  }

  // ====== ENVIO PARA N8N (WEBHOOK) ======
  async function sendToN8N(data, trafficPayload) {
    var payload = {
      name: data.nome.trim(),
      email: data.email.trim(),
      mobile_phone: data.telefone.trim(),
      cf_cnpj: data.cnpj.trim(),
      cf_segmento: data.segmento.trim(),
      city: data.cidade.trim(),
      identificador: RD_EVENT_NAME
    };

    if (trafficPayload) {
      if (trafficPayload.traffic_source) payload.traffic_source = trafficPayload.traffic_source;
      if (trafficPayload.traffic_medium) payload.traffic_medium = trafficPayload.traffic_medium;
      if (trafficPayload.traffic_campaign) payload.traffic_campaign = trafficPayload.traffic_campaign;
      if (trafficPayload.traffic_value) payload.traffic_value = trafficPayload.traffic_value;
    }

    var res = await fetch('https://n8n.proxxima.net/webhook/rd-formulario-b2b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error('[N8N] erro ' + res.status);
    }
    console.log('[N8N] webhook enviado com sucesso');
  }

  // ====== ENVIO PARA RD (API DIRETA) ======
  var RD_TOKEN = '42bed1c28d044f4c597832d3997af8c1';

  async function sendToRD(data, trafficPayload) {
    var params = new URLSearchParams();
    params.append('token_rdstation', RD_TOKEN);
    params.append('identificador', RD_EVENT_NAME);
    params.append('email', data.email.trim());
    params.append('nome', data.nome.trim());
    params.append('telefone', data.telefone.trim());
    params.append('cf_cnpj', data.cnpj.trim());
    params.append('cf_segmento', data.segmento.trim());
    params.append('cidade', data.cidade.trim());

    if (trafficPayload) {
      if (trafficPayload.traffic_source) params.append('c_utmSource', trafficPayload.traffic_source);
      if (trafficPayload.traffic_medium) params.append('c_utmMedium', trafficPayload.traffic_medium);
      if (trafficPayload.traffic_campaign) params.append('c_utmCampaign', trafficPayload.traffic_campaign);
      if (trafficPayload.traffic_value) params.append('c_utmTerm', trafficPayload.traffic_value);
    }

    console.log('[RD] enviando conversão via fetch', Object.fromEntries(params));

    await fetch('https://www.rdstation.com.br/api/1.2/conversions', {
      method: 'POST',
      mode: 'no-cors',
      body: params
    });

    console.log('[RD] conversão enviada');
  }

  // ====== INIT ======
  function init() {
    var form = document.getElementById('lead-form');
    var submitBtn = document.getElementById('form-submit');
    var successDiv = document.getElementById('form-success');

    if (!form) return;

    // Mascaras em tempo real
    var telInput = document.getElementById('telefone');
    var cnpjInput = document.getElementById('cnpj');

    telInput.addEventListener('input', function () {
      this.value = maskTelefone(this.value);
    });

    cnpjInput.addEventListener('input', function () {
      this.value = maskCNPJ(this.value);
    });

    // Validacao em tempo real (blur)
    ['nome', 'email', 'telefone', 'cnpj', 'segmento', 'cidade'].forEach(function (field) {
      var input = document.getElementById(field);
      input.addEventListener('blur', function () {
        var error = validateField(field, this.value);
        showError(field, error);
      });
      input.addEventListener('input', function () {
        if (this.classList.contains('form__input--error')) {
          var error = validateField(field, this.value);
          showError(field, error);
        }
      });
    });

    // Submit
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Honeypot check
      var honeypot = document.getElementById('website');
      if (honeypot && honeypot.value) {
        // Bot detected, fake success
        form.style.display = 'none';
        successDiv.hidden = false;
        return;
      }

      // Rate limit check
      var now = Date.now();
      if (now - lastSubmitTime < RATE_LIMIT_MS) {
        alert('Aguarde alguns segundos antes de enviar novamente.');
        return;
      }

      var data = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        telefone: document.getElementById('telefone').value,
        cnpj: document.getElementById('cnpj').value,
        segmento: document.getElementById('segmento').value,
        cidade: document.getElementById('cidade').value
      };

      // Validate
      if (!validateForm(data)) return;

      // Loading state
      submitBtn.classList.add('form__submit--loading');
      submitBtn.disabled = true;
      lastSubmitTime = now;

      try {
        // Get UTM traffic payload
        var trafficPayload = window.ProxximaUTM ? window.ProxximaUTM.getTrafficPayload() : {};

        // Dados para Supabase (inclui UTMs)
        var supabaseData = {
          nome: data.nome.trim(),
          email: data.email.trim(),
          telefone: data.telefone.trim(),
          cnpj: data.cnpj.trim(),
          segmento: data.segmento.trim(),
          cidade: data.cidade.trim(),
          utm_source: trafficPayload.traffic_source || null,
          utm_medium: trafficPayload.traffic_medium || null,
          utm_campaign: trafficPayload.traffic_campaign || null,
          utm_term: trafficPayload.traffic_value || null,
          created_at: new Date().toISOString()
        };

        // Dispara os 3 canais em paralelo — sucesso se ao menos 1 funcionar
        var results = await Promise.allSettled([
          sendToSupabase(supabaseData),
          sendToN8N(data, trafficPayload),
          sendToRD(data, trafficPayload)
        ]);

        var supabaseOk = results[0].status === 'fulfilled';
        var n8nOk = results[1].status === 'fulfilled';
        var rdOk = results[2].status === 'fulfilled';

        if (supabaseOk) console.log('[Form] Supabase OK');
        else console.error('[Form] Supabase falhou', results[0].reason);

        if (n8nOk) console.log('[Form] N8N OK');
        else console.error('[Form] N8N falhou', results[1].reason);

        if (rdOk) console.log('[Form] RD OK');
        else console.error('[Form] RD falhou', results[2].reason);

        // Atualiza sync status no Supabase (N8N e RD são canais independentes)
        if (supabaseOk) {
          var leadId = results[0].value;
          await updateSyncStatus(leadId, {
            synced_n8n: n8nOk,
            synced_rd: rdOk,
            synced_at: (n8nOk || rdOk) ? new Date().toISOString() : null
          });
        }

        // Sucesso se pelo menos um canal recebeu o lead
        if (supabaseOk || n8nOk || rdOk) {
          form.style.display = 'none';
          successDiv.hidden = false;
        } else {
          throw new Error('Todos os canais falharam');
        }

      } catch (err) {
        console.error('[Form] erro no envio', err);
        alert('Não foi possível enviar sua solicitação. Tente novamente ou entre em contato pelo e-mail corporativo@proxxima.net.');
        submitBtn.classList.remove('form__submit--loading');
        submitBtn.disabled = false;
      }
    });
  }

  // Aguardar DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
