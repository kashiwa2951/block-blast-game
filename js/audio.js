/* ===== BLOCK RISE : audio =====
 * Web Audio API でその場で合成する効果音。外部の音声ファイルは不要です。
 * ブラウザの制約により、最初のユーザー操作のときに AudioContext を作ります。
 */
(function (global) {
  'use strict';

  var BB = global.BB = global.BB || {};
  var C = BB.Config;

  var ctx = null;
  var master = null;
  var muted = false;

  try {
    muted = global.localStorage.getItem(C.LS_MUTED) === '1';
  } catch (e) { /* localStorage が使えない環境は無視 */ }

  function ensure() {
    if (ctx) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  }

  /* 単音。freq は数値か [開始, 終了] のスライド。 */
  function tone(opts) {
    if (muted || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();

    var t0 = ctx.currentTime + (opts.delay || 0);
    var dur = opts.dur || 0.09;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = opts.type || 'square';

    var f = opts.freq;
    if (Object.prototype.toString.call(f) === '[object Array]') {
      osc.frequency.setValueAtTime(f[0], t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f[1]), t0 + dur);
    } else {
      osc.frequency.setValueAtTime(f, t0);
    }

    var vol = (opts.vol === undefined) ? 0.5 : opts.vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /* ノイズ系（着地音・消去音の芯） */
  function noise(opts) {
    if (muted || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();

    var dur = opts.dur || 0.12;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;

    var filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.setValueAtTime(opts.freq || 900, t0);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.vol === undefined ? 0.35 : opts.vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  var Sfx = {
    move:      function () { tone({ freq: 220, dur: 0.035, vol: 0.22, type: 'square' }); },
    rotate:    function () { tone({ freq: [330, 470], dur: 0.06, vol: 0.26, type: 'triangle' }); },
    lock:      function () { noise({ freq: 420, dur: 0.09, vol: 0.30 });
                             tone({ freq: [150, 90], dur: 0.09, vol: 0.24, type: 'sine' }); },
    hardDrop:  function () { noise({ freq: 700, dur: 0.13, vol: 0.40 });
                             tone({ freq: [220, 70], dur: 0.12, vol: 0.30, type: 'sawtooth' }); },
    hold:      function () { tone({ freq: [520, 700], dur: 0.09, vol: 0.26, type: 'triangle' }); },

    clear: function (lines) {
      var base = 520;
      for (var i = 0; i < Math.max(1, lines); i++) {
        tone({ freq: base * Math.pow(1.26, i), dur: 0.12, vol: 0.30, type: 'triangle', delay: i * 0.045 });
      }
      noise({ freq: 2600, dur: 0.20, vol: 0.22, filterType: 'highpass' });
    },

    /* 連鎖が進むほど高い音に */
    chain: function (n) {
      var f = 440 * Math.pow(1.18, Math.min(n, 10));
      tone({ freq: [f, f * 1.6], dur: 0.20, vol: 0.34, type: 'triangle' });
      tone({ freq: [f * 1.5, f * 2.2], dur: 0.20, vol: 0.18, type: 'sine', delay: 0.05 });
    },

    warn:      function () { tone({ freq: 300, dur: 0.07, vol: 0.28, type: 'square' });
                             tone({ freq: 300, dur: 0.07, vol: 0.28, type: 'square', delay: 0.13 }); },
    rise:      function () { noise({ freq: 320, dur: 0.28, vol: 0.32 });
                             tone({ freq: [90, 170], dur: 0.26, vol: 0.26, type: 'sawtooth' }); },
    levelUp:   function () { [523, 659, 784, 1047].forEach(function (f, i) {
                               tone({ freq: f, dur: 0.13, vol: 0.30, type: 'triangle', delay: i * 0.07 });
                             }); },
    gameOver:  function () { [440, 349, 262, 196].forEach(function (f, i) {
                               tone({ freq: f, dur: 0.26, vol: 0.32, type: 'sawtooth', delay: i * 0.14 });
                             }); },
    start:     function () { [392, 523, 659].forEach(function (f, i) {
                               tone({ freq: f, dur: 0.11, vol: 0.28, type: 'triangle', delay: i * 0.06 });
                             }); }
  };

  BB.Audio = {
    sfx: Sfx,
    play: function (name) {
      var fn = Sfx[name];
      if (typeof fn === 'function') fn.apply(null, Array.prototype.slice.call(arguments, 1));
    },
    unlock: function () { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    isMuted: function () { return muted; },
    setMuted: function (v) {
      muted = !!v;
      try { global.localStorage.setItem(C.LS_MUTED, muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    toggle: function () { return BB.Audio.setMuted(!muted); }
  };

})(typeof window !== 'undefined' ? window : this);
