#!/usr/bin/env python3
"""Extract the Inventory Usage PDF into the app's searchable inventory dataset."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber


COLUMN_RANGES = {
    "itemNumber": (0, 70),
    "description": (70, 265),
    "groupSection": (265, 305),
    "branch": (305, 338),
    "ytdQuantitySold": (338, 388),
    "ytdSales": (388, 442),
    "ytdProfit": (442, 492),
    "grossMarginPercent": (492, 535),
    "turns": (535, 575),
    "onHand": (575, 625),
    "stockValue": (625, 680),
    "gmroi": (680, 730),
    "abcClass": (730, 792),
}

NUMBER_FIELDS = (
    "ytdQuantitySold",
    "ytdSales",
    "ytdProfit",
    "grossMarginPercent",
    "turns",
    "onHand",
    "stockValue",
    "gmroi",
)


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_number(value: str):
    cleaned = value.replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def words_by_line(page):
    words = [
        word
        for word in page.extract_words(x_tolerance=1, y_tolerance=2)
        if 138 <= word["top"] <= 560
    ]
    lines = []
    for word in sorted(words, key=lambda entry: (entry["top"], entry["x0"])):
        if not lines or abs(lines[-1][0] - word["top"]) > 2:
            lines.append([word["top"], [word]])
        else:
            lines[-1][1].append(word)
    return [line_words for _, line_words in lines]


def field_text(words, field):
    start, end = COLUMN_RANGES[field]
    return normalize_space(
        " ".join(
            word["text"]
            for word in words
            if start <= word["x0"] < end
        )
    )


def extract_items(pdf_path: Path):
    items = []
    current = None

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            for words in words_by_line(page):
                item_number = field_text(words, "itemNumber")
                description = field_text(words, "description")
                group_section = field_text(words, "groupSection")
                branch = field_text(words, "branch")
                abc_class = field_text(words, "abcClass")

                if item_number and group_section and branch and abc_class:
                    if current:
                        current["description"] = normalize_space(current["description"])
                        items.append(current)

                    current = {
                        "itemNumber": item_number,
                        "description": description,
                        "groupSection": group_section,
                        "branch": branch,
                        "abcClass": abc_class,
                        "sourcePage": page_number,
                    }
                    for field in NUMBER_FIELDS:
                        current[field] = parse_number(field_text(words, field))
                elif current:
                    continuation = normalize_space(
                        " ".join(
                            word["text"] for word in words if word["x0"] < 265
                        )
                    )
                    if not continuation:
                        continue
                    current["description"] = normalize_space(
                        f'{current["description"]} {continuation}'
                    )

    if current:
        current["description"] = normalize_space(current["description"])
        items.append(current)

    return items


def validate(items):
    invalid = [
        item
        for item in items
        if not item["itemNumber"]
        or not item["groupSection"]
        or not item["branch"]
    ]
    if invalid:
        sample = json.dumps(invalid[:3], indent=2)
        raise ValueError(f"Found {len(invalid)} incomplete rows. Sample:\n{sample}")

    duplicate_ids = set()
    seen = set()
    for item in items:
        key = item["itemNumber"]
        if key in seen:
            duplicate_ids.add(key)
        seen.add(key)
    if duplicate_ids:
        print(
            f"Warning: {len(duplicate_ids)} item numbers appear more than once; "
            "all report rows were retained."
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    items = extract_items(args.pdf)
    validate(items)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(items):,} inventory rows to {args.output}")


if __name__ == "__main__":
    main()
