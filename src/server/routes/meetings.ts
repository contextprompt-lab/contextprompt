import { Router } from 'express';
import { getMeetings, getMeeting, deleteMeeting, getTasksForMeeting, updateTaskGithubIssue } from '../db.js';

export const meetingsRouter = Router();

// List all meetings
meetingsRouter.get('/', (_req, res) => {
  const meetings = getMeetings();
  res.json(meetings.map(m => ({
    ...m,
    // Don't send full transcript/plan in list view
    transcript: undefined,
    plan_json: undefined,
  })));
});

// Get single meeting with full details
meetingsRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid meeting ID' });
    return;
  }

  const meeting = getMeeting(id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }

  const tasks = getTasksForMeeting(id);
  const plan = meeting.plan_json ? JSON.parse(meeting.plan_json) : null;

  res.json({
    ...meeting,
    plan: plan,
    tasks: tasks.map(t => ({
      ...t,
      files: t.files_json ? JSON.parse(t.files_json) : [],
      steps: t.steps_json ? JSON.parse(t.steps_json) : [],
      dependencies: t.dependencies_json ? JSON.parse(t.dependencies_json) : [],
      ambiguities: t.ambiguities_json ? JSON.parse(t.ambiguities_json) : [],
    })),
  });
});

// Delete a meeting
meetingsRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid meeting ID' });
    return;
  }

  deleteMeeting(id);
  res.json({ ok: true });
});

// Update task's GitHub issue URL
meetingsRouter.patch('/tasks/:taskId/github', (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  const { issue_url } = req.body;

  if (isNaN(taskId) || !issue_url) {
    res.status(400).json({ error: 'Invalid task ID or missing issue_url' });
    return;
  }

  updateTaskGithubIssue(taskId, issue_url);
  res.json({ ok: true });
});
