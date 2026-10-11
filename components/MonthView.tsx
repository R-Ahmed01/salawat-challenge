'use client';

import { useEffect, useState } from 'react';
import type { MeResponse, MonthResponse } from '@/lib/types';
import { ApiError, api } from './client-api';

export function MonthView({ data, onBack }: { data: MeResponse; onBack: () => void }) {
  const [month, setMonth] = useState(() => dataMonth(data.family.timezone));
  const [page, setPage] = useState<MonthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    api<MonthResponse>(`/api/month?month=${month}`)
      .then((next) => {
        if (!gone) setPage(next);
      })
      .catch((caught) => {
        if (!gone) setError(caught instanceof ApiError ? caught.message : 'Could not open this month.');
      });
    return () => {
      gone = true;
    };
  }, [month]);

  return (
    <section className="month">
      <div className="section-head">
        <button type="button" className="btn btn-text back" onClick={onBack}>
          Back
        </button>
        <p className="kicker">This month</p>
        <h1>{monthLabel(month)}</h1>
        <div className="month-nav">
          <button type="button" className="btn btn-text" onClick={() => setMonth((current) => shiftMonth(current, -1))}>
            Previous
          </button>
          <button type="button" className="btn btn-text" onClick={() => setMonth((current) => shiftMonth(current, 1))}>
            Next
          </button>
        </div>
      </div>
      {error ? <p className="alert">{error}</p> : null}
      {!page ? <p className="quiet">Opening the month…</p> : null}
      {page ? (
        <>
          <div className="panel house-block">
            <p className="quiet">Recited this month</p>
            <p className="household-count">
              <strong>{page.recited.toLocaleString()}</strong>
            </p>
            <p className="quiet">
              The household total is {page.householdCount.toLocaleString()} of {page.householdGoal.toLocaleString()}.
            </p>
          </div>
          <div className="panel house-block">
            <h2>Who was here</h2>
            {page.showedUp.length === 0 ? <p className="quiet">No one has recited yet this month.</p> : null}
            <ul className="calm-list">
              {page.showedUp.map((person) => (
                <li key={person.id}>
                  <span className="person-name">{person.name}</span>
                  <span className="quiet">
                    {person.days} {person.days === 1 ? 'day' : 'days'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel house-block">
            <h2>The days</h2>
            {page.days.length === 0 ? <p className="quiet">The days will gather here.</p> : null}
            <ul className="calm-list">
              {page.days.map((day) => (
                <li key={day.date}>
                  <span>{dayLabel(day.date)}</span>
                  <span className="quiet">
                    {day.total.toLocaleString()} · {day.people.map((person) => person.name).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel house-block">
            <h2>Dedications</h2>
            {page.dedications.length === 0 ? <p className="quiet">A round can be named for someone.</p> : null}
            <ul className="calm-list">
              {page.dedications.map((item) => (
                <li key={`${item.date}-${item.memberName}-${item.name}`}>
                  <span>
                    {item.count.toLocaleString()} for {item.name}
                  </span>
                  <span className="quiet">
                    {item.memberName} · {dayLabel(item.date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}

function dataMonth(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(new Date());
    return parts.slice(0, 7);
  } catch {
    return new Date().toISOString().slice(0, 7);
  }
}

function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [yearText, monthText] = month.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1));
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function dayLabel(date: string): string {
  const [yearText, monthText, dayText] = date.split('-');
  const value = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(value);
}
