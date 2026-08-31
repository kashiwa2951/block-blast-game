/* ===== BLOCK RISE : input =====
 * キーボード（DAS/ARR 付き）と、スマホ向けのタッチ操作（ジェスチャ＋画面下ボタン）。
 */
(function (global) {
  'use strict';

  var BB = global.BB = global.BB || {};
  var C = BB.Config;

  var act = null;                 // game.js から渡されるアクション群
  var state = { left: false, right: false, softDrop: false };
  var lastDir = 0, dasTimer = 0, arrTimer = 0;

  function fire(name) {
    BB.Audio.unlock();
    if (act && typeof act[name] === 'function') act[name]();
  }

  /* ---------- キーボード ---------- */

  var HELD = {};

  function onKeyDown(e) {
    if (e.repeat) {
      // 横移動とソフトドロップは自前の DAS/ARR で処理するのでリピートは無視
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown'].indexOf(e.key) >= 0) e.preventDefault();
      return;
    }
    var k = e.key;
    var lower = (typeof k === 'string' && k.length === 1) ? k.toLowerCase() : k;

    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar'].indexOf(k) >= 0) {
      e.preventDefault();
    }
    if (HELD[k]) return;
    HELD[k] = true;
    BB.Audio.unlock();

    switch (k) {
      case 'ArrowLeft':  state.left = true; return;
      case 'ArrowRight': state.right = true; return;
      case 'ArrowDown':  state.softDrop = true; return;
      case 'ArrowUp':    fire('rotateCW'); return;
      case ' ':
      case 'Spacebar':   fire('hardDrop'); return;
      case 'Shift':      fire('hold'); return;
      case 'Escape':     fire('pause'); return;
      case 'Enter':      fire('confirm'); return;
    }

    switch (lower) {
      case 'x': fire('rotateCW'); break;
      case 'z': fire('rotateCCW'); break;
      case 'c': fire('hold'); break;
      case 'p': fire('pause'); break;
      case 'r': fire('restart'); break;
      case 'm': fire('toggleSound'); break;
    }
  }

  function onKeyUp(e) {
    HELD[e.key] = false;
    if (e.key === 'ArrowLeft') state.left = false;
    if (e.key === 'ArrowRight') state.right = false;
    if (e.key === 'ArrowDown') state.softDrop = false;
  }

  function onBlur() {
    HELD = {};
    state.left = state.right = state.softDrop = false;
    lastDir = 0;
    touch = null;
  }

  /* DAS / ARR。毎フレーム game.js から呼ばれる。 */
  function update(dt) {
    var dir = 0;
    if (state.left && !state.right) dir = -1;
    else if (state.right && !state.left) dir = 1;

    if (dir === 0) { lastDir = 0; dasTimer = 0; arrTimer = 0; return; }

    if (dir !== lastDir) {
      lastDir = dir;
      dasTimer = 0;
      arrTimer = 0;
      fire(dir < 0 ? 'moveLeft' : 'moveRight');
      return;
    }

    dasTimer += dt;
    if (dasTimer >= C.DAS) {
      arrTimer += dt;
      var guard = 0;
      while (arrTimer >= C.ARR && guard++ < 12) {
        arrTimer -= C.ARR;
        fire(dir < 0 ? 'moveLeft' : 'moveRight');
      }
    }
  }

  /* ---------- タッチ／ポインタ操作（盤面のジェスチャ） ---------- */

  var touch = null;

  /* 盤面のジェスチャ。受付範囲は盤面そのものではなく、その外側の余白を含む枠全体。
   * 盤面の左右を触っても操作できるので、指でブロックが隠れない。 */
  function bindBoardGestures(surface) {
    surface.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // タイトル／一時停止／ゲームオーバーの画面が出ているときは、そちらの操作を優先
      if (e.target && e.target.closest && e.target.closest('.overlay')) return;
      BB.Audio.unlock();
      // 捕捉に失敗しても操作自体は続けられるようにしておく
      try { surface.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
      touch = {
        id: e.pointerId,
        x0: e.clientX, y0: e.clientY,
        lastX: e.clientX, lastY: e.clientY,
        accX: 0, maxDist: 0, t0: performance.now(),
        movedCells: 0, softing: false
      };
    });

    surface.addEventListener('pointermove', function (e) {
      if (!touch || e.pointerId !== touch.id) return;
      e.preventDefault();

      var cellSize = BB.Render.metrics().cell;
      var stepX = Math.max(14, cellSize * 0.7);

      var dx = e.clientX - touch.lastX;
      var dy = e.clientY - touch.lastY;
      touch.lastX = e.clientX;
      touch.lastY = e.clientY;

      var totX = e.clientX - touch.x0, totY = e.clientY - touch.y0;
      touch.maxDist = Math.max(touch.maxDist, Math.hypot(totX, totY));

      touch.accX += dx;
      var guard = 0;
      while (Math.abs(touch.accX) >= stepX && guard++ < 10) {
        if (touch.accX > 0) { touch.accX -= stepX; fire('moveRight'); }
        else { touch.accX += stepX; fire('moveLeft'); }
        touch.movedCells++;
      }

      // ゆっくり下へ引っ張っている間はソフトドロップ
      var softWanted = totY > cellSize * 0.75 && Math.abs(totY) > Math.abs(totX);
      if (softWanted !== touch.softing) {
        touch.softing = softWanted;
        state.softDrop = softWanted;
      }
    }, { passive: false });

    function endTouch(e) {
      if (!touch || e.pointerId !== touch.id) return;
      var dt = performance.now() - touch.t0;
      var totX = e.clientX - touch.x0;
      var totY = e.clientY - touch.y0;

      state.softDrop = false;

      if (touch.maxDist < 12 && dt < 260 && touch.movedCells === 0) {
        fire('rotateCW');                                   // タップ＝回転
      } else if (totY > 55 && dt < 300 && Math.abs(totY) > Math.abs(totX) * 1.4) {
        fire('hardDrop');                                   // 下フリック＝ハードドロップ
      } else if (totY < -55 && dt < 320 && Math.abs(totY) > Math.abs(totX) * 1.4) {
        fire('hold');                                       // 上スワイプ＝ホールド
      }
      touch = null;
    }

    surface.addEventListener('pointerup', endTouch);
    surface.addEventListener('pointercancel', function (e) {
      if (touch && e.pointerId === touch.id) { state.softDrop = false; touch = null; }
    });
    surface.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ---------- 押しっぱなしに対応した操作ボタン ---------- */

  /* 画面下のボタンと、盤面左右の操作エリアで共通して使う。
   * left / right / soft は押している間ずっと有効（横移動は DAS/ARR で連続移動）。 */
  function bindHoldControl(el, a, activeClass) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      BB.Audio.unlock();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 未対応環境は無視 */ }
      if (activeClass) el.classList.add(activeClass);

      if (a === 'left') state.left = true;
      else if (a === 'right') state.right = true;
      else if (a === 'soft') state.softDrop = true;
      else if (a === 'rotate') fire('rotateCW');
      else if (a === 'hard') fire('hardDrop');
      else if (a === 'hold') fire('hold');
    });

    function release(e) {
      if (e) e.preventDefault();
      if (activeClass) el.classList.remove(activeClass);
      if (a === 'left') state.left = false;
      else if (a === 'right') state.right = false;
      else if (a === 'soft') state.softDrop = false;
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }

  function bindPad(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.pad-btn'), function (btn) {
      bindHoldControl(btn, btn.getAttribute('data-act'), null);
    });
  }

  function init(actions) {
    act = actions;
    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);
    global.addEventListener('blur', onBlur);
    bindBoardGestures(document.getElementById('board-wrap'));
    bindPad(document.getElementById('touch-controls'));
  }

  BB.Input = {
    init: init,
    update: update,
    state: state,
    releaseAll: onBlur
  };

})(typeof window !== 'undefined' ? window : this);
