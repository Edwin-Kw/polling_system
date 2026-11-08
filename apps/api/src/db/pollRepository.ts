import type pg from "pg";
import { pollResultsSchema, pollSchema } from "@polling/shared";
import type { Poll, PollResults } from "@polling/shared";

export interface PollRepository {
  getActivePoll(): Promise<Poll | null>;
  getActivePolls(): Promise<Poll[]>;
  getPoll(pollId: string): Promise<(Poll & { active: boolean }) | null>;
  getResults(pollId: string, userId: string): Promise<PollResults | null>;
  insertVote(pollId: string, optionId: string, userId: string): Promise<boolean>;
}

export function createPollRepository(pool: pg.Pool): PollRepository {
  async function readPolls(pollId: string | null) {
    const result = await pool.query<{ poll: unknown; active: boolean }>(`
      SELECT jsonb_build_object('id', p.id, 'question', p.question,
        'options', jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
          ORDER BY o.display_order)) AS poll, p.active
      FROM polls p JOIN poll_options o ON o.poll_id = p.id
      WHERE ($1::uuid IS NULL AND p.active) OR p.id = $1::uuid
      GROUP BY p.id
      ORDER BY p.id
    `, [pollId]);
    return result.rows.map((row) => ({ ...pollSchema.parse(row.poll), active: row.active }));
  }

  return {
    getActivePoll: async () => (await readPolls(null))[0] ?? null,
    getActivePolls: async () => (await readPolls(null)).map(({ id, question, options }) => ({ id, question, options })),
    getPoll: async (pollId) => (await readPolls(pollId))[0] ?? null,
    async getResults(pollId, userId) {
      // Counts and this user's vote are derived from the same SQL statement snapshot.
      const result = await pool.query<{ results: unknown }>(`
        WITH counts AS (
          SELECT o.id, o.label, o.display_order, count(v.user_id)::int AS count,
            bool_or(v.user_id = $2) AS mine
          FROM poll_options o
          LEFT JOIN votes v ON v.poll_id = o.poll_id AND v.option_id = o.id
          WHERE o.poll_id = $1
          GROUP BY o.id
        )
        SELECT jsonb_build_object(
          'pollId', p.id, 'active', p.active,
          'options', jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'count', c.count)
            ORDER BY c.display_order),
          'totalVotes', sum(c.count),
          'myVote', max(c.id::text) FILTER (WHERE c.mine)
        ) AS results
        FROM polls p JOIN counts c ON true WHERE p.id = $1 GROUP BY p.id
      `, [pollId, userId]);
      const row = result.rows[0];
      return row ? pollResultsSchema.parse(row.results) : null;
    },
    async insertVote(pollId, optionId, userId) {
      const result = await pool.query(`
        INSERT INTO votes (poll_id, option_id, user_id)
        SELECT p.id, o.id, $3 FROM polls p
        JOIN poll_options o ON o.poll_id = p.id
        WHERE p.id = $1 AND o.id = $2 AND p.active
        ON CONFLICT (poll_id, user_id) DO NOTHING
        RETURNING option_id
      `, [pollId, optionId, userId]);
      return result.rowCount === 1;
    },
  };
}
