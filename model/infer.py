import argparse
import json
from typing import Iterable, List, Tuple

import pandas as pd
from config import BASE_MODEL_NAME, DEVICE, FINETUNED_MODEL_PATH
from tqdm import tqdm
from transformers import (
    AutoModelForSequenceClassification,  # type: ignore
    AutoTokenizer,  # type: ignore
)
from transformers_interpret import SequenceClassificationExplainer

model = AutoModelForSequenceClassification.from_pretrained(FINETUNED_MODEL_PATH).to(DEVICE)
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
explainer = SequenceClassificationExplainer(
    model,
    tokenizer,
    attribution_type="lig"
)

def infer_and_explain(args):
    df = pd.read_json(args.json, orient="records")

    with open("label_mapping.json") as f:
        label2id = json.load(f)
        id2label = {v: k for k, v in label2id.items()}

    preds = []
    for _, row in tqdm(df.iterrows(), total=len(df)): # type: ignore
        text = row["text"]
        word_attributions = explainer(text, internal_batch_size=4)

        pred = id2label[explainer.predicted_class_index.item()] # type: ignore

        preds.append({
            "prediction": pred,
            "highlights": _attribution_to_html(text, word_attributions),
        })

    preds = pd.DataFrame(preds, index=df.index)
    df = pd.concat([df, preds], axis=1)
    df.to_json(args.out, orient="records", force_ascii=False)


def _attribution_to_html(text: str, attribution: list[tuple[str, float]]) -> str:
    attributions = [t for t in attribution if t[0] not in ["[CLS]", "[SEP]", "[PAD]"]]
    attributions = _align_wordpiece_tokens(text, attribution)

    html = []
    for word, score in attributions:
        # TODO: Find best threshold!
        if score >= 0.1:
            html.append(f"<span class='mark'>{word}</span>")
        else:
            html.append(word)
    
    return "".join(html)



SPECIAL_TOKEN_BRACKETS = {"[CLS]", "[SEP]", "[PAD]", "[MASK]", "[UNK]"}

def _align_wordpiece_tokens(
    original_text: str,
    token_score_pairs: Iterable[Tuple[str, float]],
    *,
    keep_special: bool = False,
) -> List[Tuple[str, float]]:
    """
    Re-attaches whitespace *and* any intervening punctuation that the tokenizer
    skipped (e.g. „ or “) to WordPiece tokens, so that re-concatenation yields
    the exact `original_text`.

    Returns
    -------
    aligned_pairs : list[(str, float)]
        Same length as the filtered token list, but each token now carries its
        original leading whitespace/punctuation.
    """
    ptr, n = 0, len(original_text)
    aligned_tokens: List[str] = []
    aligned_pairs: List[Tuple[str, float]] = []

    for tok, score in token_score_pairs:
        # 1) drop or keep wrapper tokens like [CLS] / [SEP]
        if tok in SPECIAL_TOKEN_BRACKETS or (tok.startswith("[") and tok.endswith("]")):
            if keep_special:
                aligned_pairs.append(("", score))
            continue

        literal = tok[2:] if tok.startswith("##") else tok

        # 2) gather *whitespace* first
        prefix = ""
        if not tok.startswith("##"):
            while ptr < n and original_text[ptr].isspace():
                prefix += original_text[ptr]
                ptr += 1

            # 3) if literal does not start here, absorb non-whitespace chars
            #    that the tokenizer chose to ignore (e.g. „, “, «, » …)
            if not original_text.startswith(literal, ptr):
                # find first subsequent match of the literal
                idx = original_text.find(literal, ptr)
                if idx == -1:
                    raise ValueError(
                        f"Expected '{literal}' after position {ptr}, "
                        f"but it never appears."
                    )
                prefix += original_text[ptr:idx]
                ptr = idx  # now literal starts at ptr

        # 4) sanity-check (still fails only on true mis-alignments)
        if not original_text.startswith(literal, ptr):
            snippet = original_text[ptr:ptr + 20].replace("\n", "\\n")
            raise ValueError(
                f"Expected '{literal}' at position {ptr}, but saw '{snippet}'."
            )

        ptr += len(literal)
        full_token = prefix + literal
        aligned_tokens.append(full_token)
        aligned_pairs.append((full_token, score))

    # 5) attach any trailing whitespace at the very end of the text
    if ptr < n:
        aligned_tokens[-1] += original_text[ptr:]
        tok, sc = aligned_pairs[-1]
        aligned_pairs[-1] = (aligned_tokens[-1], sc)

    # 6) final integrity check
    if "".join(aligned_tokens) != original_text:
        raise AssertionError("Alignment failed: reconstructed text differs.")

    return aligned_pairs


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=str, default="../data/test.json", help="Path to JSON with a list of objects containing 'text' and 'label' columns. 'label' is only used for writing later.")
    parser.add_argument("--out", type=str, default="../data/data.json", help="Path where the output JSON is written. It contains the text, label, prediction and highlighted text as HTML.")
    args = parser.parse_args()

    infer_and_explain(args)
