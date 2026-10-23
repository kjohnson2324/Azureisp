import type { SupabaseClient } from '@supabase/supabase-js';

import type { EvidenceApi } from './outbox';

export function supabaseEvidenceApi(client: SupabaseClient): EvidenceApi {
  return {
    async saveAttempts(studentId, rows) {
      // Insert-if-missing, then update only columns students may write (the
      // update grant excludes ids and points, so a blind upsert would be refused).
      const { error: insertError } = await client
        .from('mission_attempts')
        .upsert(rows.map((r) => ({ ...r, student_id: studentId })), { onConflict: 'id', ignoreDuplicates: true });
      if (insertError) throw insertError;
      for (const r of rows) {
        const { error } = await client
          .from('mission_attempts')
          .update({ status: r.status, current_stop: r.current_stop, hints_used: r.hints_used, completed_at: r.completed_at, client_updated_at: r.client_updated_at })
          .eq('id', r.id);
        if (error) throw error;
      }
    },
    async insertAnswers(studentId, rows) {
      const { error } = await client
        .from('answer_events')
        .upsert(rows.map((r) => ({ ...r, student_id: studentId })), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    },
  };
}
