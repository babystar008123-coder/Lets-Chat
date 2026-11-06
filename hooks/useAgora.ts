"use client";
import { useState, useCallback } from "react";
export function useAgora() {
  const [joinState, setJoinState] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const join = useCallback(async () => { setJoinState(true); }, []);
  const leave = useCallback(async () => { setJoinState(false); }, []);
  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);
  const toggleVideo = useCallback(() => setIsVideoOff(prev => !prev), []);
  return { joinState, isMuted, isVideoOff, remoteUsers, join, leave, toggleMute, toggleVideo };
}
export default useAgora;
