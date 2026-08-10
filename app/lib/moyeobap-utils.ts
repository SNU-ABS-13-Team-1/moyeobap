export function getTimeRemaining(deadline: Date) {
  const total = deadline.getTime() - Date.now();
  const minutes = Math.max(0, Math.floor(total / 60000));
  const seconds = Math.max(0, Math.floor((total / 1000) % 60));
  return {
    total,
    minutes,
    seconds,
    isUrgent: total > 0 && total <= 5 * 60000,
    isExpired: total <= 0
  };
}

export function formatTime(m: number, s: number): string {
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function triggerConfetti() {
  if (typeof window === 'undefined') return;
  const colors = ['#FF6B35', '#FF8C42', '#7C5CFC', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#A78BFA', '#34D399'];

  for (let i = 0; i < 35; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 8 + 4;
    el.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 400;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      left: ${Math.random() * 100}vw;
      top: -10px;
    `;

    document.body.appendChild(el);

    const duration = 1500 + Math.random() * 2000;
    const delay = Math.random() * 500;
    const targetX = (Math.random() - 0.5) * 300;
    const rotation = Math.random() * 720 - 360;

    el.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${targetX}px, ${window.innerHeight + 50}px) rotate(${rotation}deg)`, opacity: 0 }
    ], {
      duration,
      delay,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    }).onfinish = () => el.remove();
  }
}
