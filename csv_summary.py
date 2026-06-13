import csv
import sys
from collections import defaultdict
from pathlib import Path


def summarize_csv(filepath, out):
    with open(filepath, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        out.write("Empty file.\n")
        return

    columns = list(rows[0].keys())
    out.write(f"Rows: {len(rows)}\n")
    out.write(f"Columns ({len(columns)}): {', '.join(columns)}\n\n")

    for col in columns:
        values = [row[col] for row in rows if row[col].strip() != ""]
        missing = len(rows) - len(values)

        # Try numeric summary
        try:
            nums = [float(v) for v in values]
            out.write(f"{col}:\n")
            out.write(f"  type   : numeric\n")
            out.write(f"  count  : {len(nums)}\n")
            out.write(f"  missing: {missing}\n")
            out.write(f"  min    : {min(nums)}\n")
            out.write(f"  max    : {max(nums)}\n")
            out.write(f"  mean   : {sum(nums) / len(nums):.4f}\n")
        except ValueError:
            # Categorical summary
            counts = defaultdict(int)
            for v in values:
                counts[v] += 1
            top = sorted(counts.items(), key=lambda x: -x[1])[:5]
            out.write(f"{col}:\n")
            out.write(f"  type    : categorical\n")
            out.write(f"  count   : {len(values)}\n")
            out.write(f"  missing : {missing}\n")
            out.write(f"  unique  : {len(counts)}\n")
            out.write(f"  top 5   :\n")
            max_count = top[0][1]
            max_label = max(len(v) for v, _ in top)
            bar_width = 30
            for v, c in top:
                bar = "#" * round(c / max_count * bar_width)
                out.write(f"    {v:<{max_label}}  {bar:<{bar_width}}  {c}\n")
        out.write("\n")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        print("Usage: python csv_summary.py <file.csv> [output.txt]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) == 3 else Path(input_path).stem + "_summary.txt"

    with open(output_path, "w") as out:
        summarize_csv(input_path, out)

    print(f"Summary written to {output_path}")
