import { queryDb } from '../../config/database.js';

export interface BoardCrewRow {
  id: string;
  crew_name: string;
  division: string;
  status: string;
  color_code: string | null;
  crew_leader_first_name: string | null;
  crew_leader_last_name: string | null;
  member_count: string;
}

export interface BoardJobRow {
  id: string;
  title: string;
  customer_name: string | null;
  property_address: string | null;
  job_type: string;
  status: string;
  priority: string;
  division: string;
  scheduled_date: string;
  scheduled_start_time: string | null;
  estimated_duration_minutes: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  assigned_crew_id: string;
}

export interface QueueJobRow {
  id: string;
  title: string;
  customer_name: string | null;
  property_address: string | null;
  job_type: string;
  status: string;
  priority: string;
  division: string;
  scheduled_date: string | null;
  estimated_duration_minutes: number | null;
  contract_id: string | null;
}

interface CountRow {
  count: string;
}

export async function getBoardData(
  tenantId: string,
  startDate: string,
  endDate: string,
  division?: string,
): Promise<{ crews: BoardCrewRow[]; jobs: BoardJobRow[] }> {
  const crewConditions = [
    'c.tenant_id = $1',
    'c.deleted_at IS NULL',
    "c.status = 'active'",
  ];
  const crewParams: unknown[] = [tenantId];
  let pi = 2;

  if (division) {
    crewConditions.push(`c.division = $${pi}`);
    crewParams.push(division);
    pi++;
  }

  const crewResult = await queryDb<BoardCrewRow>(
    `SELECT c.id, c.crew_name, c.division, c.status, c.color_code,
            u.first_name AS crew_leader_first_name,
            u.last_name AS crew_leader_last_name,
            (SELECT COUNT(*)::text FROM crew_members cm
             WHERE cm.crew_id = c.id AND cm.is_active = true) AS member_count
     FROM crews c
     LEFT JOIN users u ON u.id = c.crew_leader_id AND u.is_active = true
     WHERE ${crewConditions.join(' AND ')}
     ORDER BY c.division, c.crew_name`,
    crewParams,
  );

  const jobConditions = [
    'j.tenant_id = $1',
    'j.deleted_at IS NULL',
    'j.scheduled_date >= $2',
    'j.scheduled_date <= $3',
    'j.assigned_crew_id IS NOT NULL',
  ];
  const jobParams: unknown[] = [tenantId, startDate, endDate];
  let ji = 4;

  if (division) {
    jobConditions.push(`j.division = $${ji}`);
    jobParams.push(division);
    ji++;
  }

  const jobResult = await queryDb<BoardJobRow>(
    `SELECT j.id, j.title, j.job_type, j.status, j.priority, j.division,
            j.scheduled_date::text, j.scheduled_start_time::text,
            j.estimated_duration_minutes,
            j.actual_start_time::text, j.actual_end_time::text,
            j.assigned_crew_id,
            cust.display_name AS customer_name,
            COALESCE(p.address_line1, p.property_name) AS property_address
     FROM jobs j
     LEFT JOIN customers cust ON cust.id = j.customer_id AND cust.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = j.property_id AND p.deleted_at IS NULL
     WHERE ${jobConditions.join(' AND ')}
     ORDER BY j.scheduled_date, j.scheduled_start_time NULLS LAST`,
    jobParams,
  );

  return { crews: crewResult.rows, jobs: jobResult.rows };
}

export async function getQueueData(
  tenantId: string,
): Promise<{
  unassigned: QueueJobRow[];
  work_orders: QueueJobRow[];
  recurring_pending: QueueJobRow[];
  overdue: QueueJobRow[];
}> {
  const baseSelect = `
    SELECT j.id, j.title, j.job_type, j.status, j.priority, j.division,
           j.scheduled_date::text, j.estimated_duration_minutes, j.contract_id,
           cust.display_name AS customer_name,
           COALESCE(p.address_line1, p.property_name) AS property_address
    FROM jobs j
    LEFT JOIN customers cust ON cust.id = j.customer_id AND cust.deleted_at IS NULL
    LEFT JOIN properties p ON p.id = j.property_id AND p.deleted_at IS NULL
  `;

  const [unassigned, workOrders, recurringPending, overdue] = await Promise.all([
    queryDb<QueueJobRow>(
      `${baseSelect}
       WHERE j.tenant_id = $1 AND j.deleted_at IS NULL
         AND j.status = 'unscheduled' AND j.assigned_crew_id IS NULL
       ORDER BY j.priority DESC, j.created_at ASC
       LIMIT 100`,
      [tenantId],
    ),
    queryDb<QueueJobRow>(
      `${baseSelect}
       WHERE j.tenant_id = $1 AND j.deleted_at IS NULL
         AND j.status = 'unscheduled' AND j.contract_id IS NOT NULL
         AND j.assigned_crew_id IS NULL
       ORDER BY j.priority DESC, j.created_at ASC
       LIMIT 100`,
      [tenantId],
    ),
    queryDb<QueueJobRow>(
      `${baseSelect}
       WHERE j.tenant_id = $1 AND j.deleted_at IS NULL
         AND j.status = 'unscheduled' AND j.contract_id IS NOT NULL
         AND (j.scheduled_date IS NULL OR j.scheduled_date <= CURRENT_DATE + INTERVAL '14 days')
       ORDER BY j.scheduled_date ASC NULLS LAST, j.priority DESC
       LIMIT 100`,
      [tenantId],
    ),
    queryDb<QueueJobRow>(
      `${baseSelect}
       WHERE j.tenant_id = $1 AND j.deleted_at IS NULL
         AND j.scheduled_date < CURRENT_DATE
         AND j.status NOT IN ('completed', 'verified', 'cancelled', 'skipped')
       ORDER BY j.scheduled_date ASC, j.priority DESC
       LIMIT 100`,
      [tenantId],
    ),
  ]);

  return {
    unassigned: unassigned.rows,
    work_orders: workOrders.rows,
    recurring_pending: recurringPending.rows,
    overdue: overdue.rows,
  };
}

export async function assignJob(
  tenantId: string,
  jobId: string,
  crewId: string,
  scheduledDate: string,
  scheduledStartTime: string,
  userId: string,
): Promise<{ id: string; status: string } | null> {
  const result = await queryDb<{ id: string; status: string }>(
    `UPDATE jobs
     SET assigned_crew_id = $1,
         scheduled_date = $2,
         scheduled_start_time = $3,
         status = 'scheduled',
         updated_by = $4
     WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL
     RETURNING id, status`,
    [crewId, scheduledDate, scheduledStartTime, userId, jobId, tenantId],
  );
  return result.rows[0] || null;
}

export async function rescheduleJob(
  tenantId: string,
  jobId: string,
  userId: string,
  crewId?: string,
  scheduledDate?: string,
  scheduledStartTime?: string,
): Promise<{ id: string; status: string } | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  if (crewId !== undefined) {
    sets.push(`assigned_crew_id = $${pi}`);
    params.push(crewId);
    pi++;
  }
  if (scheduledDate !== undefined) {
    sets.push(`scheduled_date = $${pi}`);
    params.push(scheduledDate);
    pi++;
  }
  if (scheduledStartTime !== undefined) {
    sets.push(`scheduled_start_time = $${pi}`);
    params.push(scheduledStartTime);
    pi++;
  }

  if (sets.length === 0) return null;

  sets.push(`updated_by = $${pi}`);
  params.push(userId);
  pi++;

  params.push(jobId);
  params.push(tenantId);

  const result = await queryDb<{ id: string; status: string }>(
    `UPDATE jobs SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING id, status`,
    params,
  );
  return result.rows[0] || null;
}

export async function unassignJob(
  tenantId: string,
  jobId: string,
  userId: string,
): Promise<{ id: string; status: string } | null> {
  const result = await queryDb<{ id: string; status: string }>(
    `UPDATE jobs
     SET assigned_crew_id = NULL,
         status = 'unscheduled',
         scheduled_start_time = NULL,
         updated_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING id, status`,
    [userId, jobId, tenantId],
  );
  return result.rows[0] || null;
}

export async function jobExists(
  tenantId: string,
  jobId: string,
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [jobId, tenantId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

export async function crewIsActive(
  tenantId: string,
  crewId: string,
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM crews
     WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND deleted_at IS NULL`,
    [crewId, tenantId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}
