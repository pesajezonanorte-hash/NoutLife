import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import {
  MAX_STROKE_NUMBERS, createNotebookSchema, isEmptyPage, notebookImageSchema, pageContentSchema, updateNotebookSchema,
} from '../src/schemas/notebook.schemas';
import { NotebookError, addImage, createNotebook, savePage, updateNotebook } from '../src/services/notebook.service';

type Client = Record<string, Record<string, unknown>>;
const client = prisma as unknown as Client;

/** Sustituye métodos de Prisma durante la prueba (sin base de datos). */
async function withMocks(mocks: Record<string, Record<string, unknown>>, run: () => Promise<void>) {
  const saved: Array<[string, string, unknown]> = [];
  for (const [model, methods] of Object.entries(mocks)) {
    for (const [name, fn] of Object.entries(methods)) {
      saved.push([model, name, client[model][name]]);
      client[model][name] = fn;
    }
  }
  try { await run(); } finally { for (const [model, name, fn] of saved) client[model][name] = fn; }
}

/** El candado de Lite: 402 con el motivo exacto. */
const lockOf = (lock: string) => (err: unknown) => err instanceof NotebookError && err.status === 402 && err.lock === lock;

const blank = { html: '', strokes: [], stickies: [], images: [] };
const stroke = { t: 'pen', c: '#1d4ed8', w: 6, p: [0, 0, 10, 10] };
const note = (color: string, id = 'n1') => ({ id, x: 10, y: 10, text: 'Hola', color, rot: 0 });
const book = { title: 'Ideas', category: 'personal', color: 'jade', paper: 'ruled', pageCount: 5 } as const;
const saved = async () => ({ index: 0, content: {}, updatedAt: new Date() });

test('crear libreta: valores por defecto y solo categorías conocidas', () => {
  const ok = createNotebookSchema.parse({ title: '  Ideas sueltas ' });
  assert.deepEqual(ok, { title: 'Ideas sueltas', category: 'personal', color: 'jade', paper: 'ruled', pageCount: 20 });
  assert.equal(createNotebookSchema.safeParse({ title: 'x', category: 'secreta' }).success, false);
  assert.equal(createNotebookSchema.safeParse({ title: 'x', pageCount: 201 }).success, false);
  assert.equal(createNotebookSchema.safeParse({ title: '' }).success, false);
  assert.equal(updateNotebookSchema.safeParse({ userId: 'otro' }).success, false, 'no se cuelan campos ajenos');
});

test('página: trazos en pares, con tope de tamaño y sin campos extra', () => {
  assert.equal(pageContentSchema.safeParse({ ...blank, strokes: [stroke] }).success, true);
  assert.equal(pageContentSchema.safeParse({ ...blank, strokes: [{ ...stroke, p: [1, 2, 3] }] }).success, false, 'un punto sin su y');
  assert.equal(pageContentSchema.safeParse({ ...blank, strokes: [{ ...stroke, c: 'red' }] }).success, false);
  assert.equal(pageContentSchema.safeParse({ ...blank, script: 'x' }).success, false);
  const heavy = Array.from({ length: Math.ceil(MAX_STROKE_NUMBERS / 8000) + 1 }, () => ({ ...stroke, p: new Array(8000).fill(5) }));
  assert.equal(pageContentSchema.safeParse({ ...blank, strokes: heavy }).success, false, 'demasiados trazos');
});

test('imagen: solo base64 de jpeg, png o webp', () => {
  assert.equal(notebookImageSchema.safeParse({ mime: 'image/jpeg', data: 'QUJDREVGR0hJSktMTU5PUA==' }).success, true);
  assert.equal(notebookImageSchema.safeParse({ mime: 'image/svg+xml', data: 'QUJDREVGR0hJSktMTU5PUA==' }).success, false);
  assert.equal(notebookImageSchema.safeParse({ mime: 'image/png', data: 'data:image/png;base64,AAAA' }).success, false);
});

test('una página sin contenido cuenta como vacía', () => {
  assert.equal(isEmptyPage({ ...blank, html: '<div><br></div><div>&nbsp;</div>' }), true);
  assert.equal(isEmptyPage({ ...blank, html: '<div>Hola</div>' }), false);
  assert.equal(isEmptyPage({ ...blank, strokes: [stroke] }), false);
});

test('guardar una página vacía la borra; fuera de rango falla', async () => {
  const calls: string[] = [];
  await withMocks({
    notebook: { findFirst: async () => ({ id: 'n1', pageCount: 3 }), update: async () => { calls.push('touch'); return {}; } },
    notebookPage: {
      deleteMany: async () => { calls.push('delete'); return { count: 1 }; },
      upsert: async () => { calls.push('upsert'); return saved(); },
    },
  }, async () => {
    assert.deepEqual(await savePage('u1', 'n1', 1, blank), { page: null });
    assert.deepEqual(calls, ['delete', 'touch']);
    await savePage('u1', 'n1', 0, { ...blank, html: '<div>Hola</div>' });
    assert.deepEqual(calls.slice(2), ['upsert', 'touch']);
    await assert.rejects(savePage('u1', 'n1', 3, blank), NotebookError);
  });
});

test('una libreta ajena no existe; no se puede encoger por debajo de la última página escrita', async () => {
  await withMocks({ notebook: { findFirst: async () => null } }, async () => {
    assert.equal(await savePage('u2', 'n1', 0, blank), null);
  });
  await withMocks({
    notebook: { findFirst: async () => ({ id: 'n1', pageCount: 20 }) },
    notebookPage: { findFirst: async () => ({ index: 9 }) },
  }, async () => {
    await assert.rejects(updateNotebook('u1', 'n1', { pageCount: 9 }), /al menos 10 páginas/);
  });
});

test('Lite: dos libretas como máximo, y páginas hasta 10', async () => {
  await assert.rejects(createNotebook('u1', { ...book, pageCount: 11 }, true), lockOf('notebook-pages'));
  await withMocks({ notebook: { count: async () => 2 } }, async () => {
    await assert.rejects(createNotebook('u1', { ...book, pageCount: 10 }, true), lockOf('notebooks'));
  });
  await withMocks({ notebook: { findFirst: async () => ({ id: 'n1', pageCount: 10 }) } }, async () => {
    await assert.rejects(updateNotebook('u1', 'n1', { pageCount: 11 }, true), lockOf('notebook-pages'));
  });
});

test('Lite: escribir sí, pero no añadir trazos, imágenes ni notas de color', async () => {
  const mocks = {
    notebook: { findFirst: async () => ({ id: 'n1', pageCount: 3 }), update: async () => ({}) },
    notebookPage: { findUnique: async () => ({ content: blank }), upsert: saved },
    notebookImage: { count: async () => 0 },
  };
  await withMocks(mocks, async () => {
    await assert.rejects(savePage('u1', 'n1', 0, { ...blank, strokes: [stroke] }, true), lockOf('notebook-draw'));
    await assert.rejects(savePage('u1', 'n1', 0, { ...blank, images: [{ id: 'i1', x: 0, y: 0, w: 100, ratio: 1 }] }, true), lockOf('notebook-images'));
    await assert.rejects(savePage('u1', 'n1', 0, { ...blank, stickies: [note('pink')] }, true), lockOf('notebook-stickies'));
    await assert.rejects(addImage('u1', 'n1', { mime: 'image/png', data: 'QUJDREVGR0hJSktMTU5PUA==' }, true), lockOf('notebook-images'));
    // Un post-it amarillo y el texto sí se guardan.
    assert.notEqual(await savePage('u1', 'n1', 0, { ...blank, html: '<div>Hola</div>', stickies: [note('yellow')] }, true), null);
  });
});

test('Lite: una página con trazos de cuando era Pro sigue guardándose igual', async () => {
  await withMocks({
    notebook: { findFirst: async () => ({ id: 'n1', pageCount: 3 }), update: async () => ({}) },
    notebookPage: { findUnique: async () => ({ content: { ...blank, strokes: [stroke], stickies: [note('pink')] } }), upsert: saved },
  }, async () => {
    const content = { ...blank, html: '<div>Texto nuevo</div>', strokes: [stroke], stickies: [note('pink')] };
    assert.notEqual(await savePage('u1', 'n1', 0, content, true), null);
  });
});

test('Pro: sin límites de libretas ni de lo que es de Pro', async () => {
  await withMocks({
    notebook: { findFirst: async () => ({ id: 'n9', pageCount: 5 }), count: async () => 2, create: async ({ data }: { data: object }) => ({ id: 'n9', ...data, createdAt: new Date(), updatedAt: new Date() }) },
    notebookImage: { count: async () => 0, create: async () => ({ id: 'i1', mime: 'image/png' }) },
    notebookPage: { findUnique: async () => ({ content: blank }), upsert: saved },
  }, async () => {
    const created = await createNotebook('u1', { ...book, pageCount: 200 }, false);
    assert.equal(created.id, 'n9');
    assert.equal((await addImage('u1', 'n9', { mime: 'image/png', data: 'QUJDREVGR0hJSktMTU5PUA==' }, false))?.id, 'i1');
  });
});
