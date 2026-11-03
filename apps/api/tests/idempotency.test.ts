import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/prisma';
import { idempotent } from '../src/middleware/idempotency.middleware';

type Row = { userId: string; key: string; status: number | null; body: unknown };
const client = prisma as unknown as Record<string, unknown>;

/** Una tabla en memoria con la clave única (usuario, clave) de la real. */
function fakeTable() {
  const rows = new Map<string, Row>();
  const id = (u: string, k: string) => `${u}|${k}`;
  return {
    rows,
    create: async ({ data }: { data: { userId: string; key: string } }) => {
      if (rows.has(id(data.userId, data.key))) throw Object.assign(new Error('unique'), { code: 'P2002' });
      rows.set(id(data.userId, data.key), { ...data, status: null, body: null });
    },
    findUnique: async ({ where }: { where: { userId_key: { userId: string; key: string } } }) => rows.get(id(where.userId_key.userId, where.userId_key.key)) ?? null,
    update: async ({ where, data }: { where: { userId_key: { userId: string; key: string } }; data: Partial<Row> }) => {
      const row = rows.get(id(where.userId_key.userId, where.userId_key.key))!;
      Object.assign(row, data);
    },
    delete: async ({ where }: { where: { userId_key: { userId: string; key: string } } }) => { rows.delete(id(where.userId_key.userId, where.userId_key.key)); },
    deleteMany: async () => ({ count: 0 }),
  };
}

function request(key: string | undefined, userId = 'u1') {
  return { userId, header: (name: string) => (name === 'idempotency-key' ? key : undefined) } as never;
}

function response() {
  const out = { statusCode: 200, body: undefined as unknown, sent: 0 };
  const res = {
    get statusCode() { return out.statusCode; },
    set statusCode(v: number) { out.statusCode = v; },
    status(code: number) { out.statusCode = code; return res; },
    json(body: unknown) { out.body = body; out.sent += 1; return res; },
  };
  return { res: res as never, out };
}

const settle = () => new Promise((r) => setImmediate(r));

async function withTable<T>(run: (table: ReturnType<typeof fakeTable>) => Promise<T>): Promise<T> {
  const original = client.idempotencyKey;
  const table = fakeTable();
  client.idempotencyKey = table;
  try { return await run(table); } finally { client.idempotencyKey = original; }
}

/** El controlador: crea el recurso y responde, contando cuántas veces llegó a crearlo. */
async function attempt(key: string | undefined, created: { count: number }, userId = 'u1', fail = false) {
  const { res, out } = response();
  let ran = false;
  await idempotent(request(key, userId), res, () => {
    ran = true;
    created.count += 1;
    const r = res as unknown as { status: (n: number) => { json: (b: unknown) => void } };
    if (fail) r.status(500).json({ error: 'fallo' });
    else r.status(201).json({ event: { id: `e${created.count}` } });
  });
  await settle();
  return { out, ran };
}

void test('claves de idempotencia', async (suite) => {
  await suite.test('el reenvío recibe la misma respuesta y no vuelve a crear nada', () => withTable(async () => {
    const created = { count: 0 };
    const first = await attempt('clave-de-prueba-1', created);
    assert.equal(first.out.statusCode, 201);
    assert.deepEqual(first.out.body, { event: { id: 'e1' } });

    const again = await attempt('clave-de-prueba-1', created);
    assert.equal(again.ran, false);
    assert.equal(created.count, 1);
    assert.equal(again.out.statusCode, 201);
    assert.deepEqual(again.out.body, { event: { id: 'e1' } });
  }));

  await suite.test('sin clave o con una malformada, todo sigue como siempre', () => withTable(async (table) => {
    const created = { count: 0 };
    await attempt(undefined, created);
    await attempt(undefined, created);
    await attempt('corta', created);
    await attempt('con espacios y cosas raras!', created);
    assert.equal(created.count, 4);
    assert.equal(table.rows.size, 0);
  }));

  await suite.test('una clave es de cada persona', () => withTable(async () => {
    const created = { count: 0 };
    await attempt('clave-compartida', created, 'u1');
    const other = await attempt('clave-compartida', created, 'u2');
    assert.equal(other.ran, true);
    assert.equal(created.count, 2);
  }));

  await suite.test('una escritura que falló se puede reintentar', () => withTable(async (table) => {
    const created = { count: 0 };
    const failed = await attempt('clave-que-falla', created, 'u1', true);
    assert.equal(failed.out.statusCode, 500);
    assert.equal(table.rows.size, 0, 'la clave se olvida');
    const retried = await attempt('clave-que-falla', created);
    assert.equal(retried.ran, true);
    assert.equal(retried.out.statusCode, 201);
  }));

  await suite.test('si el primer intento sigue en curso, responde 425 para reintentar después', () => withTable(async (table) => {
    await table.create({ data: { userId: 'u1', key: 'clave-en-curso' } });
    const created = { count: 0 };
    const busy = await attempt('clave-en-curso', created);
    assert.equal(busy.ran, false);
    assert.equal(busy.out.statusCode, 425);
    assert.equal(created.count, 0);
  }));

  await suite.test('sin la tabla (migración pendiente), la escritura sigue y no se bloquea', async () => {
    const original = client.idempotencyKey;
    const quiet = console.error;
    console.error = () => undefined;
    client.idempotencyKey = { create: async () => { throw new Error('no existe la tabla'); } };
    try {
      const created = { count: 0 };
      const result = await attempt('clave-sin-tabla', created);
      assert.equal(result.ran, true);
      assert.equal(result.out.statusCode, 201);
    } finally {
      client.idempotencyKey = original;
      console.error = quiet;
    }
  });
});
