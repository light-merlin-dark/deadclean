from typing import List


def normalize(values: List[int]) -> List[int]:
    scale = 10
    return [value * scale for value in values]


def ghost_function() -> str:
    return "unused"
