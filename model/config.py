import torch

BASE_MODEL_NAME = "google-bert/bert-base-german-cased"
FINETUNED_MODEL_PATH = "zuko-model"
MAX_LEN = 512

DEVICE = torch.device("mps" if torch.backends.mps.is_available() else "cpu")