import { PageHeader } from '@/components/payroll/PageHeader';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { ReferralOfficeMappingPanel } from '@/components/payroll/ReferralOfficeMappingPanel';
import { ReferralPayoutsView } from '@/components/payroll/ReferralPayoutsView';

const REFERRAL_APP_URL = 'https://higher-view-referral-app.vercel.app/';

export default function ReferralProgram() {
  return (
    <div className="flex flex-col h-full space-y-8">
      <PageHeader
        title="Referral Program"
        description="Referral payouts, mirrored live from the Higher View Referral app."
        actions={
          <a href={REFERRAL_APP_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              Open Referral App
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        }
      />
      <ReferralPayoutsView />
      <ReferralOfficeMappingPanel />
    </div>
  );
}
