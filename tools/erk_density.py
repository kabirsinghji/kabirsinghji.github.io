"""Renders the density figure on science.html (fig/theta-*.webp, fig/erk-*-*.webp).

A toy Ras-Raf-MEK-ERK cascade with delayed ERK feedback onto Raf. Each cell gets its own
Raf activation rate and feedback strength, theta, drawn from a Gaussian in log space; every
draw is run through the model after a step of growth signal, and the cells' responses
(peak ERK, and how far ERK adapts back from that peak) form the pushed-forward density f(theta).
Three cases: normal, Raf stuck on, and Raf stuck on plus a MEK inhibitor.
Run from the repo root: python3 tools/erk_density.py   (numpy, scipy, Pillow)"""
import json
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image

rng = np.random.default_rng(7)
N = 80000
th = rng.multivariate_normal([0, 0], [[0.06, 0], [0, 0.1]], N)
a, f = 10 ** th[:, 0], 6 * 10 ** th[:, 1]


def run(m, i, T=8, dt=0.01):
    R, M, E, F, peak = (np.zeros(N) for _ in range(5))
    for k in range(int(T / dt)):
        u = 1.0 if k * dt > 1 else 0.0
        dR = (a * (u + 2 * m) / (1 + f * F * (1 - 0.8 * m)) * (1 - R) - R) / .3
        dM = (1.5 * R * (1 - i) * (1 - M) - M) / .3
        dE = (1.5 * M * (1 - E) - E) / .3
        dF = (E - F) / 1.2
        R += dR * dt; M += dM * dt; E += dE * dt; F += dF * dt
        peak = np.maximum(peak, E)
    return peak, 1 - E / peak            # peak ERK, adaptation


S = 520
RAMPS = {
    'blue-light': ['#DCE3FF', '#8FA4EC', '#2B48C8', '#14215E'],
    'red-light': ['#F5DDD3', '#E39A82', '#A83A22', '#5A1A0C'],
    'blue-dark': ['#1E2547', '#3E55B8', '#8EA2FF', '#DDE4FF'],
    'red-dark': ['#3A211A', '#8C3F2B', '#F0957C', '#FFE0D6'],
}


def ramp(stops, v):
    st = np.stack([[int(s[j:j + 2], 16) for j in (1, 3, 5)] for s in stops]).astype(float)
    n = len(stops) - 1
    x = np.clip(v, 0, 1) * n
    i = np.minimum(x.astype(int), n - 1)
    fr = (x - i)[..., None]
    return st[i] * (1 - fr) + st[i + 1] * fr


def dens(x, y, xr, yr, sig):
    H = np.histogram2d(y, x, bins=S, range=[yr, xr])[0][::-1]
    H = gaussian_filter(H, sig)
    return H / H.max()


def save(H, name, path, levels=22):
    q = np.ceil(H * levels) / levels                      # banded, like filled contours
    q = np.where(H < 0.012, 0, q)
    img = np.dstack([ramp(RAMPS[name], q ** 1.15), np.clip(q ** 0.7 * 1.2, 0, 1) * 255])
    Image.fromarray(img.astype(np.uint8), 'RGBA').save(path, 'WEBP', quality=88, method=6)


outs = {k: run(*v) for k, v in {'normal': (0, 0), 'mutant': (1, 0), 'drug': (1, .85)}.items()}
xr, yr = [0.08, 0.52], [-0.12, 0.62]
for theme in ('light', 'dark'):
    save(dens(th[:, 0], th[:, 1], [-1.1, 1.1], [-1.4, 1.4], 12), 'blue-' + theme, f'fig/theta-{theme}.webp')
    for k, (x, y) in outs.items():
        save(dens(x, y, xr, yr, 10), ('red-' if k == 'mutant' else 'blue-') + theme, f'fig/erk-{k}-{theme}.webp')
# where each case's median lands in the right-hand panel, in percent, for the labels
print(json.dumps({k: [round((np.median(x) - xr[0]) / (xr[1] - xr[0]) * 100, 1),
                      round((1 - (np.median(y) - yr[0]) / (yr[1] - yr[0])) * 100, 1)] for k, (x, y) in outs.items()}))
