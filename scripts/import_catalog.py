#!/usr/bin/env python3
"""Importa el catalogo completo de ejercicios desde hasaneyldrm/exercises-dataset.

Genera backend/data/catalog.json (1324 ejercicios) y descarga la media a
backend/static/media/. La media no se versiona: es (c) Gym Visual, redistribuida
por el dataset a 180x180, y son ~128 MB.

    python scripts/import_catalog.py            # importa todo
    python scripts/import_catalog.py --no-media # solo el JSON
    python scripts/import_catalog.py --dry-run  # no escribe nada, solo informa

Es idempotente: no re-descarga el tarball ni la media que ya existe.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import shutil
import sys
import tarfile
import urllib.request
from pathlib import Path
from typing import Any

REPO = "hasaneyldrm/exercises-dataset"
TARBALL = f"https://github.com/{REPO}/archive/refs/heads/main.tar.gz"

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "backend" / "data" / "catalog.json"
MEDIA_DIR = ROOT / "backend" / "static" / "media"
CACHE = ROOT / "backend" / "data" / ".dataset-cache"

# --- Derivacion de `role` -------------------------------------------------
# El dataset no trae rol (empuje/tiron/piernas/core), asi que lo derivamos del
# musculo objetivo. Es una aproximacion: clasifica por musculo, no por patron de
# movimiento, asi que algun `reverse fly` (delts) cae en push. Los 41 ejercicios
# del catalogo curado conservan su rol asignado a mano, que tiene prioridad.
ROLE_BY_TARGET = {
    "pectorals": "push", "delts": "push", "triceps": "push", "serratus anterior": "push",
    "lats": "pull", "upper back": "pull", "biceps": "pull", "traps": "pull",
    "forearms": "pull", "levator scapulae": "pull",
    "glutes": "legs", "quads": "legs", "hamstrings": "legs", "calves": "legs",
    "adductors": "legs", "abductors": "legs",
    "abs": "core", "spine": "core",
    "cardiovascular system": "cardio",
}

# Los 41 ejercicios de la seleccion original, traducidos y clasificados a mano.
# Van fijados aqui y no leidos del catalog.json existente a proposito: si se
# leyeran de ahi, tras la primera importacion los 1324 nombres autogenerados
# contarian como "curados" y ninguna mejora del diccionario volveria a aplicarse.
CURATED = {
    "0011": ("Elevación de rodillas colgado", "core"),
    "0283": ("Flexiones diamante", "push"),
    "0289": ("Press banca con mancuernas", "push"),
    "0292": ("Remo a una mano con mancuerna", "pull"),
    "0293": ("Remo bent-over con mancuernas", "pull"),
    "0294": ("Curl de bíceps", "pull"),
    "0308": ("Aperturas con mancuernas", "push"),
    "0310": ("Elevaciones frontales", "push"),
    "0313": ("Curl martillo", "pull"),
    "0314": ("Press inclinado con mancuernas", "push"),
    "0333": ("Patada de tríceps", "push"),
    "0334": ("Elevaciones laterales", "push"),
    "0336": ("Zancadas con mancuernas", "legs"),
    "0351": ("Extensión de tríceps tumbado", "push"),
    "0383": ("Pájaros (reverse fly)", "pull"),
    "0405": ("Press de hombro sentado", "push"),
    "0406": ("Encogimientos de hombros", "pull"),
    "0413": ("Sentadilla con mancuernas", "legs"),
    "0431": ("Step-up con mancuernas", "legs"),
    "0432": ("Peso muerto piernas rígidas", "legs"),
    "0464": ("Plancha", "core"),
    "0472": ("Elevación de piernas colgado", "core"),
    "0499": ("Remo invertido", "pull"),
    "0630": ("Mountain climbers", "core"),
    "0652": ("Dominadas", "pull"),
    "0662": ("Flexiones", "push"),
    "0687": ("Russian twist", "core"),
    "0796": ("Rueda abdominal de pie", "core"),
    "0857": ("Rueda abdominal (rollerout)", "core"),
    "0871": ("Crunch", "core"),
    "0970": ("Dominadas asistidas con liga", "pull"),
    "0971": ("Rueda abdominal asistida con banda", "core"),
    "0989": ("Press pecho con banda", "push"),
    "0991": ("Band pull-through", "legs"),
    "1003": ("Remo + sentadilla con banda", "pull"),
    "1004": ("Sentadilla con banda", "legs"),
    "1326": ("Dominadas supinas (chin-up)", "pull"),
    "1399": ("Fondos en banco", "push"),
    "1459": ("Peso muerto rumano con mancuernas", "legs"),
    "1760": ("Goblet squat", "legs"),
    "3561": ("Puente de glúteo", "legs"),
}

# --- Traduccion de nombres ------------------------------------------------
# Los nombres del dataset son formulaicos ("dumbbell bench press"), asi que
# traducimos por frases de mayor a menor longitud en vez de palabra a palabra,
# y movemos el equipo al final ("Press banca con mancuernas"). Lo que no este en
# el diccionario se queda en ingles antes que inventar una traduccion.
EQUIPMENT_ES = {
    "dumbbell": "con mancuernas", "barbell": "con barra", "ez barbell": "con barra EZ",
    "ez-barbell": "con barra EZ", "olympic barbell": "con barra olimpica",
    "trap bar": "con barra hexagonal", "cable": "en polea", "lever": "en maquina",
    "leverage machine": "en maquina", "smith": "en multipower",
    "smith machine": "en multipower", "sled machine": "en maquina de empuje",
    "sled": "en maquina de empuje", "kettlebell": "con kettlebell",
    "band": "con banda", "resistance band": "con banda", "assisted": "asistido",
    "weighted": "con lastre", "stability ball": "en fitball",
    "exercise ball": "en fitball", "bosu ball": "en bosu",
    "medicine ball": "con balon medicinal", "roller": "con rueda",
    "wheel roller": "con rueda abdominal", "rope": "con cuerda",
    "hammer": "con martillo", "tire": "con neumatico", "bodyweight": "",
    "body weight": "",
}

# Frases primero (se aplican por longitud descendente), luego palabras sueltas.
PHRASES_ES = {
    "bench press": "press banca", "incline bench press": "press inclinado",
    "decline bench press": "press declinado", "military press": "press militar",
    "shoulder press": "press de hombro", "chest press": "press de pecho",
    "leg press": "prensa de piernas", "french press": "press frances",
    "push-up": "flexiones", "push up": "flexiones", "pull-up": "dominadas",
    "pull up": "dominadas", "chin-up": "dominadas supinas", "chin up": "dominadas supinas",
    "sit-up": "abdominales", "sit up": "abdominales", "crunch": "crunch",
    "lateral raise": "elevaciones laterales", "front raise": "elevaciones frontales",
    "rear delt raise": "elevaciones posteriores", "calf raise": "elevacion de gemelos",
    "leg raise": "elevacion de piernas", "hip raise": "elevacion de cadera",
    "shoulder raise": "elevacion de hombros", "preacher curl": "curl predicador",
    "hammer curl": "curl martillo", "concentration curl": "curl concentrado",
    "spider curl": "curl araña", "wrist curl": "curl de muñeca",
    "bicep curl": "curl de biceps", "biceps curl": "curl de biceps",
    "leg curl": "curl femoral", "drag curl": "curl arrastrado",
    "triceps extension": "extension de triceps", "tricep extension": "extension de triceps",
    "leg extension": "extension de piernas", "back extension": "extension lumbar",
    "triceps kickback": "patada de triceps", "kickback": "patada",
    "triceps dip": "fondos de triceps", "dip": "fondos",
    "lat pulldown": "jalon al pecho", "pulldown": "jalon",
    "pullover": "pullover", "deadlift": "peso muerto",
    "romanian deadlift": "peso muerto rumano",
    "stiff leg deadlift": "peso muerto piernas rigidas",
    "straight leg deadlift": "peso muerto piernas rigidas",
    "bent over row": "remo inclinado", "bent-over row": "remo inclinado",
    "upright row": "remo al menton", "inverted row": "remo invertido",
    "seated row": "remo sentado", "row": "remo",
    "squat": "sentadilla", "front squat": "sentadilla frontal",
    "split squat": "sentadilla bulgara", "hack squat": "sentadilla hack",
    "goblet squat": "sentadilla goblet", "lunge": "zancada",
    "step-up": "step-up", "step up": "step-up", "hip thrust": "empuje de cadera",
    "glute bridge": "puente de gluteo", "good morning": "buenos dias",
    "shrug": "encogimiento de hombros", "fly": "aperturas", "flye": "aperturas",
    "reverse fly": "aperturas invertidas", "chest fly": "aperturas de pecho",
    "plank": "plancha", "side plank": "plancha lateral",
    "mountain climber": "escalador", "russian twist": "russian twist",
    "twist": "giro", "stretch": "estiramiento", "clean": "cargada",
    "snatch": "arrancada", "jerk": "envion", "thruster": "thruster",
    "swing": "swing", "high pull": "tiron alto", "face pull": "face pull",
    "pull-through": "pull-through", "pull through": "pull-through",
    "woodchop": "leñador", "rollout": "rueda abdominal", "roll-out": "rueda abdominal",
    "jumping jack": "jumping jack", "burpee": "burpee", "run": "carrera",
    "walk": "caminata", "jump": "salto", "hang": "suspension",
    "stability ball": "en fitball", "exercise ball": "en fitball",
    "jack knife": "navaja", "jackknife": "navaja", "v-up": "v-up",
    "sit up": "abdominales", "toe touch": "toque de puntas",
    "bent-over row": "remo inclinado", "bent over": "inclinado",
    "bent-over": "inclinado", "close grip": "agarre cerrado",
    "wide grip": "agarre abierto", "one arm": "a una mano",
    "single arm": "a una mano", "one leg": "a una pierna",
    "single leg": "a una pierna", "all fours": "a cuatro patas",
}

WORDS_ES = {
    # posicion / postura
    "seated": "sentado", "standing": "de pie", "lying": "tumbado",
    "kneeling": "de rodillas", "prone": "boca abajo", "supine": "boca arriba",
    "incline": "inclinado", "decline": "declinado", "flat": "plano",
    "bent": "flexionado", "straight": "recto", "hanging": "colgado",
    "seated-": "sentado", "half-kneeling": "rodilla al suelo",
    # modificadores
    "reverse": "inverso", "alternate": "alterno", "alternating": "alterno",
    "single": "a una mano", "one": "a una mano", "two": "a dos manos",
    "double": "doble", "wide": "abierto", "close": "cerrado",
    "close-grip": "agarre cerrado", "wide-grip": "agarre abierto",
    "grip": "agarre", "narrow": "estrecho", "front": "frontal",
    "rear": "posterior", "side": "lateral", "lateral": "lateral",
    "overhead": "sobre la cabeza", "behind": "tras", "full": "completo",
    "half": "medio", "high": "alto", "low": "bajo", "up": "arriba",
    "down": "abajo", "apart": "separados", "circular": "circular",
    "isometric": "isometrico", "static": "estatico", "dynamic": "dinamico",
    "assisted": "asistido", "weighted": "con lastre", "self": "auto",
    # partes del cuerpo
    "head": "nuca", "neck": "cuello", "chest": "pecho", "back": "espalda",
    "leg": "pierna", "legs": "piernas", "arm": "brazo", "arms": "brazos",
    "shoulder": "hombro", "shoulders": "hombros", "hip": "cadera",
    "hips": "caderas", "knee": "rodilla", "knees": "rodillas",
    "ankle": "tobillo", "ankles": "tobillos", "wrist": "muñeca",
    "wrists": "muñecas", "elbow": "codo", "heel": "talon", "heels": "talones",
    "toe": "punta", "toes": "puntas", "foot": "pie", "feet": "pies",
    "hand": "mano", "hands": "manos", "thigh": "muslo", "thighs": "muslos",
    "waist": "cintura", "spine": "columna", "groin": "ingle",
    # musculos (aparecen mucho en los estiramientos)
    "calf": "gemelo", "calves": "gemelos", "glute": "gluteo",
    "glutes": "gluteos", "gluteus": "gluteo", "abs": "abdomen",
    "abdominal": "abdominal", "abdominals": "abdomen", "core": "core",
    "biceps": "biceps", "bicep": "biceps", "triceps": "triceps",
    "tricep": "triceps", "forearm": "antebrazo", "forearms": "antebrazos",
    "hamstring": "isquios", "hamstrings": "isquios", "quad": "cuadriceps",
    "quads": "cuadriceps", "quadriceps": "cuadriceps", "oblique": "oblicuos",
    "obliques": "oblicuos", "adductor": "aductor", "adductors": "aductores",
    "abductor": "abductor", "abductors": "abductores", "lat": "dorsal",
    "lats": "dorsales", "latissimus": "dorsal", "dorsi": "",
    "pectoral": "pectoral", "pectorals": "pectorales", "pectoralis": "pectoral",
    "deltoid": "deltoides", "deltoids": "deltoides", "delts": "deltoides",
    "trapezius": "trapecio", "traps": "trapecios", "serratus": "serrato",
    "piriformis": "piriforme", "soleus": "soleo", "tibialis": "tibial",
    "infraspinatus": "infraespinoso", "psoas": "psoas", "iliopsoas": "iliopsoas",
    "rectus": "recto", "femoris": "femoral", "erector": "erector",
    "spinae": "espinal", "major": "mayor", "minor": "menor",
    "rhomboid": "romboides", "rhomboids": "romboides", "flexor": "flexor",
    "flexors": "flexores", "extensor": "extensor", "extensors": "extensores",
    "rotator": "rotador", "cuff": "manguito",
    # movimientos sueltos
    "raise": "elevacion", "raises": "elevaciones", "curl": "curl",
    "curls": "curls", "press": "press", "bend": "flexion",
    "bends": "flexiones", "circle": "circulo", "circles": "circulos",
    "touch": "toque", "touchers": "toques", "kick": "patada",
    "kicks": "patadas", "throw": "lanzamiento", "pulse": "pulso",
    "hold": "isometrico", "march": "marcha", "marching": "marcha",
    "jumping": "saltando", "running": "carrera", "walking": "caminata",
    "climber": "escalador", "climbers": "escaladores", "rotation": "rotacion",
    "rotations": "rotaciones", "pull": "tiron", "push": "empuje",
    "lift": "elevacion", "lifts": "elevaciones", "drop": "descenso",
    "swings": "swings", "thrust": "empuje", "thrusts": "empujes",
    # material / entorno
    "floor": "suelo", "bench": "banco", "bar": "barra", "ball": "balon",
    "wall": "pared", "chair": "silla", "box": "cajon", "step": "escalon",
    "parallel": "paralelas", "vertical": "vertical", "horizontal": "horizontal",
    # figuras
    "archer": "arquero", "clock": "reloj", "spider": "araña",
    "scissor": "tijera", "scissors": "tijeras", "frog": "rana",
    "butterfly": "mariposa", "bear": "oso", "crab": "cangrejo",
    "cat": "gato", "cow": "vaca", "bird": "pajaro", "dog": "perro",
    "windmill": "molino", "superman": "superman", "bicycle": "bicicleta",
    "bike": "bicicleta", "air": "al aire", "sky": "al cielo",
    # material / agarres
    "rope": "con cuerda", "v-bar": "barra en V", "bars": "barras",
    "towel": "toalla", "wheel": "rueda", "bosu": "bosu", "machine": "maquina",
    "lever": "palanca", "attachment": "", "support": "apoyo",
    "underhand": "agarre supino", "overhand": "agarre prono",
    "reverse-grip": "agarre inverso", "neutral": "neutro",
    "palm": "palma", "palms": "palmas", "stability": "estabilidad",
    # mas movimientos y modificadores del long tail
    "extension": "extension", "extensions": "extensiones",
    "hyperextension": "hiperextension", "pushdown": "extension en polea",
    "over": "sobre", "hammer": "martillo", "twisting": "con giro",
    "delt": "deltoides", "cross": "cruce", "cross-over": "cruce",
    "dips": "fondos", "bridge": "puente", "rollerout": "rueda abdominal",
    "inverse": "inverso", "revers": "inverso", "forward": "adelante",
    "backward": "atras", "body": "cuerpo", "lower": "bajo", "upper": "alto",
    "inner": "interno", "outer": "externo", "internal": "interna",
    "external": "externa", "adduction": "aduccion", "abduction": "abduccion",
    "against": "contra", "tap": "toque", "stance": "postura",
    "pose": "postura", "motion": "movimiento", "suspended": "suspendido",
    "squatting": "en sentadilla", "planche": "plancha", "muscle": "muscular",
    "sumo": "sumo", "donkey": "burro", "zottman": "zottman",
    "blaster": "blaster", "ez": "EZ", "pov": "",
    "squad": "sentadilla", "pec": "pectoral", "fixed": "fijo",
    "balance": "equilibrio", "board": "tabla", "forth": "adelante",
    "both": "ambas", "under": "bajo", "clean-grip": "agarre de cargada",
    # conectores
    "with": "con", "on": "en", "to": "a", "and": "y", "the": "",
    "of": "de", "in": "en", "at": "en", "for": "para", "a": "",
    "from": "desde", "male": "", "female": "", "exercise": "",
    "version": "version",
}

# El genero del modelo del gif no aporta nada en la galeria. Los marcadores de
# version ("v. 2") SI se conservan: distinguen variantes que si no quedarian con
# el mismo nombre.
NOISE_RE = re.compile(r"\s*\((?:male|female)\)", re.I)

# En ingles el modificador va delante ("seated dumbbell curl") y en espanol
# detras ("curl con mancuernas sentado"). Estas palabras se recolocan al final
# en vez de dejarlas donde estaban.
POSTFIX_WORDS = {
    "seated", "standing", "lying", "kneeling", "prone", "supine",
    "incline", "decline", "flat", "bent", "straight", "hanging",
    "alternate", "alternating", "single", "one", "two", "double",
    "wide", "close", "narrow", "isometric", "static", "dynamic",
    "suspended", "squatting", "assisted", "weighted", "neutral",
    "inverse", "revers", "reverse", "forward", "backward", "sumo",
    "half-kneeling", "close-grip", "wide-grip", "reverse-grip",
    "underhand", "overhand", "overhead", "isolated", "twisting",
    "full", "half", "high", "low", "lateral", "side", "front", "rear",
    "vertical", "horizontal", "parallel", "internal", "external",
    "inner", "outer", "upper", "lower", "circular",
}

# Lo mismo pero para frases completas.
POSTFIX_PHRASES = {
    "one arm", "single arm", "one leg", "single leg", "all fours",
    "bent over", "bent-over", "close grip", "wide grip",
}

# Palabras que, al inicio del nombre, identifican el equipo y se mueven al final.
EQUIPMENT_PREFIXES = sorted(EQUIPMENT_ES, key=len, reverse=True)
_PHRASES_SORTED = sorted(PHRASES_ES, key=len, reverse=True)


def translate_name(name: str) -> tuple[str, bool]:
    """Traduce un nombre al espanol. Devuelve (nombre, todo_traducido)."""
    text = NOISE_RE.sub("", name.lower()).strip()
    text = text.replace("(", " ").replace(")", " ")

    equip_suffix = ""
    for prefix in EQUIPMENT_PREFIXES:
        if text == prefix:
            return name, False
        if text.startswith(prefix + " "):
            equip_suffix = EQUIPMENT_ES[prefix]
            text = text[len(prefix) + 1 :]
            break

    # Las frases se sustituyen por un marcador para que el paso palabra-a-palabra
    # no las vuelva a tocar. Con \b: sin el, "row" casaria dentro de "throw" y
    # "hang" dentro de "hanging".
    slots: list[tuple[str, bool]] = []  # (traduccion, va_al_final)
    for phrase in _PHRASES_SORTED:
        # (?<![\w-]) en vez de \b: \b considera el guion una frontera, asi que
        # "clean" casaria dentro de "clean-grip" y dejaria un "-grip" suelto.
        pattern = r"(?<![\w-])" + re.escape(phrase) + r"(?![\w-])"
        if re.search(pattern, text):
            text = re.sub(pattern, f" \x00{len(slots)}\x00 ", text)
            slots.append((PHRASES_ES[phrase], phrase in POSTFIX_PHRASES))

    out_words: list[str] = []
    postfix: list[str] = []
    complete = True
    for token in text.split():
        m = re.fullmatch(r"\x00(\d+)\x00", token)
        if m:
            text_es, at_end = slots[int(m.group(1))]
            (postfix if at_end else out_words).append(text_es)
            continue
        if token in WORDS_ES:
            if WORDS_ES[token]:
                (postfix if token in POSTFIX_WORDS else out_words).append(WORDS_ES[token])
            continue
        if not re.search(r"[a-z]", token):  # "3/4", "45°", numeros de version
            out_words.append(token)
            continue
        out_words.append(token)
        complete = False

    # Si el nombre era solo modificadores no hay nucleo que adjetivar.
    out_words.extend(postfix)
    if equip_suffix:
        out_words.append(equip_suffix)

    result = re.sub(r"\s+", " ", " ".join(w for w in out_words if w)).strip()
    return (result[:1].upper() + result[1:]) if result else name, complete


# --- Descarga -------------------------------------------------------------

def fetch_dataset(dry_run: bool = False) -> tuple[list[dict[str, Any]], tarfile.TarFile | None]:
    CACHE.mkdir(parents=True, exist_ok=True)
    tar_path = CACHE / "dataset.tar.gz"
    if not tar_path.exists():
        print(f"-> descargando {TARBALL} (~128 MB, solo la primera vez)...")
        if dry_run:
            raise SystemExit("--dry-run sin cache: ejecuta sin --dry-run al menos una vez")
        with urllib.request.urlopen(TARBALL) as r, open(tar_path, "wb") as f:
            shutil.copyfileobj(r, f)
    else:
        print(f"-> usando tarball cacheado ({tar_path.stat().st_size // 1_000_000} MB)")

    tf = tarfile.open(tar_path, "r:gz")
    member = next(m for m in tf.getmembers() if m.name.endswith("data/exercises.json"))
    data = json.load(io.TextIOWrapper(tf.extractfile(member), encoding="utf-8"))
    return data, tf


def extract_media(tf: tarfile.TarFile, wanted: set[str]) -> tuple[int, int]:
    """Extrae images/ y videos/ del tarball. Idempotente."""
    copied = skipped = 0
    for m in tf.getmembers():
        if not m.isfile():
            continue
        parts = m.name.split("/")
        if len(parts) < 3 or parts[1] not in ("images", "videos"):
            continue
        rel = f"{parts[1]}/{parts[2]}"
        if rel not in wanted:
            continue
        dest = MEDIA_DIR / parts[1] / parts[2]
        if dest.exists():
            skipped += 1
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        with tf.extractfile(m) as src, open(dest, "wb") as out:
            shutil.copyfileobj(src, out)
        copied += 1
        if copied % 250 == 0:
            print(f"   {copied} archivos extraidos...")
    return copied, skipped


# --- Construccion del catalogo -------------------------------------------

def build(dataset: list[dict[str, Any]], previous: dict[str, Any]) -> dict[str, Any]:
    exercises = []
    untranslated: list[str] = []
    unknown_targets: set[str] = set()

    for src in dataset:
        eid = src["id"]
        target = src["target"]

        role = ROLE_BY_TARGET.get(target)
        if role is None:
            unknown_targets.add(target)
            role = "core"
        # La seleccion curada a mano manda: su nombre y su rol estan revisados.
        if eid in CURATED:
            name_es, role = CURATED[eid]
        else:
            name_es, complete = translate_name(src["name"])
            if not complete:
                untranslated.append(f"{src['name']}  ->  {name_es}")

        steps = src.get("instruction_steps", {})
        exercises.append(
            {
                "id": eid,
                "name": src["name"],
                "name_es": name_es,
                "role": role,
                "body_part": src["body_part"],
                "target": target,
                "equipment": src["equipment"],
                "secondary_muscles": src.get("secondary_muscles", []),
                "image": "/media/" + src["image"],
                "gif": "/media/" + src["gif_url"],
                "guide_es": steps.get("es") or [],
                "guide_en": steps.get("en") or [],
            }
        )

    exercises.sort(key=lambda e: e["id"])
    catalog = {
        "equipment_profile": previous.get("equipment_profile", {}),
        "exercises": exercises,
        "default_week": previous["default_week"],
    }
    return catalog, untranslated, unknown_targets


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--no-media", action="store_true", help="solo genera el JSON")
    ap.add_argument("--dry-run", action="store_true", help="no escribe nada")
    ap.add_argument("--show-untranslated", type=int, default=15, metavar="N")
    args = ap.parse_args()

    previous = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    print(f"catalogo actual: {len(previous['exercises'])} ejercicios")

    dataset, tf = fetch_dataset(args.dry_run)
    print(f"dataset: {len(dataset)} ejercicios")

    catalog, untranslated, unknown_targets = build(dataset, previous)

    # --- informe -------------------------------------------------------
    import collections

    ex = catalog["exercises"]
    print(f"\n=== catalogo generado: {len(ex)} ejercicios ===")
    print("roles:   ", dict(collections.Counter(e["role"] for e in ex)))
    print("equipos: ", len({e["equipment"] for e in ex}), "distintos")
    for k, v in collections.Counter(e["equipment"] for e in ex).most_common():
        print(f"   {v:5d}  {k}")
    if unknown_targets:
        print("AVISO targets sin rol mapeado (->core):", sorted(unknown_targets))

    missing_guide = [e["id"] for e in ex if not e["guide_es"]]
    print(f"\nsin guia_es: {len(missing_guide)}")
    done = len(ex) - len(untranslated)
    print(f"nombres traducidos por completo: {done}/{len(ex)} ({100*done//len(ex)}%)")
    if untranslated and args.show_untranslated:
        print(f"-- muestra de nombres con palabras sin traducir ({len(untranslated)} en total):")
        for line in untranslated[: args.show_untranslated]:
            print("   ", line)

    # Comprobacion de regresion: los 41 curados deben salir intactos.
    new_by_id = {e["id"]: e for e in ex}
    faltan = [i for i in CURATED if i not in new_by_id]
    cambiados = [
        i for i, (nombre, rol) in CURATED.items()
        if i in new_by_id and (new_by_id[i]["name_es"] != nombre or new_by_id[i]["role"] != rol)
    ]
    print(f"\ncurados intactos: {len(CURATED) - len(faltan) - len(cambiados)}/{len(CURATED)}")
    if faltan:
        print("  AVISO ids que desaparecen:", faltan)
    if cambiados:
        print("  AVISO curados alterados:", cambiados)

    if args.dry_run:
        print("\n--dry-run: no se escribio nada")
        return

    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    size_mb = CATALOG_PATH.stat().st_size / 1_000_000
    print(f"\nescrito {CATALOG_PATH.relative_to(ROOT)} ({size_mb:.1f} MB)")

    if not args.no_media and tf:
        wanted = {e["image"].removeprefix("/media/") for e in ex}
        wanted |= {e["gif"].removeprefix("/media/") for e in ex}
        print(f"\nextrayendo media ({len(wanted)} archivos)...")
        copied, skipped = extract_media(tf, wanted)
        print(f"media: {copied} nuevos, {skipped} ya presentes")

    if tf:
        tf.close()
    print("\nlisto. Reinicia el backend: catalog.json esta cacheado con @lru_cache.")


if __name__ == "__main__":
    sys.exit(main())
