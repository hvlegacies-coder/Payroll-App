import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Higher View Taxes'

interface AppMessageProps {
  subject?: string
  body?: string
  attachmentUrl?: string
  attachmentName?: string
  senderName?: string
}

const AppMessageEmail = ({
  subject,
  body,
  attachmentUrl,
  attachmentName,
  senderName,
}: AppMessageProps) => {
  const lines = (body ?? '').split('\n')
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject || `New message from ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerBar}>
            <Text style={brand}>{SITE_NAME}</Text>
          </Section>
          <Section style={content}>
            {subject ? <Heading style={h1}>{subject}</Heading> : null}
            {lines.map((line, i) => (
              <Text key={i} style={text}>
                {line || '\u00A0'}
              </Text>
            ))}
            {attachmentUrl ? (
              <>
                <Hr style={hr} />
                <Text style={attachLabel}>Attachment</Text>
                <Button href={attachmentUrl} style={button}>
                  {attachmentName ? `Download ${attachmentName}` : 'Download attachment'}
                </Button>
              </>
            ) : null}
            {senderName ? (
              <Text style={footer}>— {senderName}, {SITE_NAME}</Text>
            ) : (
              <Text style={footer}>— The {SITE_NAME} Team</Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AppMessageEmail,
  subject: (data: Record<string, any>) => data.subject || `Message from ${SITE_NAME}`,
  displayName: 'App message',
  previewData: {
    subject: 'Weekly Payroll Report',
    body: 'Hi,\n\nPlease find this week\u2019s payroll report attached.\n\nLet me know if you have any questions.',
    attachmentUrl: 'https://example.com/report.pdf',
    attachmentName: 'payroll-report.pdf',
    senderName: 'Admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', padding: '0' }
const headerBar = {
  backgroundColor: '#1e3a8a',
  padding: '20px 28px',
}
const brand = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 'bold' as const,
  margin: '0',
}
const content = { padding: '28px' }
const h1 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#0f172a',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 10px',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const attachLabel = {
  fontSize: '12px',
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 10px',
}
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '28px 0 0',
}