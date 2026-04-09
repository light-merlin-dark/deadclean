

def used_function(value: int) -> int:
    return value + 1


def dead_helper() -> int:
    total = 0
    for item in range(5):
        total += item
    return total


def main() -> None:
    print(used_function(3))


if __name__ == "__main__":
    main()
