/**
 * Peer-to-peer voice for a match (WebRTC mesh). Signaling runs over a realtime
 * broadcast channel; audio flows directly between browsers. Phase rules are
 * applied on the sending side: `canSpeak` mutes the mic, and `listeners`
 * restricts who receives this player's audio (e.g. mafia-only at night).
 */
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Signal =
  | { type: "hello"; from: string }
  | { type: "offer" | "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "bye"; from: string };

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function VoiceChat(props: {
  gameId: string;
  userId: string;
  peerIds: string[];
  canSpeak: boolean;
  /** null = everyone at the table may hear me */
  listeners: string[] | null;
  statusHint?: string;
}) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, { pc: RTCPeerConnection; audio: HTMLAudioElement }>());
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const live = useRef(props);
  live.current = props;

  function applyRules() {
    const track = stream.current?.getAudioTracks()[0];
    if (!track) return;
    const { canSpeak, listeners } = live.current;
    track.enabled = canSpeak && !muted;
    for (const [id, { pc }] of peers.current) {
      const allowed = canSpeak && (listeners === null || listeners.includes(id));
      for (const s of pc.getSenders()) if (s.track !== undefined) void s.replaceTrack(allowed ? track : null);
    }
  }

  useEffect(applyRules, [props.canSpeak, props.listeners?.join(","), muted, connected]);

  function send(msg: Signal) {
    void channel.current?.send({ type: "broadcast", event: "signal", payload: msg });
  }

  function peer(id: string) {
    const existing = peers.current.get(id);
    if (existing) return existing.pc;
    const pc = new RTCPeerConnection(ICE);
    const audio = new Audio();
    audio.autoplay = true;
    const track = stream.current!.getAudioTracks()[0]!;
    pc.addTrack(track, stream.current!);
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      void audio.play().catch(() => {});
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice", from: live.current.userId, to: id, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) drop(id);
      setConnected([...peers.current.values()].filter((p) => p.pc.connectionState === "connected").length);
    };
    peers.current.set(id, { pc, audio });
    return pc;
  }

  function drop(id: string) {
    const p = peers.current.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    peers.current.delete(id);
  }

  async function call(id: string) {
    const pc = peer(id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "offer", from: live.current.userId, to: id, sdp: offer });
  }

  async function onSignal(msg: Signal) {
    const me = live.current.userId;
    if (msg.from === me || !live.current.peerIds.includes(msg.from)) return;
    if (msg.type === "hello") {
      if (me < msg.from) await call(msg.from);
      else send({ type: "hello", from: me });
      return;
    }
    if (msg.type === "bye") return drop(msg.from);
    if (msg.to !== me) return;
    const pc = peer(msg.from);
    if (msg.type === "offer") {
      await pc.setRemoteDescription(msg.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", from: me, to: msg.from, sdp: answer });
    } else if (msg.type === "answer") {
      await pc.setRemoteDescription(msg.sdp);
    } else if (msg.type === "ice") {
      await pc.addIceCandidate(msg.candidate).catch(() => {});
    }
  }

  async function join() {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("Microphone access was blocked. Allow it in your browser to use voice.");
      return;
    }
    const ch = supabase.channel(`voice:${props.gameId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "signal" }, ({ payload }) => void onSignal(payload as Signal));
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") send({ type: "hello", from: live.current.userId });
    });
    channel.current = ch;
    setJoined(true);
  }

  function leave() {
    send({ type: "bye", from: live.current.userId });
    for (const id of [...peers.current.keys()]) drop(id);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (channel.current) void supabase.removeChannel(channel.current);
    channel.current = null;
    setJoined(false);
    setConnected(0);
  }

  useEffect(() => () => leave(), []);

  return (
    <section className="panel flex flex-wrap items-center justify-between gap-3 p-4" aria-label="Voice chat">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Voice</p>
        <p className="text-xs text-muted-foreground">
          {error ??
            (joined
              ? `${connected} connected${props.canSpeak ? "" : ` · ${props.statusHint ?? "You are muted this phase"}`}`
              : "Talk directly with players at this table.")}
        </p>
      </div>
      <div className="flex gap-2">
        {joined && (
          <Button size="sm" variant="secondary" onClick={() => setMuted((m) => !m)} disabled={!props.canSpeak} aria-pressed={muted}>
            {muted || !props.canSpeak ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            {muted ? "Unmute" : "Mute"}
          </Button>
        )}
        {joined ? (
          <Button size="sm" variant="outline" onClick={leave}>
            <PhoneOff className="size-4" /> Leave voice
          </Button>
        ) : (
          <Button size="sm" onClick={join}>
            <Phone className="size-4" /> Join voice
          </Button>
        )}
      </div>
    </section>
  );
}
