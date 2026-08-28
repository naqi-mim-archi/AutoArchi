import { createKvJobStore } from '../../shared/kvJobStore';
import type { ApsRevitImportJobRecord, ApsRevitImportJobStore } from './apsRevitImportBackend';

export const createKvApsRevitImportJobStore = (): ApsRevitImportJobStore =>
  createKvJobStore<ApsRevitImportJobRecord>('aps-revit-import');
