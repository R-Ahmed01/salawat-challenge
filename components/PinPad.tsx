'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Icons';
import type { MemberColor } from '@/lib/types';

export function PinPad({
  name,
  color,
  error,
  onSubmit,
  onBack,
}: {
  name: string;
  color: MemberColor;
  error: string | null;
  onSubmit: (pin: string) => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const sent = useRef('');
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (!error) return;
    setDigits('');
    setShake(true);
    const timer = window.setTimeout(() => setShake(false), 400);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (digits.length < 4) {
      sent.current = '';
      return;
    }
    if (sent.current === digits) return;
    sent.current = digits;
    submitRef.current(digits);
  }, [digits]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onBack();
      else if (event.key === 'Backspace') setDigits((current) => current.slice(0, -1));
      else if (/^\d$/.test(event.key)) setDigits((current) => (current + event.key).slice(0, 4));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  return (
    <section className="panel pin-screen">
      <Avatar name={name} color={color} size="lg" />
      <h1>{name}</h1>
      <p className="lede">Enter the PIN for this profile.</p>
      <div className={`pin-dots ${shake ? 'shake' : ''}`} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} className={index < digits.length ? 'on' : ''} />
        ))}
      </div>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="pin-pad">
        {keys.map((key, index) =>
          key === '' ? (
            <span key={`pad-${index}`} />
          ) : (
            <button
              key={`pad-${index}`}
              type="button"
              onClick={() =>
                setDigits((current) => (key === 'back' ? current.slice(0, -1) : (current + key).slice(0, 4)))
              }
              aria-label={key === 'back' ? 'Delete digit' : key}
            >
              {key === 'back' ? '⌫' : key}
            </button>
          ),
        )}
      </div>
      <button type="button" className="btn btn-text" onClick={onBack}>
        Back to profiles
      </button>
    </section>
  );
}
