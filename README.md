# csv-summary

A command-line tool that reads a CSV file and writes a summary report to a text file.

## Usage

```
python csv_summary.py <file.csv> [output.txt]
```

If no output file is specified, it defaults to `<filename>_summary.txt`.

## Output

For each column:

- **Numeric**: count, missing, min, max, mean
- **Categorical**: count, missing, unique count, top 5 values with ASCII bar chart

## Example

```
$ python csv_summary.py sample.csv
Summary written to sample_summary.txt
```

```
Rows: 10
Columns (5): name, age, city, salary, department

city:
  type    : categorical
  count   : 10
  missing : 0
  unique  : 3
  top 5   :
    New York       ##############################  4
    San Francisco  ######################          3
    Chicago        ######################          3

salary:
  type   : numeric
  count  : 9
  missing: 1
  min    : 62000.0
  max    : 110000.0
  mean   : 84000.0000
```

## Requirements

Python 3.6+ — no external dependencies.
