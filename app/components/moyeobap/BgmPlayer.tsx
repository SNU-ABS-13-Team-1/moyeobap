'use client';

import { useEffect, useRef, useState } from 'react';

const BGM_STORAGE_KEY = 'moyeobap:bgm:playing';
const BGM_VOLUME = 0.5;
const BGM_START_SECONDS = 64.5;

export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setIsPlaying(localStorage.getItem(BGM_STORAGE_KEY) === 'true');
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleEnded() {
      audio!.currentTime = BGM_START_SECONDS;
      audio!.play().catch(() => {});
    }

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !mounted) return;

    audio.volume = BGM_VOLUME;
    localStorage.setItem(BGM_STORAGE_KEY, String(isPlaying));

    if (isPlaying) {
      audio.currentTime = BGM_START_SECONDS;
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, mounted]);

  if (!mounted) return null;

  return (
    <>
      <audio preload="auto" ref={audioRef} src="/bgm.mp3" />
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
        <span className="header__bgm-label">{isPlaying ? 'BGM ON' : 'BGM OFF'}</span>
      </button>
    </>
  );
}
