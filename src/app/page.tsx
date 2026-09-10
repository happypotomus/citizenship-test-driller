"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  RotateCcw,
  Shuffle,
  Target,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { practiceSources, questions, type Question } from "@/data/questions";
import styles from "./page.module.css";

type ProfileId = "pranav" | "manal";
type Mode = "drill" | "practice";

type QuestionProgress = {
  attempts: number;
  correct: number;
  incorrect: number;
  streak: number;
  lastAnswered?: string;
};

type ProfileProgress = {
  questionStats: Record<string, QuestionProgress>;
  drillAnswered: number;
  drillCorrect: number;
  practiceRuns: { date: string; score: number; total: number; sourceId?: string }[];
};

type StoredProgress = Record<ProfileId, ProfileProgress>;

const profiles: { id: ProfileId; name: string }[] = [
  { id: "pranav", name: "Pranav" },
  { id: "manal", name: "Manal" },
];

const storageKey = "citizenship-test-driller-progress-v1";
const questionIds = new Set(questions.map((question) => question.id));
const questionsById = new Map(questions.map((question) => [question.id, question]));

const emptyProfile = (): ProfileProgress => ({
  questionStats: {},
  drillAnswered: 0,
  drillCorrect: 0,
  practiceRuns: [],
});

const defaultProgress = (): StoredProgress => ({
  pranav: emptyProfile(),
  manal: emptyProfile(),
});

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getWeaknessScore(question: Question, progress: ProfileProgress) {
  const stat = progress.questionStats[question.id];
  if (!stat) return -100;
  const accuracy = stat.correct / Math.max(1, stat.attempts);
  return accuracy * 100 + stat.streak * 8 + stat.attempts;
}

function nextDrillQuestion(progress: ProfileProgress, category: string) {
  const pool = category === "All" ? questions : questions.filter((question) => question.category === category);
  return shuffle(pool).sort((a, b) => getWeaknessScore(a, progress) - getWeaknessScore(b, progress))[0];
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function cleanProgress(progress: StoredProgress): StoredProgress {
  return {
    pranav: cleanProfileProgress(progress.pranav ?? emptyProfile()),
    manal: cleanProfileProgress(progress.manal ?? emptyProfile()),
  };
}

function cleanProfileProgress(progress: ProfileProgress): ProfileProgress {
  return {
    ...emptyProfile(),
    ...progress,
    questionStats: Object.fromEntries(
      Object.entries(progress.questionStats ?? {}).filter(([questionId]) => questionIds.has(questionId)),
    ),
  };
}

function sourceLabel(question: Question) {
  if (question.source === "official-practice") return "IRCC official sample";
  if (question.source === "official-study-question") return "IRCC study prompt";
  return "Discover Canada drill";
}

export default function Home() {
  const [progress, setProgress] = useState<StoredProgress>(defaultProgress);
  const [loaded, setLoaded] = useState(false);
  const [profileId, setProfileId] = useState<ProfileId>("pranav");
  const [mode, setMode] = useState<Mode>("drill");
  const [category, setCategory] = useState("All");
  const [current, setCurrent] = useState<Question>(questions[0]);
  const [selected, setSelected] = useState<number | null>(null);
  const [practiceSet, setPracticeSet] = useState<Question[]>([]);
  const [practiceSourceId, setPracticeSourceId] = useState(practiceSources[2].id);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [practiceFinished, setPracticeFinished] = useState(false);

  const activeProgress = progress[profileId];
  const validStats = Object.entries(activeProgress.questionStats).filter(([questionId]) => questionIds.has(questionId));
  const answeredUnique = validStats.filter(([, stat]) => stat.attempts > 0).length;
  const mastered = validStats.filter(([, stat]) => stat.attempts >= 2 && stat.incorrect === 0).length;
  const drillAccuracy = percent(activeProgress.drillCorrect, activeProgress.drillAnswered);
  const latestPractice = activeProgress.practiceRuns.at(-1);
  const practiceQuestion = practiceSet[practiceIndex];
  const practiceScore = practiceSet.reduce((score, question) => {
    return practiceAnswers[question.id] === question.answer ? score + 1 : score;
  }, 0);

  useEffect(() => {
    queueMicrotask(() => {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setProgress(cleanProgress({ ...defaultProgress(), ...JSON.parse(raw) }));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(storageKey, JSON.stringify(progress));
    }
  }, [loaded, progress]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(questions.map((question) => question.category))).sort()], []);

  function recordAnswer(question: Question, choiceIndex: number, kind: Mode) {
    const correct = choiceIndex === question.answer;
    setProgress((previous) => {
      const profile = previous[profileId];
      const stat = profile.questionStats[question.id] ?? {
        attempts: 0,
        correct: 0,
        incorrect: 0,
        streak: 0,
      };

      return {
        ...previous,
        [profileId]: {
          ...profile,
          drillAnswered: kind === "drill" ? profile.drillAnswered + 1 : profile.drillAnswered,
          drillCorrect: kind === "drill" && correct ? profile.drillCorrect + 1 : profile.drillCorrect,
          questionStats: {
            ...profile.questionStats,
            [question.id]: {
              attempts: stat.attempts + 1,
              correct: stat.correct + (correct ? 1 : 0),
              incorrect: stat.incorrect + (correct ? 0 : 1),
              streak: correct ? stat.streak + 1 : 0,
              lastAnswered: new Date().toISOString(),
            },
          },
        },
      };
    });
  }

  function answerDrill(choiceIndex: number) {
    if (selected !== null) return;
    setSelected(choiceIndex);
    recordAnswer(current, choiceIndex, "drill");
  }

  function goNextDrill() {
    setCurrent(nextDrillQuestion(progress[profileId], category));
    setSelected(null);
  }

  function startPractice(sourceId = practiceSourceId) {
    const source = practiceSources.find((item) => item.id === sourceId) ?? practiceSources[0];
    const sourceQuestions = source.questionIds
      .map((questionId) => questionsById.get(questionId))
      .filter((question): question is Question => Boolean(question));
    const nextSet = sourceQuestions.length <= 20 ? shuffle(sourceQuestions) : shuffle(sourceQuestions).slice(0, 20);
    setPracticeSourceId(source.id);
    setPracticeSet(nextSet);
    setPracticeIndex(0);
    setPracticeAnswers({});
    setPracticeFinished(false);
  }

  function answerPractice(choiceIndex: number) {
    if (!practiceQuestion || practiceAnswers[practiceQuestion.id] !== undefined) return;
    setPracticeAnswers((answers) => ({ ...answers, [practiceQuestion.id]: choiceIndex }));
    recordAnswer(practiceQuestion, choiceIndex, "practice");
  }

  function finishPractice() {
    setProgress((previous) => ({
      ...previous,
      [profileId]: {
        ...previous[profileId],
        practiceRuns: [
          ...previous[profileId].practiceRuns,
          { date: new Date().toISOString(), score: practiceScore, total: practiceSet.length, sourceId: practiceSourceId },
        ],
      },
    }));
    setPracticeFinished(true);
  }

  function resetProfile() {
    setProgress((previous) => ({ ...previous, [profileId]: emptyProfile() }));
    setSelected(null);
    setPracticeSet([]);
    setPracticeAnswers({});
    setPracticeFinished(false);
  }

  const activeCard = mode === "practice" && practiceQuestion ? practiceQuestion : current;
  const activeAnswer = mode === "practice" ? practiceAnswers[activeCard.id] : selected;
  const officialCount = questions.filter((question) => question.source !== "discover-canada-derived").length;
  const selectedPracticeSource = practiceSources.find((source) => source.id === practiceSourceId) ?? practiceSources[0];

  return (
    <main className={styles.shell}>
      <section className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Canadian citizenship test prep</p>
          <h1>Drill until the facts feel automatic.</h1>
        </div>
        <div className={styles.profileSwitch} aria-label="Profile">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              className={profile.id === profileId ? styles.activeProfile : ""}
              onClick={() => {
                setProfileId(profile.id);
                setCurrent(nextDrillQuestion(progress[profile.id], category));
                setSelected(null);
              }}
              type="button"
            >
              <UserRound size={16} />
              {profile.name}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.statsGrid}>
        <div className={styles.stat}>
          <span>Seen</span>
          <strong>{answeredUnique}/{questions.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>Drill accuracy</span>
          <strong>{drillAccuracy}%</strong>
        </div>
        <div className={styles.stat}>
          <span>Mastered</span>
          <strong>{mastered}</strong>
        </div>
        <div className={styles.stat}>
          <span>Last practice</span>
          <strong>{latestPractice ? `${latestPractice.score}/${latestPractice.total}` : "None"}</strong>
        </div>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.segmented} aria-label="Study mode">
          <button className={mode === "drill" ? styles.selectedTab : ""} onClick={() => setMode("drill")} type="button">
            <Target size={16} />
            Drill
          </button>
          <button
            className={mode === "practice" ? styles.selectedTab : ""}
            onClick={() => {
              setMode("practice");
              if (!practiceSet.length) startPractice();
            }}
            type="button"
          >
            <Trophy size={16} />
            Practice
          </button>
        </div>
        <button className={styles.iconButton} onClick={resetProfile} title="Reset current profile" type="button">
          <RotateCcw size={18} />
        </button>
      </section>

      {mode === "drill" ? (
        <section className={styles.studyLayout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <BarChart3 size={18} />
              <span>Question bank</span>
            </div>
            <p>
              {questions.length} cards in the drill bank. {officialCount} are direct IRCC sample questions or official
              study prompts; review continues after every card has been seen.
            </p>
            <label>
              Category
              <select
                value={category}
                onChange={(event) => {
                  const nextCategory = event.target.value;
                  setCategory(nextCategory);
                  setCurrent(nextDrillQuestion(activeProgress, nextCategory));
                  setSelected(null);
                }}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </aside>
          <QuestionCard question={activeCard} selected={activeAnswer} onAnswer={answerDrill} />
          <div className={styles.actions}>
            <button className={styles.primaryButton} disabled={selected === null} onClick={goNextDrill} type="button">
              Next card
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.practiceLayout}>
          <div className={styles.practiceHeader}>
            <div>
              <p className={styles.eyebrow}>Official-source practice</p>
              <h2>Practice Test</h2>
            </div>
            <button className={styles.secondaryButton} onClick={() => startPractice()} type="button">
              <Shuffle size={16} />
              New test
            </button>
          </div>
          <div className={styles.practiceControls}>
            <label>
              Source
              <select
                value={practiceSourceId}
                onChange={(event) => {
                  startPractice(event.target.value);
                }}
              >
                {practiceSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <p>{selectedPracticeSource.description}</p>
          </div>

          {practiceFinished ? (
            <div className={styles.resultPanel}>
              <Trophy size={34} />
              <h2>{practiceScore >= 15 ? "Passing score" : "Keep drilling"}</h2>
              <p>You scored {practiceScore}/{practiceSet.length}. Full-length practice uses the official 15 out of 20 passing bar.</p>
              <button className={styles.primaryButton} onClick={() => startPractice()} type="button">
                Start another test
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <>
              <div className={styles.progressLine}>
                <span>Question {practiceIndex + 1} of {practiceSet.length || selectedPracticeSource.questionIds.length}</span>
                <span>{practiceScore} correct so far</span>
              </div>
              {practiceQuestion && <QuestionCard question={practiceQuestion} selected={activeAnswer} onAnswer={answerPractice} />}
              <div className={styles.actions}>
                {practiceIndex < practiceSet.length - 1 ? (
                  <button
                    className={styles.primaryButton}
                    disabled={practiceAnswers[practiceQuestion?.id ?? ""] === undefined}
                    onClick={() => setPracticeIndex((index) => index + 1)}
                    type="button"
                  >
                    Next question
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    className={styles.primaryButton}
                    disabled={practiceSet.length === 0 || practiceAnswers[practiceQuestion?.id ?? ""] === undefined}
                    onClick={finishPractice}
                    type="button"
                  >
                    Finish test
                    <Check size={18} />
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function QuestionCard({
  question,
  selected,
  onAnswer,
}: {
  question: Question;
  selected: number | null | undefined;
  onAnswer: (choiceIndex: number) => void;
}) {
  const answered = selected !== null && selected !== undefined;

  return (
    <article className={styles.card}>
      <div className={styles.cardMeta}>
        <span>{question.category}</span>
        <span>{sourceLabel(question)}</span>
      </div>
      <h2>{question.prompt}</h2>
      <div className={styles.choices}>
        {question.choices.map((choice, index) => {
          const correct = index === question.answer;
          const picked = selected === index;
          const stateClass = answered && correct ? styles.correct : answered && picked ? styles.incorrect : "";

          return (
            <button className={stateClass} key={choice} onClick={() => onAnswer(index)} type="button">
              <span>{String.fromCharCode(65 + index)}</span>
              {choice}
              {answered && correct && <Check size={18} />}
              {answered && picked && !correct && <X size={18} />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={selected === question.answer ? styles.feedbackGood : styles.feedbackBad}>
          <strong>{selected === question.answer ? "Correct." : "Not quite."}</strong>
          <p>{question.explanation}</p>
        </div>
      )}
    </article>
  );
}
