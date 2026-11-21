import test from 'node:test';
import assert from 'node:assert/strict';
import { tourArrowPath, tourCardPosition } from '../public/tour.js';

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

test('стрелка к широкой области выше плашки плавно выходит влево', () => {
  const card = box(920, 396, 340, 303.59);
  const ring = box(176.4, 126.47, 1113.2, 200);
  const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = points(tourArrowPath(card, ring));
  assert.equal(sx, card.left - 5);
  assert.ok(sy > card.top && sy < card.bottom);
  assert.equal(c1y, sy);
  assert.ok(c1x < sx && c1x > ex);
  assert.equal(c2x, ex);
  assert.ok(c2y < sy && c2y > ey);
  assert.equal(ey, ring.bottom + 5);
});

test('плашка шага 11 располагается по центру под широкой областью аналитики', () => {
  const ring = box(176.4, 126.47, 1113.2, 200);
  const [left, top] = tourCardPosition(ring, 340, 303.59, 1280, 720);
  assert.equal(left + 170, (ring.left + ring.right) / 2);
  assert.ok(top > ring.bottom && top + 303.59 <= 704);
  const p = points(tourArrowPath(box(left, top, 340, 303.59), ring));
  assert.equal(p[0], p[6], 'стрелка должна указывать вверх без бокового изгиба');
  assert.equal(p[2], p[6]);
  assert.equal(p[4], p[6]);
});
