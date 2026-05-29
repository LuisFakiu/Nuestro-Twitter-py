export interface Post {
  id: number;
  author: number;
  author_username: string;
  author_avatar: string;
  content: string;
  image_url?: string;
  parent_id?: number | null;
  shared_post?: SharedPost | null;
  created_at: string;
  updated_at: string;
  likes_count: number;
  reply_count: number;
  repost_count: number;
  is_liked: boolean;
  is_reposted: boolean;
  is_comment: boolean;
  is_repost: boolean;
  is_quote: boolean;
  hashtags_list: string[];
  mentions_list: string[];
}

export interface SharedPost {
  id: number;
  author: number;
  author_username: string;
  author_avatar: string;
  content: string;
  image_url?: string;
  created_at: string;
  repost_count?: number;
}
