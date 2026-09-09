// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AudioProvider,
  AvatarBadge,
  ConnectionStatus,
  QRCodeDisplay,
  RoomCodeInput,
  createAudioController,
} from "../src/index.js";

afterEach(cleanup);

const descriptor = {
  key: "teal-circle",
  background: "#073b3a",
  foreground: "#f2f7f4",
  shape: "circle",
};

describe("RoomCodeInput", () => {
  it("normalizes pasted room-code text into the single input", () => {
    const onChange = vi.fn();
    render(<RoomCodeInput value="" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Room code" });
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => " ab-cd ",
      },
    });

    expect(onChange).toHaveBeenCalledWith("ABCD");
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("emits normalized changes and completion once the code is full", async () => {
    const onComplete = vi.fn();
    function ControlledInput() {
      const [value, setValue] = useState("");
      return <RoomCodeInput value={value} onChange={setValue} onComplete={onComplete} />;
    }

    const user = userEvent.setup();
    render(<ControlledInput />);
    const input = screen.getByRole("textbox", { name: "Room code" });
    await user.type(input, "a2b3");
    expect((input as HTMLInputElement).value).toBe("A2B3");

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("A2B3");
  });

  it("re-arms completion after an external controlled-value reset", () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    const { rerender } = render(
      <RoomCodeInput value="ABCD" onChange={onChange} onComplete={onComplete} />,
    );
    const input = screen.getByRole("textbox", { name: "Room code" });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledTimes(1);

    rerender(<RoomCodeInput value="" onChange={onChange} onComplete={onComplete} />);
    fireEvent.change(input, { target: { value: "ABCD" } });

    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith("ABCD");
  });

  it("plays audio cues for typing, completion, and backspace when sound is enabled", () => {
    const played: string[] = [];
    const controller = createAudioController({
      storage: null,
      engine: {
        play: (name) => {
          played.push(name ?? "default");
        },
        setEnabled: () => {},
        setVolume: () => {},
        bind: () => {},
      },
    });

    function SoundControlledInput({ sound = true }: { sound?: boolean }) {
      const [val, setVal] = useState("");
      return (
        <AudioProvider controller={controller} autoBind={false}>
          <RoomCodeInput value={val} onChange={setVal} sound={sound} />
        </AudioProvider>
      );
    }

    const { unmount } = render(<SoundControlledInput />);
    const input = screen.getByRole("textbox", { name: "Room code" });

    // Type first character -> digit cue ("tick")
    fireEvent.change(input, { target: { value: "A" } });
    expect(played).toEqual(["tick"]);

    // Type next character -> digit cue ("tick")
    fireEvent.change(input, { target: { value: "AB" } });
    expect(played).toEqual(["tick", "tick"]);

    // Backspace -> backspace cue ("droplet")
    fireEvent.change(input, { target: { value: "A" } });
    expect(played).toEqual(["tick", "tick", "droplet"]);

    // Complete 4 chars -> success cue ("success")
    fireEvent.change(input, { target: { value: "ABCD" } });
    expect(played).toEqual(["tick", "tick", "droplet", "success"]);

    unmount();
    played.length = 0;

    // With sound={false}, no sounds play
    render(<SoundControlledInput sound={false} />);
    const silentInput = screen.getByRole("textbox", { name: "Room code" });
    fireEvent.change(silentInput, { target: { value: "A" } });
    fireEvent.change(silentInput, { target: { value: "ABCD" } });
    expect(played).toHaveLength(0);
  });
});

describe("accessible status and avatar components", () => {
  it("gives a named avatar badge an image role", () => {
    render(<AvatarBadge descriptor={descriptor} name="Ada Lovelace" />);

    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toBeTruthy();
  });

  it("uses a polite atomic live region for connection changes", () => {
    const { rerender } = render(<ConnectionStatus status="connected" />);
    const status = screen.getByRole("status");

    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-atomic")).toBe("true");
    expect(status.textContent).toContain("Connected");

    rerender(<ConnectionStatus status="disconnected" />);
    expect(status.textContent).toContain("Disconnected");
  });

  it("names the QR code for assistive technology", () => {
    render(<QRCodeDisplay value="room:ABCD" label="Scan to join room ABCD" />);

    expect(screen.getByRole("img", { name: "Scan to join room ABCD" })).toBeTruthy();
  });
});
