import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth-screen">
      <img className="cover-mark" src="/mark.png" alt="" />
      <section className="panel auth-card">
        <p className="kicker">Lost</p>
        <h1>That page is not here.</h1>
        <Link className="btn btn-gold" href="/">
          Back home
        </Link>
      </section>
    </main>
  );
}
