export type Database = {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string
          content: string | null
          image_url: string | null
          nickname: string
          created_at: string
          ip_hash: string | null
          fingerprint: string | null
          reaction_count: number
          comment_count: number
        }
        Insert: {
          id?: string
          content?: string | null
          image_url?: string | null
          nickname: string
          created_at?: string
          ip_hash?: string | null
          fingerprint?: string | null
          reaction_count?: number
          comment_count?: number
        }
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
      }
      reactions: {
        Row: {
          id: string
          post_id: string
          type: string
          fingerprint: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          type: string
          fingerprint: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['reactions']['Insert']>
      }
      comments: {
        Row: {
          id: string
          post_id: string
          content: string
          nickname: string
          ip_hash: string | null
          fingerprint: string | null
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          content: string
          nickname: string
          ip_hash?: string | null
          fingerprint?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
      dm_conversations: {
        Row: {
          id: string
          created_at: string
          last_message_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          last_message_at?: string
        }
        Update: Partial<Database['public']['Tables']['dm_conversations']['Insert']>
      }
      dm_participants: {
        Row: {
          id: string
          conversation_id: string
          nickname: string
          fingerprint: string
          joined_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          nickname: string
          fingerprint: string
          joined_at?: string
        }
        Update: Partial<Database['public']['Tables']['dm_participants']['Insert']>
      }
      dm_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_nickname: string
          sender_fingerprint: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_nickname: string
          sender_fingerprint: string
          content: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['dm_messages']['Insert']>
      }
    }
  }
}

export type Post = Database['public']['Tables']['posts']['Row']
export type Reaction = Database['public']['Tables']['reactions']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type DmConversation = Database['public']['Tables']['dm_conversations']['Row']
export type DmParticipant = Database['public']['Tables']['dm_participants']['Row']
export type DmMessage = Database['public']['Tables']['dm_messages']['Row']
