import { Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useOrganization } from '@/hooks/useOrganization'
import { errorMessage } from '@/lib/http'
import { paths } from '@/routes/paths'

import { Notice } from './states'

/** Explains a plan limit the server enforced, with a way to see the plans. */
export function PlanNotice({ error, message, className }: { error?: unknown; message?: string; className?: string }) {
  const { organization } = useOrganization()
  return (
    <Notice
      variant="warning"
      title="Not included in your plan"
      className={className}
      action={
        <Button asChild variant="outline" size="sm">
          <Link to={paths.org(organization.slug).billing}>
            <Sparkles aria-hidden />
            See plans
          </Link>
        </Button>
      }
    >
      {message ?? errorMessage(error)}
    </Notice>
  )
}
