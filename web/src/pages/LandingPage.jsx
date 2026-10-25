import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import './LandingHero.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="ivote-hero">
      <div className="ivote-hero__particles" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <section className="ivote-hero__content" aria-labelledby="ivote-hero-title">
        <p className="ivote-hero__eyebrow">For administrators and election committees.</p>
        <h1 className="ivote-hero__title" id="ivote-hero-title">
          <span>Manage your next election</span>
          <span>with confidence.</span>
        </h1>
        <button className="ivote-hero__button" type="button" onClick={() => navigate('/login')}>
          <span>Log in to iVote</span>
          <span className="ivote-hero__arrow" aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  );
}