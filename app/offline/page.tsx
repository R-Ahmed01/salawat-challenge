import Link from 'next/link';

export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="auth-screen">
      <img className="cover-mark" src="/mark.png" alt="" />
      <section className="panel auth-card">
        <p className="kicker">Offline</p>
        <h1>The group is out of reach.</h1>
        <p className="lede">
          Open the group once while you are online. After that, counting keeps working on this device and joins the
          group when you reconnect.
        </p>
        <Link className="btn btn-gold" href="/play">
          Try again
        </Link>
      </section>
    </main>
  );
}
