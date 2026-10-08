/**
 * Encrypted share links, end to end through the real UI.
 *
 * Firestore is mocked at the module boundary; the crypto is real WebCrypto.
 */
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  encryptWithLinkKey,
  encryptWithPassphrase,
  serializeEnvelope,
} from "./lib/crypto/symmetric";

vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

let mockDoc: { exists: boolean; data?: Record<string, unknown> } = { exists: false };
const addDoc = vi.fn(async (_c: unknown, _d: Record<string, unknown>) => ({ id: "new-id" }));
const deleteDoc = vi.fn(async () => {});

vi.mock("firebase/firestore", () => ({
  getDoc: async () => ({ exists: () => mockDoc.exists, data: () => mockDoc.data }),
  doc: () => ({}),
  collection: () => ({}),
  addDoc: (c: unknown, d: Record<string, unknown>) => addDoc(c, d),
  deleteDoc: () => deleteDoc(),
}));

vi.mock("./firebase", () => ({ getDb: async () => ({}) }));

import App from "./App";

const SHARED = JSON.stringify({ origText: "secret A", modText: "secret B", language: "javascript" });
const DAY = 86_400_000;

const setUrl = (path: string) => window.history.replaceState({}, "", `/${path}`);

const editors = () => screen.getAllByTestId("monaco-editor") as HTMLTextAreaElement[];

beforeEach(() => {
  localStorage.clear();
  addDoc.mockClear();
  deleteDoc.mockClear();
});

afterEach(() => {
  setUrl("");
});

describe("opening encrypted shares", () => {
  it("decrypts a link-key share using the key in the fragment", async () => {
    const { envelope, linkKey } = await encryptWithLinkKey(SHARED);
    mockDoc = { exists: true, data: { data: serializeEnvelope(envelope), timestamp: Date.now(), expiresAt: Date.now() + DAY } };
    setUrl(`?id=abc#key=${linkKey}`);
    render(<App />);

    await waitFor(() => {
      expect(editors()[0].value).toBe("secret A");
      expect(editors()[1].value).toBe("secret B");
    });
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("explains a link whose key fragment was cut off", async () => {
    const { envelope } = await encryptWithLinkKey(SHARED);
    mockDoc = { exists: true, data: { data: serializeEnvelope(envelope), timestamp: Date.now() } };
    setUrl("?id=abc");
    render(<App />);

    await waitFor(() => expect(screen.getByText(/missing its decryption key/i)).toBeInTheDocument());
    expect(editors()[0].value).toBe("");
  });

  it("asks for the password, rejects a wrong one, then opens with the right one", async () => {
    const envelope = await encryptWithPassphrase(SHARED, "open sesame");
    mockDoc = { exists: true, data: { data: serializeEnvelope(envelope), timestamp: Date.now() } };
    setUrl("?id=abc");
    render(<App />);

    const input = await screen.findByLabelText("PASSWORD");
    await userEvent.type(input, "wrong");
    fireEvent.click(screen.getByRole("button", { name: "UNLOCK" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not decrypt/i));
    expect(editors()[0].value).toBe("");

    await userEvent.clear(input);
    await userEvent.type(input, "open sesame");
    fireEvent.click(screen.getByRole("button", { name: "UNLOCK" }));
    await waitFor(() => expect(editors()[0].value).toBe("secret A"));
    expect(screen.queryByLabelText("PASSWORD")).not.toBeInTheDocument();
    // An ordinary share must survive being opened.
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("burns a burn-after-reading share only after it decrypts", async () => {
    const envelope = await encryptWithPassphrase(SHARED, "pw");
    mockDoc = {
      exists: true,
      data: { data: serializeEnvelope(envelope), timestamp: Date.now(), burnAfterReading: true },
    };
    setUrl("?id=abc");
    render(<App />);

    const input = await screen.findByLabelText("PASSWORD");
    await userEvent.type(input, "nope");
    fireEvent.click(screen.getByRole("button", { name: "UNLOCK" }));
    await screen.findByRole("alert");
    expect(deleteDoc).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, "pw");
    fireEvent.click(screen.getByRole("button", { name: "UNLOCK" }));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/self-destructed/i)).toBeInTheDocument();
  });
});

describe("creating encrypted shares", () => {
  const openShareDialog = async () => {
    setUrl("?id=none");
    mockDoc = { exists: false };
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^share$/i }));
    return screen.findByRole("dialog", { name: /share comparison/i });
  };

  it("stores only ciphertext and puts the key in the fragment by default", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    render(<App />);
    // Landing page → studio
    const start = screen.queryByRole("button", { name: /launch|start|open studio/i });
    if (start) fireEvent.click(start);
    const [a, b] = editors();
    fireEvent.change(a, { target: { value: "top secret left" } });
    fireEvent.change(b, { target: { value: "top secret right" } });

    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    await screen.findByRole("dialog", { name: /share comparison/i });
    fireEvent.click(screen.getByRole("button", { name: "CREATE LINK" }));

    const link = (await screen.findByLabelText("Share link")) as HTMLInputElement;
    expect(addDoc).toHaveBeenCalledTimes(1);
    const stored = addDoc.mock.calls[0][1];
    expect(String(stored.data)).toMatch(/^tdsenc1:/);
    expect(String(stored.data)).not.toContain("top secret");
    expect(stored.burnAfterReading).toBeUndefined();
    expect(link.value).toMatch(/\?id=new-id#key=[A-Za-z0-9_-]{43}$/);
  });

  it("keeps burn-after-reading locked without a Pro licence", async () => {
    const dialog = await openShareDialog();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(await screen.findByRole("dialog", { name: /pro encryption/i })).toBeInTheDocument();
  });

  it("keeps recipient public key encryption locked without a Pro licence", async () => {
    const dialog = await openShareDialog();
    const recipientRadio = within(dialog).getByRole("radio", { name: /recipient public key/i });
    fireEvent.click(recipientRadio);
    expect(await screen.findByRole("dialog", { name: /pro encryption/i })).toBeInTheDocument();
  });

  it("decrypts an asymmetric recipient share when private key is provided", async () => {
    const { generateAsymmetricKeyPair, encryptForRecipient } = await import("./lib/crypto/asymmetric");
    const pair = await generateAsymmetricKeyPair();
    const sealed = await encryptForRecipient(SHARED, pair.publicKey);

    mockDoc = {
      exists: true,
      data: { data: "tdsasy1:" + JSON.stringify(sealed), timestamp: Date.now() },
    };
    setUrl("?id=asymm");
    render(<App />);

    const input = await screen.findByLabelText("PRIVATE KEY");
    await userEvent.type(input, pair.privateKey);
    fireEvent.click(screen.getByRole("button", { name: "UNLOCK" }));

    await waitFor(() => {
      expect(editors()[0].value).toBe("secret A");
      expect(editors()[1].value).toBe("secret B");
    });
  });
});
