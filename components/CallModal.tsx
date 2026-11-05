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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-3xl h-[70vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border border-slate-800">
        <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
          {remoteUsers.length > 0 && isVideo ? (
            <div ref={remoteContainerRef} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-slate-100 space-y-2">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-2xl font-bold text-rose-400 animate-pulse">
                LC
              </div>
              <p className="text-sm font-bold text-slate-200">Room: {channelName}</p>
              <p className="text-xs text-slate-400">
                {remoteUsers.length > 0 ? "Call Connected" : "Connecting..."}
              </p>
            </div>
          )}

          {isVideo && (
            <div
              ref={localContainerRef}
              className="absolute bottom-4 right-4 w-32 h-44 rounded-2xl overflow-hidden border border-rose-500 shadow-2xl bg-black"
            />
          )}
        </div>

        <div className="h-18 bg-slate-900 flex items-center justify-center gap-3 px-6 border-t border-slate-800">
          <button
            onClick={onToggleMute}
            className={`p-3.5 rounded-xl transition-colors ${
              isAudioMuted ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {isVideo && (
            <button
              onClick={onToggleVideo}
              className={`p-3.5 rounded-xl transition-colors ${
                !isVideoEnabled ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {!isVideoEnabled ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
          )}

          <button
            onClick={onEndCall}
            className="p-3.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
