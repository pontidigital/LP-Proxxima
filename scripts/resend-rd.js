#!/usr/bin/env node
/**
 * resend-rd.js
 * Reenvia leads com synced_rd=false do Supabase para o RD Station (API 1.2).
 *
 * Uso:
 *   node scripts/resend-rd.js              # executa o reenvio
 *   node scripts/resend-rd.js --dry-run    # apenas mostra o que seria enviado
 */

const SUPABASE_URL = 'https://xaohhbinykgmzgojszzs.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhb2hoYmlueWtnbXpnb2pzenpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Nzc4ODQsImV4cCI6MjA5MDQ1Mzg4NH0.EUfdalAZ0OZXgYM9spaK6SMG4EcseCJx1nwV5ldpMe4';

const RD_TOKEN = '42bed1c28d044f4c597832d3997af8c1';
const RD_EVENT_NAME = 'Cadastro-LPB2B-Proxxima';
const RD_DEFAULT_SOURCE = 'LP-b2b-proxxima';
const RD_API_URL = 'https://www.rdstation.com.br/api/1.2/conversions';

// Delay between requests to avoid rate limiting (ms)
const DELAY_MS = 1500;

const isDryRun = process.argv.includes('--dry-run');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUnsyncedLeads() {
  const url = `${SUPABASE_URL}/rest/v1/leads?or=(synced_rd.eq.false,synced_rd.is.null)&order=created_at.asc`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function buildRDPayload(lead) {
  const payload = {
    token_rdstation: RD_TOKEN,
    identificador: RD_EVENT_NAME,
    email: lead.email,
    nome: lead.nome,
    telefone: lead.telefone,
    cf_cnpj: lead.cnpj,
    cf_segmento: lead.segmento || '',
    cidade: lead.cidade,
    // Origem padrao, sobrescrita por UTM se disponivel
    traffic_source: lead.utm_source || RD_DEFAULT_SOURCE,
  };

  if (lead.utm_medium) payload.traffic_medium = lead.utm_medium;
  if (lead.utm_campaign) payload.traffic_campaign = lead.utm_campaign;
  if (lead.utm_term) payload.traffic_value = lead.utm_term;

  return payload;
}

async function sendToRD(payload) {
  const res = await fetch(RD_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RD API ${res.status}: ${body}`);
  }

  return res.json().catch(() => ({}));
}

async function markSynced(leadId) {
  const url = `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      synced_rd: true,
      synced_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    console.error(`  [WARN] Failed to update synced_rd for lead ${leadId}: ${res.status}`);
  }
}

async function main() {
  console.log('=== RD Station Lead Resender ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  const leads = await fetchUnsyncedLeads();
  console.log(`Found ${leads.length} unsynced leads.\n`);

  if (leads.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const lead of leads) {
    const payload = buildRDPayload(lead);
    const label = `[${lead.id}] ${lead.email}`;

    if (isDryRun) {
      console.log(`[DRY] ${label}`);
      console.log(`       traffic_source: ${payload.traffic_source}`);
      console.log(`       traffic_medium: ${payload.traffic_medium || '(none)'}`);
      console.log(`       traffic_campaign: ${payload.traffic_campaign || '(none)'}`);
      console.log(`       traffic_value: ${payload.traffic_value || '(none)'}`);
      console.log('');
      success++;
      continue;
    }

    try {
      console.log(`Sending ${label}...`);
      await sendToRD(payload);
      await markSynced(lead.id);
      console.log(`  OK - synced_rd=true`);
      success++;
    } catch (err) {
      console.error(`  FAIL - ${err.message}`);
      failed++;
    }

    // Rate limiting delay
    await sleep(DELAY_MS);
  }

  console.log('\n=== Summary ===');
  console.log(`Total:   ${leads.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed:  ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
