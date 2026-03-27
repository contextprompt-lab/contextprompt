#!/usr/bin/env node
/**
 * Fetches Google Search Console data and writes markdown reports
 * to reports/search-console/ for the autonomous agents to read.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — JSON key file contents (base64 encoded)
 *   SEARCH_CONSOLE_SITE_URL — e.g. "sc-domain:contextprompt.app"
 */

import { google } from 'googleapis';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', 'reports', 'search-console');

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set');

  const key = JSON.parse(Buffer.from(json, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function fetchData(searchconsole, siteUrl, startDate, endDate) {
  // Top queries
  const queries = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 50,
      type: 'web',
    },
  });

  // Top pages
  const pages = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 30,
      type: 'web',
    },
  });

  // Top queries by page (for understanding which pages rank for what)
  const queryByPage = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit: 100,
      type: 'web',
    },
  });

  // Device breakdown
  const devices = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['device'],
      type: 'web',
    },
  });

  // Country breakdown
  const countries = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['country'],
      rowLimit: 15,
      type: 'web',
    },
  });

  return {
    queries: queries.data.rows || [],
    pages: pages.data.rows || [],
    queryByPage: queryByPage.data.rows || [],
    devices: devices.data.rows || [],
    countries: countries.data.rows || [],
  };
}

function buildMarkdown(data, startDate, endDate, today) {
  const totalClicks = data.queries.reduce((s, r) => s + (r.clicks || 0), 0);
  const totalImpressions = data.queries.reduce((s, r) => s + (r.impressions || 0), 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0';
  const avgPosition = data.queries.length > 0
    ? (data.queries.reduce((s, r) => s + (r.position || 0), 0) / data.queries.length).toFixed(1)
    : 'N/A';

  let md = `# Search Console Report — ${today}\n\n`;
  md += `**Period:** ${startDate} to ${endDate}\n\n`;
  md += `## Summary\n`;
  md += `- Total clicks: ${totalClicks}\n`;
  md += `- Total impressions: ${totalImpressions}\n`;
  md += `- Average CTR: ${avgCTR}%\n`;
  md += `- Average position: ${avgPosition}\n\n`;

  // Top queries
  md += `## Top Queries (by clicks)\n\n`;
  md += `| Query | Clicks | Impressions | CTR | Position |\n`;
  md += `|-------|--------|-------------|-----|----------|\n`;
  for (const row of data.queries.slice(0, 30)) {
    const q = row.keys[0];
    const ctr = ((row.ctr || 0) * 100).toFixed(1);
    const pos = (row.position || 0).toFixed(1);
    md += `| ${q} | ${row.clicks} | ${row.impressions} | ${ctr}% | ${pos} |\n`;
  }
  md += '\n';

  // High-impression low-CTR opportunities
  const opportunities = data.queries
    .filter(r => r.impressions >= 10 && (r.ctr || 0) < 0.03 && (r.position || 100) <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  if (opportunities.length > 0) {
    md += `## Opportunities (high impressions, low CTR — improve these pages)\n\n`;
    md += `| Query | Impressions | CTR | Position | Action |\n`;
    md += `|-------|-------------|-----|----------|--------|\n`;
    for (const row of opportunities) {
      const q = row.keys[0];
      const ctr = ((row.ctr || 0) * 100).toFixed(1);
      const pos = (row.position || 0).toFixed(1);
      const action = pos <= 5 ? 'Improve meta description/title' : 'Improve content to rank higher';
      md += `| ${q} | ${row.impressions} | ${ctr}% | ${pos} | ${action} |\n`;
    }
    md += '\n';
  }

  // Top pages
  md += `## Top Pages (by clicks)\n\n`;
  md += `| Page | Clicks | Impressions | CTR | Position |\n`;
  md += `|------|--------|-------------|-----|----------|\n`;
  for (const row of data.pages.slice(0, 20)) {
    const page = row.keys[0].replace('https://contextprompt.app', '');
    const ctr = ((row.ctr || 0) * 100).toFixed(1);
    const pos = (row.position || 0).toFixed(1);
    md += `| ${page || '/'} | ${row.clicks} | ${row.impressions} | ${ctr}% | ${pos} |\n`;
  }
  md += '\n';

  // Pages with no clicks but impressions (underperforming)
  const underperforming = data.pages
    .filter(r => r.clicks === 0 && r.impressions >= 5)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  if (underperforming.length > 0) {
    md += `## Underperforming Pages (impressions but no clicks)\n\n`;
    md += `| Page | Impressions | Position |\n`;
    md += `|------|-------------|----------|\n`;
    for (const row of underperforming) {
      const page = row.keys[0].replace('https://contextprompt.app', '');
      const pos = (row.position || 0).toFixed(1);
      md += `| ${page || '/'} | ${row.impressions} | ${pos} |\n`;
    }
    md += '\n';
  }

  // Device breakdown
  if (data.devices.length > 0) {
    md += `## Device Breakdown\n\n`;
    md += `| Device | Clicks | Impressions | CTR |\n`;
    md += `|--------|--------|-------------|-----|\n`;
    for (const row of data.devices) {
      const ctr = ((row.ctr || 0) * 100).toFixed(1);
      md += `| ${row.keys[0]} | ${row.clicks} | ${row.impressions} | ${ctr}% |\n`;
    }
    md += '\n';
  }

  // Country breakdown
  if (data.countries.length > 0) {
    md += `## Top Countries\n\n`;
    md += `| Country | Clicks | Impressions |\n`;
    md += `|---------|--------|-------------|\n`;
    for (const row of data.countries.slice(0, 10)) {
      md += `| ${row.keys[0]} | ${row.clicks} | ${row.impressions} |\n`;
    }
    md += '\n';
  }

  // Actionable insights for agents
  md += `## Agent Instructions\n\n`;
  md += `Use this data to prioritize your work:\n`;
  md += `- **SEO Agent:** Focus on "Opportunities" table — these queries have impressions but low CTR. Improve the ranking pages' titles and meta descriptions.\n`;
  md += `- **Growth Agent:** Check which competitor comparison queries appear. Create vs pages for any missing competitors.\n`;
  md += `- **Content Agent:** Look at top queries to understand what users search for. Add blog topics targeting related long-tail keywords.\n`;
  md += `- **Conversion Agent:** Check top landing pages. Improve CTAs on pages that get traffic but may not convert.\n`;

  return md;
}

async function main() {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL || 'sc-domain:contextprompt.app';

  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const now = new Date();
  const today = formatDate(now);

  // Last 28 days (Search Console data has ~3 day lag)
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 28);

  console.log(`Fetching Search Console data: ${formatDate(startDate)} to ${formatDate(endDate)}`);

  const data = await fetchData(searchconsole, siteUrl, formatDate(startDate), formatDate(endDate));

  console.log(`Got ${data.queries.length} queries, ${data.pages.length} pages`);

  const markdown = buildMarkdown(data, formatDate(startDate), formatDate(endDate), today);

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(join(REPORTS_DIR, 'latest.md'), markdown);
  writeFileSync(join(REPORTS_DIR, `${today}.md`), markdown);

  console.log('Reports written to reports/search-console/');
}

main().catch((err) => {
  console.error('Failed to fetch Search Console data:', err.message);
  process.exit(1);
});
