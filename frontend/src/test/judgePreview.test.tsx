import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { AuthPage } from "../pages/AuthPage";
import { JudgeLogin } from "../pages/JudgeLogin";
import { Pending } from "../components/motion";
import { api, exportReport, post } from "../services/api";
import { createJudgeSession, judgeCredentials } from "../services/judgePreview";
import type { Profile, Subject } from "../types";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.setItem("lba-language", "en");
});

describe("public judge preview", () => {
  it("prefills the public credentials and validates them before opening a view", () => {
    const onSession = vi.fn();
    render(<JudgeLogin onSession={onSession} onBack={vi.fn()} />);
    expect(screen.getByLabelText("Preview username")).toHaveValue(
      judgeCredentials.handle,
    );
    expect(screen.getByLabelText("Preview password")).toHaveValue(
      judgeCredentials.password,
    );
    fireEvent.change(screen.getByLabelText("Preview password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open judge preview" }));
    expect(onSession).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "public preview credentials",
    );
  });

  it("opens a judge view from the shareable link without any backend request", async () => {
    window.history.replaceState(null, "", "/?portal=judge");
    const fetcher = vi.spyOn(globalThis, "fetch");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open judge preview" }));
    await screen.findByRole("region", { name: "Judge demonstration" });
    await screen.findByRole("heading", { name: "Your learning tree" });
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Preview as"), {
      target: { value: "teacher" },
    });
    await screen.findByText("Learner overview");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps preview payloads independent between requests", async () => {
    const token = createJudgeSession("student").access_token;
    const subjects = await api<Subject[]>("/subjects", token);
    subjects[0].name = "Changed locally";
    expect((await api<Subject[]>("/subjects", token))[0].name).toBe(
      "Mathematics",
    );
  });

  it("blocks writes, exports and unknown learner IDs before reaching the backend", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const token = createJudgeSession("teacher").access_token;
    await expect(
      api("/interventions", token, post({ student_id: "real-user" })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(api("/students/real-user", token)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      api("/diagnostics/example/ai-assist", token, post()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(exportReport(token)).rejects.toMatchObject({ status: 403 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("opens only a prewritten report for a completed example assessment", async () => {
    const token = createJudgeSession("student").access_token;
    const profile = await api<Profile>("/students/judge-learner-01", token);
    const completed = profile.assessments.find(
      (a) => a.status === "completed",
    )!;
    const report = await api<{ interpretation: string }>(
      `/assessments/${completed.id}/diagnostics`,
      token,
      post(),
    );
    expect(report.interpretation).toContain("Prewritten example report");
    const open = profile.assessments.find((a) => a.status === "open")!;
    await expect(
      api(`/assessments/${open.id}/diagnostics`, token, post()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("preserves the normal authenticated API path", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "real-authorized-profile" }), {
          status: 200,
        }),
      );
    expect(
      await api("/students/real-authorized-profile", "normal-token"),
    ).toEqual({ id: "real-authorized-profile" });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/students/real-authorized-profile",
      expect.objectContaining({
        headers: { Authorization: "Bearer normal-token" },
      }),
    );
  });
});

describe("actual loading states", () => {
  it("announces loading without a fabricated percentage", () => {
    render(<Pending label="Loading profile…" skeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading profile…");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the login animation until the request settles and then shows the error", async () => {
    const user = userEvent.setup();
    let finish!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { container } = render(<AuthPage onSession={vi.fn()} />);
    await user.type(screen.getByLabelText("Anonymous handle"), "test_learner");
    await user.type(screen.getByLabelText("Password"), "TestOnly!2026");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Connecting…" })).toBeDisabled();
    expect(
      container.querySelector(".loading-mark-compact"),
    ).toBeInTheDocument();
    finish(
      new Response(JSON.stringify({ detail: "Try again" }), { status: 401 }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
    expect(
      container.querySelector(".loading-mark-compact"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Try again");
  });
});
