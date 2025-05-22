import json

import pandas as pd
from config import BASE_MODEL_NAME, MAX_LEN
from datasets import Dataset
from transformers import AutoTokenizer  # type: ignore

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)


def load_and_tokenize_dataset(json_path: str) -> Dataset:
    """
    Reads a JSON file containing a list of JSON objects, each with a text field,
    and optionally a label field as strings. Returns a 🤗 Dataset that already
    contains tokenized tensors. If inference_mode is True, it processes the dataset
    without label-related operations.
    """
    # Load the JSON data
    df = pd.read_json(json_path, orient="records")

    # Check required columns based on mode
    relevant_columns = ["text", "label"]
    df = df.dropna(subset=relevant_columns)

    # Create a mapping from string labels to integer labels
    label_mapping = {
        label: idx for idx, label in enumerate(sorted(df["label"].unique()))
    }

    # Save the label mapping to a JSON file
    with open("label_mapping.json", "w") as f:
        json.dump(label_mapping, f, indent=4)

    print(f"Label mapping saved to 'label_mapping.json': {label_mapping}")

    # Map the string labels to integer labels in the DataFrame
    df["label"] = df["label"].map(label_mapping)

    # Create a Dataset from the DataFrame
    dataset = Dataset.from_pandas(df[relevant_columns])

    def _tokenize(batch):
        return tokenizer(
            batch["text"], truncation=True, padding="max_length", max_length=MAX_LEN
        )

    # Apply tokenization to the dataset
    dataset = dataset.map(_tokenize, batched=True)

    # Set the format of the dataset to be compatible with PyTorch
    torch_columns = ["input_ids", "attention_mask", "label"]

    dataset.set_format(
        type="torch",
        columns=torch_columns,
        output_all_columns=False,
    )

    return dataset
