import { PageHeader } from '@/components/payroll/PageHeader';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { ReferralOfficeMappingPanel } from '@/components/payroll/ReferralOfficeMappingPanel';

const REFERRAL_APP_URL = 'https://higher-view-referral-app.vercel.app/';

export default function ReferralProgram() {
  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <PageHeader
          title="Referral Program"
          description="Higher View Referral — manage referrals without leaving the payroll app."
          actions={
            <a href={REFERRAL_APP_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                Open in New Tab
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          }
        />
        <iframe
          src={REFERRAL_APP_URL}
          title="Higher View Referral Program"
          className="w-full h-[calc(100vh-160px)] rounded-lg border border-border"
        />
      </div>
      <ReferralOfficeMappingPanel />
    </div>
  );
}
