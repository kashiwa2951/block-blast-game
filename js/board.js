/* ===== BLOCK RISE : board =====
 * 盤面データと、このゲームの核になる 2 つの独自ルール：
 *   1) せり上がり（rise）
 *   2) ライン消去後、最後に置いたピースの残りが「形を崩して」バラバラに落ちる（dropCellsApart）
 */
(function (global) {
  'use strict';

  var BB = global.BB = global.BB || {};
  var C = BB.Config;

  function emptyRow(cols) {
    var row = new Array(cols);
    for (var i = 0; i < cols; i++) row[i] = null;
    return row;
  }

  function Board(cols, rows) {
    this.cols = cols || C.COLS;
    this.rows = rows || C.TOTAL_ROWS;
    this.buffer = C.BUFFER_ROWS;
    this.grid = [];
    this.reset();
  }

  Board.prototype.reset = function () {
    this.grid = [];
    for (var r = 0; r < this.rows; r++) this.grid.push(emptyRow(this.cols));
    this.lastHoles = null;
    this.currentHoles = null;   // いま続けている穴の位置
    this.holeStreak = 0;        // その位置をあと何行続けるか
  };

  Board.prototype.get = function (r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return undefined;
    return this.grid[r][c];
  };

  Board.prototype.set = function (r, c, v) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
    this.grid[r][c] = v;
  };

  /* セル群が盤面や既存ブロックとぶつかるか */
  Board.prototype.collides = function (cells) {
    for (var i = 0; i < cells.length; i++) {
      var r = cells[i].r, c = cells[i].c;
      if (c < 0 || c >= this.cols) return true;
      if (r < 0 || r >= this.rows) return true;
      if (this.grid[r][c]) return true;
    }
    return false;
  };

  /* ピースを盤面に固定し、置いたセルの座標を返す */
  Board.prototype.lockPiece = function (piece) {
    var cells = piece.cells();
    for (var i = 0; i < cells.length; i++) {
      this.set(cells[i].r, cells[i].c, piece.type);
    }
    return cells;
  };

  /* そろっている行のインデックス（上から順） */
  Board.prototype.fullRows = function () {
    var out = [];
    for (var r = 0; r < this.rows; r++) {
      var full = true;
      for (var c = 0; c < this.cols; c++) {
        if (!this.grid[r][c]) { full = false; break; }
      }
      if (full) out.push(r);
    }
    return out;
  };

  /* そろった行を削除し、上の行を下へ詰める（標準テトリスと同じ） */
  Board.prototype.clearRows = function (rowList) {
    var doomed = {};
    rowList.forEach(function (r) { doomed[r] = true; });

    var kept = [];
    for (var r = 0; r < this.rows; r++) {
      if (!doomed[r]) kept.push(this.grid[r]);
    }
    var newGrid = [];
    var missing = this.rows - kept.length;
    for (var i = 0; i < missing; i++) newGrid.push(emptyRow(this.cols));
    this.grid = newGrid.concat(kept);
  };

  /* 行 r のセルが、clearRows 後にどの行へ移動するか。
   * 自分より下（インデックスが大きい）で消えた行の数だけ下がる。 */
  Board.prototype.mapRowAfterClear = function (r, rowList) {
    var shift = 0;
    for (var i = 0; i < rowList.length; i++) {
      if (rowList[i] > r) shift++;
    }
    return r + shift;
  };

  /* ★ 独自ルールの核 ★
   * 指定セル群を「形を保たず」1マスずつバラバラに真下へ落とす。
   *
   * 重要：必ず下の行のセルから処理する。上のセルを先に落とすと、
   * まだ落ちていない下のセルにぶつかって止まり、隙間が埋まらなくなる。
   *
   * 戻り値：アニメーション用の移動情報 [{ c, fromR, toR, type }]
   */
  Board.prototype.dropCellsApart = function (cells) {
    var self = this;
    var moves = [];

    // 下の行から順（同じ行なら左から）。念のため重複も除いておく。
    var seen = {};
    var ordered = cells.filter(function (p) {
      var k = p.r + ':' + p.c;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).sort(function (a, b) {
      return (b.r - a.r) || (a.c - b.c);
    });

    ordered.forEach(function (p) {
      var type = self.get(p.r, p.c);
      if (!type) return;                 // すでに消えているセルは無視

      self.grid[p.r][p.c] = null;        // 自分自身と衝突しないよう一旦取り出す

      var r = p.r;
      while (r + 1 < self.rows && !self.grid[r + 1][p.c]) r++;

      self.grid[r][p.c] = type;
      moves.push({ c: p.c, fromR: p.r, toR: r, type: type, dist: r - p.r });
    });

    return moves;
  };

  /* --- せり上がり --- */

  /* 穴の位置をランダムに選ぶ。avoid と完全に同じ組み合わせは避ける。 */
  Board.prototype.pickHoles = function (avoid) {
    var cols = this.cols;
    var holeCount = C.RISE_HOLE_MIN +
      Math.floor(Math.random() * (C.RISE_HOLE_MAX - C.RISE_HOLE_MIN + 1));

    var holes, attempts = 0;
    do {
      var pool = [];
      for (var i = 0; i < cols; i++) pool.push(i);
      for (var j = pool.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var t = pool[j]; pool[j] = pool[k]; pool[k] = t;
      }
      holes = pool.slice(0, holeCount).sort(function (a, b) { return a - b; });
      attempts++;
    } while (attempts < 24 && avoid && sameHoles(holes, avoid));

    return holes;
  };

  /* 穴あきのせり上がり行を作る。
   *
   * 穴の位置は毎行ずらすのではなく、同じ位置を最低 RISE_SAME_HOLE_MIN 行ぶん続ける。
   * こうすることで、その列に落とし込めばせり上がった行をまとめて消せるようになる。
   * 続く行数を使い切ったら、前とは別の位置に穴を移す。
   */
  Board.prototype.makeRiseRow = function () {
    var cols = this.cols;

    if (this.holeStreak <= 0 || !this.currentHoles) {
      this.currentHoles = this.pickHoles(this.currentHoles);
      var span = C.RISE_SAME_HOLE_MAX - C.RISE_SAME_HOLE_MIN + 1;
      this.holeStreak = C.RISE_SAME_HOLE_MIN + Math.floor(Math.random() * Math.max(1, span));
    }
    this.holeStreak--;

    var holes = this.currentHoles;
    this.lastHoles = holes;

    var row = emptyRow(cols);
    for (var c = 0; c < cols; c++) row[c] = 'G';
    holes.forEach(function (h) { row[h] = null; });
    return row;
  };

  function sameHoles(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /* せり上がっても大丈夫か（最上段の可視行が空なら OK） */
  Board.prototype.canRise = function () {
    for (var c = 0; c < this.cols; c++) {
      if (this.grid[this.buffer][c]) return false;
    }
    return true;
  };

  /* 全行を 1 上へシフトし、最下段に新しい行を挿入する */
  Board.prototype.rise = function (row) {
    for (var r = 0; r < this.rows - 1; r++) this.grid[r] = this.grid[r + 1];
    this.grid[this.rows - 1] = row || this.makeRiseRow();
  };

  /* --- 補助 --- */

  /* 一番上にあるブロックの行。無ければ rows を返す。 */
  Board.prototype.topOccupiedRow = function () {
    for (var r = 0; r < this.rows; r++) {
      for (var c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) return r;
      }
    }
    return this.rows;
  };

  /* ピースを真下へ落としたときの着地 y */
  Board.prototype.dropY = function (piece) {
    var y = piece.y;
    while (!this.collides(piece.cells(piece.rot, piece.x, y + 1))) y++;
    return y;
  };

  BB.Board = Board;
  BB.emptyRow = emptyRow;

})(typeof window !== 'undefined' ? window : this);
