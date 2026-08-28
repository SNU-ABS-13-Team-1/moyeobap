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
    return (this.ctx.currentTime - this.startAudioTime) * 1000;
  }

  start(): void {
    if (!this.songBuffer) throw new Error('load()를 먼저 호출해야 합니다.');
    // resume()은 프라미스지만, 유저 제스처 핸들러 안에서 동기적으로 호출만
    // 되면 브라우저가 허용합니다(완료를 기다릴 필요 없음).
    void this.ctx.resume();
    this.startAudioTime = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.songBuffer;
    source.connect(this.songGain);
    source.start(this.startAudioTime);
    this.source = source;
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
