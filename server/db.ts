// Accès PostgreSQL. Les objets de l'appli (défis, joueurs, tournois…) sont stockés en JSONB dans la
// table `docs`, une ligne par objet. Toutes les règles passent par des transactions avec verrouillage
// (SELECT … FOR UPDATE) : deux joueurs ne peuvent pas accepter le même défi, un gain n'est versé qu'une fois.
import pg from 'pg'

export const COLLECTIONS = [
  'users', 'challenges', 'transactions', 'notifications', 'tournaments', 'announcements',
  'events', 'referrals', 'streams', 'polls', 'votes',
] as const
export type Col = (typeof COLLECTIONS)[number]

export interface Change { col: Col; id: string; doc: Record<string, unknown> | null }

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
})

export async function migrate() {
  await pool.query(`
    create table if not exists docs (
      col text not null,
      id text not null,
      owner text,
      data jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (col, id)
    );
    create index if not exists docs_owner_idx on docs (col, owner);
    create table if not exists accounts (
      user_id text primary key,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );
    create table if not exists images (
      id text primary key,
      owner text not null,
      mime text not null,
      data bytea not null,
      created_at timestamptz not null default now()
    );
  `)
}

/** Propriétaire d'un document : seuls ces documents sont privés à un joueur. */
function ownerOf(col: Col, doc: Record<string, unknown>): string | null {
  if (col === 'transactions' || col === 'notifications') return String(doc.userId)
  if (col === 'referrals') return String(doc.referrerId)
  return null
}

export class Tx {
  readonly changes = new Map<string, Change>()
  readonly client: pg.PoolClient
  constructor(client: pg.PoolClient) {
    this.client = client
  }

  async get<T>(col: Col, id: string, lock = false): Promise<T | undefined> {
    const r = await this.client.query(`select data from docs where col = $1 and id = $2${lock ? ' for update' : ''}`, [col, id])
    return r.rows[0]?.data as T | undefined
  }

  async list<T>(col: Col, owner?: string): Promise<T[]> {
    const r = owner
      ? await this.client.query('select data from docs where col = $1 and owner = $2', [col, owner])
      : await this.client.query('select data from docs where col = $1', [col])
    return r.rows.map((x) => x.data as T)
  }

  async findBy<T>(col: Col, field: string, value: string): Promise<T | undefined> {
    const r = await this.client.query(`select data from docs where col = $1 and data->>$2 = $3 limit 1`, [col, field, value])
    return r.rows[0]?.data as T | undefined
  }

  async put<T extends { id: string }>(col: Col, doc: T): Promise<T> {
    await this.client.query(
      `insert into docs (col, id, owner, data, updated_at) values ($1, $2, $3, $4, now())
       on conflict (col, id) do update set data = excluded.data, owner = excluded.owner, updated_at = now()`,
      [col, doc.id, ownerOf(col, doc as unknown as Record<string, unknown>), JSON.stringify(doc)],
    )
    this.changes.set(`${col}:${doc.id}`, { col, id: doc.id, doc: doc as unknown as Record<string, unknown> })
    return doc
  }

  /** Lit, transforme et réécrit un document verrouillé. */
  async update<T extends { id: string }>(col: Col, id: string, fn: (d: T) => T): Promise<T> {
    const cur = await this.get<T>(col, id, true)
    if (!cur) throw new AppError('Introuvable')
    return this.put(col, fn(cur))
  }

  async remove(col: Col, id: string) {
    await this.client.query('delete from docs where col = $1 and id = $2', [col, id])
    this.changes.set(`${col}:${id}`, { col, id, doc: null })
  }
}

/** Exécute une fonction dans une transaction et renvoie les documents modifiés. */
export async function tx<T>(fn: (t: Tx) => Promise<T>): Promise<{ result: T; changes: Change[] }> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const t = new Tx(client)
    const result = await fn(t)
    await client.query('commit')
    return { result, changes: [...t.changes.values()] }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/** Erreur « métier » dont le message peut être montré au joueur. */
export class AppError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}
