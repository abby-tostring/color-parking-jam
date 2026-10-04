/*
 * UI CHANGE LOG - search "[UI-" in this file to jump to each change.
 *
 * [UI-1]  Proportional layout engine: X(), Y(), U(), fs() helpers + layout().
 * [UI-2]  Background: sky gradient (#8ED6FF to #CBE9FF), clouds, pastel skyline, striped emerald grass (#38C156), grass blades, daisies.
 * [UI-3]  Landing screen: big LEVEL title, gear, light card, lot preview with slanted bay, PLAY / SETTINGS / COIN SHOP.
 * [UI-4]  Game HUD: white pill bar with red pause button, LEVEL chip, coin chip, gear, sound + passenger progress panel.
 * [UI-5]  Game scenery: sidewalk, trees, glowing lamps, hydrant, roads, raised bevelled concrete curb around the lot (drawRoad).
 * [UI-6]  Cars are drawn in 3D (stacked layers, glossy glass, off-white outlined arrow, rgba(0,0,0,.35) drop shadow). See drawTopCar / gridCar.
 * [UI-7]  Boarding bay: 6 fixed-size slanted slots (4 open, 2 locked), one car per slot, sunken stalls inside a raised concrete slab.
 * [UI-8]  Boosters row: ADD SLOT / VIP PASS / SHUFFLE with icons (drawBoosters).
 * [UI-9]  Passenger queue panel with gradient header and 3D-styled mini passengers (drawQueue, drawPerson).
 * [UI-10] Driving, boarding-walk and departure paths for the slanted bay (buildDrivingPath, moveVehicle, departVehicle).
 * [UI-11] Input hit areas for the HUD, boosters and pause menu (onPointerDown).
 * [UI-12] Larger, higher-contrast text everywhere (fs() helper, resolution 2-3).
 *
 * [UI-13] Performance: cached static background, targeted redraws, capped honk effects.
 * [UI-14] Obstructed car bumps its blocker, puffs white smoke, and slides back to its cell.
 * [UI-15] Cars are shorter and wider (gridCar / slantCarSize rebalanced).
 * [UI-16] Original music restored (no clash with hooting); arrow made wider so it reads on the wider car bodies.
 *
 * DIFFICULTY CHANGE LOG - search "[DIFF-" in this file.
 * [DIFF-1..7] Progressive difficulty ramp in LevelGenerator (grid size, colours, lengths, density, wall bias, key pairs, mystery ratio).
 *
 * ADS CHANGE LOG - search "[ADS-" in this file.
 * [ADS-1..12] AdMob via RN host: fire-and-forget messages, watchdog, banner, interstitials, rewarded ads, double coins, reward interstitial.
 *
 * AUDIO CHANGE LOG - search "[AUDIO-" in this file.
 * [AUDIO-1..4] RAF music scheduler, node cleanup, master gain throttle, honk suppression during ads, deeper honk.
 */

export interface GameSettings {
  master: boolean;
  music: boolean;
  sfx: boolean;
  vehicleSounds: boolean;
  honks: boolean;
  theme: 'light' | 'dark';
}

export interface CoinProduct {
  key: string;
  coins: number;
  price: string;
  productId: string;
}

export const gameHTML: string = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#8ED6FF" />
  <title>Color Parking Jam</title>
  <style>
    * { box-sizing: border-box; }
    html, body, #game { width: 100%; height: 100%; margin: 0; overflow: hidden; position: fixed; inset: 0; }
    html, body { background: linear-gradient(180deg, #8ED6FF 0%, #CBE9FF 100%); touch-action: none; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; transition: background 0.3s ease; }
    body.dark-mode { background: #1a1a2e; }
    canvas { display: block; background: transparent; width: 100% !important; height: 100% !important; }
    #boot-screen { position: fixed; inset: 0; display: grid; place-items: center; background: linear-gradient(180deg, #8ED6FF 0%, #CBE9FF 100%); z-index: 999998; transition: opacity .28s ease; }
    .boot-card { text-align: center; color: #17345f; font-family: Inter, ui-sans-serif, sans-serif; }
    .boot-logo { width: 68px; height: 68px; margin: 0 auto 14px; border-radius: 22px; display: grid; place-items: center; color: #fff; font-weight: 900; font-size: 22px; background: linear-gradient(145deg,#ff4f72,#8b56ff); box-shadow: 0 12px 28px rgba(40,85,150,.25); }
    .boot-title { font-weight: 900; letter-spacing: 1.4px; font-size: 18px; }
    .boot-subtitle { margin-top: 7px; font-size: 12px; opacity: .68; }
    .boot-spinner { width: 24px; height: 24px; margin: 18px auto 0; border: 3px solid rgba(23,52,95,.16); border-top-color: #ff4f72; border-radius: 50%; animation: cpj-spin .8s linear infinite; }
    @keyframes cpj-spin { to { transform: rotate(360deg); } }
    #load-error { display: none; position: fixed; inset: 0; place-items: center; padding: 24px; color: #334155; text-align: center; background: #F1F5FF; z-index: 999999; font-family: Inter, ui-sans-serif, sans-serif; line-height: 1.5; }
  </style>
</head>
<body>
  <div id="game"></div>
  <div id="boot-screen">
    <div class="boot-card">
      <div class="boot-logo">CPJ</div>
      <div class="boot-title">COLOR PARKING JAM</div>
      <div class="boot-subtitle">Loading the parking lot…</div>
      <div class="boot-spinner"></div>
    </div>
  </div>
  <div id="load-error"><strong>COLOR PARKING JAM</strong><br><span id="load-error-text">The game could not load. Check your internet connection and try again.</span></div>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js" onerror="document.getElementById('boot-screen').style.display='none';document.getElementById('load-error-text').textContent='Phaser could not be loaded. Check Android internet access.';document.getElementById('load-error').style.display='grid'"></script>
  <script>
    (function () {
      'use strict';
      var bootScreen = document.getElementById('boot-screen');
      var loadError = document.getElementById('load-error');
      var loadErrorText = document.getElementById('load-error-text');
      var memoryStorage = Object.create(null);
      var safeStorage = {
        available: false,
        get: function (key) {
          try {
            var storage = window.localStorage;
            this.available = !!storage;
            return storage.getItem(key);
          } catch (error) {
            return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
          }
        },
        set: function (key, value) {
          try {
            var storage = window.localStorage;
            storage.setItem(key, String(value));
            this.available = true;
            return true;
          } catch (error) {
            memoryStorage[key] = String(value);
            return false;
          }
        },
        remove: function (key) {
          try { window.localStorage.removeItem(key); return true; }
          catch (error) { delete memoryStorage[key]; return false; }
        }
      };
      var bootFinished = false;
      var startupWatchdog = window.setTimeout(function () {
        if (!bootFinished) showLoadError('The game took too long to start. Please reopen Color Parking Jam and try again.');
      }, 12000);
      function finishBoot() {
        if (bootFinished) return;
        bootFinished = true;
        window.clearTimeout(startupWatchdog);
        if (bootScreen) {
          bootScreen.style.opacity = '0';
          window.setTimeout(function () { if (bootScreen && bootScreen.parentNode) bootScreen.parentNode.removeChild(bootScreen); }, 320);
        }
      }
      function showLoadError(message) {
        if (bootScreen) bootScreen.style.display = 'none';
        if (loadErrorText && message) loadErrorText.textContent = message;
        if (loadError) loadError.style.display = 'grid';
      }
      window.addEventListener('error', function (event) {
        if (!bootFinished && event && event.error) showLoadError('Game startup error: ' + (event.error.message || 'unknown error'));
      });
      window.addEventListener('unhandledrejection', function (event) {
        if (!bootFinished) showLoadError('Game startup error: ' + ((event && event.reason && event.reason.message) || 'unknown error'));
      });
      if (!window.Phaser) {
        showLoadError('Phaser could not be loaded. The Android WebView may not have internet access.');
        return;
      }

      // [UI-6] glossy, saturated car palette
      var PALETTE = [
        { key: 'RED', name: 'Red', hex: 0xff2a4b, css: '#ff2a4b' },
        { key: 'BLUE', name: 'Blue', hex: 0x1b75bc, css: '#1b75bc' },
        { key: 'GREEN', name: 'Green', hex: 0x00a859, css: '#00a859' },
        { key: 'YELLOW', name: 'Yellow', hex: 0xffc20e, css: '#ffc20e' },
        { key: 'PINK', name: 'Pink', hex: 0xe61380, css: '#e61380' },
        { key: 'CYAN', name: 'Cyan', hex: 0x00aeef, css: '#00aeef' },
        { key: 'ORANGE', name: 'Orange', hex: 0xf7931e, css: '#f7931e' },
        { key: 'VIOLET', name: 'Violet', hex: 0x662d91, css: '#662d91' }
      ];
      var MYSTERY_HEX = 0x6b5a9e;
      var VEHICLE_TYPES = {
        COMPACT: { length: 2, seats: 2, bayWidth: 1, bodyWidth: 0.8 },
        SEDAN: { length: 2, seats: 3, bayWidth: 1, bodyWidth: 0.84 },
        SUV: { length: 3, seats: 4, bayWidth: 1, bodyWidth: 0.88 },
        PICKUP: { length: 3, seats: 4, bayWidth: 1, bodyWidth: 0.88 },
        TRUCK: { length: 4, seats: 6, bayWidth: 1, bodyWidth: 0.9 }
      };
      // [UI-7] bay: 6 slots shown at start, 4 open and 2 locked. Every car takes exactly one slot.
      var INITIAL_BAY_SLOTS = 6;
      var INITIAL_UNLOCKED_SLOTS = 4;
      var MAX_BAY_SLOTS = 6;
      var BAY_ANGLE = 0.6;      // slanted stall angle in radians (about 34 degrees)
      var CAR_LIFT_K = 0.36;    // sideways lean of the 3D "height" direction
      // [UI-9] queue shows 11 passengers
      var MAX_VISIBLE_PASSENGERS = 11;
      var SETTINGS_STORAGE_KEY = 'color-parking-jam.settings.v1';
      var PURCHASE_STORAGE_KEY = 'color-parking-jam.purchases.v1';
      var DEFAULT_SETTINGS = { master: true, music: true, sfx: true, vehicleSounds: true, honks: true, theme: 'light' };
      var COIN_PRODUCTS = [
        { key: 'starter', coins: 500, price: '$1.00', productId: 'CONFIGURE_COIN_PACK_500' },
        { key: 'small', coins: 1200, price: '$2.00', productId: 'CONFIGURE_COIN_PACK_1200' },
        { key: 'medium', coins: 2500, price: '$4.00', productId: 'CONFIGURE_COIN_PACK_2500' },
        { key: 'large', coins: 6000, price: '$8.00', productId: 'CONFIGURE_COIN_PACK_6000' },
        { key: 'mega', coins: 15000, price: '$15.00', productId: 'CONFIGURE_COIN_PACK_15000' }
      ];

      function makeBayUnlocked() {
        var a = [];
        for (var i = 0; i < INITIAL_BAY_SLOTS; i++) a.push(i < INITIAL_UNLOCKED_SLOTS);
        return a;
      }

      function readSettings() {
        try {
          var stored = JSON.parse(safeStorage.get(SETTINGS_STORAGE_KEY) || '{}');
          return Object.assign({}, DEFAULT_SETTINGS, stored, { theme: stored.theme === 'dark' ? 'dark' : 'light' });
        } catch (error) {
          return Object.assign({}, DEFAULT_SETTINGS);
        }
      }

      function writeSettings(settings) {
        try { safeStorage.set(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch (error) {}
      }

      function readProcessedPurchases() {
        try {
          var ids = JSON.parse(safeStorage.get(PURCHASE_STORAGE_KEY) || '[]');
          return Array.isArray(ids) ? ids.filter(function (id) { return typeof id === 'string' && id.length > 0; }) : [];
        }
        catch (error) { return []; }
      }

      function writeProcessedPurchases(ids) {
        try { safeStorage.set(PURCHASE_STORAGE_KEY, JSON.stringify(ids)); } catch (error) {}
      }

      var gameSettings = readSettings();

      function sendToNative(data) {
        var message = JSON.stringify(data);
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(message);
        }
        if (window.parent && window.parent !== window) window.parent.postMessage(message, '*');
      }

      // [UI-16] music reverted to the original gentle loop; the improved hooting is kept
      function AudioSynth() {
        this.context = null;
        this.master = null;
        this.musicTimer = null;
        this.musicRaf = null; // [AUDIO-1] requestAnimationFrame-driven scheduler handle
        this.musicIndex = 0;
        this.unlocked = false;
        this.settings = gameSettings;
        // original gentle 8-note loop (no clash with the honk)
        this.musicNotes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
      }

      AudioSynth.prototype.unlock = function () {
        if (this.unlocked) return;
        var AudioContextType = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextType) return;
        try {
          this.context = new AudioContextType();
          this.master = this.context.createGain();
          this.master.gain.value = 0.24;
          this.master.connect(this.context.destination);
          this.unlocked = true;
          var resumed = this.context.resume();
          if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {});
          this.startMusic();
          this.musicIndex = 0;
        } catch (error) {
          this.context = null;
          this.master = null;
        }
      };

      AudioSynth.prototype.playTone = function (frequency, duration, waveform, volume, delay, endFrequency, category) {
        category = category || 'sfx';
        if (!this.settings.master || !this.context || !this.master) return;
        if (category === 'music' && !this.settings.music) return;
        if (category === 'vehicle' && !this.settings.vehicleSounds) return;
        if (category === 'honks' && !this.settings.honks) return;
        if (category === 'sfx' && !this.settings.sfx) return;
        var context = this.context;
        var start = context.currentTime + (delay || 0);
        var oscillator = context.createOscillator();
        var envelope = context.createGain();
        oscillator.type = waveform || 'sine';
        oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
        if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.02), start + Math.min(0.018, duration * 0.25));
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(envelope);
        envelope.connect(this.master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.015);
        // [AUDIO-2] disconnect finished nodes so they never accumulate
        oscillator.addEventListener('ended', function () {
          try { oscillator.disconnect(); } catch (e) {}
          try { envelope.disconnect(); } catch (e) {}
        });
      };

      // [AUDIO-1] drift-free music scheduler: requestAnimationFrame + AudioContext clock, notes scheduled ahead of time
      AudioSynth.prototype.startMusic = function () {
        if (this.musicRaf || !this.context) return;
        var audio = this;
        var beat = 0.56;
        var next = this.context.currentTime + 0.1;
        function tick() {
          if (!audio.context) return;
          if (audio.context.state !== 'running') { audio.musicRaf = window.requestAnimationFrame(tick); return; }
          // if the page was throttled for a while, resync instead of firing a burst of late notes
          if (next < audio.context.currentTime - 0.1) next = audio.context.currentTime + 0.05;
          while (next < audio.context.currentTime + 0.25) {
            var note = audio.musicNotes[audio.musicIndex % audio.musicNotes.length];
            var lead = Math.max(0, next - audio.context.currentTime);
            audio.playTone(note, 0.42, 'sine', 0.012, lead, undefined, 'music');
            if (audio.musicIndex % 4 === 0) audio.playTone(note / 2, 0.72, 'triangle', 0.008, lead + 0.04, undefined, 'music');
            audio.musicIndex++;
            next += beat;
          }
          audio.musicRaf = window.requestAnimationFrame(tick);
        }
        this.musicRaf = window.requestAnimationFrame(tick);
      };

      AudioSynth.prototype.tap = function () {
        this.playTone(760, 0.065, 'sine', 0.045, 0, 390);
      };

      // [AUDIO-3] master gain changes are throttled to one ramp per second so ramps never stack.
      // Inside the throttle window the final value is still applied (directly), so the audible state always matches the setting.
      AudioSynth.prototype.applyMasterGain = function (value) {
        if (!this.master || !this.context) return;
        var now = this.context.currentTime;
        if (now - (this._lastMasterGainAt || 0) >= 1.0) {
          this._lastMasterGainAt = now;
          if (this.master.gain.setTargetAtTime) this.master.gain.setTargetAtTime(value, now, 0.04);
          else this.master.gain.value = value;
        } else {
          try { this.master.gain.cancelScheduledValues(now); } catch (e) {}
          this.master.gain.value = value;
        }
      };

      AudioSynth.prototype.setMuted = function (muted) {
        this.settings.master = !muted;
        writeSettings(this.settings);
        if (this.master && this.context) {
          var value = this.settings.master ? 0.24 : 0;
          this.applyMasterGain(value); // [AUDIO-3]
        }
      };

      AudioSynth.prototype.setSetting = function (key, value) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key) || key === 'theme') return;
        this.settings[key] = !!value;
        writeSettings(this.settings);
        if (key === 'master' && this.master && this.context) {
          var gain = this.settings.master ? 0.24 : 0;
          this.applyMasterGain(gain); // [AUDIO-3]
        }
      };

      AudioSynth.prototype.board = function () {
        this.playTone(660, 0.13, 'sine', 0.045, 0);
        this.playTone(880, 0.18, 'sine', 0.038, 0.075);
        this.playTone(1174.66, 0.23, 'sine', 0.025, 0.15);
      };

      AudioSynth.prototype.footstep = function (step) {
        var frequency = step % 2 === 0 ? 190 : 235;
        this.playTone(frequency, 0.045, 'triangle', 0.018, 0, frequency * 0.72);
      };

      AudioSynth.prototype.driveOff = function () {
        this.playTone(145, 0.55, 'sawtooth', 0.045, 0, 48, 'vehicle');
        this.playTone(72, 0.42, 'triangle', 0.025, 0.03, 42, 'vehicle');
      };

      AudioSynth.prototype.win = function () {
        var notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        for (var i = 0; i < notes.length; i++) this.playTone(notes[i], 0.34, 'sine', 0.045, i * 0.13);
        this.playTone(523.25, 0.8, 'triangle', 0.022, 0.55);
        this.playTone(659.25, 0.8, 'triangle', 0.022, 0.55);
        this.playTone(783.99, 0.8, 'triangle', 0.022, 0.55);
      };

      AudioSynth.prototype.reward = function () {
        this.playTone(987.77, 0.16, 'sine', 0.04, 0);
        this.playTone(1318.51, 0.22, 'sine', 0.035, 0.09);
        this.playTone(1567.98, 0.3, 'triangle', 0.025, 0.18);
      };

      AudioSynth.prototype.reveal = function () {
        this.playTone(520, 0.12, 'triangle', 0.035, 0, 780);
        this.playTone(1040, 0.2, 'sine', 0.03, 0.08);
      };

      AudioSynth.prototype.blocked = function () {
        this.playTone(125, 0.12, 'triangle', 0.035, 0);
        this.playTone(92, 0.14, 'triangle', 0.03, 0.13);
      };

      // [AUDIO-4] deeper honk
      AudioSynth.prototype.honk = function () {
        this.playTone(196, 0.32, 'sawtooth', 0.05, 0, undefined, 'honks');
        this.playTone(247, 0.32, 'sawtooth', 0.042, 0.006, undefined, 'honks');
        this.playTone(392, 0.30, 'square', 0.016, 0.012, undefined, 'honks');
        this.playTone(160, 0.14, 'triangle', 0.022, 0.22, undefined, 'honks');
      };

      var gameAudio = new AudioSynth();
      var COIN_STORAGE_KEY = 'color-parking-jam.coins.v1';
      var REWARD_STORAGE_KEY = 'color-parking-jam.rewards.v1';
      var LEVEL_STORAGE_KEY = 'parking_jam_level';

      function readStoredCoins() {
        try {
          var stored = safeStorage.get(COIN_STORAGE_KEY);
          if (stored === null) return 200;
          var amount = Number(stored);
          return Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : 200;
        } catch (error) {
          return 200;
        }
      }

      function writeStoredCoins(amount) {
        try { safeStorage.set(COIN_STORAGE_KEY, String(amount)); } catch (error) {}
      }

      function readRewardLedger() {
        try { return JSON.parse(safeStorage.get(REWARD_STORAGE_KEY) || '{}'); }
        catch (error) { return {}; }
      }

      function writeRewardLedger(ledger) {
        try { safeStorage.set(REWARD_STORAGE_KEY, JSON.stringify(ledger)); } catch (error) {}
      }

      function getLevelReward(levelData) {
        var colors = levelData && levelData.colors ? levelData.colors.length : 0;
        var vehicleCount = levelData && levelData.vehicles ? levelData.vehicles.length : 0;
        var targetCount = levelData && levelData.targetVehicles ? levelData.targetVehicles : vehicleCount;
        if (colors >= 8 || targetCount >= 40) return 30;
        if (colors >= 6 || targetCount >= 24) return 20;
        return 10;
      }

      function SeededRandom(seed) {
        this.state = (seed >>> 0) || 1;
      }
      SeededRandom.prototype.next = function () {
        this.state = (this.state * 1664525 + 1013904223) >>> 0;
        return this.state / 4294967296;
      };
      SeededRandom.prototype.int = function (max) {
        return Math.floor(this.next() * max);
      };
      SeededRandom.prototype.pick = function (items) {
        return items[this.int(items.length)];
      };
      SeededRandom.prototype.shuffle = function (items) {
        for (var i = items.length - 1; i > 0; i--) {
          var j = this.int(i + 1);
          var swap = items[i];
          items[i] = items[j];
          items[j] = swap;
        }
        return items;
      };

      class LevelGenerator {
        constructor(gameLevel, seed) {
          this.gameLevel = Math.max(1, Math.floor(Number(gameLevel) || 1));
          this.random = new SeededRandom(seed || (Date.now() ^ (this.gameLevel * 2654435761)));
          // [DIFF-1] rows/columns ramp faster and cap higher
          this.rows = Math.min(12, 6 + Math.floor((this.gameLevel - 1) / 1.5));
          this.columns = this.rows;

          // [DIFF-2] unlock all 8 colours sooner
          this.colorCount = Math.min(PALETTE.length, 4 + Math.floor((this.gameLevel - 1) / 2));
          this.colors = PALETTE.slice(0, this.colorCount);

          // [DIFF-3] longer vehicles appear earlier
          this.lengths = this.gameLevel >= 8 ? [2, 2, 3, 3, 3, 4, 4]
                      : this.gameLevel >= 4 ? [2, 2, 3, 3, 4]
                      : [2, 2, 3];

          // [DIFF-4] tighter packing as levels climb
          var density = Math.min(0.95, 0.55 + 0.05 * (this.gameLevel - 1));
          this.targetVehicles = Math.max(6, Math.min(60, Math.round(this.rows * this.columns * density / 2.2)));

          // [DIFF-5] bias placement toward walls on higher levels
          this.wallBias = Math.min(1, 0.4 + 0.08 * this.gameLevel);

          // [DIFF-6] more locked/key pairs on higher levels
          this.keyPairCount = this.gameLevel >= 6 ? 2 : this.gameLevel >= 3 ? 1 : 0;

          // [DIFF-7] more mystery cars on higher levels
          this.mysteryRatio = Math.min(0.55, 0.25 + 0.03 * (this.gameLevel - 1));
        }

        makeVehicle(length, orientation, row, column, index, direction) {
          var type = length === 2
            ? this.random.pick(['COMPACT', 'SEDAN'])
            : length === 3 ? this.random.pick(['SUV', 'PICKUP']) : 'TRUCK';
          return {
            id: 'L' + this.gameLevel + '-V' + (index + 1) + '-' + Math.floor(this.random.next() * 1000000),
            type: type,
            orientation: orientation,
            direction: direction,
            row: row,
            column: column,
            length: length,
            visualOffsetX: 0,
            visualOffsetY: 0,
            seats: VEHICLE_TYPES[type].seats,
            bayWidth: VEHICLE_TYPES[type].bayWidth,
            capacity: 0,
            color: this.random.pick(this.colors).key,
            layer: 0,
            locked: false,
            keyVehicleId: null,
            isKeyVehicle: false,
            tunnelSpawn: false,
            mystery: false,
            firstBlockerId: null,
            nextHonkAt: 0,
            isoX: 0,
            isoY: 0,
            renderDepth: 0,
            isMoving: false,
            status: 'grid',
            bayStart: -1
          };
        }

        pathCells(orientation, direction, row, column, length) {
          var rowStep = direction === 'North' ? -1 : direction === 'South' ? 1 : 0;
          var columnStep = direction === 'West' ? -1 : direction === 'East' ? 1 : 0;
          var frontRow = row + (rowStep > 0 ? length - 1 : 0);
          var frontColumn = column + (columnStep > 0 ? length - 1 : 0);
          var r = frontRow + rowStep;
          var c = frontColumn + columnStep;
          var cells = [];
          while (r >= 0 && r < this.rows && c >= 0 && c < this.columns) {
            cells.push([r, c]);
            r += rowStep;
            c += columnStep;
          }
          return cells;
        }

        pack() {
          var rows = this.rows;
          var columns = this.columns;
          var random = this.random;
          var occupied = [];
          var forbidden = [];
          for (var r = 0; r < rows; r++) {
            occupied.push(new Array(columns).fill(false));
            forbidden.push(new Array(columns).fill(false));
          }
          var placed = [];
          var misses = 0;
          while (placed.length < this.targetVehicles && misses < 420) {
            var length = random.pick(this.lengths);
            // [DIFF-5] bias the random row/column pick toward walls as levels climb
            var rowBias = random.next() < this.wallBias;
            var columnBias = random.next() < this.wallBias;
            var row = rowBias
              ? (random.next() < 0.5 ? random.int(Math.max(1, Math.floor(rows / 3))) : rows - 1 - random.int(Math.max(1, Math.floor(rows / 3))))
              : random.int(rows);
            var column = columnBias
              ? (random.next() < 0.5 ? random.int(Math.max(1, Math.floor(columns / 3))) : columns - 1 - random.int(Math.max(1, Math.floor(columns / 3))))
              : random.int(columns);
            var patchHorizontal = ((Math.floor(row / 3) + Math.floor(column / 3)) % 2) === 0;
            var horizontal = random.next() < 0.78 ? patchHorizontal : !patchHorizontal;
            if (horizontal ? column + length > columns : row + length > rows) { misses++; continue; }
            var free = true;
            for (var k = 0; k < length && free; k++) {
              var cr = row + (horizontal ? 0 : k);
              var cc = column + (horizontal ? k : 0);
              if (occupied[cr][cc] || forbidden[cr][cc]) free = false;
            }
            if (!free) { misses++; continue; }
            var preferNear = random.next() < 0.78;
            var direction;
            if (horizontal) {
              var nearEast = (columns - (column + length)) <= column;
              direction = (nearEast === preferNear) ? 'East' : 'West';
            } else {
              var nearSouth = (rows - (row + length)) <= row;
              direction = (nearSouth === preferNear) ? 'South' : 'North';
            }
            var orientation = horizontal ? 'Horizontal' : 'Vertical';
            for (var m = 0; m < length; m++) {
              occupied[row + (horizontal ? 0 : m)][column + (horizontal ? m : 0)] = true;
            }
            var path = this.pathCells(orientation, direction, row, column, length);
            for (var p = 0; p < path.length; p++) forbidden[path[p][0]][path[p][1]] = true;
            placed.push(this.makeVehicle(length, orientation, row, column, placed.length, direction));
            misses = 0;
          }
          return placed;
        }

        generate() {
          var vehicles = null;
          var solutionOrder = null;
          for (var attempt = 0; attempt < 6 && !solutionOrder; attempt++) {
            var best = null;
            for (var tries = 0; tries < 36; tries++) {
              var layout = this.pack();
              if (!best || layout.length > best.length) best = layout;
              if (layout.length >= this.targetVehicles) break;
            }
            vehicles = best;
            solutionOrder = this.verifyAndSolve(vehicles);
          }
          if (!solutionOrder) {
            vehicles = [this.makeVehicle(2, 'Horizontal', 0, 0, 0, 'East')];
            solutionOrder = this.verifyAndSolve(vehicles);
          }

          // [DIFF-6] multiple locked/key pairs on higher levels
          for (var kp = 0; kp < this.keyPairCount && kp * 2 + 1 < solutionOrder.length; kp++) {
            var keyVehicle = solutionOrder[kp];
            var lockedIndex = Math.min(solutionOrder.length - 1, kp * 2 + 2);
            var lockedVehicle = solutionOrder[lockedIndex];
            if (keyVehicle.isKeyVehicle || lockedVehicle.locked) continue;
            keyVehicle.isKeyVehicle = true;
            lockedVehicle.locked = true;
            lockedVehicle.keyVehicleId = keyVehicle.id;
            lockedVehicle.keyColor = keyVehicle.color;
          }
          if (this.gameLevel >= 6 && solutionOrder.length > 2) {
            solutionOrder[solutionOrder.length - 1].tunnelSpawn = true;
          }

          var mysteryCount = 0;
          if (this.gameLevel >= 2) {
            // [DIFF-7] mystery ratio instead of a fixed formula
            var wanted = Math.min(Math.floor(vehicles.length * this.mysteryRatio), Math.ceil((this.gameLevel - 1) * 2));
            var candidates = solutionOrder.filter(function (v) {
              return v.firstBlockerId && !v.isKeyVehicle && !v.locked && !v.tunnelSpawn;
            });
            this.random.shuffle(candidates);
            mysteryCount = Math.min(wanted, candidates.length);
            for (var mi = 0; mi < mysteryCount; mi++) candidates[mi].mystery = true;
          }

          var queue = [];
          for (var s = 0; s < solutionOrder.length; s++) {
            var vehicle = solutionOrder[s];
            for (var seat = 0; seat < vehicle.seats; seat++) {
              queue.push({ id: 'P' + queue.length, color: vehicle.color, vip: false });
            }
          }
          return {
            level: this.gameLevel,
            rows: this.rows,
            columns: this.columns,
            targetVehicles: vehicles.length,
            mysteryCount: mysteryCount,
            vehicles: vehicles,
            solutionOrder: solutionOrder.map(function (vehicle) { return vehicle.id; }),
            passengers: queue,
            colors: this.colors
          };
        }

        verifyAndSolve(vehicles) {
          var occupancy = {};
          for (var i = 0; i < vehicles.length; i++) {
            var vehicle = vehicles[i];
            vehicle.firstBlockerId = null;
            for (var offset = 0; offset < vehicle.length; offset++) {
              var row = vehicle.row + (vehicle.orientation === 'Vertical' ? offset : 0);
              var column = vehicle.column + (vehicle.orientation === 'Horizontal' ? offset : 0);
              var key = row + ':' + column;
              if (occupancy[key]) return null;
              occupancy[key] = vehicle;
            }
          }

          var prerequisites = new Map();
          var dependents = new Map();
          for (var j = 0; j < vehicles.length; j++) {
            prerequisites.set(vehicles[j].id, new Set());
            dependents.set(vehicles[j].id, new Set());
          }
          for (var k = 0; k < vehicles.length; k++) {
            var moving = vehicles[k];
            var direction = moving.direction || (moving.orientation === 'Horizontal' ? 'East' : 'South');
            var rowStep = direction === 'North' ? -1 : direction === 'South' ? 1 : 0;
            var columnStep = direction === 'West' ? -1 : direction === 'East' ? 1 : 0;
            var frontRow = moving.row + (rowStep > 0 ? moving.length - 1 : 0);
            var frontColumn = moving.column + (columnStep > 0 ? moving.length - 1 : 0);
            var pathRow = frontRow + rowStep;
            var pathColumn = frontColumn + columnStep;
            while (pathRow >= 0 && pathRow < this.rows && pathColumn >= 0 && pathColumn < this.columns) {
              var pathBlocker = occupancy[pathRow + ':' + pathColumn];
              if (pathBlocker && pathBlocker.id !== moving.id) {
                prerequisites.get(moving.id).add(pathBlocker.id);
                if (!moving.firstBlockerId) moving.firstBlockerId = pathBlocker.id;
              }
              pathRow += rowStep;
              pathColumn += columnStep;
            }
          }
          prerequisites.forEach(function (blockedBy, vehicleId) {
            blockedBy.forEach(function (blockerId) { dependents.get(blockerId).add(vehicleId); });
          });

          var ready = [];
          prerequisites.forEach(function (blockedBy, vehicleId) {
            if (blockedBy.size === 0) ready.push(vehicleId);
          });
          var order = [];
          while (ready.length) {
            var readyIndex = this.random.int(ready.length);
            var clearId = ready.splice(readyIndex, 1)[0];
            order.push(clearId);
            dependents.get(clearId).forEach(function (vehicleId) {
              prerequisites.get(vehicleId).delete(clearId);
              if (prerequisites.get(vehicleId).size === 0) ready.push(vehicleId);
            });
          }
          if (order.length !== vehicles.length) return null;
          var byId = new Map();
          vehicles.forEach(function (vehicle) { byId.set(vehicle.id, vehicle); });
          return order.map(function (id) { return byId.get(id); });
        }
      }

      function colorFor(key) {
        for (var i = 0; i < PALETTE.length; i++) if (PALETTE[i].key === key) return PALETTE[i];
        return PALETTE[0];
      }

      function vehicleHex(vehicle) {
        return vehicle.mystery ? MYSTERY_HEX : colorFor(vehicle.color).hex;
      }

      function shade(hex, amount) {
        var r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amount));
        var g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amount));
        var b = Math.max(0, Math.min(255, (hex & 255) + amount));
        return (r << 16) | (g << 8) | b;
      }

      function lerpColor(a, b, t) {
        var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
        var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
        return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
      }

      function ParkingScene() {
        Phaser.Scene.call(this, { key: 'ParkingScene' });
      }
      ParkingScene.prototype = Object.create(Phaser.Scene.prototype);
      ParkingScene.prototype.constructor = ParkingScene;

      // [UI-1] proportional helpers: reference art is 603 x 1295 per phone panel
      ParkingScene.prototype.X = function (v) { return v * (this.width || window.innerWidth || 400) / 603; };
      ParkingScene.prototype.Y = function (v) { return v * (this.height || window.innerHeight || 800) / 1295; };
      ParkingScene.prototype.U = function () {
        return Math.min((this.width || window.innerWidth || 400) / 603, (this.height || window.innerHeight || 800) / 1295);
      };
      // [UI-12] font size helper with a readable minimum
      ParkingScene.prototype.fs = function (base, min) {
        return Math.max(min || 9, Math.round(base * this.U() * 1.12)) + 'px';
      };
      ParkingScene.prototype.textRes = function () {
        return Math.min(3, Math.max(2, window.devicePixelRatio || 2));
      };

      ParkingScene.prototype.create = function () {
        var scene = this;
        this.level = parseInt(safeStorage.get(LEVEL_STORAGE_KEY)) || 1;
        this.coins = readStoredCoins();
        this.rewardedLevels = readRewardLedger();
        this.processedPurchaseIds = new Set(readProcessedPurchases());
        this.levelReward = 0;
        this.screen = 'LANDING';
        this.returnScreen = 'LANDING';
        this.settings = gameSettings;
        this.theme = gameSettings.theme;
        this.purchaseNotice = '';
        this.moves = 0;
        this.safeTop = 34;
        this.hudButtons = {};
        this._adStatusText = null;

        // [ADS-3] ad state. Every default makes the game behave exactly as it did before ads existed.
        this._bannerVisible = false;
        this._adInFlight = false;
        this._adRequestedAt = 0;
        this._adQueue = [];
        this._pendingRewardKind = null;
        this._pendingRewardContext = null;
        this._awaitingRewardInterstitial = false;
        this._interstitialTimes = [];
        this._interstitialWindowMs = 200000;
        this._interstitialMaxPerWindow = 3;
        this._lastInterstitialAt = 0;
        this._interstitialMinGapMs = 45000;
        this._winBaseReward = 0;
        this._suppressStartAd = false; // set while exiting to the landing screen so no start ad is requested there

        this.layout();

        // [UI-7] bay starts with 6 slots: 4 open, 2 locked
        this.baySlotCount = INITIAL_BAY_SLOTS;
        this.unlockedBaySlots = INITIAL_UNLOCKED_SLOTS;
        this.bayUnlocked = makeBayUnlocked();
        this.pendingUnlockSlot = -1;
        this.pendingFailureRecovery = false;
        this.bayMachines = [];
        for (var slotIndex = 0; slotIndex < this.baySlotCount; slotIndex++) {
          this.bayMachines.push({
            slot: slotIndex,
            state: this.bayUnlocked[slotIndex] ? 'idle' : 'locked',
            vehicle: null,
            anchor: slotIndex
          });
        }
        this.paused = false;
        this.terminal = null;
        this.passengers = [];
        this.vehicles = [];
        this.bay = [];
        this.vehicleGraphics = [];
        this.labels = [];
        this.graphics = null;
        this.landingPreview = null;
        this.landingPreviewBaseY = 0;
        this.bgGraphics = this.add.graphics().setDepth(-30);
        this.bgStaticGraphics = this.add.graphics().setDepth(-31); // [UI-13] cached static scenery
        this.backgroundBubblesGraphics = this.add.graphics().setDepth(-20);
        this.bubbles = [];
        this.createScenery();
        this.idleGraphics = this.add.graphics().setDepth(6);
        this.honkGraphics = this.add.graphics().setDepth(8);
        this.honkEffects = [];
        this.fx = this.add.graphics();
        this.applyTheme(this.theme);
        this.loadLevel(this.level);
        this.input.on('pointerdown', function (pointer) { scene.onPointerDown(pointer); });
        this.scale.on('resize', function () {
          scene.layout();
          scene.render();
        });
        window.addEventListener('message', function (event) { scene.handleNativeMessage(event.data); });
        document.addEventListener('message', function (event) { scene.handleNativeMessage(event.data); });

        // [ADS-4] watchdog: clear _adInFlight if the host never responds, so gameplay cannot be blocked
        this.time.addEvent({
          delay: 1000,
          loop: true,
          callback: function () {
            if (!scene._adInFlight) {
              // nothing in flight: drain anything still queued, and never leave NEXT LEVEL locked without an ad pending
              if (scene._adQueue.length) scene.flushAdQueue();
              else if (scene._awaitingRewardInterstitial) scene._awaitingRewardInterstitial = false;
              return;
            }
            var now = Date.now();
            if (!scene._adRequestedAt) { scene._adRequestedAt = now; return; }
            if (now - scene._adRequestedAt > 15000) {
              scene._adInFlight = false;
              scene._adRequestedAt = 0;
              scene._awaitingRewardInterstitial = false;
              scene.showAdStatus('Ad skipped — continuing.');
              scene.time.delayedCall(1200, function () { scene.hideAdStatus(); });
              scene.flushAdQueue();
            }
          }
        });

        finishBoot();
      };

      ParkingScene.prototype.createScenery = function () {
        this.buildings = [
          { h: 122, d: 18, c: 0, seed: 2 },
          { h: 166, d: 26, c: 1, seed: 5 },
          { h: 108, d: 20, c: 2, seed: 8 },
          { h: 184, d: 30, c: 3, seed: 11 },
          { h: 138, d: 22, c: 0, seed: 14 },
          { h: 172, d: 28, c: 2, seed: 17 },
          { h: 116, d: 18, c: 1, seed: 20 },
          { h: 154, d: 24, c: 3, seed: 23 }
        ];
      };

      ParkingScene.prototype.isLandingContext = function () {
        return this.screen === 'LANDING' ||
          ((this.screen === 'SETTINGS' || this.screen === 'SHOP') && this.returnScreen === 'LANDING');
      };

      ParkingScene.prototype.clearDeadlockTimer = function () {
        if (this.deadlockTimerEvent) {
          this.deadlockTimerEvent.remove(false);
          this.deadlockTimerEvent = null;
        }
      };

      ParkingScene.prototype.loadLevel = function (level) {
        // [ADS-3] reset transient ad state on every level load so a dropped response cannot lock the game
        this._adInFlight = false;
        this._adRequestedAt = 0;
        this._pendingRewardKind = null;
        this._pendingRewardContext = null;
        this._awaitingRewardInterstitial = false;

        this.clearDeadlockTimer();
        this.level = Math.max(1, Math.floor(Number(level) || 1));
        safeStorage.set(LEVEL_STORAGE_KEY, this.level);
        var generator = new LevelGenerator(this.level);
        this.puzzle = generator.generate();
        this.rows = this.puzzle.rows;
        this.columns = this.puzzle.columns;
        this.vehicles = this.puzzle.vehicles;
        this.selectedVehicleId = null;
        (this.honkEffects || []).forEach(function (honk) {
          if (honk.label && honk.label.active) honk.label.destroy();
        });
        this.honkEffects = [];
        var gameTime = this.time.now;
        this.vehicles.forEach(function (vehicle) {
          vehicle.nextHonkAt = gameTime + 3200 + Math.random() * 6200;
        });
        var tunnelVehicles = [];
        this.vehicles.forEach(function (vehicle) {
          if (vehicle.tunnelSpawn) {
            vehicle.status = 'hidden';
            tunnelVehicles.push(vehicle);
          }
        });
        this.passengers = this.puzzle.passengers;
        this.levelVehicleTotal = this.vehicles.length;
        this.levelPassengerTotal = this.passengers.length;

        // [UI-7] reset bay: 6 slots, 4 open, 2 locked
        this.baySlotCount = INITIAL_BAY_SLOTS;
        this.unlockedBaySlots = INITIAL_UNLOCKED_SLOTS;
        this.bayUnlocked = makeBayUnlocked();
        this.bay = new Array(this.baySlotCount).fill(null);
        this.bayMachines = [];
        this.bayUnlocked.forEach(function (unlocked, slotIndex) {
          this.bayMachines.push({
            slot: slotIndex,
            state: unlocked ? 'idle' : 'locked',
            vehicle: null,
            anchor: slotIndex
          });
        }, this);

        this.moves = 0;
        this.levelReward = 0;
        this.paused = false;
        this.terminal = null;
        this.layout();
        this.render();
        this.publishState();
        var scene = this;
        tunnelVehicles.forEach(function (vehicle, index) {
          scene.time.delayedCall(650 + index * 450, function () { scene.spawnTunnelVehicle(vehicle); });
        });

        // [ADS-6] level-start interstitial. Runs after the new level is built (so this.level is the new level).
        // Skipped while exiting to the landing screen (_suppressStartAd) and never fires unless the game screen is active.
        if (this.screen === 'GAME' && this.terminal !== 'WIN' && !this._suppressStartAd) {
          this.requestInterstitial('LEVEL_START');
        }
      };

      // [UI-1] layout from reference coordinates
      ParkingScene.prototype.layout = function () {
        var width = (this.scale && this.scale.width) || (this.scale && this.scale.game && this.scale.game.config && Number(this.scale.game.config.width)) || window.innerWidth || 400;
        var height = (this.scale && this.scale.height) || (this.scale && this.scale.game && this.scale.game.config && Number(this.scale.game.config.height)) || window.innerHeight || 800;
        if (!width || width < 100) width = window.innerWidth || 400;
        if (!height || height < 100) height = window.innerHeight || 800;
        this.width = width;
        this.height = height;
        this.u = this.U();
        this.safeTop = Math.max(this.Y(26), 28);
        var rows = this.rows || 6;
        var cols = this.columns || 6;

        // parking lot rectangle
        this.lotL = this.X(14);
        this.lotR = this.X(588);
        this.lotT = this.Y(418);
        this.lotB = this.Y(885);
        this.laneX = this.X(395);
        var rx0 = this.lotL + this.X(10);
        var rx1 = this.laneX - this.X(10);
        this.cell = Math.max(10, Math.min((rx1 - rx0) / (cols + 1.2), (this.lotB - this.lotT - this.Y(24)) / (rows + 1.2)));
        this.tileWidth = this.cell;
        this.tileHeight = this.cell;
        this.cellSpacingX = this.cell;
        this.cellSpacingY = this.cell;
        this.gridLeft = rx0 + ((rx1 - rx0) - this.cell * cols) / 2;
        this.gridTop = this.lotT + ((this.lotB - this.lotT) - this.cell * rows) / 2;
        this.gridRight = this.gridLeft + this.cell * cols;
        this.gridBottom = this.gridTop + this.cell * rows;

        // [UI-7] slanted boarding bay on the right
        this.bayL = this.X(406);
        this.bayR = this.X(511);
        this.bayTop = this.Y(440);
        this.slotWidth = this.bayR - this.bayL;
        this.bayCenterX = (this.bayL + this.bayR) / 2;
        // pitch is always computed for 6 slots, so cars never change size when slots unlock
        var geomSlots = Math.max(MAX_BAY_SLOTS, this.baySlotCount || INITIAL_BAY_SLOTS);
        this.bayGeom = this.slantGeom(this.bayL, this.bayTop, this.slotWidth, this.Y(862) - this.bayTop, geomSlots);
        this.slotGap = 0;
        this.slotHeight = this.bayGeom.pitch;

        // bands
        this.roadY = this.Y(944);
        this.topRoadY = this.Y(383);
        this.boosterTop = this.Y(998);
        this.boosterH = this.Y(97);
        this.queueTop = this.Y(1120);
        this.queueH = this.Y(110);
        this.queueY = this.Y(1192);
      };

      ParkingScene.prototype.drawBush = function (g, x, y, r, dark) {
        var c1 = dark ? 0x1d5a35 : 0x2f9e44;
        var c2 = dark ? 0x266b3f : 0x45b957;
        var c3 = dark ? 0x2f7d4a : 0x72d86c;
        g.fillStyle(0x0b3a1a, 0.18);
        g.fillEllipse(x + r * 0.1, y + r * 0.55, r * 2.4, r * 0.7);
        g.fillStyle(c1, 1);
        g.fillCircle(x - r * 0.7, y, r * 0.75);
        g.fillCircle(x + r * 0.7, y, r * 0.75);
        g.fillCircle(x, y - r * 0.35, r * 0.95);
        g.fillStyle(c2, 1);
        g.fillCircle(x - r * 0.45, y - r * 0.2, r * 0.6);
        g.fillCircle(x + r * 0.5, y - r * 0.1, r * 0.55);
        g.fillStyle(c3, 0.9);
        g.fillCircle(x - r * 0.15, y - r * 0.6, r * 0.35);
      };

      ParkingScene.prototype.drawTree = function (g, x, baseY, r, dark) {
        g.fillStyle(0x0b3a1a, 0.2);
        g.fillEllipse(x, baseY + 2, r * 1.5, r * 0.4);
        g.fillStyle(0x7a4e2d, 1);
        g.fillRect(x - r * 0.09, baseY - r * 0.9, r * 0.18, r * 0.9);
        var cy = baseY - r * 1.25;
        g.fillStyle(dark ? 0x1d5a35 : 0x2a8a3a, 1);
        g.fillCircle(x - r * 0.55, cy + r * 0.2, r * 0.62);
        g.fillCircle(x + r * 0.55, cy + r * 0.2, r * 0.62);
        g.fillCircle(x, cy - r * 0.15, r * 0.82);
        g.fillStyle(dark ? 0x266b3f : 0x3fae4b, 1);
        g.fillCircle(x - r * 0.3, cy, r * 0.55);
        g.fillCircle(x + r * 0.35, cy - r * 0.1, r * 0.5);
        g.fillStyle(dark ? 0x2f7d4a : 0x6ccb62, 0.9);
        g.fillCircle(x - r * 0.15, cy - r * 0.4, r * 0.3);
      };

      ParkingScene.prototype.drawDaisy = function (g, x, y, s, time, phase) {
        var bob = Math.sin(time / 420 + phase) * 1.2;
        g.fillStyle(0xffffff, 1);
        for (var p = 0; p < 5; p++) {
          var a = p * Math.PI * 2 / 5;
          g.fillCircle(x + Math.cos(a) * s * 0.6, y + bob + Math.sin(a) * s * 0.6, s * 0.5);
        }
        g.fillStyle(0xffd23f, 1);
        g.fillCircle(x, y + bob, s * 0.45);
      };

      ParkingScene.prototype.drawGear = function (g, x, y, r, color, hole) {
        g.lineStyle(Math.max(2, r * 0.34), color, 1);
        for (var i = 0; i < 8; i++) {
          var a = i * Math.PI / 4;
          g.lineBetween(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.fillStyle(color, 1);
        g.fillCircle(x, y, r * 0.72);
        g.fillStyle(hole, 1);
        g.fillCircle(x, y, r * 0.3);
      };

      ParkingScene.prototype.drawSpeaker = function (g, cx, cy, s, color, muted) {
        g.fillStyle(color, 1);
        g.fillRect(cx - s * 0.8, cy - s * 0.3, s * 0.45, s * 0.6);
        g.fillTriangle(cx - s * 0.35, cy - s * 0.3, cx - s * 0.35, cy + s * 0.3, cx + s * 0.25, cy + s * 0.75);
        g.fillTriangle(cx - s * 0.35, cy - s * 0.3, cx + s * 0.25, cy - s * 0.75, cx + s * 0.25, cy + s * 0.75);
        g.lineStyle(Math.max(1.6, s * 0.17), color, 1);
        if (muted) {
          g.lineBetween(cx + s * 0.5, cy - s * 0.4, cx + s * 1.05, cy + s * 0.4);
          g.lineBetween(cx + s * 0.5, cy + s * 0.4, cx + s * 1.05, cy - s * 0.4);
        } else {
          g.beginPath(); g.arc(cx + s * 0.25, cy, s * 0.62, -0.85, 0.85, false); g.strokePath();
          g.beginPath(); g.arc(cx + s * 0.25, cy, s * 1.0, -0.85, 0.85, false); g.strokePath();
        }
      };

      ParkingScene.prototype.drawArrowLine = function (g, x0, y0, x1, y1, head, color, width, alpha) {
        var ang = Math.atan2(y1 - y0, x1 - x0);
        g.lineStyle(width, color, alpha === undefined ? 1 : alpha);
        g.lineBetween(x0, y0, x1, y1);
        g.lineBetween(x1, y1, x1 - head * Math.cos(ang - 0.5), y1 - head * Math.sin(ang - 0.5));
        g.lineBetween(x1, y1, x1 - head * Math.cos(ang + 0.5), y1 - head * Math.sin(ang + 0.5));
      };

      // [UI-9] vertical gradient built from bands (works on Canvas and WebGL)
      ParkingScene.prototype.vGradient = function (g, x, y, w, h, c1, c2, steps, alpha) {
        var n = Math.max(2, steps || 8);
        var bh = h / n;
        for (var i = 0; i < n; i++) {
          g.fillStyle(lerpColor(c1, c2, i / (n - 1)), alpha === undefined ? 1 : alpha);
          g.fillRect(x, y + i * bh, w, bh + 1);
        }
      };

      // [UI-2][UI-13] static sky, skyline, grass, blades — drawn once into bgStaticGraphics
      ParkingScene.prototype.drawStaticBackground = function () {
        var g = this.bgStaticGraphics;
        if (!g) return;
        g.clear();
        var W = this.width || window.innerWidth || 400;
        var H = this.height || window.innerHeight || 800;
        var u = this.u || 0.6;
        var dark = this.theme === 'dark';
        var landing = this.isLandingContext();
        var base = landing ? H * 0.33 : this.Y(296);
        var skyTop = dark ? 0x071326 : 0x8ed6ff;
        var skyBottom = dark ? 0x20365c : 0xcbe9ff;
        var bands = 18;
        var bandH = Math.ceil(base / bands);
        for (var b = 0; b < bands; b++) {
          g.fillStyle(lerpColor(skyTop, skyBottom, b / (bands - 1)), 1);
          g.fillRect(0, b * bandH, W, bandH + 1);
        }

        // skyline
        var count = this.buildings.length;
        var bw = W / count;
        var palette = dark ? [0x1d3150, 0x263e64, 0x19304c, 0x304a72] : [0x7c9bd6, 0x6a8ac4, 0x93aee0, 0x8294b8];
        var k = (landing ? 0.95 : 0.66) * H / 800;
        for (var i = 0; i < count; i++) {
          var building = this.buildings[i];
          var bx = i * bw - 3;
          var bwidth = bw + 7;
          var bheight = building.h * k;
          var btop = Math.max(6, base - bheight);
          bheight = base - btop;
          var depth = building.d * k * 0.8;
          var bcolor = palette[building.c];
          var sideColor = shade(bcolor, dark ? -26 : -38);
          var roofColor = dark ? shade(bcolor, 24) : shade(bcolor, 40);

          g.fillStyle(sideColor, 1);
          g.fillPoints([
            { x: bx + bwidth, y: btop + depth * 0.55 },
            { x: bx + bwidth + depth, y: btop },
            { x: bx + bwidth + depth, y: base - depth * 0.25 },
            { x: bx + bwidth, y: base }
          ], true);
          g.fillStyle(bcolor, 1);
          g.fillRect(bx, btop + depth * 0.55, bwidth, bheight - depth * 0.55);
          g.fillStyle(0xffffff, dark ? 0.04 : 0.16);
          g.fillRect(bx, btop + depth * 0.55, Math.max(2, bwidth * 0.12), bheight - depth * 0.55);
          g.fillStyle(roofColor, 1);
          g.fillPoints([
            { x: bx, y: btop + depth * 0.55 },
            { x: bx + bwidth, y: btop + depth * 0.55 },
            { x: bx + bwidth + depth, y: btop },
            { x: bx + depth, y: btop }
          ], true);

          var cols = Math.max(2, Math.floor((bwidth - 14) / 16));
          var rowsW = Math.max(2, Math.floor((bheight - 28) / 20));
          var spacing = (bwidth - 14) / cols;
          for (var wr = 0; wr < rowsW; wr++) {
            for (var wc = 0; wc < cols; wc++) {
              var lit = ((building.seed + wc * 3 + wr * 5) % 4) !== 0;
              var wx = bx + 7 + wc * spacing;
              var wy = btop + depth * 0.55 + 10 + wr * 20;
              g.fillStyle(lit ? (dark ? 0xffd98a : 0xffe9a8) : (dark ? shade(bcolor, -20) : 0xd6ecff), lit ? 0.98 : 0.8);
              g.fillRoundedRect(wx, wy, Math.min(9, spacing - 5), 10, 2);
            }
          }
        }

        // striped emerald grass
        var grassTop = base;
        g.fillStyle(dark ? 0x1d633d : 0x38c156, 1);
        g.fillRect(0, grassTop, W, Math.max(0, H - grassTop));
        var stripe = Math.max(18, 30 * u);
        g.fillStyle(dark ? 0x194f34 : 0x30b24d, 0.8);
        for (var s = 0; grassTop + s * stripe < H; s += 2) {
          g.fillRect(0, grassTop + s * stripe, W, stripe);
        }

        // grass blades (deterministic scatter)
        var bladeColor = dark ? 0x2a8050 : 0x62d878;
        var bladeShade = dark ? 0x174a30 : 0x2a9f45;
        var span = Math.max(1, H - grassTop);
        for (var gb = 0; gb < 90; gb++) {
          var gx = ((gb * 97) % 101) / 101 * W;
          var gy = grassTop + 8 + (((gb * 53) % 89) / 89) * (span - 10);
          var gh = (6 + (gb % 5) * 2) * Math.max(0.7, u * 1.4);
          var gw = Math.max(1.5, gh * 0.22);
          g.fillStyle(gb % 2 ? bladeColor : bladeShade, 0.85);
          g.fillTriangle(gx - gw, gy, gx + gw, gy, gx + (gb % 3 - 1) * gw, gy - gh);
          g.fillTriangle(gx + gw * 1.6, gy, gx + gw * 3.4, gy, gx + gw * 2.5, gy - gh * 0.75);
        }

        // corner bushes
        this.drawBush(g, this.X(18), H - 38 * u, 36 * u, dark);
        this.drawBush(g, this.X(585), H - 34 * u, 40 * u, dark);
        if (landing) {
          this.drawBush(g, this.X(6), this.Y(540), 22 * u, dark);
        }
      };

      // [UI-2][UI-13] animated background: sun pulse, clouds, daisies only
      ParkingScene.prototype.drawBackground = function (time) {
        var g = this.bgGraphics;
        if (!g) return;
        g.clear();
        var W = this.width || window.innerWidth || 400;
        var H = this.height || window.innerHeight || 800;
        var u = this.u || 0.6;
        var dark = this.theme === 'dark';
        var landing = this.isLandingContext();
        var base = landing ? H * 0.33 : this.Y(296);

        var sunX = W * 0.78 + Math.sin(time / 4200) * 8;
        var sunY = Math.max(70, base * 0.25);
        g.fillStyle(dark ? 0x8aa9d8 : 0xfff2b0, 0.14);
        g.fillCircle(sunX, sunY, Math.min(W, H) * 0.19);
        g.fillStyle(dark ? 0xcbd9ff : 0xfff7ce, 0.26);
        g.fillCircle(sunX, sunY, Math.min(W, H) * 0.095);

        // soft fluffy clouds
        if (!dark) {
          var cloudBase = landing ? [[70, 70, 1.5], [150, 175, 1.0], [520, 55, 1.2], [575, 120, 0.9]] : [[90, 40, 1.0], [470, 30, 1.1]];
          for (var cl = 0; cl < cloudBase.length; cl++) {
            var cb = cloudBase[cl];
            var cloudX = this.X(cb[0]) + Math.sin(time / (2600 + cl * 700) + cl) * 10;
            var cloudY = this.Y(cb[1] * 1.0);
            var cs = cb[2] * u * 1.3;
            g.fillStyle(0xb7d9f2, 0.55);
            g.fillEllipse(cloudX, cloudY + 12 * cs, 130 * cs, 26 * cs);
            g.fillStyle(0xffffff, 0.95);
            g.fillEllipse(cloudX, cloudY, 120 * cs, 38 * cs);
            g.fillEllipse(cloudX - 34 * cs, cloudY + 6 * cs, 70 * cs, 30 * cs);
            g.fillEllipse(cloudX + 36 * cs, cloudY + 5 * cs, 78 * cs, 32 * cs);
            g.fillEllipse(cloudX - 8 * cs, cloudY - 14 * cs, 62 * cs, 34 * cs);
            g.fillEllipse(cloudX + 22 * cs, cloudY - 10 * cs, 48 * cs, 28 * cs);
          }
        }

        // daisies (animated)
        this.drawDaisy(g, this.X(62), H - 22 * u, 7 * u, time, 0.4);
        this.drawDaisy(g, this.X(100), H - 52 * u, 6 * u, time, 1.7);
        this.drawDaisy(g, this.X(520), H - 28 * u, 7 * u, time, 2.4);
        this.drawDaisy(g, this.X(556), H - 62 * u, 6 * u, time, 3.1);
        if (landing) {
          this.drawDaisy(g, this.X(24), this.Y(552), 6 * u, time, 0.9);
          this.drawDaisy(g, this.X(300), this.Y(900), 5 * u, time, 1.2);
          this.drawDaisy(g, this.X(580), this.Y(960), 5 * u, time, 2.8);
        }
      };

      ParkingScene.prototype.update = function (time, delta) {
        if (!this.backgroundBubblesGraphics || !this.bubbles) return;
        // [UI-13] only rebuild static scenery when needed (theme/layout change)
        if (this._staticBgDirty !== false) {
          this.drawStaticBackground();
          this._staticBgDirty = false;
        }
        this.drawBackground(time);
        this.backgroundBubblesGraphics.clear();

        if (this.idleGraphics) {
          this.idleGraphics.clear();
          if (this.screen === 'GAME' && !this.paused && !this.terminal) {
            var visiblePassengers = Math.min(MAX_VISIBLE_PASSENGERS, this.passengers.length);
            var ps = this.personScale();
            for (var passengerIndex = 0; passengerIndex < visiblePassengers; passengerIndex++) {
              var passenger = this.passengers[passengerIndex];
              var point = this.queuePoint(passengerIndex);
              var idlePhase = time / 175 + passengerIndex * 1.61;
              var bounce = (1 - Math.cos(idlePhase * 2)) * 0.55;
              this.drawPerson(this.idleGraphics, point.x, point.y + 9 * (ps / 1.25) - bounce, passenger.color, ps + bounce * 0.012, false, Math.sin(idlePhase));
              if (passenger.vip) {
                this.idleGraphics.fillStyle(0xf0b83d, 1);
                this.idleGraphics.fillCircle(point.x + 8 * ps, point.y - 16 * ps - bounce, 5);
                this.idleGraphics.fillStyle(0xffffff, 1);
                this.idleGraphics.fillTriangle(point.x + 8 * ps, point.y - 20 * ps - bounce, point.x + 6 * ps, point.y - 14 * ps - bounce, point.x + 10 * ps, point.y - 14 * ps - bounce);
              }
            }
          }
        }

        if (!this.honkGraphics) return;
        this.honkGraphics.clear();
        // [AUDIO-4] no new honks while an ad request is in flight (existing cap of 3 active honks is kept)
        if (this.screen === 'GAME' && !this.paused && !this.terminal && !this._adInFlight) {
          for (var vehicleIndex = 0; vehicleIndex < this.vehicles.length; vehicleIndex++) {
            var vehicle = this.vehicles[vehicleIndex];
            if (vehicle.status !== 'grid' || time < vehicle.nextHonkAt) continue;
            var trapped = vehicle.locked || !this.pathIsClear(vehicle);
            vehicle.nextHonkAt = time + (trapped ? 6000 : 2200) + Math.random() * (trapped ? 6500 : 2400);
            if (trapped && this.honkEffects.length < 3) this.emitVehicleHonk(vehicle, time);
          }
        }
        var activeHonks = [];
        for (var honkIndex = 0; honkIndex < this.honkEffects.length; honkIndex++) {
          var honk = this.honkEffects[honkIndex];
          var age = (time - honk.startedAt) / honk.duration;
          if (age >= 1 || !honk.vehicle || honk.vehicle.status !== 'grid') {
            if (honk.label && honk.label.active) honk.label.destroy();
            continue;
          }
          var hornCenter = this.gridCenter(honk.vehicle);
          hornCenter.y -= this.cell * 0.62;
          var radius = this.cell * (0.34 + age * 0.7);
          this.honkGraphics.lineStyle(1.6, 0xffffff, 0.8 * (1 - age));
          this.honkGraphics.strokeEllipse(hornCenter.x, hornCenter.y, radius * 2, radius * 0.92);
          this.honkGraphics.lineStyle(1.2, vehicleHex(honk.vehicle), 0.7 * (1 - age));
          this.honkGraphics.strokeEllipse(hornCenter.x, hornCenter.y, radius * 1.45, radius * 0.65);
          if (honk.label && honk.label.active) {
            honk.label.setPosition(hornCenter.x, hornCenter.y - 10 - age * 13);
            honk.label.setAlpha(1 - age);
          }
          activeHonks.push(honk);
        }
        this.honkEffects = activeHonks;
      };

      ParkingScene.prototype.emitVehicleHonk = function (vehicle, time) {
        gameAudio.honk();
        var center = this.gridCenter(vehicle);
        center.y -= this.cell * 0.62;
        var label = this.add.text(center.x, center.y - 10, 'BEEP!', {
          fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
          color: '#5a3a52', backgroundColor: '#fff9fc', padding: { x: 4, y: 2 },
          stroke: '#ffffff', strokeThickness: 1
        }).setOrigin(0.5).setDepth(12);
        this.honkEffects.push({ vehicle: vehicle, startedAt: time, duration: 1100, label: label });
      };

      // orthogonal grid projection
      ParkingScene.prototype.project = function (column, row) {
        return { x: this.gridLeft + column * this.cell, y: this.gridTop + row * this.cell };
      };

      ParkingScene.prototype.gridCenter = function (vehicle) {
        return this.project(
          vehicle.column + (vehicle.orientation === 'Horizontal' ? vehicle.length / 2 : 0.5),
          vehicle.row + (vehicle.orientation === 'Vertical' ? vehicle.length / 2 : 0.5)
        );
      };

      // [UI-7] slanted bay geometry. Pitch is fixed for 6 slots, so cars never resize.
      ParkingScene.prototype.slantGeom = function (left, top, width, height, slots) {
        var drop = width * Math.tan(BAY_ANGLE);
        return { left: left, top: top, width: width, drop: drop, slots: slots, pitch: (height - drop) / slots };
      };
      ParkingScene.prototype.slantCenter = function (geom, i) {
        return { x: geom.left + geom.width / 2, y: geom.top + i * geom.pitch + geom.drop / 2 + geom.pitch / 2 };
      };
      // [UI-15] shorter, wider cars in the bay
      ParkingScene.prototype.slantCarSize = function (geom) {
        var c = Math.cos(BAY_ANGLE);
        return { L: geom.width / c * 0.62, W: geom.pitch * c * 0.78 };
      };
      ParkingScene.prototype.bayCenter = function (start) { return this.slantCenter(this.bayGeom, start); };
      ParkingScene.prototype.bayCarSize = function () { return this.slantCarSize(this.bayGeom); };

      // [UI-15] footprint of a car on the grid — shorter, wider
      ParkingScene.prototype.gridCar = function (vehicle) {
        var c = this.cell;
        return { L: c * (vehicle.length - 0.65), W: c * 0.82, ox: c * 0.05, oy: c * 0.12 };
      };

      ParkingScene.prototype.carWidth = function (vehicle) {
        var model = VEHICLE_TYPES[vehicle.type] || VEHICLE_TYPES.COMPACT;
        return this.cell * Math.min(0.78, model.bodyWidth * 0.9);
      };

      ParkingScene.prototype.drawPolygon = function (graphics, points, fill, alpha, stroke, strokeWidth) {
        graphics.fillStyle(fill, alpha === undefined ? 1 : alpha);
        graphics.fillPoints(points, true);
        if (stroke !== undefined) {
          graphics.lineStyle(strokeWidth || 1, stroke, 0.9);
          graphics.strokePoints(points, true);
        }
      };

      ParkingScene.prototype.drawRoundedPolygon = function (graphics, points, fill, alpha, stroke, radius, strokeWidth) {
        var r = radius === undefined ? 3 : radius;
        var rounded = [];
        for (var i = 0; i < points.length; i++) {
          var previous = points[(i + points.length - 1) % points.length];
          var current = points[i];
          var next = points[(i + 1) % points.length];
          var dp = Math.sqrt(Math.pow(previous.x - current.x, 2) + Math.pow(previous.y - current.y, 2)) || 1;
          var dn = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2)) || 1;
          var rp = Math.min(r, dp * 0.5) / dp;
          var rn = Math.min(r, dn * 0.5) / dn;
          var start = { x: current.x + (previous.x - current.x) * rp, y: current.y + (previous.y - current.y) * rp };
          var end = { x: current.x + (next.x - current.x) * rn, y: current.y + (next.y - current.y) * rn };
          for (var step = 0; step <= 4; step++) {
            var t = step / 4;
            var inverse = 1 - t;
            rounded.push({
              x: inverse * inverse * start.x + 2 * inverse * t * current.x + t * t * end.x,
              y: inverse * inverse * start.y + 2 * inverse * t * current.y + t * t * end.y
            });
          }
        }
        this.drawPolygon(graphics, rounded, fill, alpha, stroke, strokeWidth);
      };

      // [UI-6] glossy 3D car.
      ParkingScene.prototype.drawTopCar = function (g, vehicle, cx, cy, length, width, heading, arrowAlpha) {
        var self = this;
        var ca = Math.cos(heading), sa = Math.sin(heading);
        var hl = length / 2, hw = width / 2;
        var K = CAR_LIFT_K;
        var Ht = width * 0.47;
        var Hb = Ht * 0.5;
        var color = vehicleHex(vehicle);
        var rad = Math.max(2, width * 0.22);
        var P = function (a, b, h) { return { x: cx + a * ca - b * sa - h * K, y: cy + a * sa + b * ca - h }; };
        var R = function (a0, a1, b0, b1, h) { return [P(a0, b0, h), P(a1, b0, h), P(a1, b1, h), P(a0, b1, h)]; };
        var layer = function (a0, a1, b0, b1, h, fill, alpha, r) {
          self.drawRoundedPolygon(g, R(a0, a1, b0, b1, h), fill, alpha, undefined, r === undefined ? rad : r);
        };

        var ss = Math.max(0.7, Math.min(1.2, (this.u || 0.6) * 1.5));
        var shadow = R(-hl, hl, -hw, hw, 0).map(function (p) { return { x: p.x + 4 * ss, y: p.y + 6 * ss }; });
        this.drawRoundedPolygon(g, shadow, 0x000000, 0.35, undefined, rad);

        var wl = Math.max(4, length * 0.17), wt = Math.max(2, width * 0.12);
        [-hl * 0.56, hl * 0.56].forEach(function (a) {
          [1, -1].forEach(function (s) {
            var b0 = s > 0 ? hw - wt * 0.5 : -hw - wt * 0.3;
            var b1 = s > 0 ? hw + wt * 0.3 : -hw + wt * 0.5;
            layer(a - wl / 2, a + wl / 2, b0, b1, 0, 0x10151c, 1, 1.5);
            layer(a - wl / 2, a + wl / 2, b0, b1, Hb * 0.55, 0x1c232d, 1, 1.5);
          });
        });

        var N = 5, k;
        for (k = 0; k < N; k++) layer(-hl, hl, -hw, hw, Hb * k / N, shade(color, -78 + 60 * k / N), 1);
        layer(-hl, hl, -hw, hw, Hb, color, 1);
        layer(-hl * 0.92, hl * 0.92, -hw * 0.9, -hw * 0.55, Hb, 0xffffff, 0.22, rad * 0.6);
        layer(hl * 0.42, hl * 0.92, -hw * 0.8, hw * 0.8, Hb, shade(color, 18), 1, rad * 0.6);
        layer(-hl * 0.92, -hl * 0.6, -hw * 0.8, hw * 0.8, Hb, shade(color, 8), 1, rad * 0.6);

        var cb = { a0: -hl * 0.58, a1: hl * 0.42, b: hw * 0.8 };
        var rf = { a0: -hl * 0.44, a1: hl * 0.28, b: hw * 0.6 };
        var M = 4;
        for (k = 0; k < M; k++) {
          var t = k / M;
          layer(cb.a0 + (rf.a0 - cb.a0) * t, cb.a1 + (rf.a1 - cb.a1) * t,
            -(cb.b + (rf.b - cb.b) * t), cb.b + (rf.b - cb.b) * t,
            Hb + (Ht - Hb) * t, shade(0x17324b, 6 * k), 1, rad * 0.7);
        }
        layer(cb.a1 - (cb.a1 - cb.a0) * 0.22, cb.a1 - (cb.a1 - cb.a0) * 0.04, -cb.b * 0.82, cb.b * 0.82, Hb + (Ht - Hb) * 0.2, 0xffffff, 0.25, rad * 0.4);
        layer(rf.a0, rf.a1, -rf.b, rf.b, Ht, shade(color, 22), 1, rad * 0.7);
        layer(rf.a0 + (rf.a1 - rf.a0) * 0.06, rf.a1 - (rf.a1 - rf.a0) * 0.06, -rf.b * 0.92, -rf.b * 0.1, Ht, 0xffffff, 0.25, rad * 0.5);

        var lamp = Math.max(2, length * 0.07);
        var poly = function (pts, fill) { self.drawPolygon(g, pts, fill, 1); };
        poly(R(hl - lamp - 1, hl - 1, hw * 0.45, hw * 0.8, Hb), 0xfff3a6);
        poly(R(hl - lamp - 1, hl - 1, -hw * 0.8, -hw * 0.45, Hb), 0xfff3a6);
        poly(R(-hl + 1, -hl + lamp + 1, hw * 0.45, hw * 0.8, Hb), 0xff3b52);
        poly(R(-hl + 1, -hl + lamp + 1, -hw * 0.8, -hw * 0.45, Hb), 0xff3b52);

        // [UI-16] arrow kept the same length; made wider so it reads on the wider car bodies
        if (arrowAlpha === undefined || arrowAlpha > 0) {
          var alpha = arrowAlpha === undefined ? 1 : arrowAlpha;
          var A = Math.min(length * 0.3, width * 0.95);
          var headW = width * 0.72;   // was 0.52 — wider head
          var shaftW = width * 0.30;  // was 0.20 — wider shaft
          var tail = -A * 0.5, tip = A * 0.5, neck = tip - A * 0.45;
          var shaft = R(tail, neck + 0.5, -shaftW / 2, shaftW / 2, Ht);
          var head = [P(neck, -headW / 2, Ht), P(tip, 0, Ht), P(neck, headW / 2, Ht)];
          var ow = Math.max(1.4, width * 0.08);
          this.drawPolygon(g, shaft, 0x141c2b, alpha, 0x141c2b, ow * 2);
          this.drawPolygon(g, head, 0x141c2b, alpha, 0x141c2b, ow * 2);
          this.drawPolygon(g, shaft, 0xf2f5f8, alpha);
          this.drawPolygon(g, head, 0xf2f5f8, alpha);
        }
      };

      // [UI-9] 3D-styled mini passenger
      ParkingScene.prototype.drawPerson = function (graphics, x, y, colorKey, scale, pose, idlePhase) {
        var color = colorFor(colorKey).hex;
        var hairs = [0x3a2418, 0x1f1a17, 0x6b4a2b];
        var hair = hairs[(colorKey.charCodeAt(0) + colorKey.length) % 3];
        var headX = x;
        var headY = y - 14 * scale;
        var bodyTop = y - 10 * scale;
        var bodyBottom = y + 1 * scale;
        var armY = bodyTop + (pose ? 1 : 3) * scale;
        var armEndY = bodyTop + (pose ? -5 : 7) * scale;
        var leftTap = idlePhase === undefined ? 0 : Math.sin(idlePhase) * 1.15;
        var rightTap = idlePhase === undefined ? 0 : Math.sin(idlePhase + Math.PI) * 1.15;

        graphics.fillStyle(0x000000, 0.28);
        graphics.fillEllipse(x + 1.2 * scale, y + 7 * scale, 16 * scale, 5 * scale);

        graphics.lineStyle(Math.max(1.8, 2.8 * scale), shade(color, -30), 1);
        graphics.lineBetween(x - 5 * scale, armY, x - 6 * scale, armEndY);
        graphics.lineBetween(x + 5 * scale, armY, x + 6 * scale, armEndY);
        graphics.fillStyle(0xffd1b0, 1);
        graphics.fillCircle(x - 6 * scale, armEndY, 1.4 * scale);
        graphics.fillCircle(x + 6 * scale, armEndY, 1.4 * scale);

        graphics.lineStyle(Math.max(1.6, 2.3 * scale), 0x2b3548, 1);
        var leftFootX = x - (2.8 + leftTap * 0.45) * scale;
        var rightFootX = x + (2.8 + rightTap * 0.45) * scale;
        var leftFootY = y + 4.5 * scale - Math.max(0, leftTap) * 0.35 * scale;
        var rightFootY = y + 4.5 * scale - Math.max(0, rightTap) * 0.35 * scale;
        graphics.lineBetween(x - 1.5 * scale, bodyBottom - 1, leftFootX, leftFootY);
        graphics.lineBetween(x + 1.5 * scale, bodyBottom - 1, rightFootX, rightFootY);
        graphics.fillStyle(0x1f2736, 1);
        graphics.fillCircle(leftFootX, leftFootY, 1.4 * scale);
        graphics.fillCircle(rightFootX, rightFootY, 1.4 * scale);

        graphics.fillStyle(shade(color, -62), 1);
        graphics.fillRoundedRect(x - 6.8 * scale, bodyTop, 13.6 * scale, 12.8 * scale, 6 * scale);
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(x - 5.8 * scale, bodyTop + 0.5 * scale, 11.6 * scale, 11.2 * scale, 5 * scale);
        graphics.fillStyle(shade(color, -34), 0.55);
        graphics.fillRoundedRect(x + 1.8 * scale, bodyTop + 1 * scale, 3.8 * scale, 10 * scale, 2 * scale);
        graphics.fillStyle(0xffffff, 0.38);
        graphics.fillRoundedRect(x - 4.2 * scale, bodyTop + 1.4 * scale, 2 * scale, 6.5 * scale, 1 * scale);
        graphics.fillStyle(shade(color, -48), 0.8);
        graphics.fillRoundedRect(x - 5.2 * scale, bodyBottom - 2.4 * scale, 10.4 * scale, 2 * scale, 1 * scale);

        graphics.fillStyle(0xd49c7c, 1);
        graphics.fillCircle(headX + 0.7 * scale, headY + 1 * scale, 4.7 * scale);
        graphics.fillStyle(0xffdcbf, 1);
        graphics.fillCircle(headX, headY + 0.6 * scale, 4.5 * scale);
        graphics.fillStyle(hair, 1);
        graphics.fillCircle(headX, headY - 1.6 * scale, 4.6 * scale);
        graphics.fillStyle(0xffdcbf, 1);
        graphics.fillCircle(headX, headY + 1.4 * scale, 3.7 * scale);
        graphics.fillStyle(0x2a1f1a, 1);
        graphics.fillCircle(headX - 1.5 * scale, headY + 1.3 * scale, 0.6 * scale);
        graphics.fillCircle(headX + 1.5 * scale, headY + 1.3 * scale, 0.6 * scale);
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillCircle(headX - 1.9 * scale, headY - 2.3 * scale, 0.9 * scale);
      };

      ParkingScene.prototype.personScale = function () {
        return Math.max(1.0, Math.min(2.2, 2.0 * this.u));
      };

      // [UI-12] text helper: higher resolution and clear default colours
      ParkingScene.prototype.addText = function (x, y, text, style, originX, originY) {
        var label = this.add.text(x, y, text, Object.assign({
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
          fontSize: '12px', color: this.theme === 'dark' ? '#F8FAFC' : '#26324A',
          fontStyle: 'bold', align: 'center',
          shadow: { offsetX: 0, offsetY: 2, color: 'rgba(25, 35, 55, 0.16)', blur: 3, fill: true }
        }, style || {}));
        label.setOrigin(originX === undefined ? 0.5 : originX, originY === undefined ? 0.5 : originY);
        if (label.setResolution) label.setResolution(this.textRes());
        this.labels.push(label);
        return label;
      };

      ParkingScene.prototype.render = function () {
        if (!this.puzzle && this.screen === 'GAME') return;
        if (this.graphics) this.graphics.destroy();
        this.vehicleGraphics.forEach(function (vehicleGraphics) { vehicleGraphics.destroy(); });
        this.vehicleGraphics = [];
        if (this.modalBackdrop && this.modalBackdrop.active) this.modalBackdrop.destroy();
        if (this.modalCard && this.modalCard.active) this.modalCard.destroy();
        this.modalBackdrop = null;
        this.modalCard = null;
        this.modalButtons = {};
        this.landingPreview = null;
        this.labels.forEach(function (label) { label.destroy(); });
        this.labels = [];
        this.failureButtons = null;
        this.nextLevelButton = null;
        this.fx.clear();

        var graphics = this.add.graphics();
        this.graphics = graphics;

        if (!this.isLandingContext() && this.puzzle) {
          this.drawRoad(graphics);
          this.drawHud(graphics);
          this.drawQueue(graphics);
          this.drawBoard(graphics);
          this.drawBay(graphics);
          this.drawBoosters(graphics);
        }
        if (this.screen !== 'GAME' || this.paused || this.terminal || this.isLandingContext()) {
          this.drawOverlay(graphics);
        }
        this.publishState();
        // [ADS-5] single call site: every screen/pause/terminal change already goes through render()
        this.syncBannerVisibility();
      };

      // [UI-4] game HUD
      ParkingScene.prototype.drawHud = function (graphics) {
        var dark = this.theme === 'dark';
        var u = this.u;
        var X = this.X.bind(this);
        var top = this.safeTop;
        var barH = Math.max(46, 77 * u);
        var cy = top + barH / 2;
        var navy = dark ? '#F8FAFC' : '#1b2c4a';
        var barR = barH / 2.4;

        graphics.fillStyle(0x1b3a6b, dark ? 0.35 : 0.16);
        graphics.fillRoundedRect(X(26) + 2, top + 5, X(553), barH, barR);
        graphics.fillStyle(dark ? 0x182238 : 0xf4f9ff, 0.97);
        graphics.fillRoundedRect(X(26), top, X(553), barH, barR);
        graphics.lineStyle(2, dark ? 0x2b3952 : 0xffffff, 1);
        graphics.strokeRoundedRect(X(26), top, X(553), barH, barR);

        var pr = barH * 0.43;
        var px = X(61);
        graphics.fillStyle(0x9d0f1c, 0.35);
        graphics.fillCircle(px, cy + 3, pr);
        graphics.fillStyle(0xe8232f, 1);
        graphics.fillCircle(px, cy, pr);
        graphics.fillStyle(0xff6a6f, 0.5);
        graphics.fillEllipse(px, cy - pr * 0.45, pr * 1.3, pr * 0.7);
        graphics.lineStyle(2, 0xffffff, 0.55);
        graphics.strokeCircle(px, cy, pr);
        graphics.fillStyle(0xffffff, 1);
        if (this.paused) {
          graphics.fillTriangle(px - pr * 0.28, cy - pr * 0.42, px - pr * 0.28, cy + pr * 0.42, px + pr * 0.48, cy);
        } else {
          graphics.fillRoundedRect(px - pr * 0.42, cy - pr * 0.42, pr * 0.28, pr * 0.84, 2);
          graphics.fillRoundedRect(px + pr * 0.14, cy - pr * 0.42, pr * 0.28, pr * 0.84, 2);
        }

        var chipH = barH * 0.7;
        graphics.fillStyle(dark ? 0x25314a : 0xffffff, 1);
        graphics.fillRoundedRect(X(89), cy - chipH / 2, X(172), chipH, chipH / 2);
        graphics.lineStyle(1.5, dark ? 0x3a4863 : 0xdfe7f3, 1);
        graphics.strokeRoundedRect(X(89), cy - chipH / 2, X(172), chipH, chipH / 2);
        this.addText(X(175), cy, 'LEVEL ' + this.level, { fontSize: this.fs(20, 12), color: navy, shadow: undefined });

        graphics.fillStyle(0xffe08a, 1);
        graphics.fillRoundedRect(X(273), cy - chipH / 2, X(136), chipH, chipH / 2);
        graphics.fillStyle(0xfff3c9, 1);
        graphics.fillRoundedRect(X(273) + 2, cy - chipH / 2 + 2, X(136) - 4, chipH * 0.55, chipH / 2.4);
        var coinR = chipH * 0.46;
        graphics.fillStyle(0xe29a0c, 1);
        graphics.fillCircle(X(301), cy + 1, coinR);
        graphics.fillStyle(0xf6b814, 1);
        graphics.fillCircle(X(301), cy, coinR);
        graphics.lineStyle(2, 0xffe27a, 1);
        graphics.strokeCircle(X(301), cy, coinR * 0.68);
        this.coinHudText = this.addText(X(357), cy, String(this.coins), { fontSize: this.fs(27, 13), color: '#d9820f', shadow: undefined });

        var br = barH * 0.42;
        var gx = X(482);
        var sx = X(544);
        graphics.fillStyle(dark ? 0x24314a : 0xeef2f9, 1);
        graphics.fillCircle(gx, cy, br);
        graphics.lineStyle(1.5, dark ? 0x3a4863 : 0xd5deec, 1);
        graphics.strokeCircle(gx, cy, br);
        this.drawGear(graphics, gx, cy, br * 0.52, dark ? 0xcbd5e1 : 0x7084a6, dark ? 0x24314a : 0xeef2f9);
        graphics.fillStyle(dark ? 0x24314a : 0xe3ebf8, 1);
        graphics.fillCircle(sx, cy, br);
        graphics.lineStyle(1.5, dark ? 0x3a4863 : 0xd0dbee, 1);
        graphics.strokeCircle(sx, cy, br);
        this.drawSpeaker(graphics, sx - br * 0.12, cy, br * 0.5, dark ? 0xdbe5f5 : 0x5f7fb2, !gameSettings.master);

        this.hudButtons = {
          pause: { x: px, y: cy, r: pr },
          settings: { x: gx, y: cy, r: br },
          sound: { x: sx, y: cy, r: br }
        };

        var panelTop = top + barH;
        var panelH = Math.max(36, 62 * u);
        var remaining = this.passengers.length;
        var total = Math.max(1, this.levelPassengerTotal);
        graphics.fillStyle(dark ? 0x182238 : 0xe9f4ff, 0.94);
        graphics.fillRoundedRect(X(82), panelTop, X(437), panelH, { tl: 0, tr: 0, bl: 18 * u, br: 18 * u });
        graphics.lineStyle(2, dark ? 0x2b3952 : 0xffffff, 1);
        graphics.strokeRoundedRect(X(82), panelTop, X(437), panelH, { tl: 0, tr: 0, bl: 18 * u, br: 18 * u });
        var iconY = panelTop + panelH * 0.3;
        var iconS = 9 * u;
        var iconColor = dark ? 0xdbe5f5 : 0x2b4a7a;
        graphics.fillStyle(iconColor, 1);
        graphics.fillCircle(X(124) - iconS * 0.6, iconY - iconS * 0.55, iconS * 0.38);
        graphics.fillCircle(X(124) + iconS * 0.6, iconY - iconS * 0.55, iconS * 0.38);
        graphics.fillRoundedRect(X(124) - iconS * 1.05, iconY - iconS * 0.1, iconS * 0.95, iconS * 0.8, iconS * 0.3);
        graphics.fillRoundedRect(X(124) + iconS * 0.1, iconY - iconS * 0.1, iconS * 0.95, iconS * 0.8, iconS * 0.3);
        this.addText(X(142), iconY, remaining + '/' + this.levelPassengerTotal + '  \u2022  PASSENGERS', { fontSize: this.fs(15, 10), color: dark ? '#F8FAFC' : '#243c63', shadow: undefined }, 0, 0.5);
        var barY = panelTop + panelH * 0.58;
        var barBH = Math.max(8, 14 * u);
        graphics.fillStyle(dark ? 0x29354a : 0xd2e8dc, 1);
        graphics.fillRoundedRect(X(107), barY, X(387), barBH, barBH / 2);
        graphics.fillStyle(0x1fc765, 1);
        graphics.fillRoundedRect(X(107), barY, Math.max(barBH, X(387) * (remaining / total)), barBH, barBH / 2);
        graphics.fillStyle(0xa6f0c4, 0.55);
        graphics.fillRoundedRect(X(107) + 3, barY + 1.5, Math.max(barBH - 6, X(387) * (remaining / total) - 6), barBH * 0.32, barBH / 4);
      };

      ParkingScene.prototype.queuePoint = function (index) {
        return { x: this.X(71) + index * this.X(43.5), y: this.queueY };
      };

      ParkingScene.prototype.drawQueue = function (graphics) {
        var dark = this.theme === 'dark';
        var X = this.X.bind(this);
        var u = this.u;
        var labelColor = dark ? '#B5C4DA' : '#1f4a7f';
        var qx = X(22), qw = X(557), qr = 22 * u;
        graphics.fillStyle(0x17406e, 0.18);
        graphics.fillRoundedRect(qx, this.queueTop + 5, qw, this.queueH, qr);
        graphics.fillStyle(dark ? 0x0f172a : 0xe6f2fb, dark ? 0.82 : 0.8);
        graphics.fillRoundedRect(qx, this.queueTop, qw, this.queueH, qr);
        this.vGradient(graphics, qx + qr * 0.6, this.queueTop + 2, qw - qr * 1.2, this.Y(36),
          dark ? 0x2a3c5e : 0xb9dcf6, dark ? 0x0f172a : 0xe6f2fb, 8, dark ? 0.9 : 0.9);
        graphics.lineStyle(2, dark ? 0x2b3a57 : 0xffffff, 1);
        graphics.strokeRoundedRect(qx, this.queueTop, qw, this.queueH, qr);
        var sx = X(49), sy = this.queueTop + this.Y(40), sw = X(506), sh = this.Y(57);
        graphics.fillStyle(0xffffff, dark ? 0.06 : 0.5);
        graphics.fillRoundedRect(sx, sy, sw, sh, 14 * u);
        graphics.fillStyle(0x17406e, dark ? 0.2 : 0.08);
        graphics.fillRoundedRect(sx + 3, sy, sw - 6, Math.max(3, 5 * u), 3);
        graphics.lineStyle(1.5, dark ? 0x35445e : 0xffffff, 0.9);
        graphics.strokeRoundedRect(sx, sy, sw, sh, 14 * u);
        this.addText(X(49), this.queueTop + this.Y(17), 'PASSENGER QUEUE', { fontSize: this.fs(15, 10), color: labelColor, shadow: undefined }, 0, 0.5);
        var visible = Math.min(MAX_VISIBLE_PASSENGERS, this.passengers.length);
        if (this.passengers.length > visible) {
          this.addText(X(552), this.queueTop + this.Y(17), '+' + (this.passengers.length - visible), { fontSize: this.fs(15, 10), color: labelColor, shadow: undefined }, 1, 0.5);
        }
        if (!visible) {
          this.addText(X(301), this.queueY, 'QUEUE CLEAR', { fontSize: this.fs(15, 10), color: labelColor, shadow: undefined });
        }
      };

      ParkingScene.prototype.drawBoard = function (graphics) {
        var scene = this;
        var cell = this.cell;

        this.vehicles.forEach(function (vehicle) {
          var c = scene.gridCenter(vehicle);
          vehicle.isoX = c.x;
          vehicle.isoY = c.y;
          vehicle.renderDepth = vehicle.isoY + (vehicle.isMoving ? 5000 : 0);
        });

        this.vehicles.slice().sort(function (a, b) {
          return a.renderDepth - b.renderDepth;
        }).forEach(function (vehicle) {
          if (vehicle.status === 'hidden') {
            scene.drawTunnelPortal(graphics, vehicle);
            return;
          }
          if (vehicle.status !== 'grid') return;

          var center = scene.gridCenter(vehicle);
          vehicle.isoX = center.x;
          vehicle.isoY = center.y;
          vehicle.renderDepth = center.y + (vehicle.isMoving ? 5000 : 0);

          var horizontal = vehicle.orientation === 'Horizontal';
          var gc = scene.gridCar(vehicle);
          var gx = center.x + gc.ox, gy = center.y + gc.oy;
          var vehicleGraphics = scene.add.graphics().setDepth(vehicle.renderDepth);
          scene.vehicleGraphics.push(vehicleGraphics);
          scene.drawTopCar(vehicleGraphics, vehicle, gx, gy, gc.L, gc.W, scene.headingForDirection(vehicle.direction));

          var hitL = vehicle.length * cell * 0.94;
          var hitW = cell * 0.9;
          var hx = horizontal ? hitL : hitW;
          var hy = horizontal ? hitW : hitL;
          vehicle.hitPoints = [
            { x: center.x - hx / 2, y: center.y - hy / 2 }, { x: center.x + hx / 2, y: center.y - hy / 2 },
            { x: center.x + hx / 2, y: center.y + hy / 2 }, { x: center.x - hx / 2, y: center.y + hy / 2 }
          ];

          var dir = vehicle.direction;
          var dx = dir === 'East' ? 1 : dir === 'West' ? -1 : 0;
          var dy = dir === 'South' ? 1 : dir === 'North' ? -1 : 0;
          var roofH = gc.W * 0.47;
          var ax = gx - roofH * CAR_LIFT_K - dx * gc.L * 0.2;
          var ay = gy - roofH - dy * gc.L * 0.2;

          if (vehicle.mystery) {
            var badgeR = Math.max(7, cell * 0.2);
            vehicleGraphics.fillStyle(0x000000, 0.18);
            vehicleGraphics.fillCircle(ax + 1, ay + 2, badgeR);
            vehicleGraphics.fillStyle(0xffffff, 1);
            vehicleGraphics.fillCircle(ax, ay, badgeR);
            vehicleGraphics.lineStyle(2, 0x7c5cff, 1);
            vehicleGraphics.strokeCircle(ax, ay, badgeR);
            scene.addText(ax, ay, '?', { fontSize: Math.round(badgeR * 1.5) + 'px', color: '#6b46e5', shadow: undefined }).setDepth(vehicle.renderDepth + 1);
          }

          if (vehicle.locked) {
            vehicleGraphics.fillStyle(0x34445c, 0.96);
            vehicleGraphics.fillRoundedRect(ax - 7, ay - 2, 14, 11, 3);
            vehicleGraphics.lineStyle(2, 0x34445c, 1);
            vehicleGraphics.strokeCircle(ax, ay - 4, 4);
            vehicleGraphics.fillStyle(0xffd86b, 1);
            vehicleGraphics.fillCircle(ax, ay + 3, 1.4);
          } else if (vehicle.isKeyVehicle && scene.level >= 3) {
            vehicleGraphics.fillStyle(colorFor(vehicle.color).hex, 1);
            vehicleGraphics.fillCircle(ax, ay, 5);
            vehicleGraphics.lineStyle(1.8, 0xffffff, 0.95);
            vehicleGraphics.strokeCircle(ax, ay, 7);
          }
        });
      };

      ParkingScene.prototype.drawTunnelPortal = function (graphics, vehicle) {
        var center = this.gridCenter(vehicle);
        graphics.fillStyle(0x6f76b7, 0.2);
        graphics.fillEllipse(center.x, center.y, this.cell * 1.3, this.cell * 1.0);
        graphics.lineStyle(2, 0x8b78c6, 0.8);
        graphics.strokeEllipse(center.x, center.y, this.cell * 1.05, this.cell * 0.8);
        graphics.lineStyle(1, 0xffffff, 0.7);
        graphics.strokeEllipse(center.x, center.y, this.cell * 0.72, this.cell * 0.54);
        graphics.fillStyle(0x31415c, 0.8);
        graphics.fillEllipse(center.x, center.y, this.cell * 0.5, this.cell * 0.34);
      };

      ParkingScene.prototype.spawnTunnelVehicle = function (vehicle) {
        if (this.vehicles.indexOf(vehicle) < 0 || vehicle.status !== 'hidden') return;
        vehicle.status = 'entering';
        vehicle.isMoving = true;
        this.render();
        var destination = this.gridCenter(vehicle);
        var origin = vehicle.orientation === 'Horizontal'
          ? { x: destination.x - this.cell * (vehicle.length + 1), y: destination.y }
          : { x: destination.x, y: destination.y - this.cell * (vehicle.length + 1) };
        var motion = { t: 0 };
        var portal = this.add.graphics();
        var effect = this.add.graphics();
        var scene = this;
        var heading = this.headingForDirection(vehicle.direction);
        vehicle.isoX = destination.x;
        vehicle.isoY = destination.y;
        vehicle.renderDepth = vehicle.isoY + 5000;
        effect.setDepth(vehicle.renderDepth);
        this.tweens.add({
          targets: motion, t: 1, duration: 760, ease: 'Cubic.easeOut',
          onUpdate: function () {
            effect.clear();
            portal.clear();
            vehicle.isoX = origin.x + (destination.x - origin.x) * motion.t;
            vehicle.isoY = origin.y + (destination.y - origin.y) * motion.t;
            vehicle.renderDepth = vehicle.isoY + 5000;
            effect.setDepth(vehicle.renderDepth);
            scene.drawTunnelPortal(portal, vehicle);
            var tg = scene.gridCar(vehicle);
            scene.drawTopCar(effect, vehicle, vehicle.isoX + tg.ox, vehicle.isoY + tg.oy, tg.L, tg.W, heading);
          },
          onComplete: function () {
            vehicle.status = 'grid';
            vehicle.isMoving = false;
            vehicle.isoX = destination.x;
            vehicle.isoY = destination.y;
            vehicle.renderDepth = vehicle.isoY;
            effect.destroy();
            portal.destroy();
            scene.render();
            sendToNative({ type: 'VEHICLE_FROM_TUNNEL', vehicleId: vehicle.id, level: scene.level });
          }
        });
      };

      ParkingScene.prototype.drawRoad = function (graphics) {
        var dark = this.theme === 'dark';
        var u = this.u;
        var W = this.width || window.innerWidth || 400;
        var H = this.height || window.innerHeight || 800;
        var X = this.X.bind(this);
        var Y = this.Y.bind(this);
        var pal = dark
          ? { walk: 0x34404f, walkLine: 0x2a3441, road: 0x2b3039, edge: 0x4b5667, lot: 0x2a2e35, curb: 0x5b6676, curbHi: 0x8794a8, curbLo: 0x38414d, line: 0xd9dee6 }
          : { walk: 0xd3d8dd, walkLine: 0xbcc3ca, road: 0x434850, edge: 0x6b7480, lot: 0x3a3f47, curb: 0xd5dae0, curbHi: 0xffffff, curbLo: 0x9aa2ad, line: 0xf2f4f7 };

        var swT = Y(296);
        var swB = Y(350);
        graphics.fillStyle(pal.walk, 1);
        graphics.fillRect(0, swT, W, swB - swT);
        graphics.lineStyle(1, pal.walkLine, 0.8);
        for (var tx = 0; tx < W; tx += X(46)) graphics.lineBetween(tx, swT, tx, swB);
        graphics.lineBetween(0, (swT + swB) / 2, W, (swT + swB) / 2);
        graphics.fillStyle(pal.curb, 1);
        graphics.fillRect(0, swB - 4 * u, W, 4 * u);
        graphics.fillStyle(0xffffff, dark ? 0.12 : 0.55);
        graphics.fillRect(0, swB - 4 * u, W, Math.max(1, 1.2 * u));

        this.drawTree(graphics, X(26), Y(312), 36 * u, dark);
        this.drawTree(graphics, X(172), Y(316), 26 * u, dark);
        this.drawTree(graphics, X(452), Y(314), 24 * u, dark);
        this.drawTree(graphics, X(566), Y(310), 40 * u, dark);
        this.drawBush(graphics, X(262), Y(326), 20 * u, dark);
        this.drawBush(graphics, X(322), Y(328), 14 * u, dark);
        this.drawBush(graphics, X(500), Y(328), 14 * u, dark);
        var lamps = [54, 522];
        for (var li = 0; li < lamps.length; li++) {
          var lx = X(lamps[li]);
          graphics.fillStyle(0xffd37a, 0.12);
          graphics.fillCircle(lx, Y(258), 26 * u);
          graphics.fillStyle(0xffd37a, 0.2);
          graphics.fillCircle(lx, Y(258), 15 * u);
          graphics.lineStyle(Math.max(2, 3 * u), 0x2f3b4d, 1);
          graphics.lineBetween(lx, Y(338), lx, Y(262));
          graphics.fillStyle(0x2f3b4d, 1);
          graphics.fillRoundedRect(lx - 6 * u, Y(252), 12 * u, 14 * u, 3);
          graphics.fillStyle(0xffe58a, 0.98);
          graphics.fillRoundedRect(lx - 4 * u, Y(254), 8 * u, 9 * u, 2);
        }
        graphics.fillStyle(0xd9232d, 1);
        graphics.fillRoundedRect(X(354) - 5 * u, Y(305), 10 * u, 18 * u, 3);
        graphics.fillRect(X(354) - 7 * u, Y(309), 14 * u, 4 * u);
        graphics.fillStyle(0xffffff, 0.45);
        graphics.fillRect(X(354) - 3 * u, Y(307), 2 * u, 12 * u);

        var trT = swB;
        var trB = Y(416);
        graphics.fillStyle(pal.road, 1);
        graphics.fillRect(0, trT, W, trB - trT);
        graphics.fillStyle(pal.edge, 1);
        graphics.fillRect(0, trT, W, 3 * u);
        for (var dx = X(8); dx < W; dx += X(60)) graphics.fillRoundedRect(dx, this.topRoadY - 1.5 * u, X(34), 3 * u, 1.5);
        this.drawArrowLine(graphics, X(386), this.topRoadY, X(420), this.topRoadY, 12 * u, pal.line, Math.max(2.5, 3.5 * u), 0.95);

        graphics.fillStyle(pal.walk, 1);
        graphics.fillRect(0, this.lotT - 2, this.lotL, this.lotB - this.lotT + Y(14));
        graphics.fillRect(this.lotR, this.lotT - 2, W - this.lotR, this.lotB - this.lotT + Y(14));

        var cp = Math.max(5, 8 * u);
        var thick = Math.max(3, 5 * u);
        var sL = this.lotL - cp, sR = this.lotR + cp, sT = this.lotT - cp, sB = this.lotB + cp;
        var sr = Math.max(6, 12 * u);
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRoundedRect(sL + 2, sT + thick + 5, sR - sL, sB - sT, sr);
        graphics.fillStyle(pal.curbLo, 1);
        graphics.fillRoundedRect(sL, sT + thick, sR - sL, sB - sT, sr);
        graphics.fillStyle(pal.curb, 1);
        graphics.fillRoundedRect(sL, sT, sR - sL, sB - sT, sr);
        graphics.lineStyle(Math.max(1.5, 2 * u), pal.curbHi, 0.95);
        graphics.beginPath(); graphics.moveTo(sL + sr, sT + 1); graphics.lineTo(sR - sr, sT + 1); graphics.strokePath();
        graphics.lineStyle(Math.max(1, 1.4 * u), pal.curbHi, 0.5);
        graphics.beginPath(); graphics.moveTo(sL + 1, sT + sr); graphics.lineTo(sL + 1, sB - sr); graphics.strokePath();

        graphics.fillStyle(pal.lot, 1);
        graphics.fillRect(this.lotL, this.lotT, this.lotR - this.lotL, this.lotB - this.lotT);
        graphics.fillStyle(0xffffff, 0.035);
        for (var py = this.lotT + Y(30); py < this.lotB; py += Y(90)) graphics.fillRect(this.lotL, py, this.lotR - this.lotL, Y(34));
        graphics.fillStyle(0x000000, 0.28);
        graphics.fillRect(this.lotL, this.lotT, this.lotR - this.lotL, Math.max(3, 5 * u));
        graphics.fillRect(this.lotL, this.lotT, Math.max(2, 3 * u), this.lotB - this.lotT);
        graphics.fillStyle(0xffffff, 0.08);
        graphics.fillRect(this.lotL, this.lotB - Math.max(2, 2.5 * u), this.lotR - this.lotL, Math.max(2, 2.5 * u));

        this.drawBush(graphics, X(4), Y(600), 20 * u, dark);
        this.drawBush(graphics, X(598), Y(480), 18 * u, dark);
        this.drawBush(graphics, X(598), Y(840), 18 * u, dark);

        graphics.lineStyle(Math.max(1.5, 2 * u), pal.line, 0.8);
        graphics.strokeRoundedRect(this.gridLeft - this.cell * 0.28, this.gridTop - this.cell * 0.28, this.cell * this.columns + this.cell * 0.56, this.cell * this.rows + this.cell * 0.56, this.cell * 0.3);
        graphics.lineStyle(Math.max(1.2, 1.6 * u), pal.line, 0.45);
        for (var r = 1; r < this.rows; r++) {
          var ly = this.gridTop + r * this.cell;
          graphics.lineBetween(this.gridLeft - this.cell * 0.28, ly, this.gridLeft + this.cell * 1.6, ly);
        }

        var brT = Y(898);
        var brB = Y(988);
        graphics.fillStyle(pal.road, 1);
        graphics.fillRect(0, brT, W, brB - brT);
        graphics.fillStyle(pal.edge, 1);
        graphics.fillRect(0, brB - 3 * u, W, 3 * u);
        for (var bx = X(8); bx < W; bx += X(60)) graphics.fillRoundedRect(bx, this.roadY - 1.5 * u, X(34), 3 * u, 1.5);
        this.drawArrowLine(graphics, X(540), this.roadY, X(584), this.roadY, 14 * u, pal.line, Math.max(2.5, 3.5 * u), 0.95);
      };

      ParkingScene.prototype.drawBaySlab = function (g, geom) {
        var u = this.u || 0.6;
        var dark = this.theme === 'dark';
        var pad = Math.max(5, geom.width * 0.07);
        var x0 = geom.left - pad, w = geom.width + pad * 2;
        var y0 = geom.top - pad, h = geom.drop + geom.slots * geom.pitch + pad * 2;
        var thick = Math.max(3, 5 * u), r = Math.max(6, 12 * u);
        g.fillStyle(0x000000, 0.3);
        g.fillRoundedRect(x0 + 2, y0 + thick + 4, w, h, r);
        g.fillStyle(dark ? 0x38414d : 0x9aa2ad, 1);
        g.fillRoundedRect(x0, y0 + thick, w, h, r);
        g.fillStyle(dark ? 0x5b6676 : 0xd5dae0, 1);
        g.fillRoundedRect(x0, y0, w, h, r);
        g.lineStyle(Math.max(1.5, 2 * u), dark ? 0x8794a8 : 0xffffff, 0.95);
        g.beginPath(); g.moveTo(x0 + r, y0 + 1); g.lineTo(x0 + w - r, y0 + 1); g.strokePath();
      };

      ParkingScene.prototype.drawSlantedBay = function (g, geom, unlocked, lw) {
        var n = geom.slots, L = geom.left, R = L + geom.width, i;
        var tanA = geom.drop / geom.width;
        var lipW = Math.max(3, geom.width * 0.06);
        var shT = Math.max(3, geom.pitch * 0.16);
        for (i = 0; i < n; i++) {
          var y = geom.top + i * geom.pitch;
          g.fillStyle(0x23272e, 1);
          g.fillPoints([{ x: L, y: y }, { x: R, y: y + geom.drop }, { x: R, y: y + geom.drop + geom.pitch }, { x: L, y: y + geom.pitch }], true);
          g.fillStyle(0x000000, 0.5);
          g.fillPoints([{ x: L, y: y }, { x: R, y: y + geom.drop }, { x: R, y: y + geom.drop + shT }, { x: L, y: y + shT }], true);
          g.fillStyle(0x000000, 0.3);
          g.fillPoints([{ x: L, y: y }, { x: L + lipW, y: y + lipW * tanA }, { x: L + lipW, y: y + lipW * tanA + geom.pitch }, { x: L, y: y + geom.pitch }], true);
          g.lineStyle(1, 0xffffff, 0.14);
          g.lineBetween(L, y + geom.pitch - 1, R, y + geom.drop + geom.pitch - 1);
        }
        for (i = 0; i < n; i++) {
          if (unlocked[i]) continue;
          var ly = geom.top + i * geom.pitch;
          g.fillStyle(0x000000, 0.45);
          g.fillPoints([{ x: L, y: ly }, { x: R, y: ly + geom.drop }, { x: R, y: ly + geom.drop + geom.pitch }, { x: L, y: ly + geom.pitch }], true);
          var c = this.slantCenter(geom, i);
          var s = Math.min(geom.pitch * 0.34, geom.width * 0.16);
          g.lineStyle(Math.max(2, s * 0.28), 0xdfe6f2, 1);
          g.beginPath(); g.arc(c.x, c.y - s * 0.1, s * 0.42, Math.PI, 0, false); g.strokePath();
          g.fillStyle(0xdfe6f2, 1);
          g.fillRoundedRect(c.x - s * 0.7, c.y - s * 0.1, s * 1.4, s * 1.1, s * 0.2);
          g.fillStyle(0x34445c, 1);
          g.fillCircle(c.x, c.y + s * 0.35, s * 0.15);
        }
        g.lineStyle(lw, 0xeef1f5, 0.9);
        for (i = 0; i <= n; i++) g.lineBetween(L, geom.top + i * geom.pitch, R, geom.top + i * geom.pitch + geom.drop);
        g.lineBetween(L, geom.top, L, geom.top + n * geom.pitch);
        g.lineBetween(R, geom.top + geom.drop, R, geom.top + geom.drop + n * geom.pitch);
      };

      ParkingScene.prototype.drawBay = function (graphics) {
        var u = this.u, X = this.X.bind(this), Y = this.Y.bind(this);
        var geom = this.bayGeom, scene = this;
        this.drawBaySlab(graphics, geom);
        this.drawSlantedBay(graphics, geom, this.bayUnlocked, Math.max(1.6, 2.2 * u));

        this.drawArrowLine(graphics, X(524), Y(534), X(524), Y(484), 12 * u, 0xf3f6fa, Math.max(2.2, 3 * u), 0.95);
        this.drawArrowLine(graphics, X(539), Y(738), X(539), Y(790), 12 * u, 0xf3f6fa, Math.max(2.2, 3 * u), 0.95);
        var title = this.addText(X(537), Y(636), 'BOARDING BAY', { fontSize: this.fs(19, 10), color: '#e6ebf3', letterSpacing: 3, shadow: undefined });
        title.setAngle(90);

        var unique = [];
        this.bay.forEach(function (v) { if (v && unique.indexOf(v) < 0) unique.push(v); });
        unique.forEach(function (vehicle) {
          if (vehicle.status !== 'bay') return;
          var center = scene.bayCenter(vehicle.bayStart);
          var size = scene.bayCarSize(vehicle);
          vehicle.bayAligned = true;
          scene.drawTopCar(graphics, vehicle, center.x, center.y, size.L, size.W, BAY_ANGLE, 0.55);
          scene.addText(geom.left + 3, geom.top + vehicle.bayStart * geom.pitch + geom.pitch - 2, vehicle.capacity + '/' + vehicle.seats, {
            fontSize: scene.fs(11, 9), color: '#ffffff', backgroundColor: 'rgba(15,23,42,0.75)', padding: { x: 3, y: 1 }, shadow: undefined
          }, 0, 1);
        });
      };

      ParkingScene.prototype.drawBoosters = function (graphics) {
        var dark = this.theme === 'dark';
        var u = this.u;
        var X = this.X.bind(this);
        var h = this.boosterH;
        var top = this.boosterTop;
        var buttons = [
          { id: 'SLOT', title: 'ADD SLOT', cost: '300 COINS', x: 22, w: 183, fill: 0xf3f8ff, border: 0xffffff, accent: 0x1fb36b },
          { id: 'VIP', title: 'VIP PASS', cost: '35 COINS', x: 209, w: 185, fill: 0xfff3c4, border: 0xf7d57a, accent: 0xf3b21c },
          { id: 'SHUFFLE', title: 'SHUFFLE', cost: '20 COINS', x: 397, w: 182, fill: 0xeceeff, border: 0xc4c9f7, accent: 0x5a62e0 }
        ];
        this.boosterBounds = {};
        for (var i = 0; i < buttons.length; i++) {
          var b = buttons[i];
          var bx = X(b.x);
          var bw = X(b.w);
          var rr = 24 * u;
          graphics.fillStyle(0x0f3d6c, 0.18);
          graphics.fillRoundedRect(bx, top + 5, bw, h, rr);
          graphics.fillStyle(dark ? 0x162238 : b.fill, 1);
          graphics.fillRoundedRect(bx, top, bw, h, rr);
          graphics.lineStyle(Math.max(2, 3 * u), dark ? 0x41516b : b.border, 1);
          graphics.strokeRoundedRect(bx, top, bw, h, rr);
          var ix = bx + X(44);
          var iy = top + h / 2;
          var ir = h * 0.29;
          graphics.fillStyle(b.accent, 1);
          graphics.fillCircle(ix, iy, ir);
          graphics.lineStyle(2, 0xffffff, 0.45);
          graphics.strokeCircle(ix, iy, ir);
          graphics.lineStyle(Math.max(2.2, ir * 0.18), 0xffffff, 1);
          graphics.fillStyle(0xffffff, 1);
          if (b.id === 'SLOT') {
            graphics.lineBetween(ix - ir * 0.5, iy, ix + ir * 0.5, iy);
            graphics.lineBetween(ix, iy - ir * 0.5, ix, iy + ir * 0.5);
          } else if (b.id === 'VIP') {
            var s = ir;
            graphics.fillPoints([
              { x: ix - s * 0.6, y: iy + s * 0.4 }, { x: ix - s * 0.6, y: iy - s * 0.35 },
              { x: ix - s * 0.25, y: iy + s * 0.0 }, { x: ix, y: iy - s * 0.5 },
              { x: ix + s * 0.25, y: iy + s * 0.0 }, { x: ix + s * 0.6, y: iy - s * 0.35 },
              { x: ix + s * 0.6, y: iy + s * 0.4 }
            ], true);
          } else {
            var q = ir * 0.55;
            graphics.beginPath();
            graphics.moveTo(ix - q * 1.1, iy + q * 0.7); graphics.lineTo(ix - q * 0.2, iy + q * 0.7);
            graphics.lineTo(ix + q * 0.4, iy - q * 0.7); graphics.lineTo(ix + q * 0.9, iy - q * 0.7);
            graphics.strokePath();
            graphics.beginPath();
            graphics.moveTo(ix - q * 1.1, iy - q * 0.7); graphics.lineTo(ix - q * 0.2, iy - q * 0.7);
            graphics.lineTo(ix + q * 0.4, iy + q * 0.7); graphics.lineTo(ix + q * 0.9, iy + q * 0.7);
            graphics.strokePath();
            graphics.fillTriangle(ix + q * 0.8, iy - q * 1.15, ix + q * 0.8, iy - q * 0.25, ix + q * 1.5, iy - q * 0.7);
            graphics.fillTriangle(ix + q * 0.8, iy + q * 0.25, ix + q * 0.8, iy + q * 1.15, ix + q * 1.5, iy + q * 0.7);
          }
          this.addText(bx + X(121), top + h * 0.37, b.title, { fontSize: this.fs(17, 11), color: dark ? '#FFFFFF' : '#1f3050', shadow: undefined });
          this.addText(bx + X(121), top + h * 0.62, b.cost, { fontSize: this.fs(13, 9), color: dark ? '#B9C7DA' : '#3b4a66', shadow: undefined });
          this.boosterBounds[b.id] = { x: bx, y: top, width: bw, height: h };
        }
      };

      ParkingScene.prototype.pathIsClear = function (vehicle) {
        var direction = vehicle.direction || (vehicle.orientation === 'Horizontal' ? 'East' : 'South');
        var rowStep = direction === 'North' ? -1 : direction === 'South' ? 1 : 0;
        var columnStep = direction === 'West' ? -1 : direction === 'East' ? 1 : 0;
        var frontRow = vehicle.row + (rowStep > 0 ? vehicle.length - 1 : 0);
        var frontColumn = vehicle.column + (columnStep > 0 ? vehicle.length - 1 : 0);
        var pathRow = frontRow + rowStep;
        var pathColumn = frontColumn + columnStep;
        while (pathRow >= 0 && pathRow < this.rows && pathColumn >= 0 && pathColumn < this.columns) {
          for (var i = 0; i < this.vehicles.length; i++) {
            var other = this.vehicles[i];
            if (other.id === vehicle.id || other.status === 'bay' || other.status === 'departing' || other.status === 'moving') continue;
            var otherRows = other.orientation === 'Vertical' ? other.length : 1;
            var otherColumns = other.orientation === 'Horizontal' ? other.length : 1;
            if (pathRow >= other.row && pathRow < other.row + otherRows &&
              pathColumn >= other.column && pathColumn < other.column + otherColumns &&
              (other.layer || 0) >= (vehicle.layer || 0)) return false;
          }
          pathRow += rowStep;
          pathColumn += columnStep;
        }
        return true;
      };

      ParkingScene.prototype.headingForDirection = function (direction) {
        if (direction === 'West') return Math.PI;
        if (direction === 'South') return Math.PI / 2;
        if (direction === 'North') return -Math.PI / 2;
        return 0;
      };

      ParkingScene.prototype.headingForScreenDelta = function (deltaX, deltaY) {
        return Math.atan2(deltaY, deltaX);
      };

      ParkingScene.prototype.buildDrivingPath = function (vehicle, bayStart) {
        var start = this.gridCenter(vehicle);
        var direction = vehicle.direction || (vehicle.orientation === 'Horizontal' ? 'East' : 'South');
        var bayPoint = this.bayCenter(bayStart);
        var entryY = bayPoint.y - (bayPoint.x - this.laneX) * Math.tan(BAY_ANGLE);
        var off = this.cell * 0.3;
        var topY = this.gridTop - off;
        var bottomY = this.gridBottom + off;
        var leftX = this.gridLeft - off;
        var laneX = this.laneX;
        var points = [start];
        var addPoint = function (x, y) {
          var last = points[points.length - 1];
          if (Math.abs(last.x - x) + Math.abs(last.y - y) > 1) points.push({ x: x, y: y });
        };

        if (direction === 'East') {
          addPoint(laneX, start.y);
        } else if (direction === 'West') {
          addPoint(leftX, start.y);
          addPoint(leftX, topY);
          addPoint(laneX, topY);
        } else if (direction === 'North') {
          addPoint(start.x, topY);
          addPoint(laneX, topY);
        } else {
          addPoint(start.x, bottomY);
          addPoint(laneX, bottomY);
        }
        addPoint(laneX, entryY);
        addPoint(bayPoint.x, bayPoint.y);

        var segments = [];
        var totalDistance = 0;
        var previousHeading = this.headingForDirection(direction);
        for (var index = 0; index < points.length - 1; index++) {
          var from = points[index];
          var to = points[index + 1];
          var deltaX = to.x - from.x;
          var deltaY = to.y - from.y;
          var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (distance < 1) continue;
          var targetHeading = index === 0 ? previousHeading : this.headingForScreenDelta(deltaX, deltaY);
          segments.push({
            from: from,
            to: to,
            distance: distance,
            startDistance: totalDistance,
            startHeading: previousHeading,
            targetHeading: targetHeading
          });
          totalDistance += distance;
          previousHeading = targetHeading;
        }
        return { segments: segments, totalDistance: totalDistance, start: start };
      };

      ParkingScene.prototype.revealMystery = function (vehicle) {
        if (!vehicle.mystery) return;
        vehicle.mystery = false;
        gameAudio.reveal();
        var center = this.gridCenter(vehicle);
        var fx = this.add.graphics().setDepth(90000);
        var motion = { t: 0 };
        var hex = colorFor(vehicle.color).hex;
        var scene = this;
        this.tweens.add({
          targets: motion, t: 1, duration: 520, ease: 'Cubic.easeOut',
          onUpdate: function () {
            fx.clear();
            fx.lineStyle(1 + 4 * (1 - motion.t), hex, 1 - motion.t);
            fx.strokeCircle(center.x, center.y, scene.cell * (0.4 + motion.t * 1.1));
            fx.lineStyle(2, 0xffffff, 0.8 * (1 - motion.t));
            fx.strokeCircle(center.x, center.y, scene.cell * (0.25 + motion.t * 0.8));
          },
          onComplete: function () { fx.destroy(); }
        });
        sendToNative({ type: 'MYSTERY_REVEALED', vehicleId: vehicle.id, color: vehicle.color });
      };

      ParkingScene.prototype.revealMysteryBlockedBy = function (blocker) {
        var scene = this;
        this.vehicles.forEach(function (other) {
          if (other.mystery && other.firstBlockerId === blocker.id) scene.revealMystery(other);
        });
      };

      // [UI-14] obstructed car bumps its blocker, puffs white smoke, slides back
      ParkingScene.prototype.bumpIntoBlocker = function (vehicle, blocker) {
        var scene = this;
        var start = this.gridCenter(vehicle);
        var direction = vehicle.direction || (vehicle.orientation === 'Horizontal' ? 'East' : 'South');
        var rowStep = direction === 'North' ? -1 : direction === 'South' ? 1 : 0;
        var columnStep = direction === 'West' ? -1 : direction === 'East' ? 1 : 0;
        var travel = this.cell * 0.6;
        var targetX = start.x + columnStep * travel;
        var targetY = start.y + rowStep * travel;

        var gc = this.gridCar(vehicle);
        var heading = this.headingForDirection(direction);
        var effect = this.add.graphics().setDepth(vehicle.isoY + 6000);

        var puffs = [];
        for (var i = 0; i < 7; i++) {
          puffs.push({
            x: 0, y: 0,
            vx: (Math.random() - 0.5) * 40,
            vy: -20 - Math.random() * 30,
            r: 4 + Math.random() * 6,
            life: 0
          });
        }

        var forward = { t: 0 };
        this.tweens.add({
          targets: forward, t: 1, duration: 160, ease: 'Cubic.easeOut',
          onUpdate: function () {
            effect.clear();
            var x = start.x + (targetX - start.x) * forward.t;
            var y = start.y + (targetY - start.y) * forward.t;
            scene.drawTopCar(effect, vehicle, x + gc.ox, y + gc.oy, gc.L, gc.W, heading);
          },
          onComplete: function () {
            var frontX = targetX + columnStep * gc.L * 0.5;
            var frontY = targetY + rowStep * gc.L * 0.5;
            puffs.forEach(function (puff) {
              puff.x = frontX + (Math.random() - 0.5) * 10;
              puff.y = frontY + (Math.random() - 0.5) * 10;
              puff.life = 1;
            });

            var back = { t: 0 };
            scene.tweens.add({
              targets: back, t: 1, duration: 420, ease: 'Sine.easeOut',
              onUpdate: function () {
                effect.clear();
                var x = targetX + (start.x - targetX) * back.t;
                var y = targetY + (start.y - targetY) * back.t;
                scene.drawTopCar(effect, vehicle, x + gc.ox, y + gc.oy, gc.L, gc.W, heading);

                var dt = 1 / 60;
                for (var p = 0; p < puffs.length; p++) {
                  var puff = puffs[p];
                  if (puff.life <= 0) continue;
                  puff.x += puff.vx * dt;
                  puff.y += puff.vy * dt;
                  puff.vy += 40 * dt;
                  puff.life -= 0.028;
                  if (puff.life < 0) puff.life = 0;
                  effect.fillStyle(0xffffff, puff.life * 0.85);
                  effect.fillCircle(puff.x, puff.y, puff.r * (1.7 - puff.life));
                }
              },
              onComplete: function () {
                effect.destroy();
                scene.processBoarding();
              }
            });
          }
        });
      };

      ParkingScene.prototype.moveVehicle = function (vehicle) {
        if (this.screen !== 'GAME' || this.paused || this.terminal || vehicle.status !== 'grid') return;
        if (vehicle.locked) {
          gameAudio.blocked();
          sendToNative({ type: 'VEHICLE_LOCKED', vehicleId: vehicle.id, keyColor: vehicle.keyColor });
          return;
        }
        if (!this.pathIsClear(vehicle)) {
          gameAudio.blocked();
          // [FIX-1] recompute a live blocker if firstBlockerId is stale (the original blocker may have already left the board)
          var blocker = null;
          if (vehicle.firstBlockerId) {
            for (var bi = 0; bi < this.vehicles.length; bi++) {
              if (this.vehicles[bi].id === vehicle.firstBlockerId && this.vehicles[bi].status === 'grid') {
                blocker = this.vehicles[bi];
                break;
              }
            }
          }
          var liveBlocker = blocker;
          if (!liveBlocker) {
            var bDir = vehicle.direction || (vehicle.orientation === 'Horizontal' ? 'East' : 'South');
            var bRowStep = bDir === 'North' ? -1 : bDir === 'South' ? 1 : 0;
            var bColStep = bDir === 'West' ? -1 : bDir === 'East' ? 1 : 0;
            var bFrontRow = vehicle.row + (bRowStep > 0 ? vehicle.length - 1 : 0);
            var bFrontCol = vehicle.column + (bColStep > 0 ? vehicle.length - 1 : 0);
            var bpr = bFrontRow + bRowStep;
            var bpc = bFrontCol + bColStep;
            while (bpr >= 0 && bpr < this.rows && bpc >= 0 && bpc < this.columns && !liveBlocker) {
              for (var li = 0; li < this.vehicles.length; li++) {
                var o = this.vehicles[li];
                if (o.id === vehicle.id || o.status !== 'grid') continue;
                var oRows = o.orientation === 'Vertical' ? o.length : 1;
                var oCols = o.orientation === 'Horizontal' ? o.length : 1;
                if (bpr >= o.row && bpr < o.row + oRows &&
                    bpc >= o.column && bpc < o.column + oCols &&
                    (o.layer || 0) >= (vehicle.layer || 0)) {
                  liveBlocker = o;
                  break;
                }
              }
              bpr += bRowStep;
              bpc += bColStep;
            }
          }
          if (liveBlocker) {
            this.bumpIntoBlocker(vehicle, liveBlocker);
          } else {
            var center = this.gridCenter(vehicle);
            var shake = { x: center.x };
            var effect = this.add.graphics().setDepth(vehicle.isoY + 5000);
            var sceneRef = this;
            var shakeHeading = this.headingForDirection(vehicle.direction);
            this.tweens.add({
              targets: shake, x: center.x + 4, duration: 45, yoyo: true, repeat: 3,
              onUpdate: function () {
                effect.clear();
                var sg = sceneRef.gridCar(vehicle);
                sceneRef.drawTopCar(effect, vehicle, shake.x + sg.ox, center.y + sg.oy, sg.L, sg.W, shakeHeading);
              },
              onComplete: function () { effect.destroy(); }
            });
            // [FIX-1] genuinely blocked but no live blocker found — show a status so the tap never feels dead
            var sceneRef2 = this;
            this.showAdStatus('That car cannot move yet.');
            this.time.delayedCall(900, function () { sceneRef2.hideAdStatus(); });
          }
          sendToNative({ type: 'CAR_BLOCKED', vehicleId: vehicle.id });
          return;
        }
        var start = this.findBayStart(vehicle.bayWidth);
        if (start < 0) {
          this.checkGridlock();
          return;
        }
        this.moves += 1;
        vehicle.status = 'moving';
        vehicle.isMoving = true;
        vehicle.bayStart = start;
        this.revealMystery(vehicle);
        this.revealMysteryBlockedBy(vehicle);
        for (var offset = 0; offset < vehicle.bayWidth; offset++) {
          this.bay[start + offset] = vehicle;
          var machine = this.bayMachines[start + offset];
          machine.state = offset === 0 ? 'arriving' : 'occupied';
          machine.vehicle = offset === 0 ? vehicle : null;
          machine.anchor = start;
        }
        this.render();

        var route = this.buildDrivingPath(vehicle, start);
        var bayPoint = route.segments[route.segments.length - 1].to;
        var motion = { t: 0 };
        var driveEffect = this.add.graphics();
        var sceneRef2 = this;
        driveEffect.setDepth(vehicle.isoY + 5000);
        var gc = this.gridCar(vehicle);
        var bayDims = this.bayCarSize(vehicle);
        var duration = Math.max(1100, Math.min(2800, route.totalDistance * 2.1));
        this.tweens.add({
          targets: motion, t: 1, duration: duration, ease: 'Linear',
          onUpdate: function () {
            driveEffect.clear();
            var distanceAt = motion.t * route.totalDistance;
            var segmentIndex = route.segments.length - 1;
            for (var segment = 0; segment < route.segments.length; segment++) {
              if (distanceAt <= route.segments[segment].startDistance + route.segments[segment].distance) {
                segmentIndex = segment;
                break;
              }
            }
            var currentSegment = route.segments[segmentIndex];
            var local = Phaser.Math.Clamp(
              (distanceAt - currentSegment.startDistance) / currentSegment.distance,
              0,
              1
            );
            var eased = local * local * (3 - 2 * local);
            var x = currentSegment.from.x + (currentSegment.to.x - currentSegment.from.x) * eased;
            var y = currentSegment.from.y + (currentSegment.to.y - currentSegment.from.y) * eased;
            vehicle.isoX = x;
            vehicle.isoY = y;
            vehicle.renderDepth = vehicle.isoY + 5000;
            driveEffect.setDepth(vehicle.renderDepth);
            var headingDelta = Phaser.Math.Angle.Wrap(currentSegment.targetHeading - currentSegment.startHeading);
            var heading = currentSegment.startHeading + headingDelta * Math.min(1, local * 3);
            var finalBlend = Phaser.Math.Clamp((motion.t - 0.86) / 0.14, 0, 1);
            heading = heading + Phaser.Math.Angle.Wrap(BAY_ANGLE - heading) * finalBlend;
            vehicle.visualAngle = heading;
            var len = gc.L + (bayDims.L - gc.L) * motion.t;
            var wid = gc.W + (bayDims.W - gc.W) * motion.t;
            var fade = 1 - motion.t;
            sceneRef2.drawTopCar(driveEffect, vehicle, x + gc.ox * fade, y + gc.oy * fade, len, wid, heading);
          },
          onComplete: function () {
            vehicle.status = 'bay';
            vehicle.isMoving = false;
            vehicle.bayAligned = true;
            vehicle.visualAngle = BAY_ANGLE;
            vehicle.isoX = bayPoint.x;
            vehicle.isoY = bayPoint.y;
            vehicle.renderDepth = vehicle.isoX + vehicle.isoY;
            driveEffect.destroy();
            sceneRef2.bayMachines[start].state = 'idle';
            sceneRef2.render();
            sendToNative({ type: 'VEHICLE_PARKED', vehicleId: vehicle.id, color: vehicle.color, bayStart: start });
            sceneRef2.processBoarding();
          }
        });
      };

      ParkingScene.prototype.findBayStart = function (footprint) {
        for (var start = 0; start <= this.baySlotCount - footprint; start++) {
          var available = true;
          for (var offset = 0; offset < footprint; offset++) {
            if (!this.bayUnlocked[start + offset] || this.bay[start + offset] !== null) { available = false; break; }
          }
          if (available) return start;
        }
        return -1;
      };

      ParkingScene.prototype.requestBayUnlock = function (slot) {
        var target = slot;
        if (target === undefined || target === null || target < 0 || target >= this.baySlotCount || this.bayUnlocked[target]) {
          target = this.bayUnlocked.indexOf(false);
        }
        if (target < 0 && (this.pendingFailureRecovery || this.baySlotCount < MAX_BAY_SLOTS)) target = this.baySlotCount;
        if (target < 0) return;
        this.pendingUnlockSlot = target;
        // [ADS-7] rewarded ad via the unified ad contract (was: sendToNative({ type: 'UNLOCK_SLOT_AD' }))
        if (!this.requestRewardedAd('ADD_SLOT', { slot: target })) this.pendingUnlockSlot = -1;
      };

      ParkingScene.prototype.requestFailureRecovery = function () {
        if (this.terminal !== 'GAME_OVER') return;
        this.pendingFailureRecovery = true;
        this.requestBayUnlock();
      };

      ParkingScene.prototype.unlockBaySlot = function (slot) {
        var target = slot;
        var canAppend = this.pendingFailureRecovery || this.baySlotCount < MAX_BAY_SLOTS;
        if (target === undefined || target === null || target < 0 || target >= this.baySlotCount || this.bayUnlocked[target]) {
          target = this.pendingUnlockSlot >= 0 ? this.pendingUnlockSlot : this.bayUnlocked.indexOf(false);
        }
        if (target < 0 && canAppend) target = this.baySlotCount;
        if (target === this.baySlotCount && canAppend) {
          this.baySlotCount += 1;
          this.bay.push(null);
          this.bayUnlocked.push(true);
          this.bayMachines.push({ slot: target, state: 'idle', vehicle: null, anchor: target });
          this.unlockedBaySlots += 1;
        } else {
          if (target < 0 || target >= this.baySlotCount || this.bayUnlocked[target]) return;
          this.bayUnlocked[target] = true;
          this.unlockedBaySlots += 1;
          this.bayMachines[target].state = 'idle';
        }
        var recovered = this.pendingFailureRecovery;
        this.pendingUnlockSlot = -1;
        this.pendingFailureRecovery = false;
        if (recovered && this.terminal === 'GAME_OVER') {
          this.clearDeadlockTimer();
          this.terminal = null;
          this.paused = false;
        }
        this.layout();
        this.render();
        sendToNative({ type: 'BAY_SLOT_UNLOCKED', slot: target, unlockedBaySlots: this.unlockedBaySlots });
        if (recovered) this.processBoarding();
      };

      ParkingScene.prototype.processBoarding = function () {
        if (this.screen !== 'GAME' || this.paused || this.terminal) return;
        if (!this.passengers.length) {
          if (this.vehicles.length === 0) this.winLevel();
          return;
        }

        var scene = this;
        var started = false;
        this.bayMachines.forEach(function (machine) {
          if (machine.state !== 'idle' || !machine.vehicle) return;
          var vehicle = machine.vehicle;
          if (vehicle.status !== 'bay' || vehicle.capacity >= vehicle.seats) return;
          if (scene.passengers[0].color !== vehicle.color) return;

          var queuePoint = scene.queuePoint(0);
          var passenger = scene.passengers.shift();
          var bayPoint = scene.bayCenter(vehicle.bayStart);
          var controlA = { x: queuePoint.x, y: scene.roadY };
          var controlB = { x: bayPoint.x, y: scene.roadY };
          var motion = { t: 0 };
          var lastFootstep = -1;
          var effect = scene.add.graphics();
          var walkScale = scene.personScale() * 0.8;
          machine.state = 'boarding';
          started = true;

          scene.tweens.add({
            targets: motion, t: 1, duration: 720, ease: 'Sine.easeInOut',
            onUpdate: function () {
              effect.clear();
              var step = Math.min(5, Math.floor(motion.t * 6));
              if (step !== lastFootstep) {
                lastFootstep = step;
                gameAudio.footstep(step);
              }
              var t = motion.t;
              var inverse = 1 - t;
              var x = inverse * inverse * inverse * queuePoint.x +
                3 * inverse * inverse * t * controlA.x +
                3 * inverse * t * t * controlB.x + t * t * t * bayPoint.x;
              var y = inverse * inverse * inverse * queuePoint.y +
                3 * inverse * inverse * t * controlA.y +
                3 * inverse * t * t * controlB.y + t * t * t * bayPoint.y;
              var bounce = Math.abs(Math.sin(t * Math.PI * 12)) * 1.5;
              scene.drawPerson(effect, x, y - bounce, passenger.color, walkScale + bounce * 0.025, true);
            },
            onComplete: function () {
              effect.destroy();
              vehicle.capacity += 1;
              gameAudio.board();
              sendToNative({ type: 'PASSENGER_BOARDED', passengerColor: passenger.color, vehicleId: vehicle.id, capacity: vehicle.capacity, seats: vehicle.seats, baySlot: machine.slot });
              if (vehicle.capacity >= vehicle.seats) scene.departVehicle(vehicle, machine);
              else {
                machine.state = 'idle';
                scene.render();
                scene.processBoarding();
              }
            }
          });
        });
        if (started) this.render();
        else this.checkGridlock();
      };

      ParkingScene.prototype.departVehicle = function (vehicle, machine) {
        vehicle.status = 'departing';
        vehicle.isMoving = true;
        machine.state = 'departing';
        gameAudio.driveOff();
        this.render();
        var from = this.bayCenter(vehicle.bayStart);
        var size = this.bayCarSize(vehicle);
        var W = this.width || window.innerWidth || 400;
        var exitX = this.X(556);
        var pts = [
          from,
          { x: exitX, y: from.y + (exitX - from.x) * Math.tan(BAY_ANGLE) },
          { x: exitX, y: this.roadY },
          { x: W + size.L, y: this.roadY }
        ];
        var segs = [], total = 0;
        for (var i = 0; i < pts.length - 1; i++) {
          var d = Math.sqrt(Math.pow(pts[i + 1].x - pts[i].x, 2) + Math.pow(pts[i + 1].y - pts[i].y, 2));
          segs.push({ a: pts[i], b: pts[i + 1], d: d, start: total, h: Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) });
          total += d;
        }
        var motion = { t: 0 };
        var effect = this.add.graphics();
        var scene = this;
        effect.setDepth(vehicle.isoY + 5000);
        this.tweens.add({
          targets: motion, t: 1, duration: 950, ease: 'Sine.easeIn',
          onUpdate: function () {
            effect.clear();
            var dist = motion.t * total, idx = segs.length - 1;
            for (var s = 0; s < segs.length; s++) { if (dist <= segs[s].start + segs[s].d) { idx = s; break; } }
            var sg = segs[idx];
            var local = Phaser.Math.Clamp((dist - sg.start) / sg.d, 0, 1);
            var x = sg.a.x + (sg.b.x - sg.a.x) * local;
            var y = sg.a.y + (sg.b.y - sg.a.y) * local;
            var prev = idx > 0 ? segs[idx - 1].h : sg.h;
            var heading = prev + Phaser.Math.Angle.Wrap(sg.h - prev) * (idx > 0 ? Math.min(1, local * 4) : 1);
            vehicle.isoX = x;
            vehicle.isoY = y;
            vehicle.renderDepth = vehicle.isoY + 5000;
            effect.setDepth(vehicle.renderDepth);
            scene.drawTopCar(effect, vehicle, x, y, size.L, size.W, heading);
          },
          onComplete: function () {
            for (var offset = 0; offset < vehicle.bayWidth; offset++) {
              var baySlot = vehicle.bayStart + offset;
              scene.bay[baySlot] = null;
              scene.bayMachines[baySlot].vehicle = null;
              scene.bayMachines[baySlot].anchor = baySlot;
              scene.bayMachines[baySlot].state = scene.bayUnlocked[baySlot] ? 'idle' : 'locked';
            }
            scene.vehicles = scene.vehicles.filter(function (item) { return item.id !== vehicle.id; });
            vehicle.isMoving = false;
            if (vehicle.isKeyVehicle) {
              scene.vehicles.forEach(function (lockedVehicle) {
                if (lockedVehicle.locked && lockedVehicle.keyVehicleId === vehicle.id) {
                  lockedVehicle.locked = false;
                  sendToNative({ type: 'VEHICLE_UNLOCKED', vehicleId: lockedVehicle.id, keyColor: vehicle.color });
                }
              });
            }
            effect.destroy();
            sendToNative({ type: 'VEHICLE_DEPARTED', vehicleId: vehicle.id, coins: scene.coins });
            scene.render();
            if (!scene.vehicles.length && !scene.passengers.length) scene.winLevel();
            else scene.processBoarding();
          }
        });
      };

      ParkingScene.prototype.checkGridlock = function () {
        if (this.terminal || !this.passengers.length) return;
        var busyMachine = this.bayMachines.some(function (machine) {
          return machine.state === 'arriving' || machine.state === 'boarding' || machine.state === 'departing';
        });
        if (busyMachine) return;
        var hasAvailableSlot = this.bay.some(function (vehicle, index) {
          return this.bayUnlocked[index] && vehicle === null;
        }, this);
        if (!hasAvailableSlot && !this.getFirstPassengerMatch()) this.finish('GAME_OVER', 'BOARDING_BAY_FULL');
      };

      ParkingScene.prototype.getFirstPassengerMatch = function () {
        if (!this.passengers.length) return null;
        var wanted = this.passengers[0].color;
        var found = null;
        this.bay.some(function (vehicle) {
          if (vehicle && vehicle.status === 'bay' && vehicle.color === wanted && vehicle.capacity < vehicle.seats) {
            found = vehicle;
            return true;
          }
          return false;
        });
        return found;
      };

      ParkingScene.prototype.winLevel = function () {
        if (this.terminal) return;
        var rewardKey = String(this.level);
        if (!this.rewardedLevels[rewardKey]) {
          this.levelReward = getLevelReward(this.puzzle);
          this.rewardedLevels[rewardKey] = true;
          writeRewardLedger(this.rewardedLevels);
          this.addCoins(this.levelReward, 'LEVEL_COMPLETION');
          gameAudio.reward();
          sendToNative({ type: 'LEVEL_REWARD', level: this.level, reward: this.levelReward, coins: this.coins });
        } else {
          this.levelReward = 0;
        }
        // [ADS-8] remember the base reward so DOUBLE COINS can grant a matching bonus (0 on replayed levels)
        this._winBaseReward = this.levelReward;
        gameAudio.win();
        this.finish('WIN');
        // [ADS-9] reward-interstitial every 10 levels starting at 20
        if (this.level >= 20 && this.level % 10 === 0) {
          this._awaitingRewardInterstitial = true;
          this.enqueueAd('REWARD_INTERSTITIAL', { level: this.level });
          this.flushAdQueue();
        }
      };

      ParkingScene.prototype.finish = function (type, reason) {
        if (this.terminal) return;
        if (type === 'GAME_OVER') gameAudio.blocked();
        this.terminal = type;
        this.render();
        sendToNative({ type: type, reason: reason || undefined, level: this.level, coins: this.coins, moves: this.moves });
      };

      ParkingScene.prototype.pressModalButton = function (id, action) {
        var button = this.modalButtons && this.modalButtons[id];
        if (!button || button.disabled || this.modalActionPending) return false;
        this.modalActionPending = true;
        var scene = this;
        this.tweens.add({
          targets: button.display,
          scaleX: 0.94,
          scaleY: 0.9,
          duration: 75,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: function () {
            scene.modalActionPending = false;
            action();
          }
        });
        return true;
      };

      ParkingScene.prototype.hitVehicle = function (x, y) {
        var candidates = this.vehicles.filter(function (v) { return v.status === 'grid' && v.hitPoints; });
        candidates.sort(function (a, b) { return b.isoY - a.isoY; });
        for (var i = 0; i < candidates.length; i++) {
          var polygon = new Phaser.Geom.Polygon(candidates[i].hitPoints);
          if (Phaser.Geom.Polygon.Contains(polygon, x, y)) return candidates[i];
        }
        return null;
      };

      ParkingScene.prototype.hitCircle = function (button, x, y) {
        if (!button) return false;
        var dx = x - button.x;
        var dy = y - button.y;
        return dx * dx + dy * dy <= button.r * button.r * 1.35;
      };

      // [ADS-13] transient on-screen feedback for ad requests and stuck-car taps
      ParkingScene.prototype.showAdStatus = function (message) {
        if (this._adStatusText && this._adStatusText.active) this._adStatusText.destroy();
        var W = this.width || window.innerWidth || 400;
        var H = this.height || window.innerHeight || 800;
        this._adStatusText = this.add.text(W / 2, H / 2, message, {
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
          fontSize: this.fs(18, 12),
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: 'rgba(15,23,42,0.85)',
          padding: { x: 16, y: 10 },
          align: 'center'
        }).setOrigin(0.5).setDepth(200000);
      };

      ParkingScene.prototype.hideAdStatus = function () {
        if (this._adStatusText && this._adStatusText.active) {
          this._adStatusText.destroy();
        }
        this._adStatusText = null;
      };

      ParkingScene.prototype.buttonAt = function (id, x, y) {
        var button = this.modalButtons && this.modalButtons[id];
        var hit = button && button.hitBox;
        return !!hit && x >= hit.x && x <= hit.x + hit.width && y >= hit.y && y <= hit.y + hit.height;
      };

      ParkingScene.prototype.onPointerDown = function (pointer) {
        gameAudio.unlock();
        gameAudio.tap();
        var x = pointer.x;
        var y = pointer.y;
        var scene = this;

        if (this.screen !== 'GAME') {
          this.handleOverlayPointer(x, y);
          return;
        }

        var hud = this.hudButtons || {};

        if (this.hitCircle(hud.pause, x, y)) {
          if (this.terminal) { this.exitToLanding(); return; }
          this.paused = !this.paused;
          this.render();
          sendToNative({ type: this.paused ? 'PAUSED' : 'RESUMED', level: this.level });
          return;
        }

        if (this.terminal === 'GAME_OVER') {
          var buttons = this.modalButtons || {};
          var restart = buttons['quit-lvl'] && buttons['quit-lvl'].hitBox;
          var watchAd = buttons.ad && buttons.ad.hitBox;
          var skipAd = buttons['revive-coin'] && buttons['revive-coin'].hitBox;
          if (restart && x >= restart.x && x <= restart.x + restart.width && y >= restart.y && y <= restart.y + restart.height) {
            this.pressModalButton('quit-lvl', function () { scene.exitToLanding(); });
          } else if (watchAd && x >= watchAd.x && x <= watchAd.x + watchAd.width && y >= watchAd.y && y <= watchAd.y + watchAd.height) {
            // [ADS-7] revive via rewarded ad. The auto-quit countdown is stopped once the request is out, so a slow ad cannot kick the player to the landing screen.
            this.pressModalButton('ad', function () {
              if (scene.requestRewardedAd('REVIVE', {})) scene.clearDeadlockTimer();
            });
          } else if (skipAd && x >= skipAd.x && x <= skipAd.x + skipAd.width && y >= skipAd.y && y <= skipAd.y + skipAd.height) {
            if (!this.canAfford(40)) {
              sendToNative({ type: 'INSUFFICIENT_COINS', requiredCoins: 40, coins: this.coins });
              return;
            }
            this.pressModalButton('revive-coin', function () {
              if (!scene.spendCoins(40)) return;
              scene.pendingUnlockSlot = -1;
              scene.pendingFailureRecovery = true;
              scene.unlockBaySlot();
            });
          }
          return;
        }
        if (this.terminal === 'WIN') {
          var nextButton = this.modalButtons && this.modalButtons.next;
          var nextHitBox = nextButton && nextButton.hitBox;
          // [ADS-8] DOUBLE COINS (AD) button
          var doubleCoins = this.modalButtons && this.modalButtons['double-coins'];
          var doubleHit = doubleCoins && doubleCoins.hitBox;
          if (doubleHit && x >= doubleHit.x && x <= doubleHit.x + doubleHit.width && y >= doubleHit.y && y <= doubleHit.y + doubleHit.height) {
            this.pressModalButton('double-coins', function () {
              scene.requestRewardedAd('DOUBLE_COINS', { baseReward: scene._winBaseReward });
            });
            return;
          }
          if (nextHitBox && x >= nextHitBox.x && x <= nextHitBox.x + nextHitBox.width && y >= nextHitBox.y && y <= nextHitBox.y + nextHitBox.height) {
            // [ADS-12] NEXT LEVEL waits for the reward-interstitial (the watchdog clears this if the host never answers)
            if (scene._awaitingRewardInterstitial) return;
            this.pressModalButton('next', function () { scene._winBaseReward = 0; scene.loadLevel(scene.level + 1); });
          }
          return;
        }

        if (this.hitCircle(hud.sound, x, y)) {
          gameAudio.setMuted(gameSettings.master);
          this.render();
          sendToNative({ type: 'AUDIO_TOGGLE', muted: !gameSettings.master });
          return;
        }
        if (this.hitCircle(hud.settings, x, y)) {
          this.openSettings();
          return;
        }

        if (this.paused) {
          if (this.buttonAt('resume', x, y)) {
            this.pressModalButton('resume', function () {
              scene.paused = false;
              scene.render();
              sendToNative({ type: 'RESUMED', level: scene.level });
            });
          } else if (this.buttonAt('home', x, y)) {
            this.pressModalButton('home', function () { scene.exitToLanding(); });
          }
          return;
        }

        var boosterKeys = Object.keys(this.boosterBounds || {});
        for (var i = 0; i < boosterKeys.length; i++) {
          var bounds = this.boosterBounds[boosterKeys[i]];
          if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
            this.useBooster(boosterKeys[i]);
            return;
          }
        }
        var vehicle = this.hitVehicle(x, y);
        if (vehicle) { this.selectedVehicleId = vehicle.id; this.moveVehicle(vehicle); }
      };

      ParkingScene.prototype.useBooster = function (booster) {
        if (booster === 'SLOT') {
          this.requestBayUnlock();
          return;
        }
        var costs = { VIP: 35, SHUFFLE: 20 };
        if (!this.canAfford(costs[booster])) {
          sendToNative({ type: 'BOOSTER_UNAVAILABLE', booster: booster, requiredCoins: costs[booster] });
          return;
        }
        if (booster === 'VIP') {
          var bayColors = {};
          var availableBayCars = 0;
          this.bayMachines.forEach(function (machine) {
            var bayVehicle = machine.vehicle;
            if (machine.state === 'idle' && bayVehicle && bayVehicle.status === 'bay' && bayVehicle.capacity < bayVehicle.seats) {
              bayColors[bayVehicle.color] = true;
              availableBayCars += 1;
            }
          });
          if (!availableBayCars || !this.passengers.length) {
            sendToNative({ type: 'VIP_UNAVAILABLE', reason: 'NO_ACTIVE_BOARDING_CAR' });
            return;
          }
          var vipPassengers = [];
          var regularPassengers = [];
          for (var vp = 0; vp < this.passengers.length; vp++) {
            var queuedPassenger = this.passengers[vp];
            if (queuedPassenger && bayColors[queuedPassenger.color]) {
              queuedPassenger.vip = true;
              vipPassengers.push(queuedPassenger);
            } else {
              regularPassengers.push(queuedPassenger);
            }
          }
          if (!vipPassengers.length) {
            sendToNative({ type: 'VIP_UNAVAILABLE', reason: 'NO_MATCHING_PASSENGERS' });
            return;
          }
          if (!this.spendCoins(costs.VIP)) return;
          this.passengers = vipPassengers.concat(regularPassengers);
          sendToNative({
            type: 'VIP_PASSENGERS',
            passengerIds: vipPassengers.map(function (passenger) { return passenger.id; }),
            colors: vipPassengers.map(function (passenger) { return passenger.color; }),
            coins: this.coins
          });
        } else if (booster === 'SHUFFLE') {
          if (!this.spendCoins(costs.SHUFFLE)) return;
          for (var q = this.passengers.length - 1; q > 0; q--) {
            var swapIndex = Math.floor(Math.random() * (q + 1));
            var temp = this.passengers[q];
            this.passengers[q] = this.passengers[swapIndex];
            this.passengers[swapIndex] = temp;
          }
          sendToNative({ type: 'QUEUE_SHUFFLED', coins: this.coins });
        }
        this.render();
        this.publishState();
        this.processBoarding();
      };

      ParkingScene.prototype.handleNativeMessage = function (data) {
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (error) { data = { type: data }; }
        }
        if (!data || typeof data !== 'object') return;
        // [ADS-11] ad results from the RN host are routed first and never reach the legacy command handling
        if (data.type === 'AD_BANNER_READY' || data.type === 'AD_BANNER_FAILED' ||
            data.type === 'AD_INTERSTITIAL_RESULT' || data.type === 'AD_REWARD_RESULT' ||
            data.type === 'AD_REWARD_INTERSTITIAL_RESULT') {
          this.handleAdResult(data);
          return;
        }
        var command = data.type || data.action || data.command;
        if (command === 'SHUFFLE_QUEUE') {
          for (var i = this.passengers.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var swap = this.passengers[i];
            this.passengers[i] = this.passengers[j];
            this.passengers[j] = swap;
          }
          this.render();
          sendToNative({ type: 'QUEUE_SHUFFLED' });
          this.processBoarding();
        } else if (command === 'ADD_BAY_SLOT') {
          this.unlockBaySlot(data.slot);
        } else if (command === 'UNLOCK_SLOT_REWARDED' || command === 'REWARDED_AD_COMPLETED') {
          if (data.completed !== false && data.rewarded !== false) this.unlockBaySlot(data.slot);
        } else if (command === 'VIP_PASSENGER') {
          this.useBooster('VIP');
        } else if (command === 'PAUSE') {
          this.paused = true;
          this.render();
        } else if (command === 'RESUME') {
          this.paused = false;
          this.render();
        } else if (command === 'START_LEVEL' || command === 'SET_LEVEL') {
          this.loadLevel(data.level || 1);
        } else if (command === 'RESTART') {
          this.loadLevel(this.level);
        }
      };

      // [ADS-11] results coming back from the RN host
      ParkingScene.prototype.handleAdResult = function (data) {
        this.hideAdStatus(); // [ADS-13] any result clears the "Loading ad..." overlay
        if (data.type === 'AD_INTERSTITIAL_RESULT') {
          this._adInFlight = false;
          this._adRequestedAt = 0;
          this.processBoarding();
          this.flushAdQueue();
          this.hideAdStatus();
          return;
        }
        if (data.type === 'AD_REWARD_RESULT') { this.applyRewardResult(data); return; }
        if (data.type === 'AD_REWARD_INTERSTITIAL_RESULT') {
          this._adInFlight = false;
          this._adRequestedAt = 0;
          this._awaitingRewardInterstitial = false;
          if (data.success && data.rewardGranted) this.addCoins(50, 'LEVEL_COMPLETION');
          this.flushAdQueue();
          return;
        }
        if (data.type === 'AD_BANNER_READY' || data.type === 'AD_BANNER_FAILED') {
          return;
        }
      };

      // [ADS-4] safe request helpers. All ad traffic goes through sendToNative; nothing here assumes the host answers.
      ParkingScene.prototype.sceneBusy = function () {
        return this.bayMachines.some(function (m) {
          return m.state === 'arriving' || m.state === 'boarding' || m.state === 'departing';
        });
      };

      ParkingScene.prototype.canShowInterstitial = function (now) {
        if (this.level < 10) return false;
        now = now || Date.now();
        if (now - this._lastInterstitialAt < this._interstitialMinGapMs) return false;
        var cutoff = now - this._interstitialWindowMs;
        this._interstitialTimes = this._interstitialTimes.filter(function (t) { return t >= cutoff; });
        return this._interstitialTimes.length < this._interstitialMaxPerWindow;
      };

      ParkingScene.prototype.requestInterstitial = function (placement) {
        if (this._adInFlight || this.sceneBusy() || this.screen !== 'GAME') return false;
        if (!this.canShowInterstitial()) return false;
        var now = Date.now();
        this._lastInterstitialAt = now;
        this._interstitialTimes.push(now);
        this._adInFlight = true;
        this._adRequestedAt = now;
        this.showAdStatus('Loading ad...'); // [ADS-13]
        sendToNative({ type: 'AD_INTERSTITIAL_SHOW', level: this.level, placement: placement });
        return true;
      };

      ParkingScene.prototype.requestRewardedAd = function (rewardKind, context) {
        if (this._adInFlight) return false;
        if (this.sceneBusy()) return false; // [ADS-10] extra safety: never during a car move, boarding walk or departure
        this._adInFlight = true;
        this._adRequestedAt = Date.now();
        this._pendingRewardKind = rewardKind;
        this._pendingRewardContext = context || {};
        this.showAdStatus('Loading ad...'); // [ADS-13]
        sendToNative({ type: 'AD_REWARD_SHOW', rewardKind: rewardKind, level: this.level, context: this._pendingRewardContext });
        return true;
      };

      ParkingScene.prototype.flushAdQueue = function () {
        if (this._adInFlight || this.sceneBusy() || this.screen !== 'GAME') return;
        var next = this._adQueue.shift();
        if (!next) return;
        if (next.kind === 'INTERSTITIAL') this.requestInterstitial(next.payload.placement);
        else if (next.kind === 'REWARD') this.requestRewardedAd(next.payload.rewardKind, next.payload.context);
        else if (next.kind === 'REWARD_INTERSTITIAL') {
          // tracked as in-flight so the watchdog also covers a host that never answers
          this._adInFlight = true;
          this._adRequestedAt = Date.now();
          this.showAdStatus('Loading ad...'); // [ADS-13]
          sendToNative({ type: 'AD_REWARD_INTERSTITIAL_SHOW', level: next.payload.level, fromLevel: next.payload.level, toLevel: next.payload.level + 1 });
        }
      };

      ParkingScene.prototype.enqueueAd = function (kind, payload) {
        this._adQueue.push({ kind: kind, payload: payload });
        if (this._adQueue.length > 3) this._adQueue.shift();
      };

      // [ADS-5] banner visibility follows the screen state; requests only go out when the state actually changes
      ParkingScene.prototype.syncBannerVisibility = function () {
        var shouldShow = (this.screen === 'GAME' && !this.isLandingContext() && !this.paused && !this.terminal);
        if (shouldShow && !this._bannerVisible) {
          this._bannerVisible = true;
          sendToNative({ type: 'AD_BANNER_SHOW', level: this.level });
        } else if (!shouldShow && this._bannerVisible) {
          this._bannerVisible = false;
          sendToNative({ type: 'AD_BANNER_HIDE' });
        }
      };

      // [ADS-7] rewarded ad results (REVIVE / DOUBLE_COINS / ADD_SLOT)
      ParkingScene.prototype.applyRewardResult = function (data) {
        this._adInFlight = false;
        this._adRequestedAt = 0;
        var kind = data.rewardKind || this._pendingRewardKind;
        var ctx = data.context || this._pendingRewardContext || {};
        var success = !!data.success;
        this._pendingRewardKind = null;
        this._pendingRewardContext = null;

        // [ADS-13] any failure shows a short "skipped" message instead of a silent no-op
        if (!success) {
          var sceneFail = this;
          this.showAdStatus('Ad skipped — continuing.');
          this.time.delayedCall(1200, function () { sceneFail.hideAdStatus(); });
        }

        if (kind === 'REVIVE') {
          if (!success) { this.pendingFailureRecovery = false; this.pendingUnlockSlot = -1; this.flushAdQueue(); return; }
          this.pendingUnlockSlot = -1;
          this.pendingFailureRecovery = true;
          this.unlockBaySlot();
          this.flushAdQueue();
          return;
        }
        if (kind === 'DOUBLE_COINS') {
          if (!success) { this.flushAdQueue(); return; }
          var bonus = Math.max(0, Number(ctx.baseReward) || 0);
          if (bonus > 0) this.addCoins(bonus, 'LEVEL_COMPLETION');
          // [ADS-8] guard against double-granting: clear the stored base reward and disable the button
          this._winBaseReward = 0;
          var doubleButton = this.modalButtons && this.modalButtons['double-coins'];
          if (doubleButton) {
            doubleButton.disabled = true;
            if (doubleButton.display && doubleButton.display.active && doubleButton.display.setAlpha) doubleButton.display.setAlpha(0.45);
          }
          this.flushAdQueue();
          return;
        }
        if (kind === 'ADD_SLOT') {
          if (!success) { this.pendingUnlockSlot = -1; this.pendingFailureRecovery = false; this.flushAdQueue(); return; }
          this.unlockBaySlot(ctx.slot);
          this.flushAdQueue();
          return;
        }
        this.flushAdQueue();
      };

      ParkingScene.prototype.publishState = function () {
        if (!this.puzzle) return;
        var parked = [];
        this.bay.forEach(function (vehicle) {
          if (vehicle && parked.indexOf(vehicle) < 0) {
            parked.push(vehicle);
          }
        });
        sendToNative({
          type: 'STATE', level: this.level, coins: this.coins, moves: this.moves,
          passengersRemaining: this.passengers.length, baySlots: this.baySlotCount,
          unlockedBaySlots: this.unlockedBaySlots,
          lockedBaySlots: this.baySlotCount - this.unlockedBaySlots,
          bayUsed: parked.length,
          bayUnlocked: this.bayUnlocked.slice(),
          bay: parked.map(function (vehicle) {
            return { id: vehicle.id, type: vehicle.type, orientation: vehicle.orientation, direction: vehicle.direction, layer: vehicle.layer, locked: vehicle.locked, color: vehicle.color, capacity: vehicle.capacity, seats: vehicle.seats, bayStart: vehicle.bayStart };
          }),
          bayMachines: this.bayMachines.map(function (machine) {
            return { slot: machine.slot, state: machine.state, vehicleId: machine.vehicle ? machine.vehicle.id : null };
          }),
          vehiclesRemaining: this.vehicles.length,
          mysteryRemaining: this.vehicles.filter(function (vehicle) { return vehicle.mystery; }).length,
          status: this.terminal || (this.paused ? 'PAUSED' : 'PLAYING'),
          colorsUnlocked: this.puzzle.colors.map(function (color) { return color.key; })
        });
      };

      ParkingScene.prototype.applyTheme = function (theme) {
        this.theme = theme === 'dark' ? 'dark' : 'light';
        gameSettings.theme = this.theme;
        writeSettings(gameSettings);
        var background = this.theme === 'dark' ? '#1a1a2e' : '#8ED6FF';
        document.documentElement.style.background = background;
        document.body.style.background = background;
        document.body.classList.toggle('dark-mode', this.theme === 'dark');
        this._staticBgDirty = true;
        this.render();
      };

      ParkingScene.prototype.openSettings = function () {
        this.returnScreen = this.screen;
        this.screen = 'SETTINGS';
        this.render();
      };

      ParkingScene.prototype.enterGame = function () {
        this.screen = 'GAME';
        // [ADS-6] level-start interstitial (gated: level >= 10, frequency cap, scene idle)
        this.requestInterstitial('LEVEL_START');
        this.returnScreen = 'GAME';
        this.purchaseNotice = '';
        this.paused = false;
        this.render();
        this.cameras.main.fadeIn(320, 0, 119, 255);
        this.processBoarding();
      };

      ParkingScene.prototype.startFromLanding = function () {
        var scene = this;
        var card = this.modalCard;
        if (card && card.active) {
          this.modalActionPending = true;
          this.tweens.add({
            targets: card, alpha: 0, scaleX: 1.1, scaleY: 1.1, duration: 240, ease: 'Cubic.easeIn',
            onComplete: function () { scene.modalActionPending = false; scene.enterGame(); }
          });
        } else {
          this.enterGame();
        }
      };

      ParkingScene.prototype.exitToLanding = function () {
        this.clearDeadlockTimer();
        this.pendingFailureRecovery = false;
        this.pendingUnlockSlot = -1;
        // [ADS-6] the level reload below is a return to the landing screen, so it must not request a start ad
        this._suppressStartAd = true;
        if (this.terminal === 'WIN') { this._winBaseReward = 0; this.loadLevel(this.level + 1); }
        else if (this.terminal === 'GAME_OVER') this.loadLevel(this.level);
        this._suppressStartAd = false;
        this.screen = 'LANDING';
        this.returnScreen = 'LANDING';
        this.terminal = null;
        this.paused = false;
        this.render();
      };

      ParkingScene.prototype.updateCoinHUD = function () {
        writeStoredCoins(this.coins);
        if (this.coinHudText && this.coinHudText.active) {
          this.coinHudText.setText(String(this.coins));
          this.tweens.add({ targets: this.coinHudText, scaleX: 1.14, scaleY: 1.14, duration: 110, yoyo: true, ease: 'Back.easeOut' });
        }
        sendToNative({ type: 'COINS_UPDATED', coins: this.coins });
      };

      ParkingScene.prototype.canAfford = function (amount) {
        return Number.isFinite(amount) && amount >= 0 && this.coins >= amount;
      };

      ParkingScene.prototype.spendCoins = function (amount) {
        if (!this.canAfford(amount)) return false;
        this.coins -= amount;
        this.updateCoinHUD();
        return true;
      };

      ParkingScene.prototype.addCoins = function (amount, source) {
        if (source !== 'LEVEL_COMPLETION' && source !== 'PURCHASE') return false;
        if (source === 'PURCHASE' && !this.validatedPurchaseCredit) return false;
        if (!Number.isFinite(amount) || amount <= 0) return false;
        this.coins += Math.floor(amount);
        this.updateCoinHUD();
        return true;
      };

      ParkingScene.prototype.setAudioSetting = function (key, value) {
        gameAudio.setSetting(key, value);
        this.settings = gameSettings;
        this.render();
      };

      ParkingScene.prototype.handleOverlayPointer = function (x, y) {
        var scene = this;
        var keys = Object.keys(this.modalButtons || {});
        for (var i = 0; i < keys.length; i++) {
          var id = keys[i];
          var button = this.modalButtons[id];
          var hit = button.hitBox;
          if (!hit || x < hit.x || x > hit.x + hit.width || y < hit.y || y > hit.y + hit.height) continue;
          if (button.disabled) return true;
          if (id.indexOf('buy:') === 0) {
            this.pressModalButton(id, function () { scene.requestCoinPurchase(id.slice(4)); });
            return true;
          }
          if (id.indexOf('setting:') === 0) {
            var settingKey = id.slice(8);
            this.pressModalButton(id, function () { scene.setAudioSetting(settingKey, !gameSettings[settingKey]); });
            return true;
          }
          if (id === 'theme:light' || id === 'theme:dark') {
            this.pressModalButton(id, function () { scene.applyTheme(id.slice(6)); });
            return true;
          }
          if (id === 'settings:reset') {
            this.pressModalButton(id, function () {
              Object.assign(gameSettings, DEFAULT_SETTINGS);
              writeSettings(gameSettings);
              scene.applyTheme('light');
              scene.setAudioSetting('master', true);
            });
            return true;
          }
          if (id === 'settings:back' || id === 'shop:back') {
            this.pressModalButton(id, function () {
              scene.screen = scene.returnScreen || 'LANDING';
              scene.render();
            });
            return true;
          }
          if (id === 'play') {
            this.pressModalButton(id, function () { scene.startFromLanding(); });
            return true;
          }
          if (id === 'settings' || id === 'settings-top') {
            this.pressModalButton(id, function () { scene.openSettings(); });
            return true;
          }
          if (id === 'shop') {
            this.pressModalButton(id, function () {
              scene.returnScreen = scene.screen;
              scene.screen = 'SHOP';
              scene.purchaseNotice = '';
              scene.render();
            });
            return true;
          }
          return true;
        }
        return false;
      };

      ParkingScene.prototype.requestCoinPurchase = function (productKey) {
        var product = COIN_PRODUCTS.find(function (item) { return item.key === productKey; });
        if (!product) return;
        if (product.productId.indexOf('CONFIGURE_') === 0) {
          this.purchaseNotice = 'Store not configured. No coins were added.';
          sendToNative({ type: 'PURCHASE_COINS', productId: product.productId, coins: product.coins, priceUSD: product.price });
          this.render();
          return;
        }
        this.purchaseNotice = 'Waiting for secure store confirmation...';
        sendToNative({ type: 'PURCHASE_COINS', productId: product.productId, coins: product.coins, priceUSD: product.price });
        this.render();
      };

      ParkingScene.prototype.handleCoinPurchaseSuccess = function (data) {
        var product = COIN_PRODUCTS.find(function (item) { return item.productId === data.productId; });
        var transactionId = String(data.transactionId || data.purchaseToken || '');
        if (!product || !transactionId || this.processedPurchaseIds.has(transactionId)) return;
        this.processedPurchaseIds.add(transactionId);
        writeProcessedPurchases(Array.from(this.processedPurchaseIds));
        this.validatedPurchaseCredit = true;
        var credited = this.addCoins(product.coins, 'PURCHASE');
        this.validatedPurchaseCredit = false;
        if (!credited) return;
        this.purchaseNotice = 'Purchase successful! +' + product.coins + ' coins.';
        gameAudio.reward();
        sendToNative({ type: 'PURCHASE_CREDITED', transactionId: transactionId, coinsAdded: product.coins, coins: this.coins });
        this.render();
      };

      ParkingScene.prototype.handleCoinPurchaseFailure = function (data) {
        var cancelled = data && (data.cancelled === true || data.reason === 'cancelled');
        this.purchaseNotice = cancelled
          ? 'Purchase cancelled. No coins were charged.'
          : 'Purchase unsuccessful. No coins were added.';
        this.render();
      };

      ParkingScene.prototype.drawOverlay = function () {
        var scene = this;
        var dark = this.theme === 'dark';
        var W = this.width || window.innerWidth || 400;
        var H = this.height || window.innerHeight || 800;
        var u = this.u;

        if (this.screen !== 'LANDING') {
          this.modalBackdrop = this.add.rectangle(W / 2, H / 2, W, H, dark ? 0x020617 : 0x172033, dark ? 0.78 : 0.52).setDepth(99999).setAlpha(0);
          this.tweens.add({ targets: this.modalBackdrop, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
        }
        var card = this.add.container(W / 2, H / 2).setDepth(100000);
        this.modalCard = card;

        var addButton = function (id, label, localY, fill, widthOverride, heightOverride, localX, disabled, fontSize) {
          var bw = widthOverride || Math.min(280, W - 64);
          var bh = heightOverride || 42;
          var bx = localX || 0;
          var c = scene.add.container(bx, localY);
          var g = scene.add.graphics();
          g.fillStyle(0x07111f, 0.18);
          g.fillRoundedRect(-bw / 2, -bh / 2 + 4, bw, bh, 16);
          g.fillStyle(fill, disabled ? 0.42 : 1);
          g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
          if (!disabled) {
            g.fillStyle(0xffffff, 0.16);
            g.fillRoundedRect(-bw / 2 + 3, -bh / 2 + 3, bw - 6, bh * 0.42, 13);
            g.lineStyle(1, 0xffffff, 0.22);
            g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
          }
          var t = scene.add.text(0, 0, label, {
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
            fontSize: fontSize || '13px', fontStyle: 'bold', color: disabled ? '#94A0B2' : '#FFFFFF', align: 'center'
          }).setOrigin(0.5);
          if (t.setResolution) t.setResolution(scene.textRes());
          c.add([g, t]); card.add(c); c.setSize(bw, bh);
          scene.modalButtons[id] = { display: c, disabled: !!disabled, hitBox: {
            x: (W - bw) / 2 + bx, y: H / 2 + localY - bh / 2, width: bw, height: bh
          }};
          return c;
        };
        var addPanel = function (w, h, accent) {
          var g = scene.add.graphics();
          g.fillStyle(0x07111f, dark ? 0.42 : 0.16); g.fillRoundedRect(-w / 2 + 2, -h / 2 + 8, w, h, 26);
          g.fillStyle(dark ? 0x182238 : 0xffffff, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
          g.lineStyle(1, dark ? 0x33425d : 0xe4e9f2, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
          g.fillStyle(accent, 1); g.fillRoundedRect(-w / 2 + 18, -h / 2 + 16, 42, 5, 2.5);
          card.add(g); return g;
        };
        var font = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        var res = this.textRes();

        if (this.screen === 'LANDING') {
          var ax = function (v) { return scene.X(v) - W / 2; };
          var ay = function (v) { return scene.Y(v) - H / 2; };
          var lt = function (x, y, str, style) {
            var t = scene.add.text(ax(x), ay(y), str, Object.assign({ fontFamily: font, fontStyle: 'bold', align: 'center' }, style));
            t.setOrigin(0.5);
            if (t.setResolution) t.setResolution(res);
            card.add(t);
            return t;
          };

          lt(306, 93, 'LEVEL ' + this.level, {
            fontSize: scene.fs(58, 30), color: '#FFFFFF', letterSpacing: 2,
            shadow: { offsetX: 0, offsetY: 3, color: '#1f5fa6', blur: 8, fill: true }
          });
          lt(306, 144, 'YOUR CURRENT LEVEL', {
            fontSize: scene.fs(17, 10), color: '#EAF6FF', letterSpacing: 3,
            shadow: { offsetX: 0, offsetY: 1, color: '#1f5fa6', blur: 4, fill: true }
          });

          var gearR = 38 * u;
          var gearC = scene.add.container(ax(540), ay(93));
          var gearG = scene.add.graphics();
          gearG.fillStyle(0x0d2f66, 0.3);
          gearG.fillCircle(0, 3, gearR);
          gearG.fillStyle(0x3f5f8f, 0.95);
          gearG.fillCircle(0, 0, gearR);
          gearG.lineStyle(2, 0x7da0cf, 1);
          gearG.strokeCircle(0, 0, gearR);
          scene.drawGear(gearG, 0, 0, gearR * 0.5, 0xffffff, 0x3f5f8f);
          gearC.add(gearG);
          card.add(gearC);
          gearC.setSize(gearR * 2, gearR * 2);
          this.modalButtons['settings-top'] = { display: gearC, disabled: false, hitBox: { x: scene.X(540) - gearR, y: scene.Y(93) - gearR, width: gearR * 2, height: gearR * 2 } };

          var cardX = ax(30), cardY = ay(268), cardW = scene.X(543), cardH = scene.Y(610), cr = 30 * u;
          var lg = scene.add.graphics();
          card.add(lg);
          lg.fillStyle(0x1b5fa8, 0.28);
          lg.fillRoundedRect(cardX + 3, cardY + 8, cardW, cardH, cr);
          lg.fillStyle(0xe8f3fd, 1);
          lg.fillRoundedRect(cardX, cardY, cardW, cardH, cr);
          lg.lineStyle(Math.max(2, 3 * u), 0xffffff, 1);
          lg.strokeRoundedRect(cardX, cardY, cardW, cardH, cr);
          lt(306, 303, 'CURRENT PARKING JAM', { fontSize: scene.fs(22, 12), color: '#14407f', letterSpacing: 1.8 });

          var pvX = ax(66), pvY = ay(343), pvW = scene.X(474), pvH = scene.Y(449);
          var fr = Math.max(4, 7 * u);
          lg.fillStyle(0x000000, 0.25);
          lg.fillRoundedRect(pvX - fr + 2, pvY - fr + 6, pvW + fr * 2, pvH + fr * 2, 16 * u);
          lg.fillStyle(0x9aa2ad, 1);
          lg.fillRoundedRect(pvX - fr, pvY - fr + 3, pvW + fr * 2, pvH + fr * 2, 16 * u);
          lg.fillStyle(0xd5dae0, 1);
          lg.fillRoundedRect(pvX - fr, pvY - fr, pvW + fr * 2, pvH + fr * 2, 16 * u);
          lg.fillStyle(0x3a3f47, 1);
          lg.fillRoundedRect(pvX, pvY, pvW, pvH, 12 * u);
          lg.fillStyle(0x000000, 0.25);
          lg.fillRoundedRect(pvX, pvY, pvW, Math.max(3, 5 * u), 3);
          scene.drawBush(lg, pvX + 8 * u, pvY + 8 * u, 9 * u, dark);
          scene.drawBush(lg, pvX + pvW - 8 * u, pvY + 8 * u, 9 * u, dark);
          scene.drawBush(lg, pvX + 8 * u, pvY + pvH - 8 * u, 9 * u, dark);
          scene.drawBush(lg, pvX + pvW - 8 * u, pvY + pvH - 8 * u, 9 * u, dark);

          lg.lineStyle(Math.max(1.5, 2 * u), 0xe4e8ee, 0.8);
          lg.strokeRoundedRect(ax(90), ay(375), scene.X(298), scene.Y(397), 16 * u);

          var previewGraphics = scene.add.graphics();
          card.add(previewGraphics);
          var rows = Math.max(1, this.rows || 6);
          var cols = Math.max(1, this.columns || 6);
          var gridX = ax(98), gridY = ay(385), gridW = scene.X(284), gridH = scene.Y(377);
          var cellW = gridW / cols;
          var cellH = gridH / rows;
          lg.lineStyle(Math.max(1.2, 1.6 * u), 0xe4e8ee, 0.4);
          for (var pr = 1; pr < rows; pr++) lg.lineBetween(ax(90), gridY + pr * cellH, gridX + cellW * 1.2, gridY + pr * cellH);
          var previewVehicles = (this.puzzle && Array.isArray(this.puzzle.vehicles)) ? this.puzzle.vehicles.filter(function (v) {
            return v && v.status !== 'hidden';
          }) : [];
          for (var pv = 0; pv < previewVehicles.length; pv++) {
            var vehicle = previewVehicles[pv];
            var horizontal = vehicle.orientation === 'Horizontal';
            var length = Math.max(1, Number(vehicle.length) || 1);
            var vr = Math.max(0, Math.min(rows - 1, Number(vehicle.row) || 0));
            var vc = Math.max(0, Math.min(cols - 1, Number(vehicle.column) || 0));
            var span = horizontal ? Math.min(length, cols - vc) : Math.min(length, rows - vr);
            var pcx = gridX + (vc + (horizontal ? span / 2 : 0.5)) * cellW;
            var pcy = gridY + (vr + (horizontal ? 0.5 : span / 2)) * cellH;
            var cs = Math.min(cellW, cellH);
            scene.drawTopCar(previewGraphics, vehicle, pcx + cs * 0.05, pcy + cs * 0.12, cs * (span - 0.65), cs * 0.82, scene.headingForDirection(vehicle.direction));
          }

          var bayX = ax(428), bayY = ay(405), bayW = scene.X(75), bayH = scene.Y(335);
          var pGeom = scene.slantGeom(bayX, bayY, bayW, bayH, MAX_BAY_SLOTS);
          scene.drawBaySlab(lg, pGeom);
          scene.drawSlantedBay(lg, pGeom, makeBayUnlocked(), Math.max(1.5, 2 * u));
          var bayColors = ['YELLOW', 'BLUE', 'PINK', 'GREEN'];
          var pSize = scene.slantCarSize(pGeom);
          for (var bs = 0; bs < bayColors.length; bs++) {
            var pc = scene.slantCenter(pGeom, bs);
            scene.drawTopCar(previewGraphics, { color: bayColors[bs], type: 'COMPACT', mystery: false }, pc.x, pc.y, pSize.L, pSize.W, BAY_ANGLE, 0.55);
          }
          scene.drawArrowLine(lg, ax(525), ay(498), ax(525), ay(452), 11 * u, 0xe3e8f0, Math.max(2, 2.6 * u), 0.9);
          scene.drawArrowLine(lg, ax(525), ay(660), ax(525), ay(706), 11 * u, 0xe3e8f0, Math.max(2, 2.6 * u), 0.9);
          lt(526, 576, 'BOARDING BAY', { fontSize: scene.fs(17, 9), color: '#e3e8f0', letterSpacing: 2.5 }).setAngle(90);

          var vehicleCount = previewVehicles.length;
          var colorCount = this.puzzle && Array.isArray(this.puzzle.colors) ? this.puzzle.colors.length : 0;
          lt(301, 837, vehicleCount + ' CARS  \u2022  ' + colorCount + ' COLORS', { fontSize: scene.fs(18, 10), color: '#2f5d96', letterSpacing: 2 });

          var playW = scene.X(486), playH = scene.Y(112), playR = playH * 0.34;
          var playButton = scene.add.container(ax(301), ay(994));
          var pg = scene.add.graphics();
          pg.fillStyle(0x075c27, 0.35);
          pg.fillRoundedRect(-playW / 2, -playH / 2 + 7, playW, playH, playR);
          pg.fillStyle(0x1fc760, 1);
          pg.fillRoundedRect(-playW / 2, -playH / 2, playW, playH, playR);
          pg.fillStyle(0x6bea96, 0.35);
          pg.fillRoundedRect(-playW / 2 + 5, -playH / 2 + 5, playW - 10, playH * 0.42, playR * 0.8);
          pg.lineStyle(Math.max(2.5, 4 * u), 0xa3f3c3, 1);
          pg.strokeRoundedRect(-playW / 2, -playH / 2, playW, playH, playR);
          var triS = playH * 0.3;
          var triX = scene.X(227 - 301);
          pg.fillStyle(0xffffff, 1);
          pg.fillTriangle(triX - triS * 0.7, -triS, triX - triS * 0.7, triS, triX + triS * 0.95, 0);
          var playText = scene.add.text(scene.X(329 - 301), 0, 'PLAY', {
            fontFamily: font, fontSize: scene.fs(50, 24), fontStyle: 'bold', color: '#FFFFFF', align: 'center',
            shadow: { offsetX: 0, offsetY: 3, color: '#0b6b30', blur: 4, fill: true }
          }).setOrigin(0.5);
          if (playText.setResolution) playText.setResolution(res);
          playButton.add([pg, playText]);
          card.add(playButton);
          playButton.setSize(playW, playH);
          this.modalButtons['play'] = { display: playButton, disabled: false, hitBox: { x: scene.X(58), y: scene.Y(938), width: playW, height: playH } };

          var smW = scene.X(235), smH = scene.Y(76), smR = smH * 0.32;
          var makeSmall = function (id, centerX, label, iconKind, iconLocalX, textLocalX) {
            var c = scene.add.container(ax(centerX), ay(1115));
            var g = scene.add.graphics();
            g.fillStyle(0x0b3a8f, 0.35);
            g.fillRoundedRect(-smW / 2, -smH / 2 + 5, smW, smH, smR);
            g.fillStyle(0x1b63d8, 1);
            g.fillRoundedRect(-smW / 2, -smH / 2, smW, smH, smR);
            g.fillStyle(0x6aa4f7, 0.3);
            g.fillRoundedRect(-smW / 2 + 4, -smH / 2 + 4, smW - 8, smH * 0.4, smR * 0.8);
            g.lineStyle(Math.max(2, 3 * u), 0x4f93f2, 1);
            g.strokeRoundedRect(-smW / 2, -smH / 2, smW, smH, smR);
            if (iconKind === 'gear') {
              scene.drawGear(g, scene.X(iconLocalX), 0, 17 * u, 0xffffff, 0x1b63d8);
            } else {
              g.fillStyle(0xd98f0c, 1);
              g.fillCircle(scene.X(iconLocalX), 1.5, 19 * u);
              g.fillStyle(0xf8bc1b, 1);
              g.fillCircle(scene.X(iconLocalX), 0, 19 * u);
              g.lineStyle(2, 0xffe27a, 1);
              g.strokeCircle(scene.X(iconLocalX), 0, 12 * u);
            }
            var t = scene.add.text(scene.X(textLocalX), 0, label, {
              fontFamily: font, fontSize: scene.fs(22, 11), fontStyle: 'bold', color: '#FFFFFF', align: 'center', letterSpacing: 1
            }).setOrigin(0.5);
            if (t.setResolution) t.setResolution(res);
            c.add([g, t]);
            card.add(c);
            c.setSize(smW, smH);
            scene.modalButtons[id] = { display: c, disabled: false, hitBox: { x: scene.X(centerX) - smW / 2, y: scene.Y(1115) - smH / 2, width: smW, height: smH } };
          };
          makeSmall('settings', 175.5, 'SETTINGS', 'gear', 112 - 175.5, 204 - 175.5);
          makeSmall('shop', 429, 'COIN SHOP', 'coin', 366 - 429, 460 - 429);

          this.landingPreview = previewGraphics;
          this.landingPreviewBaseY = cardY;
        } else if (this.screen === 'SETTINGS') {
          var sw = Math.min(350, W - 26);
          var k = Math.min(1, (H - 30) / 495);
          var sh = 495 * k;
          var top = -sh / 2;
          var Y = function (v) { return top + v * k; };
          addPanel(sw, sh, 0x8b6cff);
          card.add(scene.add.text(0, Y(40), 'SETTINGS', { fontFamily: font, fontSize: '24px', fontStyle: 'bold', color: dark ? '#F8FAFC' : '#25314A' }).setOrigin(0.5));
          card.add(scene.add.text(-sw / 2 + 28, Y(76), 'AUDIO', { fontFamily: font, fontSize: '12px', fontStyle: 'bold', color: '#8B6CFF' }).setOrigin(0, 0.5));
          var rowsDef = [{ key: 'master', label: 'Master Audio' }, { key: 'music', label: 'Music' }, { key: 'sfx', label: 'Sound Effects' }, { key: 'vehicleSounds', label: 'Vehicle Sounds' }, { key: 'honks', label: 'Honks' }];
          rowsDef.forEach(function (row, index) {
            var y = Y(106 + index * 40);
            card.add(scene.add.text(-sw / 2 + 28, y, row.label, { fontFamily: font, fontSize: '14px', fontStyle: 'bold', color: dark ? '#D9E1EE' : '#2f3d57' }).setOrigin(0, 0.5));
            var on = !!gameSettings[row.key];
            addButton('setting:' + row.key, on ? 'ON' : 'OFF', y, on ? 0x36b98a : 0x68758A, 78, 28, sw / 2 - 67, false, '13px');
          });
          card.add(scene.add.text(0, Y(312), 'APPEARANCE', { fontFamily: font, fontSize: '12px', fontStyle: 'bold', color: '#8B6CFF' }).setOrigin(0.5));
          addButton('theme:light', 'LIGHT', Y(346), this.theme === 'light' ? 0x5b7cff : 0x68758A, 110, 32, -60, false);
          addButton('theme:dark', 'DARK', Y(346), this.theme === 'dark' ? 0x5b7cff : 0x68758A, 110, 32, 60, false);
          addButton('settings:reset', 'RESET SETTINGS', Y(398), dark ? 0x3a4a68 : 0x8794aa, 160, 34, 0, false, '12px');
          addButton('settings:back', 'BACK', Y(452), 0x5b7cff, 145, 38, 0, false, '14px');
        } else if (this.screen === 'SHOP') {
          var cw = Math.min(365, W - 20), ch = Math.min(455, H - 24), ct = -ch / 2;
          addPanel(cw, ch, 0x36b98a);
          card.add(scene.add.text(0, ct + 40, 'COIN SHOP', { fontFamily: font, fontSize: '24px', fontStyle: 'bold', color: dark ? '#F8FAFC' : '#25314A' }).setOrigin(0.5));
          card.add(scene.add.text(0, ct + 68, 'YOUR BALANCE  \u2022  ' + this.coins.toLocaleString() + ' COINS', { fontFamily: font, fontSize: '12px', fontStyle: 'bold', color: '#8A6417' }).setOrigin(0.5));
          var pw = (cw - 46) / 2, ph = 70, start = ct + 112;
          COIN_PRODUCTS.forEach(function (product, index) {
            var col = index % 2, row = Math.floor(index / 2), x = col === 0 ? -pw / 2 - 5 : pw / 2 + 5, y = start + row * 80;
            var pgr = scene.add.graphics(); pgr.fillStyle(dark ? 0x202d43 : 0xf5f7fb, 1); pgr.fillRoundedRect(x - pw / 2, y - 32, pw, ph, 16); pgr.lineStyle(1, index === 0 ? 0x36b98a : (dark ? 0x35445e : 0xe0e6ef), 1); pgr.strokeRoundedRect(x - pw / 2, y - 32, pw, ph, 16); card.add(pgr);
            card.add(scene.add.text(x, y - 16, product.coins.toLocaleString(), { fontFamily: font, fontSize: '16px', fontStyle: 'bold', color: dark ? '#F8FAFC' : '#2a3750' }).setOrigin(0.5));
            card.add(scene.add.text(x, y + 2, 'COINS', { fontFamily: font, fontSize: '10px', fontStyle: 'bold', color: dark ? '#8C9AB0' : '#6a7790' }).setOrigin(0.5));
            addButton('buy:' + product.key, product.price, y + 23, index === 0 ? 0x36b98a : 0x5b7cff, pw - 16, 24, x, false, '12px');
          });
          if (this.purchaseNotice) card.add(scene.add.text(0, ct + ch - 58, this.purchaseNotice, { fontFamily: font, fontSize: '11px', color: dark ? '#AAB7C9' : '#55637d', align: 'center', wordWrap: { width: cw - 40 } }).setOrigin(0.5));
          addButton('shop:back', 'BACK', ct + ch - 28, 0x5b7cff, 140, 36, 0, false, '14px');
        }

        if (this.paused && !this.terminal && this.screen === 'GAME') {
          addPanel(280, 220, 0xf0b83d);
          card.add(scene.add.text(0, -62, 'PAUSED', { fontFamily: font, fontSize: '26px', fontStyle: 'bold', color: dark ? '#F8FAFC' : '#26324A' }).setOrigin(0.5));
          addButton('resume', 'RESUME', -10, 0x36b98a, 210, 42, 0, false, '15px');
          addButton('home', 'HOME', 44, 0x5b7cff, 210, 42, 0, false, '15px');
        } else if (this.terminal === 'GAME_OVER') {
          var gw = Math.min(330, W - 30);
          addPanel(gw, 270, 0xff647c);
          card.add(scene.add.text(0, -98, 'NO MORE MOVES', { fontFamily: font, fontSize: '23px', fontStyle: 'bold', color: '#E85B6A' }).setOrigin(0.5));
          var countdownText = scene.add.text(0, -62, '3', { fontFamily: font, fontSize: '28px', fontStyle: 'bold', color: '#f1c40f' }).setOrigin(0.5);
          card.add(countdownText);

          scene.clearDeadlockTimer();
          scene.deadlockCountdownVal = 3;
          scene.deadlockTimerEvent = scene.time.addEvent({
            delay: 1000,
            repeat: 2,
            callback: function () {
              if (scene.terminal !== 'GAME_OVER') { scene.clearDeadlockTimer(); return; }
              scene.deadlockCountdownVal--;
              if (countdownText && countdownText.active) countdownText.setText(String(Math.max(0, scene.deadlockCountdownVal)));
              if (scene.deadlockCountdownVal <= 0) {
                scene.pendingFailureRecovery = false;
                scene.pendingUnlockSlot = -1;
                scene.exitToLanding();
              }
            }
          });

          card.add(scene.add.text(0, -26, 'Revive to keep your streak going!', { fontFamily: font, fontSize: '13px', fontStyle: 'bold', color: dark ? '#AAB7C9' : '#55637d', align: 'center' }).setOrigin(0.5));
          addButton('revive-coin', 'REVIVE (40 \ud83e\ude99)', 20, 0x27ae60, gw - 46, 38, 0, false, '14px');
          addButton('ad', 'WATCH AD \ud83d\udcfa', 64, 0x2980b9, gw - 46, 38, 0, false, '14px');
          addButton('quit-lvl', 'QUIT LEVEL', 108, 0xc0392b, gw - 46, 34, 0, false, '14px');
          this.failureButtons = { restart: this.modalButtons['quit-lvl'], ad: this.modalButtons.ad, skip: this.modalButtons['revive-coin'] };
        } else if (this.terminal === 'WIN') {
          var rw = Math.min(325, W - 30);
          // [ADS-8] difficult-level rule: level 5+, every multiple of 5, and every level from 15 upward
          var isDifficult = this.level >= 5 && (this.level % 5 === 0 || this.level >= 15);
          addPanel(rw, isDifficult ? 285 : 245, 0x36b98a);
          card.add(scene.add.text(0, -88, '\u2605 \u2605 \u2605', { fontFamily: font, fontSize: '26px', fontStyle: 'bold', color: '#F5B82E' }).setOrigin(0.5));
          card.add(scene.add.text(0, -52, 'LEVEL ' + this.level + ' COMPLETE', { fontFamily: font, fontSize: '22px', fontStyle: 'bold', color: '#2f9a74' }).setOrigin(0.5));
          card.add(scene.add.text(0, -16, '+' + this.levelReward + ' COINS', { fontFamily: font, fontSize: '20px', fontStyle: 'bold', color: '#8a6417' }).setOrigin(0.5));
          card.add(scene.add.text(0, 14, 'Great parking. Next level gets trickier.', { fontFamily: font, fontSize: '12px', fontStyle: 'bold', color: dark ? '#9BAAC2' : '#5d6a80' }).setOrigin(0.5));
          addButton('next', 'NEXT LEVEL', isDifficult ? 52 : 70, 0x36b98a, rw - 46, 44, 0, false, '15px');
          if (isDifficult) {
            // disabled when there is no base reward to double (replayed level) or it was already granted
            addButton('double-coins', 'DOUBLE COINS (AD)', 112, 0x5b7cff, rw - 46, 36, 0, !(this._winBaseReward > 0), '14px');
          }
          this.nextLevelButton = this.modalButtons.next;
        }
        card.setScale(0.92);
        scene.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
      };

      var config = {
        type: Phaser.AUTO,
        parent: 'game',
        transparent: true,
        backgroundColor: 'rgba(0,0,0,0)',
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: '100%', height: '100%' },
        render: { antialias: true, roundPixels: true, resolution: Math.min(1.5, window.devicePixelRatio || 1) },
        input: { activePointers: 2 },
        scene: [ParkingScene]
      };
      new Phaser.Game(config);
    })();
  </script>
</body>
</html>`;

export default gameHTML;