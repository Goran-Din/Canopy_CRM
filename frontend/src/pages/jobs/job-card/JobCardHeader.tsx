import type { JobDetail } from './JobCard';
interface JobCardHeaderProps { job: JobDetail; onStatusChange: () => void; }
export function JobCardHeader({ job }: JobCardHeaderProps) {
  return <div className="border-b pb-4"><h1 className="text-xl font-bold">Job #{job.job_number} — {job.title}</h1></div>;
}
