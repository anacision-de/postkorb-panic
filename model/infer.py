import argparse
import json
from typing import Iterable, List, Optional, Tuple

import pandas as pd
from config import BASE_MODEL_NAME, DEVICE, FINETUNED_MODEL_PATH
from tqdm import tqdm
from transformers import (
    AutoModelForSequenceClassification,  # type: ignore
    AutoTokenizer,  # type: ignore
)
from transformers_interpret import SequenceClassificationExplainer

model = AutoModelForSequenceClassification.from_pretrained(FINETUNED_MODEL_PATH).to(
    DEVICE
)
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
explainer = SequenceClassificationExplainer(model, tokenizer, attribution_type="lig")


def infer_and_explain(args):
    df = pd.read_json(args.json, orient="records")

    with open("label_mapping.json") as f:
        label2id = json.load(f)
        id2label = {v: k for k, v in label2id.items()}

    preds = []
    for _, row in tqdm(df.iterrows(), total=len(df)):  # type: ignore
        text = row["text"]
        word_attributions = explainer(text, internal_batch_size=4)

        pred = id2label[explainer.predicted_class_index.item()]  # type: ignore

        preds.append(
            {
                "prediction": pred,
                "highlights": _attribution_to_html(text, word_attributions),
            }
        )

    preds = pd.DataFrame(preds, index=df.index)
    df = pd.concat([df, preds], axis=1)
    df.to_json(args.out, orient="records", force_ascii=False)


def _attribution_to_html(text: str, attribution: list[tuple[str, float]]) -> str:
    attributions = [t for t in attribution if t[0] not in ["[CLS]", "[SEP]", "[PAD]"]]
    attributions = _align_wordpiece_tokens(text, attribution)

    # Filter some tokens like punctuation and some stopwords
    stopwords = [
        '"',
        "“",
        "-",
        ",",
        ";",
        "!",
        "?",
        ".",
        "@",
        "als",
        "auf",
        "aus",
        "bei",
        "beim",
        "bin",
        "da",
        "dabei",
        "das",
        "dass",
        "den",
        "der",
        "die",
        "dies",
        "diese",
        "diesem",
        "dieser",
        "dieses",
        "ein",
        "eine",
        "einem",
        "einen",
        "es",
        "für",
        "habe",
        "haben",
        "hallo",
        "hat",
        "hatte",
        "ich",
        "ihnen",
        "ihren",
        "ihrer",
        "ihre",
        "im",
        "in",
        "ist",
        "kann",
        "können",
        "könnte",
        "könnten",
        "mein",
        "meine",
        "meinem",
        "meinen",
        "meiner",
        "mich",
        "mir",
        "mit",
        "nur",
        "oder",
        "sehr",
        "sein",
        "sich",
        "sie",
        "um",
        "und",
        "uns",
        "unser",
        "unsere",
        "unserem",
        "unseren",
        "unserer",
        "von",
        "war",
        "wäre",
        "wären",
        "was",
        "werden",
        "wir",
        "wird",
        "wurde",
        "würde",
        "zu",
        "zum",
    ]
    attributions = [
        t if t[0].lower() not in stopwords else (t[0], None) for t in attributions
    ]

    # Sort attributions based on the score value in descending order
    sorted_attributions = sorted(attributions, key=lambda x: x[1] or 0, reverse=True)  # type: ignore
    max_score = max([a[1] for a in attributions if a[1]])

    # Get the top N attributions if their score is higher than T
    N = 10  # Define the maximum number of top attributions you want
    T = 0.35  # Define the (normalized) threshold score

    top_attributions = {
        attr for attr in sorted_attributions[:N] if attr[1] and attr[1] / max_score >= T
    }

    html = []
    for word, score in attributions:
        if (word, score) in top_attributions:
            html.append(f"<span class='mark'>{word}</span>")
        else:
            html.append(word)

    return "".join(html)


_SPECIAL = {"[CLS]", "[SEP]", "[PAD]", "[MASK]", "[UNK]"}


def _align_wordpiece_tokens(
    original_text: str,
    token_score_pairs: Iterable[Tuple[str, float]],
    *,
    keep_special: bool = False,
) -> List[Tuple[str, Optional[float]]]:
    """
    Re-attaches *separate* whitespace tokens and collapses multi-piece WordPiece
    words into single entries using the **maximum** score of their parts.

    Whitespace tokens receive a score of `None`.

    Parameters
    ----------
    original_text : str
        Exact text that went through the tokenizer.
    token_score_pairs : iterable[(str, float)]
        Model output: plain WordPiece tokens plus their scores.
    keep_special : bool, default False
        Keep BERT wrapper tokens like [CLS] (mapped to empty text).  When kept,
        their score is preserved; otherwise they are dropped.

    Returns
    -------
    aligned_pairs : list[(str, Optional[float])]
        Tokens exactly covering `original_text`, ready for highlighting.
    """
    ptr, n = 0, len(original_text)
    out: List[Tuple[str, Optional[float]]] = []

    # State for an ongoing multi-piece word
    word_buf: List[str] = []
    word_max: Optional[float] = None

    def flush_word():
        nonlocal word_buf, word_max
        if word_buf:
            full_word = "".join(word_buf)
            out.append((full_word, word_max))
            word_buf, word_max = [], None

    for tok, score in token_score_pairs:
        # ------------------------------------------------- special tokens ----
        if tok in _SPECIAL or (tok.startswith("[") and tok.endswith("]")):
            flush_word()
            if keep_special:
                out.append(("", score))
            continue

        # ------------------------------------------------- literal fragment --
        literal = tok[2:] if tok.startswith("##") else tok

        # ------------------------------------------------- leading whitespace
        if not tok.startswith("##"):
            # any spaces/newlines *before* the next visible char
            ws_start = ptr
            while ptr < n and original_text[ptr].isspace():
                ptr += 1
            if ptr > ws_start:  # at least one whitespace char
                flush_word()
                out.append((original_text[ws_start:ptr], None))

            # ------------------------------------------------ missing chars --
            if not original_text.startswith(literal, ptr):
                # swallow everything up to the literal (e.g. „, “, «, » ...)
                extra_start = ptr
                idx = original_text.find(literal, ptr)
                if idx == -1:
                    snippet = original_text[ptr : ptr + 20].replace("\n", "\\n")
                    raise ValueError(
                        f"Expected '{literal}' after pos {ptr}, saw '{snippet}'."
                    )
                flush_word()
                out.append((original_text[extra_start:idx], None))
                ptr = idx

        # ------------------------------------------------- sanity-check ------
        if not original_text.startswith(literal, ptr):
            snippet = original_text[ptr : ptr + 20].replace("\n", "\\n")
            raise ValueError(f"Expected '{literal}' at pos {ptr}, saw '{snippet}'.")

        # ------------------------------------------------- advance & collect -
        frag = original_text[ptr : ptr + len(literal)]
        ptr += len(literal)

        if tok.startswith("##"):  # continuation of current word
            if not word_buf:  # shouldn't happen
                raise AssertionError("Sub-token without a word start.")
            word_buf.append(frag)
            word_max = max(word_max, score) if word_max is not None else score
        else:  # new word or punctuation
            flush_word()
            # treat lone punctuation (comma, dot, etc.) as its own token
            if len(frag) == 1 and not frag.isalnum():
                out.append((frag, score))
            else:  # start new word
                word_buf = [frag]
                word_max = score

    # ------------------------------------------ flush leftovers & trailing ws
    flush_word()
    if ptr < n:  # trailing whitespace at EOF
        out.append((original_text[ptr:], None))

    # ------------------------------------------ integrity check -------------
    if "".join(tok for tok, _ in out) != original_text:
        raise AssertionError("Alignment failed: reconstructed text differs.")

    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--json",
        type=str,
        default="../data/test.json",
        help="Path to JSON with a list of objects containing 'text' and 'label' columns. 'label' is only used for writing later.",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="../data/data.json",
        help="Path where the output JSON is written. It contains the text, label, prediction and highlighted text as HTML.",
    )
    args = parser.parse_args()

    infer_and_explain(args)
