"use client";

import { useEffect, useRef } from "react";

type PlayerProps = {
  src?: string;
  poster?: string;
  title?: string;
};

export default function Player({
  src,
  poster,
  title = "Now Playing",
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    video.src = src;
    video.load();

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <div className="player-container">
      <div className="player-header">
        <span>{title}</span>
      </div>

      {src ? (
        <video
          ref={videoRef}
          controls
          playsInline
          poster={poster}
          className="player-video"
        />
      ) : (
        <div className="player-empty">
          <div>
            <h2>Select something to watch</h2>
            <p>Choose a channel, movie, or episode to start playback.</p>
          </div>
        </div>
      )}
    </div>
  );
}
