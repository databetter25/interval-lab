"""파일럿 결과 분석 (PRD v2 §2.3 성공 지표, §15.1 S4).

학습자가 홈 화면의 ‘제출 파일 내보내기’로 만든 interval-lab-pilot-*.json 파일들을 모아
사전·사후 진단 지표와 학습기록 지표를 계산하고, 보고서(Markdown)와 CSV를 만든다.

    python tools/pilot_analysis.py 제출파일폴더/ --out 결과폴더/
    python tools/pilot_analysis.py a.json b.json --out 결과폴더/ --with-reasons

표준 라이브러리만 쓴다. 지표는 기술통계이며, 사이트 이용과 성적 향상 사이의 인과를 주장하지 않는다.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

SCHEMA = "interval-lab-pilot"
CORE_PATH = ("E01", "E02", "E04")
MISCONCEPTIONS = [f"M{i}" for i in range(1, 12)]

# PRD §2.3 초기 목표 (파일럿 뒤 다시 정한다)
TARGETS = {
    "interp_post": 80.0,  # 사후 해석 정답률(%) 이상
    "gain": 0.4,  # 정규화 이득 이상
    "m1_ratio": 0.5,  # 사후 M1 보유율 / 사전 M1 보유율 이하
    "core_path": 0.7,  # 핵심 경로 완료율 이상
    "predict_rate": 0.8,  # 예상 단계 응답률 이상
}


# ---------------------------------------------------------------- 통계 도구


def wilson(k: int, n: int, level: float = 0.95) -> tuple[float, float]:
    """비율 k/n의 Wilson 구간 (사이트 E06의 바로 그 구간)"""
    if n == 0:
        return (math.nan, math.nan)
    z = statistics.NormalDist().inv_cdf(1 - (1 - level) / 2)
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (max(0.0, c - h), min(1.0, c + h))


def _betacf(a: float, b: float, x: float) -> float:
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > 1e-300 else 1e-300)
    h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > 1e-300 else 1e-300)
        c = 1 + aa / c if abs(1 + aa / c) > 1e-300 else 1e-300
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > 1e-300 else 1e-300)
        c = 1 + aa / c if abs(1 + aa / c) > 1e-300 else 1e-300
        de = d * c
        h *= de
        if abs(de - 1) < 1e-15:
            break
    return h


def inc_beta(a: float, b: float, x: float) -> float:
    """정규화 불완전 베타함수 I_x(a, b)"""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbt = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x)
    if x < (a + 1) / (a + b + 2):
        return math.exp(lbt) * _betacf(a, b, x) / a
    return 1 - math.exp(lbt) * _betacf(b, a, 1 - x) / b


def t_cdf(t: float, df: float) -> float:
    tail = 0.5 * inc_beta(df / 2, 0.5, df / (df + t * t))
    return 1 - tail if t > 0 else tail


def t_ppf(q: float, df: float) -> float:
    lo, hi = -1e3, 1e3
    for _ in range(200):
        mid = (lo + hi) / 2
        if t_cdf(mid, df) < q:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def mean_ci(xs: list[float], level: float = 0.95) -> tuple[float, float, float]:
    """평균과 t 구간"""
    n = len(xs)
    if n == 0:
        return (math.nan, math.nan, math.nan)
    m = statistics.fmean(xs)
    if n < 2:
        return (m, math.nan, math.nan)
    h = t_ppf(1 - (1 - level) / 2, n - 1) * statistics.stdev(xs) / math.sqrt(n)
    return (m, m - h, m + h)


def mcnemar_exact(b: int, c: int) -> float:
    """대응 이분 자료의 정확 McNemar(이항) 양측 p-값. b: 사전○사후✕, c: 사전✕사후○"""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / 2**n
    return min(1.0, 2 * tail)


# ---------------------------------------------------------------- 자료 읽기


@dataclass
class Learner:
    pid: str
    source: str
    exported_at: str
    kinds: dict[str, str]
    pre: dict | None
    post: dict | None
    log: list[dict] = field(default_factory=list)
    visits: dict[str, dict] = field(default_factory=dict)

    @property
    def predicted(self) -> set[str]:
        """예상을 확정하고 결과까지 본 실험 (진단 기록 제외)"""
        return {e["experiment_id"] for e in self.log if not str(e.get("experiment_id", "")).startswith("DIAG")}

    @property
    def visited(self) -> set[str]:
        return set(self.visits)


def load(paths: list[Path]) -> tuple[list[Learner], list[str]]:
    files: list[Path] = []
    for p in paths:
        files += sorted(p.glob("*.json")) if p.is_dir() else [p]
    warnings: list[str] = []
    by_id: dict[str, Learner] = {}
    for f in files:
        try:
            d = json.loads(f.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as e:
            warnings.append(f"{f.name}: 읽을 수 없음 ({e})")
            continue
        if not isinstance(d, dict) or d.get("schema") != SCHEMA:
            warnings.append(f"{f.name}: 파일럿 제출 파일이 아님 (홈 화면의 ‘제출 파일 내보내기’로 만든 파일만 읽음)")
            continue
        if d.get("schema_version") != 1:
            warnings.append(f"{f.name}: 알 수 없는 schema_version {d.get('schema_version')}")
            continue
        pid = str(d.get("participant_id") or f.stem)
        lr = Learner(
            pid=pid,
            source=f.name,
            exported_at=str(d.get("exported_at", "")),
            kinds={it["id"]: it["kind"] for it in d.get("items", [])},
            pre=(d.get("diagnostic") or {}).get("pre"),
            post=(d.get("diagnostic") or {}).get("post"),
            log=[e for e in d.get("log", []) if isinstance(e, dict)],
            visits=d.get("visits") or {},
        )
        if pid in by_id:
            old = by_id[pid]
            keep, drop = (lr, old) if lr.exported_at >= old.exported_at else (old, lr)
            warnings.append(f"참가 번호 {pid} 중복: {keep.source}(나중 내보내기)를 쓰고 {drop.source}는 버림")
            by_id[pid] = keep
        else:
            by_id[pid] = lr
    return sorted(by_id.values(), key=lambda x: x.pid), warnings


# ---------------------------------------------------------------- 지표


def holds(att: dict | None, mis: str) -> bool:
    return bool(att) and any(mis in it.get("misconceptions", []) for it in att["items"].values())


def hours_between(a: str, b: str) -> float:
    try:
        return (datetime.fromisoformat(b.replace("Z", "+00:00")) - datetime.fromisoformat(a.replace("Z", "+00:00"))).total_seconds() / 3600
    except ValueError:
        return math.nan


def analyze(learners: list[Learner]) -> dict:
    matched = [l for l in learners if l.pre and l.post]
    with_post = [l for l in learners if l.post]
    res: dict = {"n_files": len(learners), "n_pre": sum(1 for l in learners if l.pre), "n_post": len(with_post), "n_matched": len(matched)}

    # 1. 해석 정답률 (사후)
    res["interp_post"] = mean_ci([l.post["interp_score"] for l in with_post])
    res["interp_pre"] = mean_ci([l.pre["interp_score"] for l in learners if l.pre])

    # 2. 정규화 이득: 학급 평균 이득(Hake)과 개인 이득의 평균
    pre_m = statistics.fmean(l.pre["score"] for l in matched) if matched else math.nan
    post_m = statistics.fmean(l.post["score"] for l in matched) if matched else math.nan
    res["score_pre"], res["score_post"] = pre_m, post_m
    res["gain_class"] = (post_m - pre_m) / (100 - pre_m) if matched and pre_m < 100 else math.nan
    indiv = [(l.post["score"] - l.pre["score"]) / (100 - l.pre["score"]) for l in matched if l.pre["score"] < 100]
    res["gain_indiv"] = mean_ci(indiv)
    res["n_gain_excluded"] = len(matched) - len(indiv)
    res["score_diff"] = mean_ci([l.post["score"] - l.pre["score"] for l in matched])

    # 3. M1 보유율 (대응 표본)
    k_pre = sum(holds(l.pre, "M1") for l in matched)
    k_post = sum(holds(l.post, "M1") for l in matched)
    res["m1_pre"] = (k_pre, len(matched))
    res["m1_post"] = (k_post, len(matched))
    res["m1_ratio"] = k_post / k_pre if k_pre else math.nan
    b = sum(holds(l.pre, "M1") and not holds(l.post, "M1") for l in matched)
    c = sum(not holds(l.pre, "M1") and holds(l.post, "M1") for l in matched)
    res["m1_mcnemar"] = mcnemar_exact(b, c)

    # 4. 핵심 경로 완료율: E01·E02·E04에서 모두 예상을 확정하고 결과를 본 학습자
    with_log = [l for l in learners if l.log or l.visits]
    res["core_path"] = (sum(set(CORE_PATH) <= l.predicted for l in with_log), len(with_log))

    # 5. 예상 단계 응답률: 연 실험 중 예상을 기록한 실험의 비율 (학습자 합산)
    num = sum(len(l.predicted & l.visited) for l in with_log)
    den = sum(len(l.visited) for l in with_log)
    res["predict_rate"] = (num, den)

    # 맥락: 사전→사후 간격, 활동 기간
    res["hours_pre_post"] = [hours_between(l.pre["timestamp"], l.post["timestamp"]) for l in matched]

    # 문항별 정답률과 McNemar
    item_ids = sorted({i for l in learners for i in l.kinds})
    items = []
    for iid in item_ids:
        kind = next((l.kinds[iid] for l in learners if iid in l.kinds), "")
        pre_c = [l.pre["items"][iid]["correct"] for l in learners if l.pre and iid in l.pre["items"]]
        post_c = [l.post["items"][iid]["correct"] for l in learners if l.post and iid in l.post["items"]]
        bb = sum(l.pre["items"][iid]["correct"] and not l.post["items"][iid]["correct"] for l in matched)
        cc = sum(not l.pre["items"][iid]["correct"] and l.post["items"][iid]["correct"] for l in matched)
        items.append({"item": iid, "kind": kind, "pre_n": len(pre_c), "pre_correct": sum(pre_c), "post_n": len(post_c), "post_correct": sum(post_c), "worse": bb, "better": cc, "mcnemar_p": mcnemar_exact(bb, cc)})
    res["items"] = items

    # 오개념별 선택 비율 (대응 표본에서 그 오개념이 붙은 답·이유를 한 번이라도 고른 학습자)
    res["misconceptions"] = [{"id": m, "n": len(matched), "pre": sum(holds(l.pre, m) for l in matched), "post": sum(holds(l.post, m) for l in matched)} for m in MISCONCEPTIONS]
    return res


# ---------------------------------------------------------------- 출력


def fmt_pct(x: float, d: int = 1) -> str:
    return "—" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{100 * x:.{d}f}%"


def fmt(x: float, d: int = 2) -> str:
    return "—" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{x:.{d}f}"


def verdict(ok: bool | None) -> str:
    return "판단 불가" if ok is None else ("달성" if ok else "미달")


def report(res: dict, warnings: list[str]) -> str:
    ip = res["interp_post"]
    gi = res["gain_indiv"]
    (m1k0, m1n), (m1k1, _) = res["m1_pre"], res["m1_post"]
    cpk, cpn = res["core_path"]
    prk, prn = res["predict_rate"]
    w = lambda k, n: f"[{fmt_pct(wilson(k, n)[0])}, {fmt_pct(wilson(k, n)[1])}]" if n else "—"
    nan = lambda v: isinstance(v, float) and math.isnan(v)
    rows = [
        ("해석 정답률 (사후)", f"{fmt(ip[0], 1)}%", f"[{fmt(ip[1], 1)}, {fmt(ip[2], 1)}]%", "80% 이상", verdict(None if nan(ip[0]) else ip[0] >= TARGETS["interp_post"]), f"사후 응시 {res['n_post']}명, 해석 문항만"),
        ("정규화 이득 (학급 평균)", fmt(res["gain_class"]), "—", "0.4 이상", verdict(None if nan(res["gain_class"]) else res["gain_class"] >= TARGETS["gain"]), f"(사후 평균 − 사전 평균) / (100 − 사전 평균), 대응 {res['n_matched']}명"),
        ("정규화 이득 (개인 평균)", fmt(gi[0]), f"[{fmt(gi[1])}, {fmt(gi[2])}]", "참고", "—", f"사전 100점 {res['n_gain_excluded']}명 제외"),
        ("M1 보유율", f"{fmt_pct(m1k0 / m1n if m1n else math.nan)} → {fmt_pct(m1k1 / m1n if m1n else math.nan)}", f"사후 {w(m1k1, m1n)}", "사전의 절반 이하", verdict(None if nan(res["m1_ratio"]) else res["m1_ratio"] <= TARGETS["m1_ratio"]), f"비 {fmt(res['m1_ratio'])}, 정확 McNemar p = {fmt(res['m1_mcnemar'], 3)}"),
        ("핵심 경로 완료율", fmt_pct(cpk / cpn if cpn else math.nan), w(cpk, cpn), "70% 이상", verdict(None if not cpn else cpk / cpn >= TARGETS["core_path"]), f"E01·E02·E04 예상 확정, {cpk}/{cpn}명"),
        ("예상 단계 응답률", fmt_pct(prk / prn if prn else math.nan), w(prk, prn), "80% 이상", verdict(None if not prn else prk / prn >= TARGETS["predict_rate"]), f"연 실험 {prn}건 중 예상 기록 {prk}건 (학습자 합산, 구간은 학습자 안의 상관을 무시)"),
    ]
    out = ["# 구간 실험실 파일럿 결과", "", f"생성: {datetime.now().strftime('%Y-%m-%d %H:%M')} · 제출 파일 {res['n_files']}개 · 사전 응시 {res['n_pre']}명 · 사후 응시 {res['n_post']}명 · 사전·사후 대응 {res['n_matched']}명", ""]
    if warnings:
        out += ["## 읽기 경고", ""] + [f"- {x}" for x in warnings] + [""]
    out += ["## PRD §2.3 지표 (초기 가설 대비)", "", "| 지표 | 값 | 95% 구간 | 초기 목표 | 판정 | 비고 |", "|---|---|---|---|---|---|"]
    out += [f"| {' | '.join(r)} |" for r in rows]
    sd = res["score_diff"]
    hrs = [h for h in res["hours_pre_post"] if not math.isnan(h)]
    out += [
        "",
        "판정은 점추정값을 목표와 비교한 것입니다. 표본이 작으면 구간이 넓으므로, 목표 근처의 판정은 구간과 함께 읽어야 합니다.",
        "",
        "## 전체 점수 (답과 이유가 모두 맞은 문항 비율)",
        "",
        f"- 대응 {res['n_matched']}명의 평균: 사전 {fmt(res['score_pre'], 1)}% → 사후 {fmt(res['score_post'], 1)}%",
        f"- 사후 − 사전 평균 {fmt(sd[0], 1)}%p, 95% t 구간 [{fmt(sd[1], 1)}, {fmt(sd[2], 1)}]%p",
        f"- 사전 해석 정답률 {fmt(res['interp_pre'][0], 1)}% (참고)",
        f"- 사전→사후 간격(시간): 중앙값 {fmt(statistics.median(hrs), 1) if hrs else '—'}, 범위 {fmt(min(hrs), 1) if hrs else '—'}–{fmt(max(hrs), 1) if hrs else '—'}",
        "",
        "## 문항별 정답률",
        "",
        "| 문항 | 종류 | 사전 | 사후 | 대응: 좋아짐 / 나빠짐 | 정확 McNemar p |",
        "|---|---|---|---|---|---|",
    ]
    for it in res["items"]:
        out.append(
            f"| {it['item']} | {'해석' if it['kind'] == 'interp' else '계산'} | {fmt_pct(it['pre_correct'] / it['pre_n'] if it['pre_n'] else math.nan, 0)} ({it['pre_correct']}/{it['pre_n']}) | "
            f"{fmt_pct(it['post_correct'] / it['post_n'] if it['post_n'] else math.nan, 0)} ({it['post_correct']}/{it['post_n']}) | {it['better']} / {it['worse']} | {fmt(it['mcnemar_p'], 3)} |"
        )
    out += ["", "문항이 12개이므로 문항별 p-값은 다중비교 보정 없이 탐색용으로만 읽습니다.", "", "## 오개념별 선택 비율 (대응 표본)", "", "| 오개념 | 사전 | 사후 |", "|---|---|---|"]
    for m in res["misconceptions"]:
        out.append(f"| {m['id']} | {fmt_pct(m['pre'] / m['n'] if m['n'] else math.nan, 0)} ({m['pre']}/{m['n']}) | {fmt_pct(m['post'] / m['n'] if m['n'] else math.nan, 0)} ({m['post']}/{m['n']}) |")
    out += [
        "",
        "## 읽는 법과 한계",
        "",
        "- 해석 문항은 D02·D07(계산)을 뺀 10문항입니다. 문항 분류는 사이트의 `src/content/diagnostic.ts`(kind)를 따르며 교수 검토로 확정합니다.",
        "- M1 보유는 M1 문항(D01)에서 M1이 붙은 답이나 이유를 고른 경우입니다.",
        "- 핵심 경로 완료는 E01·E02·E04에서 예상을 확정하고 결과를 본 기록이 모두 있는 경우입니다. 예상 단계 응답률의 분모는 학습자가 연 실험(방문 기록)입니다.",
        "- 사전·사후에 같은 문항을 쓰므로 재검사 효과가 섞입니다. 대조군이 없으므로 사이트 이용과 점수 변화 사이의 인과를 주장하지 않습니다(PRD §2.3).",
        "- 학습자의 자유 응답(예상 이유)은 이 보고서에 싣지 않습니다. 필요하면 `--with-reasons`로 따로 내보냅니다.",
        "",
    ]
    return "\n".join(out)


def write_csvs(learners: list[Learner], res: dict, out: Path, with_reasons: bool) -> None:
    def w(name: str, rows: list[dict]) -> None:
        if not rows:
            return
        with open(out / name, "w", newline="", encoding="utf-8-sig") as f:
            wr = csv.DictWriter(f, fieldnames=list(rows[0]))
            wr.writeheader()
            wr.writerows(rows)

    r4 = lambda v: round(v, 4) if isinstance(v, float) else v
    rows = []
    for l in learners:
        g = (l.post["score"] - l.pre["score"]) / (100 - l.pre["score"]) if l.pre and l.post and l.pre["score"] < 100 else ""
        rows.append(
            {
                "participant_id": l.pid,
                "source_file": l.source,
                "pre_score": l.pre["score"] if l.pre else "",
                "post_score": l.post["score"] if l.post else "",
                "pre_interp": l.pre["interp_score"] if l.pre else "",
                "post_interp": l.post["interp_score"] if l.post else "",
                "gain": g,
                "pre_m1": int(holds(l.pre, "M1")) if l.pre else "",
                "post_m1": int(holds(l.post, "M1")) if l.post else "",
                "core_path": int(set(CORE_PATH) <= l.predicted),
                "visited": " ".join(sorted(l.visited)),
                "predicted": " ".join(sorted(l.predicted)),
                "hours_pre_post": hours_between(l.pre["timestamp"], l.post["timestamp"]) if l.pre and l.post else "",
            }
        )
        rows[-1] = {k: r4(v) for k, v in rows[-1].items()}
    w("learners.csv", rows)
    w("items.csv", [{k: r4(v) for k, v in it.items()} for it in res["items"]])
    w("misconceptions.csv", res["misconceptions"])
    if with_reasons:
        w(
            "reasons.csv",
            [
                {"participant_id": l.pid, "experiment_id": e.get("experiment_id"), "item_id": e.get("item_id"), "prediction": e.get("prediction"), "confidence": e.get("confidence"), "reason": e.get("reason"), "correct": e.get("correct"), "timestamp": e.get("timestamp")}
                for l in learners
                for e in l.log
                if e.get("reason")
            ],
        )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="구간 실험실 파일럿 제출 파일을 분석한다 (PRD §2.3)")
    ap.add_argument("inputs", nargs="+", type=Path, help="제출 파일(.json) 또는 그 파일들이 든 폴더")
    ap.add_argument("--out", type=Path, default=Path("pilot-report"), help="결과 폴더 (기본: pilot-report)")
    ap.add_argument("--with-reasons", action="store_true", help="학습자의 자유 응답(예상 이유)을 reasons.csv로 내보냄")
    a = ap.parse_args(argv)
    learners, warnings = load(a.inputs)
    if not learners:
        print("읽을 수 있는 제출 파일이 없습니다.", *warnings, sep="\n", file=sys.stderr)
        return 1
    res = analyze(learners)
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "report.md").write_text(report(res, warnings), encoding="utf-8")
    write_csvs(learners, res, a.out, a.with_reasons)
    print(f"학습자 {len(learners)}명 → {a.out / 'report.md'}")
    for x in warnings:
        print("경고:", x, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
