import { Schema, model, Document, Types } from 'mongoose';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface ITask extends Document {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  dateTime?: Date;
  deadline?: Date;
  priority: TaskPriority;
  category?: string;
  tags?: string[];
  reminderMinutesBefore?: number;
  reminderEnabled?: boolean;
  notificationId?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task must belong to a user through userId'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a task title'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    dateTime: {
      type: Date,
    },
    deadline: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    category: {
      type: String,
      default: 'Work',
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    reminderMinutesBefore: {
      type: Number,
      default: null,
    },
    reminderEnabled: {
      type: Boolean,
      default: false,
    },
    notificationId: {
      type: String,
      default: '',
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Task = model<ITask>('Task', taskSchema);
