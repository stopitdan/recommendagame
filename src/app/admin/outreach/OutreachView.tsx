'use client';

import { useEffect, useState, useCallback } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  ExternalLink, Copy, ChevronDown, ChevronRight,
  Check, Clock, X, Pause, CircleDot, Rocket,
  Filter,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────

interface OutreachTask {
  id: number;
  category: string;
  priority: number;
  day_target: string | null;
  platform: string;
  url: string;
  post_title: string | null;
  post_body: string | null;
  notes: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'wont_do' | 'waiting';
  result_notes: string | null;
  posted_url: string | null;
  created_at: string;
  updated_at: string;
  // Metadata
  cost_type: string;
  cost_amount: string | null;
  can_post_immediately: string;
  maintenance_level: string;
  link_type: string;
  approval_process: string;
  estimated_reach: string;
  time_to_live: string;
}

type Status = OutreachTask['status'];

// ─── Status Config ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: React.ReactNode }> = {
  todo: { label: 'To Do', color: '#6b7280', icon: <CircleDot size={14} /> },
  in_progress: { label: 'In Progress', color: '#f59e0b', icon: <Clock size={14} /> },
  done: { label: 'Done', color: '#10b981', icon: <Check size={14} /> },
  waiting: { label: 'Waiting', color: '#6366f1', icon: <Pause size={14} /> },
  wont_do: { label: "Won't Do", color: '#ef4444', icon: <X size={14} /> },
};

const CATEGORY_LABELS: Record<string, string> = {
  'ai-directories': 'AI Tool Directories',
  'reddit': 'Reddit',
  'bgg': 'BoardGameGeek',
  'product-directories': 'Product Directories',
  'tech-communities': 'Tech Communities',
  'content': 'Content & Blog Posts',
  'social': 'Social / Facebook Groups',
  'ongoing': 'Ongoing Engagement',
  'other': 'Lower Priority',
};

// ─── Filter Dimensions ───────────────────────────────────────────────

const FILTER_DIMENSIONS: Record<string, { label: string; options: Record<string, { label: string; color: string }> }> = {
  cost_type: {
    label: 'Cost',
    options: {
      free: { label: 'Free', color: '#10b981' },
      freemium: { label: 'Freemium', color: '#f59e0b' },
      paid: { label: 'Paid', color: '#ef4444' },
    },
  },
  maintenance_level: {
    label: 'Maintenance',
    options: {
      one_and_done: { label: 'One & Done', color: '#10b981' },
      low: { label: 'Low', color: '#6ee7b7' },
      moderate: { label: 'Moderate', color: '#f59e0b' },
      high: { label: 'High', color: '#ef4444' },
    },
  },
  can_post_immediately: {
    label: 'Can Post Now',
    options: {
      yes: { label: 'Yes', color: '#10b981' },
      needs_karma: { label: 'Needs Karma', color: '#f59e0b' },
      needs_approval: { label: 'Needs Approval', color: '#f59e0b' },
      no: { label: 'No', color: '#ef4444' },
    },
  },
  estimated_reach: {
    label: 'Reach',
    options: {
      very_high: { label: 'Very High', color: '#8b5cf6' },
      high: { label: 'High', color: '#6366f1' },
      medium: { label: 'Medium', color: '#6b7280' },
      low: { label: 'Low', color: '#9ca3af' },
    },
  },
  link_type: {
    label: 'Link Type',
    options: {
      do_follow: { label: 'Do-Follow', color: '#10b981' },
      no_follow: { label: 'No-Follow', color: '#6b7280' },
    },
  },
  time_to_live: {
    label: 'Time to Live',
    options: {
      immediate: { label: 'Immediate', color: '#10b981' },
      hours: { label: 'Hours', color: '#6ee7b7' },
      days: { label: 'Days', color: '#f59e0b' },
      weeks: { label: 'Weeks', color: '#ef4444' },
    },
  },
};

/** Metadata badge config for inline display on task cards */
const META_BADGE_CONFIG: Record<string, Record<string, { label: string; color: string }>> = {
  cost_type: { free: { label: 'Free', color: '#10b981' }, freemium: { label: 'Freemium', color: '#f59e0b' }, paid: { label: 'Paid', color: '#ef4444' } },
  maintenance_level: { one_and_done: { label: '1x', color: '#10b981' }, low: { label: 'Low Maint.', color: '#6ee7b7' }, moderate: { label: 'Med Maint.', color: '#f59e0b' }, high: { label: 'High Maint.', color: '#ef4444' } },
  estimated_reach: { very_high: { label: 'Huge Reach', color: '#8b5cf6' }, high: { label: 'High Reach', color: '#6366f1' }, medium: { label: 'Med Reach', color: '#6b7280' }, low: { label: 'Low Reach', color: '#9ca3af' } },
  link_type: { do_follow: { label: 'Do-Follow', color: '#10b981' } },
};

// ─── Preset Filters ──────────────────────────────────────────────────

type MetadataFilters = Partial<Record<string, Set<string>>>;

const FILTER_PRESETS: { label: string; filters: MetadataFilters }[] = [
  {
    label: 'Quick Wins',
    filters: {
      cost_type: new Set(['free']),
      maintenance_level: new Set(['one_and_done', 'low']),
      can_post_immediately: new Set(['yes']),
      time_to_live: new Set(['immediate']),
    },
  },
  {
    label: 'Do-Follow Links',
    filters: { link_type: new Set(['do_follow']) },
  },
  {
    label: 'High Impact Free',
    filters: {
      cost_type: new Set(['free']),
      estimated_reach: new Set(['high', 'very_high']),
    },
  },
];

// ─── Component ───────────────────────────────────────────────────────

export default function OutreachView() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<OutreachTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [editingNotes, setEditingNotes] = useState<{ id: number; value: string } | null>(null);
  const [editingPostedUrl, setEditingPostedUrl] = useState<{ id: number; value: string } | null>(null);
  const [metadataFilters, setMetadataFilters] = useState<MetadataFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Auth check
  useEffect(() => {
    createClient().auth.getUser().then(({ data: d }) => {
      setAuthed(d.user?.email === 'danjwiegand@gmail.com');
    });
  }, []);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/outreach');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchTasks();
  }, [authed, fetchTasks]);

  // Seed tasks
  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/outreach/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      await fetchTasks();
    } finally {
      setSeeding(false);
    }
  }

  // Re-seed: wipe and re-insert all tasks with latest data
  async function handleReseed() {
    if (!confirm('This will delete ALL existing tasks (including any status/notes changes) and re-seed with fresh data. Continue?')) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/outreach/seed', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      await fetchTasks();
    } finally {
      setSeeding(false);
    }
  }

  // Update task status
  async function updateStatus(id: number, status: Status) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/admin/outreach/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  // Save result notes
  async function saveResultNotes(id: number, result_notes: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, result_notes } : t)));
    setEditingNotes(null);
    await fetch(`/api/admin/outreach/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result_notes }),
    });
  }

  // Save posted URL
  async function savePostedUrl(id: number, posted_url: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, posted_url } : t)));
    setEditingPostedUrl(null);
    await fetch(`/api/admin/outreach/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posted_url }),
    });
  }

  // Toggle expand
  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Copy to clipboard
  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  // Metadata filter toggle
  function toggleMetaFilter(dimension: string, value: string) {
    setMetadataFilters((prev) => {
      const next = { ...prev };
      const current = new Set(prev[dimension] ?? []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      if (current.size === 0) delete next[dimension];
      else next[dimension] = current;
      return next;
    });
  }

  function applyPreset(filters: MetadataFilters) {
    setMetadataFilters(filters);
    setShowFilters(true);
  }

  const activeFilterCount = Object.values(metadataFilters).reduce((sum, s) => sum + (s?.size ?? 0), 0);

  // ─── Auth Gate ─────────────────────────────────────────────────────

  if (authed === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authed) {
    return (
      <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
        <Typography variant="h5" color="error">Admin access required</Typography>
      </Container>
    );
  }

  // ─── Filter & Group ────────────────────────────────────────────────

  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    for (const [dim, values] of Object.entries(metadataFilters)) {
      if (!values || values.size === 0) continue;
      const taskValue = t[dim as keyof OutreachTask] as string;
      if (!values.has(taskValue)) return false;
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, OutreachTask[]>>((acc, task) => {
    const cat = task.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(task);
    return acc;
  }, {});

  const categoryOrder = [
    'ai-directories', 'reddit', 'bgg', 'product-directories',
    'tech-communities', 'content', 'social', 'ongoing', 'other',
  ];
  const sortedCategories = categoryOrder.filter((c) => grouped[c]?.length);

  // Stats
  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    waiting: tasks.filter((t) => t.status === 'waiting').length,
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Rocket size={28} />
            <Typography variant="h4" fontWeight={800}>
              Outreach Tracker
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              SEO backlink campaign. Click a task to expand, change status, and copy post content.
            </Typography>
            {tasks.length > 0 && (
              <Button size="small" variant="outlined" color="error" onClick={handleReseed} disabled={seeding} sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                {seeding ? 'Re-seeding...' : 'Re-seed All'}
              </Button>
            )}
          </Box>
        </Box>

        {/* Stats bar */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <StatChip label={`${stats.done}/${stats.total} done`} color="#10b981" />
          <StatChip label={`${stats.inProgress} in progress`} color="#f59e0b" />
          <StatChip label={`${stats.todo} to do`} color="#6b7280" />
          <StatChip label={`${stats.waiting} waiting`} color="#6366f1" />
          <Box sx={{ flex: 1 }} />
          {tasks.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {Math.round((stats.done / stats.total) * 100)}% complete
            </Typography>
          )}
        </Box>

        {/* Progress bar */}
        {stats.total > 0 && (
          <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex' }}>
            <Box sx={{ width: `${(stats.done / stats.total) * 100}%`, bgcolor: '#10b981', transition: 'width 0.3s' }} />
            <Box sx={{ width: `${(stats.inProgress / stats.total) * 100}%`, bgcolor: '#f59e0b', transition: 'width 0.3s' }} />
            <Box sx={{ width: `${(stats.waiting / stats.total) * 100}%`, bgcolor: '#6366f1', transition: 'width 0.3s' }} />
          </Box>
        )}

        {/* Filter chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={16} style={{ opacity: 0.5 }} />
          {(['all', 'todo', 'in_progress', 'done', 'waiting', 'wont_do'] as const).map((s) => (
            <Chip
              key={s}
              label={s === 'all' ? `All (${tasks.length})` : `${STATUS_CONFIG[s].label} (${tasks.filter((t) => t.status === s).length})`}
              size="small"
              onClick={() => setStatusFilter(s)}
              variant={statusFilter === s ? 'filled' : 'outlined'}
              sx={{
                fontWeight: statusFilter === s ? 700 : 400,
                ...(s !== 'all' && { borderColor: STATUS_CONFIG[s].color, color: statusFilter === s ? '#fff' : STATUS_CONFIG[s].color, bgcolor: statusFilter === s ? STATUS_CONFIG[s].color : 'transparent' }),
              }}
            />
          ))}
        </Box>

        {/* Metadata filters */}
        <Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setShowFilters((p) => !p)}
              startIcon={<Filter size={14} />}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            {FILTER_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                size="small"
                variant="text"
                onClick={() => applyPreset(preset.filters)}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                {preset.label}
              </Button>
            ))}
            {activeFilterCount > 0 && (
              <Button size="small" variant="text" color="error" onClick={() => setMetadataFilters({})} sx={{ fontSize: '0.75rem' }}>
                Clear All
              </Button>
            )}
          </Box>
          <Collapse in={showFilters}>
            <Stack spacing={1} sx={{ pl: 1, py: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
              {Object.entries(FILTER_DIMENSIONS).map(([dim, config]) => (
                <Box key={dim} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ minWidth: 90, fontWeight: 600, color: 'text.secondary' }}>
                    {config.label}
                  </Typography>
                  {Object.entries(config.options).map(([value, opt]) => {
                    const active = metadataFilters[dim]?.has(value) ?? false;
                    return (
                      <Chip
                        key={value}
                        label={`${opt.label} (${tasks.filter((t) => (t as unknown as Record<string, unknown>)[dim] === value).length})`}
                        size="small"
                        onClick={() => toggleMetaFilter(dim, value)}
                        variant={active ? 'filled' : 'outlined'}
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: active ? 700 : 400,
                          borderColor: opt.color,
                          color: active ? '#fff' : opt.color,
                          bgcolor: active ? opt.color : 'transparent',
                          '&:hover': { bgcolor: active ? opt.color : `${opt.color}20` },
                        }}
                      />
                    );
                  })}
                </Box>
              ))}
            </Stack>
          </Collapse>
        </Box>

        {/* Error */}
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        {/* Loading / empty */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && tasks.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              No outreach tasks yet
            </Typography>
            <Button variant="contained" onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Seeding...' : 'Seed Initial Tasks'}
            </Button>
          </Box>
        )}

        {/* Task groups */}
        {sortedCategories.map((category) => (
          <CategoryGroup
            key={category}
            category={category}
            tasks={grouped[category]}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onUpdateStatus={updateStatus}
            onCopyText={copyText}
            editingNotes={editingNotes}
            onEditNotes={setEditingNotes}
            onSaveNotes={saveResultNotes}
            editingPostedUrl={editingPostedUrl}
            onEditPostedUrl={setEditingPostedUrl}
            onSavePostedUrl={savePostedUrl}
          />
        ))}
      </Stack>
    </Container>
  );
}

// ─── Stat Chip ───────────────────────────────────────────────────────

function StatChip({ label, color }: { label: string; color: string }) {
  return (
    <Box
      sx={{
        px: 1.5, py: 0.5, borderRadius: 2, fontSize: '0.8rem', fontWeight: 600,
        border: '1px solid', borderColor: color, color,
      }}
    >
      {label}
    </Box>
  );
}

// ─── Category Group ──────────────────────────────────────────────────

interface CategoryGroupProps {
  category: string;
  tasks: OutreachTask[];
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  onUpdateStatus: (id: number, status: Status) => void;
  onCopyText: (text: string) => void;
  editingNotes: { id: number; value: string } | null;
  onEditNotes: (val: { id: number; value: string } | null) => void;
  onSaveNotes: (id: number, notes: string) => void;
  editingPostedUrl: { id: number; value: string } | null;
  onEditPostedUrl: (val: { id: number; value: string } | null) => void;
  onSavePostedUrl: (id: number, url: string) => void;
}

function CategoryGroup({
  category, tasks, expandedIds, onToggleExpand, onUpdateStatus, onCopyText,
  editingNotes, onEditNotes, onSaveNotes,
  editingPostedUrl, onEditPostedUrl, onSavePostedUrl,
}: CategoryGroupProps) {
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="h6" fontWeight={700}>
          {CATEGORY_LABELS[category] ?? category}
        </Typography>
        <Chip label={`${doneCount}/${tasks.length}`} size="small" sx={{ fontWeight: 600 }} />
      </Box>
      <Stack spacing={1}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            expanded={expandedIds.has(task.id)}
            onToggleExpand={() => onToggleExpand(task.id)}
            onUpdateStatus={(s) => onUpdateStatus(task.id, s)}
            onCopyText={onCopyText}
            editingNotes={editingNotes?.id === task.id ? editingNotes : null}
            onEditNotes={onEditNotes}
            onSaveNotes={onSaveNotes}
            editingPostedUrl={editingPostedUrl?.id === task.id ? editingPostedUrl : null}
            onEditPostedUrl={onEditPostedUrl}
            onSavePostedUrl={onSavePostedUrl}
          />
        ))}
      </Stack>
    </Box>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────

interface TaskCardProps {
  task: OutreachTask;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdateStatus: (s: Status) => void;
  onCopyText: (text: string) => void;
  editingNotes: { id: number; value: string } | null;
  onEditNotes: (val: { id: number; value: string } | null) => void;
  onSaveNotes: (id: number, notes: string) => void;
  editingPostedUrl: { id: number; value: string } | null;
  onEditPostedUrl: (val: { id: number; value: string } | null) => void;
  onSavePostedUrl: (id: number, url: string) => void;
}

function TaskCard({
  task, expanded, onToggleExpand, onUpdateStatus, onCopyText,
  editingNotes, onEditNotes, onSaveNotes,
  editingPostedUrl, onEditPostedUrl, onSavePostedUrl,
}: TaskCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const cfg = STATUS_CONFIG[task.status];

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: task.status === 'done' ? 'rgba(16,185,129,0.2)' : 'divider',
        bgcolor: task.status === 'done' ? 'rgba(16,185,129,0.04)' : 'background.paper',
        overflow: 'hidden',
        opacity: task.status === 'wont_do' ? 0.5 : 1,
      }}
    >
      {/* Header row */}
      <Box
        onClick={onToggleExpand}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
          cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
        }}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}

        {/* Status chip */}
        <Chip
          icon={cfg.icon as React.ReactElement}
          label={cfg.label}
          size="small"
          onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
          sx={{
            bgcolor: cfg.color, color: '#fff', fontWeight: 600, fontSize: '0.7rem',
            minWidth: 90, cursor: 'pointer',
            '& .MuiChip-icon': { color: '#fff' },
          }}
        />

        {/* Platform name */}
        <Typography variant="body1" fontWeight={600} sx={{ flex: 1, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
          {task.platform}
        </Typography>

        {/* Metadata badges */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          {Object.entries(META_BADGE_CONFIG).map(([dim, opts]) => {
            const val = (task as unknown as Record<string, unknown>)[dim] as string;
            const cfg2 = opts[val];
            if (!cfg2) return null;
            return (
              <Box
                key={dim}
                sx={{
                  px: 0.8, py: 0.2, borderRadius: 1, fontSize: '0.6rem', fontWeight: 700,
                  bgcolor: `${cfg2.color}20`, color: cfg2.color, border: `1px solid ${cfg2.color}40`,
                  whiteSpace: 'nowrap',
                }}
              >
                {cfg2.label}{dim === 'cost_type' && task.cost_amount ? ` ${task.cost_amount}` : ''}
              </Box>
            );
          })}
        </Box>

        {/* Day target */}
        {task.day_target && (
          <Chip label={task.day_target} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
        )}

        {/* Go to URL */}
        <Tooltip title="Open submission page">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); window.open(task.url, '_blank'); }}
          >
            <ExternalLink size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Status menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {(Object.entries(STATUS_CONFIG) as [Status, typeof cfg][]).map(([s, c]) => (
          <MenuItem
            key={s}
            selected={task.status === s}
            onClick={() => { onUpdateStatus(s); setMenuAnchor(null); }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {c.icon}
              <Typography variant="body2">{c.label}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* Expanded detail */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
          <Stack spacing={2}>
            {/* Platform details grid */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>PLATFORM DETAILS</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1, mt: 0.5 }}>
                {([
                  ['Cost', task.cost_type === 'unknown' ? null : `${task.cost_type === 'free' ? 'Free' : task.cost_type === 'freemium' ? 'Freemium' : 'Paid'}${task.cost_amount ? ` (${task.cost_amount})` : ''}`, task.cost_type === 'free' ? '#10b981' : task.cost_type === 'freemium' ? '#f59e0b' : '#ef4444'],
                  ['Can Post Now', FILTER_DIMENSIONS.can_post_immediately?.options?.[task.can_post_immediately]?.label, FILTER_DIMENSIONS.can_post_immediately?.options?.[task.can_post_immediately]?.color],
                  ['Maintenance', FILTER_DIMENSIONS.maintenance_level?.options?.[task.maintenance_level]?.label, FILTER_DIMENSIONS.maintenance_level?.options?.[task.maintenance_level]?.color],
                  ['Link Type', FILTER_DIMENSIONS.link_type?.options?.[task.link_type]?.label, FILTER_DIMENSIONS.link_type?.options?.[task.link_type]?.color],
                  ['Approval', task.approval_process === 'auto_published' ? 'Auto-Published' : task.approval_process === 'manual_review' ? 'Manual Review' : task.approval_process === 'community_moderated' ? 'Community' : null, '#6b7280'],
                  ['Reach', FILTER_DIMENSIONS.estimated_reach?.options?.[task.estimated_reach]?.label, FILTER_DIMENSIONS.estimated_reach?.options?.[task.estimated_reach]?.color],
                  ['Time to Live', FILTER_DIMENSIONS.time_to_live?.options?.[task.time_to_live]?.label, FILTER_DIMENSIONS.time_to_live?.options?.[task.time_to_live]?.color],
                ] as [string, string | undefined | null, string | undefined][]).filter(([, v]) => v).map(([label, value, color]) => (
                  <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>{label}:</Typography>
                    <Box sx={{ px: 0.8, py: 0.2, borderRadius: 1, fontSize: '0.7rem', fontWeight: 600, bgcolor: `${color}20`, color }}>
                      {value}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Notes / tips */}
            {task.notes && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>TIPS & RULES</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {task.notes}
                </Typography>
              </Box>
            )}

            {/* Post title */}
            {task.post_title && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>POST TITLE</Typography>
                  <Tooltip title="Copy title">
                    <IconButton size="small" onClick={() => onCopyText(task.post_title!)}>
                      <Copy size={14} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(91,79,219,0.08)',
                    border: '1px solid rgba(91,79,219,0.2)', fontWeight: 600, fontSize: '0.9rem',
                  }}
                >
                  {task.post_title}
                </Box>
              </Box>
            )}

            {/* Post body */}
            {task.post_body && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>POST BODY</Typography>
                  <Tooltip title="Copy body">
                    <IconButton size="small" onClick={() => onCopyText(task.post_body!)}>
                      <Copy size={14} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid', borderColor: 'divider',
                    fontSize: '0.85rem', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto',
                    fontFamily: 'monospace',
                  }}
                >
                  {task.post_body}
                </Box>
              </Box>
            )}

            {/* Submission URL */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>SUBMIT HERE</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Button
                  variant="contained"
                  size="small"
                  href={task.url}
                  target="_blank"
                  startIcon={<ExternalLink size={14} />}
                >
                  Open {task.platform}
                </Button>
                <Tooltip title="Copy URL">
                  <IconButton size="small" onClick={() => onCopyText(task.url)}>
                    <Copy size={14} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Posted URL (editable) */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>LIVE POST URL</Typography>
              {editingPostedUrl ? (
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Paste the URL of your live post..."
                    value={editingPostedUrl.value}
                    onChange={(e) => onEditPostedUrl({ id: task.id, value: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && onSavePostedUrl(task.id, editingPostedUrl.value)}
                    autoFocus
                  />
                  <Button size="small" onClick={() => onSavePostedUrl(task.id, editingPostedUrl.value)}>Save</Button>
                  <Button size="small" onClick={() => onEditPostedUrl(null)}>Cancel</Button>
                </Box>
              ) : (
                <Box sx={{ mt: 0.5 }}>
                  {task.posted_url ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Button size="small" href={task.posted_url} target="_blank" startIcon={<ExternalLink size={14} />}>
                        View Post
                      </Button>
                      <Button size="small" variant="text" onClick={() => onEditPostedUrl({ id: task.id, value: task.posted_url ?? '' })}>
                        Edit
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onEditPostedUrl({ id: task.id, value: '' })}
                    >
                      Add Post URL
                    </Button>
                  )}
                </Box>
              )}
            </Box>

            {/* Result notes (editable) */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>RESULT NOTES</Typography>
              {editingNotes ? (
                <Box sx={{ mt: 0.5 }}>
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="What happened? Any traction? Upvotes? Comments?"
                    value={editingNotes.value}
                    onChange={(e) => onEditNotes({ id: task.id, value: e.target.value })}
                    autoFocus
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button size="small" onClick={() => onSaveNotes(task.id, editingNotes.value)}>Save</Button>
                    <Button size="small" onClick={() => onEditNotes(null)}>Cancel</Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ mt: 0.5 }}>
                  {task.result_notes ? (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                        {task.result_notes}
                      </Typography>
                      <Button size="small" variant="text" onClick={() => onEditNotes({ id: task.id, value: task.result_notes ?? '' })}>
                        Edit
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onEditNotes({ id: task.id, value: '' })}
                    >
                      Add Notes
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
