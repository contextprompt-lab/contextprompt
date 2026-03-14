export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum';
  signature?: string;
}

export interface FileEntry {
  path: string;
  exports: ExportInfo[];
}

export interface RepoMap {
  name: string;
  rootPath: string;
  fileTree: string;
  files: FileEntry[];
  readme: string | null;
}
