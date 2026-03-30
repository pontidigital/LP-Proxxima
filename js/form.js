/**
 * Form Module
 * Validacao, antispam (honeypot + rate limit), envio para Supabase e RD.
 */

(function () {
  'use strict';

  // ====== CONFIGURACAO ======
  var SUPABASE_URL = 'https://xaohhbinykgmzgojszzs.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhb2hoYmlueWtnbXpnb2pzenpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Nzc4ODQsImV4cCI6MjA5MDQ1Mzg4NH0.EUfdalAZ0OZXgYM9spaK6SMG4EcseCJx1nwV5ldpMe4';
  var RD_EVENT_NAME = 'Cadastro-app-proxxima';

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
      input.classList.add('form__input--error');
      errorSpan.textContent = message;
      errorSpan.classList.add('form__error--visible');
    } else {
      input.classList.remove('form__input--error');
      errorSpan.textContent = '';
      errorSpan.classList.remove('form__error--visible');
    }
  }

  function validateForm(data) {
    var isValid = true;
    var fields = ['nome', 'email', 'telefone', 'cnpj', 'cidade'];

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
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Supabase error: ' + response.status);
    }
  }

  // ====== ENVIO PARA RD ======
  function sendToRD(data, trafficPayload) {
    // Usa a API de conversao do RD via script loader
    if (typeof RDStationForms !== 'undefined' || typeof RdIntegration !== 'undefined') {
      // RD Station script loaded
    }

    // Envio direto via API de conversao
    var rdPayload = {
      event_type: 'CONVERSION',
      event_family: 'CDP',
      payload: {
        conversion_identifier: RD_EVENT_NAME,
        email: data.email,
        name: data.nome,
        personal_phone: data.telefone,
        cf_cnpj: data.cnpj,
        city: data.cidade
      }
    };

    // Incluir traffic_* no payload
    if (trafficPayload.traffic_source) rdPayload.payload.traffic_source = trafficPayload.traffic_source;
    if (trafficPayload.traffic_medium) rdPayload.payload.traffic_medium = trafficPayload.traffic_medium;
    if (trafficPayload.traffic_campaign) rdPayload.payload.traffic_campaign = trafficPayload.traffic_campaign;
    if (trafficPayload.traffic_value) rdPayload.payload.traffic_value = trafficPayload.traffic_value;

    console.log('[RD] payload completo', rdPayload);

    // Envia via API do RD
    fetch('https://api.rd.services/platform/conversions?api_key=42bed1c28d044f4c597832d3997af8c1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdPayload)
    })
    .then(function (res) {
      if (res.ok) {
        console.log('[RD] conversao enviada com sucesso');
      } else {
        console.error('[RD] erro ao enviar conversao', res.status);
      }
    })
    .catch(function (err) {
      console.error('[RD] erro de rede', err);
    });
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
    ['nome', 'email', 'telefone', 'cnpj', 'cidade'].forEach(function (field) {
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
          cidade: data.cidade.trim(),
          utm_source: trafficPayload.traffic_source || null,
          utm_medium: trafficPayload.traffic_medium || null,
          utm_campaign: trafficPayload.traffic_campaign || null,
          utm_term: trafficPayload.traffic_value || null,
          created_at: new Date().toISOString()
        };

        // Enviar para Supabase
        await sendToSupabase(supabaseData);

        // Enviar para RD
        sendToRD(data, trafficPayload);

        // Sucesso
        form.style.display = 'none';
        successDiv.hidden = false;

      } catch (err) {
        console.error('[Form] erro no envio', err);
        alert('Não foi possível enviar sua solicitação. Tente novamente ou entre em contato pelo e-mail falecom@proxxima.net.');
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
