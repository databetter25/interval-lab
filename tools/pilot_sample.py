"""합성 파일럿 제출 파일 생성기: 분석 스크립트의 테스트와 보고서 모양 미리보기용.

    python tools/pilot_sample.py 폴더/ --n 24 --seed 1

실제 학습자 자료가 아니다. 사이트가 내보내는 파일과 같은 형식(schema_version 1)을 따른다.
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

ITEMS = [
    ("D01", "interp", "M1"), ("D02", "calc", "M2"), ("D03", "interp", "M3"), ("D04", "interp", "M4"),
    ("D05", "interp", "M5"), ("D06", "interp", "M6"), ("D07", "calc", "M7"), ("D08", "interp", "M8"),
    ("D09", "interp", "M9"), ("D10", "interp", "M10"), ("D11", "interp", "M11"), ("D12", "interp", "M6"),
]
EXPS = [f"E{i:02d}" for i in range(1, 16)]


def attempt(results: dict[str, tuple[bool, list[str]]], ts: datetime) -> dict:
    """results: 문항 → (정답 여부, 고른 오개념들)"""
    items = {i: {"answered": True, "correct": c, "misconceptions": m} for i, (c, m) in results.items()}
    n = len(ITEMS)
    interp = [i for i, k, _ in ITEMS if k == "interp"]
    return {
        "timestamp": ts.isoformat().replace("+00:00", "Z"),
        "answers": {},
        "score": 100 * sum(v["correct"] for v in items.values()) / n,
        "interp_score": 100 * sum(items[i]["correct"] for i in interp) / len(interp),
        "holds_m1": "M1" in items["D01"]["misconceptions"],
        "items": items,
    }


def pilot_file(pid: str, pre: dict | None, post: dict | None, predicted: list[str], visited: list[str], exported: datetime) -> dict:
    log = [{"experiment_id": e, "item_id": f"{e}-P1", "misconception_ids": [], "prediction": "", "confidence": 2, "reason": "", "correct": True, "result_summary": "", "timestamp": exported.isoformat()} for e in predicted]
    t = exported.isoformat()
    return {
        "schema": "interval-lab-pilot",
        "schema_version": 1,
        "participant_id": pid,
        "exported_at": t,
        "items": [{"id": i, "kind": k, "misconceptions": [m]} for i, k, m in ITEMS],
        "diagnostic": {"pre": pre, "post": post},
        "log": log,
        "visits": {e: {"first": t, "last": t, "count": 1} for e in visited},
    }


def synth(n: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    t0 = datetime(2026, 11, 2, 9, tzinfo=timezone.utc)
    out = []
    for k in range(n):
        ability = rng.gauss(0, 1)
        res = {}
        for when, boost in (("pre", 0.0), ("post", 1.0)):
            r = {}
            for i, _, m in ITEMS:
                p = 1 / (1 + pow(2.718281828, -(ability + boost - 0.2)))
                ok = rng.random() < p
                r[i] = (ok, [] if ok else ([m] if rng.random() < 0.7 else []))
            res[when] = r
        start = t0 + timedelta(hours=rng.uniform(0, 48))
        visited = EXPS[: rng.randint(3, 15)]
        predicted = [e for e in visited if rng.random() < 0.85]
        out.append(pilot_file(f"P{k + 1:02d}", attempt(res["pre"], start), attempt(res["post"], start + timedelta(hours=rng.uniform(24, 200))), predicted, visited, start + timedelta(days=10)))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--n", type=int, default=24)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    for d in synth(a.n, a.seed):
        (a.out / f"interval-lab-pilot-{d['participant_id']}.json").write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"합성 제출 파일 {a.n}개 → {a.out}")


if __name__ == "__main__":
    main()
