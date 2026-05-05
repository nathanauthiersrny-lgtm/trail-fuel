export type EventLogStatus = 'done' | 'skipped';

export type EventLogFeeling = 'good' | 'meh' | 'bad';

export type EventLog = {
  id: string;
  race_id: string;
  planned_event_id?: string;
  logged_at: number;
  status: EventLogStatus;
  feeling?: EventLogFeeling;
};
