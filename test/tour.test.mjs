import test from 'node:test';
import assert from 'node:assert/strict';
import { tourArrowPath } from '../public/tour.js';

const box = (left, top, width, height) => ({left, top, right: left + width, bottom: top + height, width, height});
const points = (path) => path.match(/-?\d+(?:\.\d+)?/g).map(Number);

test('нижняя стрелка шага 4 выходит вниз из плашки и плавно подходит к кнопке', () => {
  // Measured on the product page at the 1280 × 720 desktop viewport.
  const card = box(386.98, 99.94, 340, 245.9);
  const ring = box(774.98, 364.87, 471.61, 72);
  const [sx, sy, c1x, c1y, c2x, c2y, ex, ey, ax, ay, tipX, tipY, bx, by] = points(tourArrowPath(card, ring));
  assert.equal(sy, card.bottom + 5, 'стрелка должна начинаться под плашкой');
  assert.ok(sx < card.right && sx > card.left);
  assert.equal(c1x, sx, 'выход из нижнего края должен быть направлен вниз');
  assert.ok(c1y > sy && c1y < ey);
  assert.equal(c2y, ey, 'наконечник должен подходить к левой границе обводки горизонтально');
  assert.ok(c2x > sx && c2x < ex);
  assert.equal(ex, ring.left - 5);
  assert.deepEqual([tipX, tipY], [ex, ey]);
  assert.ok(ax < ex && bx < ex && ay < ey && by > ey);
});

test('обычные стрелки с четырёх сторон сохраняют наконечник у обводки', () => {
  const ring = box(500, 300, 160, 60);
  for (const [card, end] of [
    [box(100, 250, 300, 160), [495, 330]],
    [box(760, 250, 300, 160), [665, 330]],
    [box(450, 70, 300, 160), [580, 295]],
    [box(450, 450, 300, 160), [580, 365]],
  ]) {
    const p = points(tourArrowPath(card, ring));
    assert.deepEqual(p.slice(6, 8), end);
    assert.deepEqual(p.slice(10, 12), end);
    assert.ok(p.every(Number.isFinite));
  }
  assert.equal(tourArrowPath(box(490, 290, 200, 100), ring), '');
});
