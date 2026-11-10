import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../i18n";
import { HomeOverview } from "./HomeOverview";
import type { Assessment, Profile } from "../types";

const profile: Profile = {
  id: "test-learner",
  anonymous_id: "TEST",
  grade: 7,
  consent: true,
  consent_version: "test",
  assessments: [],
  interventions: [],
  outcomes: [],
};

describe("Home learning summary", () => {
  it("shows an honest empty chart and keeps subject selection available", () => {
    localStorage.setItem("lba-language", "en");
    render(
      <LanguageProvider>
        <HomeOverview profile={profile} subjects={[]} onResume={vi.fn()}>
          <h2 id="learning-tree-title">Subjects</h2>
        </HomeOverview>
      </LanguageProvider>,
    );
    expect(
      screen.getByText("Your first assessment will appear here."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "0/0 topics with saved answers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Choose a subject" }),
    ).toHaveAttribute("href", "#learning-tree-title");
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.queryByRole("button", { name: "Continue assessment" }),
    ).not.toBeInTheDocument();
  });

  it("resumes an older open assessment beyond the four most recent records", () => {
    const assessments: Assessment[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-${i}`,
      subject_id: "mathematics",
      subject_version: "test",
      stage: "pre",
      status: i === 4 ? "open" : "completed",
      items: [],
      responses: [],
      intervention_id: null,
      created_at: new Date(2026, 10, 9 - i).toISOString(),
    }));
    const onResume = vi.fn();
    render(
      <LanguageProvider>
        <HomeOverview
          profile={{ ...profile, assessments }}
          subjects={[]}
          onResume={onResume}
        >
          <h2 id="learning-tree-title">Subjects</h2>
        </HomeOverview>
      </LanguageProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue assessment" }),
    );
    expect(onResume).toHaveBeenCalledWith(assessments[4]);
    expect(
      screen.getByRole("link", { name: "Choose a subject" }),
    ).toBeInTheDocument();
    const headings = screen.getAllByRole("heading");
    expect(
      headings.findIndex((h) => h.textContent === "Subjects"),
    ).toBeLessThan(
      headings.findIndex((h) => h.textContent === "Recent assessments"),
    );
  });
});
