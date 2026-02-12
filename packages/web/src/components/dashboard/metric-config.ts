import type { MetricType } from '@/pages/dashboard';
import { FileText, CheckCircle2, Lightbulb, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MetricConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

/**
 * Configuration map for metric display properties.
 * Maps each MetricType to its visual presentation and labels.
 */
export const metricConfig: Record<MetricType, MetricConfig> = {
  features: {
    title: 'Features Created',
    description: 'Features created during this period',
    icon: FileText,
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-950',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
  },
  tasks: {
    title: 'Tasks Completed',
    description: 'Tasks completed during this period',
    icon: CheckCircle2,
    color: 'green',
    bgClass: 'bg-green-50 dark:bg-green-950',
    textClass: 'text-green-600 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800',
  },
  decisions: {
    title: 'Decisions Logged',
    description: 'Decisions logged during this period',
    icon: Lightbulb,
    color: 'amber',
    bgClass: 'bg-amber-50 dark:bg-amber-950',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800',
  },
  sessions: {
    title: 'AI Sessions',
    description: 'AI sessions recorded during this period',
    icon: Bot,
    color: 'purple',
    bgClass: 'bg-purple-50 dark:bg-purple-950',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800',
  },
};

/**
 * Get metric configuration by type.
 * @param metricType - The metric type to get config for
 * @returns The metric configuration object
 */
export function getMetricConfig(metricType: MetricType): MetricConfig {
  return metricConfig[metricType];
}
