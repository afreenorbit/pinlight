import Icon from "../components/Icon.jsx";
import { lazy, Suspense } from "react";
import Blob from "../arena/Blob.jsx";
import { bots } from "../../shared/arena/bots.js";
import "../arena/arena.css";
const BoardScene = lazy(() => import("../learning/BoardScene.jsx"));
const paths = [
  {
    n: "01",
    tone: "butter",
    blob: "lemon",
    title: "Understand the hardware",
    text: "Explore boards, chips and sensors in 3D. Click a part, ask the tutor, make an LED blink.",
    link: "/learn",
    action: "Open the workbench",
  },
  {
    n: "02",
    tone: "lilac",
    blob: "lilac",
    title: "Question your build",
    text: "Tell us your idea and your parts. See what’s missing, what each part does and what could replace it.",
    link: "/build",
    action: "Review a build",
  },
  {
    n: "03",
    tone: "pink",
    blob: "rose",
    title: "Battle by voice",
    text: "Explain four electronics concepts out loud. Beat a bot or a friend on accuracy and clarity, then read the coach’s verdict.",
    link: "/arena",
    action: "Enter the Arena",
  },
];
export default function Home() {
  return (
    <div className="fun-home">
      <section className="fun-hero">
        <div className="fun-hero-copy">
          <span className="arena-sticker">ELECTRONICS, WITH UNDERSTANDING</span>
          <h1>
            Understand it.
            <br />
            <em>Then build it.</em>
          </h1>
          <p>
            Explore hardware in 3D, question your project’s parts, then prove
            what you know in a voice battle.
          </p>
          <div className="fun-actions">
            <a className="arena-button big" href="/arena">
              Start a battle <Icon name="play" size={18} />
            </a>
            <a className="arena-button ghost" href="/learn">
              Explore the workbench <Icon name="arrow" size={18} />
            </a>
          </div>
          <small>No account needed to play. Sign in to keep your work.</small>
        </div>
        <div className="fun-board">
          <div className="fun-board-blobs" aria-hidden="true">
            <Blob avatar="volt" mood="smug" size={64} />
            <Blob avatar="mint" mood="happy" size={56} />
          </div>
          <Suspense fallback={<div className="scene-loading">Setting up your workbench…</div>}>
            <BoardScene />
          </Suspense>
          <div className="fun-board-caption">
            <strong>Raspberry Pi 5</strong>
            <span>Drag to explore · illustrative model</span>
          </div>
        </div>
      </section>
      <section className="fun-paths">
        {paths.map((p) => (
          <a className={`fun-path tone-${p.tone}`} href={p.link} key={p.n}>
            <div className="fun-path-top">
              <span>{p.n}</span>
              <Blob avatar={p.blob} mood="happy" size={54} />
            </div>
            <h2>{p.title}</h2>
            <p>{p.text}</p>
            <strong>
              {p.action} <Icon name="arrow" size={17} />
            </strong>
          </a>
        ))}
      </section>
      <section className="fun-opponents">
        <div>
          <span className="arena-sticker">MEET YOUR OPPONENTS</span>
          <h2>Four bots. Four personalities.</h2>
          <p>
            Every bot has written answers for each concept, from spot-on to
            hilariously wrong. Who you pick decides how good they are. Or invite a friend and
            watch the scores tick up live.
          </p>
        </div>
        <div className="fun-bot-row">
          {bots.map((b) => (
            <a href="/arena" className="fun-bot" key={b.id}>
              <Blob avatar={b.avatar} mood="smug" size={70} />
              <strong>{b.name}</strong>
              <small>{b.tagline}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
