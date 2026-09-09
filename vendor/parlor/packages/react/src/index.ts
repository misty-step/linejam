export {
  AvatarBadge,
  type AvatarBadgeProps,
  type AvatarBadgeSize,
  type AvatarDescriptor,
} from "./AvatarBadge.js";
export {
  ConnectionStatus,
  type ConnectionState,
  type ConnectionStatusProps,
} from "./ConnectionStatus.js";
export {
  QRCodeDisplay,
  type QRCodeDisplayProps,
  type QRCodeErrorCorrectionLevel,
} from "./QRCodeDisplay.js";
export {
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  RoomCodeInput,
  type RoomCodeInputProps,
} from "./RoomCodeInput.js";
export {
  useGuestCredential,
  useHeartbeat,
  useWakeLock,
  type UseGuestCredentialOptions,
  type UseGuestCredentialResult,
  type UseHeartbeatOptions,
  type UseHeartbeatResult,
  type UseWakeLockOptions,
  type UseWakeLockResult,
} from "./hooks.js";
export {
  AudioProvider,
  useAudio,
  type AudioProviderProps,
  type UseAudioOptions,
  type UseAudioResult,
} from "./audio.js";
export {
  AUDIO_ENABLED_STORAGE_KEY,
  AUDIO_VOLUME_STORAGE_KEY,
  AudioController,
  DEFAULT_PARLOR_SOUNDS,
  bindAudioCues,
  createAudioController,
  playRawSound,
  sounds,
  type AudioControllerOptions,
  type AudioEngineLike,
  type AudioPlayOptions,
  type AudioSnapshot,
  type ParlorSoundCue,
  type SoundName,
} from "@parlor/web";
