"use client";
import React, { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import type { ICameraVideoTrack, IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";

interface CallModalProps {
  channelName: string;
  isVideo: boolean;
  onEndCall: () => void;
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  isAudioMuted: boolean;
  isVideoEnabled: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export default function CallModal({
  channelName,
  isVideo,
  onEndCall,
  localVideoTrack,
  remoteUsers,
  isAudioMuted,
  isVideoEnabled,
  onToggleMute,
  onToggleVideo,
}: CallModalProps) {
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localVideoTrack && localContainerRef.current) {
      localVideoTrack.play(localContainerRef.current);
    }
  }, [localVideoTrack]);

  useEffect(() => {
    const remoteUser = remoteUsers[0];
    if (remoteUser?.videoTrack && remoteContainerRef.current) {
      remoteUser.videoTrack.play(remoteContainerRef.current);
    }
  }, [remoteUsers]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl h-[75vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border border-rose-500/20">
        <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
          {remoteUsers.length > 0 && isVideo ? (
            <div ref={remoteContainerRef} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-white space-y-2">
              <div className="w-24 h-24 rounded-full bg-rose-600/30 flex items-center justify-center mx-auto text-3xl font-black text-rose-300 animate-pulse border border-rose-500/50">
                ❤️
              </div>
              <p className="text-lg font-bold text-slate-300">Room: {channelName}</p>
              <p className="text-xs text-rose-400">
                {remoteUsers.length > 0 ? "Connected" : "Waiting for partner to join..."}
              </p>
            </div>
          )}

          {isVideo && (
            <div
              ref={localContainerRef}
              className="absolute bottom-4 right-4 w-36 h-48 md:w-44 md:h-60 rounded-2xl overflow-hidden border-2 border-rose-500 shadow-2xl bg-black"
            />
          )}
        </div>

        <div className="h-20 bg-slate-900/90 backdrop-blur-md flex items-center justify-center gap-4 px-6 border-t border-slate-800">
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-full transition-all ${
              isAudioMuted ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {isAudioMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {isVideo && (
            <button
              onClick={onToggleVideo}
              className={`p-4 rounded-full transition-all ${
                !isVideoEnabled ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {!isVideoEnabled ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}

          <button
            onClick={onEndCall}
            className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/40 transition-transform active:scale-95"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}