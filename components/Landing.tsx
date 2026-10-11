import Link from 'next/link';
import { RulesList } from './Rules';

export function Landing({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="page">
      <header className="nav">
        <Link href="/" className="brand">
          <img className="brand-mark" src="/mark.png" alt="" />
          <span>
            Salawat <em>Challenge</em>
          </span>
        </Link>
        {loggedIn ? (
          <div className="nav-actions">
            <Link className="btn btn-gold" href="/play">
              Continue
            </Link>
          </div>
        ) : null}
      </header>

      <section className="hero">
        <div>
          <p className="kicker">For the whole group</p>
          <h1>
            Recite together.
            <br />
            <em>Keep the streak.</em>
          </h1>
          <p className="epigraph" lang="ar" dir="rtl">
            اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ
          </p>
          <p className="lede">
            A salawat challenge you play as a group. One login for the group, a profile for each person, and a daily
            goal that turns reciting into a streak worth protecting.
          </p>
          <div className="hero-actions">
            {loggedIn ? (
              <Link className="btn btn-gold" href="/play">
                Back to the group
              </Link>
            ) : (
              <>
                <Link className="btn btn-gold" href="/signup">
                  Start a group
                </Link>
                <Link className="btn btn-ghost" href="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>

        <aside className="cover-plate">
          <img className="cover-mark" src="/mark.png" alt="" />
          <p className="cover-name">
            Salawat <em>Challenge</em>
          </p>
          <p className="cover-line" lang="ar" dir="rtl">
            اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ
          </p>
        </aside>
      </section>

      <section className="rules-section">
        <div className="section-head">
          <p className="kicker">How a day works</p>
          <h2>A small game around a daily practice</h2>
        </div>
        <RulesList />
      </section>

      <footer className="site-footer">
        <img className="brand-mark" src="/mark.png" alt="" />
        <p>Made for people who want salawat to be something they come back to together.</p>
      </footer>
    </div>
  );
}
