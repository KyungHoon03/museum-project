"""국궁 컨셉 예시 전시물(3D OBJ)과 전시 패널(SVG)을 만든다.

실행: python tools/generate_exhibits.py   (저장소 루트에서)
- 3D: assets/exhibits/*.obj  — 단위 m, Y 위, 정면 +Z. 정점 색(v x y z r g b)을 쓴다.
- 2D: assets/panels/*.svg     — 자리마다 실제 부착면의 가로세로 비율에 맞춘 패널.
전시 컨셉: "국궁 — 활을 만들고, 쏘고, 겨루는 사람들"
형상은 실물 치수를 참고한 단순화 모형이며 실측 복제가 아니다.
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_3D = os.path.join(ROOT, 'assets', 'exhibits')
OUT_2D = os.path.join(ROOT, 'assets', 'panels')

# ---------------------------------------------------------------- 색
HORN = (0.13, 0.10, 0.08)        # 물소뿔·화피로 덮인 활채
GRIP = (0.46, 0.17, 0.11)        # 줌통 가죽
TIP = (0.62, 0.47, 0.29)         # 고자(뽕나무)
STRING = (0.86, 0.83, 0.72)      # 시위
BAMBOO = (0.80, 0.69, 0.43)
BAMBOO_NODE = (0.58, 0.46, 0.26)
FEATHER = (0.55, 0.45, 0.34)
FEATHER_LIGHT = (0.84, 0.80, 0.70)
IRON = (0.23, 0.23, 0.25)
BRASS = (0.71, 0.56, 0.27)
LACQUER = (0.20, 0.09, 0.06)
WOOD = (0.47, 0.31, 0.18)
WOOD_DARK = (0.30, 0.20, 0.12)
FABRIC_RED = (0.45, 0.10, 0.09)
FABRIC_BLUE = (0.12, 0.16, 0.32)
CORD_RED = (0.70, 0.13, 0.10)
SINEW = (0.88, 0.84, 0.70)
GLUE = (0.72, 0.48, 0.16)
TARGET_FACE = (0.90, 0.88, 0.82)
TARGET_RED = (0.76, 0.13, 0.10)
BLACK = (0.08, 0.08, 0.08)


def sub(a, b): return [a[i] - b[i] for i in range(3)]
def add(a, b): return [a[i] + b[i] for i in range(3)]
def mul(a, k): return [v * k for v in a]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def norm(a):
    length = math.sqrt(dot(a, a)) or 1.0
    return [v / length for v in a]


class Mesh:
    def __init__(self):
        self.v = []
        self.f = []

    def vert(self, p, color):
        self.v.append((p[0], p[1], p[2], *color))
        return len(self.v)

    def tri(self, a, b, c):
        self.f.append((a, b, c))

    def quad(self, a, b, c, d):
        self.f.append((a, b, c))
        self.f.append((a, c, d))

    def box(self, center, size, color, yaw=0.0, pitch=0.0):
        cx, cy, cz = center
        sx, sy, sz = (s / 2 for s in size)
        cy_, sy_ = math.cos(yaw), math.sin(yaw)
        cp, sp = math.cos(pitch), math.sin(pitch)

        def place(x, y, z):
            y, z = y * cp - z * sp, y * sp + z * cp          # X축 회전(기울임)
            x, z = x * cy_ + z * sy_, -x * sy_ + z * cy_     # Y축 회전
            return (cx + x, cy + y, cz + z)
        corners = [place(x, y, z) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
        # 면마다 정점을 따로 두어 평평한 음영이 나오게 한다.
        for face in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            ids = [self.vert(corners[i], color) for i in face]
            self.quad(*ids)

    def tube(self, path, radius, color, seg=10, caps=True, colors=None, scale=None):
        """경로를 따라 원형 단면을 쓸어 만든다. radius는 상수 또는 점별 목록."""
        n = len(path)
        radii = radius if isinstance(radius, (list, tuple)) else [radius] * n
        tangents = []
        for i in range(n):
            a, b = path[max(0, i - 1)], path[min(n - 1, i + 1)]
            tangents.append(norm(sub(b, a)))
        ref = [0, 1, 0] if abs(tangents[0][1]) < 0.9 else [1, 0, 0]
        normal = norm(cross(cross(tangents[0], ref), tangents[0]))
        rings = []
        for i in range(n):
            t = tangents[i]
            normal = norm(sub(normal, mul(t, dot(normal, t))))  # 평행 이동 프레임
            binormal = cross(t, normal)
            c = colors[i] if colors else color
            sx, sz = scale or (1, 1)
            ring = []
            for k in range(seg):
                ang = 2 * math.pi * k / seg
                offset = add(mul(normal, math.cos(ang) * radii[i] * sx), mul(binormal, math.sin(ang) * radii[i] * sz))
                ring.append(self.vert(add(path[i], offset), c))
            rings.append(ring)
        for i in range(n - 1):
            for k in range(seg):
                k2 = (k + 1) % seg
                self.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2])
        if caps:
            for ring, p, flip in ((rings[0], path[0], True), (rings[-1], path[-1], False)):
                c = self.vert(p, colors[0 if flip else -1] if colors else color)
                for k in range(seg):
                    a, b = ring[k], ring[(k + 1) % seg]
                    self.tri(c, b, a) if flip else self.tri(c, a, b)

    def cylinder(self, p0, p1, r, color, seg=16, r1=None):
        self.tube([p0, p1], [r, r if r1 is None else r1], color, seg)

    def lathe(self, profile, color, center=(0, 0, 0), seg=32, colors=None, start=0.0, sweep=2 * math.pi):
        """(반지름, 높이) 단면을 Y축으로 돌린다."""
        full = abs(sweep - 2 * math.pi) < 1e-6
        steps = seg if full else seg + 1
        rows = []
        for j, (r, y) in enumerate(profile):
            c = colors[j] if colors else color
            row = []
            for k in range(steps):
                ang = start + sweep * k / seg
                row.append(self.vert((center[0] + r * math.sin(ang), center[1] + y, center[2] + r * math.cos(ang)), c))
            rows.append(row)
        for j in range(len(profile) - 1):
            for k in range(seg):
                k2 = (k + 1) % steps if full else k + 1
                self.quad(rows[j][k], rows[j][k2], rows[j + 1][k2], rows[j + 1][k])

    def disc(self, center, r, color, seg=24, axis='y'):
        c = self.vert(center, color)
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            if axis == 'y':
                p = (center[0] + r * math.sin(a), center[1], center[2] + r * math.cos(a))
            else:
                p = (center[0] + r * math.sin(a), center[1] + r * math.cos(a), center[2])
            ring.append(self.vert(p, color))
        for k in range(seg):
            self.tri(c, ring[k], ring[(k + 1) % seg])

    def merge(self, other, offset=(0, 0, 0), yaw=0.0, scale=1.0):
        base = len(self.v)
        c, s = math.cos(yaw), math.sin(yaw)
        for x, y, z, r, g, b in other.v:
            x, y, z = x * scale, y * scale, z * scale
            self.v.append((offset[0] + x * c + z * s, offset[1] + y, offset[2] - x * s + z * c, r, g, b))
        for a, b2, c2 in other.f:
            self.f.append((a + base, b2 + base, c2 + base))

    def save(self, name, note):
        assert len(self.v) <= 65535, name
        path = os.path.join(OUT_3D, name + '.obj')
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write('# %s\n# tools/generate_exhibits.py 생성. 단위 m, Y 위, 정면 +Z. 정점 색 포함.\n' % note)
            for x, y, z, r, g, b in self.v:
                f.write('v %.4f %.4f %.4f %.3f %.3f %.3f\n' % (x, y, z, r, g, b))
            for a, b, c in self.f:
                f.write('f %d %d %d\n' % (a, b, c))
        xs = [p[0] for p in self.v]; ys = [p[1] for p in self.v]; zs = [p[2] for p in self.v]
        print('%-14s v=%5d  %.2f x %.2f x %.2f m' % (name, len(self.v), max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))


# ---------------------------------------------------------------- 부품
def bow_curve(strung=True, length=1.24):
    """각궁 중심선 (x, y). y가 활 길이 방향, x는 휨. 줌통이 원점."""
    half = length / 2
    if strung:
        # 얹은활: 줌통에서 시위 쪽(+x)으로 휘다가 고자에서 바깥(-)으로 젖힌다.
        key = [(0, 0), (0.08, 0.004), (0.20, 0.035), (0.32, 0.085), (0.42, 0.135), (0.50, 0.180), (0.55, 0.205), (0.585, 0.200), (0.62, 0.175)]
        pts = [(x, y * half / 0.62) for y, x in key]
    else:
        # 부린활: 활채가 반대쪽으로 둥글게 말린 C자.
        pts = []
        for k in range(9):
            a = math.radians(k * 19)
            r = 0.30
            pts.append((-(r - r * math.cos(a)) - (0.05 * (k / 8) ** 3), r * math.sin(a) * 1.05))
    upper = pts
    lower = [(x, -y) for x, y in reversed(pts[1:])]
    return lower + upper


def smooth(points, steps=6):
    """Catmull-Rom 보간."""
    out = []
    for i in range(len(points) - 1):
        p0 = points[max(0, i - 1)]; p1 = points[i]; p2 = points[i + 1]; p3 = points[min(len(points) - 1, i + 2)]
        for s in range(steps):
            t = s / steps
            out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t ** 3) for k in range(len(p1))))
    out.append(points[-1])
    return out


def bow(strung=True, length=1.24):
    """각궁: 물소뿔 배(검정)·화피 등(적갈색)·줌통 감개·도고지 가죽띠·고자(뽕나무)·양냥고자 혹·시위 고리."""
    m = Mesh()
    curve = smooth(bow_curve(strung, length), 6)
    path = [(x, y, 0) for x, y in curve]
    half = length / 2
    colors, radii = [], []
    for (x, y, z) in path:
        s = abs(y) / half
        if s < 0.09:
            colors.append(GRIP); radii.append(0.0165)
        elif s > 0.84:
            colors.append(TIP); radii.append(0.0095 - 0.002 * (s - 0.84) / 0.16)
        else:
            colors.append(HORN); radii.append(0.0135 - 0.0035 * s)
    m.tube(path, radii, HORN, seg=10, colors=colors, scale=(0.72, 1.35))
    # 등쪽 화피(자작나무 껍질) 띠: 중심선에서 휨 바깥쪽으로 살짝 나온 납작한 띠
    back = []
    for i, (x, y, z) in enumerate(path):
        a = path[max(0, i - 1)]; b = path[min(len(path) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]; l = math.hypot(tx, ty) or 1
        nx, ny = ty / l, -tx / l  # 곡선 평면 안의 법선
        if strung: nx, ny = -nx, -ny
        s = abs(y) / half
        back.append(((x + nx * radii[i] * 0.55, y + ny * radii[i] * 0.55, 0), 0.08 < s < 0.84))
    seg_pts, segs = [], []
    for p, keep in back:
        if keep: seg_pts.append(p)
        elif seg_pts:
            segs.append(seg_pts); seg_pts = []
    if seg_pts: segs.append(seg_pts)
    for pts in segs:
        if len(pts) > 2:
            m.tube(pts, 0.0062, (0.36, 0.17, 0.11), seg=6, caps=False, scale=(0.5, 1.6))
    # 도고지(활채와 고자가 만나는 곳의 가죽 띠), 양냥고자(시위 거는 혹)
    for sign in (-1, 1):
        for i, (x, y, z) in enumerate(path):
            if abs(abs(y) / half - 0.84) < 0.012 and (y > 0) == (sign > 0):
                m.tube([(x, y - 0.008, 0), (x, y + 0.008, 0)], 0.0125, (0.30, 0.20, 0.12), seg=10)
                break
        tip = path[-1] if sign > 0 else path[0]
        m.tube([(tip[0], tip[1], 0), (tip[0] + 0.004, tip[1] + sign * 0.012, 0)], 0.0075, (0.55, 0.40, 0.24), seg=8)
    # 줌통 감개: 붉은 실을 감은 띠 여러 줄
    for k in range(-4, 5):
        y = k * 0.0105
        m.tube([(-0.001, y - 0.003, 0), (-0.001, y + 0.003, 0)], 0.0172, CORD_RED if k % 2 else (0.52, 0.12, 0.09), seg=10)
    if strung:
        top, bottom = path[-3], path[2]
        m.cylinder((top[0] + 0.004, top[1], 0), (bottom[0] + 0.004, bottom[1], 0), 0.0022, STRING, seg=5)
        for p in (top, bottom):  # 시위 고리
            ring = [(p[0] + 0.004 + 0.006 * math.cos(2 * math.pi * k / 10), p[1] + 0.006 * math.sin(2 * math.pi * k / 10), 0.0) for k in range(11)]
            m.tube(ring, 0.0015, STRING, seg=4, caps=False)
    return m


def arrow(length=0.85, fletch=FEATHER, head=True, nodes=3):
    m = Mesh()
    m.cylinder((0, 0, 0), (length, 0, 0), 0.0045, BAMBOO, seg=8)
    for k in range(1, nodes + 1):
        x = length * k / (nodes + 1)
        m.cylinder((x - 0.004, 0, 0), (x + 0.004, 0, 0), 0.0052, BAMBOO_NODE, seg=8)
    if head:
        m.cylinder((length, 0, 0), (length + 0.05, 0, 0), 0.0055, IRON, seg=8, r1=0.0005)
    m.cylinder((-0.012, 0, 0), (0.0, 0, 0), 0.005, WOOD_DARK, seg=8)  # 오늬
    for k in range(3):
        a = 2 * math.pi * k / 3
        for j, (x0, h) in enumerate(((0.02, 0.016), (0.055, 0.013), (0.09, 0.009), (0.12, 0.005))):
            r = 0.0045 + h / 2
            m.box((x0, r * math.cos(a), r * math.sin(a)), (0.035, 0.0012 + h * abs(math.cos(a)), 0.0012 + h * abs(math.sin(a))), fletch)
    m.cylinder((0.135, 0, 0), (0.145, 0, 0), 0.0058, CORD_RED, seg=8)  # 깃 앞 감은 실
    return m


def stand_post(height, base=(0.32, 0.035, 0.20)):
    m = Mesh()
    m.box((0, base[1] / 2, 0), base, WOOD_DARK)
    m.cylinder((0, base[1], 0), (0, height, 0), 0.011, WOOD, seg=10)
    m.box((0, height, 0), (0.05, 0.02, 0.05), WOOD)
    return m


def target_face(width, height, thickness=0.08):
    """과녁 판(앞면 +Z). 테두리·바탕·가운데 홍심을 단순화."""
    m = Mesh()
    m.box((0, 0, 0), (width, height, thickness), WOOD_DARK)
    z = thickness / 2 + 0.002
    m.box((0, 0, z), (width * 0.94, height * 0.95, 0.004), TARGET_FACE)
    m.box((0, 0, z + 0.002), (width * 0.56, height * 0.56, 0.004), BLACK)
    m.box((0, 0, z + 0.004), (width * 0.50, height * 0.50, 0.004), TARGET_FACE)
    m.box((0, 0, z + 0.006), (width * 0.24, height * 0.22, 0.004), TARGET_RED)
    return m


# ---------------------------------------------------------------- 전시물
def bow_strung():
    m = stand_post(0.70)
    b = bow(True)
    m.merge(b, offset=(0, 0.70 + 0.62 + 0.02 - 0.62, 0))
    m.box((0, 0.70, 0.0), (0.06, 0.03, 0.04), WOOD)  # 줌통 받침
    return m


def bow_unstrung():
    m = Mesh()
    m.box((0, 0.015, 0), (0.36, 0.03, 0.18), WOOD_DARK)
    for x in (-0.09, 0.09):
        m.box((x, 0.06, 0), (0.03, 0.06, 0.05), WOOD)
    b = bow(False)
    m.merge(b, offset=(0.15, 0.09 + 0.32, 0))
    return m


def arrow_bundle():
    m = Mesh()
    m.box((0, 0.01, 0), (0.98, 0.02, 0.26), FABRIC_RED)
    for k in range(7):
        z = -0.06 + 0.02 * k
        a = arrow(0.85, FEATHER if k % 2 else FEATHER_LIGHT)
        m.merge(a, offset=(-0.45, 0.026 + (0.009 if k % 2 else 0), z))
    for x in (-0.18, 0.18):
        m.tube([(x, 0.03, -0.075), (x, 0.03, 0.075)], 0.011, CORD_RED, seg=8)
    return m


def quiver():
    m = Mesh()
    m.lathe([(0.0, 0.0), (0.075, 0.0), (0.075, 0.02), (0.058, 0.03), (0.058, 0.72), (0.064, 0.74), (0.064, 0.76), (0.0, 0.76)], LACQUER, seg=24)
    for y in (0.08, 0.38, 0.70):
        m.lathe([(0.061, y), (0.061, y + 0.025)], BRASS, seg=24)
    for k in range(6):
        a = 2 * math.pi * k / 6
        x, z = 0.03 * math.cos(a), 0.03 * math.sin(a)
        shaft = arrow(0.9, FEATHER if k % 2 else FEATHER_LIGHT, head=False)
        rot = Mesh()
        for (px, py, pz, r, g, b) in shaft.v:
            rot.v.append((x + py, 0.86 - px, z + pz, r, g, b))
        rot.f = shaft.f
        m.merge(rot, offset=(0, 0.04 + 0.02 * (k % 2), 0))
    return m


def thumb_ring():
    m = Mesh()
    m.box((0, 0.01, 0), (0.30, 0.02, 0.17), FABRIC_BLUE)
    for i, x in enumerate((-0.09, 0, 0.09)):
        m.box((x, 0.035, 0), (0.06, 0.03, 0.06), WOOD_DARK)
        ring = [(x + 0.017 * math.cos(2 * math.pi * k / 20), 0.07 + 0.017 * math.sin(2 * math.pi * k / 20), 0) for k in range(21)]
        m.tube(ring, 0.0055, (0.74, 0.66, 0.52) if i != 1 else (0.20, 0.17, 0.14), seg=8, caps=False)
        m.box((x + 0.022, 0.07, 0), (0.016, 0.012, 0.009), (0.74, 0.66, 0.52) if i != 1 else (0.20, 0.17, 0.14))  # 깍지 혀
    return m


def target():
    """국궁 과녁: 가로 약 2.0m, 세로 약 2.67m. 뒤로 약 15도 기울인 판과 받침."""
    m = Mesh()
    w, h, tilt = 2.0, 2.67, math.radians(15)
    face = target_face(w, h, 0.10)
    cy = math.cos(tilt) * h / 2 + 0.05
    # X축 회전으로 윗부분을 뒤(-Z)로 젖힌다. 회전이라 면 방향은 그대로다.
    for (x, y, z, r, g, b) in face.v:
        y2 = y * math.cos(tilt) + z * math.sin(tilt)
        z2 = -y * math.sin(tilt) + z * math.cos(tilt)
        m.v.append((x, y2 + cy, z2, r, g, b))
    m.f.extend(face.f)
    for x in (-0.8, 0.8):
        m.box((x, 0.05, -0.15), (0.14, 0.1, 0.9), WOOD_DARK)
        m.box((x, 0.9, -0.42), (0.08, 1.8, 0.08), WOOD, pitch=-0.35)
    return m


def pyeonjeon():
    m = Mesh()
    m.box((0, 0.01, 0), (1.0, 0.02, 0.22), FABRIC_RED)
    tube = [(x, 0.035, -0.04) for x in (-0.44, 0.44)]
    m.tube(tube, 0.013, BAMBOO, seg=10, scale=(1.0, 1.0))
    m.cylinder((-0.44, 0.035, -0.04), (-0.47, 0.035, -0.04), 0.016, CORD_RED, seg=10)
    for k, z in enumerate((0.03, 0.065)):
        a = arrow(0.36, FEATHER_LIGHT if k else FEATHER, nodes=1)
        m.merge(a, offset=(-0.18, 0.026, z))
    return m


def bow_rack():
    m = Mesh()
    width, height = 1.02, 1.55
    m.box((0, 0.03, 0), (width + 0.12, 0.06, 0.34), WOOD_DARK)
    for x in (-width / 2, width / 2):
        m.box((x, height / 2, 0), (0.06, height, 0.06), WOOD)
    m.box((0, height, 0), (width + 0.1, 0.06, 0.08), WOOD)
    m.box((0, 0.32, 0), (width, 0.04, 0.06), WOOD)
    for i, x in enumerate((-0.32, 0, 0.32)):
        b = bow(True, 1.20)
        m.merge(b, offset=(x - 0.1, height - 0.04 - 0.62, 0.06))
        m.cylinder((x, height - 0.03, 0.03), (x, height - 0.03, 0.09), 0.008, WOOD_DARK, seg=8)
    return m


def helmet():
    m = Mesh()
    m.box((0, 0.02, 0), (0.24, 0.04, 0.24), WOOD_DARK)
    m.cylinder((0, 0.04, 0), (0, 0.30, 0), 0.018, WOOD, seg=12)
    y0 = 0.30
    bowl = [(0.0, y0 + 0.22), (0.022, y0 + 0.20), (0.06, y0 + 0.17), (0.093, y0 + 0.12), (0.112, y0 + 0.06), (0.118, y0 + 0.0), (0.0, y0 + 0.0)]
    m.lathe(bowl, (0.17, 0.16, 0.16), seg=32)
    m.lathe([(0.118, y0 + 0.0), (0.142, y0 - 0.008), (0.142, y0 - 0.02), (0.112, y0 - 0.012)], BRASS, seg=32)
    m.cylinder((0, y0 + 0.215, 0), (0, y0 + 0.30, 0), 0.006, BRASS, seg=8, r1=0.002)
    m.lathe([(0.0, y0 + 0.3), (0.018, y0 + 0.285), (0.0, y0 + 0.26)], CORD_RED, seg=12)
    for y in (0.05, 0.11, 0.16):
        rr = [r for r, yy in bowl if abs(yy - (y0 + y)) < 0.031]
        m.lathe([(0.113 - y * 0.25, y0 + y), (0.114 - y * 0.25, y0 + y + 0.008)], BRASS, seg=32)
    # 목과 귀를 가리는 드림(뒤와 옆만, 얼굴 쪽 개방)
    m.lathe([(0.122, y0 - 0.005), (0.15, y0 - 0.17)], FABRIC_BLUE, seg=24, start=math.radians(55), sweep=math.radians(250))
    return m


def arrowheads():
    m = Mesh()
    m.box((0, 0.012, 0), (0.46, 0.024, 0.26), FABRIC_RED)
    shapes = [(0.06, 0.010, 0.004), (0.09, 0.022, 0.003), (0.05, 0.030, 0.003), (0.11, 0.008, 0.008)]
    for i, (length, width, thick) in enumerate(shapes):
        z = -0.085 + i * 0.057
        m.cylinder((-0.14, 0.032, z), (0.02, 0.032, z), 0.004, BAMBOO, seg=6)
        tip = Mesh()
        tip.lathe([(0.0, 0.0), (width, length * 0.35), (width * 0.6, length * 0.8), (0.0, length)], IRON, seg=12)
        for (x, y, zz, r, g, b) in tip.v:
            m.v.append((0.02 + y, 0.032 + zz * (thick / max(width, 1e-6)), z + x, r, g, b))
        base = len(m.v) - len(tip.v)
        m.f.extend((a + base, b + base, c + base) for a, b, c in tip.f)
    return m


def materials():
    m = Mesh()
    m.box((0, 0.015, 0), (0.66, 0.03, 0.38), WOOD)
    m.box((0, 0.034, 0), (0.62, 0.008, 0.34), FABRIC_BLUE)
    horn = [(-0.26 + 0.02 * k, 0.05 + 0.03 * math.sin(k / 10 * math.pi), -0.11) for k in range(11)]
    m.tube(horn, [0.022 - 0.0015 * k for k in range(11)], HORN, seg=10)
    m.box((0.0, 0.045, 0.02), (0.55, 0.012, 0.03), BAMBOO)
    m.box((0.0, 0.045, 0.065), (0.55, 0.012, 0.03), BAMBOO_NODE)
    m.box((-0.2, 0.06, 0.13), (0.14, 0.04, 0.06), (0.55, 0.38, 0.22))
    for k in range(7):
        m.cylinder((0.0, 0.043, 0.11 + 0.008 * k), (0.25, 0.043, 0.11 + 0.008 * k), 0.003, SINEW, seg=5)
    m.box((0.2, 0.06, -0.1), (0.1, 0.05, 0.08), GLUE)
    return m


def bow_case():
    m = Mesh()
    path = [(-0.48 + 0.96 * t, 0.06, 0.05 * math.sin(math.pi * t)) for t in [k / 16 for k in range(17)]]
    radii = [0.035 + 0.04 * math.sin(math.pi * min(1, k / 10)) for k in range(17)]
    m.tube(path, radii, (0.36, 0.19, 0.12), seg=14, scale=(1.0, 0.45))
    for k in (4, 9, 13):
        p = path[k]
        m.tube([(p[0] - 0.01, p[1], p[2]), (p[0] + 0.01, p[1], p[2])], radii[k] * 1.04, BRASS, seg=14, scale=(1.0, 0.47))
    m.tube([(0.46, 0.06, 0.0), (0.52, 0.03, 0.04), (0.55, 0.01, 0.08)], 0.004, CORD_RED, seg=6)
    return m


def target_model():
    m = Mesh()
    m.box((0, 0.015, 0), (0.30, 0.03, 0.18), WOOD_DARK)
    face = target_face(0.24, 0.32, 0.02)
    m.merge(face, offset=(0, 0.03 + 0.16 + 0.02, 0.0))
    for x in (-0.09, 0.09):
        m.box((x, 0.1, -0.03), (0.015, 0.16, 0.015), WOOD)
    for x, y in ((0.03, 0.24), (-0.05, 0.19)):
        a = arrow(0.18, FEATHER_LIGHT, head=False, nodes=1)
        rot = Mesh()
        for (px, py, pz, r, g, b) in a.v:
            rot.v.append((x + py, y + pz, 0.012 + px * 0.95, r, g, b))
        rot.f = a.f
        m.merge(rot)
    return m


def bow_press():
    """활 만들기 체험대: 받침 판·고정 못·묶인 부린활·칼·풀 그릇."""
    m = Mesh()
    m.box((0, 0.02, 0), (1.10, 0.04, 0.34), WOOD)
    for x in (-0.42, -0.14, 0.14, 0.42):
        m.cylinder((x, 0.04, -0.09), (x, 0.13, -0.09), 0.012, WOOD_DARK, seg=8)
    b = bow(True, 1.0)
    for (x, y, z, r, g, bb) in b.v:
        m.v.append((y, 0.075 + z, -0.04 - x * 0.6, r, g, bb))
    base = len(m.v) - len(b.v)
    m.f.extend((p + base, q + base, s + base) for p, q, s in b.f)
    m.box((0.3, 0.05, 0.11), (0.16, 0.012, 0.025), IRON)
    m.box((0.18, 0.05, 0.11), (0.09, 0.02, 0.028), WOOD_DARK)
    m.lathe([(0.0, 0.04), (0.05, 0.04), (0.055, 0.09), (0.045, 0.09), (0.04, 0.05), (0.0, 0.05)], (0.55, 0.53, 0.50), center=(-0.35, 0, 0.1), seg=20)
    m.disc((-0.35, 0.085, 0.1), 0.045, GLUE)
    return m


MODELS = {
    'bow-strung': (bow_strung, '각궁(얹은활)과 받침'),
    'bow-unstrung': (bow_unstrung, '부린활(시위를 벗긴 각궁)'),
    'arrow-bundle': (arrow_bundle, '죽시 묶음'),
    'quiver': (quiver, '전통(화살통)과 화살'),
    'thumb-ring': (thumb_ring, '깍지 세 점'),
    'target': (target, '과녁(실물 크기 단순화)'),
    'pyeonjeon': (pyeonjeon, '편전과 통아'),
    'bow-rack': (bow_rack, '궁가(활 걸이)와 각궁 세 자루'),
    'helmet': (helmet, '투구'),
    'arrowheads': (arrowheads, '화살촉 네 종'),
    'materials': (materials, '각궁 재료: 물소뿔·대나무·뽕나무·소 힘줄·부레풀'),
    'bow-case': (bow_case, '활집'),
    'target-model': (target_model, '과녁 축소 모형'),
    'bow-press': (bow_press, '활 만들기 체험대'),
}

# ---------------------------------------------------------------- 패널(SVG)
PAPER, INK, ACCENT, MUTED = '#f1ead8', '#2a2420', '#9b2b1f', '#6d6257'
FONT = "'Noto Serif KR','Nanum Myeongjo','Batang','바탕',serif"


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def ill_bow(x, y, h, strung=True):
    pts = smooth(bow_curve(strung, 1.24), 5)
    k = h / 1.30
    d = ' '.join(('M' if i == 0 else 'L') + '%.1f,%.1f' % (x + px * k, y - py * k) for i, (px, py) in enumerate(pts))
    out = '<path d="%s" fill="none" stroke="%s" stroke-width="%.1f" stroke-linecap="round"/>' % (d, INK, max(3, h * 0.025))
    if strung:
        top, bottom = pts[-2], pts[1]
        out += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>' % (x + top[0] * k, y - top[1] * k, x + bottom[0] * k, y - bottom[1] * k, MUTED, max(1, h * 0.006))
    out += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (x - h * 0.016, y - h * 0.06, h * 0.032, h * 0.12, ACCENT)
    return out


def ill_arrow(x, y, length, angle=0):
    return ('<g transform="translate(%.1f %.1f) rotate(%.1f)">' % (x, y, angle) +
            '<line x1="0" y1="0" x2="%.1f" y2="0" stroke="%s" stroke-width="%.1f"/>' % (length, INK, max(2, length * 0.012)) +
            '<path d="M%.1f,0 l%.1f,%.1f l0,%.1f z" fill="%s"/>' % (length, -length * 0.07, -length * 0.025, length * 0.05, INK) +
            '<path d="M%.1f,0 l%.1f,%.1f l%.1f,0 z M%.1f,0 l%.1f,%.1f l%.1f,0 z" fill="%s"/>' % (length * 0.04, length * 0.14, -length * 0.04, -length * 0.14, length * 0.04, length * 0.14, length * 0.04, -length * 0.14, ACCENT) +
            '</g>')


def ill_target(x, y, h):
    w = h * 2.0 / 2.67
    return ('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="%.1f"/>' % (x - w / 2, y - h / 2, w, h, INK, h * 0.03) +
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="%.1f"/>' % (x - w * 0.27, y - h * 0.27, w * 0.54, h * 0.54, INK, h * 0.02) +
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (x - w * 0.12, y - h * 0.11, w * 0.24, h * 0.22, ACCENT))


def ill_quiver(x, y, h):
    w = h * 0.16
    out = '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/>' % (x - w / 2, y - h * 0.7, w, h * 0.7, w * 0.2, INK)
    for k in range(5):
        out += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>' % (x - w * 0.3 + k * w * 0.15, y - h * 0.7, x - w * 0.5 + k * w * 0.25, y - h, INK, h * 0.01)
        out += '<path d="M%.1f,%.1f l%.1f,%.1f l%.1f,%.1f z" fill="%s"/>' % (x - w * 0.5 + k * w * 0.25, y - h, -w * 0.08, h * 0.08, w * 0.16, 0, ACCENT)
    for f in (0.15, 0.45):
        out += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#b08a3e"/>' % (x - w / 2, y - h * 0.7 + h * 0.7 * f, w, h * 0.03)
    return out


def ill_helmet(x, y, h):
    w = h * 0.7
    return ('<path d="M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f Q%.1f,%.1f %.1f,%.1f z" fill="%s"/>' % (x - w / 2, y, x - w / 2, y - h * 0.75, x, y - h * 0.78, x + w / 2, y - h * 0.75, x + w / 2, y, INK) +
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#b08a3e"/>' % (x - w * 0.58, y - h * 0.03, w * 1.16, h * 0.06) +
            '<path d="M%.1f,%.1f l%.1f,%.1f l%.1f,0 l%.1f,%.1f z" fill="%s"/>' % (x - w * 0.55, y + h * 0.03, -w * 0.08, h * 0.3, w * 0.42, w * 0.02, -h * 0.3, '#1f2a52') +
            '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#b08a3e" stroke-width="%.1f"/>' % (x, y - h * 0.78, x, y - h, h * 0.02) +
            '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (x, y - h * 0.98, h * 0.04, ACCENT))


def ill_ring(x, y, h):
    return ('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="%s" stroke-width="%.1f"/>' % (x, y, h * 0.3, INK, h * 0.13) +
            '<path d="M%.1f,%.1f l%.1f,%.1f l0,%.1f z" fill="%s"/>' % (x + h * 0.36, y - h * 0.1, h * 0.3, h * 0.05, h * 0.12, INK))


def ill_heads(x, y, h):
    out = ''
    for k, (l, w) in enumerate(((0.9, 0.12), (0.7, 0.3), (0.6, 0.42), (1.0, 0.08))):
        cx = x + (k - 1.5) * h * 0.55
        out += '<path d="M%.1f,%.1f l%.1f,%.1f l%.1f,%.1f l%.1f,%.1f z" fill="%s"/>' % (cx, y - h * l / 2, w * h / 2, h * l * 0.6, -w * h / 2, h * l * 0.4, -w * h / 2, -h * l * 0.4, INK)
        out += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>' % (cx, y + h * l / 2, cx, y + h * 0.75, MUTED, h * 0.03)
    return out


def ill_materials(x, y, h):
    return ('<path d="M%.1f,%.1f q%.1f,%.1f %.1f,0" fill="none" stroke="%s" stroke-width="%.1f" stroke-linecap="round"/>' % (x - h * 0.8, y - h * 0.3, h * 0.8, -h * 0.4, h * 1.6, INK, h * 0.12) +
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#c9a865"/>' % (x - h * 0.8, y, h * 1.6, h * 0.08) +
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#8a5a33"/>' % (x - h * 0.8, y + h * 0.16, h * 0.5, h * 0.18) +
            ''.join('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#b9ac8d" stroke-width="%.1f"/>' % (x - h * 0.15, y + h * (0.17 + 0.04 * k), x + h * 0.6, y + h * (0.17 + 0.04 * k), h * 0.02) for k in range(5)) +
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#b8792a"/>' % (x + h * 0.66, y + h * 0.14, h * 0.2, h * 0.2))


def ill_timeline(x, y, w, h, items):
    out = '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>' % (x, y, x + w, y, INK, h * 0.012)
    for i, (era, title, body) in enumerate(items):
        cx = x + w * (i + 0.5) / len(items)
        out += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (cx, y, h * 0.03, ACCENT)
        out += text_block(cx, y - h * 0.08, [era], h * 0.06, anchor='middle', color=MUTED)
        out += text_block(cx, y + h * 0.12, [title], h * 0.075, anchor='middle', weight='700')
        out += text_block(cx, y + h * 0.22, body, h * 0.05, anchor='middle', color=INK, gap=1.45)
    return out


def text_block(x, y, lines, size, anchor='start', weight='400', color=INK, gap=1.5):
    out = ''
    for i, line in enumerate(lines):
        out += '<text x="%.1f" y="%.1f" font-family="%s" font-size="%.1f" font-weight="%s" fill="%s" text-anchor="%s">%s</text>' % (x, y + i * size * gap, FONT, size, weight, color, anchor, esc(line))
    return out


ILLUSTRATIONS = {
    'bow': lambda x, y, h: ill_bow(x, y + h * 0.5, h * 0.95),
    'bow-unstrung': lambda x, y, h: ill_bow(x + h * 0.2, y + h * 0.5, h * 0.9, strung=False),
    'arrows': lambda x, y, h: ''.join(ill_arrow(x - h * 0.6, y + h * (0.25 + 0.12 * k), h * 1.2) for k in range(4)),
    'target': lambda x, y, h: ill_target(x, y + h * 0.5, h * 0.9),
    'quiver': lambda x, y, h: ill_quiver(x, y + h * 0.98, h * 0.95),
    'helmet': lambda x, y, h: ill_helmet(x, y + h * 0.8, h * 0.8),
    'ring': lambda x, y, h: ill_ring(x, y + h * 0.5, h * 0.7),
    'heads': lambda x, y, h: ill_heads(x, y + h * 0.4, h * 0.55),
    'materials': lambda x, y, h: ill_materials(x, y + h * 0.4, h * 0.45),
    'archer': lambda x, y, h: ill_bow(x - h * 0.15, y + h * 0.5, h * 0.9) + ill_arrow(x - h * 0.4, y + h * 0.5, h * 0.9) + ill_target(x + h * 1.1, y + h * 0.55, h * 0.35),
}


def panel(pid, aspect, kicker, title, body, art=None, timeline=None):
    height = min(1200, int(4096 / aspect))
    width = int(height * aspect)
    pad = height * 0.08
    s = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (width, height, width, height)]
    s.append('<rect width="100%%" height="100%%" fill="%s"/>' % PAPER)
    s.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="%.1f"/>' % (pad * 0.35, pad * 0.35, width - pad * 0.7, height - pad * 0.7, INK, height * 0.004))
    s.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (pad, pad, height * 0.012, height * 0.16, ACCENT))
    title_size = height * (0.085 if aspect < 1.4 else 0.1)
    x0 = pad + height * 0.04
    s.append(text_block(x0, pad + height * 0.045, [kicker], height * 0.04, color=MUTED))
    s.append(text_block(x0, pad + height * 0.045 + title_size * 1.15, [title], title_size, weight='700'))
    if timeline:
        s.append(ill_timeline(pad * 1.2, height * 0.56, width - pad * 2.4, height, timeline))
    else:
        text_w = width * (0.55 if art and aspect > 1.3 else 1.0)
        body_size = height * (0.045 if aspect < 1.3 else 0.05)
        s.append(text_block(x0, pad + height * 0.33, body, body_size, gap=1.6))
        if art:
            if aspect > 1.3:
                ax, ay, ah = width * 0.78, height * 0.18, height * 0.66
            else:
                ax, ay, ah = width * 0.5, height * 0.58, height * 0.32
            s.append(ILLUSTRATIONS[art](ax, ay, ah))
    s.append(text_block(width - pad, height - pad * 0.7, ['부천활박물관 · 국궁 — 활을 만들고, 쏘고, 겨루는 사람들'], height * 0.028, anchor='end', color=MUTED))
    s.append('</svg>')
    with open(os.path.join(OUT_2D, pid + '.svg'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(''.join(s))


# 부착면 비율(가로/세로)은 display-supports.js의 imageSurface로 잰 값.
PANELS = [
    ('main-1', 4.39 / 2.16, '주 전시실 · 1', '각궁(角弓)', ['물소뿔·대나무·뽕나무·소 힘줄을', '민어 부레풀로 붙여 만든 합성궁입니다.', '짧은 길이에 비해 탄력이 매우 강합니다.'], 'bow'),
    ('main-2', 4.18 / 2.16, '주 전시실 · 2', '투구와 활쏘기', ['조선의 무과 시험에서 활쏘기는', '가장 중요한 과목이었습니다.', '무관은 갑옷과 투구를 갖추고 활을 쏘았습니다.'], 'helmet'),
    ('main-3', 3.69 / 2.16, '주 전시실 · 3', '부린활과 얹은활', ['시위를 벗긴 각궁은 활채가 반대로', '둥글게 말립니다. 쓰기 전에 시위를 거는 일을', '"활을 얹는다"고 합니다.'], 'bow-unstrung'),
    ('main-5-img', 1.17 / 1.75, '주 전시실 · 5', '전통(箭筒)', ['화살을 넣어 다니는 통.', '옻칠한 몸체에 장식 띠를', '둘러 튼튼하게 만들었습니다.'], 'quiver'),
    ('main-6-img', 1.24 / 1.05, '주 전시실 · 6', '깍지', ['엄지에 끼워 시위를 걸고', '당기는 도구입니다.', '뿔이나 뼈로 만들었습니다.'], 'ring'),
    ('planned-1', 3.80 / 1.78, '기획전시', '활을 만드는 사람, 궁장(弓匠)', ['각궁 한 자루에는 뿔을 깎고, 대나무를 다듬고,', '힘줄을 펴 붙이는 수많은 손질이 들어갑니다.', '재료가 마르기를 기다리는 시간도 활의 일부입니다.'], 'materials'),
    ('lobby-1', 2.99 / 1.61, '부천활박물관', '국궁, 활을 만들고 쏘고 겨루는 사람들', ['우리 활 각궁과 화살, 활쏘기 문화를', '만드는 사람과 쏘는 사람의 이야기로 소개합니다.'], 'archer'),
    ('lobby-2', 2.29 / 1.86, '관람 안내', '전시 동선', ['중앙 로비 → 영상실 → 주 전시실', '→ 실감형체험장 → 기획전시실', '→ 기증전시실 → 체험마루 → 야외체험장'], None),
    ('lobby-4', 9.71 / 1.76, '중앙 로비 · 4', '우리 활의 역사', [], None, [
        ('고구려', '사냥하는 궁수', ['고분 벽화에 말 위에서', '활을 쏘는 모습이 남아 있다']),
        ('조선', '무과와 활쏘기', ['무관을 뽑는 시험의', '핵심 과목이 활쏘기였다']),
        ('조선 후기', '활터와 사정(射亭)', ['마을마다 활터를 두고', '함께 활을 쏘며 예를 익혔다']),
        ('오늘', '이어지는 국궁', ['전국의 활터에서', '145m 거리의 과녁을 겨눈다']),
    ]),
    ('lobby-5', 3.24 / 1.66, '중앙 로비 · 5', '활을 쏘는 몸', ['발을 딛고, 활을 들고, 시위를 당겨', '과녁을 겨눈 뒤 놓습니다.', '몸 전체로 쏘는 것이 우리 활쏘기입니다.'], 'archer'),
    ('lobby-7', 2.47 / 1.61, '중앙 로비', '로비 중앙 전시', ['시위를 얹은 각궁을 크게 세워', '활의 곡선을 한눈에 볼 수 있게 했습니다.'], 'bow'),
    ('corridor-3', 1.77 / 2.01, '중앙 복도 · 3', '기증전시실', ['활을 아껴 온 분들이', '기증한 활과 도구를', '이 방에서 소개합니다.'], 'quiver'),
    ('corridor-4', 1.91 / 1.96, '중앙 복도 · 4', '기획전시실', ['활을 만드는 사람,', '궁장(弓匠)의 손과', '재료를 소개합니다.'], 'materials'),
    ('video-1-left', 1.91 / 1.83, '영상실 · 1', '활터의 하루', ['활을 얹고, 몸을 풀고,', '과녁을 향해 섭니다.'], 'bow'),
    ('video-1-back', 1.87 / 1.93, '영상실 · 1', '시위와 깍지', ['깍지를 낀 엄지로', '시위를 당깁니다.'], 'ring'),
    ('video-2', 2.94 / 1.66, '영상실 · 2', '145m 너머의 과녁', ['국궁의 과녁은 145m 떨어져 있습니다.', '화살은 높은 포물선을 그리며 날아갑니다.'], 'target'),
    ('video-3', 2.22 / 1.96, '영상실 · 3', '대나무 화살, 죽시', ['대나무를 곧게 펴고', '깃과 촉을 달아 만듭니다.'], 'arrows'),
    ('immersive-1', 4.11 / 2.16, '실감형체험장 · 1', '화살촉', ['쓰임에 따라 모양이 다른 촉을 달았습니다.', '사냥용, 연습용, 전투용 촉은', '길이와 날의 폭이 서로 다릅니다.'], 'heads'),
    ('immersive-2-img', 3.88 / 1.43, '실감형체험장 · 2', '과녁을 향해', ['화면 속 활터에서 과녁을 겨누어 보세요.', '실제 과녁은 사람 키보다 큽니다.'], 'target'),
    ('donated-1-img', 1.93 / 1.81, '기증전시실 · 1', '기증 유물 · 투구', ['기증자의 뜻에 따라', '보존 처리 후 공개합니다.'], 'helmet'),
    ('donated-2-img', 2.44 / 1.76, '기증전시실 · 2', '기증 유물 · 궁가', ['활을 걸어 두는 걸이와', '그 위의 각궁입니다.'], 'bow'),
    ('donated-9', 3.24 / 0.96, '기증전시실', '기증해 주신 분들께 감사드립니다', ['모든 기증 유물은 기증자의 뜻을 존중해 전시합니다.'], None),
]


def main():
    os.makedirs(OUT_3D, exist_ok=True)
    os.makedirs(OUT_2D, exist_ok=True)
    for name, (build, note) in MODELS.items():
        build().save(name, note)
    for row in PANELS:
        panel(*row)
    print('panels:', len(PANELS))


if __name__ == '__main__':
    main()
