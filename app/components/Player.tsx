"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

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
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    // always tear down any previous hls.js instance before (re)attaching
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!video || !src) return;

    const isHls = src.toLowerCase().includes("m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari plays HLS natively, no hls.js needed
      video.src = src;
      video.load();
    } else {
      video.src = src;
      video.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
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
