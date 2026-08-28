import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseDb, getFirebaseStorage } from './firebaseConfig';
import type { Project } from '../../types';

// Firestore documents cap out around 1MB. Small projects are stored inline for a fast,
// single-read load; anything larger is uploaded to Storage as a JSON blob instead, with
// only a pointer + lightweight listing fields kept in Firestore.
const INLINE_SIZE_LIMIT_BYTES = 700_000;

export interface SavedProjectSummary {
  id: string;
  name: string;
  mode: Project['mode'];
  elementsCount: number;
  thumbnailUrl?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface ProjectDocBase {
  ownerId: string;
  name: string;
  mode: Project['mode'];
  elementsCount: number;
  thumbnailUrl?: string;
  createdAt: any;
  updatedAt: any;
}

interface InlineProjectDoc extends ProjectDocBase {
  storageMode: 'inline';
  data: string;
}

interface StorageProjectDoc extends ProjectDocBase {
  storageMode: 'storage';
  dataUrl: string;
}

const toDate = (value: Timestamp | undefined): Date | null => (value ? value.toDate() : null);

const projectsCollection = () => collection(getFirebaseDb(), 'projects');

export const saveProject = async (userId: string, project: Project, existingProjectId?: string): Promise<string> => {
  const serialized = JSON.stringify(project);
  const sizeBytes = new TextEncoder().encode(serialized).length;

  const base = {
    ownerId: userId,
    name: project.name || 'Untitled Project',
    mode: project.mode,
    elementsCount: project.elements?.length || 0,
    updatedAt: serverTimestamp(),
  };

  let payload: Partial<InlineProjectDoc> | Partial<StorageProjectDoc>;
  if (sizeBytes <= INLINE_SIZE_LIMIT_BYTES) {
    payload = { ...base, storageMode: 'inline', data: serialized };
  } else {
    const projectId = existingProjectId || doc(projectsCollection()).id;
    const storageRef = ref(getFirebaseStorage(), `users/${userId}/projects/${projectId}/project.json`);
    await uploadString(storageRef, serialized, 'raw', { contentType: 'application/json' });
    const dataUrl = await getDownloadURL(storageRef);
    payload = { ...base, storageMode: 'storage', dataUrl };
  }

  if (existingProjectId) {
    await setDoc(doc(projectsCollection(), existingProjectId), payload, { merge: true });
    return existingProjectId;
  }

  const created = await addDoc(projectsCollection(), { ...payload, createdAt: serverTimestamp() });
  return created.id;
};

export const listProjects = async (userId: string): Promise<SavedProjectSummary[]> => {
  const q = query(projectsCollection(), where('ownerId', '==', userId), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data() as InlineProjectDoc | StorageProjectDoc;
    return {
      id: docSnap.id,
      name: data.name,
      mode: data.mode,
      elementsCount: data.elementsCount,
      thumbnailUrl: data.thumbnailUrl,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
};

export const loadProject = async (projectId: string): Promise<Project> => {
  const docSnap = await getDoc(doc(projectsCollection(), projectId));
  if (!docSnap.exists()) throw new Error('Project not found.');
  const data = docSnap.data() as InlineProjectDoc | StorageProjectDoc;

  if (data.storageMode === 'inline') {
    return JSON.parse(data.data) as Project;
  }

  const response = await fetch(data.dataUrl);
  if (!response.ok) throw new Error('Failed to download project data.');
  return (await response.json()) as Project;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await deleteDoc(doc(projectsCollection(), projectId));
};

// Generic helper for attaching a generated image (floorplan render, AI-render output, etc.)
// to a project. Not yet wired into every generation flow — call this from wherever a
// result should be persisted once that flow is ready to save automatically.
export const uploadProjectImage = async (
  userId: string,
  projectId: string,
  image: { base64?: string; blob?: Blob; label: string },
): Promise<string> => {
  const fileName = `${Date.now()}-${image.label.replace(/[^a-z0-9-_]/gi, '_')}.jpg`;
  const storageRef = ref(getFirebaseStorage(), `users/${userId}/projects/${projectId}/images/${fileName}`);
  if (image.base64) {
    const base64Data = image.base64.replace(/^data:image\/\w+;base64,/, '');
    await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/jpeg' });
  } else if (image.blob) {
    await uploadBytes(storageRef, image.blob, { contentType: image.blob.type || 'image/jpeg' });
  } else {
    throw new Error('uploadProjectImage requires base64 or blob.');
  }
  return getDownloadURL(storageRef);
};
