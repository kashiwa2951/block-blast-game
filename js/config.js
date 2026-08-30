/* ===== BLOCK RISE : config =====
 * ゲーム全体のチューニング値。数値をいじるだけで難易度や見た目を調整できます。
 * ES module ではなくクラシックスクリプトなので、file:// から直接開いても動きます。
 */
(function (global) {
  'use strict';

  var BB = global.BB = global.BB || {};

  var COLS = 10;            // 盤面の横マス数
  var VISIBLE_ROWS = 20;    // 画面に見える縦マス数
  var BUFFER_ROWS = 2;      // 天井の上に隠してある予備行（ピース出現用）

  BB.Config = {
    /* ---- 盤面 ---- */
    COLS: COLS,
    VISIBLE_ROWS: VISIBLE_ROWS,
    BUFFER_ROWS: BUFFER_ROWS,
    TOTAL_ROWS: VISIBLE_ROWS + BUFFER_ROWS,

    /* ---- 落下速度（秒／1マス） ---- */
    GRAVITY_BASE: 0.90,     // レベル1のとき
    GRAVITY_FACTOR: 0.86,   // レベルが1上がるごとに掛ける係数
    GRAVITY_MIN: 0.05,      // 最速でもこれ以上は速くしない
    SOFT_DROP_MULT: 18,     // ソフトドロップ時の倍率
    LOCK_DELAY: 0.5,        // 接地してから固定されるまでの猶予（秒）
    LOCK_RESET_MAX: 15,     // 猶予をリセットできる回数の上限

    /* ---- 入力 ---- */
    DAS: 0.13,              // 長押ししてから連続移動が始まるまで（秒）
    ARR: 0.03,              // 連続移動の間隔（秒）

    /* ---- 演出タイミング（秒） ---- */
    CLEAR_ANIM: 0.28,       // ライン消去のフラッシュ時間
    FALL_PER_CELL: 0.045,   // 崩れ落ちるブロックの 1マスあたりの落下時間
    FALL_MIN_ANIM: 0.10,    // 落下アニメの最短時間
    SPAWN_DELAY: 0.06,      // 次のピースが出るまでの間

    /* ---- せり上がり ---- */
    RISE_BASE: 20.0,        // レベル1でのせり上がり間隔（秒）
    RISE_STEP: 1.2,         // レベルが1上がるごとに短縮する秒数
    RISE_MIN: 6.0,          // 最短間隔
    RISE_WARN: 3.0,         // 残りこの秒数から警告表示
    RISE_HOLE_MIN: 1,       // せり上がる行に空ける穴の数（最小）
    RISE_HOLE_MAX: 2,       // 同（最大）

    /* ---- レベル ---- */
    LINES_PER_LEVEL: 10,

    /* ---- スコア ---- */
    SCORE_LINES: { 1: 100, 2: 300, 3: 500, 4: 800 },
    SCORE_COMBO: 50,        // × コンボ数 × レベル
    SCORE_SOFT: 1,          // ソフトドロップ 1マスあたり
    SCORE_HARD: 2,          // ハードドロップ 1マスあたり
    CHAIN_MULT_BASE: 1.0,   // 1連鎖目の倍率
    CHAIN_MULT_STEP: 0.5,   // 連鎖が1増えるごとの加算（2連鎖=1.5, 3連鎖=2.0 ...）

    /* ---- 配色（Block Blast 風の明るいブロック） ---- */
    COLORS: {
      I: { base: '#22d3ee', light: '#a5f3fc', dark: '#0b7285' },
      O: { base: '#fbbf24', light: '#fde68a', dark: '#a45c09' },
      T: { base: '#c084fc', light: '#ecd9ff', dark: '#6d28d9' },
      S: { base: '#4ade80', light: '#c3f7d3', dark: '#14713b' },
      Z: { base: '#fb7185', light: '#ffd0d8', dark: '#b01340' },
      J: { base: '#60a5fa', light: '#c7dcff', dark: '#1b4fc4' },
      L: { base: '#fb923c', light: '#ffdcb8', dark: '#b4460d' },
      G: { base: '#64748b', light: '#9aa8bf', dark: '#2b3546' }  // せり上がりブロック
    },

    /* ---- localStorage キー ---- */
    LS_HIGHSCORE: 'blockrise.highscore',
    LS_MUTED: 'blockrise.muted'
  };

  /* レベルに応じた自然落下間隔（秒／1マス） */
  BB.Config.gravityFor = function (level) {
    var c = BB.Config;
    return Math.max(c.GRAVITY_MIN, c.GRAVITY_BASE * Math.pow(c.GRAVITY_FACTOR, level - 1));
  };

  /* レベルに応じたせり上がり間隔（秒） */
  BB.Config.riseIntervalFor = function (level) {
    var c = BB.Config;
    return Math.max(c.RISE_MIN, c.RISE_BASE - (level - 1) * c.RISE_STEP);
  };

  /* 連鎖数に応じたスコア倍率（1連鎖=1.0, 2連鎖=1.5, 3連鎖=2.0 ...） */
  BB.Config.chainMultiplier = function (chain) {
    var c = BB.Config;
    return c.CHAIN_MULT_BASE + Math.max(0, chain - 1) * c.CHAIN_MULT_STEP;
  };

})(typeof window !== 'undefined' ? window : this);
