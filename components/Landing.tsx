import Link from 'next/link';
import { Flame, Lamps, StarMark } from './Icons';
import { Ring } from './Ring';
import { RulesList } from './Rules';

export function Landing({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="page">
      <header className="nav">
        <Link href="/" className="brand">
          <StarMark />
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

        <aside className="panel mock" aria-hidden="true">
          <div className="mock-top">
            <div>
              <p className="person-name">Hana</p>
              <p className="meta">
                <Flame /> 6 day streak
              </p>
            </div>
            <Lamps lives={3} />
          </div>
          <div className="dial mock-dial">
            <Ring value={72} goal={100} />
            <div className="dial-label">
              <strong>72</strong>
              <span>/ 100</span>
            </div>
          </div>
          <p className="phrase" lang="ar" dir="rtl">
            اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ
          </p>
          <p className="latin">Allahumma salli &apos;ala Muhammad</p>
          <div className="mock-family">
            <MockRow name="Hana" count={72} done={false} />
            <MockRow name="Yusuf" count={40} done={false} />
            <MockRow name="Ibrahim" count={100} done />
          </div>
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
        <StarMark />
        <p>Made for people who want salawat to be something they come back to together.</p>
      </footer>
    </div>
  );
}

function MockRow({ name, count, done }: { name: string; count: number; done: boolean }) {
  return (
    <div className="mock-row">
      <span>{name}</span>
      <span className="bar">
        <span style={{ width: `${count}%` }} />
      </span>
      <span>{done ? 'Done' : count}</span>
    </div>
  );
}
