export interface FileReference {
  path: string;
  reason: string;
}

export interface IncompleteItem {
  text: string;
  evidence: string;
  why_incomplete: string;
}

export interface ExecutionBuckets {
  ready_now: string[];
  review_before_execution: string[];
  needs_clarification: string[];
}

export interface Task {
  id: string;
  title: string;
  status: 'ready' | 'review' | 'clarify';
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
  why_this_task_exists: string;
  proposed_change: string;
  high_confidence_files: FileReference[];
  possible_related_files: FileReference[];
  evidence: string;
  ambiguities: string[];
  task_assumptions: string[];
  dependencies: string[];
  agent_steps: string[];
}

export interface ExtractedPlan {
  decisions: string[];
  fix_summary: string;
  execution_buckets: ExecutionBuckets;
  tasks: Task[];
  assumptions: string[];
  incomplete_items: IncompleteItem[];
}
