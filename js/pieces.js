/* ===== BLOCK RISE : pieces =====
 * テトロミノ7種の形状・回転（SRS準拠の壁蹴り付き）・7-bagランダマイザ。
 */
(function (global) {
  'use strict';

  var BB = global.BB = global.BB || {};
  var C = BB.Config;

  /* 回転状態0の形。1 がブロック。 */
  var BASE = {
    I: [[0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]],
    J: [[1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]],
    L: [[0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]],
    O: [[1, 1],
        [1, 1]],
    S: [[0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]],
    T: [[0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]],
    Z: [[1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]]
  };

  var TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  function rotateCW(m) {
    var n = m.length, out = [], r, c;
    for (r = 0; r < n; r++) {
      out.push([]);
      for (c = 0; c < n; c++) out[r].push(m[n - 1 - c][r]);
    }
    return out;
  }

  /* 各ピースの回転4状態を、セル座標リストとして事前計算しておく */
  var SHAPES = {};   // SHAPES[type][rot] = [{r, c}, ...]
  var MATRIX = {};   // MATRIX[type][rot] = 行列（描画のガイド用）
  (function build() {
    TYPES.forEach(function (t) {
      var m = BASE[t];
      SHAPES[t] = [];
      MATRIX[t] = [];
      for (var rot = 0; rot < 4; rot++) {
        var cells = [];
        for (var r = 0; r < m.length; r++) {
          for (var c = 0; c < m.length; c++) {
            if (m[r][c]) cells.push({ r: r, c: c });
          }
        }
        SHAPES[t].push(cells);
        MATRIX[t].push(m);
        m = rotateCW(m);
      }
    });
  })();

  /* --- SRS 壁蹴りテーブル（盤面座標：dy が正で下向き） --- */
  var KICKS_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  };

  var KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  };

  var NO_KICK = [[0, 0]];

  function kicksFor(type, from, to) {
    if (type === 'O') return NO_KICK;
    var key = from + '>' + to;
    var table = (type === 'I') ? KICKS_I : KICKS_JLSTZ;
    return table[key] || NO_KICK;
  }

  /* --- ピース --- */

  function Piece(type) {
    this.type = type;
    this.rot = 0;
    var cells = SHAPES[type][0];
    var size = BASE[type].length;

    // 形の最上段が、天井のすぐ下（最初の可視行）に来るように配置する
    var minR = Infinity, minC = Infinity, maxC = -Infinity;
    cells.forEach(function (p) {
      if (p.r < minR) minR = p.r;
      if (p.c < minC) minC = p.c;
      if (p.c > maxC) maxC = p.c;
    });
    var width = maxC - minC + 1;

    this.y = C.BUFFER_ROWS - minR;
    this.x = Math.floor((C.COLS - width) / 2) - minC;
    this.size = size;
  }

  /* 現在位置での占有セル（盤面座標） */
  Piece.prototype.cells = function (rot, x, y) {
    rot = (rot === undefined) ? this.rot : rot;
    x = (x === undefined) ? this.x : x;
    y = (y === undefined) ? this.y : y;
    var out = [];
    var shape = SHAPES[this.type][rot];
    for (var i = 0; i < shape.length; i++) {
      out.push({ r: y + shape[i].r, c: x + shape[i].c });
    }
    return out;
  };

  Piece.prototype.clone = function () {
    var p = Object.create(Piece.prototype);
    p.type = this.type; p.rot = this.rot; p.x = this.x; p.y = this.y; p.size = this.size;
    return p;
  };

  /* --- 7-bag ランダマイザ --- */

  function Bag() {
    this.queue = [];
    this.refill();
    this.refill();
  }

  Bag.prototype.refill = function () {
    var bag = TYPES.slice();
    for (var i = bag.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
    this.queue = this.queue.concat(bag);
  };

  Bag.prototype.next = function () {
    if (this.queue.length <= 7) this.refill();
    return this.queue.shift();
  };

  Bag.prototype.peek = function (n) {
    if (this.queue.length < n + 1) this.refill();
    return this.queue.slice(0, n);
  };

  BB.Pieces = {
    TYPES: TYPES,
    SHAPES: SHAPES,
    MATRIX: MATRIX,
    Piece: Piece,
    Bag: Bag,
    kicksFor: kicksFor,
    /* 形状のバウンディングボックス（NEXT/HOLD のセンタリング用） */
    boundsOf: function (type, rot) {
      var cells = SHAPES[type][rot || 0];
      var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      cells.forEach(function (p) {
        if (p.r < minR) minR = p.r;
        if (p.r > maxR) maxR = p.r;
        if (p.c < minC) minC = p.c;
        if (p.c > maxC) maxC = p.c;
      });
      return { minR: minR, maxR: maxR, minC: minC, maxC: maxC, w: maxC - minC + 1, h: maxR - minR + 1 };
    }
  };

})(typeof window !== 'undefined' ? window : this);
