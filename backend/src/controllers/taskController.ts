import { Response } from 'express';
import { Task, ITask, TaskPriority } from '../models/Task';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

type SortField = 'priority' | 'deadline' | 'dateTime' | 'createdAt' | 'title' | 'completed' | 'urgency';
type SortOrder = 'asc' | 'desc';

const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const calcUrgencyScore = (task: ITask): number => {
  if (task.completed) return 0;
  const pScore = task.priority === 'high' ? 50 : task.priority === 'medium' ? 30 : 10;
  if (!task.deadline) return pScore;
  const diffHours = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  let dScore = 5;
  if (diffHours < 0) dScore = 55;
  else if (diffHours <= 2) dScore = 50;
  else if (diffHours <= 24) dScore = 50;
  else if (diffHours <= 48) dScore = 35;
  else if (diffHours <= 72) dScore = 25;
  else if (diffHours <= 168) dScore = 15;
  return pScore + dScore;
};

export const getTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { completed, priority, category, search, sortBy, order } = req.query;

    const query: any = { userId };

    if (completed !== undefined && completed !== 'all') {
      query.completed = completed === 'true' || completed === '1';
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    let tasks = await Task.find(query);

    const sortField = (sortBy as SortField) || 'createdAt';
    const sortDirection = (order as SortOrder) || (sortField === 'createdAt' ? 'desc' : 'asc');
    const modifier = sortDirection === 'asc' ? 1 : -1;

    tasks = tasks.sort((a, b) => {
      switch (sortField) {
        case 'urgency': {
          return (calcUrgencyScore(a) - calcUrgencyScore(b)) * modifier;
        }
        case 'priority': {
          return ((PRIORITY_WEIGHTS[a.priority] || 0) - (PRIORITY_WEIGHTS[b.priority] || 0)) * modifier;
        }
        case 'deadline': {
          const timeA = a.deadline ? new Date(a.deadline).getTime() : null;
          const timeB = b.deadline ? new Date(b.deadline).getTime() : null;
          if (timeA === null && timeB === null) return 0;
          if (timeA === null) return 1;
          if (timeB === null) return -1;
          return (timeA - timeB) * modifier;
        }
        case 'dateTime': {
          const timeA = a.dateTime ? new Date(a.dateTime).getTime() : null;
          const timeB = b.dateTime ? new Date(b.dateTime).getTime() : null;
          if (timeA === null && timeB === null) return 0;
          if (timeA === null) return 1;
          if (timeB === null) return -1;
          return (timeA - timeB) * modifier;
        }
        case 'completed': {
          return ((a.completed ? 1 : 0) - (b.completed ? 1 : 0)) * modifier;
        }
        case 'title': {
          return a.title.localeCompare(b.title) * modifier;
        }
        case 'createdAt':
        default: {
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * modifier;
        }
      }
    });

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tasks',
    });
  }
};

export const getTaskById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const task = await Task.findOne({ _id: id, userId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch task',
    });
  }
};

export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      title,
      description,
      dateTime,
      deadline,
      priority,
      category,
      tags,
      reminderMinutesBefore,
      reminderEnabled,
      notificationId,
      completed,
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Task title is required',
      });
      return;
    }

    const task = await Task.create({
      userId,
      title: title.trim(),
      description: description?.trim() || '',
      dateTime: dateTime ? new Date(dateTime) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
      priority: (priority as TaskPriority) || 'medium',
      category: category ? String(category).trim() : 'Work',
      tags: Array.isArray(tags) ? tags : [],
      reminderMinutesBefore: reminderMinutesBefore !== undefined ? Number(reminderMinutesBefore) : undefined,
      reminderEnabled: reminderEnabled === true,
      notificationId: notificationId ? String(notificationId).trim() : '',
      completed: completed === true,
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task,
    });
  } catch (error: any) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create task',
    });
  }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const {
      title,
      description,
      dateTime,
      deadline,
      priority,
      category,
      tags,
      reminderMinutesBefore,
      reminderEnabled,
      notificationId,
      completed,
    } = req.body;

    const task = await Task.findOne({ _id: id, userId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        res.status(400).json({ success: false, message: 'Title cannot be empty' });
        return;
      }
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description.trim();
    }

    if (dateTime !== undefined) {
      task.dateTime = dateTime ? new Date(dateTime) : undefined;
    }

    if (deadline !== undefined) {
      task.deadline = deadline ? new Date(deadline) : undefined;
    }

    if (priority !== undefined) {
      task.priority = priority;
    }

    if (category !== undefined) {
      task.category = String(category).trim();
    }

    if (tags !== undefined && Array.isArray(tags)) {
      task.tags = tags;
    }

    if (reminderMinutesBefore !== undefined) {
      task.reminderMinutesBefore = reminderMinutesBefore !== null ? Number(reminderMinutesBefore) : undefined;
    }

    if (reminderEnabled !== undefined) {
      task.reminderEnabled = Boolean(reminderEnabled);
    }

    if (notificationId !== undefined) {
      task.notificationId = String(notificationId).trim();
    }

    if (completed !== undefined) {
      task.completed = Boolean(completed);
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task,
    });
  } catch (error: any) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update task',
    });
  }
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const task = await Task.findOneAndDelete({ _id: id, userId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete task',
    });
  }
};

export const toggleTaskStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const task = await Task.findOne({ _id: id, userId });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (req.body && typeof req.body.completed === 'boolean') {
      task.completed = req.body.completed;
    } else {
      task.completed = !task.completed;
    }
    await task.save();

    res.status(200).json({
      success: true,
      message: `Task marked as ${task.completed ? 'completed' : 'incomplete'}`,
      task,
    });
  } catch (error: any) {
    console.error('Toggle task status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle task status',
    });
  }
};
