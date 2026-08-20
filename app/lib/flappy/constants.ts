// Flappy 게임의 모든 튜닝 값을 한 곳에서 관리합니다. 순수 상수 파일이라
// 'use client' 컴포넌트와 다른 순수 함수 모듈(physics/difficulty/obstacles/
// scoring) 양쪽에서 안전하게 import해서 씁니다.

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 600;

export const BIRD_X = 90; // 새는 x축으로 고정, 배경/파이프가 움직입니다.
export const BIRD_RADIUS = 14; // 그리는 크기
export const BIRD_COLLISION_RADIUS = 11; // 판정은 그림보다 살짝 관대하게

export const GRAVITY = 1400; // px/s^2
export const FLAP_VELOCITY = -420; // px/s (음수 = 위로)
export const MAX_FALL_SPEED = 620; // px/s

export const PIPE_WIDTH = 62;
export const PIPE_HORIZONTAL_SPACING = 250; // 파이프 "쌍" 사이의 고정 간격

export const PIPE_SPEED_MIN = 180; // px/s, score 0
export const PIPE_SPEED_MAX = 420; // px/s, 최대 속도
export const PIPE_SPEED_MAX_SCORE = 80; // 이 점수부터 최대 속도로 고정

export const PIPE_GAP_MAX = 190; // px, score 0 (넉넉함)
export const PIPE_GAP_MIN = 120; // px, 최소 간격(항상 통과 가능한 하한선)
export const PIPE_GAP_MIN_SCORE = 60; // 이 점수부터 최소 간격으로 고정

export const MOVING_OBSTACLE_START_SCORE = 40;
export const MOVING_OBSTACLE_RADIUS = 11;
export const MOVING_OBSTACLE_AMPLITUDE_RATIO = 0.3; // 파이프 간격 대비 진폭
export const MOVING_OBSTACLE_ANGULAR_SPEED = 2.4; // rad/s

export const EDGE_BONUS_RATIO = 0.6; // 중심 대비 이 비율 밖이면 보너스
export const EDGE_BONUS_RATIO_HIGH = 0.85; // 더 아슬아슬하면 보너스 2배
export const PERFECT_RATIO = 0.12; // 중심에서 이 비율 이내면 PERFECT

export const COMBO_MULTIPLIER_TIERS: { combo: number; multiplier: number }[] = [
  { combo: 20, multiplier: 2.0 },
  { combo: 10, multiplier: 1.5 },
  { combo: 5, multiplier: 1.2 },
];
