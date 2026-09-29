#!/usr/bin/env python3
"""Genera db/02_territorio.sql dai confini ufficiali del Comune di Milano.

Fonti (open data, licenza CC BY 4.0, dati.comune.milano.it):
  - ds964  NIL vigenti PGT 2030      -> quartiere (88 NIL)
  - ds379  Municipi                  -> municipio (9)

Uso:  python3 db/territorio/genera_territorio.py
I GeoJSON vengono scaricati in db/territorio/ se non sono già presenti.
Il Municipio di ogni NIL è quello che contiene la maggior parte di una griglia
di punti campionati dentro il NIL (i confini NIL e Municipi non coincidono sempre).
"""
import json
import pathlib
import urllib.request

QUI = pathlib.Path(__file__).resolve().parent
OUT = QUI.parent / "02_territorio.sql"

FONTI = {
    "nil.geojson": "https://dati.comune.milano.it/dataset/e8e765fc-d882-40b8-95d8-16ff3d39eb7c/resource/9c4e0776-56fc-4f3d-8a90-f4992a3be426/download/ds964_nil_wm.geojson",
    "municipi.geojson": "https://dati.comune.milano.it/dataset/36ba21c2-8b48-43ce-bbe1-e236a8a49ff6/resource/99ecd085-0b04-4fb2-a66e-9795694d4fc4/download/ds379_municipi_label.geojson",
}
DECIMALI = 6  # ~10 cm, sufficiente per il point-in-polygon


def carica(nome):
    percorso = QUI / nome
    if not percorso.exists():
        urllib.request.urlretrieve(FONTI[nome], percorso)
    dati = json.loads(percorso.read_text(encoding="utf-8"))
    assert dati.get("crs", {}).get("properties", {}).get("name") == "EPSG:4326", nome
    return dati["features"]


def arrotonda_anello(anello):
    out = []
    for x, y in anello:
        p = [round(x, DECIMALI), round(y, DECIMALI)]
        if not out or out[-1] != p:
            out.append(p)
    if out[0] != out[-1]:
        out.append(out[0])
    return out


def geometria_sql(geom):
    assert geom["type"] == "Polygon", geom["type"]
    g = {"type": "Polygon", "coordinates": [arrotonda_anello(a) for a in geom["coordinates"]]}
    testo = json.dumps(g, separators=(",", ":"))
    return f"ST_GeomFromGeoJSON('{testo}', 1, 4326)"


def dentro(x, y, anelli):
    """Ray casting in piano (sufficiente su aree di pochi km)."""
    esito = False
    for anello in anelli:
        for (x1, y1), (x2, y2) in zip(anello, anello[1:]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                esito = not esito
    return esito


def riquadro(anelli):
    xs = [x for x, _ in anelli[0]]
    ys = [y for _, y in anelli[0]]
    return min(xs), min(ys), max(xs), max(ys)


def municipio_prevalente(nil_anelli, municipi, passi=24):
    x0, y0, x1, y1 = riquadro(nil_anelli)
    voti = {}
    for i in range(passi):
        for j in range(passi):
            x = x0 + (x1 - x0) * (i + 0.5) / passi
            y = y0 + (y1 - y0) * (j + 0.5) / passi
            if not dentro(x, y, nil_anelli):
                continue
            for n, anelli, (mx0, my0, mx1, my1) in municipi:
                if mx0 <= x <= mx1 and my0 <= y <= my1 and dentro(x, y, anelli):
                    voti[n] = voti.get(n, 0) + 1
                    break
    return max(voti, key=voti.get)


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    municipi = sorted(carica("municipi.geojson"), key=lambda f: f["properties"]["MUNICIPIO"])
    nil = sorted(carica("nil.geojson"), key=lambda f: f["properties"]["ID_NIL"])
    assert len(municipi) == 9 and len(nil) == 88

    righe = [
        "-- Generato da db/territorio/genera_territorio.py — non modificare a mano.",
        "-- Fonte: Comune di Milano, open data (CC BY 4.0): ds379 Municipi, ds964 NIL vigenti PGT 2030.",
        "SET NAMES utf8mb4;",
        "",
    ]
    for f in municipi:
        n = f["properties"]["MUNICIPIO"]
        righe.append(
            f"INSERT INTO municipio (id, nome, confine) VALUES ({n}, 'Municipio {n}', {geometria_sql(f['geometry'])});"
        )

    geo_municipi = [
        (f["properties"]["MUNICIPIO"], f["geometry"]["coordinates"], riquadro(f["geometry"]["coordinates"]))
        for f in municipi
    ]
    righe.append("")
    for f in nil:
        p = f["properties"]
        id_mun = municipio_prevalente(f["geometry"]["coordinates"], geo_municipi)
        righe.append(
            f"INSERT INTO quartiere (id, nome, id_municipio, confine) VALUES "
            f"({p['ID_NIL']}, {sql_str(p['NIL'].strip())}, {id_mun}, {geometria_sql(f['geometry'])});"
        )
    righe.append("")
    OUT.write_text("\n".join(righe), encoding="utf-8")
    print(f"Scritto {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
