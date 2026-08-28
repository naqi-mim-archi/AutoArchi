import { createKvJobStore } from '../../shared/kvJobStore';
import type { RevitExportJobRecord, RevitExportJobStore } from './apsRevitExportBackend';

export const createKvRevitExportJobStore = (): RevitExportJobStore =>
  createKvJobStore<RevitExportJobRecord>('revit-export');
