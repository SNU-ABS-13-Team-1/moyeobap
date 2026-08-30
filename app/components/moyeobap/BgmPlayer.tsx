'use client';

import { useEffect, useRef, useState } from 'react';

const BGM_STORAGE_KEY = 'moyeobap:bgm:playing';
const BGM_TRACK_KEY = 'moyeobap:bgm:track';
const BGM_VOLUME = 0.5;

type Track = {
  id: string;
  title: string;
  src: string;
  /** 인트로를 건너뛸 초. 0이면 처음부터 재생합니다. */
  startSec: number;
};

// 원본이 m4a(AAC)인 곡은 그대로 둡니다. mp3로 다시 인코딩하면 손실을 한 번 더
// 얹으면서 파일만 커지고, Safari·Chrome·Whale 모두 m4a를 그대로 재생합니다.
const TRACKS: Track[] = [
  { id: 'moyeobap', title: '다같이 모여밥', src: '/bgm.mp3', startSec: 64.5 },
  { id: 'girlgroup', title: '걸그룹모여', src: '/bgm-girlgroup.mp3', startSec: 0 },
  { id: 'acoustic', title: '모여쿠스틱', src: '/bgm-acoustic.mp3', startSec: 0 },
  { id: 'adventure', title: '김프랫의 대모험', src: '/bgm-adventure.m4a', startSec: 0 },
  { id: 'daily', title: '김프로그의 일상', src: '/bgm-daily.m4a', startSec: 0 },
];

/**
 * 인트로를 건너뛴 지점으로 이동합니다.
 *
 * 메타데이터를 아직 못 받았으면 currentTime을 넣어도 그냥 무시됩니다.
 * 그러면 인트로가 그대로 나가 버리므로, 그때는 로드된 뒤에 한 번 더 시도합니다.
 */
function seekToStart(audio: HTMLAudioElement, sec: number) {
  if (sec <= 0) return;
  const apply = () => {
    try {
      audio.currentTime = sec;
    } catch {
      // 아직 이동할 수 없는 상태면 그냥 처음부터 나갑니다.
    }
  };
  if (audio.readyState >= 1) apply();
  else audio.addEventListener('loadedmetadata', apply, { once: true });
}

export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [pickerOpen, setPickerOpen] = useState(false);

  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setIsPlaying(localStorage.getItem(BGM_STORAGE_KEY) === 'true');
    const saved = localStorage.getItem(BGM_TRACK_KEY);
    if (saved && TRACKS.some((t) => t.id === saved)) setTrackId(saved);
  }, []);

  // 곡이 끝나면 인트로를 건너뛴 지점부터 다시 돌립니다.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleEnded() {
      seekToStart(audio!, track.startSec);
      audio!.play().catch(() => {});
    }

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [track.startSec]);

  // 재생·정지·곡 바꾸기를 전부 이 효과 하나에서만 다룹니다. 버튼 쪽에서도 play()를
  // 부르면 곡을 바꿀 때 두 요청이 겹쳐 서로를 끊습니다.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !mounted) return undefined;

    audio.volume = BGM_VOLUME;
    localStorage.setItem(BGM_STORAGE_KEY, String(isPlaying));
    localStorage.setItem(BGM_TRACK_KEY, track.id);

    if (!isPlaying) {
      audio.pause();
      return undefined;
    }

    const swapping = !audio.src.endsWith(track.src);
    if (swapping) audio.src = track.src;
    // 이미 인트로를 지나 듣던 중이면 그대로 이어 갑니다(껐다 켤 때 처음으로 안 돌아가게).
    if (audio.currentTime < track.startSec) seekToStart(audio, track.startSec);

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      audio.play().catch((error: unknown) => {
        // 새 곡을 불러오느라 끊긴 것(AbortError)은 정상입니다. 이걸 실패로 보면
        // 곡을 고르는 순간 음악이 꺼져 버립니다. 자동재생 차단일 때만 끕니다.
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setIsPlaying(false);
      });
    };

    // 곡을 갈아끼운 직후에는 아직 틀 수 없어서, 준비되면 그때 시작합니다.
    if (swapping && audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      audio.addEventListener('canplay', start, { once: true });
    } else {
      start();
    }

    return () => {
      cancelled = true;
      audio.removeEventListener('canplay', start);
    };
  }, [isPlaying, mounted, track]);

  // 바깥을 누르면 곡 목록을 닫습니다.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    function onDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPickerOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  if (!mounted) return null;

  function choose(next: Track) {
    setTrackId(next.id);
    setPickerOpen(false);
  }

  const label = `BGM ON · ${track.title}`;

  return (
    <div className="header__bgm" ref={pickerRef}>
      <audio preload="metadata" ref={audioRef} src={track.src} />

      <button
        aria-label={isPlaying ? '배경음악 끄기' : '배경음악 켜기'}
        aria-pressed={isPlaying}
        className={`header__bgm-btn ${isPlaying ? 'header__bgm-btn--playing' : ''}`}
        onClick={() => setIsPlaying((prev) => !prev)}
        title={isPlaying ? '배경음악 끄기' : '배경음악 켜기'}
        type="button"
      >
        <div className="header__bgm-waves" aria-hidden="true">
          <span className="header__bgm-bar header__bgm-bar--1" />
          <span className="header__bgm-bar header__bgm-bar--2" />
          <span className="header__bgm-bar header__bgm-bar--3" />
          <span className="header__bgm-bar header__bgm-bar--4" />
        </div>

        {/* 꺼져 있을 때는 흐르지 않습니다. 나오는 곡이 없는데 제목이 흐르면
            지금 재생 중인 것처럼 보이기 때문입니다. 곡 이름은 옆 목록 버튼에서 봅니다. */}
        {isPlaying ? (
          <span className="header__bgm-marquee">
            {/* 같은 문구를 두 벌 깔고 한 벌 길이만큼 밀어야 이음매 없이 계속 흐릅니다. */}
            <span className="header__bgm-track">
              <span className="header__bgm-text">{label}</span>
              <span aria-hidden="true" className="header__bgm-text">{label}</span>
            </span>
          </span>
        ) : (
          <span className="header__bgm-text">BGM OFF</span>
        )}
      </button>

      <button
        aria-expanded={pickerOpen}
        aria-haspopup="listbox"
        aria-label={`노래 고르기 (지금 ${track.title})`}
        className={`header__bgm-pick ${pickerOpen ? 'header__bgm-pick--open' : ''}`}
        onClick={() => setPickerOpen((prev) => !prev)}
        title={`노래 고르기 (지금 ${track.title})`}
        type="button"
      >
        ♫
      </button>

      {pickerOpen && (
        <ul className="header__bgm-list" role="listbox">
          <li className="header__bgm-list-head" role="presentation">모여밥 주제가</li>
          {TRACKS.map((item) => (
            <li key={item.id} role="presentation">
              <button
                aria-selected={item.id === track.id}
                className={`header__bgm-option ${item.id === track.id ? 'is-current' : ''}`}
                onClick={() => choose(item)}
                role="option"
                type="button"
              >
                <span className="header__bgm-option-check" aria-hidden="true">
                  {item.id === track.id ? '♪' : ''}
                </span>
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
