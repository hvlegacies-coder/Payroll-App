import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Higher View Tax Services"

interface WeekSummary {
  week_label: string;
  total_received: number;
  total_share: number;
  preparer_fee: number;
  returns_count: number;
}

interface EarningsReportProps {
  preparerName?: string;
  grandReceived?: number;
  grandShare?: number;
  grandFee?: number;
  grandReturns?: number;
  weeks?: WeekSummary[];
  detailRows?: Array<{
    taxpayer: string;
    efin: string;
    received: number;
    highPrep: number;
    afterAdvance: number;
    share: number;
  }>;
  selectedWeekLabel?: string;
}

const fmt = (n: number | undefined | null) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const EarningsReportEmail = ({
  preparerName = 'Preparer',
  grandReceived = 0,
  grandShare = 0,
  grandFee = 0,
  grandReturns = 0,
  weeks = [],
  detailRows = [],
  selectedWeekLabel = '',
}: EarningsReportProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Earnings Report for {preparerName} — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📊 Earnings Report</Heading>
        <Text style={subtitle}>Preparer: <strong>{preparerName}</strong></Text>

        <Section style={kpiRow}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <tr>
              <td style={kpiCard}>
                <div style={kpiLabel}>Total Received</div>
                <div style={{ ...kpiValue, color: '#d4a843' }}>{fmt(grandReceived)}</div>
              </td>
              <td style={kpiCard}>
                <div style={kpiLabel}>Total Fees</div>
                <div style={{ ...kpiValue, color: '#e05555' }}>{fmt(grandFee)}</div>
              </td>
              <td style={kpiCard}>
                <div style={kpiLabel}>Total Share</div>
                <div style={{ ...kpiValue, color: '#16a34a' }}>{fmt(grandShare)}</div>
              </td>
              <td style={kpiCard}>
                <div style={kpiLabel}>Returns</div>
                <div style={{ ...kpiValue, color: '#3b82f6' }}>{grandReturns}</div>
              </td>
            </tr>
          </table>
        </Section>

        <Hr style={divider} />

        {/* Weekly Chart Bars */}
        <Heading as="h2" style={h2}>📈 Weekly Earnings</Heading>
        {weeks.map((w, i) => {
          const maxVal = Math.max(...weeks.map(wk => Number(wk.total_received) || 0), 1);
          const recPct = Math.max(2, Math.round(((Number(w.total_received) || 0) / maxVal) * 100));
          const sharePct = Math.max(2, Math.round(((Number(w.total_share) || 0) / maxVal) * 100));
          return (
            <Section key={i} style={{ marginBottom: '10px' }}>
              <Text style={{ fontSize: '11px', color: '#666', margin: '0 0 3px' }}>{w.week_label}</Text>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}><tr>
                <td style={{ width: `${recPct}%`, backgroundColor: '#d4a843', height: '16px', borderRadius: '3px', padding: 0 }}></td>
                <td style={{ paddingLeft: '6px', fontSize: '11px', color: '#d4a843' }}>{fmt(w.total_received)}</td>
              </tr></table>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginTop: '2px' }}><tr>
                <td style={{ width: `${sharePct}%`, backgroundColor: '#16a34a', height: '16px', borderRadius: '3px', padding: 0 }}></td>
                <td style={{ paddingLeft: '6px', fontSize: '11px', color: '#16a34a' }}>{fmt(w.total_share)}</td>
              </tr></table>
            </Section>
          );
        })}
        <Section style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <Text style={{ fontSize: '11px', color: '#888', margin: 0 }}>🟡 Received &nbsp;&nbsp; 🟢 Your Share</Text>
        </Section>

        <Hr style={divider} />

        {/* Weekly Summary Table */}
        <Heading as="h2" style={h2}>📋 Weekly Summary</Heading>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Week</th>
              <th style={{ ...th, textAlign: 'right' as const }}>Returns</th>
              <th style={{ ...th, textAlign: 'right' as const }}>Received</th>
              <th style={{ ...th, textAlign: 'right' as const }}>Fee</th>
              <th style={{ ...th, textAlign: 'right' as const }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => (
              <tr key={i}>
                <td style={td}>{w.week_label}</td>
                <td style={{ ...td, textAlign: 'right' as const }}>{w.returns_count}</td>
                <td style={{ ...td, textAlign: 'right' as const, color: '#d4a843' }}>{fmt(w.total_received)}</td>
                <td style={{ ...td, textAlign: 'right' as const, color: '#e05555' }}>{fmt(w.preparer_fee)}</td>
                <td style={{ ...td, textAlign: 'right' as const, color: '#16a34a', fontWeight: 'bold' }}>{fmt(w.total_share)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #d4a843', backgroundColor: '#f9f7f2' }}>
              <td style={{ ...td, fontWeight: 'bold', color: '#d4a843' }}>TOTAL</td>
              <td style={{ ...td, textAlign: 'right' as const, fontWeight: 'bold' }}>{grandReturns}</td>
              <td style={{ ...td, textAlign: 'right' as const, fontWeight: 'bold', color: '#d4a843' }}>{fmt(grandReceived)}</td>
              <td style={{ ...td, textAlign: 'right' as const, fontWeight: 'bold', color: '#e05555' }}>{fmt(grandFee)}</td>
              <td style={{ ...td, textAlign: 'right' as const, fontWeight: 'bold', color: '#16a34a' }}>{fmt(grandShare)}</td>
            </tr>
          </tbody>
        </table>

        {selectedWeekLabel && detailRows.length > 0 && (
          <>
            <Hr style={divider} />
            <Heading as="h2" style={h2}>📝 Detail — {selectedWeekLabel}</Heading>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Taxpayer</th>
                  <th style={th}>EFIN</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>Received</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>High Prep</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>After Adv.</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{r.taxpayer}</td>
                    <td style={td}>{r.efin || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' as const, color: '#d4a843' }}>{fmt(r.received)}</td>
                    <td style={{ ...td, textAlign: 'right' as const }}>{fmt(r.highPrep)}</td>
                    <td style={{ ...td, textAlign: 'right' as const }}>{fmt(r.afterAdvance)}</td>
                    <td style={{ ...td, textAlign: 'right' as const, color: '#16a34a', fontWeight: 'bold' }}>{fmt(r.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <Hr style={divider} />
        <Text style={footer}>{SITE_NAME} — Preparer Earnings Report</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EarningsReportEmail,
  subject: (data: Record<string, any>) => `📊 Earnings Report — ${data.preparerName || 'Preparer'}`,
  displayName: 'Earnings Report',
  previewData: {
    preparerName: 'FRANKS, KADARRA',
    grandReceived: 10050,
    grandShare: 3015,
    grandFee: 2010,
    grandReturns: 15,
    weeks: [
      { week_label: 'Week 1 - Jan 6, 2026', total_received: 4250, total_share: 1275, preparer_fee: 850, returns_count: 7 },
      { week_label: 'Week 2 - Jan 13, 2026', total_received: 5800, total_share: 1740, preparer_fee: 1160, returns_count: 8 },
    ],
    detailRows: [
      { taxpayer: 'DOE, JOHN', efin: '123456', received: 500, highPrep: 0, afterAdvance: 400, share: 200 },
    ],
    selectedWeekLabel: 'Week 1 - Jan 6, 2026',
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '650px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 8px' }
const h2 = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 12px' }
const subtitle = { fontSize: '14px', color: '#555', margin: '0 0 24px' }
const kpiRow = { marginBottom: '20px' }
const kpiCard = { padding: '12px', textAlign: 'center' as const, backgroundColor: '#f9f7f2', borderRadius: '8px' }
const kpiLabel = { fontSize: '11px', color: '#888', marginBottom: '4px' }
const kpiValue = { fontSize: '20px', fontWeight: 'bold' as const }
const divider = { borderColor: '#e5e5e5', margin: '24px 0' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' }
const th = { padding: '8px 10px', textAlign: 'left' as const, color: '#888', borderBottom: '2px solid #d4a843', fontSize: '12px' }
const td = { padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: '13px', color: '#333' }
const footer = { fontSize: '12px', color: '#999', textAlign: 'center' as const, margin: '20px 0 0' }
