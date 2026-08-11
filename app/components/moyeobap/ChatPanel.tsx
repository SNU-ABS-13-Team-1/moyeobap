import React, { FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { ChatMessage, User } from '../../types/moyeobap';
import { fetcher } from '../../lib/fetcher';

interface ChatPanelProps {
  potId: string;
  currentUser: User;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ potId, currentUser }) => {
  const { data, mutate } = useSWR<{ messages: ChatMessage[] }>(
    `/api/pots/${potId}/messages`,
    fetcher,
    { refreshInterval: 3000 },
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText('');
    await fetch(`/api/pots/${potId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    });
    await mutate();
    setSending(false);
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__list" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-panel__empty">아직 대화가 없어요. 첫 메시지를 남겨보세요!</p>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`chat-panel__message ${m.authorId === currentUser.id ? 'chat-panel__message--mine' : ''}`}
          >
            {m.authorId !== currentUser.id && (
              <span className="chat-panel__author">{m.authorName}</span>
            )}
            <span className="chat-panel__bubble">{m.text}</span>
          </div>
        ))}
      </div>
      <form className="chat-panel__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-panel__input"
          placeholder="메시지 보내기"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="chat-panel__send" disabled={!text.trim() || sending}>
          보내기
        </button>
      </form>
    </div>
  );
};
