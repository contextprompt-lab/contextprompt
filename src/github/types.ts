export interface GitHubComment {
  author: string;
  body: string;
  createdAt: string;
}

export interface GitHubIssue {
  title: string;
  body: string;
  number: number;
  url: string;
  author: string;
  labels: string[];
  comments: GitHubComment[];
}

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
}

export interface GitHubIssueSummary {
  number: number;
  title: string;
  url: string;
  author: string;
  labels: string[];
  createdAt: string;
}
