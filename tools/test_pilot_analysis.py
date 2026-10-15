"""파일럿 분석 스크립트 테스트 (표준 라이브러리 unittest). python tools/test_pilot_analysis.py"""

from __future__ import annotations

import json
import math
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pilot_analysis as pa  # noqa: E402
from pilot_sample import ITEMS, attempt, pilot_file, synth  # noqa: E402

T0 = datetime(2026, 11, 2, 9, tzinfo=timezone.utc)


def all_correct():
    return {i: (True, []) for i, _, _ in ITEMS}


def with_wrong(*ids_mis):
    r = all_correct()
    for i, m in ids_mis:
        r[i] = (False, [m])
    return r


class Stats(unittest.TestCase):
    def test_wilson(self):
        lo, hi = pa.wilson(8, 10)
        self.assertAlmostEqual(lo, 0.4901624, places=6)  # scipy/statsmodels proportion_confint(method="wilson")
        self.assertAlmostEqual(hi, 0.9433178, places=6)
        self.assertAlmostEqual(pa.wilson(0, 10)[0], 0.0, places=12)

    def test_t(self):
        self.assertAlmostEqual(pa.t_ppf(0.975, 9), 2.2621572, places=5)
        self.assertAlmostEqual(pa.t_ppf(0.975, 29), 2.0452296, places=5)
        self.assertAlmostEqual(pa.t_cdf(0.0, 5), 0.5, places=12)
        m, lo, hi = pa.mean_ci([1, 2, 3, 4, 5])
        self.assertAlmostEqual(m, 3)
        self.assertAlmostEqual(hi - m, 2.7764451 * math.sqrt(2.5) / math.sqrt(5), places=5)

    def test_mcnemar(self):
        self.assertAlmostEqual(pa.mcnemar_exact(0, 6), 2 / 64)
        self.assertEqual(pa.mcnemar_exact(3, 3), 1.0)
        self.assertEqual(pa.mcnemar_exact(0, 0), 1.0)


class Metrics(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def write(self, d, name=None):
        (self.dir / (name or f"{d['participant_id']}.json")).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")

    def test_known_dataset(self):
        # P1: 사전 D01(M1)·D02 틀림 → 사후 만점. P2: 사전 D01(M1)·D03 틀림 → 사후 D03만 틀림.
        # P3: 사전 만점 → 사후 만점 (개인 이득 제외). P4: 사전만 응시.
        pre1, post1 = with_wrong(("D01", "M1"), ("D02", "M2")), all_correct()
        pre2, post2 = with_wrong(("D01", "M1"), ("D03", "M3")), with_wrong(("D03", "M3"))
        self.write(pilot_file("P1", attempt(pre1, T0), attempt(post1, T0 + timedelta(hours=48)), ["E01", "E02", "E04"], ["E01", "E02", "E04", "E05"], T0))
        self.write(pilot_file("P2", attempt(pre2, T0), attempt(post2, T0 + timedelta(hours=24)), ["E01", "E04"], ["E01", "E02", "E04"], T0))
        self.write(pilot_file("P3", attempt(all_correct(), T0), attempt(all_correct(), T0 + timedelta(hours=72)), ["E01", "E02", "E04", "E06"], ["E01", "E02", "E04", "E06"], T0))
        self.write(pilot_file("P4", attempt(pre1, T0), None, [], ["E01"], T0))
        learners, warnings = pa.load([self.dir])
        self.assertEqual(warnings, [])
        r = pa.analyze(learners)
        self.assertEqual((r["n_files"], r["n_pre"], r["n_post"], r["n_matched"]), (4, 4, 3, 3))
        # 사후 해석 정답률: 100, 90, 100 (해석 10문항)
        self.assertAlmostEqual(r["interp_post"][0], 290 / 3)
        # 점수: 사전 (10/12, 10/12, 1), 사후 (1, 11/12, 1)
        pre_m = (100 * 10 / 12 * 2 + 100) / 3
        post_m = (100 + 100 * 11 / 12 + 100) / 3
        self.assertAlmostEqual(r["gain_class"], (post_m - pre_m) / (100 - pre_m))
        self.assertAlmostEqual(r["gain_indiv"][0], (1.0 + 0.5) / 2)
        self.assertEqual(r["n_gain_excluded"], 1)
        # M1: 사전 2/3, 사후 0/3, 비 0
        self.assertEqual(r["m1_pre"], (2, 3))
        self.assertEqual(r["m1_post"], (0, 3))
        self.assertEqual(r["m1_ratio"], 0.0)
        self.assertAlmostEqual(r["m1_mcnemar"], 0.5)
        # 핵심 경로: P1·P3 완료, P2(E02 없음)·P4 미완료 → 2/4
        self.assertEqual(r["core_path"], (2, 4))
        # 예상 응답률: (3 + 2 + 4 + 0) / (4 + 3 + 4 + 1)
        self.assertEqual(r["predict_rate"], (9, 12))
        d01 = next(i for i in r["items"] if i["item"] == "D01")
        self.assertEqual((d01["pre_correct"], d01["pre_n"], d01["post_correct"], d01["better"], d01["worse"]), (1, 4, 3, 2, 0))
        m3 = next(m for m in r["misconceptions"] if m["id"] == "M3")
        self.assertEqual((m3["pre"], m3["post"]), (1, 1))
        self.assertEqual(sorted(r["hours_pre_post"]), [24, 48, 72])

    def test_duplicates_and_bad_files(self):
        early = pilot_file("P1", attempt(all_correct(), T0), None, [], [], T0)
        late = pilot_file("P1", attempt(with_wrong(("D01", "M1")), T0), None, [], [], T0 + timedelta(days=1))
        self.write(early, "a.json")
        self.write(late, "b.json")
        (self.dir / "c.json").write_text("[]", encoding="utf-8")
        (self.dir / "d.json").write_text("{not json", encoding="utf-8")
        learners, warnings = pa.load([self.dir])
        self.assertEqual(len(learners), 1)
        self.assertEqual(learners[0].source, "b.json")
        self.assertEqual(len(warnings), 3)

    def test_end_to_end_report(self):
        for d in synth(20, 3):
            self.write(d)
        out = self.dir / "out"
        self.assertEqual(pa.main([str(self.dir), "--out", str(out)]), 0)
        rep = (out / "report.md").read_text(encoding="utf-8")
        self.assertIn("## PRD §2.3 지표", rep)
        self.assertIn("대응 20명", rep)
        for name in ("learners.csv", "items.csv", "misconceptions.csv"):
            self.assertTrue((out / name).exists(), name)
        self.assertFalse((out / "reasons.csv").exists())

    def test_empty(self):
        self.assertEqual(pa.main([str(self.dir), "--out", str(self.dir / "o")]), 1)


if __name__ == "__main__":
    unittest.main()
