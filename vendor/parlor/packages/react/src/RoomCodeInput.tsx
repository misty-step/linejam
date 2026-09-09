import {
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { useAudio } from "./audio.js";

export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Normalize user-entered room-code text at the UI boundary. */
export function normalizeRoomCode(value: string): string {
  let normalized = "";
  for (const character of value.toUpperCase()) {
    if (ROOM_CODE_ALPHABET.includes(character)) {
      normalized += character;
    }
  }
  return normalized.slice(0, ROOM_CODE_LENGTH);
}

export interface RoomCodeInputProps {
  /** The canonical room code value owned by the parent. */
  value: string;
  /** Receives the normalized value after typing or pasting. */
  onChange: (value: string) => void;
  /** Called when the value reaches four valid characters. */
  onComplete?: (value: string) => void;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  id?: string;
  name?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  style?: CSSProperties;
  autoComplete?: "one-time-code";
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  /** Whether typing, deleting, and completion play sound cues. Defaults to true. */
  sound?: boolean;
}

function joinClassNames(...classNames: Array<string | undefined>): string | undefined {
  const joined = classNames.filter(Boolean).join(" ");
  return joined || undefined;
}

/**
 * A single, keyboard-friendly controlled input for Parlor room codes.
 *
 * Keeping this as one input means screen readers and mobile keyboards get one
 * coherent field instead of four separate focus targets.
 */
export function RoomCodeInput({
  value,
  onChange,
  onComplete,
  label = "Room code",
  description,
  error,
  id,
  name,
  className,
  inputClassName,
  placeholder = "ABCD",
  disabled = false,
  readOnly = false,
  required = false,
  autoFocus = false,
  style,
  autoComplete = "one-time-code",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  onBlur,
  onFocus,
  sound = true,
}: RoomCodeInputProps) {
  const audio = useAudio({ autoBind: false });
  const generatedId = useId();
  const inputId = id ?? `parlor-room-code-${generatedId.replaceAll(":", "")}`;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const completeValue = useRef<string | null>(null);
  const normalizedValue = normalizeRoomCode(value);
  const committedValue = useRef(normalizedValue);
  useEffect(() => {
    if (committedValue.current !== normalizedValue) {
      completeValue.current = null;
      committedValue.current = normalizedValue;
    }
  }, [normalizedValue]);
  const describedBy = [
    ariaDescribedBy,
    description === undefined ? undefined : descriptionId,
    error === undefined ? undefined : errorId,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" ");

  const commit = (nextValue: string) => {
    const prevLength = committedValue.current.length;
    const next = normalizeRoomCode(nextValue);
    committedValue.current = next;
    onChange(next);

    if (sound) {
      if (next.length === ROOM_CODE_LENGTH) {
        if (completeValue.current !== next) {
          audio.play("success");
        }
      } else if (next.length > prevLength) {
        audio.play("digit");
      } else if (next.length < prevLength) {
        audio.play("backspace");
      }
    }

    if (next.length === ROOM_CODE_LENGTH) {
      if (completeValue.current !== next) {
        completeValue.current = next;
        onComplete?.(next);
      }
    } else {
      completeValue.current = null;
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    commit(event.currentTarget.value);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = normalizeRoomCode(event.clipboardData.getData("text"));
    const input = event.currentTarget;
    const start = input.selectionStart ?? normalizedValue.length;
    const end = input.selectionEnd ?? start;
    const nextValue = `${normalizedValue.slice(0, start)}${pasted}${normalizedValue.slice(end)}`;

    event.preventDefault();
    commit(nextValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || normalizedValue.length !== ROOM_CODE_LENGTH) {
      return;
    }

    event.preventDefault();
    if (completeValue.current !== normalizedValue) {
      completeValue.current = normalizedValue;
      onComplete?.(normalizedValue);
    }
  };

  const hasVisibleLabel = label !== undefined && label !== null;
  const wrapperClassName = joinClassNames("parlor-room-code", className);
  const inputClasses = joinClassNames("parlor-room-code__input", inputClassName);

  return (
    <div className={wrapperClassName}>
      {hasVisibleLabel ? (
        <label className="parlor-room-code__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={inputClasses}
        name={name}
        type="text"
        value={normalizedValue}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        autoComplete={autoComplete}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={ROOM_CODE_LENGTH}
        pattern={`[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}`}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        autoFocus={autoFocus}
        style={style}
        aria-label={ariaLabel}
        aria-describedby={describedBy || undefined}
        aria-invalid={ariaInvalid ?? (error !== undefined ? true : undefined)}
      />
      {description !== undefined ? (
        <div className="parlor-room-code__description" id={descriptionId}>
          {description}
        </div>
      ) : null}
      {error !== undefined ? (
        <div className="parlor-room-code__error" id={errorId} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
