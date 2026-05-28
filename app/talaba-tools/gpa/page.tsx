"use client";

import Link from "next/link";
import { useState } from "react";

type Subject = {
  id: number;
  name: string;
  credit: number;
  score: number;
};

export default function GPAPage() {
  const sendToTelegram =
  async () => {
    try {
      const tg =
        (
          window as any
        ).Telegram
          ?.WebApp;

      const userId =
        tg
          ?.initDataUnsafe
          ?.user?.id;

      console.log(
        "TG USER:",
        userId
      );

      if (!userId) {
        alert(
          "Telegram user topilmadi"
        );
        return;
      }

      const response =
        await fetch(
          "/api/send-gpa",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  userId,
                  subjects,
                  gpa:
                    result,
                }
              ),
          }
        );

      const data =
        await response.json();

      console.log(
        data
      );

      if (
        response.ok
      ) {
        alert(
          "Telegramga yuborildi ✅"
        );
      } else {
        alert(
          data.error ||
            "Xatolik ❌"
        );
      }
    } catch (
      error
    ) {
      console.error(
        error
      );

      alert(
        "Xatolik ❌"
      );
    }
  };
  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [result, setResult] =
    useState<number | null>(null);

  const [form, setForm] =
    useState({
      name: "",
      credit: 4,
      score: 90,
    });

  const getGrade = (
    score: number
  ) => {
    if (score >= 90) return 5;
    if (score >= 70) return 4;
    if (score >= 60) return 3;
    return 2;
  };

  const addSubject = () => {
    if (!form.name.trim()) return;

    const newSubject = {
      id: Date.now(),
      name: form.name,
      credit: form.credit,
      score: form.score,
    };

    setSubjects([
      ...subjects,
      newSubject,
    ]);

    setForm({
      name: "",
      credit: 4,
      score: 90,
    });
  };

  const deleteSubject = (
    id: number
  ) => {
    setSubjects(
      subjects.filter(
        (subject) =>
          subject.id !== id
      )
    );
  };

  const editSubject = (
    subject: Subject
  ) => {
    setEditingId(subject.id);

    setForm({
      name: subject.name,
      credit: subject.credit,
      score: subject.score,
    });
  };

  const saveEdit = () => {
    setSubjects(
      subjects.map(
        (subject) =>
          subject.id ===
          editingId
            ? {
                ...subject,
                name: form.name,
                credit:
                  form.credit,
                score:
                  form.score,
              }
            : subject
      )
    );

    setEditingId(null);

    setForm({
      name: "",
      credit: 4,
      score: 90,
    });
  };

  const calculateGPA = () => {
    let totalKU = 0;
    let totalCredits = 0;

    subjects.forEach(
      (subject) => {
        const grade =
          getGrade(
            subject.score
          );

        totalKU +=
          subject.credit *
          grade;

        totalCredits +=
          subject.credit;
      }
    );

    const gpa =
      totalCredits === 0
        ? 0
        : totalKU /
          totalCredits;

    setResult(gpa);
  };

  return (
    <main className="min-h-screen bg-[#0f1724] text-white">
      <div className="max-w-md mx-auto px-4 py-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/talaba-tools"
            className="
              h-11 w-11 rounded-[16px]
              bg-[#243140]
              flex items-center justify-center
              text-lg
            "
          >
            ←
          </Link>

          <div>
            <h1 className="text-[26px] font-bold">
              GPA Hisoblagich
            </h1>

            <p className="text-slate-400 text-sm">
              Kredit-modul GPA
            </p>
          </div>
        </div>

        {/* Table */}
        <div
          className="
            rounded-[28px]
            bg-[#243140]
            border border-cyan-500/10
            overflow-hidden
            mb-4
          "
        >
          <div
            className="
              grid grid-cols-5
              text-xs
              text-slate-400
              px-4 py-3
              border-b
              border-white/5
            "
          >
            <div>Fan</div>
            <div>Kredit</div>
            <div>Ball</div>
            <div>Baho</div>
            <div></div>
          </div>

          {subjects.length ===
          0 ? (
            <div className="p-5 text-center text-slate-500 text-sm">
              Fanlar hali
              qo‘shilmagan
            </div>
          ) : (
            subjects.map(
              (subject) => (
                <div
                  key={subject.id}
                  className="
                    grid grid-cols-5
                    px-4 py-4
                    border-b
                    border-white/5
                    items-center
                    text-sm
                  "
                >
                  <div className="truncate">
                    {subject.name}
                  </div>

                  <div>
                    {
                      subject.credit
                    }
                  </div>

                  <div>
                    {
                      subject.score
                    }
                  </div>

                  <div className="text-cyan-400 font-bold">
                    (
                    {getGrade(
                      subject.score
                    )}
                    )
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        editSubject(
                          subject
                        )
                      }
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() =>
                        deleteSubject(
                          subject.id
                        )
                      }
                    >
                      ❌
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>
                {/* Form */}
        <div
          className="
            rounded-[28px]
            bg-[#243140]
            border border-cyan-500/10
            p-4
          "
        >
          <input
            type="text"
            placeholder="Fan nomi"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name:
                  e.target.value,
              })
            }
            className="
              w-full
              bg-[#1b2635]
              rounded-xl
              px-4 py-3
              outline-none
              mb-4
            "
          />

          <div className="grid grid-cols-2 gap-3">

            {/* Kredit */}
            <div>
              <p className="text-slate-400 text-xs mb-1 ml-1">
                Kredit
              </p>

              <input
                type="text"
                inputMode="numeric"
                value={form.credit}
                onChange={(e) => {
                  const value =
                    Number(
                      e.target.value.replace(
                        /\D/g,
                        ""
                      )
                    );

                  if (
                    value <= 60
                  ) {
                    setForm({
                      ...form,
                      credit:
                        value,
                    });
                  }
                }}
                className="
                  w-full
                  bg-[#1b2635]
                  rounded-xl
                  px-4 py-3
                  outline-none
                "
              />
            </div>

            {/* Ball */}
            <div>
              <p className="text-slate-400 text-xs mb-1 ml-1">
                Ball
              </p>

              <input
                type="text"
                inputMode="numeric"
                value={form.score}
                onChange={(e) => {
                  const value =
                    Number(
                      e.target.value.replace(
                        /\D/g,
                        ""
                      )
                    );

                  if (
                    value <= 100
                  ) {
                    setForm({
                      ...form,
                      score:
                        value,
                    });
                  }
                }}
                className="
                  w-full
                  bg-[#1b2635]
                  rounded-xl
                  px-4 py-3
                  outline-none
                "
              />
            </div>
          </div>

          <button
            onClick={
              editingId
                ? saveEdit
                : addSubject
            }
            className="
              w-full
              rounded-[20px]
              bg-cyan-500
              py-3
              font-bold
              text-black
              mt-4
            "
          >
            {editingId
              ? "Saqlash"
              : "+ Fan qo‘shish"}
          </button>
        </div>

        {/* Result */}
        {result !==
          null && (
          <div
            className="
              mt-5
              rounded-[28px]
              bg-[#243140]
              border border-cyan-500/10
              p-5
            "
          >
            <h2 className="font-bold text-lg">
              GPA Natijasi
            </h2>

            <p className="text-4xl font-bold text-cyan-400 mt-2">
              {result.toFixed(
                2
              )}{" "}
              / 5
            </p>
          </div>
        )}

        <button
          onClick={
            calculateGPA
          }
          className="
            w-full
            rounded-[20px]
            bg-[#243140]
            py-3
            font-bold
            mt-4
          "
        >
          GPA Hisoblash
        </button>
        <button
  onClick={
    sendToTelegram
  }
  className="
    w-full
    rounded-[20px]
    bg-green-600
    py-3
    font-bold
    mt-3
  "
>
  📄 GPA hisobot yuklash
</button>

      </div>
    </main>
  );
}