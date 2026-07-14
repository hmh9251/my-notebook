export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string | null;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: number;
  name: string;
  count: number;
}
