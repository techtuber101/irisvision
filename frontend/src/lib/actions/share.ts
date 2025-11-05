'use server';

import { createClient } from '@/lib/supabase/server';
import { Project, Thread } from '@/lib/api';

/**
 * Server action to fetch a public project by ID
 * This allows anonymous users to view shared conversations
 */
export async function getPublicProject(projectId: string): Promise<Project | null> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_public', true) // Only fetch public projects
      .single();

    if (error) {
      // If project not found or not public, return null
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`Error fetching public project ${projectId}:`, error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Map database fields to our Project type
    const mappedProject: Project = {
      id: data.project_id,
      name: data.name || '',
      description: data.description || '',
      is_public: data.is_public || false,
      created_at: data.created_at,
      sandbox: data.sandbox || {
        id: '',
        pass: '',
        vnc_preview: '',
        sandbox_url: '',
      },
    };

    return mappedProject;
  } catch (error) {
    console.error(`Error fetching public project ${projectId}:`, error);
    return null;
  }
}

/**
 * Server action to fetch a public thread by ID
 * This allows anonymous users to view shared conversations
 */
export async function getPublicThread(threadId: string): Promise<Thread | null> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from('threads')
      .select('*')
      .eq('thread_id', threadId)
      .eq('is_public', true) // Only fetch public threads
      .single();

    if (error) {
      // If thread not found or not public, return null
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`Error fetching public thread ${threadId}:`, error);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching public thread ${threadId}:`, error);
    return null;
  }
}

