"use client";
import { useState, useEffect } from "react";
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

export function useAgora() {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    let agoraClient: IAgoraRTCClient;
    const init = async () => {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      setClient(agoraClient);

      agoraClient.on("user-published", async (user, mediaType) => {
        await agoraClient.subscribe(user, mediaType);
        if (mediaType === "video") {
          setRemoteUsers((prev) => [...prev.filter((u) => u.uid !== user.uid), user]);
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      agoraClient.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        }
      });

      agoraClient.on("user-left", (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });
    };

    init();

    return () => {
      localAudioTrack?.close();
      localVideoTrack?.close();
      agoraClient?.leave();
    };
  }, []);

  const startCall = async (channelName: string, isVideo: boolean = true) => {
    if (!client) return;
    const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

    await client.join(AGORA_APP_ID, channelName, null, null);

    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    setLocalAudioTrack(audioTrack);

    if (isVideo) {
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      setLocalVideoTrack(videoTrack);
      await client.publish([audioTrack, videoTrack]);
      setIsVideoEnabled(true);
    } else {
      await client.publish([audioTrack]);
      setIsVideoEnabled(false);
    }

    setJoined(true);
  };

  const endCall = async () => {
    localAudioTrack?.stop();
    localAudioTrack?.close();
    localVideoTrack?.stop();
    localVideoTrack?.close();

    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
    setJoined(false);

    if (client) {
      await client.leave();
    }
  };

  const toggleMute = () => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localVideoTrack) {
      localVideoTrack.setEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  return {
    joined,
    localVideoTrack,
    remoteUsers,
    isVideoEnabled,
    isAudioMuted,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}