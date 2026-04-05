import argparse
import json
import shutil
from pathlib import Path


def clamp(v, lo, hi):
    return max(lo, min(v, hi))


def to_yolo_line(x1, y1, x2, y2, w, h, cls_idx):
    x1 = clamp(x1, 0.0, w)
    y1 = clamp(y1, 0.0, h)
    x2 = clamp(x2, 0.0, w)
    y2 = clamp(y2, 0.0, h)

    bw = x2 - x1
    bh = y2 - y1
    if bw <= 0 or bh <= 0 or w <= 0 or h <= 0:
        return None

    xc = (x1 + x2) / 2.0 / w
    yc = (y1 + y2) / 2.0 / h
    wn = bw / w
    hn = bh / h
    return f"{cls_idx} {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_class_map(train_data, test_data):
    categories = {}
    for data in (train_data, test_data):
        cats = data.get("categories", {})
        if isinstance(cats, dict):
            for k, v in cats.items():
                categories[int(k)] = v["name"]
        else:
            for c in cats:
                categories[int(c["id"])] = c["name"]

    ordered = sorted(categories.items(), key=lambda x: x[0])
    cat_id_to_idx = {cat_id: i for i, (cat_id, _) in enumerate(ordered)}
    names = [name for _, name in ordered]
    return cat_id_to_idx, names


def ensure_dirs(out_root):
    for split in ("train", "val"):
        (out_root / "images" / split).mkdir(parents=True, exist_ok=True)
        (out_root / "labels" / split).mkdir(parents=True, exist_ok=True)


def convert_split(data, images_root, out_root, split, cat_id_to_idx):
    images = data.get("images", [])
    anns_raw = data.get("annotations", {})
    deep_scores_style = isinstance(anns_raw, dict)

    anns_by_img = {}
    if deep_scores_style:
        for ann_id, ann in anns_raw.items():
            img_id = ann.get("img_id")
            if img_id is None:
                continue
            d = dict(ann)
            d["_ann_id"] = str(ann_id)
            anns_by_img.setdefault(int(img_id), []).append(d)
    else:
        for ann in anns_raw:
            anns_by_img.setdefault(int(ann["image_id"]), []).append(ann)

    converted = 0
    missing = 0

    for img in images:
        img_id = int(img["id"])
        rel_name = img.get("filename") or img.get("file_name")
        src = images_root / rel_name
        if not src.exists():
            missing += 1
            continue

        dst = out_root / "images" / split / Path(rel_name).name
        shutil.copyfile(src, dst)

        w = float(img.get("width", 0))
        h = float(img.get("height", 0))

        if deep_scores_style and img.get("ann_ids"):
            keep = {str(aid) for aid in img.get("ann_ids", [])}
            anns = [a for a in anns_by_img.get(img_id, []) if a.get("_ann_id") in keep]
        else:
            anns = anns_by_img.get(img_id, [])

        lines = []
        for ann in anns:
            if deep_scores_style:
                cat_ids = ann.get("cat_id", [])
                if not cat_ids:
                    continue
                cat_id = int(cat_ids[0])
                if cat_id not in cat_id_to_idx:
                    continue
                a_bbox = ann.get("a_bbox")
                if not a_bbox or len(a_bbox) != 4:
                    continue
                x1, y1, x2, y2 = [float(v) for v in a_bbox]
            else:
                cat_id = int(ann.get("category_id", -1))
                if cat_id not in cat_id_to_idx:
                    continue
                bbox = ann.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue
                x1, y1, bw, bh = [float(v) for v in bbox]
                x2, y2 = x1 + bw, y1 + bh

            line = to_yolo_line(x1, y1, x2, y2, w, h, cat_id_to_idx[cat_id])
            if line:
                lines.append(line)

        label_path = out_root / "labels" / split / f"{dst.stem}.txt"
        with open(label_path, "w", encoding="utf-8") as f:
            if lines:
                f.write("\n".join(lines) + "\n")

        converted += 1

    return converted, missing


def write_yaml(out_root, class_names):
    yaml_path = out_root / "dataset.yaml"
    root_unix = out_root.resolve().as_posix()
    lines = [
        f"path: {root_unix}",
        "train: images/train",
        "val: images/val",
        "names:",
    ]
    for i, n in enumerate(class_names):
        lines.append(f"  {i}: {n}")

    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return yaml_path


def main():
    ap = argparse.ArgumentParser(description="DeepScores Dense (JSON) -> YOLO")
    ap.add_argument("--source-root", required=True, help="Folder with images/, deepscores_train.json, deepscores_test.json")
    ap.add_argument("--output-root", required=True, help="YOLO output folder")
    args = ap.parse_args()

    src = Path(args.source_root)
    out = Path(args.output_root)

    train_json = src / "deepscores_train.json"
    test_json = src / "deepscores_test.json"
    images_root = src / "images"

    if not train_json.exists():
        raise FileNotFoundError(f"Missing {train_json}")
    if not test_json.exists():
        raise FileNotFoundError(f"Missing {test_json}")
    if not images_root.exists():
        raise FileNotFoundError(f"Missing {images_root}")

    train_data = load_json(train_json)
    test_data = load_json(test_json)

    cat_id_to_idx, names = build_class_map(train_data, test_data)
    ensure_dirs(out)

    n_train, miss_train = convert_split(train_data, images_root, out, "train", cat_id_to_idx)
    n_val, miss_val = convert_split(test_data, images_root, out, "val", cat_id_to_idx)
    yaml_path = write_yaml(out, names)

    print("Conversion completed")
    print(f"Train: {n_train} (missing: {miss_train})")
    print(f"Val:   {n_val} (missing: {miss_val})")
    print(f"Classes: {len(names)}")
    print(f"dataset.yaml: {yaml_path}")


if __name__ == "__main__":
    main()
