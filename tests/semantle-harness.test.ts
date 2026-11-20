import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectStore } from '../lib/project-store.ts';

test('Semantle is available in Games and follows category deletion and module hiding', () => {
  const store = createProjectStore(':memory:');
  try {
    assert.equal(store.modules().find(module => module.id === 'semantle')?.categoryId, 'games');
    const category = store.addCategory('단어 게임');
    store.moveModule('semantle', category.id);
    assert.equal(store.modules().find(module => module.id === 'semantle')?.categoryId, category.id);
    store.removeCategory(category.id);
    assert.equal(store.modules().find(module => module.id === 'semantle')?.categoryId, null);
    store.removeModule('semantle');
    assert.equal(store.modules().some(module => module.id === 'semantle'), false);
  } finally { store.close(); }
});
