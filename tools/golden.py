"""PRD v2 §9 기준값(golden) 생성기 — MVP-α 범위.

사용: python tools/golden.py  →  tests/golden/golden.json
엔진 테스트(tests/engine/golden.test.ts)는 이 파일과 대조한다.
"""
import json
import math
from pathlib import Path

from scipy.stats import beta, binom, chi2, f as fdist, norm, t as tdist

OUT = Path(__file__).resolve().parent.parent / "tests" / "golden" / "golden.json"
z975 = norm.ppf(0.975)

g = {
    # G01 Q_0.975(N(0,1))
    "G01": {"q": 0.975, "value": z975},
    # G02 x̄=100, SE=5 (σ=25, n=25) 95% z 구간
    "G02": {"xbar": 100, "sigma": 25, "n": 25, "level": 0.95, "lower": 100 - 5 * z975, "upper": 100 + 5 * z975},
    # G03 교재 8.1: θ̂ ~ N(θ, 2²), θ̂ = 15
    "G03": {"xbar": 15, "sigma": 2, "n": 1, "level": 0.95, "lower": 15 - 2 * z975, "upper": 15 + 2 * z975},
    # G04 Q_0.975(t_24)
    "G04": {"q": 0.975, "df": 24, "value": tdist.ppf(0.975, 24)},
    # G13 z 검정 p-값, μ₀ = 90
    "G13": {"xbar": 100, "sigma": 25, "n": 25, "mu0": 90, "p": 2 * norm.sf(abs(100 - 90) / 5)},
    # G14 오차한계 σ = 25
    "G14": [{"sigma": 25, "n": n, "level": 0.95, "E": z975 * 25 / math.sqrt(n)} for n in (25, 100)],
    # G15 표본크기 σ = 25, E = 5
    "G15": {"sigma": 25, "E": 5, "level": 0.95, "n": math.ceil((z975 * 25 / 5) ** 2)},
    # G18 오포함확률 P_100{90 ∈ C}, SE = 5
    "G18": {"truth": 100, "other": 90, "se": 5, "value": norm.cdf(z975 - 2) - norm.cdf(-z975 - 2)},
    # 단측 한계와 단측 p-값
    "oneSided": [
        {"xbar": 100, "sigma": 25, "n": 25, "level": 0.95, "alt": "greater", "lower": 100 - 5 * norm.ppf(0.95)},
        {"xbar": 100, "sigma": 25, "n": 25, "level": 0.95, "alt": "less", "upper": 100 + 5 * norm.ppf(0.95)},
    ],
    # t 분위수 여러 자유도
    "tq": [{"q": q, "df": df, "value": tdist.ppf(q, df)} for df in (1, 2, 4, 9, 24, 99) for q in (0.9, 0.95, 0.975, 0.995, 0.025)],
    # t 검정 p-값 (교재 프로그램 8.1형: N(0,1), n = 10)
    "tp": [{"xbar": xb, "s": s, "n": 10, "mu0": 0, "p": 2 * tdist.sf(abs(xb / (s / math.sqrt(10))), 9)} for xb, s in ((0.3, 1.1), (-0.8, 0.9), (0.05, 1.0))],
}


# ---- 이항 (E02 이항 신뢰띠, PRD §9 G06·G08·G09·G11) ----
def binom_ci(x, n, level, method):
    a = 1 - level
    z = norm.ppf(1 - a / 2)
    ph = x / n
    if method == "cp":
        return (0.0 if x == 0 else beta.ppf(a / 2, x, n - x + 1), 1.0 if x == n else beta.ppf(1 - a / 2, x + 1, n - x))
    if method == "wilson":
        d = 1 + z * z / n
        c = (ph + z * z / (2 * n)) / d
        h = z / d * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))
        return (c - h, c + h)
    h = z * math.sqrt(ph * (1 - ph) / n)
    return (ph - h, ph + h)


def binom_cov(n, p, level, method):
    return sum(binom.pmf(x, n, p) for x in range(n + 1) if binom_ci(x, n, level, method)[0] <= p <= binom_ci(x, n, level, method)[1])


g["binomCI"] = [
    {"x": x, "n": n, "level": lv, "method": m, "lower": binom_ci(x, n, lv, m)[0], "upper": binom_ci(x, n, lv, m)[1]}
    for (x, n) in ((3, 10), (0, 10), (10, 10), (1, 1), (17, 50), (0, 100), (99, 100))
    for lv in (0.95, 0.9)
    for m in ("cp", "wilson", "wald")
]
g["binomCov"] = [
    {"n": n, "p": p, "level": 0.95, "method": m, "value": binom_cov(n, p, 0.95, m)}
    for (n, p) in ((10, 0.3), (10, 0.05), (25, 0.5), (50, 0.12))
    for m in ("cp", "wilson", "wald")
]
g["binomP"] = [
    {"x": x, "n": n, "p0": p0, "p": min(1.0, 2 * min(binom.cdf(x, n, p0), binom.sf(x - 1, n, p0)))}
    for (x, n, p0) in ((3, 10, 0.5), (3, 10, 0.05), (0, 10, 0.2), (17, 50, 0.5))
]


# ---- E06 이항구간 비교 (PRD §9 G06–G12) ----
def cmp_ci(x, n, level, m, a=1.0, b=1.0):
    al = 1 - level
    z = norm.ppf(1 - al / 2)
    if m in ("cp", "wilson", "wald"):
        return binom_ci(x, n, level, m)
    if m == "wald_clipped":
        lo, hi = binom_ci(x, n, level, "wald")
        return (max(0.0, lo), min(1.0, hi))
    if m in ("jeffreys", "jeffreys_boundary"):
        lo, hi = beta.ppf(al / 2, x + 0.5, n - x + 0.5), beta.ppf(1 - al / 2, x + 0.5, n - x + 0.5)
        if m == "jeffreys_boundary":
            lo = 0.0 if x == 0 else lo
            hi = 1.0 if x == n else hi
        return (lo, hi)
    if m == "bayes_beta":
        return (beta.ppf(al / 2, a + x, b + n - x), beta.ppf(1 - al / 2, a + x, b + n - x))
    if m == "agresti_coull":
        nt = n + z * z
        pt = (x + z * z / 2) / nt
        h = z * math.sqrt(pt * (1 - pt) / nt)
        return (pt - h, pt + h)
    raise ValueError(m)


def perf(n, p, level, m, a=1.0, b=1.0):
    cov = ln = ml = mr = 0.0
    for x in range(n + 1):
        w = binom.pmf(x, n, p)
        lo, hi = cmp_ci(x, n, level, m, a, b)
        ln += w * (hi - lo)
        if lo > p:
            ml += w
        elif hi < p:
            mr += w
        else:
            cov += w
    return {"coverage": cov, "meanLength": ln, "missLeft": ml, "missRight": mr}


METHODS = ["wald", "wald_clipped", "wilson", "cp", "jeffreys", "jeffreys_boundary", "agresti_coull", "bayes_beta"]
g["cmpCI"] = [
    {"x": x, "n": n, "level": 0.95, "method": m, "a": 2, "b": 3, "lower": cmp_ci(x, n, 0.95, m, 2, 3)[0], "upper": cmp_ci(x, n, 0.95, m, 2, 3)[1]}
    for (x, n) in ((3, 10), (0, 10), (10, 10), (17, 50))
    for m in METHODS
]
g["cmpPerf"] = [
    {"n": n, "p": p, "level": 0.95, "method": m, "a": 2, "b": 3, **perf(n, p, 0.95, m, 2, 3)}
    for (n, p) in ((10, 0.3), (10, 0.01), (40, 0.07))
    for m in METHODS
]
grid = [i / 1000 for i in range(1, 1000)]
cs = [perf(10, q, 0.95, "cp")["coverage"] for q in grid]
g["cmpGridCP10"] = {"min": min(cs), "at": grid[cs.index(min(cs))], "mean": sum(cs) / len(cs)}


# ---- E07 세 관점 (PRD §9 G16, AC-E07-2) ----
def post_normal(xbar, sigma, n, m0, tau0):
    vn = 1 / (n / sigma**2 + 1 / tau0**2)
    return vn * (n * xbar / sigma**2 + m0 / tau0**2), vn


def cred_cov(mu, sigma, n, level, m0, tau0):
    se = sigma / math.sqrt(n)
    mn0, vn = post_normal(0, sigma, n, m0, tau0)
    w = vn * n / sigma**2
    h = norm.ppf(1 - (1 - level) / 2) * math.sqrt(vn)
    d = (1 - w) * (m0 - mu)
    return norm.cdf((h - d) / (w * se)) - norm.cdf((-h - d) / (w * se))


mn, vn = post_normal(100, 25, 25, 90, 10)
g["E07post"] = {"xbar": 100, "sigma": 25, "n": 25, "m0": 90, "tau0": 10, "mean": mn, "variance": vn, "lower": mn - z975 * math.sqrt(vn), "upper": mn + z975 * math.sqrt(vn)}
g["E07cov"] = [{"mu": mu, "sigma": 25, "n": 25, "level": 0.95, "m0": 90, "tau0": tau0, "value": cred_cov(mu, 25, 25, 0.95, 90, tau0)} for mu in (80, 90, 100, 110, 130) for tau0 in (2, 10, 100)]


# ---- E08 예측구간 (PRD §9 G17, AC-E08-1) ----
from scipy.optimize import brentq

pi_h = z975 * 25 * math.sqrt(1 + 1 / 25)
q24 = tdist.ppf(0.975, 24)
g["E08"] = {
    "pi": {"xbar": 100, "sigma": 25, "n": 25, "lower": 100 - pi_h, "upper": 100 + pi_h},
    "piT": {"xbar": 100, "s": 20, "n": 25, "lower": 100 - q24 * 20 * math.sqrt(1.04), "upper": 100 + q24 * 20 * math.sqrt(1.04)},
    # z 신뢰구간이 새 관측값을 포함할 확률 2Φ(q/√(n+1)) − 1
    "ciCoversY": [{"n": n, "level": 0.95, "value": 2 * norm.cdf(z975 / math.sqrt(n + 1)) - 1} for n in (1, 10, 25, 100)],
    # z 예측구간이 모집단의 95% 이상을 덮을 확률 (n = 25): |d| ≤ d*에서 질량 ≥ 0.95, d = (x̄ − μ)/σ
    "piMassAtLeast": None,
}
k = z975 * math.sqrt(1 + 1 / 25)
mass = lambda d: norm.cdf(d + k) - norm.cdf(d - k)
dstar = brentq(lambda d: mass(d) - 0.95, 0, k)
g["E08"]["piMassAtLeast"] = {"n": 25, "beta": 0.95, "dstar": dstar, "prob": 2 * norm.cdf(dstar * math.sqrt(25)) - 1, "maxMass": mass(0)}


# ---- E05 설계 변수 (PRD §9 G14·G15) ----
from scipy.special import gammaln


def c4(n):
    return math.sqrt(2 / (n - 1)) * math.exp(gammaln(n / 2) - gammaln((n - 1) / 2))


def et_len(sigma, n, level):
    return 2 * tdist.ppf(1 - (1 - level) / 2, n - 1) * c4(n) * sigma / math.sqrt(n)


def n_t(sigma, E, level):
    n = 2
    while et_len(sigma, n, level) / 2 > E:
        n += 1
    return n


g["E05"] = {
    "c4": [{"n": n, "value": c4(n)} for n in (2, 5, 10, 25, 100)],
    "etLen": [{"sigma": 25, "n": n, "level": lv, "value": et_len(25, n, lv)} for n in (2, 5, 25, 100) for lv in (0.9, 0.95, 0.99)],
    "nT": [{"sigma": 25, "E": E, "level": 0.95, "value": n_t(25, E, 0.95)} for E in (5, 10, 2)],
    "nZ": [{"sigma": 25, "E": E, "level": lv, "value": math.ceil((norm.ppf(1 - (1 - lv) / 2) * 25 / E) ** 2)} for E in (5, 10, 2) for lv in (0.9, 0.95, 0.99)],
}


# ---- E03 피벗 (PRD §9 G04·G05, AC-E03-1·2) ----
from scipy.optimize import minimize_scalar


def piv_iv(kind, o, aL, aU):
    if kind in ("z", "t"):
        d = norm if kind == "z" else tdist(o["n"] - 1)
        se = (o["sigma"] if kind == "z" else o["s"]) / math.sqrt(o["n"])
        qL = d.ppf(aL) if aL > 0 else -math.inf
        qU = d.ppf(1 - aU) if aU > 0 else math.inf
        return (o["xbar"] - qU * se, o["xbar"] - qL * se)
    if kind == "chi2":
        k = o["n"] - 1
        ss = k * o["s"] ** 2
        qL = chi2.ppf(aL, k)
        qU = chi2.ppf(1 - aU, k)
        return (ss / qU, ss / qL if qL > 0 else math.inf)
    d1, d2 = o["n"] - 1, o["n2"] - 1
    r = o["s"] ** 2 / o["s2"] ** 2
    qL = fdist.ppf(aL, d1, d2)
    qU = fdist.ppf(1 - aU, d1, d2)
    return (r / qU, r / qL if qL > 0 else math.inf)


O = {"xbar": 100, "sigma": 25, "s": 2, "n": 10, "s2": 1.5, "n2": 8}
g["E03"] = {
    "obs": O,
    "iv": [
        {"kind": k, "aL": aL, "aU": aU, "lower": piv_iv(k, O, aL, aU)[0], "upper": piv_iv(k, O, aL, aU)[1]}
        for k in ("z", "t", "chi2", "f")
        for (aL, aU) in ((0.025, 0.025), (0.01, 0.04), (0.04, 0.01), (0.0, 0.05), (0.05, 0.0))
    ],
    "chi2q": [{"q": q, "k": k, "value": chi2.ppf(q, k)} for k in (1, 2, 9, 24, 99) for q in (0.001, 0.025, 0.5, 0.975, 0.999)],
    "fq": [{"q": q, "d1": a, "d2": b, "value": fdist.ppf(q, a, b)} for (a, b) in ((9, 7), (1, 1), (5, 20), (30, 30)) for q in (0.025, 0.5, 0.975)],
    "shortest": [
        {"kind": k, "share": minimize_scalar(lambda sh: (lambda iv: iv[1] - iv[0])(piv_iv(k, O, 0.05 * sh, 0.05 * (1 - sh))), bounds=(1e-6, 1 - 1e-6), method="bounded", options={"xatol": 1e-10}).x}
        for k in ("z", "t", "chi2", "f")
    ],
}


# ---- E09 가정 위반 (PRD E09 참고값). 정확값이 없어 numpy MC(B = 400,000)로 만든다 ----
import numpy as np


def e09_ref(pop, n, method, level=0.95, B=400_000, seed=20261015):
    rng = np.random.default_rng(seed)
    if pop == "normal":
        z = rng.standard_normal((B, n))
    elif pop == "exp":
        z = rng.exponential(1.0, (B, n)) - 1
    elif pop == "lnorm":
        m, v = math.exp(0.5), (math.e - 1) * math.e
        z = (np.exp(rng.standard_normal((B, n))) - m) / math.sqrt(v)
    else:
        z = rng.standard_t(3, (B, n)) / math.sqrt(3)
    xb = z.mean(1)
    s = z.std(1, ddof=1)
    a = 1 - level
    if method == "chi2":
        lo = (n - 1) * s**2 / chi2.ppf(1 - a / 2, n - 1)
        hi = (n - 1) * s**2 / chi2.ppf(a / 2, n - 1)
        truth = 1.0
    else:
        q = tdist.ppf(1 - a / 2, n - 1) if method == "t" else norm.ppf(1 - a / 2)
        sd = 1.0 if method == "z" else s
        lo, hi = xb - q * sd / math.sqrt(n), xb + q * sd / math.sqrt(n)
        truth = 0.0
    return {"pop": pop, "n": n, "method": method, "B": B, "coverage": float(((lo <= truth) & (truth <= hi)).mean()), "missLeft": float((lo > truth).mean()), "missRight": float((hi < truth).mean())}


g["E09"] = [e09_ref(p_, n_, m_) for (p_, n_, m_) in (("exp", 10, "t"), ("exp", 30, "t"), ("exp", 100, "t"), ("t3", 20, "chi2"), ("exp", 10, "clt"), ("lnorm", 20, "t"), ("normal", 10, "chi2"), ("exp", 20, "chi2"), ("t3", 10, "t"))]


# ---- E10 정확성 (PRD §9 G18·G19, AC-E10-1·2) ----
from scipy.stats import nct


def fc_t(theta, tp, sigma, n, level):
    q = tdist.ppf(1 - (1 - level) / 2, n - 1)
    nc = (theta - tp) * math.sqrt(n) / sigma
    return nct.cdf(q, n - 1, nc) - nct.cdf(-q, n - 1, nc)


g["E10"] = {
    "G18": {"theta": 100, "thetaPrime": 90, "se": 5, "value": norm.cdf(z975 - 2) - norm.cdf(-z975 - 2)},
    "G19": {"se": 5, "value": 2 * z975 * 5},
    "oneSided": [{"theta": 100, "thetaPrime": tp, "se": 5, "value": norm.cdf((tp - 100) / 5 + norm.ppf(0.95))} for tp in (90, 100, 110)],
    "tFalseCov": [{"theta": 100, "thetaPrime": tp, "sigma": 25, "n": n, "level": 0.95, "value": fc_t(100, tp, 25, n, 0.95)} for n in (5, 25) for tp in (80, 90, 100, 105)],
}

OUT.parent.mkdir(parents=True, exist_ok=True)

# ---- E11 두 모집단 (교재 8.4–8.6.2) ----
def ind_iv(m, x1, s1, n1, x2, s2, n2, level=0.95):
    a = 1 - level
    d = x1 - x2
    if m == "pooled":
        df = n1 + n2 - 2
        sp = math.sqrt(((n1 - 1) * s1**2 + (n2 - 1) * s2**2) / df)
        se = sp * math.sqrt(1 / n1 + 1 / n2)
        q = tdist.ppf(1 - a / 2, df)
    else:
        se = math.sqrt(s1**2 / n1 + s2**2 / n2)
        if m == "welch":
            v1, v2 = s1**2 / n1, s2**2 / n2
            df = (v1 + v2) ** 2 / (v1**2 / (n1 - 1) + v2**2 / (n2 - 1))
            q = tdist.ppf(1 - a / 2, df)
        else:
            df = math.inf
            q = norm.ppf(1 - a / 2)
    return d - q * se, d + q * se, df


def wald_diff(a, n1, b, n2, level=0.95):
    p1, p2 = a / n1, b / n2
    se = math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)
    q = norm.ppf(1 - (1 - level) / 2)
    return p1 - p2 - q * se, p1 - p2 + q * se


def wald_cov(p1, n1, p2, n2, level=0.95):
    d = p1 - p2
    c = 0.0
    for a in range(n1 + 1):
        for b in range(n2 + 1):
            lo, hi = wald_diff(a, n1, b, n2, level)
            if lo <= d <= hi:
                c += binom.pmf(a, n1, p1) * binom.pmf(b, n2, p2)
    return c


CASES = [(105, 10, 25, 98, 30, 8), (52.3, 4.1, 12, 48.9, 3.8, 15), (0.5, 1, 40, 0.2, 2, 10)]
g["E11"] = {
    "ind": [{"m": m, "x1": c[0], "s1": c[1], "n1": c[2], "x2": c[3], "s2": c[4], "n2": c[5], **dict(zip(("lower", "upper", "df"), ind_iv(m, *c)))} for c in CASES for m in ("pooled", "welch", "zlarge")],
    "paired": [{"dbar": 3.2, "sd": 4.5, "n": 12, "lower": 3.2 - tdist.ppf(0.975, 11) * 4.5 / math.sqrt(12), "upper": 3.2 + tdist.ppf(0.975, 11) * 4.5 / math.sqrt(12)}],
    "propIv": [{"x1": 30, "n1": 100, "x2": 18, "n2": 90, "lower": wald_diff(30, 100, 18, 90)[0], "upper": wald_diff(30, 100, 18, 90)[1]}],
    "propCov": [{"p1": p1, "n1": n1, "p2": p2, "n2": n2, "value": wald_cov(p1, n1, p2, n2)} for (p1, n1, p2, n2) in ((0.3, 20, 0.2, 15), (0.5, 50, 0.5, 50), (0.05, 30, 0.1, 30))],
}


# ---- E12 HPD (교재 예 9.7·9.8, PRD E12) ----
from scipy.optimize import brentq as _brentq
from scipy.stats import gamma as _gamma


def hpd_unimodal(dist, level=0.95):
    """단봉: 하한 l을 고르면 상한은 질량 조건으로 정해진다. f(l) = f(u)인 l을 찾는다"""
    def upper(l):
        return dist.ppf(dist.cdf(l) + level)
    lo, hi = dist.ppf(1e-12), dist.ppf(1 - level - 1e-12)
    l = _brentq(lambda l: dist.pdf(l) - dist.pdf(upper(l)), lo, hi, xtol=1e-14)
    return [l, upper(l)]


b48 = beta(4, 8)
post98v = 1 / (10 / 1 + 1 / 100)
post98m = post98v * (10 * 10.2 / 1 + 0 / 100)
g98 = norm(post98m, math.sqrt(post98v))
ga = _gamma(4, scale=1 / 4.5)
ub = beta(0.4, 0.4)
l_u = ub.ppf(0.475)

# 혼합: w·N(m1,s1²) + (1−w)·N(m2,s2²)
w, m1, s1, m2, s2 = 0.6, -1.5, 0.6, 1.8, 0.8
mpdf = lambda x: w * norm.pdf(x, m1, s1) + (1 - w) * norm.pdf(x, m2, s2)
mcdf = lambda x: w * norm.cdf(x, m1, s1) + (1 - w) * norm.cdf(x, m2, s2)


def mix_set(h):
    xs = np.linspace(-6, 7, 20001)
    f = mpdf(xs) - h
    roots = [_brentq(lambda x: mpdf(x) - h, xs[i], xs[i + 1], xtol=1e-14) for i in range(len(xs) - 1) if f[i] * f[i + 1] < 0]
    return [roots[i:i + 2] for i in range(0, len(roots), 2)]


hmix = _brentq(lambda h: sum(mcdf(b) - mcdf(a) for a, b in mix_set(h)) - 0.95, 1e-6, mpdf(m1) * 0.999, xtol=1e-14)

# Beta(4,8)의 logit 좌표 HPD를 θ로 되돌린 구간
from scipy.special import expit, logit


class LogitBeta:
    def pdf(self, p):
        tt = expit(p)
        return b48.pdf(tt) * tt * (1 - tt)

    def cdf(self, p):
        return b48.cdf(expit(p))

    def ppf(self, q):
        return logit(b48.ppf(q))


lg = hpd_unimodal(LogitBeta())

g["E12"] = {
    "ex97": {"a": 4, "b": 8, "et": [b48.ppf(0.025), b48.ppf(0.975)], "hpd": hpd_unimodal(b48)},
    "ex98": {"mean": post98m, "variance": post98v, "hpd": [g98.ppf(0.025), g98.ppf(0.975)]},
    "gamma": {"k": 4, "r": 4.5, "et": [ga.ppf(0.025), ga.ppf(0.975)], "hpd": hpd_unimodal(ga)},
    "ubeta": {"a": 0.4, "b": 0.4, "components": [[0.0, l_u], [1 - l_u, 1.0]]},
    "mix": {"w": w, "m1": m1, "s1": s1, "m2": m2, "s2": s2, "h": hmix, "components": mix_set(hmix)},
    "logitHpd": {"theta": [float(expit(lg[0])), float(expit(lg[1]))]},
}


# ---- P2: 이항 가능도비 구간 ----
def lr_iv(x, n, level=0.95):
    crit = norm.ppf(1 - (1 - level) / 2) ** 2
    ph = x / n
    ll = lambda p: (x * math.log(p) if x else 0.0) + ((n - x) * math.log1p(-p) if n - x else 0.0)
    dev = lambda p: 2 * (ll(ph) - ll(p)) - crit
    lo = 0.0 if x == 0 else _brentq(dev, 1e-15, ph, xtol=1e-15)
    hi = 1.0 if x == n else _brentq(dev, ph, 1 - 1e-15, xtol=1e-15)
    return lo, hi


g["LR"] = [{"x": x, "n": n, "lower": lr_iv(x, n)[0], "upper": lr_iv(x, n)[1]} for (x, n) in ((3, 10), (0, 10), (10, 10), (1, 25), (40, 100))]
g["LRcov"] = [{"n": n, "p": p, "value": sum(binom.pmf(k, n, p) for k in range(n + 1) if lr_iv(k, n)[0] <= p <= lr_iv(k, n)[1])} for (n, p) in ((10, 0.3), (25, 0.08))]


# ---- P2: 두 비율의 차 Newcombe hybrid score ----
def newcombe(a, n1, b, n2, level=0.95):
    l1, u1 = binom_ci(a, n1, level, "wilson")
    l2, u2 = binom_ci(b, n2, level, "wilson")
    p1, p2 = a / n1, b / n2
    d = p1 - p2
    return d - math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), d + math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)


def newcombe_cov(p1, n1, p2, n2, level=0.95):
    d = p1 - p2
    return sum(binom.pmf(a, n1, p1) * binom.pmf(b, n2, p2) for a in range(n1 + 1) for b in range(n2 + 1) if newcombe(a, n1, b, n2, level)[0] <= d <= newcombe(a, n1, b, n2, level)[1])


g["Newcombe"] = {
    "iv": [{"x1": a, "n1": n1, "x2": b, "n2": n2, "lower": newcombe(a, n1, b, n2)[0], "upper": newcombe(a, n1, b, n2)[1]} for (a, n1, b, n2) in ((56, 70, 48, 80), (9, 10, 3, 10), (0, 10, 0, 20), (30, 100, 18, 90))],
    "cov": [{"p1": p1, "n1": n1, "p2": p2, "n2": n2, "value": newcombe_cov(p1, n1, p2, n2)} for (p1, n1, p2, n2) in ((0.3, 20, 0.2, 15), (0.05, 30, 0.1, 30))],
}


# ---- P2: 부트스트랩 (E14). 같은 표본·같은 재표집 통계량을 넣어 공식을 독립 구현과 대조한다 ----
def boot_stat(kind, x):
    if kind == "mean":
        return float(np.mean(x))
    if kind == "median":
        return float(np.median(x))
    return float(np.var(x, ddof=1))


def boot_ivs(kind, x, bs, level=0.95):
    a_ = 1 - level
    th = boot_stat(kind, x)
    bs = np.sort(bs)
    qlo, qhi = np.quantile(bs, a_ / 2), np.quantile(bs, 1 - a_ / 2)
    z0 = norm.ppf(np.mean(bs < th))
    jack = np.array([boot_stat(kind, np.delete(x, i)) for i in range(len(x))])
    jm = jack.mean()
    acc = np.sum((jm - jack) ** 3) / (6 * np.sum((jm - jack) ** 2) ** 1.5)
    adj = lambda zq: norm.cdf(z0 + (z0 + zq) / (1 - acc * (z0 + zq)))
    return {"theta": th, "percentile": [qlo, qhi], "basic": [2 * th - qhi, 2 * th - qlo], "bca": [np.quantile(bs, adj(norm.ppf(a_ / 2))), np.quantile(bs, adj(norm.ppf(1 - a_ / 2)))], "z0": z0, "a": acc}


_rng = np.random.default_rng(14)
_x = np.round(np.exp(_rng.standard_normal(17)) * 10, 4)
_boot = []
for kind in ("mean", "median", "var"):
    bs = np.array([boot_stat(kind, _rng.choice(_x, len(_x))) for _ in range(500)])
    _boot.append({"kind": kind, "boot": sorted(bs.tolist()), **{k: (v.tolist() if hasattr(v, "tolist") else v) for k, v in boot_ivs(kind, _x, bs).items()}})


def boot_cov(R=4000, B=1000, n=20, seed=7):
    rng = np.random.default_rng(seed)
    hits = {"percentile": 0, "basic": 0, "bca": 0}
    for _ in range(R):
        x = rng.exponential(1.0, n) - 1
        bs = x[rng.integers(0, n, (B, n))].mean(1)
        iv = boot_ivs("mean", x, bs)
        for m in hits:
            hits[m] += iv[m][0] <= 0 <= iv[m][1]
    return {m: v / R for m, v in hits.items()}


g["Boot"] = {"x": _x.tolist(), "cases": _boot, "covExpMean20": {"R": 4000, "B": 1000, **boot_cov()}}


# ---- P2: 정규 허용구간 (E08). SciPy quad로 정확 양측 계수, nct로 단측 계수, Howe 근사 ----
from scipy.integrate import quad as _quad


def _r(z, beta):
    return _brentq(lambda r: norm.cdf(z + r) - norm.cdf(z - r) - beta, 0, abs(z) + 12, xtol=1e-14)


def tol2_conf(k, n, beta):
    f = lambda z: math.sqrt(n) * norm.pdf(z * math.sqrt(n)) * chi2.sf((n - 1) * _r(z, beta) ** 2 / k**2, n - 1)
    return 2 * _quad(f, 0, np.inf, epsabs=1e-13, limit=200)[0]


def tol2_k(n, beta, gamma):
    return _brentq(lambda k: tol2_conf(k, n, beta) - gamma, 0.05, 50, xtol=1e-12)


def howe(n, beta, gamma):
    return math.sqrt((n - 1) * (1 + 1 / n) * norm.ppf((1 + beta) / 2) ** 2 / chi2.ppf(1 - gamma, n - 1))


def tol1_k(n, beta, gamma):
    return nct.ppf(gamma, n - 1, norm.ppf(beta) * math.sqrt(n)) / math.sqrt(n)


g["Tol"] = [{"n": n, "beta": b, "gamma": c, "k2": tol2_k(n, b, c), "howe": howe(n, b, c), "k1": tol1_k(n, b, c)} for (n, b, c) in ((10, 0.9, 0.95), (25, 0.95, 0.95), (5, 0.99, 0.9), (50, 0.9, 0.99))]


def _finite(v):
    """JSON에는 무한대가 없으므로 null로 쓴다 (테스트는 null을 ±∞로 읽는다)"""
    if isinstance(v, float) and math.isinf(v):
        return None
    if isinstance(v, dict):
        return {k: _finite(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_finite(x) for x in v]
    return v


OUT.write_text(json.dumps(_finite(g), indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")
print("wrote", OUT)
