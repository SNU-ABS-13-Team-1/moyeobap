// Web Audio API 재생 엔진입니다. 브라우저 전용 API라 헤드리스로 테스트할 수
// 없고, 이 파일만 그 경계를 담당합니다(채보/판정 로직은 순수 함수로 분리해
// judgment.ts에서 테스트).
//
// 실제 모여밥 BGM(mp3)을 AudioBufferSourceNode로 재생합니다. 노트를 화면에
// 맞춰 스케줄링하는 대신, 곡을 AudioContext의 정밀한 오디오 클럭에 맞춰
// 한 번에 예약 재생합니다 — 그러면 시각 렌더링(rAF)이 어떤 이유로든
// 버벅여도 실제 음악 재생 타이밍은 전혀 흔들리지 않고, 판정도 항상 이
// 오디오 클럭을 직접 읽어서(캐시된 값이 아니라) 계산하므로 정확합니다.

type ExtendedWindow = Window & { webkitAudioContext?: typeof AudioContext };

export class RhythmAudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private songGain: GainNode;
  private startAudioTime = 0;
  private songBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  // 일부 안드로이드 기기(확인된 사례: 삼성 인터넷)에서는 rAF가 정상적으로
  // 초당 60번 넘게 도는데도 ctx.currentTime 값 자체가 매 프레임 갱신되지
  // 않고 ~100ms 단위로 계단식으로만 바뀝니다(오디오 렌더 콜백 스케줄링
  // 간격 차이로 추정 — 실제 소리는 끊기지 않고 이어지므로 하드웨어 재생
  // 자체는 매끄럽습니다, JS에서 보는 값만 뜨문뜨문입니다). 그래서 값이
  // 바뀔 때마다 (그 시점의 오디오 시각, 그 시각을 읽은 wall-clock)을
  // 기준점으로 다시 잡아 두고, 그 사이는 고해상도 wall-clock으로
  // 보간합니다 — 이러면 실제 오디오 진행에 맞춰 프레임마다 매끄럽게
  // 앞으로 가면서도, 실제 값이 갱신될 때마다 다시 맞춰지므로 장기
  // 드리프트가 쌓이지 않습니다.
  private lastRawAudioTime = 0;
  private lastWallClockMs = 0;
  private paused = false;

  constructor() {
    const Ctor = window.AudioContext || (window as ExtendedWindow).webkitAudioContext;
    this.ctx = new Ctor!();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.9;
    this.masterGain.connect(this.ctx.destination);
    this.songGain = this.ctx.createGain();
    this.songGain.gain.value = 0.8;
    this.songGain.connect(this.masterGain);
  }

  /** 곡 파일을 미리 받아서 디코딩합니다. start() 전에 반드시 완료돼 있어야 합니다. */
  async load(url: string): Promise<void> {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    this.songBuffer = await this.ctx.decodeAudioData(arrayBuffer);
  }

  get currentSongTimeMs(): number {
    const rawAudioTime = this.ctx.currentTime;
    const nowMs = performance.now();
    if (rawAudioTime !== this.lastRawAudioTime) {
      this.lastRawAudioTime = rawAudioTime;
      this.lastWallClockMs = nowMs;
    }
    // suspend() 중에는 ctx.currentTime이 그대로 멈춰 있어야 정상이므로,
    // 보간하지 않고 마지막으로 확인된 오디오 시각 그대로 얼어붙힙니다.
    const interpolatedAudioTime = this.paused ? this.lastRawAudioTime : this.lastRawAudioTime + (nowMs - this.lastWallClockMs) / 1000;
    return (interpolatedAudioTime - this.startAudioTime) * 1000;
  }

  start(): void {
    if (!this.songBuffer) throw new Error('load()를 먼저 호출해야 합니다.');
    // resume()은 프라미스지만, 유저 제스처 핸들러 안에서 동기적으로 호출만
    // 되면 브라우저가 허용합니다(완료를 기다릴 필요 없음).
    void this.ctx.resume();
    this.startAudioTime = this.ctx.currentTime;
    this.lastRawAudioTime = this.startAudioTime;
    this.lastWallClockMs = performance.now();

    const source = this.ctx.createBufferSource();
    source.buffer = this.songBuffer;
    source.connect(this.songGain);
    source.start(this.startAudioTime);
    this.source = source;
  }

  /** 일시정지. ctx.currentTime 자체가 멈추므로 currentSongTimeMs도 그대로
   * 얼어붙고, resume()하면 멈췄던 지점부터 정확히 이어집니다(노래도,
   * 판정 기준 시각도 어긋나지 않습니다). */
  suspend(): void {
    this.paused = true;
    void this.ctx.suspend();
  }

  resume(): void {
    this.paused = false;
    // 다시 시작하는 순간을 새 보간 기준점으로 잡아 둡니다 — 안 그러면
    // suspend 중 멈춰 있던 lastWallClockMs와 지금 사이의 간격이 그대로
    // "진행한 시간"으로 잘못 더해집니다.
    this.lastRawAudioTime = this.ctx.currentTime;
    this.lastWallClockMs = performance.now();
    void this.ctx.resume();
  }

  stop(): void {
    try {
      this.source?.stop();
    } catch {
      // 이미 끝난 source에 stop()을 부르면 예외가 나지만 무해합니다.
    }
    this.source?.disconnect();
    this.masterGain.disconnect();
    void this.ctx.close();
  }

  playHitBlip(): void {
    this.scheduleTone(1500, this.ctx.currentTime, 0.045, 'square', 0.1);
  }

  playMissBlip(): void {
    this.scheduleTone(160, this.ctx.currentTime, 0.09, 'sawtooth', 0.1);
  }

  private scheduleTone(freq: number, when: number, duration: number, type: OscillatorType, peakGain: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peakGain, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }
}
