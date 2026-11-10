import { lazy, Suspense, useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Network,
  FlaskConical,
  TrendingUp,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Search,
  ArrowLeft,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { LanguagePicker, LanguageProvider, useLanguage } from "./i18n";
import { AuthPage } from "./pages/AuthPage";
import { CurriculumStatus } from "./dashboards/CurriculumStatus";
import { MotionSection, Pending } from "./components/motion";
import { AssessmentForm } from "./features/AssessmentForm";
import { EvidencePanel } from "./features/EvidencePanel";
const ResearchDashboard = lazy(() =>
  import("./dashboards/ResearchDashboard").then((m) => ({
    default: m.ResearchDashboard,
  })),
);
import { LearningProfile } from "./dashboards/LearningProfile";
const KnowledgeGraph = lazy(() =>
  import("./visualizations/KnowledgeGraph").then((m) => ({
    default: m.KnowledgeGraph,
  })),
);
import {
  Brand,
  PageHeader,
  Stat,
  Empty,
  ErrorNotice,
  Notice,
  Pill,
  SectionTitle,
  pretty,
} from "./components/ui";
import { api, post } from "./services/api";
import { useResource } from "./hooks/useResource";
import type {
  Session,
  Subject,
  Profile,
  Assessment,
  Diagnostic,
  Learner,
} from "./types";

export default function App() {
  return <LanguageProvider><LocalizedApp /></LanguageProvider>;
}

function LocalizedApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("lba-theme") || "light",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("lba-theme", theme);
  }, [theme]);
  if (!session) return <AuthPage onSession={setSession} />;
  return (
    <Suspense fallback={<Pending label="Loading workspace…" skeleton />}>
      <Workspace
        session={session}
        onLogout={() => setSession(null)}
        theme={theme}
        toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />
    </Suspense>
  );
}

function Workspace({
  session,
  onLogout,
  theme,
  toggleTheme,
}: {
  session: Session;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}) {
  const { t } = useLanguage();
  const { user, access_token: token } = session;
  const teacher = user.role === "teacher";
  const researchOnly = user.role === "researcher";
  const [page, setPage] = useState(researchOnly ? "research" : "overview");
  const [selectedStudent, setSelectedStudent] = useState(user.student_id);
  const [revision, setRevision] = useState(0);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [run, setRun] = useState<Diagnostic | null>(null);
  const [baseline, setBaseline] = useState<Assessment | null>(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("mathematics");
  const [search, setSearch] = useState("");
  const { data: subjects, error: subjectError } = useResource<Subject[]>(
    "/subjects",
    token,
  );
  const { data: learners, error: learnersError } = useResource<Learner[]>(
    teacher ? "/students" : null,
    token,
    revision,
  );
  const {
    data: profile,
    error: profileError,
    loading,
  } = useResource<Profile>(
    selectedStudent ? `/students/${selectedStudent}` : null,
    token,
    revision,
  );
  const refresh = () => setRevision((n) => n + 1);
  const gradeLabel = profile
    ? t(
        `Grade ${profile.grade}`,
        profile.grade <= 6 ? `ป.${profile.grade}` : `ม.${profile.grade - 6}`,
      )
    : "—";
  function navigate(next: string) {
    setPage(next);
    setAssessment(null);
    setRun(null);
    setError("");
  }
  async function diagnose(a: Assessment) {
    const result = await api<Diagnostic>(
      `/assessments/${a.id}/diagnostics`,
      token,
      post(),
    );
    setBaseline(a);
    setRun(result);
    setPage("evidence");
  }
  async function nextVerification() {
    if (!run) return;
    const result = await api<{ id: string; assessment: Assessment }>(
      `/diagnostics/${run.id}/verification`,
      token,
      post(),
    );
    if (result.assessment.status === "completed") {
      await api(`/verifications/${result.id}/evaluate`, token, post());
      setRun(await api<Diagnostic>(`/diagnostics/${run.id}`, token));
      refresh();
      return;
    }
    setAssessment(result.assessment);
  }
  async function completed(a: Assessment) {
    setError("");
    if (a.stage === "verification") {
      const link = await api<{
        verification_id: string;
        run_id: string;
        baseline_assessment_id: string;
      }>(`/assessments/${a.id}/verification`, token);
      await api(
        `/verifications/${link.verification_id}/evaluate`,
        token,
        post(),
      );
      setRun(await api<Diagnostic>(`/diagnostics/${link.run_id}`, token));
      setBaseline(
        await api<Assessment>(
          `/assessments/${link.baseline_assessment_id}`,
          token,
        ),
      );
      setPage("evidence");
    } else if (a.stage === "pre") await diagnose(a);
    else setPage("progress");
    setAssessment(null);
    refresh();
  }
  async function logout() {
    try {
      await api("/auth/logout", token, post());
      onLogout();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const nav = researchOnly
    ? [
        { id: "research", label: t("Research overview", "ภาพรวมการวิจัย"), icon: FlaskConical },
        { id: "curriculum", label: t("Curriculum intake", "หลักสูตรและสร้างข้อสอบ"), icon: BookOpen },
        { id: "graph", label: t("Knowledge graph", "กราฟความรู้"), icon: Network },
      ]
    : [
        { id: "overview", label: t("Home", "หน้าหลัก"), icon: LayoutDashboard },
        ...(teacher
          ? [{ id: "learners", label: t("Learners", "นักเรียน"), icon: Users }]
          : [{ id: "assessments", label: t("Assessments", "แบบประเมิน"), icon: BookOpen }]),
        {
          id: "progress",
          label: teacher ? t("Learning profiles", "โปรไฟล์การเรียน") : t("Learning progress", "ความคืบหน้า"),
          icon: TrendingUp,
        },
        { id: "graph", label: t("Knowledge graph", "กราฟความรู้"), icon: Network },
        ...(teacher
          ? [
              { id: "research", label: t("Research", "งานวิจัย"), icon: FlaskConical },
              { id: "curriculum", label: t("Curriculum intake", "หลักสูตรและสร้างข้อสอบ"), icon: BookOpen },
            ]
          : []),
      ];
  const mobileLabels: Record<string, string> = {
    overview: t("Home", "หน้าหลัก"),
    assessments: t("Assess", "แบบประเมิน"),
    learners: t("Learners", "นักเรียน"),
    progress: t("Progress", "ความคืบหน้า"),
    graph: t("Graph", "กราฟ"),
    research: t("Research", "งานวิจัย"),
    curriculum: t("Curriculum", "หลักสูตร"),
  };
  return (
    <div className="app-shell design-workspace" data-role={user.role}>
      <aside className="sidebar motion-sidebar">
        <Brand />
        <div className="workspace-label">
          {teacher
            ? t("TEACHER WORKSPACE", "พื้นที่ครู")
            : researchOnly
              ? t("RESEARCH WORKSPACE", "พื้นที่นักวิจัย")
              : t("LEARNER WORKSPACE", "พื้นที่นักเรียน")}
        </div>
        <nav aria-label={t("Main navigation", "เมนูหลัก")}>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              title={n.label}
              aria-label={n.label}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              <span className="nav-label">{n.label}</span>
              <span className="nav-mobile-label" aria-hidden="true">
                {mobileLabels[n.id] ?? n.label}
              </span>
              {page === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="pilot-card">
            <ShieldCheck size={20} />
            <b>Evidence before inference.</b>
            <p>
              Sample packs are unvalidated. Keep every conclusion open to
              review.
            </p>
            <Pill>Research MVP</Pill>
          </div>
          <div className="sidebar-user">
            <span className="avatar">
              {user.handle.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{user.handle}</b>
              <small>{user.role === "student" ? t("Student", "นักเรียน") : teacher ? t("Teacher", "ครู") : t("Researcher", "นักวิจัย")}</small>
            </div>
            <button title={t("Sign out", "ออกจากระบบ")} aria-label={t("Sign out", "ออกจากระบบ")} onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <Brand />
            {t("Workspace", "พื้นที่ทำงาน")}
            <ChevronRight size={14} />
            <b>{nav.find(item => item.id === page)?.label ?? pretty(page)}</b>
          </div>
          <div className="topbar-actions">
            <LanguagePicker />
            <span className="status-dot" />
            <span>{user.handle}</span>
            <button
              className="icon-button"
              aria-label={t("Toggle theme", "เปลี่ยนธีม")}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label={t("Sign out", "ออกจากระบบ")}
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="content">
          <div className="pilot-banner">
            <span>
              <GraduationCap size={16} />
              {t("Unvalidated sample content", "เนื้อหาตัวอย่างที่ยังไม่ผ่านการรับรอง")}
            </span>
            <span>
              {t("Software demonstration · No educational validity established", "ระบบสาธิต · ยังไม่ได้ยืนยันความเที่ยงตรงทางการศึกษา")}
            </span>
          </div>
          {user.is_demo && (
            <div className="demo-banner" role="status">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <b>{t("Demonstration account", "บัญชีสาธิต")}</b> · {t("Use fictional answers for software testing.", "ใช้คำตอบสมมติเพื่อทดสอบระบบ")}
              </span>
            </div>
          )}
          <ErrorNotice
            message={error || profileError || subjectError || learnersError}
          />
          <MotionSection key={assessment?.id ?? page}>
            {assessment ? (
              <AssessmentForm
                key={assessment.id}
                assessment={assessment}
                token={token}
                onComplete={completed}
                onBack={() => {
                  setAssessment(null);
                  refresh();
                }}
              />
            ) : page === "research" ? (
              <ResearchDashboard
                token={token}
                revision={revision}
                demo={!!user.is_demo}
              />
            ) : page === "curriculum" ? (
              <CurriculumStatus token={token} teacher={teacher} />
            ) : page === "graph" ? (
              <>
                <PageHeader
                  eyebrow="CONCEPT RELATIONSHIPS"
                  title="See the connections."
                  subtitle="Explore prerequisites with their provenance and review status."
                />
                <label className="subject-select">
                  Subject
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    <option value="all">
                      All subjects · cross-subject connections
                    </option>
                    {subjects?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <KnowledgeGraph subject={subject} token={token} />
              </>
            ) : page === "evidence" && run && baseline && selectedStudent ? (
              <>
                <button
                  className="text-button"
                  onClick={() => navigate("progress")}
                >
                  <ArrowLeft size={16} />
                  Back to learning profile
                </button>
                <PageHeader
                  eyebrow="DIAGNOSTIC WORKSPACE"
                  title="A better question comes next."
                  subtitle="Keep observations, possible explanations, and verification results distinct."
                />
                <EvidencePanel
                  run={run}
                  token={token}
                  teacher={teacher}
                  studentId={selectedStudent}
                  baseline={baseline}
                  onVerify={nextVerification}
                  onChange={refresh}
                />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow={
                    teacher ? "LEARNING, IN FOCUS" : "YOUR LEARNING, IN FOCUS"
                  }
                  title={
                    teacher && !selectedStudent
                      ? t("Every learner has a next step.", "ดูว่าผู้เรียนควรฝึกอะไรต่อ")
                      : !teacher && page === "overview"
                        ? `${t("Welcome back,", "ยินดีต้อนรับกลับมา")} ${user.handle}`
                      : page === "progress"
                        ? t("Watch understanding develop.", "ติดตามความเข้าใจของคุณ")
                        : t("Let curiosity lead the way.", "เลือกวิชาแล้วเริ่มเรียน")
                  }
                  subtitle={
                    teacher
                      ? "Review the evidence. Test an explanation. Plan an intentional next step."
                      : t("Explore what you know, explain your thinking, and discover what to work on next.", "เลือกหัวข้อที่อยากฝึกและดูความคืบหน้าของคุณ")
                  }
                  action={<Pill>{teacher ? t("Teacher view", "มุมมองครู") : `${t("Student", "นักเรียน")} · ${gradeLabel}`}</Pill>}
                />
                {teacher && (
                  <>
                    <div className="stats-grid">
                      <Stat
                        label="Learners"
                        value={learners?.length ?? "—"}
                        detail="Anonymous local learner records"
                      />
                      <Stat
                        label="Completed assessments"
                        value={
                          learners?.reduce(
                            (n, l) => n + l.assessments_completed,
                            0,
                          ) ?? "—"
                        }
                        detail="All stages combined"
                      />
                      <Stat
                        label="Selected profile"
                        value={profile?.anonymous_id || "—"}
                        detail="Choose a learner below"
                      />
                      <Stat
                        label="Content review"
                        value="Pending"
                        detail="Two unvalidated sample packs"
                      />
                    </div>
                    <section className="panel learner-picker">
                      <SectionTitle
                        aside={
                          <div className="search">
                            <Search size={16} />
                            <input
                              aria-label="Find learner"
                              placeholder="Find anonymous learner"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </div>
                        }
                      >
                        Learner overview
                      </SectionTitle>
                      {learners?.length ? (
                        <div className="learner-list">
                          {learners
                            .filter((l) =>
                              l.anonymous_id
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                            )
                            .map((l) => (
                              <button
                                className={
                                  l.id === selectedStudent ? "selected" : ""
                                }
                                key={l.id}
                                onClick={() => {
                                  setSelectedStudent(l.id);
                                  setRun(null);
                                }}
                              >
                                <span className="avatar">
                                  <Users size={17} />
                                </span>
                                <span>
                                  <b>{l.anonymous_id}</b>
                                  <small>
                                    Grade {l.grade} · {l.assessments_completed}{" "}
                                    completed
                                  </small>
                                </span>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                        </div>
                      ) : (
                        <Empty title="No learner records yet">
                          A learner can create an anonymous account from the
                          sign-in page. No demonstration participants have been
                          seeded.
                        </Empty>
                      )}
                    </section>
                  </>
                )}
                {loading && (
                  <Pending label="Loading learning profile…" skeleton />
                )}
                {profile && subjects ? (
                  <LearningProfile
                    home={!teacher && page === "overview"}
                    profile={profile}
                    token={token}
                    teacher={teacher}
                    subjects={subjects}
                    onAssessment={(a) => {
                      setAssessment(a);
                    }}
                    onDiagnose={diagnose}
                    onChange={refresh}
                  />
                ) : (
                  !teacher &&
                  !loading &&
                  !profileError &&
                  !subjectError && (
                    <Pending label="Loading your workspace…" skeleton />
                  )
                )}
              </>
            )}
          </MotionSection>
          <footer className="content-footer">
            <span>LBA / Learning Bottleneck Analyzer</span>
            <span>
              Observed evidence → cautious inference → targeted verification
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
