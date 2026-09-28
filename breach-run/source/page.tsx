"use client";

import { useEffect, useRef } from "react";
import { startGame, type GameHandle, type GameInput } from "./game";

const controls: Array<{ key: GameInput; label: string; hint: string }> = [
  { key: "left", label: "◀", hint: "A" },
  { key: "right", label: "▶", hint: "D" },
  { key: "jump", label: "JUMP", hint: "SPACE" },
  { key: "smash", label: "SMASH", hint: "J / Z" },
  { key: "dash", label: "DASH", hint: "K / X" },
  { key: "slam", label: "SLAM", hint: "S / ↓" },
];

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    gameRef.current = startGame(canvasRef.current);
    return () => gameRef.current?.destroy();
  }, []);

  const press = (key: GameInput, down: boolean) => gameRef.current?.input(key, down);

  return (
    <main className="game-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">PROCEDURAL DEMOLITION TEST // BUILD 01</p>
          <h1>BREACH RUN</h1>
        </div>
        <button className="seed-button" onClick={() => gameRef.current?.newSeed()} type="button">
          NEW BLOCK
        </button>
      </header>

      <section className="cabinet" aria-label="Breach Run game demo">
        <div className="screen-bezel">
          <canvas
            ref={canvasRef}
            width={480}
            height={270}
            tabIndex={0}
            aria-label="Playable pixel-art demolition game. Clear a route through the building before the armored transporter arrives."
          />
          <div className="scanlines" aria-hidden="true" />
        </div>

        <div className="controls" aria-label="Touch controls">
          {controls.map((control) => (
            <button
              className={`control control-${control.key}`}
              key={control.key}
              type="button"
              aria-label={`${control.label}, keyboard ${control.hint}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                press(control.key, true);
              }}
              onPointerUp={() => press(control.key, false)}
              onPointerCancel={() => press(control.key, false)}
              onLostPointerCapture={() => press(control.key, false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") press(control.key, true);
              }}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ") press(control.key, false);
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <span>{control.label}</span>
              <small>{control.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <p>Clear the marked transport lane. Break supports. Expect consequences.</p>
        <p className="reset-hint">R — RESTART &nbsp; N — NEW SEED</p>
      </footer>
    </main>
  );
}
