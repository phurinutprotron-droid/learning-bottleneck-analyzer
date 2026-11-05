import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { AuthPage } from "../pages/AuthPage";
import { AssessmentForm } from "../features/AssessmentForm";
import { LearningProfile } from "../dashboards/LearningProfile";
import { api, APIError } from "../services/api";
import App from "../App";
import { StatValue } from "../components/motion";
import type { Assessment, Profile } from "../types";

it("shows new actual totals immediately with reduced motion enabled", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  try {
    const { container, rerender } = render(<StatValue value={3} />);
    rerender(<StatValue value={8} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "8",
    );
    expect(container.querySelector(".sr-only")).toHaveTextContent("8");
  } finally {
    vi.unstubAllGlobals();
  }
});

const assessment: Assessment = {
  id: "a1",
  subject_id: "mathematics",
  subject_version: "sample-v1",
  stage: "pre",
  status: "open",
  created_at: "2026-11-02",
  intervention_id: null,
  responses: [],
  items: [
    {
      id: "i1",
      prompt: "Which fraction equals one half?",
      kind: "multiple_choice",
      concept_id: "math.fractions",
      options: ["2/4", "2/3"],
    },
  ],
};
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("critical learner flows", () => {
  it("registers a student with anonymous handle and handles server errors", async () => {
    const user = userEvent.setup();
    const onSession = vi.fn();
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ detail: "Handle unavailable" }, 409))
      .mockResolvedValueOnce(
        json({ access_token: "token", user: { role: "student" } }),
      );
    render(<AuthPage onSession={onSession} />);
    await user.click(screen.getByText("New learner? Create an account"));
    await user.type(screen.getByLabelText("Anonymous handle"), "learner_07");
    await user.type(screen.getByLabelText("Password"), "valid-password");
    await user.click(
      screen.getByRole("button", { name: /Create learner account/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Handle unavailable",
    );
    await user.click(
      screen.getByRole("button", { name: /Create learner account/ }),
    );
    await waitFor(() => expect(onSession).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      handle: "learner_07",
      password: "valid-password",
      grade: 7,
    });
  });

  it("requires answer and reasoning, then saves original metadata before completion", async () => {
    const user = userEvent.setup();
    const done = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "r1" }, 201))
      .mockResolvedValueOnce(json({ ...assessment, status: "completed" }));
    render(
      <AssessmentForm
        assessment={assessment}
        token="secret"
        onComplete={done}
        onBack={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Finish assessment/ }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    await user.click(
      screen.getByRole("link", { name: /Explain your thinking/ }),
    );
    expect(screen.getByLabelText("Explain your thinking")).toHaveFocus();
    expect(screen.getByLabelText("Explain your thinking")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await user.click(screen.getByLabelText(/A2\/4/));
    await user.type(
      screen.getByLabelText("Explain your thinking"),
      "Scale the numerator and denominator by the same factor.",
    );
    await user.click(screen.getByLabelText(/1Unsure/));
    await user.click(screen.getByRole("button", { name: /Finish assessment/ }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
      "/api/assessments/a1/responses",
      "/api/assessments/a1/complete",
    ]);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toMatchObject({
      answer: "2/4",
      confidence: 1,
      item_id: "i1",
    });
    expect(fetcher.mock.calls[0][1]!.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("retries completion without resubmitting an already-saved response", async () => {
    const user = userEvent.setup();
    const done = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "r1" }, 201))
      .mockResolvedValueOnce(json({ detail: "Temporary failure" }, 503))
      .mockResolvedValueOnce(json({ ...assessment, status: "completed" }));
    render(
      <AssessmentForm
        assessment={assessment}
        token="token"
        onComplete={done}
        onBack={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText(/A2\/4/));
    await user.type(
      screen.getByLabelText("Explain your thinking"),
      "same scaling",
    );
    await user.click(screen.getByRole("button", { name: /Finish assessment/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Temporary failure",
    );
    await user.click(screen.getByRole("button", { name: /Finish assessment/ }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(
      fetcher.mock.calls.filter((c) => String(c[0]).endsWith("/responses")),
    ).toHaveLength(1);
  });

  it("gates collection on assent and enables subjects after it is recorded", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ granted: true }));
    const profile: Profile = {
      id: "s1",
      anonymous_id: "L-01",
      grade: 7,
      consent: false,
      consent_version: "pilot-v1",
      assessments: [],
      interventions: [],
      outcomes: [],
    };
    render(
      <LearningProfile
        profile={profile}
        token="token"
        teacher={false}
        subjects={[
          {
            id: "math",
            name: "Mathematics",
            version: "v1",
            review_status: "unvalidated",
            concepts: [],
          },
        ]}
        onAssessment={vi.fn()}
        onDiagnose={vi.fn()}
        onChange={changed}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Start assessment/ }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: /Record demo assent/ }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  });

  it("loads a real profile through the authenticated app instead of fabricating results", async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const path = String(input);
        if (path.endsWith("/auth/login/student"))
          return json({
            access_token: "session",
            user: {
              id: "u1",
              handle: "learner_07",
              role: "student",
              student_id: "s1",
              anonymous_id: "L-01",
            },
          });
        if (path.endsWith("/subjects"))
          return json([
            {
              id: "mathematics",
              name: "Mathematics",
              version: "v1",
              review_status: "unvalidated",
              concepts: [
                { id: "math.fractions", name: "Fractions", topic: "Number", skills: [] },
                { id: "math.ratios", name: "Ratios", topic: "Number", skills: [] },
              ],
            },
          ]);
        if (path.endsWith("/students/s1"))
          return json({
            id: "s1",
            anonymous_id: "L-01",
            grade: 7,
            consent: true,
            consent_version: "v1",
            assessments: [{ ...assessment, responses: [{ id: "r1", item_id: "i1", answer: "2/4", reasoning: "", confidence: 3 }] }],
            interventions: [],
            outcomes: [],
          });
        return json({}, 404);
      });
    render(<App />);
    await user.type(screen.getByLabelText("Anonymous handle"), "learner_07");
    await user.type(screen.getByLabelText("Password"), "valid-password");
    await user.click(screen.getByRole("button", { name: /^Sign in/ }));
    expect(await screen.findByRole("heading", { name: "Your learning tree" })).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(screen.getByText("Not attempted")).toBeInTheDocument();
    expect(screen.queryByText("Assessment history")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some((c) => c[0] === "/api/students/s1")).toBe(
      true,
    );
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(document.documentElement).toHaveClass("dark");
    await user.selectOptions(screen.getByRole("combobox", { name: "Display language" }), "th");
    expect(screen.getByRole("heading", { name: "ต้นไม้การเรียนรู้ของคุณ" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "th");
    await user.selectOptions(screen.getByRole("combobox", { name: "ภาษาที่แสดง" }), "en");
    await user.click(screen.getByRole("button", { name: /Mathematics Resume assessment/ }));
    expect(await screen.findByText("All answers saved.")).toBeInTheDocument();
  });
});

it("preserves API error status and does not fake success", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    json({ detail: "Access denied" }, 403),
  );
  await expect(api("/students", "token")).rejects.toMatchObject({
    status: 403,
    message: "Access denied",
  });
  expect(new APIError(401, "expired").status).toBe(401);
});
