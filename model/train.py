import argparse

import torch
from config import BASE_MODEL_NAME, DEVICE, FINETUNED_MODEL_PATH
from data_module import load_and_tokenize_dataset
from evaluate import load as load_metric
from transformers.models.auto.modeling_auto import AutoModelForSequenceClassification
from transformers.trainer import Trainer
from transformers.training_args import TrainingArguments


def main(args):
    train_ds = load_and_tokenize_dataset(args.json)

    n_labels = len(set(train_ds["label"]))
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL_NAME,
        num_labels=n_labels,
        torch_dtype=torch.float32,  # float32 is fastest/stable on MPS today
    ).to(DEVICE)

    metric = load_metric("accuracy")

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = logits.argmax(-1)
        return metric.compute(predictions=preds, references=labels)

    training_args = TrainingArguments(
        output_dir="checkpoints",
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        num_train_epochs=10,
        learning_rate=2e-5,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_total_limit=2,
        push_to_hub=False,
        logging_dir="logs",
        # M1 specific:
        fp16=False,  # MPS does not yet support fp16 kernels well
        bf16=False,
    )

    splitter = train_ds.train_test_split(train_size=0.8, seed=42)
    train, eval = splitter["train"], splitter["test"]

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train,
        eval_dataset=eval,
        compute_metrics=compute_metrics,  # type: ignore
    )

    trainer.train()
    trainer.save_model(FINETUNED_MODEL_PATH)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--json",
        type=str,
        default="../data/train.json",
        help="Path to JSON with a list of objects containing 'text' and 'label' columns.",
    )
    main(parser.parse_args())
