import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BarChart3, Download, FileSpreadsheet, FileText, Lock } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/misc'
import { PlanNotice } from '@/components/shared/plan'
import { EmptyState, ErrorState, Notice } from '@/components/shared/states'
import { Badge, Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDay } from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { errorMessage } from '@/lib/http'
import { cn, formatDateTime } from '@/lib/utils'
import { insightKeys, isPlanError, reportService, type ReportPeriod } from '@/services/insights'
import type { ReportInfo, ReportValue } from '@/types/api'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function display(value: ReportValue): string {
  if (value === null || value === '') return '–'
  if (typeof value === 'string' && ISO_DAY.test(value)) return formatDay(value)
  return String(value)
}

function ReportList({
  reports,
  selected,
  onSelect,
}: {
  reports: ReportInfo[]
  selected: string
  onSelect: (key: string) => void
}) {
  return (
    <Card className="h-fit p-1.5">
      <ul className="flex flex-col gap-0.5" aria-label="Reports">
        {reports.map((report) => (
          <li key={report.key}>
            <button
              type="button"
              onClick={() => onSelect(report.key)}
              aria-current={report.key === selected ? 'true' : undefined}
              className={cn(
                'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent',
                report.key === selected && 'bg-accent',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{report.title}</span>
                <span className="block text-xs text-muted-foreground">{report.description}</span>
              </span>
              {!report.allowed && <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Not in your plan" />}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Built-in reports with a preview and CSV or PDF export. */
export function ReportsPage() {
  const { organization } = useOrganization()
  const [searchParams, setSearchParams] = useSearchParams()
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null)

  const catalog = useQuery({
    queryKey: insightKeys.reportCatalog(organization.id),
    queryFn: () => reportService.catalog(organization.id),
  })
  const reports = catalog.data?.reports ?? []
  const report = reports.find((item) => item.key === searchParams.get('report')) ?? reports.find((item) => item.allowed) ?? reports[0]

  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')
  const period: ReportPeriod = {
    start: (startParam && ISO_DAY.test(startParam) ? startParam : report?.default_start) ?? undefined,
    end: (endParam && ISO_DAY.test(endParam) ? endParam : report?.default_end) ?? undefined,
  }

  const result = useQuery({
    queryKey: insightKeys.report(organization.id, report?.key ?? '', period),
    queryFn: () => reportService.run(organization.id, report!.key, period),
    enabled: Boolean(report?.allowed),
    placeholderData: keepPreviousData,
    retry: false,
  })

  const select = (key: string) => setSearchParams({ report: key }, { replace: true })
  const setPeriod = (key: 'start' | 'end', value: string) => {
    const next = new URLSearchParams(searchParams)
    if (report) next.set('report', report.key)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const download = async (format: 'csv' | 'pdf') => {
    if (!report) return
    setDownloading(format)
    try {
      await reportService.download(organization.id, report.key, period, format)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDownloading(null)
    }
  }

  if (catalog.isPending) return <Skeleton className="h-96" />
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
  const { can_export: canExport, csv_export: csvInPlan, pdf_export: pdfInPlan } = catalog.data

  return (
    <>
      <PageHeader title="Reports" description="Answers to the questions auditors and managers ask most." />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <ReportList reports={reports} selected={report?.key ?? ''} onSelect={select} />

        {report && (
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{report.title}</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{report.description}</p>
                </div>
                {report.allowed && canExport && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!csvInPlan}
                      loading={downloading === 'csv'}
                      onClick={() => void download('csv')}
                      title={csvInPlan ? undefined : 'CSV export is part of the Growth plan'}
                    >
                      <FileSpreadsheet aria-hidden />
                      CSV
                      {!csvInPlan && <Lock className="size-3" aria-hidden />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pdfInPlan}
                      loading={downloading === 'pdf'}
                      onClick={() => void download('pdf')}
                      title={pdfInPlan ? undefined : 'PDF export is part of the Starter plan'}
                    >
                      <FileText aria-hidden />
                      PDF
                      {!pdfInPlan && <Lock className="size-3" aria-hidden />}
                    </Button>
                  </div>
                )}
              </div>

              {report.allowed && report.has_period && (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-start">{report.period_label} from</Label>
                    <Input
                      id="report-start"
                      type="date"
                      className="w-44"
                      value={period.start ?? ''}
                      max={period.end}
                      onChange={(event) => setPeriod('start', event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-end">to</Label>
                    <Input
                      id="report-end"
                      type="date"
                      className="w-44"
                      value={period.end ?? ''}
                      min={period.start}
                      onChange={(event) => setPeriod('end', event.target.value)}
                    />
                  </div>
                  {(startParam || endParam) && (
                    <Button variant="ghost" size="sm" onClick={() => select(report.key)}>
                      Reset period
                    </Button>
                  )}
                </div>
              )}
              {report.allowed && canExport && !csvInPlan && (
                <p className="mt-3 text-xs text-muted-foreground">CSV export is part of the Growth plan.</p>
              )}
            </Card>

            {!report.allowed ? (
              <PlanNotice
                message={`${report.title} is part of the ${report.feature === 'advanced_reports' ? 'Growth' : 'Starter'} plan. Upgrade to run it.`}
              />
            ) : result.isError ? (
              isPlanError(result.error) ? (
                <PlanNotice error={result.error} />
              ) : (
                <Card>
                  <ErrorState error={result.error} onRetry={() => void result.refetch()} />
                </Card>
              )
            ) : result.isPending ? (
              <Skeleton className="h-72" />
            ) : (
              <div className={cn('flex flex-col gap-4', result.isPlaceholderData && 'opacity-70 transition-opacity')}>
                {result.data.summary.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {result.data.summary.map((item) => (
                      <Card key={item.label} className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{display(item.value)}</p>
                      </Card>
                    ))}
                  </div>
                )}
                <Card className="overflow-hidden">
                  {result.data.rows.length === 0 ? (
                    <EmptyState icon={BarChart3} title="Nothing to report" description="No records match this report and period." />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            {result.data.columns.map((column, index) => (
                              <TableHead key={column.key} className={cn('whitespace-nowrap', index === 0 && 'pl-5')}>
                                {column.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.data.rows.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {result.data.columns.map((column, index) => (
                                <TableCell
                                  key={column.key}
                                  className={cn(
                                    typeof row[column.key] === 'number' && 'tabular-nums',
                                    index === 0 ? 'pl-5 font-medium' : 'text-muted-foreground',
                                  )}
                                >
                                  {display(row[column.key] ?? null)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2.5 text-xs text-muted-foreground">
                    <span>
                      {result.data.rows.length} {result.data.rows.length === 1 ? 'row' : 'rows'}
                      {result.data.start || result.data.end
                        ? ` · ${result.data.start ? formatDay(result.data.start) : 'the start'} to ${result.data.end ? formatDay(result.data.end) : 'today'}`
                        : ''}
                    </span>
                    <span>Generated {formatDateTime(result.data.generated_at)}</span>
                  </div>
                </Card>
                {result.data.truncated && (
                  <Notice>
                    The preview shows the first {result.data.rows.length} rows. Exports include up to 5,000.
                  </Notice>
                )}
                {!canExport && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Download className="size-3.5" aria-hidden />
                    Exporting reports is available to compliance managers, admins and owners.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {reports.some((item) => !item.allowed) && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-1.5">
            <Lock className="size-3" aria-hidden />
            Locked
          </Badge>
          reports are included in higher plans.
        </p>
      )}
    </>
  )
}
