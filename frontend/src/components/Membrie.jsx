import { useEffect, useMemo, useState } from "react";

const BURGUNDY = "#7f1d1d";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function ageToNumber(ageLabel) {
  const m = String(ageLabel || "").match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
}

// ✅ Min age 4
const AGE_OPTIONS = [
  "4 ani",
  "5 ani",
  "6 ani",
  "7 ani",
  "8 ani",
  "9 ani",
  "10 ani",
  "11 ani",
  "12 ani",
  "13 ani",
  "14 ani",
  "15 ani",
  "16 ani",
  "17 ani",
];

const QUESTIONS_ENDPOINT = "/api/membrii/questions/";

export default function Membrie() {
  const [step, setStep] = useState(1); // 1..4, 5=success
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitError, setSubmitError] = useState("");

  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

  const [form, setForm] = useState({
    parentName: "",
    phone: "",
    email: "",

    childName: "",
    childAge: "",

    // legacy fallback (only if no CMS questions)
    artRelationship: "",

    expectation: "", // hobby | performance

    // ✅ Dynamic answers keyed by MembershipQuestion.key
    dynamicAnswers: {}, // { [key]: "answer" }
  });

  // ------------------------------------------------------------
  // ✅ Load CMS questions
  // ------------------------------------------------------------
  useEffect(() => {
    let alive = true;

    async function loadQuestions() {
      setLoadingQuestions(true);
      try {
        const res = await fetch(`${API_BASE}${QUESTIONS_ENDPOINT}`, {
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("questions endpoint not ready");

        const data = await res.json().catch(() => null);
        const raw = data?.items || data?.questions || [];

        const normalized = Array.isArray(raw)
          ? raw
              .filter(Boolean)
              .map((q, idx) => ({
                id: q.id ?? q.pk ?? null,
                key: q.key || q.slug || (q.id != null ? `q_${q.id}` : `q_${idx + 1}`),
                question_text: q.question_text || q.question || q.text || "",
                suggested_answer: q.suggested_answer || q.placeholder || q.hint || "",
                required: Boolean(q.required ?? true),
                order: Number(q.order ?? idx),
                is_active: Boolean(q.is_active ?? true),
              }))
              .filter((q) => q.is_active && q.question_text.trim())
              .sort((a, b) => a.order - b.order)
          : [];

        if (alive) setQuestions(normalized);
      } catch {
        if (alive) setQuestions([]);
      } finally {
        if (alive) setLoadingQuestions(false);
      }
    }

    loadQuestions();

    return () => {
      alive = false;
    };
  }, [API_BASE]);

  // ------------------------------------------------------------
  // ✅ Validation
  // ------------------------------------------------------------
  const errors = useMemo(() => {
    const e = {};

    // Step 1
    if (!form.parentName.trim()) e.parentName = "Te rugăm completează numele complet.";
    if (onlyDigits(form.phone).length < 9) e.phone = "Te rugăm completează un număr de telefon valid.";
    if (!isEmail(form.email)) e.email = "Te rugăm completează un email valid.";

    // Step 2
    if (!form.childName.trim()) e.childName = "Te rugăm completează numele copilului.";
    if (!form.childAge) e.childAge = "Te rugăm selectează vârsta.";
    if (form.childAge) {
      const n = ageToNumber(form.childAge);
      if (!Number.isFinite(n)) e.childAge = "Te rugăm selectează o vârstă validă.";
      else if (n < 4) e.childAge = "Vârsta minimă este 4 ani.";
    }

    // Step 3
    if (questions.length) {
      // required CMS questions
      questions.forEach((q) => {
        if (!q.required) return;
        const v = String(form.dynamicAnswers[q.key] || "").trim();
        if (!v) e[`dyn_${q.key}`] = "Acest câmp este obligatoriu.";
      });
    } else {
      // legacy fallback
      if (form.artRelationship.trim().length < 20) {
        e.artRelationship = "Te rugăm scrie câteva detalii (minim 20 caractere).";
      }
    }

    // Step 4
    if (!form.expectation) e.expectation = "Te rugăm selectează o opțiune.";

    return e;
  }, [form, questions]);

  const stepIsValid = useMemo(() => {
    if (step === 1) return !errors.parentName && !errors.phone && !errors.email;
    if (step === 2) return !errors.childName && !errors.childAge;
    if (step === 3) {
      if (questions.length) {
        // no dyn_* errors
        return !Object.keys(errors).some((k) => k.startsWith("dyn_"));
      }
      return !errors.artRelationship;
    }
    if (step === 4) return !errors.expectation;
    return false;
  }, [errors, step, questions.length]);

  function setField(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  function setDynamicAnswer(key, value) {
    setForm((p) => ({
      ...p,
      dynamicAnswers: { ...p.dynamicAnswers, [key]: value },
    }));
  }

  function markTouched(names) {
    setTouched((p) => {
      const next = { ...p };
      names.forEach((n) => (next[n] = true));
      return next;
    });
  }

  function next() {
    if (step === 1) markTouched(["parentName", "phone", "email"]);
    if (step === 2) markTouched(["childName", "childAge"]);
    if (step === 3) {
      if (questions.length) {
        markTouched(questions.filter((q) => q.required).map((q) => `dyn_${q.key}`));
      } else {
        markTouched(["artRelationship"]);
      }
    }

    if (!stepIsValid) return;

    setSubmitError("");
    setStep((s) => Math.min(4, s + 1));
  }

  function back() {
    setSubmitError("");
    setStep((s) => Math.max(1, s - 1));
  }

  function buildQaSnapshot() {
    const qa = [];

    qa.push({ question: "Nume părinte (complet)", answer: form.parentName.trim() });
    qa.push({ question: "Telefon", answer: form.phone.trim() });
    qa.push({ question: "Email", answer: form.email.trim() });

    qa.push({ question: "Nume copil", answer: form.childName.trim() });
    qa.push({ question: "Vârsta copilului", answer: form.childAge });

    if (questions.length) {
      questions.forEach((q) => {
        const ans = String(form.dynamicAnswers[q.key] || "").trim();
        if (ans) qa.push({ question: q.question_text, answer: ans });
      });
    } else {
      qa.push({
        question: "Descrieți relația copilului cu arta până în prezent",
        answer: form.artRelationship.trim(),
      });
    }

    const expectationLabel =
      form.expectation === "hobby"
        ? "Hobby (explorare creativă și dezvoltare personală)"
        : form.expectation === "performance"
        ? "Performanță (pregătire pentru o carieră în arte vizuale)"
        : "";
    if (expectationLabel) qa.push({ question: "Așteptări", answer: expectationLabel });

    return qa;
  }

  async function submit() {
    markTouched(["expectation"]);
    if (!stepIsValid) return;

    setSubmitError("");
    setSubmitting(true);

    try {
      const qa_items = buildQaSnapshot();

      const payload = {
        parent_name: form.parentName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        child_name: form.childName.trim(),
        child_age: form.childAge,
        art_relationship: form.artRelationship.trim(), // legacy
        expectation: form.expectation,
        source: "website",

        // ✅ Snapshot + fallback
        qa_items,
        dynamic_answers: form.dynamicAnswers,
      };

      const res = await fetch(`${API_BASE}/api/membrii/applications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = "Nu am putut trimite aplicația. Încearcă din nou.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
          if (data?.detail) msg = data.detail;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      setStep(5);
    } catch (err) {
      setSubmitError(err?.message || "A apărut o eroare la trimitere.");
    } finally {
      setSubmitting(false);
    }
  }

  const progress = useMemo(() => {
    const s = Math.min(Math.max(step, 1), 4);
    return ((s - 1) / 3) * 100;
  }, [step]);

  return (
    <section
      id="membrie"
      className="relative w-full bg-[#f4f1ea] px-4 pt-20 pb-28 sm:pt-28 sm:pb-36"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-36 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(127,29,29,0.10), rgba(127,29,29,0))",
          }}
        />
        <div
          className="absolute -bottom-40 right-[-140px] h-[520px] w-[520px] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(15,118,110,0.10), rgba(15,118,110,0))",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center">
            <span
              className="rounded-full border px-4 py-2 text-[12px] tracking-[0.22em] uppercase"
              style={{ borderColor: "rgba(0,0,0,0.10)", color: BURGUNDY }}
            >
              ( APLICAȚIE )
            </span>
          </div>

          <h1 className="mx-auto max-w-3xl text-3xl font-medium leading-[1.1] sm:text-5xl">
            Solicită acces la <span className="italic">comunitatea noastră</span>.
          </h1>

          {loadingQuestions ? (
            <p className="mt-3 text-sm text-stone-500">Se încarcă formularul…</p>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-4xl">
          <div className="overflow-hidden rounded-2xl border bg-white/55 p-0 shadow-[0_30px_80px_rgba(0,0,0,0.07)] backdrop-blur-xl">
            <div className="rounded-t-2xl bg-white/45 px-5 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <StepDots step={step} />
              </div>

              <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: BURGUNDY }} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                <span>{step <= 4 ? `Pasul ${step} din 4` : "Final"}</span>
              </div>
            </div>

            <div className="px-5 py-8 sm:px-8 sm:py-10">
              {step === 1 && (
                <div>
                  <h2 className="text-3xl sm:text-4xl">Detalii Părinte</h2>
                  <p className="mt-2 text-stone-600">Datele vor fi folosite doar pentru a vă contacta în legătură cu această aplicație.</p>

                  <div className="mt-8 grid gap-6">
                    <Field
                      label="Nume complet"
                      placeholder="Numele și prenumele"
                      value={form.parentName}
                      onChange={(v) => setField("parentName", v)}
                      error={touched.parentName ? errors.parentName : ""}
                      onBlur={() => markTouched(["parentName"])}
                    />

                    <Field
                      label="Telefon"
                      placeholder="+40 7XX XXX XXX"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(v) => setField("phone", v)}
                      error={touched.phone ? errors.phone : ""}
                      onBlur={() => markTouched(["phone"])}
                    />

                    <Field
                      label="Email"
                      placeholder="email@exemplu.ro"
                      inputMode="email"
                      value={form.email}
                      onChange={(v) => setField("email", v)}
                      error={touched.email ? errors.email : ""}
                      onBlur={() => markTouched(["email"])}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-3xl sm:text-4xl">Detalii Copil</h2>
                  <p className="mt-2 text-stone-600">Doar informațiile necesare pentru a înțelege profilul.</p>

                  <div className="mt-8 grid gap-6">
                    <Field
                      label="Numele copilului"
                      placeholder="Numele copilului"
                      value={form.childName}
                      onChange={(v) => setField("childName", v)}
                      error={touched.childName ? errors.childName : ""}
                      onBlur={() => markTouched(["childName"])}
                    />

                    <Select
                      label="Vârsta"
                      value={form.childAge}
                      onChange={(v) => setField("childAge", v)}
                      options={AGE_OPTIONS}
                      placeholder="Selectează vârsta (minim 4 ani)"
                      error={touched.childAge ? errors.childAge : ""}
                      onBlur={() => markTouched(["childAge"])}
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-3xl sm:text-4xl">{questions.length ? "Întrebări" : "Relația cu Arta"}</h2>
                  <p className="mt-2 text-stone-600">
                    {questions.length
                      ? "Răspunsurile ne ajută să înțelegem contextul copilului. (câmpurile marcate sunt obligatorii)"
                      : "Descrieți, pe scurt, relația copilului cu arta până în prezent."}
                  </p>

                  <div className="mt-8 grid gap-6">
                    {questions.length ? (
                      questions.map((q) => {
                        const key = `dyn_${q.key}`;
                        const hasErr = touched[key] ? errors[key] : "";
                        return (
                          <Textarea
                            key={q.key}
                            label={
                              q.required ? (
                                <span>
                                  {q.question_text} <span className="text-red-700">*</span>
                                </span>
                              ) : (
                                q.question_text
                              )
                            }
                            placeholder={q.suggested_answer || "Scrie răspunsul aici…"}
                            value={form.dynamicAnswers[q.key] || ""}
                            onChange={(v) => setDynamicAnswer(q.key, v)}
                            error={hasErr}
                            onBlur={() => markTouched([key])}
                          />
                        );
                      })
                    ) : (
                      <div>
                        <Textarea
                          label=""
                          placeholder="Ce medii artistice a explorat? Ce îl/o fascinează? Există lucrări de care este mândru/mândră?"
                          value={form.artRelationship}
                          onChange={(v) => setField("artRelationship", v)}
                          error={touched.artRelationship ? errors.artRelationship : ""}
                          onBlur={() => markTouched(["artRelationship"])}
                        />
                        <div className="mt-2 text-xs text-stone-500">
                          Minim 20 caractere. ({form.artRelationship.trim().length}/20)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="text-3xl sm:text-4xl">Așteptări</h2>
                  <p className="mt-2 text-stone-600">Ce căutați pentru copilul dumneavoastră?</p>

                  <div className="mt-8 grid gap-4">
                    <ChoiceCard
                      checked={form.expectation === "hobby"}
                      title="Hobby"
                      description="Explorare creativă și dezvoltare personală"
                      onClick={() => {
                        setField("expectation", "hobby");
                        markTouched(["expectation"]);
                      }}
                    />

                    <ChoiceCard
                      checked={form.expectation === "performance"}
                      title="Performanță"
                      description="Pregătire pentru o carieră în arte vizuale"
                      onClick={() => {
                        setField("expectation", "performance");
                        markTouched(["expectation"]);
                      }}
                    />

                    {touched.expectation && errors.expectation ? (
                      <div className="mt-1 text-sm text-red-700">{errors.expectation}</div>
                    ) : null}

                    {submitError ? (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {submitError}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: "rgba(127,29,29,0.10)", color: BURGUNDY }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </div>
                  <h2 className="mt-6 text-3xl sm:text-4xl">Aplicația a fost înregistrată.</h2>
                  <p className="mx-auto mt-3 max-w-xl text-stone-600">Comitetul de admitere vă va contacta în 48h.</p>

                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      className="rounded-full border bg-white px-6 py-3 text-sm shadow-sm transition hover:bg-black/5"
                      onClick={() => {
                        setForm({
                          parentName: "",
                          phone: "",
                          email: "",
                          childName: "",
                          childAge: "",
                          artRelationship: "",
                          expectation: "",
                          dynamicAnswers: {},
                        });
                        setTouched({});
                        setSubmitError("");
                        setStep(1);
                      }}
                    >
                      Trimite o nouă aplicație
                    </button>
                  </div>
                </div>
              )}
            </div>

            {step !== 5 && (
              <div className="rounded-b-2xl border-t bg-white/40 px-5 py-5 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={back}
                    disabled={step === 1 || submitting}
                    className={cx(
                      "inline-flex items-center gap-3 rounded-full px-3 py-2 text-sm transition",
                      step === 1 || submitting ? "text-stone-400" : "text-stone-700 hover:bg-black/5"
                    )}
                  >
                    <span aria-hidden="true">←</span>
                    <span>Înapoi</span>
                  </button>

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={next}
                      className={cx(
                        "inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm transition",
                        "border bg-white shadow-sm hover:bg-black/5"
                      )}
                      style={{ borderColor: "rgba(0,0,0,0.12)" }}
                    >
                      <span>Continuă</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={submitting || !stepIsValid}
                      className={cx(
                        "rounded-full px-5 py-2 text-sm tracking-[0.18em] uppercase transition",
                        submitting || !stepIsValid ? "bg-black/10 text-stone-500" : "text-white"
                      )}
                      style={{
                        background:
                          submitting || !stepIsValid ? undefined : `linear-gradient(135deg, ${BURGUNDY}, #3f0e0e)`,
                      }}
                    >
                      {submitting ? "Se trimite…" : "Trimite candidatura"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none h-16 sm:h-24" />
    </section>
  );
}

function StepDots({ step }) {
  const current = Math.min(Math.max(step, 1), 4);
  return (
    <div className="flex w-full items-center justify-between gap-3">
      {[1, 2, 3, 4].map((n) => {
        const done = current > n;
        const active = current === n;
        return (
          <div key={n} className="flex items-center gap-3">
            <div
              className={cx(
                "grid h-11 w-11 place-items-center rounded-full border text-sm",
                done ? "bg-black/5" : "bg-white/55",
                active ? "shadow-[0_18px_35px_rgba(0,0,0,0.08)]" : ""
              )}
              style={{
                borderColor: "rgba(0,0,0,0.12)",
                background: active ? "rgba(127,29,29,0.08)" : done ? "rgba(127,29,29,0.10)" : "rgba(255,255,255,0.55)",
                color: active ? BURGUNDY : done ? BURGUNDY : "rgba(0,0,0,0.55)",
              }}
              aria-label={done ? `Pasul ${n} completat` : `Pasul ${n}`}
            >
              {done ? "✓" : n}
            </div>
            {n !== 4 && <div className="hidden sm:block h-[2px] w-[7vw] max-w-[140px] rounded-full bg-black/10" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, placeholder, value, onChange, error, onBlur, inputMode }) {
  const hasError = Boolean(error);
  return (
    <div>
      <label className="block text-sm text-stone-700">{label}</label>
      <div
        className={cx(
          "mt-2 rounded-xl border bg-[#f7f4ee] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition",
          hasError ? "border-red-300" : "border-black/15",
          "focus-within:border-black/30 focus-within:bg-white"
        )}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          inputMode={inputMode}
          className="w-full bg-transparent text-[16px] text-stone-800 placeholder:text-stone-400 outline-none"
        />
      </div>
      {hasError ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}

function Select({ label, placeholder, value, onChange, options, error, onBlur }) {
  const hasError = Boolean(error);
  return (
    <div>
      <label className="block text-sm text-stone-700">{label}</label>
      <div
        className={cx(
          "mt-2 rounded-xl border bg-[#f7f4ee] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition",
          hasError ? "border-red-300" : "border-black/15",
          "focus-within:border-black/30 focus-within:bg-white"
        )}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cx("w-full bg-transparent text-[16px] outline-none", value ? "text-stone-800" : "text-stone-400")}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o} className="text-stone-800">
              {o}
            </option>
          ))}
        </select>
      </div>
      {hasError ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}

function Textarea({ label, placeholder, value, onChange, error, onBlur }) {
  const hasError = Boolean(error);
  return (
    <div>
      {label ? <label className="block text-sm text-stone-700">{label}</label> : null}
      <div
        className={cx(
          "mt-2 rounded-xl border bg-[#f7f4ee] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition",
          hasError ? "border-red-300" : "border-black/15",
          "focus-within:border-black/30 focus-within:bg-white"
        )}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={7}
          className="w-full resize-none bg-transparent text-[16px] text-stone-800 placeholder:text-stone-400 outline-none"
        />
      </div>
      {hasError ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}

function ChoiceCard({ title, description, checked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group w-full rounded-2xl border p-5 text-left transition",
        "bg-[#f7f4ee] hover:bg-white",
        checked ? "border-black/30" : "border-black/15"
      )}
      style={checked ? { boxShadow: "0 18px 45px rgba(0,0,0,0.08)" } : undefined}
    >
      <div className="flex items-start gap-4">
        <span
          className={cx(
            "mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border",
            checked ? "border-transparent" : "border-black/20"
          )}
          style={{ background: checked ? "rgba(127,29,29,0.10)" : "rgba(255,255,255,0.5)" }}
          aria-hidden="true"
        >
          <span
            className={cx("h-2.5 w-2.5 rounded-full transition", checked ? "opacity-100" : "opacity-0")}
            style={{ background: BURGUNDY }}
          />
        </span>

        <div className="min-w-0">
          <div className="text-lg font-medium text-stone-900">{title}</div>
          <div className="mt-1 text-sm text-stone-600">{description}</div>
        </div>
      </div>
    </button>
  );
}